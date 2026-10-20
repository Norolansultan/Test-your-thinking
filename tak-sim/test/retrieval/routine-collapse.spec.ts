/**
 * The routine-line collapse (SPEC/14 revision (q), 1 Oct 2026): families are found by structure,
 * the newest gated member is kept, the time gate is respected, Haku is untouched, the result is
 * deterministic — and no retrieval code names a designed event.
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { retrieveClosed } from "../../app/retrieval/closure.js";
import { hybridRetrieve, THINKER_RETRIEVAL_CONFIG } from "../../app/retrieval/hybrid.js";
import { collapseRoutine, labelledHeader, routineFamilies, routineFamilyKey } from "../../app/retrieval/routine-collapse.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { COMMAND_POST_SOURCE, GRID_OPERATOR_SOURCE } from "../../app/scenario/designed-events.js";
import { trafficAtom } from "../../app/scenario/traffic-atoms.js";
import { DESIGNED_EVENT_IDS, type InfoAtom, type InteractionEvent } from "../../app/scenario/types.js";

const RULE = { minDistinctSteps: 3 };

function event(id: string, cycle: number, actor: string, content: string, tier: InteractionEvent["tier"] = "T2_system", channel: InteractionEvent["channel"] = "system_log"): InteractionEvent {
  return {
    id, cycle, session_view: cycle, sim_time_s: cycle * 600 + 30, timestamp: "13:20:00", actor, actor_type: "fire_team", addressee: null,
    location: null, place: null, lat: null, lon: null, event_type: "status", task: null, content, tier, channel, nav: "yksikot", lang: "fi",
  } as InteractionEvent;
}
const atom = (...args: Parameters<typeof event>): InfoAtom => trafficAtom(event(...args));

/** The ids of the families that span at least the rule's distinct steps among `candidates`. */
function collapsingFamilies(candidates: readonly InfoAtom[]): Set<string> {
  return new Set([...routineFamilies(candidates).values()].filter((f) => f.steps.size >= RULE.minDistinctSteps).map((f) => f.id));
}

describe("family detection is structural", () => {
  it("finds labelled headers and masks their digits", () => {
    expect(labelledHeader("AVL XY7: kangas, tehtävä sammutus.", "XY7")).toBe("AVL XY#");
    expect(labelledHeader("XY7 (kysyttäessä): Vettä säiliössä noin 40 %.", "XY7")).toBe("XY# (kysyttäessä)");
    expect(labelledHeader("Mittari 4 loki: arvo 12.", "M4")).toBe("Mittari # loki");
  });

  it("refuses a bare source header, a header-less text and prose with a long head", () => {
    expect(labelledHeader("XY7: tehtävä sammutus.", "XY7")).toBeNull();
    expect(labelledHeader("Vettä on vähän.", "XY7")).toBeNull();
    expect(labelledHeader(`${"pitkä lause ".repeat(6)}: loppu`, "XY7")).toBeNull();
  });

  it("only logged or asked-for situation lines are eligible: never pushed, never lateral", () => {
    expect(routineFamilyKey(atom("a", 1, "XY7", "AVL XY7: kangas, tehtävä sammutus."))).not.toBeNull();
    expect(routineFamilyKey(atom("b", 1, "XY7", "XY7 (kysyttäessä): Vettä 40 %.", "T3_person", "ask_unit"))).not.toBeNull();
    expect(routineFamilyKey(atom("c", 1, "XY7", "AVL XY7: kangas.", "T1_pushed", "radio_command"))).toBeNull();
    expect(routineFamilyKey(atom("d", 1, "XY7", "QZ1, XY7: tilanne?", "T4_lateral", "radio_lateral"))).toBeNull();
  });

  it("in the demo corpus, collapses the periodic position, asked-status, sensor and weather lines", () => {
    const all = buildDemoScenario().atoms;
    const kept = collapseRoutine(all, RULE);
    const removed = all.filter((a) => !kept.includes(a));
    expect(removed.length).toBeGreaterThan(all.length / 4);
    for (const a of removed) {
      expect(a.tier === "T2_system" || a.tier === "T3_person").toBe(true);
      expect(routineFamilyKey(a)).not.toBeNull();
    }
  });
});

describe("the newest member is kept", () => {
  const family = [
    atom("p1", 1, "XY7", "AVL XY7: kangas, tehtävä sammutus, 1 km."),
    atom("p3", 3, "XY7", "AVL XY7: suo, tehtävä sammutus, 3 km."),
    atom("p2", 2, "XY7", "AVL XY7: tie, tehtävä sammutus, 2 km."),
    atom("q1", 1, "QZ1", "AVL QZ1: kangas, tehtävä sammutus."),
    atom("x2", 2, "XY7", "XY7: oma raportti, ei perhettä."),
  ];

  it("keeps one record per (source, tier, header) family, the newest, and every non-family record", () => {
    expect(collapseRoutine(family, RULE).map((a) => a.id)).toEqual(["p3", "q1", "x2"]);
  });

  it("does not collapse a family seen in fewer than minDistinctSteps steps", () => {
    expect(collapseRoutine(family, { minDistinctSteps: 4 }).map((a) => a.id)).toEqual(family.map((a) => a.id));
  });

  it("respects the time gate: the kept member is the newest released one, never a later record", () => {
    const gated = reachableAtoms(family, 2);
    expect(collapseRoutine(gated, { minDistinctSteps: 2 }).map((a) => a.id)).toEqual(["p2", "q1", "x2"]);
    const scenario = buildDemoScenario();
    for (const step of [1, 5, 10, 16, 20]) {
      const candidates = reachableAtoms(scenario.atoms, step);
      const familyOf = routineFamilies(candidates);
      for (const a of collapseRoutine(candidates, RULE)) {
        expect(a.cycle).toBeLessThanOrEqual(step);
        const f = familyOf.get(a);
        if (f === undefined || f.steps.size < RULE.minDistinctSteps) continue;
        const newest = Math.max(...candidates.filter((c) => familyOf.get(c) === f).map((c) => c.provenance.observedAt));
        expect(a.provenance.observedAt).toBe(newest);
      }
    }
  });

  it("is deterministic and independent of input order, and does not mutate its input", () => {
    const reversed = [...family].reverse();
    const before = reversed.map((a) => a.id);
    const a = collapseRoutine(reversed, RULE).map((x) => x.id);
    expect(collapseRoutine(reversed, RULE).map((x) => x.id)).toEqual(a);
    expect([...a].sort()).toEqual(["p3", "q1", "x2"]);
    expect(reversed.map((x) => x.id)).toEqual(before);
  });
});

describe("Haku is unaffected", () => {
  it("the time gate and Haku's search still reach every routine line", () => {
    const scenario = buildDemoScenario();
    const corpus = reachableAtoms(scenario.atoms, 12);
    const familyOf = routineFamilies(corpus);
    expect(collapseRoutine(corpus, RULE).length).toBeLessThan(corpus.length);
    expect(reachableAtoms(scenario.atoms, 12)).toHaveLength(corpus.length);
    const family = [...collapsingFamilies(corpus)][0]!;
    const members = corpus.filter((a) => familyOf.get(a)?.id === family);
    const haku = retrieveClosed(members[0]!.provenance.sourceId, corpus).map((a) => a.id);
    expect(members.length).toBeGreaterThanOrEqual(RULE.minDistinctSteps);
    for (const m of members) expect(haku).toContain(m.id);
  });

  it("Thinker's retrieval returns at most one member of each routine family", () => {
    const corpus = reachableAtoms(buildDemoScenario().atoms, 16);
    const top = hybridRetrieve("vettä säiliössä", corpus, null, { ...THINKER_RETRIEVAL_CONFIG, topK: 50, maxPerSource: null });
    const collapsing = collapsingFamilies(corpus);
    const familyOf = routineFamilies(corpus);
    const keys = top.map((r) => familyOf.get(r.atom)?.id).filter((k): k is string => k !== undefined && collapsing.has(k));
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("no retrieval code names a designed event", () => {
  const dir = new URL("../../app/retrieval/", import.meta.url);
  const sources = readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")] as const);
  const ids = Object.values(DESIGNED_EVENT_IDS).flat();
  const forbidden = [...ids, GRID_OPERATOR_SOURCE, COMMAND_POST_SOURCE, "DESIGNED_EVENT_IDS", "designed-events", "jännitteetön", "Rahkasuo", "kyteä", "110 kV", "20 kV"]; // SPEC/33 (bc): the line is 20 kV

  it.each(forbidden)("no file in app/retrieval mentions %s", (needle) => {
    expect(sources.length).toBeGreaterThan(0);
    for (const [file, text] of sources) expect(text.includes(needle), `${file} mentions ${needle}`).toBe(false);
  });
});

describe("a shared header is not enough (review fix, 1 Oct 2026)", () => {
  it("keeps records that share a header but say different things", () => {
    const fire = (c: number) => atom(`f${c}`, c, "XY7", `Johto, XY7 (kangas): sivulla pintapaloa, liekit ${c} m, linja pitää.`);
    const request = atom("req", 2, "XY7", "Johto, XY7 (kangas): letkua varalla alle 200 m. Pyydämme lisää 76 mm ja 42 mm letkua.");
    const kept = collapseRoutine([fire(1), request, fire(3), fire(4), fire(5)], RULE).map((a) => a.id);
    expect(kept).toContain("req");
    expect(kept).toContain("f5");
    expect(kept).not.toContain("f1");
  });
  it("keeps one unit's log line apart from another's (different named entities)", () => {
    const refill = (id: string, c: number, unit: string) => atom(id, c, "VESI", `Vesihuoltoloki: ${unit} täyttää säiliön, ${c * 1000} l.`);
    const kept = collapseRoutine([refill("a1", 1, "AB1"), refill("b1", 2, "CD2"), refill("a2", 3, "AB1"), refill("a3", 4, "AB1")], RULE).map((a) => a.id);
    expect(kept).toEqual(["b1", "a3"]);
  });
});
