/**
 * Game mode (SPEC/29): the shared contracts between the world, the live fire model, the units and the
 * game loop, and the screen. Each part is built against these types; change them only together.
 *
 * Game mode is a separate, playable mode beside the research instrument. The study (`?tuotanto`) never
 * offers it and never loads its code. Unlike the instrument it simulates fire live and the player's
 * orders change the world. It still runs deterministically: the same scenario, seed and command log
 * replay the same game (integer hashing for randomness, virtual time only — the determinism lint holds).
 *
 * Coordinates: local metres, x east and y north, origin at the fuel grid's south-west corner
 * (TM35FIN 514000 E, 6741000 N). Grid cells are indexed `row * cols + col` with row 0 at the NORTH edge
 * (as in the .asc files); `cellOf` / `cellCentre` in `world/grid.ts` convert.
 */

// ---------------------------------------------------------------------------
// World (world/*)
// ---------------------------------------------------------------------------

/** Fuel codes, as in content/site/site.json's legend. */
export const FUEL = {
  water: 0, road_gravel: 1, field: 2, pine_heath: 3, spruce_mature: 4, spruce_thinned: 5, birch_aspen: 6,
  drained_peat: 7, cleared_corridor: 8, built: 9, open_bog: 10, road_forest: 11, brook: 12,
} as const;
export type FuelCode = (typeof FUEL)[keyof typeof FUEL];

export interface GameGrid {
  readonly cols: number; // 400
  readonly rows: number; // 400
  readonly cellM: number; // 25
  /** TM35FIN of the grid's south-west corner. */
  readonly originTm35: { readonly east: number; readonly north: number };
}

export interface XY { readonly x: number; readonly y: number }

export type RoadClass = "main" | "gravel" | "forest" | "track" | "path";

export interface RoadGraph {
  readonly nodes: readonly XY[]; // node id = index
  readonly edges: readonly { readonly a: number; readonly b: number; readonly cls: RoadClass; readonly lengthM: number }[];
}

export interface WaterPoint {
  readonly id: string;
  readonly nameFi: string; readonly nameEn: string;
  readonly kind: "lake" | "pond" | "river" | "brook";
  /** Where a vehicle draws water: on a road node within reach of the shore. */
  readonly at: XY; readonly roadNode: number | null;
  /** The water's own centre, for helicopters and water drones (scoop point). */
  readonly scoop: XY;
}

export type AssetKind = "house" | "cabin" | "farm" | "barn" | "power_pylon" | "other";

export interface Asset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly at: XY;
  /** Points lost if it burns (houses most). */
  readonly value: number;
  readonly settlementId: string | null;
}

export interface Settlement {
  readonly id: string;
  readonly nameFi: string; readonly nameEn: string;
  readonly centre: XY;
  readonly assetIds: readonly string[];
}

export interface MapLabel { readonly textFi: string; readonly textEn: string; readonly at: XY; readonly style: string }

export interface GameWorld {
  readonly grid: GameGrid;
  /** Metres above sea level per cell. */
  readonly elevation: Float32Array;
  /** Fuel code per cell (`FuelCode`). */
  readonly fuel: Uint8Array;
  readonly roads: RoadGraph;
  readonly waterPoints: readonly WaterPoint[];
  readonly assets: readonly Asset[];
  readonly settlements: readonly Settlement[];
  /** The 110 kV line: water must not be used within `POWER_LINE_SAFE_M` of it while it is live. */
  readonly powerLine: readonly XY[];
  readonly labels: readonly MapLabel[];
  readonly commandPost: XY;
  /** Where units arrive from (road nodes at the playable area's edge). */
  readonly entryNodes: readonly number[];
}

export const POWER_LINE_SAFE_M = 30;

// ---------------------------------------------------------------------------
// Weather (weather/*)
// ---------------------------------------------------------------------------

export interface Weather {
  /** Direction the wind blows FROM, degrees true. */
  readonly windFromDeg: number;
  readonly windMs: number;
  readonly gustMs: number;
  readonly tempC: number;
  /** Relative humidity, percent. */
  readonly rh: number;
}

/** A keyframe; weather between keyframes is interpolated (wind direction along the shorter arc). */
export interface WeatherKey extends Weather { readonly atS: number }

// ---------------------------------------------------------------------------
// Fire (fire/*)
// ---------------------------------------------------------------------------

export const CELL = {
  noFuel: 0, // water, roads' gravel, built-up ground (not burnable)
  unburned: 1,
  burning: 2, // flaming front
  smouldering: 3, // after flaming: peat and duff; may rekindle while dry and windy
  burnedOut: 4,
  extinguished: 5, // put out by water / mop-up before burning out
} as const;
export type CellState = (typeof CELL)[keyof typeof CELL];

export interface FireStepReport {
  readonly ignited: readonly number[];
  readonly burnedOut: readonly number[];
  readonly spotFires: readonly { readonly cell: number; readonly fromCell: number }[];
  readonly rekindled: readonly number[];
  readonly activeCells: number; // burning + smouldering
  readonly burnedHa: number; // burning + smouldering + burnedOut
}

export interface FireSim {
  readonly state: Uint8Array; // CellState per cell
  /** Fireline intensity of a burning cell, kW/m (0 when not burning). */
  readonly intensity: Float32Array;
  /** Applied water / wetting, 0 = dry, ≥ 1 = soaked; dries over time. */
  readonly wetness: Float32Array;
  /** Simulation time of each cell's ignition, seconds (−1 = never). */
  readonly ignitedAtS: Float32Array;
  readonly tS: number;
  step(dtS: number, weather: Weather): FireStepReport;
  ignite(cell: number): boolean;
  /** Puts `litres` of water on a circle; returns the cells whose state changed (burning → extinguished, etc.). */
  applyWater(centre: XY, radiusM: number, litres: number): readonly number[];
  /** A cut or scraped fire break: the cells lose their fuel (state noFuel) unless already burning. */
  cutFireBreak(cells: readonly number[]): void;
  /** Rate of spread a front would have entering `cell` from `fromCell` now, m/min (for forecasts and the HUD). */
  rateOfSpread(fromCell: number, cell: number, weather: Weather): number;
}

// ---------------------------------------------------------------------------
// Units and orders (sim/*)
// ---------------------------------------------------------------------------

export type UnitKind =
  | "engine" // pelastusyksikkö, 2–3 m³ tank, hose attack
  | "tanker" // säiliöauto, 10–14 m³, water shuttle
  | "forest_unit" // maastopaloyksikkö: off-road, portable pump from natural water, fire breaks
  | "volunteer" // VPK
  | "ugv" // hose-laying robot
  | "drone_thermal" // thermal multicopter, battery ~35 min
  | "drone_vtol" // mapping VTOL, ~2.5 h
  | "drone_water" // water drone, ~80 l per round
  | "helicopter" // bucket, ~1 000 l per drop
  | "spotter"; // fire-spotting aircraft

export type Order =
  | { readonly type: "move"; readonly to: XY }
  | { readonly type: "attack"; readonly target: XY } // direct attack on the edge near `target`
  | { readonly type: "hose_line"; readonly to: XY } // lay hose from the vehicle toward `to` and hold the line
  | { readonly type: "fire_break"; readonly from: XY; readonly to: XY } // cut a break (forest_unit, ugv)
  | { readonly type: "refill"; readonly waterPointId: string }
  | { readonly type: "shuttle"; readonly waterPointId: string; readonly toUnitId: string } // tanker: keep a unit supplied
  | { readonly type: "recon"; readonly centre: XY } // drones / spotter: orbit and observe
  | { readonly type: "drop"; readonly target: XY } // helicopter / water drone
  | { readonly type: "protect"; readonly assetOrSettlementId: string } // wet down and defend structures
  | { readonly type: "hold" };

export type UnitStatus = "en_route" | "idle" | "moving" | "working" | "refilling" | "returning" | "out_of_action";

export interface Unit {
  readonly id: string; // "EK11"
  readonly callsign: string;
  readonly kind: UnitKind;
  readonly pos: XY;
  readonly status: UnitStatus;
  readonly order: Order | null;
  readonly waterL: number; readonly waterMaxL: number;
  /** Battery or fuel, percent (aircraft and drones); 100 for ground units. */
  readonly energyPct: number;
  /** Crew safety: 0 = fine … 1 = casualty (out of action). */
  readonly harm: number;
  readonly hoseLine: readonly XY[] | null;
  /** Arrival time for units still en route, seconds. */
  readonly etaS: number | null;
}

export interface GameCommand { readonly atS: number; readonly unitId: string; readonly order: Order }

export interface RadioMessage {
  readonly atS: number;
  readonly from: string; // callsign or "P3", "HÄTÄKESKUS", "SÄÄ"
  readonly room: "ground" | "air" | "command" | "support";
  readonly textFi: string; readonly textEn: string;
  readonly priority: "routine" | "important" | "urgent";
  readonly at?: XY;
}

// ---------------------------------------------------------------------------
// Scenario, scoring, game loop (sim/*, scenarios/*)
// ---------------------------------------------------------------------------

export type Objective =
  | { readonly kind: "protect_settlement"; readonly settlementId: string }
  | { readonly kind: "contain"; readonly byS: number } // no flaming front left
  | { readonly kind: "limit_area"; readonly maxHa: number }
  | { readonly kind: "no_casualties" };

export interface ScenarioUnit { readonly id: string; readonly kind: UnitKind; readonly arriveAtS: number; readonly entryNode?: number }

export interface ScenarioEvent {
  readonly atS: number;
  readonly kind: "ignite" | "radio" | "power_line_dead" | "units_recalled" | "weather_warning";
  readonly at?: XY;
  readonly message?: RadioMessage;
  readonly unitIds?: readonly string[];
}

export interface GameScenario {
  readonly id: string;
  readonly titleFi: string; readonly titleEn: string;
  readonly briefingFi: string; readonly briefingEn: string;
  /** Clock at tS = 0, minutes after midnight (12:00 = 720). */
  readonly startClockMin: number;
  readonly endAtS: number;
  readonly difficulty: "easy" | "normal" | "hard";
  readonly ignitions: readonly XY[];
  readonly weather: readonly WeatherKey[];
  readonly units: readonly ScenarioUnit[];
  readonly events: readonly ScenarioEvent[];
  readonly objectives: readonly Objective[];
  /** The 110 kV line is live until a `power_line_dead` event. */
  readonly powerLineLiveAtStart: boolean;
}

export interface Score {
  readonly burnedHa: number;
  readonly assetsLost: number; readonly assetsTotal: number;
  readonly settlementsLost: readonly string[];
  readonly casualties: number;
  readonly containedAtS: number | null;
  readonly points: number;
  readonly grade: "S" | "A" | "B" | "C" | "D" | "F";
  readonly objectives: readonly { readonly objective: Objective; readonly met: boolean | null }[];
}

export type GamePhase = "briefing" | "running" | "won" | "lost" | "ended";

export interface GameState {
  readonly tS: number;
  readonly clockLabel: string; // "13:20"
  readonly phase: GamePhase;
  readonly weather: Weather;
  readonly fire: FireSim;
  readonly units: readonly Unit[];
  /** Fog of war: the player's picture. Per cell, the last observed CellState (255 = never observed) and when. */
  readonly known: Uint8Array;
  readonly knownAtS: Float32Array;
  readonly powerLineLive: boolean;
  readonly radio: readonly RadioMessage[];
  readonly score: Score;
}

export interface Game {
  readonly scenario: GameScenario;
  readonly world: GameWorld;
  readonly state: GameState;
  /** Advances the simulation by `dtS` seconds of game time (fixed internal sub-steps). */
  tick(dtS: number): void;
  issue(unitId: string, order: Order): { readonly ok: true } | { readonly ok: false; readonly reasonFi: string; readonly reasonEn: string };
  /** Every accepted command, for replay. */
  readonly commands: readonly GameCommand[];
}

/** The fixed internal step of the game loop and the fire model, seconds of game time. */
export const SIM_STEP_S = 10;
