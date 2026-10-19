/**
 * The plan-confidence item (SPEC/30 §5.4, 19 Oct 2026). Split out of `orchestrator.ts`, which runs what follows a
 * main view's end in this order (`SessionOrchestrator.afterViewEnded`):
 *
 * 1. `view_ended` — the plan is final (the participant's confirmation, the minimum length or the time cap);
 * 2. this item: "How confident are you that your plan fits the situation?", on the study's one scale (25/50/75/100,
 *    `confidence.ts`), the view's map still on screen, the tools closed — never after a skipped view (demonstration)
 *    and never in the practice view;
 * 3. in V10 and V14 the freeze at the view's end (SPEC/30 §5.1, `FREEZE_AT_VIEW_END`), exactly as a freeze runs mid-view;
 * 4. V14's after-view probes (the backup and coverage items);
 * 5. the next view (or the training, the hinge, the questionnaire).
 *
 * Records (raw): `plan_confidence_presented` — durable before the item shows (I5) — and `plan_confidence_submitted`
 * `{ cycle, value }`. Calibration (H18) is read against the keyed views' plans by the analysis; nothing here is truth.
 *
 * Resume: a session interrupted during this item (or the end-of-view freeze) has no `cycle_end` for the view, so
 * `planSessionResume` replays the view from its start (SPEC/05 §9: never mid-view), and this item follows its end again
 * — as V14's after-view probes always have. The analysis takes the last attempt's records.
 */

import type { CycleIndex } from "../engine/primitives.js";
import type { TelemetryEvent } from "../telemetry/record-kinds.js";
import { assertConfidenceStep } from "./confidence.js";

export interface PlanConfidenceHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
}

/** The item as the screen shows it (its wording is the UI's, `UI_TEXT.planConfidence`). */
export interface PlanConfidenceView {
  readonly cycle: CycleIndex;
}

export class PlanConfidence {
  private cycle: CycleIndex | null = null;
  /** On screen: follows `cycle` once `plan_confidence_presented` is durable (I5). */
  private shown = false;
  private busy = false;

  constructor(private readonly host: PlanConfidenceHost) {}

  /** The item is up (presented or being presented). */
  get open(): boolean { return this.cycle !== null; }

  view(): PlanConfidenceView | null {
    return this.cycle !== null && this.shown ? { cycle: this.cycle } : null;
  }

  /** Presents the item for `cycle`'s final plan; it shows once its record is durable. */
  async present(cycle: CycleIndex): Promise<void> {
    if (this.cycle !== null) throw new Error(`plan confidence for V${cycle} while V${this.cycle}'s is open`);
    this.cycle = cycle;
    this.shown = false;
    await this.host.event({ kind: "plan_confidence_presented", detail: { cycle } });
    if (this.cycle === cycle) {
      this.shown = true;
      this.host.notify();
    }
  }

  /** The participant's rating (on the one scale); the item closes once `plan_confidence_submitted` is durable. */
  async submit(value: number): Promise<CycleIndex> {
    const cycle = this.cycle;
    if (cycle === null || !this.shown || this.busy) throw new Error(`submitPlanConfidence with no plan-confidence item on screen${this.busy ? " (already submitting)" : ""}`);
    assertConfidenceStep(value);
    this.busy = true;
    try {
      await this.host.event({ kind: "plan_confidence_submitted", detail: { cycle, value } });
      this.reset();
      return cycle;
    } finally { this.busy = false; }
  }

  reset(): void {
    this.cycle = null;
    this.shown = false;
  }
}
