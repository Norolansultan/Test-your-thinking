/**
 * Hydrography of the generated site (SPEC/33 §4 stage 2), on terrain-base.ts's ground:
 *
 *   A. Priority-Flood the base DEM; its deep hollows are lakes (the named bowls, and any hollow ≥ 3 m deep and ≥ 2 ha away from
 *      the fire's ground), each at its spill level with its outlet at the lowest shore; every other hollow is filled flat (peat or
 *      sand fills it: soil.ts makes the wet ones mires).
 *   B. Kotkanjoki is traced as a least-cost path through its valley floor, pinned straight through the R3 bridge, then given
 *      meanders that grow on flat ground; Myllyoja (through Karhujärvi) and Koivuoja likewise in their valleys. Each gets a monotone
 *      water surface and is carved in as a shallow channel (no canyon: the valley is the base DEM's, the carve is a channel).
 *   C. Re-flood; D8 on the ε-filled surface and flow accumulation; brooks are where the catchment passes ~1 km² (more on sand,
 *      which swallows the runoff), and every lake ≥ 2 ha gets its outlet stream; these are carved in as well.
 *   D. A final flood: the DEM has no sink but the lakes.
 */

import {
  BASE, BIG_LAKE, bigLakeIsland, bigLakeShore, BASINS, basinInside, BRIDGE, KOIVU_VALLEY, KORPI_VALLEY, RIVER_VALLEY, lineField,
  cellOf, cellX, cellY, distToPolyline, fbm, G, GN, HALF_M, resample, sampleGrid, type P,
} from "./terrain-base.js";
import { accumulate, d8Receivers, depressions, flowPath, priorityFlood, topoOrder, type Depression } from "./hydrology.js";
import { brookProfile, carve, cellPoint, cellsToLine, channelSurface, enforceMonotone, leastCostPath, markLine, naturalise, rillProfile, riverProfile, throughPin } from "./channels.js";

export const RIVER_NAME = "Kotkanjoki";
const LAKE_NAMES = ["Mustajärvi", "Pitkäjärvi", "Ahvenlampi", "Valkealampi", "Kaitajärvi", "Särkijärvi", "Pirttilampi", "Kivijärvi", "Ruokolampi", "Heinäjärvi", "Kuikkalampi", "Hauklampi"];
/** Catchment (cells of 400 m²) at which a brook starts on moraine; ×(1 + 3·sand) on sand. */
const BROOK_CELLS = 2600;
/** No lake is generated this close to IGN (the fire's ground stays forest, SPEC/23 H6); the named ponds are designed. */
const NO_LAKE_M = 3800;

export interface Lake {
  readonly id: number; readonly name: string;
  /** A point inside the lake (the one farthest from its shore) and the radius of a disc of its area. */
  readonly cx: number; readonly cy: number; readonly r: number;
  readonly level: number; readonly areaHa: number;
  readonly big?: boolean;
  /** Where its water leaves (the first cell outside it), or null for the big lake, which drains off the sheet. */
  readonly outlet: P | null;
}

// ---------------------------------------------------------------------------
// A. Lakes in the base DEM's hollows
// ---------------------------------------------------------------------------

/** Spatially correlated 0–1 noise for the flood's ε: drainage across flats wanders (hydrology.ts priorityFlood). */
const JITTER = new Float32Array(GN * GN);
for (let i = 0; i < GN * GN; i++) JITTER[i] = 0.5 + 0.5 * fbm(cellX(i % GN) / 140, cellY(Math.floor(i / GN)) / 140, 3, 977);
const BIG = new Uint8Array(GN * GN);
for (let i = 0; i < GN * GN; i++) { const x = cellX(i % GN); const y = cellY(Math.floor(i / GN)); if (x > 4000 && y < -4000 && bigLakeShore(x, y) < 0 && bigLakeIsland(x, y) <= 0) BIG[i] = 1; }

interface LakeSeed { readonly name: string; readonly bottom: number }

function pickLakes(list: readonly Depression[]): LakeSeed[] {
  const out: LakeSeed[] = [];
  for (const d of list) {
    if (BIG[d.bottom]) continue;
    const p = cellPoint(d.bottom);
    const basin = BASINS.find((b) => basinInside(b, p.x, p.y) < 0);
    if (basin?.kind === "mire") continue;
    if (basin?.kind === "lake") { if (!out.some((o) => o.name === basin.name)) out.push({ name: basin.name, bottom: d.bottom }); continue; }
    if (d.maxDepth >= 3 && d.cells >= 50 && Math.hypot(p.x, p.y) > NO_LAKE_M) out.push({ name: "", bottom: d.bottom });
  }
  return out;
}

const floodA = priorityFlood(BASE.dem, GN, 1e-4, undefined, JITTER).filled;
const depA = depressions(BASE.dem, floodA, d8Receivers(floodA, GN), GN);
const SEEDS = pickLakes(depA.list);
const lakeOfA = new Int32Array(GN * GN).fill(-1);
for (const [k, s] of SEEDS.entries()) { const id = depA.label[s.bottom]!; for (let i = 0; i < GN * GN; i++) if (depA.label[i] === id) lakeOfA[i] = k; }

const groundA = (x: number, y: number) => sampleGrid(floodA, x, y);
const levelA = (x: number, y: number): number | undefined => {
  const i = cellOf(x, y);
  if (BIG[i]) return BIG_LAKE.level;
  const k = lakeOfA[i]!;
  return k >= 0 ? depA.list[depA.label[i]!]!.level : undefined;
};

// ---------------------------------------------------------------------------
// B. Kotkanjoki, Myllyoja and Koivuoja
// ---------------------------------------------------------------------------

const valleyFlat = (p: P) => Math.max(0.15, sampleGrid(BASE.valleyFloor, p.x, p.y));

function traceRiver(): P[] {
  const f = lineField(RIVER_VALLEY.line, 1400);
  const w = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) w[i] = Number.isFinite(f.d[i]!) ? Math.exp((floodA[i]! - 70) / 3) * (1 + (f.d[i]! / 450) ** 2) : Infinity;
  const inCorridor = (i: number) => Number.isFinite(f.d[i]!);
  const below = { x: BRIDGE.x + 5, y: BRIDGE.y - 140 };
  const above = { x: BRIDGE.x - 5, y: BRIDGE.y + 140 };
  const south = Array.from({ length: GN }, (_, c) => c).filter((c) => (f.d[c] ?? Infinity) < 250);
  const up = leastCostPath(w, south, (i) => i === cellOf(below.x, below.y), inCorridor);
  const north = cellOf(above.x, above.y);
  const down = leastCostPath(w, [north], (i) => Math.floor(i / GN) === GN - 1 && f.d[i]! < 250, inCorridor);
  const src = { x: cellPoint(up[0]!).x, y: -HALF_M };
  const mouth = { x: cellPoint(down[down.length - 1]!).x, y: HALF_M };
  const a = naturalise(cellsToLine(up, 10, src, below), 230, 950, 31, valleyFlat);
  const b = naturalise(cellsToLine(down, 10, above, mouth), 230, 950, 32, valleyFlat);
  // Gate R: through the bridge on a smooth bend, square to R3 (was a straight reach below → BRIDGE → above, a hairpin at each end).
  const axisLen = Math.hypot(above.x - below.x, above.y - below.y);
  return throughPin(a, BRIDGE, b, { x: (above.x - below.x) / axisLen, y: (above.y - below.y) / axisLen }, 260);
}

/** Kotkanjoki, in flow order: from the south sheet edge, through BRIDGE, to the north edge. */
export const RIVER: readonly P[] = traceRiver();

const corridorWeight = (line: readonly P[], radius: number, base: number, scale: number, spread: number) => {
  const f = lineField(line, radius);
  const w = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) w[i] = Number.isFinite(f.d[i]!) ? Math.exp((floodA[i]! - base) / scale) * (1 + (f.d[i]! / spread) ** 2) : Infinity;
  return w;
};
const lakeCellsNamed = (name: string) => { const k = SEEDS.findIndex((s) => s.name === name); const out: number[] = []; if (k >= 0) for (let i = 0; i < GN * GN; i++) if (lakeOfA[i] === k) out.push(i); return out; };
const nearLine = (line: readonly P[], m: number) => (i: number) => distToPolyline(cellX(i % GN), cellY(Math.floor(i / GN)), line) < m;

/** `line` cut where it first comes within `m` of `into`, then ended on `into`'s nearest vertex (a confluence, never a crossing). */
function joinTo(line: readonly P[], into: readonly P[], m: number): P[] {
  const out: P[] = [];
  for (const p of line) {
    if (out.length > 3 && distToPolyline(p.x, p.y, into) < m) break;
    out.push(p);
  }
  const last = out[out.length - 1]!;
  let best = into[0]!;
  for (const q of into) if (Math.hypot(q.x - last.x, q.y - last.y) < Math.hypot(best.x - last.x, best.y - last.y)) best = q;
  out.push(best);
  return out;
}

/** Myllyoja: from the mires west of Karhujärvi down to the lake (least cost), through it, and out along Korpilaakso's floor (the
 * valley's own centre line, which the base DEM makes the lowest line of the floor) to Kotkanjoki. */
function traceMyllyoja(): P[] {
  const karhu = lakeCellsNamed("Karhujärvi");
  if (karhu.length === 0) throw new Error("water: Karhujärvi did not form in its bowl");
  const karhuSet = new Set(karhu);
  const src = cellOf(-3700, 1820);
  const wUp = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) wUp[i] = Math.exp((floodA[i]! - floodA[src]!) / 2.2);
  const up = leastCostPath(wUp, [src], (i) => karhuSet.has(i));
  const upLine = naturalise(cellsToLine(up, 10), 45, 380, 41, valleyFlat);
  // Leave the lake at the shore cell nearest the valley's head.
  const head = KORPI_VALLEY.line[0]!;
  const exit = karhu.reduce((a, i) => (Math.hypot(cellPoint(i).x - head.x, cellPoint(i).y - head.y) < Math.hypot(cellPoint(a).x - head.x, cellPoint(a).y - head.y) ? i : a));
  const downLine = naturalise([cellPoint(exit), ...resample(KORPI_VALLEY.line, 20)], 40, 320, 42, () => 1);
  return [...upLine, ...joinTo(downLine, RIVER, 40)];
}

function traceKoivuoja(myllyoja: readonly P[]): P[] {
  return joinTo(naturalise(resample(KOIVU_VALLEY.line, 20), 35, 300, 43, () => 1), myllyoja, 30);
}

const MYLLYOJA_LINE = traceMyllyoja();
const KOIVUOJA_LINE = traceKoivuoja(MYLLYOJA_LINE);

/** Water surface of `line` at the vertex nearest `p`. */
function surfaceNear(line: readonly P[], surface: readonly number[], p: P): number {
  let near = 0;
  for (let k = 1; k < line.length; k++) if (Math.hypot(line[k]!.x - p.x, line[k]!.y - p.y) < Math.hypot(line[near]!.x - p.x, line[near]!.y - p.y)) near = k;
  return surface[near]!;
}

export const RIVER_SURFACE: readonly number[] = channelSurface(RIVER, groundA, levelA, 1.2, 30, 0.0001);
const MYLLYOJA_SURFACE = channelSurface(MYLLYOJA_LINE, groundA, levelA, 0.6, 25, 0.0002, surfaceNear(RIVER, RIVER_SURFACE, MYLLYOJA_LINE[MYLLYOJA_LINE.length - 1]!));
const KOIVUOJA_SURFACE = channelSurface(KOIVUOJA_LINE, groundA, levelA, 0.6, 25, 0.0003, surfaceNear(MYLLYOJA_LINE, MYLLYOJA_SURFACE, KOIVUOJA_LINE[KOIVUOJA_LINE.length - 1]!));

const demB = new Float32Array(GN * GN);
for (let i = 0; i < GN * GN; i++) demB[i] = lakeOfA[i]! >= 0 || BIG[i] ? BASE.dem[i]! : floodA[i]!;
const isLakeA = (i: number) => lakeOfA[i]! >= 0 || BIG[i] === 1;
carve(demB, RIVER, RIVER_SURFACE, riverProfile, 90, isLakeA);
carve(demB, MYLLYOJA_LINE, MYLLYOJA_SURFACE, brookProfile, 45, isLakeA);
carve(demB, KOIVUOJA_LINE, KOIVUOJA_SURFACE, brookProfile, 45, isLakeA);

// ---------------------------------------------------------------------------
// C. Brooks from flow accumulation, and every lake's outlet
// ---------------------------------------------------------------------------

/** Floods `dem` and finds the chosen lakes again (by their bottom cell); big-lake cells are lake too. */
function settle(dem: Float32Array) {
  const filled = priorityFlood(dem, GN, 1e-4, undefined, JITTER).filled;
  const rec = d8Receivers(filled, GN);
  const dep = depressions(dem, filled, rec, GN);
  const lakeId = new Int32Array(GN * GN).fill(-1);
  const levels: number[] = [];
  const outlets: number[] = [];
  for (const [k, s] of SEEDS.entries()) {
    const id = dep.label[s.bottom]!;
    const d = id >= 0 ? dep.list[id]! : undefined;
    levels.push(d ? d.level : dem[s.bottom]!);
    outlets.push(d ? d.outlet : -1);
    if (d) for (let i = 0; i < GN * GN; i++) if (dep.label[i] === id) lakeId[i] = k;
  }
  const bigId = SEEDS.length;
  for (let i = 0; i < GN * GN; i++) if (BIG[i]) lakeId[i] = bigId;
  levels.push(BIG_LAKE.level);
  outlets.push(-1);
  return { filled, rec, lakeId, levels, outlets };
}

const S1 = settle(demB);
const order1 = topoOrder(S1.rec);
const acc1 = accumulate(S1.rec, order1);

export interface Brook { readonly name: string; readonly line: readonly P[]; readonly kind: "named" | "brook" | "outlet" }

const streamCell = new Int32Array(GN * GN).fill(-1);
markLine(streamCell, RIVER, 40, 0);
markLine(streamCell, MYLLYOJA_LINE, 30, 1);
markLine(streamCell, KOIVUOJA_LINE, 30, 2);
const LINES: P[][] = [RIVER as P[], MYLLYOJA_LINE, KOIVUOJA_LINE];
const KINDS: Brook["kind"][] = ["named", "named", "named"];
/** For each traced stream: the stream (id) or lake (−2 − lake id) it ends in, or −1 (sheet edge). */
const ENDS: number[] = [-1, 0, 1];

function traceFrom(start: number, lakeOf: Int32Array, prefix: number[] = []): { cells: number[]; end: number } {
  const ownLake = prefix.length > 0 ? lakeOf[prefix[0]!]! : -1;
  const cells = [...prefix, ...flowPath(S1.rec, start, (i) => streamCell[i]! >= 0 || (lakeOf[i]! >= 0 && lakeOf[i] !== ownLake))];
  const last = cells[cells.length - 1]!;
  const end = streamCell[last]! >= 0 ? streamCell[last]! : lakeOf[last]! >= 0 ? -2 - lakeOf[last]! : -1;
  return { cells, end };
}

function addStream(cells: number[], end: number, kind: Brook["kind"]): void {
  const id = LINES.length;
  // The cells and their neighbours: a later stream that comes alongside joins this one there, instead of running beside it.
  for (const i of cells) {
    const r = Math.floor(i / GN);
    const c = i % GN;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const j = (r + dr) * GN + c + dc;
      if (r + dr >= 0 && r + dr < GN && c + dc >= 0 && c + dc < GN && streamCell[j]! < 0 && S1.lakeId[j]! < 0) streamCell[j] = id;
    }
  }
  LINES.push(cellsToLine(cells, 10));
  KINDS.push(kind);
  ENDS.push(end);
}

// Lake outlets first (a lake ≥ 2 ha always has one), then brook heads in cell order.
for (const [k] of SEEDS.entries()) {
  const o = S1.outlets[k]!;
  if (o < 0 || streamCell[o]! >= 0) continue;
  const lastLake = (() => { for (let i = 0; i < GN * GN; i++) if (S1.lakeId[i] === k && S1.rec[i] === o) return i; return -1; })();
  const t = traceFrom(o, S1.lakeId, lastLake >= 0 ? [lastLake] : []);
  if (t.cells.length >= 3) addStream(t.cells, t.end, "outlet");
}
{
  const isChan = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) isChan[i] = S1.lakeId[i]! < 0 && acc1[i]! >= BROOK_CELLS * (1 + 3 * BASE.sand[i]!) ? 1 : 0;
  const fed = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) if (isChan[i] && S1.rec[i]! >= 0) fed[S1.rec[i]!] = 1;
  for (let i = 0; i < GN * GN; i++) {
    if (!isChan[i] || fed[i] || streamCell[i]! >= 0) continue;
    const t = traceFrom(i, S1.lakeId);
    if (t.cells.length >= 9) addStream(t.cells, t.end, "brook");
  }
}

// Smooth the generated streams on flat ground and join each to the line it ends in.
const slope1 = (p: P) => { const e = 30; return Math.hypot(sampleGrid(S1.filled, p.x + e, p.y) - sampleGrid(S1.filled, p.x - e, p.y), sampleGrid(S1.filled, p.x, p.y + e) - sampleGrid(S1.filled, p.x, p.y - e)) / (2 * e); };
for (let k = 3; k < LINES.length; k++) LINES[k] = naturalise(LINES[k]!, 6, 140, 100 + k, (p: P) => Math.max(0, 1 - slope1(p) * 40));
// Then join each to the final line it ends in (its nearest vertex: a confluence on the drawn line).
for (let k = 3; k < LINES.length; k++) {
  const into = ENDS[k]!;
  if (into < 0) continue;
  const line = LINES[k]!;
  const last = line[line.length - 1]!;
  let best = LINES[into]![0]!;
  for (const q of LINES[into]!) if (Math.hypot(q.x - last.x, q.y - last.y) < Math.hypot(best.x - last.x, best.y - last.y)) best = q;
  line.push(best);
}

const groundB = (x: number, y: number) => sampleGrid(S1.filled, x, y);
const levelB = (x: number, y: number): number | undefined => { const k = S1.lakeId[cellOf(x, y)]!; return k >= 0 ? S1.levels[k] : undefined; };
const SURFACES: number[][] = [RIVER_SURFACE as number[], MYLLYOJA_SURFACE, KOIVUOJA_SURFACE];
const demC = Float32Array.from(demB);
for (let i = 0; i < GN * GN; i++) if (S1.lakeId[i]! < 0) demC[i] = S1.filled[i]!;
for (let k = 3; k < LINES.length; k++) {
  const line = LINES[k]!;
  const into = ENDS[k]!;
  const floor = into >= 0 ? surfaceNear(LINES[into]!, SURFACES[into]!, line[line.length - 1]!) : into <= -2 ? S1.levels[-2 - into]! : -Infinity;
  const s = channelSurface(line, groundB, levelB, KINDS[k] === "outlet" ? 0.35 : 0.5, 20, 0.0004, floor);
  SURFACES.push(s);
  carve(demC, line, s, KINDS[k] === "outlet" ? rillProfile : brookProfile, 40, (i) => S1.lakeId[i]! >= 0);
}

// ---------------------------------------------------------------------------
// D. The final surface
// ---------------------------------------------------------------------------

// Every drawn channel falls monotonically on the grid it is drawn over (the main stems last, so they win where lines meet).
for (let k = LINES.length - 1; k >= 0; k--) enforceMonotone(demC, LINES[k]!, (i) => S1.lakeId[i]! >= 0);
const S2 = settle(demC);
/** Lake index per 20 m cell (−1 on land; LAKES[k].id === k). */
export const LAKE_ID: Int32Array = S2.lakeId;
/** The DEM with lake bottoms (shores are where it crosses the level). */
const BOTTOM = demC;
/** The final elevation grid: the filled DEM, the lakes at their level. */
export const ELEV: Float32Array = new Float32Array(GN * GN);
for (let i = 0; i < GN * GN; i++) ELEV[i] = LAKE_ID[i]! >= 0 ? S2.levels[LAKE_ID[i]!]! : S2.filled[i]!;
export const FILLED: Float64Array = S2.filled;
export const REC: Int32Array = S2.rec;
export const ORDER: Int32Array = topoOrder(S2.rec);
export const ACC: Float64Array = accumulate(S2.rec, ORDER);
/** Depth (m) of the base DEM's hollows that were filled flat (peat or sand fills them), 0 elsewhere and in lakes. */
export const HOLLOW: Float32Array = new Float32Array(GN * GN);
for (let i = 0; i < GN * GN; i++) HOLLOW[i] = LAKE_ID[i]! >= 0 ? 0 : Math.max(0, floodA[i]! - BASE.dem[i]!);
/** Stream id per cell (0 = Kotkanjoki), −1 elsewhere. */
export const STREAM_CELL: Int32Array = streamCell;

function buildLakes(): Lake[] {
  const n = SEEDS.length + 1;
  const cells = new Array<number>(n).fill(0);
  for (let i = 0; i < GN * GN; i++) if (LAKE_ID[i]! >= 0) cells[LAKE_ID[i]!]!++;
  const order = SEEDS.map((s, k) => ({ k, s })).filter(({ s }) => s.name === "").sort((a, b) => cells[b.k]! - cells[a.k]! || a.k - b.k);
  const names = new Map<number, string>();
  // Pirttilampi is the lake the cottage road west of Hiekkala leads to (roads-main.ts): the one ≥ 4 ha nearest the SW cottages.
  const pirtti = order.filter(({ k }) => cells[k]! * G * G >= 40_000).map(({ k }) => ({ k, d: Math.hypot(cellPoint(SEEDS[k]!.bottom).x + 3400, cellPoint(SEEDS[k]!.bottom).y + 7600) })).sort((a, b) => a.d - b.d || a.k - b.k)[0];
  if (pirtti) names.set(pirtti.k, "Pirttilampi");
  const pool = LAKE_NAMES.filter((n) => n !== "Pirttilampi");
  let j = 0;
  for (const { k } of order) { if (names.has(k) || cells[k]! * G * G < 30_000 || j >= pool.length) continue; names.set(k, pool[j++]!); }
  // Each lake's point farthest from its shore (two-pass chamfer distance inside the water): where its name goes, always on water.
  const inner = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) inner[i] = LAKE_ID[i]! >= 0 ? 1e9 : 0;
  for (let i = 0; i < GN * GN; i++) {
    if (!inner[i]) continue;
    const c = i % GN;
    if (c > 0) inner[i] = Math.min(inner[i]!, inner[i - 1]! + 1);
    if (i >= GN) inner[i] = Math.min(inner[i]!, inner[i - GN]! + 1, c > 0 ? inner[i - GN - 1]! + 1.414 : 1e9, c + 1 < GN ? inner[i - GN + 1]! + 1.414 : 1e9);
  }
  for (let i = GN * GN - 1; i >= 0; i--) {
    if (!inner[i]) continue;
    const c = i % GN;
    if (c + 1 < GN) inner[i] = Math.min(inner[i]!, inner[i + 1]! + 1);
    if (i + GN < GN * GN) inner[i] = Math.min(inner[i]!, inner[i + GN]! + 1, c + 1 < GN ? inner[i + GN + 1]! + 1.414 : 1e9, c > 0 ? inner[i + GN - 1]! + 1.414 : 1e9);
  }
  const pole = new Int32Array(n).fill(-1);
  for (let i = 0; i < GN * GN; i++) { const k = LAKE_ID[i]!; if (k >= 0 && (pole[k]! < 0 || inner[i]! > inner[pole[k]!]!)) pole[k] = i; }
  const out: Lake[] = SEEDS.map((s, k) => {
    const p = cellPoint(pole[k]! >= 0 ? pole[k]! : s.bottom);
    const o = S2.outlets[k]!;
    return { id: k, name: s.name || (names.get(k) ?? ""), cx: p.x, cy: p.y, r: Math.sqrt((cells[k]! * G * G) / Math.PI), level: S2.levels[k]!, areaHa: (cells[k]! * G * G) / 10_000, outlet: o >= 0 ? cellPoint(o) : null };
  });
  out.push({ id: SEEDS.length, name: BIG_LAKE.name, cx: BIG_LAKE.cx, cy: BIG_LAKE.cy, r: BIG_LAKE.r, level: BIG_LAKE.level, areaHa: (cells[SEEDS.length]! * G * G) / 10_000, big: true, outlet: null });
  return out;
}

/** Every lake: the named ones, the hollows that hold water, and Iso-Hirvijärvi (last). */
export const LAKES: readonly Lake[] = buildLakes();

// E. Reconcile the drawn streams with the final lakes: carving moves a lake's spill a little, so a brook that ended in a lake that
// has since shrunk is continued down the final flow path to the water, and a lake (≥ 2 ha) whose outlet stream no longer starts on
// its shore gets one traced from its final outlet.
{
  const followFlow = (start: number): P[] => {
    const pts: P[] = [];
    let i = start;
    for (let n = 0; n < 200; n++) {
      const j = S2.rec[i]!;
      if (j < 0) break;
      i = j;
      pts.push(cellPoint(i));
      if (LAKE_ID[i]! >= 0 || streamCell[i]! >= 0) break;
    }
    return pts;
  };
  // An outlet starts where it leaves its lake for good (not along the shore it was traced beside before the lake settled).
  const nearLake = (p: P, lake: number) => {
    const c = Math.round((p.x + HALF_M) / G - 0.5);
    const r = Math.round((p.y + HALF_M) / G - 0.5);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (LAKE_ID[(r + dr) * GN + c + dc] === lake) return true;
    return false;
  };
  for (let k = 3; k < LINES.length; k++) {
    if (KINDS[k] !== "outlet") continue;
    const line = LINES[k]!;
    const start = line[0]!;
    let lake = -1;
    for (let dr = -1; dr <= 1 && lake < 0; dr++) for (let dc = -1; dc <= 1 && lake < 0; dc++) lake = LAKE_ID[cellOf(start.x + dc * G, start.y + dr * G)]!;
    if (lake < 0) continue;
    let last = 0;
    for (let j = 0; j < line.length; j++) if (nearLake(line[j]!, lake)) last = j;
    if (last > 0 && last < line.length - 2) { LINES[k] = line.slice(last); SURFACES[k] = SURFACES[k]!.slice(last); }
  }
  for (let k = 3; k < LINES.length; k++) {
    if (ENDS[k]! > -2) continue;
    const line = LINES[k]!;
    const last = line[line.length - 1]!;
    if (lakeAt(last.x, last.y)) continue;
    line.push(...followFlow(cellOf(last.x, last.y)));
  }
  for (const [k] of SEEDS.entries()) {
    const o = S2.outlets[k]!;
    if (o < 0 || (cells2(k) < 50)) continue;
    const shore = (p: P) => { for (const [dx, dy] of [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]] as const) if (LAKE_ID[cellOf(p.x + dx, p.y + dy)] === k) return true; return false; };
    if (LINES.some((l) => shore(l[0]!))) continue;
    // The lowest shore cell whose flow path leads away from the lake (not straight back into it), from the lake cell beside it.
    let path: P[] = [];
    const shoreCells: number[] = [];
    for (let i = 0; i < GN * GN; i++) {
      if (LAKE_ID[i] !== k) continue;
      const r = Math.floor(i / GN);
      const c = i % GN;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr > 0 && cc > 0 && rr < GN - 1 && cc < GN - 1 && LAKE_ID[rr * GN + cc]! < 0) shoreCells.push(rr * GN + cc);
      }
    }
    shoreCells.sort((a, b) => ELEV[a]! - ELEV[b]! || a - b);
    for (const c0 of [o, ...shoreCells]) {
      const flow = followFlow(c0);
      const back = flow.slice(0, 3).some((q) => LAKE_ID[cellOf(q.x, q.y)] === k);
      if (back || flow.length < 1) continue;
      let lakeCell = -1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const j = c0 + dr * GN + dc; if (lakeCell < 0 && LAKE_ID[j] === k) lakeCell = j; }
      path = [...(lakeCell >= 0 ? [cellPoint(lakeCell)] : []), cellPoint(c0), ...flow];
      break;
    }
    if (path.length < 3) continue;
    const id = LINES.length;
    for (const p of path) { const i = cellOf(p.x, p.y); if (streamCell[i]! < 0 && LAKE_ID[i]! < 0) streamCell[i] = id; }
    LINES.push(path);
    KINDS.push("outlet");
    ENDS.push(-1);
    SURFACES.push(path.map((p) => ELEV[cellOf(p.x, p.y)]!));
  }
}
// Finally every drawn stream falls monotonically on the final surface too (the outlets traced above follow the final flow paths
// cell by cell; this settles the grid nodes their drawn lines pass nearest).
for (let k = LINES.length - 1; k >= 0; k--) enforceMonotone(ELEV, LINES[k]!, (i) => LAKE_ID[i]! >= 0);
function cells2(k: number): number { let n = 0; for (let i = 0; i < GN * GN; i++) if (LAKE_ID[i] === k) n++; return n; }

/**
 * Brooks in flow order (source → mouth): Myllyoja, Koivuoja, then the generated brooks and lake outlets. Unnamed ones are "puro".
 * Play-test R5 (researcher 25 Oct 2026): the first was Korpioja (English "Alder Creek"), confusable with Koivuoja ("Birch Creek"); the
 * geometry is unchanged, only the name.
 */
export const BROOKS: readonly Brook[] = (() => {
  const out: Brook[] = [];
  const lengths = LINES.map((l) => l.reduce((s, p, k) => (k ? s + Math.hypot(p.x - l[k - 1]!.x, p.y - l[k - 1]!.y) : 0), 0));
  const far = LINES.map((l, k) => ({ k, len: lengths[k]! })).filter(({ k }) => k >= 3 && LINES[k]!.every((p) => Math.hypot(p.x, p.y) > 5000)).sort((a, b) => b.len - a.len || a.k - b.k);
  const named = new Map<number, string>([[far[0]?.k ?? -1, "Suo-oja"], [far[1]?.k ?? -1, "Rahkapuro"]]);
  for (let k = 1; k < LINES.length; k++) out.push({ name: k === 1 ? "Myllyoja" : k === 2 ? "Koivuoja" : named.get(k) ?? "puro", line: LINES[k]!, kind: KINDS[k]! });
  return out;
})();
export const BROOK_SURFACES: readonly (readonly number[])[] = SURFACES.slice(1);

// ---------------------------------------------------------------------------
// Point queries
// ---------------------------------------------------------------------------

/** The lake containing (x, y), if any: the shore is where the DEM crosses the lake's level. */
export function lakeAt(x: number, y: number): Lake | undefined {
  if (Math.abs(x) >= HALF_M || Math.abs(y) >= HALF_M) return undefined;
  const fc = (x + HALF_M) / G - 0.5;
  const fr = (y + HALF_M) / G - 0.5;
  const c0 = Math.max(0, Math.min(GN - 1, Math.round(fc)));
  const r0 = Math.max(0, Math.min(GN - 1, Math.round(fr)));
  let id = LAKE_ID[r0 * GN + c0]!;
  if (id < 0) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (c >= 0 && r >= 0 && c < GN && r < GN && LAKE_ID[r * GN + c]! >= 0) { id = LAKE_ID[r * GN + c]!; break; }
    }
  }
  if (id < 0) return undefined;
  const lake = LAKES[id]!;
  return sampleGrid(BOTTOM, x, y) < lake.level ? lake : undefined;
}

export function inLake(l: Lake, x: number, y: number): boolean {
  return lakeAt(x, y)?.id === l.id;
}

export function elevation(x: number, y: number): number {
  const lake = lakeAt(x, y);
  return lake ? lake.level : sampleGrid(ELEV, x, y);
}
