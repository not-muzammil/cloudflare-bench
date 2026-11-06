import { BenchmarkMetrics, CalibrationData } from "../types.js";
import { getCalibrationData } from "../calibration/calibrator.js";

function calculatePercentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export async function benchmarkFunction(
  fn: () => void | Promise<void>,
  options: { iterations?: number; customScaleFactor?: number } = {}
): Promise<BenchmarkMetrics> {
  const iterations = options.iterations ?? 100;

  // Warm up V8
  for (let i = 0; i < Math.min(10, iterations); i++) {
    await fn();
  }

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  const min = times[0];
  const max = times[times.length - 1];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = calculatePercentile(times, 50);
  const p90 = calculatePercentile(times, 90);
  const p95 = calculatePercentile(times, 95);
  const p99 = calculatePercentile(times, 99);

  let scaleFactor = options.customScaleFactor;
  if (!scaleFactor) {
    const calibration: CalibrationData = await getCalibrationData();
    scaleFactor = calibration.scaleFactor;
  }

  const estimatedEdgeP95 = Number((p95 * scaleFactor).toFixed(2));

  let freeTierStatus: "PASS" | "WARN" | "FAIL" = "PASS";
  if (estimatedEdgeP95 > 10.0) {
    freeTierStatus = "FAIL";
  } else if (estimatedEdgeP95 >= 7.0) {
    freeTierStatus = "WARN";
  }

  return {
    iterations,
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    median: Number(median.toFixed(3)),
    p90: Number(p90.toFixed(3)),
    p95: Number(p95.toFixed(3)),
    p99: Number(p99.toFixed(3)),
    estimatedEdgeP95,
    freeTierStatus,
  };
}
