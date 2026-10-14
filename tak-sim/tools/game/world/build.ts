/**
 * Builds the game mode's world file (SPEC/29), `content/game/world.json`, from the generated site:
 *
 *   content/site/site.json                 grid files, legend, command point (TM35)
 *   content/site/elevation.asc             25 m elevation, 400 × 400, TM35 (xll 514000, yll 6741000)
 *   content/site/fuel_truth.asc            25 m fuel codes — the game's reality
 *   content/site/build/topo-features.json  the map's vectors in pixels of the 5000 px, 4 m/px basemap
 *   app/scenario/site-meta.json            that basemap's TM35 extent (px y grows southward)
 *
 * Output coordinates are local metres (x east, y north from the grid's south-west corner), rounded to 0.1 m. The
 * text is a pure function of the inputs: the same inputs give the same bytes (`test/game/world-build.spec.ts`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RoadClass } from "../../../app/game/contracts.js";
import { encodeBase64, ROAD_CLASSES, WORLD_FORMAT } from "../../../app/game/world/format.js";
import { parseAsciiGrid, type AsciiGrid } from "../../fire-ca/ascii-grid.js";
import { dist, r1, type Box, type Pt } from "./geom.js";
import { buildPlaces, clipPowerLine, type Building, type PlaceLabel } from "./places.js";
import { buildRoadGraph, reachableFrom, type BuiltRoadGraph } from "./road-graph.js";
import { buildWaterPoints, type WaterBody } from "./water.js";

/** Roads, water and buildings are kept this far beyond the grid: units arrive from outside the playable area. */
export const MARGIN_M = 1500;
/** Beyond the margin, the graph keeps only the shortest outside road joining a cut-off stretch to the network. */
export const LINK_MAX_M = 6000;
/** The directive protects these two; they must come out as settlements. */
export const REQUIRED_SETTLEMENTS = ["Lahdenkylä", "Mökkiranta"] as const;

type PxPt = readonly [number, number];
interface TopoFeatures {
  readonly size: number;
  readonly metresPerPixel: number;
  readonly water: readonly (readonly PxPt[])[];
  readonly ponds: readonly (readonly PxPt[])[];
  readonly river: readonly (readonly PxPt[])[];
  readonly brooks: readonly (readonly PxPt[])[];
  readonly roads: readonly { readonly cls: string; readonly pts: readonly PxPt[] }[];
  readonly powerLine: readonly PxPt[];
  readonly buildings: readonly { readonly px: PxPt; readonly kind: string }[];
  readonly labels: readonly { readonly text: string; readonly px: PxPt; readonly style: string }[];
  readonly labelsEn: readonly { readonly text: string; readonly px: PxPt; readonly style: string }[];
}
interface SiteMeta { readonly metresPerPixel: number; readonly sizePx: number; readonly tm35: { readonly west: number; readonly north: number } }
interface SiteJson {
  readonly commandPointTm35: { readonly eastM: number; readonly northM: number };
  readonly truthFuel: string;
  readonly elevation: string;
}

export interface WorldBuildStats {
  readonly bytes: number;
  readonly nodes: number;
  readonly edges: number;
  readonly edgesByClass: readonly (readonly [RoadClass, number])[];
  readonly roadGraph: BuiltRoadGraph["stats"];
  readonly waterPoints: number;
  readonly waterWithRoad: number;
  readonly assets: number;
  readonly settlements: readonly string[];
  readonly entryNodes: number;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

function polygonArea(ring: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]!.x + ring[i]!.x) * (ring[j]!.y - ring[i]!.y);
  return Math.abs(a) / 2;
}

/** The world file's text, and what went into it. `root` is the `tak-sim/` folder. */
export function buildWorldJson(root: string): { text: string; stats: WorldBuildStats } {
  const site = readJson<SiteJson>(join(root, "content/site/site.json"));
  const meta = readJson<SiteMeta>(join(root, "app/scenario/site-meta.json"));
  const topo = readJson<TopoFeatures>(join(root, "content/site/build/topo-features.json"));
  const fuelGrid = parseAsciiGrid(readFileSync(join(root, "content/site", site.truthFuel), "utf8"));
  const elevGrid = parseAsciiGrid(readFileSync(join(root, "content/site", site.elevation), "utf8"));
  const same = (g: AsciiGrid) => g.cols === fuelGrid.cols && g.rows === fuelGrid.rows && g.cellSize === fuelGrid.cellSize && g.xllcorner === fuelGrid.xllcorner && g.yllcorner === fuelGrid.yllcorner;
  if (!same(elevGrid)) throw new Error("elevation and fuel grids differ in extent");
  if (topo.size !== meta.sizePx || topo.metresPerPixel !== meta.metresPerPixel) throw new Error("topo-features.json and site-meta.json disagree on the basemap");

  const grid = { cols: fuelGrid.cols, rows: fuelGrid.rows, cellM: fuelGrid.cellSize, originTm35: { east: fuelGrid.xllcorner, north: fuelGrid.yllcorner } };
  const W = grid.cols * grid.cellM;
  const H = grid.rows * grid.cellM;
  const box: Box = { x0: -MARGIN_M, y0: -MARGIN_M, x1: W + MARGIN_M, y1: H + MARGIN_M };
  const playable: Box = { x0: 0, y0: 0, x1: W, y1: H };

  // Basemap pixels → local metres: px x from the map's west edge, px y down from its north edge.
  const mpp = meta.metresPerPixel;
  const fromPx = (p: PxPt): Pt => ({ x: meta.tm35.west + p[0] * mpp - grid.originTm35.east, y: meta.tm35.north - p[1] * mpp - grid.originTm35.north });
  const fromPxLine = (line: readonly PxPt[]) => line.map(fromPx);

  // Rasters, row 0 north (parseAsciiGrid keeps row 0 south).
  const n = grid.cols * grid.rows;
  const elevBytes = new Uint8Array(2 * n);
  const elevView = new DataView(elevBytes.buffer);
  const fuel = new Uint8Array(n);
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const src = (grid.rows - 1 - row) * grid.cols + col;
      const e = elevGrid.values[src]!;
      const f = fuelGrid.values[src]!;
      if (e === elevGrid.nodata || f === fuelGrid.nodata) throw new Error(`NODATA at row ${row} col ${col}`);
      const dm = Math.round(e * 10);
      if (dm < -32768 || dm > 32767) throw new Error(`elevation ${e} m out of Int16 decimetres`);
      if (!Number.isInteger(f) || f < 0 || f > 255) throw new Error(`fuel code ${f} is not a byte`);
      elevView.setInt16(2 * (row * grid.cols + col), dm, true);
      fuel[row * grid.cols + col] = f;
    }
  }

  // Roads.
  const roadLines = topo.roads.map((r) => {
    if (!(ROAD_CLASSES as readonly string[]).includes(r.cls)) throw new Error(`unknown road class ${r.cls}`);
    return { cls: r.cls as RoadClass, pts: fromPxLine(r.pts) };
  });
  const mapBox: Box = {
    x0: meta.tm35.west - grid.originTm35.east - 100, y0: meta.tm35.north - meta.sizePx * mpp - grid.originTm35.north - 100,
    x1: meta.tm35.west + meta.sizePx * mpp - grid.originTm35.east + 100, y1: meta.tm35.north - grid.originTm35.north + 100,
  };
  const cp: Pt = { x: site.commandPointTm35.eastM - grid.originTm35.east, y: site.commandPointTm35.northM - grid.originTm35.north };
  const roads = buildRoadGraph(roadLines, {
    outer: mapBox, keep: box, anchor: cp, maxLinkM: LINK_MAX_M, playable,
    simplifyM: 5, mergeM: 5, snapM: 10, connectM: 60, maxEdgeM: 100,
  });
  const nodesOut = roads.nodes.map((p) => ({ x: r1(p.x), y: r1(p.y) }));
  // The network the command post is on (the south of the map; the north's forest roads leave from a main road that
  // joins it only beyond the map's edge).
  let cpNode = 0;
  roads.nodes.forEach((p, i) => { if (dist(p, cp) < dist(roads.nodes[cpNode]!, cp)) cpNode = i; });
  const reachable = reachableFrom(roads.nodes.length, roads.edges, cpNode);

  // Entry nodes: where main, then gravel, roads cross the playable edge; one per 500 m of edge.
  const entries: number[] = [];
  const rank = (c: RoadClass) => ROAD_CLASSES.indexOf(c);
  for (const c of [...roads.edgeCrossings].sort((p, q) => rank(p.cls) - rank(q.cls) || p.node - q.node)) {
    if (entries.length >= 6) break;
    if (!reachable[c.node] || entries.some((e) => dist(nodesOut[e]!, nodesOut[c.node]!) < 500)) continue;
    entries.push(c.node);
  }
  if (entries.length < 3) throw new Error(`only ${entries.length} entry nodes on the playable area's edge`);

  // Labels (Finnish and English are the same places at the same points).
  if (topo.labels.length !== topo.labelsEn.length) throw new Error("labels and labelsEn differ in length");
  const labels: PlaceLabel[] = topo.labels.map((l, i) => {
    const en = topo.labelsEn[i]!;
    if (en.px[0] !== l.px[0] || en.px[1] !== l.px[1] || en.style !== l.style) throw new Error(`label ${l.text}: English label at another point`);
    return { fi: l.text, en: en.text, at: fromPx(l.px), style: l.style };
  });
  const inBoxLabel = (l: PlaceLabel) => l.at.x >= box.x0 && l.at.x <= box.x1 && l.at.y >= box.y0 && l.at.y <= box.y1;

  // Water.
  const bodies: WaterBody[] = [
    ...topo.water.map((ring): WaterBody => {
      const pts = fromPxLine(ring);
      return { kind: polygonArea(pts) < 50_000 ? "pond" : "lake", ring: pts };
    }),
    ...topo.ponds.map((ring): WaterBody => ({ kind: "pond", ring: fromPxLine(ring) })),
    ...topo.river.map((line): WaterBody => ({ kind: "river", line: fromPxLine(line) })),
    ...topo.brooks.map((line): WaterBody => ({ kind: "brook", line: fromPxLine(line) })),
  ];
  const waterLabels = labels.filter((l) => l.style === "water");
  const water = buildWaterPoints(bodies, waterLabels, { nodes: roads.nodes, edges: roads.edges, reachable }, { box, reachM: 150, riverBankM: 12, minApartM: 300 });

  // Assets and settlements.
  const buildings: Building[] = topo.buildings.map((b) => ({ at: fromPx(b.px), kind: b.kind === "house" ? "house" : "other" }));
  const powerLineLocal = fromPxLine(topo.powerLine);
  const places = buildPlaces(buildings, powerLineLocal, labels, {
    box, clusterM: 400, nameM: 800, requiredNameM: 2000, minUnnamed: 3, pylonSpacingM: 300,
    settlementStyles: ["village", "place"], required: REQUIRED_SETTLEMENTS,
  });
  if (places.missingRequired.length > 0) throw new Error(`no settlement for required label(s): ${places.missingRequired.join(", ")}`);
  const powerLine = clipPowerLine(powerLineLocal, box);

  const pair = (p: Pt): [number, number] => [r1(p.x), r1(p.y)];
  const entriesOut: [string, unknown][] = [
    ["format", WORLD_FORMAT],
    ["generatedBy", "npm run game:world (tools/game/build-world.ts) from content/site and topo-features.json"],
    ["grid", grid],
    ["elevationDm", encodeBase64(elevBytes)],
    ["fuel", encodeBase64(fuel)],
    ["roads", {
      classes: ROAD_CLASSES,
      nodes: nodesOut.flatMap((p) => [p.x, p.y]),
      edges: roads.edges.flatMap((e) => [e.a, e.b, rank(e.cls)]),
    }],
    ["waterPoints", water.map((w) => ({ id: w.id, nameFi: w.nameFi, nameEn: w.nameEn, kind: w.kind, at: pair(w.at), roadNode: w.roadNode, scoop: pair(w.scoop) }))],
    ["assets", places.assets.map((a) => ({ id: a.id, kind: a.kind, at: pair(a.at), value: a.value, settlementId: a.settlementId }))],
    ["settlements", places.settlements.map((s) => ({ id: s.id, nameFi: s.nameFi, nameEn: s.nameEn, centre: pair(s.centre), assetIds: s.assetIds }))],
    ["powerLine", powerLine.flatMap((p) => pair(p))],
    ["labels", labels.filter(inBoxLabel).map((l) => ({ fi: l.fi, en: l.en, at: pair(l.at), style: l.style }))],
    ["commandPost", pair(cp)],
    ["entryNodes", entries],
  ];
  // One top-level key per line; lists of records one record per line (readable diffs).
  const value = (v: unknown) => (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" ? `[\n${v.map((x) => JSON.stringify(x)).join(",\n")}\n]` : JSON.stringify(v));
  const text = `{\n${entriesOut.map(([k, v]) => `${JSON.stringify(k)}:${value(v)}`).join(",\n")}\n}\n`;

  const byClass = ROAD_CLASSES.map((c) => [c, roads.edges.filter((e) => e.cls === c).length] as const);
  return {
    text,
    stats: {
      bytes: Buffer.byteLength(text, "utf8"),
      nodes: roads.nodes.length,
      edges: roads.edges.length,
      edgesByClass: byClass,
      roadGraph: roads.stats,
      waterPoints: water.length,
      waterWithRoad: water.filter((w) => w.roadNode !== null).length,
      assets: places.assets.length,
      settlements: places.settlements.map((s) => `${s.nameFi} (${s.assetIds.length})`),
      entryNodes: entries.length,
    },
  };
}
