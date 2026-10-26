/**
 * Revision (bp), 26 Oct 2026: VP — the first look — has no freeze in the built scenario (`hasFreeze` false, SPEC/14 (bp) §bp.5). The
 * orchestrator's freeze does not depend on the view, and many session tests take their freeze in VP, the first view a session opens:
 * {@link withPracticeFreeze} gives VP a freeze back, at the retired practice freeze's moment ({@link FIXTURE_FREEZE_AT_S}) with four
 * items of both answer forms (two choices, two map points; option `a` keyed), so those tests run the orchestrator's freeze as before.
 * The built VP's own flow, with no freeze, is tested in `orchestrator.spec.ts`.
 */

import type { FreezeItem, ScenarioContract } from "../../app/scenario/types.js";

/** The retired practice freeze's moment in VP, 69 s into the view. */
export const FIXTURE_FREEZE_AT_S = 69;

/** The extent's centre: the map items' key. */
export const centreOf = (ext: ScenarioContract["extent"]) => ({ lat: (ext.south + ext.north) / 2, lon: (ext.west + ext.east) / 2 });

const opts = (prefix: string) => ["a", "b", "c", "d"].map((id) => ({ id, labelFi: `${prefix} ${id}`, correct: id === "a" }));

/** The fixture's four items: L1 and L2 choices, an L1 and an L3 map point. */
export function fixtureFreezeItems(ext: ScenarioContract["extent"]): FreezeItem[] {
  const centre = centreOf(ext);
  return [
    { id: "t.l1", level: "L1", promptFi: "Missä EK11 on?", options: opts("L1") },
    { id: "t.l2", level: "L2", promptFi: "Mikä uhkaa?", options: opts("L2") },
    { id: "t.map1", level: "L1", kind: "map_point", promptFi: "Napauta EK11:n sijainti.", options: [], mapKey: { point: centre, toleranceM: 300 }, keyAtomIds: ["atom.x"] },
    { id: "t.map3", level: "L3", kind: "map_point", promptFi: "Mihin palo on 30 min päästä edennyt pisimmälle?", options: [], mapKey: { point: centre, toleranceM: 400 } },
  ];
}

/** `base` with a freeze in VP: `items` (the fixture's by default) at {@link FIXTURE_FREEZE_AT_S}. */
export function withPracticeFreeze(base: ScenarioContract, items: FreezeItem[] = fixtureFreezeItems(base.extent)): ScenarioContract {
  return {
    ...base,
    practice: { ...base.practice, cycle: { ...base.practice.cycle, hasFreeze: true, freezeAtSeconds: FIXTURE_FREEZE_AT_S }, freeze: { ...base.practice.freeze, items } },
  };
}
