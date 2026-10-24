/**
 * The recency boost (D2(a), 8 Oct 2026): the newest candidate of each source and of each sector gets a
 * small additive score, only when the question already matched it; deterministic; declared in the
 * retrieval configuration. Uses a lexical-only retrieval over synthetic records (no index needed).
 */

import { describe, expect, it } from "vitest";
import { hybridRetrieve, recencyBoosts, THINKER_RETRIEVAL_CONFIG, type HybridConfig } from "../../app/retrieval/hybrid.js";
import { trafficAtom } from "../../app/scenario/traffic-atoms.js";
import type { InfoAtom, InteractionEvent } from "../../app/scenario/types.js";

function event(id: string, cycle: number, simTimeS: number, actor: string, content: string): InteractionEvent {
  return {
    id, cycle, session_view: cycle, sim_time_s: simTimeS, timestamp: "13:20:00", actor, actor_type: "fire_team", addressee: null,
    location: null, place: null, lat: null, lon: null, event_type: "status", task: null, content, tier: "T3_person", channel: "ask_unit", nav: "yksikot", lang: "fi",
  } as InteractionEvent;
}
const atom = (id: string, cycle: number, t: number, actor: string, content: string): InfoAtom => trafficAtom(event(id, cycle, t, actor, content));

const BOOST = { source: 0.05, sector: 0.03 };
const NO_COLLAPSE: HybridConfig = { ...THINKER_RETRIEVAL_CONFIG, routineCollapse: null, recencyBoost: BOOST };

describe("recencyBoosts", () => {
  const old = atom("a.old", 1, 100, "KY21", "KY21: lohko L3 palaa, vettä riittää.");
  const mid = atom("a.mid", 2, 700, "KY21", "KY21: lohko L3 palaa, vettä riittää.");
  const fresh = atom("a.new", 3, 1300, "KY21", "KY21: lohko L3 palaa, vettä riittää.");
  const other = atom("b.only", 3, 900, "EK11", "EK11: tilanne rauhallinen.");

  it("gives the newest of each source the source boost and the newest naming a sector the sector boost, once each", () => {
    expect(recencyBoosts([old, mid, fresh, other], BOOST)).toEqual([0, 0, BOOST.source + BOOST.sector, BOOST.source]);
  });

  it("is the same whatever the candidate order", () => {
    const a = recencyBoosts([old, mid, fresh, other], BOOST);
    const b = recencyBoosts([other, fresh, mid, old], BOOST);
    expect([b[3], b[2], b[1], b[0]]).toEqual(a);
  });

  it("breaks an observation tie by the larger id, so it is total", () => {
    const x = atom("x.1", 1, 100, "KY21", "KY21: L3 palaa.");
    const y = atom("x.2", 1, 100, "KY21", "KY21: L3 palaa.");
    expect(recencyBoosts([x, y], BOOST)[1]).toBeGreaterThan(recencyBoosts([x, y], BOOST)[0]!);
  });
});

describe("hybridRetrieve with the boost", () => {
  const old = atom("a.old", 1, 100, "KY21", "KY21: lohko L3 palaa, vettä riittää.");
  const fresh = atom("a.new", 3, 1300, "KY21", "KY21: lohko L3 palaa, vettä riittää.");
  const unrelated = atom("z.none", 3, 1400, "EK11", "EK11: sammutin tarkastettu.");

  it("ranks the newest status above an otherwise identical older one, and does not lift unmatched records", () => {
    const ranked = hybridRetrieve("L3 vettä", [old, fresh, unrelated], null, NO_COLLAPSE).map((r) => r.atom.id);
    expect(ranked).toEqual(["a.new", "a.old"]);
  });

  it("changes scores by exactly the boost for the boosted record and nothing for the older one", () => {
    const off = hybridRetrieve("L3 vettä", [old, fresh, unrelated], null, { ...NO_COLLAPSE, recencyBoost: null });
    const on = hybridRetrieve("L3 vettä", [old, fresh, unrelated], null, NO_COLLAPSE);
    const score = (rs: typeof on, id: string) => rs.find((r) => r.atom.id === id)!.score;
    expect(score(on, "a.old")).toBe(score(off, "a.old"));
    expect(score(on, "a.new")).toBeCloseTo(score(off, "a.new") + BOOST.source + BOOST.sector, 6);
  });

  it("is declared in the frozen configuration", () => {
    expect(THINKER_RETRIEVAL_CONFIG.recencyBoost).toEqual({ ...BOOST, latest: { relevance: 0.5, graded: 0.3 } }); // D10 (24 Oct 2026): the latest-state preference
    expect(THINKER_RETRIEVAL_CONFIG.routineCollapse).toEqual({ minDistinctSteps: 3 });
  });
});
