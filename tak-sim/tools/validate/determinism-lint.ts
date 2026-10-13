/**
 * Determinism lint — SPEC/05_System_Architecture.md §3 (invariant I1):
 *
 * "Banned anywhere reachable from the run loop: Date.now(), performance.now()
 * (except in the telemetry annotation path, which is lint-exempted by
 * explicit allowlist), Math.random(), crypto.getRandomValues(),
 * crypto.randomUUID(), Object.keys iteration where order matters,
 * Array.prototype.sort without a comparator, Intl formatting inside logic,
 * and any network read."
 *
 * A small, dependency-free static scanner rather than a custom ESLint
 * plugin — SPEC/05 §13 names "minimal dependency surface" as a mitigation
 * for non-determinism risk, and a regex scan over `app/engine/**` is
 * sufficient for what this needs to catch. An explicit allowlist comment
 * (`determinism-lint-allow: <reason>`) on the same or preceding line
 * exempts a match, mirroring the spec's own "lint-exempted by explicit
 * allowlist" carve-out for the telemetry annotation path.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly rule: string;
}

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
}

const RULES: readonly Rule[] = [
  { name: "no-date-now", pattern: /\bDate\.now\s*\(/ },
  { name: "no-bare-new-date", pattern: /\bnew Date\s*\(\s*\)/ },
  { name: "no-performance-now", pattern: /\bperformance\.now\s*\(/ },
  { name: "no-math-random", pattern: /\bMath\.random\s*\(/ },
  { name: "no-crypto-random-values", pattern: /\bcrypto\.getRandomValues\s*\(/ },
  { name: "no-crypto-random-uuid", pattern: /\bcrypto\.randomUUID\s*\(/ },
  { name: "no-unordered-object-keys", pattern: /\bObject\.(keys|values|entries)\s*\(/ },
  { name: "no-sort-without-comparator", pattern: /\.sort\s*\(\s*\)/ },
  { name: "no-intl", pattern: /\bIntl\./ },
  { name: "no-network-fetch", pattern: /\bfetch\s*\(/ },
  { name: "no-network-xhr", pattern: /\bnew XMLHttpRequest\s*\(/ },
  { name: "no-network-websocket", pattern: /\bnew WebSocket\s*\(/ },
];

const ALLOW_COMMENT = /determinism-lint-allow\s*:/;

/**
 * Blanks out comments and string/template contents (replacing characters
 * with spaces, preserving newlines) so the banned-API regexes only match
 * real code — not JSDoc prose that mentions a banned API by name, and not
 * a URL such as `"https://..."` that would otherwise look like a line
 * comment. Line numbers are preserved exactly.
 */
function stripCommentsAndStrings(source: string): string {
  type State = "CODE" | "LINE_COMMENT" | "BLOCK_COMMENT" | "STRING_SINGLE" | "STRING_DOUBLE" | "TEMPLATE";
  let state: State = "CODE";
  let out = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    const next = source[i + 1];

    if (state === "CODE") {
      if (c === "/" && next === "/") {
        state = "LINE_COMMENT";
        out += "  ";
        i++;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "BLOCK_COMMENT";
        out += "  ";
        i++;
        continue;
      }
      if (c === "'") {
        state = "STRING_SINGLE";
        out += " ";
        continue;
      }
      if (c === '"') {
        state = "STRING_DOUBLE";
        out += " ";
        continue;
      }
      if (c === "`") {
        state = "TEMPLATE";
        out += " ";
        continue;
      }
      out += c;
      continue;
    }

    if (state === "LINE_COMMENT") {
      if (c === "\n") {
        state = "CODE";
        out += "\n";
      } else {
        out += " ";
      }
      continue;
    }

    if (state === "BLOCK_COMMENT") {
      if (c === "*" && next === "/") {
        state = "CODE";
        out += "  ";
        i++;
      } else {
        out += c === "\n" ? "\n" : " ";
      }
      continue;
    }

    // STRING_SINGLE / STRING_DOUBLE / TEMPLATE: blank contents, respect backslash escapes.
    const closingChar = state === "STRING_SINGLE" ? "'" : state === "STRING_DOUBLE" ? '"' : "`";
    if (c === "\\") {
      out += "  ";
      i++; // skip the escaped character too
      continue;
    }
    if (c === closingChar) {
      state = "CODE";
      out += " ";
      continue;
    }
    out += c === "\n" ? "\n" : " ";
  }
  return out;
}

function listTsFiles(root: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (extname(full) === ".ts" && !full.endsWith(".spec.ts") && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Scans every `.ts` file under `rootDir` for banned, non-deterministic APIs. */
export function scanForBannedApis(rootDir: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of listTsFiles(rootDir)) {
    const raw = readFileSync(file, "utf8");
    const rawLines = raw.split("\n");
    const codeLines = stripCommentsAndStrings(raw).split("\n");
    for (let i = 0; i < codeLines.length; i++) {
      const codeLine = codeLines[i]!;
      for (const rule of RULES) {
        if (!rule.pattern.test(codeLine)) continue;
        const allowedHere = ALLOW_COMMENT.test(rawLines[i] ?? "") || ALLOW_COMMENT.test(rawLines[i - 1] ?? "");
        if (allowedHere) continue;
        violations.push({ file, line: i + 1, text: rawLines[i]!.trim(), rule: rule.name });
      }
    }
  }
  return violations;
}

// CLI entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] ?? "app/engine";
  const violations = scanForBannedApis(target);
  if (violations.length === 0) {
    console.log(`determinism-lint: clean (${target})`);
    process.exit(0);
  }
  console.error(`determinism-lint: ${violations.length} violation(s) in ${target}\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text}`);
  }
  process.exit(1);
}
