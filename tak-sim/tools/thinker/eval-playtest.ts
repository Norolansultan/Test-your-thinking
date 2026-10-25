/**
 * `npx tsx tools/thinker/eval-playtest.ts` — the D10 evaluation (SPEC/14 revision D10, 24 Oct 2026):
 * query-aware recency and clock-aware matching, before (`withoutD10`) and after (the declared
 * configuration). REPORT-ONLY and needs no model or network:
 *
 * 1. **Play-test questions** (`playtest-cases.ts`, `docs/audits/2026-10-23-playtest/haku.csv`):
 *    the rank of the right record, LEXICAL only — as the play harness and the demo bridge run Haku
 *    (the browser's local fallback). These questions have no stored query vector.
 *    1b. The same for the replay's questions (`haku-replay.csv`, analysis §10): the HELD-OUT set (SPEC/14 revision (bi), B5,
 *    25 Oct 2026); nothing is chosen on it.
 * 2. **Authored questions** (`authored-questions.ts`) with their stored query vectors
 *    (`content/thinker/authored-queries*.json`): HYBRID, as the proxy runs it, at every view's
 *    start gate; how many top-k lists change, and the designed records' ranks at the tests' views.
 * 3. **Report-only:** each authored question with a recency cue appended ("nyt" / "now"), with the
 *    plain question's stored vector. The cue leaves the lexical query, so the lexical half is exact;
 *    only the vector is approximate (the real embedding of the longer question would differ slightly).
 * 4. The frozen indexes' passage hashes still match every atom in both languages (D10 changes no passage).
 *
 *   --verbose   per play-test case, the top 3 records after
 *
 * Nothing is tuned on parts 2–4; part 1 is the development set (SPEC/14 revision D10).
 */

import { readFileSync } from "node:fs";
import { hybridRetrieve, retrievalConfigOf, vectorIndexOf, type HybridConfig, type RetrievalLang, type VectorIndex } from "../../app/retrieval/hybrid.js";
import { queryCues } from "../../app/retrieval/query-cues.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { clockAt, recordText } from "../../app/session/template-answer.js";
import { AUTHORED_QUERIES_FILE, AUTHORED_QUERIES_FILE_EN, repoPath } from "../../server/thinker/config.js";
import { authoredQuestionsOf } from "./authored-questions.js";
import { gateStepOfView, readIndexFile, scenario } from "./eval-common.js";
import { bestRank, loadPlaytestCases, PLAYTEST_HAKU_FILE, PLAYTEST_REPLAY_HAKU_FILE, rankSummary, withoutD10 } from "./playtest-cases.js";

const ALL = Number.MAX_SAFE_INTEGER;
const VIEWS = scenario.cycles.map((c) => c.index).filter((v) => v >= 1);

const rankStr = (r: number) => (r === 0 ? "-" : String(r));

function ranked(question: string, step: number, lang: RetrievalLang, config: HybridConfig, vector: { queryVector: readonly number[]; index: VectorIndex } | null): string[] {
  return hybridRetrieve(question, reachableAtoms(scenario.atoms, step), vector, { ...config, topK: ALL }, lang).map((r) => r.atom.id);
}

function playtest(verbose: boolean, file: string, title: string): void {
  const cases = loadPlaytestCases(file);
  console.log(`\n${title} (${file}: ${cases.length} with an identifiable right record), lexical only, rank of the right record (- = not ranked)`);
  console.log(`   cue: L latest-state, C a clock, T topic-free (the newest records); before = without D10, after = the declared configuration`);
  console.log(`   ${"case".padEnd(5)} ${"lang".padEnd(4)} ${"step".padStart(4)} cue   ${"before".padStart(6)} ${"after".padStart(6)}  question`);
  const before: number[] = [];
  const after: number[] = [];
  for (const c of cases) {
    const declared = retrievalConfigOf(c.lang);
    const cues = queryCues(c.question, c.lang);
    const b = bestRank(ranked(c.question, c.step, c.lang, withoutD10(declared), null), c.targets);
    const top = ranked(c.question, c.step, c.lang, declared, null);
    const a = bestRank(top, c.targets);
    before.push(b);
    after.push(a);
    const tag = `${cues.latest ? "L" : "-"}${cues.clocks.length > 0 ? "C" : "-"}${cues.topicFree ? "T" : "-"}`;
    console.log(`   ${c.id.padEnd(5)} ${c.lang.padEnd(4)} ${String(c.step).padStart(4)} ${tag.padEnd(5)} ${rankStr(b).padStart(6)} ${rankStr(a).padStart(6)}  ${c.question.slice(0, 90)}`);
    if (verbose) {
      for (const id of top.slice(0, 3)) {
        const atom = scenario.atoms.find((x) => x.id === id)!;
        console.log(`         ${id} ${atom.provenance.sourceId} ${clockAt(atom.provenance.observedAt)} ${recordText(atom.record).slice(0, 80)}`);
      }
    }
  }
  const k = retrievalConfigOf("fi").topK;
  for (const [name, ranks] of [["before", before], ["after", after]] as const) {
    const s = rankSummary(ranks, k);
    console.log(`   ${name.padEnd(6)} n ${s.n}  top-1 ${s.top1}  top-3 ${s.top3}  top-${k} ${s.topK}  MRR@${k} ${s.mrrAtK.toFixed(4)}`);
  }
  const better = cases.filter((_, i) => (after[i] || ALL) < (before[i] || ALL)).length;
  const worse = cases.filter((_, i) => (after[i] || ALL) > (before[i] || ALL)).length;
  console.log(`   better ${better}, worse ${worse}, unchanged ${cases.length - better - worse}`);
}

/** The stored query vectors of the authored questions of a language. */
function storedVectors(lang: RetrievalLang): Map<string, readonly number[]> {
  const file = JSON.parse(readFileSync(repoPath(lang === "en" ? AUTHORED_QUERIES_FILE_EN : AUTHORED_QUERIES_FILE), "utf8")) as { queries: { text: string; v: number[] }[] };
  return new Map(file.queries.map((q) => [q.text, q.v] as const));
}

/** The designed record each authored group is documented against (`rekindle.spec`, `planted.spec`), at the tests' views. */
const DESIGNED_TARGETS = {
  broadBog: { id: DESIGNED_EVENT_IDS.objection, views: [7] },
  narrowBog: { id: DESIGNED_EVENT_IDS.objection, views: [7] },
  powerLine: { id: DESIGNED_EVENT_IDS.planted, views: [6, 7, 12] },
  codes: null,
} as const;

function authored(lang: RetrievalLang): void {
  const indexFile = readIndexFile(lang);
  if (!indexFile) {
    console.log(`\n2. Authored questions (${lang}): the index is absent; skipped`);
    return;
  }
  const index = vectorIndexOf(indexFile);
  const vectors = storedVectors(lang);
  const declared = retrievalConfigOf(lang);
  const k = declared.topK;
  const cue = lang === "en" ? "now" : "nyt";
  let lists = 0;
  let changed = 0;
  let changedCue = 0;
  const lines: string[] = [];
  for (const [group, questions] of Object.entries(authoredQuestionsOf(lang)) as [keyof typeof DESIGNED_TARGETS, readonly string[]][]) { // determinism-lint-allow: a fixed literal object, its declaration order is the order
    for (const q of questions) {
      const v = vectors.get(q);
      if (!v) throw new Error(`no stored query vector for "${q}" (${lang}); run \`npm run thinker:index\``);
      const vector = { queryVector: v, index };
      const target = DESIGNED_TARGETS[group];
      for (const view of VIEWS) {
        const step = gateStepOfView(view);
        const b = ranked(q, step, lang, withoutD10(declared), vector);
        const a = ranked(q, step, lang, declared, vector);
        const c = ranked(`${q} ${cue}`, step, lang, declared, vector);
        lists++;
        if (b.slice(0, k).join() !== a.slice(0, k).join()) changed++;
        if (a.slice(0, k).join() !== c.slice(0, k).join()) changedCue++;
        if (target && (target.views as readonly number[]).includes(view)) {
          lines.push(`   V${String(view).padEnd(3)} ${target.id.padEnd(20)} before ${rankStr(bestRank(b, [target.id])).padStart(4)}  after ${rankStr(bestRank(a, [target.id])).padStart(4)}  with "${cue}" ${rankStr(bestRank(c, [target.id])).padStart(4)}  "${q}"`);
        }
      }
    }
  }
  console.log(`\n2. Authored questions (${lang}), hybrid with the stored query vectors, ${VIEWS.length} views: ${changed} of ${lists} top-${k} lists change (before -> after)`);
  console.log(`3. Report-only (${lang}): with "${cue}" appended (the plain question's vector), ${changedCue} of ${lists} top-${k} lists differ from the plain question's`);
  console.log("   designed records at the tests' views (full ranks, top-k lifted):");
  for (const l of lines) console.log(l);
}

function indexHashes(): void {
  for (const lang of ["fi", "en"] as const) {
    const file = readIndexFile(lang);
    if (!file) {
      console.log(`\n4. ${lang} index absent`);
      continue;
    }
    const index = vectorIndexOf(file);
    let ok = 0;
    for (const atom of scenario.atoms) {
      try {
        index.vectorOf(atom);
        ok++;
      } catch {
        // counted as stale below
      }
    }
    console.log(`${lang === "fi" ? "\n" : ""}4. ${lang} index: ${ok} of ${scenario.atoms.length} atoms' passage hashes match`);
  }
}

playtest(process.argv.includes("--verbose"), PLAYTEST_HAKU_FILE, "1. Play-test questions, development set");
playtest(process.argv.includes("--verbose"), PLAYTEST_REPLAY_HAKU_FILE, "1b. Replay questions, held-out set");
authored("fi");
authored("en");
indexHashes();
