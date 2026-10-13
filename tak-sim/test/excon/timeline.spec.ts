/**
 * EXCON (SPEC/28 §8) — pure logic: the view/step timeline, playback, deterministic interpolation
 * ("continuous realistic change" anchored at every step start), and the per-view truth (flags, breach,
 * designed events, traffic) beside the participant's picture.
 */

import { describe, expect, it } from "vitest";
import { buildTimeline, clockOf, locate, timelineLengthS, viewSpans, viewStartPosition } from "../../app/excon/timeline.js";
import { advance, INITIAL_PLAYBACK, MAX_FRAME_GAP_MS, pause, play, seek, setSpeed } from "../../app/excon/playback.js";
import { distanceM, morphAt, prepareMorph, resampleRing } from "../../app/excon/geometry.js";
import { truthAt } from "../../app/excon/motion.js";
import { buildExconWorld, participantPicture, siteStepOf } from "../../app/excon/world.js";
import { assertNoTruthKeysPresent } from "../../app/boundary/render-boundary.js";
import { ringHa } from "../../app/render/projection-growth.js";
import { CANONICAL_FLAG_SEQUENCE, DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { MAIN_VIEW_COUNT, SESSION_VIEWS, STEP_SECONDS } from "../../app/scenario/views.js";

const world = buildExconWorld();
const TL = world.timeline;
const LENGTH = timelineLengthS(TL);

describe("EXCON timeline — views and steps", () => {
  it("lays out VP (W2) and V1–V14 as 21 steps, merged views as two", () => {
    expect(TL).toHaveLength(21);
    expect(TL[0]).toMatchObject({ frame: 0, step: -3, stepId: "W2", viewId: "VP", stepShown: 1, stepsInView: 1, prevFrame: null, nextFrame: null });
    expect(TL.slice(1).map((t) => t.step)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const v of SESSION_VIEWS) {
      const frames = TL.filter((t) => t.viewIndex === v.index);
      expect(frames.map((t) => t.step)).toEqual(v.steps);
      expect(frames.map((t) => t.stepShown)).toEqual(v.steps.length === 2 ? [1, 2] : [1]);
    }
    expect(viewSpans(TL).map((s) => s.steps)).toEqual(SESSION_VIEWS.map((v) => v.steps.length));
    expect(LENGTH).toBe(21 * STEP_SECONDS);
  });

  it("links consecutive world steps only (nothing interpolates across the VP gap or past the end)", () => {
    expect(TL[1]!.prevFrame).toBeNull(); // step 1 follows W2 after an hour's gap
    expect(TL[20]!.nextFrame).toBeNull();
    for (let i = 1; i < 20; i++) { expect(TL[i]!.nextFrame).toBe(i + 1); expect(TL[i + 1]!.prevFrame).toBe(i); }
  });

  it("locates a playback position: step, fraction, virtual time and offset into the view; clamped to the timeline", () => {
    expect(locate(TL, -50)).toMatchObject({ positionS: 0, frame: 0, fraction: 0, virtualS: -4800 });
    const v2b = locate(TL, viewStartPosition(TL, 2) + STEP_SECONDS + 300); // V2's second step (step 3), 5 min in
    expect(v2b.step).toMatchObject({ viewId: "V2", step: 3, stepShown: 2 });
    expect(v2b.fraction).toBeCloseTo(0.25, 10);
    expect(v2b.virtualS).toBe(2 * STEP_SECONDS + 300);
    expect(v2b.viewOffsetS).toBe(STEP_SECONDS + 300);
    const end = locate(TL, LENGTH + 999);
    expect(end).toMatchObject({ positionS: LENGTH, frame: 20, fraction: 1 });
    expect(viewStartPosition(TL, 8)).toBe(TL.find((t) => t.viewId === "V8")!.frame * STEP_SECONDS);
  });

  it("formats the incident clock from virtual seconds without Date or Intl", () => {
    expect(clockOf(0)).toBe("13:20:00");
    expect(clockOf(-4800)).toBe("12:00:00");
    expect(clockOf(10 * STEP_SECONDS)).toBe("16:40:00");
    expect(clockOf(19 * STEP_SECONDS + 1199)).toBe("19:59:59");
  });
});

describe("EXCON playback — driven by frame timestamps passed in", () => {
  it("advances by real milliseconds × speed, only while playing", () => {
    let p = play(setSpeed(INITIAL_PLAYBACK, 60), LENGTH);
    p = advance(p, 1000, LENGTH); // first frame only records its timestamp
    expect(p.positionS).toBe(0);
    p = advance(p, 1200, LENGTH);
    expect(p.positionS).toBeCloseTo(12, 10); // 0.2 s × 60
    p = advance(setSpeed(p, 10), 1300, LENGTH);
    expect(p.positionS).toBeCloseTo(13, 10); // + 0.1 s × 10
    const paused = advance(pause(p), 5000, LENGTH);
    expect(paused.positionS).toBe(p.positionS);
  });

  it("caps a long gap between frames and stops at the end; play at the end restarts", () => {
    let p = advance(play(INITIAL_PLAYBACK, LENGTH), 0, LENGTH);
    p = advance(p, 60_000, LENGTH); // a background tab: one frame a minute later
    expect(p.positionS).toBeCloseTo((MAX_FRAME_GAP_MS / 1000) * p.speed, 10);
    p = advance(seek({ ...p, playing: true }, LENGTH - 1, LENGTH), 0, LENGTH);
    p = advance(p, 200, LENGTH);
    expect(p).toMatchObject({ positionS: LENGTH, playing: false });
    expect(play(p, LENGTH).positionS).toBe(0);
  });

  it("is a pure function: the same frame sequence gives the same positions", () => {
    const frames = [0, 16.7, 33.4, 50.1, 300, 316.7];
    const run = () => frames.reduce((acc, ts) => advance(acc, ts, LENGTH), play(INITIAL_PLAYBACK, LENGTH)).positionS;
    expect(run()).toBe(run());
  });
});

describe("EXCON interpolation — deterministic and continuous", () => {
  const positions = Array.from({ length: 60 }, (_, i) => (i * 431) % LENGTH);

  it("gives the identical truth picture for a position however it was reached (fresh world, shuffled order)", () => {
    const a = positions.map((p) => JSON.stringify(truthAt(world, locate(TL, p))));
    const other = buildExconWorld();
    const shuffled = [...positions].reverse().map((p) => [p, JSON.stringify(truthAt(other, locate(other.timeline, p)))] as const);
    const byPos = new Map(shuffled);
    positions.forEach((p, i) => expect(byPos.get(p)).toBe(a[i]));
  });

  it("puts every unit and aircraft exactly at its reported position at each step start", () => {
    for (const t of TL) {
      const f = truthAt(world, locate(TL, t.frame * STEP_SECONDS));
      const s = siteStepOf(world.site, t.step);
      for (const u of f.units.filter((x) => x.state === "on_scene")) expect(distanceM(u.at, s.units[u.id]!)).toBeLessThan(0.01);
      for (const a of f.aircraft.filter((x) => x.state === "on_scene")) expect(distanceM(a.at, s.aircraft.find((x) => x.platformId === a.id)!.position)).toBeLessThan(0.01);
    }
  });

  it("is continuous across step boundaries (no jumps for platforms present on both sides)", () => {
    for (const t of TL.filter((x) => x.nextFrame !== null)) {
      const before = truthAt(world, locate(TL, (t.frame + 1) * STEP_SECONDS - 0.001));
      const after = truthAt(world, locate(TL, (t.frame + 1) * STEP_SECONDS));
      for (const u of after.units) {
        const b = before.units.find((x) => x.id === u.id);
        if (b) expect(distanceM(b.at, u.at), `${u.id} at step ${t.step}→${t.step + 1}`).toBeLessThan(2);
      }
      for (const a of after.aircraft) {
        const b = before.aircraft.find((x) => x.id === a.id);
        if (b) expect(distanceM(b.at, a.at), `${a.id} at step ${t.step}→${t.step + 1}`).toBeLessThan(5);
      }
    }
  });

  it("morphs the CA fire from the step's start truth to its end truth", () => {
    for (const t of TL) {
      const s = siteStepOf(world.site, t.step);
      const end = truthAt(world, locate(TL, t.frame * STEP_SECONDS + STEP_SECONDS - 1e-6)).fire[0]![0]!;
      expect(Math.abs(ringHa(end) - ringHa(s.truthAtEnd[0]!)) / ringHa(s.truthAtEnd[0]!), `step ${t.step}`).toBeLessThan(0.05);
    }
    const m = prepareMorph(resampleRing(world.site.steps[1]!.reported[0]!, 40), world.site.steps[1]!.truthAtEnd[0]!);
    expect(morphAt(m, 0).slice(0, -1)).toEqual(m.from);
    expect(morphAt(m, 1).slice(0, -1)).toEqual(m.to);
    expect(prepareMorph(world.site.steps[3]!.truthAtEnd[0]!, world.site.steps[4]!.truthAtEnd[0]!)).toEqual(prepareMorph(world.site.steps[3]!.truthAtEnd[0]!, world.site.steps[4]!.truthAtEnd[0]!));
  });
});

describe("EXCON truth per view", () => {
  it("carries the scored flag of every view (SPEC/26 §3) and marks only V9 as the omission, only V13 as the contradiction", () => {
    expect(world.views.map((v) => v.id)).toEqual(SESSION_VIEWS.map((v) => v.id));
    expect(world.views.slice(1).map((v) => v.flag)).toEqual([...CANONICAL_FLAG_SEQUENCE].slice(0, MAIN_VIEW_COUNT));
    expect(world.views[0]).toMatchObject({ id: "VP", practice: true, expectedFlag: null });
    expect(world.views.filter((v) => v.isOmissionCycle).map((v) => v.id)).toEqual(["V9"]);
    expect(world.views.filter((v) => v.isContradictionView).map((v) => v.id)).toEqual(["V13"]);
  });

  it("highlights breach geometry exactly where the truth escapes the envelope (V11's breach is non-spatial)", () => {
    for (const v of world.views) {
      if (v.flag === "holds") expect(v.breach, v.id).toEqual([]);
      else if (v.id === "V11") expect(v.flagReason).toMatch(/non-spatial/);
      else { expect(v.breach.length, v.id).toBeGreaterThan(0); expect(v.breachDepthM, v.id).toBeGreaterThan(v.envelope.containmentToleranceMetres); }
    }
  });

  it("places the designed events in their views: F7, the rekindle arc, the directive, the omission, the contradiction", () => {
    const viewOf = (key: string) => world.events.find((e) => e.key === key)?.viewIndex;
    expect(viewOf(DESIGNED_EVENT_IDS.gridRecord)).toBe(4);
    expect(viewOf(DESIGNED_EVENT_IDS.planted)).toBe(6);
    expect(viewOf(DESIGNED_EVENT_IDS.objection)).toBe(7);
    expect(viewOf(DESIGNED_EVENT_IDS.overruled)).toBe(7);
    expect(viewOf("t4.private_doubt")).toBe(8);
    expect(viewOf("duty.directive")).toBe(8);
    expect(viewOf("hinge")).toBe(7);
    expect(world.views[9]!.events.map((e) => e.kind)).toContain("omission");
    expect(world.views[13]!.events.filter((e) => e.kind === "contradiction")).toHaveLength(3);
    expect(world.events.find((e) => e.key === DESIGNED_EVENT_IDS.planted)!.truth).toMatch(/FALSE.*LIVE/);
  });

  it("counts the participant-visible traffic per view and per step", () => {
    for (const v of world.views) {
      expect(v.traffic.pushedTotal).toBe(v.spec.pushedAtomIds.length);
      expect(v.traffic.pushedPerStep.reduce((a, b) => a + b, 0)).toBe(v.traffic.pushedTotal);
      expect(v.traffic.pushedPerStep).toHaveLength(v.steps.length);
    }
    expect(world.views[8]!.traffic.dutyMessages.some((m) => m.guidance)).toBe(true);
  });

  it("derives the participant's picture through the render boundary: no truth reachable in any view or step", () => {
    for (const t of TL) {
      const tree = participantPicture(world.scenario, t.viewIndex, t.stepShown);
      expect(() => assertNoTruthKeysPresent(tree)).not.toThrow();
      expect(tree.cycleInfo).toMatchObject({ index: t.viewIndex, stepShown: t.stepShown });
      expect(tree.envelope?.cycle).toBe(t.viewIndex);
      const json = JSON.stringify(tree);
      for (const key of ["flag", "breachGeometry", "isOmissionCycle", "actualPerimeterAtEnd", "actualDetachedAtEnd", "accuracy_label", "consistentWithEnvelope", "whatWasHappening"]) {
        expect(json.includes(`"${key}"`), `${key} in ${t.viewId} step ${t.stepShown}`).toBe(false);
      }
    }
  });
});
