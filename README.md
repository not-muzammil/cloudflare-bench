# cloudflare-bench

> Benchmark, analyze, and optimize your JavaScript/TypeScript applications to guarantee they stay within **Cloudflare's 10ms CPU Free Tier limit** (`Error 1102` prevention).

---

## ⚡ The Problem

Cloudflare Workers Free Tier enforces a strict **10ms CPU limit per request**.
- **I/O Wait time** (`fetch`, database queries, KV/R2) is **free** (the timer pauses).
- **Active JavaScript CPU execution** (JSON parsing, loops, sorting, cryptography) runs the clock.
- If your request exceeds 10ms active compute, Cloudflare abruptly terminates it with **Error 1102: Worker exceeded resource limits**.
- Developers' laptops are often 2x–5x faster than shared edge servers, masking CPU overages until production!

`cloudflare-bench` bridges this gap by calibrating your hardware against Cloudflare Edge baselines, scanning code for CPU-intensive anti-patterns, and estimating production p95 execution time.

---

## 🚀 Getting Started

### Installation

```bash
npm install -g cloudflare-bench
# or in your project:
npm install -D cloudflare-bench
```

---

## 🛠 Commands

### 1. Calibrate Your Machine
Run this once to calculate your hardware's speed ratio relative to Cloudflare Edge workers:
```bash
cf-bench calibrate
```
*Outputs your single-thread calibration score and scale factor (stored in `~/.cf-bench/calibration.json`).*

### 2. Static AST Scan
Scan your project files for code patterns known to exceed the 10ms free-tier limit:
```bash
cf-bench scan "src/**/*.ts"
```
Rules caught:
- `no-inline-regex`: Re-compiling `new RegExp()` inside request handlers or loops.
- `no-json-in-loop`: Repeated `JSON.parse` / `JSON.stringify` calls inside loops.
- `heavy-array-sort`: Unbounded in-memory `.sort()` inside handlers (suggests SQL `ORDER BY`).
- `hoist-intl-formatter`: In-handler construction of `Intl` formatters.
- `no-heavy-crypto`: Forbidden CPU-hogging crypto libraries (`bcrypt`, `argon2`).
- `avoid-heavy-date-libs`: Heavy packages like `moment` or `dayjs`.

### 3. Handler Benchmarking
Benchmark an exported endpoint or function directly:
```bash
cf-bench run ./dist/handler.js --export default --iterations 100
```
Generates a full statistical latency breakdown (p50, p95, p99) and estimates real-world Cloudflare Edge p95 against the 10ms budget:
- **PASS**: `< 7.0ms` estimated edge p95
- **WARN**: `7.0ms – 10.0ms` estimated edge p95
- **FAIL**: `> 10.0ms` (will trigger Error 1102 under load)

---

## 💻 Programmatic API

You can also integrate benchmarking directly into your test suites or CI pipeline:

```typescript
import { benchmarkFunction, analyzeSource } from "cloudflare-bench";

const metrics = await benchmarkFunction(async () => {
  await myHandler(req);
}, { iterations: 100 });

console.log(metrics.freeTierStatus); // "PASS" | "WARN" | "FAIL"
console.log(metrics.estimatedEdgeP95); // e.g. 4.2ms
```

---

## 📄 License

MIT © [Muzammil](https://github.com/not-muzammil)

