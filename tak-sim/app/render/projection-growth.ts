/**
 * Which parts of the projection grow (SPEC/12 amendment 2 Oct 2026, later; review 3 Oct 2026). Pure geometry
 * in lon/lat, so the map (`ui/fire-layers.ts`) and the tests use the same rule: a part is drawn as a dashed line,
 * bands and label only when it grows beyond the fire inside it; when nothing grows anywhere, every part is drawn,
 * so the omission view (V9) has no form of its own.
 */

import type { LatLon, Polygon } from "../engine/primitives.js";
import { subtract, toLatLon, toPts, unionAll } from "./polygon-ops.js";

/** Even–odd point-in-ring test in lon/lat (fine at the scale of one incident). */
export function insideRing(p: LatLon, ring: readonly LatLon[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (a.lat > p.lat !== b.lat > p.lat && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) c = !c;
  }
  return c;
}

/** Area of a lon/lat ring in hectares (equirectangular). */
export function ringHa(ring: readonly LatLon[]): number {
  if (ring.length < 4) return 0;
  const k = Math.cos((ring[0]!.lat * Math.PI) / 180);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]!.lon * k - ring[i]!.lon * k) * (ring[j]!.lat + ring[i]!.lat);
  return (Math.abs(a) / 2) * (111_320 * 111_320) / 10_000;
}

/** Distance (m) from `p` to the nearest vertex of `ring` (vertices are a few metres apart). */
function nearVertexM(p: LatLon, ring: readonly LatLon[]): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (const q of ring) best = Math.min(best, Math.hypot((q.lat - p.lat) * 111_320, (q.lon - p.lon) * 111_320 * k));
  return best;
}

/** A projected outline hugging a fire ring runs a few metres either side of it; this much counts as on it (m). */
const HUG_M = 30;

/**
 * How much a projected part grows beyond the fire inside it (ha); ~0 for a part that only traces a held edge. A
 * fire ring counts as inside when ≥ 90 % of its vertices are inside the part or within `HUG_M` of its outline.
 */
export function growthHa(part: Polygon, fire: readonly Polygon[]): number {
  const ring = part[0];
  if (!ring) return 0;
  const covered = (f: readonly LatLon[]) => f.filter((v) => insideRing(v, ring) || nearVertexM(v, ring) <= HUG_M).length >= 0.9 * f.length;
  const inside = fire.reduce((s, q) => s + (q[0] && q[0].length >= 4 && covered(q[0]) ? ringHa(q[0]) : 0), 0);
  return ringHa(ring) - inside;
}

type Iso = { readonly minutes: number; readonly polygon: Polygon; readonly detachedParts: readonly Polygon[] };

/** A band piece smaller than this (ha) is a sliver along the fire edge, not a band. */
const SLIVER_HA = 0.01;

/**
 * The arrival-time bands (SPEC/12 revision (ah), 9 Oct 2026): each shown part of the k-th isochrone minus the
 * current fire and every inner isochrone — a true polygon difference, so no band ever covers the burned ground or
 * the burning zone, wherever a traced ring starts and however the smoothed isochrone cuts into the fire edge. `rank`
 * is the band's place from the fire outwards (0 = the first band); `rings` is [outer, ...holes], outer CCW, holes CW.
 */
export function projectionBands(isos: readonly Iso[], fire: readonly Polygon[], shown: (p: Polygon) => boolean = () => true): { rank: number; rings: LatLon[][] }[] {
  const sorted = [...isos].sort((a, b) => a.minutes - b.minutes);
  const outerRings = (ps: readonly Polygon[]) => ps.flatMap((p) => (p[0] && p[0].length >= 4 ? [toPts(p[0])] : []));
  let inner = outerRings(fire);
  const out: { rank: number; rings: LatLon[][] }[] = [];
  for (const [rank, iso] of sorted.entries()) {
    const parts = [iso.polygon, ...iso.detachedParts];
    const cut = unionAll(inner);
    for (const part of parts) {
      const ring = part[0];
      if (!ring || ring.length < 4 || !shown(part)) continue;
      for (const reg of subtract(toPts(ring), cut)) {
        const rings = [reg.outer, ...reg.holes].map((r) => { const ll = toLatLon(r); return [...ll, ll[0]!]; });
        const ha = ringHa(rings[0]!) - rings.slice(1).reduce((s, h) => s + ringHa(h), 0);
        if (ha >= SLIVER_HA) out.push({ rank, rings });
      }
    }
    inner = [...inner, ...outerRings(parts)];
  }
  return out;
}

/** The rule the map draws by: `growth` per part, and `shown` (every part when nothing grows anywhere). */
export function projectionGrowth(isos: readonly { readonly polygon: Polygon; readonly detachedParts: readonly Polygon[] }[], fire: readonly Polygon[], minHa: number) {
  const growth = (p: Polygon) => growthHa(p, fire);
  const anyGrows = isos.some((iso) => [iso.polygon, ...iso.detachedParts].some((p) => growth(p) > minHa));
  return { growth, anyGrows, shown: (p: Polygon) => !anyGrows || growth(p) > minHa };
}
