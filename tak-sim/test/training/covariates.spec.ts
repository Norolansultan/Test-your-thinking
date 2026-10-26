/**
 * The training's pre-registered covariates (SPEC/09 (bp) §bp.1) on synthetic `training_*` records: `point_visible` and `point_memory`
 * from the FIRST answer's `errorM`; `seek_first` from `training.s3.records1` — searched before (a `training_haku_asked` for the item
 * before its answer; `hakuBefore` decides) and the latency (the first question's `atItemMs`, else censored at `rtMs`). Missing items
 * give null; records of other kinds and other items are ignored.
 */

import { describe, expect, it } from "vitest";
import { trainingCovariates } from "../../app/telemetry/training-measures.js";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { TrainingAnswerDetail, TrainingHakuAskedDetail } from "../../app/telemetry/record-kinds-training.js";

function log(...rows: readonly { kind: string; detail: unknown }[]): LogRecord[] {
  return rows.map((r, i) => ({ seq: asSeq(i), tVirtual: asVirtualTime(-10_920), tWallOffsetMs: i * 1000, kind: r.kind, detail: r.detail }));
}
const answer = (itemId: string, extra: Partial<TrainingAnswerDetail> = {}) => ({ kind: "training_answer", detail: { itemId, sectionId: itemId.split(".")[1]!, position: 1, rtMs: 20_000, measures: [], ...extra } satisfies TrainingAnswerDetail });
const asked = (itemId: string, atItemMs: number, n = 1) => ({ kind: "training_haku_asked", detail: { queryId: `trn.${n}`, itemId, text: "Mitä DR8 ilmoitti?", charCount: 18, atItemMs } satisfies TrainingHakuAskedDetail });

describe("trainingCovariates (SPEC/09 (bp) §bp.1)", () => {
  it("an empty log gives nulls", () => {
    expect(trainingCovariates([])).toEqual({ point_visible: null, point_memory: null, seek_first: { searchedBefore: null, seekLatencyMs: null, seekCensored: null } });
  });

  it("the point errors come from the first answer of each point item", () => {
    const c = trainingCovariates(log(
      { kind: "training_started", detail: {} },
      answer("training.s1.place", { point: { lat: 60.92, lon: 27.5 }, errorM: 37 }),
      { kind: "training_feedback_left", detail: { itemId: "training.s1.place", position: 1, dwellMs: 4000 } },
      answer("training.s1.place", { point: { lat: 60.93, lon: 27.5 }, errorM: 999 }),
      answer("training.s2.project", { point: { lat: 60.92, lon: 27.5 }, errorM: 5 }),
      answer("training.s4.memory", { point: { lat: 60.92, lon: 27.5 }, errorM: 212, memoryMs: 8000, confidence: 75 }),
    ));
    expect(c.point_visible).toBe(37);
    expect(c.point_memory).toBe(212);
  });

  it("seek_first: a question before the answer gives searchedBefore and the first question's time", () => {
    const c = trainingCovariates(log(
      asked("training.s3.older", 1000, 1),
      asked("training.s3.records1", 12_500, 2),
      asked("training.s3.records1", 30_000, 3),
      answer("training.s3.records1", { choiceId: "ha11", confidence: 75, hakuBefore: 2, timedOut: false, rtMs: 41_000 }),
      asked("training.s3.records1", 50_000, 4),
    ));
    expect(c.seek_first).toEqual({ searchedBefore: true, seekLatencyMs: 12_500, seekCensored: false });
  });

  it("seek_first: no question before the answer is censored at the answer's rtMs; a question after it does not count", () => {
    const c = trainingCovariates(log(
      answer("training.s3.records1", { choiceId: "ha04", confidence: 50, hakuBefore: 0, timedOut: false, rtMs: 18_000 }),
      asked("training.s3.records1", 25_000),
    ));
    expect(c.seek_first).toEqual({ searchedBefore: false, seekLatencyMs: 18_000, seekCensored: true });
  });

  it("seek_first: a timed-out card reads its hakuBefore", () => {
    const c = trainingCovariates(log(
      asked("training.s3.records1", 40_000),
      answer("training.s3.records1", { hakuBefore: 1, timedOut: true, rtMs: 60_000 }),
    ));
    expect(c.seek_first).toEqual({ searchedBefore: true, seekLatencyMs: 40_000, seekCensored: false });
    const none = trainingCovariates(log(answer("training.s3.records1", { hakuBefore: 0, timedOut: true, rtMs: 60_000 })));
    expect(none.seek_first).toEqual({ searchedBefore: false, seekLatencyMs: 60_000, seekCensored: true });
  });

  it("ignores session records: ai_chat_* questions are never training questions", () => {
    const c = trainingCovariates(log(
      { kind: "ai_chat_query_submitted", detail: { itemId: "training.s3.records1", text: "x" } },
      answer("training.s3.records1", { choiceId: "ha11", rtMs: 9000 }),
    ));
    expect(c.seek_first).toEqual({ searchedBefore: false, seekLatencyMs: 9000, seekCensored: true });
  });
});
