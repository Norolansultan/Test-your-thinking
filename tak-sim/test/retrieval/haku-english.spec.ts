/**
 * SPEC/14 revision (v): Haku's free-text search in an English session searches the records' English
 * text and the codes, stays closed (I6) and time-gated; the Finnish search is unchanged. The
 * session's local Thinker fallback retrieves over the English passages.
 */

import { describe, expect, it } from "vitest";
import { assertClosedOverCorpus, englishKeysOf, HAKU_EN_STOP_WORDS, retrieveClosed, retrieveClosedEn, retrieveClosedIn } from "../../app/retrieval/closure.js";
import { passageText } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { SessionQueries, type QueryContext } from "../../app/session/queries.js";
import type { ThinkerFallbackReason, ThinkerPromptVariant, ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { scenario } from "../engine/thinker-fixtures.js";

const corpus = reachableAtoms(scenario.atoms, 8);

describe("English Haku free text", () => {
  it("finds the planted record and the grid record by English words and the code", () => {
    const r = retrieveClosedEn("110 kV line de-energised", corpus).map((a) => a.id);
    expect(r[0]).toBe(DESIGNED_EVENT_IDS.planted);
    expect(r).toContain(DESIGNED_EVENT_IDS.gridRecord);
    assertClosedOverCorpus(retrieveClosedEn("110 kV line", corpus), corpus);
  });

  it("matches the English text where the Finnish search finds nothing", () => {
    // Not "water": the Finnish prefix stem meets the event-kind key `water_drop` ("water").
    expect(retrieveClosed("tank helicopter", corpus)).toHaveLength(0);
    const r = retrieveClosedEn("water tank", corpus);
    expect(r.length).toBeGreaterThan(0);
    expect(passageText(r[0]!, "en")).toMatch(/water/i);
  });

  it("finds codes, short ones included, and drops a possessive", () => {
    const ek11 = retrieveClosedEn("EK11's", corpus);
    expect(ek11.length).toBeGreaterThan(0);
    for (const a of ek11.slice(0, 10)) expect(englishKeysOf(a)).toContain("ek11");
    expect(retrieveClosedEn("R2", reachableAtoms(scenario.atoms, 20)).length).toBeGreaterThan(0);
  });

  it("does not match on function words", () => {
    expect(retrieveClosedEn("what where there with from", corpus)).toHaveLength(0);
    for (const a of corpus.slice(0, 100)) for (const k of englishKeysOf(a)) expect(HAKU_EN_STOP_WORDS.has(k)).toBe(false);
  });

  it("is deterministic and picked by language", () => {
    expect(retrieveClosedEn("helicopter water", corpus)).toEqual(retrieveClosedEn("helicopter water", corpus));
    expect(retrieveClosedIn("en")).toBe(retrieveClosedEn);
    expect(retrieveClosedIn("fi")).toBe(retrieveClosed);
  });
});

function queries(lang: "fi" | "en", step: number): SessionQueries {
  const ctx = { scenario, currentStep: () => step, language: () => lang } as unknown as QueryContext;
  return new SessionQueries(ctx, { transport: async () => { throw new Error("unused"); } });
}

describe("the session's Haku and local fallback by language", () => {
  it("searchAtoms uses the session language and the time gate", () => {
    expect(queries("en", 8).searchAtoms("de-energised").map((a) => a.id)).toContain(DESIGNED_EVENT_IDS.planted);
    expect(queries("en", 7).searchAtoms("de-energised").map((a) => a.id)).not.toContain(DESIGNED_EVENT_IDS.planted);
    expect(queries("fi", 8).searchAtoms("de-energised")).toHaveLength(0);
    expect(queries("fi", 8).searchAtoms("110 kV linja").map((a) => a.id)).toContain(DESIGNED_EVENT_IDS.gridRecord); // planted.spec: the Finnish search, unchanged
  });

  it("the local Thinker fallback retrieves over the English passages and says so", () => {
    const q = queries("en", 8);
    const fallback = (q as unknown as { localFallback(query: string, reason: ThinkerFallbackReason, variant: ThinkerPromptVariant): ThinkerResponse }).localFallback;
    const r = fallback.call(q, "Is the 110 kV line de-energised?", "network_error", "standard");
    expect(r).toMatchObject({ retrievalMode: "lexical_only", retrievalLanguage: "en", fallback: true });
    expect(r.retrieved[0]!.id).toBe(DESIGNED_EVENT_IDS.planted);
  });
});
