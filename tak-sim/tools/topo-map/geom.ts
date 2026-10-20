/**
 * Shared primitives of the generated site (SPEC/33 §4): integer-hash noise, polyline geometry, the 20 m analysis grid and a
 * typed binary heap. Everything is deterministic: integer-hash value noise, no Math.random, no time.
 *
 * Coordinates are local metres: x east, y north, origin at the ignition point IGN; the map covers ±HALF_M.
 */

export const HALF_M = 10_000;
/** IGN placed at a plausible ETRS-TM35FIN position inside the SPEC/03 §1.1 box. */
export const IGN_TM35 = { eastM: 519_000, northM: 6_746_000 } as const;
export const SEED = 0x2030_0723;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

export function hash2(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1) ^ SEED;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, salt);
  const b = hash2(ix + 1, iy, salt);
  const c = hash2(ix, iy + 1, salt);
  const d = hash2(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal value noise, roughly in [-1, 1]. */
export function fbm(x: number, y: number, octaves: number, salt: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(x * f, y * f, salt + o * 101) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** 0 outside, 1 well inside, linear over `edgeM` across a boundary at signed distance `inside` (m). */
export const softEdge = (inside: number, edgeM: number) => clamp01(inside / edgeM + 0.5);

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface P { readonly x: number; readonly y: number }

export function polar(bearingDeg: number, d: number): P {
  const t = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(t) * d, y: Math.cos(t) * d };
}

export function bearingOf(x: number, y: number): number {
  const b = (Math.atan2(x, y) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
}

export const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export function closestOnPolyline(x: number, y: number, line: readonly P[]): P {
  let best: P = line[0]!;
  let bd = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) { bd = d; best = { x: px, y: py }; }
  }
  return best;
}

export function distToPolyline(x: number, y: number, line: readonly P[]): number {
  const p = closestOnPolyline(x, y, line);
  return Math.hypot(x - p.x, y - p.y);
}

export function polylineLength(line: readonly P[]): number {
  let s = 0;
  for (let k = 1; k < line.length; k++) s += Math.hypot(line[k]!.x - line[k - 1]!.x, line[k]!.y - line[k - 1]!.y);
  return s;
}

/** The polyline resampled every `stepM` (end points kept). */
export function resample(line: readonly P[], stepM: number): P[] {
  const out: P[] = [line[0]!];
  let carry = 0;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let s = stepM - carry;
    while (s < len) {
      out.push({ x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len });
      s += stepM;
    }
    carry = len - (s - stepM);
  }
  const last = line[line.length - 1]!;
  const tail = out[out.length - 1]!;
  if (Math.hypot(tail.x - last.x, tail.y - last.y) > stepM * 0.3) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/** Chaikin corner cutting with both end points kept. */
export function chaikin(line: readonly P[], passes: number): P[] {
  let pts = [...line];
  for (let n = 0; n < passes; n++) {
    if (pts.length < 3) return pts;
    const out: P[] = [pts[0]!];
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
}

/** Douglas–Peucker simplification at `tolM`. */
export function simplify(line: readonly P[], tolM: number): P[] {
  if (line.length < 3) return [...line];
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [i, j] = stack.pop()!;
    const a = line[i]!;
    const b = line[j]!;
    let best = -1;
    let bd = tolM;
    for (let k = i + 1; k < j; k++) {
      const d = distToPolyline(line[k]!.x, line[k]!.y, [a, b]);
      if (d > bd) { bd = d; best = k; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return line.filter((_, k) => keep[k] === 1);
}

/**
 * Densifies a polyline to `stepM` and displaces it sideways with noise, for natural-looking lines. `ampAt(p)` (optional) scales
 * the amplitude by place (a stream meanders on flat ground, keeps straight on a slope).
 */
export function meander(points: readonly P[], stepM: number, amplitudeM: number, wavelengthM: number, salt: number, ampAt?: (p: P) => number): P[] {
  const out: P[] = [];
  let s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const n = Math.max(1, Math.round(len / stepM));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const off = amplitudeM * (ampAt ? ampAt(p) : 1) * fbm((s + t * len) / wavelengthM, 0.5, 2, salt);
      out.push({ x: p.x + nx * off, y: p.y + ny * off });
    }
    s += len;
  }
  out.push(points[points.length - 1]!);
  return out;
}

export function inPolygon(x: number, y: number, pts: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Intersection point of segments ab and cd, or null. */
export function segmentHit(a: P, b: P, c: P, d: P): P | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (den === 0) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

// ---------------------------------------------------------------------------
// The 20 m analysis grid (row 0 at the south edge)
// ---------------------------------------------------------------------------

export const G = 20;
export const GN = (2 * HALF_M) / G; // 1000
export const cellX = (c: number) => -HALF_M + (c + 0.5) * G;
export const cellY = (r: number) => -HALF_M + (r + 0.5) * G;
export const colOf = (x: number) => Math.min(GN - 1, Math.max(0, Math.floor((x + HALF_M) / G)));
export const rowOf = (y: number) => Math.min(GN - 1, Math.max(0, Math.floor((y + HALF_M) / G)));
export const cellOf = (x: number, y: number) => rowOf(y) * GN + colOf(x);
export const inMap = (x: number, y: number) => Math.abs(x) < HALF_M && Math.abs(y) < HALF_M;

/** Bilinear sample of a GN × GN grid at a point (clamped at the edges). */
export function sampleGrid(grid: ArrayLike<number>, x: number, y: number): number {
  const fc = (x + HALF_M) / G - 0.5;
  const fr = (y + HALF_M) / G - 0.5;
  const c = Math.max(0, Math.min(GN - 2, Math.floor(fc)));
  const r = Math.max(0, Math.min(GN - 2, Math.floor(fr)));
  const tx = clamp01(fc - c);
  const ty = clamp01(fr - r);
  const i = r * GN + c;
  return (grid[i]! * (1 - tx) + grid[i + 1]! * tx) * (1 - ty) + (grid[i + GN]! * (1 - tx) + grid[i + GN + 1]! * tx) * ty;
}

/** The 8 neighbours as [dc, dr, length factor], E first, counter-clockwise. */
export const D8: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [1, 1, Math.SQRT2], [0, 1, 1], [-1, 1, Math.SQRT2], [-1, 0, 1], [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
];

/** Box blur of a GN × GN field, `radius` cells, `passes` times (≈ Gaussian). */
export function blur(src: ArrayLike<number>, radius: number, passes: number): Float32Array {
  let a = Float32Array.from(src);
  const b = new Float32Array(GN * GN);
  for (let p = 0; p < passes; p++) {
    for (let r = 0; r < GN; r++) {
      let s = 0;
      let n = 0;
      for (let c = -radius; c <= radius; c++) if (c >= 0 && c < GN) { s += a[r * GN + c]!; n++; }
      for (let c = 0; c < GN; c++) {
        b[r * GN + c] = s / n;
        const out = c - radius;
        const inn = c + radius + 1;
        if (out >= 0) { s -= a[r * GN + out]!; n--; }
        if (inn < GN) { s += a[r * GN + inn]!; n++; }
      }
    }
    for (let c = 0; c < GN; c++) {
      let s = 0;
      let n = 0;
      for (let r = -radius; r <= radius; r++) if (r >= 0 && r < GN) { s += b[r * GN + c]!; n++; }
      for (let r = 0; r < GN; r++) {
        a[r * GN + c] = s / n;
        const out = r - radius;
        const inn = r + radius + 1;
        if (out >= 0) { s -= b[out * GN + c]!; n--; }
        if (inn < GN) { s += b[inn * GN + c]!; n++; }
      }
    }
  }
  return a;
}

/** Labels 8-connected components of `mask` (> 0); returns labels (-1 outside) and component sizes. */
export function components(mask: ArrayLike<number>, n = GN): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(n * n).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < n * n; s++) {
    if (!mask[s] || label[s]! >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[s] = id;
    stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const r = Math.floor(i / n);
      const c = i % n;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const j = rr * n + cc;
        if (mask[j] && label[j]! < 0) { label[j] = id; stack.push(j); }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

// ---------------------------------------------------------------------------
// Binary min-heap on typed arrays (key: float64, value: int32)
// ---------------------------------------------------------------------------

export class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;
  constructor(capacity = 1024) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
  }
  push(key: number, val: number): void {
    if (this.size === this.keys.length) {
      const k = new Float64Array(this.size * 2);
      const v = new Int32Array(this.size * 2);
      k.set(this.keys);
      v.set(this.vals);
      this.keys = k;
      this.vals = v;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= key) break;
      this.keys[i] = this.keys[p]!;
      this.vals[i] = this.vals[p]!;
      i = p;
    }
    this.keys[i] = key;
    this.vals[i] = val;
  }
  peekKey(): number { return this.keys[0]!; }
  /** Removes the smallest entry and returns its value (its key is `lastKey`). */
  pop(): number {
    const top = this.vals[0]!;
    this.lastKey = this.keys[0]!;
    const n = --this.size;
    if (n > 0) {
      const k = this.keys[n]!;
      const v = this.vals[n]!;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const c = l + 1 < n && this.keys[l + 1]! < this.keys[l]! ? l + 1 : l;
        if (this.keys[c]! >= k) break;
        this.keys[i] = this.keys[c]!;
        this.vals[i] = this.vals[c]!;
        i = c;
      }
      this.keys[i] = k;
      this.vals[i] = v;
    }
    return top;
  }
  lastKey = 0;
}
