/**
 * The training incident against the map's geometry contract (`content/site/contract.json`, SPEC/33 §3; SPEC/08 (bp) §bp.2): which
 * contract features meet the training's locked area, the 20 kV line's geometry (the band every coordinate keeps clear of), and the
 * names and match patterns no training text may use. Pure; read by the build (`training.ts`) and by `test/training/*`.
 *
 * Site metres are the contract's: x east and y north from the point of origin (ETRS-TM35FIN 519 000 E, 6 746 000 N); the basemap's
 * pixel is 4 m, its north-west corner at site (−10 000, 10 000).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Px, Ring } from "./map-training-geometry.js";

type Coords = readonly number[] | readonly Coords[];
export interface ContractFeature {
  readonly id: string;
  readonly kind: string;
  readonly names: { readonly fi: string; readonly en: string };
  readonly match?: string | null;
  readonly geometry: { readonly type: string; readonly coordinates?: Coords };
}
export interface Contract { readonly features: readonly ContractFeature[] }

export function readContract(root: string): Contract {
  return JSON.parse(readFileSync(join(root, "content/site/contract.json"), "utf8")) as Contract;
}

const px = (c: readonly number[]): Px => ({ x: (c[0]! + 10_000) / 4, y: (10_000 - c[1]!) / 4 });

/** A feature's geometry as pixel polylines (a point is a one-vertex line; a polygon's rings are closed lines); none for a sector. */
export function featureLinesPx(f: ContractFeature): Px[][] {
  const c = f.geometry.coordinates;
  if (!c) return [];
  switch (f.geometry.type) {
    case "Point": return [[px(c as readonly number[])]];
    case "LineString": return [(c as readonly (readonly number[])[]).map(px)];
    case "MultiLineString": return (c as readonly (readonly (readonly number[])[])[]).map((l) => l.map(px));
    case "Polygon": return (c as readonly (readonly (readonly number[])[])[]).map((r) => [...r.map(px), px(r[0]!)]);
    default: return [];
  }
}

export function powerLinePx(contract: Contract): Ring {
  const f = contract.features.find((x) => x.id === "POWER_LINE");
  const lines = f ? featureLinesPx(f) : [];
  if (lines.length !== 1 || lines[0]!.length < 2) throw new Error("training: the contract has no POWER_LINE line");
  return lines[0]!.map((p) => [p.x, p.y] as const);
}

/** A box in pixels: the area grown by its lock margin. */
export interface BoxPx { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

function segmentBoxDist(a: Px, b: Px, box: BoxPx): number {
  // Sampled every pixel: exact enough for a margin of hundreds of metres, and plain.
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  let best = Infinity;
  for (let k = 0; k <= n; k++) {
    const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n;
    const dx = Math.max(box.x0 - x, 0, x - box.x1), dy = Math.max(box.y0 - y, 0, y - box.y1);
    best = Math.min(best, Math.hypot(dx, dy));
    if (best === 0) return 0;
  }
  return best;
}

/** A feature's distance from the box, px (0 when it meets it; a polygon holding the box meets it too). */
export function featureBoxDist(f: ContractFeature, box: BoxPx): number {
  const lines = featureLinesPx(f);
  let best = Infinity;
  for (const l of lines) {
    if (l.length === 1) best = Math.min(best, segmentBoxDist(l[0]!, l[0]!, box));
    for (let i = 0; i + 1 < l.length; i++) best = Math.min(best, segmentBoxDist(l[i]!, l[i + 1]!, box));
  }
  if (f.geometry.type === "Polygon" && lines[0]) {
    const ring = lines[0], c = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!, b = ring[j]!;
      if ((a.y > c.y) !== (b.y > c.y) && c.x < ((b.x - a.x) * (c.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    if (hit) best = 0;
  }
  return best;
}

/** The contract features that meet the box (sectors are bearings, not map features, and are left out), and the nearest other. */
export function contractCheck(contract: Contract, box: BoxPx): { readonly met: readonly string[]; readonly nearestOther: { readonly id: string; readonly metres: number } } {
  const rows = contract.features.filter((f) => f.geometry.type !== "Sector").map((f) => ({ id: f.id, d: featureBoxDist(f, box) }));
  const met = rows.filter((r) => r.d === 0).map((r) => r.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const other = rows.filter((r) => r.d > 0).sort((a, b) => (a.d - b.d) || (a.id < b.id ? -1 : 1))[0]!;
  return { met, nearestOther: { id: other.id, metres: Math.round(other.d * 4) } };
}

/**
 * The patterns no training text may match (SPEC/08 (bp) §bp.8): every contract feature's Finnish and English name and its match
 * pattern (case-insensitive), sectors and anchors included. The anchors' ids are codes, matched as whole words.
 */
export function contractPatterns(contract: Contract): readonly { readonly id: string; readonly re: RegExp }[] {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out: { id: string; re: RegExp }[] = [];
  for (const f of contract.features) {
    for (const name of new Set([f.names.fi, f.names.en])) out.push({ id: `${f.id}.name`, re: new RegExp(`(^|[^\\p{L}\\p{N}])${esc(name)}($|[^\\p{L}\\p{N}])`, "iu") });
    if (f.match) out.push({ id: `${f.id}.match`, re: new RegExp(f.match, "iu") });
  }
  return out;
}
