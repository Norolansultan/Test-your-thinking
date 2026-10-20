/**
 * The plan review at commitment (SPEC/32 §3, 20 Oct 2026). Split out of `orchestrator.ts`, which decides when it opens and
 * what the view's clock and end do around it (`SessionOrchestrator.endView`, `keepPlan`, `revisePlan`):
 *
 * - **When.** Phase B (V8–V14), both groups, once per view, at the moment the plan would become final: the minimum length
 *   reached with a plan recorded and no revision open (`minimum_reached`, today's `minimum_length` end), or a plan or a revision
 *   recorded after the minimum (`plan_after_minimum`, today's `participant_confirm` or `minimum_length` end). An open SPAM item
 *   or a forced ready prompt holds it as it holds the view's end; a freeze or a visible probe open then holds it until it closes.
 *   No plan by the cap: no review (the view ends `time_cap` as before). Never in phase A or the practice view.
 * - **While open.** The view's clock stands still (as in a freeze); the tools are closed, the map and the message log stay.
 *   Both groups see the plan as recorded and two buttons; the guide group (`reasoning_intent`) also sees the premise lines —
 *   the fixed template of SPEC/30 §3.3, looked up on the server from the premise-evidence table at the view's records clock
 *   (`plan-review-transport.ts`, no model call). A cited record opens in the message log (`plan_review_record_opened`).
 *   A failed lookup shows the neutral review and the record carries `premiseError`.
 * - **Closing.** Keep: the view ends as it would have. Revise: the allocation opens again by the revision path
 *   (`allocation_revision_opened`, then `allocation_revised`), the view ends when the revision is recorded with no second
 *   review, and the cap moves to leave {@link REVIEW_REVISION_MIN_SECONDS} when fewer were left. The cap reached while it is
 *   open closes it (`time_cap`); the plan stands.
 *
 * Records (format 0.12.0): `plan_review_shown` — durable before the review shows (I5) — `plan_review_record_opened` and
 * `plan_review_closed`. Resume: a session interrupted during the review has no `cycle_end` for the view, so the view is
 * replayed from its start (SPEC/05 §9), as with the plan-confidence item; the analysis takes the last attempt's records.
 */

import type { CycleIndex } from "../engine/primitives.js";
import type { SectorPlan } from "../scenario/plan-types.js";
import type { LogRecord } from "../telemetry/log.js";
import type {
  AllocationRevisedDetail, AllocationSubmittedDetail, CycleStartDetail, PlanReviewClosedDetail, PlanReviewPremiseStatus, PlanReviewShownDetail, TelemetryEvent,
} from "../telemetry/record-kinds.js";
import { copyPlan } from "./allocation.js";
import type { PremiseReviewOutcome } from "./plan-review-transport.js";
import type { RadioLogEntry } from "./snapshot.js";

export { REVIEW_REVISION_MIN_SECONDS } from "../telemetry/record-kinds.js";

export type PlanReviewTrigger = PlanReviewShownDetail["trigger"];
/** The end a kept plan gives the view: today's end at that moment. */
export type PlanReviewEnd = "participant_confirm" | "minimum_length";

/** A record a premise line cites, as the message log shows it (`RadioLogEntry`), with the premise it decides. */
export interface PlanReviewCitedRecord extends RadioLogEntry {
  readonly atomId: string;
  readonly premiseId: string;
  /** The record is in the message log (pushed to the participant); otherwise it is shown in the review only. */
  readonly inLog: boolean;
}

/** The review as the screen shows it (its wording is the UI's, `UI_TEXT.planReview`); null until `plan_review_shown` is durable. */
export interface PlanReviewView {
  readonly cycle: CycleIndex;
  readonly trigger: PlanReviewTrigger;
  /** The guide group's premise lines (the server's fixed template); null in the Haku group or when the lookup failed. */
  readonly premiseLines: readonly string[] | null;
  /** The records the lines cite, in the statuses' order; empty without lines. */
  readonly citedRecords: readonly PlanReviewCitedRecord[];
  /** The cited record last opened (shown in the message log and the review), else null. */
  readonly openedAtomId: string | null;
}

export interface PlanReviewHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
  readonly realMs: () => number;
  /** A cited record as the message log shows it; null for an id the scenario lacks. */
  readonly citedRecord: (atomId: string, premiseId: string) => PlanReviewCitedRecord | null;
}

/**
 * The plan last recorded in `view`'s last attempt (after its last `cycle_start`): the submitted plan or its latest revision, and
 * how many revisions there were. A session resumed into a forced SPAM item (`resumeForcedSpam`) shows it at the review that follows.
 */
export function lastRecordedPlan(records: readonly LogRecord[], view: number): { readonly plan: SectorPlan | null; readonly revisions: number } {
  let plan: SectorPlan | null = null;
  let revisions = 0;
  for (const r of [...records].sort((a, b) => a.seq - b.seq)) {
    if (r.kind === "cycle_start" && (r.detail as CycleStartDetail).cycle === view) { plan = null; revisions = 0; }
    else if (r.kind === "allocation_submitted") plan = copyPlan((r.detail as AllocationSubmittedDetail).plan);
    else if (r.kind === "allocation_revised") { plan = copyPlan((r.detail as AllocationRevisedDetail).plan); revisions += 1; }
  }
  return { plan, revisions };
}

export class PlanReview {
  private cycle: CycleIndex | null = null;
  private trigger: PlanReviewTrigger = "minimum_reached";
  private endedBy: PlanReviewEnd = "minimum_length";
  /** On screen: follows `cycle` once `plan_review_shown` is durable (I5). */
  private shown = false;
  private shownMs = 0;
  private lines: readonly string[] | null = null;
  private statuses: readonly PlanReviewPremiseStatus[] = [];
  private opened: string | null = null;
  /** This view's review has been opened (once per view). */
  private presented = false;

  constructor(private readonly host: PlanReviewHost) {}

  /** The review is up (being presented, or on screen). */
  get open(): boolean { return this.cycle !== null; }
  /** On screen: its record is durable, its buttons answer. */
  get onScreen(): boolean { return this.cycle !== null && this.shown; }
  /** This view's review has opened already: no second one (SPEC/32 §3). */
  get done(): boolean { return this.presented; }
  /** The end a kept plan gives the view. */
  get end(): PlanReviewEnd { return this.endedBy; }

  view(): PlanReviewView | null {
    if (this.cycle === null || !this.shown) return null;
    const cited = this.lines === null ? [] : this.statuses.flatMap((s) => s.atomIds.flatMap((id) => { const r = this.host.citedRecord(id, s.premiseId); return r ? [r] : []; }));
    return { cycle: this.cycle, trigger: this.trigger, premiseLines: this.lines, citedRecords: cited, openedAtomId: this.opened };
  }

  /**
   * Opens the review for `cycle` at `atViewSeconds` (the caller has stopped the view's clock). `lookup`: the guide group's
   * premise lookup, or null (no request: the Haku group). It shows once `plan_review_shown` is durable.
   */
  async present(cycle: CycleIndex, trigger: PlanReviewTrigger, endedBy: PlanReviewEnd, atViewSeconds: number, lookup: (() => Promise<PremiseReviewOutcome>) | null): Promise<void> {
    if (this.cycle !== null || this.presented) throw new Error(`plan review for V${cycle} while ${this.cycle !== null ? `V${this.cycle}'s is open` : "this view's has been shown"}`);
    this.cycle = cycle; this.trigger = trigger; this.endedBy = endedBy; this.presented = true;
    this.shown = false; this.lines = null; this.statuses = []; this.opened = null;
    const outcome = lookup ? await lookup() : null;
    if (this.cycle !== cycle) return; // closed meanwhile (the view ended)
    const premises = outcome?.ok ? outcome.response : null;
    this.lines = premises ? [...premises.lines] : null;
    this.statuses = premises ? premises.statuses.map((s) => ({ premiseId: s.premiseId, status: s.status, atomIds: [...s.atomIds] })) : [];
    const detail: PlanReviewShownDetail = {
      cycle, atViewSeconds, trigger,
      premiseLines: this.lines, premiseStatuses: premises ? this.statuses : null, tableSha256: premises?.tableSha256 ?? null,
      ...(outcome && !outcome.ok ? { premiseError: outcome.error } : {}),
    };
    await this.host.event({ kind: "plan_review_shown", detail });
    if (this.cycle === cycle) {
      this.shown = true;
      this.shownMs = this.host.realMs();
      this.host.notify();
    }
  }

  /** A record a premise line cites, opened by the participant; logged at once, then shown. Only a cited id is accepted. */
  async openRecord(atomId: string): Promise<void> {
    const cycle = this.cycle;
    if (cycle === null || !this.shown) throw new Error("openReviewRecord with no plan review on screen");
    if (this.lines === null || !this.statuses.some((s) => s.atomIds.includes(atomId))) throw new RangeError(`openReviewRecord: ${atomId} is not a record the review cites`);
    await this.host.event({ kind: "plan_review_record_opened", detail: { cycle, atomId } });
    if (this.cycle === cycle) { this.opened = atomId; this.host.notify(); }
  }

  /** Closes the review (`plan_review_closed`, durable before it returns); the dwell counts from when it showed. */
  async close(choice: PlanReviewClosedDetail["choice"], capExtendedToSeconds?: number): Promise<void> {
    const cycle = this.cycle;
    if (cycle === null) throw new Error(`closing a plan review (${choice}) with none open`);
    const dwellMs = this.shown ? Math.max(0, Math.round(this.host.realMs() - this.shownMs)) : 0;
    this.cycle = null; this.shown = false; this.opened = null;
    await this.host.event({ kind: "plan_review_closed", detail: { cycle, choice, dwellMs, ...(capExtendedToSeconds !== undefined ? { capExtendedToSeconds } : {}) } });
  }

  /** A new view: no review yet. */
  reset(): void {
    this.cycle = null; this.shown = false; this.presented = false; this.lines = null; this.statuses = []; this.opened = null;
  }
}
