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
    const stated = ctx.length === 0 ? numbers : numbers.flatMap((n) => ctx.flatMap((c) => [`${c}[^.]{0,80}${n}`, `${n}[^.]{0,80}${c}`]));
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
  "freeze.2.nearest_head": {
    fi: ["EK11[^.]{0,80}(?:lähimpänä|lähinnä)[^.]{0,30}kärke", "(?:lähimpänä|lähinnä) (?:palon )?kärke\\w*[^.]{0,40}EK11", "EK11[^.]{0,60}\\d+ m kärjestä", anchored("yksikkö EK11")],
    en: ["EK11[^.]{0,80}(?:nearest|closest)[^.]{0,30}head", "(?:nearest|closest) (?:to )?the head[^.]{0,40}EK11", "EK11[^.]{0,60}\\d+ m from the head", anchored("unit EK11")],
  },
  "freeze.2.fuel_ahead": { fi: ["kuusik\\w*", "kuusivaltai", "kuusimetsä"], en: ["spruce(?! hill)", "conifer"] },
  "freeze.2.area_40": { band: "ha" },
  "freeze.2.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}kuusikon reuna", "kuusikon reuna\\w*[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}edge of the (?:spruce hill )?spruce", "edge of the (?:spruce hill )?spruce[^.]{0,80}head"] },
  "freeze.2.spruce_behaviour": { fi: ["latvapalo", "latvoihin", "latvoissa", "latvojen (?:yli|kautta)"], en: ["crown(?:ing| fire| run|s)", "into the (?:tree ?)?crowns", "torch(?:ing|es)"] },
  "freeze.2.junction_hour": { band: "m", context: { fi: ["risteyk", "risteys", "R2"], en: ["junction", "R2"] } },
  // ---- V4 ----
  "freeze.4.fastest_spread": {
    fi: ["\\bL2\\b[^.]{0,60}(?:nopeim|nopeasti|leviää|etenee)", "(?:nopeim\\w*|nopeasti)[^.]{0,60}(?:\\bL2\\b|koillise)", "koillisessa \\(lohko L2\\)"],
    en: ["\\bL2\\b[^.]{0,60}(?:fastest|spreading|advancing)", "fastest[^.]{0,60}(?:\\bL2\\b|north-?east)", "north-?east \\(sector L2\\)"],
  },
  "freeze.4.work_danger": { fi: ["latvapalo", "latvoissa", "latvojen yli"], en: ["crown(?:ing| fire|s)", "treetops"] },
  "freeze.4.growth_next": {
    band: "ha",
    context: { fi: ["kasva\\w*", "kasvu\\w*", "uutta", "lisää"], en: ["grow\\w*", "new", "more", "add\\w*"] },
  },
  "freeze.4.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}Koivuoj", "Koivuoj\\w*[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}Birch Creek", "Birch Creek[^.]{0,80}head"] },
  "freeze.4.crown_drops": {
    fi: ["Koivuoj\\w*[^.]{0,80}(?:laskeutu|pintapalo|koivik|lehti)", "(?:laskeutu\\w*|pintapalo\\w*)[^.]{0,80}Koivuoj", "Koivuojan varren lehtimetsä"],
    en: ["Birch Creek[^.]{0,80}(?:drop|surface fire|broadleaf|birch)", "(?:drop\\w*|surface fire)[^.]{0,80}Birch Creek", "broadleaf\\w*[^.]{0,40}Birch Creek"],
  },
  "freeze.4.korpioja_spot": {
    fi: ["Korpioj\\w*[^.]{0,80}(?:yli|toisel\\w* puolel)", "(?:kipinä\\w*|pistepalo\\w*)[^.]{0,60}(?:ojan|Korpiojan) (?:yli|toisel)", "kipinät sytyttävät paloja ojan yli"],
    en: ["Alder Creek[^.]{0,80}(?:across|over|far side|other side|jump)", "(?:sparks?|spot fires?|embers?)[^.]{0,60}(?:across|over)[^.]{0,20}(?:the )?(?:brook|creek|Alder Creek)"],
  },
  // ---- V5 ----
  "freeze.5.spot_cause": { fi: ["pistepalo", "kipinät? lensi", "kipinä\\w*[^.]{0,40}\\byli"], en: ["spot ?fires?", "sparks? (?:flew|blew|carried)", "embers?[^.]{0,40}across"] },
  "freeze.5.units_enough": {
    fi: ["(?:yksiköt|yksiköitä|voimat)[^.]{0,40}(?:eivät riitä|ei riitä|riittämättö)", "(?:tarvitaan|pyydetään|pyydämme) lisä(?:yksiköi|voim)", "uusia paloja on jo linjojen takana"],
    en: ["(?:not enough|insufficient)[^.]{0,30}(?:units|crews|resources)", "(?:more|additional) (?:units|crews|resources) (?:are )?(?:needed|requested)", "new fires are already beyond the lines"],
  },
  "freeze.5.wind_shift": {
    fi: ["pohjoisreuna\\w*[^.]{0,60}(?:aktivoi|kiihty|leviä|etene|painu)", "(?:aktivoi\\w*|kiihty\\w*)[^.]{0,60}pohjoisreuna", anchored("pohjoisreuna")],
    en: ["north edge[^.]{0,60}(?:active|pick|spread|advanc|flare)", "(?:activ\\w*|pick\\w* up)[^.]{0,60}north edge", anchored("the north edge")],
  },
  "freeze.5.area_hour": { band: "ha" },
  "freeze.5.ek14_shelter": {
    fi: ["EK14[^.]{0,100}(?:vetäyty|turva-alue|turvaan|palaneelle alueelle|palaneen alueen)", "(?:vetäyty\\w*|turva-alue\\w*|turvaan)[^.]{0,60}EK14", "turvaan palaneelle alueelle"],
    en: ["EK14[^.]{0,100}(?:withdraw|pull(?:s|ed)? back|safety zone|to safety|burn(?:ed|t) area)", "(?:withdraw\\w*|safety zone)[^.]{0,60}EK14", "safety in the burn(?:ed|t) area"],
  },
  "freeze.5.road_jump": {
    fi: ["toise\\w* kohda\\w*[^.]{0,60}(?:\\byli|ylit)", "(?:\\byli|ylit\\w*)[^.]{0,60}toise\\w* kohda", "metsäautotie\\w*[^.]{0,80}(?:uudestaan|toise\\w* kohda)"],
    en: ["(?:another|a second|second) (?:point|place|spot|crossing)", "cross\\w*[^.]{0,60}(?:again|elsewhere)"],
  },
  // ---- V7 ----
  "freeze.7.lull_meaning": {
    fi: ["palo ei ole (?:vielä )?ohi", "ei ole (?:vielä )?sammunut", "ei (?:ole )?vielä hallinnassa", "reunat rauhoittuvat hetkeksi"],
    en: ["(?:fire|it) is not (?:yet )?(?:over|out)", "not (?:yet )?(?:out|extinguished|under control)", "calm for now"],
  },
  "freeze.7.why_north": {
    fi: ["Mökkiran\\w*[^.]{0,80}(?:uhat|uhka|tiellä|vaara)", "(?:uhat\\w*|vaara\\w*)[^.]{0,60}Mökkiran", "Karhujärven mök\\w*[^.]{0,40}uhat"],
    en: ["Lakeside Cottages[^.]{0,80}(?:threat|at risk|in the (?:fire's )?path|danger)", "(?:threat\\w*|at risk)[^.]{0,60}Lakeside Cottages", "Bear Lake[^.]{0,30}(?:cabins|cottages)[^.]{0,40}threat"],
  },
  "freeze.7.rekindle_sector": {
    fi: ["\\bL3\\b[^.]{0,80}(?:uudelleen|syty|kyt|riski)", "(?:uudelleen\\w*|syttyä|kyteä|kytee)[^.]{0,80}(?:\\bL3\\b|syttymäkohdan eteläreun)", "\\bL3\\W{1,3}etelä"],
    en: ["\\bL3\\b[^.]{0,80}(?:flare|rekindl|reignit|smoulder)", "(?:flare\\w*|rekindl\\w*|reignit\\w*|smoulder\\w*)[^.]{0,80}(?:\\bL3\\b|south edge)", "\\bL3\\W{1,3}south"],
  },
  "freeze.7.cabins_reach": {
    fi: ["(?:palo|reuna)[^.]{0,60}ei (?:ehdi|ulotu|saavuta)[^.]{0,40}mök", "mök\\w*[^.]{0,60}ei (?:ole )?(?:välitöntä )?(?:uhkaa|vaaraa)", "ei tunnin aikana"],
    en: ["(?:fire|edge)[^.]{0,60}(?:will not|won't|does not) reach[^.]{0,40}(?:cottages|cabins)", "(?:cottages|cabins)[^.]{0,60}(?:not|no) (?:immediate )?(?:threat|danger|risk)", "not within the hour"],
  },
  "freeze.7.cp_safe": {
    fi: ["johtopai\\w*[^.]{0,80}(?:turvassa|ei (?:ole )?(?:uhattu|vaarassa)|ei tarvitse siirt|voi jäädä|pysyy paikallaan)", "(?:palo|savu)[^.]{0,30}ei (?:ulotu|yllä)[^.]{0,30}johtopai", "palo ja savu eivät ulotu sinne"],
    en: ["command post[^.]{0,80}(?:safe|not (?:at risk|threatened)|need not|does not need to (?:move|relocate)|can stay)", "(?:fire|smoke)[^.]{0,40}(?:not|n't) reach[^.]{0,30}command post", "neither fire nor smoke will reach it"],
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
  "freeze.10.area_total_hour": { band: "ha" },
  "freeze.10.front_r2_2h": { band: "m", context: R2_CTX },
  // ---- V12 ----
  "freeze.12.f7": {
    fi: ["(?:johto|voimajohto|110 kV)[^.]{0,60}(?:on jännitteinen|on jännitteellä|ei ole (?:kytketty pois|jännitteetön))", "\\bjännitteinen"],
    en: ["\\bline is (?:still )?live", "(?:line|power line)[^.]{0,40}(?:still )?(?<!de-)energi[sz]ed", "(?:line|power line)[^.]{0,40}not (?:been )?(?:switched off|de-energi[sz]ed)"],
  },
  "freeze.12.front_toward": {
    fi: ["Lahdenkyl\\w*[^.]{0,30}(?:suuntaan|kohti|päin)", "(?:kohti|suuntaan)[^.]{0,20}Lahdenkyl", "kaakko\\w*[^.]{0,60}Lahdenkyl", anchored("lahdenkylän")],
    en: ["(?:towards?|heading for|in the direction of)[^.]{0,20}Bay Village", "south-?east\\w*[^.]{0,60}Bay Village", anchored("bay village")],
  },
  "freeze.12.village_distance": { band: "m", context: { fi: ["Lahdenkyl"], en: ["Bay Village", "village"] } },
  "freeze.12.head_later": {
    fi: ["kär[kj]\\w*[^.]{0,80}(?:metsäautotie\\w*|Honkaharju\\w*)", "(?:metsäautotie\\w*|Honkaharju\\w*)[^.]{0,80}kär[kj]"],
    en: ["head[^.]{0,80}(?:forest road|Pine Ridge)", "(?:forest road|Pine Ridge)[^.]{0,80}head"],
  },
  // ---- V14 ----
  "freeze.14.road_crossed": {
    fi: ["(?:ylitti|ylittänyt|pääsi)[^.]{0,40}(?:metsäautotie|Honkaharju|tien)", "tie ei (?:enää )?pysäytä", "(?:metsäautotie|Honkaharju)\\w*[^.]{0,60}(?:ei (?:enää )?pidä|ylitetty|ylitti)"],
    en: ["(?:crossed|got across|jumped)[^.]{0,40}(?:forest road|Pine Ridge|road)", "road (?:no longer|does not|doesn't) (?:stop|hold)", "(?:forest road|Pine Ridge)[^.]{0,60}(?:no longer holds|was crossed)"],
  },
  "freeze.14.shift_meaning": {
    fi: ["(?:uusi|seuraava) vuoro[^.]{0,80}(?:samoilla autoilla|otti[^.]{0,30}(?:auton|linjan))", "ei (?:jää )?(?:aukkoa|katkosta)", "linjat pysyvät"],
    en: ["(?:new|next) shift[^.]{0,80}(?:same vehicles|took over[^.]{0,30}(?:vehicle|line))", "no gap", "lines stay"],
  },
  "freeze.14.se_front_r2": { band: "m", context: R2_CTX },
  "freeze.14.head_later": { fi: ["kär[kj]\\w*[^.]{0,80}(?:\\bR2\\b|huoltotie)", "(?:\\bR2\\b|huoltotie\\w*)[^.]{0,80}kär[kj]"], en: ["head[^.]{0,80}(?:\\bR2\\b|service road)", "(?:\\bR2\\b|service road)[^.]{0,80}head"] },
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

/** The item with its statements (analysis only); an item that already has them, or has none authored, is returned as it is. */
export function withKeyStatements(item: FreezeItem): FreezeItem {
  if (item.keyStatements) return item;
  const keyStatements = keyStatementsFor(item);
  return keyStatements ? { ...item, keyStatements } : item;
}
