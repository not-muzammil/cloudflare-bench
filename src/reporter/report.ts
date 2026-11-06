import chalk from "chalk";
import { table } from "table";
import { Diagnostic, BenchmarkMetrics, CalibrationData } from "../types.js";

export function printDiagnostics(diagnostics: Diagnostic[]): void {
  if (diagnostics.length === 0) {
    console.log(chalk.green("✔ No Cloudflare CPU anti-patterns found!"));
    return;
  }

  console.log(chalk.bold(`\nFound ${diagnostics.length} diagnostic(s):\n`));

  for (const diag of diagnostics) {
    const sevTag =
      diag.severity === "error"
        ? chalk.bgRed.black(" ERROR ")
        : diag.severity === "warn"
        ? chalk.bgYellow.black(" WARN ")
        : chalk.bgBlue.black(" INFO ");

    console.log(`${sevTag} ${chalk.bold(diag.ruleId)}`);
    console.log(`  ${chalk.dim(diag.file)}:${chalk.cyan(diag.line)}:${chalk.cyan(diag.column)}`);
    console.log(`  ${diag.message}`);
    if (diag.suggestion) {
      console.log(`  ${chalk.green("→ Fix:")} ${diag.suggestion}`);
    }
    console.log();
  }
}

export function printCalibration(data: CalibrationData): void {
  console.log(chalk.bold.cyan("\n--- Machine Calibration Profile ---"));
  console.log(`  CPU:              ${chalk.yellow(data.cpuModel)}`);
  console.log(`  Platform:         ${data.platform}`);
  console.log(`  Local Score:      ${data.localScore} ms`);
  console.log(`  Baseline Edge:    ${data.baselineEdgeScore} ms`);
  console.log(
    `  Scale Factor:     ${chalk.bold.magenta(data.scaleFactor.toString())} (Local ms × ${data.scaleFactor} ≈ CF Edge ms)`
  );
  console.log(`  Calibrated At:    ${data.timestamp}\n`);
}

export function printBenchmarkReport(label: string, metrics: BenchmarkMetrics): void {
  console.log(chalk.bold.cyan(`\n--- Benchmark: ${label} ---`));

  const statusBadge =
    metrics.freeTierStatus === "PASS"
      ? chalk.bgGreen.black(" PASS (10ms Budget) ")
      : metrics.freeTierStatus === "WARN"
      ? chalk.bgYellow.black(" WARN (Tight Budget) ")
      : chalk.bgRed.black(" FAIL (Exceeds 10ms Limit) ");

  const data = [
    [chalk.bold("Metric"), chalk.bold("Value")],
    ["Iterations", metrics.iterations.toString()],
    ["Local Min", `${metrics.min} ms`],
    ["Local Mean", `${metrics.mean} ms`],
    ["Local Median", `${metrics.median} ms`],
    ["Local p95", `${metrics.p95} ms`],
    ["Local p99", `${metrics.p99} ms`],
    [
      chalk.bold("Estimated CF Edge p95"),
      metrics.estimatedEdgeP95 > 10
        ? chalk.red.bold(`${metrics.estimatedEdgeP95} ms`)
        : metrics.estimatedEdgeP95 >= 7
        ? chalk.yellow.bold(`${metrics.estimatedEdgeP95} ms`)
        : chalk.green.bold(`${metrics.estimatedEdgeP95} ms`),
    ],
    ["Cloudflare Free Tier Status", statusBadge],
  ];

  console.log(table(data));

  if (metrics.freeTierStatus === "FAIL") {
    console.log(
      chalk.red(
        `🚨 WARNING: Code has an estimated edge p95 of ${metrics.estimatedEdgeP95}ms, which exceeds Cloudflare's 10ms CPU limit.\nThis endpoint will trigger Error 1102 in production under peak load.`
      )
    );
  } else if (metrics.freeTierStatus === "WARN") {
    console.log(
      chalk.yellow(
        `⚠️ CAUTION: Estimated p95 of ${metrics.estimatedEdgeP95}ms is near the 10ms boundary. Consider caching or offloading compute.`
      )
    );
  } else {
    console.log(
      chalk.green(`🎉 Success: Safe for Cloudflare Workers Free Tier (< 10ms).`)
    );
  }
}

