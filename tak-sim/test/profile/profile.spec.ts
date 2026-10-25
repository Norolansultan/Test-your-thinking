/**
 * The commander profile's fold (SPEC/35 §4, `app/telemetry/profile.ts`) on synthetic logs: the calibration bands (well, over,
 * under, and the 10-point edge), resolution, the checking share and its latency, tool counts in both groups, the plan reviews,
 * phase-A sessions and missing or malformed data.
 */

import { describe, expect, it } from "vitest";
import { buildFreezes } from "../../app/scenario/demo-probes.js";
import {
  commanderProfile, EXPERT_REFERENCE, MIN_CALIBRATION_ANSWERS, WELL_CALIBRATED_POINTS,
} from "../../app/telemetry/profile.js";
import { roadblockLatencies } from "../../app/telemetry/roadblock-measures.js";
import {
  freezeLog, freezeSubmitted, guideQuestion, hakuChat, LogBuilder, navQuery, plan, recordOpened, reviewClosed, reviewShown, revisePlan,
  sessionStarted, start, syntheticFreeze, viewEnded,
} from "./fixtures.js";

// V2, V4, V5, V7: 32 items, all answered in the logs below; 31 count (play-test R2, 25 Oct 2026: V4's `head_later` is exploratory,
// index 15 here, the last of V4's eight, `scoredFor: "exploratory"`, outside the calibration as F7 is).
const PHASE_A = buildFreezes().filter((f) => f.cycle <= 7);

describe("calibration (real freeze bank, phase A)", () => {
  it("the exploratory item is answered but not counted (play-test R2)", () => {
    const items = PHASE_A.flatMap((f) => f.items);
    expect(items).toHaveLength(32);
    expect(items.filter((it) => it.scoredFor).map((it) => [items.indexOf(it), it.id, it.scoredFor])).toEqual([[15, "freeze.4.head_later", "exploratory"]]);
    expect(commanderProfile(freezeLog(PHASE_A, () => true, () => 100)).calibration.answers).toBe(31);
  });

  it("well calibrated: ~75 % right; sure when right, unsure when wrong (good resolution)", () => {
    const records = freezeLog(PHASE_A, (i) => i % 4 !== 0, (_i, ok) => (ok ? 100 : 25));
    const c = commanderProfile(records).calibration;
    // 23 of the 31 counted answers right (the exploratory item, right at 100, is left out; it was 24 of 32, 75 %).
    expect(c).toMatchObject({ status: "ok", answers: 31, band: "well" });
    expect(c.percentCorrect).toBeCloseTo((100 * 23) / 31);
    expect(c.meanConfidence).toBeCloseTo((23 * 100 + 8 * 25) / 31);
    expect(c.gapPoints).toBeCloseTo((23 * 100 + 8 * 25) / 31 - (100 * 23) / 31);
    expect(c.resolution).toMatchObject({ status: "ok", band: "higher_when_right" });
    expect(c.resolution.diffPoints).toBeCloseTo(75);
  });

  it("overconfident: about half right, always 100", () => {
    const c = commanderProfile(freezeLog(PHASE_A, (i) => i % 2 === 0, () => 100)).calibration;
    // 16 of the 31 counted answers right (the exploratory item, index 15, was wrong).
    expect(c).toMatchObject({ status: "ok", meanConfidence: 100, band: "over" });
    expect(c.percentCorrect).toBeCloseTo((100 * 16) / 31);
    expect(c.gapPoints).toBeCloseTo(100 - (100 * 16) / 31);
    expect(c.resolution).toMatchObject({ status: "ok", diffPoints: 0, band: "about_same" });
  });

  it("underconfident: almost all right, mostly 25–50; more confident when wrong", () => {
    const c = commanderProfile(freezeLog(PHASE_A, (i) => i % 8 !== 0, (_i, ok) => (ok ? 25 : 50))).calibration;
    expect(c.band).toBe("under");
    expect(c.gapPoints!).toBeLessThan(-WELL_CALIBRATED_POINTS);
    expect(c.resolution).toMatchObject({ status: "ok", band: "higher_when_wrong", diffPoints: -25 });
  });

  it("all right: no resolution (no wrong answers), the band still given", () => {
    const c = commanderProfile(freezeLog(PHASE_A, () => true, () => 100)).calibration;
    expect(c).toMatchObject({ band: "well", gapPoints: 0, resolution: { status: "not_enough", band: null, diffPoints: null } });
  });

  it("the band edge: a gap of exactly 10 points is well calibrated, beyond it is not", () => {
    const f = [syntheticFreeze(2, 20)];
    const edge = commanderProfile(freezeLog(f, (i) => i < 13, () => 75), { freezes: f }).calibration; // 75 − 65
    expect(edge).toMatchObject({ gapPoints: 10, band: "well" });
    const beyond = commanderProfile(freezeLog(f, (i) => i < 12, () => 75), { freezes: f }).calibration; // 75 − 60
    expect(beyond).toMatchObject({ gapPoints: 15, band: "over" });
    const under = commanderProfile(freezeLog(f, (i) => i < 17, () => 70), { freezes: f }).calibration; // 70 − 85
    expect(under.band).toBe("under");
    expect(under.gapPoints).toBeCloseTo(-15);
    const f7 = [syntheticFreeze(2, 10)]; // 0.7 × 10 confidences sum with a float error; the edge holds
    expect(commanderProfile(freezeLog(f7, (i) => i < 6, () => 70), { freezes: f7 }).calibration.band).toBe("well");
  });

  it("fewer than the minimum answers: not enough answers, no numbers", () => {
    const f = [syntheticFreeze(2, MIN_CALIBRATION_ANSWERS - 1)];
    expect(commanderProfile(freezeLog(f, () => true, () => 100), { freezes: f }).calibration).toEqual({
      status: "not_enough", answers: MIN_CALIBRATION_ANSWERS - 1, meanConfidence: null, percentCorrect: null, gapPoints: null, band: null,
      resolution: { status: "not_enough", diffPoints: null, band: null },
    });
  });

  it("the practice freeze is not scored; the first answer to an item counts", () => {
    const practice = syntheticFreeze(0, 10), main = syntheticFreeze(2, 10);
    const b = new LogBuilder().add(sessionStarted("radio"))
      .add(start(0)).add(freezeSubmitted(0, practice.items.map((x) => ({ itemId: x.id, optionId: "b", confidence: 100 }))))
      .add(start(2)).add(freezeSubmitted(2, main.items.map((x) => ({ itemId: x.id, optionId: "a", confidence: 100 }))))
      .add(freezeSubmitted(2, main.items.map((x) => ({ itemId: x.id, optionId: "b", confidence: 25 }))));
    expect(commanderProfile(b.records, { freezes: [practice, main] }).calibration).toMatchObject({ answers: 10, percentCorrect: 100, band: "well" });
  });
});

describe("checking", () => {
  it("counts a decision checked when a look-up came before the first plan, or a cited record was opened at the review", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_once"));
    b.add(start(1)).add(hakuChat(1), 20_000).add(plan()).add(viewEnded(1)); // checked, 20 s
    b.add(start(2)).add(plan()).add(hakuChat(2)).add(viewEnded(2)); // looked only after the plan
    b.add(start(3)).add(navQuery(), 40_000).add(plan()).add(viewEnded(3)); // checked, 40 s
    b.add(start(9)).add(plan()).add(reviewShown(9, ["atom.d"])).add(recordOpened(9, "atom.d")).add(reviewClosed(9, "keep")).add(viewEnded(9)); // checked at the review
    b.add(start(10)); // no plan: not a decision
    const c = commanderProfile(b.records).checking;
    expect(c).toMatchObject({ status: "ok", decisions: 4, checked: 3, share: 0.75, band: "often", medianSecondsToFirstLookup: 30, decidingRecords: null });
  });

  it("bands: rarely below a third, sometimes in between", () => {
    const views = (checkedViews: number, total: number) => {
      const b = new LogBuilder().add(sessionStarted("radio"));
      for (let v = 1; v <= total; v++) {
        b.add(start(v));
        if (v <= checkedViews) b.add(hakuChat(v));
        b.add(plan());
      }
      return commanderProfile(b.records).checking;
    };
    expect(views(1, 4)).toMatchObject({ share: 0.25, band: "rarely" });
    expect(views(2, 4)).toMatchObject({ share: 0.5, band: "sometimes" });
    expect(views(0, 2)).toMatchObject({ status: "not_enough", decisions: 2, share: null, band: null });
    expect(views(0, 3)).toMatchObject({ status: "ok", share: 0, band: "rarely", medianSecondsToFirstLookup: null });
  });

  it("the analysis can pass roadblock rows: deciding records opened before the first act, with the median latency", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_once"));
    b.add(start(9)).add(plan()).add({ kind: "bubble_available", detail: { atomId: "atom.d1", cycle: 9 } as never })
      .add(reviewShown(9, ["atom.d1"]), 10_000).add(recordOpened(9, "atom.d1"), 4_000).add(reviewClosed(9, "keep")).add(viewEnded(9));
    b.add(start(10)).add(plan()).add({ kind: "bubble_available", detail: { atomId: "atom.d2", cycle: 10 } as never }).add(viewEnded(10));
    const rows = roadblockLatencies(b.records, {}, { decidingAtoms: new Map([[9, ["atom.d1"]], [10, ["atom.d2"]], [14, ["atom.d3"]]]) });
    const c = commanderProfile(b.records, { roadblock: rows }).checking;
    expect(c.decidingRecords).toEqual({ reached: 2, opened: 1, share: 0.5, medianLatencySeconds: 10 }); // the review's 4 s are clock-paused
  });
});

describe("tool use", () => {
  it("the Haku group: Haku searches (chat, builder) in the main views; no Thinker", () => {
    const b = new LogBuilder().add(sessionStarted("radio")).add(start(0)).add(hakuChat(0)) // practice: not counted
      .add(start(1)).add(hakuChat(1)).add(hakuChat(1)).add(navQuery()).add(plan())
      .add(start(2)).add(hakuChat(2)).add(plan());
    expect(commanderProfile(b.records).toolUse).toEqual({ status: "ok", hakuSearches: 4, guideQuestions: null, reviews: null });
  });

  it("the guide group: Haku and Thinker questions apart (an untagged chat question is the Thinker's)", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_intent"))
      .add(start(1)).add(hakuChat(1)).add(guideQuestion(1)).add(guideQuestion(1, undefined)).add(plan())
      .add(start(2)).add(guideQuestion(2)).add(hakuChat(2)).add(plan());
    expect(commanderProfile(b.records).toolUse).toMatchObject({ hakuSearches: 2, guideQuestions: 3 });
  });

  it("a guide group with no Thinker question shows zero, not nothing; without a header the group is read from the questions", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_once")).add(start(1)).add(plan());
    expect(commanderProfile(b.records).toolUse.guideQuestions).toBe(0);
    const noHeader = new LogBuilder().add(start(1)).add(guideQuestion(1)).add(plan());
    expect(commanderProfile(noHeader.records).toolUse.guideQuestions).toBe(1);
  });

  it("the plan reviews: how many ended with the plan changed", () => {
    const b = new LogBuilder().add(sessionStarted("radio"));
    b.add(start(8)).add(plan()).add(reviewShown(8)).add(reviewClosed(8, "revise")).add(revisePlan(8)).add(viewEnded(8));
    b.add(start(9)).add(plan()).add(reviewShown(9)).add(reviewClosed(9, "keep")).add(viewEnded(9));
    b.add(start(10)).add(plan()).add(reviewShown(10)).add(reviewClosed(10, "revise")).add(viewEnded(10)); // revise opened, nothing recorded
    expect(commanderProfile(b.records).toolUse.reviews).toEqual({ shown: 3, changed: 1 });
  });
});

describe("phase-A sessions and missing data", () => {
  it("a phase-A session: calibration and checking from V1–V7, no reviews, phase B not reached", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_once"));
    let offset = 0;
    for (let v = 1; v <= 7; v++) {
      b.add(start(v)).add(hakuChat(v)).add(plan());
      const f = PHASE_A.find((x) => x.cycle === v);
      if (f) {
        b.add(freezeSubmitted(v, f.items.map((item, k) => {
          const ok = (offset + k) % 3 !== 0;
          return item.kind === "map_point"
            ? { itemId: item.id, optionId: "map_point", confidence: 75, point: ok ? item.mapKey!.point : { lat: 0, lon: 0 } }
            : { itemId: item.id, optionId: item.options.find((o) => o.correct === ok)!.id, confidence: 75 };
        })));
        offset += f.items.length;
      }
    }
    const p = commanderProfile(b.records);
    expect(p.phaseBReached).toBe(false);
    expect(p.calibration).toMatchObject({ status: "ok", answers: 31, band: "well" }); // 32 answered, V4's exploratory head_later not counted (R2)
    expect(p.checking).toMatchObject({ status: "ok", decisions: 7, checked: 7, band: "often" });
    expect(p.toolUse).toMatchObject({ hakuSearches: 7, guideQuestions: 0, reviews: null });
  });

  it("an empty log: not enough data everywhere, zero tool use, the expert slots empty", () => {
    const p = commanderProfile([]);
    expect(p.calibration.status).toBe("not_enough");
    expect(p.checking).toMatchObject({ status: "not_enough", decisions: 0 });
    expect(p.toolUse).toEqual({ status: "ok", hakuSearches: 0, guideQuestions: null, reviews: null });
    expect(p.expert).toBe(EXPERT_REFERENCE);
    expect(Object.values(EXPERT_REFERENCE).every((v) => v === null)).toBe(true);
  });

  it("malformed input never throws: non-records are dropped, an unreadable freeze makes calibration unavailable", () => {
    const f = [syntheticFreeze(2, 10)];
    const records: unknown[] = [null, 3, "x", { kind: "cycle_start" }, ...freezeLog(f, () => true, () => 100)];
    expect(commanderProfile(records, { freezes: f }).calibration.status).toBe("ok");
    const bad = new LogBuilder().add(start(2)).add(freezeSubmitted(2, f[0]!.items.map((x) => ({ itemId: x.id, optionId: "zz", confidence: 50 }))));
    const p = commanderProfile(bad.records, { freezes: f });
    expect(p.calibration).toMatchObject({ status: "unavailable", band: null, gapPoints: null });
    expect(p.toolUse.status).toBe("ok");
  });

  it("is deterministic: the same records give the same profile", () => {
    const records = freezeLog(PHASE_A, (i) => i % 3 !== 0, (i) => [25, 50, 75, 100][i % 4]!);
    expect(JSON.stringify(commanderProfile(records))).toBe(JSON.stringify(commanderProfile([...records])));
  });
});
