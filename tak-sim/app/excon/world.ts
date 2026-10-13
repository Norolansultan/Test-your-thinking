/**
 * EXCON (SPEC/28 §8) — the white cell's model of the incident: per view, the TRUTH (the envelope's flag and
 * accuracy label, the CA perimeter at the horizon, where the truth runs outside the envelope, the omission
 * marker, the branch truth, the designed events F7 / rekindle / omission / contradiction / directive) beside
 * THE PARTICIPANT'S PICTURE, which is derived exactly as the session derives it: the view's spec and envelope
 * folded through `applyRenderEvent` (`app/render/render-tree.ts`), i.e. through `toRenderableCycle` /
 * `toRenderableEnvelope` at the render boundary (I4). The right-hand map therefore cannot show anything the
 * participant's map could not.
 *
 * RESEARCHER-ONLY. This module reads truth on purpose. Nothing outside `app/excon/` may import it, the
 * participant bundle never reaches it, and the production build refuses it (test/excon/isolation.spec.ts,
 * vite.config.ts `exconBuildGuard`, tools/deploy/excon-guard.ts).
 */

import type { LatLon, Polygon } from "../engine/primitives.js";
import { buildDemoScenario } from "../scenario/demo-scenario.js";
import { SITE_SCENARIO, type SiteScenarioBundle, type SiteStep } from "../scenario/site-scenario.js";
import { F7_TRUTH_INVARIANT } from "../scenario/designed-events.js";
import { DESIGNED_EVENT_IDS, LOAD_BEARING_T4_IDS, type Envelope, type Flag, type InfoAtom, type ScenarioContract, type ViewEnvelope, type ViewSpec } from "../scenario/types.js";
import { HINGE_AFTER_VIEW, SESSION_VIEWS, STEP_SECONDS, viewOfStep, viewStartVirtual } from "../scenario/views.js";
import { applyRenderEvent, EMPTY_RENDER_TREE, type RenderTree } from "../render/render-tree.js";
import { subtract, toLatLon, toPts, unionAll } from "../render/polygon-ops.js";
import { ringHa } from "../render/projection-growth.js";
import { recordEn, tr } from "../i18n/text.js";
import { compareStrings } from "../engine/deterministic-object.js";
import { closeRing, distanceToPolylineM } from "./geometry.js";
import { buildTimeline, type ExconStep } from "./timeline.js";

/** The marker string the production build guard looks for (tools/deploy/excon-guard.ts): it must never ship. */
export const EXCON_MARKER = "EXCON-RESEARCHER-ONLY-SHOWS-TRUTH";

export type ExconEventKind = "intent" | "f7" | "rekindle" | "t4" | "hinge" | "directive" | "omission" | "contradiction";

export interface ExconEvent {
  readonly key: string;
  readonly kind: ExconEventKind;
  readonly viewIndex: number;
  /** World-state step it happens in; null for a view-level marker (the hinge). */
  readonly step: number | null;
  /** Seconds into the view (a merged view's second step starts at 1200); null when not tied to a moment. */
  readonly viewOffsetS: number | null;
  /** Short English label, researcher-facing. */
  readonly title: string;
  /** What is actually true / why it matters (English). */
  readonly truth: string;
  readonly source: string | null;
  /** The record as authored (Finnish), and its English where one exists. */
  readonly textFi: string | null;
  readonly textEn: string | null;
  /** How the participant can meet it. */
  readonly reach: string;
}

export interface TrafficItem {
  readonly id: string;
  readonly viewOffsetS: number;
  readonly source: string;
  readonly textFi: string;
  readonly textEn: string | null;
}

export interface ExconTraffic {
  /** Pushed (T1) items delivered to the participant in this view. */
  readonly pushedTotal: number;
  /** Pushed per step of the view: [first] or [first, second]. */
  readonly pushedPerStep: readonly number[];
  readonly items: readonly TrafficItem[];
  /** The duty officer's messages opening the view (P2's intent at V1, the directive at V8). */
  readonly dutyMessages: readonly { readonly textFi: string; readonly textEn: string; readonly guidance: boolean }[];
  /** Recorded (T2/T3/T4) items that exist by the end of the view: what Haku/Thinker could reach, time-gated. */
  readonly recordedByEnd: number;
}

export interface ExconViewInfo {
  readonly index: number;
  readonly id: string;
  readonly practice: boolean;
  readonly phase: "A" | "B" | null;
  readonly steps: readonly number[];
  readonly clock: string;
  readonly horizonClock: string;
  readonly horizonMinutes: number;
  /** TRUTH: the envelope's flag as the scenario scores it. */
  readonly flag: Flag;
  /** SPEC/26 §3's flag for the view (null for VP) and the CA's reason for the derived one. */
  readonly expectedFlag: Flag | null;
  readonly flagReason: string;
  readonly accuracyLabel: Envelope["accuracy_label"];
  readonly isOmissionCycle: boolean;
  readonly isContradictionView: boolean;
  readonly spec: ViewSpec;
  readonly envelope: ViewEnvelope;
  /** TRUTH at the horizon: `actualPerimeterAtEnd` and its detached parts. */
  readonly truthAtHorizon: readonly Polygon[];
  /**
   * Where the horizon truth lies outside the envelope by more than its containment tolerance (the envelope's
   * `breachGeometry` when authored, else computed: truth minus envelope, keeping regions deeper than the tolerance).
   */
  readonly breach: readonly Polygon[];
  readonly breachHa: number;
  /** How far outside the envelope the truth reaches at most (m); 0 when inside. */
  readonly breachDepthM: number;
  readonly truthHa: number;
  readonly envelopeHa: number;
  /** The candidate developments offered after "fundamentally wrong", with the CA-derived truth. */
  readonly branches: readonly { readonly id: string; readonly textFi: string; readonly actual: boolean | null }[];
  readonly events: readonly ExconEvent[];
  readonly traffic: ExconTraffic;
}

export interface WeatherRow {
  readonly frame: number;
  readonly step: number;
  readonly stepId: string;
  readonly viewId: string;
  readonly clock: string;
  readonly fromDeg: number;
  readonly meanMs: number;
  readonly gustMs: number;
  /** SPEC/18 §7: the authored true head rate and the rate the envelope assumes (m/min). */
  readonly headActualMpm: number;
  readonly headEnvelopeMpm: number;
  readonly areaHa: number;
}

export interface ExconWorld {
  readonly scenario: ScenarioContract;
  readonly site: SiteScenarioBundle;
  readonly timeline: readonly ExconStep[];
  readonly views: readonly ExconViewInfo[];
  readonly weather: readonly WeatherRow[];
  readonly events: readonly ExconEvent[];
}

/**
 * The flag itself is the CA's (`tools/fire-ca/flags.ts`: 25 m cells, the envelope dilated by the tolerance, at
 * least 3 escaped cells). The outlines here are traced from those cells, so a region counts as breach geometry
 * only when it is at least 3 cells big and reaches more than the tolerance plus one cell beyond the envelope.
 */
const CA_CELL_M = 25;
const MIN_BREACH_HA = (3 * CA_CELL_M * CA_CELL_M) / 10_000;

export function siteStepOf(site: SiteScenarioBundle, step: number): SiteStep {
  const s = site.steps.find((x) => x.index === step);
  if (!s) throw new RangeError(`site-scenario.json has no step ${step}`);
  return s;
}

export function viewSpecOf(scenario: ScenarioContract, viewIndex: number): ViewSpec {
  if (viewIndex === scenario.practice.cycle.index) return scenario.practice.cycle;
  const c = scenario.cycles.find((x) => x.index === viewIndex);
  if (!c) throw new RangeError(`the scenario has no view ${viewIndex}`);
  return c;
}

export function viewEnvelopeOf(scenario: ScenarioContract, viewIndex: number): ViewEnvelope {
  if (viewIndex === scenario.practice.envelope.cycle) return scenario.practice.envelope;
  const e = scenario.envelopes.find((x) => x.cycle === viewIndex);
  if (!e) throw new RangeError(`the scenario has no envelope for view ${viewIndex}`);
  return e;
}

/**
 * The participant's map state at a view and step: exactly the session's render events (`cycle_start`, the
 * envelope revealed, and `step_boundary` for a merged view's second step) folded into a render tree, so every
 * object passes `toRenderableCycle` / `toRenderableEnvelope` and their truth-key assertion.
 */
export function participantPicture(scenario: ScenarioContract, viewIndex: number, stepShown: 1 | 2): RenderTree {
  const spec = viewSpecOf(scenario, viewIndex);
  let tree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: spec });
  tree = applyRenderEvent(tree, { kind: "envelope_revealed", envelope: viewEnvelopeOf(scenario, viewIndex) });
  if (stepShown === 2) tree = applyRenderEvent(tree, { kind: "step_boundary", cycle: spec });
  return tree;
}

/** A record's text, whatever its kind. */
export function atomText(a: InfoAtom): string {
  const r = a.record;
  switch (r.kind) {
    case "situation_log": return r.text;
    case "lateral_traffic": return r.content;
    case "aerial_observation": return r.text;
    case "radio_traffic": return r.transcriptFi ?? "(voice only)";
    case "traffic_log": return r.content ?? "(voice only)";
    case "unit_status": return `${r.unitId}: ${r.status}`;
    case "task_record": return r.callerAccount;
    case "weather": return `wind ${r.windDirectionDeg}° ${r.windMeanMs} m/s`;
    case "reference": return `${r.surface} ${r.featureId}`;
    default: return "";
  }
}

const REACH: Readonly<Record<InfoAtom["tier"], string>> = {
  T1_pushed: "pushed to the message log",
  T2_system: "recorded (T2): found only by searching",
  T3_person: "recorded unit answer (T3): found only by searching",
  T4_lateral: "lateral traffic (T4): found only by searching",
};

/** The truth outside the envelope by more than the envelope's tolerance, and the deepest point's distance (m). */
function breachOf(truth: readonly Polygon[], env: ViewEnvelope): { readonly regions: Polygon[]; readonly depthM: number } {
  const envRings = [env.polygon, ...env.detachedParts].flatMap((p) => (p[0] && p[0].length >= 4 ? [p[0]] : []));
  const depth = (ring: readonly LatLon[]) => ring.reduce((m, p) => Math.max(m, Math.min(...envRings.map((r) => distanceToPolylineM(p, r)))), 0);
  if (env.breachGeometry) return { regions: [env.breachGeometry], depthM: env.breachGeometry[0] ? depth(env.breachGeometry[0]) : 0 };
  const cut = unionAll(envRings.map(toPts));
  const regions: Polygon[] = [];
  let depthM = 0;
  for (const part of truth) {
    const outer = part[0];
    if (!outer || outer.length < 4) continue;
    for (const region of subtract(toPts(outer), cut)) {
      const ring = closeRing(toLatLon(region.outer));
      const d = depth(ring);
      if (ringHa(ring) < MIN_BREACH_HA || d <= env.containmentToleranceMetres + CA_CELL_M) continue;
      depthM = Math.max(depthM, d);
      regions.push([ring, ...region.holes.map((h) => closeRing(toLatLon(h)))]);
    }
  }
  return { regions, depthM };
}

const polygonsHa = (polys: readonly Polygon[]): number => polys.reduce((s, p) => s + (p[0] ? ringHa(closeRing(p[0])) : 0), 0);

function atomEvent(scenario: ScenarioContract, id: string, kind: ExconEventKind, title: string, truth: string): ExconEvent | null {
  const a = scenario.atoms.find((x) => x.id === id);
  if (!a) return null;
  const view = viewOfStep(a.cycle);
  if (!view) return null;
  return {
    key: id, kind, viewIndex: view.index, step: a.cycle,
    viewOffsetS: a.provenance.observedAt - viewStartVirtual(view),
    title, truth, source: a.provenance.sourceId, textFi: atomText(a), textEn: recordEn(id) ?? null, reach: REACH[a.tier],
  };
}

/** Every designed event of the incident, in view and time order. */
export function designedEvents(scenario: ScenarioContract): ExconEvent[] {
  const out: (ExconEvent | null)[] = [];
  for (const m of scenario.dutyOfficerMessages) {
    out.push({
      key: m.isStrategicGuidance ? "duty.directive" : `duty.intent.${m.cycle}`,
      kind: m.isStrategicGuidance ? "directive" : "intent",
      viewIndex: m.cycle, step: null, viewOffsetS: 0,
      title: m.isStrategicGuidance ? "Directive from P2 (strategic guidance)" : "Phase-A intent from P2",
      truth: m.isStrategicGuidance
        ? "Reverses phase A's offensive intent: defensive, lines on roads and water, protect the village and the cottages. Deliberately does not fit every view (Paper 2's alignment outcome)."
        : "Direct attack where intensity allows: the phase-A posture baseline (reported descriptively, not coded as aligned).",
      source: "P2", textFi: m.text, textEn: tr("en", m.text), reach: m.isStrategicGuidance ? "hinge screen + opening message of V8 + on-screen line from V8" : "opening message of V1",
    });
  }
  out.push({
    key: "hinge", kind: "hinge", viewIndex: HINGE_AFTER_VIEW, step: null, viewOffsetS: null,
    title: `Hinge after V${HINGE_AFTER_VIEW} (${scenario.hinge.pauseSeconds / 60}-min pause)`,
    truth: "Phase A ends; the directive is shown on the pause screen with the manipulation check.",
    source: null, textFi: null, textEn: null, reach: "pause screen",
  });
  const f7 = `the 110 kV line is ${String(F7_TRUTH_INVARIANT.expected).toUpperCase()} for the whole incident (invariant ${F7_TRUTH_INVARIANT.name})`;
  out.push(atomEvent(scenario, DESIGNED_EVENT_IDS.gridRecord, "f7", "F7 set-up: grid operator — line still live, de-energising requested", `TRUE record (load-bearing): ${f7}; it contradicts the planted record two steps later.`));
  out.push(atomEvent(scenario, DESIGNED_EVENT_IDS.planted, "f7", "F7 planted FALSE record: \"110 kV line de-energised, confirmed\"", `FALSE: ${f7}. Never corrected; holding "de-energised" is scored wrong (H9).`));
  out.push(atomEvent(scenario, DESIGNED_EVENT_IDS.heliLineClearance, "f7", "HELI1 keeps clear of the 110 kV line", "Later traffic still treats the line as a hazard (not a correction)."));
  for (const id of DESIGNED_EVENT_IDS.inHand) out.push(atomEvent(scenario, id, "rekindle", "Rekindle arc: L3 (origin's south edge) reported in hand", "Apparent success as the wind eases; the edge is not checked with a thermal camera."));
  out.push(atomEvent(scenario, DESIGNED_EVENT_IDS.objection, "rekindle", "Rekindle arc: VPK objects on TOIMINTA-2 (load-bearing)", "The warning is right: stumps and slash keep smouldering and flare up at step 12 when the wind turns west (V9)."));
  out.push(atomEvent(scenario, DESIGNED_EVENT_IDS.overruled, "rekindle", "Rekindle arc: the L3 sector leader overrules VPK", "KY21 and VPK leave the origin's south edge for the north flank."));
  const t4Title: Readonly<Record<(typeof LOAD_BEARING_T4_IDS)[number], [string, string]>> = {
    "t4.water_state": ["T4: VPK's water lasts ~20 min", "Load-bearing lateral traffic; consequence at step 13."],
    "t4.ember_warning": ["T4: embers crossing the ridge", "Load-bearing lateral traffic; consequence at step 8."],
    "t4.private_doubt": ["T4 echo of the rekindle: VPK doubts the old edge", "Load-bearing; the omission (V9) follows in the next view."],
  };
  for (const id of LOAD_BEARING_T4_IDS) out.push(atomEvent(scenario, id, "t4", t4Title[id][0], t4Title[id][1]));
  const om = scenario.omission;
  for (const id of om.developmentAtomIds) {
    out.push(atomEvent(scenario, id, "omission", `Omission (${om.mechanism}): the origin's old south edge flares up`, "Outside EVERY envelope (categorical breach); no branch statement is true in this view."));
  }
  const c = scenario.contradiction;
  out.push(atomEvent(scenario, c.premiseAtomId, "contradiction", "Contradiction premise (aerial): north edge flared up", "Both reports are right: the flare-up is east of the track, outside EK14's sector."));
  out.push(atomEvent(scenario, c.counterAtomId, "contradiction", "Contradiction counter (ground): \"our line holds\"", "True for EK14's own sector only."));
  out.push(atomEvent(scenario, c.reconcilingAtomId, "contradiction", "Contradiction reconciled (T4): smoke east of the track, not our sector", "The lateral item that explains the conflict; found only by searching."));
  return out
    .filter((e): e is ExconEvent => e !== null)
    .sort((a, b) => a.viewIndex - b.viewIndex || (a.viewOffsetS ?? Infinity) - (b.viewOffsetS ?? Infinity) || compareStrings(a.key, b.key));
}

function trafficOf(scenario: ScenarioContract, spec: ViewSpec, viewIndex: number, lastStep: number): ExconTraffic {
  const byId = new Map(scenario.atoms.map((a) => [a.id, a] as const));
  const items: TrafficItem[] = spec.pushedAtomIds.map((id, i) => {
    const a = byId.get(id);
    return {
      id, viewOffsetS: spec.deliveryOffsetsSeconds[i] ?? 0,
      source: a?.provenance.sourceId ?? "?", textFi: a ? atomText(a) : "", textEn: recordEn(id) ?? null,
    };
  });
  const perStep = spec.steps === 2
    ? [items.filter((t) => t.viewOffsetS < STEP_SECONDS).length, items.filter((t) => t.viewOffsetS >= STEP_SECONDS).length]
    : [items.length];
  const duty = scenario.dutyOfficerMessages.filter((m) => m.cycle === viewIndex);
  return {
    pushedTotal: items.length,
    pushedPerStep: perStep,
    items,
    dutyMessages: duty.map((m) => ({ textFi: m.text, textEn: tr("en", m.text), guidance: m.isStrategicGuidance })),
    recordedByEnd: scenario.atoms.filter((a) => a.tier !== "T1_pushed" && a.cycle <= lastStep).length,
  };
}

export function buildExconWorld(scenario: ScenarioContract = buildDemoScenario(), site: SiteScenarioBundle = SITE_SCENARIO): ExconWorld {
  const timeline = buildTimeline();
  const events = designedEvents(scenario);
  const views: ExconViewInfo[] = SESSION_VIEWS.map((v) => {
    const spec = viewSpecOf(scenario, v.index);
    const envelope = viewEnvelopeOf(scenario, v.index);
    const sv = site.views.find((x) => x.index === v.index);
    const truthAtHorizon: Polygon[] = [spec.actualPerimeterAtEnd, ...spec.actualDetachedAtEnd];
    const { regions: breach, depthM: breachDepthM } = breachOf(truthAtHorizon, envelope);
    const lastStep = v.steps[v.steps.length - 1]!;
    return {
      index: v.index, id: v.id, practice: v.practice, phase: v.phase, steps: v.steps,
      clock: spec.clockLabel, horizonClock: sv?.horizonClock ?? "", horizonMinutes: v.steps.length * (STEP_SECONDS / 60),
      flag: envelope.flag, expectedFlag: v.flag, flagReason: sv?.flagReason ?? "", accuracyLabel: envelope.accuracy_label,
      isOmissionCycle: envelope.isOmissionCycle, isContradictionView: scenario.contradiction.cycle === v.index,
      spec, envelope, truthAtHorizon, breach,
      breachHa: polygonsHa(breach), breachDepthM, truthHa: polygonsHa(truthAtHorizon), envelopeHa: polygonsHa([envelope.polygon, ...envelope.detachedParts]),
      branches: (v.practice ? scenario.practice.branchStatements : scenario.branchStatements.filter((b) => b.cycle === v.index))
        .map((b) => ({ id: b.branchId, textFi: b.statementFi, actual: b.truth.isActualDevelopment }))
        .sort((a, b) => compareStrings(a.id, b.id)),
      events: events.filter((e) => e.viewIndex === v.index),
      traffic: trafficOf(scenario, spec, v.index, lastStep),
    };
  });
  const weather: WeatherRow[] = timeline.map((t) => {
    const s = siteStepOf(site, t.step);
    return {
      frame: t.frame, step: t.step, stepId: t.stepId, viewId: t.viewId, clock: s.clock,
      fromDeg: s.wind.fromDeg, meanMs: s.wind.meanMs, gustMs: s.wind.gustMs,
      headActualMpm: s.headRos.actualMpm, headEnvelopeMpm: s.headRos.envelopeMpm, areaHa: s.areaHa,
    };
  });
  return { scenario, site, timeline, views, weather, events };
}
