/**
 * Did a text state a freeze item's key? The matching rules of `aiStatedKey` (SPEC/30 §5.3), apart from the log: the
 * item's authored `keyStatements` (regular-expression sources, case-insensitive, in the session language) when it has
 * any for that language, otherwise a generic fallback built from the key option's label (in the session language):
 * - `band`: the key names a numeric band with a unit ("15–22 hehtaaria", "Less than 15 minutes", "Yli 140 hehtaaria"):
 *   a quantity in the text with a unit of the same dimension (ha; m and km; m/min; m/s; min and h; %), single or a
 *   range, that lies wholly inside the band (thousands and decimals read as the session language writes them:
 *   `normaliseQuantities`). A key with a band uses this rule alone;
 * - `sector`: the key names one sector (L1–L4) that no other option names: the text names that sector and none of the
 *   other options' sectors;
 * - `tokens`: the key's distinctive word stems (five-letter prefixes of its words of four letters or more, so Finnish
 *   endings do not matter, and identifiers such as EK11, that no other option has, stop words left out): at least two
 *   of them in the text, or the only one.
 * A map item has no option label: without `keyStatements` it cannot be screened (`rules` empty).
 *
 * A SCREENING AID, as `answerRelaysAtom` is: it misses paraphrase and can match a number stated about something else.
 * Two coders audit a sample of the matches (SPEC/30 §5.3); the matched text is returned for them.
 *
 * SPEC/31 §3.6, sagat F16 (19 Oct 2026):
 * - **Element-tied patterns.** An item may carry `elementPatterns` (WP-2 authors them): regular-expression sources naming the
 *   item's element (the cottages, the lull, the R1 road …). When it has any for the session language, a statement counts only in a
 *   sentence that also names the element, so a generic pattern ("ei vielä hallinnassa", "linjat pysyvät", "kuusik…") is no longer
 *   matched about something else. Without them the whole text is read, as before.
 * - **Lures** (`lureMatchers`, for `statedLure`): each distractor option of a choice item, matched by its authored `lureStatements`
 *   (WP-2) when it has any in the session language, else by the same generic band, sector and token rules applied to its own label
 *   (against every other option's); element-tied in the same way. A map item has no lure matcher.
 */

import type { FreezeItem } from "../scenario/types.js";

/** Regular-expression sources per session language (the shape of `keyStatements`). */
export interface StatementSources { readonly fi: readonly string[]; readonly en: readonly string[] }

/**
 * The analysis-only statement fields an item may carry beside `keyStatements` (SPEC/31 §3.6; authored by WP-2 in the item bank, never
 * shown, never in the session): the element's patterns and the distractors' statements. Optional: an item without them is screened as
 * before (the whole text; generic lure rules).
 */
export interface StatementFields {
  readonly elementPatterns?: StatementSources;
  readonly lureStatements?: readonly ({ readonly optionId: string } & StatementSources)[];
}

export type KeyRule = "key_statements" | "band" | "sector" | "tokens";

export interface KeyMatch {
  readonly rule: KeyRule;
  /** What matched: the regular expression's match, the quantity, the sector, or the stems found. */
  readonly text: string;
}

export interface KeyMatcher {
  /** The rules that can apply to this item, in the order tried; empty: the item cannot be screened. */
  readonly rules: readonly KeyRule[];
  readonly match: (text: string) => KeyMatch | null;
}

type Dim = "area" | "length" | "rate" | "speed" | "time" | "percent";
interface Interval { readonly dim: Dim; readonly lo: number; readonly hi: number; readonly text: string }

/** Units, longest first where one is a prefix of another; each must end at a word boundary. */
const UNITS: readonly { readonly re: string; readonly dim: Dim; readonly factor: number }[] = [
  { re: "m\\s*/\\s*min|metriä minuutissa|met(?:re|er)s? (?:per|a) minute", dim: "rate", factor: 1 },
  { re: "m\\s*/\\s*s|metriä sekunnissa|met(?:re|er)s? per second", dim: "speed", factor: 1 },
  { re: "ha|hehtaari\\p{L}*|hectares?", dim: "area", factor: 1 },
  { re: "km|kilometri\\p{L}*|kilomet(?:re|er)s?", dim: "length", factor: 1000 },
  { re: "m|metri\\p{L}*|met(?:re|er)s?", dim: "length", factor: 1 },
  { re: "min|minuut\\p{L}*|minutes?", dim: "time", factor: 1 },
  { re: "h|tunni\\p{L}*|tunti\\p{L}*|hours?", dim: "time", factor: 60 },
  { re: "%|prosentti\\p{L}*|per ?cent", dim: "percent", factor: 1 },
];
const UNIT = `(${UNITS.map((u) => `(?:${u.re})`).join("|")})(?![\\p{L}\\d])`;
const NUM = "(\\d+(?:\\.\\d+)?)";
const START = "(?<![\\p{L}\\d.])";
const WORD = "(?<![\\p{L}\\d])";
const RANGE = new RegExp(`${START}${NUM}\\s*(?:–|—|-|to)\\s*${NUM}\\s*${UNIT}`, "gu");
const BELOW = new RegExp(`${WORD}(?:alle|less than|under|below|fewer than|enintään|korkeintaan|at most|up to)\\s+${NUM}\\s*${UNIT}`, "gu");
const ABOVE = new RegExp(`${WORD}(?:yli|more than|over|above|vähintään|at least)\\s+${NUM}\\s*${UNIT}`, "gu");
const SINGLE = new RegExp(`${START}${NUM}\\s*${UNIT}`, "gu");

/**
 * Lower case; non-breaking and thin spaces become spaces; thousands grouped by a space ("1 500") are joined (not after a
 * letter: "L3 500 m" stays two numbers); in English a comma before exactly three digits is a thousands separator
 * ("1,500 metres"); any other comma between digits is a decimal comma ("18,8 ha").
 */
export function normaliseQuantities(text: string, lang: "fi" | "en" = "fi"): string {
  let t = text.toLowerCase().replace(/[   ]/g, " ");
  t = t.replace(/(?<![\p{L}\d.,])(\d{1,3}) (?=\d{3}(?!\d))/gu, "$1");
  if (lang === "en") t = t.replace(/(?<=\d),(?=\d{3}(?!\d))/g, "");
  return t.replace(/(\d),(\d)/g, "$1.$2");
}

function unitOf(token: string): { readonly dim: Dim; readonly factor: number } {
  const u = UNITS.find((x) => new RegExp(`^(?:${x.re})$`, "u").test(token))!;
  return { dim: u.dim, factor: u.factor };
}

/** Every quantity stated in a text, as an interval in the dimension's base unit (ha, m, m/min, m/s, min, %). */
export function quantitiesIn(text: string, lang: "fi" | "en" = "fi"): Interval[] {
  const t = normaliseQuantities(text, lang);
  const out: Interval[] = [];
  const taken: [number, number][] = [];
  const free = (from: number, to: number) => taken.every(([a, b]) => to <= a || from >= b);
  const add = (m: RegExpMatchArray, lo: number, hi: number, unit: string) => {
    const { dim, factor } = unitOf(unit);
    out.push({ dim, lo: lo * factor, hi: hi * factor, text: m[0] });
    taken.push([m.index!, m.index! + m[0].length]);
  };
  for (const m of t.matchAll(RANGE)) add(m, Math.min(+m[1]!, +m[2]!), Math.max(+m[1]!, +m[2]!), m[3]!);
  for (const m of t.matchAll(BELOW)) if (free(m.index!, m.index! + m[0].length)) add(m, -Infinity, +m[1]!, m[2]!);
  for (const m of t.matchAll(ABOVE)) if (free(m.index!, m.index! + m[0].length)) add(m, +m[1]!, Infinity, m[2]!);
  for (const m of t.matchAll(SINGLE)) if (free(m.index!, m.index! + m[0].length)) add(m, +m[1]!, +m[1]!, m[2]!);
  return out;
}

const SECTOR = /(?<![\p{L}\d])l[1-9](?![\p{L}\d])/gu;
const sectorsIn = (text: string): Set<string> => new Set([...text.toLowerCase().matchAll(SECTOR)].map((m) => m[0]));

const STOP_WORDS = [
  // Finnish
  "kuin", "joka", "jotka", "sekä", "ovat", "olla", "myös", "mutta", "vain", "ilman", "noin", "kohti", "eikä", "tämä", "siitä", "sitä", "niin",
  "palo", "palon", "paloa", "palossa", "lohko", "lohkon", "lohkolla", "reuna", "yksikkö", "kyllä", "mikään", "jossa", "kanssa",
  "aikana", "sisällä", "jälkeen", "ennen", "mennessä", "kuluttua", "välillä", "tunnin", "tunti", "minuuttia", "seuraavan",
  // English
  "with", "from", "that", "this", "have", "been", "into", "than", "more", "less", "about", "over", "under", "there", "their", "they", "will",
  "would", "fire", "sector", "edge", "unit", "still", "only", "what", "when", "where", "which", "while", "after", "before", "already", "none",
  "within", "during", "until", "next", "hour", "hours", "minutes", "yes",
];
const isIdentifier = (w: string) => /\p{L}/u.test(w) && /\d/.test(w);
const stemOf = (w: string) => (isIdentifier(w) ? w : w.slice(0, 5));
const STOP_STEMS = new Set(STOP_WORDS.map(stemOf));

/** The word stems of a text: five-letter prefixes of its words of four letters or more, and identifiers (EK11, R1) whole. */
export function stemsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/[\p{L}\d]+/gu)) {
    const w = m[0];
    if (/^\d+$/.test(w) || /^l[1-9]$/.test(w)) continue; // numbers: the band rule; sectors: the sector rule
    if (!isIdentifier(w) && w.length < 4) continue;
    const s = stemOf(w);
    if (!STOP_STEMS.has(s)) out.add(s);
  }
  return out;
}

function compiled(item: FreezeItem, field: string, patterns: readonly string[]): RegExp[] {
  return patterns.map((src) => {
    try { return new RegExp(src, "iu"); } catch (e) { throw new Error(`freeze item ${item.id}: ${field} pattern ${JSON.stringify(src)} is not a valid regular expression (${(e as Error).message})`); }
  });
}

function regexMatcher(item: FreezeItem, patterns: readonly string[], field = "keyStatements"): KeyMatcher {
  const res = compiled(item, field, patterns);
  return {
    rules: ["key_statements"],
    match: (text) => {
      for (const re of res) { const m = re.exec(text); if (m) return { rule: "key_statements", text: m[0] }; }
      return null;
    },
  };
}

function genericMatcher(keyLabel: string, otherLabels: readonly string[], lang: "fi" | "en"): KeyMatcher {
  const band = quantitiesIn(keyLabel, lang)[0];
  if (band) {
    return {
      rules: ["band"],
      match: (text) => {
        const hit = quantitiesIn(text, lang).find((q) => q.dim === band.dim && q.lo >= band.lo && q.hi <= band.hi);
        return hit ? { rule: "band", text: hit.text } : null;
      },
    };
  }
  const keySectors = sectorsIn(keyLabel);
  const otherSectors = new Set(otherLabels.flatMap((l) => [...sectorsIn(l)]));
  const sector = keySectors.size === 1 && !otherSectors.has([...keySectors][0]!) ? [...keySectors][0]! : null;
  const otherStems = new Set(otherLabels.flatMap((l) => [...stemsOf(l)]));
  const distinctive = [...stemsOf(keyLabel)].filter((s) => !otherStems.has(s));
  const rules: KeyRule[] = [...(sector ? ["sector" as const] : []), ...(distinctive.length > 0 ? ["tokens" as const] : [])];
  return {
    rules,
    match: (text) => {
      if (sector) {
        const named = sectorsIn(text);
        if (named.has(sector) && ![...named].some((s) => otherSectors.has(s))) return { rule: "sector", text: sector.toUpperCase() };
      }
      if (distinctive.length > 0) {
        const stems = stemsOf(text);
        const found = distinctive.filter((s) => stems.has(s));
        if (found.length >= Math.min(2, distinctive.length)) return { rule: "tokens", text: found.join(" ") };
      }
      return null;
    },
  };
}

/**
 * The matcher for one item in one session language. `label` gives an option's label in that language (the Finnish
 * source for a Finnish session: `tr(lang, …)` from `app/i18n/text.ts` by default in `aiStatedKey`).
 */
export function keyMatcher(item: FreezeItem & StatementFields, lang: "fi" | "en", label: (fi: string) => string): KeyMatcher {
  const patterns = item.keyStatements?.[lang] ?? [];
  if (patterns.length > 0) return elementTied(item, lang, regexMatcher(item, patterns));
  if ((item.kind ?? "choice") === "map_point") return { rules: [], match: () => null };
  const key = item.options.filter((o) => o.correct);
  if (key.length !== 1) return { rules: [], match: () => null };
  return elementTied(item, lang, genericMatcher(label(key[0]!.labelFi), item.options.filter((o) => !o.correct).map((o) => label(o.labelFi)), lang));
}

/** The sentences of a text: split after . ! ? before white space, and at line breaks ("klo 14.40" and "18,8" stay whole). */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/u).map((x) => x.trim()).filter((x) => x.length > 0);
}

/**
 * SPEC/31 F16: with `elementPatterns` in the session language, `inner` matches only inside a sentence that also names the element (the
 * first such sentence that matches wins); without them, `inner` unchanged.
 */
export function elementTied(item: FreezeItem & StatementFields, lang: "fi" | "en", inner: KeyMatcher): KeyMatcher {
  const element = item.elementPatterns?.[lang] ?? [];
  if (element.length === 0 || inner.rules.length === 0) return inner;
  const res = compiled(item, "elementPatterns", element);
  return {
    rules: inner.rules,
    match: (text) => {
      for (const sentence of sentencesOf(text)) {
        if (!res.some((re) => re.test(sentence))) continue;
        const m = inner.match(sentence);
        if (m) return m;
      }
      return null;
    },
  };
}

/** One distractor's matcher (`statedLure`). */
export interface LureMatcher { readonly optionId: string; readonly matcher: KeyMatcher }

/**
 * The distractors' matchers of a choice item in one session language, in option order: each by its `lureStatements` for that
 * language when it has any, else the generic rules on its own label against every other option's; element-tied as the key's. A map
 * item, or an item without exactly one key, has none.
 */
export function lureMatchers(item: FreezeItem & StatementFields, lang: "fi" | "en", label: (fi: string) => string): LureMatcher[] {
  if ((item.kind ?? "choice") === "map_point" || item.options.filter((o) => o.correct).length !== 1) return [];
  return item.options.filter((o) => !o.correct).map((o) => {
    const authored = item.lureStatements?.find((l) => l.optionId === o.id)?.[lang] ?? [];
    const inner = authored.length > 0
      ? regexMatcher(item, authored, "lureStatements")
      : genericMatcher(label(o.labelFi), item.options.filter((x) => x.id !== o.id).map((x) => label(x.labelFi)), lang);
    return { optionId: o.id, matcher: elementTied(item, lang, inner) };
  });
}
