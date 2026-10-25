/**
 * Crew-to-crew traffic (T4, review 1 Oct 2026, item 4): situation-specific, from the step's own
 * state — hand-offs when a crew takes a new stretch, water sharing tied to the actual tank levels
 * (`traffic-water.ts`), the actual wind change and its time, spot fires a crew can see, road and
 * access problems, fatigue and rest rotation, and safety (lookouts, escape routes).
 *
 * Every candidate has a priority; the step keeps the highest few. No candidate mentions the bog
 * in steps 10–11 (SPEC/26 §5: the only bog doubts on record then are the authored objection and
 * `t4.private_doubt`).
 */

import { FEATURES, UNIT_PLAN, type P } from "./deployment.js";
import { ROADS } from "../topo-map/roads.js";
import { actorTypeOf, bearing, dirAdj, dirFrom, dirTo, dist, fmt1, hm, intensityClass, L, r50, stepStartS, vary } from "./traffic-text.js";
import type { FireProbe } from "./traffic-fire.js";
import { isShuttle, tankLevelAt, type WaterOutcome } from "./traffic-water.js";
import { isRekindleCallsign } from "./fire-display.js";
import type { Out, TrafficCycleInput, TrafficState, TrafficUnit } from "./traffic-types.js";

/** Hours a crew has been on the fire at step n: since arrival, plus the prologue for the first-alarm units. */
const BEFORE_HANDOVER_H: Readonly<Record<string, number>> = { EK11: 1.5, VPK: 1.3, EK12: 0.7 };
/** The step a fresh shift takes over the unit's vehicle on the line (fix pass 3, 7 Oct 2026: the 19.20 shift change). */
const RELIEVED_AT: Readonly<Record<string, number>> = { EK11: 19, VPK: 19 };
export const hoursOnScene = (u: TrafficUnit, n: number) => {
  const fresh = RELIEVED_AT[u.id];
  if (fresh !== undefined && n >= fresh) return ((n - fresh) * 20) / 60;
  return (BEFORE_HANDOVER_H[u.id] ?? 0) + Math.max(0, (n - u.arrivedCycle) * 20) / 60;
};

/** Named escape routes and lookout points crews use. */
const ROUTES: readonly { readonly fi: string; readonly at: P }[] = [
  { fi: "tie R1 länteen", at: FEATURES.R1_W }, { fi: "tie R1 itään", at: FEATURES.R1_MID }, { fi: "R1/R2-risteys", at: FEATURES.R1_R2 },
  { fi: "tie R2 etelään", at: FEATURES.R2_BOG }, { fi: "johtopaikka", at: FEATURES.CP }, { fi: "Lahdenkylän maantie", at: FEATURES.VILLAGE },
];
const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
/** The 16-point rose: where the wind comes from, where it goes, and in English. */
const FROM16 = ["pohjoisesta", "pohjoiskoillisesta", "koillisesta", "itäkoillisesta", "idästä", "itäkaakosta", "kaakosta", "eteläkaakosta", "etelästä", "etelälounaasta", "lounaasta", "länsilounaasta", "lännestä", "länsiluoteesta", "luoteesta", "pohjoisluoteesta"] as const;
const TO16 = ["pohjoiseen", "pohjoiskoilliseen", "koilliseen", "itäkoilliseen", "itään", "itäkaakkoon", "kaakkoon", "eteläkaakkoon", "etelään", "etelälounaaseen", "lounaaseen", "länsilounaaseen", "länteen", "länsiluoteeseen", "luoteeseen", "pohjoisluoteeseen"] as const;
const EN16 = ["north", "north-north-east", "north-east", "east-north-east", "east", "east-south-east", "south-east", "south-south-east", "south", "south-south-west", "south-west", "west-south-west", "west", "west-north-west", "north-west", "north-north-west"] as const;
/** The routes' names in English (session language "en"). */
const ROUTE_EN: Readonly<Record<string, string>> = {
  "tie R1 länteen": "road R1 west", "tie R1 itään": "road R1 east", "R1/R2-risteys": "the R1/R2 junction",
  "tie R2 etelään": "road R2 south", "johtopaikka": "the command post", "Lahdenkylän maantie": "the Lahdenkylä main road",
  "oma auto": "our own vehicle",
};
export const routeEn = (fi: string): string => ROUTE_EN[fi] ?? fi;
const nearestRoute = (p: P) => ROUTES.reduce((a, b) => (dist(b.at, p) < dist(a.at, p) ? b : a));
/** The crew's own vehicle as its way out (positions audit 2 Oct 2026, item 7). */
const OWN_VEHICLE = "oma auto";
/** Whether the straight path a → b runs over the reported fire (sampled every 10 m). */
const throughFire = (fire: FireProbe, a: P, b: P): boolean => {
  const k = Math.max(1, Math.ceil(dist(a, b) / 10));
  for (let s = 1; s < k; s++) if (fire.inside({ x: a.x + ((b.x - a.x) * s) / k, y: a.y + ((b.y - a.y) * s) / k })) return true;
  return false;
};
/**
 * A crew's escape route. The size-up, the crew's answers and its lateral traffic all name this one
 * (consistency review 1 Oct 2026, item 6). With the fire known (positions audit 2 Oct 2026, item 7):
 * its own vehicle when the way there crosses no fire (placement keeps the two on one side);
 * else the nearest named route whose straight path crosses no fire, preferring those that do not
 * lead toward the head (more than 60° off the bearing to it).
 */
export function escapeRoute(p: P, head: P, fire?: FireProbe, vehicle?: P | null): { readonly fi: string; readonly at: P } {
  if (fire && vehicle && !throughFire(fire, p, vehicle)) return { fi: OWN_VEHICLE, at: vehicle };
  const awayOf = (rs: readonly { readonly fi: string; readonly at: P }[]) => rs.filter((r) => angleDiff(bearing(p, r.at), bearing(p, head)) > 60);
  const clear = fire ? ROUTES.filter((r) => !throughFire(fire, p, r.at)) : ROUTES;
  const pool = [awayOf(clear), clear, awayOf(ROUTES), ROUTES].find((x) => x.length > 0)!;
  return pool.reduce((a, b) => (dist(b.at, p) < dist(a.at, p) ? b : a));
}

interface Candidate { readonly prio: number; readonly topic: string; readonly from: TrafficUnit; readonly to: TrafficUnit; readonly text: string; readonly offsetS?: number }

/**
 * A crew's talk group (SPEC/19 §2): TOIMINTA-1 for the units in L1 and L2, TOIMINTA-2 for L3 and L4; null for a unit with no
 * sector (at a point). Radio TG-02 (SPEC/31): lateral traffic runs only between neighbours on one group — the L3/L4 crews do not
 * agree a boundary with the L1/L2 crews over the radio. The water shuttle works every line and talks to whichever crew it serves.
 */
export function talkGroupOf(sector: string | null): 1 | 2 | null {
  if (!sector) return null;
  if (sector.startsWith("L1") || sector.startsWith("L2")) return 1;
  if (sector.startsWith("L3") || sector.startsWith("L4")) return 2;
  return null;
}
export function sameTalkGroup(a: TrafficUnit, b: TrafficUnit): boolean {
  if (isShuttle(a.id) || isShuttle(b.id)) return true;
  const ga = talkGroupOf(a.sector), gb = talkGroupOf(b.sector);
  return ga === null || gb === null || ga === gb;
}

/** The road (index into `ROADS`) a vehicle stands on: the nearest within 30 m, or -1. */
function roadOf(p: P): number {
  let best = -1, bestD = 30;
  ROADS.forEach((r, i) => {
    for (let k = 0; k + 1 < r.line.length; k++) {
      const a = r.line[k]!, b = r.line[k + 1]!;
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
      const d = Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.y - (a.y + (b.y - a.y) * t));
      if (d < bestD) { bestD = d; best = i; }
    }
  });
  return best;
}
/** How far a lookout on the ground sees a head through forest (m; radio ST-04). */
const LOOKOUT_SIGHT_M = 300;
/** Hose is laid at about 40 m a minute (FF7, 7 Oct 2026: a 100 m supply line took "noin 10 min"). */
const LAY_MPM = 40;

const onBogWords = /suo|Rahkasuo|turve|turpee|kyt/i;

export function lateralTraffic(inp: TrafficCycleInput, state: TrafficState, out: Out, water: WaterOutcome): void {
  const { n, fire } = inp;
  const { pick, rnd, chance } = out.draw;
  const t0 = stepStartS(n);
  // The hose robot's operator talks through OUT1 (SPEC/18 §8.2), so the robot is not a radio party.
  const crews = inp.units.filter((u) => u.arrivedCycle <= n && !u.silent && !u.id.startsWith("UGV"));
  const nearestTo = (p: P, maxM: number, ok: (v: TrafficUnit) => boolean = () => true, not = "") => {
    let best: TrafficUnit | null = null;
    for (const v of crews) if (v.id !== not && ok(v) && dist(p, v.pos) <= maxM && (!best || dist(p, v.pos) < dist(p, best.pos))) best = v;
    return best;
  };
  const nearest = (u: TrafficUnit, maxM: number, ok: (v: TrafficUnit) => boolean = () => true) => nearestTo(u.pos, maxM, ok, u.id);
  const c: Candidate[] = [];
  // Radio TG-02 (SPEC/31): crew-to-crew traffic only between neighbours on one talk group (`sameTalkGroup`). A call to a crew on the
  // other group is dropped here, after its wording is drawn, so every other call keeps its draw and wording (identical stimulus).
  const add = (prio: number, topic: string, from: TrafficUnit, to: TrafficUnit | null, text: string | null, offsetS?: number) => { if (to && text !== null && sameTalkGroup(from, to)) c.push({ prio, topic, from, to, text, ...(offsetS !== undefined ? { offsetS } : {}) }); };

  // Hand-offs: a crew that takes a new stretch of edge agrees the boundary with its new neighbour.
  for (const u of crews.filter((x) => x.moved && x.onEdge && x.moved !== "water")) {
    const v = nearest(u, 900, (x) => x.onEdge && !x.moved);
    if (!v) continue;
    const d = dist(u.pos, v.pos);
    const side = dirTo(bearing(v.pos, u.pos));
    add(8, `handoff:${u.id}`, u, v, out.capped("handoff", [
      L(`${v.id}, ${u.id}: olemme nyt teistä ${side} noin ${r50(d)} m. Otetaan reuna siitä ${side}, pidetään raja puolivälissä.`, `${v.id}, ${u.id}: we are now about ${r50(d)} m ${side} of you. We take the edge from there to the ${side}, boundary halfway.`),
      L(`${v.id}, täällä ${u.id}. Tulimme viereenne, ${r50(d)} m ${side}. Kumpi ottaa välin? Ehdotan että me.`, `${v.id}, this is ${u.id}. We came in next to you, ${r50(d)} m ${side}. Who takes the gap? I suggest we do.`),
      L(`${v.id}, ${u.id}: aloitamme teidän ${dirAdj(bearing(v.pos, u.pos))}puolella. Letkut eivät saa mennä ristiin, meidän linja tulee ${dirTo(bearing(u.pos, v.pos))} päin.`, `${v.id}, ${u.id}: we start on your ${dirAdj(bearing(v.pos, u.pos))} side. The hoses must not cross, our line comes from the ${dirTo(bearing(u.pos, v.pos))}.`),
      L(`${v.id}, ${u.id}: olemme ${r50(d)} m teistä ${side}. Väli on meidän, te pidätte oman pätkänne.`, `${v.id}, ${u.id}: we are ${r50(d)} m ${side} of you. The gap is ours, you keep your own stretch.`),
      L(`${v.id}, ${u.id}: tulimme naapuriksenne, ${r50(d)} m ${side}. Raja menee puolivälissä, ilmoittakaa jos reuna lähtee teillä liikkeelle.`, `${v.id}, ${u.id}: we are your new neighbours, ${r50(d)} m ${side}. The boundary is halfway; tell us if the edge starts moving on your side.`),
      L(`${v.id}, ${u.id}: meidän pätkä alkaa ${r50(d / 2)} m päästä teistä ${side}. Sopiiko?`, `${v.id}, ${u.id}: our stretch starts ${r50(d / 2)} m ${side} of you. Is that OK?`),
    ]));
    add(4, `handoff-ack:${v.id}`, v, u, L(`${u.id}, ${v.id}: selvä, pidetään raja: meidän pätkä loppuu ${r50(d / 2)} m päähän teistä. ${hoursOnScene(v, n) > 2 ? `Olemme olleet täällä ${fmt1(hoursOnScene(v, n))} h, reuna tuttu.` : "Kerromme jos reuna lähtee liikkeelle."}`,
      `${u.id}, ${v.id}: roger, we keep the boundary: our stretch ends ${r50(d / 2)} m from you. ${hoursOnScene(v, n) > 2 ? `We have been here ${fmt1(hoursOnScene(v, n))} h, we know the edge.` : "We will tell you if the edge starts moving."}`));
  }

  // Water (fix pass 2, 7 Oct 2026): the shuttle answers a crew's call at once with its arrival time; a crew that would
  // wait long for the basin asks the nearest crew with plenty to feed its line meanwhile, and gets its answer within
  // 30–90 s (FF7: answers came 9–13 min later). A supply line takes about a minute per 40 m to lay; two vehicles on
  // one road simply drive side by side.
  const shuttle = crews.find((x) => isShuttle(x.id));
  for (const d of water.deliveries) {
    if (!shuttle || d.unit.silent) continue;
    add(8, `water-shuttle:${d.unit.id}`, shuttle, d.unit, L(`${d.unit.id}, ${shuttle.id}: selvä, tuomme altaan linjanne päähän, perillä noin klo ${hm(d.doneS)}.`, `${d.unit.id}, ${shuttle.id}: roger, we are bringing a basin to the end of your line, there at about ${hm(d.doneS)}.`),
      d.atOffset + 30 + Math.floor(rnd() * 40));
  }
  for (const { unit: u, pct, atOffset, waitMin } of water.low) {
    if (u.silent || waitMin < 8) continue;
    const askAt = atOffset + 20;
    // Fix pass 6 (8 Oct 2026, FF5): a crew asks a neighbour only when help can arrive before its basin does: a giver on
    // the same road (vehicles side by side, about 2 min), not one 700 m away whose hose takes 20 min (evt.c15.005, .009).
    const vu = u.vehicle ?? u.pos;
    const giver = water.high.find((h) => {
      if (h.unit.id === u.id || h.unit.silent || isShuttle(h.unit.id)) return false;
      const vg2 = h.unit.vehicle ?? h.unit.pos, vd2 = dist(vu, vg2);
      return vd2 <= 300 && roadOf(vu) >= 0 && roadOf(vu) === roadOf(vg2) && 2 <= waitMin - 3;
    });
    if (!giver) continue;
    const g = giver.unit;
    const gPct = tankLevelAt(state, g.id, t0 + askAt) ?? giver.pct;
    if (gPct < 50) continue;
    const vg = g.vehicle ?? g.pos;
    const vd = dist(vu, vg);
    const sameRoad = true;
    const d = dist(g.pos, u.pos);
    add(9, `water:${u.id}`, u, g, L(`${g.id}, ${u.id}: meillä vesi vähissä, enää ${pct} %, ja allas tulee vasta noin ${waitMin} min päästä. Voitteko syöttää meidän linjaa sillä aikaa? Väliä noin ${r50(sameRoad ? vd : d)} m.`,
      `${g.id}, ${u.id}: we are low on water, only ${pct} % left, and the basin is still about ${waitMin} min away. Can you feed our line meanwhile? About ${r50(sameRoad ? vd : d)} m between us.`), askAt);
    const hose = r50(d * 1.15);
    const layMin = Math.max(1, Math.ceil(hose / LAY_MPM));
    add(6, `water-ack:${g.id}`, g, u, sameRoad
      ? L(`${u.id}, ${g.id}: onnistuu, meillä ${gPct} %. Autot ovat samalla tiellä, ajamme viereen ja kytketään säiliöt yhteen, noin 2 min.`, `${u.id}, ${g.id}: can do, we have ${gPct} %. Our vehicles are on the same road; we drive alongside and connect the tanks, about 2 min.`)
      : out.fresh([
        L(`${u.id}, ${g.id}: onnistuu, meillä ${gPct} %. Vedämme syöttölinjan teille, noin ${hose} m letkua, kytkentä noin ${layMin} min.`, `${u.id}, ${g.id}: can do, we have ${gPct} %. We will lay a supply line to you, about ${hose} m of hose, connected in about ${layMin} min.`),
        L(`${u.id}, ${g.id}: meillä ${gPct} % jäljellä, annetaan puolet. Kaksi miestä tulee letkun kanssa, ${hose} m, noin ${layMin} min.`, `${u.id}, ${g.id}: we have ${gPct} % left, you get half. Two men are coming with the hose, ${hose} m, about ${layMin} min.`),
      ]), askAt + 30 + Math.floor(rnd() * 60));
  }

  // Wind: the crew that sees it first tells its neighbour when and how it turned.
  if (inp.windPrev && angleDiff(inp.wind.fromDeg, inp.windPrev.fromDeg) >= 20) {
    const down = (inp.wind.fromDeg + 180) % 360;
    const exposed = [...crews].filter((u) => u.onEdge).sort((a, b) => dist(a.pos, inp.head) - dist(b.pos, inp.head) || (a.id < b.id ? -1 : 1));
    const was = dirFrom(inp.windPrev.fromDeg), now = dirFrom(inp.wind.fromDeg);
    // A turn within one named direction is said as a crew says it, on the 16-point rose (fix pass 3, 16: was "40 astetta vastapäivään").
    const w16 = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
    const change = was !== now ? L(`${was} ${dirTo(inp.wind.fromDeg)}`, `from the ${was} to the ${dirTo(inp.wind.fromDeg)}`)
      : w16(inp.windPrev.fromDeg) !== w16(inp.wind.fromDeg) ? L(`${FROM16[w16(inp.windPrev.fromDeg)]} ${TO16[w16(inp.wind.fromDeg)]}`, `from the ${EN16[w16(inp.windPrev.fromDeg)]} to the ${EN16[w16(inp.wind.fromDeg)]}`)
        : L(`hieman, tulee edelleen ${now}`, `a little, still from the ${now}`);
    exposed.slice(0, 2).forEach((u, i) => {
      const v = nearest(u, 1500, (x) => x.onEdge);
      add(9, `wind:${u.id}`, u, v, [
        L(`${v?.id}, ${u.id}: tuuli kääntyi noin klo ${hm(t0)} ${change}, nyt ${fmt1(inp.wind.meanMs)} m/s. Palo painuu ${dirTo(down)}, katsokaa ${dirAdj(down)}puolta.`, `${v?.id}, ${u.id}: the wind turned at about ${hm(t0)} ${change}, now ${fmt1(inp.wind.meanMs)} m/s. The fire is pushing ${dirTo(down)}, watch your ${dirAdj(down)} side.`),
        L(`${v?.id}, täällä ${u.id}: tuulen suunta muuttui klo ${hm(t0)} jälkeen, ${was === now ? `kääntyi ${change}` : `tulee nyt ${now} (oli ${was})`}. Savu kääntyi ${dirTo(down)} parissa minuutissa. Varmistakaa perääntymistie.`, `${v?.id}, this is ${u.id}: the wind direction changed after ${hm(t0)}, ${was === now ? `it turned ${change}` : `now from the ${now} (was from the ${was})`}. The smoke swung ${dirTo(down)} within a couple of minutes. Check your escape route.`),
      ][i]!);
    });
  }

  // Spot fires a crew can see from its own position.
  for (const s of inp.spotFires) {
    const u = nearestTo(s.pos, 1100);
    if (!u) continue;
    const v = nearest(u, 1500);
    const rk = isRekindleCallsign(s.callsign);
    // Radio CO-04 (SPEC/31): a crew does not use the map's label before a drone has confirmed and labelled the fire ("Pistepalo PP1" at
    // 15:24, DR1's confirmation at 15:28): it says what it sees, unconfirmed. ST-08: three phrasings by unit and step (EK15 said one
    // sentence at 17:24, 19:26 and 19:51).
    const where = dirTo(bearing(u.pos, s.pos)), howFar = r50(dist(u.pos, s.pos));
    const what = rk ? L("Mahdollinen uudelleensyttymä, varmistamatta.", "Possibly a rekindle, unconfirmed.") : L("Pistepalo, varmistamatta.", "A spot fire, unconfirmed.");
    add(9, `spot:${s.callsign}`, u, v, vary(u.id, n, [
      L(`${v?.id}, ${u.id}: näemme savua ${where}, noin ${howFar} m meistä. ${what} Näkyykö teille?`, `${v?.id}, ${u.id}: we see smoke to the ${where}, about ${howFar} m from us. ${what} Can you see it?`),
      L(`${v?.id}, ${u.id}: ${where} noin ${howFar} m päässä nousee savua. ${what} Onko teillä näkyvyys sinne?`, `${v?.id}, ${u.id}: smoke rising about ${howFar} m to the ${where}. ${what} Can you see that way?`),
      L(`${v?.id}, ${u.id}: tähystäjä näkee savua ${where}, arviolta ${howFar} m. ${what} Näettekö sen?`, `${v?.id}, ${u.id}: our lookout sees smoke to the ${where}, roughly ${howFar} m. ${what} Do you see it?`),
    ]));
  }

  // Roads and access: a crew near a road the fire is close to warns the crew that uses it.
  for (const u of crews.filter((x) => x.onEdge)) {
    const r = nearestRoute(u.pos);
    const d = fire.distanceM(r.at, 2000);
    if (dist(u.pos, r.at) < 900 && Number.isFinite(d) && d < 250 && fire.freshHa(r.at, 300) > 0 && !state.said.has(`road:${r.fi}:${n}`)) {
      state.said.add(`road:${r.fi}:${n}`);
      add(7, `road:${u.id}`, u, nearest(u, 2000), L(`${nearest(u, 2000)?.id}, ${u.id}: ${r.fi} — palo noin ${r50(d)} m tiestä, savua tiellä. Raskaat autot kiertäkää, jos mahdollista.`, `${nearest(u, 2000)?.id}, ${u.id}: ${routeEn(r.fi)} — fire about ${r50(d)} m from the road, smoke on the road. Heavy vehicles take another way if you can.`));
    }
    const road = inp.roadNear(u.pos);
    if ((road.cls === "track" || road.distM > 250) && !state.said.has(`access:${u.id}`)) {
      state.said.add(`access:${u.id}`);
      const to = nearest(u, 1500)?.id, m = r50(road.distM), from = dirFrom(bearing(u.pos, nearestRoute(u.pos).at));
      // Revision (bn), 25 Oct 2026 (review B1): a unit whose own terrain vehicle reaches its line (`access: "offroad"`, EK14's maastoauto,
      // which keeps its basin full at the line, evt.c10.005, radio 10.5) cannot say that no vehicle gets closer: it says that a fire
      // engine does not, and that its own terrain vehicle does. Not the road crews' template (was word for word KY23's line to KY21).
      // DRAFT Finnish (native and domain check). No bog word (`onBogWords`).
      add(5, `access:${u.id}`, u, nearest(u, 1500), UNIT_PLAN[u.id]?.access === "offroad"
        ? L(`${to}, ${u.id}: paloautolla pääsee meistä noin ${m} metrin päähän, siitä eteenpäin ajoura on liian pehmeä. Vain meidän maastoauto kulkee linjalle asti. Jos tuotte letkua, kantakaa viimeinen pätkä ${from}.`, `${to}, ${u.id}: a fire engine gets to about ${m} m from us; beyond that the track is too soft. Only our terrain vehicle gets through to the line. If you bring hose, carry it the last stretch in from the ${from}.`)
        : L(`${to}, ${u.id}: meille ei pääse autolla lähemmäs kuin ${m} m, ${road.cls === "track" ? "ajoura on pehmeä" : "tie loppuu"}. Jos tuotte letkua, kantakaa ${from}.`, `${to}, ${u.id}: a vehicle cannot get closer to us than ${m} m, ${road.cls === "track" ? "the track is soft" : "the road ends"}. If you bring hose, carry it in from the ${from}.`));
    }
  }

  // Fatigue: crews long on the line ask a fresher neighbour to take the nozzle for a while.
  for (const u of crews.filter((x) => x.onEdge && hoursOnScene(x, n) >= 3.5)) {
    if (state.said.has(`tired:${u.id}:${Math.floor(hoursOnScene(u, n))}`)) continue;
    const fresh = nearest(u, 1500, (x) => hoursOnScene(x, n) < hoursOnScene(u, n) - 1.5);
    if (!fresh) continue;
    state.said.add(`tired:${u.id}:${Math.floor(hoursOnScene(u, n))}`);
    const hh = fmt1(hoursOnScene(u, n));
    add(6, `tired:${u.id}`, u, fresh, out.capped("tired", [
      L(`${fresh.id}, ${u.id}: olemme olleet linjalla ${hh} h. Voitteko ottaa letkupään puoleksi tunniksi, niin pidämme juomatauon?`, `${fresh.id}, ${u.id}: we have been on the line ${hh} h. Can you take the nozzle for half an hour so we can have a drink break?`),
      ((m: number) => L(`${fresh.id}, ${u.id}: porukka alkaa olla väsynyttä (${hh} h). Vaihdetaanko suuttimet vuorotellen ${m} min välein?`, `${fresh.id}, ${u.id}: the crew is getting tired (${hh} h). Shall we swap nozzles every ${m} min?`))(15 + Math.floor(rnd() * 3) * 5),
      L(`${fresh.id}, ${u.id}: meillä takana ${hh} h. Ottaisitteko meidän pätkän hetkeksi, miehet tarvitsevat tauon.`, `${fresh.id}, ${u.id}: we have ${hh} h behind us. Could you take our stretch for a while, the men need a break.`),
      L(`${fresh.id}, ${u.id}: ${hh} h putkeen linjalla. Voisitteko tuurata suutinmiestä vartin?`, `${fresh.id}, ${u.id}: ${hh} h straight on the line. Could you stand in for our nozzle man for a quarter of an hour?`),
    ]));
  }

  // Safety: where the crew's own edge runs, crews tell each other where the lookout is and which way out.
  // Rates as the crew sees them now (`crewSees`): its own edge, and the head's current run.
  const headNow = fire.currentAdvanceM(inp.head, 400) / 20;
  for (const u of crews.filter((x) => x.onEdge)) {
    const local = fire.currentAdvanceM(u.pos, 350) / 20;
    const nearHead = dist(u.pos, inp.head) < 700;
    const running = local > 5 || (nearHead && headNow > 6);
    if (!running && !(nearHead && chance(0.25))) continue;
    const v = nearest(u, 1200, (x) => x.onEdge);
    const r = escapeRoute(u.pos, inp.head, fire, u.vehicle);
    const smokeOnRoute = Number.isFinite(fire.distanceM(r.at, 400)) && fire.freshHa(r.at, 300) > 0;
    const re = routeEn(r.fi), hd = r50(dist(u.pos, inp.head));
    const tooHotEdge = local > 5 && fire.distanceM(u.pos, 400) <= 300 && intensityClass(inp.landCoverAt(u.pos), local, true) >= 3;
    const tooHotHead = running && dist(u.pos, inp.head) <= 300 && intensityClass(inp.landCoverAt(inp.head), headNow, true) >= 3;
    add(running ? 8 : 3, `safety:${u.id}`, u, v, out.capped(running ? "safety-running" : "safety", [
      L(`${v?.id}, ${u.id}: meillä tähystäjä ${dirAdj(bearing(u.pos, inp.head))}puolella, perääntymistie: ${r.fi}. Mikä on teidän reittinne?`, `${v?.id}, ${u.id}: our lookout is on the ${dirAdj(bearing(u.pos, inp.head))} side, escape route: ${re}. What is your route?`),
      L(`${v?.id}, ${u.id}: kärki ${hd} m meistä. Jos se kääntyy, kokoontumispaikka: ${r.fi}. Pitäkää radio auki.`, `${v?.id}, ${u.id}: the head is ${hd} m from us. If it turns, the assembly point is ${re}. Keep your radio on.`),
      L(`${v?.id}, ${u.id}: kärki noin ${hd} m päässä. Jos joudumme lähtemään, reitti: ${r.fi}.`, `${v?.id}, ${u.id}: the head is about ${hd} m away. If we have to leave, the route is ${re}.`),
      // Radio ST-04 (SPEC/31): a lookout sees a head through forest only a few hundred metres off (was "3000 m"); further away it follows the smoke.
      hd <= LOOKOUT_SIGHT_M
        ? L(`${v?.id}, ${u.id}: tähystäjällä näkyvyys kärkeen, ${hd} m. Kokoontuminen: ${r.fi}, kuulolla koko ajan.`, `${v?.id}, ${u.id}: the lookout can see the head, ${hd} m. Assembly at ${re}, listening all the time.`)
        : L(`${v?.id}, ${u.id}: tähystäjä ei näe kärkeä, seuraamme savua. Kokoontuminen: ${r.fi}, kuulolla koko ajan.`, `${v?.id}, ${u.id}: the lookout cannot see the head, we are following the smoke. Assembly at ${re}, listening all the time.`),
      // The rate said is the one that makes it too hot (review 6 Oct 2026, A2: "4 m/min, liian kuuma" near the head).
      // "Too hot" only within ~300 m of the edge or head and with flames that warrant it (fix pass 5, 8 Oct 2026); otherwise the crew watches.
      tooHotEdge ? L(`${v?.id}, ${u.id}: reuna juoksee meillä noin ${Math.round(local)} m/min, liian kuuma suoraan hyökkäykseen. Turva-alue palaneella alalla takanamme.`, `${v?.id}, ${u.id}: the edge is running at about ${Math.round(local)} m/min here, too hot for a direct attack. Safety zone in the burned area behind us.`)
        : tooHotHead ? L(`${v?.id}, ${u.id}: kärki juoksee noin ${Math.round(headNow)} m/min ${hd} m meistä, liian kuuma suoraan hyökkäykseen. Turva-alue palaneella alalla takanamme.`, `${v?.id}, ${u.id}: the head is running at about ${Math.round(headNow)} m/min ${hd} m from us, too hot for a direct attack. Safety zone in the burned area behind us.`)
        : running ? L(`${v?.id}, ${u.id}: kärki juoksee noin ${Math.round(Math.max(headNow, local))} m/min, ${hd} m meistä. Seuraamme etenemistä, turva-alue palaneella alalla takanamme.`, `${v?.id}, ${u.id}: the head is running at about ${Math.round(Math.max(headNow, local))} m/min, ${hd} m from us. We are watching its progress, safety zone in the burned area behind us.`)
        : L(`${v?.id}, ${u.id}: reuna rauhoittui, mutta pidämme tähystäjän. Turva-alue palaneella alalla, reitti: ${r.fi}.`, `${v?.id}, ${u.id}: the edge has calmed down, but we keep the lookout. Safety zone in the burned area, route: ${re}.`),
      // The way out named as a route, or as the way back to the crew's own vehicle (review 3 Oct 2026: "perääntymistie (oma auto) on savun peitossa" read as a smoky vehicle).
      smokeOnRoute ? L(`${v?.id}, ${u.id}: ${r.fi === OWN_VEHICLE ? "tie autollemme" : `perääntymistie (${r.fi})`} on savun peitossa. Käytämme palanutta alaa turva-alueena, tehkää samoin.`, `${v?.id}, ${u.id}: ${r.fi === OWN_VEHICLE ? "the way back to our vehicle" : `the escape route (${re})`} is covered in smoke. We use the burned area as a safety zone; do the same.`)
        : L(`${v?.id}, ${u.id}: tarkistimme ${r.fi === OWN_VEHICLE ? "tien autollemme" : `perääntymistien (${r.fi})`}, auki. Sovitaan, että ilmoitamme toisillemme ennen kuin kumpikaan lähtee.`, `${v?.id}, ${u.id}: we checked ${r.fi === OWN_VEHICLE ? "the way back to our vehicle" : `the escape route (${re})`}, it is open. Let us agree to tell each other before either of us leaves.`),
    ]));
  }

  // Hose: a long line from the vehicle loses pressure; the neighbour may have a closer road.
  for (const u of crews.filter((x) => (x.hoseM ?? 0) >= 400 && !state.said.has(`hose:${x.id}:${x.place}`))) {
    state.said.add(`hose:${u.id}:${u.place}`);
    // TG-02: no wording is drawn here, so the call goes to the nearest crew on the caller's own talk group (or the water shuttle).
    const v = nearest(u, 1200, (x) => sameTalkGroup(u, x));
    add(5, `hose:${u.id}`, u, v, L(`${v?.id}, ${u.id}: letkulinjamme on ${u.hoseM} m, paine jää heikoksi. Onko teillä ylimääräistä jatkopumppua tai lyhyempää reittiä autolle?`, `${v?.id}, ${u.id}: our hose line is ${u.hoseM} m, the pressure stays low. Do you have a spare booster pump or a shorter route for the vehicle?`));
  }

  const cap = n <= 3 ? 9 : 7;
  const seen = new Set<string>();
  const kept = c
    .filter((x) => !out.same(() => n >= 10 && n <= 11 && onBogWords.test(x.text)))
    .sort((a, b) => b.prio - a.prio || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0))
    .filter((x) => { const k = `${x.from.id}>${x.topic.split(":")[0]}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, cap);
  for (const x of kept) {
    out.push({ ...(x.offsetS !== undefined ? { offsetS: x.offsetS } : {}), actor: x.from.id, actor_type: actorTypeOf(x.from.id, null), addressee: x.to.id, pos: x.from.pos, place: x.from.place, location: x.from.sector,
      event_type: "coordination", task: x.from.task, content: x.text, tier: "T4_lateral", channel: "radio_lateral", nav: x.topic.startsWith("water") ? "vesi_reitit" : "yksikot" }, "lateral");
  }
}
