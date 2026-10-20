/**
 * The two designed content events, as data and reachability (retrieval behaviour is T5's):
 * fault F7, the planted false record (SPEC/02 revision (o) §5, SPEC/18 §10), and the rekindle arc
 * (SPEC/26 §5, SPEC/18 revision (p)); plus the F7 freeze items (SPEC/08 revision (o), SPEC/26 §4).
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { COMMAND_POST_SOURCE, GRID_OPERATOR_SOURCE } from "../../app/scenario/designed-events.js";
import { F7_FALSE_OPTION_ID, F7_FREEZE_VIEWS } from "../../app/scenario/demo-probes.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { DESIGNED_EVENT_IDS, type InfoAtom } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import { navigate, navigationNow } from "../../app/retrieval/navigation.js";
import { isReachableByExecutingItsOwnRoute } from "../../app/routing/route-executor.js";
import { UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import { siteTrafficHelpers } from "../../tools/fire-ca/traffic.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";
import type { VirtualTime } from "../../app/engine/primitives.js";

const scenario = buildDemoScenario();
const atom = (id: string): InfoAtom => {
  const a = scenario.atoms.find((x) => x.id === id);
  if (!a) throw new Error(`no atom ${id}`);
  return a;
};
const textOf = (a: InfoAtom): string => {
  const r = a.record;
  return "text" in r ? r.text : "content" in r && typeof r.content === "string" ? r.content : r.kind === "radio_traffic" ? r.transcriptFi ?? "" : "";
};
const pushed = new Set(scenario.cycles.flatMap((c) => c.pushedAtomIds));
const stepStart = (step: number) => (step - 1) * 1200;

/** Reachable by executing its own directed and substitutive routes (SPEC/10 M5). */
function reachableByOwnRoutes(a: InfoAtom): boolean {
  return isReachableByExecutingItsOwnRoute(a, a.routes.directed!, scenario.atoms) && isReachableByExecutingItsOwnRoute(a, a.routes.substitutive!, scenario.atoms);
}

/** Through the query builder (Haku, SPEC/25): its category and source, at its own time and to the end of its step; never before it. */
function reachableThroughHaku(a: InfoAtom): boolean {
  const at = a.provenance.observedAt;
  const q = { category: a.navCategory, sourceId: a.provenance.sourceId };
  const has = (xs: readonly InfoAtom[]) => xs.some((x) => x.id === a.id);
  return (
    has(navigate({ ...q, window: "latest" }, scenario.atoms, at)) &&
    has(navigate({ ...q, sourceId: null, window: "last_cycle" }, scenario.atoms, at)) &&
    has(navigate({ ...q, window: "last_cycle" }, scenario.atoms, navigationNow(a.cycle))) &&
    has(navigate({ ...q, window: "whole_incident" }, scenario.atoms, navigationNow(20))) &&
    !has(navigate({ ...q, window: "whole_incident" }, scenario.atoms, (at - 1) as VirtualTime))
  );
}

describe("fault F7: the planted false record (SPEC/02 revision (o) §5)", () => {
  it("the grid operator's step-6 record: recorded, load-bearing, the line live and de-energising only requested", () => {
    const grid = atom(DESIGNED_EVENT_IDS.gridRecord);
    expect(grid.cycle).toBe(6);
    expect(grid.provenance.sourceId).toBe(GRID_OPERATOR_SOURCE);
    expect(grid.tier).toBe("T2_system");
    expect(grid.loadBearing).toBe(true);
    expect(grid.consequence).toBeDefined();
    expect(pushed.has(grid.id)).toBe(false);
    expect(textOf(grid)).toMatch(/jännitteinen/);
    expect(textOf(grid)).toMatch(/pyydetty/);
  });

  it("the grid record is reachable by its own routes and through Haku from its time", () => {
    const grid = atom(DESIGNED_EVENT_IDS.gridRecord);
    expect(reachableByOwnRoutes(grid)).toBe(true);
    expect(reachableThroughHaku(grid)).toBe(true);
  });

  it("the planted record: step 8 (V6) at 15:4x, by the command-post operator, recorded, false", () => {
    const planted = atom(DESIGNED_EVENT_IDS.planted);
    expect(planted.cycle).toBe(8);
    expect(viewOfStep(8)!.id).toBe("V6");
    expect(planted.provenance.sourceId).toBe(COMMAND_POST_SOURCE);
    expect(planted.record).toMatchObject({ kind: "situation_log", authorUnitId: COMMAND_POST_SOURCE, text: "20 kV linja jännitteetön, vahvistettu." }); // SPEC/33 (bc): was 110 kV
    expect(planted.provenance.observedAt).toBeGreaterThanOrEqual(stepStart(8));
    expect(planted.provenance.observedAt).toBeLessThan(stepStart(8) + 1200);
    expect(planted.tier).toBe("T2_system");
    expect(pushed.has(planted.id)).toBe(false);
    expect(planted.truth.isGroundTruth).toBe(false);
    expect(reachableThroughHaku(planted)).toBe(true);
  });

  it("the truth says live, for the whole incident", () => {
    expect(scenario.invariants).toContainEqual({ name: "f7.power_line_state", expected: "live", tolerance: 0 });
    expect(atom(DESIGNED_EVENT_IDS.planted).truth.relevantInvariants).toContain("f7.power_line_state");
  });

  it("no record anywhere confirms de-energisation except the planted one, and none corrects it", () => {
    const deEnergised = /jännitteet(ön|tömänä|tömäksi kytketty)|kytketty pois|poiskytketty|pois kytketty/i;
    const confirming = scenario.atoms.filter((a) => deEnergised.test(textOf(a))).map((a) => a.id);
    expect(confirming).toEqual([DESIGNED_EVENT_IDS.planted]);
    for (const r of SITE_SCENARIO.radio) expect(r.text).not.toMatch(deEnergised);
    for (const d of scenario.dutyOfficerMessages) expect(d.text).not.toMatch(deEnergised);
    // Nothing supersedes the planted entry (SPEC/04 degradation 10, a silent correction).
    for (const a of scenario.atoms) if (a.record.kind === "situation_log") expect(a.record.supersedesEntryId).not.toBe(`log.${DESIGNED_EVENT_IDS.planted}`);
  });

  it("later traffic still treats the line as a hazard, recorded", () => {
    const heli = atom(DESIGNED_EVENT_IDS.heliLineClearance);
    expect(heli.cycle).toBeGreaterThan(8);
    expect(heli.tier).toBe("T2_system");
    expect(textOf(heli)).toMatch(/20 kV/); // SPEC/33 (bc): was 110 kV
    expect(reachableThroughHaku(heli)).toBe(true);
  });
});

/** The anchor a unit holds at a step: its last move at or before it (SPEC/18 revision (l)). */
function anchorAt(unit: string, step: number): string | null {
  const moves = UNIT_PLAN[unit]!.moves.filter((m) => m.cycle <= step);
  return moves.length > 0 ? moves[moves.length - 1]!.to : null;
}
const { sectorOf } = siteTrafficHelpers();
const ign = wgs84ToTm35(SITE_SCENARIO.ignition);
function sectorAtStep(unit: string, step: number): string {
  const p = SITE_SCENARIO.steps.find((s) => s.index === step)!.units[unit]!;
  const q = wgs84ToTm35(p);
  return sectorOf({ x: q.eastM - ign.eastM, y: q.northM - ign.northM });
}

describe("the rekindle arc (SPEC/26 §5)", () => {
  // Phase-B rebuild round 2 (researcher decision 5 Oct 2026, SPEC/27 §7.3 c): the crews come back south
  // at step 14, not 13, so that in V10 no crew is on the new front; and, the directive being in force,
  // they come back to a line on the forest road south of it, not to its edge (SPEC/27 §7.3 e).
  it("KY21 and VPK are on L3 at step 9, on L1B at steps 10–13 and back south at step 14, on the forest road", () => {
    for (const unit of ["KY21", "VPK"]) {
      expect(anchorAt(unit, 9), unit).toBe("edge:L3");
      expect(sectorAtStep(unit, 9), unit).toBe("L3-Etelä");
      for (const step of [10, 11, 12, 13]) {
        expect(anchorAt(unit, step), `${unit} step ${step}`).toBe("edge:L1B");
        // Step 10 is a stale report (deployment.ts `stale`): the 16:20 map still shows them on the south edge, where they object from (A3, 6 Oct 2026).
        if (step === 10) expect(sectorAtStep(unit, step), `${unit} step ${step}`).toBe("L3-Etelä");
        else expect(sectorAtStep(unit, step), `${unit} step ${step}`).not.toBe("L3-Etelä");
      }
      expect(anchorAt(unit, 14), unit).toMatch(/^at:FR_/);
      // South of the rekindled front, on the forest road within 600 m of it, at step 14.
      const front = SITE_SCENARIO.steps.find((s) => s.index === 14)!.reportedDetached[0]![0]!;
      const at = SITE_SCENARIO.steps.find((s) => s.index === 14)!.units[unit]!;
      const d = Math.min(...front.map((p) => Math.hypot((at.lat - p.lat) * 111_320, (at.lon - p.lon) * 111_320 * Math.cos((p.lat * Math.PI) / 180))));
      expect(d, unit).toBeLessThan(600);
      expect(at.lat, unit).toBeLessThan(Math.min(...front.map((p) => p.lat)));
      expect(UNIT_PLAN[unit]!.moves.find((m) => m.cycle === 10)!.reason).toBe("reassign");
      expect(UNIT_PLAN[unit]!.moves.find((m) => m.cycle === 13)).toBeUndefined();
      expect(UNIT_PLAN[unit]!.moves.find((m) => m.cycle === 14)!.reason).toBe("return");
    }
  });

  it("no crew and no asset works the new front in V10 (step 13); EK11's move south is at step 14, to R2", () => {
    const step13 = SITE_SCENARIO.steps.find((s) => s.index === 13)!;
    for (const unit of Object.keys(step13.units)) expect(sectorAtStep(unit, 13), unit).not.toBe("L3-Etelä");
    expect(SITE_SCENARIO.radio.filter((r) => r.cycle === 13 && r.kind === "move")).toEqual([]);
    expect(UNIT_PLAN["EK11"]!.moves.find((m) => m.cycle === 13)).toBeUndefined();
    expect(UNIT_PLAN["EK11"]!.moves.find((m) => m.cycle === 14)!.to).toBe("at:R2_FR");
    expect(SITE_SCENARIO.traffic.filter((t) => t.cycle === 13 && t.actor === "VD1" && /pudotus/.test(t.content) && /eteläreuna/i.test(t.content))).toEqual([]);
  });

  it("no move reason states a main effort or a posture (SPEC/27 §7.3 c)", () => {
    for (const plan of Object.values(UNIT_PLAN)) for (const mv of plan.moves) expect(mv.whyFi ?? "").not.toMatch(/painopiste|suora hyökkäys|puolustuslinja|suojaus\b/i);
    for (const r of SITE_SCENARIO.radio) expect(r.text).not.toMatch(/painopiste/i);
  });

  it("the moves out (step 10) and back (step 14) are on the radio, pushed", () => {
    for (const unit of ["KY21", "VPK"]) {
      for (const step of [10, 14]) {
        const r = SITE_SCENARIO.radio.find((x) => x.cycle === step && x.from === unit && x.kind === "move");
        expect(r, `${unit} step ${step}`).toBeDefined();
        expect(r!.pushed).toBe(true);
      }
    }
  });

  it("no crew is on L3 at step 12, when the fire surfaces in BOG-S", () => {
    const step12 = SITE_SCENARIO.steps.find((s) => s.index === 12)!;
    for (const unit of Object.keys(step12.units)) expect(sectorAtStep(unit, 12), unit).not.toBe("L3-Etelä");
  });

  it("at step 10, crews report L3 in hand (recorded), so a broad bog question has many in-hand hits", () => {
    const inHand = scenario.atoms.filter((a) => a.cycle === 10 && /hallinnassa/.test(textOf(a)) && /(syttymäkohdan|L3|[Ll]ohko 3)/.test(textOf(a)));
    expect(inHand.length).toBeGreaterThanOrEqual(3);
    for (const id of DESIGNED_EVENT_IDS.inHand) {
      expect(atom(id).tier).toBe("T2_system");
      expect(atom(id).loadBearing).toBe(false);
    }
  });

  it("the objection and the overruling reply are at step 10 (V7), before the moves; the objection is load-bearing", () => {
    const objection = atom(DESIGNED_EVENT_IDS.objection);
    const overruled = atom(DESIGNED_EVENT_IDS.overruled);
    expect(viewOfStep(10)!.id).toBe("V7");
    for (const a of [objection, overruled]) {
      expect(a.cycle).toBe(10);
      expect(a.tier).toBe("T2_system");
      expect(pushed.has(a.id)).toBe(false);
    }
    expect(objection.provenance.sourceId).toBe("VPK");
    expect(textOf(objection)).toBe("Syttymäkohdan reunalla kannot ja hakkuutähteet voivat vielä kyteä pinnan alla. Jos tuuli kääntyy, se voi syttyä uudelleen. Pitäisi tarkistaa lämpökameralla ennen kuin lähdetään.");
    expect(objection.loadBearing).toBe(true);
    expect(objection.consequence!.manifestsAtCycle).toBe(12);
    expect(overruled.provenance.sourceId).toBe("KY21");
    expect(textOf(overruled)).toBe("Ei ole väkeä tarkistukseen. Lohko on hallinnassa, siirrytään L1:lle.");
    expect(overruled.loadBearing).toBe(false);
    expect(objection.provenance.observedAt).toBeLessThan(overruled.provenance.observedAt);
    const moveTimes = SITE_SCENARIO.radio.filter((r) => r.cycle === 10 && r.kind === "move" && (r.from === "KY21" || r.from === "VPK")).map((r) => stepStart(10) + r.atOffsetS);
    for (const t of moveTimes) expect(overruled.provenance.observedAt).toBeLessThan(t);
  });

  it("the objection is reachable by its own routes and through Haku from 16:2x", () => {
    const objection = atom(DESIGNED_EVENT_IDS.objection);
    expect(reachableByOwnRoutes(objection)).toBe(true);
    expect(reachableThroughHaku(objection)).toBe(true);
    // Still there in the next view (V8), under the whole incident.
    expect(navigate({ category: "palo", sourceId: "VPK", window: "whole_incident" }, scenario.atoms, navigationNow(11)).some((a) => a.id === objection.id)).toBe(true);
  });

  it("t4.private_doubt is the echo at step 11 (V8): VPK to its neighbour on L1B, load-bearing", () => {
    const doubt = atom("t4.private_doubt");
    expect(doubt.cycle).toBe(11);
    expect(viewOfStep(11)!.id).toBe("V8");
    expect(doubt.tier).toBe("T4_lateral");
    expect(doubt.loadBearing).toBe(true);
    expect(doubt.record.kind).toBe("lateral_traffic");
    if (doubt.record.kind !== "lateral_traffic") return;
    expect(doubt.record.speakerUnitId).toBe("VPK");
    expect(anchorAt(doubt.record.addresseeUnitId, 11)).toBe("edge:L1B");
    expect(doubt.record.content).toMatch(/syttymäkohdan eteläreunalta/);
  });
});

describe("F7 freeze items (SPEC/08 revision (o), SPEC/26 §4)", () => {
  const f7ItemOf = (view: number) => scenario.freezes.find((f) => f.cycle === view)!.items.filter((it) => /20 kV/.test(it.promptFi)); // SPEC/33 (bc): was 110 kV

  it("F7 is asked once (researcher decision 1 Oct 2026): V12 carries the one item, live correct, de-energised a distinct wrong option", () => {
    expect([...F7_FREEZE_VIEWS]).toEqual([12]);
    const items = f7ItemOf(12);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.id).toBe("freeze.12.f7");
    expect(item.level).toBe("L2");
    expect(item.options).toHaveLength(4);
    expect(item.options.filter((o) => o.correct).map((o) => o.id)).toEqual(["live"]);
    expect(item.options.find((o) => o.id === F7_FALSE_OPTION_ID)!.correct).toBe(false);
  });

  it("the prompt names no status", () => {
    expect(f7ItemOf(12)[0]!.promptFi).not.toMatch(/jännitteinen|jännitteetön|kytketty|pois/i);
  });

  it("no other freeze asks about the line, V7 included", () => {
    for (const f of scenario.freezes) if (f.cycle !== 12) expect(f7ItemOf(f.cycle), `V${f.cycle}`).toHaveLength(0);
    expect(f7ItemOf(7)).toHaveLength(0);
  });
});
