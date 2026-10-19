/**
 * Shared Monte Carlo helpers for the power tools (`h2-power.ts`, `paper2-power.ts`).
 *
 * Moved here on 19 Oct 2026 (SPEC/30 §11 re-run) from the two tools, which carried identical copies.
 * The generator, the tests and the clustered fit are unchanged (the fit is `paper2-power.ts`'s; H2's
 * GLM× now uses it for the same model), so a cell seeded as before draws the same stream as before.
 *
 * Deterministic: a seeded xoshiro128** stream; no unseeded randomness, no clock.
 */

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

export function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  private readonly s: Uint32Array;
  private spare: number | null = null;
  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.s = new Uint32Array([sm(), sm(), sm(), sm()]);
  }
  /** xoshiro128** → [0, 1). */
  uniform(): number {
    const s = this.s;
    const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
    const result = Math.imul(rotl(Math.imul(s[1]!, 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1]! << 9) >>> 0;
    s[2]! ^= s[0]!; s[3]! ^= s[1]!; s[1]! ^= s[2]!; s[0]! ^= s[3]!;
    s[2]! ^= t; s[3] = rotl(s[3]!, 11);
    return result / 4294967296;
  }
  bern(p: number): boolean {
    return this.uniform() < p;
  }
  normal(): number {
    if (this.spare !== null) { const v = this.spare; this.spare = null; return v; }
    let u = 0;
    while (u === 0) u = this.uniform();
    const v = this.uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
}

/** The seed of one grid cell: the base seed hashed with the cell's indices. */
export function cellSeed(base: number, ...parts: number[]): number {
  let h = base >>> 0;
  for (const p of parts) h = splitmix32(h ^ Math.imul(p + 1, 0x27d4eb2d))();
  return h;
}

export const logistic = (x: number): number => 1 / (1 + Math.exp(-x));
export const logit = (p: number): number => Math.log(p / (1 - p));

// ---------------------------------------------------------------------------
// Logistic regression with a participant-clustered sandwich SE
// ---------------------------------------------------------------------------

/** Solves A x = v (p × p) by Gauss–Jordan with partial pivoting; null if singular. */
function solve(A: readonly (readonly number[])[], v: readonly number[]): number[] | null {
  const p = v.length;
  const m = A.map((row, i) => [...row, v[i]!]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    if (Math.abs(m[piv]![c]!) < 1e-10) return null;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      if (f === 0) continue;
      for (let k = c; k <= p; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[p]! / row[i]!);
}

/**
 * Fits y ~ X by IRLS and returns the two-sided Wald p-value for coefficient `target`, with the
 * participant-clustered sandwich variance (small-sample factor G/(G−1)); null if the fit failed
 * (separation or a singular information matrix). A population-averaged stand-in for the mixed model.
 */
export function clusteredLogitP(X: readonly (readonly number[])[], y: ArrayLike<number>, cluster: ArrayLike<number>, clusters: number, target: number): number | null {
  const n = y.length, p = X[0]!.length;
  let beta = new Array<number>(p).fill(0);
  const eta = (x: readonly number[]) => { let e = 0; for (let a = 0; a < p; a++) e += x[a]! * beta[a]!; return e; };
  let converged = false;
  for (let iter = 0; iter < 40; iter++) {
    const A = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const grad = new Array<number>(p).fill(0);
    for (let k = 0; k < n; k++) {
      const x = X[k]!;
      const mu = logistic(eta(x));
      const w = mu * (1 - mu);
      for (let a = 0; a < p; a++) {
        grad[a]! += x[a]! * (y[k]! - mu);
        for (let c = 0; c < p; c++) A[a]![c]! += w * x[a]! * x[c]!;
      }
    }
    const step = solve(A, grad);
    if (!step) return null;
    beta = beta.map((v, i) => v + step[i]!);
    if (!beta.every((b) => Number.isFinite(b) && Math.abs(b) < 30)) return null;
    if (Math.max(...step.map(Math.abs)) < 1e-8) { converged = true; break; }
  }
  if (!converged) return null;
  const A = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const scores = Array.from({ length: clusters }, () => new Array<number>(p).fill(0));
  for (let k = 0; k < n; k++) {
    const x = X[k]!;
    const mu = logistic(eta(x));
    const w = mu * (1 - mu);
    const sc = scores[cluster[k]!]!;
    for (let a = 0; a < p; a++) {
      sc[a]! += x[a]! * (y[k]! - mu);
      for (let c = 0; c < p; c++) A[a]![c]! += w * x[a]! * x[c]!;
    }
  }
  // Column `target` of A⁻¹, then Var(β̂_target) = a' B a with B = Σ_g s_g s_g'.
  const col = solve(A, Array.from({ length: p }, (_, i) => (i === target ? 1 : 0)));
  if (!col) return null;
  let v = 0;
  for (const sc of scores) { let d = 0; for (let a = 0; a < p; a++) d += col[a]! * sc[a]!; v += d * d; }
  v *= clusters / (clusters - 1);
  if (!(v > 0)) return null;
  const z = beta[target]! / Math.sqrt(v);
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** Two-sided Welch t-test p-value. */
export function welchP(a: readonly number[], b: readonly number[]): number {
  const mean = (x: readonly number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const variance = (x: readonly number[], m: number) => x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  const ma = mean(a), mb = mean(b), va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length;
  if (va + vb === 0) return 1;
  const t = (ma - mb) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return studentTwoSidedP(t, df);
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26 on erf; |error| < 1.5e-7.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularised incomplete beta I_x(a, b) (Numerical Recipes continued fraction). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx: number, aa: number, bb: number) => {
    let c = 1, d = 1 - ((aa + bb) * xx) / (aa + 1);
    d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      for (const num of [(m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2)), (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1))]) {
        d = 1 + num * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
        c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        h *= d * c;
      }
      if (Math.abs(d * c - 1) < 1e-12) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
}

function studentTwoSidedP(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

// ---------------------------------------------------------------------------
// CLI and output
// ---------------------------------------------------------------------------

/** The numeric value after a CLI flag (`--reps 1000`), or the fallback. */
export function argValue(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

/**
 * A comma-separated numeric list after a CLI flag (`--pdirect 0.25,0.30,0.30`), or the fallback; the list must have the fallback's
 * length and finite values (SPEC/31 §3.12: pilot-2 base rates per view are passed this way).
 */
export function argList(name: string, fallback: readonly number[]): readonly number[] {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = (process.argv[i + 1] ?? "").split(",").map(Number);
  if (v.length !== fallback.length || !v.every(Number.isFinite)) throw new Error(`${name} takes ${fallback.length} comma-separated numbers`);
  return v;
}

export const pct = (x: number): string => `${(100 * x).toFixed(0)} %`;
export const signed = (x: number, digits = 3): string => `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;
