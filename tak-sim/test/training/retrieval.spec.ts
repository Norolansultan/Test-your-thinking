/**
 * The pre-recorded questions rank their records first (SPEC/08 (bp) §bp.6): lexical `hybridRetrieve` without a vector over the
 * training's corpus at its step (−9), in both languages, as Haku answers the training everywhere (`14` (bp)). "Is road R6 passable?"
 * ranks the older record (`trn.r02`) first and the newer report (`trn.r09`) second; the limitation question retrieves nothing that
 * answers it. Only `trn.` records are ever retrieved, also for the scenario's names. A rewording that moves a record fails here.
 */

import { describe, expect, it } from "vitest";
import { hybridRetrieve } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { TRAINING_ATOMS, TRAINING_QUESTIONS, TRAINING_STEP } from "../../app/session/training/corpus.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { recordIn } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";

const gated = reachableAtoms(TRAINING_ATOMS, TRAINING_STEP);
const ask = (q: string, lang: "fi" | "en") => hybridRetrieve(q, gated, null, undefined, lang);

describe("the training's Haku retrieval (lexical, step −9)", () => {
  it("all twelve records are reachable at the training's step", () => {
    expect(gated).toHaveLength(12);
  });

  for (const lang of ["fi", "en"] as const) {
    it(`${lang}: each pre-recorded question ranks its record(s) first, in order`, () => {
      for (const [id, q] of Object.entries(TRAINING_QUESTIONS)) {
        if (q.recordIds.length === 0) continue;
        const got = ask(q[lang], lang).map((r) => r.atom.id);
        expect(got.slice(0, q.recordIds.length), `${id}: ${q[lang]}`).toEqual(q.recordIds);
      }
      expect(ask(TRAINING_QUESTIONS["trn.q.r6_passable"]![lang], lang).slice(0, 2).map((r) => r.atom.id)).toEqual(["trn.r02", "trn.r09"]);
    });

    it(`${lang}: the lessons' and S5's questions are the ones the items name`, () => {
      for (const it of TRAINING.items) if (it.lesson) {
        const q = TRAINING_QUESTIONS[it.lesson.questionId]!;
        expect(ask(q[lang], lang).slice(0, it.lesson.recordIds.length).map((r) => r.atom.id), it.id).toEqual([...it.lesson.recordIds]);
      }
    });

    it(`${lang}: "is the fire contained?" (S5's limitation question) retrieves no record that answers it`, () => {
      const got = ask(TRAINING_QUESTIONS["trn.q.contained"]![lang], lang);
      if (lang === "fi") expect(got).toEqual([]);
      for (const r of got) expect(recordIn(lang, r.atom.id, recordText(r.atom.record))).not.toMatch(/hallin|rajat|rajaa|under control|contained|sammut|extinguish/i);
    });

    it(`${lang}: only trn. records come back, also for the scenario's names and subjects`, () => {
      for (const q of ["Haukilampi", "Pike Pond", "EK11", "20 kV", "rekindle", "R1", "Kaitajärvi", "EK51", "DR8"]) for (const r of ask(q, lang)) expect(r.atom.id.startsWith("trn."), q).toBe(true);
      expect(ask("Haukilampi", lang)).toEqual([]);
      expect(ask("EK11", lang)).toEqual([]);
    });
  }
});
