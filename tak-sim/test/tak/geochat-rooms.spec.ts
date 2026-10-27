/**
 * GeoChat's rooms by source (SPEC/28 §5, `app/tak/geochat.ts`; review 27 Oct 2026, finding 7): every drone call sign DR<n> is filed
 * with the air and drones — the training's DR8 was filed under "Support & weather" — and the main scenario's rooms are unchanged:
 * every source the scenario holds (its records' sources, its units, its aircraft) gets the room it got before (the rule of 26 Oct 2026,
 * kept here as it was).
 */

import { describe, expect, it } from "vitest";
import { chatRoomOf, type ChatRoom } from "../../app/tak/geochat.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { TRAINING_ATOMS } from "../../app/session/training/corpus.js";

/** The rule before the review: a fixed list of air sources. */
function roomBefore(sourceId: string): ChatRoom {
  const id = sourceId.trim().toUpperCase();
  if (new Set(["DR1", "DR2", "DR3", "VD1", "SPOT", "HELI1", "DRONERYHMÄ"]).has(id)) return "air";
  if (new Set(["P2", "P3", "TILANNEKUVA", "HÄTÄKESKUS", "JÄLKIVARTIO", "JOKE"]).has(id)) return "command";
  if (/^(EK\d+|KY\d+|OUT\d+|VPK|UGV\d+)$/.test(id)) return "ground";
  return "support";
}

describe("GeoChat's rooms (finding 7)", () => {
  it("files every DR<n> with the air and drones: the training's DR8 too", () => {
    for (const id of ["DR1", "DR2", "DR3", "DR8", "dr12 "]) expect(chatRoomOf(id), id).toBe("air");
    expect(new Set(TRAINING_ATOMS.map((a) => chatRoomOf(a.provenance.sourceId)))).toEqual(new Set(["ground", "air"]));
    for (const id of ["DRONERYHMÄ", "VD1", "SPOT", "HELI1"]) expect(chatRoomOf(id), id).toBe("air");
    for (const id of ["DRY", "DR", "ADR1"]) expect(chatRoomOf(id), id).toBe("support");
  });

  it("gives every source of the main scenario the room it had before", () => {
    const scenario = buildDemoScenario();
    const ids = new Set<string>();
    for (const a of scenario.atoms) ids.add(a.provenance.sourceId);
    for (const c of [scenario.practice.cycle, ...scenario.cycles]) {
      for (const id of Object.keys(c.unitPositions ?? {})) ids.add(id);
      for (const a of c.aircraft ?? []) ids.add(a.platformId);
    }
    expect(ids.size).toBeGreaterThan(20);
    expect([...ids].filter((id) => /^DR\d+$/i.test(id)).sort()).toEqual(["DR1", "DR2", "DR3"]);
    for (const id of ids) expect(chatRoomOf(id), id).toBe(roomBefore(id));
  }, 60_000);
});
