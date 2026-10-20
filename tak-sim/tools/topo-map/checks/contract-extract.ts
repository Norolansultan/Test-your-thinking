/**
 * `npm run map:contract:extract` — writes the generated part of the geometry contract (SPEC/33 §3, stage 0),
 * `content/site/contract.json`: every contract feature with its geometry on the map built now (`contract-map.ts`
 * FEATURE_CATALOGUE), and every relation of RELATION_SPECS below measured on it, with its tolerance and the files, items
 * and records that use it. The file's `curated` section (hand-written relations, features and text rules) is kept as it is.
 *
 * Run it once on the map the scenario was authored on: its values are the contract a rebuilt map must meet (`npm run
 * map:check`). Re-running it after a rebuild would move the contract to the new map: do that only once every changed
 * relation has been accepted (SPEC/33 §5 gate D).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTRACT_PATH, measure, type Contract, type ContractFeature, type Relation, type RelationType, type Tolerance, type UsedBy } from "./contract.js";
import { FEATURE_CATALOGUE, loadBuiltMap, type BuiltMap } from "./contract-map.js";
import type { Geom } from "./contract-geom.js";
import { RELATION_SPECS } from "./contract-specs.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** A relation before measuring: its value comes from the built map, its tolerance from `tol` (or, for a band key, `band`). */
export interface RelationSpec {
  readonly id: string;
  readonly type: RelationType;
  readonly measure: Relation["measure"];
  readonly features: readonly string[];
  readonly params?: Readonly<Record<string, unknown>>;
  readonly unit?: string;
  /** Fixed tolerance; default by type (distance ±15 %, bearing ±20°, topology exact). */
  readonly tol?: Tolerance;
  /** A band key's edges and margin: the tolerance is the band the current value falls in, shrunk by the margin (bandOf's rule). */
  readonly band?: { readonly edges: readonly number[]; readonly margin: number };
  readonly usedBy: readonly UsedBy[];
  readonly note?: string;
}

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
const roundGeom = (g: Geom): unknown => {
  const rp = (p: { x: number; y: number }) => [round(p.x), round(p.y)];
  switch (g.kind) {
    case "point": return { type: "Point", coordinates: rp(g.p) };
    case "line": return { type: "LineString", coordinates: g.pts.filter((_, i) => i % Math.max(1, Math.floor(g.pts.length / 60)) === 0 || i === g.pts.length - 1).map(rp), simplified: g.pts.length > 60 };
    case "polygon": return { type: "Polygon", coordinates: g.rings.map((r) => r.filter((_, i) => i % Math.max(1, Math.floor(r.length / 60)) === 0).map(rp)), simplified: g.rings.some((r) => r.length > 60) };
    case "sector": return { type: "Sector", fromDeg: g.fromDeg, toDeg: g.toDeg, about: "IGN" };
  }
};

function defaultTol(spec: RelationSpec): Tolerance {
  switch (spec.measure) {
    case "bearing": return { kind: "absolute", value: 20 };
    case "distance": case "road_route": case "fire_distance": return { kind: "relative", value: 0.15 };
    default: return { kind: "exact" };
  }
}

export function measureSpecs(map: BuiltMap): Relation[] {
  return RELATION_SPECS.map((spec) => {
    const probe: Relation = { id: spec.id, type: spec.type, measure: spec.measure, features: spec.features, value: 0, tolerance: { kind: "exact" }, usedBy: spec.usedBy, ...(spec.params ? { params: spec.params } : {}) };
    const raw = measure(probe, map);
    const value = typeof raw === "number" ? round(raw) : raw;
    let tolerance = spec.tol ?? defaultTol(spec);
    if (spec.band && typeof raw === "number") {
      const e = spec.band.edges;
      const lo = [...e].reverse().find((x) => x <= raw);
      const hi = e.find((x) => x > raw);
      tolerance = { kind: "range", ...(lo !== undefined ? { min: lo + spec.band.margin } : {}), ...(hi !== undefined ? { max: hi - spec.band.margin } : {}) };
    }
    return {
      id: spec.id, type: spec.type, measure: spec.measure, features: spec.features, ...(spec.params ? { params: spec.params } : {}),
      value, ...(spec.unit ? { unit: spec.unit } : typeof raw === "number" ? { unit: spec.measure === "bearing" || spec.measure === "sector_margin" ? "deg" : spec.measure === "crossing_count" ? "count" : "m" } : {}),
      tolerance, usedBy: spec.usedBy, ...(spec.note ? { note: spec.note } : {}),
    };
  });
}

export function buildContract(map: BuiltMap, curated: Contract["curated"]): Contract & Record<string, unknown> {
  const features: ContractFeature[] = FEATURE_CATALOGUE.map((f) => {
    const g = map.features[f.id];
    return { id: f.id, kind: f.kind, names: { fi: f.fi, en: f.en }, ...(f.match ? { match: f.match } : {}), geometry: g ? roundGeom(g) : null, sources: f.sources };
  });
  return {
    version: 1,
    about: "SPEC/33 §3 geometry contract: the map features and spatial relations the study's keys, items and texts depend on. Site metres from IGN (x east, y north; ETRS-TM35FIN 519 000 E, 6 746 000 N), compass degrees. `features` and `relations` are generated by `npm run map:contract:extract` (tools/topo-map/checks/contract-extract.ts, relation list in contract-specs.ts) on the map the scenario was authored on; `curated` is hand-written and kept by the extractor. `npm run map:check` evaluates every relation on the map built now and lists the texts no entry covers.",
    tolerances: { distance: "±15 % unless stated", bearing: "±20°", topology: "exact (sector, crossing, label) or a stated maximum offset (on_road, adjacency)", bandKeys: "the band the key's value falls in, less the key's own margin (bandOf)" },
    features,
    relations: measureSpecs(map),
    curated,
  };
}

function main(): void {
  const path = ROOT + CONTRACT_PATH;
  const empty: Contract["curated"] = { features: [], relations: [], textRules: [] };
  const curated = existsSync(path) ? ((JSON.parse(readFileSync(path, "utf8")) as Contract).curated ?? empty) : empty;
  const contract = buildContract(loadBuiltMap(), curated);
  writeFileSync(path, `${JSON.stringify(contract, null, 1)}\n`);
  console.log(`map:contract:extract — ${CONTRACT_PATH}: ${contract.features.length} features, ${contract.relations.length} generated relations; curated kept: ${curated.features.length} features, ${curated.relations.length} relations, ${curated.textRules.length} text rules`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
