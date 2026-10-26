/**
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.3): the training incident's corpus and the session's are separate, both ways.
 *
 * - Static: no training id (`trn.`) is in `scenario.atoms`, in either vector index, or in any scored item's key records; no session id is
 *   in the training's corpus; the two lists are disjoint.
 * - Training side: for every training question and for a set of session questions (the taught and seek questions, "Haukilampi", "EK11",
 *   "20 kV", "rekindle", every H9 and H10 record's own words), `hybridRetrieve` over the training's corpus at its step returns only
 *   `trn.` records, in both languages.
 * - Session side: for the training's questions and names, the session's retrieval over `scenario.atoms` at every step of every view, VP
 *   included, returns no `trn.` record (the session's corpus never holds one; checked at every step all the same).
 *
 * Lexical, as the training's Haku always is and as the play harness runs the session's. The training's corpus is the built one.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hybridRetrieve, retrievalConfigOf } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { DESIGNED_EVENT_IDS, LOAD_BEARING_T4_IDS } from "../../app/scenario/types.js";
import { PRACTICE_STEP, STEP_SECONDS } from "../../app/scenario/views.js";
import { recordIn } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { HAKU_SUGGESTED_QUESTION } from "../../app/session/consult-notice.js";
import { SEEK_QUESTIONS } from "../../tools/review/seek-questions.js";
import { FIXTURE_TRAINING_ATOMS, TRAINING_FOR_TESTS, TRAINING_NAMES, TRAINING_QUESTIONS } from "./training-fixture.js";

type Lang = "fi" | "en";
const LANGS = ["fi", "en"] as const;
const scenario = buildDemoScenario();
const training = TRAINING_FOR_TESTS;
const ALL = { ...retrievalConfigOf("fi"), topK: Number.MAX_SAFE_INTEGER };
const trainingIds = new Set(training.atoms.map((a) => a.id));
const sessionIds = new Set(scenario.atoms.map((a) => a.id));

const firstStepOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual / STEP_SECONDS + 1;
/** Every step a participant can ask at: VP's, then every main view's. */
const SESSION_STEPS = [PRACTICE_STEP, ...scenario.cycles.flatMap((c) => Array.from({ length: c.steps }, (_, i) => firstStepOf(c.index) + i))];

const textOf = (id: string, lang: Lang) => { const a = scenario.atoms.find((x) => x.id === id)!; return recordIn(lang, a.id, recordText(toRenderable(a).record)); };
const H9_H10 = [DESIGNED_EVENT_IDS.planted, DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.gridAtLine, DESIGNED_EVENT_IDS.heliLineClearance, DESIGNED_EVENT_IDS.objection, LOAD_BEARING_T4_IDS[1]];

/** Session questions put to the training's corpus (none may return anything but a training record). */
const sessionQuestions = (lang: Lang): string[] => [
  "Haukilampi", "EK11", "20 kV", "rekindle", "Mikä on viimeisin sääennuste?", "What is the latest weather forecast?", "Mitä DR1 ilmoitti klo 12.05?",
  HAKU_SUGGESTED_QUESTION[lang], ...SEEK_QUESTIONS.flatMap((q) => q[lang]), ...H9_H10.map((id) => textOf(id, lang)),
];

describe("the two corpora are disjoint (static)", () => {
  it("the built corpus is the twelve records of 08 (bp) §bp.6 (the fixture): the same ids, sources, tiers and clocks", () => {
    const sig = (a: { id: string; tier: string; provenance: { sourceId: string; observedAt: number } }) => `${a.id} ${a.provenance.sourceId} ${a.tier} ${a.provenance.observedAt}`;
    expect(training.atoms.map(sig)).toEqual(FIXTURE_TRAINING_ATOMS.map(sig));
  });

  it("no training id in the session's atoms and no session id in the training's; every training id is `trn.`", () => {
    expect(training.atoms.length).toBeGreaterThanOrEqual(12);
    expect(training.atoms.every((a) => a.id.startsWith("trn."))).toBe(true);
    expect(scenario.atoms.filter((a) => a.id.startsWith("trn.") || trainingIds.has(a.id))).toEqual([]);
    expect(training.atoms.filter((a) => sessionIds.has(a.id))).toEqual([]);
  });

  it("no training id in either vector index, nor in any scored item's key records (freezes, SPAM, the practice view)", () => {
    for (const file of ["content/thinker/index.json", "content/thinker/index.en.json"]) {
      if (!existsSync(file)) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/"trn\./);
    }
    const keys = [...scenario.freezes, scenario.practice.freeze].flatMap((f) => f.items.flatMap((i) => i.keyAtomIds ?? []));
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((id) => id.startsWith("trn.") || trainingIds.has(id))).toEqual([]);
    expect(JSON.stringify(scenario.probeSchedule)).not.toMatch(/"trn\./);
  });
});

describe("training side: the training's corpus returns only training records", () => {
  const gated = reachableAtoms(training.atoms, training.step);
  it("every record is at the training's step and reachable there", () => {
    expect(gated.map((a) => a.id)).toEqual(training.atoms.map((a) => a.id));
  });

  for (const lang of LANGS) {
    it(`${lang}: the training's questions and the session's (taught, seek, names, H9 and H10 records' own words)`, () => {
      const questions = [...TRAINING_QUESTIONS[lang], ...sessionQuestions(lang)];
      expect(questions.length).toBeGreaterThan(20);
      for (const q of questions) {
        const ids = hybridRetrieve(q, gated, null, ALL, lang).map((r) => r.atom.id);
        expect(ids.filter((id) => !trainingIds.has(id)), q).toEqual([]);
      }
    });
  }

  it("the pre-recorded questions find their record first (and the older R6 report before the newer), in Finnish", () => {
    const first = (q: string) => hybridRetrieve(q, gated, null, ALL, "fi").map((r) => r.atom.id);
    expect(first("Mitä DR8 ilmoitti klo 10.05?")[0]).toBe("trn.r06");
    expect(first("Onko tie R6 ajettavissa?").slice(0, 2)).toEqual(["trn.r02", "trn.r09"]);
    expect(first("Kuinka suuri EK51:n miehistö on?")[0]).toBe("trn.r07");
    expect(first("Paljonko vettä EK52:lla on?")[0]).toBe("trn.r10");
  });
});

describe("session side: the session's corpus never returns a training record", () => {
  for (const lang of LANGS) {
    it(`${lang}: the training's questions and names, at every step of every view (VP included)`, () => {
      const questions = [...TRAINING_QUESTIONS[lang], ...TRAINING_NAMES];
      for (const step of SESSION_STEPS) {
        const atoms = reachableAtoms(scenario.atoms, step);
        for (const q of questions) {
          const ids = hybridRetrieve(q, atoms, null, ALL, lang).map((r) => r.atom.id);
          expect(ids.filter((id) => id.startsWith("trn.") || trainingIds.has(id)), `${q} at step ${step}`).toEqual([]);
        }
      }
    });
  }

  it("the training's names occur in no session record (the reason a session search finds nothing of the training)", () => {
    const texts = scenario.atoms.flatMap((a) => LANGS.map((l) => recordIn(l, a.id, recordText(toRenderable(a).record))));
    for (const name of TRAINING_NAMES) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{N}])`, "u");
      expect(texts.filter((t) => re.test(t)).slice(0, 3), name).toEqual([]);
    }
  });
});
