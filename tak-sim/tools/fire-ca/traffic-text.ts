/**
 * Shared vocabulary for the traffic corpus (`traffic.ts` and its parts): directions, rounding,
 * clock formats, ground and task words, and each unit's VOICE — how its leader talks on the radio,
 * so that five crews seeing the same fire do not say the same sentence (review 1 Oct 2026, item 5).
 * Every choice is seeded (the caller's Mulberry32), never Math.random.
 */

import type { ActorType, AirKind } from "../../app/scenario/types.js";
import type { P } from "./deployment.js";

/**
 * The language the generator writes (session language "en", 1 Oct 2026). The generator runs once in
 * Finnish (the corpus) and once in English with the same draws and the same choices replayed
 * (`Out.tape`), so the English record of an event says what its Finnish record says. Every
 * participant-facing literal is `L(fi, en)`; numbers, unit ids and proper names are shared.
 */
let LANG: "fi" | "en" = "fi";
export function withLang<T>(lang: "fi" | "en", f: () => T): T {
  const was = LANG;
  LANG = lang;
  try { return f(); } finally { LANG = was; }
}
export const isEn = () => LANG === "en";
/** The literal in the language being written. */
export const L = (fi: string, en: string): string => (LANG === "en" ? en : fi);
/** Equal-length Finnish and English lists: the same index is picked in both runs. */
export function LL(fi: readonly string[], en: readonly string[]): readonly string[] {
  if (fi.length !== en.length) throw new Error(`LL: ${fi.length} Finnish and ${en.length} English variants`);
  return LANG === "en" ? en : fi;
}

/** Place names in the log (`traffic-places.ts`, `deployment.ts`) and their English. Proper names stay. */
const PLACE_EN: Readonly<Record<string, string>> = {
  "pohjoisreuna": "north flank", "pohjoisreuna, Karhujärven puoli": "north flank, Karhujärvi side", "kaakkoisrintama": "south-east front",
  "syttymäkohta": "point of origin", "Syttymäkohdan eteläreuna": "south edge by the point of origin", "kärki, pohjoissivusta": "head, north flank", "kärki, eteläsivusta": "head, south flank", "kärki": "head",
  "eteläsivusta": "south flank", "pohjoissivusta": "north flank", "itäreuna": "east edge", "tie R1, palanut alue": "road R1, burned area", "oma auto": "own truck",
  "johtopaikka": "command post", "tie R1": "road R1", "tie R2": "road R2", "R1/R2-risteys": "R1/R2 junction", "R3:n silta (Kotkanjoki)": "R3 bridge (Kotkanjoki)",
  "Lahdenkylän lampi": "Lahdenkylä pond", "koko kehä": "whole perimeter", "eteläreuna (L3)": "south edge (L3)",
  "kuva-ala": "image area", "reuna": "edge", "vesipiste": "water point", "maastossa": "in the terrain",
  "Lahdenkylän lampi (W2)": "Lahdenkylä pond (W2)", "R3:n silta (Kotkanjoki), W3": "R3 bridge (Kotkanjoki), W3",
  "vesipiste W1 (Haukilampi)": "water point W1 (Haukilampi)", "vesipiste W2 (Lahdenkylän lampi)": "water point W2 (Lahdenkylä pond)", "vesipiste W3, R3:n silta (Kotkanjoki)": "water point W3, R3 bridge (Kotkanjoki)",
  "viljelijän lietevaunu": "farmer's slurry tanker", "pohjoisreuna (L1)": "north flank (L1)", "EK13:n vesiajo": "EK13's water run",
  "metsäautotie (Honkaharju)": "forest road (Honkaharju)", "R2:n ja metsäautotien risteys": "junction of R2 and the forest road",
  "länsireuna (L4)": "west edge (L4)",
};
/** A place name in the language being written. */
export const pl = (p: string): string => (LANG === "en" ? PLACE_EN[p] ?? p : p);
/** Sector labels ("L3-Etelä") in the language being written. */
const SECTOR_EN: Readonly<Record<string, string>> = { "L1-Pohjoinen": "L1-North", "L2-Koillinen": "L2-North-east", "L3-Etelä": "L3-South", "L4-Länsi": "L4-West", Kaakkoisrintama: "South-east front" };
export const sec = (s: string): string => (LANG === "en" ? SECTOR_EN[s] ?? s : s);

export type LandCoverFi = "forest" | "spruce" | "ridge" | "birch" | "drained_bog" | "pine_bog" | "open_bog" | "field" | "water";

/** A seeded draw: `rnd()` in [0, 1), `pick` one of a list, `chance(p)`. */
export interface Draw {
  readonly rnd: () => number;
  readonly pick: <T>(xs: readonly T[]) => T;
  readonly chance: (p: number) => boolean;
}
export function drawFrom(next: () => number): Draw {
  return { rnd: next, pick: (xs) => xs[Math.floor(next() * xs.length)]!, chance: (p) => next() < p };
}

const DIR_TO = ["pohjoiseen", "koilliseen", "itään", "kaakkoon", "etelään", "lounaaseen", "länteen", "luoteeseen"] as const;
const DIR_FROM = ["pohjoisesta", "koillisesta", "idästä", "kaakosta", "etelästä", "lounaasta", "lännestä", "luoteesta"] as const;
const DIR_ADJ = ["pohjois", "koillis", "itä", "kaakkois", "etelä", "lounais", "länsi", "luoteis"] as const;
const DIR_EN = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
const dirIdx = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 45) % 8;
/** "koilliseen" / "north-east" (English uses the bare direction: "moves north-east"). */
export const dirTo = (deg: number) => (LANG === "en" ? DIR_EN : DIR_TO)[dirIdx(deg)]!;
/** "lounaasta" / "south-west" (the English caller writes "from the …"). */
export const dirFrom = (deg: number) => (LANG === "en" ? DIR_EN : DIR_FROM)[dirIdx(deg)]!;
/** "pohjois", "kaakkois": the first half of a compound ("pohjoisreuna"); English "north", "south-east". */
export const dirAdj = (deg: number) => (LANG === "en" ? DIR_EN : DIR_ADJ)[dirIdx(deg)]!;
export const bearing = (from: P, to: P) => ((Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI + 360) % 360;
export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export const r10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);
export const r50 = (m: number) => Math.max(50, Math.round(m / 50) * 50);
export const fmt1 = (x: number) => (LANG === "en" ? x.toFixed(1) : x.toFixed(1).replace(".", ","));
/** Sentence case for a clause that starts a sentence. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Wall clock for a simulation time (0 = start of step 1, 13:20), "HH:MM:SS". */
export const clockAt = (simS: number) => { const t = 13 * 3600 + 20 * 60 + simS; return [Math.floor(t / 3600) % 24, Math.floor((t % 3600) / 60), t % 60].map((v) => String(v).padStart(2, "0")).join(":"); };
/** Spoken Finnish clock, "16.20". */
export const hm = (simS: number) => clockAt(simS).slice(0, 5).replace(":", ".");
/** Start of step n in simulation seconds. */
export const stepStartS = (n: number) => (n - 1) * 1200;

export function actorTypeOf(id: string, air: AirKind | null): ActorType {
  if (air === "drone") return "drone";
  if (air === "water_drone") return "water_drone";
  if (air === "helicopter") return "helicopter";
  if (air === "fixed_wing") return "spotter_aircraft";
  if (id === "P2" || id === "HÄTÄKESKUS" || id === "POLIISI") return "command"; // the duty officer, the emergency centre, the police (fix pass 2–3)
  if (id === "DRONERYHMÄ") return "drone"; // the drone team's operators at the command post
  if (id === "VPK") return "volunteer_brigade";
  if (id === "EK14") return "forest_fire_unit";
  if (id.startsWith("UGV")) return "robot";
  return "fire_team";
}

const FUEL_FI_LISTS: Record<LandCoverFi, readonly string[]> = {
  forest: ["kuivaa männikkökangasta", "kanerva- ja jäkäläkangasta", "harvaa sekametsää", "kuivaa kangasmetsää, paljon kuivaa kariketta"],
  spruce: ["tiheää kuusikkoa, oksat maahan asti", "harventamatonta kuusikkoa"],
  ridge: ["harjun kuivaa jäkäläkangasta", "harjun rinnettä, hiekkapohjaa ja männikköä"],
  birch: ["koivu- ja haapavaltaista lehtimetsää", "lehtipuuvaltaista rantametsää"],
  drained_bog: ["ojitettua turvemaata", "kuivunutta ojitettua suota"],
  pine_bog: ["mäntyrämettä", "rämettä, turvepohjaa"],
  open_bog: ["avosuota", "märkää avosuota"],
  field: ["peltoa", "pellon reunaa"],
  water: ["rantaa", "rantaviivaa"],
};
const FUEL_EN_LISTS: Record<LandCoverFi, readonly string[]> = {
  forest: ["dry pine heath", "heather and lichen heath", "open mixed forest", "dry heath forest with a lot of dry litter"],
  spruce: ["dense spruce, branches down to the ground", "unthinned spruce"],
  ridge: ["dry lichen heath on the esker", "the esker slope, sandy ground and pine"],
  birch: ["birch and aspen broadleaf forest", "broadleaf shore forest"],
  drained_bog: ["drained peatland", "dried-out drained bog"],
  pine_bog: ["pine bog", "pine bog on peat"],
  open_bog: ["open bog", "wet open bog"],
  field: ["field", "field edge"],
  water: ["shore", "shoreline"],
};
/** The fuel words for a ground type, in the language being written (same count in both). */
export const FUEL_FI: Readonly<Record<LandCoverFi, readonly string[]>> = new Proxy(FUEL_FI_LISTS, { get: (t, k: string) => (LANG === "en" ? FUEL_EN_LISTS : t)[k as LandCoverFi] });
export const isBog = (lc: LandCoverFi) => lc === "drained_bog" || lc === "pine_bog" || lc === "open_bog";

const TASK_FI_MAP: Record<string, string> = {
  hose_attack: "sammutus letkulinjalla", pump_attack: "sammutus moottoriruiskulla", peat_soak: "turvepalon kastelu",
  firebreak: "palokatkon raivaus", road_line: "linjan pito tiellä", mop_up: "jälkisammutus", hose_laying: "letkulinjan veto", refill: "veden täydennys", water_shuttle: "vedensiirto, toimittaa vettä altaalle",
  rest: "lepo ja huolto", withdrawn: "vetäytynyt tielle", evacuation: "evakuoinnin avustus", staging: "odottaa tehtävää",
  transit: "siirtymässä", blocked: "pysähtynyt",
};
const TASK_EN_MAP: Record<string, string> = {
  hose_attack: "attack with a hose line", pump_attack: "attack with a portable pump", peat_soak: "soaking burning peat",
  firebreak: "cutting a firebreak", road_line: "holding the road line", mop_up: "mop-up", hose_laying: "laying a hose line", refill: "refilling water", water_shuttle: "water shuttle, delivering water to a basin",
  rest: "rest and maintenance", withdrawn: "withdrawn to the road", evacuation: "helping the evacuation", staging: "waiting for a task",
  transit: "moving", blocked: "stopped",
};
/** A task's name in the language being written. */
export const TASK_FI: Readonly<Record<string, string>> = new Proxy(TASK_FI_MAP, { get: (t, k: string) => (LANG === "en" ? TASK_EN_MAP : t)[k] });

/**
 * Fire intensity class at a point, from what a crew or camera can see there: the local rate of
 * spread and the ground the rate was measured on (the caller passes both for the same interval and
 * cells). 0 = no fire in sight, 1 smouldering/creeping, 2 low surface fire, 3 moderate, 4 intense
 * surface fire with torching, 5 crown fire. A fire running over 12 m/min is intense whatever the
 * ground: the land-cover cap applies only at low rates (review 6 Oct 2026, A2: 38 m/min read "2/5,
 * flames 0.3–1 m" because the drone's centre point lay in the birch stand).
 */
export function intensityClass(lc: LandCoverFi, rateMpm: number, burningNear: boolean): number {
  if (!burningNear) return 0;
  if (rateMpm > 12) return lc === "spruce" ? 5 : 4;
  if (isBog(lc) || lc === "field" || lc === "water") return rateMpm > 3 ? 2 : 1;
  if (lc === "birch") return rateMpm > 4 ? 2 : 1;
  if (rateMpm > 6) return lc === "spruce" ? 4 : 3;
  if (rateMpm > 1.5) return 2;
  return 1;
}
const FLAME_FI_LIST = ["ei liekkejä", "liekit alle 0,3 m", "liekit 0,3–1 m", "liekit 1–2 m", "liekit 2–4 m", "liekit puiden latvojen yli"] as const;
const FLAME_EN_LIST = ["no flames", "flames under 0.3 m", "flames 0.3–1 m", "flames 1–2 m", "flames 2–4 m", "flames above the treetops"] as const;
/** Flame height by intensity class, in the language being written. */
export const FLAME_FI: readonly string[] = new Proxy([...FLAME_FI_LIST], { get: (t, k) => Reflect.get(LANG === "en" ? FLAME_EN_LIST : t, k) });

/**
 * How a unit's leader talks (seeded by unit, fixed for the day). `prefix` opens a report; `self`
 * is how it names itself; `hedge` the words it uses when it is not sure.
 */
export interface Voice {
  readonly prefix: (id: string, place: string | null) => string;
  readonly hedge: readonly string[];
  readonly ack: readonly string[];
}
const V_TERSE: Voice = {
  prefix: (id, place) => `${id}${place ? `, ${pl(place)}` : ""}:`,
  get hedge() { return LL(["arvio", "varmistamatta", "tarkentuu"], ["estimate", "unconfirmed", "to be refined"]); },
  get ack() { return LL(["Kuittaan.", "Selvä."], ["Copy.", "Roger."]); },
};
const V_LOCAL: Voice = {
  prefix: (id, place) => L(`${id} täällä${place ? ` ${place}` : ""}.`, `${id} here${place ? `, ${pl(place)}` : ""}.`),
  get hedge() { return LL(["näin äkkiseltään arvioituna", "en ole ihan varma", "pitää vielä katsoa"], ["at a quick guess", "I am not quite sure", "we will have to look again"]); },
  get ack() { return LL(["Joo, selvä.", "Ok, hoidetaan."], ["Yes, got it.", "OK, we will handle it."]); },
};
const V_CROSS: Voice = {
  // KY21: a cross-border unit with its own call-sign habits (SPEC/18 §8.1).
  prefix: (id, place) => L(`Johto, ${id}${place ? ` (${place})` : ""}:`, `Command, ${id}${place ? ` (${pl(place)})` : ""}:`),
  get hedge() { return LL(["arviolta", "ei varmistettu", "epävarma tieto"], ["roughly", "not confirmed", "uncertain information"]); },
  get ack() { return LL(["Kuitattu.", "Vastaanotettu."], ["Acknowledged.", "Received."]); },
};
const V_FOREST: Voice = {
  prefix: (id, place) => `${id}${place ? ` ${pl(place)}` : ""} —`,
  get hedge() { return LL(["karkea arvio", "näkyvyys huono, varmistamatta", "arvio maastosta"], ["rough estimate", "poor visibility, unconfirmed", "estimate from the ground"]); },
  get ack() { return LL(["Selvä, toimitaan.", "Kuittaus."], ["Roger, acting on it.", "Copy."]); },
};
const V_OUTSIDE: Voice = {
  prefix: (id, place) => `${id}${place ? ` (${pl(place)})` : ""}:`,
  get hedge() { return LL(["arvio, emme tunne maastoa", "kartan mukaan, varmistamatta", "epävarma, paikannimet vieraita"], ["estimate, we do not know the terrain", "by the map, unconfirmed", "uncertain, the place names are new to us"]); },
  get ack() { return LL(["Selvä, kuittaan.", "Ymmärretty."], ["Roger, copy.", "Understood."]); },
};
export function voiceOf(id: string): Voice {
  if (id === "VPK") return V_LOCAL;
  if (id === "KY21" || id === "KY23") return V_CROSS;
  if (id === "EK14") return V_FOREST;
  if (id === "OUT1" || id === "OUT2") return V_OUTSIDE;
  return V_TERSE;
}

/** A unit's radio sentence in its own voice: its opening, then `text` (capitalised after a full stop). */
export function say(id: string, place: string | null, text: string): string {
  const pre = voiceOf(id).prefix(id, place);
  return `${pre} ${pre.endsWith(".") ? cap(text) : text}`;
}
