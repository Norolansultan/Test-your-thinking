/**
 * Game mode: aircraft and drones — reconnaissance orbits, the bucket and water-drone drop cycle, and
 * the battery swap or refuel at the command post (SPEC/18 k.3: DR1/DR2 orbit their target at 120 m,
 * DR3 maps the perimeter, HELI1 shuttles its bucket between Haukilampi and the head; aa.2: VD1 80 l a
 * round, no drops above 11 m/s gusts).
 */

import type { UnitKind, XY } from "../contracts.js";
import { dist } from "./geom.js";
import { moveToward } from "./movement.js";
import { say, unitSay, type Ctx, type UnitRt } from "./runtime.js";
import { nearestScoop, resumePhase, wet } from "./support.js";
import { T } from "./texts.js";

/** Aircraft head home at this battery / fuel level, percent. */
export const RETURN_AT_PCT = 15;
/** The water drone stops dropping above this gust speed, m/s (SPEC/18 aa.2). */
export const WATER_DRONE_GUST_LIMIT_MS = 11;
/** A drop aims at the burning cell nearest the ordered point within this distance, m. */
export const DROP_AIM_M = 150;
/** Within this distance of the command post an aircraft is on the ground. */
const BASE_M = 30;

export function orbitRadiusM(kind: UnitKind): number {
  switch (kind) {
    case "drone_thermal": return 150;
    case "drone_vtol": return 400;
    case "helicopter": return 300;
    case "spotter": return 1000;
    default: return 150;
  }
}

export function stepAir(ctx: Ctx, u: UnitRt, dtS: number): void {
  const base = ctx.world.commandPost;
  if (u.airborne) {
    u.energyPct = Math.max(0, u.energyPct - (dtS / (u.spec.enduranceMin * 60)) * 100);
    if (u.energyPct <= 0) {
      say(ctx, unitSay(u, { text: T.forcedLanding(), priority: "urgent", key: "forced_landing", at: u.pos }));
      u.status = "out_of_action";
      u.order = null;
      u.legs = [];
      u.airborne = false;
      return;
    }
  }
  if (u.recalled) {
    u.status = "returning";
    const exit = u.kind === "helicopter" || u.kind === "spotter" ? u.entry : base;
    if (moveToward(ctx, u, exit, dtS)) {
      u.status = "out_of_action";
      u.order = null;
      u.airborne = false;
    }
    return;
  }
  if (stepRecharge(ctx, u, dtS)) {
    u.airborne = u.logistics !== null && u.logistics.kind === "recharge" && u.logistics.phase === "to_base";
    return;
  }
  if (u.airborne && u.energyPct <= RETURN_AT_PCT) {
    say(ctx, unitSay(u, { text: T.lowEnergy(u.energyPct, u.kind === "helicopter" || u.kind === "spotter"), priority: "important", key: "low_energy" }));
    u.logistics = { kind: "recharge", phase: "to_base", untilS: 0 };
    u.legs = [];
    u.dest = null;
    stepRecharge(ctx, u, dtS);
    return;
  }
  const o = u.order;
  if (o === null || o.type === "hold") {
    u.status = "idle";
    u.legs = [];
  } else if (o.type === "move") {
    u.status = "moving";
    if (moveToward(ctx, u, o.to, dtS)) {
      u.order = null;
      u.status = "idle";
    }
  } else if (o.type === "recon") {
    stepRecon(ctx, u, o.centre, dtS);
  } else if (o.type === "drop") {
    stepDrop(ctx, u, o.target, dtS);
  } else {
    u.status = "idle";
  }
  u.airborne = dist(u.pos, base) > BASE_M || u.legs.length > 0;
}

/** Battery swap / refuel: fly home, wait, take the order up again. True while it takes the step. */
function stepRecharge(ctx: Ctx, u: UnitRt, dtS: number): boolean {
  const lg = u.logistics;
  if (lg === null || lg.kind !== "recharge") return false;
  if (lg.phase === "to_base") {
    u.status = "returning";
    if (!moveToward(ctx, u, ctx.world.commandPost, dtS)) return true;
    lg.phase = "charging";
    lg.untilS = ctx.tS + u.spec.rechargeMin * 60;
  }
  u.status = "refilling";
  if (ctx.tS + dtS < lg.untilS) return true;
  u.energyPct = 100;
  u.logistics = null;
  u.phase = u.order === null ? "none" : resumePhase(u.order);
  if (u.order !== null && u.order.type === "drop") u.phase = "none";
  if (u.order !== null && u.order.type === "recon") u.phase = "to_orbit";
  u.status = u.order === null ? "idle" : "moving";
  return true;
}

function stepRecon(ctx: Ctx, u: UnitRt, centre: XY, dtS: number): void {
  const r = orbitRadiusM(u.kind);
  if (u.phase !== "orbit") {
    u.phase = "to_orbit";
    const d = dist(u.pos, centre);
    // The point of the orbit circle on the aircraft's side of the centre.
    const entry = d < 1 ? { x: centre.x, y: centre.y + r } : { x: centre.x + ((u.pos.x - centre.x) / d) * r, y: centre.y + ((u.pos.y - centre.y) / d) * r };
    u.status = "moving";
    if (!moveToward(ctx, u, entry, dtS)) return;
    u.orbitAngle = Math.atan2(u.pos.x - centre.x, u.pos.y - centre.y);
    u.phase = "orbit";
    return;
  }
  u.status = "working";
  u.legs = [];
  u.orbitAngle += ((u.spec.airKmh / 3.6) * dtS) / r;
  u.pos = { x: centre.x + r * Math.sin(u.orbitAngle), y: centre.y + r * Math.cos(u.orbitAngle) };
}

function stepDrop(ctx: Ctx, u: UnitRt, target: XY, dtS: number): void {
  const wp = nearestScoop(ctx, target);
  if (wp === undefined) {
    u.order = null;
    u.status = "idle";
    return;
  }
  if (u.kind === "drone_water" && ctx.weather.gustMs > WATER_DRONE_GUST_LIMIT_MS) {
    say(ctx, unitSay(u, { text: T.gustHold(), priority: "important", key: "gust_hold" }));
    u.status = "idle";
    u.legs = [];
    return;
  }
  if (u.phase === "none" || u.phase === "to_orbit" || u.phase === "orbit") u.phase = u.waterL >= u.spec.waterL * 0.5 ? "to_drop" : "to_scoop";
  if (u.phase === "to_scoop") {
    u.status = "moving";
    if (!moveToward(ctx, u, wp.scoop, dtS)) return;
    u.phase = "scooping";
    u.phaseUntilS = ctx.tS + u.spec.scoopS;
  }
  if (u.phase === "scooping") {
    u.status = "refilling";
    if (ctx.tS + dtS < u.phaseUntilS) return;
    u.waterL = u.spec.waterL;
    u.phase = "to_drop";
    return;
  }
  // to_drop: aim at the flames nearest the ordered point
  const idx = ctx.fireIdx;
  const cell = idx.nearestBurning(target, DROP_AIM_M);
  const aim = cell >= 0 ? idx.centre(cell) : target;
  u.status = "moving";
  if (!moveToward(ctx, u, aim, dtS, 5)) return;
  const len = u.spec.dropStripM;
  const from = wp.scoop;
  const d = Math.max(1, dist(from, aim));
  const ux = (aim.x - from.x) / d;
  const uy = (aim.y - from.y) / d;
  const radius = Math.max(ctx.world.grid.cellM * 0.6, len / 6);
  const each = u.waterL / 3;
  let dropped = 0;
  for (const k of [-1, 0, 1]) {
    const p = { x: aim.x + (ux * len * k) / 3, y: aim.y + (uy * len * k) / 3 };
    if (wet(ctx, u, p, radius, each)) dropped += each;
  }
  if (dropped > 0) say(ctx, unitSay(u, { text: T.drop(Math.round(dropped)), priority: "routine", key: "drop", at: aim }));
  u.waterL = 0;
  u.status = "working";
  u.phase = "to_scoop";
}
