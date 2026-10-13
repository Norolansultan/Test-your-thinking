/**
 * Thinker's deterministic answer template (SPEC/14 revision 23 Sep 2026 (g): ANSWER · BASIS ·
 * CERTAINTY · WOULD CHANGE IF). Since SPEC/14 revision (q) Thinker answers live; this template is
 * its fallback, built over the same retrieved records when the model cannot answer (step 6).
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

/** The four-part template over retrieved records, best first (SPEC/14 revisions (g) and (q)). */
export function buildTemplateAnswer(results: readonly RenderableAtom[], lang: "fi" | "en" = "fi"): TemplateAnswer {
  if (lang === "en") {
    if (results.length === 0) return { answerFi: "No hits in the archive among what has been reported so far.", basisFi: "—", certaintyFi: "not known", wouldChangeIfFi: "A new report on the subject arrives." };
    const first = results[0]!;
    return {
      answerFi: recordIn("en", first.id, recordText(first.record)),
      basisFi: results.slice(0, 3).map((r) => `${sourceName("en", r.provenance.sourceId)} at ${clockAt(r.provenance.observedAt)}`).join("; "),
      certaintyFi: certaintyEn(first.provenance.certainty),
      wouldChangeIfFi: "A new, contradicting report on the same subject.",
    };
  }
  if (results.length === 0) {
    return {
      answerFi: "Ei osumia arkistossa tähän mennessä raportoidusta.",
      basisFi: "—",
      certaintyFi: "ei tiedossa",
      wouldChangeIfFi: "Uusi raportti aiheesta saapuu.",
    };
  }
  const top = results[0]!;
  return {
    answerFi: recordText(top.record),
    basisFi: results.slice(0, 3).map((r) => `${r.provenance.sourceId} klo ${clockAt(r.provenance.observedAt)}`).join("; "),
    certaintyFi: certaintyFi(top.provenance.certainty),
    wouldChangeIfFi: "Uusi, ristiriitainen raportti samasta aiheesta.",
  };
}
