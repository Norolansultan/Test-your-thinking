/**
 * Paper 2 power by Monte Carlo — SPEC/27 §6 (4 Oct 2026); re-cut for SPEC/30 §6 and §11 (19 Oct 2026).
 *
 *   npx tsx tools/power/paper2-power.ts [--reps 1000] [--seed 20261004]
 *
 * Question: with one posture per participant per keyed view, how much power do Paper 2's tests have
 * for the guide (`reasoning_intent`, "S": the Open Thinker with the leader's intent and the premise
 * check) against Haku (`radio`, the control) at SPEC/30's 50 / 50, and at 40 / 40 after attrition?
 *
 * What changed on 19 Oct 2026 (SPEC/30, two groups, 100 participants) and why:
 *   - contrast: guide against Haku (SPEC/30 §2, §6: the package claim); `reasoning_once` is no longer
 *     allocated, so the T-vs-S rows are gone; 50 / 50 and 40 / 40 (20 % attrition), with 70 / 70 kept
 *     as the reference size of the 11 Oct runs;
 *   - views: as built in round 2 only, no-fit V9, V10, V14 (bases .25, .30, .30) and fit V11–V13; the
 *     2- and 4-no-fit-view designs of 4 Oct are dropped;
 *   - manipulation: the deterministic premise check (SPEC/30 §3) replaces the model-rated `linjaus`
 *     verdict. The status shown comes from the panel's premise-evidence table, so it is correct with
 *     probability 1.0 (pCorrect, δ_wrong and the wrong-AI row are dropped). Exposure is now "asked for
 *     a decision answer before the plan and saw the premise line", run at .6 (the old planning value)
 *     and .8 (what the consult notification of SPEC/30 §4 is meant to reach), each with δ 1.0 and 1.5;
 *     the compliance amplifier (the guide carries the directive in every answer) stays;
 *   - estimators: GLM-C (H13), a fit-view aligned test (H14, missing from earlier runs: `27` y.4 "not
 *     reconciled") and GLM-int (H15); Share-C is dropped;
 *   - the generators, tests and the clustered fit moved to `power-lib.ts` (unchanged).
 *
 * Data-generating process (assumptions, not pilot values; SPEC/27 §6 lists them and why):
 *   participant  u_i ~ N(0, SIGMA_U²): a propensity to attack the edge (logit scale), the same in
 *                every view of the participant (the participant random intercept);
 *   phase A      7 views, P(direct_attack) = logistic(A0 + LAMBDA_A·u_i); the participant's share
 *                enters every model as the phase-A covariate (SPEC/09 revision (t));
 *   no-fit view  P(direct_attack) = logistic(b_v + u_i + effect); a direct attack is on the new
 *                front's sector with probability P_SECTOR (C), otherwise elsewhere (D);
 *   fit view     P(aligned) = logistic(F_BASE − u_i + effect) (A); the rest is D;
 *   guide (S)    in each keyed phase-B view, exposure e ~ Bern(pExp). An exposed no-fit view shows a
 *                contradicted premise and moves the posture toward attack by δ; an exposed fit view
 *                shows "no newest record contradicts P1 or P2" and moves it toward aligned by δ (the
 *                same δ, as SPEC/27 §6 assumed for a right verdict). GAMMA is a compliance push toward
 *                aligned in every phase-B view of every guide participant;
 *   Haku (H)     no effect: Haku's base rates are the ones above (as `reasoning_once`'s were).
 *
 * Estimators, each two-sided at α = .05 (participant-clustered logistic models, sandwich SE, Wald z;
 * population-averaged stand-ins for the mixed models, as in `h2-power.ts`):
 *   GLM-C   — H13: no-fit views, C ~ group + view + phase-A share; target group.
 *   GLM-A   — H14: fit views, aligned ~ group + view + phase-A share; target group.
 *   GLM-int — H15: every keyed view, aligned ~ group + group×fit + view + phase-A share; target group×fit.
 *
 * Deterministic: a seeded xoshiro128** stream per grid cell; no unseeded randomness, no clock.
 */

import { Rng, argValue, cellSeed, clusteredLogitP, logistic, logit, pct } from "./power-lib.js";

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

const SIGMA_U = 1.0; // participant SD on the logit scale (ICC ≈ .23 on the latent scale)
const A0 = 0.4; // phase A: P(direct_attack) ≈ .58 at u = 0 under the offensive intent
const LAMBDA_A = 0.8; // how strongly phase-A posture reflects the same propensity
const PHASE_A_VIEWS = 7;
const P_SECTOR = 0.85; // a direct attack in a no-fit view is on the new front's sector (C)
/** No-fit views as built in round 2: V9 (front not mapped, no crew there), V10 (crews back south), V14 (the second rekindle). */
const NOFIT_BASES: readonly number[] = [logit(0.25), logit(0.3), logit(0.3)];
/** Fit views V11–V13: P(aligned) ≈ .88 at u = 0 (the ceiling risk of SPEC/09 revision (t)). */
const F_BASE = logit(0.88);
const FIT_VIEWS = 3;

interface Scenario {
  readonly id: string;
  readonly label: string;
  /** Guide group: P(saw the premise line before the plan) per keyed view. */
  readonly pExp: number;
  /** Shift of an exposed view toward the sound side (logit). The line is always correct (the table). */
  readonly delta: number;
  /** Compliance push toward aligned in every phase-B view (logit). */
  readonly gamma: number;
}

const SCENARIOS: readonly Scenario[] = [
  { id: "null", label: "no effect", pExp: 0.8, delta: 0, gamma: 0 },
  { id: "check-.6-1.0", label: "premise check, exp .6, δ 1.0", pExp: 0.6, delta: 1.0, gamma: 0 },
  { id: "check-.6-1.5", label: "premise check, exp .6, δ 1.5", pExp: 0.6, delta: 1.5, gamma: 0 },
  { id: "check-.8-1.0", label: "premise check, exp .8 (notification), δ 1.0", pExp: 0.8, delta: 1.0, gamma: 0 },
  { id: "check-.8-1.5", label: "premise check, exp .8 (notification), δ 1.5", pExp: 0.8, delta: 1.5, gamma: 0 },
  { id: "amplifier", label: "compliance push γ 0.7, no check effect", pExp: 0.8, delta: 0, gamma: 0.7 },
];

/** [Haku, guide]: SPEC/30 §2 (100 = 50 : 50), 20 % attrition, and the 11 Oct reference size. */
const SAMPLE_SIZES: readonly { readonly label: string; readonly nControl: number; readonly nS: number }[] = [
  { label: "H 50 / S 50", nControl: 50, nS: 50 },
  { label: "H 40 / S 40", nControl: 40, nS: 40 },
  { label: "H 70 / S 70 (ref.)", nControl: 70, nS: 70 },
];

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

/** One keyed phase-B view's outcome for one participant. */
interface Obs {
  readonly pid: number;
  readonly s: number; // 1 = guide group
  readonly view: number; // index into [no-fit views..., fit views...]
  readonly fit: number; // 1 = the directive fits
  readonly aligned: number; // barrier_line or protect_values
  readonly c: number; // justified departure (no-fit views only)
  readonly baseA: number; // the participant's phase-A share of direct_attack
}

interface Dataset {
  readonly obs: readonly Obs[];
  readonly participants: number;
}

/** The premise line's shift in one view for a guide participant (positive = toward the sound side). */
function checkShift(rng: Rng, sc: Scenario): number {
  return rng.bern(sc.pExp) ? sc.delta : 0;
}

function simulate(rng: Rng, nControl: number, nS: number, sc: Scenario): Dataset {
  const obs: Obs[] = [];
  const participants = nControl + nS;
  for (let i = 0; i < participants; i++) {
    const s = i < nControl ? 0 : 1;
    const u = SIGMA_U * rng.normal();
    let directA = 0;
    for (let v = 0; v < PHASE_A_VIEWS; v++) if (rng.bern(logistic(A0 + LAMBDA_A * u))) directA++;
    const baseA = directA / PHASE_A_VIEWS;
    NOFIT_BASES.forEach((b, v) => {
      // No-fit: the sound side is a direct attack on the new front; the compliance push works against it.
      const eff = s === 1 ? checkShift(rng, sc) - sc.gamma : 0;
      const direct = rng.bern(logistic(b + u + eff));
      const c = direct && rng.bern(P_SECTOR) ? 1 : 0;
      obs.push({ pid: i, s, view: v, fit: 0, aligned: direct ? 0 : 1, c, baseA });
    });
    for (let f = 0; f < FIT_VIEWS; f++) {
      // Fit: the sound side is aligned; the compliance push works with it.
      const eff = s === 1 ? checkShift(rng, sc) + sc.gamma : 0;
      const aligned = rng.bern(logistic(F_BASE - u + eff)) ? 1 : 0;
      obs.push({ pid: i, s, view: NOFIT_BASES.length + f, fit: 1, aligned, c: 0, baseA });
    }
  }
  return { obs, participants };
}

// ---------------------------------------------------------------------------
// Estimators
// ---------------------------------------------------------------------------

/** View dummies for `views` views starting at index `first` (the first is the reference). */
const viewDummies = (o: Obs, first: number, views: number) => Array.from({ length: views - 1 }, (_, j) => (o.view === first + j + 1 ? 1 : 0));

/** GLM-C (H13): no-fit views only; C ~ 1 + S + view dummies + phase-A share. Target: S. */
function glmCP(d: Dataset): number | null {
  const rows = d.obs.filter((o) => o.fit === 0);
  const X = rows.map((o) => [1, o.s, ...viewDummies(o, 0, NOFIT_BASES.length), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map((o) => o.c), rows.map((o) => o.pid), d.participants, 1);
}

/** GLM-A (H14): fit views only; aligned ~ 1 + S + view dummies + phase-A share. Target: S. */
function glmAP(d: Dataset): number | null {
  const rows = d.obs.filter((o) => o.fit === 1);
  const X = rows.map((o) => [1, o.s, ...viewDummies(o, NOFIT_BASES.length, FIT_VIEWS), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map((o) => o.aligned), rows.map((o) => o.pid), d.participants, 1);
}

/** GLM-int (H15): every keyed view; aligned ~ 1 + S + S×fit + view dummies + phase-A share. Target: S×fit. */
function glmIntP(d: Dataset): number | null {
  const X = d.obs.map((o) => [1, o.s, o.s * o.fit, ...viewDummies(o, 0, NOFIT_BASES.length + FIT_VIEWS), o.baseA - 0.5]);
  return clusteredLogitP(X, d.obs.map((o) => o.aligned), d.obs.map((o) => o.pid), d.participants, 2);
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

/** Population shares (large deterministic sample): C in the no-fit views and A in the fit views, per group. */
function populationShares(sc: Scenario, seed: number): { cH: number; cS: number; aH: number; aS: number } {
  const rng = new Rng(seed);
  const n = 20000;
  const d = simulate(rng, n, n, sc);
  const tot = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (const o of d.obs) {
    const t = tot[o.s]!;
    if (o.fit === 0) { t[0]! += o.c; t[1]! += 1; } else { t[2]! += o.aligned; t[3]! += 1; }
  }
  return { cH: tot[0]![0]! / tot[0]![1]!, cS: tot[1]![0]! / tot[1]![1]!, aH: tot[0]![2]! / tot[0]![3]!, aS: tot[1]![2]! / tot[1]![3]! };
}

function main(): void {
  const reps = argValue("--reps", 1000);
  const seed = argValue("--seed", 20261004);
  const share = (x: number) => (100 * x).toFixed(1);
  const pts = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1)}`;
  console.log(`Paper 2 power simulation (SPEC/30) — ${reps} replicates per cell, seed ${seed}, α = .05 two-sided\n`);
  console.log("Population shares, Haku → guide (20 000 + 20 000 participants):\n");
  console.log("| Scenario | C in V9, V10, V14 (%) | A in V11–V13 (%) |");
  console.log("|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    const e = populationShares(sc, cellSeed(seed, 99, si));
    console.log(`| ${sc.id} (${sc.label}) | ${share(e.cH)} → ${share(e.cS)} (${pts(e.cS - e.cH)} points) | ${share(e.aH)} → ${share(e.aS)} (${pts(e.aS - e.aH)} points) |`);
  });
  console.log("\nPower, guide (S) vs Haku (H); no-fit V9, V10, V14; fit V11–V13:\n");
  console.log("| Scenario | N | GLM-C (H13, primary) | GLM-A, fit views (H14) | GLM-int (H15) |");
  console.log("|---|---|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    SAMPLE_SIZES.forEach((ns, ni) => {
      const rng = new Rng(cellSeed(seed, si, ni));
      let glmC = 0, glmA = 0, glmInt = 0, failC = 0, failA = 0, failInt = 0;
      for (let r = 0; r < reps; r++) {
        const d = simulate(rng, ns.nControl, ns.nS, sc);
        const pC = glmCP(d);
        if (pC === null) failC++; else if (pC < 0.05) glmC++;
        const pA = glmAP(d);
        if (pA === null) failA++; else if (pA < 0.05) glmA++;
        const pI = glmIntP(d);
        if (pI === null) failInt++; else if (pI < 0.05) glmInt++;
      }
      const note = (f: number) => (f > 0 ? ` (${f} fits failed)` : "");
      console.log(`| ${sc.id} | ${ns.label} | ${pct(glmC / reps)}${note(failC)} | ${pct(glmA / reps)}${note(failA)} | ${pct(glmInt / reps)}${note(failInt)} |`);
    });
  });
}

main();
