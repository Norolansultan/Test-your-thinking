/**
 * SPAM delivery (SPEC/15 §5; phase-B round 2, brief D4, 4 Oct 2026; SPEC/27 revision (ag), 9 Oct 2026). Split out of `orchestrator.ts`.
 *
 * The probe is ONLINE: the map, the message log and the view's clock run on. At its moment on the
 * view's clock the participant gets a ready prompt ("Valmis vastaamaan?"); the question is not shown
 * yet, so they can finish what they are doing (the time to "ready" is the workload index). Revision
 * (ag): the ready prompt NO LONGER EXPIRES — it stays until "ready" is pressed — and the participant
 * may collapse it to a small pill and expand it again (`spam_collapsed` / `spam_expanded`; nothing is
 * cancelled, the ready latency runs on). After "ready" the question and its four options are shown
 * and the decision panel is held; Haku and the Thinker stay USABLE (revision (ag) supersedes D4's
 * tool lock: the question is the commander's task with the tools at hand, so SPAM measures the
 * commander-plus-tools' situation knowledge). Choosing an option is final; then its confidence on
 * the one scale. The probe closes on the confidence, or `answerTimeoutMs` (60 s) after the item was
 * shown with no answer and confidence. Timeouts are logged, never errors.
 *
 * FORCED at the view's end (revision (ag)): a view end that falls due while the ready prompt is still
 * up does not drop the probe. The orchestrator pauses the view's clock and calls `force`: the item is
 * shown at once as a modal step (the same answer window), logged as `spam_ready` with `forced: true`,
 * the view moment and the view end it holds — so the ready latency is CENSORED at that record — and
 * the view ends when the probe closes. A session interrupted during a forced probe resumes into it
 * (`resumeForced`, `resumed: true`). Demonstration skip: a ready prompt still up when the presenter
 * skips the view is logged `skipped: true` and closed, no item (as a skipped freeze leaves its items
 * missing); a prompt not yet due is not logged (as a freeze still to come).
 *
 * The rules where SPAM meets the rest of the view (the orchestrator enforces them, tests in
 * `test/session/spam.spec.ts` and `spam-forced.spec.ts`):
 * - It never meets a freeze: SPAM views carry no freeze (`buildProbeSchedule` refuses one, and the
 *   orchestrator registers the SPAM cue only in a view without a freeze, or — the practice view —
 *   after its freeze); it never meets the hinge, which lies between views.
 * - While the item (or its confidence) is open, the decision panel is held: its submissions are
 *   refused and the screen keeps its drafts; during the ready prompt it stays usable.
 * - A merged view's step boundary waits for an open ITEM (its key must not move under the question);
 *   the ready prompt holds nothing. A view end during an open item waits for it to close; during the
 *   ready prompt it forces the item (above).
 *
 * Records are raw (`record-kinds.ts`): `spam_prompt_shown`, `spam_collapsed`, `spam_expanded`,
 * `spam_ready`, `spam_answered`, `recall_confidence_submitted`, `spam_closed`; every latency and the
 * per-probe tool use are derived later (`spam-measures.ts`). The probe carries no key (the key is the
 * invariant `spam.cycle_<n>`), so nothing here is truth.
 *
 * SPEC/30 §5.2 (19 Oct 2026): a SECOND ITEM (V3, V6; `second`, id `<first id>.b`, `secondSpamProbeId`) follows the
 * first under the same "ready" — no second prompt, no second `spam_prompt_shown` or `spam_ready`. When the first item
 * closes (its confidence given, or its answer window run out) the second is shown at once, with its own 60 s answer
 * window and its own `spam_answered` and `recall_confidence_submitted` (its id); `spam_closed` comes once, after the
 * second item, with the FIRST item's id (the delivery's: it pairs with `spam_prompt_shown` and `spam_ready`, and with a
 * forced `spam_ready` for the resume plan). The decision panel stays held, the view's end and a step boundary wait,
 * and the tools stay usable throughout both. Forced at the view's end, both items are forced (modal). The second
 * item's display moment is the first item's last record (its confidence, or its timed-out answer), or — when only the
 * first item's confidence ran out, which logs nothing — the end of the first item's answer window.
 */

import type { CycleIndex } from "../engine/primitives.js";
import type { PracticeViewIndex, ProbeSpec } from "../scenario/types.js";
import type { TelemetryEvent, ViewEndedDetail } from "../telemetry/record-kinds.js";
import { assertConfidenceStep } from "./confidence.js";
import type { SpamView } from "./snapshot.js";

export interface SpamHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
  /** Called once the probe has closed (after `spam_closed` is logged): anything held for it runs now. */
  readonly closed: () => Promise<void>;
}

type Phase = "ready" | "item" | "confidence";

/** A SPAM probe: a main view's, or the practice view's (5 Oct 2026, `practice-spam.ts`; cycle 0). */
export type SpamProbe = Omit<ProbeSpec, "cycle"> & { readonly cycle: ProbeSpec["cycle"] | PracticeViewIndex };
type SpamCycle = CycleIndex | PracticeViewIndex;

/** The fallback answer window when a probe carries none (the study's is `SPAM_ANSWER_TIMEOUT_MS`, 60 s). */
const DEFAULT_ANSWER_TIMEOUT_MS = 60_000;

export class SpamDelivery {
  /** The item on screen (the first, or after it the second). */
  private probe: SpamProbe | null = null;
  /** The delivery's first item's id: `spam_closed` carries it (SPEC/30 §5.2). */
  private deliveryId: string | null = null;
  /** SPEC/30 §5.2: the second item still to come in this delivery, if any. */
  private second: SpamProbe | null = null;
  /** 1 or 2 in a delivery of `itemCount` items. */
  private itemIndex: 1 | 2 = 1;
  private itemCount: 1 | 2 = 1;
  private cycle: SpamCycle | null = null;
  private phase: Phase | null = null;
  /** The phase on screen: it follows `phase` once the participant's step is durable (I5), so the next screen never shows before its record. */
  private shown: Phase | null = null;
  private chosen: string | null = null;
  private collapsed = false;
  /** The item was forced at the view's end (revision (ag)). */
  private forced = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false; // set synchronously so a double click is refused while the log write is awaited

  constructor(private readonly host: SpamHost) {}

  /** A probe is on screen (the ready prompt, the item or its confidence). */
  get open(): boolean { return this.phase !== null; }

  /** Only the ready prompt is up: a view end now forces the item. */
  get readyOpen(): boolean { return this.phase === "ready"; }

  /** The item (or its confidence) is open: the decision panel is held (the tools are not, revision (ag)). */
  get itemOpen(): boolean { return this.phase === "item" || this.phase === "confidence"; }

  view(): SpamView | null {
    const p = this.probe;
    if (!p || !this.phase || !this.shown) return null;
    if (this.shown === "ready") return { phase: "ready", probeId: p.id, collapsed: this.collapsed };
    const options = p.response.kind === "categorical" ? p.response.options.map((o) => ({ id: o.id, fi: o.fi })) : [];
    return { phase: this.shown, probeId: p.id, promptFi: p.prompt, options, chosen: this.shown === "confidence" ? this.chosen : null, forced: this.forced, itemIndex: this.itemIndex, itemCount: this.itemCount };
  }

  /**
   * The ready prompt, at the probe's moment on the view's clock (`atViewSeconds`, logged). It waits for "ready" (no expiry).
   * `second` (SPEC/30 §5.2): the item shown after this one under the same "ready".
   */
  async show(probe: SpamProbe, cycle: SpamCycle, atViewSeconds: number, second: SpamProbe | null = null): Promise<void> {
    if (this.open) throw new Error(`SPAM ${probe.id} while ${this.probe!.id} is open`);
    const notSpam = [probe, second].find((p) => p !== null && p.type !== "S");
    if (notSpam) throw new Error(`${notSpam.id} is not a SPAM probe`);
    this.begin(probe, cycle, second);
    // The prompt shows once `spam_prompt_shown` is durable (I5; fix pass 2, 7 Oct 2026: it was notified first).
    await this.host.event({ kind: "spam_prompt_shown", detail: { probeId: probe.id, cycle, atViewSeconds } });
    if (this.phase === "ready" && this.probe === probe) this.shown = "ready";
    this.host.notify();
  }

  /** Collapses the ready prompt to its pill (revision (ag)): nothing is cancelled, the ready latency runs on. */
  async collapse(): Promise<void> { await this.toggle(true); }
  /** Expands the pill back to the ready prompt. */
  async expand(): Promise<void> { await this.toggle(false); }

  /** "Valmis": the question is shown (the decision panel held). */
  async ready(): Promise<void> {
    const probe = this.expect("ready", "spamReady");
    await this.openItem(probe, { probeId: probe.id, timedOut: false });
  }

  /**
   * The view's end fell due during the ready prompt (revision (ag)): the item is shown now, as a modal
   * step with the same answer window; the orchestrator has paused the view's clock and holds the end.
   * `spam_ready` carries `forced`, the view moment and the held end, so the ready latency is censored there.
   */
  async force(atViewSeconds: number, viewEndedBy: ViewEndedDetail["endedBy"], resumed = false): Promise<void> {
    const probe = this.expect("ready", "forceSpam");
    this.forced = true;
    await this.openItem(probe, { probeId: probe.id, timedOut: false, forced: true, atViewSeconds, viewEndedBy, ...(resumed ? { resumed: true as const } : {}) });
  }

  /**
   * A session interrupted during a forced probe (revision (ag)): the forced item again, `resumed: true`; no new prompt
   * record. With a second item (SPEC/30 §5.2) the delivery runs again from its first item, as the forced item always has.
   */
  async resumeForced(probe: SpamProbe, cycle: SpamCycle, atViewSeconds: number, viewEndedBy: ViewEndedDetail["endedBy"], second: SpamProbe | null = null): Promise<void> {
    if (this.open) throw new Error(`resumeForced ${probe.id} while ${this.probe!.id} is open`);
    this.begin(probe, cycle, second);
    await this.force(atViewSeconds, viewEndedBy, true);
  }

  /** The option (final); its confidence is asked next, within the same answer window. */
  async answer(optionId: string): Promise<void> {
    const probe = this.expect("item", "answerSpam");
    const ids = probe.response.kind === "categorical" ? probe.response.options.map((o) => o.id) : [];
    if (!ids.includes(optionId)) throw new RangeError(`answerSpam: "${optionId}" is not an option of ${probe.id}`);
    this.busy = true;
    try {
      this.phase = "confidence";
      this.chosen = optionId;
      await this.host.event({ kind: "spam_answered", detail: { probeId: probe.id, response: optionId, timedOut: false } });
      if (this.phase === "confidence") this.shown = "confidence"; // the confidence is asked once the option is durable (I5)
      this.host.notify();
    } finally { this.busy = false; }
  }

  /** The confidence on the one scale; the item closes (the second item follows, else the probe closes). */
  async confidence(value: number): Promise<void> {
    const probe = this.expect("confidence", "submitSpamConfidence");
    assertConfidenceStep(value);
    this.busy = true;
    try {
      this.disarm();
      await this.host.event({ kind: "recall_confidence_submitted", detail: { probeId: probe.id, value } });
      await this.itemDone();
    } finally { this.busy = false; }
  }

  /**
   * Demonstration only: the presenter skips the view while the ready prompt is up — logged `skipped`,
   * closed, no item. The view is ending, so nothing held for the probe runs (`host.closed` is not called).
   */
  async skip(): Promise<void> {
    const probe = this.expect("ready", "skipSpam"), cycle = this.cycle!;
    this.busy = true;
    await this.host.event({ kind: "spam_ready", detail: { probeId: probe.id, timedOut: false, skipped: true } }); // the second item is not shown either
    this.reset();
    await this.host.event({ kind: "spam_closed", detail: { probeId: probe.id, cycle } });
    this.host.notify();
  }

  /** Drops whatever is open without a record (the view is gone; cannot happen while a probe is open, which holds the view's end). */
  reset(): void {
    this.disarm();
    this.probe = null; this.cycle = null; this.phase = this.shown = null; this.chosen = null; this.busy = false;
    this.collapsed = false; this.forced = false;
    this.deliveryId = null; this.second = null; this.itemIndex = 1; this.itemCount = 1;
  }

  private begin(probe: SpamProbe, cycle: SpamCycle, second: SpamProbe | null): void {
    this.probe = probe;
    this.deliveryId = probe.id;
    this.second = second;
    this.itemIndex = 1;
    this.itemCount = second ? 2 : 1;
    this.cycle = cycle;
    this.phase = "ready";
    this.shown = null;
    this.chosen = null;
    this.collapsed = false;
    this.forced = false;
  }

  private async toggle(collapse: boolean): Promise<void> {
    const probe = this.expect("ready", collapse ? "collapseSpam" : "expandSpam");
    if (this.collapsed === collapse) return; // already so: nothing to log
    this.collapsed = collapse;
    this.host.notify();
    await this.host.event(collapse ? { kind: "spam_collapsed", detail: { probeId: probe.id } } : { kind: "spam_expanded", detail: { probeId: probe.id } });
  }

  /** The item is shown: the answer window starts, `spam_ready` is logged, the question shows once it is durable (I5). */
  private async openItem(probe: SpamProbe, detail: Extract<TelemetryEvent, { kind: "spam_ready" }>["detail"]): Promise<void> {
    this.busy = true;
    try {
      this.phase = "item"; // the decision panel is held at once; the question shows once "ready" is durable (I5)
      this.collapsed = false;
      this.arm(probe.answerTimeoutMs ?? DEFAULT_ANSWER_TIMEOUT_MS, () => this.answerTimedOut());
      await this.host.event({ kind: "spam_ready", detail });
      if (this.phase === "item") this.shown = "item";
      this.host.notify();
    } finally { this.busy = false; }
  }

  private expect(phase: Phase, name: string): SpamProbe {
    if (this.phase !== phase || this.busy) throw new Error(`${name} with the SPAM probe ${this.phase ?? "closed"}${this.busy ? " (already submitting)" : ""}`);
    return this.probe!;
  }

  private async answerTimedOut(): Promise<void> {
    if (this.phase !== "item" && this.phase !== "confidence") return;
    this.busy = true; // a late answer or confidence is refused
    try {
      if (this.phase === "item") await this.host.event({ kind: "spam_answered", detail: { probeId: this.probe!.id, response: null, timedOut: true } });
      await this.itemDone(); // an option without its confidence: the confidence is missing data
    } finally { this.busy = false; }
  }

  /** The item on screen is over: the delivery's second item now (SPEC/30 §5.2), else the probe closes. */
  private async itemDone(): Promise<void> {
    const next = this.second;
    if (next === null) { await this.close(); return; }
    // Shown at once: the first item's last record is durable (or, its confidence run out, nothing was to be logged).
    this.second = null;
    this.probe = next;
    this.itemIndex = 2;
    this.chosen = null;
    this.phase = this.shown = "item";
    this.arm(next.answerTimeoutMs ?? DEFAULT_ANSWER_TIMEOUT_MS, () => this.answerTimedOut());
    this.host.notify();
  }

  private async close(): Promise<void> {
    const probeId = this.deliveryId ?? this.probe!.id, cycle = this.cycle!;
    this.reset();
    this.host.notify();
    await this.host.event({ kind: "spam_closed", detail: { probeId, cycle } });
    await this.host.closed();
  }

  private arm(ms: number, fire: () => Promise<void>): void {
    this.disarm();
    this.timer = setTimeout(() => { this.timer = null; void fire(); }, ms);
  }

  private disarm(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
