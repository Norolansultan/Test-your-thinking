/**
 * Cellular-automaton fire spread — the model structure of
 *
 *   Alexandridis, A., Vakalis, D., Siettos, C. I., & Bafas, G. V. (2008).
 *   A cellular automata model for forest fire spread prediction: The case of
 *   the wildfire that swept through Spetses Island in 1990.
 *   Applied Mathematics and Computation, 204(1), 191–201.
 *
 * SPEC/24 §2. This is an AUTHORING tool: it runs at build time, never in the
 * participant's browser (SPEC/00 §0, "does not simulate fire"; SPEC/05 §3,
 * cross-browser floating-point variance). Its output is frozen into the
 * scenario as polygons.
 *
 * Each cell is in one of four states. A burning cell burns out after one
 * step, and on that step ignites each unburned 8-neighbour with probability
 *
 *   p_burn = p_h · (1 + p_veg) · (1 + p_den) · p_w · p_s        (clamped to 1)
 *   p_w    = exp(c1·V) · exp(c2·V·(cos θ − 1))
 *   p_s    = exp(a·θ_s)
 *
 * where V is wind speed (m/s), θ the angle between the wind's heading and the
 * direction of spread, and θ_s the slope angle (degrees) from the burning cell
 * to the neighbour. p_veg and p_den belong to the neighbour (the cell about to
 * burn). Parameter values are those published in the paper; the Finnish fuel
 * mapping is ours and is pending domain review (SPEC/24 §4).
 *
 * Linear barriers (roads, brooks) are an addition (SPEC/24 §12): a barrier cell ignites at the
 * full rate only when the fire runs at it with the wind — spread within `headArcDeg` of the wind's
 * heading and wind of at least `minWindMs` — i.e. a head fire in a strong wind. Flanks and backing
 * fire meet it at `leak` times the rate: the occasional ember, not a front.
 */

export const NO_FUEL = 0;
export const UNBURNED = 1;
export const BURNING = 2;
export const BURNED = 3;

export interface AlexandridisParams {
  readonly pH: number;
  readonly c1: number;
  readonly c2: number;
  readonly a: number;
}

/** Values as published in Alexandridis et al. (2008). Verify against the paper before citing. */
export const ALEXANDRIDIS_2008: AlexandridisParams = { pH: 0.58, c1: 0.045, c2: 0.131, a: 0.078 };

/**
 * PROVISIONAL recalibration for managed boreal forest (SPEC/24 §4.2). With the published values
 * the head saturates at one cell per step while the flanks nearly do too, so fires grow almost
 * round (length-to-breadth < 1 at 4–14 m/s), which inflates the authored 172 ha several-fold.
 * Alexandridis et al. fitted p_h, c1 and c2 to Spetses; refitting c2 (directionality) and p_h
 * here gives length-to-breadth ≈ 1.3 / 2.8 / 4.3 at 4 / 9 / 14 m/s on uniform pine heath,
 * in line with the empirical wind relation (Anderson 1983). To be confirmed with the domain
 * reviewer against the authored rates and area.
 */
export const BOREAL_PROVISIONAL: AlexandridisParams = { pH: 0.45, c1: 0.045, c2: 0.6, a: 0.078 };

export interface FuelClass {
  readonly id: string;
  readonly labelFi: string;
  readonly burnable: boolean;
  readonly pVeg: number;
  readonly pDen: number;
  /** A linear break the fire crosses only as a wind-driven head (SPEC/24 §12). */
  readonly barrier?: { readonly minWindMs: number; readonly headArcDeg: number; readonly leak: number };
}

/** A regular grid. Row 0 is the southern edge, column 0 the western edge; row-major. */
export interface FuelGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSizeM: number;
  readonly fuel: Uint8Array; // index into `classes`
  readonly classes: readonly FuelClass[];
  readonly elevationM: Float32Array | null;
}

/** Meteorological convention: the direction the wind blows FROM, degrees clockwise from north. */
export interface Wind {
  readonly fromDeg: number;
  readonly speedMs: number;
}

/** 8-neighbourhood as [dCol (east), dRow (north)], fixed order — part of the determinism contract. */
export const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1],
];

const DEG = Math.PI / 180;

/** Bearing of a neighbour offset, degrees clockwise from north. */
export function offsetBearingDeg(dCol: number, dRow: number): number {
  const b = Math.atan2(dCol, dRow) / DEG;
  return b < 0 ? b + 360 : b;
}

/** The wind factor p_w for spread toward `spreadBearingDeg`. */
export function windFactor(wind: Wind, spreadBearingDeg: number, params: AlexandridisParams): number {
  const headingDeg = (wind.fromDeg + 180) % 360;
  const theta = (spreadBearingDeg - headingDeg) * DEG;
  const v = wind.speedMs;
  return Math.exp(params.c1 * v) * Math.exp(params.c2 * v * (Math.cos(theta) - 1));
}

/**
 * Fast deterministic 32-bit generator (mulberry32) — integer-only via Math.imul, so it is
 * bit-identical across JS engines. Seeded from the project's xorshift64* stream by the caller.
 * The project generator is BigInt-based and too slow for the tens of millions of draws an
 * ensemble needs.
 */
export class Mulberry32 {
  private s: number;
  constructor(seed32: number) {
    this.s = seed32 >>> 0;
  }
  nextFloat(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * The automaton. Holds cell states and the list of burning cells. Mutable by design (it is a
 * build-time simulator, not engine state); every mutation is deterministic given the seed.
 */
export class FireAutomaton {
  readonly state: Uint8Array;
  private burning: number[] = [];

  constructor(
    readonly grid: FuelGrid,
    readonly params: AlexandridisParams = ALEXANDRIDIS_2008,
  ) {
    this.state = new Uint8Array(grid.cols * grid.rows);
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] = grid.classes[grid.fuel[i]!]!.burnable ? UNBURNED : NO_FUEL;
    }
  }

  /** Copies another automaton's cell states (same grid dimensions), recomputing the burning list. */
  loadStates(states: Uint8Array): void {
    this.state.set(states);
    this.burning = [];
    for (let i = 0; i < states.length; i++) if (states[i] === BURNING) this.burning.push(i);
  }

  burningCount(): number {
    return this.burning.length;
  }

  /**
   * Sets unburned cells to burning. Cells already burning, burned or without fuel are unchanged — except, with
   * `throughLines` (a rekindle or holdover, revision (aj)), a held line (`removeFuel` on burnable ground: a dug or
   * wetted strip) that the disk covers: fire that crept under it through roots and humus surfaces on its far
   * side, so the line's cells burn too and the new fire touches the old edge. Water and built ground never burn.
   */
  ignite(cells: readonly number[], throughLines = false): void {
    for (const i of cells) {
      const line = throughLines && this.state[i] === NO_FUEL && this.grid.classes[this.grid.fuel[i]!]!.burnable;
      if (this.state[i] === UNBURNED || line) {
        this.state[i] = BURNING;
        this.burning.push(i);
      }
    }
    this.burning.sort((x, y) => x - y);
  }

  /** Puts out burning cells (a line holding, a spot knocked down): burning -> burned. */
  extinguish(cells: readonly number[]): void {
    const out = new Set<number>();
    for (const i of cells) if (this.state[i] === BURNING) { this.state[i] = BURNED; out.add(i); }
    if (out.size > 0) this.burning = this.burning.filter((i) => !out.has(i));
  }

  /**
   * Perimeter persistence (SPEC/24 §3.3) — an addition to the 2008 model, where a cell burns out
   * after one step. Real perimeters smoulder and flare again when the wind turns; without this,
   * a fire stalled by calm, rain or a birch strip is extinct when the later wind arrives. Every
   * burned cell with unburned fuel beside it becomes burning again. Controlled line segments are
   * represented by removing their fuel (`removeFuel`), which this never undoes.
   */
  reactivatePerimeter(): void {
    const { cols, rows } = this.grid;
    const add: number[] = [];
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] !== BURNED) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr] of NEIGHBOURS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (this.state[nr * cols + nc] === UNBURNED) { add.push(i); break; }
      }
    }
    for (const i of add) this.state[i] = BURNING;
    this.burning = this.burning.concat(add).sort((x, y) => x - y);
  }

  /**
   * Secures the perimeter where `inSector(cell)` is true — crews have the line in hand. Burning
   * cells there are put out and the unburned fuel beside the footprint is removed (the line), so
   * `reactivatePerimeter` can never re-light that stretch. Returns the number of cells secured.
   */
  secureSector(inSector: (cell: number) => boolean): number {
    const { cols, rows } = this.grid;
    const line: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      if ((s !== BURNED && s !== BURNING) || !inSector(i)) continue;
      if (s === BURNING) out.push(i);
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr] of NEIGHBOURS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        if (this.state[n] === UNBURNED) line.push(n);
      }
    }
    this.extinguish(out);
    this.removeFuel(line);
    return line.length;
  }

  /** Removes fuel from unburned cells (a dug line, a wetted strip). */
  removeFuel(cells: readonly number[]): void {
    for (const i of cells) if (this.state[i] === UNBURNED) this.state[i] = NO_FUEL;
  }

  /** One CA step under `wind`. Returns the number of newly ignited cells. */
  step(wind: Wind, rng: Mulberry32): number {
    const { cols, rows, cellSizeM, fuel, classes, elevationM } = this.grid;
    // p for each (neighbour direction, fuel class) without slope — recomputed per step (wind may change).
    const heading = (wind.fromDeg + 180) % 360;
    const base: number[][] = NEIGHBOURS.map(([dc, dr]) => {
      const bearing = offsetBearingDeg(dc, dr);
      const pw = windFactor(wind, bearing, this.params);
      const offHead = Math.abs(((bearing - heading + 540) % 360) - 180);
      return classes.map((fc) => {
        if (!fc.burnable) return 0;
        const p = this.params.pH * (1 + fc.pVeg) * (1 + fc.pDen) * pw;
        const b = fc.barrier;
        return b && !(wind.speedMs >= b.minWindMs && offHead <= b.headArcDeg) ? p * b.leak : p;
      });
    });
    const next: number[] = [];
    for (const i of this.burning) {
      const c = i % cols;
      const r = (i - c) / cols;
      for (let k = 0; k < NEIGHBOURS.length; k++) {
        const [dc, dr] = NEIGHBOURS[k]!;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        if (this.state[n] !== UNBURNED) continue;
        let p = base[k]![fuel[n]!]!;
        if (elevationM) {
          const dist = cellSizeM * (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
          const slopeDeg = Math.atan((elevationM[n]! - elevationM[i]!) / dist) / DEG;
          p *= Math.exp(this.params.a * slopeDeg);
        }
        if (rng.nextFloat() < p) {
          this.state[n] = BURNING;
          next.push(n);
        }
      }
      this.state[i] = BURNED;
    }
    next.sort((x, y) => x - y);
    this.burning = next;
    return next.length;
  }

  /** True for cells that are burning or have burned — the fire's footprint. */
  footprint(): Uint8Array {
    const mask = new Uint8Array(this.state.length);
    for (let i = 0; i < mask.length; i++) mask[i] = this.state[i] === BURNING || this.state[i] === BURNED ? 1 : 0;
    return mask;
  }
}
