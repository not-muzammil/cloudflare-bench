export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  ruleId: string;
  message: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  suggestion?: string;
  fixable?: boolean;
}

export interface CalibrationData {
  cpuModel: string;
  platform: string;
  timestamp: string;
  localScore: number;
  baselineEdgeScore: number;
  scaleFactor: number; // localMs * scaleFactor ≈ edgeMs
}

export interface BenchmarkMetrics {
  iterations: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  estimatedEdgeP95: number;
  freeTierStatus: "PASS" | "WARN" | "FAIL";
}

export interface HttpBenchmarkOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  iterations?: number;
  concurrency?: number;
  warmup?: number;
}

export interface HttpBenchmarkResult {
  url: string;
  method: string;
  iterations: number;
  statusCodes: Record<number, number>;
  metrics: BenchmarkMetrics;
  estimatedServerCpuP95: number;
  networkLatencyP50: number;
}
