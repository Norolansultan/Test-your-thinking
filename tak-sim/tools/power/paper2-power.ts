/**
 * Paper 2 power by Monte Carlo — SPEC/27 §6 (4 Oct 2026); re-cut for SPEC/30 §6 and §11 (19 Oct 2026); re-run for SPEC/31 §3.12.
 *
 *   npx tsx tools/power/paper2-power.ts [--reps 1000] [--seed 20261004]
 *     [--pdirect 0.25,0.30,0.30] [--hshare 0.25,0.25,0.25] [--mainshare 0.6,0.6,0.5] [--mainok 0.95,0.95,0.75]
 *
 * Question: with one plan per participant per keyed view, how much power do Paper 2's tests have for the guide (`reasoning_intent`,
 * "S": the Open Thinker with the leader's intent and the premise check) against Haku (`radio`, the control) at SPEC/30's 50 / 50, and
 * at 40 / 40 after attrition?
 *
 * 19 Oct 2026 (SPEC/30): guide against Haku, 50 / 50, 40 / 40 and the 70 / 70 reference; no-fit V9, V10, V14 and fit V11–V13; the
 * deterministic premise check (correct with probability 1), exposure .6 / .8, δ 1.0 / 1.5, the compliance amplifier; GLM-C (H13),
 * GLM-A (H14), GLM-int (H15).
 *
 * What changed for SPEC/31 §3.12 (19 Oct 2026) and why:
 *   - **H13 codes the act (§3.1, RC).** A no-fit plan either attends the keyed front or not. An attending plan's act is a main-effort
 *     direct attack, a secondary task labelled direct attack, or a secondary task labelled mop-up or hold-line (share `hshare`). The
 *     label coding (the build's, now the sensitivity) counts the first two; the act coding counts all three. So the C base rate rises
 *     in both groups; δ (on the propensity to attend) is unchanged.
 *   - **V14 only through the secondary route (§3.2, RC).** A main-effort attack on the flare-up codes D; the secondary route needs the
 *     main effort aligned in Lahdenkylä's sector (`mainok`). The old key (main route sound) is printed beside it, for comparison.
 *   - **The fallbacks (§3.3):** a view keyed mixed is reported, not coded — H13 on two no-fit views (V14 mixed: V9, V10), H14 on two fit
 *     views (V11 mixed: V12, V13), H15 on the remaining views.
 *   - **Base rates per view are parameters** (`--pdirect`, `--hshare`, `--mainshare`, `--mainok`, in V9, V10, V14 order): the defaults
 *     are planning values, not data; pilot 2 replaces them (§3.12, `31` §6 item 8) and the tool is re-run before the pre-registration.
 *
 * Data-generating process (assumptions, not pilot values; SPEC/27 §6 lists the rest and why):
 *   participant  u_i ~ N(0, SIGMA_U²): a propensity to attack the edge (logit scale), the same in every view (the participant intercept);
 *   phase A      7 views, P(direct_attack) = logistic(A0 + LAMBDA_A·u_i); the participant's share is the phase-A covariate;
 *   no-fit view  P(attend) = logistic(logit(pdirect_v / (1 − hshare_v)) + u_i + effect): `pdirect` is the old base rate of a plan
 *                that attacks the front by its label, at u = 0. An attending plan's act: the main effort (share (1 − h)·m), a secondary
 *                labelled direct attack ((1 − h)·(1 − m)) or a secondary labelled mop-up / hold-line (h). The act lands on the front's
 *                sector with probability P_SECTOR (else D); a secondary route also needs a main effort the key allows (`mainok`).
 *                Label C: main route (where the key's main route is sound) or secondary direct attack; act C: any of the three;
 *   fit view     P(aligned) = logistic(F_BASE − u_i + effect) (A); the rest is D. Act coding = label coding (no keyed front);
 *   guide (S)    in each keyed phase-B view, exposure e ~ Bern(pExp). An exposed no-fit view shows a contradicted premise and moves the
 *                propensity to attend by δ; an exposed fit view moves toward aligned by δ. GAMMA pushes toward aligned in every view;
 *   Haku (H)     no effect.
 *
 * Estimators, each two-sided at α = .05 (participant-clustered logistic models, sandwich SE, Wald z; population-averaged stand-ins for
 * the mixed models, as in `h2-power.ts`):
 *   GLM-C   — H13: no-fit views, C ~ group + view + phase-A share; target group. Act coding (primary), label coding (sensitivity),
 *             and the act coding on V9, V10 (V14 mixed);
 *   GLM-A   — H14: fit views, aligned ~ group + view + phase-A share; V11–V13, and V12, V13 (V11 mixed);
 *   GLM-int — H15: keyed views, aligned ~ group + group×fit + view + phase-A share; all six, V11 mixed, V14 mixed. Alignment by the act
 *             (an attending no-fit plan is against; integration 19 Oct 2026, RC with §3.1); by the label as the sensitivity.
 *
 * Deterministic: a seeded xoshiro128** stream per grid cell; no unseeded randomness, no clock.
 */

import { Rng, argList, argValue, cellSeed, clusteredLogitP, logistic, logit, pct } from "./power-lib.js";

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

const SIGMA_U = 1.0; // participant SD on the logit scale (ICC ≈ .23 on the latent scale)
const A0 = 0.4; // phase A: P(direct_attack) ≈ .58 at u = 0 under the offensive intent
const LAMBDA_A = 0.8; // how strongly phase-A posture reflects the same propensity
const PHASE_A_VIEWS = 7;
const P_SECTOR = 0.85; // an attending act lands on the front's sector (C); otherwise it is an attack elsewhere (D)
const NOFIT_LABELS = ["V9", "V10", "V14"] as const;
/** P(a plan attacks the front by its label) at u = 0, per no-fit view (the bases of 19 Oct: .25, .30, .30). */
const P_DIRECT = argList("--pdirect", [0.25, 0.3, 0.3]);
/** Of the attending plans, the share whose act is a secondary task labelled mop-up or hold-line (label B, act C). Planning value. */
const H_SHARE = argList("--hshare", [0.25, 0.25, 0.25]);
/** Of the attending plans labelled direct attack, the share with the attack as the main effort. Planning value. */
const MAIN_SHARE = argList("--mainshare", [0.6, 0.6, 0.5]);
/** A secondary route's main effort is one the key allows (V9–V10: any sector, an aligned posture; V14: aligned in Lahdenkylä's sector). */
const MAIN_OK = argList("--mainok", [0.95, 0.95, 0.75]);
/** Whether the key accepts the main-effort route (§3.2: not at V14); the old key accepted it everywhere. */
const MAIN_SOUND = [true, true, false] as const;
/** Fit views V11–V13: P(aligned) ≈ .88 at u = 0 (the ceiling risk of SPEC/09 revision (t)). */
const F_BASE = logit(0.88);
const FIT_VIEWS = 3;
/** View indices into [V9, V10, V14, V11, V12, V13]. */
const V14 = 2, V11 = 3;

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
  // SPEC/32 §3 (20 Oct 2026): the premise line at the plan review reaches every guide participant (exposure 1). Appended, so the
  // rows above keep their seeds and reproduce `30` (az) exactly.
  { id: "review-1.0", label: "premise line at the plan review, exp 1.0, δ 1.0", pExp: 1.0, delta: 1.0, gamma: 0 },
  { id: "review-1.5", label: "premise line at the plan review, exp 1.0, δ 1.5", pExp: 1.0, delta: 1.5, gamma: 0 },
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
  readonly aligned: number; // label coding: barrier_line or protect_values, no secondary direct attack (H14; H15's sensitivity)
  readonly alignedAct: number; // act coding: as `aligned`, and in a no-fit view not attending the keyed front (H15's primary)
  readonly cAct: number; // justified departure, act coding (no-fit views only; the primary)
  readonly cLabel: number; // justified departure, label coding (the sensitivity)
  readonly cOldKey: number; // label coding under the old V14 key (main route sound), for comparison
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

/** One no-fit plan: whether it attends, by which act, and its C under each coding. */
function noFitPlan(rng: Rng, v: number, u: number, eff: number): { attended: boolean; directLabel: boolean; cAct: number; cLabel: number; cOldKey: number } {
  const h = H_SHARE[v]!, m = MAIN_SHARE[v]!;
  const attended = rng.bern(logistic(logit(P_DIRECT[v]! / (1 - h)) + u + eff));
  if (!attended) return { attended, directLabel: false, cAct: 0, cLabel: 0, cOldKey: 0 };
  const r = rng.uniform();
  const route = r < (1 - h) * m ? "main" : r < 1 - h ? "secondary_direct" : "secondary_mop_hold";
  const onSector = rng.bern(P_SECTOR);
  const mainOk = route === "main" ? true : rng.bern(MAIN_OK[v]!);
  const soundMain = (mainSound: boolean) => (onSector && mainSound ? 1 : 0);
  const soundSecondary = onSector && mainOk ? 1 : 0;
  return {
    attended, directLabel: route !== "secondary_mop_hold",
    cAct: route === "main" ? soundMain(MAIN_SOUND[v]!) : soundSecondary,
    cLabel: route === "main" ? soundMain(MAIN_SOUND[v]!) : route === "secondary_direct" ? soundSecondary : 0,
    cOldKey: route === "main" ? soundMain(true) : route === "secondary_direct" ? soundSecondary : 0,
  };
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
    NOFIT_LABELS.forEach((_, v) => {
      // No-fit: the sound side is attending the keyed front; the compliance push works against it.
      const eff = s === 1 ? checkShift(rng, sc) - sc.gamma : 0;
      const p = noFitPlan(rng, v, u, eff);
      obs.push({ pid: i, s, view: v, fit: 0, aligned: p.attended && p.directLabel ? 0 : 1, alignedAct: p.attended ? 0 : 1, cAct: p.cAct, cLabel: p.cLabel, cOldKey: p.cOldKey, baseA });
    });
    for (let f = 0; f < FIT_VIEWS; f++) {
      // Fit: the sound side is aligned; the compliance push works with it.
      const eff = s === 1 ? checkShift(rng, sc) + sc.gamma : 0;
      const aligned = rng.bern(logistic(F_BASE - u + eff)) ? 1 : 0;
      obs.push({ pid: i, s, view: NOFIT_LABELS.length + f, fit: 1, aligned, alignedAct: aligned, cAct: 0, cLabel: 0, cOldKey: 0, baseA });
    }
  }
  return { obs, participants };
}

// ---------------------------------------------------------------------------
// Estimators
// ---------------------------------------------------------------------------

/** View dummies over the views present (the first present is the reference). */
const dummies = (o: Obs, views: readonly number[]) => views.slice(1).map((v) => (o.view === v ? 1 : 0));

/** GLM-C (H13): the given no-fit views; C ~ 1 + S + view dummies + phase-A share. Target: S. */
function glmCP(d: Dataset, outcome: (o: Obs) => number, views: readonly number[] = [0, 1, V14]): number | null {
  const rows = d.obs.filter((o) => o.fit === 0 && views.includes(o.view));
  const X = rows.map((o) => [1, o.s, ...dummies(o, views), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map(outcome), rows.map((o) => o.pid), d.participants, 1);
}

/** GLM-A (H14): the given fit views; aligned ~ 1 + S + view dummies + phase-A share. Target: S. */
function glmAP(d: Dataset, views: readonly number[] = [V11, V11 + 1, V11 + 2]): number | null {
  const rows = d.obs.filter((o) => o.fit === 1 && views.includes(o.view));
  const X = rows.map((o) => [1, o.s, ...dummies(o, views), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map((o) => o.aligned), rows.map((o) => o.pid), d.participants, 1);
}

/**
 * GLM-int (H15): the given keyed views; aligned ~ 1 + S + S×fit + view dummies + phase-A share. Target: S×fit. The outcome is the act
 * coding's alignment (integration of §3.1, RC: an attending no-fit plan is against the directive, as H13 reads it); the label's is the
 * sensitivity.
 */
function glmIntP(d: Dataset, views: readonly number[] = [0, 1, 2, 3, 4, 5], outcome: (o: Obs) => number = (o) => o.alignedAct): number | null {
  const rows = d.obs.filter((o) => views.includes(o.view));
  const X = rows.map((o) => [1, o.s, o.s * o.fit, ...dummies(o, views), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map(outcome), rows.map((o) => o.pid), d.participants, 2);
}

/**
 * GLM-c (H15c, SPEC/32 §4): the criterion of the signal-detection pair — aligned ~ 1 + S + view dummies + phase-A share over all keyed
 * views (the view dummies carry fit). Target: S. A compliance push moves it; a check that only sharpens discrimination moves it little.
 */
function glmMainP(d: Dataset, views: readonly number[] = [0, 1, 2, 3, 4, 5], outcome: (o: Obs) => number = (o) => o.alignedAct): number | null {
  const rows = d.obs.filter((o) => views.includes(o.view));
  const X = rows.map((o) => [1, o.s, ...dummies(o, views), o.baseA - 0.5]);
  return clusteredLogitP(X, rows.map(outcome), rows.map((o) => o.pid), d.participants, 1);
}

/** The power columns, in table order: [label, p-value of one replicate]. */
const ESTIMATORS: readonly (readonly [string, (d: Dataset) => number | null])[] = [
  ["H13 act (V9, V10, V14)", (d) => glmCP(d, (o) => o.cAct)],
  ["H13 label (sensitivity)", (d) => glmCP(d, (o) => o.cLabel)],
  ["H13 act, V14 mixed (V9, V10)", (d) => glmCP(d, (o) => o.cAct, [0, 1])],
  ["H14 (V11–V13)", (d) => glmAP(d)],
  ["H14, V11 mixed (V12, V13)", (d) => glmAP(d, [V11 + 1, V11 + 2])],
  ["H15 act", (d) => glmIntP(d)],
  ["H15 label (sensitivity)", (d) => glmIntP(d, undefined, (o) => o.aligned)],
  ["H15, V11 mixed", (d) => glmIntP(d, [0, 1, 2, 4, 5])],
  ["H15, V14 mixed", (d) => glmIntP(d, [0, 1, 3, 4, 5])],
  ["H15c criterion (act)", (d) => glmMainP(d)],
];

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

/** Population shares (large deterministic sample) per group [Haku, guide]: C per no-fit view under each coding, A in the fit views. */
function populationShares(sc: Scenario, seed: number) {
  const rng = new Rng(seed);
  const n = 20000;
  const d = simulate(rng, n, n, sc);
  const z = () => [0, 0, 0, 0, 0, 0];
  const act = [z(), z()], label = [z(), z()], old = [z(), z()], cnt = [z(), z()];
  for (const o of d.obs) {
    act[o.s]![o.view]! += o.fit === 0 ? o.cAct : o.aligned;
    label[o.s]![o.view]! += o.fit === 0 ? o.cLabel : o.aligned;
    old[o.s]![o.view]! += o.cOldKey;
    cnt[o.s]![o.view]! += 1;
  }
  const share = (t: number[][], g: number, views: readonly number[]) => views.reduce((a, v) => a + t[g]![v]!, 0) / views.reduce((a, v) => a + cnt[g]![v]!, 0);
  return { act, label, old, share };
}

function main(): void {
  const reps = argValue("--reps", 1000);
  const seed = argValue("--seed", 20261004);
  const sh = (x: number) => (100 * x).toFixed(1);
  console.log(`Paper 2 power simulation (SPEC/30, SPEC/31 §3.12) — ${reps} replicates per cell, seed ${seed}, α = .05 two-sided`);
  console.log(`Planning values per no-fit view (V9, V10, V14): pdirect ${P_DIRECT.join(", ")}; hshare ${H_SHARE.join(", ")}; mainshare ${MAIN_SHARE.join(", ")}; mainok ${MAIN_OK.join(", ")}; main route sound ${MAIN_SOUND.join(", ")}\n`);
  console.log("Population shares, Haku → guide (20 000 + 20 000 participants), %:\n");
  console.log("| Scenario | C act V9 | C act V10 | C act V14 | C act, 3 views | C label, 3 views | V14 C: act · label · old key (label) | A in V11–V13 |");
  console.log("|---|---|---|---|---|---|---|---|");
  SCENARIOS.forEach((sc, si) => {
    const p = populationShares(sc, cellSeed(seed, 99, si));
    const hs = (t: number[][], views: readonly number[]) => `${sh(p.share(t, 0, views))} → ${sh(p.share(t, 1, views))}`;
    console.log(`| ${sc.id} | ${hs(p.act, [0])} | ${hs(p.act, [1])} | ${hs(p.act, [V14])} | ${hs(p.act, [0, 1, V14])} | ${hs(p.label, [0, 1, V14])} | ${hs(p.act, [V14])} · ${hs(p.label, [V14])} · ${hs(p.old, [V14])} | ${hs(p.act, [3, 4, 5])} |`);
  });
  console.log("\nPower, guide (S) vs Haku (H); no-fit V9, V10, V14 (V14 via the secondary route only); fit V11–V13:\n");
  console.log(`| Scenario | N | ${ESTIMATORS.map(([l]) => l).join(" | ")} |`);
  console.log(`|---|---|${ESTIMATORS.map(() => "---").join("|")}|`);
  SCENARIOS.forEach((sc, si) => {
    SAMPLE_SIZES.forEach((ns, ni) => {
      const rng = new Rng(cellSeed(seed, si, ni));
      const hits = ESTIMATORS.map(() => 0), fails = ESTIMATORS.map(() => 0);
      for (let r = 0; r < reps; r++) {
        const d = simulate(rng, ns.nControl, ns.nS, sc);
        ESTIMATORS.forEach(([, f], k) => { const p = f(d); if (p === null) fails[k]!++; else if (p < 0.05) hits[k]!++; });
      }
      const cell = (k: number) => `${pct(hits[k]! / reps)}${fails[k]! > 0 ? ` (${fails[k]} fits failed)` : ""}`;
      console.log(`| ${sc.id} | ${ns.label} | ${ESTIMATORS.map((_, k) => cell(k)).join(" | ")} |`);
    });
  });
}

main();
