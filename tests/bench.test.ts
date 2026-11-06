import { describe, it, expect } from "vitest";
import { analyzeSource } from "../src/analyzer/scanner.js";
import { benchmarkFunction } from "../src/runner/benchmark.js";
import { detectProject } from "../src/analyzer/detector.js";

describe("scanner", () => {
  it("detects forbidden crypto libraries", () => {
    const code = `import bcrypt from 'bcrypt';`;
    const diags = analyzeSource(code, "test.ts");
    expect(diags.some((d) => d.ruleId === "no-heavy-crypto")).toBe(true);
  });

  it("detects regex instantiations inside functions", () => {
    const code = `
      export function handler() {
        const regex = new RegExp("pattern", "g");
        return regex.test("test");
      }
    `;
    const diags = analyzeSource(code, "test.ts");
    expect(diags.some((d) => d.ruleId === "no-inline-regex")).toBe(true);
  });

  it("detects JSON parse inside loops", () => {
    const code = `
      for (let i = 0; i < 10; i++) {
        JSON.parse('{}');
      }
    `;
    const diags = analyzeSource(code, "test.ts");
    expect(diags.some((d) => d.ruleId === "no-json-in-loop")).toBe(true);
  });

  it("passes clean code", () => {
    const code = `
      const REGEX = /test/g;
      export function handler() {
        return REGEX.test("test");
      }
    `;
    const diags = analyzeSource(code, "test.ts");
    expect(diags.length).toBe(0);
  });
});

describe("runner", () => {
  it("benchmarks a fast function and returns PASS for 10ms budget", async () => {
    const fn = () => {
      let x = 0;
      for (let i = 0; i < 100; i++) x += i;
    };
    const res = await benchmarkFunction(fn, { iterations: 50, customScaleFactor: 2.0 });
    expect(res.iterations).toBe(50);
    expect(res.freeTierStatus).toBe("PASS");
  });
});

describe("detector", () => {
  it("detects project structure", async () => {
    const project = await detectProject();
    expect(project).toBeDefined();
    expect(project.name).toBe("cloudflare-bench");
  });
});
