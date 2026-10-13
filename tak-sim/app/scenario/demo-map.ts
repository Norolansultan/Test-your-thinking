/**
 * The demo scenario's map state per view, from the frozen build of the modelled incident
 * (`site-scenario.json`, `npm run fire:ca`): perimeters, envelopes, units, aircraft, wind, rate
 * marks and the incident's own radio traffic. Split out of `demo-scenario.ts`, which assembles it.
 *
 * SPEC/26 §2: a view shows its FIRST step's map; a merged view also carries its second step's unit,
 * aircraft and sensor positions (`CycleSpec.stepBoundary`), which the session switches to when the
 * second step's virtual time is reached inside the view.
 */

import { asVirtualTime, type CycleIndex, type LatLon } from "../engine/primitives.js";
import type { Certainty, Envelope, Flag, InfoAtom, RateMark, SensorFootprint, StepBoundary } from "./types.js";
import { SITE_SCENARIO, type SiteStep, type SiteView } from "./site-scenario.js";
import { viewMinSecondsFor, STEP_SECONDS, type SessionView } from "./views.js";

export function siteStep(step: number): SiteStep {
  const c = SITE_SCENARIO.steps.find((x) => x.index === step);
  if (!c) throw new Error(`site-scenario.json has no step ${step}; re-run npm run fire:ca`);
  return c;
}

export function siteView(index: number): SiteView {
  const v = SITE_SCENARIO.views.find((x) => x.index === index);
  if (!v) throw new Error(`site-scenario.json has no view ${index}; re-run npm run fire:ca`);
  return v;
}

const DRONES = ["DR1", "DR2", "DR3"] as const;

const provenanceAt = (sourceId: string, sourceClassId: string, observedAt: number, deliveredAt: number) => ({
  sourceId, sourceClassId, sourceReliability: "known-good" as const,
  observedAt: asVirtualTime(observedAt), recordedAt: asVirtualTime(deliveredAt), deliveredAt: asVirtualTime(deliveredAt),
  certainty: { kind: "confirmed" as const }, supports: [], contradicts: [],
});

/** The source class of a rate observer: drones, the spotting aircraft and the helicopter are sensors (visual), crews experienced. */
function observerClass(observerId: string): "sc.sensor" | "sc.experienced" {
  return /^(DR\d|SPOT$|HELI1$)/.test(observerId) ? "sc.sensor" : "sc.experienced";
}

/**
 * SPEC/12 §5, §9 — observed rate of spread (data, not projection). One head mark per view at the
 * head of the reported fire, its rate what its observer (`observedHead.observerId`, FC9) saw over
 * the previous 20 minutes. Per §9: no head mark at step 6 (the crown run started between reports);
 * at step 18 the north flank carries two current marks from two sources that disagree (the
 * contradiction, visible on the map). Fix pass 4 (M1, 7 Oct 2026): at step 9 no drone is up, and
 * the helicopter at the head is credited with a rate judged by eye — a band (`rateBand`, "arvio"),
 * where the mark used to be DR1's 40-minute-old reading. `step` is the step shown: the view's
 * first, or a merged view's second from its step boundary on (`StepBoundary.rateMarks`; systems
 * review F6, 7 Oct 2026 — before that the second step's §9 rules never applied).
 */
export function buildRateMarks(view: CycleIndex, step: number, sc: SiteStep, flag: Flag): RateMark[] {
  const start = (step - 1) * STEP_SECONDS;
  if (step === 6) return [];
  const head: RateMark = {
    id: `rate.head.cycle_${step}`,
    cycle: view,
    flank: "head",
    anchor: sc.observedHead.anchor,
    bearingDeg: sc.observedHead.bearingDeg,
    rateMetresPerMinute: sc.observedHead.rateMpm,
    ...(sc.observedHead.rateBand ? { rateBand: sc.observedHead.rateBand } : {}),
    provenance: provenanceAt(sc.observedHead.observerId, observerClass(sc.observedHead.observerId), start - 120, start + 100),
    consistentWithEnvelope: flag === "holds",
  };
  if (step !== 18) return [head];
  const line = sc.units["EK14"] ?? sc.observedHead.anchor;
  // SPOT's mark sits on the spot fire it reports (3 Oct 2026), else 150 m north of EK14's line.
  const north: LatLon = sc.fire.spot_fires[0]?.position ?? { lat: line.lat + 150 / 111_320, lon: line.lon };
  return [
    head,
    { id: "rate.north.cycle_18.ek14", cycle: view, flank: "north", anchor: line, bearingDeg: 0, rateMetresPerMinute: 0.5, provenance: provenanceAt("EK14", "sc.experienced", start + 60, start + 90), consistentWithEnvelope: true },
    { id: "rate.north.cycle_18.spot", cycle: view, flank: "north", anchor: north, bearingDeg: 30, rateMetresPerMinute: 6, provenance: provenanceAt("SPOT", "sc.sensor", start + 45, start + 80), consistentWithEnvelope: true },
  ];
}

/** SPEC/12 revision 24 Sep (c) §7: the scoring label, from the derived flag. Never shown. */
export function accuracyLabel(flag: Flag): Envelope["accuracy_label"] {
  return flag === "holds" ? "correct" : flag === "breach_quantitative" ? "partly" : "incorrect";
}

/** SPEC/12 §9's envelope-certainty column, steps 1–20; a view takes its first step's. */
const ENVELOPE_CERTAINTY: readonly Certainty["kind"][] = [
  "uncertain", "probable", "probable", "confirmed", "confirmed", "probable", "confirmed", "probable", "uncertain", "confirmed",
  "confirmed", "confirmed", "probable", "uncertain", "probable", "confirmed", "probable", "probable", "uncertain", "probable",
];

function envelopeCertaintyFor(step: number): Envelope["certainty"] {
  const kind = ENVELOPE_CERTAINTY[Math.max(step, 1) - 1]!;
  if (kind === "probable") return { kind, basis: "polttoainekartta ja tuuliennuste, ei tuoretta rajausta kaikilta sivuilta" };
  if (kind === "uncertain") return { kind, basis: "havainnot puutteelliset tai vanhentuneet" };
  if (kind === "confirmed") return { kind };
  return { kind: "unknown" };
}

/** Drone sensor footprints: every drone every view, null while it is on the ground (SPEC/12 §6.5). */
export function buildSensorFootprints(index: CycleIndex, sc: SiteStep): SensorFootprint[] {
  return DRONES.map((platformId) => {
    const a = sc.aircraft.find((x) => x.platformId === platformId);
    return { platformId, cycle: index, geometry: a?.footprint ?? null };
  });
}

const aircraftOf = (sc: SiteStep) => sc.aircraft.map((a) => ({ platformId: a.platformId, kind: a.kind, position: a.position, track: a.track }));

/** SPEC/26 §2: a merged view's second-step positions and rate marks, reached inside the view; null for one step. */
function stepBoundaryOf(index: CycleIndex, view: Pick<SessionView, "steps">, flag: Flag): StepBoundary | null {
  if (view.steps.length !== 2) return null;
  const sc = siteStep(view.steps[1]!);
  return {
    atVirtual: asVirtualTime((view.steps[1]! - 1) * STEP_SECONDS),
    clockLabel: sc.clock,
    unitPositions: sc.units,
    unitWork: sc.unitWork,
    aircraft: aircraftOf(sc),
    sensorFootprints: buildSensorFootprints(index, sc),
    rateMarks: buildRateMarks(index, view.steps[1]!, sc, flag),
  };
}

/** The map state of a view: its first step's (SPEC/26 §2). Shared by the main views and the practice view. */
export function viewMap(view: Pick<SessionView, "index" | "steps">, sv: SiteView) {
  const sc = siteStep(view.steps[0]!);
  const start = (view.steps[0]! - 1) * STEP_SECONDS;
  return {
    sc,
    start,
    spec: {
      startsAtVirtual: asVirtualTime(start),
      steps: view.steps.length as 1 | 2,
      clockLabel: sc.clock,
      perimeter: sc.reported,
      detachedFronts: sc.reportedDetached,
      unitPositions: sc.units,
      unitWork: sc.unitWork,
      fire: sc.fire,
      aircraft: aircraftOf(sc),
      wind: { observedAt: asVirtualTime(start), fromDeg: sc.wind.fromDeg, meanMs: sc.wind.meanMs, sourceFi: "Sääasema, johtopaikka" },
      actualPerimeterAtEnd: sv.truthAtEnd,
      actualDetachedAtEnd: sv.truthDetached,
      gaps: [],
      minViewSeconds: viewMinSecondsFor(view.steps.length), // the real value (decision 1 Oct 2026)
      stepBoundary: stepBoundaryOf(view.index as CycleIndex, view, sv.derivedFlag),
    },
    envelope: {
      polygon: sv.envelope,
      detachedParts: sv.envelopeDetached,
      certainty: envelopeCertaintyFor(view.steps[0]!),
      attribution: "Kansallinen palonlevintäpalvelu",
      horizonVirtual: asVirtualTime(start + view.steps.length * STEP_SECONDS),
      horizonLabel: `ennuste voimassa klo ${sv.horizonClock} saakka`,
      isochrones: sv.isochrones,
      bands: sv.projectionBands,
      containmentToleranceMetres: 50,
    },
  };
}

/**
 * The incident's own radio traffic of one step (SPEC/18 revision (l)): moves, crossings, stops,
 * holds. `atOffsetS` is into the VIEW; a routine item of a merged view's first step is recorded
 * (T2), not pushed (SPEC/26 §6).
 */
export function radioAtoms(step: number, viewStart: number): { atoms: InfoAtom[]; pushed: { id: string; t: number }[] } {
  const atoms: InfoAtom[] = [];
  const pushed: { id: string; t: number }[] = [];
  SITE_SCENARIO.radio.filter((r) => r.cycle === step).forEach((r, k) => {
    const id = `atom.radio.${step}.${k}`;
    const air = r.from.startsWith("DR") || r.from === "SPOT" || r.from === "HELI1";
    const inStep = r.atOffsetS - ((step - 1) * STEP_SECONDS - viewStart);
    const at = asVirtualTime((step - 1) * STEP_SECONDS + Math.min(inStep, 1190));
    atoms.push({
      id, tier: r.pushed ? "T1_pushed" : "T2_system", origin: air ? "sensor" : "below", cycle: step as CycleIndex, loadBearing: false,
      navCategory: r.kind === "move" ? "yksikot" : "palo",
      routes: r.pushed
        ? { directed: { kind: "pushed" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "pushed" } }
        : { directed: { kind: "browse", surface: "situation_log" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "free_text", exampleQueries: [r.from.toLowerCase()] } },
      record: { kind: "situation_log", entryId: `log.${id}`, authorUnitId: r.from, text: r.text },
      provenance: { sourceId: r.from, sourceClassId: air ? "sc.sensor" : "sc.experienced", sourceReliability: "known-good", observedAt: at, recordedAt: at, deliveredAt: r.pushed ? at : null, certainty: { kind: "confirmed" }, supports: [], contradicts: [] },
      degradation: [], retrievalKeys: [r.from.toLowerCase(), r.kind], truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
    });
    if (r.pushed) pushed.push({ id, t: r.atOffsetS });
  });
  return { atoms, pushed };
}
