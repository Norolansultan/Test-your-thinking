/**
 * Game mode screen: soft smoke plumes drifting downwind from the flaming cells the player can see. Visual only (the game
 * loop has its own smoke rule for sensors); cheap: at most `MAX_PUFFS` soft sprites on one canvas over the map, placed
 * with an affine local-metres → screen transform measured once per frame. Which cell emits next comes from integer
 * hashing (no `Math.random`), and the drift from the frame's real time step, so a paused game's smoke stands still.
 */

import type { GameGrid, Weather } from "../contracts.js";

export const MAX_PUFFS = 180;
/** Puffs launched per real second per flaming cell, capped by `MAX_SPAWN_PER_S`. */
const SPAWN_PER_CELL_S = 0.6;
const MAX_SPAWN_PER_S = 40;
/** A puff's life, real seconds. */
const LIFE_S = 9;
/** Drift: metres per real second per m/s of wind (exaggerated so the plume reads at map scale). */
const DRIFT_PER_MS = 22;

interface Puff { x: number; y: number; age: number; life: number; r0: number; seed: number }

/** Screen position of local metres: `[a, b, c, d, e, f]` with sx = a·x + b·y + c, sy = d·x + e·y + f. */
export type Affine = readonly [number, number, number, number, number, number];

export class SmokeLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite: HTMLCanvasElement;
  private puffs: Puff[] = [];
  private spawnAcc = 0;
  private counter = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2";
    this.ctx = this.canvas.getContext("2d")!;
    this.sprite = document.createElement("canvas");
    this.sprite.width = this.sprite.height = 64;
    const g = this.sprite.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(205, 200, 192, 0.55)");
    grad.addColorStop(0.5, "rgba(170, 166, 160, 0.28)");
    grad.addColorStop(1, "rgba(150, 146, 140, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }

  /**
   * One frame: `dtS` real seconds since the last (0 when paused), the flaming cells, the wind, the transform and the
   * map's metres per screen pixel.
   */
  frame(dtS: number, flaming: ArrayLike<number>, grid: GameGrid, w: Weather, toScreen: Affine, mPerPx: number, enabled: boolean): void {
    const c = this.canvas;
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const wPx = c.clientWidth, hPx = c.clientHeight;
    if (c.width !== Math.round(wPx * dpr) || c.height !== Math.round(hPx * dpr)) { c.width = Math.round(wPx * dpr); c.height = Math.round(hPx * dpr); }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!enabled) { this.puffs = []; return; }
    // Wind blows FROM windFromDeg: the smoke goes the other way.
    const toRad = ((w.windFromDeg + 180) * Math.PI) / 180;
    const speed = Math.max(1.5, w.windMs) * DRIFT_PER_MS;
    const vx = Math.sin(toRad) * speed, vy = Math.cos(toRad) * speed;
    // Age and move.
    const kept: Puff[] = [];
    for (const p of this.puffs) {
      p.age += dtS;
      if (p.age >= p.life) continue;
      const spread = 1 + p.age * 0.12;
      p.x += vx * dtS * spread * 0.9;
      p.y += vy * dtS * spread * 0.9;
      kept.push(p);
    }
    this.puffs = kept;
    // Launch.
    const n = flaming.length;
    if (n > 0 && dtS > 0) {
      this.spawnAcc += Math.min(MAX_SPAWN_PER_S, n * SPAWN_PER_CELL_S) * dtS;
      while (this.spawnAcc >= 1 && this.puffs.length < MAX_PUFFS) {
        this.spawnAcc -= 1;
        const k = this.counter++;
        const cell = flaming[hash(k, n) % n]!;
        const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
        this.puffs.push({
          x: (col + 0.5) * grid.cellM, y: (grid.rows - row - 0.5) * grid.cellM,
          age: 0, life: LIFE_S * (0.7 + 0.6 * ((hash(k, 7) % 1000) / 1000)), r0: 40 + (hash(k, 13) % 40), seed: k,
        });
      }
      if (this.spawnAcc > 1) this.spawnAcc = 1;
    }
    // Draw.
    const [a, b, cc, d, e, f] = toScreen;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of this.puffs) {
      const t = p.age / p.life;
      const rM = p.r0 + p.age * 45;
      const rPx = Math.max(4, rM / mPerPx);
      const sx = a * p.x + b * p.y + cc, sy = d * p.x + e * p.y + f;
      if (sx < -rPx || sy < -rPx || sx > wPx + rPx || sy > hPx + rPx) continue;
      const fadeIn = Math.min(1, t * 6);
      ctx.globalAlpha = 0.55 * fadeIn * (1 - t) * (1 - t);
      ctx.drawImage(this.sprite, sx - rPx, sy - rPx, rPx * 2, rPx * 2);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.puffs = [];
  }
}

function hash(a: number, b: number): number {
  let h = Math.imul(a + 0x7f4a7c15, 0x9e3779b1) ^ Math.imul(b + 0x165667b1, 0x85ebca77);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae3d);
  h ^= h >>> 16;
  return h >>> 0;
}
