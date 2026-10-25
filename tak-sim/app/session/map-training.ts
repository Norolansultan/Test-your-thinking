/**
 * The map training (researcher decision 25 Oct 2026; SPEC/08 (bj), SPEC/15 (bj)): seven short tasks on the neutral extract around
 * Kaitajärvi (`content/pretest/map-training.json`, built and keyed by `tools/review/map-training.ts`) that teach how to behave on the
 * simulation's map — find a named place, measure a distance, fire and slope, water by road, the map against the log ("now" is the
 * latest reports), projecting by the clock, and the memory-check map. It replaces the map-reading pretest in the same step
 * (`map_pretest`, owned by `orchestrator.ts`): after the pre-session item (and the primer in a public session), before the intro video
 * and the practice view, identical in both groups and both audiences (`SessionOptions.mapPretest`).
 *
 * - One task at a time, in a fixed order: the question (a choice, or a point on the extract), answered ONCE, then its feedback (the
 *   right answer drawn and one or two sentences on how it works in the simulation), left with "Next task". No retry, no score shown.
 *   The memory task first shows the extract with a unit for `memoryMs` (8 s), then the blank memory-check map.
 * - A 5-minute cap on the whole training from its appearance (`timeLimitMs`); the tasks not answered by then are missing.
 * - Records (format 0.17.0; the pretest's kinds kept): `map_pretest_started`, per task `map_pretest_answer` (its FIRST answer, logged
 *   before the feedback shows: the choice, or the point with its error in metres) and `map_pretest_feedback_left {dwellMs}`, then
 *   `map_pretest_completed`. Tasks 1 and 7's errors are the per-person pointing baseline (SPEC/09 (bj)).
 * - Resume: the training reopens on the first task whose feedback was not left — its feedback again if its answer is logged (the answer
 *   stands), else its question; the cap is what is left after the active time already logged. A training that had ended is not shown
 *   again.
 */

import type { LogRecord } from "../telemetry/log.js";
import type { MapPretestAnswerDetail, MapPretestEndReason, MapPretestFeedbackLeftDetail, TelemetryEvent } from "../telemetry/record-kinds.js";
import { isPointTask, pointErrorMetres, type MapTrainingSpec, type TrainingAnswer, type TrainingPhase, type TrainingTask } from "./map-training-spec.js";
import trainingSpec from "../../content/pretest/map-training.json" with { type: "json" };

export const MAP_TRAINING: MapTrainingSpec = trainingSpec as unknown as MapTrainingSpec;

/** The task on screen and where it is (its geometry and texts: `MAP_TRAINING` and `map-training-texts.ts` by `taskId`). */
export interface MapTrainingView {
  readonly taskId: string;
  /** 1-based, of `taskCount`. */
  readonly position: number;
  readonly taskCount: number;
  /** `study`: the memory task's unit on the map; `answer`: the question; `feedback`: the right answer and why. */
  readonly phase: TrainingPhase;
  /** In the feedback: the first answer (as logged) and, for a point, its distance from the key (m). */
  readonly answer: TrainingAnswer | null;
  readonly errorM: number | null;
  readonly timeLimitMs: number;
}

/** What a log holds of the training, for a resume: each task's first answer, and the tasks whose feedback was left. */
export interface KeptTraining {
  readonly answers: ReadonlyMap<string, TrainingAnswer>;
  readonly done: ReadonlySet<string>;
}

export function keptTraining(records: readonly LogRecord[]): KeptTraining {
  const answers = new Map<string, TrainingAnswer>();
  const done = new Set<string>();
  for (const r of records) {
    if (r.kind === "map_pretest_answer") {
      const d = r.detail as MapPretestAnswerDetail;
      if (!answers.has(d.itemId)) answers.set(d.itemId, d.point ? { point: d.point } : { choiceId: d.choiceId ?? "" });
    } else if (r.kind === "map_pretest_feedback_left") done.add((r.detail as MapPretestFeedbackLeftDetail).itemId);
  }
  return { answers, done };
}

/** The active time already logged (questions, the memory task's exposure, feedback), charged against the cap on a resume. */
export function trainingSpentMs(records: readonly LogRecord[]): number {
  return records.reduce((s, r) => {
    if (r.kind === "map_pretest_answer") { const d = r.detail as MapPretestAnswerDetail; return s + d.rtMs + (d.memoryMs ?? 0); }
    return r.kind === "map_pretest_feedback_left" ? s + (r.detail as MapPretestFeedbackLeftDetail).dwellMs : s;
  }, 0);
}

/** Whether the training has ended in this log: a resume does not show it again. */
export function mapTrainingEnded(records: readonly LogRecord[]): boolean {
  return records.some((r) => r.kind === "map_pretest_completed");
}

export interface MapTrainingHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  /** The training has ended and its end record is durable: the session moves on (to the intro video and the practice view). */
  ended(): Promise<void>;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export class MapTraining {
  private answers = new Map<string, TrainingAnswer>();
  private done = new Set<string>();
  private state: "idle" | "running" | "ended" = "idle";
  private index = 0;
  private phase: TrainingPhase = "answer";
  private startedMs = 0;
  private shownMs = 0; // the current phase's appearance
  private deadlineMs = 0;
  private studyEndsMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private studyTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly host: MapTrainingHost, private readonly spec: MapTrainingSpec = MAP_TRAINING) {}

  /** Shows the training: logs `map_pretest_started` and starts the cap (`kept`, `spentMs`: from before a resume). */
  start(kept: KeptTraining = { answers: new Map(), done: new Set() }, spentMs = 0, resumed = false): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "idle") throw new Error("map training: already started");
      this.answers = new Map(kept.answers);
      this.done = new Set(kept.done);
      const first = this.spec.tasks.findIndex((t) => !kept.done.has(t.id));
      const remainingMs = Math.max(0, this.spec.timeLimitMs - spentMs);
      this.state = "running";
      this.startedMs = this.host.realMs();
      this.deadlineMs = this.startedMs + remainingMs;
      await this.host.event({ kind: "map_pretest_started", detail: {
        version: this.spec.version, itemIds: this.spec.tasks.map((t) => t.id), timeLimitMs: this.spec.timeLimitMs, remainingMs, resumed,
        keptItemIds: this.spec.tasks.filter((t) => kept.done.has(t.id)).map((t) => t.id),
      } });
      if (first === -1) return this.finish("completed");
      if (remainingMs === 0) return this.finish("timeout");
      this.timer = setTimeout(() => void this.enqueue(() => this.finish("timeout")).catch(() => undefined), remainingMs);
      this.enter(first);
    });
  }

  view(): MapTrainingView | null {
    if (this.state !== "running") return null;
    const task = this.task();
    const answer = this.phase === "feedback" ? this.answers.get(task.id) ?? null : null;
    return {
      taskId: task.id, position: this.index + 1, taskCount: this.spec.tasks.length, phase: this.phase, timeLimitMs: this.spec.timeLimitMs,
      answer, errorM: answer && "point" in answer ? pointErrorMetres(this.spec, task, answer.point) : null,
    };
  }

  /** Whole seconds left on the cap (the countdown), 0 once ended. */
  secondsLeft(): number { return this.state === "running" ? Math.max(0, Math.ceil((this.deadlineMs - this.host.realMs()) / 1000)) : 0; }

  /** Whole seconds the memory task's unit is still shown, 0 outside that phase. */
  studySecondsLeft(): number { return this.state === "running" && this.phase === "study" ? Math.max(0, Math.ceil((this.studyEndsMs - this.host.realMs()) / 1000)) : 0; }

  /**
   * The task on screen answered (once, final): logged at once with its error for a point and the measure tool's readings
   * (`measures`, m); then its feedback shows.
   */
  answer(taskId: string, answer: TrainingAnswer, measures: readonly number[] = []): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("map training: it has ended");
      const task = this.task();
      if (task.id !== taskId) throw new Error(`map training: ${taskId} is not on the screen`);
      if (this.phase !== "answer") throw new Error(`map training: ${taskId} is not asked now (${this.phase})`);
      const detail = this.answerDetail(task, answer, measures);
      await this.host.event({ kind: "map_pretest_answer", detail });
      this.answers.set(task.id, "point" in answer ? { point: detail.point! } : { choiceId: answer.choiceId });
      this.phase = "feedback";
      this.shownMs = this.host.realMs();
      this.host.notify();
    });
  }

  /** The feedback on screen left ("Next task"): logged with its dwell; the last ends the training (`completed`). */
  leaveFeedback(taskId: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("map training: it has ended");
      const task = this.task();
      if (task.id !== taskId || this.phase !== "feedback") throw new Error(`map training: no feedback of ${taskId} on the screen`);
      await this.host.event({ kind: "map_pretest_feedback_left", detail: { itemId: task.id, position: this.index + 1, dwellMs: Math.max(0, Math.round(this.host.realMs() - this.shownMs)) } });
      this.done.add(task.id);
      if (this.index === this.spec.tasks.length - 1) return this.finish("completed");
      this.enter(this.index + 1);
      this.host.notify();
    });
  }

  /** Clears the timers (the session is torn down). */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.studyTimer !== null) clearTimeout(this.studyTimer);
    this.timer = this.studyTimer = null;
  }

  private task(): TrainingTask { return this.spec.tasks[this.index]!; }

  /** Puts task `i` on screen: its feedback when its answer is already logged (a resume), else the memory task's unit or the question. */
  private enter(i: number): void {
    this.index = i;
    const task = this.task();
    this.shownMs = this.host.realMs();
    if (this.answers.has(task.id)) { this.phase = "feedback"; return; }
    if (task.kind !== "memory") { this.phase = "answer"; return; }
    this.phase = "study";
    this.studyEndsMs = this.shownMs + this.spec.memoryMs;
    this.studyTimer = setTimeout(() => void this.enqueue(async () => {
      this.studyTimer = null;
      if (this.state !== "running" || this.task() !== task || this.phase !== "study") return;
      this.phase = "answer";
      this.shownMs = this.host.realMs();
      this.host.notify();
    }).catch(() => undefined), this.spec.memoryMs);
  }

  private answerDetail(task: TrainingTask, answer: TrainingAnswer, measures: readonly number[]): MapPretestAnswerDetail {
    const base = {
      itemId: task.id, position: this.index + 1, rtMs: Math.max(0, Math.round(this.host.realMs() - this.shownMs)),
      measures: measures.map((m) => { if (!Number.isFinite(m) || m < 0) throw new RangeError("map training: a measure is a distance in metres"); return Math.round(m); }),
      ...(task.kind === "memory" ? { memoryMs: this.spec.memoryMs } : {}),
    };
    if (isPointTask(task)) {
      if (!("point" in answer)) throw new RangeError(`map training: ${task.id} is answered with a point`);
      const { x, y } = answer.point, size = this.spec.crop.size;
      if (!(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= size && y <= size)) throw new RangeError(`map training: the point is not on the extract (0–${size})`);
      const point = { x: r1(x), y: r1(y) };
      return { ...base, point, errorM: pointErrorMetres(this.spec, task, point)! };
    }
    if (!("choiceId" in answer) || !task.options.some((o) => o.id === answer.choiceId)) throw new RangeError(`map training: "${"choiceId" in answer ? answer.choiceId : "a point"}" is not an option of ${task.id}`);
    return { ...base, choiceId: answer.choiceId };
  }

  private async finish(endReason: MapPretestEndReason): Promise<void> {
    if (this.state !== "running") return;
    this.state = "ended";
    this.dispose();
    const missingItemIds = this.spec.tasks.filter((t) => !this.answers.has(t.id)).map((t) => t.id);
    await this.host.event({ kind: "map_pretest_completed", detail: {
      endReason, answeredCount: this.spec.tasks.length - missingItemIds.length, missingItemIds, durationMs: Math.max(0, Math.round(this.host.realMs() - this.startedMs)),
    } });
    await this.host.ended();
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
