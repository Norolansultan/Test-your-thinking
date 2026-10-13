/**
 * H2 power by Monte Carlo — SPEC/09 Amendment 2 Oct 2026 ("H2 power with the 6-item freezes").
 *
 *   npx tsx tools/power/h2-power.ts [--reps 1000] [--seed 20261002]
 *
 * Question: with 6-item freezes (2×L1, 2×L2, 2×L3), H2's primary window (L2/L3 items of the freezes
 * in V2, V4, V5, V7) has 16 items per participant instead of 4. How much power does that buy for
 * the group difference in confidence–accuracy calibration at the planned N?
 *
 * Data-generating process (assumptions, not pilot values — SPEC/09 §8 still requires the
 * pilot-based simulation):
 *   item bank   b_j ~ N(0, SIGMA_ITEM²), drawn once per replicate, the same items for everyone;
 *   participant θ_i ~ N(0, SIGMA_ABILITY²), confidence bias u_i ~ N(0, SIGMA_CONF_BIAS²);
 *   accuracy    p_ij = GUESS + (1 − GUESS)·logistic(MU + θ_i − b_j), four-option items (chance 25 %);
 *   confidence  s_ij = logistic(λ_g·logit(p_ij) + δ_g + u_i + ε_ij), ε ~ N(0, SIGMA_CONF_NOISE²),
 *               reported on the instrument's 25/50/75/100 scale (nearest step);
 *   group g     Haku (directed): λ = 1, δ = BASE_OVERCONFIDENCE; Thinker (substitutive): per scenario.
 * λ is resolution (how well confidence tracks the item's real chance); δ is bias (overconfidence).
 * Accuracy itself is the same in both groups: a pure calibration effect (H1 is a separate test).
 *
 * Estimators, each two-sided at α = .05:
 *   GLM×   — the pre-registered form: item-level logistic model correct ~ conf × group, conf centred,
 *            cluster-robust (participant) sandwich SE, Wald z on the interaction. A population-
 *            averaged stand-in for the mixed model (no item random effect; see SPEC/09 amendment).
 *   Brier  — per-participant Brier score, Welch t-test between groups.
 *   Gap    — per-participant over/under-confidence gap (mean conf − proportion correct), Welch t.
 *
 * Deterministic: a seeded xoshiro128** stream per grid cell; no Math.random, no clock.
 */

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

const GUESS = 0.25;
const MU = 0.0; // mean accuracy ≈ .62 on L2/L3 items
const SIGMA_ITEM = 1.0;
const SIGMA_ABILITY = 0.8;
const SIGMA_CONF_BIAS = 0.5;
const SIGMA_CONF_NOISE = 1.0;
const BASE_OVERCONFIDENCE = 0.3;
const CONF_STEPS = [0.25, 0.5, 0.75, 1.0] as const;

interface Scenario {
  readonly id: string;
  readonly label: string;
  /** Thinker group's resolution and bias (Haku: λ 1, δ BASE_OVERCONFIDENCE). */
  readonly lambda: number;
  readonly delta: number;
}

const SCENARIOS: readonly Scenario[] = [
  { id: "null", label: "no difference", lambda: 1, delta: BASE_OVERCONFIDENCE },
  { id: "R-small", label: "resolution λ 0.75", lambda: 0.75, delta: BASE_OVERCONFIDENCE },
  { id: "R-medium", label: "resolution λ 0.5", lambda: 0.5, delta: BASE_OVERCONFIDENCE },
  { id: "O-small", label: "bias δ +0.4", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.4 },
  { id: "O-medium", label: "bias δ +0.8", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.8 },
  { id: "mixed", label: "λ 0.75 and δ +0.4", lambda: 0.75, delta: BASE_OVERCONFIDENCE + 0.4 },
];

/** [Haku, Thinker] per group: planned 210 = 3 x 70 (SPEC/09 revision (au); Thinker cells pooled for H2), ~30 % attrition, half the plan. Was [35, 65], [49, 91], [70, 130] for n = 200. */
const SAMPLE_SIZES: readonly (readonly [number, number])[] = [[35, 70], [49, 98], [70, 140]];
/** L2/L3 items per participant in the primary window: 3-item freezes (1 L2/L3 each) vs 6-item freezes (4 each). */
const ITEM_COUNTS: readonly number[] = [4, 16];

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

class Rng {
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

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

function toScale(s: number): number {
  let best: number = CONF_STEPS[0];
  for (const step of CONF_STEPS) if (Math.abs(s - step) < Math.abs(s - best)) best = step;
  return best;
}

interface Dataset {
  /** Per observation: participant index, group (0 Haku, 1 Thinker), confidence 0–1, correct 0/1. */
  readonly pid: Int32Array;
  readonly grp: Uint8Array;
  readonly conf: Float64Array;
  readonly y: Uint8Array;
  readonly participants: number;
}

function simulate(rng: Rng, nHaku: number, nThinker: number, items: number, sc: Scenario): Dataset {
  const b = Array.from({ length: items }, () => SIGMA_ITEM * rng.normal());
  const participants = nHaku + nThinker;
  const n = participants * items;
  const data: Dataset = { pid: new Int32Array(n), grp: new Uint8Array(n), conf: new Float64Array(n), y: new Uint8Array(n), participants };
  let k = 0;
  for (let i = 0; i < participants; i++) {
    const g = i < nHaku ? 0 : 1;
    const lambda = g === 0 ? 1 : sc.lambda;
    const delta = g === 0 ? BASE_OVERCONFIDENCE : sc.delta;
    const theta = SIGMA_ABILITY * rng.normal();
    const u = SIGMA_CONF_BIAS * rng.normal();
    for (let j = 0; j < items; j++) {
      const p = GUESS + (1 - GUESS) * logistic(MU + theta - b[j]!);
      data.pid[k] = i; data.grp[k] = g;
      data.y[k] = rng.uniform() < p ? 1 : 0;
      data.conf[k] = toScale(logistic(lambda * logit(p) + delta + u + SIGMA_CONF_NOISE * rng.normal()));
      k++;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Estimators
// ---------------------------------------------------------------------------

/** Solves the 4×4 system A x = v by Gauss–Jordan with partial pivoting; null if singular. */
function solve4(A: number[][], v: number[]): number[] | null {
  const m = A.map((row, i) => [...row, v[i]!]);
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    if (Math.abs(m[piv]![c]!) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k < 5; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[4]! / row[i]!);
}

function inverse4(A: number[][]): number[][] | null {
  const cols: number[][] = [];
  for (let c = 0; c < 4; c++) {
    const col = solve4(A, [0, 1, 2, 3].map((i) => (i === c ? 1 : 0)));
    if (!col) return null;
    cols.push(col);
  }
  return [0, 1, 2, 3].map((r) => cols.map((col) => col[r]!));
}

/** GLM× p-value for the conf × group interaction (cluster-robust Wald z), or null if the fit failed. */
function glmInteractionP(d: Dataset): number | null {
  const n = d.y.length;
  let meanConf = 0;
  for (let k = 0; k < n; k++) meanConf += d.conf[k]!;
  meanConf /= n;
  const row = (k: number) => { const c = d.conf[k]! - meanConf; const g = d.grp[k]!; return [1, c, g, c * g]; };
  let beta = [0, 0, 0, 0];
  for (let iter = 0; iter < 30; iter++) {
    const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
    const grad = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) {
      const x = row(k);
      const mu = logistic(x[0]! * beta[0]! + x[1]! * beta[1]! + x[2]! * beta[2]! + x[3]! * beta[3]!);
      const w = mu * (1 - mu);
      for (let a = 0; a < 4; a++) {
        grad[a]! += x[a]! * (d.y[k]! - mu);
        for (let c = 0; c < 4; c++) A[a]![c]! += w * x[a]! * x[c]!;
      }
    }
    const step = solve4(A, grad);
    if (!step) return null;
    beta = beta.map((v, i) => v + step[i]!);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  if (!beta.every(Number.isFinite)) return null;
  const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const scores = Array.from({ length: d.participants }, () => [0, 0, 0, 0]);
  for (let k = 0; k < n; k++) {
    const x = row(k);
    const mu = logistic(x[0]! * beta[0]! + x[1]! * beta[1]! + x[2]! * beta[2]! + x[3]! * beta[3]!);
    const w = mu * (1 - mu);
    const s = scores[d.pid[k]!]!;
    for (let a = 0; a < 4; a++) {
      s[a]! += x[a]! * (d.y[k]! - mu);
      for (let c = 0; c < 4; c++) A[a]![c]! += w * x[a]! * x[c]!;
    }
  }
  const Ainv = inverse4(A);
  if (!Ainv) return null;
  const B = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (const s of scores) for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) B[a]![c]! += s[a]! * s[c]!;
  const G = d.participants;
  // Var(β̂_3) = (A⁻¹ B A⁻¹)_33 · G/(G−1)
  let v33 = 0;
  for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) v33 += Ainv[3]![a]! * B[a]![c]! * Ainv[c]![3]!;
  v33 *= G / (G - 1);
  if (!(v33 > 0)) return null;
  const z = beta[3]! / Math.sqrt(v33);
  return 2 * (1 - normalCdf(Math.abs(z)));
}

function perParticipant(d: Dataset): { brier: number[][]; gap: number[][] } {
  const sumSq = new Float64Array(d.participants), sumC = new Float64Array(d.participants), sumY = new Float64Array(d.participants), cnt = new Float64Array(d.participants);
  const grpOf = new Uint8Array(d.participants);
  for (let k = 0; k < d.y.length; k++) {
    const i = d.pid[k]!;
    grpOf[i] = d.grp[k]!;
    sumSq[i]! += (d.conf[k]! - d.y[k]!) ** 2; sumC[i]! += d.conf[k]!; sumY[i]! += d.y[k]!; cnt[i]! += 1;
  }
  const brier: number[][] = [[], []], gap: number[][] = [[], []];
  for (let i = 0; i < d.participants; i++) {
    brier[grpOf[i]!]!.push(sumSq[i]! / cnt[i]!);
    gap[grpOf[i]!]!.push((sumC[i]! - sumY[i]!) / cnt[i]!);
  }
  return { brier, gap };
}

function welchP(a: readonly number[], b: readonly number[]): number {
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

function normalCdf(z: number): number {
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
// The grid
// ---------------------------------------------------------------------------

function cellSeed(base: number, ...parts: number[]): number {
  let h = base >>> 0;
  for (const p of parts) h = splitmix32(h ^ Math.imul(p + 1, 0x27d4eb2d))();
  return h;
}

/** Population effect in natural units (large deterministic sample): Thinker − Haku in mean Brier and mean gap. */
function populationEffect(sc: Scenario, seed: number): { dBrier: number; dGap: number; acc: number; gapHaku: number } {
  const rng = new Rng(seed);
  let acc = 0, accN = 0;
  const sums = [[0, 0], [0, 0]];
  for (let rep = 0; rep < 40; rep++) {
    const d = simulate(rng, 500, 500, 16, sc);
    const pp = perParticipant(d);
    for (let k = 0; k < d.y.length; k++) { acc += d.y[k]!; accN++; }
    for (const g of [0, 1]) { sums[g]![0]! += pp.brier[g]!.reduce((s, v) => s + v, 0) / 500; sums[g]![1]! += pp.gap[g]!.reduce((s, v) => s + v, 0) / 500; }
  }
  return { dBrier: (sums[1]![0]! - sums[0]![0]!) / 40, dGap: (sums[1]![1]! - sums[0]![1]!) / 40, acc: acc / accN, gapHaku: sums[0]![1]! / 40 };
}

function argValue(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function main(): void {
  const reps = argValue("--reps", 1000);
  const seed = argValue("--seed", 20261002);
  const pct = (x: number) => `${(100 * x).toFixed(0)} %`;
  console.log(`H2 power simulation — ${reps} replicates per cell, seed ${seed}, α = .05 two-sided\n`);
  console.log("| Scenario | Thinker − Haku: ΔBrier, Δgap (population) |");
  console.log("|---|---|");
  SCENARIOS.forEach((sc, si) => {
    const e = populationEffect(sc, cellSeed(seed, 99, si));
    console.log(`| ${sc.id} (${sc.label}) | ${e.dBrier >= 0 ? "+" : ""}${e.dBrier.toFixed(3)}, ${e.dGap >= 0 ? "+" : ""}${e.dGap.toFixed(3)} (Haku gap ${e.gapHaku.toFixed(3)}, accuracy ${e.acc.toFixed(2)}) |`);
  });
  console.log("\n| Scenario | N Haku/Thinker | Items | GLM× | Brier | Gap |");
  console.log("|---|---|---|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    SAMPLE_SIZES.forEach(([nH, nT], ni) => {
      for (const items of ITEM_COUNTS) {
        const rng = new Rng(cellSeed(seed, si, ni, items));
        let glm = 0, brier = 0, gap = 0, failed = 0;
        for (let r = 0; r < reps; r++) {
          const d = simulate(rng, nH, nT, items, sc);
          const p = glmInteractionP(d);
          if (p === null) failed++; else if (p < 0.05) glm++;
          const pp = perParticipant(d);
          if (welchP(pp.brier[0]!, pp.brier[1]!) < 0.05) brier++;
          if (welchP(pp.gap[0]!, pp.gap[1]!) < 0.05) gap++;
        }
        const note = failed > 0 ? ` (${failed} fits failed)` : "";
        console.log(`| ${sc.id} | ${nH}/${nT} | ${items} | ${pct(glm / reps)}${note} | ${pct(brier / reps)} | ${pct(gap / reps)} |`);
      }
    });
  });
}

main();
