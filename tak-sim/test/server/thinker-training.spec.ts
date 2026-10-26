/**
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.1, §bp.3; SPEC/07 (bp)): the proxy's training branch. A Haku request with
 * `corpus: "training"` (view 0) is answered over the training's records only — gated by its one step (−9), lexical only even with
 * both indexes loaded (the frozen embedder below throws on any question it has no vector for, so a training answer proves no vector
 * was asked for), told the training's "now" (10.18) — with the session's prompt, checks and fallbacks; its log line carries `corpus`
 * "training", `practice` false, `view` 0, `step` −9; every other line carries `corpus` "main". The session's requests never reach a
 * training record. The validation refuses `corpus` with another view, on the Open Thinker, or with another value; the startup check
 * refuses a corpus that is empty, not `trn.`, the session's own, or off its step.
 */

import { describe, expect, it } from "vitest";
import { validateThinkerRequest, type ThinkerResponse } from "../../app/session/thinker-protocol.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { loadTrainingCorpus, trainingCorpusProblems } from "../../server/thinker/deps.js";
import { clockLineOf } from "../../server/thinker/model.js";
import { TRAINING_NOW_S, TRAINING_STEP } from "../../app/session/training/corpus.js";
import { frozenEmbedder, scenario, vectorIndex } from "../engine/thinker-fixtures.js";
import { FIXTURE_TRAINING, TRAINING_FOR_TESTS, TRAINING_NAMES, TRAINING_QUESTIONS } from "../retrieval/training-fixture.js";

const V7_START = scenario.cycles.find((c) => c.index === 7)!.startsAtVirtual;
const TRAINING = { sessionId: "P-001_a", condition: "directed", cell: "radio", view: 0, virtualTimeS: TRAINING_NOW_S, question: "Mitä DR8 ilmoitti klo 10.05?", corpus: "training", queryId: "trn.1" } as const;

function depsWith(logs: Record<string, unknown>[], training = TRAINING_FOR_TESTS): ThinkerDeps {
  return {
    scenario, training, vector: { embedder: frozenEmbedder, index: vectorIndex }, vectorEn: { embedder: frozenEmbedder, index: vectorIndex },
    prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"), promptOpen: loadSystemPrompt("fi", "open"), promptOpenOnce: loadSystemPrompt("fi", "open_once"),
    client: null, appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-26T00:00:00.000Z",
  };
}

describe("the request's `corpus` (revision (bp))", () => {
  it("accepts `corpus: \"training\"` on Haku's chat with view 0, from every cell, and passes it on", () => {
    expect(validateThinkerRequest(TRAINING)).toEqual({ ok: true, request: TRAINING });
    expect(validateThinkerRequest({ ...TRAINING, condition: "substitutive", cell: "reasoning_intent" }).ok).toBe(true);
    expect(validateThinkerRequest({ ...TRAINING, condition: "substitutive", cell: "reasoning_once" }).ok).toBe(true);
    const { corpus: _c, ...main } = TRAINING;
    expect(validateThinkerRequest(main)).toEqual({ ok: true, request: main }); // absent: the session's corpus
  });

  it.each([
    ["another view", { ...TRAINING, view: 3 }, "a training request has view 0"],
    ["another value", { ...TRAINING, corpus: "main" }, "invalid corpus"],
    ["a non-string value", { ...TRAINING, corpus: true }, "invalid corpus"],
  ])("refuses %s", (_label, body, error) => {
    expect(validateThinkerRequest(body)).toEqual({ ok: false, error });
  });

  it("refuses `corpus` on the Open Thinker (400), before any retrieval", async () => {
    expect(validateThinkerRequest({ ...TRAINING, condition: "substitutive", cell: "reasoning_once" }, "open_thinker")).toEqual({ ok: false, error: "the training corpus is Haku's chat only" });
    const r = await handleOpenThinkerRequest(depsWith([]), { ...TRAINING, condition: "substitutive", cell: "reasoning_once" });
    expect(r.status).toBe(400);
  });
});

describe("the handler's training branch (revision (bp))", () => {
  for (const lang of ["fi", "en"] as const) {
    it(`${lang}: answers every training question over the training's records only, lexical only with both indexes loaded, told 10.18`, async () => {
      const logs: Record<string, unknown>[] = [];
      for (const question of TRAINING_QUESTIONS[lang]) {
        const r = await handleThinkerRequest(depsWith(logs), { ...TRAINING, language: lang, question });
        expect(r.status, question).toBe(200);
        const body = r.body as ThinkerResponse;
        expect(body).toMatchObject({ retrievalMode: "lexical_only", retrievalLanguage: lang, fallback: true, fallbackReason: "no_api_key" });
        expect(body.retrieved.every((x) => x.id.startsWith("trn.")), question).toBe(true);
      }
      expect(logs).toHaveLength(TRAINING_QUESTIONS[lang].length);
      for (const line of logs) {
        expect(line).toMatchObject({ tool: "haku", corpus: "training", practice: false, view: 0, step: TRAINING_STEP, embedderId: null, retrievalIndex: null, retrievalMode: "lexical_only", clockVirtualS: TRAINING_NOW_S, ageRefVirtualS: TRAINING_NOW_S, queryId: "trn.1" });
        expect((line.retrieved as { id: string }[]).every((x) => x.id.startsWith("trn."))).toBe(true);
        expect((line.recent as string[]).every((id) => id.startsWith("trn."))).toBe(true);
      }
    });
  }

  it("ranks the intended record first for the pre-recorded questions (fi), and the clock line says 10.18", async () => {
    const intended: Readonly<Record<string, string>> = { "Mitä DR8 ilmoitti klo 10.05?": "trn.r06", "Onko tie R6 ajettavissa?": "trn.r02", "Kuinka suuri EK51:n miehistö on?": "trn.r07", "Paljonko vettä EK52:lla on?": "trn.r10" };
    for (const [question, id] of Object.entries(intended)) {
      const r = await handleThinkerRequest(depsWith([]), { ...TRAINING, question });
      expect((r.body as ThinkerResponse).retrieved[0]?.id, question).toBe(id);
    }
    expect(clockLineOf("fi", TRAINING_NOW_S, TRAINING_NOW_S)).toMatch(/^Nyt: klo 10[.:]18/);
  });

  it("never returns a session record to a training request, whatever is asked (session questions, its names, its sources)", async () => {
    for (const question of ["Haukilampi", "EK11", "20 kV", "rekindle", "Mikä on viimeisin sääennuste?", "Mitä DR1 ilmoitti klo 12.05?", "VPK", "Mökkiranta"]) {
      const r = await handleThinkerRequest(depsWith([]), { ...TRAINING, question });
      expect((r.body as ThinkerResponse).retrieved.every((x) => x.id.startsWith("trn.")), question).toBe(true);
    }
  });

  it("is refused (503) when no training corpus is loaded — never answered over the session's records", async () => {
    const r = await handleThinkerRequest({ ...depsWith([]), training: null }, TRAINING);
    expect(r).toEqual({ status: 503, body: { error: "the training corpus is not loaded" } });
  });

  it("a session request never gets a training record, in VP or a main view, and its log line says `corpus` \"main\"", async () => {
    const logs: Record<string, unknown>[] = [];
    const deps = { ...depsWith(logs), vector: null, vectorEn: null };
    for (const question of [...TRAINING_QUESTIONS.fi, ...TRAINING_NAMES]) {
      for (const [view, virtualTimeS] of [[0, 0], [7, V7_START]] as const) {
        const r = await handleThinkerRequest(deps, { ...TRAINING, corpus: undefined, view, virtualTimeS, question });
        expect(r.status).toBe(200);
        expect((r.body as ThinkerResponse).retrieved.some((x) => x.id.startsWith("trn.")), `${question} V${view}`).toBe(false);
      }
    }
    expect(logs.every((l) => l.corpus === "main")).toBe(true);
  });
});

describe("the startup check of the training corpus (revision (bp))", () => {
  it("passes the training's corpus against the scenario", () => {
    expect(trainingCorpusProblems(TRAINING_FOR_TESTS, scenario.atoms)).toEqual([]);
    expect(loadTrainingCorpus(scenario.atoms, FIXTURE_TRAINING)).toBe(FIXTURE_TRAINING);
  });

  it("refuses an empty corpus, an id without `trn.`, a session record, a repeated id and a record off the training's step", () => {
    const [a, b] = FIXTURE_TRAINING.atoms as [typeof FIXTURE_TRAINING.atoms[0], typeof FIXTURE_TRAINING.atoms[0]];
    const session = scenario.atoms[0]!;
    expect(trainingCorpusProblems({ ...FIXTURE_TRAINING, atoms: [] }, scenario.atoms)).toEqual(["the training corpus is empty (build it: `npm run training:build`)"]);
    expect(trainingCorpusProblems({ ...FIXTURE_TRAINING, atoms: [{ ...a, id: "evt.x.1" }] }, scenario.atoms)).toEqual(['evt.x.1: a training record\'s id must begin "trn."']);
    expect(trainingCorpusProblems({ ...FIXTURE_TRAINING, atoms: [a] }, [...scenario.atoms, { id: a.id }])).toEqual([`${a.id}: is a session record`, `${a.id}: a session record with the training's prefix`]);
    expect(trainingCorpusProblems({ ...FIXTURE_TRAINING, atoms: [a, a] }, scenario.atoms)).toEqual([`${a.id}: twice`]);
    expect(trainingCorpusProblems({ ...FIXTURE_TRAINING, atoms: [{ ...b, cycle: -3 as never }] }, scenario.atoms)).toEqual([`${b.id}: at step -3, not the training's ${TRAINING_STEP}`]);
    expect(() => loadTrainingCorpus(scenario.atoms, { ...FIXTURE_TRAINING, atoms: [{ ...session }] })).toThrow(/cannot be served/);
  });
});
