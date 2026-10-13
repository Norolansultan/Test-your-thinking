/**
 * SPEC/26 §3 — the session's views: one practice view (VP, step W2) and fourteen main views over
 * steps 1–20, merged but never skipped. Checks the view table itself (`app/scenario/views.ts`) and
 * the frozen bundle built from it (`site-scenario.json`).
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CANONICAL_FLAG_SEQUENCE } from "../../app/scenario/types.js";
import {
  DECISION_OPENS_AFTER_S, FREEZE_EARLIEST_S, FREEZE_LATEST_BEFORE_END_S, freezeOffsetSecondsFor, HINGE_AFTER_VIEW, MAIN_VIEWS, MERGED_VIEW_MIN_SECONDS,
  SESSION_VIEWS, stepId, stepNumber, stepStartVirtual, VIEW_MIN_SECONDS, viewEndVirtual, viewMinSecondsFor, viewOfStep, viewStartVirtual,
} from "../../app/scenario/views.js";
import { pushedCountByView } from "../../tools/fire-ca/view-traffic.js";

const H = "holds", Q = "breach_quantitative", C = "breach_categorical";

describe("the view table (SPEC/26 §3)", () => {
  it("has the practice view VP at step W2, then V1–V14", () => {
    expect(SESSION_VIEWS.map((v) => v.id)).toEqual(["VP", ...Array.from({ length: 14 }, (_, i) => `V${i + 1}`)]);
    const vp = SESSION_VIEWS[0]!;
    expect(vp.practice).toBe(true);
    expect(vp.steps.map(stepId)).toEqual(["W2"]);
    expect(vp.flag).toBeNull();
    expect(viewStartVirtual(vp)).toBe(-4800); // 12:00
  });

  it("covers steps 1–20 exactly once, in order, one or two steps per view", () => {
    expect(MAIN_VIEWS.flatMap((v) => v.steps)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const v of MAIN_VIEWS) {
      expect([1, 2]).toContain(v.steps.length);
      if (v.steps.length === 2) expect(v.steps[1]).toBe(v.steps[0]! + 1);
    }
    for (let i = 1; i < MAIN_VIEWS.length; i++) expect(viewStartVirtual(MAIN_VIEWS[i]!)).toBe(viewEndVirtual(MAIN_VIEWS[i - 1]!));
    expect(viewStartVirtual(MAIN_VIEWS[0]!)).toBe(0);
    expect(viewEndVirtual(MAIN_VIEWS[13]!)).toBe(20 * 1200);
  });

  it("merges exactly SPEC/26 §3's pairs", () => {
    expect(MAIN_VIEWS.filter((v) => v.steps.length === 2).map((v) => `${v.id}=${v.steps.join("+")}`))
      .toEqual(["V2=2+3", "V4=5+6", "V6=8+9", "V11=14+15", "V12=16+17", "V14=19+20"]);
  });

  it("never merges V7, V8 (the hinge neighbours), V9 (the omission) or V13 (the contradiction)", () => {
    for (const id of ["V7", "V8", "V9", "V13"]) expect(MAIN_VIEWS.find((v) => v.id === id)!.steps).toHaveLength(1);
    expect(viewOfStep(12)!.id).toBe("V9");
    expect(viewOfStep(18)!.id).toBe("V13");
  });

  it("puts the hinge between V7 and V8, at 16:40 (the end of step 10)", () => {
    expect(HINGE_AFTER_VIEW).toBe(7);
    const v7 = MAIN_VIEWS[6]!;
    expect(v7.steps).toEqual([10]);
    expect(viewEndVirtual(v7)).toBe(stepStartVirtual(11));
    expect(MAIN_VIEWS.map((v) => v.phase)).toEqual([...Array(7).fill("A"), ...Array(7).fill("B")]);
  });

  it("carries SPEC/26 §3's flags: phase A H Q H C H C H, phase B H C H C Q H Q", () => {
    expect(MAIN_VIEWS.map((v) => v.flag)).toEqual([H, Q, H, C, H, C, H, H, C, H, C, Q, H, Q]);
    expect(CANONICAL_FLAG_SEQUENCE).toEqual([H, Q, H, C, H, C, H, H, C, H, C, Q, H, Q]);
  });

  it("maps the other prologue steps (W1, W3–W5) to no view (history), W2 to VP, and round-trips step ids", () => {
    for (const s of [-4, -2, -1, 0]) expect(viewOfStep(s)).toBeNull();
    expect(viewOfStep(-3)!.id).toBe("VP");
    for (const s of [-4, 0, 1, 20]) expect(stepNumber(stepId(s))).toBe(s);
  });
});

describe("the frozen bundle's views", () => {
  it("derives every main view's flag from its own envelope and matches SPEC/26 §3", () => {
    const main = SITE_SCENARIO.views.filter((v) => !v.practice);
    expect(main.map((v) => v.derivedFlag)).toEqual([...CANONICAL_FLAG_SEQUENCE]);
    expect(main.map((v) => v.steps)).toEqual(MAIN_VIEWS.map((v) => v.steps));
  });

  it("pushes 6–20 items per main view (traffic T1 plus radio) after thinning the merged views (SPEC/26 §6)", () => {
    const counts = pushedCountByView(SITE_SCENARIO.traffic, SITE_SCENARIO.radio);
    for (const v of MAIN_VIEWS) {
      const n = counts.get(v.index) ?? 0;
      expect(n, v.id).toBeGreaterThanOrEqual(6);
      expect(n, v.id).toBeLessThanOrEqual(20);
    }
  });
});

describe("the view timing (researcher decision 1 Oct 2026)", () => {
  it("opens the decision panel at 20 s; a view lasts at least 120 s, a merged one 150 s", () => {
    expect(DECISION_OPENS_AFTER_S).toBe(20);
    expect(viewMinSecondsFor(1)).toBe(VIEW_MIN_SECONDS);
    expect(viewMinSecondsFor(2)).toBe(MERGED_VIEW_MIN_SECONDS);
    expect([VIEW_MIN_SECONDS, MERGED_VIEW_MIN_SECONDS]).toEqual([120, 130]);
  });

  it("draws a freeze moment per view: a whole second in [25, minimum − 20], a pure function of seed and view", () => {
    for (const min of [120, 150]) {
      const seen = new Set<number>();
      for (let view = 0; view < 300; view++) {
        const t = freezeOffsetSecondsFor(20260917n, view, min);
        expect(Number.isInteger(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(FREEZE_EARLIEST_S);
        expect(t).toBeLessThanOrEqual(min - FREEZE_LATEST_BEFORE_END_S);
        expect(freezeOffsetSecondsFor(20260917n, view, min)).toBe(t);
        seen.add(t);
      }
      expect(seen.has(FREEZE_EARLIEST_S)).toBe(true); // both ends of the window are reachable
      expect(seen.has(min - FREEZE_LATEST_BEFORE_END_S)).toBe(true);
    }
  });
});
