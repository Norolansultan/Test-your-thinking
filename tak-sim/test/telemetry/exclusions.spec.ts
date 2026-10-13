/**
 * The exclusion helpers (`exclusions.ts`) and the attention check (`attentionCheckPassed`) over
 * hand-built raw records (8 Oct 2026): every amount is a difference of two records' `tWallOffsetMs`.
 */

import { describe, expect, it } from "vitest";
import { ATTENTION_CHECK_CORRECT, ATTENTION_CHECK_ID, POST_ITEMS, questionnaireItems } from "../../app/session/questionnaire.js";
import { attentionCheckPassed } from "../../app/telemetry/derived-measures.js";
import {
  blurExcluded, cumulativeBlurMs, cumulativeIdleMs, idleExcluded, MAX_BLUR_SHARE_OF_SESSION, MAX_IDLE_SHARE_OF_VIEW_TIME,
  sessionWallMs, TOO_FAST_FREEZE_ANSWER_MS, tooFastFreezeAnswers, viewTimeMs,
} from "../../app/telemetry/exclusions.js";
import type { LogRecord } from "../../app/telemetry/log.js";

const mk = (rows: readonly [number, string, object?][]): LogRecord[] =>
  rows.map(([t, kind, detail], i) => ({ seq: i as never, tVirtual: 0 as never, tWallOffsetMs: t, kind, detail: detail ?? {} }));

describe("cumulativeBlurMs / cumulativeIdleMs", () => {
  it("sums closed periods; an open period runs to the last record; a repeated open does not restart it", () => {
    const records = mk([
      [0, "session_started"], [10_000, "window_blur"], [14_000, "window_focus"], [20_000, "window_blur"], [21_000, "window_blur"], [30_000, "view_ended", { viewSeconds: 0 }],
    ]);
    expect(cumulativeBlurMs(records)).toBe(4_000 + 10_000);
    expect(cumulativeIdleMs(records)).toBe(0);
  });

  it("idle counts idle_start to idle_end, including one ended by a wait", () => {
    const records = mk([
      [0, "cycle_start"], [5_000, "idle_start"], [9_000, "idle_end", { endedBy: "wait_started" }], [20_000, "idle_start"], [26_000, "idle_end"], [30_000, "view_ended", { viewSeconds: 30 }],
    ]);
    expect(cumulativeIdleMs(records)).toBe(4_000 + 6_000);
  });

  it("counts idle only between a view's cycle_start and its view_ended (fix pass 6): not before V1, between views, or in the questionnaire", () => {
    const records = mk([
      [0, "session_started"], [1_000, "idle_start"], [9_000, "idle_end"], // before V1: 8 s, not counted
      [10_000, "cycle_start"], [12_000, "idle_start"], [15_000, "idle_end"], [20_000, "view_ended", { viewSeconds: 10 }], // 3 s inside V1
      [21_000, "idle_start"], [24_000, "idle_end"], // between views: not counted
      [25_000, "cycle_start"], [28_000, "idle_start"], [34_000, "view_ended", { viewSeconds: 9 }], [40_000, "idle_end"], // straddles the end: 6 s inside
      [45_000, "idle_start"], [60_000, "idle_end"], [61_000, "questionnaire_submitted"], // the questionnaire: not counted
    ]);
    expect(cumulativeIdleMs(records)).toBe(3_000 + 6_000);
    expect(viewTimeMs(records)).toBe(19_000);
  });

  it("is zero for an empty log", () => {
    expect(cumulativeBlurMs([])).toBe(0);
    expect(sessionWallMs([])).toBe(0);
  });
});

describe("blurExcluded / idleExcluded (shares are pre-register defaults)", () => {
  it("blur above 10 % of the session excludes; exactly at the share does not", () => {
    const base = (blurMs: number) => mk([[0, "a"], [1_000, "window_blur"], [1_000 + blurMs, "window_focus"], [100_000, "z"]]);
    expect(MAX_BLUR_SHARE_OF_SESSION).toBe(0.1);
    expect(blurExcluded(base(10_000))).toBe(false);
    expect(blurExcluded(base(10_001))).toBe(true);
    expect(blurExcluded(base(5_000), 0.04)).toBe(true);
    expect(blurExcluded([])).toBe(false);
  });

  it("idle above 15 % of the view time excludes; no view time never excludes", () => {
    const base = (idleMs: number) => mk([[0, "cycle_start"], [1_000, "idle_start"], [1_000 + idleMs, "idle_end"], [500_000, "view_ended", { viewSeconds: 100 }]]);
    expect(MAX_IDLE_SHARE_OF_VIEW_TIME).toBe(0.15);
    expect(viewTimeMs(base(0))).toBe(100_000);
    expect(idleExcluded(base(15_000))).toBe(false);
    expect(idleExcluded(base(15_001))).toBe(true);
    expect(idleExcluded(mk([[0, "a"], [1_000, "idle_start"], [9_000, "idle_end"]]))).toBe(false);
  });
});

describe("tooFastFreezeAnswers", () => {
  const answer = (itemId: string, msSinceFreezeOpened?: number) => ({ itemId, optionId: "a", confidence: 50, ...(msSinceFreezeOpened === undefined ? {} : { msSinceFreezeOpened }) });
  it("flags items answered under the threshold since the previous item (the first since the freeze opened)", () => {
    expect(TOO_FAST_FREEZE_ANSWER_MS).toBe(1_500);
    const records = mk([[1, "freeze_submitted", { cycle: 3, responses: [answer("i1", 1_000), answer("i2", 9_000), answer("i3", 10_000), answer("i4", 12_000)] }]]);
    expect(tooFastFreezeAnswers(records)).toEqual([{ view: 3, itemId: "i1", itemMs: 1_000 }, { view: 3, itemId: "i3", itemMs: 1_000 }]);
    expect(tooFastFreezeAnswers(records, 500)).toEqual([]);
  });

  it("skips answers without a timestamp and keeps each freeze's own timeline", () => {
    const records = mk([
      [1, "freeze_submitted", { cycle: 3, responses: [answer("i1"), answer("i2", 20_000)] }],
      [2, "freeze_submitted", { cycle: 4, responses: [answer("j1", 800)] }],
    ]);
    expect(tooFastFreezeAnswers(records)).toEqual([{ view: 4, itemId: "j1", itemMs: 800 }]);
  });
});

describe("attentionCheckPassed", () => {
  const submitted = (answers: { itemId: string; value: string | number | null }[], id = "post") => mk([[1, "questionnaire_submitted", { questionnaireId: id, answers, dwellMs: 1 }]]);
  it("true on the instructed answer, false on any other or a blank, null without a post questionnaire", () => {
    expect(attentionCheckPassed(submitted([{ itemId: ATTENTION_CHECK_ID, value: ATTENTION_CHECK_CORRECT }]))).toBe(true);
    expect(attentionCheckPassed(submitted([{ itemId: ATTENTION_CHECK_ID, value: 5 }]))).toBe(false);
    expect(attentionCheckPassed(submitted([{ itemId: ATTENTION_CHECK_ID, value: null }]))).toBe(false);
    expect(attentionCheckPassed(submitted([{ itemId: ATTENTION_CHECK_ID, value: 2 }], "pre"))).toBeNull();
    expect(attentionCheckPassed([])).toBeNull();
  });

  it("the item is in the post questionnaire of every cell, a 1-7 scale containing the instructed answer", () => {
    const item = POST_ITEMS.find((i) => i.id === ATTENTION_CHECK_ID)!;
    expect(item).toMatchObject({ kind: "scale", min: 1, max: 7 });
    expect(item.cells).toBeUndefined();
    for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) expect(questionnaireItems("post", cell).map((i) => i.id)).toContain(ATTENTION_CHECK_ID);
    expect(ATTENTION_CHECK_CORRECT).toBe(2);
  });
});
