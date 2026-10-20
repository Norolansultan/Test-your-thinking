/**
 * D8 in the wildfire-skills export (`tools/skills/laces.ts`): each ground placement's escape route, safety zone, lookout
 * and comms come from what that crew itself says in the records, quoted with the record id, held for its current posting
 * only (same task, within SAME_STRETCH_M of where the posting began, every step present) and null where nothing is
 * stated. Aircraft keep their exemption unchanged.
 */

import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildScenarioPackage } from "../../tools/skills/package.js";
import { recordsOfStep } from "../../tools/skills/fire-observations.js";
import { COMMS_VIRVE, lacesOf, postingStart, SAME_STRETCH_M, statedIn } from "../../tools/skills/laces.js";
import { dist, toEN } from "../../tools/skills/geo.js";

const pkg = buildScenarioPackage("test-version");
type Rec = Record<string, unknown>;
const cycles = (JSON.parse(pkg.files.get("ground_truth/cycles.json")!) as { cycles: Rec[] }).cycles;
const placement = (cycle: number, unit: string): Rec => {
  const p = (cycles.find((c) => c.cycle === cycle)!.placements as Rec[]).find((x) => x.unit_id === unit);
  expect(p, `${unit} in cycle ${cycle}`).toBeDefined();
  return p!;
};
const groundPlacements = cycles.flatMap((c) => (c.placements as Rec[]).filter((p) => p.laces_exempt !== true).map((p) => ({ c, p })));
const records = SITE_SCENARIO.steps.flatMap((s) => recordsOfStep(s.index, pkg.scenario.atoms));
const recordById = new Map(records.map((r) => [r.id, r]));

describe("D8: what counts as a stated escape route, safety zone and lookout", () => {
  it("quotes the clause that states it, the sentence where the clause only points back ('sinne') or is the 'Jos …' form", () => {
    expect(statedIn("EK11 (kysyttäessä): Vettä säiliössä noin 59 %. Perääntymistie: oma auto.", "escape_route")).toBe("Perääntymistie: oma auto");
    const backRef = "EK11, Kuivakangas: olemme kärjen vasemmalla sivustalla. Turva-alue palaneella alalla 50 m takanamme, sinne perääntymistie. Tähystäjä nimetty, kaikki kuulolla.";
    expect(statedIn(backRef, "escape_route")).toBe("Turva-alue palaneella alalla 50 m takanamme, sinne perääntymistie");
    expect(statedIn(backRef, "safety_zone")).toBe("Turva-alue palaneella alalla 50 m takanamme");
    expect(statedIn(backRef, "lookout")).toBe("Tähystäjä nimetty");
    expect(statedIn("EK14, EK11: kärki noin 50 m päässä. Jos joudumme lähtemään, reitti: oma auto.", "escape_route")).toBe("Jos joudumme lähtemään, reitti: oma auto");
    expect(statedIn("Perääntymistie: autolla tietä R2 pitkin etelään Lahdenkylän pelloille (turva-alue), auto käännettynä.", "safety_zone"))
      .toBe("Perääntymistie: autolla tietä R2 pitkin etelään Lahdenkylän pelloille (turva-alue)");
    expect(statedIn("EK12, KY21: tie autollemme on savun peitossa. Käytämme palanutta alaa turva-alueena, tehkää samoin.", "safety_zone")).toBe("Käytämme palanutta alaa turva-alueena");
    expect(statedIn("EK11: palo ylitti ojan vierestämme. Miehet siirtyivät palaneelle alueelle turvaan, perääntymistie palaneen kautta autolle.", "safety_zone"))
      .toBe("Miehet siirtyivät palaneelle alueelle turvaan");
    expect(statedIn("Pakotie itään tietä pitkin.", "escape_route")).toBe("Pakotie itään tietä pitkin");
    // Parentheses stay with their clause.
    expect(statedIn("EK12 vetäytyy tielle R1 palaneelle alueelle (turva-alue) (läheltä piti; vahvuus tarkistettu, kaikki tallessa).", "safety_zone"))
      .toBe("EK12 vetäytyy tielle R1 palaneelle alueelle (turva-alue) (läheltä piti; vahvuus tarkistettu, kaikki tallessa)");
  });

  it("does not take an instruction to others, an intention without a route, a withdrawal or an assembly point for a route", () => {
    expect(statedIn("Savu kääntyi pohjoiseen parissa minuutissa. Varmistakaa perääntymistie.", "escape_route")).toBeNull();
    expect(statedIn("Suora hyökkäys ei onnistu, varmistamme perääntymistien.", "escape_route")).toBeNull();
    expect(statedIn("EK11 vetäytyy tielle R1 palaneelle alueelle (turva-alue).", "escape_route")).toBeNull();
    expect(statedIn("EK11, EK12: tähystäjällä näkyvyys kärkeen, 200 m. Kokoontuminen: oma auto, kuulolla koko ajan.", "escape_route")).toBeNull();
    expect(statedIn("Kokoontuminen: oma auto.", "safety_zone")).toBeNull();
  });
});

describe("D8: the crews' LCES lines reach the placements", () => {
  const R2_CREWS: Readonly<Record<number, Readonly<Record<string, string>>>> = {
    // SPEC/33 stage 7–9 and gate R (20 Oct 2026, the road-graph shuttle re-seeded the step draws): the generated ids of the regenerated traffic (the same crews' own statements).
    19: { EK11: "evt.c19.007", EK12: "evt.c19.012", EK16: "evt.c19.031", KY21: "evt.c19.034", OUT1: "evt.c19.042", OUT2: "evt.c19.045", VPK: "evt.c19.048" },
    20: { EK11: "evt.c20.008", EK12: "evt.c20.011", EK16: "evt.c20.032", KY21: "evt.c20.035", OUT1: "evt.c20.041", OUT2: "evt.c20.043", VPK: "evt.c20.045" },
  };

  it("gives the R2 crews at 19.20–20.00 their stated escape route and named safety zone, with the record ids", () => {
    for (const cycle of [19, 20]) {
      for (const [unit, id] of Object.entries(R2_CREWS[cycle]!)) {
        const p = placement(cycle, unit);
        expect([p.escape_route_source, p.safety_zone_source], `${unit} c${cycle}`).toEqual([id, id]);
        expect(String(p.escape_route), `${unit} c${cycle}`).toMatch(/perääntymistie/i);
        expect(String(p.safety_zone), `${unit} c${cycle}`).toMatch(/Lahdenkylän pelloille|puutavaran varastoalue/);
        expect(recordById.get(id)!.source).toBe(unit);
        expect(recordById.get(id)!.step).toBe(cycle);
      }
    }
    expect(placement(19, "EK11").safety_zone).toBe("Turva-alue: R2:n risteyksen puutavaran varastoalue vieressämme");
  });

  it("carries KY21's 18:26 line and EK16's 19:04 line (why it holds) to their placements", () => {
    for (const cycle of [16, 17]) {
      const p = placement(cycle, "KY21");
      expect([p.escape_route_source, p.safety_zone_source, p.lookout_source]).toEqual(["atom.radio.16.3", "atom.radio.16.3", "atom.radio.16.3"]);
      expect(p.escape_route).toBe("Perääntymistie jalkaisin uraa pitkin pohjoiseen palaneelle alueelle (turva-alue)");
    }
    const ek16 = placement(18, "EK16");
    expect(ek16.escape_route_source).toBe("atom.radio.18.5");
    expect(ek16.escape_route).toBe("perääntymistie itään R2:n risteyksen varastoalueelle on auki ja vie poispäin palosta");
    expect(ek16.safety_zone_source).toBe("atom.radio.17.1");
  });

  it("takes the crew's most recent statement by time, across the traffic and the incident radio", () => {
    // EK11 at 13.20–13.40: 13:23:20 "palaneelle alalle", 13:24:00 radio "palaneelle alueelle", 13:25:42 "oma auto".
    expect(recordById.get("atom.radio.1.0")!.t).toBeLessThan(recordById.get("evt.c01.020")!.t);
    expect(placement(1, "EK11").escape_route_source).toBe("evt.c01.020");
    expect(placement(1, "EK11").escape_route).toBe("Perääntymistie: oma auto");
  });

  it("quotes only the crew's own records, logged in the placement's step or before", () => {
    for (const { c, p } of groundPlacements) {
      for (const k of ["escape_route", "safety_zone", "lookout", "comms"]) {
        const id = p[`${k}_source`] as string | null;
        expect(id === null, `${p.unit_id} c${c.cycle} ${k}`).toBe(p[k] === null);
        if (id === null) continue;
        const r = recordById.get(id)!;
        expect(r, id).toBeDefined();
        expect(r.source, id).toBe(p.unit_id);
        expect(r.step, id).toBeLessThanOrEqual(c.step as number);
        if (k !== "comms") expect(r.step, `${id}: before the posting`).toBeGreaterThanOrEqual(postingStart(p.unit_id as string, c.step as number)!);
        if (k !== "comms") expect(statedIn(r.text_fi, k as "escape_route" | "safety_zone" | "lookout"), id).toBe(p[k]);
      }
    }
  });
});

describe("D8: an item holds for the crew's posting only, and stays null where nothing is stated", () => {
  it("does not carry a stated route over a move: KY21 after its 900 m move at 16.00, EK16 after its withdrawal at 19.20", () => {
    expect(placement(8, "KY21").escape_route_source).toBe("evt.c08.029"); // SPEC/33 stage 7–9: restated at 15.5x (was the 15.1x line, evt.c06.033); gate R: .029
    const ky21 = placement(9, "KY21");
    expect(ky21.posting_from_cycle).toBe(9);
    expect([ky21.escape_route, ky21.safety_zone, ky21.lookout]).toEqual([null, null, null]);
    expect(placement(18, "EK16").escape_route_source).toBe("atom.radio.18.5");
    const ek16 = placement(19, "EK16");
    expect(ek16.posting_from_cycle).toBe(19);
    expect(recordById.get(ek16.escape_route_source as string)!.step).toBe(19); // restated after the move, not carried
  });

  // SPEC/33 stage 7–9 (20 Oct 2026): on the regenerated traffic EK14's task changes in place at 18.40 (mop-up → pump attack on the
  // north edge) and it states no route in that step, so the example moves one step earlier (was its 18.40 route not carried into 19.00).
  it("treats a task changed in place as a new task: EK14's 18.20 route does not carry into its pump attack at 18.40", () => {
    expect(placement(17, "EK14").escape_route_source).toBe("evt.c17.024");
    expect(placement(18, "EK14").task).not.toBe(placement(17, "EK14").task);
    expect(placement(18, "EK14").escape_route).toBeNull();
  });

  it("keeps null for a crew that never states one: the water shuttle EK13", () => {
    const ek13 = groundPlacements.filter(({ p }) => p.unit_id === "EK13").map(({ p }) => p);
    expect(ek13.length).toBeGreaterThan(10);
    for (const p of ek13) expect([p.escape_route, p.safety_zone]).toEqual([null, null]);
  });

  it("defines a posting by the placement data: consecutive steps, same task, within SAME_STRETCH_M of its first position", () => {
    const steps = SITE_SCENARIO.steps;
    for (const u of SITE_SCENARIO.units) {
      for (const s of steps) {
        const start = postingStart(u.id, s.index);
        if (!s.units[u.id]) { expect(start).toBeNull(); continue; }
        const first = steps.find((x) => x.index === start)!;
        expect(dist(toEN(s.units[u.id]!), toEN(first.units[u.id]!))).toBeLessThanOrEqual(SAME_STRETCH_M);
        for (const x of steps.filter((y) => y.index >= start! && y.index <= s.index)) {
          expect(x.units[u.id], `${u.id} ${x.index}`).toBeDefined();
          expect(x.unitWork[u.id]?.task, `${u.id} ${x.index}`).toBe(s.unitWork[u.id]?.task);
        }
        const prev = steps.find((x) => x.index === s.index - 1);
        if (start === s.index && prev?.units[u.id] && prev.unitWork[u.id]?.task === s.unitWork[u.id]?.task) {
          const prevFirst = steps.find((x) => x.index === postingStart(u.id, prev.index))!;
          expect(dist(toEN(s.units[u.id]!), toEN(prevFirst.units[u.id]!)), `${u.id} ${s.index}`).toBeGreaterThan(SAME_STRETCH_M);
        }
      }
    }
  });

  it("agrees with the scenario's own move log: every logged move starts a posting (a step late where the map shows the unit stale)", () => {
    const placed = (id: string, n: number) => SITE_SCENARIO.steps.find((s) => s.index === n)?.units[id];
    let checked = 0;
    for (const r of SITE_SCENARIO.radio.filter((x) => x.kind === "move" && x.cycle > 1 && placed(x.from, x.cycle))) {
      const now = placed(r.from, r.cycle)!, before = placed(r.from, r.cycle - 1);
      const stale = before !== undefined && dist(toEN(now), toEN(before)) === 0 && postingStart(r.from, r.cycle) !== r.cycle;
      expect(postingStart(r.from, stale ? r.cycle + 1 : r.cycle), `${r.from} step ${r.cycle}: ${r.text}`).toBe(stale ? r.cycle + 1 : r.cycle);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe("D8: comms, and the aircraft's exemption", () => {
  it("gives VIRVE comms from the unit's latest radio record (never the AVL log), and nothing to a unit that has not spoken", () => {
    for (const { c, p } of groundPlacements) {
      if (p.comms === null) continue;
      expect(p.comms).toBe(COMMS_VIRVE);
      const r = recordById.get(p.comms_source as string)!;
      expect(r.channel, `${p.unit_id} c${c.cycle}`).not.toBe("system_log");
      const later = records.filter((x) => x.source === p.unit_id && x.step <= (c.step as number) && x.channel !== "system_log" && x.t > r.t);
      expect(later.map((x) => x.id), `${p.unit_id} c${c.cycle}`).toEqual([]);
    }
    expect(lacesOf("NO_SUCH_UNIT", 5, pkg.scenario.atoms)).toMatchObject({ comms: null, comms_source: null, escape_route: null, safety_zone: null, lookout: null });
  });

  it("leaves the aircraft placements as they were: exempt, 'n/a (airborne)', no LACES sources", () => {
    const air = cycles.flatMap((c) => (c.placements as Rec[]).filter((p) => p.laces_exempt === true));
    expect(air.length).toBeGreaterThan(0);
    for (const p of air) {
      expect([p.escape_route, p.safety_zone, p.comms]).toEqual(["n/a (airborne)", "n/a (airborne)", "n/a (airborne)"]);
      expect(Object.keys(p)).toEqual([ // key order as before D8
        "unit_id", "segment_id", "front", "task", "attack", "xy", "vehicle_xy", "hose_length_needed_m", "access_distance_m", "distance_ahead_of_head_m",
        "water_pct", "laces_exempt", "escape_route", "safety_zone", "comms", "downwind", "co_ppm", "zone", "zone_basis", "water_confirmed",
      ]);
    }
  });

  it("documents the fields and the rule in DATA_SOURCES.md, with the counts from the file, deterministically", () => {
    const md = pkg.files.get("DATA_SOURCES.md")!;
    expect(md).toContain("**LACES of ground crews**");
    expect(md).toContain("`posting_from_cycle`");
    expect(md).not.toContain("every ground placement fails LACES until those are authored");
    const nullEscape = groundPlacements.filter(({ p }) => p.escape_route === null).length;
    expect(md).toContain(`${groundPlacements.length} ground placements; null \`escape_route\` ${nullEscape}`);
    expect(buildScenarioPackage("test-version").files.get("ground_truth/cycles.json")).toBe(pkg.files.get("ground_truth/cycles.json"));
  });
});
