/**
 * Game mode: how units get somewhere. Road vehicles drive the road graph and the crew walks the last
 * stretch (SPEC/18 (m): "a fire engine cannot get there; its crew can, on foot"); the forest-fire unit
 * and the robot take the off-road leg themselves when it is quicker; aircraft fly straight.
 */

import type { XY } from "../contracts.js";
import { dist } from "./geom.js";
import type { Ctx, Leg, UnitRt } from "./runtime.js";

/** A destination closer than this needs no road: the crew walks or the vehicle drives straight. */
const DIRECT_M = 200;
/** How far from a unit the road network may start, and from a destination it may end. */
const ROAD_START_MAX_M = 1500;
const ROAD_END_MAX_M = 5000;
/** A destination that moved less than this keeps the planned route. */
const REPLAN_M = 30;

function offRoadMs(u: UnitRt): number {
  return Math.max(0.3, u.spec.offRoadKmh / 3.6);
}

/** The legs from `from` to `dest` for this unit. */
export function planLegs(ctx: Ctx, u: UnitRt, from: XY, dest: XY): Leg[] {
  if (u.spec.air) return [{ to: dest, speedMs: u.spec.airKmh / 3.6 }];
  const off = offRoadMs(u);
  const direct: Leg[] = [{ to: dest, speedMs: off }];
  const directM = dist(from, dest);
  if (directM <= DIRECT_M) return direct;
  const nA = ctx.deps.nearestNode(ctx.world, from, ROAD_START_MAX_M);
  const nB = ctx.deps.nearestNode(ctx.world, dest, ROAD_END_MAX_M);
  if (nA === null || nB === null) return direct;
  const a = ctx.world.roads.nodes[nA];
  const b = ctx.world.roads.nodes[nB];
  if (a === undefined || b === undefined) return direct;
  const legs: Leg[] = [{ to: a, speedMs: off }];
  let roadS = 0;
  if (nA !== nB) {
    const r = ctx.deps.route(ctx.world, nA, nB, u.spec.roadKmh);
    if (r === null || r.path.length === 0) return direct;
    const v = r.durationS > 0 && r.lengthM > 0 ? r.lengthM / r.durationS : off;
    for (const p of r.path) legs.push({ to: p, speedMs: v });
    roadS = r.durationS;
  }
  legs.push({ to: dest, speedMs: off });
  const viaRoadS = dist(from, a) / off + roadS + dist(b, dest) / off;
  return directM / off <= viaRoadS ? direct : legs;
}

/** Seconds the legs take from `from`. */
export function legsDurationS(from: XY, legs: readonly Leg[]): number {
  let t = 0;
  let p = from;
  for (const l of legs) {
    t += dist(p, l.to) / Math.max(0.1, l.speedMs);
    p = l.to;
  }
  return t;
}

/** Estimated travel time for this unit between two points, s. */
export function travelTimeS(ctx: Ctx, u: UnitRt, from: XY, to: XY): number {
  return legsDurationS(from, planLegs(ctx, u, from, to));
}

/** Plans (or keeps) a route to `dest` and sets the arrival estimate. */
export function planTo(ctx: Ctx, u: UnitRt, dest: XY): void {
  if (u.dest !== null && dist(u.dest, dest) <= REPLAN_M && u.legs.length > 0) return;
  u.dest = dest;
  u.legs = planLegs(ctx, u, u.pos, dest);
  u.etaS = ctx.tS + legsDurationS(u.pos, u.legs);
}

/** Moves along the planned legs for `dtS` (optionally faster); true when the last leg is done. */
export function advance(u: UnitRt, dtS: number, speedFactor = 1): boolean {
  let remaining = dtS;
  while (remaining > 1e-9 && u.legs.length > 0) {
    const leg = u.legs[0]!;
    const v = Math.max(0.1, leg.speedMs * speedFactor);
    const d = dist(u.pos, leg.to);
    const t = d / v;
    if (t <= remaining) {
      u.pos = leg.to;
      remaining -= t;
      u.legs.shift();
    } else {
      const f = (v * remaining) / d;
      u.pos = { x: u.pos.x + (leg.to.x - u.pos.x) * f, y: u.pos.y + (leg.to.y - u.pos.y) * f };
      remaining = 0;
    }
  }
  if (u.legs.length === 0) {
    u.dest = null;
    u.etaS = null;
    return true;
  }
  return false;
}

/**
 * One step toward `dest`: plans if needed and moves. True when the unit is there (within `tolM`)
 * — then it has the rest of the step's time unused; behaviours start working on the next step.
 */
export function moveToward(ctx: Ctx, u: UnitRt, dest: XY, dtS: number, tolM = 3, speedFactor = 1): boolean {
  if (dist(u.pos, dest) <= tolM) {
    if (tolM <= 5) u.pos = dest;
    u.legs = [];
    u.dest = null;
    u.etaS = null;
    return true;
  }
  planTo(ctx, u, dest);
  return advance(u, dtS, speedFactor);
}
