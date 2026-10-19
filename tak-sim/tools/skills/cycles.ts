/**
 * `ground_truth/cycles.json`: the fire, the weather and the units per step, in the fields `fire_check.py`
 * (wildfire-fire-behaviour-check) and `tactical_check.py` (wildfire-tactical-check) read. One record per main step 1–20
 * and one for the practice view (cycle 0, step W2). Every fire field describes the step's own 20 minutes, the window
 * `ros_head_m_min` is measured over (SPEC/31 §5 D2; `window.ts`):
 * - spread: `ros_head_m_min` is the CA's achieved head rate over the step (`headRos.achievedMpm`, the truth the
 *   perimeters show); the authored forcing rate (SPEC/18 §7, `scenario-18.ts`), the projection's assumed rate and the
 *   observed head at the step's start (measured over the PREVIOUS 20 min) are given beside it;
 * - direction: `head_bearing_deg` is the head's direction over the window (the next step's observed head); null when
 *   the head did not advance or no later observation exists;
 * - flames and fire type: the flame table's value when the scenario has one (`scenario-extras.ts`), else QUOTED from the
 *   records that describe the window (`fire-observations.ts`); a single value is the band's upper bound;
 * - wind: the step's forcing (`site-scenario.json` `steps[].wind`); RH, T and dew point: the weather station's reading in
 *   the step, if it gave one, else null;
 * - events: the CA's scripted events (`SCENARIO_18_FORCING`; a spot fire already on the next step's report is dated to
 *   the step that threw it), the incident radio's crossings and stops (dated by the interval they name), and a crown
 *   fire where the head's flames are "above the treetops";
 * - units and placements: `units.ts`.
 */

import type { SiteStep } from "../../app/scenario/site-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import type { CycleEvent, CycleForcing } from "../fire-ca/run.js";
import { barriersAhead, type BarrierAhead } from "./spatial.js";
import { fireTypeOfClass, headFire, maxBand, observationsOfWindow, SEGMENT_IDS, type FlameBand, type Observation, type SegmentId } from "./fire-observations.js";
import { clockOf, cycleOfStep, stepOfClock, toEN } from "./geo.js";
import { stationReading, stationRecords, type FlameEntry, type FlameTable, type StationRecord } from "./scenario-extras.js";
import { unitsAndPlacements } from "./units.js";
import { burningEdges, distToPart, frontGeometry, placeOnFront, stepByIndex, type FrontGeometry } from "./window.js";

/** What the cycles are built from besides the site bundle and the forcing (defaults: the scenario's own). */
export interface CycleSources {
  /** The scenario's corpus atoms: designed events and lateral items are read as observations too. */
  readonly atoms: readonly InfoAtom[];
  /** The weather station's records (`scenario-extras.ts` `stationRecords`). */
  readonly station: readonly StationRecord[];
  /** The flame table (D1) when the scenario has one; null: bands quoted from the records. */
  readonly flameTable: FlameTable | null;
}

export const defaultCycleSources = (atoms: readonly InfoAtom[] = []): CycleSources => ({ atoms, station: stationRecords(), flameTable: null });

// ---------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------

export interface FireEvent { readonly kind: string; readonly note: string; readonly source: string; readonly distance_m: number | null }

const PRIORITY = ["reignition", "crown", "spotting", "stop_at_barrier", "barrier_crossed", "deep_burning", "regime_change", "suppression", "control"];

/** The step a radio report is about: the interval it names ("klo 18.40–19.00"), else its own step. */
function stepNamed(text: string, own: number): number {
  const m = text.match(/klo (\d{1,2})\.(\d{2})–/);
  return m ? stepOfClock(Number(m[1]), Number(m[2])) : own;
}

/** A forcing event's ignition: a spot fire (timing `before_report`: already on the step's report, so thrown in the step before). */
function spotOf(e: CycleEvent, src: string): FireEvent | null {
  if (e.kind !== "ignite" || e.rekindle) return null;
  return { kind: "spotting", note: e.note, source: src, distance_m: e.anchor === "head" ? e.distanceM : null };
}

function eventsOf(step: number, forcing: readonly CycleForcing[], crown: boolean): FireEvent[] {
  const out: FireEvent[] = [];
  const f = forcing.find((x) => x.id === String(step));
  const src = `scenario-18.ts forcing, step ${step}`;
  for (const e of f?.events ?? []) {
    if (e.kind === "control_sector") out.push({ kind: "control", note: e.note, source: src, distance_m: null });
    else if (e.kind === "ignite" && e.rekindle) out.push({ kind: "reignition", note: e.note, source: src, distance_m: null });
    else if (e.kind === "ignite") { if (e.timing !== "before_report") out.push(spotOf(e, src)!); }
    else out.push({ kind: "suppression", note: e.note, source: src, distance_m: null });
  }
  // Spot fires the next step's report already shows were thrown during this step (SPEC/31 D2: dated to the source step).
  const next = forcing.find((x) => x.id === String(step + 1));
  for (const e of next?.events ?? []) {
    if (e.kind !== "ignite" || e.timing !== "before_report") continue;
    const spot = spotOf(e, `scenario-18.ts forcing, step ${step + 1} (on its report; thrown in step ${step})`);
    if (spot) out.push(spot);
  }
  SITE_SCENARIO.radio.forEach((r) => {
    if ((r.kind !== "crossing" && r.kind !== "stopped") || stepNamed(r.text, r.cycle) !== step) return;
    const k = SITE_SCENARIO.radio.filter((x) => x.cycle === r.cycle).indexOf(r);
    out.push({ kind: r.kind === "stopped" ? "stop_at_barrier" : "barrier_crossed", note: r.text, source: `atom.radio.${r.cycle}.${k}`, distance_m: null });
  });
  if (crown) out.push({ kind: "crown", note: "the head's flames are reported above the treetops (intensity class 5/5)", source: "head observation", distance_m: null });
  // The forcing's categorical basis (SPEC/24 §6): `depth` = burning below the surface; `mechanism` = a regime change the projection lacks.
  if (f?.categoricalBasis === "depth") out.push({ kind: "deep_burning", note: "burning deep in the humus layer and stump roots (categorical basis: depth)", source: src, distance_m: null });
  if (f?.categoricalBasis === "mechanism") out.push({ kind: "regime_change", note: "a regime change the projection's model lacks (categorical basis: mechanism)", source: src, distance_m: null });
  return out;
}

/**
 * A rekindle front starts on the old fire's edge (revision (aj)): the main fire's burned area adjoins its rear, the
 * anchor the reference allocation looks for (`adjacent_segment: "rear"`).
 */
function blackBehind(g: FrontGeometry): object[] {
  const main = g.parts.find((p) => p.id === "main");
  if (g.active.id === "main" || !main || !g.active.rings.some((r) => r.some((v) => distToPart(v, main) <= BLACK_CONTACT_M))) return [];
  return [{ id: "burned.main", type: "burned area", name: "the old fire's burned area (the black)", adjacent_segment: "rear", note: `${g.active.id} starts on its edge` }];
}
const BLACK_CONTACT_M = 30;

// ---------------------------------------------------------------------------------------------------
// The cycle record
// ---------------------------------------------------------------------------------------------------

/** A band as [lo, hi] metres; null for none and for "above the treetops" (no number). */
const bandOf = (b: FlameBand | null): [number | null, number | null] | null => (b && !b.crown ? [b.lo, b.hi] : null);
const tableBand = (e: FlameEntry | null): [number, number] | null => (e ? [e.loM, e.hiM] : null);

function segmentRecord(id: SegmentId, obs: readonly Observation[], seg: ReadonlyMap<string, SegmentId | null>, table: FlameEntry | null) {
  const mine = obs.filter((o) => seg.get(o.id) === id);
  const top = maxBand(mine);
  const rates = mine.map((o) => o.rateMpm).filter((r): r is number => r !== null);
  const ros = rates.length ? Math.max(...rates) : null;
  const rosSource = ros === null ? undefined : mine.find((o) => o.rateMpm === ros);
  const sources = [...(top ? [top.id] : []), ...(rosSource && rosSource !== top ? [rosSource.id] : [])];
  return {
    id, type: id === "head" ? "head" : id === "rear" ? "rear" : "flank",
    flame_length_m: table ? table.hiM : top?.band?.hi ?? null, flame_band_m: table ? tableBand(table) : bandOf(top?.band ?? null),
    flame_source: table ? "flame table" : top ? "records (quoted)" : null,
    ros_m_min: ros, sources,
  };
}

export function cycleRecord(s: SiteStep, forcing: readonly CycleForcing[], src: CycleSources = defaultCycleSources()): object {
  const startS = (s.index - 1) * 1200;
  const geo: FrontGeometry = frontGeometry(s);
  const wh = geo.head;
  const obs = observationsOfWindow(s.index, src.atoms);
  // A drone's road observation is placed where the drone is, not on the road it describes: on no segment (the zone proxy reads its road).
  const seg = new Map<string, SegmentId | null>(obs.filter((o) => o.xy !== null && !/tiehavainto/.test(o.text_fi)).map((o) => [o.id, placeOnFront(o.xy!, geo).segment]));
  const held = s.headRos.achievedMpm === 0;
  const hf = headFire(obs, wh.observerId, seg, wh.observedRateMpm);
  const tHead = src.flameTable?.at(s.index, "head") ?? null;
  const tFlank = src.flameTable?.at(s.index, "flank") ?? null;
  const tRear = src.flameTable?.at(s.index, "rear") ?? null;
  const fireType = held ? null : tHead?.fireType ?? (hf.cls === null ? null : fireTypeOfClass(hf.cls));
  const fireTypeBasis = held ? "held: the CA's head did not advance over the step (ros_head_m_min 0)"
    : tHead?.fireType ? `the flame table (${src.flameTable!.source})`
    : hf.cls === null ? hf.basis : `intensity class ${hf.cls}/5 from ${hf.basis} (${hf.sourceIds.join(", ")})`;
  const flanks = obs.filter((o) => seg.get(o.id) === "left_flank" || seg.get(o.id) === "right_flank");
  const flankTop = maxBand(flanks);
  const events = eventsOf(s.index, forcing, fireType === "active_crown");
  const primary = PRIORITY.find((k) => events.some((e) => e.kind === k)) ?? null;
  const spotting = events.filter((e) => e.kind === "spotting" && e.distance_m !== null).map((e) => e.distance_m!);
  const forcingNotes = (forcing.find((x) => x.id === String(s.index))?.events ?? []).map((e) => e.note);
  const wx = stationReading(s.index, src.station);
  const segments = SEGMENT_IDS.map((id) => segmentRecord(id, obs, seg, id === "head" ? tHead : id === "rear" ? tRear : tFlank)).map((r) => r.id !== "head" ? r : {
    ...r, flame_length_m: tHead ? tHead.hiM : hf.band?.hi ?? null, flame_band_m: tHead ? tableBand(tHead) : bandOf(hf.band),
    flame_source: tHead ? "flame table" : hf.band ? "records (quoted)" : null,
    ros_m_min: s.headRos.achievedMpm, fire_type: fireType, sources: hf.sourceIds,
  });
  const smoulder = obs.filter((o) => o.smoulder !== null)
    .map((o) => `${o.source} ${o.id}${o.smoulder === "suspected" ? " (suspected)" : ""}: ${o.text_en ?? o.text_fi}${o.xy ? ` @ E ${o.xy[0]} N ${o.xy[1]}` : ""}`);
  const flareUps = s.fire.spot_fires.filter((x) => x.callsign.startsWith("US")).map((x) => { const p = toEN(x.position); return `flare-up ${x.callsign} (${x.confirmed ? "confirmed" : "reported, unconfirmed"}) @ E ${p[0]} N ${p[1]}`; });
  const { units, placements } = unitsAndPlacements({ step: s, geometry: geo, edges: burningEdges(s), windFromDeg: s.wind.fromDeg, obs });
  const barriers: (BarrierAhead | object)[] = [...blackBehind(geo), ...barriersAhead(wh.startXy, wh.axisDeg)];
  const next = stepByIndex(s.index + 1);
  return {
    cycle: cycleOfStep(s.index), step: s.index, view: viewOfStep(s.index)?.id ?? null, time: s.clock, time_end: clockOf(startS + 1200),
    fire_type: fireType, fire_type_basis: fireTypeBasis,
    ros_head_m_min: s.headRos.achievedMpm, ros_head_authored_m_min: s.headRos.actualMpm, ros_head_projected_m_min: s.headRos.envelopeMpm,
    observed_head: { at: "step start", rate_m_min: s.observedHead.rateMpm, rate_band_m_min: s.observedHead.rateBand ?? null, bearing_deg: s.observedHead.bearingDeg, observer: s.observedHead.observerId, xy: toEN(s.observedHead.anchor) },
    window_head: {
      at: "step end", basis: wh.basis, rate_m_min: wh.observedRateMpm, bearing_deg: wh.bearingDeg, observer: wh.observerId,
      xy: next && wh.bearingDeg !== null ? wh.endXy.map((v) => Math.round(v * 10) / 10) : null,
    },
    active_front: { id: geo.active.id, origin_xy: geo.active.origin.map((v) => Math.round(v * 10) / 10), report_step: geo.reportStep },
    fl_source: src.flameTable && tHead ? `flame table (${src.flameTable.source})` : "records (quoted)",
    fl_head_m: tHead ? tHead.hiM : hf.band?.hi ?? null, fl_head_band_m: tHead ? tableBand(tHead) : bandOf(hf.band),
    fl_head_phrase: hf.band?.phrase ?? null, fl_head_sources: hf.sourceIds,
    fl_flank_m: tFlank ? tFlank.hiM : flankTop?.band?.hi ?? null, fl_flank_band_m: tFlank ? tableBand(tFlank) : bandOf(flankTop?.band ?? null),
    fl_flank_sources: flankTop ? [flankTop.id] : [],
    isi: null,
    wind: { from_deg: s.wind.fromDeg, speed_ms: s.wind.meanMs, gust_ms: s.wind.gustMs },
    head_bearing_deg: wh.bearingDeg,
    rh_pct: wx.rhPct, temp_c: wx.tempC, dew_point_c: wx.dewPointC, rh_source: wx.sourceId,
    event: primary, events,
    spotting_m: spotting.length ? Math.max(...spotting) : null,
    reignition_source: events.find((e) => e.kind === "reignition")?.note ?? null,
    change_reason: forcingNotes.length ? forcingNotes.join("; ") : null,
    segments, barriers, smouldering_spots: [...smoulder, ...flareUps],
    units, placements,
    is_night: false, // SPEC/18 §2: a day in late July; the steps run 12:00–20:00
  };
}

export function buildCycles(forcing: readonly CycleForcing[], src: CycleSources = defaultCycleSources()): object[] {
  return SITE_SCENARIO.steps.map((s) => cycleRecord(s, forcing, src));
}
