/**
 * Game mode screen: the targeting state machine — select a unit, choose an order, click once or twice, and the order
 * is issued — plus the selection rules and issuing to a selection through `game.issue`.
 */

import { describe, expect, it } from "vitest";
import type { Game, Order, Unit, UnitKind, XY } from "../../app/game/contracts.js";
import { issueToSelection, nextSelection } from "../../app/game/ui/controls.js";
import { NO_TARGETING, nearestProtectable, nearestWaterPoint, targetStep, type TargetEvent, type TargetPick, type Targeting } from "../../app/game/ui/orders.js";
import { getWorld } from "../../app/game/world/load.js";

const pick: TargetPick = {
  nearestWater: (at) => (at.x < 100 ? "w-near" : null),
  nearestProtectable: (at) => (at.x < 100 ? "house-near" : null),
};

/** Runs events from no targeting; returns the final targeting and the orders issued on the way. */
function run(events: readonly TargetEvent[], start: Targeting = NO_TARGETING): { t: Targeting; orders: Order[]; consumed: boolean[] } {
  let t = start;
  const orders: Order[] = [];
  const consumed: boolean[] = [];
  for (const e of events) {
    const r = targetStep(t, e, pick);
    t = r.next;
    consumed.push(r.consumed);
    if (r.order) orders.push(r.order);
  }
  return { t, orders, consumed };
}

const P = (x: number, y: number): XY => ({ x, y });

describe("targeting: order → click(s) → issue", () => {
  it("one-click orders issue on the map click and end targeting", () => {
    const cases: [Exclude<Order["type"], "fire_break" | "refill" | "shuttle" | "protect" | "hold">, Order][] = [
      ["move", { type: "move", to: P(10, 20) }],
      ["attack", { type: "attack", target: P(10, 20) }],
      ["hose_line", { type: "hose_line", to: P(10, 20) }],
      ["recon", { type: "recon", centre: P(10, 20) }],
      ["drop", { type: "drop", target: P(10, 20) }],
    ];
    for (const [order, expected] of cases) {
      const r = run([{ type: "choose", order }, { type: "map", at: P(10, 20) }]);
      expect(r.orders).toEqual([expected]);
      expect(r.t).toEqual(NO_TARGETING);
    }
  });

  it("a fire break takes two clicks: start, then end", () => {
    const first = run([{ type: "choose", order: "fire_break" }, { type: "map", at: P(1, 2) }]);
    expect(first.orders).toEqual([]);
    expect(first.t).toEqual({ kind: "break_to", from: P(1, 2) });
    const both = run([{ type: "map", at: P(300, 400) }], first.t);
    expect(both.orders).toEqual([{ type: "fire_break", from: P(1, 2), to: P(300, 400) }]);
    expect(both.t).toEqual(NO_TARGETING);
  });

  it("hold issues at once, without a click", () => {
    expect(run([{ type: "choose", order: "hold" }])).toMatchObject({ t: NO_TARGETING, orders: [{ type: "hold" }] });
  });

  it("refill: a water point marker, or a map click near one; a click far from water keeps targeting", () => {
    expect(run([{ type: "choose", order: "refill" }, { type: "water", id: "w1" }]).orders).toEqual([{ type: "refill", waterPointId: "w1" }]);
    expect(run([{ type: "choose", order: "refill" }, { type: "map", at: P(50, 0) }]).orders).toEqual([{ type: "refill", waterPointId: "w-near" }]);
    const far = run([{ type: "choose", order: "refill" }, { type: "map", at: P(5000, 0) }]);
    expect(far.orders).toEqual([]);
    expect(far.t).toEqual({ kind: "water" });
    expect(far.consumed[1]).toBe(true); // the click does not fall through to deselection
  });

  it("shuttle: the water point, then the unit to supply", () => {
    const r = run([{ type: "choose", order: "shuttle" }, { type: "water", id: "w2" }, { type: "map", at: P(9999, 0) }, { type: "unit", id: "EK11" }]);
    expect(r.orders).toEqual([{ type: "shuttle", waterPointId: "w2", toUnitId: "EK11" }]);
    expect(r.t).toEqual(NO_TARGETING);
  });

  it("protect: a house or settlement marker, or a map click near one", () => {
    expect(run([{ type: "choose", order: "protect" }, { type: "protectable", id: "lahdenkyla" }]).orders).toEqual([{ type: "protect", assetOrSettlementId: "lahdenkyla" }]);
    expect(run([{ type: "choose", order: "protect" }, { type: "map", at: P(1, 1) }]).orders).toEqual([{ type: "protect", assetOrSettlementId: "house-near" }]);
  });

  it("Esc cancels any step; choosing another order starts afresh", () => {
    expect(run([{ type: "choose", order: "fire_break" }, { type: "map", at: P(1, 2) }, { type: "cancel" }])).toMatchObject({ t: NO_TARGETING, orders: [] });
    expect(run([{ type: "choose", order: "attack" }, { type: "choose", order: "move" }]).t).toEqual({ kind: "point", order: "move" });
  });

  it("without targeting, clicks are not consumed (they select and deselect)", () => {
    const r = run([{ type: "map", at: P(1, 1) }, { type: "unit", id: "EK11" }, { type: "water", id: "w" }, { type: "cancel" }]);
    expect(r.consumed).toEqual([false, false, false, false]);
    expect(r.orders).toEqual([]);
  });
});

describe("world picks for forgiving clicks", () => {
  const world = getWorld();
  it("finds the nearest water point within reach, else nothing", () => {
    const w = world.waterPoints[0]!;
    expect(nearestWaterPoint(world, { x: w.at.x + 5, y: w.at.y }, 400)).toBe(w.id);
    expect(nearestWaterPoint(world, { x: -50_000, y: -50_000 }, 400)).toBeNull();
  });
  it("finds a building or settlement near a click, never a pylon", () => {
    const s = world.settlements[0]!;
    expect(nearestProtectable(world, s.centre, 250)).not.toBeNull();
    const pylon = world.assets.find((a) => a.kind === "power_pylon");
    if (pylon) expect(nearestProtectable(world, pylon.at, 1)).not.toBe(pylon.id);
  });
});

describe("selection and issuing", () => {
  it("a click selects one unit; Shift-click adds or removes", () => {
    expect(nextSelection([], "A", false)).toEqual(["A"]);
    expect(nextSelection(["A", "B"], "C", false)).toEqual(["C"]);
    expect(nextSelection(["A"], "B", true)).toEqual(["A", "B"]);
    expect(nextSelection(["A", "B"], "A", true)).toEqual(["B"]);
  });

  const u = (id: string, kind: UnitKind): Unit => ({ id, callsign: id, kind, pos: { x: 0, y: 0 }, status: "idle", order: null, waterL: 0, waterMaxL: 0, energyPct: 100, harm: 0, hoseLine: null, etaS: null });
  const fakeGame = () => {
    const calls: [string, Order][] = [];
    const game: Pick<Game, "issue"> = {
      issue: (id, order) => {
        calls.push([id, order]);
        return id === "BAD" ? { ok: false, reasonFi: "Ei.", reasonEn: "No." } : { ok: true };
      },
    };
    return { game, calls };
  };

  it("issues to every selected unit that can take the order, through game.issue (select → order → click → issue)", () => {
    const units = [u("EK11", "engine"), u("DR1", "drone_thermal"), u("VPK", "volunteer")];
    let t: Targeting = NO_TARGETING;
    t = targetStep(t, { type: "choose", order: "attack" }, pick).next;
    const r = targetStep(t, { type: "map", at: P(5000, 5000) }, pick);
    const { game, calls } = fakeGame();
    const out = issueToSelection(game, units, ["EK11", "DR1", "VPK"], r.order!);
    expect(calls.map((c) => c[0])).toEqual(["EK11", "VPK"]); // the drone cannot attack: skipped
    expect(out).toEqual([{ unitId: "EK11", ok: true }, { unitId: "VPK", ok: true }]);
  });

  it("reports the game's refusal with its reasons", () => {
    const { game } = fakeGame();
    expect(issueToSelection(game, [u("BAD", "engine")], ["BAD"], { type: "hold" })).toEqual([{ unitId: "BAD", ok: false, reasonFi: "Ei.", reasonEn: "No." }]);
  });

  it("when no selected unit can take the order, the first is still asked so the player hears why", () => {
    const { game, calls } = fakeGame();
    issueToSelection(game, [u("DR1", "drone_thermal")], ["DR1"], { type: "attack", target: P(0, 0) });
    expect(calls).toHaveLength(1);
  });

  it("a per-unit order (refill at each unit's nearest water) is built for each unit", () => {
    const { game, calls } = fakeGame();
    issueToSelection(game, [u("EK11", "engine"), u("EK12", "engine")], ["EK11", "EK12"], (x) => ({ type: "refill", waterPointId: `near-${x.id}` }));
    expect(calls).toEqual([["EK11", { type: "refill", waterPointId: "near-EK11" }], ["EK12", { type: "refill", waterPointId: "near-EK12" }]]);
  });
});
