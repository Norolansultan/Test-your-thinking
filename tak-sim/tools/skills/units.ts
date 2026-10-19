/**
 * Units and placements of `cycles.json` (`tactical_check.py`'s `units[]` and `placements[]`), per step:
 * - types: the roster's Finnish type mapped to the skill's types; the wildland unit (Maastopaloyksikkö: portable pump and
 *   hose lines from natural water) is a `hose_team`, the skill's equipment class (SPEC/31 §5 D11); uncertain types stay
 *   `unknown`;
 * - `persons`: the roster's crew ("1+4" → 5; SPEC/18 §8.1, `app/render/ui/unit-roster.ts`; D5);
 * - `hours_on_shift`: the crew's own latest statement at or before the step ("Miehistö ollut kentällä 2,5 h"), as stated,
 *   never extrapolated (D7);
 * - placements: the scripted position and task, the segment of the window's active front (`window.ts`), the CO-zone
 *   proxy (`smoke-zone.ts`, D4); aircraft are exempt from the LACES fields (they are for ground crews), which carry
 *   "n/a (airborne)" so that the check does not fail them for a rule that does not apply.
 * Escape route, safety zone, comms and water confirmation of ground crews stay null (not authored as fields).
 */

import type { SiteStep } from "../../app/scenario/site-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { UnitTask } from "../../app/scenario/types.js";
import { UNIT_ROSTER } from "../../app/render/ui/unit-roster.js";
import type { Observation } from "./fire-observations.js";
import { dist, toEN } from "./geo.js";
import { zoneProxy } from "./smoke-zone.js";
import { aheadOfHead, placeOnFront, type FrontGeometry } from "./window.js";

export type SkillUnitType = "engine" | "tanker" | "hose_team" | "drone" | "helicopter" | "unknown";

/** By the roster's Finnish type (`site-scenario.json` `units[].type`); "unknown" where the mapping is not certain. */
export function unitTypeOf(typeFi: string): SkillUnitType {
  if (/^Pelastusyksikkö/.test(typeFi)) return "engine"; // rescue unit (with tank, wildfire container or as reinforcement)
  if (/^Säiliöauto/.test(typeFi) || /^VPK, säiliöauto/.test(typeFi) || /^(?:Raskas )?säiliöyksikkö/i.test(typeFi)) return "tanker";
  if (/^Maastopaloyksikkö/.test(typeFi)) return "hose_team"; // wildland unit: portable pump from natural water, hose lines (D11)
  return "unknown"; // Letkunvetorobotti (hose-laying robot)
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

/** The roster's crew as a head count: "1+4" → 5, "3 (drooniryhmä, johtopaikalla)" → 3; null without a crew entry. */
export function personsOf(unitId: string): { persons: number | null; crew: string | null } {
  const crew = UNIT_ROSTER[unitId]?.crew ?? null;
  const m = crew?.match(/^(\d+)(?:\+(\d+))?/);
  return { persons: m ? Number(m[1]) + (m[2] ? Number(m[2]) : 0) : null, crew };
}

const SHIFT = /[Mm]iehistö ollut kentällä (\d+(?:,\d+)?) h/;

/** The crew's latest "Miehistö ollut kentällä X h" at or before `step` (its own record), as stated. */
export function hoursOnShift(unitId: string, step: number): { hours: number | null; sourceId: string | null; at: string | null } {
  let best: { hours: number; sourceId: string; at: string; key: number } | null = null;
  for (const t of SITE_SCENARIO.traffic) {
    if (t.actor !== unitId || t.cycle > step) continue;
    const m = t.content.match(SHIFT);
    if (!m) continue;
    const key = t.sim_time_s;
    if (best === null || key >= best.key) best = { hours: Number(m[1]!.replace(",", ".")), sourceId: t.id, at: t.timestamp, key };
  }
  return best ? { hours: best.hours, sourceId: best.sourceId, at: best.at } : { hours: null, sourceId: null, at: null };
}

const AIRBORNE = "n/a (airborne)";

export interface UnitsInput {
  readonly step: SiteStep;
  readonly geometry: FrontGeometry;
  readonly edges: readonly (readonly (readonly [number, number])[])[];
  readonly windFromDeg: number;
  readonly obs: readonly Observation[];
}

export function unitsAndPlacements({ step: s, geometry, edges, windFromDeg, obs }: UnitsInput): { units: object[]; placements: object[] } {
  const units: object[] = [];
  const placements: object[] = [];
  for (const u of SITE_SCENARIO.units) {
    const at = s.units[u.id];
    if (!at) continue;
    const type = unitTypeOf(u.type);
    const { persons, crew } = personsOf(u.id);
    const shift = hoursOnShift(u.id, s.index);
    units.push({
      id: u.id, type, type_fi: u.type, type_mapping: type === "unknown" ? "uncertain: left unknown" : "mapped from the roster type",
      persons, persons_basis: crew === null ? null : `roster crew ${crew}`, hose_available_m: null,
      hours_on_shift: shift.hours, hours_on_shift_source: shift.sourceId, hours_on_shift_at: shift.at, available_from_cycle: u.availableFromCycle,
    });
    const xy = toEN(at);
    const work = s.unitWork[u.id];
    const { segment, front } = placeOnFront(xy, geometry);
    const vehicle = work?.vehicle ? toEN(work.vehicle) : null;
    const z = zoneProxy(xy, edges, windFromDeg, obs);
    placements.push({
      unit_id: u.id, segment_id: segment, front, task: work?.task ?? null, attack: work ? attackOf(work.task) : null, xy,
      vehicle_xy: vehicle, hose_length_needed_m: work?.hoseM ?? null, access_distance_m: vehicle ? Math.round(dist(xy, vehicle)) : null,
      distance_ahead_of_head_m: aheadOfHead(xy, geometry, segment), water_pct: work?.waterPct ?? null,
      escape_route: null, safety_zone: null, comms: null, downwind: z.downwind, co_ppm: null, zone: z.zone, zone_basis: z.basis, water_confirmed: null,
    });
  }
  for (const a of s.aircraft) {
    const type = aircraftTypeOf(a.kind);
    const { persons, crew } = personsOf(a.platformId);
    units.push({
      id: a.platformId, type, type_fi: a.kind, type_mapping: type === "unknown" ? "uncertain: left unknown" : "mapped from the aircraft kind",
      persons, persons_basis: crew === null ? null : `roster crew ${crew}`, hose_available_m: null,
      hours_on_shift: null, hours_on_shift_source: null, hours_on_shift_at: null, available_from_cycle: null,
    });
    const xy = toEN(a.position);
    const { segment, front } = placeOnFront(xy, geometry);
    placements.push({
      unit_id: a.platformId, segment_id: segment, front, task: "airborne", attack: type === "drone" ? "lookout" : null, xy,
      vehicle_xy: null, hose_length_needed_m: null, access_distance_m: null, distance_ahead_of_head_m: aheadOfHead(xy, geometry, segment), water_pct: null,
      laces_exempt: true, escape_route: AIRBORNE, safety_zone: AIRBORNE, comms: AIRBORNE, downwind: null, co_ppm: null, zone: null, zone_basis: null, water_confirmed: null,
    });
  }
  return { units, placements };
}
