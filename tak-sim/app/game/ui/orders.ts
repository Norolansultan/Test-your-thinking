/**
 * Game mode screen: which orders each kind of unit takes, the order bar's keys, and the targeting state machine that
 * turns "order chosen → click(s) on the map" into an `Order` (pure, tested).
 *
 * The capability and sensor tables mirror the game loop's unit specs (`sim/unit-specs.ts`, `can` and `sensorM`).
 * TEMPORARY copy until the game loop is merged into this branch; then they are read from there.
 */

import type { GameWorld, Order, UnitKind, XY } from "../contracts.js";

export type OrderType = Order["type"];

/** The order bar's order (left to right). */
export const ORDER_TYPES: readonly OrderType[] = ["move", "attack", "hose_line", "fire_break", "refill", "shuttle", "recon", "drop", "protect", "hold"];

/** Keyboard shortcut of each order. */
export const ORDER_KEY: Readonly<Record<OrderType, string>> = {
  move: "M", attack: "A", hose_line: "H", fire_break: "B", refill: "R", shuttle: "S", recon: "C", drop: "D", protect: "P", hold: "X",
};

/** What each kind can do (mirrors `UNIT_SPECS[kind].can`). TEMPORARY copy. */
const CAN: Readonly<Record<UnitKind, readonly OrderType[]>> = {
  engine: ["move", "attack", "hose_line", "refill", "protect", "hold"],
  tanker: ["move", "refill", "shuttle", "protect", "hold"],
  forest_unit: ["move", "attack", "hose_line", "fire_break", "refill", "protect", "hold"],
  volunteer: ["move", "attack", "hose_line", "refill", "protect", "hold"],
  ugv: ["move", "hose_line", "fire_break", "hold"],
  drone_thermal: ["move", "recon", "hold"],
  drone_vtol: ["move", "recon", "hold"],
  drone_water: ["move", "drop", "hold"],
  helicopter: ["move", "drop", "recon", "hold"],
  spotter: ["move", "recon", "hold"],
};

/** Clear-air sensor radius by kind, m (mirrors `UNIT_SPECS[kind].sensorM`). TEMPORARY copy. */
export const SENSOR_M: Readonly<Record<UnitKind, number>> = {
  engine: 250, tanker: 200, forest_unit: 250, volunteer: 250, ugv: 150,
  drone_thermal: 600, drone_vtol: 800, drone_water: 200, helicopter: 500, spotter: 1500,
};

/** Aircraft and drones (drawn with an air symbol and an energy bar). */
export const AIR_KINDS: ReadonlySet<UnitKind> = new Set<UnitKind>(["drone_thermal", "drone_vtol", "drone_water", "helicopter", "spotter"]);

export function canDo(kind: UnitKind, order: OrderType): boolean {
  return CAN[kind].includes(order);
}

/** The orders a unit of `kind` takes, in the order bar's order. */
export function ordersFor(kind: UnitKind): readonly OrderType[] {
  return ORDER_TYPES.filter((o) => canDo(kind, o));
}

/** The orders every selected unit takes (the bar for a multi-selection); empty for no selection. */
export function ordersForSelection(kinds: readonly UnitKind[]): readonly OrderType[] {
  if (kinds.length === 0) return [];
  return ORDER_TYPES.filter((o) => kinds.every((k) => canDo(k, o)));
}

/** The order whose key is `key` (case-insensitive), or null. */
export function orderByKey(key: string): OrderType | null {
  const k = key.toUpperCase();
  return ORDER_TYPES.find((o) => ORDER_KEY[o] === k) ?? null;
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

export type PointOrder = "move" | "attack" | "hose_line" | "recon" | "drop";

export type Targeting =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly order: PointOrder }
  | { readonly kind: "break_from" }
  | { readonly kind: "break_to"; readonly from: XY }
  | { readonly kind: "water" }
  | { readonly kind: "shuttle_water" }
  | { readonly kind: "shuttle_unit"; readonly waterPointId: string }
  | { readonly kind: "protect" };

export const NO_TARGETING: Targeting = { kind: "none" };

export type TargetEvent =
  | { readonly type: "choose"; readonly order: OrderType }
  | { readonly type: "map"; readonly at: XY }
  | { readonly type: "water"; readonly id: string }
  | { readonly type: "protectable"; readonly id: string }
  | { readonly type: "unit"; readonly id: string }
  | { readonly type: "cancel" };

/** World look-ups for a click on open map (a forgiving pick: the nearest thing within reach). */
export interface TargetPick {
  readonly nearestWater: (at: XY) => string | null;
  readonly nearestProtectable: (at: XY) => string | null;
}

export interface TargetResult {
  readonly next: Targeting;
  /** The order to issue now, or null. */
  readonly order: Order | null;
  /** Whether the event was used by targeting (else the screen handles it: selection, deselection). */
  readonly consumed: boolean;
}

const done = (order: Order): TargetResult => ({ next: NO_TARGETING, order, consumed: true });
const stay = (t: Targeting, consumed: boolean): TargetResult => ({ next: t, order: null, consumed });
const go = (next: Targeting): TargetResult => ({ next, order: null, consumed: true });

function choose(order: OrderType): TargetResult {
  switch (order) {
    case "hold": return done({ type: "hold" });
    case "fire_break": return go({ kind: "break_from" });
    case "refill": return go({ kind: "water" });
    case "shuttle": return go({ kind: "shuttle_water" });
    case "protect": return go({ kind: "protect" });
    default: return go({ kind: "point", order });
  }
}

function pointOrder(order: PointOrder, at: XY): Order {
  switch (order) {
    case "move": return { type: "move", to: at };
    case "attack": return { type: "attack", target: at };
    case "hose_line": return { type: "hose_line", to: at };
    case "recon": return { type: "recon", centre: at };
    case "drop": return { type: "drop", target: at };
  }
}

/** One step of the targeting machine. Choosing an order always starts afresh; Esc (`cancel`) always ends targeting. */
export function targetStep(t: Targeting, ev: TargetEvent, pick: TargetPick): TargetResult {
  if (ev.type === "choose") return choose(ev.order);
  if (ev.type === "cancel") return { next: NO_TARGETING, order: null, consumed: t.kind !== "none" };
  switch (t.kind) {
    case "none":
      return stay(t, false);
    case "point":
      return ev.type === "map" ? done(pointOrder(t.order, ev.at)) : stay(t, false);
    case "break_from":
      return ev.type === "map" ? go({ kind: "break_to", from: ev.at }) : stay(t, false);
    case "break_to":
      return ev.type === "map" ? done({ type: "fire_break", from: t.from, to: ev.at }) : stay(t, false);
    case "water": {
      const id = ev.type === "water" ? ev.id : ev.type === "map" ? pick.nearestWater(ev.at) : null;
      return id === null ? stay(t, ev.type === "map") : done({ type: "refill", waterPointId: id });
    }
    case "shuttle_water": {
      const id = ev.type === "water" ? ev.id : ev.type === "map" ? pick.nearestWater(ev.at) : null;
      return id === null ? stay(t, ev.type === "map") : go({ kind: "shuttle_unit", waterPointId: id });
    }
    case "shuttle_unit":
      return ev.type === "unit" ? done({ type: "shuttle", waterPointId: t.waterPointId, toUnitId: ev.id }) : stay(t, ev.type === "map");
    case "protect": {
      const id = ev.type === "protectable" ? ev.id : ev.type === "map" ? pick.nearestProtectable(ev.at) : null;
      return id === null ? stay(t, ev.type === "map") : done({ type: "protect", assetOrSettlementId: id });
    }
  }
}

// ---------------------------------------------------------------------------
// World picks
// ---------------------------------------------------------------------------

const d2 = (a: XY, b: XY) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

/** The water point nearest `at` (by its draw point or its scoop point), within `maxM`; null when none. */
export function nearestWaterPoint(world: Pick<GameWorld, "waterPoints">, at: XY, maxM = Number.POSITIVE_INFINITY): string | null {
  let best: string | null = null;
  let bestD = maxM * maxM;
  for (const w of world.waterPoints) {
    const d = Math.min(d2(w.at, at), d2(w.scoop, at));
    if (d <= bestD) { best = w.id; bestD = d; }
  }
  return best;
}

/** The building (not a pylon) or settlement centre nearest `at`, within `maxM`; null when none. */
export function nearestProtectable(world: Pick<GameWorld, "assets" | "settlements">, at: XY, maxM = Number.POSITIVE_INFINITY): string | null {
  let best: string | null = null;
  let bestD = maxM * maxM;
  for (const s of world.settlements) {
    const d = d2(s.centre, at);
    if (d <= bestD) { best = s.id; bestD = d; }
  }
  for (const a of world.assets) {
    if (a.kind === "power_pylon") continue;
    const d = d2(a.at, at);
    if (d < bestD) { best = a.id; bestD = d; }
  }
  return best;
}
