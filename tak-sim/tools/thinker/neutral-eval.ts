/**
 * The neutral retrieval evaluation (`content/thinker/neutral-eval.json`), as pure functions: resolve
 * each question's needs against the corpus by stable features, score a ranking (recall@k, MRR@k),
 * and choose among the declared candidate configurations by a rule fixed before the run.
 *
 * Needs name records by features (actor, event_type, a content substring, latest-or-any), never by
 * id alone, so the file survives a regenerated corpus; the resolved ids are only a snapshot.
 */

import { THINKER_RETRIEVAL_CONFIG, type HybridConfig } from "../../app/retrieval/hybrid.js";
import type { InteractionEvent } from "../../app/scenario/types.js";

export interface NeedSpec {
  readonly actor?: string;
  readonly event_type?: string;
  readonly contains: string;
  readonly pick: "latest" | "any";
  readonly ids: readonly string[];
}

export interface NeutralQuestion {
  readonly id: string;
  readonly topic: string;
  readonly view: number;
  readonly question: string;
  readonly needs: readonly NeedSpec[];
}

export interface NeutralEvalFile {
  readonly version: number;
  readonly questions: readonly NeutralQuestion[];
  readonly [key: string]: unknown;
}

/** The corpus records that satisfy one need at the gate step (sorted newest first). */
export function resolveNeed(need: NeedSpec, corpus: readonly InteractionEvent[], gateStep: number): string[] {
  const needle = need.contains.toLowerCase();
  const matches = corpus
    .filter((e) => e.cycle <= gateStep)
    .filter((e) => (need.actor === undefined || e.actor === need.actor) && (need.event_type === undefined || e.event_type === need.event_type))
    .filter((e) => e.content.toLowerCase().includes(needle))
    .sort((a, b) => b.sim_time_s - a.sim_time_s || b.cycle - a.cycle || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  if (matches.length === 0) return [];
  return need.pick === "latest" ? [matches[0]!.id] : matches.map((e) => e.id);
}

export interface QuestionScore {
  readonly id: string;
  readonly recall: number;
  /** 1/rank of the first top-k record that meets any need; 0 when none does. */
  readonly reciprocalRank: number;
  readonly met: readonly boolean[];
  readonly unresolved: number;
}

/** Recall@k is the share of needs met by the top-k ranking; MRR@k is over the same list. */
export function scoreQuestion(id: string, resolved: readonly (readonly string[])[], topIds: readonly string[]): QuestionScore {
  const met = resolved.map((ids) => ids.some((x) => topIds.includes(x)));
  const firstRank = topIds.findIndex((x) => resolved.some((ids) => ids.includes(x)));
  return {
    id,
    recall: resolved.length === 0 ? 0 : met.filter(Boolean).length / resolved.length,
    reciprocalRank: firstRank < 0 ? 0 : 1 / (firstRank + 1),
    met,
    unresolved: resolved.filter((ids) => ids.length === 0).length,
  };
}

export interface ConfigScore {
  readonly name: string;
  readonly recallAtK: number;
  readonly mrrAtK: number;
  readonly questions: readonly QuestionScore[];
}

export const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function aggregate(name: string, questions: readonly QuestionScore[]): ConfigScore {
  const n = questions.length || 1;
  return {
    name,
    recallAtK: round4(questions.reduce((s, q) => s + q.recall, 0) / n),
    mrrAtK: round4(questions.reduce((s, q) => s + q.reciprocalRank, 0) / n),
    questions,
  };
}

const base: HybridConfig = { ...THINKER_RETRIEVAL_CONFIG, routineCollapse: null, maxPerSource: null };

/**
 * The candidates, declared before the evaluation was run (1 Oct 2026). Only the collapse and the
 * per-source cap vary; weights, BM25 parameters and top-k stay as SPEC/14 revision (q) declared.
 */
export const CANDIDATE_CONFIGS: readonly { readonly name: string; readonly config: HybridConfig }[] = [
  { name: "baseline", config: base },
  { name: "collapse3", config: { ...base, routineCollapse: { minDistinctSteps: 3 } } },
  { name: "cap2", config: { ...base, maxPerSource: 2 } },
  { name: "cap3", config: { ...base, maxPerSource: 3 } },
  { name: "collapse3+cap2", config: { ...base, routineCollapse: { minDistinctSteps: 3 }, maxPerSource: 2 } },
  { name: "collapse3+cap3", config: { ...base, routineCollapse: { minDistinctSteps: 3 }, maxPerSource: 3 } },
];

/** Selection rule (declared in advance): highest recall@k, then highest MRR@k, then the earlier (simpler) candidate. */
export function selectConfig(scores: readonly ConfigScore[]): ConfigScore {
  let best = scores[0]!;
  for (const s of scores.slice(1)) {
    if (s.recallAtK > best.recallAtK || (s.recallAtK === best.recallAtK && s.mrrAtK > best.mrrAtK)) best = s;
  }
  return best;
}

/** The English question file (`content/thinker/neutral-eval.en.json`, SPEC/14 revision (v)): questions only. */
export interface NeutralEvalEnFile {
  readonly version: number;
  readonly language: "en";
  readonly needsFrom: string;
  readonly questions: readonly { readonly id: string; readonly question: string }[];
  readonly [key: string]: unknown;
}

/**
 * The English evaluation: each English question takes the Finnish question's id, topic, view and
 * needs (the same records by the same stable features). The two files must list the same ids in the
 * same order; anything else is refused, so the English set can never drift from the Finnish one.
 */
export function englishQuestions(fi: NeutralEvalFile, en: NeutralEvalEnFile): NeutralQuestion[] {
  const fiIds = fi.questions.map((q) => q.id).join(",");
  const enIds = en.questions.map((q) => q.id).join(",");
  if (fiIds !== enIds) throw new Error(`the English neutral questions (${enIds}) are not the Finnish ones (${fiIds}), item for item`);
  return fi.questions.map((q, i) => ({ ...q, question: en.questions[i]!.question }));
}

/**
 * Runs every candidate over every question (`retrieve` gives the top-k ids of a question at its
 * view under a configuration) and scores them. Pure apart from `retrieve`; the runner passes the
 * proxy's retrieval, tests a stub.
 */
export async function evaluateCandidates(
  questions: readonly NeutralQuestion[],
  resolved: readonly (readonly (readonly string[])[])[],
  retrieve: (question: NeutralQuestion, config: HybridConfig) => Promise<readonly string[]>,
  candidates: readonly { readonly name: string; readonly config: HybridConfig }[] = CANDIDATE_CONFIGS,
): Promise<ConfigScore[]> {
  const scores: ConfigScore[] = [];
  for (const { name, config } of candidates) {
    const qs: QuestionScore[] = [];
    for (const [i, q] of questions.entries()) qs.push(scoreQuestion(q.id, resolved[i]!, await retrieve(q, config)));
    scores.push(aggregate(name, qs));
  }
  return scores;
}

/** Whether two configurations declare the same retrieval. */
export function sameConfig(a: HybridConfig, b: HybridConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
