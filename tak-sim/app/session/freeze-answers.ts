/**
 * The SAGAT freeze's answers at the session boundary (SPEC/15 r.12, 2 Oct 2026): what each item
 * asks, and the check `submitFreeze` runs before anything is logged. Split out of `orchestrator.ts`.
 *
 * - A `choice` item's answer is one of its option ids; a `map_point` item's is `"map_point"` with
 *   the tapped `point`, which must lie inside the scenario's extent.
 * - The confidence is on the scale (`confidence.ts`).
 * - No source question (researcher decision 2 Oct 2026, SPEC/08 amendment): a `source` sent with an
 *   answer is dropped. Where information reached the participant is in the log itself
 *   (`freezeItemExposure` in `telemetry/freeze-measures.ts`).
 *
 * Completeness (every item answered) is the screen's job: its submit stays off until then.
 */

import type { GeoExtent, LatLon } from "../engine/primitives.js";
import type { FreezeItem } from "../scenario/types.js";
import type { FreezeItemAnsweredDetail } from "../telemetry/record-kinds.js";
import { assertConfidenceStep } from "./confidence.js";

/** The `optionId` a map item's answer carries (`FreezeItemAnsweredDetail`). */
export const MAP_POINT_OPTION_ID = "map_point";

type ItemShape = Pick<FreezeItem, "id" | "level" | "kind"> & { readonly options: readonly Pick<FreezeItem["options"][number], "id">[] };

export function isMapItem(item: Pick<FreezeItem, "kind">): boolean {
  return item.kind === "map_point";
}

/*
 * No fire-centred framing here any more (SPEC/12 revision (aj), 9 Oct 2026): `freezeMapFrame` (2 Oct 2026) framed
 * the memory-check map on the fire as last reported; the map now opens on the scenario's extent, like the live map,
 * so no frame is derived from the view. That every map key lies inside the extent with its tolerance to spare is
 * checked in `test/session/freeze-map-frame.spec.ts`.
 */

export function insideExtent(point: LatLon, extent: Pick<GeoExtent, "south" | "north" | "west" | "east">): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && point.lat >= extent.south && point.lat <= extent.north && point.lon >= extent.west && point.lon <= extent.east;
}

/** One item's answer so far, as the screen holds it. */
export interface FreezeDraft {
  readonly optionId?: string;
  readonly point?: LatLon;
  readonly confidence?: number;
}

export function draftComplete(item: ItemShape, draft: FreezeDraft | undefined): boolean {
  if (!draft || draft.confidence === undefined) return false;
  const answered = isMapItem(item) ? draft.point !== undefined : draft.optionId !== undefined;
  return answered;
}

/** The responses the screen sends: map items with their point. */
export function responsesFromDrafts(items: readonly ItemShape[], drafts: Readonly<Record<string, FreezeDraft>>): FreezeItemAnsweredDetail[] {
  return items.map((item) => {
    const d = drafts[item.id] ?? {};
    return {
      itemId: item.id,
      optionId: isMapItem(item) ? MAP_POINT_OPTION_ID : d.optionId!,
      confidence: d.confidence!,
      ...(isMapItem(item) && d.point ? { point: { lat: d.point.lat, lon: d.point.lon } } : {}),
    };
  });
}

/**
 * A skipped freeze's responses (demonstration only, 6 Oct 2026): only the items answered in full so far,
 * so nothing incomplete reaches `checkFreezeResponses`; sent with `submitFreeze(…, { skipped: true })`.
 */
export function skippedResponses(items: readonly ItemShape[], drafts: Readonly<Record<string, FreezeDraft>>): FreezeItemAnsweredDetail[] {
  return responsesFromDrafts(items.filter((item) => draftComplete(item, drafts[item.id])), drafts);
}

/**
 * Validates the freeze's responses against this freeze's items and returns clean copies (any
 * `source` and a choice item's point dropped). Throws on anything else.
 */
export function checkFreezeResponses(
  items: readonly ItemShape[],
  responses: readonly FreezeItemAnsweredDetail[],
  extent: Pick<GeoExtent, "south" | "north" | "west" | "east">,
): FreezeItemAnsweredDetail[] {
  const seen = new Set<string>();
  return responses.map((r) => {
    assertConfidenceStep(r.confidence);
    const item = items.find((it) => it.id === r.itemId);
    if (!item) throw new Error(`freeze answer for an item not in this freeze: ${r.itemId}`);
    if (seen.has(item.id)) throw new Error(`freeze item answered twice: ${item.id}`);
    seen.add(item.id);
    let point: LatLon | undefined;
    if (isMapItem(item)) {
      if (r.optionId !== MAP_POINT_OPTION_ID) throw new Error(`map item ${item.id}: optionId must be "${MAP_POINT_OPTION_ID}"`);
      if (!r.point || !insideExtent(r.point, extent)) throw new Error(`map item ${item.id}: a point inside the scenario extent is required`);
      point = { lat: r.point.lat, lon: r.point.lon };
    } else if (!item.options.some((o) => o.id === r.optionId)) {
      throw new Error(`freeze item ${item.id}: no option ${r.optionId}`);
    }
    return {
      itemId: item.id, optionId: r.optionId, confidence: r.confidence,
      ...(point ? { point } : {}),
    };
  });
}
