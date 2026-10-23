/**
 * The hand-judged half of the difficulty audit (`difficulty-audit.ts`; `docs/audits/2026-10-23-difficulty/audit.md` §2), one row per item.
 * Judged on 23 Oct 2026 from the built scenario (the key records, their tier, view and arrival; the map as the participant sees it: the TAK
 * shell, the MML-style basemap without vegetation types, the overlay's sector codes and road labels, no water points, no area figure, and
 * the blank basemap of the freeze map). DRAFT, for the researcher and the domain reviewer.
 *
 * - `channels`: (a) pushed to the message log; (b) drawn on the map without action (fire, units, rate marks, projection, wind arrow);
 *   (c) only by seeking (Haku or the Thinker: the records); (d) inference across sources or domain knowledge; (e) map reading that no
 *   record does for the participant (distances by the scale bar, which feature lies where, placing a point on the blank freeze map).
 * - `passive`: a participant who never searches can answer — yes / partly (part of the basis, or only a hard estimate) / no.
 * - `map`: map dependence — none / helps / required.
 * - `mapUnstated`: the key rests on a map fact (or a fact on no surface at all) that no record states before the item's moment.
 * - `extra`: PUSHED records the judgement rests on beyond the item's own key records (checked to be pushed before the moment).
 * - `anyOf`: the key records are duplicates; the first suffices (the lead is the earliest's).
 * - `stemSuffices`: the stem states the premise the key records give, so a non-searcher can answer although they are recorded-only.
 */

export interface HandRow {
  readonly channels: string;
  readonly passive: "yes" | "partly" | "no";
  readonly map: "none" | "helps" | "required";
  readonly mapUnstated: boolean;
  /** Where a seeker finds what a non-seeker lacks; "" when nothing needs seeking. */
  readonly seek: string;
  readonly note: string;
  readonly extra?: readonly string[];
  readonly anyOf?: boolean;
  readonly stemSuffices?: boolean;
}

const row = (channels: string, passive: HandRow["passive"], map: HandRow["map"], note: string, more: Partial<HandRow> = {}): HandRow =>
  ({ channels, passive, map, mapUnstated: false, seek: "", note, ...more });

export const HAND: Readonly<Record<string, HandRow>> = {
  // VP (practice, not scored; freeze at 69 s, everything pushed at 0 s)
  "freeze.practice.infra": row("a", "yes", "none", "VOL1's pushed 12.09 report: water at Pike Pond (W1), the forest road takes a tanker"),
  "freeze.practice.first_target": row("a,d", "yes", "helps", "EK11's pushed reports: head north-east towards R1 ~320 m; the cottages 2.1 km and the village 3.0 km away"),
  "freeze.practice.r1_arrival": row("a,d", "yes", "helps", "EK11's pushed 320 m at 4 m/min gives ~80 min (the drawn head and rate ~97 min): arithmetic on pushed figures"),
  "freeze.practice.head_now": row("b,e", "yes", "required", "the drawn fire; placed on the blank freeze basemap by the terrain around it (R1, the clear-cut)"),

  // V2 (merged, steps 2–3; freeze at 105 s; step-3 records arrive at 65 s)
  "freeze.2.infra": row("c,d", "partly", "none", "DR1's road reports are recorded only (sensor log); pushed are only V1's 'the edge crossed road R1 at the head' and 3–4 m flames, which suggest but do not state the road's state", { seek: "Haku: DR1 road report (R1 south of Dry Heath)", anyOf: true, extra: ["atom.demo.1.1"] }),
  "freeze.2.ek11_between": row("a,d", "yes", "helps", "integrates three step-3 pushed records that arrive at the step boundary (65 s), 40 s before the freeze"),
  "freeze.2.south_flank": row("a,d", "yes", "none", "EK12's 13.20 (V1) and 14.08 (65 s) pushed reports"),
  "freeze.2.area_40": row("c,d,e", "no", "helps", "no area figure is pushed by V2 and the map prints none: a non-searcher must estimate hectares from the drawn polygons with the scale bar; the growth series (13.55 13.8 ha, 14.15 18.3 ha) is recorded only", { seek: "Haku: DR3 perimeter surveys 13.55 and 14.15" }),
  "freeze.2.spruce_behaviour": row("a,d", "yes", "none", "the pushed 'dense spruce ~500 m ahead' (story 2.0) and the stem name the stand; the key is domain knowledge (spruce + wind -> crown fire, embers): novices lack it", { extra: ["atom.demo.2.0"] }),
  "freeze.2.junction_hour": row("b,d,e", "partly", "required", "no record states the fire's distance to the R1/R2 junction; extrapolate the drawn head along its direction with the scale bar and the pushed rate (DR1 7.1 m/min); the map's ~950 m now is the lure", { mapUnstated: true }),
  "freeze.2.ek11_point": row("a,b,e", "yes", "required", "EK11's move to the esker (radio 3.0, at 65 s, 40 s before the freeze) and its symbol; placed on the blank basemap by the esker's shape"),
  "freeze.2.head_later": row("b,d,e", "partly", "required", "an hour on; V2's projection ends at 40 minutes: extrapolate the drawn head and rate on the blank basemap", { mapUnstated: true }),

  // V4 (merged, steps 5–6; freeze at 102 s; step-6 records arrive at 65 s)
  "freeze.4.infra": row("a,c", "yes", "none", "the key record (water supply log) is recorded only, but VOL1's pushed 15.01 'Pike Pond, tank full' states the same at 65 s", { seek: "Haku: water supply log", extra: ["evt.c06.007"] }),
  "freeze.4.ek12_where": row("a,b", "yes", "helps", "EK12's withdrawal radio (6.1) at 65 s; its symbol moves at the boundary"),
  "freeze.4.fastest_spread": row("a,b,d", "yes", "helps", "the crown-fire story beat and DR3's pushed 14.1 m/min, both at 65 s; the sector from the map's codes"),
  "freeze.4.head_unattended": row("a,d", "yes", "none", "two withdrawal radios and EK11's 'waiting on the road', all at 65 s"),
  "freeze.4.return_danger": row("a,d", "yes", "none", "the pushed 'embers 200–400 m ahead' (story 6.0, 65 s) plus knowledge that spot fires start behind crews returning to the flank"),
  "freeze.4.crown_drops": row("d", "partly", "helps", "no record before step 7 and no map layer shows a broadleaf strip (the basemap has no forest types); only knowledge that brook valleys carry birch, cued by the name Koivuoja / Birch Creek; the map shows where the brook lies ahead of the head", { mapUnstated: true }),
  "freeze.4.korpioja_spot": row("a,d,e", "yes", "helps", "pushed spotting 200–400 m ahead (65 s) and knowledge; where Alder Creek lies across the head's path is only on the map, though the stem implies it"),
  "freeze.4.head_later": row("b,d,e", "partly", "required", "20 minutes on, inside V4's 40-minute projection (a breach view: the key lies beyond the isochrone); placed on the blank basemap", { mapUnstated: true }),

  // V5 (single step 7; freeze at 61 s)
  "freeze.5.infra": row("c", "no", "none", "DR2's 15.27 road report is recorded only; nothing pushed states R1's state", { seek: "Haku: DR2 road report (R1 south of Dry Heath)" }),
  "freeze.5.lines_breached": row("a,d", "yes", "helps", "the pushed Alder Creek crossing (radio 7.2) and EK11's place"),
  "freeze.5.hose_short": row("a,d", "yes", "none", "EK11's two pushed step-7 reports"),
  "freeze.5.ek14_shelter": row("c,d", "no", "helps", "the turn of the wind that leaves the north edge downwind is only in the recorded 15.00 forecast (every forecast of the session is recorded only); the map's wind arrow still shows south-west", { seek: "Haku: weather forecast update 15.00" }),
  "freeze.5.wind_shift": row("d,e", "yes", "helps", "the stem states the premise ('if the wind starts blowing from the south'); the key is which edge then runs: knowledge and the map's orientation", { stemSuffices: true }),
  "freeze.5.area_hour": row("a,d", "yes", "none", "DR3's pushed 15.35 survey: 76.4 ha with 35.8 ha new in 20 minutes; arithmetic over three steps"),
  "freeze.5.road_jump": row("a,d", "yes", "helps", "the pushed 'stopped at Birch Creek' is the lure; the key needs knowledge that the pushed crown-run embers cross a brook"),
  "freeze.5.head_now": row("b,e", "yes", "required", "the drawn head; placed on the blank basemap"),

  // V7 (single step 10; freeze at 73 s)
  "freeze.7.infra": row("a,c", "yes", "none", "the key record (water supply log) is recorded only, but EK12's pushed radio 10.0 says it is refilling at W3", { seek: "Haku: water supply log", extra: ["atom.radio.10.0"] }),
  "freeze.7.ky21_where": row("a", "yes", "none", "KY21's pushed radio; the map symbol still shows the south edge by design (the map is the lure)"),
  "freeze.7.lull_meaning": row("a,d", "yes", "none", "the pushed sector summary and EK11's report"),
  "freeze.7.north_help": row("a,d", "yes", "helps", "three pushed moves to the north edge"),
  "freeze.7.rekindle_sector": row("a,d,e", "partly", "helps", "verification item: pushed only that KY21 and VOL1 leave the south edge (L3); the WNW turn is in the recorded forecasts and VPK's doubt comes in V8; the old south edge's sector from the map codes and the tour's sector text", { seek: "Haku: forecasts (16.00), VOL1's 'south edge calmed' (recorded)", extra: ["atom.radio.10.3"] }),
  "freeze.7.cabins_reach": row("a,d,e", "yes", "helps", "DR3's pushed north-edge rate 5.3 m/min and a distance read from the map (~1.7 km) or the old pushed 2.1 km", { extra: ["evt.c10.008", "evt.c01.008"] }),
  "freeze.7.cp_safe": row("b,d,e", "partly", "required", "no record states the fire's distance to the command post (~760 m) before V8: the scale bar and the wind arrow; the turn away from the CP is in the recorded forecast", { mapUnstated: true, seek: "Haku: forecast 16.00" }),
  "freeze.7.relief_next": row("a,d", "yes", "none", "arithmetic over five pushed time-on-scene and arrival records from V1–V7"),

  // V10 (single step 13; freeze at the view's end, >= 120 s)
  "freeze.10.infra": row("a", "yes", "helps", "the pushed story beat 13.0: R2 passable, the new fire a good kilometre away"),
  "freeze.10.ek12_water": row("a,c,d", "yes", "none", "EK12's pushed request with EK13's estimate implies the delivery; EK13's confirmation is lateral (recorded)", { seek: "Haku: EK13's reply (unit-to-unit)" }),
  "freeze.10.cabins_distance": row("a", "yes", "helps", "DR1's pushed 17.05 thermal image (V9): ~1700 m", { anyOf: true }),
  "freeze.10.area_total_hour": row("c,d,e", "no", "helps", "no area is pushed in phase B and the map prints none; the recorded 17.35 survey (153.6 ha, 'no edge moved') is the lure, so even a seeker must add the new front's growth from the drawn perimeters", { mapUnstated: true, seek: "Haku: DR3 survey 17.35 (gives the lure)" }),
  "freeze.10.front_r2_80": row("a,b,d,e", "partly", "required", "the pushed 'a good kilometre from R2' (the lure) less the drawn rate mark (4 m/min) x 100 min", { extra: ["atom.demo.13.0"] }),
  "freeze.10.south_front_point": row("a,b,e", "yes", "required", "the pushed story beats (120 m SE of the origin, spreading east) and the drawn front; placed on the blank basemap", { anyOf: true }),

  // V12 (merged, steps 16–17; freeze at the view's end, >= 130 s; step-17 records arrive at 65 s)
  "freeze.12.longest_shift": row("c,d", "partly", "none", "the hours are in the units' status answers (asked-only, recorded); a non-searcher can infer EK11 (on scene since 11.50, VP; relief asked at 4.5 h, V7)", { seek: "Haku: units' status answers ('when asked')", extra: ["evt.vp.002", "evt.c10.011"] }),
  "freeze.12.f7": row("c", "no", "none", "verification item by design: the line's true state is only in the recorded grid-operator log (V4) and HELI1's report (V6)", { seek: "Haku: the distribution company's log, HELI1" }),
  "freeze.12.front_toward": row("b,c,d", "partly", "required", "the story beat naming Bay Village is recorded only; the drawn rate mark points south-east and Bay Village lies south-east on the map; DR1's pushed Bay Village survey implies the threat", { seek: "Haku: SPOT's step-17 report", extra: ["evt.c17.009"] }),
  "freeze.12.village_distance": row("a,d", "yes", "helps", "DR1's pushed 18.45 survey (2350 m, the lure) less the rate (map or pushed DR2) x 40 min"),
  "freeze.12.head_now": row("b,e", "yes", "required", "the drawn head; placed on the blank basemap"),
  "freeze.12.head_later": row("b,d,e", "partly", "required", "an hour on; V12's projection ends at 19.20: extrapolate on the blank basemap", { mapUnstated: true }),

  // V14 (merged, steps 19–20; freeze at the view's end, >= 130 s)
  "freeze.14.infra": row("a", "yes", "none", "OUT1's and OUT2's pushed arrival radios (V12)", { anyOf: true }),
  "freeze.14.shift_change": row("a", "yes", "none", "two pushed step-19 radios"),
  "freeze.14.road_crossed": row("a,d", "yes", "helps", "three pushed radios"),
  "freeze.14.residents": row("a,d", "yes", "none", "the police's and VOL1's pushed radios"),
  "freeze.14.se_front_r2": row("a,d", "yes", "none", "arithmetic over three pushed figures (550 m, 11.5 m/min, the 100 m trigger)"),
  "freeze.14.flare_next": row("a,b,d", "yes", "helps", "two pushed story beats and the map's wind arrow"),

  // SPAM (ready at 25 s; tools usable while answering)
  "probe.s.cycle_3": row("a", "yes", "none", "DR3's pushed 14.35 survey"),
  "probe.s.cycle_3.b": row("a,c,d", "partly", "none", "needs the recorded 14.15 survey beside the pushed 14.35 one", { seek: "Haku: DR3 perimeter survey 14.15" }),
  "probe.s.cycle_6": row("a", "yes", "none", "the pushed Birch Creek crossing (radio 8.3)"),
  "probe.s.cycle_6.b": row("c,d", "no", "none", "both DR2 road reports are recorded only (retrieval-dependent by design)", { seek: "Haku: DR2 road reports 15.27 and 15.47" }),
  "probe.s.cycle_8": row("a", "yes", "none", "the pushed story beat (V6) and EK14's pushed repeat (V8)", { anyOf: true }),
  "probe.s.cycle_11": row("a", "yes", "none", "the pushed story beat 14.0"),
};
