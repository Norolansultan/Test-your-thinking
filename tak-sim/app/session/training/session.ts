/**
 * The training incident inside the session (SPEC/15 (bp)): what `orchestrator.ts` holds for its `training_incident` step and delegates
 * to in one line each — the flow (`controller.ts`), S3's Haku (`haku.ts`), the resume (`resume.ts`) and the snapshot's fields
 * (`view.ts`). While the step is `training_incident` the orchestrator routes the session's real components here:
 *
 * - Haku's chat (`askAiChat`) → `askChat` (S3 only; `training_haku_*`, never `ai_chat_*`);
 * - the SPAM card (`answerSpam`, `submitSpamConfidence`, `spamSecondsLeft`) → S3's question card;
 * - the freeze screen (`submitFreeze`; `mapExtent`, `freezeNowLabel`) → S4's item, its answer and its locked map;
 * - map use, tab and freeze-map records (`logMapUse`, `logTabSelected`, `logFreezeMapPick`, `logPanelUse`) → nothing (the training's
 *   map use is not logged, SPEC/07 (bp)).
 */

import type { GeoExtent } from "../../engine/primitives.js";
import type { Lang } from "../../i18n/lang.js";
import { TRAINING_TEXT } from "../../i18n/training-texts.js";
import type { Cell } from "../../scenario/types.js";
import type { LogHeader, LogRecord } from "../../telemetry/log.js";
import type { FreezeItemAnsweredDetail, TelemetryEvent } from "../../telemetry/record-kinds.js";
import { assertConfidenceStep } from "../confidence.js";
import { MAP_POINT_OPTION_ID } from "../freeze-answers.js";
import type { TemplateAnswer } from "../template-answer.js";
import type { ThinkerTransport } from "../thinker-transport.js";
import { trainingExtent } from "./area.js";
import { TrainingController, type TrainingDemo } from "./controller.js";
import { TrainingHaku } from "./haku.js";
import type { TrainingAnswer, TrainingView } from "./host.js";
import { keptTrainingOf, NOTHING_KEPT } from "./resume.js";
import type { TrainingSpec } from "./spec.js";
import { trainingFreezeNowLabel, trainingSnapshotParts, type TrainingSnapshotParts } from "./view.js";

export interface TrainingRunHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  /** The training has ended (`training_completed` durable): the intro video and VP follow. */
  ended(): Promise<void>;
  header(): LogHeader;
  readonly language: Lang;
  readonly cell: Cell;
}

/** S5's recording for a cell (SPEC/30 (bp)): Haku's in the Haku cell, the guide's in the Thinker cells; its examples' ids from the texts. */
export function trainingDemoOf(cell: Cell, lang: Lang): TrainingDemo {
  const ids = TRAINING_TEXT[lang].demo(cell).examples.map((e) => e.id);
  return { demoId: cell === "radio" ? "haku" : "guide", exampleIds: ids };
}

export class TrainingRun {
  readonly controller: TrainingController;
  readonly haku: TrainingHaku;

  constructor(private readonly host: TrainingRunHost, readonly spec: TrainingSpec, thinker: { readonly transport?: ThinkerTransport; readonly wait?: (ms: number) => Promise<void> } = {}) {
    this.controller = new TrainingController(host, spec, () => trainingDemoOf(host.cell, host.language));
    this.haku = new TrainingHaku({
      event: (e) => host.event(e), notify: () => host.notify(), realMs: () => host.realMs(), header: () => host.header(),
      language: () => host.language, cell: () => host.cell,
      openItem: () => this.controller.hakuOpen(), asked: (itemId) => this.controller.noteHakuAsked(itemId),
    }, thinker);
  }

  /** Shows the training (`training_started`); a resume (`records`) re-opens it where the log says (SPEC/15 (bp) §bp.4). */
  start(records: readonly LogRecord[] = [], resumed = false): Promise<void> {
    const kept = resumed ? keptTrainingOf(records) : NOTHING_KEPT;
    this.haku.restore(kept);
    return this.controller.start(kept, resumed);
  }

  view(): TrainingView | null { return this.controller.view(); }

  snapshotParts(): TrainingSnapshotParts {
    return trainingSnapshotParts(this.spec, {
      view: this.controller.view(), item: this.controller.currentItem(), cardChoice: this.controller.cardChoiceNow(),
      hakuTurns: this.haku.turns, hakuWaiting: this.haku.waiting,
    }, this.host.language);
  }

  // The orchestrator's `TrainingHost` methods.
  leaveIntro(): Promise<void> { return this.controller.leaveIntro(); }
  leaveSection(): Promise<void> { return this.controller.leaveSection(); }
  answer(itemId: string, answer: TrainingAnswer, measures?: readonly number[]): Promise<void> { return this.controller.answer(itemId, answer, measures); }
  leaveFeedback(itemId: string): Promise<void> { return this.controller.leaveFeedback(itemId); }
  leaveDemo(): Promise<void> { return this.controller.leaveDemo(); }
  noteMeasure(metres: number): void { this.controller.noteMeasure(metres); }
  secondsLeft(): number { return this.controller.secondsLeft(); }
  studySecondsLeft(): number { return this.controller.studySecondsLeft(); }
  cardSecondsLeft(): number { return this.controller.cardSecondsLeft(); }
  demoSecondsLeft(): number { return this.controller.demoSecondsLeft(); }

  // The real components, routed while the step is `training_incident`.
  /** Haku's chat (S3). */
  askChat(text: string): Promise<TemplateAnswer> { return this.haku.ask(text); }
  /** The SPAM card's option and confidence (S3's question card). */
  chooseCard(optionId: string): Promise<void> { return this.controller.chooseCard(optionId); }
  confidenceCard(value: number): Promise<void> { return this.controller.confidenceCard(value); }
  /** The SPAM card's countdown: null when no question card is on screen. */
  cardCountdown(): number | null { return this.controller.cardOpen() ? this.controller.cardSecondsLeft() : null; }
  /** The freeze screen's map: the training's locked area. */
  get extent(): GeoExtent { return trainingExtent(this.spec); }
  freezeNowLabel(): string { return trainingFreezeNowLabel(this.spec); }

  /** The freeze screen's submission (S4: one item on screen): its answer, with its confidence; a map item's point. */
  submitFreeze(responses: readonly FreezeItemAnsweredDetail[]): Promise<void> {
    const item = this.controller.currentItem();
    const view = this.controller.view();
    if (!item || item.mode !== "freeze" || view?.phase !== "question") return Promise.reject(new Error("submitFreeze: no training freeze item on the screen"));
    const r = responses.find((x) => x.itemId === item.id);
    if (!r || responses.length !== 1) return Promise.reject(new Error(`submitFreeze: one answer, for ${item.id}`));
    try { assertConfidenceStep(r.confidence); } catch (e) { return Promise.reject(e); }
    const confidence = r.confidence as NonNullable<TrainingAnswer["confidence"]>;
    if (r.optionId === MAP_POINT_OPTION_ID) {
      if (!r.point) return Promise.reject(new RangeError(`submitFreeze: ${item.id} needs its point`));
      return this.controller.answer(item.id, { point: r.point, confidence }, []);
    }
    return this.controller.answer(item.id, { choiceId: r.optionId, confidence }, []);
  }

  dispose(): void { this.controller.dispose(); }
}
