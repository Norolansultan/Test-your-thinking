/**
 * The spatial files of the wildfire-skills package, EPSG:3067:
 * - `spatial/perimeters_scripted.geojson`: per step, the cellular automaton's TRUTH at the step's end (`kind: "truth"`,
 *   main fire and detached fronts as one MultiPolygon) and, separately tagged, the perimeter REPORTED at the step's start
 *   (`kind: "reported"`, what the participant's map shows). `perimeter_compare.py` unions every feature of a cycle, so a
 *   comparison must first keep one kind (DATA_SOURCES.md says how).
 * - `spatial/barriers.geojson`: the basemap's roads (by class), lakes and ponds, the river, the brooks and the bridges
 *   (`content/site/build/topo-features.json`, the fictional terrain of SPEC/23 §11). Ditches are not exported.
 * - `barriersAhead`: the roads (main, gravel, forest) and waters within 1 km ahead of a head (±45° of its bearing), with
 *   the distance to the nearest vertex there, for `cycles.json` (tactical_check's `barriers`).
 */

import type { SiteStep } from "../../app/scenario/site-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CycleForcing } from "../fire-ca/run.js";
import { bearing, clockOf, CRS_3067, cycleOfStep, dist, insideRing, multiPolygonEN, pxToEN, signedAngle, toEN, type EN } from "./geo.js";

interface TopoFeatures {
  readonly water: readonly (readonly number[][])[];
  readonly ponds: readonly (readonly number[][])[];
  readonly river: readonly (readonly number[][])[];
  readonly brooks: readonly (readonly number[][])[];
  readonly roads: readonly { readonly cls: string; readonly pts: readonly number[][] }[];
  readonly bridges: readonly number[][];
  readonly labels: readonly { readonly text: string; readonly px: readonly number[]; readonly style: string }[];
}
/** Read at run time (7.6 MB: too large for the type checker as a JSON import). */
const TOPO_PATH = fileURLToPath(new URL("../../content/site/build/topo-features.json", import.meta.url));
let topoCache: TopoFeatures | null = null;
function topo(): TopoFeatures {
  topoCache ??= JSON.parse(readFileSync(TOPO_PATH, "utf8")) as TopoFeatures;
  return topoCache;
}

export type BarrierType = "road" | "water" | "river" | "brook" | "bridge";

export interface Barrier {
  readonly id: string;
  readonly type: BarrierType;
  readonly cls: string | null;
  readonly name: string | null;
  /** LineString / Polygon outer ring / Point vertices, EPSG:3067. */
  readonly coords: readonly EN[];
  readonly geometry: "LineString" | "Polygon" | "Point";
}

// ---------------------------------------------------------------------------------------------------
// Barrier layer
// ---------------------------------------------------------------------------------------------------

/** The scenario's named road points (`site-scenario.json` features): which feature names a road. */
const ROAD_NAMES: readonly { readonly prefix: string; readonly name: string }[] = [
  { prefix: "R1_", name: "R1" }, { prefix: "R2_", name: "R2" }, { prefix: "R3_", name: "R3" }, { prefix: "FR_", name: "Honkaharju forest road" },
];
/** The feature names (only counted per prefix below, so their order does not matter). */
function featureNames(): string[] {
  const names: string[] = [];
  for (const k in SITE_SCENARIO.features) names.push(k);
  return names;
}

function minDistToLine(p: EN, line: readonly EN[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!, b = line[i + 1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    best = Math.min(best, dist(p, [a[0] + t * dx, a[1] + t * dy]));
  }
  return line.length === 1 ? dist(p, line[0]!) : best;
}

/** A road's name: the designed road (R1, R2, R3, the Honkaharju forest road) with the most named points within 40 m of it. */
function roadName(line: readonly EN[]): string | null {
  let best: { name: string; n: number } | null = null;
  for (const r of ROAD_NAMES) {
    const n = featureNames().filter((f) => f.startsWith(r.prefix)).filter((f) => {
      const at = SITE_SCENARIO.features[f];
      return at !== undefined && minDistToLine(toEN(at), line) <= 40;
    }).length;
    if (n > 0 && (best === null || n > best.n)) best = { name: r.name, n };
  }
  return best?.name ?? null;
}

const waterLabels = () => topo().labels.filter((l) => l.style === "water").map((l) => ({ text: l.text, at: pxToEN(l.px) }));

function polygonName(ring: readonly EN[]): string | null {
  return waterLabels().find((l) => insideRing(l.at, ring))?.text ?? null;
}

function lineName(line: readonly EN[]): string | null {
  let best: { text: string; d: number } | null = null;
  for (const l of waterLabels()) {
    const d = minDistToLine(l.at, line);
    if (d <= 150 && (best === null || d < best.d)) best = { text: l.text, d };
  }
  return best?.text ?? null;
}

let barrierCache: readonly Barrier[] | null = null;

/** Every barrier of the basemap, in a fixed order: roads, lakes, ponds, the river, brooks, bridges. */
export function barrierLayer(): readonly Barrier[] {
  if (barrierCache) return barrierCache;
  const TOPO = topo();
  const out: Barrier[] = [];
  const used = new Map<string, number>();
  const uniq = (id: string) => { const n = (used.get(id) ?? 0) + 1; used.set(id, n); return n === 1 ? id : `${id}.${n}`; };
  TOPO.roads.forEach((r, i) => {
    const coords = r.pts.map(pxToEN);
    const name = roadName(coords);
    out.push({ id: uniq(name ? `road.${name.replace(/\s+/g, "_")}` : `road.${r.cls}.${i}`), type: "road", cls: r.cls, name, coords, geometry: "LineString" });
  });
  TOPO.water.forEach((w, i) => { const coords = w.map(pxToEN); out.push({ id: `water.${i}`, type: "water", cls: "lake", name: polygonName(coords), coords, geometry: "Polygon" }); });
  TOPO.ponds.forEach((w, i) => { const coords = w.map(pxToEN); out.push({ id: `pond.${i}`, type: "water", cls: "pond", name: polygonName(coords), coords, geometry: "Polygon" }); });
  TOPO.river.forEach((w, i) => { const coords = w.map(pxToEN); out.push({ id: `river.${i}`, type: "river", cls: "river", name: lineName(coords), coords, geometry: "LineString" }); });
  TOPO.brooks.forEach((w, i) => { const coords = w.map(pxToEN); out.push({ id: `brook.${i}`, type: "brook", cls: "brook", name: lineName(coords), coords, geometry: "LineString" }); });
  TOPO.bridges.forEach((b, i) => { out.push({ id: `bridge.${i}`, type: "bridge", cls: "bridge", name: null, coords: [pxToEN(b)], geometry: "Point" }); });
  barrierCache = out;
  return out;
}

function closedRing(coords: readonly EN[]): EN[] {
  const f = coords[0], l = coords[coords.length - 1];
  return f && l && (f[0] !== l[0] || f[1] !== l[1]) ? [...coords, f] : [...coords];
}

export function barriersGeoJson(version: string): object {
  return {
    type: "FeatureCollection", crs: CRS_3067, version,
    features: barrierLayer().map((b) => ({
      type: "Feature",
      properties: { id: b.id, type: b.type, class: b.cls, name: b.name },
      geometry: b.geometry === "Point" ? { type: "Point", coordinates: b.coords[0] }
        : b.geometry === "Polygon" ? { type: "Polygon", coordinates: [closedRing(b.coords)] }
        : { type: "LineString", coordinates: b.coords },
    })),
  };
}

export interface BarrierAhead {
  readonly id: string;
  readonly type: string;
  readonly name: string | null;
  readonly segment_ahead: "head";
  readonly distance_ahead_m: number;
  readonly nearest_xy: readonly [number, number];
}

const AHEAD_TYPES: ReadonlySet<string> = new Set(["main", "gravel", "forest", "lake", "pond", "river", "brook"]);

/** Roads (main, gravel, forest) and waters with a vertex within `maxM` ahead of the head (±`halfAngleDeg` of its bearing), nearest first. */
export function barriersAhead(head: EN, headBearingDeg: number, maxM = 1000, halfAngleDeg = 45): BarrierAhead[] {
  const out: BarrierAhead[] = [];
  for (const b of barrierLayer()) {
    if (b.cls === null || !AHEAD_TYPES.has(b.cls)) continue;
    let best: { d: number; at: EN } | null = null;
    for (const v of b.coords) {
      const d = dist(head, v);
      if (d > maxM || d < 1) continue;
      if (Math.abs(signedAngle(headBearingDeg, bearing(head, v))) > halfAngleDeg) continue;
      if (best === null || d < best.d) best = { d, at: v };
    }
    if (best) out.push({ id: b.id, type: b.type === "road" ? `${b.cls} road` : b.cls, name: b.name, segment_ahead: "head", distance_ahead_m: Math.round(best.d), nearest_xy: [best.at[0], best.at[1]] });
  }
  return out.sort((a, b) => a.distance_ahead_m - b.distance_ahead_m || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------------
// Perimeters
// ---------------------------------------------------------------------------------------------------

/** Whether suppression shaped the truth this step: the CA's control, fuel-removal and knock-down events, and every step from 10 (L2 in hand). */
export function suppressedAt(step: number, forcing: readonly CycleForcing[]): boolean {
  const f = forcing.find((x) => x.id === String(step));
  const acted = (f?.events ?? []).some((e) => e.kind === "control_sector" || e.kind === "remove_fuel" || e.kind === "extinguish");
  return acted || step >= 10;
}

export function perimetersGeoJson(version: string, forcing: readonly CycleForcing[]): object {
  const features: object[] = [];
  for (const s of SITE_SCENARIO.steps) {
    const cycle = cycleOfStep(s.index);
    const startS = (s.index - 1) * 1200;
    features.push(perimeterFeature(s, cycle, "truth", "end", clockOf(startS + 1200), suppressedAt(s.index, forcing)));
    features.push(perimeterFeature(s, cycle, "reported", "start", s.clock, suppressedAt(s.index, forcing)));
  }
  return { type: "FeatureCollection", crs: CRS_3067, version, features };
}

function perimeterFeature(s: SiteStep, cycle: number, kind: "truth" | "reported", at: "start" | "end", time: string, suppressed: boolean): object {
  const coords = kind === "truth" ? multiPolygonEN(s.truthAtEnd, s.truthDetached) : multiPolygonEN(s.reported, s.reportedDetached);
  return {
    type: "Feature",
    properties: {
      cycle, step: s.index, kind, at, time, suppressed,
      source: kind === "truth" ? "cellular automaton (SPEC/24), truth at the step's end, main fire + detached fronts" : "reported perimeter at the step's start (the participant's map)",
    },
    geometry: { type: "MultiPolygon", coordinates: coords },
  };
}
