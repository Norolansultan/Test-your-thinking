/**
 * Game mode, live fire model (contracts.ts `FireSim`): an elliptical-wave, rate-of-spread cellular
 * automaton on the 25 m fuel grid.
 *
 * Every burning cell sends a front toward each of its 16 neighbours (8 + knight moves) at that
 * direction's rate (ros.ts: base · wind ellipse · slope · moisture · crown). Each source keeps the
 * distance its front has travelled toward each neighbour; a neighbour ignites when the first front
 * reaches it — a minimum-travel-time front in time-varying weather, the overshoot carried into the
 * new cell's first step so the rate does not depend on the step length. A burning cell stays alight
 * while it still drives a front into an unburned neighbour, and for at least its fuel's residence
 * time; then it smoulders (humus, peat) or burns out. Smouldering edges may flare up again in dry
 * wind. Crowning heads, strong surface heads and fires beside brooks throw embers (spotting.ts).
 * Noncombustible cells (roads, water, breaks) stop the front: diagonal and knight moves never pass
 * between or through them.
 *
 * Only active cells are visited (burning, smouldering, wet), so a step costs O(front), not O(grid).
 * Deterministic: integer hashing for randomness, virtual time only (SPEC/00 §3 I1–I2).
 */

import { CELL, type FireSim, type FireStepReport, type GameWorld, type Weather, type XY } from "../contracts.js";
import * as cells from "./cells.js";
import * as fuels from "./fuels.js";
import * as ros from "./ros.js";
import { SlotPool } from "./slots.js";
import { SALT, SURFACE_SPOT_MIN_KWM, launchEmbers, type EmberContext } from "./spotting.js";
import { SOAK_L_PER_M2, waterNeedL, waterOutcome } from "./water.js";

export type FireWorld = Pick<GameWorld, "grid" | "fuel" | "elevation">;

export interface FireSimOptions {
  /** Spotting, brook leaks and rekindles (hashed randomness). Off for forecasts. Default true. */
  readonly randomEvents?: boolean;
  readonly startS?: number; // the fire's clock at creation, s (default 0; negative for a scenario's pre-burn)
}

/** A cell burns at most this long, s, even while its front creeps on (it then smoulders or burns out). */
export const MAX_FLAME_S = 3 * 3600;
/** Rekindles need drier air and more wind than this. */
export const REKINDLE_MAX_RH = 35;
export const REKINDLE_MIN_WIND_MS = 6;

const { noFuel: NO_FUEL, unburned: UNBURNED, burning: BURNING, smouldering: SMOULDERING, burnedOut: BURNED_OUT, extinguished: EXTINGUISHED } = CELL;

const F_BURN_LIST = 1;
const F_SMOULDER_LIST = 2;
const F_WET_LIST = 4;
const F_CROWN = 8;
const F_EDGE = 16; // smouldering with an unburned 8-neighbour: may flare up

// Hot-loop bindings, read once (a bundler's or test runner's module wrapper can turn every use of an
// imported binding into a property lookup).
const { K, NB_KIND, onGrid } = cells;
const { FUEL_PROPS, HEAT_KJ_KG, fuelProps } = fuels;
const { MIN_ROS_M_MIN, wetFactor, hash01, prepareWeather } = ros;
const SURFACE_SPOT_MIN = SURFACE_SPOT_MIN_KWM;

/** The live fire. Construct with `createFireSim`. */
export class LiveFireSim implements FireSim {
  readonly state: Uint8Array;
  readonly intensity: Float32Array;
  readonly wetness: Float32Array;
  readonly ignitedAtS: Float32Array;

  private readonly world: FireWorld;
  private readonly seed: number;
  private readonly randomEvents: boolean;
  private readonly cellM: number;
  private readonly soakL: number;
  private readonly nb: cells.NeighbourIndex;
  private readonly nearBrook: Uint8Array;
  private readonly embers: EmberContext;

  private t = 0;
  private stepIndex = 0;
  private readonly smoulderEndS: Float32Array;
  private readonly flags: Uint8Array;
  private readonly counts = new Int32Array(6);
  private burning: number[] = [];
  private smouldering: number[] = [];
  private wetList: number[] = [];
  /** Slot of each burning cell in `slots` (−1 when not burning). */
  private readonly slotOf: Int32Array;
  private readonly slots: SlotPool;
  /** Candidate ignitions within a step: cell → earliest arrival (insertion order is deterministic). */
  private readonly cand = new Map<number, number>();

  constructor(world: FireWorld, seed: number, options: FireSimOptions = {}, from?: LiveFireSim) {
    const { cols, rows, cellM } = world.grid;
    const n = cols * rows;
    if (world.fuel.length !== n || world.elevation.length !== n) throw new Error("createFireSim: fuel/elevation size does not match the grid");
    this.world = world;
    this.seed = seed | 0;
    this.randomEvents = options.randomEvents ?? true;
    this.cellM = cellM;
    this.soakL = SOAK_L_PER_M2 * cellM * cellM;
    this.nb = from ? from.nb : cells.neighbourIndex(world.grid);
    this.nearBrook = from ? from.nearBrook : cells.brookMask(world.grid, world.fuel);
    if (from) {
      this.state = from.state.slice();
      this.intensity = from.intensity.slice();
      this.wetness = from.wetness.slice();
      this.ignitedAtS = from.ignitedAtS.slice();
      this.smoulderEndS = from.smoulderEndS.slice();
      this.flags = from.flags.slice();
      this.counts.set(from.counts);
      this.burning = from.burning.slice();
      this.smouldering = from.smouldering.slice();
      this.wetList = from.wetList.slice();
      this.slotOf = from.slotOf.slice();
      this.slots = from.slots.clone();
      this.t = from.t;
      this.stepIndex = from.stepIndex;
    } else {
      this.state = new Uint8Array(n);
      this.intensity = new Float32Array(n);
      this.wetness = new Float32Array(n);
      this.ignitedAtS = new Float32Array(n).fill(-1);
      this.smoulderEndS = new Float32Array(n);
      this.flags = new Uint8Array(n);
      this.slotOf = new Int32Array(n).fill(-1);
      this.slots = new SlotPool();
      this.t = Number.isFinite(options.startS) ? options.startS! : 0;
      for (let i = 0; i < n; i++) {
        const s = fuelProps(world.fuel[i]!).burnable ? UNBURNED : NO_FUEL;
        this.state[i] = s;
        this.counts[s]!++;
      }
    }
    this.embers = { grid: world.grid, fuel: world.fuel, state: this.state, wetness: this.wetness, seed: this.seed, unburned: UNBURNED };
  }

  get tS(): number {
    return this.t;
  }

  /** Cell size of the grid, m. */
  get cellSizeM(): number {
    return this.cellM;
  }

  /**
   * Area the fire has reached, hectares (as `FireStepReport.burnedHa`): burning, smouldering, burned out, and
   * extinguished — a cell is only ever extinguished after it caught fire, so a fire put out early still counts
   * the ground it burned (integration review, 14 Oct 2026).
   */
  get burnedHa(): number {
    return ((this.counts[BURNING]! + this.counts[SMOULDERING]! + this.counts[BURNED_OUT]! + this.counts[EXTINGUISHED]!) * this.cellM * this.cellM) / 10_000;
  }

  /** Cells in each `CellState`, indexed by state. */
  stateCounts(): readonly number[] {
    return Array.from(this.counts);
  }

  /** True when the cell's fire ran in the crowns in the last step. */
  isCrowning(cell: number): boolean {
    return (this.flags[cell]! & F_CROWN) !== 0;
  }

  /** A copy that runs on independently (the live sim is untouched). */
  clone(options: FireSimOptions = { randomEvents: this.randomEvents }): LiveFireSim {
    return new LiveFireSim(this.world, this.seed, options, this);
  }

  // ---------------------------------------------------------------------------------------------
  // FireSim
  // ---------------------------------------------------------------------------------------------

  ignite(cell: number): boolean {
    if (!(cell >= 0 && cell < this.state.length) || this.state[cell] !== UNBURNED) return false;
    this.igniteAt(cell, this.t, 0);
    return true;
  }

  step(dtS: number, weather: Weather): FireStepReport {
    const ignited: number[] = [];
    const burnedOut: number[] = [];
    const spotFires: { cell: number; fromCell: number }[] = [];
    const rekindled: number[] = [];
    if (!(dtS > 0)) return this.report(ignited, burnedOut, spotFires, rekindled);
    const t0 = this.t;
    const t1 = t0 + dtS;
    const idx = this.stepIndex;
    const sw = prepareWeather(weather); // validates before anything changes
    this.dry(sw, dtS);

    const ending: number[] = [];
    const spots: number[] = []; // (cell, fromCell) pairs
    const list = this.burning;
    this.burning = [];
    for (const i of list) {
      if (this.state[i] !== BURNING) {
        this.flags[i]! &= ~F_BURN_LIST;
        continue;
      }
      if (this.advanceSource(i, sw, t0, t1, dtS, idx, spots)) ending.push(i);
      else this.burning.push(i);
    }
    for (const [n, tc] of this.cand) {
      if (this.state[n] !== UNBURNED) continue;
      this.igniteAt(n, tc, t1 - tc);
      ignited.push(n);
    }
    this.cand.clear();
    for (let s = 0; s < spots.length; s += 2) {
      const cell = spots[s]!;
      if (this.state[cell] !== UNBURNED) continue;
      this.igniteAt(cell, t1, 0);
      ignited.push(cell);
      spotFires.push({ cell, fromCell: spots[s + 1]! });
    }
    this.advanceSmouldering(sw, t1, dtS, idx, burnedOut, rekindled);
    for (const i of ending) this.endFlaming(i, t1, burnedOut);

    this.t = t1;
    this.stepIndex = idx + 1;
    return this.report(ignited, burnedOut, spotFires, rekindled);
  }

  applyWater(centre: XY, radiusM: number, litres: number): readonly number[] {
    const circle = cells.cellsInCircle(this.world.grid, centre, radiusM);
    const changed: number[] = [];
    if (circle.length === 0 || !(litres > 0)) return changed;
    const per = litres / circle.length;
    for (const n of circle) {
      const s = this.state[n]!;
      if (s !== UNBURNED && s !== BURNING && s !== SMOULDERING) continue;
      this.addWetness(n, per / this.soakL);
      const props = fuelProps(this.world.fuel[n]!);
      const held = this.wetness[n]! * this.soakL;
      if (s === BURNING) {
        const slot = this.slotOf[n]!;
        const i0 = this.slots.i0[slot]!;
        const need = waterNeedL(this.cellM, i0);
        const outcome = waterOutcome(held, need, props.smoulderS > 0, props.mopUpL);
        if (outcome !== "knockback") {
          // Flames out; a ground fire (humus, peat) smoulders on unless the mop-up water is there too.
          if (outcome === "out" || !this.toSmouldering(n, this.t)) this.extinguish(n);
          changed.push(n);
        } else {
          // Knocked back: the front loses this application's share of its progress and heat.
          const f = Math.min(1, per / need);
          for (let k = 0; k < K; k++) this.slots.travel[slot * K + k]! *= 1 - f;
          this.intensity[n] = i0 * Math.max(0, 1 - held / need);
        }
      } else if (s === SMOULDERING && held >= props.mopUpL) {
        this.extinguish(n);
        changed.push(n);
      }
    }
    return changed.sort((a, b) => a - b);
  }

  cutFireBreak(line: readonly number[]): void {
    for (const n of line) if (n >= 0 && n < this.state.length && this.state[n] === UNBURNED) this.setState(n, NO_FUEL);
  }

  rateOfSpread(fromCell: number, cell: number, weather: Weather): number {
    const n = this.state.length;
    if (!(cell >= 0 && cell < n && fromCell >= 0 && fromCell < n) || this.state[cell] === NO_FUEL) return 0;
    const vigor = this.state[fromCell] === BURNING ? this.vigor(fromCell) : 1;
    return ros.rateBetween(this.world, fromCell, cell, prepareWeather(weather), this.wetness[cell]!) * vigor;
  }

  // ---------------------------------------------------------------------------------------------
  // The step's parts
  // ---------------------------------------------------------------------------------------------

  /** Spreads from burning cell `i`; returns true when its flaming ends this step. */
  private advanceSource(i: number, sw: ros.StepWeather, t0: number, t1: number, dtS: number, idx: number, spots: number[]): boolean {
    const { state, wetness, cand, slots } = this;
    const { cols, rows } = this.world.grid;
    const fuel = this.world.fuel;
    const fi = fuel[i]!;
    const props = FUEL_PROPS[fi]!;
    const slot = this.slotOf[i]!;
    const base = slot * K;
    const dtEff = dtS + slots.credit[slot]!;
    slots.credit[slot] = 0;
    const vigor = wetness[i]! > 0 ? this.vigor(i) : 1;
    const c = i % cols;
    const r = (i - c) / cols;
    const interior = c >= 2 && r >= 2 && c < cols - 2 && r < rows - 2;
    const { delta, via1, via2, distM } = this.nb;
    const { travel, slope } = slots;
    const rosFD = sw.rosFD;
    let pending = false;
    let front = 0; // the fastest front this cell still drives, m/min (after water)
    for (let k = 0; k < K; k++) {
      if (!interior && !onGrid(this.world.grid, c, r, k)) continue;
      const n = i + delta[k]!;
      if (state[n] !== UNBURNED) continue;
      const kind = NB_KIND[k]!;
      if (kind === 1) {
        if (state[i + via1[k]!] === NO_FUEL && state[i + via2[k]!] === NO_FUEL) continue; // diagonal line
      } else if (kind === 2) {
        if (state[i + via1[k]!] === NO_FUEL || state[i + via2[k]!] === NO_FUEL) continue; // knight over a line
      }
      let ros = rosFD[fuel[n]! * K + k]! * slope[base + k]! * vigor;
      const wn = wetness[n]!;
      if (wn > 0) ros *= wetFactor(sw, wn);
      if (ros < MIN_ROS_M_MIN) continue;
      pending = true;
      if (ros > front) front = ros;
      const rs = ros / 60;
      const d = travel[base + k]! + rs * dtEff;
      travel[base + k] = d;
      const dist = distM[k]!;
      if (d >= dist) {
        const tc = Math.max(t0, t1 - (d - dist) / rs);
        const prev = cand.get(n);
        if (prev === undefined || tc < prev) cand.set(n, tc);
      }
    }
    // Fireline intensity (Byram I = H·w·R) of the front the cell still drives; in the crown-fire regime
    // the cells whose own surface fire reaches the threshold (the head) crown and burn the canopy too.
    // Once the front has passed, the cell's flames fade until it burns out.
    let iSurf = 0;
    let crown = false;
    if (pending) {
      const regime = sw.crownRegime[fi] === 1;
      const undamped = vigor > 0 ? front / vigor : front;
      iSurf = (HEAT_KJ_KG * props.surfaceLoadKgM2 * (regime ? undamped / props.crownRosFactor : undamped)) / 60;
      crown = regime && iSurf >= props.crownThresholdKWm;
      slots.i0[slot] = (HEAT_KJ_KG * (props.surfaceLoadKgM2 + (crown ? props.crownLoadKgM2 : 0)) * undamped) / 60;
    } else {
      slots.i0[slot] = slots.i0[slot]! * 0.5;
    }
    if (crown) this.flags[i]! |= F_CROWN;
    else this.flags[i]! &= ~F_CROWN;
    const inten = slots.i0[slot]! * vigor;
    this.intensity[i] = inten;
    const brooks = this.nearBrook[i]!;
    if (this.randomEvents && (crown || iSurf * vigor >= SURFACE_SPOT_MIN || brooks !== 0)) {
      launchEmbers(this.embers, brooks, i, crown, iSurf * vigor, inten, sw, dtS, idx, spots);
    }
    const burnt = t1 - slots.flameS[slot]!;
    return (!pending && burnt >= props.residenceS) || burnt >= MAX_FLAME_S;
  }

  private advanceSmouldering(sw: ros.StepWeather, t1: number, dtS: number, idx: number, burnedOut: number[], rekindled: number[]): void {
    const w = sw.weather;
    const dryWind = this.randomEvents && w.rh < REKINDLE_MAX_RH && w.windMs > REKINDLE_MIN_WIND_MS;
    const list = this.smouldering;
    this.smouldering = [];
    for (const i of list) {
      if (this.state[i] !== SMOULDERING) {
        this.flags[i]! &= ~F_SMOULDER_LIST;
        continue;
      }
      if (t1 >= this.smoulderEndS[i]!) {
        this.flags[i]! &= ~F_SMOULDER_LIST;
        this.setState(i, BURNED_OUT);
        burnedOut.push(i);
        continue;
      }
      if (dryWind && (this.flags[i]! & F_EDGE) !== 0) {
        if (!this.hasUnburnedNeighbour(i)) {
          this.flags[i]! &= ~F_EDGE;
        } else if (hash01(this.seed, i, idx, SALT.rekindle) < (fuelProps(this.world.fuel[i]!).rekindlePerMin * dtS) / 60) {
          // Flare-up: the cell burns again (its ignition time and smoulder end stay) and spreads normally.
          this.flags[i]! &= ~F_SMOULDER_LIST;
          this.setState(i, BURNING);
          this.slots.flameS[this.allocSlot(i)] = t1;
          this.listBurning(i);
          rekindled.push(i);
          continue;
        }
      }
      this.smouldering.push(i);
    }
  }

  private endFlaming(i: number, t: number, burnedOut: number[]): void {
    this.flags[i]! &= ~F_BURN_LIST;
    if (this.state[i] !== BURNING) return;
    if (fuelProps(this.world.fuel[i]!).smoulderS > 0 && this.toSmouldering(i, t)) return;
    this.freeSlot(i);
    this.setState(i, BURNED_OUT);
    burnedOut.push(i);
  }

  /** Burning → smouldering (until the cell's smoulder end); false when that time has passed. */
  private toSmouldering(i: number, t: number): boolean {
    if (this.smoulderEndS[i] === 0) this.smoulderEndS[i] = t + fuelProps(this.world.fuel[i]!).smoulderS;
    if (t >= this.smoulderEndS[i]!) return false;
    this.freeSlot(i);
    this.setState(i, SMOULDERING);
    if (this.hasUnburnedNeighbour(i)) this.flags[i]! |= F_EDGE;
    else this.flags[i]! &= ~F_EDGE;
    if ((this.flags[i]! & F_SMOULDER_LIST) === 0) {
      this.flags[i]! |= F_SMOULDER_LIST;
      this.smouldering.push(i);
    }
    return true;
  }

  private extinguish(i: number): void {
    this.freeSlot(i);
    this.setState(i, EXTINGUISHED);
  }

  /** Applied water dries back exponentially (half-life from the fine-fuel moisture). */
  private dry(sw: ros.StepWeather, dtS: number): void {
    if (this.wetList.length === 0) return;
    const decay = Math.pow(0.5, dtS / sw.halfLifeS);
    const list = this.wetList;
    this.wetList = [];
    for (const i of list) {
      const w = this.wetness[i]! * decay;
      if (w < 1e-3) {
        this.wetness[i] = 0;
        this.flags[i]! &= ~F_WET_LIST;
      } else {
        this.wetness[i] = w;
        this.wetList.push(i);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------

  private igniteAt(n: number, t: number, creditS: number): void {
    this.setState(n, BURNING);
    if (this.ignitedAtS[n]! < 0) this.ignitedAtS[n] = t;
    const slot = this.allocSlot(n);
    this.slots.flameS[slot] = t;
    this.slots.credit[slot] = Math.max(0, creditS);
    this.listBurning(n);
  }

  private listBurning(n: number): void {
    if ((this.flags[n]! & F_BURN_LIST) !== 0) return;
    this.flags[n]! |= F_BURN_LIST;
    this.burning.push(n);
  }

  private setState(i: number, s: number): void {
    this.counts[this.state[i]!]!--;
    this.state[i] = s;
    this.counts[s]!++;
    if (s !== BURNING) this.intensity[i] = 0;
  }

  /** Share of a burning cell's fire that water has left (1 = dry). */
  private vigor(i: number): number {
    const w = this.wetness[i]!;
    const slot = this.slotOf[i]!;
    if (w <= 0 || slot < 0) return 1;
    return Math.max(0, 1 - (w * this.soakL) / waterNeedL(this.cellM, this.slots.i0[slot]!));
  }

  private addWetness(i: number, w: number): void {
    this.wetness[i] = this.wetness[i]! + w;
    if ((this.flags[i]! & F_WET_LIST) === 0) {
      this.flags[i]! |= F_WET_LIST;
      this.wetList.push(i);
    }
  }

  private hasUnburnedNeighbour(i: number): boolean {
    return cells.has8Neighbour(this.world.grid, this.nb, this.state, i, UNBURNED);
  }

  /** A slot for a cell starting to burn, with its slope factors toward each neighbour. */
  private allocSlot(i: number): number {
    const slot = this.slots.alloc();
    this.slotOf[i] = slot;
    const grid = this.world.grid;
    const elev = this.world.elevation;
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    for (let k = 0; k < K; k++) {
      if (onGrid(grid, c, r, k)) this.slots.slope[slot * K + k] = cells.safeSlope(elev[i]!, elev[i + this.nb.delta[k]!]!, this.nb.distM[k]!);
    }
    return slot;
  }

  private freeSlot(i: number): void {
    const slot = this.slotOf[i]!;
    if (slot < 0) return;
    this.slotOf[i] = -1;
    this.slots.release(slot);
  }

  private report(ignited: number[], burnedOut: number[], spotFires: { cell: number; fromCell: number }[], rekindled: number[]): FireStepReport {
    const asc = (a: number, b: number) => a - b;
    return {
      ignited: ignited.sort(asc),
      burnedOut: burnedOut.sort(asc),
      spotFires: spotFires.sort((a, b) => a.cell - b.cell || a.fromCell - b.fromCell),
      rekindled: rekindled.sort(asc),
      activeCells: this.counts[BURNING]! + this.counts[SMOULDERING]!,
      burnedHa: this.burnedHa,
    };
  }
}

/** The live fire on a world's fuel and elevation; `seed` drives spotting, leaks and rekindles. */
export function createFireSim(world: FireWorld, seed: number, options: FireSimOptions = {}): LiveFireSim {
  return new LiveFireSim(world, seed, options);
}
