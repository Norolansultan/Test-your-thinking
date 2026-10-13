/**
 * The English names of the site's places and the English of the Finnish codes an English session
 * would otherwise show (revision (ae), researcher decision 9 Oct 2026: "change the place names to
 * English ones so we can skip the introduction to different terms"). THE ONE AUTHORITATIVE TABLE:
 * every English text that names a place takes its name from here —
 *   - the generated records' English (`tools/fire-ca/site-export.ts` runs `englishNames` over the
 *     bundle's `english` map, so the generator keeps writing one set of proper names);
 *   - the authored English (`content/i18n/*.en.json`), the Thinker's English queries and the neutral
 *     evaluation's English questions, rewritten with this table and guarded by
 *     `test/i18n/place-names.spec.ts`, which fails on any Finnish name left in an English text;
 *   - the unit marker and source name of the volunteer brigade (`unitCallSign`).
 * Finnish sessions never pass through here: the Finnish corpus, map and texts are unchanged.
 *
 * The basemap's labels come from the same table: `tools/topo-map/build.ts` writes each label's English
 * (`labelsEn` in `topo-features.json`) and `render.py` draws the English tiles (`maps/topo-en/`), which
 * `MapView` and `FreezeMap` load in English sessions (`topoTileUrl`). `test/i18n/place-names.spec.ts`
 * checks that every map label has its English here and that no English text names a place outside it.
 *
 * The names are short, distinct from each other and from the unit call signs, and in the style of an
 * English-speaking wildland incident; most translate the Finnish (Karhujärvi, bear lake → Bear Lake),
 * except where a translation would clash (Hauklampi is Hawk Pond beside Pike Pond) and the farms, whose
 * Finnish names are surnames. DRAFT, for native and domain review (SPEC/11 §7.21).
 */

import { sortedKeys } from "../engine/deterministic-object.js";

/** Finnish place name → English. Map labels and scenario texts alike; copied, with each label's position, in SPEC/18 revision (ae), ae.1. */
export const PLACE_NAMES_EN: Readonly<Record<string, string>> = {
  // Named in the scenario's records, questions and directive.
  Karhujärvi: "Bear Lake",
  Haukilampi: "Pike Pond",
  Kotkanjoki: "Eagle River",
  Koivuoja: "Birch Creek",
  Korpioja: "Alder Creek",
  Lahdenkylä: "Bay Village",
  Mökkiranta: "Lakeside Cottages",
  Rahkasuo: "Moss Bog",
  Kuivakangas: "Dry Heath",
  Kuusimäki: "Spruce Hill",
  Honkaharju: "Pine Ridge",
  // On the map only.
  Hiekkala: "Sandy Hamlet",
  "Iso-Rahkasuo": "Great Moss Bog",
  Korpilaakso: "Fern Valley",
  "Iso-Hirvijärvi": "Great Elk Lake",
  "Suo-oja": "Marsh Creek",
  Rahkapuro: "Peat Creek",
  Mustajärvi: "Black Lake",
  Pitkäjärvi: "Long Lake",
  Ahvenlampi: "Perch Pond",
  Valkealampi: "White Pond",
  Kaitajärvi: "Narrow Lake",
  Särkijärvi: "Roach Lake",
  Pirttilampi: "Cabin Pond",
  Kivijärvi: "Stone Lake",
  Ruokolampi: "Reed Pond",
  Heinäjärvi: "Hay Lake",
  Kuikkalampi: "Loon Pond",
  Hauklampi: "Hawk Pond",
  // Farmsteads (surnames in Finnish).
  Rinne: "Hillside Farm",
  Mäkelä: "Knoll Farm",
  Niemelä: "Point Farm",
  Koivula: "Greenwood Farm",
  Harju: "Oakley Farm",
  Peltola: "Meadow Farm",
};

/**
 * A word the English text put after a Finnish name to say what it is ("the Korpioja brook", "the
 * Mökkiranta cabins"): the English name already says it, so it goes with the name ("Alder Creek",
 * "Lakeside Cottages", not "Alder Creek brook").
 */
const ABSORBED: Readonly<Record<string, readonly string[]>> = {
  Haukilampi: ["pond"], Koivuoja: ["brook"], Korpioja: ["brook"], Kotkanjoki: ["river"], Karhujärvi: ["lake"],
  Mökkiranta: ["cabins"], Lahdenkylä: ["village"], Rahkasuo: ["bog"],
};

/** The volunteer brigade's Finnish call sign (vapaaehtoinen palokunta) and its English one. */
export const VOLUNTEER_ID = "VPK";
export const VOLUNTEER_CALL_SIGN_EN = "VOL1";

const LETTER = "\\p{L}\\p{N}";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "the Korpioja brook" is "Alder Creek", not "the Alder Creek" (a name in English takes no article; the cottages keep theirs). */
const ARTICLE_RULES: readonly (readonly [RegExp, string])[] = sortedKeys(ABSORBED)
  .filter((fi) => fi !== "Mökkiranta")
  .map((fi) => [new RegExp(`(?<![${LETTER}])[Tt]he ${escape(fi)} (?:${ABSORBED[fi]!.join("|")})(?![${LETTER}])`, "gu"), PLACE_NAMES_EN[fi]!] as const);
/** Longest first, so "Iso-Rahkasuo" is replaced before "Rahkasuo" could match inside it. */
const NAME_RULES: readonly (readonly [RegExp, string])[] = [...ARTICLE_RULES, ...sortedKeys(PLACE_NAMES_EN)
  .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
  .map((fi) => {
    const tail = ABSORBED[fi]?.length ? `(?: (?:${ABSORBED[fi]!.join("|")}))?` : "";
    return [new RegExp(`(?<![${LETTER}-])${escape(fi)}${tail}(?![${LETTER}])`, "gu"), PLACE_NAMES_EN[fi]!] as const;
  })];

/**
 * Codes the Finnish system writes that an English reader cannot be expected to know: the volunteer
 * brigade's call sign and the vehicle-location log (AVL, "automaattinen ajoneuvopaikannus" in Finnish
 * use), and the fire display's labels for spot fires (PP1, "pistepalo") and rekindles (US1,
 * "uudelleensyttymä"): SF1 and RK1, in the records and on the map alike (`codeIn`). Unit call
 * signs that are codes in English too (EK11, KY21, DR1, VD1, HELI1, UGV1, OUT1, SPOT) stay: the
 * roster's hover card gives each one's type.
 */
const CODE_RULES: readonly (readonly [RegExp, string])[] = [
  [new RegExp(`(?<![${LETTER}])${VOLUNTEER_ID}(?![${LETTER}])`, "gu"), VOLUNTEER_CALL_SIGN_EN],
  [new RegExp(`(?<![${LETTER}])AVL(?= )`, "gu"), "Vehicle location"],
  [/(?<![\p{L}\p{N}])PP(\d+)(?![\p{L}\p{N}])/gu, "SF$1"],
  [/(?<![\p{L}\p{N}])US(\d+)(?![\p{L}\p{N}])/gu, "RK$1"],
];

/** An English text with the Finnish place names and codes in their English form. Idempotent. */
export function englishNames(text: string): string {
  let out = text;
  for (const [re, en] of NAME_RULES) out = out.replace(re, en);
  for (const [re, en] of CODE_RULES) out = out.replace(re, en);
  return out;
}

/** The Finnish place names (and codes) an English text still contains, for the tests. */
export function finnishNamesIn(text: string): string[] {
  const found: string[] = [];
  for (const [re] of [...NAME_RULES, ...CODE_RULES]) for (const m of text.matchAll(new RegExp(re.source, "gu"))) found.push(m[0]);
  return found;
}

/** A spot-fire or rekindle label (PP1, US2: the fire display's ids) as the map shows it in the session language. */
export function codeIn(lang: "fi" | "en", code: string): string {
  return lang === "en" ? englishNames(code) : code;
}

/**
 * A basemap tile's URL in the session language: English sessions load the same tiles with the English
 * labels (`maps/topo-en/`, drawn by `render.py` from `labelsEn`); Finnish sessions the Finnish ones.
 */
export function topoTileUrl(url: string, lang: "fi" | "en"): string {
  return lang === "en" ? url.replace("/maps/topo/", "/maps/topo-en/") : url;
}

/** A unit's call sign as the map, the roster and the log show it in the session language. */
export function unitCallSign(lang: "fi" | "en", id: string): string {
  return lang === "en" && id === VOLUNTEER_ID ? VOLUNTEER_CALL_SIGN_EN : id;
}
