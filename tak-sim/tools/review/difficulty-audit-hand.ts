/**
 * The hand-judged half of the difficulty audit (`difficulty-audit.ts`; `docs/audits/2026-10-23-difficulty/audit.md` §2), one row per item.
 * Judged on 23 Oct 2026 from the built scenario (the key records, their tier, view and arrival; the map as the participant sees it: the TAK
 * shell, the MML-style basemap without vegetation types, the overlay's sector codes and road labels, no water points, no area figure, and
 * the blank basemap of the freeze map). DRAFT, for the researcher and the domain reviewer.
 *
 * Updated 24 Oct 2026 for the play-test decisions (`docs/audits/2026-10-23-playtest/analysis.md` §6): `freeze.5.infra` "no" → "partly"
 * (the audit fix: EK11's and EK12's pushed 15.03 and 15.07 R1 reports); `freeze.4.crown_drops` and `freeze.5.ek14_shelter` → "yes" (D3's
 * pushed birch-strip line, D7's pushed forecast headline); V10 `area_total_hour` → `area_growth_hour` (D5); V12 `head_now` re-keyed at
 * 19.00 and V10 `south_front_point` at 17.40 (D1, D8); the re-worded stems (D1, D3) and F7's H9-only scoring (D6) noted.
 *
 * Updated 25 Oct 2026 for the play-test decisions R1–R9 (`analysis.md` §10.4): VP `r1_arrival` asks a time of day (R4); V4 `head_later`
 * exploratory (R2); V5 `area_hour` re-banded (R8); V10 `infra` with DR2's plain "ajettavissa" and a false option c (R3); SPAM V3.b's
 * magnitudes (R9); V14 `se_front_r2`'s figures (B4); the brook Myllyoja / Mill Brook (R5). No class changed.
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
  "freeze.practice.r1_arrival": row("a,d", "yes", "helps", "play-test R4: a time of day; EK11's pushed 12.01 '320 m' at '4 m/min' gives 13.21 (the drawn head and rate 13.37, the fire model 13.20), all in the key 13.10–13.40: arithmetic on pushed figures"),
  "freeze.practice.head_now": row("b,e", "yes", "required", "the drawn fire; placed on the blank freeze basemap by the terrain around it (R1, the clear-cut)"),
  // Added after the audit (23 Oct 2026, proposal (b.2) option A): the practice search lesson, by design answerable only with Haku.
  "freeze.practice.forecast": row("c", "no", "none", "the 12.00 forecast is recorded only (T2, 12.07); every option agrees with the map's wind arrow", { seek: "Haku: \"Mikä on sääennuste?\" (1st, lexical)" }),

  // V2 (merged, steps 2–3; freeze at 105 s; step-3 records arrive at 65 s)
  "freeze.2.infra": row("c,d", "partly", "none", "DR1's road reports are recorded only (sensor log); pushed are only V1's 'the edge crossed road R1 at the head' and 3–4 m flames, which suggest but do not state the road's state", { seek: "Haku: DR1 road report (R1 south of Dry Heath)", anyOf: true, extra: ["atom.demo.1.1"] }),
  "freeze.2.ek11_between": row("a,d", "yes", "helps", "integrates three step-3 pushed records that arrive at the step boundary (65 s), 40 s before the freeze; since play-test D3 the stem states neither the new fire nor EK11's place (it asks what the esker's situation means for the crews nearest the head)"),
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
  "freeze.4.head_unattended": row("a,d", "yes", "none", "two withdrawal radios and EK11's 'waiting on the road', all at 65 s; since play-test D3 the stem no longer states the withdrawal, and the stale pre-15.00 state (EK11 and EK12 on the head's flanks) is a distractor"),
  "freeze.4.return_danger": row("a,d", "yes", "none", "the pushed 'embers 200–400 m ahead' (story 6.0, 65 s) plus knowledge that spot fires start behind crews returning to the flank"),
  "freeze.4.crown_drops": row("a,d", "yes", "helps", "play-test D3: DR1's pushed 14.27 terrain line (V3) states the narrow birch–aspen strip along Koivuoja beyond Kuusimäki's spruce (was: on no surface, only cued by the name); the key is knowledge that a crown fire drops back to the surface in broadleaf; the map shows where the brook lies ahead of the head"),
  "freeze.4.korpioja_spot": row("a,d,e", "yes", "helps", "pushed spotting 200–400 m ahead (65 s) and knowledge; where Mill Brook lies across the head's path is only on the map, though the stem implies it"),
  "freeze.4.head_later": row("b,d,e", "partly", "required", "at 15.20, the end of the header's span (0 minutes from its 'now'), inside V4's 40-minute projection (a breach view: the key lies beyond the isochrone); placed on the blank basemap; the key implies ~38 m/min, the pushed DR3 15.05 says 14.1; exploratory, outside H2 and the composites (play-test R2)", { mapUnstated: true }),

  // V5 (single step 7; freeze at 61 s)
  // Play-test audit fix (24 Oct 2026): "partly", was "no" — the pushed EK11 15.03 and EK12 15.07 R1 reports support "passable with care".
  "freeze.5.infra": row("a,c,d", "partly", "none", "DR2's 15.27 road report (the key) is recorded only, but EK11's pushed 15.03 (glowing litter and small flames on R1 in the burned area) and EK12's pushed 15.07 (a small flame in the moss on R1) support 'passable with care'; both play-test players answered it without the key record", { seek: "Haku: DR2 road report (R1 south of Dry Heath)", extra: ["evt.c06.008", "evt.c06.020"] }),
  "freeze.5.lines_breached": row("a,d", "yes", "helps", "the pushed Mill Brook crossing (radio 7.2) and EK11's place"),
  "freeze.5.hose_short": row("a,d", "yes", "none", "EK11's two pushed step-7 reports"),
  "freeze.5.ek14_shelter": row("a,d", "yes", "helps", "play-test D7: the turn of the wind that leaves the north edge downwind is in P2's pushed 15.05 headline of the 15.00 forecast (V4's second step; was recorded only); the full forecast stays recorded; the map's wind arrow still shows south-west", { seek: "Haku: weather forecast update 15.00 (the full text)" }),
  "freeze.5.wind_shift": row("d,e", "yes", "helps", "the stem states the premise ('if the wind starts blowing from the south'); the key is which edge then runs: knowledge and the map's orientation", { stemSuffices: true }),
  "freeze.5.area_hour": row("a,d", "yes", "none", "DR3's pushed 15.35 survey: 76.4 ha with 35.8 ha new in 20 minutes; arithmetic over three steps (~184 ha; the fire model slows to ~148 ha); play-test R8: bands 90/130/190, the truth 18 ha from an edge (was 8)"),
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
  "freeze.10.infra": row("a", "yes", "helps", "the pushed story beat 13.0: R2 passable, the new fire a good kilometre away (play-test R3: 'vielä' dropped, so it no longer reads 'for now'; option c is a false 'with care, low fire at the roadside')"),
  "freeze.10.ek12_water": row("a,c,d", "yes", "none", "EK12's pushed request with EK13's estimate implies the delivery; EK13's confirmation is lateral (recorded)", { seek: "Haku: EK13's reply (unit-to-unit)" }),
  "freeze.10.cabins_distance": row("a", "yes", "helps", "DR1's pushed 17.05 thermal image (V9): ~1700 m", { anyOf: true }),
  // Play-test D5 (24 Oct 2026): replaces area_total_hour (the total, whose bands revealed the magnitude).
  "freeze.10.area_growth_hour": row("a,b,d,e", "partly", "helps", "V9's pushed situation picture (152.6 ha at 17.05) gives the base and V10's map draws the new fire with its rate mark (DR2's pushed 'spreading east'); the hour's growth is an estimate of the small new fire's spread (the CA's 9 ha, 2–15 ha); DR3's recorded 17.35 'no edge moved' is the lure (under 2 ha)", { seek: "Haku: SPOT's 17.10 pass (0.5–1 ha, 3 m/min), DR2's 17.25 thermal (1.0 ha)" }),
  "freeze.10.front_r2_80": row("a,b,d,e", "partly", "required", "the pushed 'a good kilometre from R2' (the lure) less the drawn rate mark (4 m/min) x 100 min", { extra: ["atom.demo.13.0"] }),
  "freeze.10.south_front_point": row("a,b,e", "yes", "required", "the pushed story beats (120 m SE of the origin, spreading east) and the drawn front; placed on the blank basemap; the key is the CA front at the view's end, 17.40 (play-test D1), 84 m east of the drawn one, tolerance 200 m (D8; was 100 m)", { anyOf: true }),

  // V12 (merged, steps 16–17; freeze at the view's end, >= 130 s; step-17 records arrive at 65 s)
  "freeze.12.longest_shift": row("c,d", "partly", "none", "the hours are in the units' status answers (asked-only, recorded); a non-searcher can infer EK11 (on scene since 11.50, VP; relief asked at 4.5 h, V7)", { seek: "Haku: units' status answers ('when asked')", extra: ["evt.vp.002", "evt.c10.011"] }),
  "freeze.12.f7": row("c", "no", "none", "verification item by design: the line's true state is only in the recorded grid-operator log (V4) and HELI1's report (V6); scored for H9 only, outside the SA composites (play-test D6)", { seek: "Haku: the distribution company's log, HELI1" }),
  "freeze.12.front_toward": row("b,c,d", "partly", "required", "the story beat naming Bay Village is recorded only; the drawn rate mark points south-east and Bay Village lies south-east on the map; DR1's pushed Bay Village survey implies the threat", { seek: "Haku: SPOT's step-17 report", extra: ["evt.c17.009"] }),
  "freeze.12.village_distance": row("a,d", "yes", "helps", "DR1's pushed 18.45 survey (2350 m, the lure) less the rate (map or pushed DR2) x 40 min"),
  "freeze.12.head_now": row("a,b,d,e", "yes", "required", "play-test D1: the key is the head at 19.00, the header's now, at the Honkaharju forest road: EK16's pushed 18.41 radio (65 s) puts it closing on the road from the north-west at ~10 m/min, while the map draws the 18.20 head ~370 m behind; placed on the blank basemap"),
  "freeze.12.head_later": row("b,d,e", "partly", "required", "an hour on; V12's projection ends at 19.20: extrapolate on the blank basemap", { mapUnstated: true }),

  // V14 (merged, steps 19–20; freeze at the view's end, >= 130 s)
  "freeze.14.infra": row("a", "yes", "none", "OUT1's and OUT2's pushed arrival radios (V12)", { anyOf: true }),
  "freeze.14.shift_change": row("a", "yes", "none", "two pushed step-19 radios"),
  "freeze.14.road_crossed": row("a,d", "yes", "helps", "three pushed radios"),
  "freeze.14.residents": row("a,d", "yes", "none", "the police's and VOL1's pushed radios"),
  "freeze.14.se_front_r2": row("a,d", "yes", "none", "arithmetic over three pushed figures (500 m KY21 19.52, the nearer of it and OUT1's 900 m; 11.5 m/min; the 100 m trigger)"),
  "freeze.14.flare_next": row("a,b,d", "yes", "helps", "two pushed story beats and the map's wind arrow"),

  // SPAM (ready at 25 s; tools usable while answering)
  "probe.s.cycle_3": row("a", "yes", "none", "DR3's pushed 14.35 survey"),
  "probe.s.cycle_3.b": row("a,c,d", "partly", "none", "needs the recorded 14.15 survey (4.4 ha new) beside the pushed 14.35 one (6.0 ha); play-test R9: the options differ in magnitude (less, about the same, a third more, twice), so the pushed rate's rise alone does not decide it; a hard estimate from pushed areas (10.1 ha at 13.20, 24.3 − 6.0 ha at 14.15) is possible", { seek: "Haku: DR3 perimeter survey 14.15" }),
  "probe.s.cycle_6": row("a", "yes", "none", "the pushed Birch Creek crossing (radio 8.3)"),
  "probe.s.cycle_6.b": row("c,d", "no", "none", "both DR2 road reports are recorded only (retrieval-dependent by design)", { seek: "Haku: DR2 road reports 15.27 and 15.47" }),
  "probe.s.cycle_8": row("a", "yes", "none", "the pushed story beat (V6) and EK14's pushed repeat (V8)", { anyOf: true }),
  "probe.s.cycle_11": row("a", "yes", "none", "the pushed story beat 14.0"),
};
