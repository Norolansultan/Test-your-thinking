/**
 * `map:check` road part (SPEC/33 §2.3 Roads, §5 gate A) on the built map:
 *
 *   water      a road crosses Kotkanjoki only at a drawn bridge and a brook only at a bridge or culvert (within 30 m), and never runs
 *              into a lake;
 *   mire       no road runs more than MAX_MIRE_RUN_M across mire in one stretch (a causeway is short; a main road's embankment
 *              MAX_MIRE_RUN_MAIN_M), and no road longer than
 *              500 m lies more than MAX_MIRE_SHARE on mire;
 *   network    every road is connected to the network (a road graph joining lines within 25 m);
 *   rectangles no face of the road network (a region every road walls in) is a closed rectangle: rectangularity (area over the
 *              minimum bounding rectangle) ≥ 0.85 together with convexity ≥ 0.95.
 */

import { fileURLToPath } from "node:url";
import {
  dist, hull, lineLength, loadLayers, minRectArea, ringArea, RingIndex, SegmentIndex, type BuiltLayers, type CheckResult, type P,
} from "./built-layers.js";
import { printResult } from "./hydro.js";

export const MAX_MIRE_RUN_M = 450;
/** A main road crosses a wide mire on an embankment: its limit is longer (planning value, SPEC/33 §1 c). */
export const MAX_MIRE_RUN_MAIN_M = 650;
export const MAX_MIRE_SHARE = 0.35;
const HALF = 10_000;

function resample(line: readonly P[], step: number): P[] {
  const out: P[] = [line[0]!];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let s = 1; s <= n; s++) out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
  }
  return out;
}

/** Faces of the road network on a 20 m raster: regions of non-road cells that do not reach the sheet edge. */
export function networkFaces(roads: readonly (readonly P[])[], cell = 20): P[][] {
  const n = Math.round((2 * HALF) / cell);
  const wall = new Uint8Array(n * n);
  for (const l of roads) for (const p of resample(l, cell / 3)) {
    const c = Math.floor((p.x + HALF) / cell);
    const r = Math.floor((p.y + HALF) / cell);
    if (c >= 0 && r >= 0 && c < n && r < n) wall[r * n + c] = 1;
  }
  const seen = new Uint8Array(n * n);
  const faces: P[][] = [];
  for (let s = 0; s < n * n; s++) {
    if (wall[s] || seen[s]) continue;
    const stack = [s];
    const cells: number[] = [];
    let edge = false;
    seen[s] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      cells.push(i);
      const r = Math.floor(i / n);
      const c = i % n;
      if (r === 0 || c === 0 || r === n - 1 || c === n - 1) edge = true;
      for (const j of [c > 0 ? i - 1 : -1, c + 1 < n ? i + 1 : -1, r > 0 ? i - n : -1, r + 1 < n ? i + n : -1]) if (j >= 0 && !wall[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    if (!edge && cells.length >= 25) faces.push(cells.map((i) => ({ x: -HALF + ((i % n) + 0.5) * cell, y: -HALF + (Math.floor(i / n) + 0.5) * cell })));
  }
  return faces;
}

export function checkRoads(layers: BuiltLayers = loadLayers()): CheckResult {
  const violations: string[] = [];
  const roads = layers.roads;
  // Water crossings.
  const riverIdx = new SegmentIndex(layers.river);
  const brookIdx = new SegmentIndex(layers.brooks);
  const lakes = new RingIndex(layers.water);
  let riverX = 0, brookX = 0, unbridged = 0, intoLake = 0;
  for (const r of roads) {
    for (let k = 0; k + 1 < r.line.length; k++) {
      const a = r.line[k]!;
      const b = r.line[k + 1]!;
      for (const h of riverIdx.crossings(a, b)) {
        riverX++;
        if (!layers.bridges.some((q) => dist(q, h.p) < 30)) { unbridged++; violations.push(`${r.cls} road crosses Kotkanjoki without a bridge at (${Math.round(h.p.x)},${Math.round(h.p.y)})`); }
      }
      for (const h of brookIdx.crossings(a, b)) {
        brookX++;
        if (!layers.culverts.some((q) => dist(q, h.p) < 30) && !layers.bridges.some((q) => dist(q, h.p) < 30)) { unbridged++; if (unbridged <= 15) violations.push(`${r.cls} road crosses a brook without a culvert at (${Math.round(h.p.x)},${Math.round(h.p.y)})`); }
      }
    }
    const inLake = resample(r.line, 20).slice(1, -1).filter((p) => lakes.contains(p));
    if (inLake.length > 0) { intoLake++; violations.push(`${r.cls} road${r.id ? ` ${r.id}` : ""} runs into a lake at (${Math.round(inLake[0]!.x)},${Math.round(inLake[0]!.y)})`); }
  }
  // Mire runs and shares.
  const mireRings = new RingIndex([...layers.mires.open, ...layers.mires.pine, ...layers.mires.drained]);
  const firm = new RingIndex(layers.mires.islands);
  const mires = { contains: (p: P) => mireRings.contains(p) && !firm.contains(p) };
  let worstRun = { m: 0, at: { x: 0, y: 0 } as P, cls: "" };
  let worstShare = { s: 0, cls: "", id: "" };
  let overRun = 0;
  for (const r of roads) {
    const pts = resample(r.line, 10);
    let run = 0;
    let onMire = 0;
    for (let k = 1; k < pts.length; k++) {
      const m = mires.contains(pts[k]!);
      const step = dist(pts[k]!, pts[k - 1]!);
      if (m) { run += step; onMire += step; } else run = 0;
      if (run > worstRun.m) worstRun = { m: run, at: pts[k]!, cls: r.cls };
      const limit = r.cls === "main" ? MAX_MIRE_RUN_MAIN_M : MAX_MIRE_RUN_M;
      if (run > limit && run - step <= limit) { overRun++; violations.push(`${r.cls} road${r.id ? ` ${r.id}` : ""} runs ${limit}+ m across mire near (${Math.round(pts[k]!.x)},${Math.round(pts[k]!.y)})`); }
    }
    const len = lineLength(r.line);
    const share = len > 0 ? onMire / len : 0;
    if (len > 500 && share > worstShare.s) worstShare = { s: share, cls: r.cls, id: r.id ?? "" };
    if (len > 500 && share > MAX_MIRE_SHARE) violations.push(`${r.cls} road${r.id ? ` ${r.id}` : ""} lies ${Math.round(share * 100)} % on mire`);
  }
  // Connectivity: union-find over roads whose lines come within 25 m of each other.
  const parent = roads.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const grid = new Map<string, number[]>();
  roads.forEach((r, id) => {
    for (const p of resample(r.line, 15)) {
      const key = `${Math.floor(p.x / 25)},${Math.floor(p.y / 25)}`;
      const list = grid.get(key) ?? grid.set(key, []).get(key)!;
      if (list[list.length - 1] !== id) list.push(id);
    }
  });
  for (const [key, ids] of grid) {
    const [bx, by] = key.split(",").map(Number) as [number, number];
    const near = new Set<number>(ids);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(`${bx + dx},${by + dy}`) ?? []) near.add(j);
    const first = ids[0]!;
    for (const j of near) parent[find(j)] = find(first);
  }
  const comps = new Map<number, number>();
  roads.forEach((_, i) => comps.set(find(i), (comps.get(find(i)) ?? 0) + 1));
  const main = find(0);
  const detached = roads.map((r, i) => ({ r, i })).filter(({ i }) => find(i) !== main);
  for (const { r, i } of detached.slice(0, 10)) violations.push(`${r.cls} road #${i} is not connected to the network (starts at (${Math.round(r.line[0]!.x)},${Math.round(r.line[0]!.y)}))`);
  // Closed rectangles.
  const faces = networkFaces(roads.map((r) => r.line));
  let rectangles = 0;
  let mostRect = 0;
  for (const f of faces) {
    const area = f.length * 400;
    const rect = minRectArea(f);
    const rectangularity = rect > 0 ? Math.min(1, area / rect) : 0;
    const convexity = Math.min(1, area / Math.max(1, ringArea(hull(f))));
    mostRect = Math.max(mostRect, rectangularity);
    if (rectangularity >= 0.85 && convexity >= 0.95) { rectangles++; violations.push(`road network encloses a near-rectangular block of ${(area / 10_000).toFixed(0)} ha (rectangularity ${rectangularity.toFixed(2)}) near (${Math.round(f[0]!.x)},${Math.round(f[0]!.y)})`); }
  }
  return {
    name: "road",
    violations,
    report: [
      ["roads", `${roads.length} (${Math.round(roads.reduce((s, r) => s + lineLength(r.line), 0) / 1000)} km)`],
      ["river / brook crossings", `${riverX} / ${brookX}; without bridge or culvert ${unbridged}; into a lake ${intoLake}`],
      ["longest mire run", `${Math.round(worstRun.m)} m (${worstRun.cls} near (${Math.round(worstRun.at.x)},${Math.round(worstRun.at.y)})); limit ${MAX_MIRE_RUN_M} m (main ${MAX_MIRE_RUN_MAIN_M} m); over it ${overRun}`],
      ["highest mire share (roads > 500 m)", `${Math.round(worstShare.s * 100)} % (${worstShare.cls}${worstShare.id ? ` ${worstShare.id}` : ""}); limit ${MAX_MIRE_SHARE * 100} %`],
      ["network components", `${comps.size} (${detached.length} roads detached)`],
      ["network faces / near-rectangles", `${faces.length} / ${rectangles} (most rectangular ${mostRect.toFixed(2)})`],
    ],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = checkRoads();
  printResult(r);
  if (r.violations.length > 0) process.exitCode = 1;
}
