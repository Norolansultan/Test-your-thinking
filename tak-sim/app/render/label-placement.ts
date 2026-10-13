/**
 * Fire-label placement (SPEC/12 revisions (ah) and (al)), pure so it can be tested at any map size without a browser;
 * `fire-layers.ts` measures the DOM and applies the result.
 *
 * Order: spot-fire labels first, then the projection's, then the earlier perimeters' (by key within each). Each label
 * takes the first candidate position that lies inside the map and clears the map's own overlays (wind, zoom buttons,
 * legend, scale bar) and every label placed before it.
 *
 * - **Spot-fire labels never yield to unit markers** (revision (al)): V13's planted US2 sits ~140 m from KY23's crew,
 *   and whether its label was shown used to depend on the window size. Spot labels ignore the units and are drawn
 *   above them; every other label still keeps clear of the units.
 * - **Earlier-perimeter labels sit on their own line** (revision (al)): each has a list of anchor points on its ring,
 *   the same bearings in the same order for every ring, and is centred on the first anchor that is free. Rings nest
 *   outward in time, so the times read in order along the spread direction (V9 had shown "16:40 / 17:00 / 16:20"
 *   when the labels were pushed off their lines around one point).
 */

import type { ScreenPoint } from "./map-frame.js";

export interface Rect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export type LabelKind = "spot" | "iso" | "past";

export interface LabelRequest {
  readonly key: string;
  readonly kind: LabelKind;
  /** Candidate anchor points, in order of preference. Spot and projection labels have one; earlier perimeters several. */
  readonly anchors: readonly ScreenPoint[];
  readonly w: number;
  readonly h: number;
}

export interface LabelPlacement {
  /** Index into `anchors`. */
  readonly anchor: number;
  /** Offset of the label's centre from the anchor, px. */
  readonly dx: number;
  readonly dy: number;
}

/** Where a spot or projection label may sit around its point: right, left, above, below, the diagonals, then further out. */
export const AROUND: readonly ((w: number, h: number) => readonly [number, number])[] = [
  (w) => [w / 2 + 6, 0], (w) => [-(w / 2 + 6), 0], (_, h) => [0, -(h / 2 + 6)], (_, h) => [0, h / 2 + 6],
  (w, h) => [w / 2 + 6, -(h / 2 + 6)], (w, h) => [w / 2 + 6, h / 2 + 6], (w, h) => [-(w / 2 + 6), -(h / 2 + 6)], (w, h) => [-(w / 2 + 6), h / 2 + 6],
  (w) => [w / 2 + 40, 0], (w) => [-(w / 2 + 40), 0], (_, h) => [0, -(h / 2 + 30)], (_, h) => [0, h / 2 + 30],
];

const ORDER: Record<LabelKind, number> = { spot: 0, iso: 1, past: 2 };

const intersects = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inside = (r: Rect, box: Rect) => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;

/**
 * Places the labels. `overlays` are the map's own boxes (wind, zoom, legend, scale), `units` the unit markers' drawn
 * boxes, `bounds` the map. Returns each label's placement, or null when it has none free (it is hidden).
 */
export function placeLabels(labels: readonly LabelRequest[], overlays: readonly Rect[], units: readonly Rect[], bounds: Rect): Map<string, LabelPlacement | null> {
  const ordered = [...labels].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const placed: Rect[] = [];
  const out = new Map<string, LabelPlacement | null>();
  for (const l of ordered) {
    const blockers = l.kind === "spot" ? [...overlays, ...placed] : [...overlays, ...units, ...placed];
    const tries: LabelPlacement[] = l.kind === "past"
      ? l.anchors.map((_, k) => ({ anchor: k, dx: 0, dy: 0 }))
      : l.anchors.length === 0 ? [] : AROUND.map((f) => { const [dx, dy] = f(l.w, l.h); return { anchor: 0, dx, dy }; });
    let chosen: LabelPlacement | null = null;
    for (const t of tries) {
      const a = l.anchors[t.anchor]!;
      const r = { left: a.x + t.dx - l.w / 2, right: a.x + t.dx + l.w / 2, top: a.y + t.dy - l.h / 2, bottom: a.y + t.dy + l.h / 2 };
      if (inside(r, bounds) && !blockers.some((b) => intersects(r, b))) { placed.push(r); chosen = t; break; }
    }
    out.set(l.key, chosen);
  }
  return out;
}

/** Bearings (degrees from the spread direction) at which an earlier perimeter's label may sit, in order. */
export const PAST_LABEL_BEARINGS: readonly number[] = [0, 25, -25, 50, -50, 75, -75, 100, -100];
