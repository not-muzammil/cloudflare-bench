import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import ora from "ora";
import chalk from "chalk";

import { analyzeSource } from "./analyzer/scanner.js";
import { detectProject } from "./analyzer/detector.js";
import { calibrateMachine } from "./calibration/calibrator.js";
import {
  printCalibration,
  printDiagnostics,
  printBenchmarkReport,
  printHttpBenchmarkReport,
  generateMarkdownReport,
} from "./reporter/report.js";
import { benchmarkFunction } from "./runner/benchmark.js";
import { benchmarkHttpEndpoint } from "./runner/http.js";
import { Diagnostic } from "./types.js";

const program = new Command();

program
  .name("cf-bench")
  .description("Benchmark & optimize any app or API for Cloudflare's 10ms CPU Free Tier limit")
  .version("0.2.0");

// Command: calibrate
program
  .command("calibrate")
  .description("Calibrate this machine's single-thread CPU speed against Cloudflare Edge baselines")
  .action(async () => {
    const spinner = ora("Running micro-benchmarks to calibrate machine against Cloudflare Workers edge...").start();
    try {
      const data = await calibrateMachine();
      spinner.succeed("Calibration complete!");
      printCalibration(data);
    } catch (err: any) {
      spinner.fail(`Calibration failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: scan
program
  .command("scan [pattern]")
  .description("Scan files for CPU-intensive patterns, synchronous loops, and heavy libraries")
  .option("--ext <extensions>", "File extensions to scan", ".ts,.js,.mjs,.tsx,.jsx")
  .action(async (pattern, options) => {
    const project = await detectProject();
    const targetPattern = pattern || `${project.apiRoutesDir || "src"}/**/*.{ts,js,mjs,tsx,jsx}`;

    console.log(chalk.dim(`Detected framework: ${chalk.bold.cyan(project.type.toUpperCase())} (${project.name})`));
    const spinner = ora(`Scanning files matching '${targetPattern}'...`).start();

    try {
      const files = await glob(targetPattern, {
        ignore: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/.git/**", "**/.astro/**", "**/.next/**"],
        nodir: true,
      });

      if (files.length === 0) {
        spinner.info(`No files found matching '${targetPattern}'.`);
        return;
      }

      const allDiagnostics: Diagnostic[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf8");
          const diags = analyzeSource(content, file);
          allDiagnostics.push(...diags);
        } catch {
          // ignore unreadable files
        }
      }

      spinner.stop();
      printDiagnostics(allDiagnostics);

      const hasErrors = allDiagnostics.some((d) => d.severity === "error");
      if (hasErrors) {
        process.exitCode = 1;
      }
    } catch (err: any) {
      spinner.fail(`Scan error: ${err.message}`);
      process.exit(1);
    }
  });

// Command: run (in-process JS function benchmark)
program
  .command("run <file>")
  .description("Benchmark an exported handler or function from a given file")
  .option("-i, --iterations <count>", "Number of benchmark iterations", "100")
  .option("-e, --export <name>", "Exported function name to test", "default")
  .action(async (file, options) => {
    const resolvedPath = path.resolve(process.cwd(), file);
    const spinner = ora(`Loading module from ${resolvedPath}...`).start();

    try {
      const moduleUrl = pathToFileURL(resolvedPath).href;
      const mod = await import(moduleUrl);
      const fn = mod[options.export];

      if (typeof fn !== "function") {
        spinner.fail(
          `Export '${options.export}' in ${file} is not a function (found: ${typeof fn}).`
        );
        process.exit(1);
      }

      spinner.text = `Benchmarking function '${options.export}' (${options.iterations} iterations)...`;

      const iterations = parseInt(options.iterations, 10);
      const metrics = await benchmarkFunction(fn, { iterations });

      spinner.succeed("Benchmark completed!");
      printBenchmarkReport(`${file} [${options.export}]`, metrics);

      if (metrics.freeTierStatus === "FAIL") {
        process.exitCode = 1;
      }
    } catch (err: any) {
      spinner.fail(`Benchmark failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: http (universal black-box HTTP endpoint benchmark)
program
  .command("http <url>")
  .description("Benchmark any live endpoint over HTTP (framework-agnostic: Next.js, Astro, Hono, Rust Wasm)")
  .option("-X, --method <method>", "HTTP Method", "GET")
  .option("-i, --iterations <count>", "Number of requests", "50")
  .option("-d, --data <json>", "JSON Request body string")
  .option("-H, --header <headers...>", "Headers in 'Key: Value' format")
  .action(async (url, options) => {
    const headers: Record<string, string> = {};
    if (options.header) {
      for (const h of options.header) {
        const [k, ...v] = h.split(":");
        if (k && v.length) {
          headers[k.trim()] = v.join(":").trim();
        }
      }
    }

    const spinner = ora(`Benchmarking endpoint ${options.method} ${url} (${options.iterations} requests)...`).start();

    try {
      const result = await benchmarkHttpEndpoint({
        url,
        method: options.method.toUpperCase(),
        headers,
        body: options.data,
        iterations: parseInt(options.iterations, 10),
      });

      spinner.succeed("HTTP Benchmark completed!");
      printHttpBenchmarkReport(result);

      if (result.metrics.freeTierStatus === "FAIL") {
        process.exitCode = 1;
      }
    } catch (err: any) {
      spinner.fail(`HTTP Benchmark failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: ci (Generate markdown PR report for CI/CD)
program
  .command("ci")
  .description("Run full audit and output Markdown comment for GitHub Actions / CI")
  .option("-o, --output <file>", "Markdown output file", "cf-bench-report.md")
  .action(async (options) => {
    const project = await detectProject();
    const spinner = ora(`Running CI audit on ${project.name}...`).start();

    try {
      const targetPattern = `${project.apiRoutesDir || "src"}/**/*.{ts,js,mjs,tsx,jsx}`;
      const files = await glob(targetPattern, {
        ignore: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/.git/**", "**/.astro/**", "**/.next/**"],
        nodir: true,
      });

      const allDiagnostics: Diagnostic[] = [];
      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf8");
          const diags = analyzeSource(content, file);
          allDiagnostics.push(...diags);
        } catch {}
      }

      const md = generateMarkdownReport(project.name, allDiagnostics);
      await fs.writeFile(path.resolve(process.cwd(), options.output), md, "utf8");

      spinner.succeed(`CI audit complete. Report written to ${options.output}`);
      if (allDiagnostics.some((d) => d.severity === "error")) {
        process.exitCode = 1;
      }
    } catch (err: any) {
      spinner.fail(`CI audit failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
