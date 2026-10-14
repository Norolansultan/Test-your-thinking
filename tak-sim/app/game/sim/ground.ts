/**
 * Game mode: what ground units do with their orders, one fixed step at a time — direct attack (and
 * the mop-up of the smouldering ground once the flames near the ordered point are out), hose lines, fire breaks, water runs, the tanker shuttle and structure protection (SPEC/18 (m), (y),
 * (ab): hose lines from the vehicle, sprinklers that open when the fire is about 100 m away, firebreak
 * sections cut by saw, the shuttle that keeps a line supplied).
 */

import type { Asset, XY } from "../contracts.js";
import { alongSegment, beyond, byNumber, clampToMap, dist, flameLengthM, pointSegmentDist, toward } from "./geom.js";
import { moveToward, planTo, advance } from "./movement.js";
import { say, unitSay, type Ctx, type UnitRt } from "./runtime.js";
import { isSupplied, naturalWaterAt, nearestWaterPoint, standoffPoint, stepRefill, stepRetreat, tankEmpty, waterAllowedAt, waterPointById, wet } from "./support.js";
import { T } from "./texts.js";

/** How far around the ordered point a crew looks for the burning edge, m. */
export const ATTACK_SEARCH_M = 300;
/** A hose line's water goes on when the fire is this close to it (SPEC/18 ab.2, SPRINKLER_ON_M). */
export const LINE_WATER_ON_M = 100;
/** A stretch of hose line is wetted where flames are within this distance of it, m. */
export const LINE_THREAT_M = 75;
/** A protecting crew's sprinklers and hoses cover buildings this far from it, m. */
export const PROTECT_RADIUS_M = 300;
/** Sprinklers and hoses on the buildings open when the fire is this close (SPEC/18 ab.2, SPRINKLER_ON_M). */
export const SPRINKLER_ON_M = 100;
/** A wetted building stays protected this long after the crew leaves or the water stops, s. */
export const PROTECT_HOLD_S = 600;
/** A tanker hands water over to a unit within this distance (a supply hose), m. */
export const TRANSFER_M = 250;

export function stepGround(ctx: Ctx, u: UnitRt, dtS: number): void {
  if (u.recalled) {
    u.status = "returning";
    if (moveToward(ctx, u, u.entry, dtS)) {
      u.status = "out_of_action";
      u.order = null;
    }
    return;
  }
  if (stepRetreat(ctx, u, dtS)) return;
  if (u.order !== null && u.order.type === "refill" && u.logistics === null) {
    u.logistics = { kind: "refill", waterPointId: u.order.waterPointId, phase: "to_water" };
  }
  if (stepRefill(ctx, u, dtS)) return;
  const o = u.order;
  if (o === null) {
    u.status = "idle";
    return;
  }
  switch (o.type) {
    case "move":
      u.status = "moving";
      if (moveToward(ctx, u, o.to, dtS)) {
        u.order = null;
        u.status = "idle";
      }
      return;
    case "hold":
      u.status = "idle";
      u.legs = [];
      return;
    case "attack": return stepAttack(ctx, u, o.target, dtS);
    case "hose_line": return stepHose(ctx, u, o.to, dtS);
    case "fire_break": return stepBreak(ctx, u, o.from, o.to, dtS);
    case "shuttle": return stepShuttle(ctx, u, o.waterPointId, o.toUnitId, dtS);
    case "protect": return stepProtect(ctx, u, o.assetOrSettlementId, dtS);
    default:
      u.status = "idle";
  }
}

// --- direct attack -----------------------------------------------------------------------------

function stepAttack(ctx: Ctx, u: UnitRt, target: XY, dtS: number): void {
  const idx = ctx.fireIdx;
  const spec = u.spec;
  const natural = naturalWaterAt(ctx, u, u.pos);
  if (!natural && u.waterL <= 0.5) return tankEmpty(ctx, u);
  const workable = (c: number): boolean => (ctx.fire.intensity[c] ?? 0) <= spec.maxSafeKwM && waterAllowedAt(ctx, idx.centre(c));
  let cell = u.workCell;
  if (cell < 0 || !idx.isBurning(cell) || !workable(cell)) {
    // The edge nearest the ordered point first; once working, the next burning cell nearest the crew —
    // an edge cell, one the crew can stand beside without standing in flames.
    const from = u.phase === "engage" ? u.pos : target;
    const candidates = idx.burningWithin(target, ATTACK_SEARCH_M)
      .filter(workable)
      .map((c) => ({ c, d: dist(idx.centre(c), from) }))
      .sort((a, b) => a.d - b.d || a.c - b.c);
    cell = -1;
    u.workAt = null;
    for (const { c } of candidates.slice(0, 40)) {
      const at = standoffPoint(ctx, idx.centre(c), u.pos, spec.reachM * 0.7);
      if (at === null) continue;
      cell = c;
      u.workAt = at;
      break;
    }
    u.workCell = cell;
  }
  if (cell < 0) return attackNothingWorkable(ctx, u, target, dtS);
  let c = idx.centre(cell);
  if (dist(u.pos, c) > spec.reachM) {
    // Balance review (14 Oct 2026): a crew walking in attacks the first workable flames of this fire
    // that come within its nozzle's reach — it no longer walks past (or into) the edge toward a cell
    // picked from afar, which kept the first crews pulling back from flames underfoot without ever
    // opening a nozzle.
    const onTheWay = idx.nearestBurning(u.pos, spec.reachM, (k) => workable(k) && dist(idx.centre(k), target) <= ATTACK_SEARCH_M);
    if (onTheWay < 0) {
      u.phase = "approach";
      u.status = "moving";
      moveToward(ctx, u, u.workAt ?? c, dtS);
      return;
    }
    cell = onTheWay;
    u.workCell = cell;
    u.workAt = null;
    c = idx.centre(cell);
  }
  u.phase = "engage";
  u.status = "working";
  u.legs = [];
  let litres = (spec.pumpLpm * dtS) / 60;
  if (!natural) litres = Math.min(litres, u.waterL);
  if (wet(ctx, u, c, ctx.world.grid.cellM * 0.75, litres) && !natural) u.waterL = Math.max(0, u.waterL - litres);
}

function attackNothingWorkable(ctx: Ctx, u: UnitRt, target: XY, dtS: number): void {
  const idx = ctx.fireIdx;
  const any = idx.nearestBurning(target, ATTACK_SEARCH_M);
  if (any >= 0) {
    const kw = ctx.fire.intensity[any] ?? 0;
    const hot = idx.centre(any);
    if (kw > u.spec.maxSafeKwM) {
      // Too hot: say so and watch from about 150 m.
      say(ctx, unitSay(u, { text: T.tooHot(flameLengthM(kw)), priority: "important", key: "too_hot", at: hot }));
      if (dist(u.pos, hot) < 140) {
        u.status = "moving";
        moveToward(ctx, u, clampToMap(ctx.world.grid, beyond(hot, u.pos, 150)), dtS);
        return;
      }
    } else if (!waterAllowedAt(ctx, hot)) {
      say(ctx, unitSay(u, { text: T.powerLineNoWater(), priority: "important", key: "power_line" }));
    }
    u.phase = "standby";
    u.status = "idle";
    u.legs = [];
    return;
  }
  if (u.phase === "engage") say(ctx, unitSay(u, { text: T.knockedDown(), priority: "routine", key: "knocked_down" }));
  if (stepMopUp(ctx, u, target, dtS)) return;
  if (dist(u.pos, target) > ATTACK_SEARCH_M) {
    u.phase = "approach";
    u.status = "moving";
    moveToward(ctx, u, target, dtS);
    return;
  }
  u.phase = "standby";
  u.status = "idle";
  u.legs = [];
}

/**
 * Mop-up: with no flames left near the ordered point, the crew drowns the smouldering ground within
 * `ATTACK_SEARCH_M` of it, the cell nearest the crew first (a ground fire is out only when it is soaked:
 * the fuel's mop-up water, fire/fuels.ts). True while it takes the step.
 */
function stepMopUp(ctx: Ctx, u: UnitRt, target: XY, dtS: number): boolean {
  const idx = ctx.fireIdx;
  const near = (c: number): boolean => dist(idx.centre(c), target) <= ATTACK_SEARCH_M && waterAllowedAt(ctx, idx.centre(c));
  const cell = idx.nearestSmouldering(u.pos, dist(u.pos, target) + ATTACK_SEARCH_M, near);
  u.workCell = cell;
  u.workAt = null;
  if (cell < 0) return false;
  const c = idx.centre(cell);
  if (dist(u.pos, c) > u.spec.reachM) {
    u.phase = "approach";
    u.status = "moving";
    moveToward(ctx, u, c, dtS, u.spec.reachM * 0.7);
    return true;
  }
  u.phase = "mop_up";
  u.status = "working";
  u.legs = [];
  const natural = naturalWaterAt(ctx, u, u.pos);
  let litres = (u.spec.pumpLpm * dtS) / 60;
  if (!natural) litres = Math.min(litres, u.waterL);
  if (wet(ctx, u, c, ctx.world.grid.cellM * 0.75, litres) && !natural) u.waterL = Math.max(0, u.waterL - litres);
  return true;
}

// --- hose line ---------------------------------------------------------------------------------

/** Where the line starts: natural water for the forest unit's pump, the unit itself, or a road near `to`. */
function hoseAnchor(ctx: Ctx, u: UnitRt, to: XY): XY {
  const hoseM = u.spec.hoseM;
  if (u.kind === "forest_unit") {
    const wp = nearestWaterPoint(ctx, to);
    if (wp !== undefined && dist(wp.at, to) <= hoseM) return wp.at;
  }
  if (dist(u.pos, to) <= hoseM) return u.pos;
  if (u.kind === "engine" || u.kind === "volunteer" || u.kind === "tanker") {
    const n = ctx.deps.nearestNode(ctx.world, to);
    const node = n === null ? undefined : ctx.world.roads.nodes[n];
    if (node !== undefined) return node;
  }
  return toward(to, u.pos, hoseM * 0.95);
}

type Feed = { readonly kind: "natural" } | { readonly kind: "own" } | { readonly kind: "unit"; readonly by: UnitRt } | { readonly kind: "none" };

function hoseFeed(ctx: Ctx, u: UnitRt, anchor: XY): Feed {
  if (u.hoseNatural) return { kind: "natural" };
  if (u.spec.waterL > 0) return { kind: "own" };
  for (const f of ctx.units) {
    if (f === u || f.recalled || f.status === "out_of_action" || f.status === "en_route" || f.spec.air) continue;
    if (f.waterL > 0 && dist(f.pos, anchor) <= 150) return { kind: "unit", by: f };
  }
  return { kind: "none" };
}

function stepHose(ctx: Ctx, u: UnitRt, to: XY, dtS: number): void {
  const spec = u.spec;
  if (u.hoseAnchor === null) {
    u.hoseAnchor = hoseAnchor(ctx, u, to);
    u.hoseNatural = naturalWaterAt(ctx, u, u.hoseAnchor);
    u.phase = "to_anchor";
  }
  const anchor = u.hoseAnchor;
  if (u.phase === "to_anchor" || u.phase === "none") {
    u.status = "moving";
    if (!moveToward(ctx, u, anchor, dtS)) return;
    u.phase = u.hoseTip === null ? "laying" : "holding";
    if (u.hoseTip === null) u.hoseTip = anchor;
    return;
  }
  const tip0 = u.hoseTip ?? anchor;
  const maxLen = Math.min(spec.hoseM, dist(anchor, to));
  if (u.phase === "laying") {
    u.status = "working";
    const next = Math.min(maxLen, dist(anchor, tip0) + (spec.hoseLayMpm * dtS) / 60);
    u.hoseTip = toward(anchor, to, next);
    u.pos = u.hoseTip;
    u.hoseLine = [anchor, u.hoseTip];
    if (next >= maxLen - 1e-6) {
      u.phase = "holding";
      u.hoseCells = ctx.deps.cellsAlongLine(ctx.world.grid, anchor, u.hoseTip);
      const feed = hoseFeed(ctx, u, anchor);
      if (feed.kind === "none") say(ctx, unitSay(u, { text: T.hoseDry(), priority: "important", key: "hose_dry" }));
      else say(ctx, unitSay(u, { text: T.hoseReady(Math.round(next), feed.kind === "natural"), priority: "important", key: "hose_ready" }));
    }
    return;
  }
  // Holding. A line on natural water keeps its whole length wet; a tank-fed line stands ready and
  // its water goes on where the fire comes within 100 m of it.
  u.status = "working";
  const tip = tip0;
  u.hoseLine = [anchor, tip];
  u.hoseCells ??= ctx.deps.cellsAlongLine(ctx.world.grid, anchor, tip);
  const idx = ctx.fireIdx;
  const mid = { x: (anchor.x + tip.x) / 2, y: (anchor.y + tip.y) / 2 };
  const near = idx.burningWithin(mid, dist(anchor, tip) / 2 + LINE_WATER_ON_M)
    .filter((c) => pointSegmentDist(idx.centre(c), anchor, tip) <= LINE_WATER_ON_M);
  const feed = hoseFeed(ctx, u, anchor);
  if (feed.kind === "none") return;
  if (near.length === 0) {
    if (feed.kind === "natural" && u.hoseCells.length > 0) {
      const share = (spec.pumpLpm * dtS) / 60 / u.hoseCells.length;
      for (const c of u.hoseCells) wet(ctx, u, idx.centre(c), ctx.world.grid.cellM * 0.5, share);
    }
    return;
  }
  let budget = (spec.pumpLpm * dtS) / 60;
  if (feed.kind === "own") budget = Math.min(budget, u.waterL);
  if (feed.kind === "unit") budget = Math.min(budget, feed.by.waterL);
  if (budget <= 0.5) {
    if (feed.kind === "own") tankEmpty(ctx, u);
    return;
  }
  // A wet line: most of the water on the stretch of line the fire is nearest (every threatened line
  // cell), the rest from the nozzle on the flames within reach of the line (the nearest few).
  const reach = spec.reachM + ctx.world.grid.cellM / 2;
  const flames: { cell: number; d: number }[] = [];
  for (const c of near) {
    const d = pointSegmentDist(idx.centre(c), anchor, tip);
    if (d <= reach) flames.push({ cell: c, d });
  }
  flames.sort((a, b) => a.d - b.d || a.cell - b.cell);
  const line: number[] = [];
  for (const c of u.hoseCells) if (idx.nearestBurning(idx.centre(c), LINE_THREAT_M) >= 0) line.push(c);
  const toFlames = flames.length === 0 ? 0 : line.length === 0 ? budget : budget * 0.3;
  const toLine = budget - toFlames;
  let used = 0;
  const hit = flames.slice(0, 4);
  for (const f of hit) if (wet(ctx, u, idx.centre(f.cell), ctx.world.grid.cellM * 0.6, toFlames / hit.length)) used += toFlames / hit.length;
  for (const c of line) if (wet(ctx, u, idx.centre(c), ctx.world.grid.cellM * 0.5, toLine / line.length)) used += toLine / line.length;
  if (feed.kind === "own") u.waterL = Math.max(0, u.waterL - used);
  if (feed.kind === "unit") feed.by.waterL = Math.max(0, feed.by.waterL - used);
}

// --- fire break --------------------------------------------------------------------------------

function stepBreak(ctx: Ctx, u: UnitRt, from: XY, to: XY, dtS: number): void {
  const len = dist(from, to);
  if (u.breakCells === null) {
    const cells = ctx.deps.cellsAlongLine(ctx.world.grid, from, to);
    u.breakCells = cells
      .map((cell) => ({ cell, along: Math.max(0, Math.min(len, alongSegment(ctx.fireIdx.centre(cell), from, to))) }))
      .sort((a, b) => a.along - b.along || a.cell - b.cell);
    u.breakNext = 0;
    u.breakProgressM = 0;
    if (u.phase === "none") u.phase = "to_start";
  }
  if (u.phase !== "cutting") {
    u.status = "moving";
    const resumeAt = toward(from, to, u.breakProgressM);
    if (!moveToward(ctx, u, resumeAt, dtS)) return;
    u.phase = "cutting";
  }
  u.status = "working";
  u.breakProgressM = Math.min(len, u.breakProgressM + (u.spec.breakMpm * dtS) / 60);
  const done = u.breakProgressM >= len - 1e-6;
  const reach = done ? Infinity : u.breakProgressM + ctx.world.grid.cellM / 2;
  const batch: number[] = [];
  while (u.breakNext < u.breakCells.length && u.breakCells[u.breakNext]!.along <= reach) {
    batch.push(u.breakCells[u.breakNext]!.cell);
    u.breakNext++;
  }
  if (batch.length > 0) {
    ctx.fire.cutFireBreak(batch.sort(byNumber));
    ctx.breakCellsCut += batch.length;
  }
  u.pos = toward(from, to, u.breakProgressM);
  if (done) {
    say(ctx, unitSay(u, { text: T.breakDone(Math.round(len)), priority: "important", key: "break_done" }));
    u.order = null;
    u.phase = "done";
    u.status = "idle";
  }
}

// --- tanker shuttle ----------------------------------------------------------------------------

function stepShuttle(ctx: Ctx, u: UnitRt, waterPointId: string, toUnitId: string, dtS: number): void {
  const target = ctx.unitById.get(toUnitId);
  if (target === undefined || target.status === "out_of_action" || target.recalled) {
    say(ctx, unitSay(u, { text: T.shuttleStopped(toUnitId), priority: "important", key: "shuttle_stopped", room: "support" }));
    u.order = null;
    u.status = "idle";
    return;
  }
  const wp = waterPointById(ctx, waterPointId);
  if (wp === undefined) {
    u.order = null;
    u.status = "idle";
    return;
  }
  if (u.waterL <= Math.max(100, u.spec.waterL * 0.02)) {
    say(ctx, unitSay(u, { text: T.shuttleFilling(wp.nameFi, wp.nameEn), priority: "routine", key: "shuttle_fill", room: "support" }));
    u.logistics = { kind: "refill", waterPointId, phase: "to_water" };
    u.legs = [];
    u.dest = null;
    stepRefill(ctx, u, dtS);
    return;
  }
  if (target.status === "en_route") {
    u.status = "idle";
    return;
  }
  if (dist(u.pos, target.pos) > TRANSFER_M) {
    if (u.phase !== "to_target") {
      u.phase = "to_target";
      say(ctx, unitSay(u, { text: T.shuttleDelivering(u.waterL / 1000, target.id), priority: "routine", key: "shuttle_go", room: "support" }));
    }
    u.status = "moving";
    if (u.dest === null || dist(u.dest, target.pos) > 100) {
      u.legs = [];
      planTo(ctx, u, target.pos);
    }
    advance(u, dtS);
    if (dist(u.pos, target.pos) <= TRANSFER_M) {
      u.legs = [];
      u.dest = null;
      u.etaS = null;
    }
    return;
  }
  u.phase = "transfer";
  u.status = "working";
  const space = target.spec.waterL - target.waterL;
  const amount = Math.min((u.spec.pumpLpm * dtS) / 60, u.waterL, Math.max(0, space));
  u.waterL -= amount;
  target.waterL += amount;
}

// --- structure protection ----------------------------------------------------------------------

interface ProtectTarget { readonly centre: XY; readonly assets: readonly Asset[]; readonly nameFi: string; readonly nameEn: string }

export function protectTarget(ctx: Ctx, id: string): ProtectTarget | null {
  const s = ctx.world.settlements.find((x) => x.id === id);
  if (s !== undefined) {
    const assets = ctx.world.assets.filter((a) => s.assetIds.includes(a.id));
    return { centre: s.centre, assets, nameFi: s.nameFi, nameEn: s.nameEn };
  }
  const a = ctx.world.assets.find((x) => x.id === id);
  if (a === undefined) return null;
  return { centre: a.at, assets: [a], nameFi: a.id, nameEn: a.id };
}

function stepProtect(ctx: Ctx, u: UnitRt, id: string, dtS: number): void {
  const t = protectTarget(ctx, id);
  if (t === null) {
    u.order = null;
    u.status = "idle";
    return;
  }
  if (u.phase !== "protecting") {
    u.status = "moving";
    if (!moveToward(ctx, u, t.centre, dtS, 20)) return;
    u.phase = "protecting";
    say(ctx, unitSay(u, { text: T.protectStart(t.nameFi, t.nameEn), priority: "routine", key: "protect_start" }));
  }
  u.status = "working";
  const covered = t.assets.filter((a) => dist(a.at, u.pos) <= PROTECT_RADIUS_M && !ctx.burnedAssets.has(a.id) && a.kind !== "power_pylon");
  if (covered.length === 0) return;
  const natural = naturalWaterAt(ctx, u, u.pos) || ctx.world.waterPoints.some((w) => dist(w.at, u.pos) <= PROTECT_RADIUS_M);
  const threatened = covered.some((a) => ctx.fireIdx.nearestBurning(a.at, SPRINKLER_ON_M) >= 0);
  if (!natural && u.waterL <= 0.5) {
    // No water, no protection: wait for the shuttle, or go and fill when the fire is coming.
    if (threatened && !isSupplied(ctx, u)) tankEmpty(ctx, u);
    return;
  }
  if (threatened) {
    const need = (u.spec.protectLpm * dtS) / 60;
    const use = natural ? need : Math.min(need, u.waterL);
    const per = use / covered.length;
    let used = 0;
    for (const a of covered) if (wet(ctx, u, a.at, ctx.world.grid.cellM * 0.6, per)) used += per;
    if (!natural) u.waterL = Math.max(0, u.waterL - used);
  }
  for (const a of covered) ctx.protectedUntil.set(a.id, ctx.tS + PROTECT_HOLD_S);
}
