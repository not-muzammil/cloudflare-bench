export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  ruleId: string;
  message: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  suggestion?: string;
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

