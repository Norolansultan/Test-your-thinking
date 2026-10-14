/**
 * Game mode screen: the fire and fuel rasters, one pixel per 25 m cell (400 × 400), drawn into canvases that MapLibre
 * places on the grid's corners (`gridCornersLngLat`). The fire is the player's picture (`known`, aged by `knownAtS`) or,
 * in the debug view, the truth. Only the cells that show are touched each frame: the full picture is rebuilt when the
 * game state changes, and between ticks only the flaming cells are re-coloured for the flicker.
 */

import { CELL, type GameState } from "../contracts.js";
import { FUEL_COLORS, flickerNoise, NEVER_SEEN, staleness, writeCellRgba } from "./fire-colors.js";

/** Truth intensity above which a freshly seen flaming cell is drawn as crowning, kW/m. */
export const CROWN_DRAW_KWM = 4000;
/** A cell counts as seen "now" (crown colours, flicker at full strength) for this long, s. */
const NOW_S = 30;

export class FireRaster {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;

  /** Cells drawn as flaming at the last rebuild (re-coloured every frame). */
  private flaming: Int32Array = new Int32Array(0);
  private flamingAge: Float32Array = new Float32Array(0);
  private flamingCrown: Uint8Array = new Uint8Array(0);
  /** Cells drawn as smouldering (a slow glow). */
  private glowing: Int32Array = new Int32Array(0);
  private glowingAge: Float32Array = new Float32Array(0);
  private lastState: GameState | null = null;
  private lastTruth = false;

  constructor(cols: number, rows: number) {

    this.canvas = document.createElement("canvas");
    this.canvas.width = cols;
    this.canvas.height = rows;
    this.ctx = this.canvas.getContext("2d")!;
    this.img = this.ctx.createImageData(cols, rows);
  }

  /** Flaming cells in the current picture (for the smoke), in index order. */
  get flamingCells(): Int32Array {
    return this.flaming;
  }

  /** Redraws for `state` at real time `ms`. Returns whether anything was drawn. */
  draw(state: GameState, ms: number, truth: boolean): boolean {
    if (state !== this.lastState || truth !== this.lastTruth) this.rebuild(state, truth);
    const px = this.img.data;
    for (let k = 0; k < this.flaming.length; k++) {
      const i = this.flaming[k]!;
      writeCellRgba(px, i * 4, CELL.burning, this.flamingAge[k]!, flickerNoise(i, ms), this.flamingCrown[k] === 1);
    }
    const slow = ms * 0.25;
    for (let k = 0; k < this.glowing.length; k++) {
      const i = this.glowing[k]!;
      writeCellRgba(px, i * 4, CELL.smouldering, this.glowingAge[k]!, flickerNoise(i, slow), false);
    }
    this.ctx.putImageData(this.img, 0, 0);
    return true;
  }

  private rebuild(state: GameState, truth: boolean): void {
    this.lastState = state;
    this.lastTruth = truth;
    const px = this.img.data;
    px.fill(0);
    const src = truth ? state.fire.state : state.known;
    const at = state.knownAtS;
    const t = state.tS;
    const inten = state.fire.intensity;
    const flaming: number[] = [], fAge: number[] = [], fCrown: number[] = [];
    const glowing: number[] = [], gAge: number[] = [];
    for (let i = 0; i < src.length; i++) {
      const s = src[i]!;
      if (s === NEVER_SEEN || s < CELL.burning) continue;
      const age = truth ? 0 : Math.max(0, t - (at[i] ?? t));
      if (s === CELL.burning) {
        flaming.push(i);
        fAge.push(age);
        fCrown.push(age <= NOW_S && (inten[i] ?? 0) >= CROWN_DRAW_KWM ? 1 : 0);
      } else if (s === CELL.smouldering) {
        glowing.push(i);
        gAge.push(age);
      } else {
        writeCellRgba(px, i * 4, s, age, 0, false);
      }
    }
    // A glow around flaming cells, so a small fire still reads at a wide zoom over the pale basemap.
    const cols = this.img.width, rows = this.img.height;
    for (let k = 0; k < flaming.length; k++) {
      const i = flaming[k]!;
      const r = Math.floor(i / cols), c = i % cols;
      const strength = 1 - 0.5 * staleness(fAge[k]!);
      for (let dr = -2; dr <= 2; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= rows) continue;
        for (let dc = -2; dc <= 2; dc++) {
          const cc = c + dc;
          const d = Math.abs(dr) + Math.abs(dc);
          if (cc < 0 || cc >= cols || d === 0 || d > 3) continue;
          const o = (rr * cols + cc) * 4;
          const a = Math.round((d === 1 ? 120 : d === 2 ? 75 : 40) * strength);
          if (px[o + 3]! >= a) continue;
          px[o] = 255; px[o + 1] = 110; px[o + 2] = 20; px[o + 3] = a;
        }
      }
    }
    this.flaming = Int32Array.from(flaming);
    this.flamingAge = Float32Array.from(fAge);
    this.flamingCrown = Uint8Array.from(fCrown);
    this.glowing = Int32Array.from(glowing);
    this.glowingAge = Float32Array.from(gAge);
  }
}

/** The fuel overlay, drawn once. */
export function fuelCanvas(cols: number, rows: number, fuel: Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cols, rows);
  const px = img.data;
  for (let i = 0; i < fuel.length; i++) {
    const c = FUEL_COLORS[fuel[i]!];
    if (!c) continue;
    px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = c[3];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
