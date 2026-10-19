/**
 * The answer history of an item before its submission (SPEC/07 §2.6; first emitter SPEC/30 §5.4, 19 Oct 2026), for the
 * freeze items (`FreezeScreen`, `probeId` = the item's id) and the visible probes (`VisibleProbeCard`, the probe's id):
 * - `probe_option_hovered`: a mouse or pen entered an option (pre-selection consideration). Every entry, a return to an
 *   option included; nothing on touch. A few hundred records per session at most.
 * - `probe_answer_changed`: every change of the answer before it is sent, `from` the answer before (null: none yet)
 *   `to` the new one; one record per click that changes it (~1–2 per item). The new answer is shown only once its
 *   record is durable (I5); a refused write leaves the answer as it was, so the next click logs it again.
 * The submitted answer stays in its own record (`freeze_submitted`, `probe_submitted`); this is the path to it. No
 * key, no correctness: the screen holds none (I4).
 */

import { interactionLog, quietly, type InteractionLog } from "./interaction-log.js";
import type { SessionOrchestrator } from "../../session/orchestrator.js";

export class ProbeAnswerTracker {
  private readonly answers = new Map<string, string>();
  private readonly hoverLog: ReturnType<typeof quietly>;

  constructor(private readonly log: InteractionLog) {
    this.hoverLog = quietly(log);
  }

  static of(orchestrator: Pick<SessionOrchestrator, "logMapUse">): ProbeAnswerTracker {
    return new ProbeAnswerTracker(interactionLog(orchestrator));
  }

  /** A pointer entered an option; `pointerType` "touch" is not a hover and is not logged. */
  hovered(probeId: string, optionId: string, pointerType = "mouse"): void {
    if (pointerType === "touch") return;
    this.hoverLog({ kind: "probe_option_hovered", detail: { probeId, optionId } });
  }

  /** The answer as last chosen (the screen may not show it yet: its record is being written). */
  current(probeId: string): string | null {
    return this.answers.get(probeId) ?? null;
  }

  /**
   * The participant chose `to`: logged, then `show` once durable. Choosing the answer already chosen logs nothing and
   * shows at once. A refused write resets the answer, so a retry is logged as a change again.
   */
  changed(probeId: string, to: string, show: () => void): void {
    const from = this.current(probeId);
    if (from === to) { show(); return; }
    this.answers.set(probeId, to);
    void this.log({ kind: "probe_answer_changed", detail: { probeId, from, to } }).then(show, () => {
      if (this.answers.get(probeId) === to) {
        if (from === null) this.answers.delete(probeId);
        else this.answers.set(probeId, from);
      }
    });
  }
}

/** A visible area probe's answer as one value: "no", "yes", or "yes:" and the parts chosen in order, joined by "+". */
export function areaAnswer(unsure: boolean, areas: readonly string[]): string {
  return !unsure ? "no" : areas.length === 0 ? "yes" : `yes:${areas.join("+")}`;
}
