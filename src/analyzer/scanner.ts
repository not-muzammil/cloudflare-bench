import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { Diagnostic } from "../types.js";

// Handle default/named export interoperability for @babel/traverse in ESM
const traverse = (_traverse as any).default || _traverse;

export function analyzeSource(code: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check if file is explicitly marked to ignore cf-bench or is internal benchmark/test code
  if (
    code.includes("// cf-bench-ignore-file") ||
    filePath.includes("calibration") ||
    filePath.includes("runner") ||
    filePath.includes(".test.") ||
    filePath.includes(".spec.")
  ) {
    return diagnostics;
  }

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
  } catch {
    return diagnostics;
  }

  traverse(ast, {
    // Rule 1: RegExp constructor inside functions/loops
    NewExpression(path: any) {
      if (path.node.callee.name === "RegExp") {
        const inFunctionOrLoop = path.findParent((p: any) =>
          p.isFunction() || p.isLoop()
        );
        if (inFunctionOrLoop) {
          const loc = path.node.loc?.start || { line: 1, column: 0 };
          diagnostics.push({
            ruleId: "no-inline-regex",
            severity: "warn",
            file: filePath,
            line: loc.line,
            column: loc.column,
            message: "Constructing 'new RegExp()' in request/function scope consumes CPU re-compiling the regex pattern.",
            suggestion: "Hoist the RegExp literal or instance to module/top-level scope so it is compiled once.",
            fixable: true,
          });
        }
      }
    },

    // Rule 2: JSON.parse / JSON.stringify in loops
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (
        callee.type === "MemberExpression" &&
        callee.object.name === "JSON" &&
        (callee.property.name === "parse" || callee.property.name === "stringify")
      ) {
        const inLoop = path.findParent((p: any) => p.isLoop());
        if (inLoop) {
          const loc = path.node.loc?.start || { line: 1, column: 0 };
          diagnostics.push({
            ruleId: "no-json-in-loop",
            severity: "error",
            file: filePath,
            line: loc.line,
            column: loc.column,
            message: `JSON.${callee.property.name}() invoked inside a loop can easily exceed Cloudflare's 10ms CPU limit.`,
            suggestion: "Parse/serialize outside the loop or stream the JSON payload.",
            fixable: false,
          });
        }
      }

      // Rule 3: Array.prototype.sort on potentially large arrays in request handlers
      if (
        callee.type === "MemberExpression" &&
        callee.property.name === "sort"
      ) {
        const inFunction = path.findParent((p: any) => p.isFunction());
        if (inFunction) {
          const loc = path.node.loc?.start || { line: 1, column: 0 };
          diagnostics.push({
            ruleId: "heavy-array-sort",
            severity: "info",
            file: filePath,
            line: loc.line,
            column: loc.column,
            message: "In-memory Array.prototype.sort() in request handlers can spike isolate CPU time on large datasets.",
            suggestion: "Consider sorting at query-time (SQL ORDER BY in DB / D1) or caching the pre-sorted list.",
            fixable: false,
          });
        }
      }

      // Rule 4: Sync Intl / DateTimeFormat formatting inside handlers
      if (
        callee.type === "MemberExpression" &&
        callee.object?.name === "Intl"
      ) {
        const inFunction = path.findParent((p: any) => p.isFunction());
        if (inFunction) {
          const loc = path.node.loc?.start || { line: 1, column: 0 };
          diagnostics.push({
            ruleId: "hoist-intl-formatter",
            severity: "warn",
            file: filePath,
            line: loc.line,
            column: loc.column,
            message: `Constructing Intl.${callee.property.name} instances on every request causes repetitive engine initialization overhead.`,
            suggestion: "Hoist your Intl formatter instance to the module scope.",
            fixable: true,
          });
        }
      }
    },

    // Rule 5: Forbidden heavy crypto imports (bcrypt, argon2)
    ImportDeclaration(path: any) {
      const source = path.node.source.value;
      if (source === "bcrypt" || source === "bcryptjs" || source === "argon2") {
        const loc = path.node.loc?.start || { line: 1, column: 0 };
        diagnostics.push({
          ruleId: "no-heavy-crypto",
          severity: "error",
          file: filePath,
          line: loc.line,
          column: loc.column,
          message: `Importing '${source}' will crash Cloudflare Free Tier (bcrypt/argon2 typically require >50ms-100ms CPU).`,
          suggestion: "Use Web Crypto API (crypto.subtle) or @noble/hashes (PBKDF2) with tuned edge iteration counts.",
          fixable: false,
        });
      }

      if (source === "moment" || source === "dayjs") {
        const loc = path.node.loc?.start || { line: 1, column: 0 };
        diagnostics.push({
          ruleId: "avoid-heavy-date-libs",
          severity: "info",
          file: filePath,
          line: loc.line,
          column: loc.column,
          message: `'${source}' increases bundle parse time.`,
          suggestion: "Use native Date or Intl APIs on Cloudflare Workers.",
          fixable: false,
        });
      }
    },
  });

  return diagnostics;
}
