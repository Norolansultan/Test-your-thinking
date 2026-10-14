/**
 * The game loop's dependencies wired to the real world and fire model (SPEC/29 §3). The loop (`game.ts`) takes
 * them explicitly so its tests can use small fakes; the game screen uses these.
 */

import { createFireSim } from "../fire/spread.js";
import { cellCentre, cellOf, cellsAlongLine, cellsInCircle } from "../world/grid.js";
import { nearestNode, routeOnRoads } from "../world/roads.js";
import { describeWeatherEn, describeWeatherFi, weatherAt } from "../weather/weather.js";
import type { GameDeps } from "./ports.js";

export const defaultDeps: GameDeps = {
  // The loop routes between road nodes; the world's router takes points (it adds no off-road leg at a node).
  route: (world, from, to, speedKmhByClass) => {
    const a = world.roads.nodes[from];
    const b = world.roads.nodes[to];
    if (!a || !b) return null;
    const r = routeOnRoads(world, a, b, speedKmhByClass);
    return r ? { path: r.path, lengthM: r.lengthM, durationS: r.durationS } : null;
  },
  nearestNode: (world, xy, maxM) => nearestNode(world, xy, maxM),
  cellOf: (grid, xy) => {
    const c = cellOf(grid, xy);
    return c < 0 ? null : c;
  },
  cellCentre: (grid, cell) => cellCentre(grid, cell),
  cellsInCircle: (grid, centre, radiusM) => cellsInCircle(grid, centre, radiusM),
  // One cell wide: the cells a line passes through.
  cellsAlongLine: (grid, a, b) => cellsAlongLine(grid, a, b, grid.cellM),
  createFire: (world, seed, startS) => createFireSim(world, seed, startS === undefined ? {} : { startS }),
  weatherAt: (keys, tS) => weatherAt(keys, tS),
  describeWeatherFi: (w) => describeWeatherFi(w),
  describeWeatherEn: (w) => describeWeatherEn(w),
};
