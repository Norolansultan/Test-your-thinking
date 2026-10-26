/**
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.3–bp.4): the published demonstration's bridge answers the training incident's Haku
 * (`corpus: "training"`, view 0) over the training's records only, lexically, with the same prompts and the bridge's model id — and
 * its model input carries no session text; a session request never gets a training record. Refusals as the proxy's: a training
 * request with another view, a training request on the Open Thinker, an unknown corpus. A data file without the training corpus (the
 * version-1 file) is refused rather than half used.
 */

import { describe, expect, it } from "vitest";
import { DEMO_BRIDGE_MODEL_ID } from "../../app/session/thinker-protocol.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { TRAINING_NOW_S } from "../../app/session/training/corpus.js";
import { parseBridgeData } from "../../tools/demo-bridge/data.js";
import { createBridgeServer } from "../../tools/demo-bridge/serve.js";
import { data, fakeSample, FOUR, HAKU, OPEN, scenario, training } from "./fixtures.js";
import { TRAINING_NAMES, TRAINING_QUESTIONS } from "../retrieval/training-fixture.js";

const TRAINING_HAKU = { ...HAKU, view: 0, virtualTimeS: TRAINING_NOW_S, corpus: "training", queryId: "trn.1" } as const;
const clock = { nowMs: () => 0, nowIso: () => "" };

async function serve(tool: "haku" | "open_thinker", body: unknown) {
  const { sample, calls } = fakeSample(() => FOUR);
  const result = await createBridgeServer(sample, data, clock).serve(tool, body);
  return { status: result.status, body: result.body as Record<string, unknown> & { retrieved?: { id: string }[] }, calls };
}

/** The session's own record texts, long enough to be their own (the model input must carry none of them in a training answer). */
const sessionTexts = scenario.atoms.map((a) => recordText(toRenderable(a).record)).filter((t) => t.length >= 30).map((t) => t.slice(0, 30));

describe("the bridge's training Haku (revision (bp))", () => {
  for (const lang of ["fi", "en"] as const) {
    it(`${lang}: every training question is answered over the training's records only, lexically, marked with the bridge's id`, async () => {
      for (const question of TRAINING_QUESTIONS[lang]) {
        const r = await serve("haku", { ...TRAINING_HAKU, language: lang, question });
        expect(r.status, question).toBe(200);
        expect(r.body).toMatchObject({ modelId: DEMO_BRIDGE_MODEL_ID, retrievalMode: "lexical_only", fallback: false });
        expect(r.body.retrieved!.every((x) => x.id.startsWith("trn.")), question).toBe(true);
        const input = String(r.calls[0]!.input);
        for (const t of sessionTexts) expect(input.includes(t), `${question}: "${t}"`).toBe(false);
      }
    });
  }

  it("a session question asked as a training request gets no session record; the training's own records reach the model", async () => {
    for (const question of ["Haukilampi", "EK11", "20 kV", "Mikä on viimeisin sääennuste?", "Mitä DR1 ilmoitti klo 12.05?"]) {
      const r = await serve("haku", { ...TRAINING_HAKU, question });
      expect(r.status).toBe(200);
      expect(r.body.retrieved!.every((x) => x.id.startsWith("trn.")), question).toBe(true);
    }
    const r = await serve("haku", { ...TRAINING_HAKU, question: "Mitä DR8 ilmoitti klo 10.05?" });
    const dr8 = training.atoms.find((a) => a.provenance.sourceId === "DR8" && /10[.:]05/.test(recordText(toRenderable(a).record)))!;
    expect(String(r.calls[0]!.input)).toContain(recordText(toRenderable(dr8).record));
  });

  it("a session request never gets a training record, whatever it asks (the training's names and questions included)", async () => {
    for (const question of [...TRAINING_QUESTIONS.fi, ...TRAINING_NAMES]) {
      for (const [view, virtualTimeS] of [[0, scenario.practice.cycle.startsAtVirtual], [9, HAKU.virtualTimeS]] as const) {
        const r = await serve("haku", { ...HAKU, view, virtualTimeS, question });
        expect(r.status).toBe(200);
        expect(r.body.retrieved!.some((x) => x.id.startsWith("trn.")), `${question} V${view}`).toBe(false);
      }
    }
  });

  it("refuses as the proxy does: a training request with another view, on the Open Thinker, or an unknown corpus (400), without a model call", async () => {
    for (const [tool, body] of [["haku", { ...TRAINING_HAKU, view: 3 }], ["open_thinker", { ...OPEN, view: 0, corpus: "training" }], ["haku", { ...HAKU, corpus: "main" }]] as const) {
      const r = await serve(tool, body);
      expect(r.status).toBe(400);
      expect(r.calls).toHaveLength(0);
    }
  });

  it("refuses a data file without the training corpus (the version-1 file)", () => {
    const { training: _t, ...v1 } = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    expect(() => parseBridgeData({ ...v1, version: 1 })).toThrow(/not this bridge's data file/);
    expect(() => parseBridgeData({ ...v1 })).toThrow(/lacks the training corpus/);
    expect(parseBridgeData(JSON.parse(JSON.stringify(data))).training.atoms.length).toBe(training.atoms.length);
  });
});
