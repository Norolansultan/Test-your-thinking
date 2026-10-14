/**
 * Game mode: the loop's mutable runtime — one record per unit and the shared context the behaviours
 * work on. Nothing here leaves `sim/`; `game.ts` turns it into the contract's read-only `GameState`.
 */

import type { FireSim, GameScenario, GameWorld, Order, Unit, UnitKind, UnitStatus, Weather, XY } from "../contracts.js";
import type { FireIndex } from "./fire-index.js";
import type { GameDeps } from "./ports.js";
import type { RadioLog, Say } from "./radio.js";
import type { UnitSpec } from "./unit-specs.js";

/** One leg of a planned movement, travelled at a fixed speed. */
export interface Leg { readonly to: XY; readonly speedMs: number }

export type Phase =
  | "none"
  | "approach" | "engage" | "standby" // attack
  | "to_anchor" | "laying" | "holding" // hose line
  | "to_start" | "cutting" // fire break
  | "to_target" | "transfer" // shuttle
  | "to_orbit" | "orbit" // recon
  | "to_scoop" | "scooping" | "to_drop" // drop
  | "to_asset" | "protecting"
  | "done";

/** Logistics that interrupt an order and hand it back: a water run or an aircraft's battery / fuel. */
export type Logistics =
  | { readonly kind: "refill"; readonly waterPointId: string; phase: "to_water" | "filling" }
  | { readonly kind: "recharge"; phase: "to_base" | "charging"; untilS: number };

export interface BreakCell { readonly cell: number; readonly along: number }

export interface UnitRt {
  readonly id: string;
  readonly kind: UnitKind;
  readonly spec: UnitSpec;
  /** Index in the scenario's unit list (stable ordering and hash input). */
  readonly index: number;
  readonly arriveAtS: number;
  /** Where it appears (and where a released unit leaves the map). */
  readonly entry: XY;
  pos: XY;
  status: UnitStatus;
  order: Order | null;
  waterL: number;
  energyPct: number;
  harm: number;
  hoseLine: XY[] | null;
  etaS: number | null;

  legs: Leg[];
  dest: XY | null;
  phase: Phase;
  /** Generic behaviour target (cell being attacked) and where the crew stands to work it. */
  workCell: number;
  workAt: XY | null;
  /** The task a player's refill order interrupted; resumed when the tank is full. */
  prevOrder: Order | null;
  hoseAnchor: XY | null;
  hoseTip: XY | null;
  hoseNatural: boolean;
  /** Cells under the laid hose (cached). */
  hoseCells: readonly number[] | null;
  breakCells: BreakCell[] | null;
  breakNext: number;
  breakProgressM: number;
  orbitAngle: number;
  phaseUntilS: number;
  logistics: Logistics | null;
  retreatTo: XY | null;
  retreatUntilS: number;
  airborne: boolean;
  recalled: boolean;
  casualty: boolean;
  onSceneSinceS: number;
  lastSitrepS: number;
  /** One-shot radio flags. */
  readonly said: Set<string>;
}

export interface Ctx {
  readonly scenario: GameScenario;
  readonly world: GameWorld;
  readonly deps: GameDeps;
  readonly fire: FireSim;
  readonly fireIdx: FireIndex;
  readonly radio: RadioLog;
  readonly seed: number;
  readonly units: UnitRt[];
  readonly unitById: Map<string, UnitRt>;
  tS: number;
  weather: Weather;
  powerLineLive: boolean;
  /** Assets that stand protected until this time (sprinklers, wetting), by asset id. */
  readonly protectedUntil: Map<string, number>;
  /** Assets that have burned. */
  readonly burnedAssets: Set<string>;
}

/** A unit's message: its callsign, its net, the sender's prefix on the text. */
export function unitSay(u: UnitRt, s: Omit<Say, "from" | "room" | "text"> & { readonly text: Say["text"]; readonly room?: Say["room"] }): Say {
  const room = s.room ?? (u.spec.air ? "air" : "ground");
  const base = { from: u.id, room, text: { fi: `${u.id}: ${s.text.fi}`, en: `${u.id}: ${s.text.en}` }, priority: s.priority, key: s.key };
  return s.at === undefined ? base : { ...base, at: s.at };
}

export function say(ctx: Ctx, m: Say): boolean {
  return ctx.radio.say(ctx.tS, m);
}

/** True while the unit is on the map and can act. */
export function active(u: UnitRt): boolean {
  return u.status !== "en_route" && u.status !== "out_of_action";
}

/** The read-only `Unit` the contract exposes. */
export function toUnit(u: UnitRt): Unit {
  return {
    id: u.id,
    callsign: u.id,
    kind: u.kind,
    pos: { x: u.pos.x, y: u.pos.y },
    status: u.status,
    order: u.order,
    waterL: Math.round(u.waterL * 10) / 10,
    waterMaxL: u.spec.waterL,
    energyPct: Math.round(u.energyPct * 10) / 10,
    harm: Math.round(u.harm * 1000) / 1000,
    hoseLine: u.hoseLine === null ? null : u.hoseLine.map((p) => ({ x: p.x, y: p.y })),
    etaS: u.etaS,
  };
}

/** Resets the behaviour state when a new order takes over. An aircraft's battery swap or refuel is kept. */
export function resetBehaviour(u: UnitRt): void {
  const keep = u.logistics !== null && u.logistics.kind === "recharge" ? u.logistics : null;
  u.legs = [];
  u.dest = null;
  u.phase = "none";
  u.workCell = -1;
  u.workAt = null;
  u.hoseAnchor = null;
  u.hoseTip = null;
  u.hoseNatural = false;
  u.hoseCells = null;
  u.hoseLine = null;
  u.breakCells = null;
  u.breakNext = 0;
  u.breakProgressM = 0;
  u.phaseUntilS = 0;
  u.logistics = keep;
  u.retreatTo = null;
  u.retreatUntilS = -1;
  if (u.status !== "en_route" && u.status !== "out_of_action") u.etaS = null;
}
