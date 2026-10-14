/**
 * The game world's assets and settlements (`tools/game/build-world.ts`).
 *
 * Assets: the map's buildings within the grid plus margin — houses (the MML symbol for residential and holiday
 * buildings, value 100) and other buildings (saunas, barns, huts: "barn", value 30) — and the 110 kV line's pylons,
 * one every `pylonSpacingM` along it (value 20).
 *
 * Settlements: buildings within `clusterM` of each other form a cluster (single linkage); a cluster takes the name of
 * the nearest village or place label within `nameM` of one of its buildings, each label naming one cluster (nearest
 * pairs first; the `required` names first of all, and the build fails if one of them finds no cluster). A cluster is
 * a settlement when it is named or has at least `minUnnamed` buildings ("Asutus 1" / "Settlement 1").
 */

import type { AssetKind } from "../../../app/game/contracts.js";
import { clipLine, dist, inBox, lerp, slug, type Box, type Pt } from "./geom.js";

export interface Building { readonly at: Pt; readonly kind: "house" | "other" }
export interface PlaceLabel { readonly fi: string; readonly en: string; readonly at: Pt; readonly style: string }

export interface BuiltAsset { readonly id: string; readonly kind: AssetKind; readonly at: Pt; readonly value: number; settlementId: string | null }
export interface BuiltSettlement { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly centre: Pt; readonly assetIds: readonly string[] }

export interface PlacesOptions {
  readonly box: Box;
  readonly clusterM: number;
  readonly nameM: number;
  /** Required names get this much farther to find their cluster. */
  readonly requiredNameM: number;
  readonly minUnnamed: number;
  readonly pylonSpacingM: number;
  /** Labels with these styles name settlements. */
  readonly settlementStyles: readonly string[];
  /** Finnish names that must become settlements when their label exists. */
  readonly required: readonly string[];
}

export const ASSET_VALUE: Readonly<Record<AssetKind, number>> = { house: 100, cabin: 80, farm: 100, barn: 30, power_pylon: 20, other: 10 };

const pad = (n: number) => String(n).padStart(3, "0");

export function buildPlaces(buildings: readonly Building[], powerLine: readonly Pt[], labels: readonly PlaceLabel[], o: PlacesOptions): {
  assets: BuiltAsset[]; settlements: BuiltSettlement[]; missingRequired: string[];
} {
  // Buildings.
  const assets: BuiltAsset[] = [];
  const counts = new Map<AssetKind, number>();
  const nextId = (kind: AssetKind, prefix: string) => {
    const n = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, n);
    return `${prefix}-${pad(n)}`;
  };
  for (const b of buildings) {
    if (!inBox(b.at, o.box)) continue;
    const kind: AssetKind = b.kind === "house" ? "house" : "barn";
    assets.push({ id: nextId(kind, kind), kind, at: b.at, value: ASSET_VALUE[kind], settlementId: null });
  }
  const nBuildings = assets.length;

  // Pylons: every pylonSpacingM from the line's own start, those inside the box.
  let s0 = 0;
  for (let k = 0; k + 1 < powerLine.length; k++) {
    const a = powerLine[k]!;
    const b = powerLine[k + 1]!;
    const len = dist(a, b);
    for (let s = Math.ceil(s0 / o.pylonSpacingM) * o.pylonSpacingM; s <= s0 + len; s += o.pylonSpacingM) {
      const p = lerp(a, b, (s - s0) / len);
      if (inBox(p, o.box)) assets.push({ id: nextId("power_pylon", "pylon"), kind: "power_pylon", at: p, value: ASSET_VALUE.power_pylon, settlementId: null });
    }
    s0 += len;
  }

  // Clusters of buildings (single linkage), each listed by its lowest member.
  const parent = Array.from({ length: nBuildings }, (_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[i] !== r) { const n = parent[i]!; parent[i] = r; i = n; }
    return r;
  };
  for (let i = 0; i < nBuildings; i++) {
    for (let j = i + 1; j < nBuildings; j++) {
      if (dist(assets[i]!.at, assets[j]!.at) <= o.clusterM) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const clusterOf = new Map<number, number[]>();
  for (let i = 0; i < nBuildings; i++) {
    const r = find(i);
    const list = clusterOf.get(r);
    if (list) list.push(i); else clusterOf.set(r, [i]);
  }
  const clusters = [...clusterOf.keys()].sort((a, b) => a - b).map((r) => clusterOf.get(r)!);

  // Names: (label, cluster) pairs by distance to the nearest member; required labels first.
  const placeLabels = labels.filter((l) => o.settlementStyles.includes(l.style));
  const pairs: { li: number; ci: number; d: number; req: boolean }[] = [];
  placeLabels.forEach((l, li) => {
    const req = o.required.includes(l.fi);
    clusters.forEach((members, ci) => {
      let d = Infinity;
      for (const m of members) d = Math.min(d, dist(l.at, assets[m]!.at));
      if (d <= (req ? o.requiredNameM : o.nameM)) pairs.push({ li, ci, d, req });
    });
  });
  pairs.sort((p, q) => Number(q.req) - Number(p.req) || p.d - q.d || p.li - q.li || p.ci - q.ci);
  const nameOf = new Map<number, PlaceLabel>();
  const labelUsed = new Set<number>();
  for (const p of pairs) {
    if (labelUsed.has(p.li) || nameOf.has(p.ci)) continue;
    labelUsed.add(p.li);
    nameOf.set(p.ci, placeLabels[p.li]!);
  }
  const missingRequired = o.required.filter((fi) => placeLabels.some((l) => l.fi === fi) && ![...nameOf.values()].some((l) => l.fi === fi));

  const settlements: BuiltSettlement[] = [];
  let unnamed = 0;
  const ids = new Set<string>();
  clusters.forEach((members, ci) => {
    const label = nameOf.get(ci);
    if (!label && members.length < o.minUnnamed) return;
    let nameFi: string;
    let nameEn: string;
    if (label) { nameFi = label.fi; nameEn = label.en; } else { unnamed++; nameFi = `Asutus ${unnamed}`; nameEn = `Settlement ${unnamed}`; }
    let id = slug(nameFi);
    for (let k = 2; ids.has(id); k++) id = `${slug(nameFi)}-${k}`;
    ids.add(id);
    let cx = 0;
    let cy = 0;
    for (const m of members) { cx += assets[m]!.at.x; cy += assets[m]!.at.y; assets[m]!.settlementId = id; }
    settlements.push({ id, nameFi, nameEn, centre: { x: cx / members.length, y: cy / members.length }, assetIds: members.map((m) => assets[m]!.id) });
  });
  return { assets, settlements, missingRequired };
}

/** The power line inside the box (its longest run there). */
export function clipPowerLine(line: readonly Pt[], box: Box): Pt[] {
  const runs = clipLine(line, box);
  let best: Pt[] = [];
  let bestLen = -1;
  for (const r of runs) {
    let len = 0;
    for (let k = 1; k < r.pts.length; k++) len += dist(r.pts[k - 1]!, r.pts[k]!);
    if (len > bestLen) { bestLen = len; best = r.pts; }
  }
  return best;
}
