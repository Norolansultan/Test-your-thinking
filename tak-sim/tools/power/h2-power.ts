/**
 * H2 power by Monte Carlo — SPEC/09 Amendment 2 Oct 2026; re-cut for SPEC/30 §6 and §11 (19 Oct 2026).
 *
 *   npx tsx tools/power/h2-power.ts [--reps 1000] [--seed 20261002]
 *
 * What changed on 19 Oct 2026 (SPEC/30, two groups, 100 participants) and why:
 *   - groups: Haku (`radio`) against the guide (`reasoning_intent`) only, 50 / 50, and 40 / 40 after
 *     20 % attrition; 70 / 140 (the 11 Oct three-cell plan, Thinker cells pooled) stays as a
 *     reference row and keeps its cell seeds, so its 16-item rows reproduce the 11 Oct run;
 *   - items: two more L3 items in each phase-A freeze (SPEC/30 §5.1) grow H2's window from 16 to
 *     24 L2/L3 items; both counts are run (16 is the fallback if the new items fail review);
 *   - primary: H2 is now the overconfidence gap (mean confidence − proportion correct), so the gap
 *     estimator is listed first; the confidence × group interaction (GLM×) becomes H2r (resolution);
 *   - H2t (SPEC/30 §5.3, §6): a family of scenarios in which the AI states some items' keys to the
 *     guide group; the gap test is run on all items and on the not-stated items only.
 *   - the shared generators and tests moved to `power-lib.ts`; GLM× uses its clustered fit (same model).
 *
 * Data-generating process (assumptions, not pilot values — SPEC/09 §8 still requires the
 * pilot-based simulation):
 *   item bank   b_j ~ N(0, SIGMA_ITEM²), drawn once per replicate, the same items for everyone;
 *   participant θ_i ~ N(0, SIGMA_ABILITY²), confidence bias u_i ~ N(0, SIGMA_CONF_BIAS²);
 *   accuracy    p_ij = GUESS + (1 − GUESS)·logistic(MU + θ_i − b_j), four-option items (chance 25 %);
 *   confidence  s_ij = logistic(λ_g·logit(p_ij) + δ_g + u_i + ε_ij), ε ~ N(0, SIGMA_CONF_NOISE²),
 *               reported on the instrument's 25/50/75/100 scale (nearest step);
 *   group g     Haku: λ = 1, δ = BASE_OVERCONFIDENCE; guide: per scenario.
 * λ is resolution (how well confidence tracks the item's real chance); δ is bias (overconfidence).
 * In the six calibration scenarios accuracy is the same in both groups (H1 is a separate test).
 *
 * H2t family: each guide-group item is "stated" (`aiStatedKey`: an AI answer shown before the freeze
 * stated its key) with probability STATED_SHARE, independently of the item and the participant (a
 * pessimistic share: SPEC/30 §5.3 rewrites items stated in > 15 % of guide sessions). On a stated
 * item the guide participant is more accurate (logit + STATED_ACC_SHIFT) and, through λ·logit(p),
 * more confident, with the scenario's stated-item bias; the overconfidence effect sits only in the
 * not-stated items. Haku is assumed never to state an L2/L3 key (it returns records, not
 * comprehension), so all its items are not-stated. T-cancel is set so that the stated items'
 * lagging confidence offsets the not-stated overconfidence: pooling over all items hides it.
 *
 * Estimators, each two-sided at α = .05:
 *   Gap    — H2, primary: per-participant gap (mean conf − proportion correct), Welch t; the stand-in
 *            for SPEC/30's participant-level model with item random effects. H2t: the same on the
 *            participant's not-stated items only.
 *   GLM×   — H2r: item-level logistic model correct ~ conf × group, conf centred, cluster-robust
 *            (participant) sandwich SE, Wald z on the interaction (no item random effect).
 *   Brier  — per-participant Brier score, Welch t-test between groups.
 *
 * Deterministic: a seeded xoshiro128** stream per grid cell; no Math.random, no clock.
 */

import { Rng, argValue, cellSeed, clusteredLogitP, logistic, logit, pct, signed, welchP } from "./power-lib.js";

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
/** H2t: share of a guide participant's L2/L3 items whose key the AI stated before the freeze. */
const STATED_SHARE = 0.3;
/** H2t: accuracy gain on a stated item (logit): ≈ .62 → ≈ .82 at the mean. */
const STATED_ACC_SHIFT = 1.5;
/** T-cancel: stated-item bias, below Haku's, chosen so the pooled population Δgap is ≈ 0. */
const CANCEL_STATED_DELTA = BASE_OVERCONFIDENCE - 0.9;

interface Stated {
  readonly share: number;
  readonly accShift: number;
  /** Confidence bias on the stated items. */
  readonly delta: number;
}

interface Scenario {
  readonly id: string;
  readonly label: string;
  /** Guide group's resolution and bias on not-stated items (Haku: λ 1, δ BASE_OVERCONFIDENCE). */
  readonly lambda: number;
  readonly delta: number;
  /** H2t: what the AI stated to the guide group; absent = no key stated. */
  readonly stated?: Stated;
}

/** The calibration scenarios of 2 Oct 2026; their order is their cell-seed index. */
const SCENARIOS: readonly Scenario[] = [
  { id: "null", label: "no difference", lambda: 1, delta: BASE_OVERCONFIDENCE },
  { id: "R-small", label: "resolution λ 0.75", lambda: 0.75, delta: BASE_OVERCONFIDENCE },
  { id: "R-medium", label: "resolution λ 0.5", lambda: 0.5, delta: BASE_OVERCONFIDENCE },
  { id: "O-small", label: "bias δ +0.4", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.4 },
  { id: "O-medium", label: "bias δ +0.8", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.8 },
  { id: "mixed", label: "λ 0.75 and δ +0.4", lambda: 0.75, delta: BASE_OVERCONFIDENCE + 0.4 },
];

const STATED_CALIBRATED: Stated = { share: STATED_SHARE, accShift: STATED_ACC_SHIFT, delta: BASE_OVERCONFIDENCE };

/** H2t family (SPEC/30 §5.3): 30 % of the guide group's items stated; seeds offset by H2T_SEED_OFFSET. */
const H2T_SCENARIOS: readonly Scenario[] = [
  { id: "T-null", label: "stated 30 %, no overconfidence", lambda: 1, delta: BASE_OVERCONFIDENCE, stated: STATED_CALIBRATED },
  { id: "T-small", label: "stated 30 %, not-stated δ +0.4", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.4, stated: STATED_CALIBRATED },
  { id: "T-medium", label: "stated 30 %, not-stated δ +0.8", lambda: 1, delta: BASE_OVERCONFIDENCE + 0.8, stated: STATED_CALIBRATED },
  {
    id: "T-cancel",
    label: "not-stated δ +0.4, stated δ −0.9",
    lambda: 1,
    delta: BASE_OVERCONFIDENCE + 0.4,
    stated: { share: STATED_SHARE, accShift: STATED_ACC_SHIFT, delta: CANCEL_STATED_DELTA },
  },
];
const H2T_SEED_OFFSET = 10;

/**
 * Haku / guide (SPEC/30 §2: 100 = 50 : 50; 20 % attrition 40 : 40) and the 11 Oct reference
 * (210 = 3 × 70, Thinker cells pooled). `key` is the cell-seed index: 2 is the index 70 / 140 had
 * on 11 Oct, so the reference row reproduces that run.
 */
const SAMPLE_SIZES: readonly { readonly label: string; readonly nHaku: number; readonly nGuide: number; readonly key: number }[] = [
  { label: "50/50", nHaku: 50, nGuide: 50, key: 3 },
  { label: "40/40", nHaku: 40, nGuide: 40, key: 4 },
  { label: "70/140 (ref.)", nHaku: 70, nGuide: 140, key: 2 },
];
/** L2/L3 items per participant in the primary window: 6-item freezes (16) and 8-item freezes (24, SPEC/30 §5.1). */
const ITEM_COUNTS: readonly number[] = [16, 24];

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

function toScale(s: number): number {
  let best: number = CONF_STEPS[0];
  for (const step of CONF_STEPS) if (Math.abs(s - step) < Math.abs(s - best)) best = step;
  return best;
}

interface Dataset {
  /** Per observation: participant index, group (0 Haku, 1 guide), confidence 0–1, correct 0/1, key stated 0/1. */
  readonly pid: Int32Array;
  readonly grp: Uint8Array;
  readonly conf: Float64Array;
  readonly y: Uint8Array;
  readonly stated: Uint8Array;
  readonly participants: number;
}

function simulate(rng: Rng, nHaku: number, nGuide: number, items: number, sc: Scenario): Dataset {
  const b = Array.from({ length: items }, () => SIGMA_ITEM * rng.normal());
  const participants = nHaku + nGuide;
  const n = participants * items;
  const data: Dataset = { pid: new Int32Array(n), grp: new Uint8Array(n), conf: new Float64Array(n), y: new Uint8Array(n), stated: new Uint8Array(n), participants };
  let k = 0;
  for (let i = 0; i < participants; i++) {
    const g = i < nHaku ? 0 : 1;
    const lambda = g === 0 ? 1 : sc.lambda;
    const delta = g === 0 ? BASE_OVERCONFIDENCE : sc.delta;
    const stated = g === 1 ? sc.stated : undefined;
    const theta = SIGMA_ABILITY * rng.normal();
    const u = SIGMA_CONF_BIAS * rng.normal();
    for (let j = 0; j < items; j++) {
      // Drawn only when the scenario states keys, so the calibration scenarios keep their streams.
      const st = stated !== undefined && rng.uniform() < stated.share ? stated : undefined;
      const p = GUESS + (1 - GUESS) * logistic(MU + theta - b[j]! + (st ? st.accShift : 0));
      data.pid[k] = i; data.grp[k] = g; data.stated[k] = st ? 1 : 0;
      data.y[k] = rng.uniform() < p ? 1 : 0;
      data.conf[k] = toScale(logistic(lambda * logit(p) + (st ? st.delta : delta) + u + SIGMA_CONF_NOISE * rng.normal()));
      k++;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Estimators
// ---------------------------------------------------------------------------

/** GLM× (H2r) p-value for the conf × group interaction (cluster-robust Wald z), or null if the fit failed. */
function glmInteractionP(d: Dataset): number | null {
  const n = d.y.length;
  let meanConf = 0;
  for (let k = 0; k < n; k++) meanConf += d.conf[k]!;
  meanConf /= n;
  const X = Array.from({ length: n }, (_, k) => { const c = d.conf[k]! - meanConf; const g = d.grp[k]!; return [1, c, g, c * g]; });
  return clusteredLogitP(X, d.y, d.pid, d.participants, 3);
}

interface PerParticipant {
  /** Per group [Haku, guide]: Brier score, gap on all items, gap on not-stated items. */
  readonly brier: number[][];
  readonly gap: number[][];
  readonly gapNotStated: number[][];
}

function perParticipant(d: Dataset): PerParticipant {
  const P = d.participants;
  const sumSq = new Float64Array(P), sumC = new Float64Array(P), sumY = new Float64Array(P), cnt = new Float64Array(P);
  const nsC = new Float64Array(P), nsY = new Float64Array(P), nsCnt = new Float64Array(P);
  const grpOf = new Uint8Array(P);
  for (let k = 0; k < d.y.length; k++) {
    const i = d.pid[k]!;
    grpOf[i] = d.grp[k]!;
    sumSq[i]! += (d.conf[k]! - d.y[k]!) ** 2; sumC[i]! += d.conf[k]!; sumY[i]! += d.y[k]!; cnt[i]! += 1;
    if (d.stated[k] === 0) { nsC[i]! += d.conf[k]!; nsY[i]! += d.y[k]!; nsCnt[i]! += 1; }
  }
  const out: PerParticipant = { brier: [[], []], gap: [[], []], gapNotStated: [[], []] };
  for (let i = 0; i < P; i++) {
    const g = grpOf[i]!;
    out.brier[g]!.push(sumSq[i]! / cnt[i]!);
    out.gap[g]!.push((sumC[i]! - sumY[i]!) / cnt[i]!);
    if (nsCnt[i]! > 0) out.gapNotStated[g]!.push((nsC[i]! - nsY[i]!) / nsCnt[i]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Population effects (large deterministic sample, 24 items)
// ---------------------------------------------------------------------------

interface Population {
  readonly dGap: number;
  readonly dGapNotStated: number;
  readonly dBrier: number;
  readonly dAcc: number;
  readonly gapHaku: number;
  readonly accHaku: number;
  /** Guide group's stated items: share of items, accuracy, mean confidence (NaN when none). */
  readonly statedShare: number;
  readonly statedAcc: number;
  readonly statedConf: number;
}

function populationEffect(sc: Scenario, seed: number): Population {
  const rng = new Rng(seed);
  const N = 500, REPS = 40;
  // [group][Brier, gap, gap not-stated, accuracy] summed over participants; stated items: [count, correct, confidence].
  const sums = [[0, 0, 0, 0], [0, 0, 0, 0]];
  const st = [0, 0, 0];
  let guideItems = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const d = simulate(rng, N, N, 24, sc);
    const pp = perParticipant(d);
    for (const g of [0, 1]) {
      const s = sums[g]!;
      const mean = (x: readonly number[]) => x.reduce((a, v) => a + v, 0) / x.length;
      s[0]! += mean(pp.brier[g]!); s[1]! += mean(pp.gap[g]!); s[2]! += mean(pp.gapNotStated[g]!);
    }
    for (let k = 0; k < d.y.length; k++) {
      sums[d.grp[k]!]![3]! += d.y[k]! / (N * 24);
      if (d.grp[k] === 1) { guideItems++; if (d.stated[k] === 1) { st[0]!++; st[1]! += d.y[k]!; st[2]! += d.conf[k]!; } }
    }
  }
  const diff = (c: number) => (sums[1]![c]! - sums[0]![c]!) / REPS;
  return {
    dBrier: diff(0), dGap: diff(1), dGapNotStated: diff(2), dAcc: diff(3),
    gapHaku: sums[0]![1]! / REPS, accHaku: sums[0]![3]! / REPS,
    statedShare: st[0]! / guideItems, statedAcc: st[1]! / st[0]!, statedConf: st[2]! / st[0]!,
  };
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

function main(): void {
  const reps = argValue("--reps", 1000);
  const seed = argValue("--seed", 20261002);
  console.log(`H2 power simulation (SPEC/30) — ${reps} replicates per cell, seed ${seed}, α = .05 two-sided\n`);
  console.log("Population effects, guide − Haku (500 + 500 participants × 40 replicates, 24 items):\n");
  console.log("| Scenario | Δgap, all items | Δgap, not-stated items | ΔBrier | Δaccuracy | Haku gap, accuracy | Guide stated items: share, accuracy, confidence |");
  console.log("|---|---|---|---|---|---|---|");
  const all: readonly (readonly [Scenario, number])[] = [...SCENARIOS.map((sc, si) => [sc, si] as const), ...H2T_SCENARIOS.map((sc, ti) => [sc, H2T_SEED_OFFSET + ti] as const)];
  for (const [sc, si] of all) {
    const e = populationEffect(sc, cellSeed(seed, 99, si));
    const stated = sc.stated ? `${e.statedShare.toFixed(2)}, ${e.statedAcc.toFixed(2)}, ${e.statedConf.toFixed(2)}` : "—";
    console.log(`| ${sc.id} (${sc.label}) | ${signed(e.dGap)} | ${signed(e.dGapNotStated)} | ${signed(e.dBrier)} | ${signed(e.dAcc)} | ${e.gapHaku.toFixed(3)}, ${e.accHaku.toFixed(2)} | ${stated} |`);
  }

  console.log("\nPower, calibration scenarios (no key stated):\n");
  console.log("| Scenario | N Haku/guide | Items | Gap (H2, primary) | GLM× (H2r) | Brier |");
  console.log("|---|---|---|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    for (const ns of SAMPLE_SIZES) {
      for (const items of ITEM_COUNTS) {
        const rng = new Rng(cellSeed(seed, si, ns.key, items));
        let glm = 0, brier = 0, gap = 0, failed = 0;
        for (let r = 0; r < reps; r++) {
          const d = simulate(rng, ns.nHaku, ns.nGuide, items, sc);
          const p = glmInteractionP(d);
          if (p === null) failed++; else if (p < 0.05) glm++;
          const pp = perParticipant(d);
          if (welchP(pp.brier[0]!, pp.brier[1]!) < 0.05) brier++;
          if (welchP(pp.gap[0]!, pp.gap[1]!) < 0.05) gap++;
        }
        const note = failed > 0 ? ` (${failed} fits failed)` : "";
        console.log(`| ${sc.id} | ${ns.label} | ${items} | ${pct(gap / reps)} | ${pct(glm / reps)}${note} | ${pct(brier / reps)} |`);
      }
    }
  });

  console.log(`\nPower, H2t family (${(100 * STATED_SHARE).toFixed(0)} % of the guide group's items stated by the AI):\n`);
  console.log("| Scenario | N Haku/guide | Items | Gap, all items (H2) | Gap, not-stated items (H2t) |");
  console.log("|---|---|---|---|---|");
  H2T_SCENARIOS.forEach((sc, ti) => {
    for (const ns of SAMPLE_SIZES) {
      for (const items of ITEM_COUNTS) {
        const rng = new Rng(cellSeed(seed, H2T_SEED_OFFSET + ti, ns.key, items));
        let gapAll = 0, gapNot = 0;
        for (let r = 0; r < reps; r++) {
          const pp = perParticipant(simulate(rng, ns.nHaku, ns.nGuide, items, sc));
          if (welchP(pp.gap[0]!, pp.gap[1]!) < 0.05) gapAll++;
          if (welchP(pp.gapNotStated[0]!, pp.gapNotStated[1]!) < 0.05) gapNot++;
        }
        console.log(`| ${sc.id} | ${ns.label} | ${items} | ${pct(gapAll / reps)} | ${pct(gapNot / reps)} |`);
      }
    }
  });
}

main();
