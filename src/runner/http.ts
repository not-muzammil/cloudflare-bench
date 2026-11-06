import { HttpBenchmarkOptions, HttpBenchmarkResult, BenchmarkMetrics } from "../types.js";
import { getCalibrationData } from "../calibration/calibrator.js";

function calculatePercentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export async function benchmarkHttpEndpoint(
  options: HttpBenchmarkOptions
): Promise<HttpBenchmarkResult> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    iterations = 50,
    warmup = 5,
  } = options;

  // Warm up the endpoint
  for (let i = 0; i < warmup; i++) {
    try {
      await fetch(url, {
        method,
        headers,
        body: body ? body : undefined,
      });
    } catch {
      // Ignore initial warmup errors
    }
  }

  // Base ping test (network latency estimation)
  // Hit origin with an OPTIONS or HEAD or minimal request to gauge round-trip overhead
  let networkLatencyP50 = 0.5; // fallback baseline 0.5ms on localhost
  try {
    const pingTimes: number[] = [];
    const urlObj = new URL(url);
    const origin = urlObj.origin;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await fetch(origin, { method: "HEAD" }).catch(() => {});
      pingTimes.push(performance.now() - t0);
    }
    pingTimes.sort((a, b) => a - b);
    networkLatencyP50 = pingTimes[Math.floor(pingTimes.length / 2)] || 0.5;
  } catch {
    networkLatencyP50 = 0.5;
  }

  const times: number[] = [];
  const statusCodes: Record<number, number> = {};

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? body : undefined,
      });
      // Consume body to ensure complete transfer
      await res.text();
      const end = performance.now();
      const elapsed = Math.max(0.01, end - start);
      times.push(elapsed);

      statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
    } catch (err: any) {
      statusCodes[500] = (statusCodes[500] || 0) + 1;
      times.push(50); // penalty on failure
    }
  }

  times.sort((a, b) => a - b);

  const min = times[0];
  const max = times[times.length - 1];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = calculatePercentile(times, 50);
  const p90 = calculatePercentile(times, 90);
  const p95 = calculatePercentile(times, 95);
  const p99 = calculatePercentile(times, 99);

  const calibration = await getCalibrationData();

  // Subtract base network latency to approximate server active execution
  const serverTimeP95 = Math.max(0.1, p95 - networkLatencyP50);
  const estimatedEdgeP95 = Number((serverTimeP95 * calibration.scaleFactor).toFixed(2));

  let freeTierStatus: "PASS" | "WARN" | "FAIL" = "PASS";
  if (estimatedEdgeP95 > 10.0) {
    freeTierStatus = "FAIL";
  } else if (estimatedEdgeP95 >= 7.0) {
    freeTierStatus = "WARN";
  }

  const metrics: BenchmarkMetrics = {
    iterations,
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    p90: Number(p90.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    estimatedEdgeP95,
    freeTierStatus,
  };

  return {
    url,
    method,
    iterations,
    statusCodes,
    metrics,
    estimatedServerCpuP95: Number(serverTimeP95.toFixed(2)),
    networkLatencyP50: Number(networkLatencyP50.toFixed(2)),
  };
}

