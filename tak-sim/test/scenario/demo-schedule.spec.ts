/**
 * The demo scenario against SPEC/26 §4 (probes and responses) and §6 (pushed volume), at contract
 * level: what `buildDemoScenario()` hands the session.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { MAIN_VIEWS, PRACTICE_VIEW_MIN_SECONDS } from "../../app/scenario/views.js";

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
    expect(recorded.map((a) => a.id).sort()).toEqual(["atom.demo.11.0", "atom.demo.12.1", "atom.demo.16.0", "atom.demo.17.0", "atom.demo.17.1", "atom.demo.19.3"]);
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
      expect(p.offsetInWorkingPeriodMs).toBeGreaterThan(0);
      expect(p.saLevel).toBeDefined();
    }
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

  it("are set exactly on the views with a freeze (the practice view and FREEZE_VIEWS), whole seconds in [25, minimum − 20]", () => {
    expect(views.filter((c) => c.freezeAtSeconds !== null).map((c) => c.index)).toEqual([0, 2, 4, 5, 7, 10, 12, 14]);
    for (const c of views) {
      expect(c.freezeAtSeconds !== null).toBe(c.hasFreeze);
      if (c.freezeAtSeconds === null) continue;
      expect(Number.isInteger(c.freezeAtSeconds)).toBe(true);
      expect(c.freezeAtSeconds).toBeGreaterThanOrEqual(25);
      expect(c.freezeAtSeconds).toBeLessThanOrEqual(c.minViewSeconds - 20);
    }
  });

  it("the practice freeze is fixed at 69 s after the tour, and VP lasts 180 s (researcher, 11 Oct 2026)", () => {
    expect(scenario.practice.cycle.freezeAtSeconds).toBe(69);
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

  it("has a 4-item practice freeze (the infrastructure item, a map point, an L2 and an L3 item; SPEC/08 amendment 2 Oct 2026), a decision item and candidate developments, all tagged practice", () => {
    expect(vp.cycle.hasFreeze).toBe(true);
    expect(vp.freeze.items).toHaveLength(4);
    for (const item of vp.freeze.items) expect(item.id).toMatch(/^freeze\.practice\./);
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
