/**
 * The training incident's two scenes as the live map draws them (SPEC/08 (bp) §bp.3), built from the build's geometry
 * (`tools/review/training.ts` writes them into `content/training/incident.json`), and S4's exposure scene:
 * - `s1`: the basemap only — no fire, no units, calm; the item's marks and the road codes are drawn over it.
 * - `incident`: the fire as the live map draws a mapped edge (the burnt core, the burning zone, the red uncontained edge with its
 *   head), EK51 at the fire's tail, a light wind from the spread's reverse, the clock 10.00 (the period's start, as every session map).
 * - the memory exposure: the `s1` scene with the memory unit alone (`memoryExposureScene`).
 * Pure; never a main-session view (index 0, the training's own clock).
 */

import { asVirtualTime, type LatLon, type Ring } from "../../engine/primitives.js";
import type { RenderableCycle } from "../../boundary/render-boundary.js";
import type { FireDisplay } from "../../scenario/types.js";
import type { TrainingSpec } from "./spec.js";

/** 10.00 on the session's scale (13.20 = 0): the map's "as mapped" time. */
export const TRAINING_MAP_START_S = -12_000;
export const TRAINING_MAP_CLOCK = "10:00";
/** The vertices each side of the head that the edge's head segment spans. */
const HEAD_HALF = 5;

export interface TrainingFireInput {
  /** The mapped edge, any orientation, open or closed; its first vertex is the head. */
  readonly edge: readonly LatLon[];
  /** The fire's burnt core (the earlier edge, nearer the tail). */
  readonly burnt: readonly LatLon[];
  readonly ek51: LatLon;
  /** The spread's bearing, degrees true; the wind blows from its reverse. */
  readonly spreadDeg: number;
  readonly windMs: number;
}

/** Closed and counter-clockwise (lon east, lat north), starting at `ring[0]`. */
function ccwClosed(ring: readonly LatLon[]): LatLon[] {
  const open = ring.length > 1 && ring[0]!.lat === ring.at(-1)!.lat && ring[0]!.lon === ring.at(-1)!.lon ? ring.slice(0, -1) : [...ring];
  let s = 0;
  for (let i = 0, j = open.length - 1; i < open.length; j = i++) s += (open[j]!.lon - open[i]!.lon) * (open[j]!.lat + open[i]!.lat);
  const ccw = s < 0 ? open : [open[0]!, ...open.slice(1).reverse()];
  return [...ccw, ccw[0]!];
}

function scene(fire: FireDisplay, perimeter: readonly Ring[], units: Readonly<Record<string, LatLon>>, wind: { fromDeg: number; meanMs: number; sourceFi: string }): RenderableCycle {
  return {
    index: 0,
    phase: "A",
    startsAtVirtual: asVirtualTime(TRAINING_MAP_START_S),
    steps: 1,
    stepShown: 1,
    clockLabel: TRAINING_MAP_CLOCK,
    perimeter,
    detachedFronts: [],
    unitPositions: units,
    unitWork: Object.fromEntries(Object.keys(units).map((id) => [id, { task: "hose_attack", vehicle: null, hoseM: null }] as const)),
    fire,
    aircraft: [],
    wind: { observedAt: asVirtualTime(TRAINING_MAP_START_S), ...wind },
    rateMarks: [],
    sensorFootprints: [],
  };
}

const NO_FIRE: FireDisplay = { perimeters_past: [], perimeter_current: [], burnt_area: { geometry: [], severity: null }, burning_zone: [], spot_fires: [], detections: [] };

export function trainingScenes(input: TrainingFireInput): { readonly s1: RenderableCycle; readonly incident: RenderableCycle } {
  const edge = ccwClosed(input.edge), burnt = ccwClosed(input.burnt);
  const n = edge.length - 1;
  const at = (k: number) => edge[((k % n) + n) % n]!;
  const head = Array.from({ length: 2 * HEAD_HALF + 1 }, (_, k) => at(k - HEAD_HALF));
  const rest = Array.from({ length: n - 2 * HEAD_HALF + 1 }, (_, k) => at(HEAD_HALF + k));
  const fire: FireDisplay = {
    perimeters_past: [],
    perimeter_current: [{ status: "uncontained", is_head: true, line: head }, { status: "uncontained", is_head: false, line: rest }],
    burnt_area: { geometry: [[burnt]], severity: null },
    burning_zone: [[edge, [...burnt].reverse()]],
    spot_fires: [],
    detections: [],
  };
  return {
    s1: scene(NO_FIRE, [], {}, { fromDeg: 0, meanMs: 0, sourceFi: "" }),
    incident: scene(fire, [edge], { EK51: input.ek51 }, { fromDeg: Math.round((input.spreadDeg + 180) % 360), meanMs: input.windMs, sourceFi: "EK51" }),
  };
}

/** S4's exposure: the `s1` scene with the memory unit alone, where the item puts it. */
export function memoryExposureScene(spec: TrainingSpec): RenderableCycle {
  const item = spec.items.find((it) => it.memory !== undefined);
  if (!item?.memory) throw new Error("training: no memory item");
  const s1 = spec.scenes.s1;
  return { ...s1, unitPositions: { [item.memory.unit]: item.memory.at }, unitWork: { [item.memory.unit]: { task: "staging", vehicle: null, hoseM: null } } };
}

/** The scene an item shows (the memory item's question shows the blank freeze map; its exposure is `memoryExposureScene`). */
export function sceneOf(spec: TrainingSpec, itemId: string): RenderableCycle {
  const item = spec.items.find((it) => it.id === itemId);
  if (!item) throw new Error(`training: no item ${itemId}`);
  return spec.scenes[item.scene];
}
