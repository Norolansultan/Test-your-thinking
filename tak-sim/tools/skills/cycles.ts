/**
 * `ground_truth/cycles.json`: the fire, the weather and the units per step, in the fields `fire_check.py`
 * (wildfire-fire-behaviour-check) and `tactical_check.py` (wildfire-tactical-check) read. One record per main step 1–20
 * and one for the practice view (cycle 0, step W2). Sources, field by field:
 * - spread: `ros_head_m_min` is the CA's achieved head rate over the step (`headRos.achievedMpm`, the truth the
 *   perimeters show); the authored forcing rate (SPEC/18 §7, `scenario-18.ts`), the projection's assumed rate and the
 *   observed head (at the step's start, measured over the previous 20 min) are given beside it;
 * - direction: `head_bearing_deg` is the observed head's direction of travel at the step's start (`observedHead`);
 * - flames and fire type: QUOTED from the step's records (`fire-observations.ts`); a single value is the band's upper
 *   bound (the conservative reading for the intensity limits), the band itself is kept;
 * - wind: the step's forcing (`site-scenario.json` `steps[].wind`); RH: the weather station's reading in the step, if it
 *   gave one (it does at the practice step and steps 10, 15, 19), else null;
 * - events: the CA's scripted events (`SCENARIO_18_FORCING`), the incident radio's crossings and stops (dated by the
 *   interval they name), and a crown fire where the head's flames are "above the treetops";
 * - units and placements: the scripted roster and positions (`steps[].units`, `unitWork`, `aircraft`).
 * Nothing the scenario does not hold is filled in: LACES, CO, water confirmation, crew sizes, hose carried and hours on
 * shift stay null (the scripts then report the check as unverifiable or, for LACES, as failed).
 */

import type { SiteStep } from "../../app/scenario/site-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { UnitTask } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import type { CycleForcing } from "../fire-ca/run.js";
import { barriersAhead, type BarrierAhead } from "./spatial.js";
import { fireTypeOfClass, headFire, maxBand, observationsOfStep, SEGMENT_IDS, segmentOf, type FlameBand, type Observation, type SegmentId } from "./fire-observations.js";
import { clockOf, cycleOfStep, dist, toEN, type EN } from "./geo.js";

// ---------------------------------------------------------------------------------------------------
// Units: our roster mapped to the skill's unit types (ids kept)
// ---------------------------------------------------------------------------------------------------

export type SkillUnitType = "engine" | "tanker" | "drone" | "helicopter" | "unknown";

/** By the roster's Finnish type (`site-scenario.json` `units[].type`); "unknown" where the mapping is not certain. */
export function unitTypeOf(typeFi: string): SkillUnitType {
  if (/^Pelastusyksikkö/.test(typeFi)) return "engine"; // rescue unit (with tank, wildfire container or as reinforcement)
  if (/^Säiliöauto/.test(typeFi) || /^VPK, säiliöauto/.test(typeFi)) return "tanker";
  return "unknown"; // Maastopaloyksikkö (wildland unit: hose team or ground crew?), Letkunvetorobotti (hose-laying robot)
}

export function aircraftTypeOf(kind: string): SkillUnitType {
  return kind === "drone" ? "drone" : kind === "helicopter" ? "helicopter" : "unknown"; // fixed_wing (spotter), water_drone
}

/** The scripted task as an attack mode (null: not attacking the fire — staging, transit, refill, shuttle, rest, withdrawn …). */
export function attackOf(task: UnitTask | string): string | null {
  switch (task) {
    case "hose_attack": case "pump_attack": case "mop_up": return "direct";
    case "firebreak": case "road_line": return "indirect";
    case "evacuation": return "point_protection";
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------

export interface FireEvent { readonly kind: string; readonly note: string; readonly source: string; readonly distance_m: number | null }

const PRIORITY = ["reignition", "crown", "spotting", "stop_at_barrier", "barrier_crossed", "deep_burning", "regime_change", "suppression", "control"];

/** The step a radio report is about: the interval it names ("klo 18.40–19.00"), else its own step. */
function stepNamed(text: string, own: number): number {
  const m = text.match(/klo (\d{1,2})\.(\d{2})–/);
  if (!m) return own;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return Math.floor((minutes - (13 * 60 + 20)) / 20) + 1;
}

function eventsOf(step: number, forcing: readonly CycleForcing[], crown: boolean): FireEvent[] {
  const out: FireEvent[] = [];
  const f = forcing.find((x) => x.id === String(step));
  for (const e of f?.events ?? []) {
    const src = `scenario-18.ts forcing, step ${step}`;
    if (e.kind === "control_sector") out.push({ kind: "control", note: e.note, source: src, distance_m: null });
    else if (e.kind === "ignite") out.push({ kind: e.rekindle ? "reignition" : "spotting", note: e.note, source: src, distance_m: !e.rekindle && e.anchor === "head" ? e.distanceM : null });
    else out.push({ kind: "suppression", note: e.note, source: src, distance_m: null });
  }
  SITE_SCENARIO.radio.forEach((r) => {
    if ((r.kind !== "crossing" && r.kind !== "stopped") || stepNamed(r.text, r.cycle) !== step) return;
    const k = SITE_SCENARIO.radio.filter((x) => x.cycle === r.cycle).indexOf(r);
    out.push({ kind: r.kind === "stopped" ? "stop_at_barrier" : "barrier_crossed", note: r.text, source: `atom.radio.${r.cycle}.${k}`, distance_m: null });
  });
  if (crown) out.push({ kind: "crown", note: "the head's flames are reported above the treetops (intensity class 5/5)", source: "head observation", distance_m: null });
  // The forcing's categorical basis (SPEC/24 §6): `depth` = burning below the surface; `mechanism` = a regime change the projection lacks.
  const src = `scenario-18.ts forcing, step ${step}`;
  if (f?.categoricalBasis === "depth") out.push({ kind: "deep_burning", note: "burning deep in the humus layer and stump roots (categorical basis: depth)", source: src, distance_m: null });
  if (f?.categoricalBasis === "mechanism") out.push({ kind: "regime_change", note: "a regime change the projection's model lacks (categorical basis: mechanism)", source: src, distance_m: null });
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The cycle record
// ---------------------------------------------------------------------------------------------------

const ORIGIN: EN = toEN(SITE_SCENARIO.ignition);

/** A band as [lo, hi] metres; null for none and for "above the treetops" (no number). */
const bandOf = (b: FlameBand | null): [number | null, number | null] | null => (b && !b.crown ? [b.lo, b.hi] : null);

function rhOf(step: number): { rh: number | null; source: string | null } {
  const rec = SITE_SCENARIO.traffic.find((t) => t.cycle === step && t.actor === "SAA" && /ilmankosteus \d+ %/.test(t.content));
  const m = rec?.content.match(/ilmankosteus (\d+) %/);
  return m ? { rh: Number(m[1]), source: rec!.id } : { rh: null, source: null };
}

function segmentRecord(id: SegmentId, obs: readonly Observation[], seg: ReadonlyMap<string, SegmentId>) {
  const mine = obs.filter((o) => seg.get(o.id) === id);
  const top = maxBand(mine);
  const rates = mine.map((o) => o.rateMpm).filter((r): r is number => r !== null);
  const ros = rates.length ? Math.max(...rates) : null;
  const rosSource = ros === null ? undefined : mine.find((o) => o.rateMpm === ros);
  const sources = [...(top ? [top.id] : []), ...(rosSource && rosSource !== top ? [rosSource.id] : [])];
  return {
    id, type: id === "head" ? "head" : id === "rear" ? "rear" : "flank",
    flame_length_m: top?.band?.hi ?? null, flame_band_m: bandOf(top?.band ?? null),
    ros_m_min: ros, sources,
  };
}

function unitsAndPlacements(s: SiteStep, head: EN, headBearing: number) {
  const units: object[] = [];
  const placements: object[] = [];
  const dir: EN = [Math.sin((headBearing * Math.PI) / 180), Math.cos((headBearing * Math.PI) / 180)];
  const ahead = (p: EN, segment: SegmentId) => (segment === "head" && (p[0] - head[0]) * dir[0] + (p[1] - head[1]) * dir[1] > 0 ? Math.round(dist(p, head)) : null);
  for (const u of SITE_SCENARIO.units) {
    const at = s.units[u.id];
    if (!at) continue;
    const type = unitTypeOf(u.type);
    units.push({ id: u.id, type, type_fi: u.type, type_mapping: type === "unknown" ? "uncertain: left unknown" : "mapped from the roster type", persons: null, hose_available_m: null, hours_on_shift: null, available_from_cycle: u.availableFromCycle });
    const xy = toEN(at);
    const work = s.unitWork[u.id];
    const segment = segmentOf(xy, ORIGIN, head, headBearing);
    const vehicle = work?.vehicle ? toEN(work.vehicle) : null;
    placements.push({
      unit_id: u.id, segment_id: segment, task: work?.task ?? null, attack: work ? attackOf(work.task) : null, xy,
      vehicle_xy: vehicle, hose_length_needed_m: work?.hoseM ?? null, access_distance_m: vehicle ? Math.round(dist(xy, vehicle)) : null,
      distance_ahead_of_head_m: ahead(xy, segment), water_pct: work?.waterPct ?? null,
      escape_route: null, safety_zone: null, comms: null, downwind: null, co_ppm: null, water_confirmed: null,
    });
  }
  for (const a of s.aircraft) {
    const type = aircraftTypeOf(a.kind);
    units.push({ id: a.platformId, type, type_fi: a.kind, type_mapping: type === "unknown" ? "uncertain: left unknown" : "mapped from the aircraft kind", persons: null, hose_available_m: null, hours_on_shift: null, available_from_cycle: null });
    const xy = toEN(a.position);
    const segment = segmentOf(xy, ORIGIN, head, headBearing);
    placements.push({
      unit_id: a.platformId, segment_id: segment, task: "airborne", attack: type === "drone" ? "lookout" : null, xy,
      vehicle_xy: null, hose_length_needed_m: null, access_distance_m: null, distance_ahead_of_head_m: ahead(xy, segment), water_pct: null,
      escape_route: null, safety_zone: null, comms: null, downwind: null, co_ppm: null, water_confirmed: null,
    });
  }
  return { units, placements };
}

export function cycleRecord(s: SiteStep, forcing: readonly CycleForcing[]): object {
  const startS = (s.index - 1) * 1200;
  const head = toEN(s.observedHead.anchor);
  const headBearing = s.observedHead.bearingDeg;
  const obs = observationsOfStep(s.index);
  const seg = new Map<string, SegmentId>(obs.filter((o) => o.xy !== null).map((o) => [o.id, segmentOf(o.xy!, ORIGIN, head, headBearing)]));
  const hf = headFire(obs, s.observedHead.observerId, seg);
  const fireType = hf.cls === null ? null : fireTypeOfClass(hf.cls);
  const flanks = obs.filter((o) => seg.get(o.id) === "left_flank" || seg.get(o.id) === "right_flank");
  const flankTop = maxBand(flanks);
  const events = eventsOf(s.index, forcing, fireType === "active_crown");
  const primary = PRIORITY.find((k) => events.some((e) => e.kind === k)) ?? null;
  const spotting = events.filter((e) => e.kind === "spotting" && e.distance_m !== null).map((e) => e.distance_m!);
  const forcingNotes = (forcing.find((x) => x.id === String(s.index))?.events ?? []).map((e) => e.note);
  const rh = rhOf(s.index);
  const segments = SEGMENT_IDS.map((id) => segmentRecord(id, obs, seg)).map((r) => r.id !== "head" ? r : {
    ...r, flame_length_m: hf.band?.hi ?? null, flame_band_m: bandOf(hf.band), ros_m_min: s.headRos.achievedMpm, fire_type: fireType, sources: hf.sourceIds,
  });
  const smoulder = obs.filter((o) => o.smoulder).map((o) => `${o.source} ${o.id}: ${o.text_en ?? o.text_fi}${o.xy ? ` @ E ${o.xy[0]} N ${o.xy[1]}` : ""}`);
  const flareUps = s.fire.spot_fires.filter((x) => x.callsign.startsWith("US")).map((x) => { const p = toEN(x.position); return `flare-up ${x.callsign} (${x.confirmed ? "confirmed" : "reported, unconfirmed"}) @ E ${p[0]} N ${p[1]}`; });
  const { units, placements } = unitsAndPlacements(s, head, headBearing);
  const barriers: BarrierAhead[] = barriersAhead(head, headBearing);
  return {
    cycle: cycleOfStep(s.index), step: s.index, view: viewOfStep(s.index)?.id ?? null, time: s.clock, time_end: clockOf(startS + 1200),
    fire_type: fireType, fire_type_basis: hf.cls === null ? hf.basis : `intensity class ${hf.cls}/5 from ${hf.basis} (${hf.sourceIds.join(", ")})`,
    ros_head_m_min: s.headRos.achievedMpm, ros_head_authored_m_min: s.headRos.actualMpm, ros_head_projected_m_min: s.headRos.envelopeMpm,
    observed_head: { at: "step start", rate_m_min: s.observedHead.rateMpm, rate_band_m_min: s.observedHead.rateBand ?? null, bearing_deg: headBearing, observer: s.observedHead.observerId, xy: head },
    fl_head_m: hf.band?.hi ?? null, fl_head_band_m: bandOf(hf.band), fl_head_phrase: hf.band?.phrase ?? null, fl_head_sources: hf.sourceIds,
    fl_flank_m: flankTop?.band?.hi ?? null, fl_flank_band_m: bandOf(flankTop?.band ?? null), fl_flank_sources: flankTop ? [flankTop.id] : [],
    isi: null,
    wind: { from_deg: s.wind.fromDeg, speed_ms: s.wind.meanMs, gust_ms: s.wind.gustMs },
    head_bearing_deg: headBearing,
    rh_pct: rh.rh, rh_source: rh.source,
    event: primary, events,
    spotting_m: spotting.length ? Math.max(...spotting) : null,
    reignition_source: events.find((e) => e.kind === "reignition")?.note ?? null,
    change_reason: forcingNotes.length ? forcingNotes.join("; ") : null,
    segments, barriers, smouldering_spots: [...smoulder, ...flareUps],
    units, placements,
    is_night: false, // SPEC/18 §2: a day in late July; the steps run 12:00–20:00
  };
}

export function buildCycles(forcing: readonly CycleForcing[]): object[] {
  return SITE_SCENARIO.steps.map((s) => cycleRecord(s, forcing));
}
