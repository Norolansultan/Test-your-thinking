/**
 * Revision (al), 10 Oct 2026: what the server checks and hashes around an Open Thinker answer, for the
 * log only (no stimulus change) — the citation post-check, the history the model is sent (record tags
 * rewritten), the provenance hashes and the directive-quote screen. Pure and deterministic.
 */

import type { InfoAtom } from "../../app/scenario/types.js";
import { clockAt } from "../../app/session/template-answer.js";
import { sha256Hex } from "./config.js";
import type { OpenStructuredAnswer } from "../../app/session/open-answer.js";

/** A citation of the answer that does not match what the model was given (revision (al), logged as `citationIssues`). */
export interface CitationIssue {
  /** `unknown_tag`: no record carries the tag; `time_mismatch`: the time cited beside it is not the record's. */
  readonly kind: "unknown_tag" | "time_mismatch";
  readonly tag: string;
  /** The time cited, as written (time_mismatch). */
  readonly cited?: string;
  /** The tagged record's time, hh.mm (time_mismatch). */
  readonly actual?: string;
}

const CITATION = /[[(]([^[\]()]*\bT\d{1,3}\b[^[\]()]*)[\])]/g;

/**
 * Revision (al), 10 Oct 2026 (logging only): every [T#] or [T#, hh:mm] in the answer checked against
 * the tagged records — a tag beyond the last one is `unknown_tag`; a clock time written in the same
 * bracket as a single tag that is not that record's time is `time_mismatch`. Deterministic; a screen,
 * not a judgement of the answer.
 */
export function citationIssuesOf(answer: string, tagged: readonly InfoAtom[]): CitationIssue[] {
  const issues: CitationIssue[] = [];
  for (const m of answer.matchAll(CITATION)) {
    const inner = m[1]!;
    const tags = [...inner.matchAll(/\bT(\d{1,3})\b/g)].map((t) => Number(t[1]));
    const times = [...inner.matchAll(/\b(\d{1,2})[.:](\d{2})\b/g)].map((t) => `${t[1]!.padStart(2, "0")}.${t[2]}`);
    for (const n of tags) if (n < 1 || n > tagged.length) issues.push({ kind: "unknown_tag", tag: `T${n}` });
    if (tags.length === 1 && times.length === 1) {
      const atom = tagged[tags[0]! - 1];
      if (atom) {
        const actual = clockAt(atom.provenance.observedAt);
        if (actual !== times[0]) issues.push({ kind: "time_mismatch", tag: `T${tags[0]}`, cited: times[0]!, actual });
      }
    }
  }
  return issues;
}

/**
 * Revision (al), 10 Oct 2026: the tags are numbered afresh in every request, so a [T3] in an earlier
 * answer names some other record now. In the history the model is sent, each bracket that holds tags
 * becomes "(earlier answer)" — keeping whatever else it says, as "(earlier answer, 15:40)". The
 * participant's own turns are not touched; the log keeps what the browser sent (and its hashes).
 */
export function historyTurnForModel(turn: { readonly role: "user" | "model"; readonly text: string }, lang: "fi" | "en"): { role: "user" | "model"; text: string } {
  if (turn.role === "user") return { role: turn.role, text: turn.text };
  const label = lang === "en" ? "earlier answer" : "aiempi vastaus";
  const text = turn.text.replace(/[[(]([^[\]()]*)[\])]/g, (whole, inner: string) => {
    if (!/\bT\d{1,3}\b/.test(inner)) return whole;
    const rest = inner.replace(/\bT\d{1,3}\b/g, "").split(/\s*[,;]\s*/).map((p) => p.trim()).filter((p) => p.length > 0 && !/^(?:and|ja|sekä|[-–—/])$/i.test(p));
    return `(${[label, ...rest].join(", ")})`;
  });
  return { role: turn.role, text };
}

/**
 * Revision (al): the provenance of what the model was sent — the sha256 of each history turn as the
 * browser sent it, in order, and of the full user content. A forged or edited client history then shows
 * in the log (it cannot be prevented: the server keeps no conversation state).
 */
export function provenanceHashes(history: readonly { readonly role: string; readonly text: string }[] | undefined, userContent: string): { readonly historyHashes: string[]; readonly userContentHash: string } {
  return { historyHashes: (history ?? []).map((h) => sha256Hex(`${h.role}\n${h.text}`)), userContentHash: sha256Hex(userContent) };
}

const normaliseWords = (s: string) => s.toLocaleLowerCase("fi").normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((w) => w.length > 0);

/** The run of consecutive words a question must share with the directive to count as quoting it. */
export const DIRECTIVE_QUOTE_MIN_WORDS = 5;

/**
 * Revision (al), 10 Oct 2026 (logging only): whether the participant's question quotes the directive —
 * shares a run of at least {@link DIRECTIVE_QUOTE_MIN_WORDS} consecutive words (lowercased, punctuation
 * dropped) with its text in either language. A deterministic string-overlap screen: a paraphrase is
 * not caught, and a five-word stock phrase would be.
 */
export function directiveQuoted(question: string, directiveTexts: readonly string[]): boolean {
  const q = ` ${normaliseWords(question).join(" ")} `;
  return directiveTexts.some((d) => {
    const w = normaliseWords(d);
    for (let i = 0; i + DIRECTIVE_QUOTE_MIN_WORDS <= w.length; i++) if (q.includes(` ${w.slice(i, i + DIRECTIVE_QUOTE_MIN_WORDS).join(" ")} `)) return true;
    return false;
  });
}

/**
 * Revision (aq), 11 Oct 2026: the citation check over a structured answer. Every `tags` array of the
 * answer the model returned (before the proxy's limits) is checked against the tagged records: a tag
 * beyond the last one, or T0, is `unknown_tag`. No time is checked: the proxy writes each citation's
 * time from the record itself, so a `time_mismatch` cannot arise. Also counts the facts, premises and
 * options that cite no record (the fixed sentence about P2's orders cites none).
 */
export function citationIssuesOfStructured(a: OpenStructuredAnswer, taggedCount: number): { readonly issues: CitationIssue[]; readonly uncited: number } {
  const issues: CitationIssue[] = [];
  const items = [...a.facts, ...a.premises, ...a.options];
  for (const item of items) {
    for (const t of item.tags) if (Number(t.slice(1)) < 1 || Number(t.slice(1)) > taggedCount) issues.push({ kind: "unknown_tag", tag: t });
  }
  return { issues, uncited: items.filter((i) => i.tags.length === 0).length };
}

// Unicode-aware word edges: the regex word boundary is ASCII-only in JavaScript, so it never matched a word ending in "ä". "pitää" is not listed: it is mostly the descriptive "holds" ("Pitää linjat…") and never matched before.
const IMPERATIVE_WORDS: Readonly<Record<"fi" | "en", RegExp>> = {
  en: /(?<![\p{L}])(?:must|should|immediately|cease)(?![\p{L}])/giu,
  fi: /(?<![\p{L}])(?:täytyy|pitäisi|kannattaa|kannattaisi|heti|lopeta)(?![\p{L}])/giu,
};

/** "I recommend", "we suggest", "suosittelen": a recommendation is rejected even when it is phrased as a question. */
const RECOMMENDATION: Readonly<Record<"fi" | "en", RegExp>> = {
  en: /(?<![\p{L}])(?:I|we)\s+(?:strongly\s+)?(?:recommend|suggest|advise)(?![\p{L}])/iu,
  fi: /(?<![\p{L}])(?:suosittelen|suosittelemme|ehdotan|ehdotamme|neuvon|neuvomme)(?![\p{L}])/iu,
};

/** After the word: the descriptive uses that are no instruction ("immediately east of R2", "heti kun", "must have crossed"). */
const DESCRIPTIVE_AFTER: Readonly<Record<"fi" | "en", Readonly<Record<string, RegExp>>>> = {
  en: {
    immediately: /^\s+(?:to\s+the\b|north|south|east|west|n[ew]?\b|s[ew]?\b|adjacent|downwind|upwind|beyond|behind|ahead|next|after|before|following|above|below|inside|outside|around|along|across|near|surrounding)/i,
    must: /^\s+have\b/i,
  },
  fi: {
    heti: /^\s+(?:kun\b|sen\b|jälkeen|ennen|vieressä|takana|(?:\p{L}+\s+)?\p{L}*puolella)/iu,
  },
};

/** An "if" / "jos" clause earlier in the sentence ("if the wind should shift"): a condition, no instruction. */
const CONDITIONAL_BEFORE: Readonly<Record<"fi" | "en", RegExp>> = { en: /\bif\b[^,;]*$/i, fi: /(?<![\p{L}])jos\s[^,;]*$/iu };

/** The sentences of a text (split after . ! ? and at line breaks); the original wording of each, trimmed. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\s*\n\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** A sentence that ends in a question mark: a question to the commander, not an instruction. */
export function isQuestionSentence(sentence: string): boolean {
  return /\?[\s"'”’)\]]*$/.test(sentence.trim());
}

/** The forbidden words in one sentence, without the descriptive uses and without the conditional "Should the wind shift, …". */
function forbiddenWords(sentence: string, lang: "fi" | "en"): string[] {
  const out: string[] = [];
  for (const m of sentence.matchAll(IMPERATIVE_WORDS[lang])) {
    const word = m[0].toLowerCase();
    const index = m.index ?? 0;
    if (DESCRIPTIVE_AFTER[lang][word]?.test(sentence.slice(index + m[0].length))) continue;
    if ((word === "should" || word === "pitäisi") && (CONDITIONAL_BEFORE[lang].test(sentence.slice(0, index)) || (index === 0 && sentence.includes(",")))) continue;
    out.push(word);
  }
  return out;
}

/** A sentence that recommends ("I recommend", "we suggest", "suosittelen"), even as a question: rule 4's ban (SPEC/14 ab.2). */
export function isRecommendationSentence(sentence: string, lang: "fi" | "en"): boolean {
  return RECOMMENDATION[lang].test(sentence);
}

/** An instruction or a recommendation: a statement with a forbidden word, or any sentence that recommends. A question to the commander is none (researcher, 11 Oct 2026). */
export function isImperativeSentence(sentence: string, lang: "fi" | "en"): boolean {
  if (isRecommendationSentence(sentence, lang)) return true;
  return !isQuestionSentence(sentence) && forbiddenWords(sentence, lang).length > 0;
}

/** The text without its imperative sentences, in the model's own words (nothing is rewritten); `changed` is false when nothing was removed. */
export function withoutImperativeSentences(text: string, lang: "fi" | "en"): { readonly text: string; readonly changed: boolean } {
  const sentences = sentencesOf(text);
  const kept = sentences.filter((s) => !isImperativeSentence(s, lang));
  return kept.length === sentences.length ? { text, changed: false } : { text: kept.join(" "), changed: true };
}

/** The forbidden words of the statements in the text (a question to the commander is not counted); the log's screen, not a judgement. */
export function imperativeWordsIn(text: string, lang: "fi" | "en"): string[] {
  return sentencesOf(text).flatMap((s) => (isQuestionSentence(s) ? [] : forbiddenWords(s, lang)));
}

