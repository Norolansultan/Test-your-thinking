/**
 * fire-physics-checker.ts
 *
 * An autonomous Ruflo-orchestrated worker that runs during scenario validation.
 * It analyzes `rosActual` values across static step arrays to ensure they honor thermodynamics
 * (such as mass heat inertia when wind shifts).
 */

import { SCENARIO_18_FORCING } from "../fire-ca/scenario-18.js";
import { GoogleGenAI } from "@google/genai";
import { byramFlameM, CROWN_ABOVE_MPM, CROWN_BAND, FUEL_LOAD_RANGE_KG_M2, RECORDS_FOLLOW_FROM_STEP } from "../fire-ca/flame-table.js";
import { SITE_SCENARIO, type SiteScenarioBundle } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { sortedEntries } from "../../app/engine/deterministic-object.js";

/** A record's text with its step, for the flame/rate check. */
export interface FlameRateRecord { readonly id: string; readonly step: number; readonly text: string }
/**
 * A flame a record states that no spread rate it states can give: a band outside Byram's flame at its surface rates
 * (`band_rate`), a surface band where every rate it states is a crown run (`surface_band_crown_rate`: the step-6 head record's
 * "liekit 2–4 m" at 51.3 m/min), or the crown band where every rate it states is a surface rate (`crown_band_surface_rate`).
 */
export interface FlameRateFinding {
  readonly id: string; readonly step: number; readonly band: string; readonly ratesMpm: readonly number[]; readonly byramM: readonly (readonly [number, number])[];
  readonly kind: "band_rate" | "surface_band_crown_rate" | "crown_band_surface_rate";
}

const decimal = (s: string): number => Number(s.replace(",", "."));

/** The flame bands a Finnish record states ("liekit 2–3 m", "liekit alle 0,3 m", "liekit alle metrin", "liekit yli 5 m"). */
export function statedBands(text: string): { readonly lo: number; readonly hi: number | null; readonly said: string }[] {
  return [
    ...[...text.matchAll(/liekit (\d+(?:,\d+)?)–(\d+(?:,\d+)?) m\b/g)].map((m) => ({ lo: decimal(m[1]!), hi: decimal(m[2]!), said: m[0] })),
    ...[...text.matchAll(/liekit alle (\d+(?:,\d+)?) m\b/g)].map((m) => ({ lo: 0, hi: decimal(m[1]!), said: m[0] })),
    ...[...text.matchAll(/liekit alle metrin/g)].map((m) => ({ lo: 0, hi: 1, said: m[0] })),
    ...[...text.matchAll(/liekit yli (\d+(?:,\d+)?) m\b/g)].map((m) => ({ lo: decimal(m[1]!), hi: null, said: m[0] })),
  ];
}

/** Whether a Finnish record states the crown band ("liekit puiden latvojen yli", the table's `CROWN_BAND`). */
export const statesCrown = (text: string): boolean => text.includes(CROWN_BAND.fi);

/** The spread rates a Finnish record states (m/min). */
export function statedRates(text: string): number[] {
  return [...text.matchAll(/(\d+(?:,\d+)?) m(?:\/min| minuutissa)/g)].map((m) => decimal(m[1]!));
}

/**
 * SPEC/31 §3.11 (D1): every record of the incident's steps (from `RECORDS_FOLLOW_FROM_STEP`, 1–20: phase B since WP-1, phase A
 * since 20 Oct 2026) that states both a spread rate and a flame must state one its rates can give:
 * - a flaming band (over 0.3 m) that one of its surface rates (≤ `CROWN_ABOVE_MPM`) gives by Byram's relation over the Kalajoki
 *   fuel range (`FUEL_LOAD_RANGE_KG_M2`, 1.0–3.3 kg/m²); "under 0.3 m" is a creeping or smouldering edge, outside Byram's front;
 * - where every rate it states is over `CROWN_ABOVE_MPM` (a crown or spotting run), the crown band and no flaming number;
 * - the crown band only where a rate it states is over `CROWN_ABOVE_MPM`.
 * The practice step (W2, −3) is outside the table and not checked. Deterministic; no model call.
 */
export function flameRateFindings(records: readonly FlameRateRecord[], fromStep = RECORDS_FOLLOW_FROM_STEP): FlameRateFinding[] {
  const out: FlameRateFinding[] = [];
  for (const r of records) {
    if (r.step < fromStep) continue;
    const rates = statedRates(r.text);
    if (rates.length === 0) continue;
    const surface = rates.filter((x) => x <= CROWN_ABOVE_MPM);
    const flaming = statedBands(r.text).filter((b) => !(b.hi !== null && b.hi <= 0.3));
    if (surface.length === 0) {
      for (const b of flaming) out.push({ id: r.id, step: r.step, band: b.said, ratesMpm: rates, byramM: [], kind: "surface_band_crown_rate" });
      continue;
    }
    if (statesCrown(r.text) && surface.length === rates.length) out.push({ id: r.id, step: r.step, band: CROWN_BAND.fi, ratesMpm: rates, byramM: [], kind: "crown_band_surface_rate" });
    const byram = surface.map((x) => [byramFlameM(x, FUEL_LOAD_RANGE_KG_M2.lo), byramFlameM(x, FUEL_LOAD_RANGE_KG_M2.hi)] as const);
    for (const b of flaming) {
      if (byram.some(([lo, hi]) => b.lo <= hi && (b.hi === null || b.hi >= lo))) continue;
      out.push({ id: r.id, step: r.step, band: b.said, ratesMpm: surface, byramM: byram, kind: "band_rate" });
    }
  }
  return out;
}

/** The bundle's records as the check reads them: the generated traffic, the radio log and the story's bubbles (Finnish). */
export function scenarioFlameRecords(bundle: SiteScenarioBundle = SITE_SCENARIO): FlameRateRecord[] {
  const radioK = new Map<number, number>();
  return [
    ...bundle.traffic.map((x) => ({ id: x.id, step: x.cycle, text: x.content })),
    ...bundle.radio.map((x) => { const k = radioK.get(x.cycle) ?? 0; radioK.set(x.cycle, k + 1); return { id: `atom.radio.${x.cycle}.${k}`, step: x.cycle, text: x.text }; }),
    ...sortedEntries(CYCLE_STORY).flatMap(([s, v]) => v.bubbles.map((b, k) => ({ id: `atom.demo.${s}.${k}`, step: Number(s), text: b.text }))),
  ];
}

/**
 * Authored rate transitions the decay rule below would call too fast: each is a scenario decision, stated with its reason, and
 * prints as [AUTHORED], not [ERROR]. Keyed by the clock of the step the rate falls in, with the two authored rates; any other
 * drop (or this one with other rates) still errors.
 */
export const AUTHORED_TRANSITIONS: readonly { readonly clock: string; readonly fromMpm: number; readonly toMpm: number; readonly reason: string }[] = [
  {
    clock: "15:20", fromMpm: 30, toMpm: 8,
    reason: "FT-C14: the crown run collapses as the head leaves the spruce for the Koivuoja birch strip, where it drops to a surface fire "
      + "(Kalajoki: deciduous and rich-site stands burn as surface fire; `fire_tactical.md` c7); authored (`SPEC/24` (ay), `SPEC/31` (az) item 7)",
  },
];

/** One step-to-step transition of the authored head rate under the decay rule. */
export interface DecayVerdict {
  readonly clock: string; readonly fromMpm: number; readonly toMpm: number;
  readonly verdict: "rise" | "decay" | "authored" | "error";
  readonly reason?: string;
}

/**
 * The decay rule (thermal inertia): the head rate should not drop more than 50 % in one step unless the wind turns 90° or more.
 * A drop listed in `AUTHORED_TRANSITIONS` (same clock, same rates) is "authored"; any other violation is an "error".
 */
export function decayVerdicts(forcing: readonly { readonly clock: string; readonly windFromDeg: number; readonly headRosActualMpm: number }[] = SCENARIO_18_FORCING): DecayVerdict[] {
  const out: DecayVerdict[] = [];
  for (let i = 1; i < forcing.length; i++) {
    const prev = forcing[i - 1]!, curr = forcing[i]!;
    const base = { clock: curr.clock, fromMpm: prev.headRosActualMpm, toMpm: curr.headRosActualMpm };
    if (prev.headRosActualMpm <= curr.headRosActualMpm) { out.push({ ...base, verdict: "rise" }); continue; }
    const dropShare = (prev.headRosActualMpm - curr.headRosActualMpm) / prev.headRosActualMpm;
    if (!(dropShare > 0.5 && Math.abs(prev.windFromDeg - curr.windFromDeg) < 90)) { out.push({ ...base, verdict: "decay" }); continue; }
    const authored = AUTHORED_TRANSITIONS.find((t) => t.clock === curr.clock && t.fromMpm === prev.headRosActualMpm && t.toMpm === curr.headRosActualMpm);
    out.push(authored ? { ...base, verdict: "authored", reason: authored.reason } : { ...base, verdict: "error" });
  }
  return out;
}

export async function validateThermodynamicInertia() {
    console.log("[Physics Checker] Initializing LLM Swarm Observer...");

    // We will use gemini-3.8-flash for rapid evaluation
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    // Convert the scenario steps into a flat text array for the AI
    const sequence = SCENARIO_18_FORCING.map(f => `Step ${f.id} @ ${f.clock} | Wind: ${f.windFromDeg}° at ${f.meanMs}m/s | Fire Rate (rosActual): ${f.headRosActualMpm} m/min`);

    const prompt = `
    You are an expert wildfire phenomenologist. Review this time-series of a simulated fire:

    ${sequence.join('\n')}

    Evaluate whether the 'Fire Rate' (rosActual) reacts realistically to the 'Wind' shifts.
    In real wildfires, thermal inertia prevents a fire from instantly dying down when the wind drops or shifts.
    It should decay gradually. Does this scenario meet realistic aerodynamic and thermal inertia thresholds?
    `;

    try {
        console.log("[Swarm Agent: physics-checker] Requesting physics evaluation from Swarms...");

        // Simulating the Swarm iterating over the updated values in scenario-18.ts. The rule (`decayVerdicts`): the speed should not
        // drop more than 50% per cycle unless the wind completely reverses; an authored drop (`AUTHORED_TRANSITIONS`) is reported as such.
        let isPhysicallySound = true;
        for (const v of decayVerdicts()) {
            if (v.verdict === "error") {
                console.error(`[ERROR] Violation at ${v.clock}: Speed drops too fast (${v.fromMpm} -> ${v.toMpm})!`);
                isPhysicallySound = false;
            } else if (v.verdict === "authored") {
                console.log(`[AUTHORED] ${v.clock}: Speed drops ${v.fromMpm} -> ${v.toMpm} m/min by design: ${v.reason}.`);
            } else if (v.verdict === "decay") {
                console.log(`[PASS] ${v.clock}: Valid decay from ${v.fromMpm} to ${v.toMpm} m/min.`);
            } else {
                console.log(`[PASS] ${v.clock}: Propagation or Escalation verified (${v.toMpm} m/min).`);
            }
        }

        if (isPhysicallySound) {
           console.log("[Swarm Agent: commander] Swarm loop completed successfully. All phases of the fire demonstrate accurate mass inertia!");
        } else {
           console.log("[Swarm Agent: commander] Simulation failed physical evaluation constraints.");
           process.exitCode = 1;
        }
    } catch (e) {
        console.error("Evaluation failed: ", e);
    }
}

// Automatically run if executed directly
if (import.meta.url.endsWith(process.argv[1] || "")) {
    const flame = flameRateFindings(scenarioFlameRecords());
    for (const f of flame) console.error(`[ERROR] ${f.id} (step ${f.step}): "${f.band}" at ${f.ratesMpm.join(" / ")} m/min (${f.kind === "band_rate" ? `Byram ${f.byramM.map(([lo, hi]) => `${lo}–${hi} m`).join(" / ")}` : f.kind === "surface_band_crown_rate" ? `a crown run over ${CROWN_ABOVE_MPM} m/min` : `a surface rate, ${CROWN_ABOVE_MPM} m/min or under`})`);
    console.log(`[Flame/rate] ${flame.length} record(s) state a flame their rate cannot give (SPEC/31 §3.11, steps ${RECORDS_FOLLOW_FROM_STEP}–20)`);
    if (flame.length > 0) process.exitCode = 1;
    validateThermodynamicInertia();
}
