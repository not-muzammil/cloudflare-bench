# cloudflare-bench

> 🚀 Benchmark, analyze, and optimize any app, framework, or API to guarantee it stays within **Cloudflare's 10ms CPU Free Tier limit** (`Error 1102` prevention).

---

## ⚡ Why This Exists

Cloudflare Workers Free Tier enforces a strict **10ms CPU time limit per request**.
- **I/O Wait time** (`fetch`, database queries, KV/R2) is **free** (the timer pauses).
- **Active JavaScript CPU execution** (JSON parsing, loops, sorting, cryptography) runs the clock.
- If your request exceeds 10ms active compute, Cloudflare abruptly terminates it with **Error 1102: Worker exceeded resource limits**.
- Developers' laptops are often 2x–5x faster than shared edge servers, masking CPU overages until production!

`cloudflare-bench` bridges this gap:
1. **Calibrates** your local hardware speed against Cloudflare Edge servers.
2. **Statically scans** code for CPU-intensive anti-patterns (regex recompilation, JSON in loops, forbidden crypto).
3. **Benchmarks live HTTP endpoints** across any framework (Astro, Next.js, Hono, Remix, or Rust/Wasm).
4. **Automates CI/CD checks** with markdown PR comments to block PRs that exceed the 10ms budget.

---

## 📦 Installation

```bash
# Global CLI
npm install -g cloudflare-bench

# Or as a project devDependency
npm install -D cloudflare-bench
```

Or run directly with `npx`:
```bash
npx cloudflare-bench scan
```

---

## 🛠 Commands & Features

### 1. Calibrate Your Machine
Run this once to calculate your hardware's speed ratio relative to Cloudflare Edge workers:
```bash
cf-bench calibrate
```
*Outputs your single-thread calibration score and scale factor (stored in `~/.cf-bench/calibration.json`).*

### 2. Universal Static AST Scanner
Scans your project for code patterns known to exceed the 10ms free-tier limit. Auto-detects frameworks (Astro, Next.js, Hono, Remix, Workers):
```bash
cf-bench scan
```
**Patterns caught:**
- `no-inline-regex`: Re-compiling `new RegExp()` inside request handlers or loops.
- `no-json-in-loop`: Repeated `JSON.parse` / `JSON.stringify` inside loops.
- `heavy-array-sort`: Unbounded in-memory `.sort()` inside handlers (suggests SQL `ORDER BY`).
- `hoist-intl-formatter`: In-handler construction of `Intl` formatters.
- `no-heavy-crypto`: Forbidden CPU-hogging crypto libraries (`bcrypt`, `argon2`).
- `avoid-heavy-date-libs`: Heavy packages like `moment` or `dayjs`.

### 3. Black-Box HTTP Endpoint Benchmark
Benchmark any live endpoint (local dev server or remote staging). Completely framework and language-agnostic:
```bash
# Benchmark an Astro/Next.js/Hono endpoint over HTTP
cf-bench http http://localhost:8787/api/orders -i 50

# Benchmark a POST request with payload
cf-bench http http://localhost:8787/api/checkout -X POST -d '{"cartId":"123"}'
```
*Features I/O latency subtraction so network ping doesn't distort your CPU budget estimate.*

### 4. Direct In-Process Function Benchmark
Benchmark an exported handler or function directly:
```bash
cf-bench run ./dist/handler.js --export default --iterations 100
```

### 5. CI/CD GitHub Action Mode
Generate an audit report for pull requests in CI:
```bash
cf-bench ci --output cf-bench-report.md
```
*Exits with code 1 if critical free-tier CPU anti-patterns or limit breaches are found.*

---

## 💻 Programmatic API

You can also integrate benchmarking directly into your test suites or CI scripts:

```typescript
import { benchmarkFunction, benchmarkHttpEndpoint, analyzeSource } from "cloudflare-bench";

// 1. Benchmark an HTTP route
const result = await benchmarkHttpEndpoint({
  url: "http://localhost:8787/api/orders",
  iterations: 50,
});
console.log(result.metrics.freeTierStatus); // "PASS" | "WARN" | "FAIL"
console.log(result.metrics.estimatedEdgeP95); // e.g. 5.2ms

// 2. Scan code dynamically
const diags = analyzeSource(codeString, "src/api/handler.ts");
```

---

## 📄 License

MIT © [Muzammil](https://github.com/not-muzammil)
