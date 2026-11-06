import chalk from "chalk";
import { table } from "table";
import { Diagnostic, BenchmarkMetrics, CalibrationData, HttpBenchmarkResult } from "../types.js";

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

export function printHttpBenchmarkReport(res: HttpBenchmarkResult): void {
  console.log(chalk.bold.cyan(`\n--- HTTP Endpoint Benchmark: ${res.method} ${res.url} ---`));

  const statusBadge =
    res.metrics.freeTierStatus === "PASS"
      ? chalk.bgGreen.black(" PASS (10ms Budget) ")
      : res.metrics.freeTierStatus === "WARN"
      ? chalk.bgYellow.black(" WARN (Tight Budget) ")
      : chalk.bgRed.black(" FAIL (Exceeds 10ms Limit) ");

  const statusSummary = Object.entries(res.statusCodes)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");

  const data = [
    [chalk.bold("Metric"), chalk.bold("Value")],
    ["Target URL", res.url],
    ["HTTP Method", res.method],
    ["Iterations", res.iterations.toString()],
    ["Status Codes", statusSummary],
    ["Est. Base Network Latency (p50)", `${res.networkLatencyP50} ms`],
    ["Est. Server CPU (p95 minus Network)", `${res.estimatedServerCpuP95} ms`],
    ["Total Roundtrip p95", `${res.metrics.p95} ms`],
    [
      chalk.bold("Estimated CF Edge CPU p95"),
      res.metrics.estimatedEdgeP95 > 10
        ? chalk.red.bold(`${res.metrics.estimatedEdgeP95} ms`)
        : res.metrics.estimatedEdgeP95 >= 7
        ? chalk.yellow.bold(`${res.metrics.estimatedEdgeP95} ms`)
        : chalk.green.bold(`${res.metrics.estimatedEdgeP95} ms`),
    ],
    ["Cloudflare Free Tier Status", statusBadge],
  ];

  console.log(table(data));

  if (res.metrics.freeTierStatus === "FAIL") {
    console.log(
      chalk.red(
        `🚨 WARNING: Estimated Edge CPU p95 is ${res.metrics.estimatedEdgeP95}ms (>10ms limit).\nThis endpoint is at high risk of Error 1102 on Cloudflare Free Tier!`
      )
    );
  } else if (res.metrics.freeTierStatus === "WARN") {
    console.log(
      chalk.yellow(
        `⚠️ CAUTION: Estimated Edge CPU p95 is ${res.metrics.estimatedEdgeP95}ms. Close to 10ms.`
      )
    );
  } else {
    console.log(
      chalk.green(
        `🎉 Success: Endpoint is edge-optimized (< 10ms CPU) and safe for Cloudflare Free Tier.`
      )
    );
  }
}

export function generateMarkdownReport(
  projectName: string,
  diagnostics: Diagnostic[],
  metrics?: BenchmarkMetrics
): string {
  let md = `# Cloudflare CPU Free Tier Audit Report: ${projectName}\n\n`;

  if (metrics) {
    md += `## Benchmark Verdict: **${metrics.freeTierStatus}**\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Iterations | ${metrics.iterations} |\n`;
    md += `| Local p95 | ${metrics.p95} ms |\n`;
    md += `| Estimated CF Edge p95 | **${metrics.estimatedEdgeP95} ms** (10ms budget) |\n\n`;
  }

  md += `## Static Anti-Pattern Findings (${diagnostics.length})\n\n`;
  if (diagnostics.length === 0) {
    md += `✅ No anti-patterns detected. Code is edge-optimized!\n`;
  } else {
    md += `| Severity | Rule | Location | Suggestion |\n|---|---|---|---|\n`;
    for (const d of diagnostics) {
      md += `| ${d.severity.toUpperCase()} | \`${d.ruleId}\` | \`${d.file}:${d.line}\` | ${d.suggestion || d.message} |\n`;
    }
  }

  return md;
}
