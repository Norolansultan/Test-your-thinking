/**
 * Tank water, step by step (review 1 Oct 2026, item 3): a crew on a hose line drains its tank, and
 * the tank is filled again — by the scripted refill moves (`deployment.ts`, reason `water`), by the
 * water shuttle, and in phase B on the south front by the farmers' slurry tankers (SPEC/18 §8.1
 * FARM). Levels go down and up; a unit with a scripted refill coming is near empty the step before
 * it ("säiliö tyhjä", VPK's twenty minutes at step 4).
 *
 * The water shuttle (fix pass 2, 7 Oct 2026, researcher decision): the tanker EK13 carries water
 * from the declared water points (W1 Haukilampi, W2 Lahdenkylän lampi, W3 by R3:n silta (Kotkanjoki), revision (al)) to a
 * portable basin at each line, and the engine refills from the basin without leaving it. Until then
 * a low engine drove away for water while its crew "stayed on the line" — on a dead hose, without
 * its escape vehicle, both head-flank engines at once at 14.21. A crew radios at a quarter tank; the
 * shuttle serves the requests in the order they come, from where it is, filling up at the water
 * point nearest the line it last served whenever it cannot carry another delivery. A crew whose tank
 * runs dry near the head before the basin is filled withdraws to the burned area (LCES).
 *
 * Every water event has a fixed time in its step, so what a crew says about its tank when asked
 * (`waterAnswer`) is what the tank held at that moment. A delivery after the step's end is applied,
 * and logged, in the step it falls in. A scripted refill (a logged move) reports the full tank after
 * the fill, with the time it will be back on the line.
 */

import { FEATURES, UNIT_PLAN, type P } from "./deployment.js";
import { actorTypeOf, dist, hm, L, pl, say, stepStartS } from "./traffic-text.js";
import type { Out, ShuttleState, TankState, TrafficCycleInput, TrafficState, TrafficUnit } from "./traffic-types.js";
import type { UnitWork } from "../../app/scenario/types.js";
import { sortedKeys } from "../../app/engine/deterministic-object.js";

/** Units without a water tank to drain: the forest-fire unit pumps from natural water; the robot carries hose. */
const NO_TANK = new Set(["EK14", "UGV1"]);
/** Tankers and engine + tanker pairs carry about twice an engine's water: they drain at half the share. */
const BIG_TANK = new Set(["EK11", "VPK", "OUT1", "OUT2"]);
/** Share of the tank a task uses in 20 minutes (percentage points). */
const USE: Readonly<Record<string, number>> = { hose_attack: 38, peat_soak: 46, mop_up: 26, firebreak: 4 };
/**
 * A crew holding a line on a road (deployment.ts `at:` anchors with task road_line, phase-B rebuild round 2,
 * 5 Oct 2026) runs a sprinkler line along the road and wets the buildings it protects (FF6, 7 Oct 2026; was
 * "clearing the verge and wetting it"): more than saw work, less than an attack.
 */
const ROAD_LINE_USE = 16;
/** Starting level at step 1 for the units already working before the handover. */
const AT_HANDOVER: Readonly<Record<string, number>> = { EK11: 64, EK12: 72, VPK: 58 };

const WATER: readonly { readonly id: string; readonly fi: string; readonly at: P }[] = [
  { id: "W1", fi: "Haukilampi (W1)", at: FEATURES.POND_W1 },
  { id: "W2", fi: "Lahdenkylän lampi (W2)", at: FEATURES.POND_W2 },
  { id: "W3", fi: "R3:n silta (Kotkanjoki), W3", at: FEATURES.BRIDGE_W3 },
];
/** Forest-road driving speed with a full tank, metres per minute, and the time to fill. */
const DRIVE_MPM = 450;
const FILL_MIN = 7;
/**
 * The shuttle: water aboard when full (m³), what one delivery takes (an 8 m³ folding basin at the line, so a delivery of 6 m³ fits it, and
 * the engine's tank topped up), and the minutes to fill the basin and top up the tank once there.
 */
const SHUTTLE_M3 = 14;
const DELIVERY_M3 = 6;
const BASIN_MIN = 3;
/** A crew this near the head whose tank runs dry before the basin is filled withdraws to the burned area. */
const HEAD_NEAR_M = 450;
/** Where the shuttle is at the handover: filling at W1. */
const SHUTTLE_HOME: P = FEATURES.POND_W1;

export interface WaterOutcome {
  /** Crews that ran low this step: their level when they radioed, the moment (offset in the step), and the minutes until the shuttle's basin. */
  readonly low: readonly { readonly unit: TrafficUnit; readonly pct: number; readonly atOffset: number; readonly waitMin: number }[];
  /** Units at or above 60 % after this step (for lateral water sharing). */
  readonly high: readonly { readonly unit: TrafficUnit; readonly pct: number }[];
  /** The shuttle's deliveries asked for this step: the request (offset in the step) and the delivery (simulation second). */
  readonly deliveries: readonly { readonly unit: TrafficUnit; readonly atOffset: number; readonly doneS: number }[];
}

export const hasTank = (id: string) => !NO_TANK.has(id);
/** Whether a unit is the water shuttle (`deployment.ts` `shuttle`). */
export const isShuttle = (id: string) => UNIT_PLAN[id]?.shuttle === true;
/** The water shuttle's call sign. */
export const SHUTTLE_ID = sortedKeys(UNIT_PLAN).find(isShuttle) ?? "EK13";
/** What a tank refilled from a basin names as its source ("Viimeksi täytetty klo … (EK13:n vesiajo)"). */
const FROM_SHUTTLE_FI = `${SHUTTLE_ID}:n vesiajo`;

/** The practice view's tanks at 12:00 (its water-supply log says 90 % and 85 % at 12:12). */
const PRACTICE_TANK_PCT: Readonly<Record<string, number>> = { EK11: 95, VPK: 90 };

/**
 * Puts each unit's tank level at the step's start into its map record (the hover card shows it,
 * 2 Oct 2026). Call after the step's traffic, so `startPct` is this step's. Units without a tank get null.
 */
export function withTankLevels(unitWork: Record<string, UnitWork>, state: TrafficState, practice: boolean): void {
  for (const id of sortedKeys(unitWork)) {
    const s = state.tanks.get(id);
    const pct = !hasTank(id) ? null : practice ? PRACTICE_TANK_PCT[id] ?? null : s ? s.startPct : null;
    unitWork[id] = { ...unitWork[id]!, waterPct: pct };
  }
}
const nearestWater = (p: P) => WATER.reduce((a, b) => (dist(b.at, p) < dist(a.at, p) ? b : a));
/** Roads wind round bogs and lakes: a drive is about this much longer than the straight line (fix pass 3, 18: Koivuoja → south of the origin is 2.6 km straight, ~4 km by R1 and the forest road). */
const ROAD_DETOUR = 1.4;
const driveS = (a: P, b: P) => Math.round(((dist(a, b) * ROAD_DETOUR) / DRIVE_MPM) * 60);
/** The longest wait for the shuttle on the south-east front before a farmer's slurry tanker is called instead (min). */
const SLURRY_IF_WAIT_MIN = 10;
/** From this simulation second (18.00, step 15) the shuttle works the south-east front from W2 (`afterJob`). */
const PHASE_B_SHUTTLE_S = 14 * 1200;

function refill(s: TankState, atS: number, fromFi: string, pct: number) {
  s.before = s.pct;
  s.prevRefill = s.lastRefill;
  s.lastRefill = { atS, fromFi };
  s.pct = pct;
}

function shuttleOf(state: TrafficState): ShuttleState {
  if (!state.shuttle) state.shuttle = { at: SHUTTLE_HOME, m3: SHUTTLE_M3, freeS: 0, legs: [], jobs: [], load: [{ atS: 0, m3: SHUTTLE_M3 }], fills: [] };
  return state.shuttle;
}

/** The shuttle drives to the water point and fills up; it is free again when full. */
function fillShuttle(sh: ShuttleState, fromS: number, w: (typeof WATER)[number]): void {
  const arrive = fromS + driveS(sh.at, w.at);
  sh.legs.push({ fromS, toS: arrive, from: sh.at, to: w.at });
  sh.jobs.push({ fromS, toS: arrive, kind: "drive_fill", what: w.fi });
  const full = arrive + FILL_MIN * 60;
  sh.jobs.push({ fromS: arrive, toS: full, kind: "fill", what: w.fi });
  sh.m3 = SHUTTLE_M3;
  sh.load.push({ atS: full, m3: SHUTTLE_M3 });
  sh.at = w.at;
  sh.freeS = full;
  sh.fills.push({ atS: full, pointFi: w.fi, pos: w.at });
}

/**
 * After a job: in phase A the shuttle fills up at the water point nearest the line it served when it cannot carry
 * another delivery, and waits there; from 18.00 (fix pass 4, 7 Oct 2026: it sat full at W1 from 18.23 to 20.00 while
 * the south-east front's crews ran dry) it fills up at W2 and waits at the R2 / forest-road junction, between the
 * Honkaharju and R2 lines it serves.
 */
function afterJob(sh: ShuttleState, t: number, lastTo: P): void {
  if (t < PHASE_B_SHUTTLE_S) { if (sh.m3 < DELIVERY_M3) fillShuttle(sh, t, nearestWater(lastTo)); return; }
  if (sh.m3 < SHUTTLE_M3) fillShuttle(sh, t, WATER.find((w) => w.id === "W2")!);
  const from = sh.freeS;
  const arrive = from + driveS(sh.at, FEATURES.R2_FR);
  sh.legs.push({ fromS: from, toS: arrive, from: sh.at, to: FEATURES.R2_FR });
  sh.jobs.push({ fromS: from, toS: arrive, kind: "drive_standby", what: "R2:n ja metsäautotien risteys" });
  sh.at = FEATURES.R2_FR;
  sh.freeS = arrive;
}

/** One delivery asked for at `reqS` to the vehicle at `to`: the simulation second the basin is full and the tank topped up. */
function deliver(sh: ShuttleState, reqS: number, to: P, unitId: string): number {
  if (sh.m3 < DELIVERY_M3) fillShuttle(sh, Math.max(reqS, sh.freeS), nearestWater(sh.at));
  const start = Math.max(reqS, sh.freeS);
  const arrive = start + driveS(sh.at, to);
  sh.legs.push({ fromS: start, toS: arrive, from: sh.at, to });
  sh.jobs.push({ fromS: start, toS: arrive, kind: "drive_basin", what: unitId });
  const done = arrive + BASIN_MIN * 60;
  sh.jobs.push({ fromS: arrive, toS: done, kind: "basin", what: unitId });
  sh.m3 -= DELIVERY_M3;
  sh.load.push({ atS: done, m3: sh.m3 });
  sh.at = to;
  sh.freeS = done;
  afterJob(sh, done, to);
  return done;
}

/**
 * What the shuttle is doing at simulation second `atS`, in words (fix pass 4: its AVL, answers and hover card follow its
 * actual run; it said "on a water run" while parked full at W1): filling, driving to a line, filling a line's basin, moving
 * to its stand-by point, or waiting there.
 */
export function shuttleDoing(state: TrafficState, atS: number): string {
  const j = shuttleJobAt(state, atS);
  if (!j) return L("Valmiudessa, odottaa seuraavaa vesitilausta.", "On stand-by, waiting for the next water call.");
  switch (j.kind) {
    case "fill": return L(`Täyttää säiliötä, ${j.what}; valmis klo ${hm(j.toS)}.`, `Filling the tank at ${pl(j.what)}; done at ${hm(j.toS)}.`);
    case "drive_fill": return L(`Vedensiirto: matkalla täyttämään, ${j.what}.`, `Water shuttle: on the way to fill up at ${pl(j.what)}.`);
    case "drive_basin": return L(`Vedensiirto: vesiajossa ${j.what}:n altaalle, perillä klo ${hm(j.toS)}.`, `Water shuttle: on a water run to ${j.what}'s basin, there at ${hm(j.toS)}.`);
    case "basin": return L(`Täyttää ${j.what}:n allasta linjalla.`, `Filling ${j.what}'s basin at the line.`);
    case "drive_standby": return L(`Siirtyy valmiuteen, ${j.what}.`, `Moving to stand-by at ${pl(j.what)}.`);
  }
}

/** What the shuttle is doing at simulation second `atS`, or null when it waits (full or with water aboard) for the next call. */
export function shuttleJobAt(state: TrafficState, atS: number): ShuttleState["jobs"][number] | null {
  return state.shuttle?.jobs.find((j) => atS >= j.fromS && atS < j.toS) ?? null;
}

/** When a delivery asked for at `reqS` would be done, without booking it (the shuttle as it stands). */
function estimateDelivery(sh: ShuttleState, reqS: number, to: P): number {
  let at = sh.at, free = sh.freeS;
  if (sh.m3 < DELIVERY_M3) { const w = nearestWater(sh.at); free = Math.max(reqS, free) + driveS(at, w.at) + FILL_MIN * 60; at = w.at; }
  return Math.max(reqS, free) + driveS(at, to) + BASIN_MIN * 60;
}

/** Where the shuttle is at simulation second `atS` (on a drive, where it has got to), site metres. */
export function shuttlePosition(state: TrafficState, atS: number): P {
  const sh = state.shuttle;
  if (!sh) return SHUTTLE_HOME;
  let at = SHUTTLE_HOME;
  for (const g of sh.legs) {
    if (g.fromS > atS) break;
    if (atS < g.toS) { const f = (atS - g.fromS) / Math.max(1, g.toS - g.fromS); return { x: g.from.x + (g.to.x - g.from.x) * f, y: g.from.y + (g.to.y - g.from.y) * f }; }
    at = g.to;
  }
  return at;
}

/** Whether the shuttle is filling at a water point at simulation second `atS` (its map task: filling, or carrying water). */
export function shuttleFillingAt(state: TrafficState, atS: number): boolean {
  return shuttleJobAt(state, atS)?.kind === "fill";
}

/** Water aboard the shuttle at simulation second `atS` (m³). */
function shuttleM3At(sh: ShuttleState, atS: number): number {
  let m3 = SHUTTLE_M3;
  for (const e of sh.load) { if (e.atS > atS) break; m3 = e.m3; }
  return m3;
}

/** Advances every unit's tank by one step and reports refills and low tanks. */
export function stepWater(inp: TrafficCycleInput, state: TrafficState, out: Out): WaterOutcome {
  const { draw } = out;
  const sh = shuttleOf(state);
  const low: { unit: TrafficUnit; pct: number; atOffset: number; waitMin: number }[] = [];
  const high: { unit: TrafficUnit; pct: number }[] = [];
  const deliveries: { unit: TrafficUnit; atOffset: number; doneS: number }[] = [];
  const t0 = stepStartS(inp.n), t1 = t0 + 1200;
  let slot = 0;
  const log = (u: TrafficUnit, atOffset: number, content: string) => out.push({ offsetS: Math.min(1195, atOffset), actor: "VESIHUOLTO", actor_type: "command", addressee: null,
    pos: u.pos, place: u.place, location: u.sector, event_type: "status", task: u.task, content, tier: "T2_system", channel: "system_log", nav: "vesi_reitit" });
  const deliveryLog = (u: TrafficUnit, atOffset: number, pct: number) => log(u, atOffset,
    L(`Vesihuoltoloki: ${SHUTTLE_ID} toi vettä ${u.id}:n linjalle: allas täytetty, säiliö ${pct} % klo ${hm(t0 + atOffset)}.`, `Water supply log: ${SHUTTLE_ID} brought water to ${u.id}'s line: basin filled, tank ${pct} % at ${hm(t0 + atOffset)}.`));
  /** A low crew waiting for the shuttle, kept until every unit's level is known, then served in the order they asked. */
  const requests: { u: TrafficUnit; s: TankState; track: { atS: number; pct: number }[]; reqAt: number; reqPct: number; perS: number; level0: number; useFrom: number; end: number }[] = [];
  for (const u of inp.units) {
    if (u.arrivedCycle > inp.n || !hasTank(u.id)) continue;
    const s: TankState = state.tanks.get(u.id) ?? { pct: inp.n === 1 ? AT_HANDOVER[u.id] ?? 100 : 100, lastRefill: null, prevRefill: null, before: null, startPct: 100, track: [], away: null };
    state.tanks.set(u.id, s);
    s.before = null;
    s.startPct = s.pct;
    s.away = null;
    const track: { atS: number; pct: number }[] = [{ atS: t0, pct: s.pct }];
    s.track = track;
    if (isShuttle(u.id)) {
      // The shuttle's own tank, for its hover card: the water aboard at the step's start.
      s.pct = s.startPct = Math.round((100 * shuttleM3At(sh, t0)) / SHUTTLE_M3);
      track.splice(0, 1, { atS: t0, pct: s.pct }, { atS: t1, pct: s.pct });
      continue;
    }
    const plan = UNIT_PLAN[u.id]!;
    const scheduled = plan.moves.find((m) => m.reason === "water" && m.cycle > inp.n && m.cycle <= inp.n + 2);
    if (u.task === "refill") {
      const at = 420 + Math.floor(draw.rnd() * 120);
      s.away = { fromS: t0, toS: t0 + at, pointFi: u.place ?? "vesipiste" };
      track.push({ atS: t0 + at, pct: s.pct });
      refill(s, t0 + at, u.place ?? "vesipiste", 100);
      track.push({ atS: t0 + at, pct: 100 }, { atS: t1, pct: 100 });
      const next = plan.moves.find((m) => m.cycle > inp.n);
      log(u, at, L(`Vesihuoltoloki: ${u.id} täytti säiliön, ${u.place ?? "vesipiste"}, klo ${hm(t0 + at)}.`, `Water supply log: ${u.id} filled its tank, ${pl(u.place ?? "vesipiste")}, at ${hm(t0 + at)}.`));
      out.push({ offsetS: at + 45, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type: "report", task: u.task,
        content: say(u.id, u.place, next && next.cycle === inp.n + 1
          ? L(`säiliö täynnä klo ${hm(t0 + at)}. Palaamme linjalle, perillä noin klo ${hm(t0 + 1200 + 90)}.`, `tank full at ${hm(t0 + at)}. Returning to the line, there at about ${hm(t0 + 1200 + 90)}.`)
          : L(`säiliö täynnä klo ${hm(t0 + at)}. Odotamme täällä uutta tehtävää.`, `tank full at ${hm(t0 + at)}. We are waiting here for a new task.`)), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" });
      continue;
    }
    // A basin the shuttle fills in this step for a request of an earlier step: the tank is topped up when it said.
    let useFrom = t0;
    const dueS = state.waterAsked.get(u.id);
    if (dueS !== undefined && dueS < t1) {
      state.waterAsked.delete(u.id);
      delete s.askedS;
      // At least a minute into the step: the water table at the boundary shows the level before the fill (fix pass 5: a tie at 14.40).
      const at = Math.max(60, dueS - t0);
      track.push({ atS: t0 + at, pct: s.pct });
      refill(s, t0 + at, FROM_SHUTTLE_FI, 88 + Math.floor(draw.rnd() * 10));
      track.push({ atS: t0 + at, pct: s.pct });
      useFrom = t0 + at;
      deliveryLog(u, at, s.pct);
    }
    const use = u.task === "road_line" ? ROAD_LINE_USE : USE[u.task] ?? 0;
    if (use === 0) { track.push({ atS: t1, pct: s.pct }); if (s.pct >= 60) high.push({ unit: u, pct: s.pct }); continue; }
    // The step's use runs evenly from `useFrom` to the step's end: the level at any moment is on that line.
    const level0 = s.pct;
    let end = Math.min(100, Math.max(4, level0 - Math.round((use + (draw.rnd() - 0.5) * 14) * (BIG_TANK.has(u.id) ? 0.5 : 1))));
    if (scheduled && scheduled.cycle === inp.n + 1) end = Math.min(end, 10 + Math.floor(draw.rnd() * 12));
    const perS = (level0 - end) / (t1 - useFrom);
    const levelAt = (t: number) => Math.round(level0 - perS * (t - useFrom));
    s.pct = end;
    // Low or plenty by the level after this step's refills (6 Oct 2026: a crew whose tank a slurry tanker had just
    // filled to 94 % asked its neighbour for water at 4 %, from the level before the fill).
    const classify = () => { if (s.pct >= 60) high.push({ unit: u, pct: s.pct }); };
    // A unit that just moved settles in first; one with a scripted refill coming, or a basin on its way, waits for it.
    if (scheduled || u.moved || s.pct >= 25 || state.waterAsked.has(u.id)) { track.push({ atS: t1, pct: end }); classify(); continue; }

    // Low with nothing scheduled: the crew radios when the tank is down to a quarter (at the earliest in its slot).
    const early = 70 + slot * 35 + Math.floor(draw.rnd() * 20);
    slot += 1;
    const quarterS = level0 <= 25 || perS <= 0 ? useFrom : useFrom + (level0 - 25) / perS;
    const reqAt = Math.min(1100, Math.max(early, Math.round(quarterS - t0)));
    const reqPct = levelAt(t0 + reqAt);
    // The south-east front's lines (phase B): the shuttle comes via W2 and R2, the tankers' water route (fix pass 3, N2); a
    // farmer's slurry tanker fills the tank only when the shuttle would be long.
    // Alternating (fix pass 4): a crew calling while the shuttle is out on another delivery gets the slurry tanker.
    if (inp.n >= 14 && u.sector === "L3-Etelä" && (sh.freeS > t0 + reqAt || (estimateDelivery(sh, t0 + reqAt, u.vehicle ?? u.pos) - (t0 + reqAt)) / 60 > SLURRY_IF_WAIT_MIN)) {
      const at = Math.min(1170, reqAt + 300 + Math.floor(draw.rnd() * 240));
      const before = levelAt(t0 + at);
      track.push({ atS: t0 + at, pct: before });
      s.pct = before;
      refill(s, t0 + at, "viljelijän lietevaunu", 84 + Math.floor(draw.rnd() * 12));
      const full = s.pct;
      track.push({ atS: t0 + at, pct: full });
      s.pct = Math.max(4, Math.round(full - perS * (t1 - t0 - at)));
      track.push({ atS: t1, pct: s.pct });
      out.push({ offsetS: at + 20, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type: "report", task: u.task,
        // The tanker brings more than an engine's ~3 m³ tank holds: the rest goes into the 8 m³ basin, so at most 8 (fix pass 3, 19; pass 6).
        content: say(u.id, u.place, ((m3: number) => L(`vettä oli enää ${before} %, Lahdenkylän viljelijän lietevaunu toi ${m3} kuutiota altaaseen ja täytti säiliön. Säiliö nyt ${full} %.`, `water was down to ${before} %, a Lahdenkylä farmer's slurry tanker brought ${m3} cubic metres into the basin and filled the tank. Tank now ${full} %.`))(6 + Math.floor(draw.rnd() * 3))), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" });
      log(u, at, L(`Vesihuoltoloki: lietevaunu täydensi ${u.id}:n säiliön (${full} %) klo ${hm(t0 + at)}.`, `Water supply log: a slurry tanker filled ${u.id}'s tank (${full} %) at ${hm(t0 + at)}.`));
      classify();
      continue;
    }
    requests.push({ u, s, track, reqAt, reqPct, perS, level0, useFrom, end });
  }

  // The shuttle serves the step's requests in the order the crews radioed.
  requests.sort((a, b) => a.reqAt - b.reqAt || (a.u.id < b.u.id ? -1 : a.u.id > b.u.id ? 1 : 0));
  for (const r of requests) {
    const { u, s, track, reqAt, reqPct, perS, level0, useFrom } = r;
    const reqS = t0 + reqAt;
    const doneS = deliver(sh, reqS, u.vehicle ?? u.pos, u.id);
    const waitMin = Math.max(1, Math.round((doneS - reqS) / 60));
    const left = perS > 0 ? Math.max(1, Math.round((reqPct - 5) / perS / 60)) : 20;
    // The tank will not last until the basin comes (fix pass 4, M2): the crew says how it bridges the gap.
    const short = left < waitMin
      ? { fi: " Säästämme vettä ja pidämme reunaa käsityökaluin, kunnes allas tulee.", en: " We are saving water and holding the edge with hand tools until the basin arrives." }
      : { fi: "", en: "" };
    out.push({ offsetS: reqAt, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type: "request", task: u.task,
      content: out.fresh([
        say(u.id, u.place, L(`vettä säiliössä enää noin ${reqPct} %. ${SHUTTLE_ID} tuo vettä altaaseen linjan päähän, perillä noin klo ${hm(doneS)}. Jatkamme linjalla.${short.fi}`, `only about ${reqPct} % water left in the tank. ${SHUTTLE_ID} is bringing water to a basin at the end of our line, there at about ${hm(doneS)}. We carry on with the line.${short.en}`)),
        say(u.id, u.place, L(`vesi loppumassa (${reqPct} %). Pyysimme ${SHUTTLE_ID}:lta vesiajon altaaseen, arvio klo ${hm(doneS)}.${short.fi}`, `water running out (${reqPct} %). We have asked ${SHUTTLE_ID} for a basin delivery, estimate ${hm(doneS)}.${short.en}`)),
        say(u.id, u.place, L(`säiliö ${reqPct} %, riittää noin ${left} min. ${SHUTTLE_ID} tulossa altaan kanssa noin ${waitMin} min päästä.${short.fi}`, `tank ${reqPct} %, enough for about ${left} min. ${SHUTTLE_ID} is coming with the basin in about ${waitMin} min.${short.en}`)),
      ]), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" });
    // Dry before the basin is filled: the level stays at the tank's floor; near the head the crew pulls back (LCES).
    const dryS = perS > 0 ? useFrom + (level0 - 4) / perS : Infinity;
    if (dryS < Math.min(doneS, t1)) {
      track.push({ atS: Math.round(dryS), pct: 4 });
      if (u.onEdge && dist(u.pos, inp.head) < HEAD_NEAR_M) out.push({ offsetS: Math.min(1195, Math.round(dryS - t0) + 15), actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type: "warning", task: u.task,
        content: say(u.id, u.place, L(`vesi loppui klo ${hm(Math.round(dryS))}, letkulinja tyhjä. Vetäydymme palaneelle alalle, kunnes ${SHUTTLE_ID} on täyttänyt altaan.`, `the water ran out at ${hm(Math.round(dryS))}, the hose line is dry. We are pulling back into the burned area until ${SHUTTLE_ID} has filled the basin.`)), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" });
    }
    if (doneS < t1 - 10) {
      const before = Math.max(4, Math.round(level0 - perS * (doneS - useFrom)));
      track.push({ atS: doneS, pct: before });
      s.pct = before;
      refill(s, doneS, FROM_SHUTTLE_FI, 86 + Math.floor(draw.rnd() * 12));
      const full = s.pct;
      track.push({ atS: doneS, pct: full });
      s.pct = Math.max(4, Math.round(full - perS * (t1 - doneS)));
      track.push({ atS: t1, pct: s.pct });
      deliveryLog(u, doneS - t0, full);
    } else {
      track.push({ atS: t1, pct: r.end });
      state.waterAsked.set(u.id, doneS);
      s.askedS = reqS;
    }
    if (s.pct >= 60) high.push({ unit: u, pct: s.pct });
    low.push({ unit: u, pct: reqPct, atOffset: reqAt, waitMin });
    deliveries.push({ unit: u, atOffset: reqAt, doneS });
  }
  // The shuttle's fills at the water points that fall in this step (a fill started late in a step is logged in the next).
  for (const f of sh.fills.filter((x) => x.atS >= t0 && x.atS < t1)) {
    out.push({ offsetS: Math.min(1195, f.atS - t0), actor: "VESIHUOLTO", actor_type: "command", addressee: null, pos: f.pos, place: null, location: null, event_type: "status", task: null,
      content: L(`Vesihuoltoloki: ${SHUTTLE_ID} täytti säiliönsä, ${f.pointFi}, klo ${hm(f.atS)} (${SHUTTLE_M3} m³).`, `Water supply log: ${SHUTTLE_ID} filled its tank, ${pl(f.pointFi)}, at ${hm(f.atS)} (${SHUTTLE_M3} m³).`),
      tier: "T2_system", channel: "system_log", nav: "vesi_reitit" });
  }

  return { low, high, deliveries };
}

/** The tank's level at simulation second `atS` on this step's line (`TankState.track`); at a refill's moment, the full level. */
function levelOn(s: TankState, atS: number): number {
  const t = s.track;
  if (t.length === 0) return s.pct;
  let k = -1;
  for (let i = 0; i < t.length; i++) if (t[i]!.atS <= atS) k = i;
  if (k < 0) return t[0]!.pct;
  if (k === t.length - 1) return t[k]!.pct;
  const a = t[k]!, b = t[k + 1]!;
  return Math.round(a.pct + ((b.pct - a.pct) * (atS - a.atS)) / (b.atS - a.atS));
}

/** A unit's tank level at simulation second `atS` of this step (percent), or null for a unit without a tank record. */
export function tankLevelAt(state: TrafficState, id: string, atS: number): number | null {
  const s = state.tanks.get(id);
  return s ? levelOn(s, atS) : null;
}

/** Where the unit's vehicle is filling at simulation second `atS` (its water point, Finnish), or null when it is not away for water. */
export function vehicleFilling(state: TrafficState, id: string, atS: number): string | null {
  const a = state.tanks.get(id)?.away;
  return a && atS >= a.fromS && atS < a.toS ? a.pointFi : null;
}

/** What the crew answers about its water when asked at simulation second `atS` (T3). */
export function waterAnswer(state: TrafficState, id: string, atS: number): string {
  // No lake or brook by its lines (positions audit item 13): the pump draws from a portable tank the off-road vehicle keeps filled.
  if (id === "EK14") return L("Moottoriruisku imee kannettavasta altaasta, maastoauto pitää altaan täynnä.", "The portable pump draws from a portable tank; the off-road vehicle keeps it full.");
  if (id.startsWith("UGV")) return "";
  if (isShuttle(id)) {
    const m3 = state.shuttle ? shuttleM3At(state.shuttle, atS) : SHUTTLE_M3;
    return shuttleJobAt(state, atS)?.kind === "fill" ? shuttleDoing(state, atS) : `${shuttleDoing(state, atS)} ${L(`Vettä kyydissä noin ${m3} m³.`, `About ${m3} m³ of water aboard.`)}`;
  }
  const s = state.tanks.get(id);
  if (!s) return "";
  // A refill later in this step, or a basin the shuttle fills after the step's end.
  const pending = (s.lastRefill !== null && s.lastRefill.atS > atS) || (s.askedS !== undefined && s.askedS <= atS);
  const pct = levelOn(s, atS);
  const last = pending ? s.prevRefill : s.lastRefill;
  // Revision (al): a source whose name carries its own brackets ("R3:n silta (Kotkanjoki)") follows a comma, not a second pair of brackets.
  const from = (fi: string, en: string) => (fi.includes("(") ? L(`, ${fi}.`, `, ${en}.`) : L(` (${fi}).`, ` (${en}).`));
  const when = last ? L(` Viimeksi täytetty klo ${hm(last.atS)}`, ` Last filled at ${hm(last.atS)}`) + from(last.fromFi, pl(last.fromFi)) : "";
  return L(`Vettä säiliössä noin ${pct} %.`, `About ${pct} % water in the tank.`) + (pending ? L(" Täyttö tulossa.", " A refill is on its way.") : "") + when;
}
