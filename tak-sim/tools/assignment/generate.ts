/**
 * Generates the study's allocation table (SPEC/27 §2.2, U4) from the fixed plan in
 * `app/session/assignment.ts` and writes it to `content/assignment/allocation.json`.
 *
 *     npx tsx tools/assignment/generate.ts           # (re)write the table
 *     npx tsx tools/assignment/generate.ts --check   # exit 1 unless the committed file is byte-identical
 *
 * Deterministic: the plan's seed alone fixes every row; no clock, no unseeded randomness. The
 * seed and `rowsSha256` go into the pre-registration. Regenerating must reproduce the committed
 * file byte for byte (`test/session/assignment.spec.ts`).
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ASSIGNMENT_PLAN, BLOCK_COMPOSITION, BLOCK_SIZE, generateAssignmentRows, type AssignmentPlan, type AssignmentRow,
} from "../../app/session/assignment.js";

export const ALLOCATION_FILE = fileURLToPath(new URL("../../content/assignment/allocation.json", import.meta.url));

export function rowsSha256(rows: readonly AssignmentRow[]): string {
  return createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");
}

/** The file's text: header fields, then one row per line (readable diffs). */
export function renderAllocationFile(plan: AssignmentPlan = ASSIGNMENT_PLAN): string {
  const rows = generateAssignmentRows(plan);
  const head = {
    version: 1,
    generator: "tools/assignment/generate.ts (splitmix32-seeded xoshiro128**, Fisher-Yates per block)",
    seed: plan.seed,
    blockSize: BLOCK_SIZE,
    composition: BLOCK_COMPOSITION.map((c) => `${c.cell}:${c.count}`).join(" "),
    strata: plan.strata,
    rowsSha256: rowsSha256(rows),
  };
  const headLines = JSON.stringify(head, null, 2).split("\n").slice(0, -1); // drop the closing brace
  headLines[headLines.length - 1] += ",";
  const rowLines = rows.map((r, i) => `    ${JSON.stringify(r)}${i < rows.length - 1 ? "," : ""}`);
  return [...headLines, '  "rows": [', ...rowLines, "  ]", "}", ""].join("\n");
}

function main(): void {
  const text = renderAllocationFile();
  if (process.argv.includes("--check")) {
    let committed = "";
    try { committed = readFileSync(ALLOCATION_FILE, "utf8"); } catch { /* missing: differs */ }
    if (committed !== text) {
      console.error("content/assignment/allocation.json differs from what the generator produces");
      process.exit(1);
    }
    console.log("allocation table is byte-identical to the generator's output");
    return;
  }
  writeFileSync(ALLOCATION_FILE, text);
  console.log(`wrote ${ALLOCATION_FILE}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
