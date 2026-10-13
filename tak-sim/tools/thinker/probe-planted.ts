/**
 * REPORT-ONLY probe, run after the retrieval configuration was frozen (1 Oct 2026). Lists whether
 * the designed items — VPK's rekindle objection and the F7 planted record — appear in top-k for a
 * few natural commander questions under the frozen configuration (and, for comparison, the
 * pre-collapse baseline). Nothing is tuned on this output; it is not part of `thinker:eval`.
 *
 *   npx tsx tools/thinker/probe-planted.ts [--lexical] [--lang en]
 *
 * `--lang en` (SPEC/14 revision (v)) runs the English translations of the same questions with the
 * English retrieval (English passages, tokeniser and `content/thinker/index.en.json`; lexical only,
 * and says so, while that index is absent). Report-only in both languages.
 */

import { retrievalConfigOf, type HybridConfig } from "../../app/retrieval/hybrid.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { PLANTED_PROBES } from "./authored-questions.js";
import { langArg, loadQueryEmbedding, retrieveAtView, type QueryEmbedding } from "./eval-common.js";

async function rankOf(question: string, view: number, target: string, embedding: QueryEmbedding, config: HybridConfig): Promise<number> {
  const all = await retrieveAtView(question, view, embedding, { ...config, topK: Number.MAX_SAFE_INTEGER });
  return all.findIndex((r) => r.atom.id === target) + 1;
}

async function main(): Promise<void> {
  const lang = langArg(process.argv.slice(2));
  const frozen = retrievalConfigOf(lang);
  const baseline: HybridConfig = { ...frozen, routineCollapse: null, maxPerSource: null };
  const embedding = await loadQueryEmbedding(process.argv.includes("--lexical"), lang);
  const k = frozen.topK;
  console.log(`probe-planted (report-only) — language ${lang}, mode ${embedding.mode}${embedding.reason ? ` (${embedding.reason})` : ""}, top-k ${k}`);
  console.log("rank = position in the full ranked list with top-k lifted (0 = absent: zero score, or past the per-source cap); 'in top-k' uses the frozen configuration");
  for (const p of PLANTED_PROBES) {
    const question = p[lang];
    const target = p.target === "objection" ? DESIGNED_EVENT_IDS.objection : DESIGNED_EVENT_IDS.planted;
    const label = p.target === "objection" ? "objection" : "F7";
    const top = await retrieveAtView(question, p.view, embedding, frozen);
    const inTop = top.some((r) => r.atom.id === target);
    const rFrozen = await rankOf(question, p.view, target, embedding, frozen);
    const uncapped = await rankOf(question, p.view, target, embedding, { ...frozen, maxPerSource: null });
    const base = await rankOf(question, p.view, target, embedding, baseline);
    const r = (n: number) => String(n).padStart(3);
    console.log(`  V${p.view} ${label.padEnd(9)} in top-${k}: ${inTop ? "YES" : "no "}  rank frozen ${r(rFrozen)}, cap lifted ${r(uncapped)}, baseline ${r(base)}  "${question}"`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
