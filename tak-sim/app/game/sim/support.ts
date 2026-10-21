/**
 * Game mode: water, logistics and crew safety shared by the unit behaviours — where water may be used
 * (the live 20 kV line), where it comes from (tank, natural water, a shuttle), the water run that
 * interrupts an order and hands it back, and the pull-back when an edge is too hot (LCES).
 */

import { CELL, POWER_LINE_SAFE_M, type Order, type WaterPoint, type XY } from "../contracts.js";
import { clampToMap, dist, polylineDist } from "./geom.js";
import { neighbours } from "./hazards.js";
import { moveToward, travelTimeS } from "./movement.js";
import { say, unitSay, type Ctx, type Phase, type UnitRt } from "./runtime.js";
import { T } from "./texts.js";

/** A ground unit standing this close to a water point pumps from it (no tank drawn). */
export const AT_WATER_M = 60;
/** The forest-fire unit's portable pump reaches natural water this far from where it works. */
export const PUMP_REACH_M = 300;
/** A crew pulls back when an edge hotter than its limit burns this close. */
export const DANGER_M = 60;
/** …to this distance from the heat, and waits there at least this long. */
export const SAFE_M = 150;
export const RETREAT_HOLD_S = 120;

/** Whether water may be used at `p` now (not within `POWER_LINE_SAFE_M` of the live line). */
export function waterAllowedAt(ctx: Ctx, p: XY): boolean {
  return !ctx.powerLineLive || polylineDist(p, ctx.world.powerLine) > POWER_LINE_SAFE_M;
}

/** Puts water on the fire unless the live line forbids it; tells the crew's radio once if it does. */
export function wet(ctx: Ctx, u: UnitRt, centre: XY, radiusM: number, litres: number): boolean {
  if (litres <= 0) return false;
  const allowed = waterAllowedAt(ctx, centre);
  ctx.deps.onWater?.({ tS: ctx.tS, unitId: u.id, at: centre, litres, applied: allowed });
  if (!allowed) {
    say(ctx, unitSay(u, { text: T.powerLineNoWater(), priority: "important", key: "power_line" }));
    return false;
  }
  ctx.fire.applyWater(centre, radiusM, litres);
  ctx.waterAppliedL += litres;
  return true;
}

export function waterPointById(ctx: Ctx, id: string): WaterPoint | undefined {
  return ctx.world.waterPoints.find((w) => w.id === id);
}

/** The water point whose drawing point is nearest `p` (ties: list order). */
export function nearestWaterPoint(ctx: Ctx, p: XY): WaterPoint | undefined {
  let best: WaterPoint | undefined;
  let bestD = Infinity;
  for (const w of ctx.world.waterPoints) {
    const d = dist(w.at, p);
    if (d < bestD) { best = w; bestD = d; }
  }
  return best;
}

/** The water point whose scoop point is nearest `p` (aircraft). */
export function nearestScoop(ctx: Ctx, p: XY): WaterPoint | undefined {
  let best: WaterPoint | undefined;
  let bestD = Infinity;
  for (const w of ctx.world.waterPoints) {
    const d = dist(w.scoop, p);
    if (d < bestD) { best = w; bestD = d; }
  }
  return best;
}

/** Whether the unit at `p` works from natural water (a pump at a water point). */
export function naturalWaterAt(ctx: Ctx, u: UnitRt, p: XY): boolean {
  const reach = u.kind === "forest_unit" ? PUMP_REACH_M : AT_WATER_M;
  for (const w of ctx.world.waterPoints) if (dist(w.at, p) <= reach || dist(w.scoop, p) <= reach) return true;
  return false;
}

/** Whether a tanker is shuttling water to this unit. */
export function isSupplied(ctx: Ctx, u: UnitRt): boolean {
  for (const t of ctx.units) {
    if (t.recalled || t.casualty || t.status === "out_of_action" || t.status === "en_route") continue;
    if (t.order !== null && t.order.type === "shuttle" && t.order.toUnitId === u.id) return true;
  }
  return false;
}

/** Where an order picks up again after a water run or a battery swap. */
export function resumePhase(order: Order | null): Phase {
  if (order === null) return "none";
  switch (order.type) {
    case "attack": return "approach";
    case "hose_line": return "to_anchor";
    case "protect": return "to_asset";
    case "shuttle": return "none";
    case "fire_break": return "to_start";
    default: return "none";
  }
}

/** The tank is empty: wait for the shuttle that supplies it, else go and refill (and come back). */
export function tankEmpty(ctx: Ctx, u: UnitRt): void {
  if (isSupplied(ctx, u)) {
    say(ctx, unitSay(u, { text: T.tankEmptyWaiting(), priority: "important", key: "tank_empty" }));
    u.status = "idle";
    u.phase = "standby";
    return;
  }
  const wp = nearestWaterPoint(ctx, u.pos);
  if (wp === undefined) {
    u.status = "idle";
    u.phase = "standby";
    return;
  }
  const fillS = u.spec.fillLpm > 0 ? (u.spec.waterL / u.spec.fillLpm) * 60 : 0;
  const awayMin = (2 * travelTimeS(ctx, u, u.pos, wp.at) + fillS) / 60;
  say(ctx, unitSay(u, { text: T.tankEmptyRefill(wp.nameFi, wp.nameEn, awayMin), priority: "important", key: "tank_empty", room: "support" }));
  u.logistics = { kind: "refill", waterPointId: wp.id, phase: "to_water" };
  u.legs = [];
  u.dest = null;
  u.status = "returning";
}

/** One step of a water run. True while the run takes the unit's step. */
export function stepRefill(ctx: Ctx, u: UnitRt, dtS: number): boolean {
  const lg = u.logistics;
  if (lg === null || lg.kind !== "refill") return false;
  const wp = waterPointById(ctx, lg.waterPointId);
  if (wp === undefined) {
    u.logistics = null;
    return false;
  }
  const explicit = u.order !== null && u.order.type === "refill";
  if (lg.phase === "to_water") {
    u.status = explicit ? "moving" : "returning";
    if (!moveToward(ctx, u, wp.at, dtS)) return true;
    lg.phase = "filling";
    say(ctx, unitSay(u, { text: T.filling(wp.nameFi, wp.nameEn), priority: "routine", key: "filling", room: "support" }));
  }
  u.status = "refilling";
  u.waterL = Math.min(u.spec.waterL, u.waterL + (u.spec.fillLpm * dtS) / 60);
  if (u.waterL < u.spec.waterL - 1e-6) return true;
  u.waterL = u.spec.waterL;
  u.logistics = null;
  if (explicit) {
    u.order = u.prevOrder;
    u.prevOrder = null;
  }
  const back = u.order !== null;
  say(ctx, unitSay(u, { text: T.tankFull(back), priority: "routine", key: "tank_full", room: "support" }));
  u.phase = resumePhase(u.order);
  u.status = back ? "moving" : "idle";
  return true;
}

/**
 * LCES: a crew on a task (not one told to hold or move) pulls back when an edge hotter than its limit
 * burns within 60 m, when flames are under its feet or when the fire closes round it — to the safest
 * nearby point (least heat, upwind first) — and waits there before taking the task up again.
 */
export function stepRetreat(ctx: Ctx, u: UnitRt, dtS: number): boolean {
  if (u.spec.air) return false;
  if (u.retreatTo !== null) {
    u.status = "moving";
    const there = moveToward(ctx, u, u.retreatTo, dtS, 3, 1.5);
    if (there && ctx.tS >= u.retreatUntilS) {
      u.retreatTo = null;
      u.retreatUntilS = -1;
      u.phase = resumePhase(u.order);
      u.workCell = -1;
      u.workAt = null;
      u.status = "idle";
    }
    return true;
  }
  const o = u.order;
  if (o !== null && (o.type === "hold" || o.type === "move")) return false;
  if (!inDanger(ctx, u)) return false;
  u.retreatTo = safestPoint(ctx, u.pos, SAFE_M);
  u.retreatUntilS = ctx.tS + RETREAT_HOLD_S;
  u.legs = [{ to: u.retreatTo, speedMs: Math.max(0.5, u.spec.offRoadKmh / 3.6) }];
  u.dest = u.retreatTo;
  u.status = "moving";
  say(ctx, unitSay(u, { text: T.retreat(), priority: "important", key: "retreat", at: u.pos }));
  moveToward(ctx, u, u.retreatTo, dtS, 3, 1.5);
  return true;
}

/** Heat above the crew's limit nearby, flames underfoot, or fire on seven sides of eight. */
export function inDanger(ctx: Ctx, u: UnitRt): boolean {
  const hot = ctx.fireIdx.hottestWithin(u.pos, DANGER_M);
  if (hot.cell >= 0 && hot.kwM > u.spec.maxSafeKwM) return true;
  const cell = ctx.deps.cellOf(ctx.world.grid, u.pos);
  if (cell === null) return false;
  if (ctx.fire.state[cell] === CELL.burning) return true;
  let around = 0;
  for (const n of neighbours(ctx.world.grid.cols, ctx.world.grid.rows, cell)) if (ctx.fire.state[n] === CELL.burning) around++;
  return around >= 7;
}

/**
 * Where a crew stands to put water on a burning cell: `r` from its centre, on a cell that is not
 * burning (one foot in the black or on unburned ground), nearest the crew; null inside a burning area.
 */
export function standoffPoint(ctx: Ctx, target: XY, from: XY, r: number): XY | null {
  let best: XY | null = null;
  let bestD = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const q = clampToMap(ctx.world.grid, { x: target.x + r * Math.sin(a), y: target.y + r * Math.cos(a) });
    const c = ctx.deps.cellOf(ctx.world.grid, q);
    if (c === null || ctx.fire.state[c] === CELL.burning) continue;
    const d = dist(q, from);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

/** Of eight points `d` away, the one with the least heat within 60 m (ties: upwind first, then north and clockwise). */
export function safestPoint(ctx: Ctx, p: XY, d: number): XY {
  const upwind = ctx.weather.windFromDeg;
  let best: XY = clampToMap(ctx.world.grid, { x: p.x, y: p.y + d });
  let bestScore = Infinity;
  for (let k = 0; k < 8; k++) {
    const deg = k * 45;
    const r = (deg * Math.PI) / 180;
    const q = clampToMap(ctx.world.grid, { x: p.x + d * Math.sin(r), y: p.y + d * Math.cos(r) });
    const heat = ctx.fireIdx.hottestWithin(q, DANGER_M).kwM + 50 * ctx.fireIdx.burningWithin(q, DANGER_M).length;
    const off = Math.abs(((deg - upwind + 540) % 360) - 180) / 180;
    const score = heat + off;
    if (score < bestScore) { bestScore = score; best = q; }
  }
  return best;
}
