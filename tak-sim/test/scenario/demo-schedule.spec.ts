/**
 * The demo scenario against SPEC/26 §4 (probes and responses) and §6 (pushed volume), at contract
 * level: what `buildDemoScenario()` hands the session.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario, secondSpamProbes } from "../../app/scenario/demo-scenario.js";
import { SPAM_SECOND_ITEMS, SPAM_SECOND_VIEWS } from "../../app/scenario/demo-probes.js";
import { FREEZE_AT_VIEW_END, MAIN_VIEWS, PRACTICE_VIEW_MIN_SECONDS, SECOND_SPAM_SUFFIX, secondSpamProbeId } from "../../app/scenario/views.js";

const scenario = buildDemoScenario();
const probesOf = (type: string) => scenario.probeSchedule.probes.filter((p) => p.type === type);
const viewsOf = (type: string) => [...new Set(probesOf(type).map((p) => p.cycle))].sort((a, b) => Number(a) - Number(b));

describe("SPEC/26 §6: pushed volume per main view", () => {
  it.each(MAIN_VIEWS.map((v) => v.index))("V%i pushes 6-20 items", (i) => {
    const n = scenario.cycles[i - 1]!.pushedAtomIds.length;
    expect(n).toBeGreaterThanOrEqual(6);
    expect(n).toBeLessThanOrEqual(20);
  });

  it("never demotes a load-bearing item, and keeps the contradiction's two reports pushed", () => {
    const pushed = new Set(scenario.cycles.flatMap((c) => c.pushedAtomIds));
    const demoted = scenario.atoms.filter((a) => /^atom\.demo\.\d/.test(a.id) && !pushed.has(a.id));
    for (const a of demoted) expect(a.loadBearing).toBe(false);
    expect(pushed.has(scenario.contradiction.premiseAtomId)).toBe(true);
    expect(pushed.has(scenario.contradiction.counterAtomId)).toBe(true);
  });

  it("a recorded story beat is T2, not delivered, and in no view's push list", () => {
    const pushed = new Set(scenario.cycles.flatMap((c) => c.pushedAtomIds));
    const recorded = scenario.atoms.filter((a) => a.id.startsWith("atom.demo.") && a.tier === "T2_system");
    // atom.demo.12.1: SPOT's second pass at 17.10 (phase-B rebuild round 2, 5 Oct 2026), the flare-up's size recorded only;
    // atom.demo.19.3: SPOT's second pass over the step-19 flare-up at 19.30 (fix pass 2, 7 Oct 2026), likewise.
    // Revision (bk), 25 Oct 2026 (SPEC/30 (bk)): atom.demo.7.1, P2's dispatch, held for seeking (V5 `reinforcements`'s key record).
    expect(recorded.map((a) => a.id).sort()).toEqual(["atom.demo.11.0", "atom.demo.12.1", "atom.demo.16.0", "atom.demo.17.0", "atom.demo.17.1", "atom.demo.19.3", "atom.demo.7.1"]);
    for (const a of recorded) {
      expect(a.provenance.deliveredAt).toBeNull();
      expect(pushed.has(a.id)).toBe(false);
    }
  });

  it("offsets are seconds into the view: a merged view's second-step items come at or after 1200 s", () => {
    for (const c of scenario.cycles) {
      const firstStep = c.startsAtVirtual / 1200 + 1;
      c.pushedAtomIds.forEach((id, k) => {
        const step = scenario.atoms.find((a) => a.id === id)!.cycle;
        const t = c.deliveryOffsetsSeconds[k]!;
        if (step === firstStep) expect(t).toBeLessThan(1200);
        else expect(t).toBeGreaterThanOrEqual(1200);
      });
    }
  });
});

describe("SPEC/26 §4: probes and responses", () => {
  it("no Type J in any view (revision (x), 6 Oct 2026: a view asks only for the sector plan)", () => {
    expect(viewsOf("J")).toEqual([]);
  });

  it("blanked freezes at V2, V4, V5, V7 | V10, V12, V14", () => {
    expect(scenario.freezes.map((f) => f.cycle)).toEqual([2, 4, 5, 7, 10, 12, 14]);
    expect(scenario.cycles.filter((c) => c.hasFreeze).map((c) => c.index)).toEqual([2, 4, 5, 7, 10, 12, 14]);
  });

  it("SPAM at V3, V6, V8, V11, all situation items (round 2: the intent check is on the hinge screen, brief D3)", () => {
    expect(viewsOf("S")).toEqual([3, 6, 8, 11]);
    expect(probesOf("S").every((p) => p.contentKind === "situation")).toBe(true);
    expect(scenario.hinge.manipulationCheck).toBeDefined();
    for (const p of probesOf("S")) {
      expect(p.mode).toBe("ONLINE");
      // SPEC/30 §5.2: a second item (`<first id>.b`) has no moment of its own; it follows the first under the same "ready".
      if (p.id.endsWith(SECOND_SPAM_SUFFIX)) expect(p.offsetInWorkingPeriodMs).toBeUndefined();
      else expect(p.offsetInWorkingPeriodMs).toBeGreaterThan(0);
      expect(p.saLevel).toBeDefined();
    }
  });

  it("SPEC/30 §5.2: second SPAM items only in SPAM_SECOND_VIEWS, each `<first id>.b` after its first, keyed by `<first invariant>.b`", () => {
    const seconds = probesOf("S").filter((p) => p.id.endsWith(SECOND_SPAM_SUFFIX));
    expect(seconds.map((p) => Number(p.cycle))).toEqual(SPAM_SECOND_VIEWS.filter((v) => v in SPAM_SECOND_ITEMS));
    for (const b of seconds) {
      const first = probesOf("S").find((p) => p.cycle === b.cycle && !p.id.endsWith(SECOND_SPAM_SUFFIX))!;
      expect(b.id).toBe(secondSpamProbeId(first.id));
      expect(b.invariantName).toBe(`${first.invariantName}.b`);
      expect(scenario.invariants.some((i) => i.name === b.invariantName)).toBe(true);
      expect(b.orderWithinCycle).toBeGreaterThan(first.orderWithinCycle);
    }
  });

  it("SPEC/30 §5.2: secondSpamProbes builds the second item from an injected fixture (the content arrives from the content package)", () => {
    const first = probesOf("S").find((p) => p.cycle === 3)!;
    const fixture = { 3: { prompt: "Mikä on testikysymys?", options: ["A1", "B1", "C1", "D1"] as const, correct: "c" as const, saLevel: 2 as const, contentKind: "situation" as const } };
    const built = secondSpamProbes(fixture, scenario.probeSchedule.probes.filter((p) => !p.id.endsWith(SECOND_SPAM_SUFFIX)));
    expect(built.probes).toHaveLength(1);
    expect(built.probes[0]).toMatchObject({
      id: "probe.s.cycle_3.b", type: "S", mode: "ONLINE", cycle: 3, orderWithinCycle: first.orderWithinCycle + 1, invariantName: "spam.cycle_3.b",
      prompt: "Mikä on testikysymys?", answerTimeoutMs: first.answerTimeoutMs, collectsConfidence: true, saLevel: 2,
      response: { kind: "categorical", options: [{ id: "a", fi: "A1" }, { id: "b", fi: "B1" }, { id: "c", fi: "C1" }, { id: "d", fi: "D1" }] },
    });
    expect(built.probes[0]!.offsetInWorkingPeriodMs).toBeUndefined();
    expect(built.invariants).toEqual([{ name: "spam.cycle_3.b", expected: "c", tolerance: 0 }]); // TRUTH: the key, never on the probe
  });

  it("no SA probe (freeze or SPAM) at V1, V9 (omission) or V13 (contradiction); never both in one view", () => {
    const sa = new Set<number>([...scenario.freezes.map((f) => f.cycle), ...viewsOf("S").map(Number)]);
    expect([...sa].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 14]);
    for (const f of scenario.freezes) expect(viewsOf("S")).not.toContain(f.cycle);
  });

  it("no Type E (withdrawn with H6, researcher decision 6 Oct 2026)", () => {
    expect(probesOf("E")).toEqual([]);
  });

  it("no Type F (withdrawn with Type J); Type U at V13 (closed area item, revision (ai)) and V14 (forced choice with confidence + coverage confidence)", () => {
    expect(viewsOf("F")).toEqual([]);
    const u = probesOf("U");
    expect(u.map((p) => [p.cycle, p.response.kind])).toEqual([[13, "area_check"], [14, "categorical"], [14, "confidence"]]);
  });

  it("the contradiction's detection probe is V13's closed area item and its backup V14's forced choice with confidence", () => {
    const byId = (id: string) => scenario.probeSchedule.probes.find((p) => p.id === id)!;
    expect(scenario.contradiction.cycle).toBe(13);
    expect(byId(scenario.contradiction.detectionProbeId)).toMatchObject({ type: "U", cycle: 13, response: { kind: "area_check" }, invariantName: "contradiction.area_hit" });
    expect(byId(scenario.contradiction.backupProbeId)).toMatchObject({ type: "U", cycle: 14, response: { kind: "categorical" }, collectsConfidence: true });
  });

  it("each view's probeIds are its scheduled probes, in presentation order", () => {
    for (const c of scenario.cycles) {
      const scheduled = scenario.probeSchedule.probes.filter((p) => p.cycle === c.index).sort((a, b) => a.orderWithinCycle - b.orderWithinCycle);
      expect(c.probeIds).toEqual(scheduled.map((p) => p.id));
    }
  });

  it("every main view has exactly one decision item (SPEC/15 §9's decision-free cycles are withdrawn)", () => {
    for (const v of MAIN_VIEWS) expect(scenario.decisionItems.filter((d) => d.cycle === v.index)).toHaveLength(1);
  });

  it("a main view lasts at least 120 s single-step and 130 s merged, the practice view 180 s — the real values, never a preview value", () => {
    for (const c of scenario.cycles) expect(c.minViewSeconds).toBe(c.steps === 2 ? 130 : 120);
    expect(scenario.practice.cycle.minViewSeconds).toBe(PRACTICE_VIEW_MIN_SECONDS); // 180 s since 11 Oct 2026
  });
});

describe("the freeze moments (researcher decision 1 Oct 2026)", () => {
  const views = [scenario.practice.cycle, ...scenario.cycles];

  it("are set exactly on the views with a freeze at a moment (FREEZE_VIEWS but V10, V12 and V14; VP has none since revision (bp)), whole seconds in [25, minimum − 20]", () => {
    // SPEC/30 §5.1, `31` §3.8: V10, V12 and V14's freeze comes at the view's end, after the plan is final — no moment on the clock.
    expect(views.filter((c) => c.freezeAtSeconds !== null).map((c) => c.index)).toEqual([2, 4, 5, 7]);
    for (const c of views) {
      expect(c.freezeAtSeconds !== null).toBe(c.hasFreeze && c.freezeAtViewEnd !== true);
      if (c.freezeAtSeconds === null) continue;
      expect(Number.isInteger(c.freezeAtSeconds)).toBe(true);
      expect(c.freezeAtSeconds).toBeGreaterThanOrEqual(25);
      expect(c.freezeAtSeconds).toBeLessThanOrEqual(c.minViewSeconds - 20);
    }
  });

  it("SPEC/30 §5.1, `31` §3.8 (coa F10): V10, V12 and V14 (FREEZE_AT_VIEW_END) freeze at the view's end — the property set on exactly those, with a freeze and no moment", () => {
    expect([...FREEZE_AT_VIEW_END].sort((a, b) => a - b)).toEqual([10, 12, 14]);
    expect(views.filter((c) => c.freezeAtViewEnd === true).map((c) => c.index)).toEqual([10, 12, 14]);
    for (const c of views.filter((x) => x.freezeAtViewEnd === true)) {
      expect(c.hasFreeze).toBe(true);
      expect(c.freezeAtSeconds).toBeNull();
      expect(scenario.freezes.some((f) => f.cycle === c.index)).toBe(true); // the same freeze, its items unchanged
    }
    // The other freeze views keep their pre-planned moments (each drawn on its own stream, so none moved).
    expect(scenario.cycles.filter((c) => c.hasFreeze && c.freezeAtViewEnd !== true).map((c) => c.index)).toEqual([2, 4, 5, 7]);
  });

  it("revision (bp), 26 Oct 2026: VP, the first look, has no freeze (its practice freeze, at 69 s after the tour, is retired); VP lasts 180 s (researcher, 11 Oct 2026)", () => {
    expect(scenario.practice.cycle.hasFreeze).toBe(false);
    expect(scenario.practice.cycle.freezeAtSeconds).toBeNull();
    expect(scenario.practice.cycle.minViewSeconds).toBe(180);
  });

  it("are pre-planned: identical on every build (the identical-stimulus rule), and not all the same moment", () => {
    const again = buildDemoScenario();
    const at = (s: typeof scenario) => [s.practice.cycle, ...s.cycles].map((c) => c.freezeAtSeconds);
    expect(at(again)).toEqual(at(scenario));
    expect(new Set(at(scenario).filter((t) => t !== null)).size).toBeGreaterThan(1);
  });
});

describe("SPEC/26 D3: the practice view", () => {
  const vp = scenario.practice;

  it("revision (bp): has no freeze (`practice.freeze` kept with no items, the shape the session reads), a decision item and candidate developments, all tagged practice; the first look's label", () => {
    expect(vp.cycle.hasFreeze).toBe(false);
    expect(vp.freeze).toEqual({ cycle: 0, items: [] });
    expect(vp.cycle.title).toBe("Ensikatsaus");
    expect(vp.decisionItem.id).toBe("decision.practice");
    expect(vp.branchStatements.filter((b) => b.truth.isActualDevelopment)).toHaveLength(1);
  });

  it("pushes its own starting picture (10–15 messages, all from W2), has no scheduled probe and no step boundary", () => {
    expect(vp.cycle.pushedAtomIds.length).toBeGreaterThanOrEqual(10);
    expect(vp.cycle.pushedAtomIds.length).toBeLessThanOrEqual(15);
    for (const id of vp.cycle.pushedAtomIds) expect(scenario.atoms.find((a) => a.id === id)!.cycle, id).toBe(-3);
    expect(vp.cycle.deliveryOffsetsSeconds.every((t, i, xs) => t >= 0 && t < 1200 && (i === 0 || t >= xs[i - 1]!))).toBe(true);
    expect(vp.cycle.probeIds).toEqual([]);
    expect(vp.cycle.stepBoundary).toBeNull();
    expect(scenario.probeSchedule.probes.some((p) => Number(p.cycle) === 0)).toBe(false);
  });
});

describe("SPEC/26 §2: a merged view's step boundary", () => {
  it("carries the second step's clock and positions, at the second step's start", () => {
    for (const c of scenario.cycles.filter((x) => x.steps === 2)) {
      expect(c.stepBoundary!.atVirtual).toBe(c.startsAtVirtual + 1200);
      expect(c.stepBoundary!.clockLabel).not.toBe(c.clockLabel);
    }
    for (const c of scenario.cycles.filter((x) => x.steps === 1)) expect(c.stepBoundary).toBeNull();
  });

  it("V4's freeze asks where EK12 is after its step-6 withdrawal to the safety zone on R1 in the black (review fixes (ah); was the R1/R2 junction), which the step boundary shows", () => {
    const v4 = scenario.cycles[3]!;
    expect(v4.stepBoundary!.unitPositions["EK12"]).not.toEqual(v4.unitPositions["EK12"]);
    const l1 = scenario.freezes.find((f) => f.cycle === 4)!.items.find((it) => it.id === "freeze.4.ek12_where")!;
    expect(l1.level).toBe("L1");
    expect(l1.options.find((o) => o.correct)!.id).toBe("black");
  });
});
