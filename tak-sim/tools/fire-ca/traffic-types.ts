/**
 * Types shared by the traffic corpus generator (`traffic.ts`) and its parts: drones
 * (`traffic-drones.ts`), water (`traffic-water.ts`), lateral traffic and requests
 * (`traffic-lateral.ts`). Positions are site metres (x east, y north of the ignition).
 */

import type { ActorType, AirKind, EventType, NavCategoryId, Tier, UnitTask } from "../../app/scenario/types.js";
import type { P } from "./deployment.js";
import type { FireProbe } from "./traffic-fire.js";
import type { Draw, LandCoverFi } from "./traffic-text.js";

export interface TrafficUnit {
  readonly id: string;
  readonly pos: P; // where it works (crew), site metres
  /** Where its vehicle is parked (`placement.ts`; on the crew's side of the fire), site metres; null for the robot and units at a point. */
  readonly vehicle: P | null;
  /** How far its vehicle was moved this step while the crew held its stretch (m; 0 when it stayed or the unit moved). */
  readonly vehicleMovedM: number;
  readonly task: UnitTask;
  readonly hoseM: number | null;
  readonly onEdge: boolean;
  /** Reason of this step's move, if it moved. */
  readonly moved: string | null;
  readonly arrivedCycle: number;
  /** Stale report (AVL drift, dead zone): the unit is not heard from this step. */
  readonly silent: boolean;
  /** Its deployment (`deployment.ts` anchor) and the place and sector that names (`traffic-places.ts`). */
  readonly anchor: string | null;
  readonly place: string | null;
  readonly sector: string | null;
  /**
   * Where the vehicle-location log has the unit later in the step when its map report is stale on a move step (M8, review
   * fixes (ah)): the map at the step's start still shows the old place (AVL lag), the AVL record after the move the new one.
   */
  readonly avl?: { readonly pos: P; readonly place: string | null; readonly sector: string | null; readonly task: UnitTask };
}

export interface TrafficAircraft {
  readonly id: string;
  readonly kind: AirKind;
  readonly flight: string;
  readonly target: P;
  /** Whether its camera covers a site point this step (drones; always false for the others). */
  readonly covers: (p: P) => boolean;
}

/**
 * The step in which the rekindled front by the point of origin is first on the reported map (V10,
 * 17:20; `site-scenario.json` step 13 `reportedDetached`, checked by `test/scenario/directive.spec.ts`).
 * Phase-B corpus rebuild (4 Oct 2026, SPEC/18 revision (t)): in this step the crews on the new front
 * radio it qualitatively (a new small fire, they are on it) and the drones' size measurements of it
 * are recorded, not pushed (`traffic.ts`, `traffic-drones.ts`), so that its size has to be looked up.
 */
export const NEW_FRONT_STEP = 13;

/**
 * The steps whose new separate fire is measured for the record only (phase-B rebuild round 2, 5 Oct
 * 2026: existence pushed, deciding quantity recorded, SPEC/27 §7.1): `NEW_FRONT_STEP` (V10, the
 * rekindle by the origin) and 19 (V14, the origin's old west edge flaring up again, `scenario-18.ts`).
 * A drone's thermal image or perimeter mapping that finds a new separate fire in these steps goes to
 * the sensor feed, not the radio; a crew on such a fire radios it qualitatively (`traffic.ts`).
 */
export const NEW_FIRE_STEPS: ReadonlySet<number> = new Set([NEW_FRONT_STEP, 19]);

export interface Wind { readonly fromDeg: number; readonly meanMs: number; readonly gustMs: number }

export interface TrafficCycleInput {
  readonly n: number;
  readonly wind: Wind;
  /** The previous step's wind (for "the wind turned at 16.00"); null at step 1. */
  readonly windPrev: Wind | null;
  readonly observedRateMpm: number; // head rate over the previous 20 minutes, as crews saw it
  readonly headingDeg: number;
  readonly head: P;
  readonly areaHa: number; // reported
  readonly lengthM: number; // reported: the footprint's greatest extent (`reportedExtent`)
  readonly units: readonly TrafficUnit[];
  readonly aircraft: readonly TrafficAircraft[];
  readonly spotFires: readonly { readonly pos: P; readonly confirmed: boolean; readonly callsign: string }[];
  /** Drone thermal detections under 10 min old, site metres. */
  readonly detections: readonly P[];
  readonly fire: FireProbe;
  readonly landCoverAt: (p: P) => LandCoverFi;
  readonly placeNear: (p: P) => string | null;
  readonly roadNear: (p: P) => { readonly cls: string; readonly distM: number };
  /** Values at risk with people (SPEC/18 §9): named settlements on the map. */
  readonly settlements: readonly { readonly fi: string; readonly at: P }[];
}

/** An event before it is placed on the map (site metres); site-export turns `pos` into lat/lon. */
export interface TrafficEvent {
  readonly offsetS: number;
  readonly actor: string;
  readonly actor_type: ActorType;
  readonly addressee: string | null;
  readonly pos: P | null;
  /** Named place and sector when they come from a deployment, not from the position. */
  readonly place?: string | null;
  readonly location?: string | null;
  readonly event_type: EventType;
  readonly task: string | null;
  readonly content: string;
  readonly tier: Tier;
  readonly channel: "radio_command" | "radio_lateral" | "sensor_feed" | "ask_unit" | "system_log";
  readonly nav: NavCategoryId;
}

export interface TankState {
  pct: number;
  /** Simulation second of the last refill and where it came from (Finnish), for the crew's answers. */
  lastRefill: { readonly atS: number; readonly fromFi: string } | null;
  /** The refill before the last one (what a crew asked before the last refill names). */
  prevRefill: { readonly atS: number; readonly fromFi: string } | null;
  /** The level just before this step's refill; null when the tank was not refilled this step. */
  before: number | null;
  /** The level at the start of this step. */
  startPct: number;
  /**
   * This step's level over time (simulation seconds): a piecewise-linear line through these points, a
   * refill being two points at one moment (review 6 Oct 2026, A4: a crew asked mid-step answered the
   * level after the whole step's use, 69 of 116 answers ten points or more off the hover card).
   */
  track: { readonly atS: number; readonly pct: number }[];
  /** The vehicle away for water this step (simulation seconds), and where it fills; null when it is not. */
  away: { readonly fromS: number; readonly toS: number; readonly pointFi: string } | null;
  /** When the crew asked for the shuttle's basin that is filled only after this step (simulation second); unset otherwise. */
  askedS?: number;
}

/**
 * The water shuttle (fix pass 2, 7 Oct 2026, `deployment.ts` EK13): a tanker carrying water from the water
 * points to portable basins at the lines (`traffic-water.ts`). Times are simulation seconds.
 */
export interface ShuttleState {
  /** Where it is when it is next free, site metres. */
  at: P;
  /** Water aboard (m³) when it is next free. */
  m3: number;
  /** When it is free for the next delivery. */
  freeS: number;
  /** Its drives so far (stops lie between them), for where the map draws it at a step's start. */
  readonly legs: { readonly fromS: number; readonly toS: number; readonly from: P; readonly to: P }[];
  /** Water aboard over time (each change, in order), for the crew's answer and the hover card. */
  readonly load: { readonly atS: number; readonly m3: number }[];
  /** What it does when (fix pass 4): driving to fill, filling, driving to a line, filling the line's basin, moving to stand-by. */
  readonly jobs: { readonly fromS: number; readonly toS: number; readonly kind: "drive_fill" | "fill" | "drive_basin" | "basin" | "drive_standby"; readonly what: string }[];
  /** Its fills at a water point (each logged in the step it falls in, which may be after the delivery that started it). */
  readonly fills: { readonly atS: number; readonly pointFi: string; readonly pos: P }[];
}

/** Memory across steps: tank levels, water deliveries, once-only topics (drone batteries: `app/scenario/drone-battery.ts`). */
export interface TrafficState {
  readonly tanks: Map<string, TankState>;
  /** Units whose basin the shuttle fills only after the step's end (id → simulation second of the delivery). */
  readonly waterAsked: Map<string, number>;
  /** The water shuttle; set by the first step's water (`traffic-water.ts`). */
  shuttle: ShuttleState | null;
  /** Once-only topics already said ("relief:EK11", "food:VPK"), so a crew does not repeat a request every step. */
  readonly said: Set<string>;
  /** How often each wording (numbers, unit ids and directions masked) has been used today (`Out.fresh`). */
  readonly wordings: Map<string, number>;
}

export function newTrafficState(): TrafficState {
  return { tanks: new Map(), waterAsked: new Map(), shuttle: null, said: new Set(), wordings: new Map() };
}

/**
 * When in the step an event without a fixed time goes out: `early` in the first minutes (arrivals,
 * moves), `main` across the step (reports), `feed` across the step (sensor and system lines),
 * `ask` and `lateral` across the step's second part, `late` near its end.
 */
export type Lane = "early" | "main" | "feed" | "ask" | "lateral" | "late";

/** The step's event sink: spreads events through the step and keeps the seeded draw. */
export interface Out {
  readonly draw: Draw;
  push(e: Omit<TrafficEvent, "offsetS"> & { offsetS?: number }, lane?: Lane): void;
  /**
   * One of `xs`, preferring a wording not yet used this step (compared without numbers and unit
   * ids), so that crews seeing the same thing do not send the same sentence (review item 5).
   */
  fresh(xs: readonly string[]): string;
  /**
   * Like `fresh`, but each template of `topic` (by its index in `xs`) is said at most `MAX_REPEATS`
   * times in the day; once all are used up, null — the routine chatter is then not said.
   */
  capped(topic: string, xs: readonly string[]): string | null;
  /**
   * A decision made on the text (a filter over Finnish words): computed in the Finnish run and
   * replayed in the English one, so both runs keep the same events (`Tape`).
   */
  same<T>(f: () => T): T;
}

/**
 * The choices of one step's Finnish run (`fresh`, `capped`, `same`), replayed in its English run:
 * the draws are seeded and identical, so with the choices replayed the English events are the
 * Finnish events one for one — same ids, times, actors and tiers, other words.
 */
export interface Tape {
  readonly mode: "record" | "replay";
  readonly values: unknown[];
  pos: number;
}
export const recordTape = (): Tape => ({ mode: "record", values: [], pos: 0 });
export const replayTape = (t: Tape): Tape => ({ mode: "replay", values: t.values, pos: 0 });
