/**
 * What the scenario's own observers say about the fire during one step, read from its records: flame-height bands,
 * intensity classes, spread rates and smouldering, each with the record id and, where the record has one, its position.
 * The scenario has no flame-length, intensity or fire-type FIELD: the CA (SPEC/24, an Alexandridis-type cellular
 * automaton) models spread only, and the traffic generator writes what a crew or a camera would see from the local rate
 * and ground (`tools/fire-ca/traffic-text.ts` `intensityClass`: 1 smouldering/creeping … 4 intense surface fire with
 * torching, 5 crown fire; flame bands "alle 0,3 m", "0,3–1 m", "1–2 m", "2–4 m", "puiden latvojen yli"). So every flame
 * value the export gives is a band QUOTED from a record; nothing here is computed from fire physics.
 *
 * Sources per step: the traffic corpus (`site-scenario.json` `traffic`, positioned), the incident radio (`radio`,
 * positioned when it has `at`) and the story bubbles (`demo-story.ts`, no position). The perimeter-mapping loop
 * (`kehäkartoitus`: the whole perimeter, sector maxima), the weather station and the forecasts carry no local fire
 * observation and are skipped.
 */

import type { CycleIndex } from "../../app/engine/primitives.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { recordEn } from "../../app/i18n/text.js";
import { bearing, dist, signedAngle, toEN, type EN } from "./geo.js";

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
  readonly step: number;
  readonly source: string;
  readonly text_fi: string;
  readonly text_en: string | null;
  readonly xy: EN | null;
  readonly band: FlameBand | null;
  /** "Intensiteettiluokka k/5", when the record states it. */
  readonly intensityClass: number | null;
  /** A spread rate quoted in m/min, when the record states one. */
  readonly rateMpm: number | null;
  readonly smoulder: boolean;
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

/** Smouldering said in so many words: stumps and litter smoking, residual heat, burning deep in the humus, smouldering. */
const SMOULDER = /savuaa|jälkilämpöä|kunttakerroksessa|kytee|kyteä|kytevät/;
const SKIP = /kehäkartoitus|^Sääasema|^Ennuste/;

function observation(id: string, step: number, source: string, fi: string, xy: EN | null): Observation {
  return {
    id, step, source, text_fi: fi, text_en: recordEn(id) ?? null, xy,
    band: parseFlame(fi), intensityClass: parseClass(fi), rateMpm: parseRate(fi), smoulder: SMOULDER.test(fi),
  };
}

/** Every record of `step` that states something about the fire there (a flame band, a class, a rate, or smouldering). */
export function observationsOfStep(step: number): Observation[] {
  const out: Observation[] = [];
  for (const t of SITE_SCENARIO.traffic) {
    if (t.cycle !== step || SKIP.test(t.content)) continue;
    out.push(observation(t.id, step, t.actor, t.content, t.lat !== null && t.lon !== null ? toEN({ lat: t.lat, lon: t.lon }) : null));
  }
  SITE_SCENARIO.radio.filter((r) => r.cycle === step).forEach((r, k) => {
    out.push(observation(`atom.radio.${step}.${k}`, step, r.from, r.text, r.at ? toEN(r.at) : null));
  });
  (CYCLE_STORY[step as CycleIndex]?.bubbles ?? []).forEach((b, k) => {
    out.push(observation(`atom.demo.${step}.${k}`, step, b.authorUnitId, b.text, null));
  });
  return out.filter((o) => o.band !== null || o.intensityClass !== null || o.rateMpm !== null || o.smoulder);
}

// ---------------------------------------------------------------------------------------------------
// Segments: head, left and right flank, rear — left/right seen from the origin toward the head (KAL convention)
// ---------------------------------------------------------------------------------------------------

export type SegmentId = "head" | "left_flank" | "right_flank" | "rear";
export const SEGMENT_IDS: readonly SegmentId[] = ["head", "left_flank", "right_flank", "rear"];

/** Within this distance of the observed head a point is the head, whatever its bearing. */
export const HEAD_RADIUS_M = 300;

/**
 * The segment a point lies on, on the axis from the ignition point (origin) in the head's direction of travel: the head
 * within 300 m of the observed head or ahead of it (±45° of its bearing, seen from the head); the rear behind the origin
 * (±45° of the back bearing, seen from the origin); otherwise a flank, right or left of the axis (seen from the origin
 * toward the head). A geometric convention of this export: the scenario names sectors L1–L4, not segments.
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
 * The head's flames this step: the band in the records of the step's head observer (`observedHead.observerId`: the drone,
 * aircraft or crew the scenario names as measuring the head), its measurement (`mittaus`) first, then its thermal image,
 * then anything else it said; failing that, the highest band among the step's positioned observations on the head
 * segment; else none.
 */
export function headFire(obs: readonly Observation[], observerId: string, segments: ReadonlyMap<string, SegmentId>): HeadFire {
  const own = obs.filter((o) => o.source === observerId && (o.band !== null || o.intensityClass !== null));
  const rank = (o: Observation) => (/ mittaus:/.test(o.text_fi) ? 0 : /lämpökuva/.test(o.text_fi) ? 1 : 2);
  const pick = [...own].sort((a, b) => rank(a) - rank(b))[0];
  if (pick) return { band: pick.band, cls: pick.intensityClass ?? (pick.band ? classOfBand(pick.band) : null), sourceIds: [pick.id], basis: `the head observer ${observerId}` };
  const onHead = obs.filter((o) => o.band !== null && segments.get(o.id) === "head");
  const top = maxBand(onHead);
  if (top) return { band: top.band, cls: top.intensityClass ?? classOfBand(top.band!), sourceIds: [top.id], basis: "the highest band reported on the head segment" };
  return { band: null, cls: null, sourceIds: [], basis: `no flame band from the head observer ${observerId} or on the head segment` };
}

/** The observation with the highest band (a crown band counts highest); null when none has a band. */
export function maxBand(obs: readonly Observation[]): Observation | null {
  let best: Observation | null = null;
  const score = (b: FlameBand) => (b.crown ? 99 : b.hi ?? 0);
  for (const o of obs) if (o.band && (best === null || score(o.band) > score(best.band!))) best = o;
  return best;
}
