/**
 * The comparisons in a personal results report (SPEC/36 §3): the participant's background group, the three profile metrics, the
 * percentile band against all completed study sessions of the same group, and the relation to the expert median. Pure functions over
 * parsed session logs; the CLI (`reports.ts`) does the file work.
 *
 * Background group, from the session header and the post-session questionnaire (the study's own items; no new measure):
 *   fire      a professional session (audience `expert`, the fire-rescue study link) whose `role.rank` is not "other"
 *             (unanswered counts as fire: the link was given to fire-rescue professionals)
 *   military  a public session (`?yleiso`) answering "as a profession" to `public.responder` (rescue, emergency care, police or
 *             military work; the item does not separate them, so the group is "military and other professional responders")
 *   other     everyone else (a professional session with `role.rank` "other", a public session without a professional background)
 *
 * Metrics (from `commanderProfile`; null when the dimension has too little data):
 *   calibration  |mean confidence − percent correct| in points (smaller: confidence matched accuracy more closely)
 *   checking     the share of decisions with a look-up before acting
 *   questions    Haku searches + Thinker questions in the main views
 *
 * Band: the mid-rank percentile p = 100 · (below + ½ · equal) / n over the pool's values (the participant's own session included
 * when it is a study session); p < 25 → "low" (the lowest quarter), p > 75 → "high", otherwise "middle". No band when fewer than
 * `MIN_COMPARISON_GROUP` sessions of the group have the metric: a small group would let a report reveal other people's results.
 * The report states bands only, never the percentile or another participant's value.
 */

import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import type { QuestionnaireSubmittedDetail } from "../../app/telemetry/record-kinds.js";
import { commanderProfile, type CommanderProfile, type ExpertReference } from "../../app/telemetry/profile.js";
import { aiQuestionFocus, chooseTips, type TipId } from "../../app/telemetry/profile-tips.js";

export type BackgroundGroup = "fire" | "military" | "other";
export type Band = "low" | "middle" | "high";
export type Relation = "below" | "about" | "above";
export type MetricId = "calibration" | "checking" | "questions";
export const METRICS: readonly MetricId[] = ["calibration", "checking", "questions"];

/** The smallest group a band is computed in (k-anonymity of the comparison). */
export const MIN_COMPARISON_GROUP = 10;
/** "About the same as the expert median" within these margins. */
export const EXPERT_ABOUT = { calibration: 5, checking: 0.1, questionsShare: 0.2, questionsMin: 2 } as const;

export interface ParsedSession {
  readonly header: LogHeader;
  readonly records: readonly LogRecord[];
}

/** The answers of the last post-session questionnaire, by item id. */
function postAnswers(records: readonly LogRecord[]): ReadonlyMap<string, unknown> {
  const out = new Map<string, unknown>();
  for (const r of records) {
    if (r.kind !== "questionnaire_submitted") continue;
    const d = r.detail as Partial<QuestionnaireSubmittedDetail>;
    if (d.questionnaireId !== "post" || !Array.isArray(d.answers)) continue;
    out.clear();
    for (const a of d.answers) out.set(a.itemId, a.value);
  }
  return out;
}

export function backgroundGroup(session: ParsedSession): BackgroundGroup {
  const answers = postAnswers(session.records);
  if ((session.header.audience ?? "expert") === "expert") return answers.get("role.rank") === "other" ? "other" : "fire";
  return answers.get("public.responder") === "professional" ? "military" : "other";
}

/** A finished study session: COMPLETE reached, real timings, levels hidden, nothing skippable (a demonstration never enters a pool). */
export function isCompletedStudySession(session: ParsedSession): boolean {
  const h = session.header;
  return h.probeLevelsShown === false && h.viewSkipAllowed !== true && h.previewOverride === undefined && session.records.some((r) => r.kind === "session_completed");
}

export type Metrics = Readonly<Record<MetricId, number | null>>;

export function metricsOf(profile: CommanderProfile): Metrics {
  const c = profile.calibration, k = profile.checking, u = profile.toolUse;
  return {
    calibration: c.status === "ok" && c.gapPoints !== null ? Math.abs(c.gapPoints) : null,
    checking: k.status === "ok" ? k.share : null,
    questions: u.status === "ok" ? u.hakuSearches + (u.guideQuestions ?? 0) : null,
  };
}

/** The mid-rank percentile band of `value` among `pool`, or null below the minimum group size. */
export function percentileBand(value: number, pool: readonly number[], minGroup = MIN_COMPARISON_GROUP): Band | null {
  if (pool.length < minGroup) return null;
  let below = 0, equal = 0;
  for (const x of pool) {
    if (x < value) below += 1;
    else if (x === value) equal += 1;
  }
  const p = (100 * (below + equal / 2)) / pool.length;
  return p < 25 ? "low" : p > 75 ? "high" : "middle";
}

/** The participant's metric against the expert median; null when the median is not known. */
export function expertRelation(metric: MetricId, value: number, expert: ExpertReference, hadGuide: boolean): Relation | null {
  if (metric === "calibration") {
    if (expert.calibrationGapPoints === null) return null;
    const ref = Math.abs(expert.calibrationGapPoints);
    return Math.abs(value - ref) <= EXPERT_ABOUT.calibration ? "about" : value < ref ? "below" : "above";
  }
  if (metric === "checking") {
    if (expert.checkingShare === null) return null;
    return Math.abs(value - expert.checkingShare) <= EXPERT_ABOUT.checking + 1e-9 ? "about" : value < expert.checkingShare ? "below" : "above";
  }
  if (expert.hakuSearches === null || (hadGuide && expert.guideQuestions === null)) return null;
  const ref = expert.hakuSearches + (hadGuide ? expert.guideQuestions ?? 0 : 0);
  const margin = Math.max(EXPERT_ABOUT.questionsMin, ref * EXPERT_ABOUT.questionsShare);
  return Math.abs(value - ref) <= margin ? "about" : value < ref ? "below" : "above";
}

export interface Comparison {
  readonly metric: MetricId;
  /** Null: the participant's own session has too little data for this metric. */
  readonly hasValue: boolean;
  readonly band: Band | null;
  /** The number of sessions in the group with this metric (for the "too few to compare" note; never printed as other people's data). */
  readonly poolSize: number;
  readonly expert: Relation | null;
}

export interface PersonalResult {
  readonly sessionId: string;
  readonly group: BackgroundGroup;
  readonly profile: CommanderProfile;
  readonly tips: readonly TipId[];
  readonly comparisons: readonly Comparison[];
}

/** The pool: per group and metric, the values of every completed study session (computed once for all reports). */
export type Pool = ReadonlyMap<BackgroundGroup, ReadonlyMap<MetricId, readonly number[]>>;

export function buildPool(sessions: readonly ParsedSession[]): Pool {
  const pool = new Map<BackgroundGroup, Map<MetricId, number[]>>();
  for (const s of sessions) {
    if (!isCompletedStudySession(s)) continue;
    const group = backgroundGroup(s);
    const metrics = metricsOf(commanderProfile(s.records));
    const byMetric = pool.get(group) ?? new Map<MetricId, number[]>();
    for (const m of METRICS) {
      const v = metrics[m];
      if (v === null) continue;
      byMetric.set(m, [...(byMetric.get(m) ?? []), v]);
    }
    pool.set(group, byMetric);
  }
  return pool;
}

/** One participant's result: the profile, the tips, and each metric's band and expert relation. */
export function personalResult(session: ParsedSession, pool: Pool, expert: ExpertReference): PersonalResult {
  const profile = commanderProfile(session.records, { expert });
  const group = backgroundGroup(session);
  const metrics = metricsOf(profile);
  const values = pool.get(group);
  const hadGuide = profile.toolUse.guideQuestions !== null;
  const comparisons = METRICS.map((metric): Comparison => {
    const value = metrics[metric];
    const groupValues = values?.get(metric) ?? [];
    if (value === null) return { metric, hasValue: false, band: null, poolSize: groupValues.length, expert: null };
    return { metric, hasValue: true, band: percentileBand(value, groupValues), poolSize: groupValues.length, expert: expertRelation(metric, value, expert, hadGuide) };
  });
  return { sessionId: session.header.sessionId, group, profile, tips: chooseTips({ profile, ai: aiQuestionFocus(session.records) }), comparisons };
}
