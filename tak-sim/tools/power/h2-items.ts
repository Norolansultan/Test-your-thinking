/**
 * H2 power with item-specific difficulty and an effect only on seek-dependent items — the re-run the difficulty audit asked for
 * (`docs/audits/2026-10-23-difficulty/`, SPEC/09 (be) §3; researcher decision 24 Oct 2026, SPEC/09 (bf), SPEC/30 (bf)).
 *
 *   npm run power:h2-items            # = npx tsx tools/power/h2-power.ts --items docs/audits/2026-10-23-difficulty/items.csv
 *   npx tsx tools/power/h2-power.ts --items <items.csv> [--reps 1000] [--seed 20261024] [--partly-weight 1] [--late-weight 0]
 *     [--b-yes -1] [--b-partly 0] [--b-no 0.5] [--b-late 0.5] [--alpha 0.05]   (revision (bk): --alpha 0.00714 is the Holm worst case
 *     of a secondary in Paper 1's family of seven, SPEC/09 (bk))
 *
 * Why: the audit classed each freeze item by whether its key reaches a participant without seeking (`passive` yes / partly / no) and
 * whether its last key record arrives less than 60 s before the freeze (`late_lt60s`). 16 of the 24 H2 items were answerable without
 * seeking (23 Oct 2026; 18 of 23 by play-test R2; 14 of 23 since revision (bk), which made four items seek-dependent). If the guide's overconfidence effect works through what the AI tells the seeker (SPEC/30 §5.3), it sits on the
 * seek-dependent items only, and the pre-registered gap over all 24 items dilutes it. This module computes that effective power.
 *
 * The window: the audit's `items.csv` rows that are freeze items of V2, V4, V5 or V7 at L2 or L3 (H2's 24; 23 since play-test R2, 25 Oct
 * 2026: a row with a `scored_for` value, V4's exploratory `head_later`, is outside H2 and left out). The command reads the CSV
 * the audit wrote, so a regenerated audit is re-run by the same command. Lure items (a seeker finds a designed stale figure): the CSV's
 * `lure` column when it has one, else the build's items that carry `lureStatements` (`app/scenario/types.ts`), passed in by the CLI.
 *
 * Data-generating process (assumptions, not pilot values; the 2 Oct model of `h2-power.ts` with two changes):
 *   item        b_j = B[passive_j] + (late_j ? B_LATE : 0) + SIGMA_ITEM_RESID · z_j, z_j ~ N(0, 1) per replicate (the same for everyone):
 *               an item the stream tells is easier (B yes −1: the +1 logit of the stream-told items in `h2-power.ts`), a seek-only one
 *               harder; a late item harder again (less time to read it);
 *   accuracy    p_ij = GUESS + (1 − GUESS) · logistic(MU + θ_i − b_j), θ_i ~ N(0, SIGMA_ABILITY²);
 *   confidence  s_ij = logistic(logit(p_ij) + δ_ij + u_i + ε_ij), on the 25/50/75/100 scale;
 *   effect      δ_ij = BASE_OVERCONFIDENCE in the Haku group; BASE_OVERCONFIDENCE + Δ · w_j in the guide group, where w_j = 1 for a
 *               `no` item, `partlyWeight` (default 1) for a `partly` item, 0 for a `yes` item; a late item takes at least `lateWeight`
 *               (default 0, i.e. no change). Accuracy is the same in both groups (H1 is a separate test).
 * Estimator: the per-participant gap (mean confidence − proportion correct) on the window's items, Welch t, two-sided α = .05 (the
 * stand-in for the participant-level model with item random effects, as in `h2-power.ts`).
 *
 * Windows: all 24 (H2 as pre-registered); seek-dependent only (partly ∪ no); without the late items; without the late and lure items;
 * seek-dependent without lure items. Each replicate draws once and is scored on every window and every Δ (common random numbers),
 * so the power curve over Δ is smooth and the minimum detectable effect (80 %) is read off it by linear interpolation.
 *
 * Revision (bk), 25 Oct 2026 (SPEC/09 (bk), SPEC/30 (bk)): H2's primary test is the gap on the seek-dependent items (window `seek`), the
 * sensitivity the gap over all items (`all`), and the pre-stated secondary the group × item-class interaction (`interaction`): the
 * per-participant contrast gap(seek-dependent) − gap(passive yes), Welch t between the groups — the stand-in for the participant-level
 * model with a person random effect, in which a participant's own confidence bias and ability cancel in the contrast (the passive items
 * are the within-person control). Its Δgap is the difference in differences; under this model's effect (seek items only) it equals the
 * seek window's Δgap.
 *
 * Deterministic: a seeded xoshiro128** stream per sample size (`power-lib.ts`); no clock, no unseeded randomness.
 */

import { parseCsv } from "../../app/telemetry/uncertainty-audit.js";
import { Rng, cellSeed, logistic, logit, welchP } from "./power-lib.js";

export type Passive = "yes" | "partly" | "no";

export interface ItemClass {
  readonly id: string;
  readonly view: string;
  readonly level: string;
  readonly passive: Passive;
  readonly late: boolean;
  readonly lure: boolean;
}

const H2_VIEWS = new Set(["V2", "V4", "V5", "V7"]);
const truthy = (v: string | undefined) => ["true", "yes", "1"].includes((v ?? "").trim().toLowerCase());

/**
 * The H2 window's items from the audit's `items.csv`: freeze rows of V2, V4, V5, V7 at L2 / L3, with their classes. `lureIds` is used
 * when the CSV has no `lure` column. Throws on a row whose `passive` is not yes / partly / no (the audit's classes).
 */
export function h2ItemClasses(csv: string, lureIds: ReadonlySet<string> = new Set()): ItemClass[] {
  const [head, ...body] = parseCsv(csv);
  if (!head) throw new Error("items.csv: empty");
  const col = (name: string) => head.findIndex((h) => h.trim() === name);
  const at = { id: col("id"), kind: col("kind"), view: col("view"), level: col("level"), passive: col("passive"), late: col("late_lt60s"), lure: col("lure"), scoredFor: col("scored_for") };
  for (const k of ["id", "kind", "view", "level", "passive", "late"] as const) if (at[k] < 0) throw new Error(`items.csv: no column for ${k}`);
  return body.flatMap((r): ItemClass[] => {
    if (r[at.kind] !== "freeze" || !H2_VIEWS.has(r[at.view] ?? "") || !["L2", "L3"].includes(r[at.level] ?? "")) return [];
    // Play-test R2 (25 Oct 2026): an item scored outside H2 and the composites (`scored_for`: V4's exploratory head_later) is not in the window.
    if (at.scoredFor >= 0 && (r[at.scoredFor] ?? "").trim() !== "") return [];
    const passive = (r[at.passive] ?? "").trim();
    if (passive !== "yes" && passive !== "partly" && passive !== "no") throw new Error(`items.csv: ${r[at.id]} has passive "${passive}"`);
    const id = r[at.id]!;
    return [{ id, view: r[at.view]!, level: r[at.level]!, passive, late: truthy(r[at.late]), lure: at.lure >= 0 ? truthy(r[at.lure]) : lureIds.has(id) }];
  });
}

export interface ItemModel {
  readonly bYes: number; readonly bPartly: number; readonly bNo: number; readonly bLate: number;
  readonly partlyWeight: number; readonly lateWeight: number;
}
export const DEFAULT_MODEL: ItemModel = { bYes: -1, bPartly: 0, bNo: 0.5, bLate: 0.5, partlyWeight: 1, lateWeight: 0 };

const GUESS = 0.25, MU = 0, SIGMA_ITEM_RESID = 0.8, SIGMA_ABILITY = 0.8, SIGMA_CONF_BIAS = 0.5, SIGMA_CONF_NOISE = 1.0, BASE_OVERCONFIDENCE = 0.3;
const CONF_STEPS = [0.25, 0.5, 0.75, 1.0] as const;
const toScale = (s: number) => CONF_STEPS.reduce((best, step) => (Math.abs(s - step) < Math.abs(s - best) ? step : best), CONF_STEPS[0] as number);

export const itemBase = (it: ItemClass, m: ItemModel) => ({ yes: m.bYes, partly: m.bPartly, no: m.bNo })[it.passive] + (it.late ? m.bLate : 0);
export const effectWeight = (it: ItemClass, m: ItemModel) => Math.max(({ yes: 0, partly: m.partlyWeight, no: 1 })[it.passive], it.late ? m.lateWeight : 0);

export interface Window {
  readonly id: string;
  readonly label: string;
  readonly keep: (it: ItemClass) => boolean;
  /** A within-person contrast (revision (bk)): the participant's score is gap(keep) − gap(minus). */
  readonly minus?: (it: ItemClass) => boolean;
}
export const WINDOWS: readonly Window[] = [
  { id: "all", label: "all H2 items (as pre-registered)", keep: () => true },
  { id: "seek", label: "seek-dependent only (passive partly or no)", keep: (it) => it.passive !== "yes" },
  { id: "no_late", label: "without the late items", keep: (it) => !it.late },
  { id: "no_late_lure", label: "without the late and lure items", keep: (it) => !it.late && !it.lure },
  { id: "seek_no_lure", label: "seek-dependent without lure items", keep: (it) => it.passive !== "yes" && !it.lure },
  // Revision (bk): the pre-stated secondary, group × item class (seek-dependent vs passive yes) with the person as its own control.
  { id: "interaction", label: "group × item class (seek − passive, within person)", keep: (it) => it.passive !== "yes", minus: (it) => it.passive === "yes" },
];

export interface PowerCell {
  readonly window: string;
  readonly items: number;
  readonly nPerGroup: number;
  /** Power at each Δ of the grid (same order). */
  readonly power: readonly number[];
  /** Mean observed Δgap (guide − Haku) at each Δ, over the replicates. */
  readonly dGap: readonly number[];
}

/**
 * Power over the Δ grid for every window at one sample size (per group). One replicate draws the item bank, the participants and the
 * noise once; every Δ and every window is scored on the same draws. `alpha` (two-sided; revision (bk)): a Holm family's worst-case
 * threshold, e.g. .05 / 7 for a secondary.
 */
export function powerGrid(items: readonly ItemClass[], nPerGroup: number, deltas: readonly number[], reps: number, seed: number, m: ItemModel = DEFAULT_MODEL, windows: readonly Window[] = WINDOWS, alpha = 0.05): PowerCell[] {
  const rng = new Rng(seed);
  const J = items.length, P = 2 * nPerGroup;
  const base = items.map((it) => itemBase(it, m)), w = items.map((it) => effectWeight(it, m));
  const members = windows.map((win) => items.flatMap((it, j) => (win.keep(it) ? [j] : [])));
  const minus = windows.map((win) => (win.minus ? items.flatMap((it, j) => (win.minus!(it) ? [j] : [])) : null));
  const hits = windows.map(() => deltas.map(() => 0)), gapSums = windows.map(() => deltas.map(() => 0));
  const logitP = new Float64Array(P * J), y = new Uint8Array(P * J), noise = new Float64Array(P * J), u = new Float64Array(P);
  const conf = new Float64Array(J);
  for (let r = 0; r < reps; r++) {
    const b = base.map((x) => x + SIGMA_ITEM_RESID * rng.normal());
    for (let i = 0; i < P; i++) {
      const theta = SIGMA_ABILITY * rng.normal();
      u[i] = SIGMA_CONF_BIAS * rng.normal();
      for (let j = 0; j < J; j++) {
        const p = GUESS + (1 - GUESS) * logistic(MU + theta - b[j]!);
        logitP[i * J + j] = logit(p);
        y[i * J + j] = rng.uniform() < p ? 1 : 0;
        noise[i * J + j] = SIGMA_CONF_NOISE * rng.normal();
      }
    }
    for (let di = 0; di < deltas.length; di++) {
      const delta = deltas[di]!;
      const gaps = windows.map(() => [[] as number[], [] as number[]] as const);
      for (let i = 0; i < P; i++) {
        const g = i < nPerGroup ? 0 : 1;
        for (let j = 0; j < J; j++) {
          const k = i * J + j;
          conf[j] = toScale(logistic(logitP[k]! + BASE_OVERCONFIDENCE + (g === 1 ? delta * w[j]! : 0) + u[i]! + noise[k]!));
        }
        const gapOf = (js: readonly number[]) => {
          let c = 0, yy = 0;
          for (const j of js) { c += conf[j]!; yy += y[i * J + j]!; }
          return (c - yy) / js.length;
        };
        for (let wi = 0; wi < members.length; wi++) {
          const js = members[wi]!, ms = minus[wi];
          if (js.length === 0 || (ms && ms.length === 0)) continue;
          gaps[wi]![g].push(ms ? gapOf(js) - gapOf(ms) : gapOf(js));
        }
      }
      gaps.forEach(([h, s], wi) => {
        if (h.length > 1 && s.length > 1 && welchP(h, s) < alpha) hits[wi]![di]!++;
        gapSums[wi]![di]! += mean(s) - mean(h);
      });
    }
  }
  return windows.map((win, wi) => ({
    window: win.id, items: members[wi]!.length + (minus[wi]?.length ?? 0), nPerGroup,
    power: hits[wi]!.map((h) => h / reps), dGap: gapSums[wi]!.map((s) => s / reps),
  }));
}

const mean = (x: readonly number[]) => (x.length === 0 ? 0 : x.reduce((a, v) => a + v, 0) / x.length);

/** The smallest Δ at which the power curve reaches `target` (linear interpolation between grid points); null if it never does. */
export function minimumDetectable(deltas: readonly number[], power: readonly number[], target = 0.8): number | null {
  for (let i = 0; i < deltas.length; i++) {
    if (power[i]! < target) continue;
    if (i === 0) return deltas[0]!;
    const [d0, d1, p0, p1] = [deltas[i - 1]!, deltas[i]!, power[i - 1]!, power[i]!];
    return p1 === p0 ? d1 : d0 + ((target - p0) * (d1 - d0)) / (p1 - p0);
  }
  return null;
}

/** The Δgap at a Δ between grid points (linear). */
export function interpolate(deltas: readonly number[], values: readonly number[], at: number): number {
  for (let i = 1; i < deltas.length; i++) if (at <= deltas[i]!) return values[i - 1]! + ((at - deltas[i - 1]!) * (values[i]! - values[i - 1]!)) / (deltas[i]! - deltas[i - 1]!);
  return values[values.length - 1]!;
}

export interface ItemPowerOptions {
  readonly reps: number;
  readonly seed: number;
  readonly model: ItemModel;
  readonly sizes: readonly number[];
  readonly deltas: readonly number[];
  /** Two-sided α (revision (bk): a Holm worst case for the secondary); absent: .05. */
  readonly alpha?: number;
}
export const DEFAULT_OPTIONS: ItemPowerOptions = {
  reps: 1000, seed: 20261024, model: DEFAULT_MODEL, sizes: [50, 60, 75],
  deltas: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.4, 3.0],
};

const pctOf = (x: number) => `${(100 * x).toFixed(0)} %`;

/** The whole run as Markdown: the classes read, power at Δ 0.4 and 0.8, the minimum detectable effect, and the uniform-effect reference. */
export function itemPowerReport(items: readonly ItemClass[], o: ItemPowerOptions = DEFAULT_OPTIONS): string {
  const out: string[] = [];
  const ids = (f: (it: ItemClass) => boolean) => items.filter(f).map((it) => it.id.replace(/^freeze\./, "")).join(", ") || "—";
  const alpha = o.alpha ?? 0.05;
  out.push(`H2 power with item classes (SPEC/09 (bf), (bk)) — ${o.reps} replicates per sample size, seed ${o.seed}, α = ${String(Number(alpha.toFixed(4))).replace(/^0/, "")} two-sided`, "");
  out.push(`Items read: ${items.length} (passive yes ${items.filter((i) => i.passive === "yes").length}, partly ${items.filter((i) => i.passive === "partly").length}, no ${items.filter((i) => i.passive === "no").length}; late ${items.filter((i) => i.late).length}; lure ${items.filter((i) => i.lure).length}).`);
  out.push(`- seek-dependent: ${ids((i) => i.passive !== "yes")}`, `- late: ${ids((i) => i.late)}`, `- lure: ${ids((i) => i.lure)}`, "");
  const m = o.model;
  out.push(`Model: b = ${m.bYes} / ${m.bPartly} / ${m.bNo} (passive yes / partly / no) + ${m.bLate} if late; effect weight 0 / ${m.partlyWeight} / 1, late at least ${m.lateWeight}.`, "");
  const grids = o.sizes.map((n, k) => powerGrid(items, n, o.deltas, o.reps, cellSeed(o.seed, k + 1, n), m, WINDOWS, alpha));
  const at = (d: number) => o.deltas.indexOf(d);
  out.push("**Power, effect on seek-dependent items only** (Δ on the confidence logit, as δ in `h2-power.ts`):", "");
  out.push(`| Window | Items | ${o.sizes.map((n) => `Δ 0.4 · 0.8, n = ${2 * n}`).join(" | ")} |`, `|---|---|${o.sizes.map(() => "---").join("|")}|`);
  WINDOWS.forEach((win, wi) => {
    const cells = grids.map((g) => `${pctOf(g[wi]!.power[at(0.4)]!)} · ${pctOf(g[wi]!.power[at(0.8)]!)}`);
    out.push(`| ${win.label} | ${grids[0]![wi]!.items} | ${cells.join(" | ")} |`);
  });
  out.push("", "**Minimum detectable effect at 80 % power** (Δ, and the population Δgap it gives on that window):", "");
  out.push(`| Window | ${o.sizes.map((n) => `n = ${2 * n}`).join(" | ")} |`, `|---|${o.sizes.map(() => "---").join("|")}|`);
  WINDOWS.forEach((win, wi) => {
    const cells = grids.map((g) => {
      const mde = minimumDetectable(o.deltas, g[wi]!.power);
      return mde === null ? `> ${o.deltas[o.deltas.length - 1]}` : `Δ ${mde.toFixed(2)} (Δgap +${interpolate(o.deltas, g[wi]!.dGap, mde).toFixed(3)})`;
    });
    out.push(`| ${win.label} | ${cells.join(" | ")} |`);
  });
  out.push("", `Null (Δ 0), all items: ${grids.map((g, k) => `${pctOf(g[0]!.power[0]!)} at n = ${2 * o.sizes[k]!}`).join(", ")}.`);
  // The reference: the same items, every one carrying the effect and one difficulty (b 0, late items + bLate): SPEC/30 §11's assumption.
  const everyItem = items.map((it) => ({ ...it, passive: "no" as const }));
  const ref = o.sizes.map((n, k) => powerGrid(everyItem, n, [0.4, 0.8], o.reps, cellSeed(o.seed, 50 + k, n), { ...m, bNo: 0 }, [WINDOWS[0]!], alpha)[0]!);
  out.push("", `Reference (the effect on every item, one difficulty b 0 + ${m.bLate} if late; SPEC/30 §11's assumption): Δ 0.4 · 0.8 = ${ref.map((c, k) => `${pctOf(c.power[0]!)} · ${pctOf(c.power[1]!)} at n = ${2 * o.sizes[k]!}`).join("; ")}.`, "");
  return out.join("\n");
}
