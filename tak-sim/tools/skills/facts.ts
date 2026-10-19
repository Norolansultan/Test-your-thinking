/**
 * The scenario's information as the wildfire skills' channel contract (`wildfire-scenario-pipeline`,
 * `references/geoai_handoffs.md`): `ground_truth/facts.json`, `channels/radio.json`, `channels/ai_packages.json`.
 *
 * - Facts: every corpus atom of the scenario contract (`buildDemoScenario().atoms`: the traffic records, the radio items
 *   `atom.radio.<step>.<k>`, the story bubbles `atom.demo.<step>.<k>`, the forecasts `evt.wx.*`, the designed events, the
 *   load-bearing lateral items and the register entries), keeping our atom ids (the skills' F### convention is not used),
 *   plus the duty officer's two messages (V1's intent, the hinge directive), which are pushed to both groups but are not
 *   corpus atoms (neither Haku nor the Thinker can find them).
 * - The pushed channel ("radio"): what both groups receive in the message log, in delivery order — every view's
 *   `pushedAtomIds` at `startsAtVirtual + deliveryOffsetsSeconds`, the practice view's included, and the duty messages.
 * - The retrievable channel ("ai"): what the query tools can return. The time gate (`app/retrieval/time-gate.ts`) makes an
 *   atom reachable once its STEP is reached, pushed or recorded alike; Haku runs in both groups, the Thinker in the guide
 *   group (`reasoning_intent`), both behind the same gate. One package per cycle and tool.
 *
 * Cycles: the skills' `cycle` is the main step 1–20; the practice view (step W2) and the prologue are cycle 0 (`geo.ts`).
 */

import type { InfoAtom, ScenarioContract } from "../../app/scenario/types.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { viewOfStep } from "../../app/scenario/views.js";
import { clockOf, cycleOfStep, cycleOfVirtual, stepOfVirtual } from "./geo.js";

export type Route = "pushed" | "recorded";

export interface Fact {
  readonly id: string;
  /** The skills' cycle the fact is first available in: its step (the time gate's unit), cycle 0 for the practice view and prologue. */
  readonly cycle_true_from: number;
  /** When it was observed or said, on the scenario clock. */
  readonly time: string;
  readonly source: string;
  readonly text_fi: string;
  readonly text_en: string | null;
  readonly route: Route;
  /** The world-state step (−3 = the practice step W2) and the view that shows it. */
  readonly step: number;
  readonly view: string | null;
  readonly tier: string;
  /** False for the planted false record (fault F7): the record exists, its content is not true. */
  readonly is_ground_truth: boolean;
  readonly load_bearing: boolean;
}

export interface RadioMessage {
  readonly cycle: number;
  readonly time: string;
  readonly fact_ids: readonly string[];
  readonly view: string;
  readonly offset_s: number;
  readonly source: string;
}

export interface AiPackage {
  readonly cycle: number;
  readonly id: string;
  readonly fact_ids: readonly string[];
  readonly group: "both" | "guide";
  readonly tool: "haku" | "thinker";
}

export interface Channels {
  readonly facts: readonly Fact[];
  readonly radio: readonly RadioMessage[];
  readonly packages: readonly AiPackage[];
}

/** An atom's Finnish text, whatever its record kind (a register entry: its surface, id and fields). */
export function atomFi(a: InfoAtom): string {
  const r = a.record;
  switch (r.kind) {
    case "situation_log": return r.text;
    case "lateral_traffic": return r.content;
    case "aerial_observation": return r.text;
    case "reference": return `${r.surface} ${r.featureId}: ${JSON.stringify(r.fields)}`;
    case "traffic_log": return r.content ?? "";
    case "radio_traffic": return r.transcriptFi ?? "";
    default: return JSON.stringify(r);
  }
}

/** The duty officer's messages as facts: ids `duty.v<view>`; P2 (the duty officer) is their source in both groups. */
export function dutyFacts(s: ScenarioContract): Fact[] {
  return s.dutyOfficerMessages.map((m) => {
    const step = stepOfVirtual(m.at as number);
    const en = tr("en", m.text);
    return {
      id: `duty.v${m.cycle}`, cycle_true_from: cycleOfStep(step), time: clockOf(m.at as number), source: "P2", text_fi: m.text,
      text_en: en === m.text ? null : en, route: "pushed", step, view: `V${m.cycle}`, tier: "duty_officer", is_ground_truth: true, load_bearing: false,
    };
  });
}

/** Every view's pushed deliveries, the practice view first, then the duty messages, in time order (stable). */
export function pushedStream(s: ScenarioContract): RadioMessage[] {
  const atomSource = new Map(s.atoms.map((a) => [a.id, a.provenance.sourceId]));
  const views = [{ id: "VP", spec: s.practice.cycle }, ...s.cycles.map((c) => ({ id: `V${c.index}`, spec: c }))];
  const out: { t: number; m: RadioMessage }[] = [];
  for (const { id, spec } of views) {
    spec.pushedAtomIds.forEach((atomId, i) => {
      const offset = spec.deliveryOffsetsSeconds[i]!;
      const t = (spec.startsAtVirtual as number) + offset;
      out.push({ t, m: { cycle: cycleOfVirtual(t), time: clockOf(t), fact_ids: [atomId], view: id, offset_s: offset, source: atomSource.get(atomId) ?? "" } });
    });
  }
  for (const d of dutyFacts(s)) {
    const msg = s.dutyOfficerMessages.find((m) => `duty.v${m.cycle}` === d.id)!;
    out.push({ t: msg.at as number, m: { cycle: d.cycle_true_from, time: d.time, fact_ids: [d.id], view: d.view!, offset_s: 0, source: "P2" } });
  }
  return out.map((x, i) => ({ ...x, i })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.m);
}

/** One package per cycle and tool: the atoms that become reachable in that cycle (the time gate), Haku for both groups, the Thinker for the guide group. */
export function retrievablePackages(s: ScenarioContract): AiPackage[] {
  const byCycle = new Map<number, string[]>();
  for (const a of s.atoms) {
    const c = cycleOfStep(a.cycle);
    byCycle.set(c, [...(byCycle.get(c) ?? []), a.id]);
  }
  const cycles = [...byCycle.keys()].sort((a, b) => a - b);
  const pad = (c: number) => String(c).padStart(2, "0");
  return cycles.flatMap((c) => [
    { cycle: c, id: `haku.c${pad(c)}`, fact_ids: byCycle.get(c)!, group: "both" as const, tool: "haku" as const },
    { cycle: c, id: `thinker.c${pad(c)}`, fact_ids: byCycle.get(c)!, group: "guide" as const, tool: "thinker" as const },
  ]);
}

export function buildChannels(s: ScenarioContract): Channels {
  const radio = pushedStream(s);
  const pushed = new Set(radio.flatMap((m) => m.fact_ids));
  const seen = new Set<string>();
  const facts: Fact[] = [];
  for (const a of s.atoms) {
    if (seen.has(a.id)) continue; // the contract's atoms are unique (validator); kept defensive
    seen.add(a.id);
    facts.push({
      id: a.id, cycle_true_from: cycleOfStep(a.cycle), time: clockOf(a.provenance.observedAt as number), source: a.provenance.sourceId,
      text_fi: atomFi(a), text_en: recordEn(a.id) ?? null, route: pushed.has(a.id) ? "pushed" : "recorded",
      step: a.cycle as number, view: viewOfStep(a.cycle)?.id ?? null, tier: a.tier,
      is_ground_truth: a.truth.isGroundTruth, load_bearing: a.loadBearing,
    });
  }
  facts.push(...dutyFacts(s));
  return { facts, radio, packages: retrievablePackages(s) };
}
