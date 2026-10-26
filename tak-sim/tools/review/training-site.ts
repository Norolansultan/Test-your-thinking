/**
 * The training incident's area as the build sees it (SPEC/08 (bp) §§bp.1–bp.2): the basemap's north-east corner, site x and y
 * 7 500–10 000 m (basemap pixels x 4 375–5 000, y 0–625; 4 m each), its terrain predicates, and its roads cut at the 400 m band
 * around the contract's 20 kV line. Pure: the same site data give the same site.
 *
 * Roads: the drivable ones (main, gravel and forest roads; tracks are not) clipped to the area (`uncut`, what the participant sees),
 * then cut at the band (`pieces`, what any task, route or label may use). R5 is the longest main-road run; R6 is the one long forest
 * road (≥ 1.6 km) that joins R5 outside the band; R7 is the longest other run of 800 m or more, joined to nothing (its junction with
 * R5 lies inside the band). Every rule that fails throws: the rule, not a mark, is what changes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearOf, contourError, dist, ElevationGrid, inside, keptRuns, levelSegments, lineDist, pathLength, polygonDist, RoadGraph, toPx, type LevelSegment, type Px, type Ring } from "./map-training-geometry.js";
import { powerLinePx, type Contract } from "./training-contract.js";

export interface TopoFeatures {
  readonly size: number;
  readonly metresPerPixel: number;
  readonly elevationGrid: { readonly size: number; readonly values: readonly number[] };
  readonly water: readonly Ring[];
  readonly fields: readonly Ring[];
  readonly mireFill: readonly Ring[];
  readonly contours: readonly { readonly level: number; readonly pts: Ring }[];
  readonly roads: readonly { readonly cls: string; readonly pts: Ring }[];
  readonly powerLine: Ring;
  readonly labels: readonly { readonly text: string; readonly px: readonly [number, number] }[];
}

export function readTopoFeatures(root: string): TopoFeatures {
  return JSON.parse(readFileSync(join(root, "content/site/build/topo-features.json"), "utf8")) as TopoFeatures;
}

/** The area in basemap pixels, the tile that holds it, and the live map's lock margin. */
export const AREA = { x0: 4375, y0: 0, size: 625, tile: "0_3", tileX0: 625, tileY0: 0, tilePx: 1250, lockMarginM: 100 } as const;
/** No coordinate of the training lies within this distance of the 20 kV line (the rule is about 300 m; 100 m is the margin). */
export const BAND_M = 400;
const DRIVABLE = new Set(["main", "gravel", "forest"]);

export interface Piece { readonly id: string; readonly cls: string; readonly pts: readonly Px[] }
export interface NamedRoad { readonly code: "R5" | "R6" | "R7"; readonly piece: Piece }

export interface Site {
  readonly mpp: number;
  readonly grid: ElevationGrid;
  readonly segs: readonly LevelSegment[];
  /** The 20 kV line in pixels (the contract's), and a point's distance from it in metres. */
  readonly line: Ring;
  lineM(p: Px): number;
  /** ≥ 400 m from the line. */
  clear(p: Px): boolean;
  inArea(p: Px, marginPx?: number): boolean;
  /** Distance to the area's nearest edge, px (negative outside). */
  edgePx(p: Px): number;
  waters: readonly Ring[];
  waterDist(p: Px): number;
  inField(p: Px): boolean;
  inMire(p: Px): boolean;
  /** Not on or within `waterPx` of water, not in a field or a mire. */
  forest(p: Px, waterPx: number): boolean;
  /** Every road and track (any class), clipped to the area plus 50 px: what "no road or track within 100 m" reads. */
  readonly anyRoads: readonly Piece[];
  /** The drivable roads clipped to the area (as drawn), and the same cut at the band (what tasks may use). */
  readonly uncut: readonly Piece[];
  readonly pieces: readonly Piece[];
  readonly named: readonly NamedRoad[];
  road(code: NamedRoad["code"]): Piece;
  /** Where a drivable road's end meets another drivable road, on the drawn network (band included). */
  readonly junctions: readonly Px[];
  /** The R5/R6 junction (R6's end on R5). */
  readonly r5r6: Px;
  /** Shortest paths over the cut network, and over the drawn one. */
  readonly graph: RoadGraph;
  readonly drawnGraph: RoadGraph;
  /** Kaitajärvi's printed label. */
  readonly lakeLabel: Px;
}

export function buildSite(f: TopoFeatures, contract: Contract): Site {
  if (f.size !== 5000 || f.metresPerPixel !== 4) throw new Error("training: the basemap is not the 5000 px, 4 m one");
  const mpp = f.metresPerPixel;
  const x1 = AREA.x0 + AREA.size, y1 = AREA.y0 + AREA.size;
  const inArea = (p: Px, m = 0) => p.x >= AREA.x0 + m && p.x <= x1 - m && p.y >= AREA.y0 + m && p.y <= y1 - m;
  const edgePx = (p: Px) => Math.min(p.x - AREA.x0, x1 - p.x, p.y - AREA.y0, y1 - p.y);

  // The line: the contract's, checked against the basemap's own drawing of it.
  const line = powerLinePx(contract);
  const drawnOff = Math.max(...f.powerLine.map((q) => lineDist(toPx(q), line)));
  if (drawnOff > 2) throw new Error(`training: the basemap's power line is ${drawnOff.toFixed(1)} px off the contract's`);
  const lineM = (p: Px) => lineDist(p, line) * mpp;
  const clear = clearOf(line, BAND_M / mpp);

  const grid = new ElevationGrid(f.elevationGrid.size, f.elevationGrid.values, f.size);
  const contourErr = contourError(grid, f.contours, (p) => inArea(p, -200));
  if (contourErr > 1.5) throw new Error(`training: the elevation grid disagrees with the contours (median ${contourErr.toFixed(2)} m)`);
  const label = f.labels.find((l) => l.text === "Kaitajärvi");
  if (!label || !inArea(toPx(label.px))) throw new Error("training: no Kaitajärvi label in the area (not the north-east corner)");

  const memo = <T>(fn: (p: Px) => T) => { const cache = new Map<string, T>(); return (p: Px): T => { const k = `${p.x.toFixed(2)},${p.y.toFixed(2)}`; let v = cache.get(k); if (v === undefined) { v = fn(p); cache.set(k, v); } return v; }; };
  /** The polygons whose bounding box meets the area grown by `m` px (a polygon can hold the area's points with no vertex inside). */
  const near = (rs: readonly Ring[], m: number) => rs.filter((r) => Math.min(...r.map((q) => q[0])) <= x1 + m && Math.max(...r.map((q) => q[0])) >= AREA.x0 - m &&
    Math.min(...r.map((q) => q[1])) <= y1 + m && Math.max(...r.map((q) => q[1])) >= AREA.y0 - m);
  const waters = near(f.water, 50), fields = near(f.fields, 0), mires = near(f.mireFill, 0);
  const waterDist = memo((p: Px) => Math.min(...waters.map((w) => polygonDist(p, w))));
  const inField = memo((p: Px) => fields.some((r) => inside(p, r)));
  const inMire = memo((p: Px) => mires.some((r) => inside(p, r)));
  const forest = (p: Px, waterPx: number) => waterDist(p) >= waterPx && !inField(p) && !inMire(p);
  const contours = f.contours.filter((c) => c.pts.some((q) => inArea(toPx(q), -20)));

  const runsOf = (keep: (p: Px) => boolean, classes: ((cls: string) => boolean)) => {
    const out: Piece[] = [];
    f.roads.forEach((r, i) => {
      if (!classes(r.cls)) return;
      for (const run of keptRuns(r.pts.map(toPx), keep)) out.push({ id: `road${i}.${out.length}`, cls: r.cls, pts: run });
    });
    return out;
  };
  const anyRoads = runsOf((p) => inArea(p, -50), () => true);
  const uncut = runsOf((p) => inArea(p), (c) => DRIVABLE.has(c));
  const pieces = runsOf((p) => inArea(p) && clear(p), (c) => DRIVABLE.has(c));

  const mains = pieces.filter((p) => p.cls === "main").sort((a, b) => (pathLength(b.pts) - pathLength(a.pts)) || (a.id < b.id ? -1 : 1));
  const r5 = mains[0];
  if (!r5) throw new Error("training: no main road outside the band");
  const r5Ring = r5.pts.map((p) => [p.x, p.y] as const);
  const joins = pieces.filter((p) => p !== r5).map((p) => {
    const ends = [p.pts[0]!, p.pts.at(-1)!].map((e) => ({ e, d: lineDist(e, r5Ring) })).sort((a, b) => a.d - b.d);
    return { piece: p, junction: ends[0]!.e, gap: ends[0]!.d, length: pathLength(p.pts) };
  }).filter((j) => j.gap <= 4);
  const long = joins.filter((j) => j.length * mpp >= 1600);
  if (long.length !== 1) throw new Error(`training: expected one long forest road (≥ 1.6 km) joining R5 outside the band, found ${long.length}`);
  const r6 = long[0]!.piece;
  const others = pieces.filter((p) => p !== r5 && p !== r6 && !joins.some((j) => j.piece === p) && pathLength(p.pts) * mpp >= 800)
    .sort((a, b) => (pathLength(b.pts) - pathLength(a.pts)) || (a.id < b.id ? -1 : 1));
  if (others.length !== 1) throw new Error(`training: expected one other run of 800 m or more (R7's north run), found ${others.length}`);
  const named: NamedRoad[] = [{ code: "R5", piece: r5 }, { code: "R6", piece: r6 }, { code: "R7", piece: others[0]! }];

  // Junctions on the drawn network: a drivable road's end on another drivable road (the basemap draws a junction as one road ending
  // on another), the same place found twice kept once.
  const junctions: Px[] = [];
  for (const a of uncut) for (const e of [a.pts[0]!, a.pts.at(-1)!]) {
    if (!inArea(e, 1)) continue;
    if (!uncut.some((b) => b !== a && lineDist(e, b.pts.map((q) => [q.x, q.y] as const)) <= 4)) continue;
    if (junctions.every((j) => dist(j, e) > 8)) junctions.push(e);
  }
  junctions.sort((a, b) => (a.x - b.x) || (a.y - b.y));

  return {
    mpp, grid, segs: levelSegments(contours), line, lineM, clear, inArea, edgePx, waters, waterDist, inField, inMire, forest,
    anyRoads, uncut, pieces, named,
    road: (code) => named.find((n) => n.code === code)!.piece,
    junctions, r5r6: long[0]!.junction,
    graph: new RoadGraph(pieces.map((p) => ({ id: p.id, pts: [...p.pts] }))),
    drawnGraph: new RoadGraph(uncut.map((p) => ({ id: p.id, pts: [...p.pts] }))),
    lakeLabel: toPx(label.px),
  };
}

/** Site metres (x east, y north from the point of origin; ETRS-TM35FIN 519 000 E, 6 746 000 N) of a basemap pixel, and back. */
export const siteOf = (p: Px): { readonly x: number; readonly y: number } => ({ x: -10_000 + p.x * 4, y: 10_000 - p.y * 4 });
export const pxOfSite = (x: number, y: number): Px => ({ x: (x + 10_000) / 4, y: (10_000 - y) / 4 });
