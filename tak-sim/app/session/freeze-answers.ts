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

/** An item as the freeze screen gets it: what it asks and its options' ids and labels — nothing else (I4). */
export interface ScreenFreezeItem {
  readonly id: string;
  readonly level: FreezeItem["level"];
  readonly promptFi: string;
  readonly kind?: NonNullable<FreezeItem["kind"]>;
  readonly options: readonly { readonly id: string; readonly labelFi: string }[];
}

/**
 * The screen's copy of a freeze item, built field by field (`31` §3.9, 19 Oct 2026): no TRUTH and no analysis metadata reaches
 * the render layer — not the keys (`mapKey`, each option's `correct`, `projectionPoint`, `projectionOptionId`, `truthOptionId`),
 * not `keyAtomIds`, `keyStatements`, `elementPatterns`, `lureStatements`, `basisAtomIds`, `basisKind`, `family` or `retrievalDependent` (a whitelist, so a field added later is
 * left out unless it is named here). Checked in `test/session/freeze-screen-items.spec.ts`.
 */
export function screenFreezeItem(item: FreezeItem): ScreenFreezeItem {
  return {
    id: item.id, level: item.level, promptFi: item.promptFi,
    ...(item.kind !== undefined ? { kind: item.kind } : {}),
    options: item.options.map(({ id, labelFi }) => ({ id, labelFi })),
  };
}

/**
 * `31` §3.8, F13 (19 Oct 2026): the clock the freeze's header states as "now" ("Kello pysähtyi klo …"), the study's dotted form
 * ("19.00"). `08` y.1: the clock on screen when the freeze opens — the start of the view's last step (a merged view's freeze falls
 * after its step boundary); for a freeze at the view's end (`FREEZE_AT_VIEW_END`) the view's end. `firstStepStartMin` is the
 * clock of the view's first step's start in minutes after midnight; `steps` the view's step count (1 or 2).
 */
export function freezeNowClock(firstStepStartMin: number, steps: number, atViewEnd: boolean): string {
  const minutes = firstStepStartMin + 20 * (atViewEnd ? steps : steps - 1);
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;
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
