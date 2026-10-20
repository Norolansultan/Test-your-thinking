/**
 * The incident's traffic corpus (SPEC/18 revision (n)): what crews, drones and aircraft say — to
 * command, to each other, into logs and sensor feeds — step by step, generated from what they can
 * OBSERVE at the time: the reported fire around their own position (`traffic-fire.ts`), the rate
 * observed over the last 20 minutes, the wind now, the ground under them, their own task and tank.
 * Never the truth or the future.
 *
 * Revised 1 Oct 2026 (review items 1–7): places follow deployment (`traffic-places.ts`); every
 * crew describes its own stretch in its own voice, sometimes unsure; drone products and coverage
 * gaps (`traffic-drones.ts`); tanks that empty and refill (`traffic-water.ts`); situation-specific
 * lateral traffic (`traffic-lateral.ts`) and requests to command (`traffic-requests.ts`).
 * Deterministic: one seeded Mulberry32 per step.
 */

import type { InteractionEvent } from "../../app/scenario/types.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { viewOfStep } from "../../app/scenario/views.js";
import type { GridFrame } from "./geometry.js";
import { Mulberry32 } from "./model.js";
import { FEATURES, HELD_FOR_REGION, LINE_REPORTS, type P } from "./deployment.js";
import { ROADS } from "../topo-map/roads.js";
import { landCover, LC_DRAINED_BOG, LC_FIELD, LC_OPEN_BOG, LC_PINE_BOG, LC_WATER, POWER_LINE } from "../topo-map/terrain.js";
import { closestOnPolyline } from "../topo-map/terrain-base.js";
import { droneTraffic } from "./traffic-drones.js";
import { isRekindleCallsign } from "./fire-display.js";
import { escapeRoute, hoursOnScene, lateralTraffic, routeEn } from "./traffic-lateral.js";
import { requestTraffic } from "./traffic-requests.js";
import { isShuttle, SHUTTLE_ID, shuttleDoing, stepWater, vehicleFilling, waterAnswer } from "./traffic-water.js";
import { sectorOfPoint } from "./traffic-places.js";
import {
  actorTypeOf, bearing, cap, clockAt, dirFrom, dirTo, dist, drawFrom, FLAME_FI, flameWords, fmt1, FUEL_FI, hm, intensityClass, isBog, L, LL, pl, r50, say, stepStartS,
  TASK_FI, vary, voiceOf, type LandCoverFi,
} from "./traffic-text.js";
import { RECORDS_FOLLOW_FROM_STEP } from "./flame-table.js";
import { stationReading } from "./station-weather.js";
import { NEW_FIRE_STEPS, recordTape, type Lane, type Out, type Tape, type TrafficCycleInput, type TrafficEvent, type TrafficState, type TrafficUnit } from "./traffic-types.js";

export { actorTypeOf, clockAt, dirTo, type LandCoverFi };
export { newTrafficState, recordTape, replayTape } from "./traffic-types.js";
export type { TrafficAircraft, TrafficCycleInput, TrafficEvent, TrafficState, TrafficUnit } from "./traffic-types.js";

/** Place names, ground type, sector and nearest road for a site point — what a crew can tell. */
export function siteTrafficHelpers() {
  const sample = (cls: string): P[] => ROADS.filter((r) => r.cls === cls).flatMap((r) => r.line.flatMap((a, i) => {
    const b = r.line[i + 1];
    if (!b) return [];
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20));
    return Array.from({ length: k }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k }));
  }));
  const roadsByClass = (["main", "gravel", "forest", "track"] as const).map((cls) => ({ cls, pts: sample(cls) }));
  const roadNear = (p: P) => {
    let best = { cls: "track", distM: Infinity };
    for (const r of roadsByClass) for (const q of r.pts) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < best.distM) best = { cls: r.cls, distM: d }; }
    return best;
  };
  /** Named places crews use on the radio (SPEC/18 §5, deployment.ts FEATURES). */
  const PLACES: readonly { readonly at: P; readonly fi: string }[] = [
    { at: FEATURES.IGN, fi: "syttymäkohta" }, { at: FEATURES.CP, fi: "johtopaikka" }, { at: FEATURES.RIDGE, fi: "Kuivakangas" },
    { at: FEATURES.SPR, fi: "Kuusimäki" }, { at: FEATURES.BIRCH, fi: "Koivuoja" }, { at: FEATURES.POND_W1, fi: "Haukilampi" },
    { at: FEATURES.CABINS, fi: "Mökkiranta" }, { at: FEATURES.BOG_S, fi: "Rahkasuo" }, { at: FEATURES.VILLAGE, fi: "Lahdenkylä" },
    { at: FEATURES.R1_R2, fi: "R1/R2-risteys" }, { at: FEATURES.R1_MID, fi: "tie R1" }, { at: FEATURES.R3_BRIDGE_W, fi: "R3:n silta (Kotkanjoki)" },
    { at: FEATURES.BRIDGE_W3, fi: "R3:n silta (Kotkanjoki)" }, { at: FEATURES.POND_W2, fi: "Lahdenkylän lampi" },
  ];
  const placeNear = (p: P) => {
    let best: { fi: string; d: number } | null = null;
    for (const pl of PLACES) { const d = Math.hypot(pl.at.x - p.x, pl.at.y - p.y); if (d < 700 && (!best || d < best.d)) best = { fi: pl.fi, d }; }
    return best?.fi ?? null;
  };
  const landCoverAt = (p: P): LandCoverFi => {
    const near = (f: P, r: number) => Math.hypot(p.x - f.x, p.y - f.y) < r;
    if (near(FEATURES.SPR, 400)) return "spruce";
    if (near(FEATURES.RIDGE, 350)) return "ridge";
    if (near(FEATURES.BIRCH, 300)) return "birch";
    const lc = landCover(p.x, p.y, 0);
    return lc === LC_DRAINED_BOG ? "drained_bog" : lc === LC_PINE_BOG ? "pine_bog" : lc === LC_OPEN_BOG ? "open_bog" : lc === LC_FIELD ? "field" : lc === LC_WATER ? "water" : "forest";
  };
  const settlements = [{ fi: "Mökkiranta", at: FEATURES.CABINS }, { fi: "Lahdenkylä", at: FEATURES.VILLAGE }] as const;
  return { roadNear, placeNear, landCoverAt, sectorOf: sectorOfPoint, settlements };
}

/**
 * Reported area and length, from the reported mask. The length is the footprint's greatest extent
 * (the longest distance between two burned cells, plus a cell), whatever the wind: measured along the
 * spread direction it shrank from 1950 to 1200 m between 18:15 and 18:55 while the area grew, as the
 * wind veered across the old fire (review 6 Oct 2026, A11).
 */
export function reportedExtent(frame: GridFrame, mask: Uint8Array): { areaHa: number; lengthM: number } {
  const cs = frame.cellSizeM;
  const edge: { x: number; y: number }[] = [];
  let cells = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    cells += 1;
    const col = i % frame.cols, row = (i - col) / frame.cols;
    // Only cells on the footprint's boundary can be the ends of its greatest extent.
    const inner = col > 0 && col + 1 < frame.cols && row > 0 && row + 1 < frame.rows && mask[i - 1] && mask[i + 1] && mask[i - frame.cols] && mask[i + frame.cols];
    if (!inner) edge.push({ x: (col + 0.5) * cs, y: (row + 0.5) * cs });
  }
  let best = 0;
  for (let a = 0; a < edge.length; a++) for (let b = a + 1; b < edge.length; b++) {
    const d = (edge[a]!.x - edge[b]!.x) ** 2 + (edge[a]!.y - edge[b]!.y) ** 2;
    if (d > best) best = d;
  }
  return { areaHa: (cells * cs * cs) / 10_000, lengthM: cells > 0 ? Math.sqrt(best) + cs : 0 };
}

/** A step's events as flat log records, placed on the map, with the view they belong to (SPEC/26 §6). */
export function toInteractionEvents(n: number, events: readonly TrafficEvent[], fromSite: (p: P) => LatLon, sectorOf: (p: P) => string, placeNear: (p: P) => string | null): InteractionEvent[] {
  return events.map((ev, k) => {
    const sim = (n - 1) * 1200 + ev.offsetS;
    const ll = ev.pos ? fromSite(ev.pos) : null;
    return {
      id: n >= 1 ? `evt.c${String(n).padStart(2, "0")}.${String(k).padStart(3, "0")}` : `evt.vp.${String(k).padStart(3, "0")}`, cycle: n, session_view: viewOfStep(n)?.index ?? null, sim_time_s: sim, timestamp: clockAt(sim),
      actor: ev.actor, actor_type: ev.actor_type, addressee: ev.addressee,
      location: ev.location !== undefined && ev.location !== null ? ev.location : ev.pos ? sectorOf(ev.pos) : null,
      place: ev.place !== undefined ? ev.place : ev.pos ? placeNear(ev.pos) : null, lat: ll?.lat ?? null, lon: ll?.lon ?? null,
      event_type: ev.event_type, task: ev.task, content: ev.content, tier: ev.tier, channel: ev.channel, nav: ev.nav, lang: "fi",
    };
  });
}

const LANES: Readonly<Record<Lane, readonly [number, number]>> = {
  early: [20, 300], main: [60, 1150], feed: [40, 1180], ask: [200, 1190], lateral: [120, 1190], late: [900, 1190],
};

/** A wording is used at most this many times in the day while another wording is left (review item 11). */
const MAX_REPEATS = 3;
const DIRECTION_WORDS = /(pohjois|koillis|itä|kaakkois|etelä|lounais|länsi|luoteis)puole(lla|lta|lle|n)?|(pohjoiseen|koilliseen|itään|kaakkoon|etelään|lounaaseen|länteen|luoteeseen|pohjoisesta|koillisesta|idästä|kaakosta|etelästä|lounaasta|lännestä|luoteesta)/g;

/** The step's sink: events with a fixed time keep it; the rest are spread evenly over their lane. */
function makeOut(seed: number, dayUse: Map<string, number>, tape: Tape): Out & { finish(): TrafficEvent[] } {
  const rng = new Mulberry32(seed);
  const draw = drawFrom(() => rng.nextFloat());
  const fixed: TrafficEvent[] = [];
  const queued = new Map<Lane, Omit<TrafficEvent, "offsetS">[]>();
  const used = new Set<string>();
  const skeleton = (s: string) => s.replace(/\b(EK|KY|VPK|OUT|UGV|DR|VD)\d*\b/g, "#").replace(/\d+([,.]\d+)?/g, "9").replace(DIRECTION_WORDS, "~");
  const take = (x: string) => { const k = skeleton(x); used.add(k); dayUse.set(k, (dayUse.get(k) ?? 0) + 1); return x; };
  const replay = <T,>(): T => {
    if (tape.pos >= tape.values.length) throw new Error("traffic tape: the English run asked for more choices than the Finnish run made");
    return tape.values[tape.pos++] as T;
  };
  const rec = <T,>(v: T): T => { tape.values.push(v); return v; };
  return {
    draw,
    fresh(xs) {
      const start = Math.floor(draw.rnd() * xs.length);
      if (tape.mode === "replay") return xs[replay<number>()]!;
      const order = xs.map((_, k) => xs[(start + k) % xs.length]!);
      const ok = (x: string, max: number) => !used.has(skeleton(x)) && (dayUse.get(skeleton(x)) ?? 0) < max;
      const pick = order.find((x) => ok(x, MAX_REPEATS)) ?? order.find((x) => ok(x, Infinity))
        ?? order.reduce((a, b) => ((dayUse.get(skeleton(b)) ?? 0) < (dayUse.get(skeleton(a)) ?? 0) ? b : a));
      return take(xs[rec(xs.indexOf(pick))]!);
    },
    capped(topic, xs) {
      // Counted per template (`topic#k`), so one template with another place name in it is still the same phrase.
      const start = Math.floor(draw.rnd() * xs.length);
      if (tape.mode === "replay") { const k = replay<number>(); return k < 0 ? null : xs[k]!; }
      for (let j = 0; j < xs.length; j++) {
        const k = (start + j) % xs.length;
        const key = `${topic}#${k}`;
        if (used.has(skeleton(xs[k]!)) || (dayUse.get(key) ?? 0) >= MAX_REPEATS) continue;
        dayUse.set(key, (dayUse.get(key) ?? 0) + 1);
        rec(k);
        return take(xs[k]!);
      }
      rec(-1);
      return null;
    },
    same(f) {
      return tape.mode === "replay" ? replay() : rec(f());
    },
    push(e, lane = "main") {
      if (e.offsetS !== undefined) { fixed.push({ ...e, offsetS: e.offsetS }); return; }
      const q = queued.get(lane) ?? [];
      q.push(e);
      queued.set(lane, q);
    },
    finish() {
      const all = [...fixed];
      for (const lane of ["early", "main", "feed", "ask", "lateral", "late"] as const) {
        const q = queued.get(lane) ?? [];
        const [lo, hi] = LANES[lane];
        const step = (hi - lo) / Math.max(1, q.length);
        q.forEach((e, k) => all.push({ ...e, offsetS: Math.min(1195, Math.round(lo + step * (k + 0.5) + (draw.rnd() - 0.5) * Math.min(30, step * 0.6))) }));
      }
      return all.map((e, k) => ({ e, k })).sort((a, b) => a.e.offsetS - b.e.offsetS || a.k - b.k).map((x) => x.e);
    },
  };
}

/** A crew within this distance of a new separate fire's cells is working it (`NEW_FIRE_STEPS`). */
const NEW_FRONT_NEAR_M = 400;
/**
 * What the crews on a new separate fire radio in `NEW_FIRE_STEPS` (phase-B rebuild, 4 Oct 2026):
 * qualitative — a new small fire, what burns, that they are on it. No rate, no size and no "slowly":
 * the size is DR2's recorded thermal reading, and the CA front is not slow (150 m in 17:20–17:40).
 * Said in turn, one per crew; DRAFT Finnish for native review.
 */
const NEW_FRONT_WORDS: readonly (() => string)[] = [
  () => L("uusi pieni palo vanhan eteläreunan ulkopuolella, pintapaloa karikkeessa. Olemme siinä kiinni", "a new small fire outside the old south edge, surface fire in the litter. We are on it"),
  () => L("täällä uusi pieni palo, liekki kulkee maata pitkin. Letku vedetty, olemme reunassa kiinni", "a new small fire here, the flames running along the ground. Hose laid, we are on its edge"),
  () => L("pieni uusi palo, savua ja liekkiä sammalessa ja karikkeessa. Olemme siinä kiinni", "a small new fire, smoke and flames in the moss and litter. We are on it"),
  () => L("uusi palo on vielä pieni, pintapaloa maapuustossa ja karikkeessa. Työskentelemme sen reunalla", "the new fire is still small, surface fire in the deadwood and litter. We are working its edge"),
];

/**
 * How far around a crew its own stretch of edge reaches (fix pass 2, 7 Oct 2026, FF1): 350 m and a blend with
 * the head's run let VPK on the origin's south edge radio "flames a couple of metres, 7 m/min, we cannot hold
 * the edge" at 16:09, twenty minutes before the same edge was reported calm.
 */
const OWN_EDGE_M = 200;
/** An edge whose outward direction is more than this off the downwind direction is a backing edge (it faces the wind). */
const BACKING_OFF_DEG = 120;
/** A backing edge creeps at most this fast (m/min). */
const BACKING_MAX_MPM = 1;

/** What a crew sees of its own stretch of fire, in its own words (review item 5). */
function crewSees(u: TrafficUnit, inp: TrafficCycleInput, out: Out): { text: string; cls: number; lc: LandCoverFi; rate: number; measured: number; moveDeg: number } {
  const { pick, chance, rnd } = out.draw;
  const lc = inp.landCoverAt(u.pos);
  const atHead = dist(u.pos, inp.head) < 450;
  const near = inp.fire.distanceM(u.pos, 3000);
  // A crew's estimate of its own edge: how fast it moves in front of the crew now, during this step, with an
  // eye's error (±20 %). Not the last step's run (review 6 Oct 2026, A2: EK11 radioed the crown run's 38 m/min at
  // 15:22, when its stretch moved 5 m/min), and only its own stretch, not the head's run (FF1).
  // An edge that faces into the wind backs against it (fix pass 3, 7 Oct 2026, FF1): it creeps at most about 1 m/min
  // whatever the grid's coarse front does there (VPK on the origin's south edge in the 16.00 southerly said 3–4 m/min).
  const cen = inp.fire.centroids(u.pos, OWN_EDGE_M);
  const inner = cen.old ?? inp.fire.nearestBurned(u.pos, OWN_EDGE_M);
  const backing = inner !== null && dist(inner, u.pos) > 1 && Math.abs(((bearing(inner, u.pos) - (inp.wind.fromDeg + 180) + 540) % 360) - 180) > BACKING_OFF_DEG;
  const measured = Math.min(inp.fire.currentAdvanceM(u.pos, OWN_EDGE_M) / 20, backing ? BACKING_MAX_MPM : Infinity);
  const rate = measured * (0.8 + rnd() * 0.4);
  const active = inp.fire.freshHa(u.pos, OWN_EDGE_M) > 0 || inp.fire.currentFreshHa(u.pos, OWN_EDGE_M) > 0;
  const cls = intensityClass(lc, measured, active);
  // The flame the crew states: the provisional table's at its own edge's rate (SPEC/31 §3.11), at every step; the class still drives the wording.
  const fw = flameWords(cls, measured, lc, inp.n);
  const hedge = chance(0.3) ? ` (${pick(voiceOf(u.id).hedge)})` : "";
  const moveDeg = cen.old && cen.fresh ? bearing(cen.old, cen.fresh) : atHead ? inp.headingDeg : bearing(inp.head, u.pos);
  const dir = dirTo(moveDeg);
  const r1 = Math.max(1, Math.round(rate));
  const rateFi = cls >= 4 && chance(0.4) ? L("nopeutta en pysty arvioimaan savun takia", "I cannot judge the speed because of the smoke") : out.fresh([
    L(`etenee ${dir} noin ${r1} m/min${hedge}`, `spreading ${dir} at about ${r1} m/min${hedge}`),
    L(`menee ${dir} päin, ehkä ${r1} m minuutissa${hedge}`, `going ${dir}, maybe ${r1} m a minute${hedge}`),
    L(`liikkuu ${dir}${rate < 2 ? " hitaasti" : ` arviolta ${Math.round(rate)} m/min`}${hedge}`, `moving ${dir}${rate < 2 ? " slowly" : ` at roughly ${Math.round(rate)} m/min`}${hedge}`)]);
  let text: string;
  const toward = dirTo(bearing(u.pos, inp.head));
  if (!active && near > 150) text = out.fresh([
    L(`reuna ei näy täältä, lähin palo noin ${r50(near)} m`, `no edge in sight from here, nearest fire about ${r50(near)} m`),
    L(`meillä hiljaista, palon reuna ${r50(near)} m päässä`, `quiet here, the fire edge is ${r50(near)} m away`),
    L(`ei paloa näköetäisyydellä, savua ${toward}`, `no fire in sight, smoke to the ${toward}`),
    L(`ei omaa reunaa, palo ${r50(near)} m ${toward}`, `no edge of our own, the fire is ${r50(near)} m to the ${toward}`)]);
  else if (!active) text = isBog(lc)
    ? out.fresh([L("turvepinta savuaa paikoin, liekkejä ei näy", "the peat surface smokes in places, no flames"), L("suon pinta höyryää, avotulta ei ole", "the bog surface is steaming, no open fire"), L("turvepinnassa savuavia kohtia, kastelemme", "smoking spots in the peat, we are soaking them")])
    : out.fresh([L("reuna pysynyt paikallaan, savuaa vain", "the edge has stayed put, only smoking"), L("ei liekkejä, kantoja ja kariketta savuaa", "no flames, stumps and litter smoking"), L("reuna rauhallinen, jälkisammutusta riittää", "the edge is calm, plenty of mop-up"), L("reunalla ei liikettä, kuumia kantoja kaivetaan auki", "no movement on the edge, digging out hot stumps"), L("palanut reuna jäähtyy, yksittäisiä savuja", "the burned edge is cooling, a few smokes")]);
  else if (isBog(lc)) text = out.fresh([L(`palo menee turpeeseen, pinnalla savuavia laikkuja, ${fw}`, `the fire is going into the peat, smoking patches on the surface, ${fw}`), L("turve palaa pinnan alla, savua paljon, liekkejä vähän", "the peat is burning under the surface, a lot of smoke, few flames"), L(`suon reuna savuaa leveältä alalta, ${rateFi}`, `the bog edge is smoking over a wide area, ${rateFi}`), L(`turpeesta nousee savua ojan varresta, ${fw}`, `smoke rising from the peat along the ditch, ${fw}`)]);
  else if (cls <= 1) text = out.fresh([L(`matalaa pintapaloa, ${FLAME_FI[1]}, reuna ryömii hitaasti`, `low surface fire, ${FLAME_FI[1]}, the edge creeping slowly`), L(`hehkuvaa kariketta ja pientä liekkiä, ${rateFi}`, `glowing litter and small flames, ${rateFi}`), L(`pieni liekki sammalessa, ${rateFi}`, `small flames in the moss, ${rateFi}`)]);
  else if (cls === 2) text = ((f) => out.fresh([L(`pintapaloa ${f}, ${fw}`, `surface fire in ${f}, ${fw}`), L(`reuna ${rateFi}, ${fw}`, `edge ${rateFi}, ${fw}`), L(`sivulla tasaista pintapaloa, ${fw}`, `steady surface fire on the flank, ${fw}`), L(`kanerva palaa tasaisesti, ${rateFi}`, `the heather is burning steadily, ${rateFi}`), L(`liekki kulkee maata pitkin, ${fw}; ${rateFi}`, `flames running along the ground, ${fw}; ${rateFi}`)]))(pick(FUEL_FI[lc]));
  // The table's band at every step since 20 Oct 2026, was "liekit pari metriä" before the hinge (FT-C16: KY21 18:26, DR2 18:25 agree).
  else if (cls === 3) text = ((f) => out.fresh([L(`voimakas pintapalo, ${fw}, yksittäisiä puita syttyy`, `intense surface fire, ${fw}, single trees catching`), L(`reuna painuu ${dir}, ${fw}; ${rateFi}`, `the edge is pushing ${dir}, ${fw}; ${rateFi}`), L(`kova pintapalo ${f}, ${rateFi}`, `hard surface fire in ${f}, ${rateFi}`), L(`${inp.n >= RECORDS_FOLLOW_FROM_STEP ? fw : "liekit pari metriä"}, alikasvos syttyy, ${rateFi}`, `${inp.n >= RECORDS_FOLLOW_FROM_STEP ? fw : "flames a couple of metres"}, the undergrowth is catching, ${rateFi}`)]))(pick(FUEL_FI[lc]));
  else if (cls === 4) text = ((f) => out.fresh([L(`puita syttyy latvoiltaan, ${fw}, suora hyökkäys ei onnistu`, `trees torching, ${fw}, no direct attack possible`), L(`rajua paloa ${f}, ${rateFi}`, `fierce fire in ${f}, ${rateFi}`), L(`yksittäisiä latvoja leimahtaa, kuumuus ajaa meidät taaksepäin; ${rateFi}`, `single crowns flaring up, the heat is driving us back; ${rateFi}`)]))(pick(FUEL_FI[lc]));
  else text = out.fresh([L(`latvapaloa, ${FLAME_FI[5]}, kipinöitä satoja metrejä eteen`, `crown fire, ${FLAME_FI[5]}, embers hundreds of metres ahead`), L(`kuusikko palaa latvoissa, ${rateFi}`, `the spruce stand is burning in the crowns, ${rateFi}`), L(`latvoissa jatkuva tulirintama, ${rateFi}`, `a continuous fire front in the crowns, ${rateFi}`)]);
  if (atHead && cls >= 4 && chance(0.35)) text += L(", en näe kärkeä savun takia", ", I cannot see the head for the smoke");
  else if (atHead && chance(0.5)) text += L(`, kärki noin ${r50(dist(u.pos, inp.head))} m meistä ${toward}`, `, the head about ${r50(dist(u.pos, inp.head))} m to our ${toward}`) + (chance(0.3) ? L(" (varmistamatta)", " (unconfirmed)") : "");
  return { text, cls, lc, rate, measured, moveDeg };
}

/**
 * A road-line crew's work (fix pass 2, 7 Oct 2026, FF6; was "raivaamme tien vartta ja kastelemme tien reunaa" ~25
 * times a day, 1–1.4 km from the fire): a sprinkler line or pre-laid hose with nozzles along the road, fed from the
 * crew's basin, and sprinklers round the buildings by Lahdenkylä and Mökkiranta. Fix pass 3 (N3, N5): one engine runs
 * 100–300 m of line (not 900 m in a step); it stays "ready, the water goes on when …" until the fire is within
 * `SPRINKLER_ON_M`, (pass 6: the water goes on at about 100 m or at the first embers, not 300 m) then draws 500–1200 l/min from the basin; near the road the crew says whether the front comes at the
 * road or runs along it (its own edge's direction, `crewSees`). The burnout is proposed and closed in `burnoutTraffic`.
 */
const SPRINKLER_ON_M = 100;
/** A road line's length (m) for a unit: 100–300 m, fixed for the day. */
const lineLengthM = (id: string) => 100 + ([...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5) * 50;
function roadLineWork(u: TrafficUnit, inp: TrafficCycleInput, out: Out, moveDeg: number): string {
  const d = inp.fire.distanceM(u.pos, 4000);
  const homes = inp.settlements.find((s) => dist(s.at, u.pos) < 1000);
  const m = lineLengthM(u.id);
  if (homes) {
    const placeFi = homes.fi === "Lahdenkylä" ? "Lahdenkylän" : "Mökkirannan";
    // The water goes on only when the fire is near (as for the road line); before that the sprinklers stand ready (fix pass 5, 8 Oct 2026).
    if (!Number.isFinite(d) || d > SPRINKLER_ON_M) return out.fresh([
      L(`sadettimet ${placeFi} talojen ympärillä valmiina, vesi kytketään kun palo on noin ${SPRINKLER_ON_M} m päässä`, `sprinklers ready round the buildings at ${homes.fi}; the water goes on when the fire is about ${SPRINKLER_ON_M} m away`),
      L(`sadetinlinja ${placeFi} rakennusten vieressä valmiina, pihat kastellaan kun palo lähestyy`, `the sprinkler line by the buildings at ${homes.fi} is ready; the yards are wetted when the fire comes closer`),
    ]);
    return out.fresh([
      L(`sadettimet ${placeFi} talojen ympärillä käynnissä, pihat kasteltu`, `sprinklers running round the buildings at ${homes.fi}, the yards wetted`),
      L(`kastelemme ${placeFi} rakennusten seinustat ja katot, sadetinlinja tien varressa auki`, `wetting the walls and roofs at ${homes.fi}, the sprinkler line along the road on`),
    ]);
  }
  if (!Number.isFinite(d) || d > SPRINKLER_ON_M) return out.fresh([
    L(`sadetinlinja (noin ${m} m) valmiina tien varressa, vesi kytketään altaasta kun palo on noin ${SPRINKLER_ON_M} m päässä tai kipinät ylittävät tien; allas riittää noin 10 min, ${SHUTTLE_ID} täydentää`, `the sprinkler line (about ${m} m) is ready along the road; the water goes on from the basin when the fire is about ${SPRINKLER_ON_M} m away or embers cross the road; the basin lasts about 10 min and ${SHUTTLE_ID} tops it up`),
    L(`suuttimilla varustettu letkulinja tien reunassa valmiina, noin ${m} m, allas täynnä`, `a hose line with nozzles laid along the road edge, about ${m} m, the basin full`),
    // Radio ST-03 (SPEC/31): the crew's own report before this tail already says how far the fire is; the tail no longer repeats it
    // ("… palo noin 550 m länteen. Palo noin 550 m päässä; linja …", c20.033, c17.004, c14.025).
    L(`linja ${m} m tien varressa valmiina, vesi kytketään kun palo lähestyy`, `${m} m of line ready along the road, the water goes on when the fire comes closer`),
  ]);
  const flow = 500 + Math.round(((300 - Math.min(300, d)) / 300) * 7) * 100;
  // Whether this stretch of the front comes at the road (within 60° of the way from the fire to the crew) or runs along it.
  const inner = inp.fire.nearestBurned(u.pos, 4000);
  const atRoad = inner === null || Math.abs(((moveDeg - bearing(inner, u.pos) + 540) % 360) - 180) <= 60;
  if (!atRoad) return out.fresh([
    L(`rintama noin ${r50(d)} m tiestä, kulkee tien suuntaisesti; sadetinlinja auki, noin ${flow} l/min altaasta`, `the front about ${r50(d)} m from the road, running along it; the sprinkler line is on, about ${flow} l/min from the basin`),
    L(`palo kulkee tien suuntaisesti noin ${r50(d)} m päässä, sadettimet auki (${flow} l/min), tarkkailemme kipinöitä`, `the fire is running along the road about ${r50(d)} m away, the sprinklers on (${flow} l/min), we are watching for embers`),
  ]);
  return out.fresh([
    L(`rintama tulee tietä kohti, noin ${r50(d)} m; sadetinlinja auki, noin ${flow} l/min altaasta`, `the front is coming at the road, about ${r50(d)} m away; the sprinkler line is on, about ${flow} l/min from the basin`),
    L(`palo lähestyy tietä, ${r50(d)} m; sadettimet kastelevat tien palon puoleista reunaa (${flow} l/min), tarkkailemme kipinöitä tien yli`, `the fire is nearing the road, ${r50(d)} m; the sprinklers are wetting the fire side of the road (${flow} l/min), we are watching for embers across the road`),
  ]);
}

/**
 * Burnouts from the road lines (fix pass 3, 7 Oct 2026, N4): a crew proposes one to command when the front is within
 * `BURNOUT_PROPOSE_M` of its road, and each proposal is closed later — lit when the front is about 400 m away and
 * the wind allows, or called off: the wind too strong (the evening event, gusts from `BURNOUT_MAX_GUST_MS`), or the
 * line moved. Once per unit and stretch.
 */
// Fix pass 6 (FF5): lit when the front is about 400 m away (200 m is too late to light a burn that must burn out the strip before it arrives).
const BURNOUT_PROPOSE_M = 700;
const BURNOUT_LIGHT_M = 400;
const BURNOUT_MAX_GUST_MS = 12;
/**
 * Revision (al), 10 Oct 2026 (map review panel): no officer burns out beside a 110 kV line whose status he has not
 * confirmed. A road crew within this distance of the line proposes its burnout on the stretch of road AWAY from the
 * line ("asemastamme länteen"), without a word about the line: the line's status is F7's planted record, asked at
 * V12, and nothing before the V12 freeze may speak of it.
 */
const BURNOUT_LINE_CLEAR_M = 300;
function burnoutStretch(p: P): { fi: string; en: string } {
  const q = closestOnPolyline(p.x, p.y, POWER_LINE);
  if (Math.hypot(q.x - p.x, q.y - p.y) >= BURNOUT_LINE_CLEAR_M) return { fi: "", en: "" };
  const west = q.x > p.x;
  return west ? { fi: " asemastamme länteen", en: " on the stretch west of our position" } : { fi: " asemastamme itään", en: " on the stretch east of our position" };
}
function burnoutTraffic(inp: TrafficCycleInput, state: TrafficState, out: Out): void {
  const windFi = L(`tuuli ${fmt1(inp.wind.meanMs)} m/s, puuskissa ${fmt1(inp.wind.gustMs)}`, `wind ${fmt1(inp.wind.meanMs)} m/s, gusts ${fmt1(inp.wind.gustMs)}`);
  let proposals = 0;
  for (const u of inp.units.filter((x) => x.arrivedCycle <= inp.n && !x.silent)) {
    const key = `burnout:${u.id}`;
    const proposed = [...state.said].find((k) => k.startsWith(`${key}:`) && !k.endsWith(":closed") && !state.said.has(`${k}:closed`));
    const push = (offsetS: number, event_type: "request" | "report", fi: string, en: string) => out.push({ offsetS, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type, task: u.task,
      content: say(u.id, u.place, L(fi, en)), tier: "T1_pushed", channel: "radio_command", nav: "palo" });
    const onRoadLine = !u.onEdge && u.task === "road_line";
    const d = inp.fire.distanceM(u.pos, 4000);
    if (proposed) {
      const stays = onRoadLine && !u.moved;
      if (inp.wind.gustMs >= BURNOUT_MAX_GUST_MS) { state.said.add(`${proposed}:closed`); push(stays ? 420 : 160, "report", `taustapoltto peruttu, tuuli liian kova (${windFi}). ${stays ? "Pidämme tien sadettimilla." : "Linja siirtyy."}`, `burnout called off, the wind is too strong (${windFi}). ${stays ? "We hold the road with the sprinklers." : "The line is moving."}`); continue; }
      if (!stays) { state.said.add(`${proposed}:closed`); push(160, "report", "taustapoltto peruttu, linja siirtyi.", "burnout called off, the line has moved."); continue; }
      if (Number.isFinite(d) && d <= BURNOUT_LIGHT_M) { state.said.add(`${proposed}:closed`); push(480, "report", `taustapoltto sytytetty tien reunasta klo ${hm(stepStartS(inp.n) + 470)}, rintama noin ${r50(d)} m; poltto etenee paloa kohti, tie pitää.`, `burnout lit from the road edge at ${hm(stepStartS(inp.n) + 470)}, the front about ${r50(d)} m away; the burn is moving towards the fire, the road holds.`); continue; }
      // The day's last step: no burnout is left open at the handover.
      // No distance to the road here: in V14 the front's distance to R2 is on record only (SPEC/27 §7.1).
      if (inp.n >= 20) { state.said.add(`${proposed}:closed`); push(900, "report", "taustapoltto peruttu: rintama ei tullut tien lähelle ennen yövuoroa, yövuoro arvioi tilanteen uudelleen.", "burnout called off: the front has not come near the road before the night shift; the night shift will reassess."); }
      continue;
    }
    // At most one new proposal a step, never in the day's last step (it could not be closed).
    if (proposals > 0 || inp.n >= 20 || !onRoadLine || u.moved || !Number.isFinite(d) || d > BURNOUT_PROPOSE_M || d <= BURNOUT_LIGHT_M || inp.wind.gustMs >= BURNOUT_MAX_GUST_MS || state.said.has(`${key}:${u.anchor}`)) continue;
    proposals += 1;
    state.said.add(`${key}:${u.anchor}`);
    const stretch = burnoutStretch(u.pos);
    push(380, "request", `esitämme taustapolttoa tien reunasta${stretch.fi}, kun rintama on noin 400 m päässä (${windFi}). Pyydämme johdon hyväksynnän.`, `we propose a burnout from the road edge${stretch.en} when the front is about 400 m away (${windFi}). We request command's approval.`);
  }
}

/** The hose robot is stuck from OUT1's report at step 19 (~19:23, `deployment.ts` EXTRA_RADIO) to the handover (radio ST-06). */
const robotStuck = (id: string, n: number): boolean => id === "UGV1" && n >= 19;

/** The log landing in the R2/forest-road junction's south-east corner (revision (al): 60 × 40 m, drawn on the map). */
const LOG_LANDING: P = { x: FEATURES.R2_FR.x + 30, y: FEATURES.R2_FR.y - 20 };
/**
 * SPEC/31 D8 (FT-T19/T20): every crew holding road R2 states, when asked from 19:00 to 20:00, its escape route and a named safety
 * zone — the crews at and north of the forest-road junction the log landing in the junction's corner, the crews south of it the
 * fields of Lahdenkylä, both away from the south-east front's path (the panel judges them: `fire_tactical.md` "For the expert
 * panel"). Deterministic (no draw); DRAFT Finnish for the native check.
 */
function r2SafetyLine(u: TrafficUnit, n: number): string {
  if (n < 18 || u.onEdge || u.task !== "road_line" || !/^at:R2_/.test(u.anchor ?? "")) return "";
  if (u.anchor === "at:R2_FR" || u.anchor === "at:R2_BOG") {
    const near = dist(u.pos, LOG_LANDING) < 150;
    return near
      ? L("Turva-alue: R2:n risteyksen puutavaran varastoalue vieressämme, auto käännettynä, perääntymistie sinne tietä pitkin.", "Safety zone: the log landing at the R2 junction right beside us, vehicle turned round, escape route there along the road.")
      : L(`Perääntymistie: autolla tietä R2 pitkin ${dirTo(bearing(u.pos, LOG_LANDING))} R2:n risteyksen puutavaran varastoalueelle (turva-alue), auto käännettynä.`, `Escape route: by vehicle along road R2 ${dirTo(bearing(u.pos, LOG_LANDING))} to the log landing at the R2 junction (safety zone), vehicle turned round.`);
  }
  return L("Perääntymistie: autolla tietä R2 pitkin etelään Lahdenkylän pelloille (turva-alue), auto käännettynä.", "Escape route: by vehicle south along road R2 to the Lahdenkylä fields (safety zone), vehicle turned round.");
}

/** Builds one step's traffic. `state` carries tanks, batteries and coverage between steps. */
/**
 * What the spotter sees besides the main fire: spot fires (embers) and old edges flaring up again (rekindles, the north edge's
 * holdover at 19:00) are said apart (F4, review fixes (ah): the holdover is not a spot fire).
 */
/** Which old edge a flare-up is on (radio CO-02): the edge the crews nearest it hold, as their place names it. */
const OLD_EDGE: Readonly<Record<string, readonly [string, string]>> = {
  pohjoisreuna: ["Pohjoisreuna", "The north edge"], itäreuna: ["Itäreuna", "The east edge"], eteläreuna: ["Eteläreuna", "The south edge"], länsireuna: ["Länsireuna", "The west edge"],
};
const EDGE_PLACE = /^(pohjoisreuna|itäreuna|eteläreuna|länsireuna)/;
/** The flare-up's edge: the place of the nearest crew within 400 m that holds a named edge; undefined when none does. */
function edgeOf(inp: TrafficCycleInput, p: P): readonly [string, string] | undefined {
  const near = inp.units.filter((u) => u.place !== null && EDGE_PLACE.test(u.place) && dist(u.pos, p) <= 400).sort((a, b) => dist(a.pos, p) - dist(b.pos, p) || (a.id < b.id ? -1 : 1))[0];
  return near ? OLD_EDGE[EDGE_PLACE.exec(near.place!)![1]!] : undefined;
}
function spotCountText(inp: TrafficCycleInput): string {
  const rks = inp.spotFires.filter((s) => isRekindleCallsign(s.callsign));
  const rk = rks.length;
  const sp = inp.spotFires.length - rk;
  const spots = sp === 1 ? L("Yksi pistepalo näkyvissä.", "One spot fire in sight.") : sp > 1 ? L(`${sp} pistepaloa näkyvissä.`, `${sp} spot fires in sight.`) : "";
  // Radio CO-02 (SPEC/31): a flare-up is placed (SPOT 19:15 in V13: the north edge, the holdover US2 beside KY23's firebreak), so it
  // cannot be read as a fire the directive does not describe or as an early report of V14's west-edge flare-up.
  const edge = rk === 1 ? edgeOf(inp, rks[0]!.pos) : undefined;
  const flares = rk === 1
    ? (edge ? L(`${edge[0]} leimahtanut uudelleen yhdessä kohdassa.`, `${edge[1]} has flared up again in one place.`) : L("Vanha reuna leimahtanut uudelleen yhdessä kohdassa.", "An old edge has flared up again in one place."))
    : rk > 1 ? L(`Vanha reuna leimahtanut uudelleen ${rk} kohdassa.`, `Old edges have flared up again in ${rk} places.`) : "";
  return [spots, flares].filter(Boolean).join(" ") || L("Ei muita savuja alueella.", "No other smoke in the area.");
}

export function cycleTraffic(inp: TrafficCycleInput, state: TrafficState, tape: Tape = recordTape()): TrafficEvent[] {
  const out = makeOut(0x5eed + inp.n * 7919, state.wordings, tape);
  const { pick, rnd, chance } = out.draw;
  const { n } = inp;
  const rate = inp.observedRateMpm;
  const spread = dirTo(inp.headingDeg);
  const windTxt = L(`tuuli ${dirFrom(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s, puuskissa ${fmt1(inp.wind.gustMs)}`, `wind from the ${dirFrom(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s, gusts ${fmt1(inp.wind.gustMs)}`);
  const ground = inp.units.filter((u) => !u.silent);
  const onScene = ground.filter((u) => u.arrivedCycle <= n);
  const at = (u: TrafficUnit) => ({ pos: u.pos, place: u.place, location: u.sector });

  // --- Size-up: the first crew on scene (step 1) --------------------------------------------------
  if (n === 1) {
    const lead = onScene.find((u) => u.id === "EK11") ?? onScene[0];
    if (lead) {
      const lc = inp.landCoverAt(lead.pos);
      const fuel = pick(FUEL_FI[lc]); // the draws in the order the Finnish lines made them
      const leadSees = crewSees(lead, inp, out).text;
      const lines = [
        L(`Johdolle: EK11 paikalla. Palo noin ${fmt1(inp.areaHa)} ha, pituus noin ${r50(inp.lengthM)} m, kärki etenee ${spread}.`, `To command: EK11 on scene. Fire about ${fmt1(inp.areaHa)} ha, about ${r50(inp.lengthM)} m long, the head spreading ${spread}.`),
        L(`Savupatsas vaalea ja voimakas, kallistuu ${spread}. Näkyvyys kärjen edessä huono.`, `Smoke column light-coloured and strong, leaning ${spread}. Poor visibility ahead of the head.`),
        L(`Palo on pintapaloa, ${fuel}. ${cap(leadSees)}.`, `Surface fire in ${fuel}. ${cap(leadSees)}.`),
        L(`Etenemisnopeus arviolta ${Math.round(rate)} m/min. ${cap(windTxt)}.`, `Rate of spread roughly ${Math.round(rate)} m/min. ${cap(windTxt)}.`),
        L(`Lähin asutus: ${inp.settlements.map((s) => `${s.fi} ${fmt1(dist(inp.head, s.at) / 1000)} km ${dirTo(bearing(inp.head, s.at))}`).join(", ")} kärjestä.`, `Nearest homes: ${inp.settlements.map((s) => `${s.fi} ${fmt1(dist(inp.head, s.at) / 1000)} km ${dirTo(bearing(inp.head, s.at))}`).join(", ")} of the head.`),
        L(`Aloitamme kärjen pohjoissivustasta letkulinjalla, EK12 eteläsivustaan, VPK eteläreunalle. Johtopaikka R1:n ja R3:n risteyksessä.`, `We start on the north flank of the head with a hose line, EK12 on the south flank, VPK on the south edge. Command post at the R1/R3 junction.`),
        L(`Pyydän lisää vettä ja maastopaloyksikön pohjoisreunalle; perääntymistie: ${escapeRoute(lead.pos, inp.head, inp.fire, lead.vehicle).fi}.`, `I request more water and a forest-fire unit for the north edge; escape route: ${routeEn(escapeRoute(lead.pos, inp.head, inp.fire, lead.vehicle).fi)}.`),
      ];
      lines.forEach((content, k) => out.push({ offsetS: 15 + k * 22, actor: lead.id, actor_type: "fire_team", addressee: "JOHTO", ...at(lead), event_type: k < 5 ? "size_up" : "request", task: lead.task, content, tier: "T1_pushed", channel: "radio_command", nav: k === 3 ? "saa" : k === 4 ? "kohteet" : "palo" }));
    }
  }

  // --- First size-ups: every unit on its first step ----------------------------------------------
  // A unit arriving after the handover has said "saapunut" in its move message already (one arrival
  // per unit); a unit already working at the handover has been there for a while (`hoursOnScene`).
  // A late arrival's size-up follows its move message (sent from 90 s, 25 s apart: `site-export.ts`).
  onScene.filter((x) => x.arrivedCycle === n && x.onEdge && !(n === 1 && x.id === "EK11")).forEach((u, k) => {
    const seen = crewSees(u, inp, out);
    const h = hoursOnScene(u, n);
    const where = u.place ? `, ${pl(u.place)}` : "";
    const opening = h > 0 ? L(`${u.id}${where}: olemme olleet täällä noin ${fmt1(h)} h.`, `${u.id}${where}: we have been here about ${fmt1(h)} h.`) : L(`${u.id}${where}: ensimmäinen tilannearvio.`, `${u.id}${where}: first size-up.`);
    const after = h > 0 ? {} : { offsetS: 300 + k * 40 };
    out.push({ ...after, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "size_up", task: u.task,
      content: `${opening} ${L("Edessä", "Ahead:")} ${pick(FUEL_FI[seen.lc])}. ${cap(seen.text)}.`, tier: "T1_pushed", channel: "radio_command", nav: "palo" }, "early");
    out.push({ ...(h > 0 ? {} : { offsetS: 320 + k * 40 }), actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "report", task: u.task,
      content: `${u.id}: ${L("tehtävä", "task")} ${TASK_FI[u.task] ?? u.task}. ${u.hoseM ? L(`Letkua tarvitaan noin ${u.hoseM} m.`, `About ${u.hoseM} m of hose needed.`) : L("Ajoneuvo lähellä.", "Vehicle close by.")}`, tier: "T1_pushed", channel: "radio_command", nav: "yksikot" }, "early");
    if (u.id === "VPK") out.push({ actor: "VPK", actor_type: "volunteer_brigade", addressee: "JOHTO", ...at(u), event_type: "observation", task: u.task,
      content: L("VPK: tunnemme alueen. Metsäautotie kantaa säiliöauton, Haukilammelta saa vettä, Rahkasuon ojat ovat kuivia.", "VPK: we know the area. The forest road takes a tanker, there is water at Haukilampi, the Rahkasuo ditches are dry."), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" }, "early");
  });

  // --- Tanks: drain, refill, ask (before the crews' reports, which quote their level) --------------
  const water = stepWater(inp, state, out);

  // --- Crews on the edge report their own stretch (rotating; always at the head or after a move) ----
  let headWarnings = 0;
  let newFrontSaid = 0;
  onScene.forEach((u, k) => {
    // A unit refilling at a water point reports its tank from `stepWater`, after the fill; the water shuttle holds no edge.
    if (u.arrivedCycle === n || u.task === "refill" || isShuttle(u.id)) return;
    const head = dist(u.pos, inp.head) < 450 && u.onEdge;
    // A crew with an authored report this step (`LINE_REPORTS`) always reports (safety re-check (ah): KY21's V14 report fell to the rotation).
    const forced = LINE_REPORTS[`${u.id}@${n}`] !== undefined;
    if (!forced && !head && !u.moved && (k + n) % 2 === 1) return;
    const skipped = !u.onEdge && !u.moved && chance(0.5);
    if (skipped && !forced) return;
    const seen = crewSees(u, inp, out);
    const tank = state.tanks.get(u.id);
    const tail = !u.onEdge ? (u.task === "road_line" ? roadLineWork(u, inp, out, seen.moveDeg)
      : ({ withdrawn: L("odotamme tiellä, kunnes kärki rauhoittuu", "waiting on the road until the head calms down"), rest: L("miehistö huollossa", "crew at rest and maintenance"), staging: HELD_FOR_REGION.has(u.id) ? L("alueen varalla johtopaikalla", "held in reserve for the region at the command post") : L("odotamme tehtävää", "waiting for a task"), transit: L("siirrymme", "on the move"), evacuation: L("evakuointi käynnissä", "evacuation under way"), blocked: L("emme pääse eteenpäin", "we cannot get through") } as Record<string, string>)[u.task] ?? "")
      // Fix pass 6 (FF5): a crew's own section, ~30–50 m at its first step and 60–80 m more per step (saws, 150–250 m/h), not a shared total.
      : u.task === "firebreak" ? ((m: number) => L(`palokatkoa valmiina noin ${m} m`, `about ${m} m of firebreak ready`))(r50(30 + (n - u.arrivedCycle - 1) * 60 + rnd() * (20 + (n - u.arrivedCycle - 1) * 20)))
      : u.task === "pump_attack" ? pick(LL(["moottoriruisku käy, vettä riittää", "ruisku imee altaasta, maastoauto täyttää"], ["the portable pump is running, enough water", "the pump draws from the portable tank, the off-road vehicle refills it"]))
      : tank && tank.before === null && tank.pct < 15 ? L("vesi lähes loppu", "water almost gone")
      : tank && tank.before === null && tank.pct < 35 ? pick(LL(["vesi vähissä", "vettä enää vähän, säästämme"], ["water low", "little water left, we are saving it"]))
      // A line holds, and an edge goes out, only where the fire is low and slow (class ≤ 2 and its own edge at most
      // 2 m/min; A2: "38 m/min … Pidämme linjan"; FF8: "the edge is going out slowly" at 4–6 m/min).
      : tank && seen.cls <= 2 && seen.measured <= 2 ? out.fresh([L("linja pitää", "the line holds"), L("reuna sammuu hitaasti, jälkisammutusta riittää", "the edge is going out slowly, plenty of mop-up"), u.hoseM ? L(`letkulinja ${u.hoseM} m, paine riittää`, `hose line ${u.hoseM} m, pressure is enough`) : L("linja pitää, vettä riittää", "the line holds, enough water"), L("pidämme linjan", "we are holding the line")])
      : tank && seen.cls <= 2 ? out.fresh([L("reuna liikkuu vielä, sammutamme reunaa ja vedämme letkua perässä", "the edge is still moving, we are putting it out and pulling the hose along"), L("saamme reunaa kiinni, mutta se lipsuu paikoin", "we are catching the edge, but it slips away in places")])
      : tank ? out.fresh([L("emme pysty pitämään reunaa, työskentelemme sivustasta", "we cannot hold the edge, we are working from the flank"), L("pidämme turvaetäisyyden, kastelemme reunan takaa", "we keep a safe distance and wet from behind the edge"), L("suora hyökkäys ei onnistu, varmistamme perääntymistien", "no direct attack possible, we are keeping our escape route clear")])
      : "";
    // The rekindled front at its first reported step (phase-B rebuild, 4 Oct 2026): the crews radio that
    // there is a new small fire and that they are on it — no rate and no "slowly". The draws above are
    // still made, so nothing else in the step moves. Their stretch reads as a separate patch, which
    // `advanceM` excludes, so `crewSees` would say "noin 1 m/min" (the floor of a zero measurement)
    // while the CA front advances ~150 m in 17:20–17:40 (DR2's recorded measurement at step 14).
    const onNewFront = NEW_FIRE_STEPS.has(n) && inp.fire.fresh.some((f) => f.separate && dist(f.p, u.pos) < NEW_FRONT_NEAR_M);
    // A crew's own report of its stretch at this step, where the estimate would mislead (`LINE_REPORTS`, fix pass 7, 9 Oct 2026).
    const own = LINE_REPORTS[`${u.id}@${n}`];
    const sees = own ? L(own.fi, own.en).replace("{near}", String(r50(inp.fire.distanceM(u.pos, 3000)))) : seen.text;
    const content = onNewFront ? say(u.id, u.place, `${NEW_FRONT_WORDS[newFrontSaid++ % NEW_FRONT_WORDS.length]!()}.`)
      : say(u.id, u.place, tail ? `${sees}. ${cap(tail)}.` : `${sees}.`);
    out.push({ actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "observation", task: u.task,
      content, tier: "T1_pushed", channel: "radio_command", nav: "palo" });
    if (head && rate > 6 && headWarnings < 2) {
      headWarnings += 1;
      // Embers by the fire in front of the crew (FF8, 7 Oct 2026: "embers 500 m ahead" from a birch stand burning low,
      // computed from the head's run): its intensity class and its own rate; a low edge throws none worth a distance.
      const ember = r50([0, 20, 40, 100, 200, 350][seen.cls]! + seen.measured * 6 + (seen.lc === "spruce" ? 80 : 0) + (rnd() - 0.5) * 60);
      if (seen.cls <= 2) {
        // Radio ST-08 (SPEC/31): the watch is said in the crew's own words, fixed by unit and step (EK12 14:08 and EK11 14:28 said one sentence).
        const watch = vary(u.id, n, [
          L("Tähystäjä seuraa kipinöitä.", "The lookout is watching for embers."),
          L("Yksi mies katsoo kipinöitä palaneen puolelta.", "One man is watching for embers from the burned side."),
          L("Tähystäjä tien varressa katsoo kipinöitä.", "The lookout by the road is watching for embers."),
        ]);
        const passing = out.capped("head-passing", [
          L(`kärki menee ohitsemme ${dirTo(inp.headingDeg)}, meidän kohdallamme reuna palaa matalana. Tarkkailemme kipinöitä ja pistepaloja.`, `the head is going past us to the ${dirTo(inp.headingDeg)}; on our stretch the edge burns low. We are watching for embers and spot fires.`),
          L(`kärki etenee ${dirTo(inp.headingDeg)} meidän ohi, omalla pätkällämme matalaa paloa. ${watch}`, `the head is running ${dirTo(inp.headingDeg)} past us, low fire on our own stretch. ${watch}`),
        ]);
        if (passing !== null) out.push({ actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "warning", task: u.task,
          content: say(u.id, u.place, passing), tier: "T1_pushed", channel: "radio_command", nav: "palo" });
      } else out.push({ actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "warning", task: u.task,
        content: say(u.id, u.place, pick([
          L(`kipinöitä lentää ${ember} m eteen ${dirTo(inp.headingDeg)}`, `embers flying ${ember} m ahead to the ${dirTo(inp.headingDeg)}`) + (chance(0.4) ? ` (${pick(voiceOf(u.id).hedge)})` : "") + L(". Tarkkailemme pistepaloja omalla puolellamme.", ". We are watching for spot fires on our side."),
          L(`${seen.lc === "spruce" ? "kuusikko syttyy latvoista" : "puuskat nostavat liekit latvoihin"}, ${windTxt}. Pidämme turvaetäisyyden, perääntymistie auki.`, `${seen.lc === "spruce" ? "the spruce is torching" : "the gusts are lifting the flames into the crowns"}, ${windTxt}. We keep a safe distance, escape route open.`),
          L(`kärki karkaa meiltä ${dirTo(inp.headingDeg)}, kipinäsuihku noin ${ember} m. Emme pysty pitämään kärkeä, keskitymme sivustaan.`, `the head is getting away from us to the ${dirTo(inp.headingDeg)}, a shower of embers about ${ember} m. We cannot hold the head, we focus on the flank.`),
        ])), tier: "T1_pushed", channel: "radio_command", nav: "palo" });
    }
  });

  // --- Burnouts from the road lines, proposed and closed (fix pass 3, N4) ---------------------------------------------
  burnoutTraffic(inp, state, out);

  // --- A crew ahead of the head, downwind (fix pass 2, 7 Oct 2026, FF5): its way out and its lookout, once per stretch ---
  for (const u of onScene.filter((x) => x.onEdge && !x.silent)) {
    const d = dist(u.pos, inp.head);
    // The crew's side of the head is judged from the wind now (fix pass 3, 7 Oct 2026, FF5): ahead of the head downwind,
    // or on its left or right flank looking downwind; the text says what the geometry says.
    const downwind = (inp.wind.fromDeg + 180) % 360;
    const rel = ((bearing(inp.head, u.pos) - downwind + 540) % 360) - 180;
    const off = Math.abs(rel);
    // In the first views the head's leading flanks count too (EK11 on its north flank at 13:20, on the esker at 14:00).
    if (d > 600 || off > (n <= 3 ? 90 : 60) || state.said.has(`ahead:${u.id}:${u.anchor}`)) continue;
    state.said.add(`ahead:${u.id}:${u.anchor}`);
    const back = r50(Math.max(40, inp.fire.distanceM(u.pos, 1000)));
    const where = off <= 45
      ? L(`olemme kärjen edessä tuulen alapuolella, noin ${r50(d)} m kärjestä ${dirTo(bearing(inp.head, u.pos))}`, `we are ahead of the head, downwind, about ${r50(d)} m ${dirTo(bearing(inp.head, u.pos))} of it`)
      : L(`olemme kärjen ${rel < 0 ? "vasemmalla" : "oikealla"} sivustalla tuulen suuntaan katsoen, noin ${r50(d)} m kärjestä ${dirTo(bearing(inp.head, u.pos))}`, `we are on the head's ${rel < 0 ? "left" : "right"} flank looking downwind, about ${r50(d)} m ${dirTo(bearing(inp.head, u.pos))} of it`);
    // Radio TE-04 (one form, "perääntymistie", the corpus's majority) and ST-08 (EK11 said this sentence word for word at 13:23 and
    // 14:03): three phrasings, fixed by unit and step (no draw).
    const lces = vary(u.id, n, [
      L(`Perääntymistie palaneelle alalle ${back} m, tähystäjä nimetty, radioyhteys kaikkiin.`, `Escape route into the burned area ${back} m, lookout posted, radio contact with everyone.`),
      L(`Perääntymistie palaneelle alalle, noin ${back} m. Tähystäjä paikallaan, yhteys kaikkiin kunnossa.`, `Escape route into the burned area, about ${back} m. The lookout is in place, radio contact with everyone.`),
      L(`Turva-alue palaneella alalla ${back} m takanamme, sinne perääntymistie. Tähystäjä nimetty, kaikki kuulolla.`, `Safety zone in the burned area ${back} m behind us, our escape route leads there. Lookout posted, everyone listening.`),
    ]);
    out.push({ offsetS: 200, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "report", task: u.task,
      content: say(u.id, u.place, `${where}. ${lces}`),
      tier: "T1_pushed", channel: "radio_command", nav: "yksikot" });
  }

  // --- Drones, the water drone: products, coverage, batteries ---------------------------------------
  droneTraffic(inp, out);

  // --- Helicopter and spotting aircraft ------------------------------------------------------------
  for (const a of inp.aircraft) {
    if (a.kind === "helicopter") {
      out.push({ actor: a.id, actor_type: "helicopter", addressee: "JOHTO", pos: a.target, place: "kärki", event_type: "water_drop", task: a.flight,
        content: `${a.id}: ${L("kauhapudotukset kärkeen, vesi Haukilammelta, kierros noin", "bucket drops on the head, water from Haukilampi, a round trip of about")} ${Math.round(5 + rnd() * 3)} min. ${L("Pudotusalue ilmoitettu yksiköille, miehet pois alta (kuitattu).", "Drop zone announced to the units, men clear of it (acknowledged).")} ${pick(LL(["Pudotukset osuvat, kärki hidastuu hetkeksi.", "Savu haittaa tähtäystä, pudotamme kärjen sivuun.", "Tuuli hajottaa pudotuksen, teho heikko."], ["The drops are on target, the head slows for a while.", "Smoke spoils the aim, we drop beside the head.", "The wind scatters the drop, little effect."]))}`, tier: "T1_pushed", channel: "radio_command", nav: "ilma" });
    } else if (a.kind === "fixed_wing") {
      // Steps 12, 19 and 20: SPOT's reports are the authored rekindles (atom.demo.12.0, 19.2, 20.1); a generic "no other smoke" would contradict them.
      if (n === 12 || n === 19 || n === 20) continue;
      out.push({ actor: a.id, actor_type: "spotter_aircraft", addressee: "JOHTO", pos: a.target, place: null, event_type: "observation", task: a.flight,
        content: `${a.id}: ${L("savupatsas nousee noin", "the smoke column rises to about")} ${r50(400 + rate * 60)} ${L("metriin", "metres")}, ${L("kallistuu", "leaning")} ${dirTo((inp.wind.fromDeg + 180) % 360)}. ${spotCountText(inp)}${n >= 15 ? L(` Palanut ala ilmasta arvioiden noin ${Math.round(inp.areaHa / 10) * 10} ha.`, ` Burned area estimated from the air about ${Math.round(inp.areaHa / 10) * 10} ha.`) : ""}`, tier: "T1_pushed", channel: "radio_command", nav: "ilma" });
    }
  }
  // After DR3 is released (step 14), nobody flies the mapping loop: the situation picture's perimeter map is
  // updated from crew reports and drone images, and its area is the reported area the map shows (review item 9).
  if (n >= 15 && !inp.aircraft.some((a) => a.flight === "loop")) {
    out.push({ offsetS: 940, actor: "TILANNEKUVA", actor_type: "command", addressee: null, pos: FEATURES.CP, place: "johtopaikka", location: null, event_type: "status", task: null,
      content: L(`Tilannekuva klo ${hm(stepStartS(n) + 930)}: palorajan kartta päivitetty yksiköiden ilmoitusten${inp.aircraft.some((a) => a.kind === "drone") ? " ja droonikuvien" : ""} perusteella. Palanut ala noin ${fmt1(inp.areaHa)} ha, pituus noin ${r50(inp.lengthM)} m.`,
        `Situation picture at ${hm(stepStartS(n) + 930)}: the perimeter map updated from the units' reports${inp.aircraft.some((a) => a.kind === "drone") ? " and drone images" : ""}. Burned area about ${fmt1(inp.areaHa)} ha, length about ${r50(inp.lengthM)} m.`),
      tier: "T2_system", channel: "system_log", nav: "palo" });
  }

  // --- System logs: weather station, AVL positions ---------------------------------------------------
  // Fix pass 6 (FF5): at 16.20, 18.00 and 19.20 the station also gave temperature and humidity. SPEC/31 D3 (FT-C12/C18/C20): its
  // reading at every step's start gives temperature, humidity and dew point (`station-weather.ts`: the design values to 16.00, then
  // the evening drying with no recovery), so the reignition check has RH at 17:00, 19:00 and 19:40.
  const th = stationReading(n);
  const thFi = th ? `, lämpötila ${th.tempC} °C, ilmankosteus ${th.rhPct} %, kastepiste ${fmt1(th.dewC).replace("-", "−")} °C` : "";
  const thEn = th ? `, temperature ${th.tempC} °C, humidity ${th.rhPct} %, dew point ${fmt1(th.dewC).replace("-", "−")} °C` : "";
  for (const k of [0, 1]) {
    out.push({ offsetS: k === 0 ? 5 : 600, actor: "SAA", actor_type: "weather_station", addressee: null, pos: FEATURES.CP, place: "johtopaikka", event_type: "weather", task: null,
      content: `${L("Sääasema johtopaikalla", "Weather station at the command post")}: ${windTxt}${k === 0 ? L(thFi, thEn) : ""}${k === 1 ? L(", suunta vaihtelee ±15°", ", direction varying ±15°") : ""}${k === 1 && n === 10 ? L("; kaakkoistuuli on paikallinen: rintaman edellä purkautuva ilma ja virtaus Karhujärven ja harjun suuntaisesti", "; the south-easterly is local: outflow ahead of the front and channelling along Karhujärvi and the esker") : ""}.`, tier: "T2_system", channel: "system_log", nav: "saa" });
  }
  for (const u of inp.units.filter((x) => x.arrivedCycle <= n)) {
    // The water shuttle's AVL is logged at the step's start, where the map draws it, and says what its run has it doing
    // then (fix pass 4: it said "on a water run" while parked full at W1); its place is the stand-by point when it waits there.
    if (isShuttle(u.id)) {
      const standby = dist(u.pos, FEATURES.R2_FR) < 250 ? "R2:n ja metsäautotien risteys" : null;
      out.push({ offsetS: 10, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: null, ...at(u), event_type: "status", task: u.task,
        content: `AVL ${u.id}: ${pl(standby ?? inp.placeNear(u.pos) ?? "maastossa")}. ${shuttleDoing(state, stepStartS(n))}`, tier: "T2_system", channel: "system_log", nav: "yksikot" });
      continue;
    }
    // M8 (review fixes (ah)): after a move the stale map does not show yet, the AVL record follows the move (`TrafficUnit.avl`).
    const v = u.avl ?? u;
    // Radio ST-06 (SPEC/31): after OUT1's pushed report that UGV1 is stuck (step 19, ~19:23) its AVL says it has stopped, not "laying hose".
    const taskFi = robotStuck(u.id, n) ? TASK_FI["blocked"]! : TASK_FI[v.task] ?? v.task;
    out.push({ actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: null, pos: v.pos, place: v.place, location: v.sector, event_type: "status", task: v.task,
      content: `AVL ${u.id}: ${pl(v.place ?? inp.placeNear(v.pos) ?? "maastossa")}, ${L("tehtävä", "task")} ${taskFi}.`, tier: "T2_system", channel: "system_log", nav: "yksikot" }, "feed");
  }

  // --- Ask a unit (T3): what only the crew knows -------------------------------------------------------
  onScene.forEach((u, k) => {
    const askAt = Math.round(240 + (k + 0.5) * (920 / onScene.length) + (rnd() - 0.5) * 20);
    // The road class is where the vehicle stands, not the crew (positions audit item 14); the robot has no vehicle, crew or escape route.
    const road = inp.roadNear(u.vehicle ?? u.pos);
    const h = hoursOnScene(u, n);
    const robot = u.id.startsWith("UGV");
    // Radio ST-06 (SPEC/31): the robot's answer follows its state — on OUT1's trailer (blocked at the bridge), laying hose, or stuck.
    const facts = robot
      ? [robotStuck(u.id, n) ? L("Robotti juuttunut ojanvarteen, letkunveto seis.", "The robot is stuck in the ditch beside the road, hose laying has stopped.")
        : u.task === "blocked" ? L("Robotti OUT1:n perävaunussa, ei tehtävää.", "The robot is on OUT1's trailer, no task.")
          : L(`Robotti vetää letkua, maapohja ${isBog(inp.landCoverAt(u.pos)) ? "pehmeää" : "kantavaa"}${u.hoseM ? `, letkulinja ${u.hoseM} m` : ""}.`, `The robot is laying hose, the ground is ${isBog(inp.landCoverAt(u.pos)) ? "soft" : "firm"}${u.hoseM ? `, hose line ${u.hoseM} m` : ""}.`)]
      : [
          waterAnswer(state, u.id, stepStartS(n) + askAt),
          // A vehicle away for water says so (review 6 Oct 2026, A6: "nyt soratiellä" while it was filling);
          // a vehicle re-parked while the crew held its stretch says so (positions audit item 11).
          ((filling) => filling !== null
            ? L(`Ajoneuvo täyttämässä (${filling})${u.hoseM ? `, letkulinja ${u.hoseM} m` : ""}.`, `Vehicle away filling (${pl(filling)})${u.hoseM ? `, hose line ${u.hoseM} m` : ""}.`)
            : L(`${u.vehicleMovedM > 150 ? `Auto siirretty noin ${r50(u.vehicleMovedM)} m, nyt` : "Ajoneuvo"} ${road.cls === "forest" ? "metsäautotiellä" : road.cls === "gravel" ? "soratiellä" : road.cls === "main" ? "maantiellä" : "ajouralla"}${u.hoseM ? `, letkulinja ${u.hoseM} m` : ""}.`, `${u.vehicleMovedM > 150 ? `Vehicle moved about ${r50(u.vehicleMovedM)} m, now` : "Vehicle"} on ${road.cls === "forest" ? "a forest road" : road.cls === "gravel" ? "a gravel road" : road.cls === "main" ? "the main road" : "a track"}${u.hoseM ? `, hose line ${u.hoseM} m` : ""}.`))(vehicleFilling(state, u.id, stepStartS(n) + askAt)),
          L(`Miehistö ollut kentällä ${fmt1(Math.max(0.3, h))} h${h > 5 ? ", väsymystä alkaa näkyä" : h > 3 ? ", juomataukoja pidetty" : ""}.`, `Crew in the field for ${fmt1(Math.max(0.3, h))} h${h > 5 ? ", fatigue starting to show" : h > 3 ? ", drink breaks taken" : ""}.`),
          r2SafetyLine(u, n),
          u.onEdge ? pick([L(`Perääntymistie: ${escapeRoute(u.pos, inp.head, inp.fire, u.vehicle).fi}.`, `Escape route: ${routeEn(escapeRoute(u.pos, inp.head, inp.fire, u.vehicle).fi)}.`), L("Tähystäjä nimetty.", "Lookout posted."), ((m: number) => L(`Letkua varalla ${m} m.`, `${m} m of spare hose.`))(r50(100 + rnd() * 200))]) : "",
        ].filter((x) => x.length > 0);
    out.push({ offsetS: askAt, actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", ...at(u), event_type: "status", task: u.task,
      content: `${u.id} (${L("kysyttäessä", "when asked")}): ${facts.join(" ")}`, tier: "T3_person", channel: "ask_unit", nav: "yksikot" });
  });

  // --- Lateral traffic (T4) and requests to command ------------------------------------------------------
  lateralTraffic(inp, state, out, water);
  requestTraffic(inp, state, out);

  return out.finish();
}
