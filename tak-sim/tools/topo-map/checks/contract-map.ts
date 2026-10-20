/**
 * The built map as the geometry contract reads it (SPEC/33 §3): every feature the study depends on, in site metres
 * (x east, y north of IGN), from the topo build output (`content/site/build/topo-features.json`), the terrain modules'
 * exports (`tools/topo-map/{terrain,roads}.ts`), the scenario's anchor points (`tools/fire-ca/deployment.ts` FEATURES)
 * and the fire's run as frozen in the scenario bundle (`app/scenario/site-scenario.json`).
 *
 * FEATURE_CATALOGUE is the one list of contract features: `contract-extract.ts` writes it, with each feature's current
 * geometry, into `content/site/contract.json`; `loadBuiltMap` reads the same features off whatever map is built now.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BRIDGE_S, COMMAND_POINT, roadIndexById, ROADS } from "../roads.js";
import { BRIDGE, BROOKS, ESKER_CENTRE, HAMLET_S, LAKES, polar, RIVER, VILLAGE } from "../terrain.js";
import { FEATURES } from "../../fire-ca/deployment.js";
import { wgs84ToTm35 } from "../../fire-ca/tm35.js";
import { parseAsciiGrid } from "../../fire-ca/ascii-grid.js";
import { sortedEntries, sortedKeys } from "../../../app/engine/deterministic-object.js";
import { IGN_TM35 } from "../terrain-base.js";
import type { Geom, P } from "./contract-geom.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const TOPO_FEATURES_PATH = "content/site/build/topo-features.json";
export const SITE_SCENARIO_PATH = "app/scenario/site-scenario.json";

/** The stable id (roads.ts `Road.id`) of each named road; its index in ROADS (= topo-features.json `roads`) follows from it. The
 * Honkaharju forest road was found by index (48) until SPEC/33's rebuild renumbered the generated roads. */
export const ROAD_ID = {
  MAANTIE_S: "maantie_s", MAANTIE_N: "maantie_n", R3_W: "r3_w", R1: "r1", R3_E: "r3_e", R2: "r2", KARHU_ROAD: "karhu", PEAT_ROAD: "peat", HONKAHARJU_ROAD: "honkaharju",
} as const;
export const ROAD_INDEX: Readonly<Record<keyof typeof ROAD_ID, number>> = Object.fromEntries(
  sortedEntries(ROAD_ID).map(([k, id]) => [k, roadIndexById(id)]),
) as Record<keyof typeof ROAD_ID, number>;

/** The four sectors (lohkot) as bearing wedges from IGN, as `sectorOfPoint` (traffic-places.ts) and the bundle's polygons tile them. */
export const SECTOR_WEDGES = {
  L1: { fromDeg: 280, toDeg: 20, fi: "L1-Pohjoinen", en: "L1 North" },
  L2: { fromDeg: 20, toDeg: 100, fi: "L2-Koillinen", en: "L2 North-east" },
  L3: { fromDeg: 100, toDeg: 220, fi: "L3-Etelä", en: "L3 South" },
  L4: { fromDeg: 220, toDeg: 280, fi: "L4-Länsi", en: "L4 West" },
} as const;

export interface FeatureDef {
  readonly id: string;
  readonly kind: string;
  readonly fi: string;
  readonly en: string;
  /** Regular expression (source) that finds the feature's name in a text, any inflection; none for unnamed anchors. */
  readonly match?: string;
  readonly sources: readonly string[];
}

const T = "tools/topo-map/terrain.ts", TB = "tools/topo-map/terrain-base.ts", RD = "tools/topo-map/roads.ts", PL = "tools/topo-map/places.ts";
const DEP = "tools/fire-ca/deployment.ts", TF = TOPO_FEATURES_PATH, PN = "app/i18n/place-names.ts";

/** The contract's features. `anchor.*` are the scenario's unit and water points (deployment.ts FEATURES), placed on the map. */
export const FEATURE_CATALOGUE: readonly FeatureDef[] = [
  { id: "IGN", kind: "ignition", fi: "syttymäkohta", en: "point of origin", match: "syttymäkoh|point of origin", sources: [TB, DEP, "content/site/site.json"] },
  { id: "CP", kind: "command_point", fi: "johtopaikka", en: "command post", match: "johtopaik|command post", sources: [RD, DEP, "content/site/site.json"] },
  { id: "R1", kind: "road_gravel", fi: "tie R1", en: "road R1", match: "\\bR1\\b", sources: [RD, TF, "tools/fire-ca/traffic-drones.ts"] },
  { id: "R2", kind: "road_gravel", fi: "tie R2", en: "road R2", match: "\\bR2\\b", sources: [RD, TF, "tools/fire-ca/traffic-drones.ts"] },
  { id: "R3_W", kind: "road_gravel", fi: "tie R3 (länsi)", en: "road R3 (west)", match: "\\bR3\\b", sources: [RD, TF] },
  { id: "R3_E", kind: "road_gravel", fi: "tie R3 (itä, silta)", en: "road R3 (east, bridge)", match: "\\bR3\\b", sources: [RD, TF] },
  { id: "MAANTIE_S", kind: "road_main", fi: "maantie", en: "main road", match: "maantie|main road", sources: [RD, TF, PL] },
  { id: "MAANTIE_N", kind: "road_main", fi: "maantie (pohjoinen)", en: "main road (north)", sources: [RD, TF] },
  { id: "KARHU_ROAD", kind: "road_gravel", fi: "Mökkirannan tie", en: "Lakeside Cottages road", sources: [RD, TF, "tools/fire-ca/crossings.ts"] },
  { id: "PEAT_ROAD", kind: "road_gravel", fi: "turvetie", en: "peat road", match: "turvetie|peat road", sources: [RD, TF, "tools/fire-ca/crossings.ts"] },
  { id: "HONKAHARJU_ROAD", kind: "road_forest", fi: "metsäautotie (Honkaharju)", en: "forest road (Pine Ridge)", match: "metsäautoti|forest road", sources: [RD, TF, "tools/fire-ca/traffic-drones.ts (roadById(\"honkaharju\"))", "tools/fire-ca/crossings.ts"] },
  { id: "KOTKANJOKI", kind: "river", fi: "Kotkanjoki", en: "Eagle River", match: "Kotkanjo|Eagle River", sources: [T, TF, PN] },
  { id: "BRIDGE", kind: "bridge", fi: "R3:n silta (Kotkanjoki)", en: "the R3 bridge (Eagle River)", match: "silta|sillan|bridge", sources: [T, RD, DEP, TF] },
  { id: "BRIDGE_S", kind: "bridge", fi: "Hiekkalan tien silta", en: "Sandy Hamlet road bridge", sources: [RD, TF] },
  { id: "KORPIOJA", kind: "brook", fi: "Korpioja", en: "Alder Creek", match: "Korpioj|Alder Creek", sources: [T, TF, PN, "tools/fire-ca/crossings.ts"] },
  { id: "KOIVUOJA", kind: "brook", fi: "Koivuoja", en: "Birch Creek", match: "Koivuoj|Birch Creek", sources: [T, TF, PN, "tools/fire-ca/crossings.ts", DEP] },
  { id: "KARHUJARVI", kind: "lake", fi: "Karhujärvi", en: "Bear Lake", match: "Karhujärv|Bear Lake", sources: [TB, TF, PN, DEP] },
  { id: "HAUKILAMPI", kind: "lake", fi: "Haukilampi", en: "Pike Pond", match: "Haukila[mn]|Pike Pond", sources: [TB, TF, PN, DEP] },
  { id: "W2_POND", kind: "pond", fi: "Lahdenkylän lampi", en: "Bay Village pond", match: "Lahdenkylän lam|village pond|Bay Village pond", sources: ["tools/topo-map/build.ts", TF, DEP] },
  { id: "LAHDENKYLA", kind: "village", fi: "Lahdenkylä", en: "Bay Village", match: "Lahdenkyl|Bay Village", sources: [TB, PL, PN, DEP] },
  { id: "MOKKIRANTA", kind: "cottages", fi: "Mökkiranta", en: "Lakeside Cottages", match: "Mökkirann|Mökkiran|Lakeside Cottages", sources: [PL, RD, DEP, PN] },
  { id: "HIEKKALA", kind: "hamlet", fi: "Hiekkala", en: "Sandy Hamlet", match: "Hiekkal|Sandy Hamlet", sources: [TB, PL, PN] },
  { id: "KUIVAKANGAS", kind: "esker", fi: "Kuivakangas", en: "Dry Heath", match: "Kuivakan|Dry Heath|harju(?!n? ?\\()|esker", sources: [TB, PL, PN, DEP] },
  { id: "KUUSIMAKI", kind: "spruce_stand", fi: "Kuusimäki", en: "Spruce Hill", match: "Kuusimä|Spruce Hill", sources: [PL, PN, DEP] },
  { id: "BIRCH", kind: "birch_strip", fi: "Koivuojan koivikko", en: "the Birch Creek birch stand", match: "koivik|birch stand", sources: [DEP, T] },
  { id: "RAHKASUO", kind: "mire_drained", fi: "Rahkasuo", en: "Moss Bog", match: "Rahkasuo(?!.)|Rahkasuon|Rahkasuolla|Rahkasuolle|Rahkasuota|Moss Bog", sources: [TB, PL, PN, DEP, "tools/fire-ca/traffic-drones.ts"] },
  { id: "ISO_RAHKASUO", kind: "mire_open", fi: "Iso-Rahkasuo", en: "Great Moss Bog", match: "Iso-Rahkasu|Great Moss Bog", sources: [TB, PL, PN] },
  { id: "HONKAHARJU", kind: "terrain_name", fi: "Honkaharju", en: "Pine Ridge", match: "Honkaharj|Pine Ridge", sources: [PL, PN] },
  { id: "KORPILAAKSO", kind: "valley", fi: "Korpilaakso", en: "Fern Valley", match: "Korpilaak|Fern Valley", sources: [PL, PN] },
  { id: "POWER_LINE", kind: "power_line", fi: "20 kV:n sähkölinja", en: "20 kV power line", match: "20 kV|sähkölinj|voimajoh|power line", sources: [T, TF] }, // SPEC/33 (bc): 20 kV (was "110 kV voimajohto")
  { id: "LOG_LANDING", kind: "clearing", fi: "R2:n risteyksen puutavaran varastoalue", en: "the log landing at the R2 junction", match: "varastoalue|log landing", sources: ["tools/topo-map/build.ts", TF, "tools/fire-ca/traffic.ts", DEP] },
  ...(sortedEntries(SECTOR_WEDGES).map(([k, s]) => ({ id: `SECTOR_${k}`, kind: "sector", fi: s.fi, en: s.en, match: `\\b${k}\\b`, sources: ["tools/fire-ca/traffic-places.ts", "tools/fire-ca/site-export.ts"] }))),
  ...sortedKeys(FEATURES).map((k) => ({ id: `anchor.${k}`, kind: "anchor", fi: k, en: k, sources: [DEP] })),
];

export interface MapLabel { readonly text: string; readonly p: P; readonly style: string }
export type Polygons = readonly (readonly (readonly P[])[])[];
export interface FireStep { readonly truth: Polygons; readonly reported: Polygons }

export interface BuiltMap {
  /** Contract feature id → geometry. */
  readonly features: Record<string, Geom>;
  readonly labels: { readonly fi: readonly MapLabel[]; readonly en: readonly MapLabel[] };
  readonly bridges: readonly P[];
  readonly roads: readonly { readonly index: number; readonly cls: string; readonly line: readonly P[] }[];
  /** The fire as the bundle has it, by step number (0 = W5, 1–20); empty when no bundle is read. */
  readonly fire: ReadonlyMap<number, FireStep>;
  /** The truth fuel grid's cells (centres, site metres) by fuel id (`content/site/fuel_truth.asc`, legend in site.json). */
  readonly fuelCells: ReadonlyMap<string, readonly P[]>;
}

/** The truth fuel grid as cell centres per fuel id. */
function readFuelCells(): Map<string, P[]> {
  const site = readJson<{ truthFuel: string; legend: { code: number; fuelId: string }[] }>("content/site/site.json");
  const g = parseAsciiGrid(readFileSync(ROOT + "content/site/" + site.truthFuel, "utf8"));
  const legend = new Map(site.legend.map((l) => [l.code, l.fuelId]));
  const out = new Map<string, P[]>();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const id = legend.get(g.values[r * g.cols + c]!);
    if (!id) continue;
    const p = { x: g.xllcorner + (c + 0.5) * g.cellSize - IGN_TM35.eastM, y: g.yllcorner + (r + 0.5) * g.cellSize - IGN_TM35.northM };
    const list = out.get(id);
    if (list) list.push(p);
    else out.set(id, [p]);
  }
  return out;
}

interface TopoJson {
  size: number; metresPerPixel: number;
  water: [number, number][][]; ponds: [number, number][][]; clearings: [number, number][][];
  river: [number, number][][]; roads: { cls: string; pts: [number, number][] }[]; powerLine: [number, number][];
  bridges: [number, number][]; labels: { text: string; px: [number, number]; style: string }[]; labelsEn: { text: string; px: [number, number]; style: string }[];
  drainedBogs: [number, number][][]; openBogs: [number, number][][]; pineBogs: [number, number][][];
}

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(ROOT + rel, "utf8")) as T;

/** topo-features.json pixel → site metres (build.ts `toPx` inverted). */
function pxToSite(t: Pick<TopoJson, "size" | "metresPerPixel">): (px: readonly [number, number]) => P {
  const half = (t.size * t.metresPerPixel) / 2;
  return ([px, py]) => ({ x: px * t.metresPerPixel - half, y: half - py * t.metresPerPixel });
}

/** WGS84 → site metres through ETRS-TM35FIN (the bundle's coordinates). */
export const latLonToSite = (p: { readonly lat: number; readonly lon: number }): P => {
  const t = wgs84ToTm35(p);
  return { x: t.eastM - IGN_TM35.eastM, y: t.northM - IGN_TM35.northM };
};

interface Bundle { steps: { index: number; truthAtEnd: { lat: number; lon: number }[][]; truthDetached: { lat: number; lon: number }[][][]; reported: { lat: number; lon: number }[][]; reportedDetached: { lat: number; lon: number }[][][] }[] }

function readFire(): Map<number, FireStep> {
  const b = readJson<Bundle>(SITE_SCENARIO_PATH);
  const poly = (rings: { lat: number; lon: number }[][]) => rings.map((r) => r.map(latLonToSite));
  return new Map(b.steps.map((s) => [s.index, { truth: [poly(s.truthAtEnd), ...s.truthDetached.map(poly)], reported: [poly(s.reported), ...s.reportedDetached.map(poly)] }]));
}

/** The water polygon (largest ring) that contains `p`, or the nearest one's ring. */
function waterRingAt(rings: readonly (readonly P[])[], p: P): readonly P[] {
  const containing = rings.filter((r) => inRingLocal(p, r));
  if (containing.length > 0) return containing.reduce((a, r) => (r.length > a.length ? r : a));
  return rings.reduce((a, r) => (Math.min(...r.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) < Math.min(...a.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) ? r : a));
}
function inRingLocal(p: P, ring: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Reads the built map now on disk and in the modules. `withFire` (default true) also reads the fire from the bundle; the
 * fire is the CA's run on this map's grids, so after a rebuild it is current only once `npm run fire:ca` has re-run.
 */
export function loadBuiltMap(withFire = true): BuiltMap {
  const t = readJson<TopoJson>(TOPO_FEATURES_PATH);
  const s = pxToSite(t);
  const line = (pts: readonly [number, number][]) => pts.map(s);
  const roads = t.roads.map((r, index) => ({ index, cls: r.cls, line: line(r.pts) }));
  if (roads.length !== ROADS.length) throw new Error(`contract: topo-features.json has ${roads.length} roads, roads.ts ${ROADS.length}: rebuild the map (npm run map:build)`);
  const water = t.water.map(line);
  const pt = (p: P): Geom => ({ kind: "point", p });
  const ln = (pts: readonly P[]): Geom => ({ kind: "line", pts });
  const lake = (name: string): Geom => {
    const l = LAKES.find((x) => x.name === name);
    if (!l) throw new Error(`contract: no lake ${name} in terrain-base.ts`);
    return { kind: "polygon", rings: [waterRingAt(water, { x: l.cx, y: l.cy })] };
  };
  const brook = (name: string): Geom => {
    const b = BROOKS.find((x) => x.name === name);
    if (!b) throw new Error(`contract: no brook ${name} in terrain.ts`);
    return ln(b.line);
  };
  const road = (k: keyof typeof ROAD_INDEX): Geom => ln(roads[ROAD_INDEX[k]]!.line);
  const f: Record<string, Geom> = {
    IGN: pt({ x: 0, y: 0 }),
    CP: pt(COMMAND_POINT),
    R1: road("R1"), R2: road("R2"), R3_W: road("R3_W"), R3_E: road("R3_E"), MAANTIE_S: road("MAANTIE_S"), MAANTIE_N: road("MAANTIE_N"),
    KARHU_ROAD: road("KARHU_ROAD"), PEAT_ROAD: road("PEAT_ROAD"), HONKAHARJU_ROAD: road("HONKAHARJU_ROAD"),
    // Kotkanjoki whole, through the lakes on its course (topo-features.json draws only its runs outside them).
    KOTKANJOKI: ln(RIVER),
    BRIDGE: pt(BRIDGE), BRIDGE_S: pt(BRIDGE_S),
    KORPIOJA: brook("Korpioja"), KOIVUOJA: brook("Koivuoja"),
    KARHUJARVI: lake("Karhujärvi"), HAUKILAMPI: lake("Haukilampi"),
    W2_POND: { kind: "polygon", rings: t.ponds.map(line) },
    LAHDENKYLA: pt(VILLAGE),
    MOKKIRANTA: pt(FEATURES.CABINS),
    HIEKKALA: pt(HAMLET_S),
    KUIVAKANGAS: pt(ESKER_CENTRE),
    BIRCH: pt(polar(45, 2300)),
    POWER_LINE: ln(line(t.powerLine)),
    LOG_LANDING: { kind: "polygon", rings: t.clearings.map(line) },
  };
  for (const [k, w] of sortedEntries(SECTOR_WEDGES)) f[`SECTOR_${k}`] = { kind: "sector", fromDeg: w.fromDeg, toDeg: w.toDeg };
  for (const [k, p] of sortedEntries(FEATURES)) f[`anchor.${k}`] = pt(p);
  // Map-name points come from the labels where the module has no constant (Rahkasuo, Iso-Rahkasuo, Honkaharju, Korpilaakso,
  // Kuusimäki): places.ts puts those labels on the feature itself, so the built label is the built feature. A missing label
  // leaves the feature missing, which every relation on it reports.
  const labelsFi = t.labels.map((l) => ({ text: l.text, p: s(l.px), style: l.style }));
  const labelsEn = t.labelsEn.map((l) => ({ text: l.text, p: s(l.px), style: l.style }));
  for (const [id, name] of [["RAHKASUO", "Rahkasuo"], ["ISO_RAHKASUO", "Iso-Rahkasuo"], ["HONKAHARJU", "Honkaharju"], ["KORPILAAKSO", "Korpilaakso"], ["KUUSIMAKI", "Kuusimäki"]] as const) {
    const l = labelsFi.find((x) => x.text === name);
    if (l) f[id] = pt(l.p);
  }
  return {
    features: f,
    labels: { fi: labelsFi, en: labelsEn },
    bridges: t.bridges.map(s),
    roads,
    fire: withFire ? readFire() : new Map(),
    fuelCells: readFuelCells(),
  };
}

/** The mire polygons of the built map (drained, open, pine), for a feature's "lies on a mire" relation. */
export function mirePolygons(): { readonly drained: readonly (readonly P[])[]; readonly open: readonly (readonly P[])[]; readonly pine: readonly (readonly P[])[] } {
  const t = readJson<TopoJson>(TOPO_FEATURES_PATH);
  const s = pxToSite(t);
  return { drained: t.drainedBogs.map((r) => r.map(s)), open: t.openBogs.map((r) => r.map(s)), pine: t.pineBogs.map((r) => r.map(s)) };
}
