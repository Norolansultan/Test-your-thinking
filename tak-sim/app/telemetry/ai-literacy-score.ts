/**
 * The AI literacy questionnaire's scores (SNAIL; revision (ac), amended 9 Oct 2026; SPEC/09 ac.1).
 * Analysis only: SPEC/07 §3 keeps scores out of the log ("Scoring happens entirely in the analysis
 * pipeline"); the session never calls this. Pure folds over the records, like `derived-measures.ts`.
 *
 * Scoring (Laupichler et al., 2023; as reported by Fernandes et al., 2026): the mean rating (1–7) of
 * each factor's items — Technical Understanding (TU, 14 items), Critical Appraisal (CA, 10),
 * Practical Application (PA, 7) — and of all 31. Self-report: no item is right or wrong. **Means over
 * the rated items only**: an item not reached at the cap or left by "Skip the test" is missing, not
 * a low rating; a subscale with no rated item has no score (null), and a participant who skipped
 * before rating anything has none at all. `rated` counts the items behind each mean.
 */

import type { LogRecord } from "./log.js";
import type { AiLiteracyEndReason, AiLiteracySubmittedDetail } from "./record-kinds.js";
import { AI_LITERACY_ITEMS, type SnailFactor } from "../session/ai-literacy-items.js";
import { keptAiLiteracyAnswers } from "../session/ai-literacy.js";

/** The item → factor table (SNAIL's Table 1, the 31 retained items). */
export const SNAIL_FACTOR_OF: Readonly<Record<string, SnailFactor>> = Object.fromEntries(AI_LITERACY_ITEMS.map((i) => [i.id, i.factor]));
export const SNAIL_FACTORS: readonly SnailFactor[] = ["TU", "CA", "PA"];

export interface SubscaleScore {
  /** Mean rating of the rated items; null when none was rated. */
  readonly mean: number | null;
  readonly rated: number;
  readonly items: number;
}

export interface AiLiteracyScores {
  readonly TU: SubscaleScore;
  readonly CA: SubscaleScore;
  readonly PA: SubscaleScore;
  readonly total: SubscaleScore;
}

const subscale = (ratings: ReadonlyMap<string, number>, ids: readonly string[]): SubscaleScore => {
  const rated = ids.map((id) => ratings.get(id)).filter((r): r is number => r !== undefined);
  return { mean: rated.length === 0 ? null : rated.reduce((a, b) => a + b, 0) / rated.length, rated: rated.length, items: ids.length };
};

/** The subscale means of a set of ratings by item id. */
export function scoreSnail(ratings: ReadonlyMap<string, number>): AiLiteracyScores {
  const ids = (f: SnailFactor) => AI_LITERACY_ITEMS.filter((i) => i.factor === f).map((i) => i.id);
  return { TU: subscale(ratings, ids("TU")), CA: subscale(ratings, ids("CA")), PA: subscale(ratings, ids("PA")), total: subscale(ratings, AI_LITERACY_ITEMS.map((i) => i.id)) };
}

/**
 * A session's SNAIL scores from its log: null until the questionnaire has ended
 * (`ai_literacy_submitted`); otherwise how it ended (the last end record) and the subscale means of
 * the ratings logged (the last rating per item).
 */
export function aiLiteracyScoreOf(records: readonly LogRecord[]): (AiLiteracyScores & { readonly endReason: AiLiteracyEndReason; readonly answeredCount: number }) | null {
  const ends = records.filter((r) => r.kind === "ai_literacy_submitted");
  if (ends.length === 0) return null;
  const ratings = keptAiLiteracyAnswers(records);
  return { endReason: (ends.at(-1)!.detail as AiLiteracySubmittedDetail).endReason, answeredCount: ratings.size, ...scoreSnail(ratings) };
}
