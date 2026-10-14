/**
 * Small fakes for the game-loop tests: a 60 × 60-cell world (1.5 km square) with one straight E–W
 * gravel road, a pond with a water point, a four-house village and a N–S power line; a straight-line
 * router; grid helpers; step weather; and a deterministic grid fire that grows one ring downwind every
 * few steps and honours water and fire breaks.
 */

import { CELL, FUEL, type FireSim, type FireStepReport, type GameGrid, type GameScenario, type GameWorld, type RoadClass, type ScenarioUnit, type Weather, type WeatherKey, type XY } from "../../app/game/contracts.js";
import type { GameDeps, RouteResult } from "../../app/game/sim/ports.js";

export const COLS = 60;
export const ROWS = 60;
export const CELL_M = 25;
export const SIZE_M = COLS * CELL_M;
export const ROAD_Y = 750;
export const POND = { x: 300, y: 1200 };
export const VILLAGE = { x: 1200, y: 300 };
export const POWER_X = 1000;

const d = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);

export function cellOf(grid: GameGrid, p: XY): number | null {
  const w = grid.cols * grid.cellM;
  const h = grid.rows * grid.cellM;
  if (!(p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= h)) return null;
  const col = Math.min(grid.cols - 1, Math.floor(p.x / grid.cellM));
  const row = Math.min(grid.rows - 1, Math.floor((h - p.y) / grid.cellM));
  return row * grid.cols + col;
}

export function cellCentre(grid: GameGrid, c: number): XY {
  const row = Math.floor(c / grid.cols);
  const col = c % grid.cols;
  return { x: (col + 0.5) * grid.cellM, y: grid.rows * grid.cellM - (row + 0.5) * grid.cellM };
}

export function cellsInCircle(grid: GameGrid, centre: XY, r: number): number[] {
  const out: number[] = [];
  const h = grid.rows * grid.cellM;
  const c0 = Math.max(0, Math.floor((centre.x - r) / grid.cellM));
  const c1 = Math.min(grid.cols - 1, Math.floor((centre.x + r) / grid.cellM));
  const r0 = Math.max(0, Math.floor((h - centre.y - r) / grid.cellM));
  const r1 = Math.min(grid.rows - 1, Math.floor((h - centre.y + r) / grid.cellM));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const c = row * grid.cols + col;
      if (d(cellCentre(grid, c), centre) <= r) out.push(c);
    }
  }
  if (out.length === 0) {
    const c = cellOf(grid, centre);
    if (c !== null) out.push(c);
  }
  return out;
}

export function cellsAlongLine(grid: GameGrid, a: XY, b: XY): number[] {
  const len = d(a, b);
  const n = Math.max(1, Math.ceil(len / (grid.cellM / 4)));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    const c = cellOf(grid, p);
    if (c !== null && !out.includes(c)) out.push(c);
  }
  return out;
}

export function makeWorld(): GameWorld {
  const grid: GameGrid = { cols: COLS, rows: ROWS, cellM: CELL_M, originTm35: { east: 514000, north: 6741000 } };
  const n = COLS * ROWS;
  const fuel = new Uint8Array(n).fill(FUEL.pine_heath);
  for (let c = 0; c < n; c++) {
    const p = cellCentre(grid, c);
    if (d(p, POND) <= 100) fuel[c] = FUEL.water;
  }
  const roadRow = Math.floor((ROWS * CELL_M - ROAD_Y) / CELL_M);
  for (let col = 0; col < COLS; col++) fuel[roadRow * COLS + col] = FUEL.road_gravel;
  const nodes: XY[] = [];
  for (let i = 0; i <= 15; i++) nodes.push({ x: i * 100, y: ROAD_Y });
  const edges = nodes.slice(1).map((_, i) => ({ a: i, b: i + 1, cls: "gravel" as RoadClass, lengthM: 100 }));
  const houses = [
    { id: "h1", at: { x: VILLAGE.x - 50, y: VILLAGE.y } },
    { id: "h2", at: { x: VILLAGE.x + 50, y: VILLAGE.y } },
    { id: "h3", at: { x: VILLAGE.x, y: VILLAGE.y - 50 } },
    { id: "h4", at: { x: VILLAGE.x, y: VILLAGE.y + 50 } },
  ];
  for (const h of houses) fuel[cellOf(grid, h.at)!] = FUEL.built;
  return {
    grid,
    elevation: new Float32Array(n),
    fuel,
    roads: { nodes, edges },
    waterPoints: [{ id: "W1", nameFi: "Testilampi", nameEn: "Test Pond", kind: "pond", at: { x: 300, y: ROAD_Y }, roadNode: 3, scoop: POND }],
    assets: [
      ...houses.map((h) => ({ id: h.id, kind: "house" as const, at: h.at, value: 50, settlementId: "kyla" })),
      { id: "pylon1", kind: "power_pylon" as const, at: { x: POWER_X, y: 1300 }, value: 0, settlementId: null },
    ],
    settlements: [{ id: "kyla", nameFi: "Testikylä", nameEn: "Test Village", centre: VILLAGE, assetIds: ["h1", "h2", "h3", "h4"] }],
    powerLine: [{ x: POWER_X, y: 0 }, { x: POWER_X, y: SIZE_M }],
    labels: [],
    commandPost: { x: 100, y: ROAD_Y },
    entryNodes: [0, 15],
  };
}

export interface FakeFireOptions {
  /** Grow one ring downwind every this many steps (0 = never grows). */
  readonly growEvery?: number;
  /** A burning cell burns out after this many seconds (0 = never). */
  readonly burnOutS?: number;
  /** Intensity of a newly burning cell, kW/m. */
  readonly intensity?: number;
  /** No growth before this time, s. */
  readonly growFromS?: number;
  /** A neighbour catches when its direction's cosine to the wind exceeds this (0.9: straight downwind only). */
  readonly spreadCos?: number;
}

export class FakeFire implements FireSim {
  readonly state: Uint8Array;
  readonly intensity: Float32Array;
  readonly wetness: Float32Array;
  readonly ignitedAtS: Float32Array;
  readonly water: Float32Array;
  /** All water put on the fire so far, litres. */
  totalLitres = 0;
  tS = 0;
  private steps = 0;
  private readonly grid: GameGrid;
  private readonly pendingIgnited: number[] = [];

  constructor(world: GameWorld, private readonly opts: FakeFireOptions = {}) {
    this.grid = world.grid;
    const n = world.grid.cols * world.grid.rows;
    this.state = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      const f = world.fuel[c];
      this.state[c] = f === FUEL.water || f === FUEL.road_gravel || f === FUEL.built ? CELL.noFuel : CELL.unburned;
    }
    this.intensity = new Float32Array(n);
    this.wetness = new Float32Array(n);
    this.ignitedAtS = new Float32Array(n).fill(-1);
    this.water = new Float32Array(n);
  }

  /** Sets the intensity of burning cells (tests make a hot edge). */
  heat(cells: readonly number[], kwM: number): void {
    for (const c of cells) if (this.state[c] === CELL.burning) this.intensity[c] = kwM;
  }

  step(dtS: number, weather: Weather): FireStepReport {
    this.tS += dtS;
    this.steps++;
    const n = this.state.length;
    const burnedOut: number[] = [];
    for (let c = 0; c < n; c++) this.wetness[c] = Math.max(0, this.wetness[c]! - dtS * 0.0005);
    const burnOutS = this.opts.burnOutS ?? 0;
    if (burnOutS > 0) {
      for (let c = 0; c < n; c++) {
        if (this.state[c] === CELL.burning && this.tS - this.ignitedAtS[c]! >= burnOutS) {
          this.state[c] = CELL.burnedOut;
          this.intensity[c] = 0;
          burnedOut.push(c);
        }
      }
    }
    const every = this.opts.growEvery ?? 0;
    if (every > 0 && this.steps % every === 0 && this.tS >= (this.opts.growFromS ?? 0)) {
      const toRad = ((weather.windFromDeg + 180) * Math.PI) / 180;
      const wx = Math.sin(toRad);
      const wy = Math.cos(toRad);
      const burning: number[] = [];
      for (let c = 0; c < n; c++) if (this.state[c] === CELL.burning) burning.push(c);
      for (const c of burning) {
        const row = Math.floor(c / this.grid.cols);
        const col = c % this.grid.cols;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = row + dr;
            const cc = col + dc;
            if (rr < 0 || rr >= this.grid.rows || cc < 0 || cc >= this.grid.cols) continue;
            const len = Math.hypot(dc, dr);
            if ((dc * wx - dr * wy) / len <= (this.opts.spreadCos ?? 0.3)) continue;
            const nb = rr * this.grid.cols + cc;
            if (this.wetness[nb]! >= 0.5) continue;
            this.ignite(nb);
          }
        }
      }
    }
    const ignited = this.pendingIgnited.splice(0);
    let active = 0;
    let burned = 0;
    for (let c = 0; c < n; c++) {
      const s = this.state[c];
      if (s === CELL.burning || s === CELL.smouldering) active++;
      if (s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut) burned++;
    }
    return { ignited, burnedOut, spotFires: [], rekindled: [], activeCells: active, burnedHa: (burned * CELL_M * CELL_M) / 10000 };
  }

  ignite(cell: number): boolean {
    if (this.state[cell] !== CELL.unburned) return false;
    this.state[cell] = CELL.burning;
    this.intensity[cell] = this.opts.intensity ?? 1500;
    this.ignitedAtS[cell] = this.tS;
    this.pendingIgnited.push(cell);
    return true;
  }

  applyWater(centre: XY, radiusM: number, litres: number): readonly number[] {
    const cells = cellsInCircle(this.grid, centre, radiusM);
    const share = litres / Math.max(1, cells.length);
    this.totalLitres += litres;
    const changed: number[] = [];
    for (const c of cells) {
      this.wetness[c] = Math.min(3, this.wetness[c]! + share / 10);
      if (this.state[c] !== CELL.burning) continue;
      this.water[c] = this.water[c]! + share;
      if (this.water[c]! >= 50 + this.intensity[c]! * 0.1) {
        this.state[c] = CELL.extinguished;
        this.intensity[c] = 0;
        changed.push(c);
      }
    }
    return changed;
  }

  cutFireBreak(cells: readonly number[]): void {
    for (const c of cells) if (this.state[c] === CELL.unburned) this.state[c] = CELL.noFuel;
  }

  rateOfSpread(_from: number, _to: number, weather: Weather): number {
    return 2 + weather.windMs;
  }
}

export function weatherAt(keys: readonly WeatherKey[], tS: number): Weather {
  let k = keys[0]!;
  for (const x of keys) if (x.atS <= tS) k = x;
  return { windFromDeg: k.windFromDeg, windMs: k.windMs, gustMs: k.gustMs, tempC: k.tempC, rh: k.rh };
}

export interface FakeDeps extends GameDeps {
  /** The fires created so far (the last is the current game's). */
  readonly fires: FakeFire[];
}

export function fakeDeps(opts: FakeFireOptions = {}, onCreate?: (fire: FakeFire, world: GameWorld) => void): FakeDeps {
  const fires: FakeFire[] = [];
  return {
    fires,
    route: (world, from, to, speeds): RouteResult | null => {
      const a = world.roads.nodes[from];
      const b = world.roads.nodes[to];
      if (a === undefined || b === undefined || speeds.gravel <= 0) return null;
      const lengthM = d(a, b);
      return { path: [a, b], lengthM, durationS: lengthM / (speeds.gravel / 3.6) };
    },
    nearestNode: (world, p, maxM) => {
      let best: number | null = null;
      let bestD = Infinity;
      world.roads.nodes.forEach((n, i) => {
        const dd = d(n, p);
        if (dd < bestD && (maxM === undefined || dd <= maxM)) { best = i; bestD = dd; }
      });
      return best;
    },
    cellOf, cellCentre, cellsInCircle, cellsAlongLine,
    createFire: (world) => {
      const f = new FakeFire(world, opts);
      onCreate?.(f, world);
      fires.push(f);
      return f;
    },
    weatherAt,
    describeWeatherFi: (w) => `tuuli ${w.windFromDeg}° ${w.windMs} m/s, puuskat ${w.gustMs} m/s`,
    describeWeatherEn: (w) => `wind ${w.windFromDeg}° ${w.windMs} m/s, gusts ${w.gustMs} m/s`,
  };
}

export const CALM: readonly WeatherKey[] = [{ atS: 0, windFromDeg: 225, windMs: 3, gustMs: 5, tempC: 20, rh: 40 }];

export function scenario(over: Partial<GameScenario> & { readonly units: readonly ScenarioUnit[] }): GameScenario {
  return {
    id: "test",
    titleFi: "Testi", titleEn: "Test",
    briefingFi: "", briefingEn: "",
    startClockMin: 720,
    endAtS: 4 * 3600,
    difficulty: "easy",
    ignitions: [],
    weather: CALM,
    events: [],
    objectives: [],
    powerLineLiveAtStart: false,
    ...over,
  };
}

/** Lights a block of cells (inclusive bounds in local metres) on a fake fire. */
export function lightBlock(fire: FakeFire, world: GameWorld, x0: number, y0: number, x1: number, y1: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < world.grid.cols * world.grid.rows; c++) {
    const p = cellCentre(world.grid, c);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && fire.ignite(c)) out.push(c);
  }
  return out;
}
