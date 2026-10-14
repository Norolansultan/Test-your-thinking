/**
 * Game mode: fog of war. The player's picture is what the units have seen: each step every unit on
 * the map copies the fire's state within its sensor radius into `known` and stamps `knownAtS`.
 * Smoke blinds eyes and ground crews (SPEC/18 §1: "smoke blocks optics"); thermal drones see through it.
 */

import type { XY } from "../contracts.js";
import { clampToMap, dist, windToVector } from "./geom.js";
import { active, type Ctx, type UnitRt } from "./runtime.js";

/** Never observed (contract: `known` 255). */
export const UNKNOWN = 255;
/** A point lies in the smoke plume of a burning cell this far upwind of it, m. */
export const SMOKE_REACH_M = 600;
/** Inside the plume an optical sensor sees this fraction of its clear-air radius. */
export const SMOKE_FACTOR = 0.5;

interface Footprint { readonly cell: number; readonly radius: number; readonly cells: readonly number[] }

export class Fog {
  readonly known: Uint8Array;
  readonly knownAtS: Float32Array;
  private readonly footprints = new Map<string, Footprint>();

  constructor(cells: number) {
    this.known = new Uint8Array(cells).fill(UNKNOWN);
    this.knownAtS = new Float32Array(cells).fill(-1);
  }

  /** Marks cells as seen now (the 112 call's position of a reported ignition). */
  reveal(ctx: Ctx, cells: readonly number[]): void {
    for (const c of cells) {
      this.known[c] = ctx.fire.state[c] ?? UNKNOWN;
      this.knownAtS[c] = ctx.tS;
    }
  }

  /** Every unit on the map observes (aircraft only while airborne). */
  observeAll(ctx: Ctx): void {
    for (const u of ctx.units) if (active(u) && (!u.spec.air || u.airborne)) this.observe(ctx, u);
  }

  /** The cells the unit saw on its last observation. */
  footprint(u: UnitRt): readonly number[] {
    return this.footprints.get(u.id)?.cells ?? [];
  }

  effectiveRadius(ctx: Ctx, u: UnitRt): number {
    const r = u.spec.sensorM;
    if (u.spec.seesThroughSmoke) return r;
    return inSmoke(ctx, u.pos) ? r * SMOKE_FACTOR : r;
  }

  private observe(ctx: Ctx, u: UnitRt): void {
    const radius = this.effectiveRadius(ctx, u);
    if (radius <= 0) return;
    const cell = ctx.deps.cellOf(ctx.world.grid, clampToMap(ctx.world.grid, u.pos));
    if (cell === null) return;
    let fp = this.footprints.get(u.id);
    if (fp === undefined || fp.cell !== cell || fp.radius !== radius) {
      fp = { cell, radius, cells: ctx.deps.cellsInCircle(ctx.world.grid, u.pos, radius) };
      this.footprints.set(u.id, fp);
    }
    const st = ctx.fire.state;
    const t = ctx.tS;
    for (const c of fp.cells) {
      this.known[c] = st[c] ?? UNKNOWN;
      this.knownAtS[c] = t;
    }
  }
}

/** Whether `p` lies in the plume downwind of a burning cell (within 600 m, a narrow cone). */
export function inSmoke(ctx: Ctx, p: XY): boolean {
  const w = windToVector(ctx.weather.windFromDeg);
  const idx = ctx.fireIdx;
  for (const c of idx.burningWithin(p, SMOKE_REACH_M)) {
    const q = idx.centre(c);
    const d = dist(p, q);
    if (d < ctx.world.grid.cellM) return true;
    const cos = ((p.x - q.x) * w.x + (p.y - q.y) * w.y) / d;
    if (cos > 0.85) return true;
  }
  return false;
}
