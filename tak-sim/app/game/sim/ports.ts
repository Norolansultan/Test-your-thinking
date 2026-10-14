/**
 * Game mode, the game loop's ports: the functions it needs from the world (`world/*`), the live fire
 * model (`fire/*`) and the weather (`weather/*`). The loop never imports those modules; `createGame`
 * takes them as one `GameDeps` bundle, so the loop is tested with small fakes and the real modules are
 * wired in one place (`sim/default-deps.ts`, added by the integrator).
 *
 * Signatures follow the module owners' published ones. Where a real module's shape differs, the
 * integrator adapts it in `default-deps.ts` rather than changing the loop.
 */

import type { FireSim, GameGrid, GameWorld, RoadClass, Weather, WeatherKey, XY } from "../contracts.js";

/** A route along the road graph. `path` runs from the `from` node to the `to` node, inclusive. */
export interface RouteResult {
  readonly path: readonly XY[];
  readonly lengthM: number;
  readonly durationS: number;
}

/** Road speed per road class, km/h, for the vehicle that drives the route. */
export type SpeedByRoadClass = Readonly<Record<RoadClass, number>>;

/** `world/roads.ts` routeOnRoads: fastest route between two road nodes; null when they are not connected. */
export type RouteFn = (world: GameWorld, from: number, to: number, speedKmhByClass: SpeedByRoadClass) => RouteResult | null;

/** `world/roads.ts` nearestNode: the nearest road node to `xy`, or null when none lies within `maxM`. */
export type NearestNodeFn = (world: GameWorld, xy: XY, maxM?: number) => number | null;

/** `world/grid.ts` cellOf: the cell index (`row * cols + col`, row 0 at the north edge) containing `xy`; null off the grid. */
export type CellOfFn = (grid: GameGrid, xy: XY) => number | null;

/** `world/grid.ts` cellCentre: the local-metre centre of a cell. */
export type CellCentreFn = (grid: GameGrid, cell: number) => XY;

/** `world/grid.ts` cellsInCircle: every cell whose centre lies within `radiusM` of `centre` (on the grid only). */
export type CellsInCircleFn = (grid: GameGrid, centre: XY, radiusM: number) => readonly number[];

/** `world/grid.ts` cellsAlongLine: the cells a straight segment passes through, from `a` to `b`, without repeats. */
export type CellsAlongLineFn = (grid: GameGrid, a: XY, b: XY) => readonly number[];

/** `fire/*` createFireSim: a fresh live fire over the world, seeded, its clock at `startS` (default 0; negative for a pre-burn). */
export type CreateFireFn = (world: GameWorld, seed: number, startS?: number) => FireSim;

/** `weather/weather.ts` weatherAt: the weather at `tS`, interpolated between keyframes. */
export type WeatherAtFn = (keys: readonly WeatherKey[], tS: number) => Weather;

/** `weather/weather.ts` describeWeatherFi / describeWeatherEn: one line for the weather service's radio report. */
export type DescribeWeatherFn = (weather: Weather) => string;

/** Everything the game loop needs from outside `sim/`. */
export interface GameDeps {
  readonly route: RouteFn;
  readonly nearestNode: NearestNodeFn;
  readonly cellOf: CellOfFn;
  readonly cellCentre: CellCentreFn;
  readonly cellsInCircle: CellsInCircleFn;
  readonly cellsAlongLine: CellsAlongLineFn;
  readonly createFire: CreateFireFn;
  readonly weatherAt: WeatherAtFn;
  readonly describeWeatherFi: DescribeWeatherFn;
  readonly describeWeatherEn: DescribeWeatherFn;
}
