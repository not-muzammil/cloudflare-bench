import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import ora from "ora";
import chalk from "chalk";

import { analyzeSource } from "./analyzer/scanner.js";
import { calibrateMachine, getCalibrationData } from "./calibration/calibrator.js";
import { printCalibration, printDiagnostics, printBenchmarkReport } from "./reporter/report.js";
import { benchmarkFunction } from "./runner/benchmark.js";
import { Diagnostic } from "./types.js";

const program = new Command();

program
  .name("cf-bench")
  .description("Benchmark & analyze code for Cloudflare's 10ms CPU Free Tier limit")
  .version("0.1.0");

// Command 1: calibrate
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

// Command 2: scan
program
  .command("scan [pattern]")
  .description("Scan files for CPU-intensive patterns, synchronous loops, and heavy libraries")
  .option("--ext <extensions>", "File extensions to scan", ".ts,.js,.mjs,.tsx,.jsx")
  .action(async (pattern = "**/*.{ts,js,mjs,tsx,jsx}", options) => {
    const spinner = ora("Scanning codebase for Cloudflare CPU anti-patterns...").start();

    try {
      const files = await glob(pattern, {
        ignore: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/.git/**"],
        nodir: true,
      });

      if (files.length === 0) {
        spinner.info(`No files found matching '${pattern}'.`);
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

// Command 3: run (benchmark an exported function from a file)
program
  .command("run <file>")
  .description("Benchmark an exported handler or function from a given file")
  .option("-i, --iterations <count>", "Number of benchmark iterations", "100")
  .option("-e, --export <name>", "Exported function name to test", "default")
  .action(async (file, options) => {
    const resolvedPath = path.resolve(process.cwd(), file);
    const spinner = ora(`Loading module from ${resolvedPath}...`).start();

    try {
      const mod = await import(resolvedPath);
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

program.parse(process.argv);
