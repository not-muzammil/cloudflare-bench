# cloudflare-bench

> 🚀 Benchmark, analyze, and optimize any app, framework, or API to guarantee it stays within **Cloudflare's 10ms CPU Free Tier limit** (`Error 1102` prevention).

---

## ⚡ Why This Exists

Cloudflare Workers Free Tier enforces a strict **10ms CPU time limit per request**.
- **I/O Wait time** (`fetch`, database queries, KV/R2) is **free** (the timer pauses).
- **Active JavaScript CPU execution** (JSON parsing, loops, sorting, cryptography) runs the clock.
- If your request exceeds 10ms active compute, Cloudflare abruptly terminates it with **Error 1102: Worker exceeded resource limits**.
- Laptops are often 2x–5x faster than shared edge servers, masking CPU overages until production!

`cloudflare-bench` bridges this gap:
1. **Calibrates** your local hardware speed against Cloudflare Edge servers.
2. **Statically scans** code for CPU-intensive anti-patterns (regex recompilation, JSON in loops, forbidden crypto).
3. **Benchmarks live HTTP endpoints** across any framework, port, or language.
4. **Automates CI/CD checks** with markdown PR comments to block PRs that exceed the 10ms budget.

---

## 📦 Installation & Quick Start

```bash
# Run instantly with npx anywhere
npx cloudflare-bench scan

# Or install globally
npm install -g cloudflare-bench
```

---

## 🛠 Commands & Features

### 1. Universal Scanner (`cf-bench scan`)
Scan any project, directory, or single file. Defaults to `.` (the current folder):

```bash
# Scan whatever folder you are currently in
cf-bench scan

# Scan a specific directory
cf-bench scan ./src
cf-bench scan ./api

# Scan a single file
cf-bench scan ./src/utils/crypto.ts
```

**Patterns caught:**
- `no-inline-regex`: Re-compiling `new RegExp()` inside request handlers or loops.
- `no-json-in-loop`: Repeated `JSON.parse` / `JSON.stringify` inside loops.
- `heavy-array-sort`: Unbounded in-memory `.sort()` inside handlers (suggests SQL `ORDER BY`).
- `hoist-intl-formatter`: In-handler construction of `Intl` formatters.
- `no-heavy-crypto`: Forbidden CPU-hogging crypto libraries (`bcrypt`, `argon2`).
- `avoid-heavy-date-libs`: Heavy packages like `moment` or `dayjs`.

---

### 2. Live HTTP Endpoint Benchmark (`cf-bench http <url>`)
Benchmark any URL, any port, any framework (Astro, Next.js, Hono, Express, Python, or Rust Wasm):

```bash
# Works on any URL / any port:
cf-bench http http://localhost:3000/api/users
cf-bench http http://localhost:4321/api/search
cf-bench http http://localhost:8080/compute

# With custom HTTP method and payload:
cf-bench http http://localhost:3000/api/data -X POST -d '{"query":"sample"}'
```
*Automatically subtracts network latency so ping/network roundtrip does not falsely trigger a CPU limit failure.*

---

### 3. Hardware Calibration (`cf-bench calibrate`)
Run this once so the tool knows your computer's speed compared to Cloudflare Workers edge servers:
```bash
cf-bench calibrate
```
*Outputs your single-thread calibration score and scale factor (saved to `~/.cf-bench/calibration.json`).*

---

### 4. Direct In-Process Function Benchmark (`cf-bench run <file>`)
Benchmark an exported function without starting a server:
```bash
cf-bench run ./src/utils/pricing.js --export calculateDiscount --iterations 100
```

---

### 5. CI/CD GitHub Action Mode (`cf-bench ci`)
Run full audits in your CI pipeline and output a Markdown summary:
```bash
cf-bench ci ./src --output report.md
```

---

## 📄 License

MIT © [Muzammil](https://github.com/not-muzammil)
