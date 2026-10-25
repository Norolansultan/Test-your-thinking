/**
 * Thinker's deterministic answer template (SPEC/14 revision 23 Sep 2026 (g): ANSWER · BASIS ·
 * CERTAINTY · WOULD CHANGE IF). Since SPEC/14 revision (q) Thinker answers live; this template is
 * its fallback, built over the same retrieved records when the model cannot answer (step 6).
 *
 * B6 (SPEC/14 revision (bi), 25 Oct 2026; play-test analysis §10.3 d), the two rules the study model's prompt already follows:
 * - **A record that is a question is never the answer** ({@link isQuestionRecord}): the next ranked record is taken, and the
 *   template is built over the records that are not questions (the basis too). A unit's question to command is the closest
 *   lexical match to the participant's own question ("Onko poliisi ilmoittanut, onko Mökkirannan mökeillä ihmisiä?" returned
 *   EK14's "onko Mökkirannan mökit tarkistettu?"), but it answers nothing.
 * - **An old record is not "varma"** ({@link STALE_RECORD_MINUTES}): when the shown record is more than 30 minutes older than the
 *   period's end — the reference the model's record ages are counted to (prompt rule 2, SPEC/14 revision (an): `ageRefS`, the end
 *   of the question's step) — its certainty reads "epävarma (tieto klo hh.mm)" / "uncertain (record from hh.mm)" instead of the
 *   record's own. Without `ageRefS` (older callers) no age rule applies.
 */

import type { RenderableAtom } from "../boundary/render-boundary.js";
import type { Certainty } from "../scenario/types.js";
import { recordIn, sourceName } from "../i18n/text.js";
import type { ThinkerLinjaus } from "./thinker-protocol.js";

/** SPEC/14 revision 23 Sep 2026 (g): ANSWER · BASIS · CERTAINTY · WOULD CHANGE IF. */
export interface TemplateAnswer {
  readonly answerFi: string;
  readonly basisFi: string;
  readonly certaintyFi: string;
  readonly wouldChangeIfFi: string;
  /** The strategy-guided Thinker's fifth field (cell `reasoning_intent`, V8–V14; D2); absent otherwise. */
  readonly linjaus?: ThinkerLinjaus;
}

/** The wall-clock label of a virtual time (13:20 is virtual 0), e.g. "16.21". */
export function clockAt(observedAtSeconds: number, start = "13:20"): string {
  const [h, m] = start.split(":").map(Number) as [number, number];
  const total = h * 60 + m + Math.floor(observedAtSeconds / 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}.${String(total % 60).padStart(2, "0")}`;
}

function certaintyEn(certainty: Certainty): string {
  switch (certainty.kind) {
    case "confirmed": return "certain";
    case "probable": return `probable (${certainty.basis})`;
    case "uncertain": return `uncertain (${certainty.basis})`;
    case "unknown": return "not known";
  }
}

function certaintyFi(certainty: Certainty): string {
  switch (certainty.kind) {
    case "confirmed":
      return "varma";
    case "probable":
      return `todennäköinen (${certainty.basis})`;
    case "uncertain":
      return `epävarma (${certainty.basis})`;
    case "unknown":
      return "ei tiedossa";
  }
}

export function recordText(record: RenderableAtom["record"]): string {
  return "text" in record ? record.text : "content" in record && record.content ? record.content : `(${record.kind})`;
}

/** B6: a record more than this many minutes older than the period's end is "uncertain (record from hh.mm)" (prompt rule 2's "about 30 minutes"). */
export const STALE_RECORD_MINUTES = 30;

/**
 * A record's age in whole minutes at `refS`, counted between the clock minutes shown (as the model's record lines count it,
 * `server/thinker/model.ts` `recordAgeMinutes`, SPEC/14 revision (an)); never negative.
 */
export function recordAgeAt(observedAtS: number, refS: number): number {
  return Math.max(0, Math.floor(refS / 60) - Math.floor(observedAtS / 60));
}

/** Unit-to-unit traffic opens with the unit addressed, then the record's own source: "EK15, VPK: …", "KY21, täällä VPK. …". */
function addressedToAnotherUnit(text: string, sourceId: string): boolean {
  const head = /^([\p{L}][\p{L}\p{N}-]*), (?:täällä )?([\p{L}][\p{L}\p{N}-]*)[:.]/u.exec(text);
  return head !== null && head[1]!.toLowerCase() !== "johto" && head[2] === sourceId;
}

const SENTENCE_END = /(?<=[.!?])\s+/u;
const ENDS_IN_QUESTION = /\?["”»)]*$/u;

/**
 * B6: the record is a question — a unit asking command, which answers nothing. Narrowly: its (Finnish) text ends in a question
 * (its last sentence ends in "?") or opens with one (its first sentence does), and it is not traffic between two units ("EK11,
 * EK12: … Mikä on teidän reittinne?": a question to another unit, whose report before it is often what was asked for, e.g. VPK's
 * 17:24 smoke sighting). Decided on the record's source text, so a record is a question in both session languages or in neither.
 * Records that ask in the middle and then report ("… Voitteko syöttää meidän linjaa? Väliä noin 50 m.") are not questions.
 */
export function isQuestionRecord(atom: Pick<RenderableAtom, "record" | "provenance">): boolean {
  const text = recordText(atom.record).trim();
  if (addressedToAnotherUnit(text, atom.provenance.sourceId)) return false;
  const sentences = text.split(SENTENCE_END);
  return ENDS_IN_QUESTION.test(sentences.at(-1) ?? "") || ENDS_IN_QUESTION.test(sentences[0] ?? "");
}

/** The shown record's certainty: its own, or "uncertain (record from hh.mm)" when it is old at `ageRefS` (B6). */
function shownCertainty(top: RenderableAtom, lang: "fi" | "en", ageRefS: number | undefined): string {
  if (ageRefS !== undefined && recordAgeAt(top.provenance.observedAt, ageRefS) > STALE_RECORD_MINUTES) {
    const at = clockAt(top.provenance.observedAt);
    return lang === "en" ? `uncertain (record from ${at})` : `epävarma (tieto klo ${at})`;
  }
  return lang === "en" ? certaintyEn(top.provenance.certainty) : certaintyFi(top.provenance.certainty);
}

/**
 * The four-part template over retrieved records, best first (SPEC/14 revisions (g) and (q)), over the records that are not
 * questions (B6). `ageRefS`: the period's end the record ages are counted to (the end of the question's step; B6).
 */
export function buildTemplateAnswer(results: readonly RenderableAtom[], lang: "fi" | "en" = "fi", ageRefS?: number): TemplateAnswer {
  const answerable = results.filter((r) => !isQuestionRecord(r));
  if (lang === "en") {
    if (answerable.length === 0) return { answerFi: "No hits in the archive among what has been reported so far.", basisFi: "—", certaintyFi: "not known", wouldChangeIfFi: "A new report on the subject arrives." };
    const first = answerable[0]!;
    return {
      answerFi: recordIn("en", first.id, recordText(first.record)),
      basisFi: answerable.slice(0, 3).map((r) => `${sourceName("en", r.provenance.sourceId)} at ${clockAt(r.provenance.observedAt)}`).join("; "),
      certaintyFi: shownCertainty(first, "en", ageRefS),
      wouldChangeIfFi: "A new, contradicting report on the same subject.",
    };
  }
  if (answerable.length === 0) {
    return {
      answerFi: "Ei osumia arkistossa tähän mennessä raportoidusta.",
      basisFi: "—",
      certaintyFi: "ei tiedossa",
      wouldChangeIfFi: "Uusi raportti aiheesta saapuu.",
    };
  }
  const top = answerable[0]!;
  return {
    answerFi: recordText(top.record),
    basisFi: answerable.slice(0, 3).map((r) => `${r.provenance.sourceId} klo ${clockAt(r.provenance.observedAt)}`).join("; "),
    certaintyFi: shownCertainty(top, "fi", ageRefS),
    wouldChangeIfFi: "Uusi, ristiriitainen raportti samasta aiheesta.",
  };
}
