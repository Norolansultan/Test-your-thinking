/**
 * Game mode screen: the map's vector data as GeoJSON, built from the game state and the world (pure). Local metres go
 * to `[lng, lat]` through `world/geo.ts`, the same projection the fire canvas is placed with, so lines and the fire
 * raster agree.
 */

import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import type { AssetStatus, GameCommand, GameGrid, GameWorld, Order, Unit, XY } from "../contracts.js";
import { localToLngLat } from "../world/geo.js";
import { isAir, sensorRadiusM } from "./orders.js";

export type LL = [number, number];

export function lngLatOf(grid: GameGrid, xy: XY): LL {
  const ll = localToLngLat(grid, xy);
  return [ll[0], ll[1]];
}

const fc = <G extends LineString | Point | Polygon>(features: Feature<G>[]): FeatureCollection<G> => ({ type: "FeatureCollection", features });

/** Where an order sends its unit (null: no place, e.g. hold). */
export function orderTarget(order: Order, world: Pick<GameWorld, "waterPoints" | "assets" | "settlements">, isAirUnit = false): XY | null {
  switch (order.type) {
    case "move": return order.to;
    case "attack": return order.target;
    case "hose_line": return order.to;
    case "fire_break": return order.from;
    case "recon": return order.centre;
    case "drop": return order.target;
    case "refill":
    case "shuttle": {
      const w = world.waterPoints.find((p) => p.id === order.waterPointId);
      return w ? (isAirUnit ? w.scoop : w.at) : null;
    }
    case "protect": {
      const s = world.settlements.find((x) => x.id === order.assetOrSettlementId);
      if (s) return s.centre;
      return world.assets.find((a) => a.id === order.assetOrSettlementId)?.at ?? null;
    }
    case "hold": return null;
  }
}

// Not "returning" or "refilling": then the unit is on a water run, not going to its order's place.
const ACTIVE_FOR_ROUTE = new Set<Unit["status"]>(["moving", "working"]);

/** Dashed planned routes: from each busy unit to its order's place (straight; the game routes by road). */
export function routeLines(world: GameWorld, units: readonly Unit[], selected: ReadonlySet<string>): FeatureCollection<LineString> {
  const out: Feature<LineString>[] = [];
  for (const u of units) {
    if (!u.order || !ACTIVE_FOR_ROUTE.has(u.status)) continue;
    const to = orderTarget(u.order, world, isAir(u.kind));
    if (!to) continue;
    const dx = to.x - u.pos.x, dy = to.y - u.pos.y;
    if (dx * dx + dy * dy < 40 * 40) continue;
    out.push({ type: "Feature", properties: { id: u.id, selected: selected.has(u.id) }, geometry: { type: "LineString", coordinates: [lngLatOf(world.grid, u.pos), lngLatOf(world.grid, to)] } });
  }
  return fc(out);
}

/** Laid hose lines, solid blue. */
export function hoseLines(grid: GameGrid, units: readonly Unit[]): FeatureCollection<LineString> {
  const out: Feature<LineString>[] = [];
  for (const u of units) {
    if (!u.hoseLine || u.hoseLine.length < 2) continue;
    out.push({ type: "Feature", properties: { id: u.id }, geometry: { type: "LineString", coordinates: u.hoseLine.map((p) => lngLatOf(grid, p)) } });
  }
  return fc(out);
}

/** Fire breaks ordered so far (accepted commands), brown dashed; one feature per distinct break. */
export function fireBreakLines(grid: GameGrid, commands: readonly GameCommand[]): FeatureCollection<LineString> {
  const seen = new Set<string>();
  const out: Feature<LineString>[] = [];
  for (const c of commands) {
    if (c.order.type !== "fire_break") continue;
    const { from, to } = c.order;
    const key = `${from.x},${from.y},${to.x},${to.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: "Feature", properties: { id: c.unitId }, geometry: { type: "LineString", coordinates: [lngLatOf(grid, from), lngLatOf(grid, to)] } });
  }
  return fc(out);
}

/** A circle as a 40-gon ring in `[lng, lat]`. */
export function circleRing(grid: GameGrid, centre: XY, radiusM: number, n = 40): LL[] {
  const ring: LL[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    ring.push(lngLatOf(grid, { x: centre.x + radiusM * Math.sin(a), y: centre.y + radiusM * Math.cos(a) }));
  }
  return ring;
}

/** Sensor circles of the aircraft and drones on the map (faint). */
export function sensorCircles(grid: GameGrid, units: readonly Unit[]): FeatureCollection<Polygon> {
  const out: Feature<Polygon>[] = [];
  for (const u of units) {
    if (!isAir(u.kind) || u.status === "en_route" || u.status === "out_of_action") continue;
    out.push({ type: "Feature", properties: { id: u.id }, geometry: { type: "Polygon", coordinates: [circleRing(grid, u.pos, sensorRadiusM(u.kind))] } });
  }
  return fc(out);
}

/** Structures as points, with their status (intact / protected / burned) and kind. */
export function assetPoints(world: GameWorld, status: Readonly<Record<string, AssetStatus>>): FeatureCollection<Point> {
  return fc(world.assets.map((a) => ({
    type: "Feature" as const,
    properties: { id: a.id, kind: a.kind, status: status[a.id] ?? "intact" },
    geometry: { type: "Point" as const, coordinates: lngLatOf(world.grid, a.at) },
  })));
}

/** The 20 kV line. */
export function powerLineData(world: GameWorld, live: boolean): FeatureCollection<LineString> {
  if (world.powerLine.length < 2) return fc([]);
  return fc([{ type: "Feature", properties: { live }, geometry: { type: "LineString", coordinates: world.powerLine.map((p) => lngLatOf(world.grid, p)) } }]);
}

/** Forecast outlines (rings in local metres) per horizon, minutes. */
export function forecastLines(grid: GameGrid, byHorizon: readonly { readonly min: number; readonly rings: readonly (readonly XY[])[] }[]): FeatureCollection<LineString> {
  const out: Feature<LineString>[] = [];
  for (const h of byHorizon) {
    for (const ring of h.rings) out.push({ type: "Feature", properties: { min: h.min }, geometry: { type: "LineString", coordinates: ring.map((p) => lngLatOf(grid, p)) } });
  }
  return fc(out);
}

/** The pending first click of a fire break (targeting), to show where it starts. */
export function pendingPoint(grid: GameGrid, at: XY | null): FeatureCollection<Point> {
  return fc(at ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: lngLatOf(grid, at) } }] : []);
}

/**
 * The opening frame, local metres: the ignitions, the command post and the settlements to protect, with `padM` around,
 * kept on the grid. The game opens on the action, not on the whole 10 km.
 */
export function openingBox(world: Pick<GameWorld, "grid" | "commandPost" | "settlements">, ignitions: readonly XY[], protectIds: readonly string[], padM = 700): { readonly min: XY; readonly max: XY } {
  const pts: XY[] = [...ignitions, world.commandPost];
  for (const id of protectIds) {
    const s = world.settlements.find((x) => x.id === id || x.nameFi === id || x.nameEn === id);
    if (s) pts.push(s.centre);
  }
  const W = world.grid.cols * world.grid.cellM, H = world.grid.rows * world.grid.cellM;
  const clampX = (v: number) => Math.max(0, Math.min(W, v)), clampY = (v: number) => Math.max(0, Math.min(H, v));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return {
    min: { x: clampX(Math.min(...xs) - padM), y: clampY(Math.min(...ys) - padM) },
    max: { x: clampX(Math.max(...xs) + padM), y: clampY(Math.max(...ys) + padM) },
  };
}

/** The playable grid's outline (a thin frame on the map). */
export function gridFrame(grid: GameGrid): FeatureCollection<LineString> {
  const w = grid.cols * grid.cellM, h = grid.rows * grid.cellM;
  const pts: XY[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }];
  return fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => lngLatOf(grid, p)) } }]);
}
