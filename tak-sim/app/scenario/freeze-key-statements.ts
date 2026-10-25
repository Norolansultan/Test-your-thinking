/**
 * SPEC/30 §5.3 (19 Oct 2026): how an AI answer would state each L2/L3 freeze item's key — the authored
 * `keyStatements` that `aiStatedKey` (`app/telemetry/freeze-measures.ts`, analysis only) matches,
 * case-insensitively, against the Haku and Thinker answers shown to a participant before the freeze. TRUTH:
 * never sent to the screen.
 *
 * Each entry is a list of regular-expression SOURCES per session language. Three kinds of pattern:
 * - the key's distinctive phrase in context (a unit with what it does, a place with what happens there);
 * - for a numeric band key (`band`), every number strictly inside the key's band with its unit (integers,
 *   decimals, and for metres kilometres), and the band written as a range ("400–700 m"), generated from the
 *   key option's id (`m<lo>_<hi>`); for distances a context word must stand in the same sentence;
 * - for a key that is a bare name ("Yksikkö EK11", "Lahdenkylän"), the label itself, anchored, so it
 *   recognises the key's own text but no answer that merely mentions the name.
 * `test/scenario/freeze-key-statements.spec.ts`: every L2/L3 item of the seven main freezes has statements in
 * both languages; each choice item's statements match its key option's own text (fi and en) and no
 * distractor's. Map items' statements (`head_later`) are coarse (the head at a named place at the clock).
 *
 * `31` F16 (19 Oct 2026): patterns are tied to the item's element (no bare "not over" or "no gap"), every rewritten L2/L3 item has its
 * own, `elementPatterns` name the element an answer must be about, and a band item's `lureStatements` give its distractors'
 * statements for the analysis's `statedLure` class (all on the item, analysis only, never on screen).
 *
 * DRAFT for the two coders' audit and Pilot 2 (SPEC/30 §5.3); English place names follow `place-names.ts`.
 */

import type { FreezeItem } from "./types.js";
import { sortedKeys } from "../engine/deterministic-object.js";

export interface KeyStatements { readonly fi: readonly string[]; readonly en: readonly string[] }

type Unit = "ha" | "m";
interface BandSpec {
  readonly band: Unit;
  /** Words one of which must stand in the sentence with a number (distances); none for areas. */
  readonly context?: KeyStatements;
  /** Extra phrase patterns. */
  readonly also?: KeyStatements;
}
type Spec = KeyStatements | BandSpec;

const SEP = "[ ,\\u00a0]?"; // a thousands separator, Finnish (space) or English (comma)
const NOT_NUMBER_BEFORE = "(?<![\\d.,])(?<!(?:alle|yli|under|over|than) )";
const UNIT: Readonly<Record<Unit, KeyStatements>> = {
  ha: { fi: ["(?:ha\\b|hehtaari)"], en: ["(?:ha\\b|hectare)"] },
  m: { fi: ["(?:m\\b(?!\\/)|metri)"], en: ["(?:m\\b(?!\\/)|met(?:re|er))"] },
};
const KM: KeyStatements = { fi: ["(?:km\\b|kilometri)"], en: ["(?:km\\b|kilomet(?:re|er))"] };

/** An integer as written: 1600 as "1600", "1 600" or "1,600". */
function int(n: number): string {
  return n >= 1000 ? `${Math.floor(n / 1000)}${SEP}${String(n % 1000).padStart(3, "0")}` : String(n);
}

/** Every integer from `from` to `to` (inclusive), grouped by tens: "1[ ,]?50[1-9]|1[ ,]?51\d|…". */
function intAlternatives(from: number, to: number): string {
  const out: string[] = [];
  for (let tens = Math.floor(from / 10); tens <= Math.floor(to / 10); tens++) {
    const lo = Math.max(from, tens * 10) % 10, hi = Math.min(to, tens * 10 + 9) % 10;
    const prefix = tens === 0 ? "" : tens >= 100 ? `${Math.floor(tens / 100)}${SEP}${String(tens % 100).padStart(2, "0")}` : String(tens);
    out.push(`${prefix}${lo === hi ? lo : lo === 0 && hi === 9 ? "\\d" : `[${lo}-${hi}]`}`);
  }
  return out.join("|");
}

/** Kilometre forms strictly inside (lo, hi) metres, to the nearest 10 m: "0[,.]8\d?", "1[,.]6[1-9]". */
function kmAlternatives(lo: number, hi: number): string {
  const out: string[] = [];
  const first = Math.floor(lo / 10) + 1, last = Math.ceil(hi / 10) - 1; // hundredths of a kilometre
  for (let tenth = Math.floor(first / 10); tenth <= Math.floor(last / 10); tenth++) {
    const a = Math.max(first, tenth * 10) % 10, b = Math.min(last, tenth * 10 + 9) % 10;
    const head = `${Math.floor(tenth / 10)}[,.]${tenth % 10}`;
    out.push(a === 0 ? `${head}${b === 9 ? "\\d?" : `[0-${b}]?`}` : `${head}${a === b ? a : `[${a}-${b}]`}`);
  }
  return out.join("|");
}

/** The statements of a band key [lo, hi): numbers strictly inside it with the unit, and the band as a range. */
export function bandStatements(lo: number, hi: number, spec: BandSpec): KeyStatements {
  const lang = (l: "fi" | "en"): string[] => {
    const unit = UNIT[spec.band][l][0]!;
    const inside = `${NOT_NUMBER_BEFORE}(?:(?:${intAlternatives(lo + 1, hi - 1)})(?:[,.]\\d+)?|${int(lo)}[,.]\\d*[1-9])(?![\\d])\\s*${unit}`;
    const km = spec.band === "m" ? `${NOT_NUMBER_BEFORE}(?:${kmAlternatives(lo, hi)})(?![\\d])\\s*${KM[l][0]!}` : null;
    const numbers = [inside, ...(km ? [km] : [])];
    const ctx = spec.context?.[l] ?? [];
    // One sentence: anything but a full stop, which may still stand inside a clock or a number ("klo 15.00", "2.1 km"; play-test D1, 24 Oct
    // 2026: the L3 stems name their clock, as AI answers do), as the source-memory facts' windows read it.
    const win = "(?:[^.]|\\.(?=\\d)){0,80}";
    const stated = ctx.length === 0 ? numbers : numbers.flatMap((n) => ctx.flatMap((c) => [`${c}${win}${n}`, `${n}${win}${c}`]));
    return [`${NOT_NUMBER_BEFORE}${int(lo)}\\s*[–—-]\\s*${int(hi)}\\s*${unit}`, ...stated, ...(spec.also?.[l] ?? [])];
  };
  return { fi: lang("fi"), en: lang("en") };
}

const isBand = (s: Spec): s is BandSpec => "band" in s;
const anchored = (label: string) => `^\\s*${label}\\s*$`;

/** Context words for the distance items. */
const R2_CTX: KeyStatements = { fi: ["R2", "huoltotie"], en: ["R2", "service road"] };

const SPECS: Readonly<Record<string, Spec>> = {
  // ---- V2 ----
  // `31` F10: ek11_between and south_flank replace nearest_head and fuel_ahead (F16: fuel_ahead's "kuusik\w*" matched the place name).
  // Play-test D3 (24 Oct 2026): the item no longer names EK11 (the crew nearest the head, on the esker), so the statements accept the crew
  // by its call sign or as the crew nearest the head.
  "freeze.2.ek11_between": {
    fi: [
      "(?:EK11|miehistö)[^.]{0,80}(?:kärjen ja (?:harjun )?(?:uuden |toisen )?palon väli|kahden palon väli|väliin)", "(?:kärjen ja (?:harjun )?(?:uuden |toisen )?palon|kahden palon) väli\\w*[^.]{0,60}(?:EK11|miehistö)",
      "(?:saarr|eristy)[^.]{0,60}(?:EK11|miehistö)", "(?:EK11|miehistö)[^.]{0,60}(?:saarr|eristy)",
    ],
    en: ["(?:EK11|crew)[^.]{0,80}(?:between the head and the (?:new|second) fire|caught between|cut off|trapped)", "between the head and the (?:new|second) fire[^.]{0,60}(?:EK11|crew)"],
  },
  "freeze.2.south_flank": {
    fi: ["(?:eteläsivust\\w*|EK12)[^.]{0,80}(?:matala\\w*|pidetään|pitää|kiinni)[^.]{0,80}kär(?:ki|jen)[^.]{0,40}ohi", "kärki\\w*[^.]{0,40}(?:pääsee|menee|etenee)[^.]{0,30}ohi[^.]{0,80}(?:eteläsivust|EK12)", "reuna pysyy matalana"],
    en: ["(?:south flank|EK12)[^.]{0,80}(?:kept low|held low|holding)[^.]{0,80}head[^.]{0,40}(?:past|by)", "head[^.]{0,40}(?:gets|got|runs|ran|goes|went|passing|passes) (?:past|by)[^.]{0,80}(?:south flank|EK12)", "edge is kept low"],
  },
  "freeze.2.area_40": { band: "ha" },
  // A map item's statements are coarse: the head at a named place at the item's clock (15.00: in the Spruce Hill spruce, crowning).
  "freeze.2.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}(?:kuusiko|kuusikossa|kuusikon|Kuusimäe)", "(?:kuusiko|kuusikossa|kuusikon|Kuusimäe)\\w*[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}(?:spruce|Spruce Hill)", "(?:spruce|Spruce Hill)[^.]{0,80}head"] },
  "freeze.2.spruce_behaviour": { fi: ["latvapalo", "latvoihin", "latvoissa", "latvojen (?:yli|kautta)"], en: ["crown(?:ing| fire| run|s)", "into the (?:tree ?)?crowns", "torch(?:ing|es)"] },
  "freeze.2.junction_hour": { band: "m", context: { fi: ["risteyk", "risteys", "R2"], en: ["junction", "R2"] } },
  // ---- V4 ----
  "freeze.4.fastest_spread": {
    fi: ["\\bL2\\b[^.]{0,60}(?:nopeim|nopeasti|leviää|etenee)", "(?:nopeim\\w*|nopeasti)[^.]{0,60}(?:\\bL2\\b|koillise)", "koillisessa \\(lohko L2\\)"],
    en: ["\\bL2\\b[^.]{0,60}(?:fastest|spreading|advancing)", "fastest[^.]{0,60}(?:\\bL2\\b|north-?east)", "north-?east \\(sector L2\\)"],
  },
  "freeze.4.head_unattended": {
    fi: ["kär(?:keä|ki)[^.]{0,40}ei (?:nyt )?(?:sammuteta|hyökätä|ole ketään)", "(?:kukaan|ketään|yksikään)[^.]{0,40}(?:ei )?(?:sammuta|ole)[^.]{0,30}kärje", "kärki\\w*[^.]{0,40}etenee vapaasti"],
    en: ["(?:no one|nobody|no crew)[^.]{0,40}(?:attack|work|fight)\\w*[^.]{0,20}(?:the )?head", "head[^.]{0,60}(?:spreads?|runs?|advances?) (?:freely|unchecked|unopposed)", "head is (?:now )?unattended"],
  },
  "freeze.4.return_danger": {
    fi: ["pistepalo\\w*[^.]{0,60}(?:taakse|takana|perääntymis)", "(?:taakse|takana|perääntymis\\w*)[^.]{0,60}pistepalo", "\\bPP1\\b"],
    en: ["spot ?fires?[^.]{0,60}(?:behind|escape route|retreat)", "(?:behind|escape route)[^.]{0,60}spot ?fires?", "\\b(?:SF1|PP1)\\b"],
  },
  "freeze.4.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}Koivuoj", "Koivuoj\\w*[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}Birch Creek", "Birch Creek[^.]{0,80}head"] },
  "freeze.4.crown_drops": {
    fi: ["Koivuoj\\w*[^.]{0,80}(?:laskeutu|pintapalo|koivik|lehti)", "(?:laskeutu\\w*|pintapalo\\w*)[^.]{0,80}Koivuoj", "Koivuojan varren lehtimetsä"],
    en: ["Birch Creek[^.]{0,80}(?:drop|surface fire|broadleaf|birch)", "(?:drop\\w*|surface fire)[^.]{0,80}Birch Creek", "broadleaf\\w*[^.]{0,40}Birch Creek"],
  },
  "freeze.4.korpioja_spot": {
    fi: ["Myllyoj\\w*[^.]{0,80}(?:yli|toisel\\w* puolel)", "(?:kipinä\\w*|pistepalo\\w*)[^.]{0,60}(?:ojan|Myllyojan) (?:yli|toisel)", "kipinät sytyttävät paloja ojan yli"],
    en: ["Mill Brook[^.]{0,80}(?:across it|far side|other side|jump)", "(?:sparks?|spot fires?|embers?)[^.]{0,60}(?:across|over)[^.]{0,20}(?:the )?(?:brook|creek|Mill Brook)"],
  },
  // ---- V5 ----
  // SPEC/33 stage 9 (20 Oct 2026): re-authored with the item (the one crossing, Myllyoja, unattended; the Kuusimäki road crossing is gone).
  "freeze.5.lines_breached": {
    fi: ["Myllyoja\\w*[^.]{0,40}(?:takana|yli|toisella puolella)[^.]{0,60}(?:kukaan ei|ei kukaan|ilman sammuttaj|ei ole ketään)", "(?:kukaan ei|ei kukaan|ilman sammuttaj)[^.]{0,60}Myllyoja", "Myllyoja\\w*[^.]{0,40}ei (?:enää )?(?:rajaa|pidä|pysäytä)"],
    en: ["(?:beyond|across|over|other side of) Mill Brook[^.]{0,80}(?:no one|nobody|unattended|no crew)", "(?:no one|nobody|no crew)[^.]{0,60}Mill Brook", "Mill Brook[^.]{0,40}(?:no longer|does not|doesn't) (?:contain|hold|stop)"],
  },
  "freeze.5.hose_short": {
    fi: ["letku\\w*[^.]{0,40}(?:liian vähän|loppu\\w*|ei riitä|vähissä)", "(?:liian vähän|ei riitä)[^.]{0,30}letku", "lisää letkua", "letkua varalla alle"],
    en: ["(?:too little|not enough|short of|running out of) hose", "hose[^.]{0,40}(?:runs? out|running out|in reserve|is short)", "more hose"],
  },
  "freeze.5.ek14_shelter": {
    fi: ["EK14[^.]{0,100}(?:vetäyty|turva-alue|turvaan|palaneelle alueelle|palaneen alueen)", "(?:vetäyty\\w*|turva-alue\\w*|turvaan)[^.]{0,60}EK14", "turvaan palaneelle alueelle"],
    en: ["EK14[^.]{0,100}(?:withdraw|pull(?:s|ed)? back|safety zone|to safety|burn(?:ed|t) area)", "(?:withdraw\\w*|safety zone)[^.]{0,60}EK14", "safety in the burn(?:ed|t) area"],
  },
  // Revision (bk), 25 Oct 2026: replaces `wind_shift`. The key is the three alerted units; an answer naming them on their way states it.
  "freeze.5.reinforcements": {
    fi: ["(?:kolme|3)[^.]{0,40}(?:lisäyksik|yksikkö|pelastusyksik)", "(?:EK15|EK16|KY23)[^.]{0,80}(?:saapuu|saapumassa|johtopaik|tulossa|hälytet)", "lisäyksik\\w*[^.]{0,60}(?:hälytet|saapuu|tulossa)"],
    en: ["three[^.]{0,40}(?:units?|reinforcements?)", "(?:EK15|EK16|KY23)[^.]{0,80}(?:arriv|due|command post|alerted|on (?:its|their) way)", "reinforcements?[^.]{0,60}(?:alerted|arriv|due|on (?:its|their) way)"],
  },
  "freeze.5.area_hour": { band: "ha" },
  // `31` F16: the English "cross … again" was tied to the road. SPEC/33 stage 9 (20 Oct 2026): re-authored with the item (embers across
  // Koivuoja, the brook that stopped the surface fire).
  "freeze.5.road_jump": {
    fi: ["Koivuoja\\w*[^.]{0,80}(?:kipin|heit)\\w*[^.]{0,40}(?:\\byli|ylit)", "(?:kipin|heit)\\w*[^.]{0,40}(?:\\byli|ylit)\\w*[^.]{0,40}Koivuoja", "kipinät lentävät ojan yli"],
    en: ["embers?[^.]{0,40}(?:across|over|cross)\\w*[^.]{0,40}(?:Birch Creek|brook)", "Birch Creek[^.]{0,80}embers?[^.]{0,40}(?:across|over|cross)", "(?:spot fires?|new fire)[^.]{0,40}(?:beyond|across|other side of) Birch Creek"],
  },
  // ---- V7 ----
  // `31` F16: tied to the element (the edges calming, the fire not over), not a bare "not under control".
  "freeze.7.lull_meaning": {
    fi: ["reun\\w*[^.]{0,40}rauhoittu\\w*[^.]{0,60}(?:ei ole (?:vielä )?(?:ohi|sammunut)|palaa (?:yhä|edelleen))", "(?:tuul\\w*|reun\\w*)[^.]{0,60}(?:heikkene|rauhoittu)\\w*[^.]{0,60}palo ei ole (?:vielä )?(?:ohi|sammunut)", "reunat rauhoittuvat hetkeksi"],
    en: ["edges?[^.]{0,40}calm\\w*[^.]{0,60}(?:not (?:yet )?(?:over|out)|still burn)", "(?:wind|edges?)[^.]{0,60}(?:eas|calm|weaken)\\w*[^.]{0,60}(?:fire|it) is not (?:yet )?(?:over|out)"],
  },
  // Revision (bk), 25 Oct 2026: re-keyed — what reaching EK14's line takes (a vehicle stops short of it, the kit is carried).
  "freeze.7.north_help": {
    fi: ["(?:autolla|autoilla|paloautolla) ei pääse", "ei pääse (?:autolla|autoilla)", "(?:letku\\w*|kalusto\\w*)[^.]{0,40}(?:kannetaan|kannettava|kantakaa)", "(?:kannetaan|kannettava|kantakaa)[^.]{0,40}(?:letku|kalusto)"],
    en: ["(?:cannot|can't|can not) (?:get|drive|reach)[^.]{0,60}(?:closer|the line|EK14)", "(?:no|a) vehicle (?:cannot|can't|can not|gets no) (?:get|reach|closer)", "(?:hose|equipment|kit)[^.]{0,40}(?:carried|carry)", "carr(?:y|ied)[^.]{0,40}(?:hose|equipment|kit)"],
  },
  "freeze.7.rekindle_sector": {
    fi: ["\\bL3\\b[^.]{0,80}(?:uudelleen|syty|kyt|riski)", "(?:uudelleen\\w*|syttyä|kyteä|kytee)[^.]{0,80}(?:\\bL3\\b|syttymäkohdan eteläreun)", "\\bL3\\W{1,3}etelä"],
    en: ["\\bL3\\b[^.]{0,80}(?:flare|rekindl|reignit|smoulder)", "(?:flare\\w*|rekindl\\w*|reignit\\w*|smoulder\\w*)[^.]{0,80}(?:\\bL3\\b|south edge)", "\\bL3\\W{1,3}south"],
  },
  // `31` F16: the bare "ei tunnin aikana" / "not within the hour" is gone (any answer about any hour matched it).
  "freeze.7.cabins_reach": {
    fi: ["(?:palo|reuna)[^.]{0,60}ei (?:ehdi|ulotu|saavuta)[^.]{0,40}mök", "mök\\w*[^.]{0,60}ei (?:ole )?(?:välitöntä )?(?:uhkaa|vaaraa)", "matkaa (?:on )?(?:liikaa|liian pitkä)[^.]{0,60}(?:nopeu|vauhdi)"],
    en: ["(?:fire|edge)[^.]{0,60}(?:will not|won't|does not|cannot) reach[^.]{0,40}(?:cottages|cabins)", "(?:cottages|cabins)[^.]{0,60}(?:not|no) (?:immediate )?(?:threat|danger|risk)", "too far at the (?:present|current) rate"],
  },
  "freeze.7.cp_safe": {
    fi: ["johtopai\\w*[^.]{0,80}(?:turvassa|ei (?:ole )?(?:uhattu|vaarassa)|ei tarvitse siirt|voi jäädä|pysyy paikallaan)", "(?:palo|savu)[^.]{0,30}(?:ei|eivät) (?:ulotu|yllä)[^.]{0,30}johtopai", "palo ja savu pysyvät siitä kaukana"],
    en: ["command post[^.]{0,80}(?:is safe|stays safe|not (?:at risk|threatened)|need not|does not need to (?:move|relocate)|can stay)", "(?:fire|smoke)[^.]{0,40}(?:not|n't) reach[^.]{0,30}command post", "fire and smoke stay far from it"],
  },
  "freeze.7.relief_next": {
    fi: ["VPK[^.]{0,100}(?:lepo|korvaav|vuoronvaih|tauko|huoltoon)", "(?:lepo\\w*|korvaav\\w*|vuoronvaih\\w*)[^.]{0,60}VPK", anchored("VPK:n miehistö")],
    en: ["VOL1[^.]{0,100}(?:rest|reliev|replacement|shift change|break)", "(?:rest|relief|reliev\\w*|replacement)[^.]{0,60}VOL1", anchored("VOL1's crew")],
  },
  // ---- V10 ----
  "freeze.10.ek12_water": {
    fi: ["EK12[^.]{0,80}(?:jää linjalle|pysyy linjalla)", "(?:vesi|vettä|allas|altaan)[^.]{0,60}(?:tuodaan|tuo)[^.]{0,40}EK12", "EK13[^.]{0,80}tuo\\w*[^.]{0,40}(?:altaan|vettä)[^.]{0,40}EK12", "lisävesi tuodaan"],
    en: ["EK12[^.]{0,80}(?:stays|remains) on (?:the|its) line", "water[^.]{0,60}(?:brought|delivered)[^.]{0,40}(?:to )?EK12", "more water is brought"],
  },
  "freeze.10.cabins_distance": { band: "m", context: { fi: ["Mökkiran"], en: ["Lakeside Cottages", "cottages", "cabins"] } },
  // Play-test D5 (24 Oct 2026): the growth, not the total (was `area_total_hour`); its band statements are the key band's numbers in hectares.
  "freeze.10.area_growth_hour": { band: "ha" },
  "freeze.10.front_r2_80": { band: "m", context: R2_CTX },
  // ---- V12 ----
  "freeze.12.f7": {
    fi: ["(?:johto|linja|sähkölinja|voimajohto|20 kV)[^.]{0,60}(?:on jännitteinen|on jännitteellä|ei ole (?:kytketty pois|jännitteetön))", "\\bjännitteinen"],
    en: ["\\bline is (?:still )?live", "(?:line|power line)[^.]{0,40}(?:still )?(?<!de-)energi[sz]ed", "(?:line|power line)[^.]{0,40}not (?:been )?(?:switched off|de-energi[sz]ed)"],
  },
  "freeze.12.front_toward": {
    fi: ["Lahdenkyl\\w*[^.]{0,30}(?:suuntaan|kohti|päin)", "(?:kohti|suuntaan)[^.]{0,20}Lahdenkyl", "kaakko\\w*[^.]{0,60}Lahdenkyl", anchored("lahdenkylän")],
    en: ["(?:towards?|heading for|in the direction of)[^.]{0,20}Bay Village", "south-?east\\w*[^.]{0,60}Bay Village", anchored("bay village")],
  },
  "freeze.12.village_distance": { band: "m", context: { fi: ["Lahdenkyl"], en: ["Bay Village", "village"] } },
  // 20.00: the head near service road R2 (coarse, as every map item's).
  "freeze.12.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}(?:\\bR2\\b|huoltotie)", "(?:\\bR2\\b|huoltotie\\w*)[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}(?:\\bR2\\b|service road)", "(?:\\bR2\\b|service road)[^.]{0,80}head"] },
  // ---- V14 ----
  "freeze.14.road_crossed": {
    fi: ["seuraava\\w* este[^.]{0,60}(?:\\bR2\\b|huoltotie)", "(?:\\bR2\\b|huoltotie\\w*)[^.]{0,60}seuraava\\w* este", "kärj\\w*[^.]{0,40}(?:edessä|tiellä)[^.]{0,30}(?:tie R2|R2:n linj|huoltotie)"],
    en: ["next barrier[^.]{0,60}(?:\\bR2\\b|service road)", "(?:\\bR2\\b|service road)[^.]{0,60}next barrier", "head[^.]{0,40}(?:faces|meets|now reaches)[^.]{0,30}(?:road R2|R2's lines)"],
  },
  "freeze.14.residents": {
    fi: ["(?:Lahdenkyl\\w*|kylä\\w*)[^.]{0,60}(?:yhä|edelleen|vielä) (?:asukkaita|ihmisiä)", "(?:asukkaita|ihmisiä|talo\\w*)[^.]{0,60}(?:kieltäyty|ei lähde)[^.]{0,80}(?:linj\\w*|R2)"],
    en: ["(?:people|residents)[^.]{0,30}(?:are )?still in (?:the village|Bay Village)", "(?:Bay Village|the village)[^.]{0,60}still (?:has )?(?:people|residents)", "(?:households?|houses?)[^.]{0,40}(?:refus\\w*|will not leave)[^.]{0,80}(?:lines?|R2)"],
  },
  "freeze.14.se_front_r2": {
    fi: ["satojen metrien päässä", "(?:sadetin\\w*|sadettim\\w*|vettä|vesi)[^.]{0,60}(?:ei (?:vielä|tarvitse)|ei kytketä)", "(?:ei (?:vielä|tarvitse)|ei kytketä)[^.]{0,40}(?:kytke|päälle)"],
    en: ["hundreds of metres (?:away|from)", "(?:sprinkler|water)[^.]{0,60}(?:not yet|no need|need not|not be needed)", "not yet[^.]{0,40}(?:switched|turned) on"],
  },
  "freeze.14.flare_next": {
    fi: ["(?:uudelleensyttym\\w*|länsipuolen palo|leimahd\\w*)[^.]{0,80}(?:laajenee|leviää|etenee)[^.]{0,30}kaakko", "(?:laajenee|leviää|etenee)[^.]{0,30}kaakko\\w*[^.]{0,40}tuul"],
    en: ["(?:flare-up|rekindl\\w*|new fire)[^.]{0,80}(?:spread|grow|run)\\w*[^.]{0,30}south-?east", "(?:spreads?|grows?|runs?)[^.]{0,30}south-?east\\w*[^.]{0,40}wind"],
  },
};

/** The ids of the items that carry authored statements, sorted. */
export const KEY_STATEMENT_ITEM_IDS: readonly string[] = sortedKeys(SPECS);

/** An item's statements: the authored ones, a band key's computed from its key option's id (`m<lo>_<hi>`); undefined when none are authored. */
export function keyStatementsFor(item: FreezeItem): KeyStatements | undefined {
  const spec = SPECS[item.id];
  if (!spec) return undefined;
  if (!isBand(spec)) return spec;
  const key = item.options.find((o) => o.correct)?.id ?? "";
  const m = /^m(\d+)_(\d+)$/.exec(key);
  if (!m) throw new Error(`${item.id}: a band item's key must be a closed band m<lo>_<hi>, got "${key}"`);
  return bandStatements(Number(m[1]), Number(m[2]), spec);
}

/** An option's lure statements (`FreezeItem.lureStatements`). */
export interface LureStatements { readonly optionId: string; readonly fi: readonly string[]; readonly en: readonly string[] }

/**
 * `31` F16 (19 Oct 2026; analysis only, for `statedLure`): statements of an ordinal band item's wrong bands, per option — an AI answer that
 * states a number inside a distractor band (the map-now figure, a stale survey) states a lure. Closed bands are read as `bandStatements`
 * reads the key's; an open lower band (`lt<n>`) as 0 … n, an open upper band (`gt<n>`) as n … 2n; with the key's context words.
 * Undefined for an item without band statements.
 */
export function lureStatementsFor(item: FreezeItem): readonly LureStatements[] | undefined {
  const spec = SPECS[item.id];
  if (!spec || !isBand(spec)) return undefined;
  return item.options.filter((o) => !o.correct).map((o) => {
    const closed = /^m(\d+)_(\d+)$/.exec(o.id), lt = /^lt(\d+)$/.exec(o.id), gt = /^gt(\d+)$/.exec(o.id);
    const st = closed ? bandStatements(Number(closed[1]), Number(closed[2]), spec)
      : lt ? bandStatements(0, Number(lt[1]), spec)
      : gt ? bandStatements(Number(gt[1]), 2 * Number(gt[1]), spec)
      : null;
    if (!st) throw new Error(`${item.id}: option ${o.id} is not a band`);
    return { optionId: o.id, fi: st.fi, en: st.en };
  });
}

/**
 * `31` F16 (19 Oct 2026; analysis only): the item's ELEMENT — what an AI answer must be about for a statement in it to count for the item
 * (the unit, the place, the quantity the item asks about). `aiStatedKey` ties its statements to it (WP-3); each set matches the item's own
 * prompt (`freeze-key-statements.spec.ts`).
 */
const ELEMENTS: Readonly<Record<string, KeyStatements>> = {
  "freeze.2.ek11_between": { fi: ["EK11", "harju", "miehist"], en: ["EK11", "esker", "crew"] }, // play-test D3: the stem names the esker and the crews
  "freeze.2.south_flank": { fi: ["eteläsivust", "EK12"], en: ["south flank", "EK12"] },
  "freeze.2.area_40": { fi: ["palanut ala", "pinta-ala", "\\bha\\b|hehtaari"], en: ["burn(?:t|ed) area", "\\bha\\b|hectare"] },
  "freeze.2.spruce_behaviour": { fi: ["kuusik", "Kuusimä", "latv"], en: ["spruce", "crown"] },
  "freeze.2.junction_hour": { fi: ["risteyk", "risteys"], en: ["junction"] },
  "freeze.2.head_later": { fi: ["kär[kj]"], en: ["\\bhead\\b"] },
  "freeze.4.fastest_spread": { fi: ["leviä", "nopeim", "\\bL2\\b", "koillis"], en: ["spread", "fastest", "\\bL2\\b", "north-?east"] },
  "freeze.4.head_unattended": { fi: ["kär[kj]"], en: ["\\bhead\\b"] },
  "freeze.4.return_danger": { fi: ["pistepalo", "perääntymis", "miehist"], en: ["spot ?fire", "escape route", "crew"] },
  "freeze.4.crown_drops": { fi: ["latvapalo", "pintapalo", "Koivuoj"], en: ["crown", "surface fire", "Birch Creek"] },
  "freeze.4.korpioja_spot": { fi: ["Myllyoj"], en: ["Mill Brook"] },
  "freeze.4.head_later": { fi: ["kär[kj]"], en: ["\\bhead\\b"] },
  "freeze.5.lines_breached": { fi: ["Myllyoj", "ylity"], en: ["Mill Brook", "cross"] },
  "freeze.5.hose_short": { fi: ["EK11", "letku"], en: ["EK11", "hose"] },
  "freeze.5.ek14_shelter": { fi: ["EK14"], en: ["EK14"] },
  "freeze.5.reinforcements": { fi: ["lisäyksik", "yksikk", "EK15", "EK16", "KY23"], en: ["reinforcement", "units?", "EK15", "EK16", "KY23"] }, // revision (bk)
  "freeze.5.area_hour": { fi: ["palanut ala", "pinta-ala", "\\bha\\b|hehtaari"], en: ["burn(?:t|ed) area", "\\bha\\b|hectare"] },
  "freeze.5.road_jump": { fi: ["Koivuoj"], en: ["Birch Creek"] }, // SPEC/33 stage 9: was the Kuusimäki forest road
  "freeze.7.lull_meaning": { fi: ["tuul", "reun"], en: ["wind", "edge"] },
  "freeze.7.north_help": { fi: ["EK14", "pohjoisreuna", "pääse", "autolla"], en: ["EK14", "north edge", "reach", "vehicle"] }, // revision (bk): re-keyed
  "freeze.7.rekindle_sector": { fi: ["uudelleen", "syty", "kyt", "lohko"], en: ["flar", "rekindl", "smoulder", "sector"] },
  "freeze.7.cabins_reach": { fi: ["Mökkiran", "mök"], en: ["Lakeside Cottages", "cottage", "cabin"] },
  "freeze.7.cp_safe": { fi: ["johtopai"], en: ["command post"] },
  "freeze.7.relief_next": { fi: ["lepo", "vuoronvaih", "korvaav", "huolto"], en: ["\\brest\\b", "relief", "shift change", "replacement"] },
  "freeze.10.ek12_water": { fi: ["EK12"], en: ["EK12"] },
  "freeze.10.cabins_distance": { fi: ["Mökkiran", "mök"], en: ["Lakeside Cottages", "cottage", "cabin"] },
  "freeze.10.area_growth_hour": { fi: ["palanut ala", "pinta-ala", "kasv", "\\bha\\b|hehtaari"], en: ["burn(?:t|ed) area", "grow", "\\bha\\b|hectare"] },
  "freeze.10.front_r2_80": { fi: ["\\bR2\\b", "huoltotie"], en: ["\\bR2\\b", "service road"] },
  "freeze.12.f7": { fi: ["20 kV", "sähkölinj", "voimajoh", "johdo?n?\\b"], en: ["20 kV", "power line"] }, // SPEC/33 (bc): a 20 kV line (was 110 kV)
  "freeze.12.front_toward": { fi: ["kaakkoisrintam", "asutu", "Lahdenkyl"], en: ["south-?east(?:ern)? front", "settlement", "Bay Village"] },
  "freeze.12.village_distance": { fi: ["Lahdenkyl"], en: ["Bay Village", "village"] },
  "freeze.12.head_later": { fi: ["kär[kj]"], en: ["\\bhead\\b"] },
  "freeze.14.road_crossed": { fi: ["metsäautotie", "Honkaharju", "\\bR2\\b"], en: ["forest road", "Pine Ridge", "\\bR2\\b"] },
  "freeze.14.residents": { fi: ["Lahdenkyl", "kylä", "asuk"], en: ["Bay Village", "village", "resident"] },
  "freeze.14.se_front_r2": { fi: ["\\bR2\\b", "sadetin", "sadettim"], en: ["\\bR2\\b", "sprinkler"] },
  "freeze.14.flare_next": { fi: ["uudelleensyttym", "länsipuol", "leimah"], en: ["flare-up", "west of the point of origin", "rekindl"] },
};

/** The item's element patterns (analysis only), undefined when none are authored. */
export function elementPatternsFor(item: Pick<FreezeItem, "id">): KeyStatements | undefined {
  return ELEMENTS[item.id];
}

/** The item with its statements (analysis only); an item that already has them, or has none authored, is returned as it is. */
export function withKeyStatements(item: FreezeItem): FreezeItem {
  if (item.keyStatements) return item;
  const keyStatements = keyStatementsFor(item);
  if (!keyStatements) return item;
  const elementPatterns = elementPatternsFor(item), lureStatements = lureStatementsFor(item);
  return { ...item, keyStatements, ...(elementPatterns ? { elementPatterns } : {}), ...(lureStatements ? { lureStatements } : {}) };
}
