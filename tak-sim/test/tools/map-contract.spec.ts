/**
 * The geometry contract (SPEC/33 §3, stage 0): the map the scenario was authored on meets its own contract, the committed
 * contract is what the extractor measures on it, a moved feature breaks it, and every keyed item and text that names a feature or
 * states a distance maps to a contract entry.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { allRelations, checkContract, contractIntegrity, newViolations, readContract, type Contract } from "../../tools/topo-map/checks/contract.js";
import { loadBuiltMap, type BuiltMap } from "../../tools/topo-map/checks/contract-map.js";
import { measureSpecs } from "../../tools/topo-map/checks/contract-extract.js";
import { contractCoverage } from "../../tools/topo-map/checks/contract-coverage.js";
import type { Geom } from "../../tools/topo-map/checks/contract-geom.js";

let map: BuiltMap;
let contract: Contract;

beforeAll(() => {
  map = loadBuiltMap();
  contract = readContract();
}, 120_000);

/** The built map with one point feature moved by (dx, dy) metres. */
function moved(id: string, dx: number, dy: number): BuiltMap {
  const g = map.features[id];
  if (!g || g.kind !== "point") throw new Error(`${id} is not a point feature`);
  const shifted: Geom = { kind: "point", p: { x: g.p.x + dx, y: g.p.y + dy } };
  return { ...map, features: { ...map.features, [id]: shifted } };
}

const failing = (m: BuiltMap) => newViolations(checkContract(m, contract)).map((v) => v.relation);

describe("geometry contract (SPEC/33 §3)", () => {
  it("is well formed: unique ids, every feature a relation names defined, every relation used by something", () => {
    expect(contractIntegrity(contract)).toEqual([]);
    expect(contract.features.length).toBeGreaterThan(50);
    expect(allRelations(contract).length).toBeGreaterThan(120);
  });

  it("is what the extractor measures on the built map (the committed contract is current)", () => {
    const fresh = measureSpecs(map);
    expect(fresh.map((r) => r.id)).toEqual(contract.relations.map((r) => r.id));
    for (const [i, r] of fresh.entries()) expect(JSON.parse(JSON.stringify(r.value)), r.id).toEqual(contract.relations[i]!.value);
  });

  it("holds on the current build: no violation but the documented known ones", () => {
    const all = checkContract(map, contract);
    expect(newViolations(all).map((v) => v.message)).toEqual([]);
    expect(all.filter((v) => v.known !== undefined).map((v) => v.relation).sort()).toEqual(["curated.text.detour_any_truck_road", "curated.text.kuusimaki_400m_ahead"]);
  });

  it("fails when the R3 bridge moves off the river crossing", () => {
    const f = failing(moved("BRIDGE", 0, -800));
    expect(f).toEqual(expect.arrayContaining(["crosses.R3_E.KOTKANJOKI@BRIDGE", "crosses.bridge_drawn@BRIDGE", "adjacency.BRIDGE_W3.BRIDGE"]));
  });

  it("fails when Lahdenkylä moves to the west, out of its sector and off R2's end", () => {
    const f = failing(moved("LAHDENKYLA", -4000, 1000));
    expect(f).toEqual(expect.arrayContaining(["bearing.IGN.LAHDENKYLA", "within_sector.LAHDENKYLA", "adjacency.VILLAGE=LAHDENKYLA", "adjacency.R2_end.LAHDENKYLA"]));
  });

  it("fails when a road-line anchor leaves its forest road", () => {
    expect(failing(moved("anchor.FR_E", 0, -200))).toContain("on_road.FR_E.HONKAHARJU_ROAD");
  });

  it("fails when a label the scenario names is missing from the map", () => {
    const m: BuiltMap = { ...map, labels: { fi: map.labels.fi.filter((l) => l.text !== "Honkaharju"), en: map.labels.en } };
    expect(failing(m)).toEqual(expect.arrayContaining(["text_mention.label.Honkaharju", "text_mention.HONKAHARJU_ROAD.name"]));
  });

  it("covers every keyed item and text that names a feature or states a distance", async () => {
    const cov = await contractCoverage(contract);
    expect(cov.texts).toBeGreaterThan(1500);
    expect(cov.unmatched.map((u) => `${u.id}: ${u.what}`)).toEqual([]);
  }, 120_000);
});
