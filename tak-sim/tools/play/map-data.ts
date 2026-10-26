/**
 * What the play harness's images are made from (`tools/play/`): pure data, built in the harness from the session's snapshot and
 * drawn in Chromium by `map-render.ts`. Three kinds, each the participant's own picture of that moment:
 *
 * - `live`: the live TAK map (`map-page.ts`) — the snapshot's renderable data only, as `MapView` reads it;
 * - `freeze`: a `map_point` freeze item's map — the plain basemap (no fire, no units, no overlay: the app's `FreezeMap`), cropped to
 *   the scenario's extent (where an answer may lie) with a labelled pixel grid, so the player can answer with x,y
 *   (`freeze-grid.ts` converts with the app's own basemap projection, `basemap-px.ts`); the training's memory item uses it on the
 *   training's lock box (`extent`);
 * - `training` (revision (bp), 26 Oct 2026): the training incident's live map — `MapView` over the training's scene, locked to its square,
 *   with work package B's overlay (`drawTrainingOverlay`: the item's marks, the memory item's unit, the feedback's drawing) — and a grid
 *   labelled in the PNG's own pixels around it (`training-host.ts`), so the player answers a point with x,y (play-test B12).
 *
 * No answer key of a scored item is ever in this data (the freeze map is the basemap and a grid; the training shows its own keys only
 * in its feedback, as the app does). The map training's extract and the practice feedback's head map are retired with them (bp).
 */

import type { RenderableCycle, RenderableEnvelope } from "../../app/boundary/render-boundary.js";
import type { GeoExtent, LatLon } from "../../app/engine/primitives.js";
import type { Lang } from "../../app/i18n/lang.js";
import type { SectorPlan } from "../../app/scenario/plan-types.js";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import type { Audience } from "../../app/session/public-session.js";
import type { Camera } from "../../app/render/map-frame.js";
import type { TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem } from "../../app/session/training/spec.js";
import type { MapLock } from "../../app/render/ui/training-lock.js";

/** The live map's size in the PNG, px: the TAK shell's map at a 1440 × 900 window with GeoChat open beside it (about 984 × 680). */
export const LIVE_MAP_PX = { width: 1000, height: 680 } as const;

export interface MapPageData {
  readonly lang: Lang;
  readonly audience: Audience;
  readonly currentCycle: number;
  readonly clockLabel: string;
  readonly cycleInfo: RenderableCycle | null;
  readonly envelope: RenderableEnvelope | null;
  readonly recordedPlan: SectorPlan | null;
  readonly extent: Pick<GeoExtent, "south" | "north" | "west" | "east">;
  readonly widthPx: number;
  readonly heightPx: number;
  /** The participant's own camera (`map`), or null: the app's opening frame. */
  readonly camera: Camera | null;
  /** The legend open (the harness's default, as the tour opens it) or collapsed (`map legend` toggles it, as its button does). */
  readonly legend: boolean;
  /** The Range & Bearing line on the map (`measure`), or null. */
  readonly rb: { readonly from: LatLon; readonly to: LatLon } | null;
  /**
   * Revision (bp): the training's map — its view and item (for B's overlay) and the grid's margin and step in PNG pixels; absent for a
   * session view. `cycleInfo` is then the training's scene and `extent` its square.
   */
  readonly training?: { readonly view: TrainingView; readonly item: TrainingItem | null; readonly gridMarginPx: number; readonly gridStepPx: number; readonly lock: MapLock };
}

export type ImageRequest =
  | { readonly kind: "live"; readonly path: string; readonly data: MapPageData }
  /** `extent`: the box the blank map shows (default: the scenario's extent; the training's memory item: its lock box). */
  | { readonly kind: "freeze"; readonly path: string; readonly lang: Lang; readonly extent?: Pick<GeoExtent, "south" | "north" | "west" | "east"> }
  | { readonly kind: "training"; readonly path: string; readonly data: MapPageData };

/** The live map's data from a snapshot: only the fields `MapView` and the TAK chrome read. */
export function liveMapData(s: SessionSnapshot, extent: MapPageData["extent"], audience: Audience, camera: Camera | null, legend: boolean, rb: MapPageData["rb"]): MapPageData {
  return {
    lang: s.language, audience, currentCycle: s.currentCycle, clockLabel: s.clockLabel,
    cycleInfo: s.renderTree.cycleInfo, envelope: s.currentEnvelope, recordedPlan: s.recordedPlan,
    extent: { south: extent.south, north: extent.north, west: extent.west, east: extent.east },
    widthPx: LIVE_MAP_PX.width, heightPx: LIVE_MAP_PX.height, camera, legend, rb,
  };
}
