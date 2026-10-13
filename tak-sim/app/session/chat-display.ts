/**
 * The chats' input check and answer display (revision (ah), 9 Oct 2026; review M3, M6). Pure, so the
 * right panel's click path cannot throw and the tests run without a browser.
 */

import { THINKER_MAX_QUESTION_CHARS } from "./thinker-protocol.js";

/** Why a typed question is not sent: blank, too long, or the tool busy with the previous question. */
export type QuestionRefusal = { readonly kind: "empty" } | { readonly kind: "too_long"; readonly length: number } | { readonly kind: "busy" };

/** Null when the question can be sent. The check the session's own guard repeats (`queries.ts`), done first, in the UI. */
export function questionRefusal(query: string, busy: boolean): QuestionRefusal | null {
  if (!query.trim()) return { kind: "empty" };
  if (query.length > THINKER_MAX_QUESTION_CHARS) return { kind: "too_long", length: query.length };
  if (busy) return { kind: "busy" };
  return null;
}

/** A record tag the model was given (`[T7]`, `T12`), never a time or a unit id. */
const TAG = /\bT\d{1,3}\b/g;
/** What is left of a bracket's content once its tags are gone, if it says nothing else. */
const FILLER = /^(?:[\s,;:/–—-]|\b(?:and|to|ja|sekä|record|records|tietue|tietueet|tietueessa|tietueissa)\b)*$/i;

/**
 * Review M3: the model cites the neutral record tags ("[T7, 15:31]", "(T4)"), which mean nothing to
 * the participant (the tag-to-record map is server-side). For display, a bracket that holds tags
 * keeps what else it says, as "(15:31)" or "(13.37, EK12)", and is dropped when nothing else is left.
 * Only brackets are touched; the logged text is unchanged.
 */
export function displayAnswerText(text: string): string {
  return text
    .replace(/\s?[[(]([^[\]()]*)[\])]/g, (whole, inner: string) => {
      if (!/\bT\d{1,3}\b/.test(inner)) return whole;
      const parts = inner.replace(TAG, "").split(/\s*[,;]\s*/).map((p) => p.trim()).filter((p) => p.length > 0 && !FILLER.test(p));
      if (parts.length === 0) return "";
      const kept = parts.join(", ");
      const lead = whole.startsWith(" ") ? " " : "";
      return `${lead}(${kept})`;
    })
    .replace(/ +([.,;:])/g, "$1");
}
