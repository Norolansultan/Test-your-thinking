/**
 * Names for the game world's features the map leaves unnamed (`tools/game/build-world.ts`).
 *
 * The map names only some of its water: the generator (`tools/topo-map/water.ts`) has a fixed pool of lake names and
 * leaves the rest unlabelled, and most brooks carry no label. The game still has to call a draw point something, so
 * an unnamed lake, pond, river or brook takes its name from a nearby named lake or pond, or place, village, terrain
 * or bog label, the way unnamed water is spoken of in Finland: "Lahdenkylän lampi" (Lahdenkylä's pond),
 * "Pitkäjärven oja" (the brook at Pitkäjärvi), "Pikku-Pitkäjärvi" (a lake within `LITTLE_M` of Pitkäjärvi). Nearest
 * pairs first and each name once, so two waters at one place take two places' names. Only the map's own names are
 * used; nothing is numbered or invented ("Lampi 1", "Oja 7" before 20 Oct 2026). Should there be more unnamed waters
 * than names, the rest share their nearest place's, told apart as all shared names are (`water.ts`).
 *
 * Finnish genitives do not follow from the spelling alone (Mökkiranta → Mökkirannan, Kuivakangas → Kuivakankaan,
 * Rinne → Rinteen), so each place label has its genitive here, and a label without one fails the build; lake and
 * pond names end in -järvi / -lampi, whose genitives are regular (-järven, -lammen).
 */

import { dist, type Pt } from "./geom.js";
import type { WaterKind } from "./water.js";

/** The map's place, village, terrain and bog labels (`tools/topo-map/places.ts`, `fields.ts`), in the genitive. */
export const GENITIVE_FI: Readonly<Record<string, string>> = {
  Lahdenkylä: "Lahdenkylän",
  Hiekkala: "Hiekkalan",
  Mökkiranta: "Mökkirannan",
  Rahkasuo: "Rahkasuon",
  "Iso-Rahkasuo": "Iso-Rahkasuon",
  Kuivakangas: "Kuivakankaan",
  Kuusimäki: "Kuusimäen",
  Korpilaakso: "Korpilaakson",
  Honkaharju: "Honkaharjun",
  Rinne: "Rinteen",
  Mäkelä: "Mäkelän",
  Niemelä: "Niemelän",
  Koivula: "Koivulan",
  Harju: "Harjun",
  Peltola: "Peltolan",
};

/** Label styles that anchor an unnamed water's name (and water labels naming a lake or pond). */
export const ANCHOR_STYLES: readonly string[] = ["village", "place", "terrain", "bog"];

/** "Pitkäjärvi" → "Pitkäjärven", "Haukilampi" → "Haukilammen"; null for any other name. */
export function lakeGenitive(fi: string): string | null {
  if (fi.endsWith("järvi")) return `${fi.slice(0, -1)}en`;
  if (fi.endsWith("lampi")) return `${fi.slice(0, -3)}mmen`;
  return null;
}

/** The genitive of an anchor label, or undefined. */
const genitive = (fi: string): string | undefined => GENITIVE_FI[fi] ?? lakeGenitive(fi) ?? undefined;

export interface AnchorLabel { readonly fi: string; readonly en: string; readonly at: Pt }

const NOUN: Readonly<Record<WaterKind, readonly [string, string]>> = {
  lake: ["järvi", "Lake"], pond: ["lampi", "Pond"], river: ["joki", "River"], brook: ["oja", "Brook"],
};

/** Fails when an anchor label has no genitive (add it to `GENITIVE_FI`). */
export function checkAnchors(anchors: readonly AnchorLabel[]): void {
  const missing = anchors.filter((a) => genitive(a.fi) === undefined).map((a) => a.fi);
  if (missing.length > 0) throw new Error(`no Finnish genitive for map label(s): ${missing.join(", ")} (tools/game/world/names.ts)`);
}

/** A lake or pond this close to a named one may be its "little" one. */
export const LITTLE_M = 2000;

/** The name unnamed water of `kind` takes after anchor `a`. */
function nameAfter(kind: WaterKind, a: AnchorLabel, d: number): readonly [string, string] {
  // A lake or pond beside a named one is its "little" one, as Finnish lakes often are: "Pikku-Pitkäjärvi".
  if ((kind === "lake" || kind === "pond") && lakeGenitive(a.fi) !== null) {
    return d <= LITTLE_M ? [`Pikku-${a.fi}`, `Little ${a.en}`] : ["", ""];
  }
  const [fi, en] = NOUN[kind];
  return [`${genitive(a.fi)!} ${fi}`, `${a.en} ${en}`];
}

/**
 * Names for unnamed waters (kind and centre each), after the map's anchor labels: nearest pairs first, each name
 * given once ("Lahdenkylän lampi" / "Bay Village Pond"), so two waters at one place are named after two places.
 * Deterministic: ties go by water, then anchor order.
 */
export function nameUnnamed(waters: readonly { readonly kind: WaterKind; readonly at: Pt }[], anchors: readonly AnchorLabel[]): (readonly [string, string])[] {
  if (waters.length > 0 && anchors.length === 0) throw new Error("no place label on the map to name unnamed water after");
  const pairs: { w: number; a: number; d: number }[] = [];
  waters.forEach((wt, w) => anchors.forEach((an, a) => pairs.push({ w, a, d: dist(wt.at, an.at) })));
  pairs.sort((p, q) => p.d - q.d || p.w - q.w || p.a - q.a);
  const out: (readonly [string, string] | null)[] = waters.map(() => null);
  const used = new Set<string>();
  for (const p of pairs) {
    if (out[p.w] !== null) continue;
    const name = nameAfter(waters[p.w]!.kind, anchors[p.a]!, p.d);
    if (name[0] === "" || used.has(name[0])) continue;
    used.add(name[0]);
    out[p.w] = name;
  }
  // More unnamed waters than names: the rest share their nearest place's (told apart by compass side or number).
  return out.map((n, w) => {
    if (n !== null) return n;
    const p = pairs.find((q) => q.w === w && nameAfter(waters[w]!.kind, anchors[q.a]!, q.d)[0] !== "")!;
    return nameAfter(waters[w]!.kind, anchors[p.a]!, p.d);
  });
}
