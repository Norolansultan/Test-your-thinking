/**
 * Game mode: scripted scenario events (new ignitions, P3 and emergency-centre traffic, the grid
 * operator de-energising the 110 kV line, the region recalling units, weather warnings) and the
 * periodic traffic: the weather service every 20 minutes, the crews' and drones' situation reports,
 * spot-fire calls and long-shift warnings.
 */

import { CELL, type FireStepReport, type ScenarioEvent } from "../contracts.js";
import { bearingDeg, clockLabel, dist, flameLengthM, windToVector } from "./geom.js";
import type { Fog } from "./fog.js";
import { active, say, unitSay, type Ctx, type UnitRt } from "./runtime.js";
import { T } from "./texts.js";
import type { Text } from "./radio.js";

/** The weather service reports every this many seconds. */
export const WEATHER_EVERY_S = 1200;
/** A crew's own situation report at most this often, s. */
export const SITREP_EVERY_S = 600;
/** An aircraft's report from its orbit at most this often, s. */
export const AIR_SITREP_EVERY_S = 900;

const p3 = (t: Text): Text => ({ fi: `P3: ${t.fi}`, en: `P3: ${t.en}` });

export function runEvent(ctx: Ctx, fog: Fog, e: ScenarioEvent): void {
  const msg = e.message;
  switch (e.kind) {
    case "ignite": {
      if (e.at !== undefined) {
        const cell = ctx.deps.cellOf(ctx.world.grid, e.at);
        if (cell !== null && ctx.fire.ignite(cell)) ctx.fireIdx.noteIgnited(cell);
        // A reported ignition is on the map; an unreported one waits to be found.
        if (cell !== null && msg !== undefined) fog.reveal(ctx, [cell]);
      }
      if (msg !== undefined) ctx.radio.push(ctx.tS, msg);
      return;
    }
    case "radio":
      if (msg !== undefined) ctx.radio.push(ctx.tS, msg);
      return;
    case "power_line_dead":
      ctx.powerLineLive = false;
      if (msg !== undefined) ctx.radio.push(ctx.tS, msg);
      else say(ctx, { from: "P3", room: "command", text: p3(T.powerLineDead()), priority: "important", key: "power_line_dead", force: true });
      return;
    case "units_recalled": {
      const ids = (e.unitIds ?? []).filter((id) => ctx.unitById.has(id));
      if (msg !== undefined) ctx.radio.push(ctx.tS, msg);
      else if (ids.length > 0) say(ctx, { from: "P3", room: "command", text: p3(T.recalled(ids)), priority: "important", key: "recalled", force: true });
      for (const id of ids) recall(ctx, ctx.unitById.get(id)!);
      return;
    }
    case "weather_warning": {
      if (msg !== undefined) {
        ctx.radio.push(ctx.tS, msg);
        return;
      }
      const ahead = ctx.tS + 3600;
      const w = ctx.deps.weatherAt(ctx.scenario.weather, ahead);
      const t = T.weatherWarning(w.windFromDeg, w.windMs, w.gustMs, clockLabel(ctx.scenario.startClockMin, ahead));
      say(ctx, { from: "SÄÄ", room: "support", text: { fi: `SÄÄ: ${t.fi}`, en: `WEATHER: ${t.en}` }, priority: "important", key: "warning", force: true });
      return;
    }
  }
}

/** The region takes a unit for another fire: it leaves the map (or never arrives). */
export function recall(ctx: Ctx, u: UnitRt): void {
  if (u.status === "out_of_action") return;
  u.recalled = true;
  u.order = null;
  u.prevOrder = null;
  u.logistics = null;
  u.retreatTo = null;
  u.legs = [];
  u.dest = null;
  u.hoseLine = null;
  if (u.status === "en_route") {
    u.status = "out_of_action";
    u.etaS = null;
    return;
  }
  u.status = "returning";
  say(ctx, unitSay(u, { text: T.leaving(), priority: "important", key: "leaving", room: "command" }));
}

/** The neighbour cell in a compass direction (degrees), or -1 at the edge. */
function cellToward(ctx: Ctx, cell: number, deg: number): number {
  const { cols, rows } = ctx.world.grid;
  const oct = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  const dc = [0, 1, 1, 1, 0, -1, -1, -1][oct]!;
  const dr = [-1, -1, 0, 1, 1, 1, 0, -1][oct]!;
  const r = Math.floor(cell / cols) + dr;
  const c = (cell % cols) + dc;
  return r >= 0 && r < rows && c >= 0 && c < cols ? r * cols + c : -1;
}

function rosToward(ctx: Ctx, cell: number, deg: number): number {
  const n = cellToward(ctx, cell, deg);
  return n < 0 ? 0 : Math.max(0, ctx.fire.rateOfSpread(cell, n, ctx.weather));
}

export function periodicRadio(ctx: Ctx, fog: Fog, report: FireStepReport): void {
  if (ctx.tS % WEATHER_EVERY_S === 0) {
    const w = ctx.weather;
    say(ctx, { from: "SÄÄ", room: "support", text: { fi: `SÄÄ: ${ctx.deps.describeWeatherFi(w)}`, en: `WEATHER: ${ctx.deps.describeWeatherEn(w)}` }, priority: "routine", key: "weather", force: true });
  }
  spotFireCalls(ctx, report);
  for (const u of ctx.units) {
    if (!active(u) || u.recalled) continue;
    longShift(ctx, u);
    if (ctx.tS - u.lastSitrepS < (u.spec.air ? AIR_SITREP_EVERY_S : SITREP_EVERY_S)) continue;
    const said = u.spec.air ? airSitrep(ctx, fog, u) : groundSitrep(ctx, u);
    if (said) u.lastSitrepS = ctx.tS;
  }
}

function spotFireCalls(ctx: Ctx, report: FireStepReport): void {
  for (const s of report.spotFires) {
    const p = ctx.fireIdx.centre(s.cell);
    const seer = ctx.units.find((u) => active(u) && !u.recalled && dist(u.pos, p) <= u.spec.sensorM);
    if (seer === undefined) continue;
    const from = ctx.fireIdx.centre(s.fromCell);
    say(ctx, unitSay(seer, { text: T.spotFire(dist(from, p), bearingDeg(from, p)), priority: "important", key: "spot", at: p }));
  }
}

function longShift(ctx: Ctx, u: UnitRt): void {
  if (u.spec.air || !u.spec.crewExposed || u.said.has("long_shift")) return;
  if (ctx.tS - u.onSceneSinceS < u.spec.enduranceMin * 60) return;
  u.said.add("long_shift");
  say(ctx, unitSay(u, { text: T.longShift(Math.round(u.spec.enduranceMin / 60)), priority: "important", key: "long_shift", room: "command" }));
}

function taskSuffix(u: UnitRt): Text {
  const o = u.order;
  if (o === null) return { fi: "", en: "" };
  if (o.type === "attack" && u.phase === "engage") return T.attacking(u.waterL, u.spec.waterL === 0);
  if (o.type === "hose_line" && u.phase === "holding" && u.hoseLine !== null) {
    const [a, b] = u.hoseLine;
    return T.hoseHolding(a !== undefined && b !== undefined ? Math.round(dist(a, b)) : 0);
  }
  if (o.type === "fire_break" && u.breakCells !== null) return T.breakProgress(Math.round(u.breakProgressM), Math.round(dist(o.from, o.to)));
  if (o.type === "protect" && u.phase === "protecting") return T.protecting();
  return { fi: "", en: "" };
}

function groundSitrep(ctx: Ctx, u: UnitRt): boolean {
  if (u.status === "refilling" || u.status === "returning") return false;
  const idx = ctx.fireIdx;
  const cell = idx.nearestBurning(u.pos, u.spec.sensorM);
  if (cell < 0) return false;
  const q = idx.centre(cell);
  const wTo = windToVector(ctx.weather.windFromDeg);
  const d = Math.max(1, dist(q, u.pos));
  const head = ((u.pos.x - q.x) * wTo.x + (u.pos.y - q.y) * wTo.y) / d > 0.5;
  const dir = head ? bearingDeg({ x: 0, y: 0 }, wTo) : bearingDeg(q, u.pos);
  const ros = rosToward(ctx, cell, dir);
  const flame = flameLengthM(ctx.fire.intensity[cell] ?? 0);
  const e = T.edge(head, dir, ros, flame);
  const s = taskSuffix(u);
  return say(ctx, unitSay(u, { text: { fi: e.fi + s.fi, en: e.en + s.en }, priority: "routine", key: "sitrep", at: q }));
}

function airSitrep(ctx: Ctx, fog: Fog, u: UnitRt): boolean {
  const o = u.order;
  if (o === null || o.type !== "recon" || u.phase !== "orbit" || u.logistics !== null || u.status !== "working") return false;
  const cells = fog.footprint(u);
  let burned = 0;
  let maxRos = 0;
  let sampled = 0;
  const windTo = bearingDeg({ x: 0, y: 0 }, windToVector(ctx.weather.windFromDeg));
  for (const c of cells) {
    const s = ctx.fire.state[c];
    if (s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished) burned++;
    if (s === CELL.burning && sampled < 40) {
      sampled++;
      maxRos = Math.max(maxRos, rosToward(ctx, c, windTo));
    }
  }
  const ha = (burned * ctx.world.grid.cellM * ctx.world.grid.cellM) / 10000;
  const thermal = u.kind === "drone_thermal" || u.kind === "drone_vtol";
  const t = T.airSitrep(thermal ? "thermal" : "eyes", ha, sampled > 0 ? windTo : null, maxRos);
  return say(ctx, unitSay(u, { text: t, priority: "routine", key: "sitrep", at: o.centre }));
}
