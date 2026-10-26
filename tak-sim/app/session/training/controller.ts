/**
 * The training incident's flow and records (SPEC/15 (bp) §bp.2–§bp.4, SPEC/08 (bp), SPEC/07 (bp)): the state machine behind the
 * orchestrator's `training_incident` step. It writes `training_*` records only.
 *
 * - The intro (once), then for each of S1–S4 its section card (`training_section_left` with its dwell) and its items. An item: the
 *   question; the answer (once, final; `training_answer` is logged before anything else shows); the feedback, left with
 *   `training_feedback_left`. Nothing is skippable.
 * - A question card (S3, `mode: "card"`): `cardWindowMs` (60 s); at 0 the item closes unanswered (`timedOut`, no confidence; a choice
 *   already made stands) and its feedback shows. Its answer carries `hakuBefore`.
 * - The memory item (S4, `memory`): the unit shown for `exposureMs` (phase `study`), then the blank map (phase `question`); `rtMs` is
 *   from the blank map's appearance, `memoryMs` the exposure.
 * - The cap (`capMs`, 12 min) runs from the intro's appearance to S4's end; at the cap the unanswered items are missing
 *   (`endReason: "timeout"`) and S5 is still shown. S5 (phase `demo`, outside the cap) is left no sooner than `demoMinDwellMs`:
 *   `training_demo_shown`, then `training_completed` (`durationMs` the active time from the intro to S4's end), then the host moves on.
 * - Resume (§bp.4): `start(kept, true)` re-opens at the first item whose feedback was not left — its feedback again when its answer is
 *   logged, else its question (a card with a fresh window; the memory exposure in full again); a section card is not shown again once
 *   one of its items is logged; the cap is what is left after the active time already logged.
 *
 * Every operation is serialised (`enqueue`), so a timer (the cap, the card's window, the exposure) never interleaves with a write.
 */

import type { LatLon } from "../../engine/primitives.js";
import type { TelemetryEvent } from "../../telemetry/record-kinds.js";
import type { TrainingAnswerDetail } from "../../telemetry/record-kinds-training.js";
import { assertConfidenceStep } from "../confidence.js";
import type { TrainingAnswer, TrainingView } from "./host.js";
import type { TrainingItem, TrainingSectionId, TrainingSpec } from "./spec.js";
import { insideBox, trainingErrorM, trainingLockBox } from "./area.js";
import { answerOfDetail, NOTHING_KEPT, type KeptTraining, type LoggedTrainingAnswer } from "./resume.js";

export interface TrainingControllerHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  /** S5 left and `training_completed` durable: the session moves on (the intro video and VP). */
  ended(): Promise<void>;
}

/** S5's recording for the session's cell: `haku` (the Haku cell) or `guide` (the Thinker cells), and its examples' ids. */
export interface TrainingDemo { readonly demoId: "haku" | "guide"; readonly exampleIds: readonly string[] }

type Phase = TrainingView["phase"];
type Tools = TrainingView["tools"];

const NO_TOOLS: Tools = { map: false, rb: false, log: false, haku: false };
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * The real tools open for an item in a phase (SPEC/08 (bp) §bp.1's table): S1 the map and R&B; S2 also the message log; S3 also Haku
 * (the question card); S4 none (the freeze screen), the live map only during the memory exposure and under a map item's feedback
 * (a point answer, or a `map` source), never under a log or records item's (the map would answer the next item).
 */
export function trainingTools(item: TrainingItem | null, phase: Phase): Tools {
  if (!item) return NO_TOOLS;
  if (phase === "study") return { ...NO_TOOLS, map: true };
  if (phase !== "question" && phase !== "feedback") return NO_TOOLS;
  if (item.mode === "freeze" || item.section === "s4") return { ...NO_TOOLS, map: phase === "feedback" && (item.answer === "point" || item.source === "map") };
  const log = item.section === "s2" || item.section === "s3" || item.mode === "card";
  return { map: true, rb: true, log, haku: item.mode === "card" };
}

/** The sections `training_started` lists: the spec's, with S5 last. */
function sectionIdsOf(spec: TrainingSpec): string[] {
  const ids: string[] = spec.sections.map((s) => s.id);
  return ids.includes("s5") ? ids : [...ids, "s5"];
}

export class TrainingController {
  private answers = new Map<string, LoggedTrainingAnswer>();
  private done = new Set<string>();
  private hakuAsked = new Map<string, number>();
  private state: "idle" | "items" | "demo" | "ended" = "idle";
  private phase: Phase = "intro";
  private index = -1;
  private cardLeftFor: TrainingSectionId | null = null;
  private startedMs = 0; // this run's start: the intro's appearance, or the resume
  private spentBeforeMs = 0; // the active time logged before a resume
  private deadlineMs = 0;
  private shownMs = 0; // the current phase's appearance
  private itemShownMs = 0; // the current item's appearance (Haku's `atItemMs`)
  private studyEndsMs = 0;
  private cardEndsMs = 0;
  private cardChoice: string | null = null;
  private measures: number[] = [];
  private endReason: "completed" | "timeout" = "completed";
  private durationMs = 0;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private itemTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly host: TrainingControllerHost, private readonly spec: TrainingSpec, private readonly demo: () => TrainingDemo) {}

  /** The intro is shown: `training_started`, the cap starts (`kept`: a resume's log; `resumed`: re-opened after an interruption). */
  start(kept: KeptTraining = NOTHING_KEPT, resumed = false): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "idle") throw new Error("training: already started");
      this.answers = new Map(kept.answers);
      this.done = new Set(kept.done);
      this.hakuAsked = new Map(kept.hakuAskedByItem);
      this.spentBeforeMs = Math.min(this.spec.capMs, Math.max(0, Math.round(kept.spentMs)));
      const remainingMs = this.spec.capMs - this.spentBeforeMs;
      this.state = "items";
      this.startedMs = this.shownMs = this.host.realMs();
      this.deadlineMs = this.startedMs + remainingMs;
      await this.host.event({ kind: "training_started", detail: {
        version: this.spec.version, sectionIds: sectionIdsOf(this.spec), itemIds: this.spec.items.map((it) => it.id), capMs: this.spec.capMs,
        remainingMs, resumed, keptItemIds: this.spec.items.filter((it) => this.done.has(it.id)).map((it) => it.id),
      } });
      const first = this.nextIndex(-1);
      if (first === -1) return this.endItems("completed");
      if (remainingMs === 0) return this.endItems("timeout");
      this.capTimer = setTimeout(() => void this.enqueue(() => this.endItems("timeout")).catch(() => undefined), remainingMs);
      this.phase = "intro";
      this.shownMs = this.host.realMs();
      if (kept.pastIntro) this.showCardOrItem(first);
    });
  }

  /** The intro's button: the first section's card (or, after a resume, where the participant was). */
  leaveIntro(): Promise<void> {
    return this.enqueue(async () => {
      this.assertPhase("intro", "trainingStart");
      this.showCardOrItem(this.nextIndex(-1));
      this.host.notify();
    });
  }

  /** A section card left: `training_section_left` with its dwell, then its first item. */
  leaveSection(): Promise<void> {
    return this.enqueue(async () => {
      this.assertPhase("section", "trainingLeaveSection");
      const item = this.item()!;
      await this.host.event({ kind: "training_section_left", detail: { sectionId: item.section, dwellMs: this.since(this.shownMs) } });
      this.cardLeftFor = item.section;
      this.enterItem(this.index);
      this.host.notify();
    });
  }

  /**
   * The item on screen answered (once, final): `training_answer`, then its feedback. `measures`: the R&B readings (m); absent, the
   * ones noted on this item (`noteMeasure`). A card's or freeze item's answer carries its confidence; a live item's none.
   */
  answer(itemId: string, answer: TrainingAnswer, measures?: readonly number[]): Promise<void> {
    return this.enqueue(async () => {
      const item = this.asking(itemId, "answerTraining");
      if (this.cardChoice !== null && (!("choiceId" in answer) || answer.choiceId !== this.cardChoice)) throw new Error(`answerTraining: ${itemId}'s choice is final (${this.cardChoice})`);
      await this.record(item, this.answerDetail(item, answer, measures ?? this.measures));
    });
  }

  /** A question card's option (final; the SPAM card's flow): its confidence is asked next. Not logged until the answer. */
  chooseCard(optionId: string): Promise<void> {
    return this.enqueue(async () => {
      const item = this.openCard("answerSpam");
      if (this.cardChoice !== null) throw new Error(`answerSpam: ${item.id}'s choice is final`);
      if (!item.options.some((o) => o.id === optionId)) throw new RangeError(`answerSpam: "${optionId}" is not an option of ${item.id}`);
      this.cardChoice = optionId;
      this.host.notify();
    });
  }

  /** A question card's confidence: the card's answer (its choice and this confidence) is logged, then its feedback. */
  confidenceCard(value: number): Promise<void> {
    return this.enqueue(async () => {
      const item = this.openCard("submitSpamConfidence");
      if (this.cardChoice === null) throw new Error(`submitSpamConfidence: no option of ${item.id} chosen`);
      assertConfidenceStep(value);
      await this.record(item, this.answerDetail(item, { choiceId: this.cardChoice, confidence: value }, this.measures));
    });
  }

  /** An R&B measurement on the item on screen (m), logged with its answer. Ignored outside a question with R&B open. */
  noteMeasure(metres: number): void {
    if (this.state !== "items" || this.phase !== "question" || !trainingTools(this.item(), this.phase).rb) return;
    if (Number.isFinite(metres) && metres >= 0) this.measures.push(Math.round(metres));
  }

  /** A feedback left ("Seuraava" / the last: "Valmis"): `training_feedback_left`, then the next item, card or S5. */
  leaveFeedback(itemId: string): Promise<void> {
    return this.enqueue(async () => {
      const item = this.item();
      if (this.state !== "items" || this.phase !== "feedback" || !item || item.id !== itemId) throw new Error(`leaveTrainingFeedback: no feedback of ${itemId} on the screen`);
      await this.host.event({ kind: "training_feedback_left", detail: { itemId, position: item.position, dwellMs: this.since(this.shownMs) } });
      this.done.add(item.id);
      const next = this.nextIndex(this.index);
      if (next === -1) return this.endItems("completed");
      this.showCardOrItem(next);
      this.host.notify();
    });
  }

  /** S5 left (no sooner than `demoMinDwellMs`): `training_demo_shown`, `training_completed`, then the session moves on. */
  leaveDemo(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "demo") throw new Error(`leaveTrainingDemo: S5 is not on the screen (${this.state === "items" ? this.phase : this.state})`);
      const dwellMs = this.since(this.shownMs);
      if (dwellMs < this.spec.demoMinDwellMs) throw new Error(`leaveTrainingDemo: the button is enabled after ${this.spec.demoMinDwellMs} ms (${dwellMs} ms)`);
      const { demoId, exampleIds } = this.demo();
      await this.host.event({ kind: "training_demo_shown", detail: { demoId, exampleIds: [...exampleIds], dwellMs } });
      const missingItemIds = this.spec.items.filter((it) => !this.answers.has(it.id)).map((it) => it.id);
      await this.host.event({ kind: "training_completed", detail: {
        endReason: this.endReason, answeredCount: this.spec.items.length - missingItemIds.length, missingItemIds, durationMs: this.durationMs,
      } });
      this.state = "ended";
      this.phase = "ended";
      await this.host.ended();
    });
  }

  /** Haku's question on the item on screen is logged (`hakuBefore` counts it when the item is answered after it). */
  noteHakuAsked(itemId: string): void { this.hakuAsked.set(itemId, (this.hakuAsked.get(itemId) ?? 0) + 1); }

  /** The item Haku may answer for now (S3, its question or feedback) and the ms since it appeared; null: Haku is closed. */
  hakuOpen(): { readonly itemId: string; readonly atItemMs: number } | null {
    const item = this.item();
    if (this.state !== "items" || !item || !trainingTools(item, this.phase).haku) return null;
    return { itemId: item.id, atItemMs: this.since(this.itemShownMs) };
  }

  view(): TrainingView | null {
    if (this.state === "idle" || this.state === "ended") return null;
    const item = this.state === "items" && this.phase !== "intro" ? this.item() : null;
    const onItem = item !== null && this.phase !== "section";
    const logged = this.phase === "feedback" && item ? this.answers.get(item.id) : undefined;
    const tools = trainingTools(item, this.phase);
    return {
      phase: this.phase,
      sectionId: this.state === "demo" ? "s5" : item?.section ?? null,
      itemId: onItem ? item.id : null,
      position: onItem ? item.position : item ? item.position - 1 : 0,
      itemCount: this.spec.items.length,
      scene: tools.map && item ? item.scene : null,
      tools,
      answer: logged?.answer ?? null,
      errorM: logged?.errorM ?? null,
      timedOut: logged?.timedOut ?? false,
      demoId: this.state === "demo" ? this.demo().demoId : null,
      capMs: this.spec.capMs,
    };
  }

  /** The item on screen (its question, exposure, feedback or section card), else null. */
  currentItem(): TrainingItem | null { return this.state === "items" ? this.item() : null; }
  /** A question card's option chosen and waiting for its confidence, else null. */
  cardChoiceNow(): string | null { return this.cardChoice; }
  /** Whole seconds left on the cap (the countdown); 0 once S4 has ended. */
  secondsLeft(): number { return this.state === "items" ? this.left(this.deadlineMs) : 0; }
  /** Whole seconds the memory item's unit is still shown; 0 outside the exposure. */
  studySecondsLeft(): number { return this.state === "items" && this.phase === "study" ? this.left(this.studyEndsMs) : 0; }
  /** Whole seconds left on the question card's window; 0 when no card question is on screen. */
  cardSecondsLeft(): number { return this.cardOpen() ? this.left(this.cardEndsMs) : 0; }
  /** Whole seconds until S5's button is enabled; 0 outside S5 or once it is. */
  demoSecondsLeft(): number { return this.state === "demo" ? this.left(this.shownMs + this.spec.demoMinDwellMs) : 0; }
  cardOpen(): boolean { return this.state === "items" && this.phase === "question" && this.item()?.mode === "card"; }

  /** Clears the timers (the session is torn down). */
  dispose(): void {
    this.clearItemTimer();
    if (this.capTimer !== null) clearTimeout(this.capTimer);
    this.capTimer = null;
  }

  // ---- internals -----------------------------------------------------------------------------------------------------------

  private item(): TrainingItem | null { return this.index >= 0 ? this.spec.items[this.index] ?? null : null; }
  private since(ms: number): number { return Math.max(0, Math.round(this.host.realMs() - ms)); }
  private left(untilMs: number): number { return Math.max(0, Math.ceil((untilMs - this.host.realMs()) / 1000)); }
  private nextIndex(after: number): number { return this.spec.items.findIndex((it, k) => k > after && !this.done.has(it.id)); }

  private assertPhase(phase: Phase, name: string): void {
    if (this.state !== "items" || this.phase !== phase) throw new Error(`${name}: not in the training's ${phase} (${this.state === "items" ? this.phase : this.state})`);
  }

  private asking(itemId: string, name: string): TrainingItem {
    const item = this.item();
    if (this.state !== "items" || !item || this.phase === "intro" || this.phase === "section") throw new Error(`${name}: no training item on the screen`);
    if (item.id !== itemId) throw new Error(`${name}: ${itemId} is not on the screen (${item.id} is)`);
    if (this.phase !== "question") throw new Error(`${name}: ${itemId} is not asked now (${this.phase})`);
    return item;
  }

  private openCard(name: string): TrainingItem {
    if (!this.cardOpen()) throw new Error(`${name}: no training question card on the screen`);
    return this.item()!;
  }

  /** Item `i` next: its section's card first unless that card was just left or an item of the section is logged. */
  private showCardOrItem(i: number): void {
    const item = this.spec.items[i]!;
    this.index = i;
    const sectionLogged = this.spec.items.some((it) => it.section === item.section && this.answers.has(it.id));
    if (this.cardLeftFor === item.section || sectionLogged) { this.enterItem(i); return; }
    this.clearItemTimer();
    this.phase = "section";
    this.shownMs = this.host.realMs();
  }

  /** Puts item `i` on screen: its feedback when its answer is logged (a resume), else the memory exposure or the question. */
  private enterItem(i: number): void {
    this.clearItemTimer();
    this.index = i;
    const item = this.item()!;
    this.itemShownMs = this.shownMs = this.host.realMs();
    this.cardChoice = null;
    this.measures = [];
    if (this.answers.has(item.id)) { this.phase = "feedback"; return; }
    if (item.memory) {
      this.phase = "study";
      this.studyEndsMs = this.shownMs + item.memory.exposureMs;
      this.itemTimer = setTimeout(() => void this.enqueue(async () => {
        this.itemTimer = null;
        if (this.state !== "items" || this.item() !== item || this.phase !== "study") return;
        this.phase = "question";
        this.shownMs = this.host.realMs();
        this.host.notify();
      }).catch(() => undefined), item.memory.exposureMs);
      return;
    }
    this.phase = "question";
    if (item.mode !== "card") return;
    this.cardEndsMs = this.shownMs + this.spec.cardWindowMs;
    this.itemTimer = setTimeout(() => void this.enqueue(() => this.timeOutCard(item)).catch(() => undefined), this.spec.cardWindowMs);
  }

  /** The card's window ran out: the item closes unanswered (`timedOut`; a choice already made stands, no confidence). */
  private async timeOutCard(item: TrainingItem): Promise<void> {
    this.itemTimer = null;
    if (this.state !== "items" || this.item() !== item || this.phase !== "question") return;
    await this.record(item, {
      itemId: item.id, sectionId: item.section, position: item.position, rtMs: this.since(this.shownMs), measures: [...this.measures],
      ...(this.cardChoice !== null ? { choiceId: this.cardChoice } : {}), hakuBefore: this.hakuAsked.get(item.id) ?? 0, timedOut: true,
    });
  }

  private answerDetail(item: TrainingItem, answer: TrainingAnswer, measures: readonly number[]): TrainingAnswerDetail {
    const base = {
      itemId: item.id, sectionId: item.section, position: item.position, rtMs: this.since(this.shownMs),
      measures: measures.map((m) => { if (!Number.isFinite(m) || m < 0) throw new RangeError("answerTraining: a measure is a distance in metres"); return Math.round(m); }),
    };
    let confidence = {};
    if (answer.confidence !== undefined) {
      if (item.mode === "live") throw new RangeError(`answerTraining: ${item.id} is answered without a confidence`);
      assertConfidenceStep(answer.confidence);
      confidence = { confidence: answer.confidence };
    } else if (item.mode !== "live") throw new RangeError(`answerTraining: ${item.id} is answered with a confidence (25/50/75/100)`);
    const after = { ...confidence, ...(item.memory ? { memoryMs: item.memory.exposureMs } : {}), ...(item.mode === "card" ? { hakuBefore: this.hakuAsked.get(item.id) ?? 0, timedOut: false } : {}) };
    if (item.answer === "point") {
      if (!("point" in answer)) throw new RangeError(`answerTraining: ${item.id} is answered with a point`);
      const p: LatLon = answer.point;
      if (!insideBox(p, trainingLockBox(this.spec))) throw new RangeError(`answerTraining: the point is outside the training's area`);
      const point = { lat: r6(p.lat), lon: r6(p.lon) };
      const errorM = trainingErrorM(item, point);
      return { ...base, point, ...(errorM !== null ? { errorM } : {}), ...after };
    }
    if (!("choiceId" in answer) || !item.options.some((o) => o.id === answer.choiceId)) throw new RangeError(`answerTraining: "${"choiceId" in answer ? answer.choiceId : "a point"}" is not an option of ${item.id}`);
    return { ...base, choiceId: answer.choiceId, ...after };
  }

  /** Logs an item's first answer, then shows its feedback. */
  private async record(item: TrainingItem, detail: TrainingAnswerDetail): Promise<void> {
    await this.host.event({ kind: "training_answer", detail });
    this.answers.set(item.id, { answer: answerOfDetail(detail), errorM: detail.errorM ?? null, timedOut: detail.timedOut === true });
    this.clearItemTimer();
    this.cardChoice = null;
    this.phase = "feedback";
    this.shownMs = this.host.realMs();
    this.host.notify();
  }

  /** S4 has ended (every feedback left, or the cap): S5 shows; the cap stops and the training's active time is fixed. */
  private async endItems(reason: "completed" | "timeout"): Promise<void> {
    if (this.state !== "items") return;
    this.dispose();
    this.state = "demo";
    this.endReason = reason;
    this.durationMs = this.spentBeforeMs + this.since(this.startedMs);
    this.phase = "demo";
    this.cardChoice = null;
    this.shownMs = this.host.realMs();
    this.host.notify();
  }

  private clearItemTimer(): void {
    if (this.itemTimer !== null) clearTimeout(this.itemTimer);
    this.itemTimer = null;
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
