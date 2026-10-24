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
 *
 * Since 24 Oct 2026 (SPEC/30 §2 revision (bf), table version 2) the table is stratified by language × profession × leads others,
 * one balanced sequence (permuted blocks of 4) per stratum, each from its own seeded stream (`stratumSeed`); the writer prints the
 * codes per stratum.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ASSIGNMENT_PLAN, BLOCK_COMPOSITION, BLOCK_SIZE, generateAssignmentRows, type AssignmentPlan, type AssignmentRow,
} from "../../app/session/assignment.js";
import { stratumId } from "../../app/telemetry/record-kinds-pilot2.js";

export const ALLOCATION_FILE = fileURLToPath(new URL("../../content/assignment/allocation.json", import.meta.url));

export function rowsSha256(rows: readonly AssignmentRow[]): string {
  return createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");
}

/** The file's text: header fields, one stratum per line, then one row per line (readable diffs). Version 2: stratified (SPEC/30 §2 (bf)). */
export function renderAllocationFile(plan: AssignmentPlan = ASSIGNMENT_PLAN): string {
  const rows = generateAssignmentRows(plan);
  const head = {
    version: 2,
    generator: "tools/assignment/generate.ts (splitmix32-seeded xoshiro128**, one stream per stratum, Fisher-Yates per block)",
    seed: plan.seed,
    blockSize: BLOCK_SIZE,
    composition: BLOCK_COMPOSITION.map((c) => `${c.cell}:${c.count}`).join(" "),
  };
  const headLines = JSON.stringify(head, null, 2).split("\n").slice(0, -1); // drop the closing brace
  headLines[headLines.length - 1] += ",";
  const list = (items: readonly unknown[]) => items.map((x, i) => `    ${JSON.stringify(x)}${i < items.length - 1 ? "," : ""}`);
  return [
    ...headLines, '  "strata": [', ...list(plan.strata), "  ],", `  "rowsSha256": ${JSON.stringify(rowsSha256(rows))},`,
    '  "rows": [', ...list(rows), "  ]", "}", "",
  ].join("\n");
}

/** The table's codes per stratum (language.profession.leads), for the researcher's console and the deployment notes. */
export function strataSummary(plan: AssignmentPlan = ASSIGNMENT_PLAN): string[] {
  return plan.strata.map((s) => `${s.language}.${stratumId(s)}: ${s.blocks} block${s.blocks === 1 ? "" : "s"}, ${s.blocks * BLOCK_SIZE} codes`);
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
  for (const line of strataSummary()) console.log(`  ${line}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
