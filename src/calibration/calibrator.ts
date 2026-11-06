import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CalibrationData } from "../types.js";

const CALIBRATION_FILE = path.join(os.homedir(), ".cf-bench", "calibration.json");

// A synthetic workload that matches typical JS compute:
// recursive hashing/math, JSON parsing, and object property iterations.
function runCalibrationWorkload(): number {
  const start = performance.now();

  let sum = 0;
  for (let i = 0; i < 50000; i++) {
    sum += Math.sqrt(i) * Math.sin(i);
  }

  const dummy = { a: 1, b: 2, c: "test", list: [1, 2, 3, 4, 5] };
  for (let i = 0; i < 2000; i++) {
    const serialized = JSON.stringify(dummy);
    JSON.parse(serialized);
  }

  const end = performance.now();
  return end - start;
}

// Baseline edge score: On standard Cloudflare Workers AMD EPYC / ARM edge nodes,
// this identical workload clocks in at ~18.5ms average.
const BASELINE_EDGE_SCORE_MS = 18.5;

export async function calibrateMachine(): Promise<CalibrationData> {
  // Warm up V8 JIT
  for (let i = 0; i < 3; i++) {
    runCalibrationWorkload();
  }

  // Measure 10 runs
  const runs: number[] = [];
  for (let i = 0; i < 10; i++) {
    runs.push(runCalibrationWorkload());
  }

  const localScore = runs.reduce((a, b) => a + b, 0) / runs.length;
  // If local runs faster (e.g. 10ms vs 18.5ms), scaleFactor > 1 (e.g. 1.85)
  // If local runs slower (e.g. 25ms vs 18.5ms), scaleFactor < 1 (e.g. 0.74)
  const scaleFactor = Number((BASELINE_EDGE_SCORE_MS / localScore).toFixed(3));

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : "Unknown CPU";

  const data: CalibrationData = {
    cpuModel,
    platform: `${os.platform()} ${os.arch()}`,
    timestamp: new Date().toISOString(),
    localScore: Number(localScore.toFixed(3)),
    baselineEdgeScore: BASELINE_EDGE_SCORE_MS,
    scaleFactor: Math.max(0.5, scaleFactor),
  };

  await fs.mkdir(path.dirname(CALIBRATION_FILE), { recursive: true });
  await fs.writeFile(CALIBRATION_FILE, JSON.stringify(data, null, 2), "utf8");

  return data;
}

export async function getCalibrationData(): Promise<CalibrationData> {
  try {
    const raw = await fs.readFile(CALIBRATION_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    // If not calibrated yet, calibrate automatically
    return await calibrateMachine();
  }
}

