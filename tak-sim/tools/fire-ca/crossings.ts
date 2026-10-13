/**
 * Where the fire crossed a road or a brook, and how — SPEC/24 §12, SPEC/18 revision (l).
 *
 * The barriers are the same lines the fuel grid rasterises (`tools/topo-map/build.ts`): gravel and
 * main roads, forest roads, brooks. A barrier is CROSSED in a cycle at a point on it when the fire
 * reaches both sides there (cells `SIDE_M` either side burned) at the cycle's end, and did not at
 * its start. Each crossing is classified by what carried it over:
 *
 *   embers   the cycle has authored spotting (SPEC/18 §7) — the fire jumped it;
 *   head     the gust met the barrier's wind threshold and the crossing ran with the wind;
 *   creep    neither: the fire worked across slowly (the barrier's small leak).
 *
 * Everything here is site metres (x east, y north of IGN).
 */

import { BROOKS } from "../topo-map/terrain.js";
import { FIXED_ROADS, ROADS } from "../topo-map/roads.js";
import { namedLabels } from "../topo-map/places.js";
import type { CycleForcing, SiteModel } from "./run.js";
import type { P } from "./deployment.js";
import { FUEL_CLASSES } from "./template-site.js";
import { bearing, dirTo, r50, withLang } from "./traffic-text.js";

export type BarrierKind = "road_gravel" | "road_forest" | "brook";
export interface Barrier {
  readonly id: string;
  readonly kind: BarrierKind;
  /** Genitive, for "… yli": "tien R1", "Koivuojan", "metsäautotien (Kuusimäki)". */
  readonly nameGenFi: string;
  readonly line: readonly P[];
}

export type CrossingMechanism = "embers" | "head" | "creep";
export interface Crossing {
  /** Index into the forcing (0 = W1; session cycle n is index n + 4). */
  readonly forcingIndex: number;
  readonly barrier: Barrier;
  readonly at: P;
  readonly mechanism: CrossingMechanism;
  /** Metres of barrier newly crossed — used to keep the most significant ones. */
  readonly lengthM: number;
  /** Where a barrier of the same name was crossed before (the nearest earlier crossing), or null on its first crossing. */
  readonly previous: P | null;
}

const SIDE_M = 40;
const SAMPLE_M = 25;
const WITHIN_M = 4500;

/** Names of the fixed roads by their index in FIXED_ROADS (roads.ts), genitive. */
const FIXED_NAMES = ["maantien", "maantien", "tien R3", "tien R1", "tien R3", "tien R2", "Mökkirannan tien", "turvetien", "Hiekkalan tien", "Pirttilammen tien"];

const near = (line: readonly P[]) => line.some((p) => Math.hypot(p.x, p.y) < WITHIN_M);

export function barriers(): Barrier[] {
  const labels = namedLabels().filter((l) => l.style === "terrain" || l.style === "place" || l.style === "bog" || l.style === "water");
  const nearestLabel = (line: readonly P[]) => {
    const mid = line[Math.floor(line.length / 2)]!;
    let best = labels[0]!;
    for (const l of labels) if (Math.hypot(l.x - mid.x, l.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y)) best = l;
    return best.text;
  };
  const out: Barrier[] = [];
  FIXED_ROADS.forEach((r, i) => { if (near(r.line)) out.push({ id: `road.fixed.${i}`, kind: "road_gravel", nameGenFi: FIXED_NAMES[i] ?? "soratien", line: r.line }); });
  ROADS.forEach((r, i) => {
    if (i < FIXED_ROADS.length || !near(r.line)) return;
    if (r.cls === "main" || r.cls === "gravel") out.push({ id: `road.${i}`, kind: "road_gravel", nameGenFi: `soratien (${nearestLabel(r.line)})`, line: r.line });
    else if (r.cls === "forest") out.push({ id: `road.${i}`, kind: "road_forest", nameGenFi: `metsäautotien (${nearestLabel(r.line)})`, line: r.line });
  });
  BROOKS.forEach((b, i) => { if (near(b.line)) out.push({ id: `brook.${i}`, kind: "brook", nameGenFi: `${b.name}n`, line: b.line }); });
  return out;
}

interface Sample { readonly at: P; readonly left: P; readonly right: P; readonly normalDeg: number }

function samples(line: readonly P[]): Sample[] {
  const out: Sample[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let s = 0; s < len; s += SAMPLE_M) {
      const at = { x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len };
      out.push({ at, left: { x: at.x + nx * SIDE_M, y: at.y + ny * SIDE_M }, right: { x: at.x - nx * SIDE_M, y: at.y - ny * SIDE_M }, normalDeg: (Math.atan2(nx, ny) * 180) / Math.PI });
    }
  }
  return out;
}

export function detectCrossings(site: SiteModel, forcing: readonly CycleForcing[], masks: readonly { readonly reported: Uint8Array; readonly truthAtEnd: Uint8Array }[]): Crossing[] {
  const { frame } = site;
  const cell = (p: P) => {
    const c = Math.floor((p.x + site.ignitionM.eastM) / frame.cellSizeM);
    const r = Math.floor((p.y + site.ignitionM.northM) / frame.cellSizeM);
    return c < 0 || r < 0 || c >= frame.cols || r >= frame.rows ? -1 : r * frame.cols + c;
  };
  const burned = (mask: Uint8Array, p: P) => { const i = cell(p); return i >= 0 && mask[i] === 1; };
  const out: Crossing[] = [];
  const reportedSoFar = new Map<string, P[]>();
  for (const b of barriers()) {
    const ss = samples(b.line);
    const cls = FUEL_CLASSES.find((f) => f.id === b.kind)!;
    masks.forEach((mk, fi) => {
      const f = forcing[fi]!;
      const fresh = ss.filter((s) => burned(mk.truthAtEnd, s.left) && burned(mk.truthAtEnd, s.right) && !(burned(mk.reported, s.left) && burned(mk.reported, s.right)));
      if (fresh.length === 0) return;
      // The stretch crossed: the fresh sample nearest the middle of the fresh ones.
      const cx = fresh.reduce((a, s) => a + s.at.x, 0) / fresh.length;
      const cy = fresh.reduce((a, s) => a + s.at.y, 0) / fresh.length;
      const mid = fresh.reduce((a, s) => (Math.hypot(s.at.x - cx, s.at.y - cy) < Math.hypot(a.at.x - cx, a.at.y - cy) ? s : a));
      const earlier = reportedSoFar.get(b.id) ?? [];
      if (earlier.some((p) => Math.hypot(p.x - mid.at.x, p.y - mid.at.y) < 400)) return; // the same crossing, still widening
      earlier.push(mid.at);
      reportedSoFar.set(b.id, earlier);
      // Which way did it cross? From the side that was burning at the start.
      const fromLeft = burned(mk.reported, mid.left);
      const crossDeg = fromLeft ? mid.normalDeg + 180 : mid.normalDeg;
      const heading = (f.windFromDeg + 180) % 360;
      const off = Math.abs((((crossDeg - heading) % 360) + 540) % 360 - 180);
      const spotting = (f.events ?? []).some((e) => e.kind === "ignite" && e.anchor === "head");
      const barrier = cls.barrier!;
      const mechanism: CrossingMechanism = spotting ? "embers" : f.gustMs >= barrier.minWindMs && off <= barrier.headArcDeg ? "head" : "creep";
      out.push({ forcingIndex: fi, barrier: b, at: mid.at, mechanism, lengthM: fresh.length * SAMPLE_M, previous: null });
    });
  }
  // The earlier crossing of a barrier of the same name, as the radio names it (two forest roads both named after
  // Kuusimäki read as one road): the nearest one from an earlier step.
  return out.map((x) => ({
    ...x,
    previous: out.filter((y) => y.barrier.nameGenFi === x.barrier.nameGenFi && y.forcingIndex < x.forcingIndex)
      .reduce<P | null>((a, y) => (!a || Math.hypot(y.at.x - x.at.x, y.at.y - x.at.y) < Math.hypot(a.x - x.at.x, a.y - x.at.y) ? y.at : a), null),
  })).sort((a, b) => a.forcingIndex - b.forcingIndex || b.lengthM - a.lengthM || (a.barrier.id < b.barrier.id ? -1 : 1));
}

export interface Stop {
  readonly forcingIndex: number;
  readonly barrier: Barrier;
  readonly at: P;
  readonly contactM: number;
}

/**
 * Where a barrier STOPPED the fire: the fire newly reached one side of it along at least
 * `minContactM` of its length during a cycle, and the other side stayed unburned there. Reported
 * once per barrier — the first time it holds — so the log says what the ground did for the crews.
 */
export function detectStops(site: SiteModel, masks: readonly { readonly reported: Uint8Array; readonly truthAtEnd: Uint8Array }[], minContactM = 100): Stop[] {
  const { frame } = site;
  const cell = (p: P) => {
    const c = Math.floor((p.x + site.ignitionM.eastM) / frame.cellSizeM);
    const r = Math.floor((p.y + site.ignitionM.northM) / frame.cellSizeM);
    return c < 0 || r < 0 || c >= frame.cols || r >= frame.rows ? -1 : r * frame.cols + c;
  };
  const burned = (mask: Uint8Array, p: P) => { const i = cell(p); return i >= 0 && mask[i] === 1; };
  const out: Stop[] = [];
  for (const b of barriers()) {
    const ss = samples(b.line);
    for (let fi = 0; fi < masks.length; fi++) {
      const mk = masks[fi]!;
      const touching = ss.filter((s) => {
        const l = burned(mk.truthAtEnd, s.left);
        const r = burned(mk.truthAtEnd, s.right);
        const newly = !burned(mk.reported, s.left) && !burned(mk.reported, s.right);
        return l !== r && newly;
      });
      if (touching.length * SAMPLE_M < minContactM) continue;
      const mid = touching[Math.floor(touching.length / 2)]!;
      out.push({ forcingIndex: fi, barrier: b, at: mid.at, contactM: touching.length * SAMPLE_M });
      break; // once per barrier
    }
  }
  return out.sort((a, b) => a.forcingIndex - b.forcingIndex || b.contactM - a.contactM || (a.barrier.id < b.barrier.id ? -1 : 1));
}

/** A barrier's name in English, from its Finnish genitive ("tien R1" → "road R1"). */
export function barrierNameEn(b: Barrier): string {
  const fixed: Record<string, string> = { "maantien": "the main road", "tien R3": "road R3", "tien R1": "road R1", "tien R2": "road R2", "Mökkirannan tien": "the Mökkiranta road", "turvetien": "the peat road", "Hiekkalan tien": "the Hiekkala road", "Pirttilammen tien": "the Pirttilampi road" };
  if (fixed[b.nameGenFi]) return fixed[b.nameGenFi]!;
  const m = /^(soratien|metsäautotien) \((.+)\)$/.exec(b.nameGenFi);
  if (m) return `the ${m[1] === "soratien" ? "gravel" : "forest"} road (${m[2]})`;
  return b.kind === "brook" ? `the ${b.nameGenFi.replace(/n$/, "")} brook` : b.nameGenFi;
}

/** The stop message in English (DRAFT translation). */
export function stopMessageEn(s: Stop, window: CrossingWindow): string {
  const why = s.barrier.kind === "brook" ? "the wet banks stopped the surface fire" : "the road broke the surface fire";
  return `The fire stopped at ${barrierNameEn(s.barrier)} between ${window[0]} and ${window[1]} along about ${Math.round(s.contactM / 50) * 50} metres; ${why}.`;
}

/**
 * A barrier crossed again names where, against the earlier crossing (review 6 Oct 2026, A7: the second
 * crossings of the Kuusimäki forest road and of the Honkaharju road read word for word as the first).
 */
function againFi(c: Crossing): string {
  return c.previous ? ` toisessa kohdassa, noin ${r50(Math.hypot(c.at.x - c.previous.x, c.at.y - c.previous.y))} m ${dirTo(bearing(c.previous, c.at))} edellisestä ylityksestä` : "";
}
function againEn(c: Crossing): string {
  return c.previous ? withLang("en", () => ` at another point, about ${r50(Math.hypot(c.at.x - c.previous!.x, c.at.y - c.previous!.y))} m ${dirTo(bearing(c.previous!, c.at))} of the earlier crossing,`) : "";
}

/** The crossing message in English (DRAFT translation). */
export function crossingMessageEn(c: Crossing, gustMs: number, nearestUnit: { readonly id: string; readonly distM: number; readonly withdrew: boolean } | null, window: CrossingWindow): string {
  const name = barrierNameEn(c.barrier);
  const again = againEn(c);
  const what = c.mechanism === "embers"
    ? `Embers flew over ${name}${again ? again.replace(/,$/, "") : ""}; a new fire on the other side.`
    : c.mechanism === "head"
      ? `The head of the fire crossed ${name}${again} between ${window[0]} and ${window[1]} in the gusts (${gustMs} m/s).`
      : `The fire crept over ${name}${again ? again.replace(/,$/, "") : ""} along the edge.`;
  if (!nearestUnit || nearestUnit.distM > 600) return `${what} No units were near; nothing could be done in time.`;
  if (nearestUnit.withdrew) return `${what} ${nearestUnit.id} had to withdraw; it could not be stopped in time.`;
  return c.mechanism === "creep"
    ? `${what} ${nearestUnit.id} is putting out the crossing point.`
    : `${what} ${nearestUnit.id} tried to hold the line, but the fire got across.`;
}

/**
 * The stop message names the step it stopped in, as a crossing does (6 Oct 2026: EK16's 19.01 withdrawal "the fire is
 * crossing the forest road" and its 19.03 "the fire stopped at the forest road" read as one moment; the stop was 18.40–19.00).
 */
export function stopMessageFi(s: Stop, window: CrossingWindow): string {
  const why = s.barrier.kind === "brook" ? "kosteat rannat pysäyttivät pintapalon" : "tie katkaisi pintapalon";
  return `Palo pysähtyi ${s.barrier.nameGenFi} kohdalle klo ${window[0]}–${window[1]} noin ${Math.round(s.contactM / 50) * 50} metrin matkalta, ${why}.`;
}

/**
 * The step a crossing happened in, as clock times ("18.40", "19.00"). The message goes out at the
 * start of the next step, so a head crossing names when it crossed: its gust is that step's (the
 * weather station's then), not the gust at the time of the message (phase-B rebuild, 4 Oct 2026:
 * OUT2's "14 m/s" at 19.01 read against the station's 12 m/s at 19.00).
 */
export type CrossingWindow = readonly [string, string];

/** The radio message: what crossed, how, and what the nearest crew could do about it. */
export function crossingMessageFi(c: Crossing, gustMs: number, nearestUnit: { readonly id: string; readonly distM: number; readonly withdrew: boolean } | null, window: CrossingWindow): string {
  const again = againFi(c);
  const what = c.mechanism === "embers"
    ? `Kipinät lensivät ${c.barrier.nameGenFi} yli${again}, uusi palo toisella puolella.`
    : c.mechanism === "head"
      ? `Palon kärki ylitti ${c.barrier.nameGenFi}${again} klo ${window[0]}–${window[1]} puuskissa (${gustMs} m/s).`
      : `Palo kyti ${c.barrier.nameGenFi} yli${again} reunaa pitkin.`;
  if (!nearestUnit || nearestUnit.distM > 600) return `${what} Lähellä ei ollut yksiköitä, ei ehditty tehdä mitään.`;
  if (nearestUnit.withdrew) return `${what} ${nearestUnit.id} joutui vetäytymään, ei ehditty estää.`;
  return c.mechanism === "creep"
    ? `${what} ${nearestUnit.id} sammuttaa ylityskohtaa.`
    : `${what} ${nearestUnit.id} yritti pitää linjan, mutta palo pääsi yli.`;
}
