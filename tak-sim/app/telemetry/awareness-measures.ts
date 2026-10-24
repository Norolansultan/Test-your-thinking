/**
 * The awareness index (SPEC/09 revision (bf), 24 Oct 2026): perceived against logged influence of the group's own tool, and the global
 * self-estimate against the freezes' accuracy. Analysis only, never called at runtime and never stored (SPEC/07 §1).
 *
 * - **Perceived** (post-session, `questionnaire.ts` revision (bf)): `influence.plan_views.<tool>` (periods in which an answer of the
 *   tool changed the plan, 0–14), `influence.answers.<tool>` (how much it changed the memory-check answers, 0–100) and
 *   `accuracy.perceived` (0–100 %). `tool` is the group's own (Haku in `radio`, the Thinker in the Thinker cells).
 * - **Logged plan influence** ({@link loggedPlanInfluenceViews}): the main views in which an answer of that tool reached the screen
 *   (`shownAnswers`: a chat answer with text, and for the Thinker the plan review's premise lines, which the screen labels "Thinker")
 *   before the view's final plan, and the final plan differs from the plan in force just before that answer — the view's last plan
 *   record before it, else the previous view's final plan. A view with no plan in force before the answer (V1 before its first plan)
 *   is not counted: no change can be read. It is an upper-bound proxy (a change after an answer need not be caused by it), the same
 *   rule in both groups.
 * - **Logged answer influence** is the caller's: the share of the participant's scored freeze items whose key a shown answer of the
 *   tool stated (`aiStatedKey`, `freeze-measures.ts`), on the same 0–1 scale as `influence.answers` / 100.
 * - **The gaps** are perceived minus logged (positive: more influence perceived than logged); the self-estimate gap is
 *   `accuracy.perceived` / 100 minus the proportion correct the caller computes (`freezeItemScores`). Null where either side is missing.
 */

import { shownAnswers } from "./ai-stated-key.js";
import { finalPlanPerView, type FinalPlanOfView } from "./derived-measures.js";
import type { LogRecord } from "./log.js";
import type { AllocationRevisedDetail, AllocationSubmittedDetail, CycleStartDetail, QuestionnaireSubmittedDetail } from "./record-kinds.js";

export type AwarenessTool = "haku" | "thinker";

export interface PerceivedInfluence {
  /** The tool the items named (the session's own), or null when neither pair was answered or shown. */
  readonly tool: AwarenessTool | null;
  readonly planViews: number | null;
  /** 0–100. */
  readonly answers: number | null;
  /** 0–100. */
  readonly accuracyPerceived: number | null;
}

/** The post-session answers to the self-estimate and the perceived-influence items. */
export function perceivedInfluence(records: readonly LogRecord[]): PerceivedInfluence {
  const post = records.find((r) => r.kind === "questionnaire_submitted" && (r.detail as QuestionnaireSubmittedDetail).questionnaireId === "post");
  const answers = post ? (post.detail as QuestionnaireSubmittedDetail).answers : [];
  const num = (id: string): number | null => { const v = answers.find((a) => a.itemId === id)?.value; return typeof v === "number" ? v : null; };
  const asked = (tool: AwarenessTool) => answers.some((a) => a.itemId === `influence.plan_views.${tool}` || a.itemId === `influence.answers.${tool}`);
  const tool: AwarenessTool | null = asked("haku") ? "haku" : asked("thinker") ? "thinker" : null;
  return {
    tool,
    planViews: tool ? num(`influence.plan_views.${tool}`) : null,
    answers: tool ? num(`influence.answers.${tool}`) : null,
    accuracyPerceived: num("accuracy.perceived"),
  };
}

type PlanKey = string;
type Part = { readonly sectorId: string; readonly taskId: string } | null | undefined;
/** The plan's content (main effort, posture, secondary sector and task, the drones' sector and task); the departure note is not a change of plan. */
const keyOf = (p: { readonly mainEffort: string; readonly posture?: string | null; readonly secondary?: Part; readonly drones?: Part }): PlanKey => {
  const part = (x: Part) => (x ? [x.sectorId, x.taskId] : null);
  return JSON.stringify([p.mainEffort, p.posture ?? null, part(p.secondary), part(p.drones)]);
};

/** Per main view, the views counted by the logged plan-influence rule (see the module note), ascending. */
export function loggedPlanInfluenceViews(records: readonly LogRecord[], tool: AwarenessTool): number[] {
  const finals = new Map<number, FinalPlanOfView>(finalPlanPerView(records).map((f) => [f.view, f]));
  // Every plan record with its view (the view whose `cycle_start` it follows), in log order.
  const plans: { readonly seq: number; readonly view: number; readonly key: PlanKey }[] = [];
  let view = -1;
  for (const r of records) {
    if (r.kind === "cycle_start") { view = (r.detail as CycleStartDetail).cycle; continue; }
    if ((r.kind === "allocation_submitted" || r.kind === "allocation_revised") && view >= 1) {
      plans.push({ seq: r.seq as number, view, key: keyOf((r.detail as AllocationSubmittedDetail | AllocationRevisedDetail).plan) });
    }
  }
  const counted: number[] = [];
  for (const [v, final] of [...finals.entries()].sort((a, b) => a[0] - b[0])) {
    const before = shownAnswers(records).filter((a) => a.tool === tool && a.view === v && a.seq < final.seq);
    const previous = finals.get(v - 1);
    const changed = before.some((a) => {
      const inView = plans.filter((p) => p.view === v && p.seq < a.seq).at(-1);
      const inForce = inView?.key ?? (previous ? keyOf(previous) : null);
      return inForce !== null && inForce !== keyOf(final);
    });
    if (changed) counted.push(v);
  }
  return counted;
}

export interface AwarenessIndex extends PerceivedInfluence {
  readonly loggedPlanViews: number | null;
  /** Perceived minus logged periods. */
  readonly planViewsGap: number | null;
  /** `influence.answers` / 100 minus the caller's stated share (null without one). */
  readonly answersGap: number | null;
  /** `accuracy.perceived` / 100 minus the caller's proportion correct (null without one). */
  readonly selfEstimateGap: number | null;
}

/** The awareness index of one session: `statedShare` and `accuracy` (0–1) come from the freeze measures, when the caller has them. */
export function awarenessIndex(records: readonly LogRecord[], logged: { readonly statedShare?: number; readonly accuracy?: number } = {}): AwarenessIndex {
  const p = perceivedInfluence(records);
  const loggedPlanViews = p.tool ? loggedPlanInfluenceViews(records, p.tool).length : null;
  const gap = (a: number | null, b: number | null | undefined) => (a === null || b === null || b === undefined ? null : a - b);
  return {
    ...p,
    loggedPlanViews,
    planViewsGap: gap(p.planViews, loggedPlanViews),
    answersGap: gap(p.answers === null ? null : p.answers / 100, logged.statedShare),
    selfEstimateGap: gap(p.accuracyPerceived === null ? null : p.accuracyPerceived / 100, logged.accuracy),
  };
}
