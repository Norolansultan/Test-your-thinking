/**
 * What the scenario's own observers say about the fire, read from its records: flame-height bands, intensity classes,
 * spread rates and smouldering, each with the record id, its position where the record has one, and the WINDOW it
 * describes. The scenario has no flame-length, intensity or fire-type FIELD: the CA (SPEC/24, an Alexandridis-type
 * cellular automaton) models spread only, and the traffic generator writes what a crew or a camera would see from the
 * local rate and ground (`tools/fire-ca/traffic-text.ts` `intensityClass`: 1 smouldering/creeping … 4 intense surface
 * fire with torching, 5 crown fire; flame bands "alle 0,3 m", "0,3–1 m", "1–2 m", "2–4 m", "puiden latvojen yli"). So,
 * unless the scenario's flame table is present (`scenario-extras.ts`), every flame value the export gives is a band
 * QUOTED from a record; nothing here is computed from fire physics.
 *
 * Sources: the traffic corpus (`site-scenario.json` `traffic`, positioned), the incident radio (`radio`, positioned when
 * it has `at`), the story bubbles (`demo-story.ts`, no position) and the scenario's other corpus atoms (designed events
 * such as VPK's "voivat vielä kyteä" warning, the lateral items; placed where their source unit stands, as the corpus
 * export places them). The perimeter-mapping loop (`kehäkartoitus`: the whole perimeter, sector maxima), the weather
 * station and the forecasts carry no local fire observation and are skipped.
 *
 * Windows (SPEC/31 §5 D2): a measurement or thermal image names the interval it measured ("(klo 14.20–14.40)") and
 * describes that 20-minute step, which is the step BEFORE the one it is logged in; every other record describes the
 * moment it is made, inside its own step. `observationsOfWindow(n)` collects what describes step n's 20 minutes, the
 * window `ros_head_m_min` is measured over.
 */

import type { CycleIndex } from "../../app/engine/primitives.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { radioAtoms } from "../../app/scenario/demo-map.js";
import { DESIGNED_LOG } from "../../app/scenario/designed-events.js";
import { stepStartVirtual, viewOfStep, viewStartVirtual } from "../../app/scenario/views.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { recordEn } from "../../app/i18n/text.js";
import { atomFi } from "./facts.js";
import { bearing, dist, signedAngle, stepOfClock, toEN, type EN } from "./geo.js";

export interface FlameBand {
  /** Metres; both null for "flames above the treetops" (no number given). */
  readonly lo: number | null;
  readonly hi: number | null;
  readonly crown: boolean;
  /** The quoted Finnish phrase. */
  readonly phrase: string;
}

export interface Observation {
  readonly id: string;
  /** The step the record is logged in. */
  readonly step: number;
  /** The step whose 20 minutes it describes: the interval it names, else its own step. */
  readonly window: number;
  readonly source: string;
  readonly text_fi: string;
  readonly text_en: string | null;
  readonly xy: EN | null;
  readonly band: FlameBand | null;
  /** "Intensiteettiluokka k/5", when the record states it. */
  readonly intensityClass: number | null;
  /** A spread rate quoted in m/min, when the record states one. */
  readonly rateMpm: number | null;
  /** Smouldering said in so many words (`stated`) or as a possibility ("voivat vielä kyteä": `suspected`). */
  readonly smoulder: "stated" | "suspected" | null;
}

const num = (s: string): number => Number(s.replace(",", "."));

export function parseFlame(text: string): FlameBand | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/liekit puiden latvojen yli/))) return { lo: null, hi: null, crown: true, phrase: m[0] };
  if ((m = text.match(/liekit (\d+(?:,\d+)?)–(\d+(?:,\d+)?) m\b/))) return { lo: num(m[1]!), hi: num(m[2]!), crown: false, phrase: m[0] };
  if ((m = text.match(/liekit alle (\d+(?:,\d+)?) m\b/))) return { lo: 0, hi: num(m[1]!), crown: false, phrase: m[0] };
  if ((m = text.match(/liekit alle metrin/))) return { lo: 0, hi: 1, crown: false, phrase: m[0] };
  if ((m = text.match(/\bei liekkejä/))) return { lo: 0, hi: 0, crown: false, phrase: m[0] };
  return null;
}

export function parseRate(text: string): number | null {
  const m = text.match(/(\d+(?:,\d+)?) m\/min/);
  return m ? num(m[1]!) : null;
}

export function parseClass(text: string): number | null {
  const m = text.match(/Intensiteettiluokka (\d)\/5/);
  return m ? Number(m[1]) : null;
}

/** The step a record describes: the interval it names ("klo 14.20–14.40" → the step starting 14.20), else its own step. */
export function windowOf(text: string, ownStep: number): number {
  const m = text.match(/klo (\d{1,2})\.(\d{2})–(\d{1,2})\.(\d{2})/);
  return m ? stepOfClock(Number(m[1]), Number(m[2])) : ownStep;
}

/** Smouldering as a possibility: "voivat (vielä) kyteä", "voi kyteä". */
const SUSPECTED = /\bvoi(?:vat)? (?:vielä )?kyteä/;
/** Smouldering said in so many words: stumps and litter smoking, residual heat, burning deep in the humus, smouldering. */
const SMOULDER = /savuaa|jälkilämpöä|kunttakerroksessa|kytee|kyteä|kytevät|kytöpesäke/;
const SKIP = /kehäkartoitus|^Sääasema|^Ennuste/;
/** Smoke where someone is (read by the CO-zone proxy, `smoke-zone.ts`). */
const SMOKE = /savu/i;

function smoulderOf(fi: string): Observation["smoulder"] {
  if (SUSPECTED.test(fi)) return "suspected";
  return SMOULDER.test(fi) ? "stated" : null;
}

function observation(id: string, step: number, source: string, fi: string, xy: EN | null): Observation {
  return {
    id, step, window: windowOf(fi, step), source, text_fi: fi, text_en: recordEn(id) ?? null, xy,
    band: parseFlame(fi), intensityClass: parseClass(fi), rateMpm: parseRate(fi), smoulder: smoulderOf(fi),
  };
}

const COVERED = /^(?:evt\.|atom\.radio\.\d|atom\.demo\.\d)/;

/** Where a corpus atom's source stands: the unit or aircraft at the designed event's position step, else at the atom's own step. */
function atomPosition(a: InfoAtom): EN | null {
  const stepIndex = DESIGNED_LOG[a.id]?.positionStep ?? a.cycle;
  const s = SITE_SCENARIO.steps.find((x) => x.index === stepIndex);
  const actor = a.provenance.sourceId;
  const at = s?.units[actor] ?? s?.aircraft.find((x) => x.platformId === actor)?.position ?? null;
  return at ? toEN(at) : null;
}

/** A record logged in a step: who made it, when, and where it comes from (read by the observations and by `laces.ts`). */
export interface StepRecord {
  readonly id: string;
  /** The step it is logged in. */
  readonly step: number;
  /** When it was said or logged, on the scenario's clock (virtual seconds, 0 = 13:20, step 1's start). */
  readonly t: number;
  /** Who made it: the traffic's `actor`, the radio's `from`, the story beat's author, the corpus atom's source. */
  readonly source: string;
  /** Traffic: its channel (`radio_command`, `radio_lateral`, `ask_unit`, `system_log`, `sensor_feed`); `incident_radio`; `story`; a corpus atom: its record kind. */
  readonly channel: string;
  readonly text_fi: string;
  readonly xy: EN | null;
  /** The perimeter-mapping loop, the weather station or a forecast (traffic and corpus atoms): no local fire observation. */
  readonly skip: boolean;
}

/**
 * Every record LOGGED in `step`, in this order: the traffic corpus, the incident radio (`atom.radio.<step>.<k>`, timed as
 * the scenario times it, `demo-map.ts` `radioAtoms`), the story beats (`atom.demo.<step>.<k>`, `demo-story.ts`
 * `storyAtoms`), then the corpus atoms outside those three (designed events, lateral items). Register entries
 * (`reference`) are skipped.
 */
export function recordsOfStep(step: number, atoms: readonly InfoAtom[] = []): StepRecord[] {
  const out: StepRecord[] = [];
  const inTraffic = new Set<string>();
  for (const t of SITE_SCENARIO.traffic) {
    inTraffic.add(t.id);
    if (t.cycle !== step) continue;
    const xy = t.lat !== null && t.lon !== null ? toEN({ lat: t.lat, lon: t.lon }) : null;
    out.push({ id: t.id, step, t: t.sim_time_s, source: t.actor, channel: t.channel, text_fi: t.content, xy, skip: SKIP.test(t.content) });
  }
  const view = viewOfStep(step);
  const radioAt = radioAtoms(step, view ? viewStartVirtual(view) : stepStartVirtual(step)).atoms.map((a) => Number(a.provenance.observedAt));
  SITE_SCENARIO.radio.filter((r) => r.cycle === step).forEach((r, k) => {
    out.push({ id: `atom.radio.${step}.${k}`, step, t: radioAt[k]!, source: r.from, channel: "incident_radio", text_fi: r.text, xy: r.at ? toEN(r.at) : null, skip: false });
  });
  (CYCLE_STORY[step as CycleIndex]?.bubbles ?? []).forEach((b, k) => {
    out.push({ id: `atom.demo.${step}.${k}`, step, t: stepStartVirtual(step) + (b.atS ?? 60 * (k + 1)), source: b.authorUnitId, channel: "story", text_fi: b.text, xy: null, skip: false });
  });
  for (const a of atoms) {
    if (a.cycle !== step || inTraffic.has(a.id) || COVERED.test(a.id) || a.record.kind === "reference") continue;
    const fi = atomFi(a);
    out.push({ id: a.id, step, t: Number(a.provenance.observedAt), source: a.provenance.sourceId, channel: a.record.kind, text_fi: fi, xy: atomPosition(a), skip: SKIP.test(fi) });
  }
  return out;
}

/**
 * Every record LOGGED in `step` that states something about the fire (a flame band, a class, a rate, smouldering or smoke).
 * `atoms`: the scenario's corpus atoms; those outside the traffic, the radio and the story (designed events, lateral
 * items) are read too. Register entries (`reference`) are skipped.
 */
export function observationsOfStep(step: number, atoms: readonly InfoAtom[] = []): Observation[] {
  return recordsOfStep(step, atoms).filter((r) => !r.skip).map((r) => observation(r.id, step, r.source, r.text_fi, r.xy))
    .filter((o) => o.band !== null || o.intensityClass !== null || o.rateMpm !== null || o.smoulder !== null || SMOKE.test(o.text_fi));
}

/** Everything that describes step `n`'s 20 minutes: records logged in it that name no other interval, and the measurements of it logged later. */
export function observationsOfWindow(n: number, atoms: readonly InfoAtom[] = []): Observation[] {
  return [n, n + 1, n + 2].flatMap((k) => observationsOfStep(k, atoms)).filter((o) => o.window === n);
}

// ---------------------------------------------------------------------------------------------------
// Segments: head, left and right flank, rear — left/right seen from the origin toward the head (KAL convention)
// ---------------------------------------------------------------------------------------------------

export type SegmentId = "head" | "left_flank" | "right_flank" | "rear";
export const SEGMENT_IDS: readonly SegmentId[] = ["head", "left_flank", "right_flank", "rear"];

/** Within this distance of the observed head a point is the head, whatever its bearing. */
export const HEAD_RADIUS_M = 300;

/**
 * The segment a point lies on, on the axis from a front's origin in the head's direction of travel: the head within
 * 300 m of the head or ahead of it (±45° of its bearing, seen from the head); the rear behind the origin (±45° of the back
 * bearing, seen from the origin); otherwise a flank, right or left of the axis (seen from the origin toward the head). A
 * geometric convention of this export: the scenario names sectors L1–L4, not segments. `window.ts` applies it to the
 * active front (its origin, its head over the window) and leaves points off that front without a segment.
 */
export function segmentOf(p: EN, origin: EN, head: EN, headBearingDeg: number): SegmentId {
  if (dist(p, head) <= HEAD_RADIUS_M) return "head";
  if (Math.abs(signedAngle(headBearingDeg, bearing(head, p))) <= 45) return "head";
  const rad = (headBearingDeg * Math.PI) / 180;
  const dx = p[0] - origin[0], dy = p[1] - origin[1];
  const along = dx * Math.sin(rad) + dy * Math.cos(rad);
  if (along < 0 && Math.abs(signedAngle((headBearingDeg + 180) % 360, bearing(origin, p))) <= 45) return "rear";
  const across = dx * Math.cos(rad) - dy * Math.sin(rad); // positive: clockwise of the axis, the right side
  return across >= 0 ? "right_flank" : "left_flank";
}

/** The class a band implies, when no class is stated (the generator's own table, `traffic-text.ts`). */
export function classOfBand(b: FlameBand): number {
  if (b.crown) return 5;
  if (b.hi === null) return 4;
  if (b.hi <= 0) return 0;
  if (b.hi <= 0.3) return 1;
  if (b.hi <= 1) return 2;
  if (b.hi <= 2) return 3;
  return 4;
}

/**
 * The skills' fire type from the intensity class: 5 (crown fire, "flames above the treetops") → active_crown; 1–4
 * surface (4 is the generator's "intense surface fire with torching": kept surface, as SPEC/18 §7 says of step 7, "crown
 * run drops in BIRCH; surface fire continues" — a reviewer may read it passive_crown); 0 (no flames) → surface.
 */
export function fireTypeOfClass(cls: number): "surface" | "active_crown" {
  return cls >= 5 ? "active_crown" : "surface";
}

export interface HeadFire {
  readonly band: FlameBand | null;
  readonly cls: number | null;
  readonly sourceIds: readonly string[];
  readonly basis: string;
}

/**
 * The head's flames over a window: the band in the window's head observer's measurement (`mittaus`) of it, else its
 * thermal image of it (the observer is the one the scenario names as measuring the head over that window: the next
 * step's `observedHead.observerId`); else another observer's measurement of the window whose rate is the head's observed
 * rate (the same head, measured by another drone); failing that, the highest band among the window's positioned
 * observations on the head segment; else none. `obs` are the window's observations; `segments` maps their ids to segments.
 */
export function headFire(obs: readonly Observation[], observerId: string, segments: ReadonlyMap<string, SegmentId | null>, observedRateMpm: number | null = null): HeadFire {
  const rank = (o: Observation) => (/ mittaus:/.test(o.text_fi) ? 0 : /lämpökuva/.test(o.text_fi) ? 1 : 2);
  const own = obs.filter((o) => o.source === observerId && (o.band !== null || o.intensityClass !== null) && rank(o) < 2);
  const pick = [...own].sort((a, b) => rank(a) - rank(b))[0];
  if (pick) return { band: pick.band, cls: pick.intensityClass ?? (pick.band ? classOfBand(pick.band) : null), sourceIds: [pick.id], basis: `the head observer ${observerId}` };
  // Another drone's measurement of the same head: its measured rate is the head's observed rate over the window.
  const same = observedRateMpm === null ? undefined : obs.find((o) => rank(o) === 0 && o.band !== null && o.rateMpm !== null && Math.abs(o.rateMpm - observedRateMpm) < 0.05);
  if (same) return { band: same.band, cls: same.intensityClass ?? classOfBand(same.band!), sourceIds: [same.id], basis: `${same.source}'s measurement of the head (its rate is the head's observed ${observedRateMpm} m/min)` };
  const onHead = obs.filter((o) => o.band !== null && segments.get(o.id) === "head");
  const top = maxBand(onHead);
  if (top) return { band: top.band, cls: top.intensityClass ?? classOfBand(top.band!), sourceIds: [top.id], basis: "the highest band reported on the head segment" };
  return { band: null, cls: null, sourceIds: [], basis: `no record of the window from the head observer ${observerId} or on the head segment` };
}

/** The observation with the highest band (a crown band counts highest); null when none has a band. */
export function maxBand(obs: readonly Observation[]): Observation | null {
  let best: Observation | null = null;
  const score = (b: FlameBand) => (b.crown ? 99 : b.hi ?? 0);
  for (const o of obs) if (o.band && (best === null || score(o.band) > score(best.band!))) best = o;
  return best;
}
