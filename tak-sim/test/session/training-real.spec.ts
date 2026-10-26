/**
 * The training incident with the built content (`TRAINING`, work package A's `spec-data.ts`; SPEC/08 (bp)): the same session checks
 * as `training-session.spec.ts`, generically over the real items. Skipped while the content is the placeholder (no items).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { trainingLockBox, insideBox } from "../../app/session/training/area.js";
import { trainingTools } from "../../app/session/training/controller.js";
import type { TrainingAnswerDetail, TrainingCompletedDetail } from "../../app/telemetry/record-kinds-training.js";
import { driveTo, newTrainingSession, ofKind, passTraining } from "./training-run.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

describe.skipIf(TRAINING.items.length === 0)("the built training incident in the session (SPEC/08 (bp), SPEC/15 (bp))", () => {
  it("has the shape the session runs: 13 items in S1–S4, the cap, the card window, S5's dwell, keys inside the lock", () => {
    expect(TRAINING.items).toHaveLength(13);
    expect(TRAINING.items.map((it) => it.position)).toEqual(TRAINING.items.map((_, i) => i + 1));
    expect(TRAINING).toMatchObject({ capMs: 720_000, cardWindowMs: 60_000, demoMinDwellMs: 10_000 });
    const box = trainingLockBox(TRAINING);
    for (const it of TRAINING.items) {
      if ("point" in it.key) expect(insideBox(it.key.point, box)).toBe(true);
      if ("optionId" in it.key) expect(it.options.map((o) => o.id)).toContain((it.key as { optionId: string }).optionId);
      expect(TRAINING.scenes[it.scene]).toBeDefined();
    }
    expect(TRAINING.items.filter((it) => it.covariate !== null).map((it) => it.covariate).sort()).toEqual(["point_memory", "point_visible", "seek_first"]);
    // The tools each section opens (`08` (bp) §bp.1's table): Haku only in S3, nothing on S4's freeze screen.
    for (const it of TRAINING.items) {
      const tools = trainingTools(it, "question");
      expect(tools.haku).toBe(it.section === "s3");
      if (it.section === "s4") expect(tools).toEqual({ map: false, rb: false, log: false, haku: false });
    }
  });

  for (const cell of ["radio", "reasoning_intent"] as const) {
    it(`${cell}: 33 records with no Haku question; every item answered once, its feedback after it; S5 the cell's`, async () => {
      const { o, snap } = newTrainingSession({ cell });
      await o.start();
      await driveTo(o, snap);
      await passTraining(o, snap, TRAINING);
      expect(snap().step).toBe("briefing");
      const records = await o.logRecords();
      const training = records.filter((r) => r.kind.startsWith("training_"));
      expect(training).toHaveLength(33);
      expect(ofKind<TrainingAnswerDetail>(records, "training_answer").map((d) => d.itemId)).toEqual(TRAINING.items.map((it) => it.id));
      expect(ofKind<{ demoId: string }>(records, "training_demo_shown")[0]!.demoId).toBe(cell === "radio" ? "haku" : "guide");
      expect(ofKind<TrainingCompletedDetail>(records, "training_completed")[0]).toMatchObject({ endReason: "completed", answeredCount: 13, missingItemIds: [] });
      for (const d of ofKind<TrainingAnswerDetail>(records, "training_answer")) if (d.point) expect(d.errorM).toBe(0);
    });
  }
});
