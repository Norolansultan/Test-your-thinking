/**
 * The provisional flame-length table (SPEC/31 §3.11, data item D1; SPEC/18 and SPEC/24 revisions (ay)) — PROVISIONAL,
 * to be replaced by FMI/Prometheus head-fire intensity (HFI) or the SMP flame-length table when available.
 *
 * Why: the phase-B records quoted 0.3–1 m and 1–2 m flames at 4.5–10.6 m/min. By Byram's relation that implies only
 * 0.2–0.5 kg/m² of fuel burned in the flaming front, against about 2–3.3 kg/m² from the Kalajoki 2021 rate/flame
 * pairs (3–4 m/min ↔ 2.6 m; 5–7 m/min ↔ 4–4.4 m; flank ≈ 0.6–0.7 × head; `docs/audits/2026-10-19-skills/fire_tactical.md`).
 * The fire's rates are unchanged: this table is a forcing-level artefact the records read.
 *
 * Method (stated for the methods section, DRAFT):
 * - Byram (1959): fireline intensity I = H · w · r (kW/m), H = 18 000 kJ/kg, w the fuel consumed in the flaming front
 *   (kg/m²), r the rate of spread (m/s); flame length L = 0.0775 · I^0.46 (m).
 * - w = 2.05 kg/m² for coniferous surface fuels (pine heath, the esker, spruce below crowning, drained and pine bog
 *   surface): the low end of the Kalajoki range, the value at which 3.5 m/min gives 2.6 m (Kalajoki's 3–4 m/min pair).
 *   At 6 m/min it gives 3.4 m, under Kalajoki's 4–4.4 m: the table errs short where the pairs disagree. Broadleaf
 *   (birch–aspen) 1.0, open bog 0.6, field 0.5 kg/m².
 * - Segments per step: the head from the CA's achieved head rate (`headRos.achievedMpm`, the rate the records quote);
 *   the flanks 0.65 × the head's flame (Kalajoki 0.6–0.7); the rear 0.35 × (a backing fire at about a tenth of the
 *   head's intensity: 0.1^0.46 ≈ 0.35). A head over 12 m/min crowns (the generator's own rule, `intensityClass`):
 *   its flames are "above the treetops", no number.
 * - Records follow it from the hinge (`PHASE_B_FIRST_STEP`, V8): every record that states a flame band states the band
 *   of Byram's flame at the spread rate it reports (or measures) on its own stretch; a creeping or smouldering edge
 *   (generator class ≤ 1) keeps "under 0.3 m". Phase-A records keep the generator's class bands (several are cited by
 *   freeze and source-memory keys; `SPEC/31` WP-6 and the panel decide whether phase A follows).
 * - The intensity class a phase-B record states is read from the same flame (the generator's scale: 1 under 0.3 m,
 *   2 0.3–1 m, 3 1–2 m, 4 surface fire over 2 m with torching, 5 crown fire).
 *
 * Deterministic, no randomness: the same rate gives the same band in both languages.
 */

import type { LandCoverFi } from "./traffic-text.js";

/** Heat yield (kJ/kg), Byram's constant for forest fuels. */
export const HEAT_YIELD_KJ_KG = 18_000;
/** Byram's flame-length relation L = A · I^B (I in kW/m, L in m). */
export const BYRAM_A = 0.0775;
export const BYRAM_B = 0.46;
/** Fuel consumed in the flaming front (kg/m²), by the generator's ground types. */
export const FUEL_LOAD_KG_M2: Readonly<Record<LandCoverFi, number>> = {
  forest: 2.05, ridge: 2.05, spruce: 2.05, drained_bog: 2.05, pine_bog: 2.05, birch: 1.0, open_bog: 0.6, field: 0.5, water: 0,
};
/** The Kalajoki range of the fuel consumed (kg/m²), for the consistency check's tolerance. */
export const FUEL_LOAD_RANGE_KG_M2 = { lo: 1.0, hi: 3.3 } as const;
export const FLANK_FACTOR = 0.65;
export const REAR_FACTOR = 0.35;
/** Above this head rate (m/min) the head crowns (`traffic-text.ts` `intensityClass`). */
export const CROWN_ABOVE_MPM = 12;
/** The first step whose records follow the table: the hinge (16:40, V8). */
export const PHASE_B_FIRST_STEP = 11;

/** Byram's fireline intensity (kW/m) at a spread rate (m/min) and fuel load (kg/m²). */
export function byramIntensityKwM(rateMpm: number, fuelKgM2: number): number {
  return HEAT_YIELD_KJ_KG * fuelKgM2 * (Math.max(0, rateMpm) / 60);
}

/** Byram's flame length (m), rounded to 0.01 m. */
export function byramFlameM(rateMpm: number, fuelKgM2: number): number {
  const i = byramIntensityKwM(rateMpm, fuelKgM2);
  return i <= 0 ? 0 : Math.round(BYRAM_A * i ** BYRAM_B * 100) / 100;
}

export interface FlameBand {
  /** Metres; `hi` null for the open top band and for a crown fire. */
  readonly lo: number;
  readonly hi: number | null;
  readonly crown: boolean;
  /** The record wording: "liekit 2–3 m" / "flames 2–3 m". */
  readonly fi: string;
  readonly en: string;
}

const BAND_EDGES: readonly (readonly [number, number | null, string, string])[] = [
  [0, 0.3, "liekit alle 0,3 m", "flames under 0.3 m"],
  [0.3, 1, "liekit 0,3–1 m", "flames 0.3–1 m"],
  [1, 2, "liekit 1–2 m", "flames 1–2 m"],
  [2, 3, "liekit 2–3 m", "flames 2–3 m"],
  [3, 4, "liekit 3–4 m", "flames 3–4 m"],
  [4, 5, "liekit 4–5 m", "flames 4–5 m"],
  [5, null, "liekit yli 5 m", "flames over 5 m"],
];
/** A crown fire's band (no number, as the generator says it). */
export const CROWN_BAND: FlameBand = { lo: 5, hi: null, crown: true, fi: "liekit puiden latvojen yli", en: "flames above the treetops" };

/** The record band a flame length falls in (lower edge inclusive). */
export function bandOf(lengthM: number): FlameBand {
  const row = BAND_EDGES.find(([lo, hi]) => lengthM >= lo && (hi === null || lengthM < hi)) ?? BAND_EDGES[0]!;
  return { lo: row[0], hi: row[1], crown: false, fi: row[2], en: row[3] };
}

/** The flame a record states for a spreading edge at `rateMpm` on ground `lc`. */
export function flameAt(rateMpm: number, lc: LandCoverFi): { readonly lengthM: number; readonly band: FlameBand } {
  const lengthM = byramFlameM(rateMpm, FUEL_LOAD_KG_M2[lc]);
  return { lengthM, band: bandOf(lengthM) };
}

/** The generator's intensity class (1–5) of a flame, as its own scale reads (`traffic-text.ts` FLAME_FI). */
export function classOfFlame(lengthM: number, crown: boolean): number {
  if (crown) return 5;
  if (lengthM < 0.3) return 1;
  if (lengthM < 1) return 2;
  if (lengthM < 2) return 3;
  return 4;
}

/** Whether a stated band is consistent with a stated rate: it overlaps Byram's flame over the Kalajoki fuel range. */
export function bandFitsRate(band: { readonly lo: number; readonly hi: number | null }, rateMpm: number): boolean {
  const lo = byramFlameM(rateMpm, FUEL_LOAD_RANGE_KG_M2.lo);
  const hi = byramFlameM(rateMpm, FUEL_LOAD_RANGE_KG_M2.hi);
  return band.lo <= hi && (band.hi === null || band.hi >= lo);
}

export interface FlameRow {
  readonly step: number;
  readonly clock: string;
  /** The CA's achieved head rate during the step (m/min), the rate the records quote. */
  readonly headRosMpm: number;
  readonly crown: boolean;
  /** Flame lengths (m); null for a crown fire's head (no number). */
  readonly headM: number | null;
  readonly flankM: number | null;
  readonly rearM: number | null;
  readonly head: FlameBand;
  readonly flank: FlameBand;
  readonly rear: FlameBand;
  /** Whether this step's records follow the table (from the hinge). */
  readonly recordsFollow: boolean;
}

/**
 * The table, per step and segment, from the steps' achieved head rates (`SITE_SCENARIO.steps` or the CA run). Coniferous
 * surface fuel at the head (pine heath carries 97 % of the phase-B head cells; the crown run is flagged by its rate).
 */
export function flameTable(steps: readonly { readonly index: number; readonly clock: string; readonly headRos: { readonly achievedMpm: number } }[]): FlameRow[] {
  return steps.filter((s) => s.index >= 1).map((s) => {
    const rate = s.headRos.achievedMpm;
    const crown = rate > CROWN_ABOVE_MPM;
    const head = byramFlameM(rate, FUEL_LOAD_KG_M2.forest);
    const flank = Math.round(head * FLANK_FACTOR * 100) / 100;
    const rear = Math.round(head * REAR_FACTOR * 100) / 100;
    return {
      step: s.index, clock: s.clock, headRosMpm: rate, crown,
      headM: crown ? null : head, flankM: flank, rearM: rear,
      head: crown ? CROWN_BAND : bandOf(head), flank: bandOf(flank), rear: bandOf(rear),
      recordsFollow: s.index >= PHASE_B_FIRST_STEP,
    };
  });
}

/** The Kalajoki 2021 rate/flame pairs the table is checked against (fire_tactical.md, KAL 4.4/4.6). */
export const KALAJOKI_PAIRS: readonly { readonly rateMpm: readonly [number, number]; readonly flameM: readonly [number, number] }[] = [
  { rateMpm: [3, 4], flameM: [2.6, 2.6] },
  { rateMpm: [5, 7], flameM: [4, 4.4] },
];
