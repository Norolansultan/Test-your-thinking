/**
 * Game mode screen: the order bar offers exactly the orders a unit's kind takes (the game loop's own unit specs), with
 * a key for each, and lights the order being targeted.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import type { Unit, UnitKind } from "../../app/game/contracts.js";
import { canDo as specCanDo, UNIT_SPECS } from "../../app/game/sim/unit-specs.js";
import { activeOrder, hintOf, OrderBar } from "../../app/game/ui/OrderBar.js";
import { ORDER_KEY, ORDER_TYPES, orderByKey, ordersFor, ordersForSelection, type OrderType } from "../../app/game/ui/orders.js";
import { GAME_TEXT } from "../../app/game/ui/text.js";

const KINDS = Object.keys(UNIT_SPECS).sort() as UnitKind[];

function unit(id: string, kind: UnitKind): Unit {
  return { id, callsign: id, kind, pos: { x: 0, y: 0 }, status: "idle", order: null, waterL: 1000, waterMaxL: 3000, energyPct: 100, harm: 0, hoseLine: null, etaS: null };
}

/** Every `data-testid` in a rendered vnode tree (function components are rendered by calling them). */
function testIds(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) { for (const n of node) testIds(n, out); return out; }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === "function") return testIds((v.type as (p: unknown) => unknown)(v.props), out);
  const id = v.props?.["data-testid"];
  if (typeof id === "string") out.push(id);
  return testIds(v.props?.children, out);
}

const bar = (units: readonly Unit[], targeting: Parameters<typeof OrderBar>[0]["targeting"] = { kind: "none" }) =>
  OrderBar({
    lang: "fi", units, orders: ordersForSelection(units.map((u) => u.kind)), targeting, startClockMin: 720,
    onChoose: () => undefined, onNearestWater: () => undefined, onCancel: () => undefined, onDeselect: () => undefined,
  });

describe("valid orders per unit kind", () => {
  it("the bar's list for each kind is exactly what the game loop accepts for it", () => {
    for (const k of KINDS) expect(ordersFor(k), k).toEqual(ORDER_TYPES.filter((o) => specCanDo(k, o)));
  });

  it("the expected roles: engines attack and protect, the forest unit and the robot cut breaks, drones look, aircraft drop", () => {
    expect(ordersFor("engine")).toEqual(["move", "attack", "hose_line", "refill", "protect", "hold"]);
    expect(ordersFor("forest_unit")).toContain("fire_break");
    expect(ordersFor("ugv")).toEqual(["move", "hose_line", "fire_break", "hold"]);
    expect(ordersFor("tanker")).toContain("shuttle");
    expect(ordersFor("drone_thermal")).toEqual(["move", "recon", "hold"]);
    expect(ordersFor("helicopter")).toEqual(["move", "recon", "drop", "hold"]);
    for (const k of ["drone_thermal", "drone_vtol", "spotter", "helicopter", "drone_water"] as const) expect(ordersFor(k)).not.toContain("attack");
    expect(ordersFor("engine")).not.toContain("fire_break");
  });

  it("a multi-selection gets the orders every selected unit takes", () => {
    expect(ordersForSelection(["engine", "drone_thermal"])).toEqual(["move", "hold"]);
    expect(ordersForSelection(["engine", "volunteer"])).toEqual(ordersFor("engine"));
    expect(ordersForSelection([])).toEqual([]);
  });

  it("each order has its own key, and the keys find the orders", () => {
    const keys = ORDER_TYPES.map((o) => ORDER_KEY[o]);
    expect(new Set(keys).size).toBe(ORDER_TYPES.length);
    for (const o of ORDER_TYPES) {
      expect(orderByKey(ORDER_KEY[o])).toBe(o);
      expect(orderByKey(ORDER_KEY[o].toLowerCase())).toBe(o);
      expect(GAME_TEXT.fi.order[o]).toBeTruthy();
      expect(GAME_TEXT.en.order[o]).toBeTruthy();
    }
    expect(orderByKey("Q")).toBeNull();
    // Space and 1–4 are the clock's keys.
    for (const k of [" ", "1", "2", "3", "4"]) expect(orderByKey(k)).toBeNull();
  });
});

describe("the order bar", () => {
  it("shows one button per valid order for the selected unit's kind, and nothing else", () => {
    for (const k of KINDS) {
      const ids = testIds(bar([unit("U1", k)])).filter((id) => id.startsWith("game-order-"));
      expect(ids, k).toEqual(ordersFor(k).map((o) => `game-order-${o}`));
    }
  });

  it("shows the targeting hint only while targeting, with Nearest water for a refill", () => {
    expect(testIds(bar([unit("EK11", "engine")]))).not.toContain("game-target-hint");
    const refill = testIds(bar([unit("EK11", "engine")], { kind: "water" }));
    expect(refill).toContain("game-target-hint");
    expect(refill).toContain("game-nearest-water");
    const attack = testIds(bar([unit("EK11", "engine")], { kind: "point", order: "attack" }));
    expect(attack).toContain("game-target-hint");
    expect(attack).not.toContain("game-nearest-water");
  });

  it("names the targeting step and lights its order", () => {
    const cases: [Parameters<typeof activeOrder>[0], OrderType | null, string | null][] = [
      [{ kind: "none" }, null, null],
      [{ kind: "point", order: "move" }, "move", "point_move"],
      [{ kind: "break_from" }, "fire_break", "break_from"],
      [{ kind: "break_to", from: { x: 1, y: 2 } }, "fire_break", "break_to"],
      [{ kind: "water" }, "refill", "water"],
      [{ kind: "shuttle_water" }, "shuttle", "shuttle_water"],
      [{ kind: "shuttle_unit", waterPointId: "w" }, "shuttle", "shuttle_unit"],
      [{ kind: "protect" }, "protect", "protect"],
    ];
    for (const [t, order, hint] of cases) {
      expect(activeOrder(t)).toBe(order);
      expect(hintOf(t)).toBe(hint);
      if (hint) { expect(GAME_TEXT.fi.hint[hint as keyof typeof GAME_TEXT.fi.hint]).toBeTruthy(); expect(GAME_TEXT.en.hint[hint as keyof typeof GAME_TEXT.en.hint]).toBeTruthy(); }
    }
  });
});
