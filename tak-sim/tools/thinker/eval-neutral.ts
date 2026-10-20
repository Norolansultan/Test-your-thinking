/**
 * `npm run thinker:eval` — the neutral retrieval evaluation (SPEC/14 revision (q), 1 Oct 2026).
 * Runs every question of `content/thinker/neutral-eval.json` at its view's time gate under each
 * declared candidate configuration and reports recall@k and MRR@k, baseline first. Deterministic
 * and rerunnable: needs are resolved from the corpus by features at every run.
 *
 *   --lang en   the English evaluation (SPEC/14 revision (v)): the questions of
 *               `content/thinker/neutral-eval.en.json` with the Finnish questions' needs, English
 *               passages, tokeniser and `content/thinker/index.en.json`; same candidates, same rule
 *   --lexical   run the lexical half only (also the fallback when the e5 model or the index cannot be loaded)
 *   --verbose   print per-question results for the declared configuration
 *   --write     Finnish: refresh the resolved-id snapshot in neutral-eval.json and record the results
 *               in content/thinker/manifest.json (retrieval.neutralEval). English: record the results
 *               in the manifest's retrievalEn.neutralEval only — refused unless the run is hybrid;
 *               "frozen" only when the rule selects the declared THINKER_RETRIEVAL_CONFIG_EN
 *
 * The planted items are not part of this evaluation (see `probe-planted.ts`, report-only).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { retrievalConfigOf, type RetrievalLang } from "../../app/retrieval/hybrid.js";
import { MANIFEST_FILE, repoPath } from "../../server/thinker/config.js";
import { gateStepOfView, langArg, loadCorpus, loadQueryEmbedding, retrieveAtView } from "./eval-common.js";
import {
  CANDIDATE_CONFIGS, englishQuestions, evaluateCandidates, resolveNeed, sameConfig, selectConfig,
  type ConfigScore, type NeutralEvalEnFile, type NeutralEvalFile, type NeutralQuestion,
} from "./neutral-eval.js";
import { declaredRetrievalBlock, englishRetrievalBlock, readManifest } from "./retrieval-manifest.js";

export const NEUTRAL_EVAL_FILE = "content/thinker/neutral-eval.json";
export const NEUTRAL_EVAL_FILE_EN = "content/thinker/neutral-eval.en.json";
const EVAL_DATE = "2026-10-01";

function fileText(file: NeutralEvalFile): string {
  const { questions, ...head } = file;
  const open = JSON.stringify(head, null, 2).slice(0, -2);
  return `${open},\n  "questions": [\n${questions.map((q) => `    ${JSON.stringify(q)}`).join(",\n")}\n  ]\n}\n`;
}

const readJson = <T>(relative: string): T => JSON.parse(readFileSync(repoPath(relative), "utf8")) as T;

/** The evaluation's questions in a language (English: the English wording with the Finnish needs). */
export function questionsOf(lang: RetrievalLang, fi: NeutralEvalFile): readonly NeutralQuestion[] {
  return lang === "en" ? englishQuestions(fi, readJson<NeutralEvalEnFile>(NEUTRAL_EVAL_FILE_EN)) : fi.questions;
}

/** The manifest's evaluation record (the same fields in both languages). */
function evalRecord(lang: RetrievalLang, mode: string, questions: number, needs: number, topK: number, scores: readonly ConfigScore[], selected: string, declared: string | null, date: string): Record<string, unknown> {
  return {
    file: lang === "en" ? NEUTRAL_EVAL_FILE_EN : NEUTRAL_EVAL_FILE,
    ...(lang === "en" ? { needsFrom: NEUTRAL_EVAL_FILE, language: "en" } : {}),
    date,
    status: lang === "fi" || selected === declared ? "frozen" : "not frozen: the rule selected another candidate; set THINKER_RETRIEVAL_CONFIG_EN to it in a dated amendment and re-run",
    mode,
    questions,
    needs,
    metric: `mean per-question recall@${topK} (share of needs met) and MRR@${topK}, at each view's start gate`,
    selectionRule: "highest recall@k, then highest MRR@k, then the earlier (simpler) candidate; candidates declared before the run",
    plantedItemsExcluded: "the designed events (rekindle objection, bog smoulder, F7 / 20 kV line, step-18 contradiction) were not used in tuning; tools/thinker/probe-planted.ts reports them after the freeze",
    results: scores.map((s) => ({ name: s.name, recallAtK: s.recallAtK, mrrAtK: s.mrrAtK })),
    selected,
    declared,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const lang = langArg(argv);
  const file = readJson<NeutralEvalFile>(NEUTRAL_EVAL_FILE);
  const questions = questionsOf(lang, file);
  const corpus = loadCorpus();
  const embedding = await loadQueryEmbedding(args.has("--lexical"), lang);
  const declaredConfig = retrievalConfigOf(lang);
  const topK = declaredConfig.topK;

  const resolved = questions.map((q) => q.needs.map((n) => resolveNeed(n, corpus, gateStepOfView(q.view))));
  let drift = 0;
  questions.forEach((q, i) => q.needs.forEach((n, j) => {
    const now = resolved[i]![j]!;
    if (now.length === 0) console.warn(`! ${q.id} need ${j + 1} ("${n.contains}") resolves to no record at V${q.view}`);
    if (JSON.stringify(now) !== JSON.stringify(n.ids)) drift++;
  }));

  console.log(`thinker:eval — language ${lang}, ${questions.length} neutral questions, ${resolved.flat().length} needs, top-k ${topK}, mode ${embedding.mode}${embedding.reason ? ` (${embedding.reason})` : ""}`);
  if (drift > 0) console.log(`  (${drift} need snapshot(s) differ from the corpus; --write (Finnish) refreshes them)`);

  const scores = await evaluateCandidates(questions, resolved, async (q, config) => (await retrieveAtView(q.question, q.view, embedding, config)).map((r) => r.atom.id));

  console.log(`\n  ${"configuration".padEnd(18)} recall@${topK}   MRR@${topK}`);
  for (const s of scores) console.log(`  ${s.name.padEnd(18)} ${s.recallAtK.toFixed(4)}     ${s.mrrAtK.toFixed(4)}`);
  const selected = selectConfig(scores);
  const declared = CANDIDATE_CONFIGS.find((c) => sameConfig(c.config, declaredConfig));
  console.log(`\n  selected by the declared rule: ${selected.name}; declared in hybrid.ts (${lang}): ${declared?.name ?? "(not a candidate)"}`);
  if (declared && declared.name !== selected.name) console.log("  ! the declared configuration is not the selected one");

  if (args.has("--verbose")) {
    const s = scores.find((x) => x.name === (declared?.name ?? "baseline"))!;
    const b = scores[0]!;
    for (const [i, q] of s.questions.entries()) {
      const fq = questions[i]!;
      console.log(`  ${q.id} V${fq.view} recall ${b.questions[i]!.recall.toFixed(2)} -> ${q.recall.toFixed(2)}  RR ${b.questions[i]!.reciprocalRank.toFixed(2)} -> ${q.reciprocalRank.toFixed(2)}  ${fq.question}`);
    }
  }

  if (args.has("--write")) {
    const manifest = readManifest();
    if (!manifest) throw new Error("no manifest; run `npm run thinker:index` first");
    if (lang === "en") {
      if (embedding.mode !== "hybrid") throw new Error(`--write --lang en needs the hybrid run (the declared treatment); this run is ${embedding.mode} (${embedding.reason ?? ""})`);
      // The run's date (outside any session run loop; the manifest records when the freeze was made).
      const date = new Date().toISOString().slice(0, 10); // determinism-lint-allow: build tool outside any run loop, dates the manifest's freeze entry
      const record = evalRecord("en", embedding.mode, questions.length, resolved.flat().length, topK, scores, selected.name, declared?.name ?? null, date);
      const out = { ...manifest, retrievalEn: englishRetrievalBlock(record) };
      writeFileSync(repoPath(MANIFEST_FILE), `${JSON.stringify(out, null, 2)}\n`, "utf8");
      console.log(`\n  wrote ${MANIFEST_FILE} (retrievalEn.neutralEval, status ${String(record["status"])})`);
      if (record["status"] !== "frozen") process.exitCode = 2;
      return;
    }
    const refreshed: NeutralEvalFile = {
      ...file,
      questions: file.questions.map((q, i) => ({ ...q, needs: q.needs.map((n, j) => ({ ...n, ids: resolved[i]![j]! })) })),
    };
    writeFileSync(repoPath(NEUTRAL_EVAL_FILE), fileText(refreshed), "utf8");
    const neutralEval = evalRecord("fi", embedding.mode, file.questions.length, resolved.flat().length, topK, scores, selected.name, declared?.name ?? null, EVAL_DATE);
    const out = { ...manifest, retrieval: declaredRetrievalBlock(neutralEval) };
    writeFileSync(repoPath(MANIFEST_FILE), `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.log(`\n  wrote ${NEUTRAL_EVAL_FILE} (id snapshot) and ${MANIFEST_FILE} (retrieval.neutralEval)`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
