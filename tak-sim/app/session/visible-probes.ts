/**
 * The visible probe Type U (SPEC/08 §3.5, §4 PROBING_VISIBLE; readiness round, agent H,
 * 5 Oct 2026; Type E withdrawn with H6, Type F with Type J, 6 Oct 2026). Where each is delivered and why: `demo-probes.ts` ("TYPE F AND U"). This class holds
 * the visible probes, checks their answers and writes their raw records; the orchestrator decides WHEN (the
 * queue, the view's clock standing still, waiting for a SPAM probe or a freeze to close).
 *
 * Records (raw, existing kinds; SPEC/07 §2.6): `probe_presented` (with the view, the moment on the
 * view's clock and the step the participant was in; the option ids in the order shown) when the probe
 * shows; then `probe_submitted` (V13's area answer, the backup's option with its confidence, or the
 * coverage confidence). Revision (ai), 9 Oct 2026: V13's open text became the closed area item
 * (`area`): yes/no, then on yes the parts of the picture, in the participant's own order
 * (`option-order.ts`); no free text is left among the probes. The probe carries no key — the keys are invariants of the scenario (TRUTH),
 * read only by the analysis (`probe-measures.ts`, `probe-keys.ts`) — so nothing here is truth (I4).
 */

import type { ProbeSpec } from "../scenario/types.js";
import type { TelemetryEvent } from "../telemetry/record-kinds.js";
import { assertConfidenceStep } from "./confidence.js";
import { participantOptionOrder, type OptionOrderSeed } from "./option-order.js";
import type { JudgementStep } from "./snapshot.js";

/** What the screen needs to show a visible probe; no key. */
export interface VisibleProbeView {
  readonly probeId: string;
  readonly type: "U";
  /** `area`: yes/no, then on yes the parts of the picture (V13); `choice`: one option; `scale`: the 25/50/75/100 scale. */
  readonly kind: "area" | "choice" | "scale";
  readonly promptFi: string;
  /** In the order shown (for `area`, the participant's own order, "other" last). */
  readonly options: readonly { readonly id: string; readonly fi: string }[];
  /** `area`: the question shown after "yes"; else null. */
  readonly followUpFi: string | null;
  /** `choice`: the answer carries a confidence on the one scale (the backup, revision (ai)). */
  readonly collectsConfidence: boolean;
}

export class ProbeToolsLockedError extends Error {
  constructor(what: string) {
    super(`${what}: Haku and Thinker are locked while a visible probe (U) is open`);
    this.name = "ProbeToolsLockedError";
  }
}

export interface VisibleProbeHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
  /** The participant's option-order stream (`option-order.ts`). */
  readonly optionSeed: OptionOrderSeed;
}

type AreaResponse = Extract<ProbeSpec["response"], { kind: "area_check" }>;

function kindOf(probe: ProbeSpec): VisibleProbeView["kind"] {
  switch (probe.response.kind) {
    case "area_check": return "area";
    case "categorical": return "choice";
    case "confidence": return "scale";
    default: throw new Error(`${probe.id}: response ${probe.response.kind} is not a visible-probe response`);
  }
}

export class VisibleProbes {
  private probe: ProbeSpec | null = null;
  private busy = false;

  constructor(private readonly host: VisibleProbeHost) {}

  get open(): boolean { return this.probe !== null; }
  get current(): ProbeSpec | null { return this.probe; }

  view(): VisibleProbeView | null {
    const p = this.probe;
    if (!p) return null;
    const r = p.response;
    const all = r.kind === "categorical" || r.kind === "area_check" ? r.options : [];
    return {
      probeId: p.id, type: p.type as VisibleProbeView["type"], kind: kindOf(p), promptFi: p.prompt,
      options: this.shownOrder(p).map((id) => all.find((o) => o.id === id)!).map((o) => ({ id: o.id, fi: o.fi })),
      followUpFi: r.kind === "area_check" ? r.followUpPrompt : null,
      collectsConfidence: r.kind === "categorical" && p.collectsConfidence,
    };
  }

  /** The option ids as shown: the authored order, or for the area item the participant's own. */
  private shownOrder(p: ProbeSpec): string[] {
    const r = p.response;
    if (r.kind === "area_check") return participantOptionOrder(r.options.map((o) => o.id), r.fixedLastIds, this.host.optionSeed, p.id);
    return r.kind === "categorical" ? r.options.map((o) => o.id) : [];
  }

  /** Shows the probe and logs it (`probe_presented`). */
  async present(probe: ProbeSpec, at: { readonly cycle: number; readonly atViewSeconds: number | null; readonly decisionStep: JudgementStep | null }): Promise<void> {
    if (this.probe) throw new Error(`visible probe ${probe.id} while ${this.probe.id} is open`);
    if (probe.type !== "U") throw new Error(`${probe.id} is not a visible probe`);
    kindOf(probe);
    this.probe = probe;
    this.host.notify();
    await this.host.event({
      kind: "probe_presented",
      detail: {
        probeId: probe.id, type: probe.type, mode: probe.mode, optionIds: this.shownOrder(probe),
        cycle: at.cycle, atViewSeconds: at.atViewSeconds, decisionStep: at.decisionStep,
      },
    });
  }

  /**
   * V13's area item: `unsure` the yes/no; on yes, at least one part (no repeats), logged in the order
   * shown, with that order (`optionOrder`); on no, none.
   */
  async submitArea(unsure: boolean, areaIds: readonly string[]): Promise<void> {
    const probe = this.expect("area", "submitArea");
    const r = probe.response as AreaResponse;
    if (typeof unsure !== "boolean") throw new RangeError("submitArea: the yes/no is a boolean");
    if (!Array.isArray(areaIds) || new Set(areaIds).size !== areaIds.length) throw new RangeError("submitArea: the parts are a list without repeats");
    for (const id of areaIds) if (!r.options.some((o) => o.id === id)) throw new RangeError(`submitArea: "${String(id)}" is not an option of ${probe.id}`);
    if (!unsure && areaIds.length > 0) throw new RangeError("submitArea: parts only after yes");
    if (unsure && areaIds.length === 0) throw new RangeError("submitArea: yes needs at least one part");
    const optionOrder = this.shownOrder(probe);
    const areas = optionOrder.filter((id) => areaIds.includes(id));
    await this.close({ kind: "probe_submitted", detail: { probeId: probe.id, response: { unsure, areas, optionOrder } } });
  }

  /** U backup: one of the options as shown, with its confidence on the one scale when the probe collects one (revision (ai)). */
  async submitChoice(optionId: string, confidence?: number): Promise<void> {
    const probe = this.expect("choice", "submitChoice");
    const r = probe.response as Extract<ProbeSpec["response"], { kind: "categorical" }>;
    if (!r.options.some((o) => o.id === optionId)) throw new RangeError(`submitChoice: "${optionId}" is not an option of ${probe.id}`);
    if (probe.collectsConfidence) assertConfidenceStep(confidence as number);
    else if (confidence !== undefined) throw new RangeError(`submitChoice: ${probe.id} takes no confidence`);
    await this.close({ kind: "probe_submitted", detail: { probeId: probe.id, response: optionId, ...(probe.collectsConfidence ? { confidence: confidence! } : {}) } });
  }

  /** U coverage confidence, on the one scale. */
  async submitScale(value: number): Promise<void> {
    const probe = this.expect("scale", "submitScale");
    assertConfidenceStep(value);
    await this.close({ kind: "probe_submitted", detail: { probeId: probe.id, response: value } });
  }

  /** Drops an open probe without a record (the view is gone). */
  reset(): void { this.probe = null; this.busy = false; }

  private expect(kind: VisibleProbeView["kind"], name: string): ProbeSpec {
    if (!this.probe || this.busy || kindOf(this.probe) !== kind) throw new Error(`${name} with ${this.probe ? `${this.probe.id} (${kindOf(this.probe)})` : "no visible probe"} open${this.busy ? " (already submitting)" : ""}`);
    return this.probe;
  }

  /** Logs the answer (durably, before the screen moves on: I5), then closes the probe. */
  private async close(record: TelemetryEvent): Promise<void> {
    this.busy = true;
    try {
      await this.host.event(record);
      this.probe = null;
    } finally { this.busy = false; }
  }
}
