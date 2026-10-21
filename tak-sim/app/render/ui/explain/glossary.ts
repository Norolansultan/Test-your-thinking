/**
 * SPEC/35 §3 item 2: the glossary's terms and the matcher that marks them in a text. Pure: no clock, no randomness, no
 * DOM (I1). The terms are data (`content/glossary/terms.{fi,en}.json`, the same ids in both, DRAFT); a term's forms say
 * which words it covers (`formSyntax` in the files):
 *
 * - a form is one or more words separated by spaces, matched against whole words of the text separated by white space;
 * - in a word, a leading `*` covers any letters before it (the first part of a compound, "kaakkois|sivusta"), a trailing
 *   `*` any letters after it (an inflected ending, "sivusta|lla"), and `#` one or more digits (a call sign's number);
 * - a form starting with `=` matches case-sensitively (call signs, "ha"); every other form ignores case.
 *
 * `markTerms` returns the text cut into plain and term segments whose texts, joined, are the text unchanged: the stimulus
 * is never altered, only marked. At each word the longest match wins (most words, then most literal letters, then the
 * order of the list); a match never starts or ends inside a word, marks never nest, and each term is marked at most at
 * its first occurrence in the text, so a long record is not cluttered. A file's `exclude` phrases ("in front of") take
 * their words out of matching without a mark. The marking depends only on the language and the text — never on the group.
 */

import termsFi from "../../../../content/glossary/terms.fi.json" with { type: "json" };
import termsEn from "../../../../content/glossary/terms.en.json" with { type: "json" };
import type { Lang } from "../../../i18n/lang.js";

export interface GlossaryTerm {
  readonly id: string;
  /** The headword as the help card lists it. */
  readonly term: string;
  readonly forms: readonly string[];
  /** One or two plain-language sentences about the word (never about the situation, SPEC/35 §1). */
  readonly definition: string;
}

export interface GlossaryFile {
  readonly lang: string;
  readonly status: string;
  readonly exclude: readonly string[];
  readonly terms: readonly GlossaryTerm[];
}

export type Segment =
  | { readonly kind: "plain"; readonly text: string }
  | { readonly kind: "term"; readonly text: string; readonly termId: string };

export const GLOSSARY_FILES: Readonly<Record<Lang, GlossaryFile>> = { fi: termsFi, en: termsEn };

/** Letters, digits and the joiners that stay inside a word ("turva-alue", "kV:n", "fire's"). */
const WORD = /[\p{L}\p{N}]+(?:[-'’:][\p{L}\p{N}]+)*/gu;
const WILD = "[\\p{L}\\p{N}'’:-]*";

interface Pattern {
  /** null: an exclude phrase (its words are skipped, never marked). */
  readonly termId: string | null;
  readonly words: readonly RegExp[];
  /** Literal letters in the form: the tie-break after the word count. */
  readonly weight: number;
  readonly order: number;
}

export interface CompiledGlossary {
  readonly patterns: readonly Pattern[];
  readonly terms: ReadonlyMap<string, GlossaryTerm>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** One word of a form as a whole-word regular expression; throws on a form the syntax does not allow. */
export function wordPattern(word: string, caseSensitive: boolean): RegExp {
  const lead = word.startsWith("*");
  const trail = word.length > 1 && word.endsWith("*");
  const core = word.slice(lead ? 1 : 0, trail ? -1 : undefined);
  if (core.length === 0 || core.includes("*")) throw new RangeError(`glossary: bad form word "${word}"`);
  const body = core.split("#").map(escape).join("\\d+");
  return new RegExp(`^${lead ? WILD : ""}${body}${trail ? WILD : ""}$`, caseSensitive ? "u" : "iu");
}

function compileForm(form: string, termId: string | null, order: number): Pattern {
  const caseSensitive = form.startsWith("=");
  const words = (caseSensitive ? form.slice(1) : form).trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") throw new RangeError(`glossary: empty form for "${termId ?? "exclude"}"`);
  const weight = words.reduce((n, w) => n + w.replace(/[*#]/g, "").length, 0);
  return { termId, words: words.map((w) => wordPattern(w, caseSensitive)), weight, order };
}

export function compileGlossary(file: Pick<GlossaryFile, "exclude" | "terms">): CompiledGlossary {
  const patterns: Pattern[] = [];
  let order = 0;
  for (const phrase of file.exclude) patterns.push(compileForm(phrase, null, order++));
  for (const term of file.terms) for (const form of term.forms) patterns.push(compileForm(form, term.id, order++));
  return { patterns, terms: new Map(file.terms.map((t) => [t.id, t])) };
}

interface Word { readonly text: string; readonly start: number; readonly end: number }

function wordsOf(text: string): Word[] {
  const out: Word[] = [];
  for (const m of text.matchAll(WORD)) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** Whether `p` matches the words from `i` on, each pair separated by white space only. */
function matchesAt(p: Pattern, text: string, words: readonly Word[], i: number): boolean {
  if (i + p.words.length > words.length) return false;
  for (let k = 0; k < p.words.length; k++) {
    const w = words[i + k]!;
    if (!p.words[k]!.test(w.text)) return false;
    if (k > 0 && !/^\s+$/.test(text.slice(words[i + k - 1]!.end, w.start))) return false;
  }
  return true;
}

const better = (a: Pattern, b: Pattern | null) =>
  b === null || a.words.length > b.words.length || (a.words.length === b.words.length && (a.weight > b.weight || (a.weight === b.weight && a.order < b.order)));

/** The text as plain and term segments; joined, their texts are `text` exactly. An empty text has no segments. */
export function markTerms(text: string, glossary: CompiledGlossary): Segment[] {
  const words = wordsOf(text);
  const segments: Segment[] = [];
  const marked = new Set<string>();
  let cursor = 0;
  const plain = (to: number) => { if (to > cursor) segments.push({ kind: "plain", text: text.slice(cursor, to) }); };
  for (let i = 0; i < words.length;) {
    let best: Pattern | null = null;
    for (const p of glossary.patterns) if (better(p, best) && matchesAt(p, text, words, i)) best = p;
    if (!best) { i++; continue; }
    const first = words[i]!;
    const last = words[i + best.words.length - 1]!;
    if (best.termId !== null && !marked.has(best.termId)) {
      marked.add(best.termId);
      plain(first.start);
      segments.push({ kind: "term", text: text.slice(first.start, last.end), termId: best.termId });
      cursor = last.end;
    }
    i += best.words.length;
  }
  plain(text.length);
  return segments;
}

const compiled = new Map<Lang, CompiledGlossary>();

/** The session language's glossary, compiled once. */
export function glossaryFor(lang: Lang): CompiledGlossary {
  let g = compiled.get(lang);
  if (!g) { g = compileGlossary(GLOSSARY_FILES[lang]); compiled.set(lang, g); }
  return g;
}

/** A term in the session language, or undefined. */
export function termIn(lang: Lang, termId: string): GlossaryTerm | undefined {
  return glossaryFor(lang).terms.get(termId);
}

/** Texts already marked, per language (the message log re-renders the same records on every tick). */
const CACHE_LIMIT = 4000;
const cache = new Map<string, readonly Segment[]>();

/** `markTerms` in the session language, cached by text. */
export function segmentsIn(lang: Lang, text: string): readonly Segment[] {
  const key = `${lang}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const segments = markTerms(text, glossaryFor(lang));
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, segments);
  return segments;
}

/**
 * What `Glossed` draws: null in an expert session (the text as it always was), else the segments. Depends only on the
 * audience, the language and the text — the same in both groups (SPEC/35 §1).
 */
export function glossedSegments(audience: "expert" | "public", lang: Lang, text: string): readonly Segment[] | null {
  return audience === "public" ? segmentsIn(lang, text) : null;
}

/**
 * The completeness check (SPEC/35 §9 P2): every id in both languages, no id twice, every term with a headword, at least
 * one valid form and a definition, and each file marked DRAFT until reviewed. Returns the problems found (none: []).
 */
export function glossaryProblems(files: Readonly<Record<Lang, GlossaryFile>> = GLOSSARY_FILES): string[] {
  const problems: string[] = [];
  const ids = { fi: files.fi.terms.map((t) => t.id), en: files.en.terms.map((t) => t.id) };
  for (const lang of ["fi", "en"] as const) {
    const other = lang === "fi" ? "en" : "fi";
    const file = files[lang];
    if (file.lang !== lang) problems.push(`${lang}: the file says lang "${file.lang}"`);
    if (!/DRAFT/.test(file.status)) problems.push(`${lang}: status is not marked DRAFT`);
    const seen = new Set<string>();
    for (const t of file.terms) {
      if (seen.has(t.id)) problems.push(`${lang}: "${t.id}" twice`);
      seen.add(t.id);
      if (!ids[other].includes(t.id)) problems.push(`${lang}: "${t.id}" has no ${other} entry`);
      if (!t.term.trim()) problems.push(`${lang}: "${t.id}" has no headword`);
      if (!t.definition.trim()) problems.push(`${lang}: "${t.id}" has no definition`);
      if (t.forms.length === 0) problems.push(`${lang}: "${t.id}" has no form`);
      for (const f of t.forms) {
        try { compileForm(f, t.id, 0); } catch (e) { problems.push(`${lang}: "${t.id}" form "${f}": ${(e as Error).message}`); }
      }
    }
  }
  return problems;
}
