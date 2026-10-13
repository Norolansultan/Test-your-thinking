/**
 * Paper 2 power by Monte Carlo — SPEC/27 §6 (4 Oct 2026).
 *
 *   npx tsx tools/power/paper2-power.ts [--reps 1000] [--seed 20261004]
 *
 * Question: with one posture per participant per view, how much power does the primary Paper 2
 * contrast have — justified deviation (cell C: `direct_attack` with the main effort on the new
 * front's sector) in the no-fit views, strategy-guided Thinker (`reasoning_intent`, "S") against
 * Thinker (`reasoning_once`, "T") — at the planned 65 / 65, after 30 % attrition (46 / 46), and
 * against Haku (65 / 70)? And how much do two more no-fit views buy?
 *
 * Data-generating process (assumptions, not pilot values; SPEC/27 §6 lists them and why):
 *   participant  u_i ~ N(0, SIGMA_U²): a propensity to attack the edge (logit scale), the same in
 *                every view of the participant (the participant random intercept);
 *   phase A      7 views, P(direct_attack) = logistic(A0 + LAMBDA_A·u_i); the participant's share
 *                enters every model as the phase-A covariate (SPEC/09 revision (t));
 *   no-fit view  P(direct_attack) = logistic(b_v + u_i + effect); a direct attack is on the new
 *                front's sector with probability P_SECTOR (C), otherwise elsewhere (D);
 *   fit view     P(aligned) = logistic(F_BASE − u_i + effect) (A); the rest is D;
 *   cell S       in each phase-B view, exposure e ~ Bern(pExp): at least one `linjaus` notice that
 *                bears on the posture arrived before the coded plan. An exposed notice is correct
 *                for the view's fit with probability pCorrect. A correct notice moves the posture
 *                toward the sound side by DELTA (no-fit: toward attack; fit: toward aligned); a
 *                wrong one moves it the other way by DELTA_WRONG. GAMMA is a compliance push that
 *                applies to every S participant in every phase-B view (the directive kept in view
 *                in every answer), toward aligned;
 *   cells T, H   no effect (Haku is assumed to behave as T on this measure; SPEC/27 §6 says why).
 *
 * Estimators, each two-sided at α = .05:
 *   GLM-C   — the pre-registered form's stand-in: participant-clustered logistic model on the no-fit
 *             views, C ~ cell + view + phase-A share, cluster-robust (participant) sandwich SE, Wald z
 *             on cell. A population-averaged stand-in for the mixed model (as `h2-power.ts`).
 *   Share-C — per-participant share of C over the no-fit views, Welch t between cells.
 *   GLM-int — every keyed view (no-fit and fit), aligned ~ cell + cell×fit + view + phase-A share,
 *             cluster-robust Wald z on cell×fit (the discrimination contrast, SPEC/27 H15).
 *
 * Deterministic: a seeded xoshiro128** stream per grid cell; no unseeded randomness, no clock.
 */

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

const SIGMA_U = 1.0; // participant SD on the logit scale (ICC ≈ .23 on the latent scale)
const A0 = 0.4; // phase A: P(direct_attack) ≈ .58 at u = 0 under the offensive intent
const LAMBDA_A = 0.8; // how strongly phase-A posture reflects the same propensity
const PHASE_A_VIEWS = 7;
const P_SECTOR = 0.85; // a direct attack in a no-fit view is on the new front's sector (C)
const logit = (p: number) => Math.log(p / (1 - p));
/** Thinker-cell base rates of a direct attack in the no-fit views: V9 (front not mapped, no crew there), V10 (crews already moving there). */
const NOFIT_BASE_CURRENT: readonly number[] = [logit(0.25), logit(0.5)];
/** Two added late no-fit views (SPEC/27 §7.3), assumed harder than V10: base P(direct_attack) .30. */
const NOFIT_BASE_ADDED: readonly number[] = [logit(0.3), logit(0.3)];
/** Fit views V11–V14: P(aligned) ≈ .88 at u = 0 (the ceiling risk of SPEC/09 revision (t)). */
const F_BASE = logit(0.88);
const FIT_VIEWS = 4;

interface Scenario {
  readonly id: string;
  readonly label: string;
  readonly pExp: number;
  readonly pCorrect: number;
  readonly delta: number;
  readonly deltaWrong: number;
  readonly gamma: number;
}

const SCENARIOS: readonly Scenario[] = [
  { id: "null", label: "no effect", pExp: 0.6, pCorrect: 0.8, delta: 0, deltaWrong: 0, gamma: 0 },
  { id: "aid-weak", label: "exp .5, correct .7, δ 1.0", pExp: 0.5, pCorrect: 0.7, delta: 1.0, deltaWrong: 1.0, gamma: 0 },
  { id: "aid-moderate", label: "exp .6, correct .8, δ 1.5", pExp: 0.6, pCorrect: 0.8, delta: 1.5, deltaWrong: 1.0, gamma: 0 },
  { id: "aid-mid", label: "exp .7, correct .85, δ 1.75", pExp: 0.7, pCorrect: 0.85, delta: 1.75, deltaWrong: 1.0, gamma: 0 },
  { id: "aid-strong", label: "exp .8, correct .9, δ 2.0", pExp: 0.8, pCorrect: 0.9, delta: 2.0, deltaWrong: 1.0, gamma: 0 },
  { id: "exp-low", label: "exp .3, correct .8, δ 1.5", pExp: 0.3, pCorrect: 0.8, delta: 1.5, deltaWrong: 1.0, gamma: 0 },
  { id: "exp-high", label: "exp .9, correct .8, δ 1.5", pExp: 0.9, pCorrect: 0.8, delta: 1.5, deltaWrong: 1.0, gamma: 0 },
  { id: "amplifier", label: "compliance push γ 0.7, no aid", pExp: 0.6, pCorrect: 0.8, delta: 0, deltaWrong: 0, gamma: 0.7 },
  { id: "wrong-AI", label: "exp .6, correct .3, δ 1.5", pExp: 0.6, pCorrect: 0.3, delta: 1.5, deltaWrong: 1.5, gamma: 0 },
];

/** [control, S]: planned Thinker vs strategy-guided; after 30 % attrition; S against Haku (H16). */
const SAMPLE_SIZES: readonly { readonly label: string; readonly nControl: number; readonly nS: number }[] = [
  // 210 = 3 x 70 (SPEC/27 revision (au)); was T 65 / S 65, T 46 / S 46, H 70 / S 65 for n = 200.
  { label: "T 70 / S 70", nControl: 70, nS: 70 },
  { label: "T 49 / S 49", nControl: 49, nS: 49 },
  { label: "H 70 / S 70", nControl: 70, nS: 70 },
];

/**
 * The phase-B rebuild round 2 (5 Oct 2026, corpus-rebuild branch): V10 without crews on the new front
 * (they come back south at step 14), so its base is V9's kind, assumed .30 (was .50 with the crews already
 * moving there); V14 becomes a no-fit view (the second rekindle), assumed .30 like the added views above;
 * three fit views remain (V11–V13).
 */
const NOFIT_BASE_BUILT: readonly number[] = [logit(0.25), logit(0.3), logit(0.3)];

/**
 * No-fit views per participant: the design before round 2 (V9, V10), four with two added late misfits,
 * and as built in round 2 (listed last so the first two rows keep their seeds and results).
 */
const NOFIT_DESIGNS: readonly { readonly label: string; readonly bases: readonly number[]; readonly fitViews: number }[] = [
  { label: "2 (V9, V10)", bases: NOFIT_BASE_CURRENT, fitViews: FIT_VIEWS },
  { label: "4 (+2 late)", bases: [...NOFIT_BASE_CURRENT, ...NOFIT_BASE_ADDED], fitViews: FIT_VIEWS },
  { label: "3 (V9, V10, V14; round 2)", bases: NOFIT_BASE_BUILT, fitViews: 3 },
];

// ---------------------------------------------------------------------------
// Seeded randomness (as `h2-power.ts`)
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

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

/** One keyed phase-B view's outcome for one participant. */
interface Obs {
  readonly pid: number;
  readonly s: number; // 1 = strategy-guided cell
  readonly view: number; // index into [no-fit views..., fit views...]
  readonly fit: number; // 1 = the directive fits
  readonly aligned: number; // barrier_line or protect_values
  readonly c: number; // justified deviation (no-fit views only)
  readonly baseA: number; // the participant's phase-A share of direct_attack
}

interface Dataset {
  readonly obs: readonly Obs[];
  readonly participants: number;
  readonly nofitViews: number;
  readonly fitViews: number;
}

/** The shift a cell-S participant's posture gets in one view (positive = toward the sound side). */
function sShift(rng: Rng, sc: Scenario): number {
  let shift = 0;
  if (rng.bern(sc.pExp)) shift += rng.bern(sc.pCorrect) ? sc.delta : -sc.deltaWrong;
  return shift;
}

function simulate(rng: Rng, nControl: number, nS: number, nofitBases: readonly number[], sc: Scenario, fitViews: number = FIT_VIEWS): Dataset {
  const obs: Obs[] = [];
  const participants = nControl + nS;
  for (let i = 0; i < participants; i++) {
    const s = i < nControl ? 0 : 1;
    const u = SIGMA_U * rng.normal();
    let directA = 0;
    for (let v = 0; v < PHASE_A_VIEWS; v++) if (rng.bern(logistic(A0 + LAMBDA_A * u))) directA++;
    const baseA = directA / PHASE_A_VIEWS;
    nofitBases.forEach((b, v) => {
      // No-fit: the sound side is a direct attack; the compliance push works against it.
      const eff = s === 1 ? sShift(rng, sc) - sc.gamma : 0;
      const direct = rng.bern(logistic(b + u + eff));
      const c = direct && rng.bern(P_SECTOR) ? 1 : 0;
      obs.push({ pid: i, s, view: v, fit: 0, aligned: direct ? 0 : 1, c, baseA });
    });
    for (let f = 0; f < fitViews; f++) {
      // Fit: the sound side is aligned; the compliance push works with it.
      const eff = s === 1 ? sShift(rng, sc) + sc.gamma : 0;
      const aligned = rng.bern(logistic(F_BASE - u + eff)) ? 1 : 0;
      obs.push({ pid: i, s, view: nofitBases.length + f, fit: 1, aligned, c: 0, baseA });
    }
  }
  return { obs, participants, nofitViews: nofitBases.length, fitViews };
}

// ---------------------------------------------------------------------------
// Estimators: logistic regression with a participant-clustered sandwich SE
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
 * (separation or a singular information matrix).
 */
function clusteredLogitP(X: readonly (readonly number[])[], y: readonly number[], cluster: readonly number[], clusters: number, target: number): number | null {
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

/** GLM-C: no-fit views only; C ~ 1 + S + view dummies + phase-A share. Target: S. */
function glmCP(d: Dataset): number | null {
  const rows = d.obs.filter((o) => o.fit === 0);
  const X = rows.map((o) => [1, o.s, ...Array.from({ length: d.nofitViews - 1 }, (_, j) => (o.view === j + 1 ? 1 : 0)), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map((o) => o.c), rows.map((o) => o.pid), d.participants, 1);
}

/** GLM-int: every keyed view; aligned ~ 1 + S + S×fit + view dummies + phase-A share. Target: S×fit. */
function glmIntP(d: Dataset): number | null {
  const views = d.nofitViews + d.fitViews;
  const X = d.obs.map((o) => [1, o.s, o.s * o.fit, ...Array.from({ length: views - 1 }, (_, j) => (o.view === j + 1 ? 1 : 0)), o.baseA - 0.5]);
  return clusteredLogitP(X, d.obs.map((o) => o.aligned), d.obs.map((o) => o.pid), d.participants, 2);
}

/** Share-C: per-participant share of C over the no-fit views, Welch t. */
function shareCP(d: Dataset): number {
  const sum = new Float64Array(d.participants), cnt = new Float64Array(d.participants), grp = new Uint8Array(d.participants);
  for (const o of d.obs) if (o.fit === 0) { sum[o.pid]! += o.c; cnt[o.pid]! += 1; grp[o.pid] = o.s; }
  const g: number[][] = [[], []];
  for (let i = 0; i < d.participants; i++) g[grp[i]!]!.push(sum[i]! / cnt[i]!);
  return welchP(g[0]!, g[1]!);
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
// Distributions (as `h2-power.ts`)
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

/** Population shares (large deterministic sample, current two no-fit views): C in no-fit views and A in fit views, per cell. */
function populationShares(sc: Scenario, seed: number): { cT: number; cS: number; aT: number; aS: number } {
  const rng = new Rng(seed);
  const n = 20000;
  const d = simulate(rng, n, n, NOFIT_BASE_CURRENT, sc);
  const tot = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (const o of d.obs) {
    const t = tot[o.s]!;
    if (o.fit === 0) { t[0]! += o.c; t[1]! += 1; } else { t[2]! += o.aligned; t[3]! += 1; }
  }
  return { cT: tot[0]![0]! / tot[0]![1]!, cS: tot[1]![0]! / tot[1]![1]!, aT: tot[0]![2]! / tot[0]![3]!, aS: tot[1]![2]! / tot[1]![3]! };
}

function argValue(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function main(): void {
  const reps = argValue("--reps", 1000);
  const seed = argValue("--seed", 20261004);
  const pct = (x: number) => `${(100 * x).toFixed(0)} %`;
  const share = (x: number) => (100 * x).toFixed(1);
  console.log(`Paper 2 power simulation — ${reps} replicates per cell, seed ${seed}, α = .05 two-sided\n`);
  console.log("| Scenario | C in V9–V10, T → S (%) | A in V11–V14, T → S (%) |");
  console.log("|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    const e = populationShares(sc, cellSeed(seed, 99, si));
    console.log(`| ${sc.id} (${sc.label}) | ${share(e.cT)} → ${share(e.cS)} | ${share(e.aT)} → ${share(e.aS)} |`);
  });
  console.log("\n| Scenario | N | No-fit views | GLM-C | Share-C | GLM-int |");
  console.log("|---|---|---|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    SAMPLE_SIZES.forEach((ns, ni) => {
      NOFIT_DESIGNS.forEach((nd, di) => {
        const rng = new Rng(cellSeed(seed, si, ni, di));
        let glmC = 0, shareC = 0, glmInt = 0, failC = 0, failInt = 0;
        for (let r = 0; r < reps; r++) {
          const d = simulate(rng, ns.nControl, ns.nS, nd.bases, sc, nd.fitViews);
          const pC = glmCP(d);
          if (pC === null) failC++; else if (pC < 0.05) glmC++;
          if (shareCP(d) < 0.05) shareC++;
          const pI = glmIntP(d);
          if (pI === null) failInt++; else if (pI < 0.05) glmInt++;
        }
        const note = (f: number) => (f > 0 ? ` (${f} fits failed)` : "");
        console.log(`| ${sc.id} | ${ns.label} | ${nd.label} | ${pct(glmC / reps)}${note(failC)} | ${pct(shareC / reps)} | ${pct(glmInt / reps)}${note(failInt)} |`);
      });
    });
  });
}

main();

// A module, so its names do not collide with `h2-power.ts` (a script) in the project-wide typecheck.
export {};
