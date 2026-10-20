/**
 * The game world's water points (`tools/game/build-world.ts`).
 *
 * Every lake, pond, river and brook within the grid plus margin gives one or more places a vehicle draws water:
 * a road node within `reachM` of the shore (on a road a vehicle drives: main, gravel, forest or track — not a
 * footpath), the nearest first, the next at least `spacingM` along. Off the river's bridge decks (a tanker does not
 * fill standing on a load-limited bridge). A lake no road reaches still gets one point for aircraft and the forest
 * unit's portable pump (`roadNode: null`, on the shore nearest the road network). The scoop point is the lake's own
 * centre (its pole of inaccessibility), or the channel beside the draw point.
 *
 * Names come from the map's water labels, matched by what the Finnish name says the water is (-järvi a lake,
 * -lampi a pond, -joki a river, -oja / -puro a brook), so Korpioja's label, which sits on Karhujärvi, names the brook
 * and not the lake. Unnamed water is named after the map's nearest lake or place label, each such name once:
 * "Lahdenkylän lampi" / "Bay Village Pond", "Pikku-Pitkäjärvi" (`names.ts`). Points sharing a name are told apart by
 * compass side,
 * "Karhujärvi (itä)" / "Bear Lake (east)", or, when two share a side, numbered: "Kotkanjoki 2" / "Eagle River 2".
 * Draw points are only on the road network the command post is on (where a tanker can actually drive).
 */

import type { RoadClass, WaterPoint } from "../../../app/game/contracts.js";
import { dist, distToArea, inBox, nearestOnLine, nearestOnRing, poleOf, slug, type Box, type Pt } from "./geom.js";
import { nameUnnamed, type AnchorLabel } from "./names.js";

export type WaterKind = WaterPoint["kind"];

export interface WaterBody {
  readonly kind: WaterKind;
  /** Lakes and ponds: the outline. */
  readonly ring?: readonly Pt[];
  /** Rivers and brooks: the channel's line. */
  readonly line?: readonly Pt[];
}

export interface WaterLabel { readonly fi: string; readonly en: string; readonly at: Pt }

export interface WaterGraph {
  readonly nodes: readonly Pt[];
  readonly edges: readonly { readonly a: number; readonly b: number; readonly cls: RoadClass }[];
  /** 1 for nodes on the network the command post is on: draw points are only where a tanker can drive to. */
  readonly reachable: Uint8Array;
}

export interface WaterOptions {
  readonly box: Box;
  readonly reachM: number;
  /** Minimum distance from the river's centreline for a draw point (off the bridge). */
  readonly riverBankM: number;
  /** Draw points of different waters stand at least this far apart (the earlier water — lakes first — keeps its). */
  readonly minApartM: number;
  /** The map's lake, pond, place, village, terrain and bog labels: unnamed water is named after them (`names.ts`). */
  readonly anchors: readonly AnchorLabel[];
}

interface DrawPoint { readonly at: Pt; readonly roadNode: number | null; readonly scoop: Pt }
export interface BuiltWaterPoint extends DrawPoint { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly kind: WaterKind }

const PER_BODY: Readonly<Record<WaterKind, { max: number; spacingM: number }>> = {
  lake: { max: 3, spacingM: 700 },
  pond: { max: 1, spacingM: 0 },
  river: { max: 4, spacingM: 1500 },
  brook: { max: 2, spacingM: 1200 },
};


const COMPASS_FI = ["pohjoinen", "koillinen", "itä", "kaakko", "etelä", "lounas", "länsi", "luode"] as const;
const COMPASS_EN = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] as const;

/** What a Finnish hydronym says the water is. */
export function hydronymKind(fi: string): WaterKind | null {
  const s = fi.toLowerCase();
  if (s.endsWith("järvi")) return "lake";
  if (s.endsWith("lampi")) return "pond";
  if (s.endsWith("joki")) return "river";
  if (s.endsWith("oja") || s.endsWith("puro")) return "brook";
  return null;
}

/** The lake-or-pond label for an outline: inside it (nearest its centre), else the nearest within 300 m of it. */
function labelForArea(ring: readonly Pt[], centre: Pt, labels: readonly WaterLabel[]): WaterLabel | null {
  let best: WaterLabel | null = null;
  let bestKey = Infinity;
  for (const l of labels) {
    const k = hydronymKind(l.fi);
    if (k !== "lake" && k !== "pond") continue;
    const d = distToArea(l.at, ring);
    if (d > 300) continue;
    const key = d === 0 ? dist(l.at, centre) : 1e6 + d;
    if (key < bestKey) { bestKey = key; best = l; }
  }
  return best;
}

/** The river or brook label nearest a channel (a river takes its river's name however far the label is). */
function labelForLine(kind: WaterKind, line: readonly Pt[], labels: readonly WaterLabel[]): WaterLabel | null {
  let best: WaterLabel | null = null;
  let bestD = kind === "river" ? Infinity : 600;
  for (const l of labels) {
    if (hydronymKind(l.fi) !== kind) continue;
    const d = nearestOnLine(l.at, line).d;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}

export function buildWaterPoints(bodies: readonly WaterBody[], labels: readonly WaterLabel[], g: WaterGraph, o: WaterOptions): BuiltWaterPoint[] {
  const RANK: Readonly<Record<RoadClass, number>> = { main: 0, gravel: 0, forest: 0, track: 1, path: 9 };
  const nodeRank = g.nodes.map(() => 9);
  for (const e of g.edges) {
    nodeRank[e.a] = Math.min(nodeRank[e.a]!, RANK[e.cls]);
    nodeRank[e.b] = Math.min(nodeRank[e.b]!, RANK[e.cls]);
  }
  const drivable = g.nodes.map((_, i) => i).filter((i) => nodeRank[i]! < 9 && g.reachable[i] === 1);
  const named: { nameFi: string; nameEn: string; kind: WaterKind; points: DrawPoint[]; centre: Pt; unnamed: boolean }[] = [];

  for (const body of bodies) {
    const area = body.ring;
    const line = body.line;
    let centre: Pt;
    let shoreDist: (p: Pt) => number;
    if (area) {
      centre = poleOf(area);
      if (!inBox(centre, o.box) && !area.some((p) => inBox(p, o.box))) continue;
      shoreDist = (p) => distToArea(p, area);
    } else if (line) {
      if (line.length < 2) continue;
      centre = line[Math.floor(line.length / 2)]!;
      shoreDist = (p) => nearestOnLine(p, line).d;
    } else continue;

    // A lake or pond is what its name says (else what its area suggested).
    const label = area ? labelForArea(area, centre, labels) : labelForLine(body.kind, line!, labels);
    const kind: WaterKind = (area && label ? hydronymKind(label.fi) : null) ?? body.kind;

    // Candidates: drivable nodes within reach, by (road rank, distance, id).
    const cands = drivable
      .map((id) => ({ id, d: shoreDist(g.nodes[id]!) }))
      .filter((c) => c.d <= o.reachM && inBox(g.nodes[c.id]!, o.box) && !(kind === "river" && c.d < o.riverBankM))
      .sort((p, q) => nodeRank[p.id]! - nodeRank[q.id]! || p.d - q.d || p.id - q.id);
    const { max, spacingM } = PER_BODY[kind];
    const picked: DrawPoint[] = [];
    for (const c of cands) {
      if (picked.length >= max) break;
      const at = g.nodes[c.id]!;
      if (picked.some((p) => dist(p.at, at) < Math.max(spacingM, 1))) continue;
      // Not beside another water's draw point (Korpioja runs into Karhujärvi where Mökkiranta's road ends).
      if (named.some((b) => b.points.some((p) => p.roadNode !== null && dist(p.at, at) < o.minApartM))) continue;
      picked.push({ at, roadNode: c.id, scoop: area ? centre : nearestOnLine(at, line!).q });
    }
    if (picked.length === 0) {
      if (!area) continue; // a river or brook no road reaches gives no draw point
      // Aircraft and portable pumps: the shore nearest the road network.
      let best = { id: -1, d: Infinity };
      for (const id of drivable) {
        const d = shoreDist(g.nodes[id]!);
        if (d < best.d) best = { id, d };
      }
      const at = best.id >= 0 ? nearestOnRing(g.nodes[best.id]!, area).q : nearestOnRing(centre, area).q;
      picked.push({ at, roadNode: null, scoop: centre });
    }

    named.push({ nameFi: label?.fi ?? "", nameEn: label?.en ?? "", kind, points: picked, centre, unnamed: label === null });
  }

  // Ids and names: points that share a name ("Kotkanjoki", or Korpioja on both sides of Karhujärvi) are told apart
  // by compass side from their middle when no two share a side, else numbered in order ("Kotkanjoki 2").
  const unnamed = named.filter((b) => b.unnamed);
  nameUnnamed(unnamed.map((b) => ({ kind: b.kind, at: b.centre })), o.anchors).forEach(([fi, en], k) => {
    unnamed[k]!.nameFi = fi;
    unnamed[k]!.nameEn = en;
  });
  const flat = named.flatMap((b) => b.points.map((p) => ({ b, p })));
  const groups = new Map<string, { at: Pt; oct: number }[]>();
  for (const { b, p } of flat) {
    const list = groups.get(b.nameFi);
    if (list) list.push({ at: p.at, oct: -1 }); else groups.set(b.nameFi, [{ at: p.at, oct: -1 }]);
  }
  const compass = new Map<string, boolean>();
  for (const [name, list] of groups) {
    const cx = list.reduce((s, q) => s + q.at.x, 0) / list.length;
    const cy = list.reduce((s, q) => s + q.at.y, 0) / list.length;
    for (const q of list) q.oct = Math.round(((((Math.atan2(q.at.x - cx, q.at.y - cy) * 180) / Math.PI) + 360) % 360) / 45) % 8;
    compass.set(name, new Set(list.map((q) => q.oct)).size === list.length);
  }
  const out: BuiltWaterPoint[] = [];
  const seenInGroup = new Map<string, number>();
  for (const { b, p } of flat) {
    const k = (seenInGroup.get(b.nameFi) ?? 0) + 1;
    seenInGroup.set(b.nameFi, k);
    const list = groups.get(b.nameFi)!;
    let nameFi = b.nameFi;
    let nameEn = b.nameEn;
    if (list.length > 1 && compass.get(b.nameFi)) {
      const oct = list[k - 1]!.oct;
      nameFi = `${b.nameFi} (${COMPASS_FI[oct]})`;
      nameEn = `${b.nameEn} (${COMPASS_EN[oct]})`;
    } else if (list.length > 1) {
      nameFi = `${b.nameFi} ${k}`;
      nameEn = `${b.nameEn} ${k}`;
    }
    const base = slug(b.nameFi);
    out.push({ id: k === 1 ? base : `${base}-${k}`, nameFi, nameEn, kind: b.kind, ...p });
  }
  return out;
}
