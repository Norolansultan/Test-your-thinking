/**
 * The manipulation check on the hinge screen (brief D3, 4 Oct 2026), split out of `orchestrator.ts` (21 Oct 2026, to keep it from
 * growing). The hinge screen shows the directive; with a check in the scenario, "the directive is read" shows the question
 * (`hinge_check_presented`, the answer latency's time base), one answer is taken (`hinge_check_answered`), and only then may the
 * hinge be left. Each record is durable before the screen moves on (I5).
 */

import type { ScenarioContract } from "../scenario/types.js";
import type { TelemetryEvent } from "../telemetry/record-kinds.js";
import type { HingeCheckView } from "./snapshot.js";

export interface HingeCheckHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
}

export class HingeCheck {
  /** Where the check stands while the hinge screen shows (null: no check, or the hinge not on screen), and the option chosen. */
  private phase: HingeCheckView["phase"] | null = null;
  private chosen: string | null = null;

  constructor(private readonly host: HingeCheckHost, private readonly item: ScenarioContract["hinge"]["manipulationCheck"]) {}

  /** The hinge screen opens: the directive first (the check, if any, waits for it to be read). */
  enter(): void {
    this.phase = this.item ? "directive" : null;
    this.chosen = null;
  }

  /** The hinge is left; refused while a check is not yet answered. */
  leave(): void {
    if (this.phase !== null && this.phase !== "answered") throw new Error(`dismissHinge before the manipulation check is answered (${this.phase})`);
    this.phase = null;
  }

  /** The question is on screen (the directive is hidden meanwhile, SPEC/27 §4.1). */
  get asking(): boolean { return this.phase === "item"; }

  view(): HingeCheckView | null {
    if (!this.item || this.phase === null) return null;
    return { phase: this.phase, promptFi: this.item.promptFi, options: this.item.options.map(({ id, labelFi }) => ({ id, labelFi })), chosen: this.chosen };
  }

  /** The directive is read: the question is shown once `hinge_check_presented` is durable. */
  async show(step: string): Promise<void> {
    if (step !== "hinge_pause" || !this.item || this.phase !== "directive") throw new Error(`showHingeCheck in step ${step} (${this.phase ?? "no check"})`);
    this.phase = "item";
    await this.host.event({ kind: "hinge_check_presented", detail: { itemId: this.item.id } });
    this.host.notify();
  }

  /** The check's answer: one submission, one of its options; Continue is enabled once it is durable. */
  async answer(step: string, optionId: string): Promise<void> {
    if (step !== "hinge_pause" || !this.item || this.phase !== "item") throw new Error(`answerHingeCheck in step ${step} (${this.phase ?? "no check"})`);
    if (!this.item.options.some((o) => o.id === optionId)) throw new RangeError(`answerHingeCheck: "${optionId}" is not an option of ${this.item.id}`);
    this.phase = "answered";
    this.chosen = optionId;
    await this.host.event({ kind: "hinge_check_answered", detail: { itemId: this.item.id, optionId } });
    this.host.notify();
  }
}
