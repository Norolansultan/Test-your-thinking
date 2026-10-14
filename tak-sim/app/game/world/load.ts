/**
 * Game mode (SPEC/29): the game's world, decoded from `content/game/world.json` (written by `npm run game:world`,
 * `tools/game/build-world.ts`; the format and its base64 codec are in `format.ts`).
 *
 * Decoding needs no Node API (no `Buffer`), so it runs the same in the browser and in tests. `loadWorld` checks the
 * shape and throws on a malformed file.
 */

import type { Asset, GameGrid, GameWorld, MapLabel, RoadClass, RoadGraph, Settlement, WaterPoint, XY } from "../contracts.js";
import worldJson from "../../../content/game/world.json" with { type: "json" };
import { decodeBase64, WORLD_FORMAT, type Pair, type WorldJson } from "./format.js";

export { decodeBase64, encodeBase64, ROAD_CLASSES, WORLD_FORMAT, type WorldJson } from "./format.js";

function fail(what: string): never {
  throw new Error(`world.json: ${what}`);
}

function pair(p: unknown, what: string): XY {
  if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== "number" || typeof p[1] !== "number") fail(`${what} is not an [x, y] pair`);
  const [x, y] = p as unknown as Pair;
  return { x, y };
}

function pointList(flat: readonly number[], what: string): XY[] {
  if (!Array.isArray(flat) || flat.length % 2 !== 0) fail(`${what} is not a flat list of [x, y] pairs`);
  const out: XY[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i]!, y: flat[i + 1]! });
  return out;
}

function decodeRoads(j: WorldJson["roads"]): RoadGraph {
  const nodes = pointList(j.nodes, "roads.nodes");
  if (j.edges.length % 3 !== 0) fail("roads.edges is not a list of [a, b, class] triples");
  const edges: { a: number; b: number; cls: RoadClass; lengthM: number }[] = [];
  for (let i = 0; i < j.edges.length; i += 3) {
    const a = j.edges[i]!;
    const b = j.edges[i + 1]!;
    const cls = j.classes[j.edges[i + 2]!];
    const pa = nodes[a];
    const pb = nodes[b];
    if (!pa || !pb || cls === undefined) fail(`road edge ${i / 3} refers to a missing node or class`);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    edges.push({ a, b, cls, lengthM: Math.sqrt(dx * dx + dy * dy) });
  }
  return { nodes, edges };
}

/** Decodes and checks a parsed `world.json`. */
export function loadWorld(json: unknown): GameWorld {
  const j = json as WorldJson;
  if (!j || typeof j !== "object" || j.format !== WORLD_FORMAT) fail(`not a ${WORLD_FORMAT} file`);
  const grid: GameGrid = {
    cols: j.grid.cols, rows: j.grid.rows, cellM: j.grid.cellM,
    originTm35: { east: j.grid.originTm35.east, north: j.grid.originTm35.north },
  };
  const n = grid.cols * grid.rows;
  if (!Number.isInteger(n) || n <= 0) fail("grid has no cells");
  const elevBytes = decodeBase64(j.elevationDm);
  if (elevBytes.length !== 2 * n) fail(`elevation has ${elevBytes.length / 2} cells, expected ${n}`);
  const view = new DataView(elevBytes.buffer, elevBytes.byteOffset, elevBytes.byteLength);
  const elevation = new Float32Array(n);
  for (let i = 0; i < n; i++) elevation[i] = view.getInt16(2 * i, true) / 10;
  const fuel = decodeBase64(j.fuel);
  if (fuel.length !== n) fail(`fuel has ${fuel.length} cells, expected ${n}`);
  const roads = decodeRoads(j.roads);
  const nodeOk = (k: number | null) => k === null || (Number.isInteger(k) && k >= 0 && k < roads.nodes.length);
  const waterPoints: WaterPoint[] = j.waterPoints.map((w) => {
    if (!nodeOk(w.roadNode)) fail(`water point ${w.id} refers to a missing road node`);
    return { id: w.id, nameFi: w.nameFi, nameEn: w.nameEn, kind: w.kind, at: pair(w.at, `${w.id}.at`), roadNode: w.roadNode, scoop: pair(w.scoop, `${w.id}.scoop`) };
  });
  const assets: Asset[] = j.assets.map((a) => ({ id: a.id, kind: a.kind, at: pair(a.at, `${a.id}.at`), value: a.value, settlementId: a.settlementId }));
  const settlements: Settlement[] = j.settlements.map((s) => ({ id: s.id, nameFi: s.nameFi, nameEn: s.nameEn, centre: pair(s.centre, `${s.id}.centre`), assetIds: [...s.assetIds] }));
  const labels: MapLabel[] = j.labels.map((l) => ({ textFi: l.fi, textEn: l.en, at: pair(l.at, `label ${l.fi}`), style: l.style }));
  for (const e of j.entryNodes) if (!nodeOk(e)) fail(`entry node ${e} is not a road node`);
  return {
    grid,
    elevation,
    fuel,
    roads,
    waterPoints,
    assets,
    settlements,
    powerLine: pointList(j.powerLine, "powerLine"),
    labels,
    commandPost: pair(j.commandPost, "commandPost"),
    entryNodes: [...j.entryNodes],
  };
}

let cached: GameWorld | null = null;

/** The committed world (`content/game/world.json`), decoded once. */
export function getWorld(): GameWorld {
  cached ??= loadWorld(worldJson);
  return cached;
}
