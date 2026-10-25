/**
 * What the play harness's images are made from (`tools/play/`): pure data, built in the harness from the session's snapshot and
 * drawn in Chromium by `map-render.ts`. Four kinds, each the participant's own picture of that moment:
 *
 * - `live`: the live TAK map (`map-page.ts`) — the snapshot's renderable data only, as `MapView` reads it;
 * - `freeze`: a `map_point` freeze item's map — the plain basemap (no fire, no units, no overlay: the app's `FreezeMap`), cropped to
 *   the scenario's extent (where an answer may lie) with a labelled pixel grid, so the player can answer with x,y
 *   (`freeze-grid.ts` converts with the app's own basemap projection, `basemap-px.ts`);
 * - `pretest`: the map training's task on its extract (`trainingSvg`, the app's markup: the question's marks, the memory task's unit or
 *   blank map, the feedback's drawing) with a labelled pixel grid, so the player can answer with x,y;
 * - `head`: the practice feedback's head map (the basemap's tiles, the outline as the practice map drew it, the head, the mark).
 *
 * No answer key of a scored item is ever in this data (the freeze map is the basemap and a grid; the training shows its own keys only
 * in its feedback, as the app does).
 */

import type { RenderableCycle, RenderableEnvelope } from "../../app/boundary/render-boundary.js";
import type { GeoExtent, LatLon } from "../../app/engine/primitives.js";
import type { Lang } from "../../app/i18n/lang.js";
import type { SectorPlan } from "../../app/scenario/plan-types.js";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import type { Audience } from "../../app/session/public-session.js";
import type { Camera } from "../../app/render/map-frame.js";
import type { TrainingAnswer, TrainingPhase } from "../../app/session/map-training-spec.js";

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
}

export type ImageRequest =
  | { readonly kind: "live"; readonly path: string; readonly data: MapPageData }
  | { readonly kind: "freeze"; readonly path: string; readonly lang: Lang }
  | { readonly kind: "pretest"; readonly path: string; readonly lang: Lang; readonly taskId: string; readonly phase: TrainingPhase; readonly answer: TrainingAnswer | null }
  | { readonly kind: "head"; readonly path: string; readonly lang: Lang; readonly head: { readonly mark: LatLon | null; readonly head: LatLon; readonly outline: readonly LatLon[] } };

/** The live map's data from a snapshot: only the fields `MapView` and the TAK chrome read. */
export function liveMapData(s: SessionSnapshot, extent: MapPageData["extent"], audience: Audience, camera: Camera | null, legend: boolean, rb: MapPageData["rb"]): MapPageData {
  return {
    lang: s.language, audience, currentCycle: s.currentCycle, clockLabel: s.clockLabel,
    cycleInfo: s.renderTree.cycleInfo, envelope: s.currentEnvelope, recordedPlan: s.recordedPlan,
    extent: { south: extent.south, north: extent.north, west: extent.west, east: extent.east },
    widthPx: LIVE_MAP_PX.width, heightPx: LIVE_MAP_PX.height, camera, legend, rb,
  };
}
