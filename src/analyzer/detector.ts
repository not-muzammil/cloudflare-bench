import fs from "node:fs/promises";
import path from "node:path";

export interface ProjectInfo {
  type: "astro" | "nextjs" | "hono" | "remix" | "workers" | "unknown";
  name: string;
  apiRoutesDir?: string;
  hasWrangler: boolean;
}

export async function detectProject(rootDir: string = process.cwd()): Promise<ProjectInfo> {
  let pkg: any = {};
  try {
    const raw = await fs.readFile(path.join(rootDir, "package.json"), "utf8");
    pkg = JSON.parse(raw);
  } catch {
    // not a node project
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  let hasWrangler = false;

  try {
    await fs.access(path.join(rootDir, "wrangler.toml"));
    hasWrangler = true;
  } catch {
    hasWrangler = !!deps["wrangler"];
  }

  if (deps["astro"]) {
    return {
      type: "astro",
      name: pkg.name || "Astro Project",
      apiRoutesDir: "src/pages/api",
      hasWrangler,
    };
  }

  if (deps["next"]) {
    return {
      type: "nextjs",
      name: pkg.name || "Next.js Project",
      apiRoutesDir: "app/api",
      hasWrangler,
    };
  }

  if (deps["hono"]) {
    return {
      type: "hono",
      name: pkg.name || "Hono Project",
      apiRoutesDir: "src",
      hasWrangler,
    };
  }

  if (deps["@remix-run/cloudflare"]) {
    return {
      type: "remix",
      name: pkg.name || "Remix Project",
      apiRoutesDir: "app/routes",
      hasWrangler,
    };
  }

  if (hasWrangler) {
    return {
      type: "workers",
      name: pkg.name || "Cloudflare Worker",
      apiRoutesDir: "src",
      hasWrangler: true,
    };
  }

  return {
    type: "unknown",
    name: pkg.name || "Generic Project",
    hasWrangler,
  };
}

