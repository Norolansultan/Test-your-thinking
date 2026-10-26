/**
 * What the durable log holds of the training incident, for a resume (SPEC/15 (bp) §bp.4, SPEC/07 (bp)): the log alone restores the
 * training. Pure reads of `training_*` records; nothing else is read and nothing is written here.
 *
 * - Each item's FIRST answer (`training_answer`), with its error and whether its card timed out, so its feedback shows again and the
 *   answer stands.
 * - The items whose feedback was left (`training_feedback_left`): the training re-opens at the first item not in this set.
 * - The active time already logged — section cards' dwell, items' `rtMs`, the memory item's exposure, feedback dwell — which the cap
 *   is charged with. (The intro's and S5's time are not logged: S5 is outside the cap.)
 * - S3's Haku turns: each `training_haku_answered` joined to its `training_haku_asked` by `queryId`; a question with no answer logged
 *   (interrupted mid-request) is not restored. The number of questions asked, so `queryId` continues ("trn.N").
 */

import type { LogRecord } from "../../telemetry/log.js";
import type {
  TrainingAnswerDetail, TrainingFeedbackLeftDetail, TrainingHakuAnsweredDetail, TrainingHakuAskedDetail, TrainingSectionLeftDetail,
} from "../../telemetry/record-kinds-training.js";
import type { AiChatTurn } from "../snapshot.js";
import type { TrainingAnswer } from "./host.js";

/** An item's first answer as logged: the answer itself, its distance from the key (a point), and whether its card timed out. */
export interface LoggedTrainingAnswer {
  readonly answer: TrainingAnswer | null;
  readonly errorM: number | null;
  readonly timedOut: boolean;
}

export interface KeptTraining {
  readonly answers: ReadonlyMap<string, LoggedTrainingAnswer>;
  readonly done: ReadonlySet<string>;
  readonly spentMs: number;
  /** A section card was left or an item answered: the participant was past the intro. */
  readonly pastIntro: boolean;
  /** `training_haku_asked` per item (an answer's `hakuBefore` counts the ones before it, a resume included). */
  readonly hakuAskedByItem: ReadonlyMap<string, number>;
  /** S3's Haku turns, in order (the pane shows them again). */
  readonly hakuTurns: readonly AiChatTurn[];
  /** The highest N of "trn.N" asked so far. */
  readonly hakuCount: number;
}

export const NOTHING_KEPT: KeptTraining = {
  answers: new Map(), done: new Set(), spentMs: 0, pastIntro: false, hakuAskedByItem: new Map(), hakuTurns: [], hakuCount: 0,
};

/** The answer a `training_answer` record stands for (null: a card that timed out with no choice). */
export function answerOfDetail(d: TrainingAnswerDetail): TrainingAnswer | null {
  const confidence = d.confidence !== undefined ? { confidence: d.confidence } : {};
  if (d.point) return { point: { lat: d.point.lat, lon: d.point.lon }, ...confidence };
  if (d.choiceId !== undefined) return { choiceId: d.choiceId, ...confidence };
  return null;
}

export function keptTrainingOf(records: readonly LogRecord[]): KeptTraining {
  const answers = new Map<string, LoggedTrainingAnswer>();
  const done = new Set<string>();
  const hakuAskedByItem = new Map<string, number>();
  const asked = new Map<string, TrainingHakuAskedDetail>();
  const hakuTurns: AiChatTurn[] = [];
  let spentMs = 0, pastIntro = false, hakuCount = 0;
  for (const r of records) {
    switch (r.kind) {
      case "training_section_left": {
        spentMs += (r.detail as TrainingSectionLeftDetail).dwellMs;
        pastIntro = true;
        break;
      }
      case "training_answer": {
        const d = r.detail as TrainingAnswerDetail;
        spentMs += d.rtMs + (d.memoryMs ?? 0);
        pastIntro = true;
        if (!answers.has(d.itemId)) answers.set(d.itemId, { answer: answerOfDetail(d), errorM: d.errorM ?? null, timedOut: d.timedOut === true });
        break;
      }
      case "training_feedback_left": {
        const d = r.detail as TrainingFeedbackLeftDetail;
        spentMs += d.dwellMs;
        done.add(d.itemId);
        break;
      }
      case "training_haku_asked": {
        const d = r.detail as TrainingHakuAskedDetail;
        asked.set(d.queryId, d);
        hakuAskedByItem.set(d.itemId, (hakuAskedByItem.get(d.itemId) ?? 0) + 1);
        const n = Number(/^trn\.(\d+)$/.exec(d.queryId)?.[1] ?? 0);
        hakuCount = Math.max(hakuCount, n);
        break;
      }
      case "training_haku_answered": {
        const d = r.detail as TrainingHakuAnsweredDetail;
        const q = asked.get(d.queryId);
        if (q) hakuTurns.push({ query: q.text, answer: { answerFi: d.answer.vastaus, basisFi: d.answer.perusteet, certaintyFi: d.answer.varmuus, wouldChangeIfFi: d.answer.muuttaisi } });
        break;
      }
      default: break;
    }
  }
  return { answers, done, spentMs, pastIntro, hakuAskedByItem, hakuTurns, hakuCount };
}

/** The training has ended in this log (S5 left): a resume does not show it again. */
export function trainingCompleted(records: readonly LogRecord[]): boolean {
  return records.some((r) => r.kind === "training_completed");
}
