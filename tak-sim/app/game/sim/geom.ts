/**
 * Game mode: small geometry, wording and hashing helpers for the loop. No wall clock, no randomness:
 * variation comes from `hash32`, an integer hash of the seed and the moment.
 */

import type { GameGrid, XY } from "../contracts.js";

export const dist = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);

export const xy = (x: number, y: number): XY => ({ x, y });

/** The point `d` metres from `a` toward `b` (clamped at `b`). */
export function toward(a: XY, b: XY, d: number): XY {
  const len = dist(a, b);
  if (len <= 1e-9 || d >= len) return b;
  const f = d / len;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** The point `d` metres from `a` in the direction of `b` (not clamped; straight north if they coincide). */
export function beyond(a: XY, b: XY, d: number): XY {
  const len = dist(a, b);
  if (len <= 1e-9) return { x: a.x, y: a.y + d };
  return { x: a.x + ((b.x - a.x) / len) * d, y: a.y + ((b.y - a.y) / len) * d };
}

export function mapWidthM(grid: GameGrid): number {
  return grid.cols * grid.cellM;
}

export function mapHeightM(grid: GameGrid): number {
  return grid.rows * grid.cellM;
}

export function insideMap(grid: GameGrid, p: XY): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= mapWidthM(grid) && p.y <= mapHeightM(grid);
}

export function clampToMap(grid: GameGrid, p: XY): XY {
  const w = mapWidthM(grid) - 1;
  const h = mapHeightM(grid) - 1;
  return { x: Math.min(w, Math.max(1, p.x)), y: Math.min(h, Math.max(1, p.y)) };
}

/** Distance from `p` to the segment a–b. */
export function pointSegmentDist(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-12) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance along a–b of `p`'s projection, in metres (may fall outside 0…|ab|). */
export function alongSegment(p: XY, a: XY, b: XY): number {
  const len = dist(a, b);
  if (len <= 1e-9) return 0;
  return ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len;
}

/** Distance from `p` to a polyline (Infinity for an empty line). */
export function polylineDist(p: XY, line: readonly XY[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return dist(p, line[0]!);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, pointSegmentDist(p, line[i - 1]!, line[i]!));
  return best;
}

/** Shortest distance between segment a–b and a polyline. */
export function segmentPolylineDist(a: XY, b: XY, line: readonly XY[]): number {
  if (line.length === 0) return Infinity;
  let best = Math.min(polylineDist(a, line), polylineDist(b, line));
  const len = dist(a, b);
  const n = Math.max(1, Math.ceil(len / 10));
  for (let i = 1; i < n; i++) best = Math.min(best, polylineDist(toward(a, b, (len * i) / n), line));
  for (const q of line) best = Math.min(best, pointSegmentDist(q, a, b));
  return best;
}

/** Unit vector of the direction the wind blows TO (x east, y north). */
export function windToVector(windFromDeg: number): XY {
  const toRad = ((windFromDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(toRad), y: Math.cos(toRad) };
}

/** Compass bearing (degrees true) from a to b. */
export function bearingDeg(a: XY, b: XY): number {
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

const COMPASS_TO_FI = ["pohjoiseen", "koilliseen", "itään", "kaakkoon", "etelään", "lounaaseen", "länteen", "luoteeseen"] as const;
const COMPASS_EN = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
const COMPASS_FROM_FI = ["pohjoisesta", "koillisesta", "idästä", "kaakosta", "etelästä", "lounaasta", "lännestä", "luoteesta"] as const;

function octant(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 45) % 8;
}

/** "koilliseen" — the direction something moves to. */
export const compassToFi = (deg: number): string => COMPASS_TO_FI[octant(deg)]!;
/** "lounaasta" — the direction the wind blows from. */
export const compassFromFi = (deg: number): string => COMPASS_FROM_FI[octant(deg)]!;
export const compassEn = (deg: number): string => COMPASS_EN[octant(deg)]!;

/** Integer with thousands grouping: "1 800" (fi) / "1,800" (en). No Intl (determinism lint). */
export function groupThousands(n: number, lang: "fi" | "en"): string {
  const neg = n < 0;
  const s = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += lang === "fi" ? " " : ",";
    out += s[i];
  }
  return (neg ? "-" : "") + out;
}

/** A number with one decimal when small, decimal comma in Finnish: "0,5" / "0.5"; "6". */
export function roughNumber(n: number, lang: "fi" | "en"): string {
  if (Math.abs(n) >= 10) return groupThousands(n, lang);
  const r = Math.round(n * 2) / 2;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return lang === "fi" ? s.replace(".", ",") : s;
}

/** "13:20" for a game second, from the scenario's start clock (minutes after midnight). */
export function clockLabel(startClockMin: number, tS: number): string {
  const total = Math.floor(startClockMin + tS / 60);
  const m = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh < 10 ? "0" : ""}${hh}:${mm < 10 ? "0" : ""}${mm}`;
}

/** Byram's flame length from fireline intensity: L = 0.0775 · I^0.46 (m). */
export function flameLengthM(kwM: number): number {
  return kwM <= 0 ? 0 : 0.0775 * Math.pow(kwM, 0.46);
}

/** A deterministic 32-bit integer hash of a few integers (no randomness anywhere in the loop). */
export function hash32(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** A small stable string hash, for mixing ids into `hash32`. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Numeric ascending comparator (sorting with a comparator only — determinism lint). */
export const byNumber = (a: number, b: number): number => a - b;

/** Lower-case, without diacritics and spaces: "Lahdenkylä" → "lahdenkyla". */
export function normaliseName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
