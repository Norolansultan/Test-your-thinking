/**
 * The hinge's fatigue item (SPEC/15 revision (bf), 24 Oct 2026): the same 1–7 item as the questionnaires' `fatigue.start` and
 * `fatigue.end`, on the hinge screen (V7 → V8), shown once the manipulation check is answered, one click, optional. Each click is
 * logged at once (`hinge_fatigue_rated {itemId: "fatigue.hinge", value}`) and shown as chosen once durable; the last counts; leaving the
 * hinge never waits for it. Both groups alike.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HINGE_FATIGUE_ITEM_ID } from "../../app/session/hinge-check.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { readFileSync } from "node:fs";
import { atHinge as toHinge, HeldSink, ofKind, settle, type Running } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const atHinge = (cell: "radio" | "reasoning_intent", sink?: HeldSink): Promise<Running> => toHinge(cell, sink ? { sink } : {});

describe("the hinge's fatigue item (SPEC/15 (bf))", () => {
  it("is shown once the check is answered, logs every click at once, and the hinge is left without waiting for it", async () => {
    for (const cell of ["radio", "reasoning_intent"] as const) {
      const { o, snap } = await atHinge(cell);
      expect(snap().step).toBe("hinge_pause");
      expect(snap().hingeFatigue, cell).toBeNull(); // the directive is read first
      await expect(o.rateHingeFatigue(3)).rejects.toThrow(/rateHingeFatigue in step hinge_pause/);
      await o.showHingeCheck();
      expect(snap().hingeFatigue).toBeNull(); // not while the check is asked
      await o.answerHingeCheck("a");
      expect(snap().hingeFatigue).toEqual({ value: null });
      await o.rateHingeFatigue(5);
      expect(snap().hingeFatigue).toEqual({ value: 5 });
      await o.rateHingeFatigue(6); // again: the last counts
      expect(snap().hingeFatigue).toEqual({ value: 6 });
      await expect(o.rateHingeFatigue(8)).rejects.toThrow(RangeError);
      await expect(o.rateHingeFatigue(2.5)).rejects.toThrow(RangeError);
      await o.dismissHinge();
      expect(snap().hingeFatigue).toBeNull();
      await expect(o.rateHingeFatigue(4)).rejects.toThrow(/rateHingeFatigue in step/);
      const records = await o.logRecords();
      const rated = ofKind(records, "hinge_fatigue_rated");
      expect(rated.map((r) => r.detail)).toEqual([{ itemId: HINGE_FATIGUE_ITEM_ID, value: 5 }, { itemId: HINGE_FATIGUE_ITEM_ID, value: 6 }]);
      const kinds = records.map((r) => r.kind);
      expect(kinds.indexOf("hinge_check_answered")).toBeLessThan(records.indexOf(rated[0]!));
      expect(records.indexOf(rated[1]!)).toBeLessThan(kinds.indexOf("hinge_pause_end"));
    }
  }, 120_000);

  it("is optional: a hinge left without a rating writes no fatigue record", async () => {
    const { o } = await atHinge("radio");
    await o.showHingeCheck();
    await o.answerHingeCheck("a");
    await o.dismissHinge();
    expect(ofKind(await o.logRecords(), "hinge_fatigue_rated")).toHaveLength(0);
  }, 120_000);

  it("the rating shows as chosen only once its record is durable (I5)", async () => {
    const sink = new HeldSink();
    const { o, snap } = await atHinge("radio", sink);
    await o.showHingeCheck();
    await o.answerHingeCheck("a");
    sink.hold();
    const rating = o.rateHingeFatigue(2);
    await settle();
    expect(snap().hingeFatigue).toEqual({ value: null });
    sink.release();
    await rating;
    expect(snap().hingeFatigue).toEqual({ value: 2 });
  }, 120_000);

  it("asks the questionnaires' fatigue item, word for word, and says it is optional; the screen renders it above Continue", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(STUDY_TEXT[lang].questionnaire.items["fatigue.start"]).toEqual(STUDY_TEXT[lang].questionnaire.items["fatigue.end"]);
      expect(UI_TEXT[lang].hingeCheck.fatigueOptional).toBeTruthy();
    }
    const item = readFileSync(new URL("../../app/render/ui/components/HingeFatigueItem.tsx", import.meta.url), "utf8");
    expect(item).toMatch(/STUDY_TEXT\[lang\]\.questionnaire\.items\["fatigue\.start"\]/);
    expect(item).toMatch(/orchestrator\.rateHingeFatigue\(n\)/);
    const panel = readFileSync(new URL("../../app/render/ui/components/JudgementPanel.tsx", import.meta.url), "utf8");
    expect(panel.indexOf("<HingeFatigueItem")).toBeGreaterThan(panel.indexOf('data-testid="hinge-check"'));
    expect(panel.indexOf("<HingeFatigueItem")).toBeLessThan(panel.indexOf("orchestrator.dismissHinge()"));
  });
});
