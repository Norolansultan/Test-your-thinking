/**
 * Test helpers for the Open Thinker's structured output (SPEC/14 revision (aq)): the model's JSON for a
 * fake Gemini client. `openJson` builds the JSON a model would return; `asOpenModelText` lets the older
 * specs keep their plain-text fakes (a plain string becomes a one-fact lookup, a JSON string is kept).
 */

import type { OpenAnswerKind, OpenFact, OpenOption, OpenPremise } from "../../app/session/open-answer.js";

export interface OpenJsonParts {
  readonly kind?: OpenAnswerKind;
  readonly facts?: readonly OpenFact[];
  readonly unforeseen?: { readonly text: string; readonly tags: readonly string[] } | null;
  readonly premises?: readonly OpenPremise[];
  readonly options?: readonly OpenOption[];
  readonly inference?: string | null;
  readonly questionsForYou?: readonly string[];
}

/** The model's JSON text. Default: a lookup with one fact, no tags. */
export function openJson(parts: OpenJsonParts = {}): string {
  const kind = parts.kind ?? "lookup";
  return JSON.stringify({
    kind,
    facts: parts.facts ?? (kind === "lookup" || kind === "safety" ? [{ text: "ok", tags: [] }] : []),
    unforeseen: parts.unforeseen ?? null,
    premises: parts.premises ?? [],
    options: parts.options ?? [],
    inference: parts.inference ?? null,
    questionsForYou: parts.questionsForYou ?? (kind === "lookup" ? ["Does that change where you would put the relay?"] : []),
  });
}

/** Two options with the given verdicts (null: none), for a decision question. */
export const twoOptions = (a: OpenOption["verdict"] = null, b: OpenOption["verdict"] = null, tags: readonly string[] = ["T1"]): OpenOption[] => [
  { option: "Direct attack", tradeoffs: "Fast containment, close to the head.", verdict: a, tags },
  { option: "Defensive line", tradeoffs: "Slower, holds the road.", verdict: b, tags },
];

/** A JSON string is the model's output already; any other text is wrapped as a one-fact lookup. */
export function asOpenModelText(text: string): string {
  return text.trimStart().startsWith("{") ? text : openJson({ facts: [{ text, tags: [] }] });
}
