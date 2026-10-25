/**
 * SPEC/14 revision (bo), 25 Oct 2026 (the independent review's B2): the questions the instrument teaches or fixes, and the natural
 * "what did unit X report" forms, against the H9 and H10 records. H9 exposure counts any retrieval at rank ≤ 8 (SPEC/09 (bh) §3), in
 * both groups (Haku and the Thinker share the retrieval), so a taught question that pulls an H9 or H10 record raises exposure for
 * everyone who follows the teaching. Lexical, as the play harness runs Haku (the vector half needs the embedding model, which this
 * environment does not have; a hybrid re-check belongs to the next index rebuild).
 *
 * 1. **Taught and fixed questions**, in both languages, read from where the instrument shows them, so a re-worded text is checked:
 *    the tour's records step (`hakuRecords`, every quoted example), the practice lesson's example question, the Haku chip and the
 *    guide's chip, the consult notice's text, the Thinker practice's example, and the converted items' questions (`SEEK_QUESTIONS`).
 *    None returns an H9 record (`f7.planted_record`, `f7.grid_record`, `f7.grid_at_line`, `f7.heli_line_clearance`) or an H10 record
 *    (`rekindle.objection`, `t4.private_doubt`) in the top 8 while its exposure counts: H9 through V12 (its freeze), H10 through V8 (V7's
 *    freeze and V7–V8's anticipation window), SPEC/09 (bh) §3. A question taught for the whole session is checked at every step it can
 *    be asked; an item's question at the item's moment.
 * 2. **Natural forms** per seek-dependent item with a recorded key ("Mitä EK12 ilmoitti?", "What has EK12 reported?" …): the key
 *    record in the top 3 (one documented exception, below) and no H9 or H10 record in the top 8, at the item's moment.
 * 3. The finding itself, reproduced on revision (bn)'s retrieval (`withoutBo`), so the guard is known to bite.
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { hybridRetrieve, retrievalConfigOf, type HybridConfig } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { PRACTICE_THINKER_EXAMPLE_EN, PRACTICE_THINKER_EXAMPLE_FI } from "../../app/scenario/briefing.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { DESIGNED_EVENT_IDS, LOAD_BEARING_T4_IDS } from "../../app/scenario/types.js";
import { PRACTICE_STEP, STEP_SECONDS } from "../../app/scenario/views.js";
import { HAKU_SUGGESTED_QUESTION, SUGGESTED_QUESTION } from "../../app/session/consult-notice.js";
import { practiceFeedbackView } from "../../app/session/practice-feedback.js";
import { auditItems } from "../../tools/review/difficulty-audit.js";
import { SEEK_QUESTIONS } from "../../tools/review/seek-questions.js";
import { withoutBo } from "../../tools/thinker/playtest-cases.js";

type Lang = "fi" | "en";

const scenario = buildDemoScenario();
const LANGS = ["fi", "en"] as const;
const H9 = [DESIGNED_EVENT_IDS.planted, DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.gridAtLine, DESIGNED_EVENT_IDS.heliLineClearance];
const H10 = [DESIGNED_EVENT_IDS.objection, LOAD_BEARING_T4_IDS[1]];
const TOP = retrievalConfigOf("fi").topK;

const firstStepOf = (view: number) => scenario.cycles.find((c) => c.index === view)!.startsAtVirtual / STEP_SECONDS + 1;
const lastStepOf = (view: number) => firstStepOf(view) + scenario.cycles.find((c) => c.index === view)!.steps - 1;
/** SPEC/09 (bh) §3: H9 exposure counts before V12's freeze, H10 before V7's freeze and in V7–V8's anticipation window. */
const H9_LAST_STEP = lastStepOf(12);
const H10_LAST_STEP = lastStepOf(8);
/** Every step a participant can ask at: the practice view's, then every main view's. */
const SESSION_STEPS = [PRACTICE_STEP, ...scenario.cycles.filter((c) => c.index >= 1).flatMap((c) => Array.from({ length: c.steps }, (_, i) => firstStepOf(c.index) + i))];
/** The chips are offered from V8 (`hakuChipOffered`, `suggestedQuestionOffered`); the consult notice in V1–V14. */
const CHIP_STEPS = SESSION_STEPS.filter((s) => s >= firstStepOf(8));
const MAIN_STEPS = SESSION_STEPS.filter((s) => s >= 1);

/** The H9 and H10 records in the top 8 whose exposure counts at `step`. */
function exposed(question: string, step: number, lang: Lang, config: HybridConfig = retrievalConfigOf(lang)): string[] {
  const top = hybridRetrieve(question, reachableAtoms(scenario.atoms, step), null, config, lang).map((r) => r.atom.id);
  const designed: readonly string[] = [...(step <= H9_LAST_STEP ? H9 : []), ...(step <= H10_LAST_STEP ? H10 : [])];
  return top.flatMap((id, i) => (designed.includes(id) ? [`${id} at rank ${i + 1}, step ${step}`] : []));
}

function rankOf(question: string, step: number, lang: Lang, records: readonly string[]): number | null {
  const ids = hybridRetrieve(question, reachableAtoms(scenario.atoms, step), null, { ...retrievalConfigOf(lang), topK: Number.MAX_SAFE_INTEGER }, lang).map((r) => r.atom.id);
  const ranks = records.map((id) => ids.indexOf(id)).filter((k) => k >= 0);
  return ranks.length ? Math.min(...ranks) + 1 : null;
}

/** The examples the tour's records step quotes („…” in Finnish, “…” in English). */
const tourExamples = (lang: Lang) => [...UI_TEXT[lang].tour.steps.hakuRecords.body.matchAll(/[„“]([^”]+)”/gu)].map((m) => m[1]!.trim());
const practiceExamples = (lang: Lang) => practiceFeedbackView(scenario, null).items.flatMap((it) => (it.exampleQuestion ? [it.exampleQuestion[lang]] : []));

/** The step the time gate has reached at an item's moment (a merged view's second step after its boundary), as the audit computes it. */
const audit = auditItems();
function momentStep(itemId: string): number {
  const a = audit.find((i) => i.id === itemId)!;
  const spec = scenario.cycles.find((c) => c.index === a.view)!;
  return firstStepOf(a.view) + (spec.steps === 2 && a.momentS >= spec.minViewSeconds / 2 ? 1 : 0);
}

interface Taught {
  readonly name: string;
  readonly questions: (lang: Lang) => readonly string[];
  readonly steps: readonly number[];
}

const TAUGHT: readonly Taught[] = [
  { name: "the tour's records-step examples", questions: tourExamples, steps: SESSION_STEPS },
  { name: "the practice lesson's example question", questions: practiceExamples, steps: SESSION_STEPS },
  { name: "the Haku chip", questions: (lang) => [HAKU_SUGGESTED_QUESTION[lang]], steps: CHIP_STEPS },
  { name: "the guide's chip", questions: (lang) => [SUGGESTED_QUESTION[lang]], steps: CHIP_STEPS },
  { name: "the consult notice's text", questions: (lang) => [UI_TEXT[lang].consult.notice], steps: MAIN_STEPS },
  { name: "the Thinker practice's example", questions: (lang) => [lang === "fi" ? PRACTICE_THINKER_EXAMPLE_FI : PRACTICE_THINKER_EXAMPLE_EN], steps: [PRACTICE_STEP] },
];

describe("revision (bo): taught and fixed questions return no H9 or H10 record in the top 8 while its exposure counts", () => {
  it("reads the taught questions from the instrument: three tour examples and one practice example per language", () => {
    for (const lang of LANGS) {
      expect(tourExamples(lang), lang).toHaveLength(3);
      expect(practiceExamples(lang).length, lang).toBeGreaterThanOrEqual(1);
    }
    expect(H9_LAST_STEP).toBe(17);
    expect(H10_LAST_STEP).toBe(11);
  });

  for (const t of TAUGHT) {
    for (const lang of LANGS) {
      it(`${t.name} (${lang})`, () => {
        for (const q of t.questions(lang)) for (const step of t.steps) expect(exposed(q, step, lang), `"${q}"`).toEqual([]);
      });
    }
  }

  for (const s of SEEK_QUESTIONS) {
    for (const lang of LANGS) {
      it(`${s.itemId}'s questions (${lang}), at the item's moment`, () => {
        const step = momentStep(s.itemId);
        for (const q of s[lang]) expect(exposed(q, step, lang), `"${q}" (step ${step})`).toEqual([]);
      });
    }
  }
});

/**
 * The natural forms the play-test commanders used (`docs/audits/2026-10-23-playtest/haku.csv`, `haku-replay.csv`). `top` is the rank
 * the key must reach. LIMIT (reported to the integrator): "Mitä EK12 ilmoitti?" at V2's moment (step 3) ranks EK12's records newest
 * first, as the rule says, and four EK12 records are newer than its 14.08 report (`evt.c03.021`): three lateral lines to EK11 and EK14
 * (14.09, 14.13, 14.16) and the 14.08 vehicle-location line. The key is 5th: in the top 8 the answer is built on, not in the top 3.
 * No ordering principle puts it in the top 3 without also dropping EK14's key (`evt.c10.028`, itself a lateral line) out of it.
 */
const NATURAL: readonly { readonly itemId: string; readonly fi: string; readonly en: string; readonly top: number }[] = [
  { itemId: "freeze.2.south_flank", fi: "Mitä EK12 ilmoitti?", en: "What has EK12 reported?", top: 5 },
  { itemId: "freeze.5.hose_short", fi: "Mitä EK11 ilmoitti?", en: "What has EK11 reported?", top: 3 },
  { itemId: "freeze.7.north_help", fi: "Mitä EK14 ilmoitti?", en: "What has EK14 reported?", top: 3 },
  { itemId: "freeze.5.reinforcements", fi: "Mitä lisäyksiköitä on hälytetty?", en: "What additional units have been alerted?", top: 3 },
];

describe("revision (bo): the natural 'what did unit X report' forms find the item's key at its moment", () => {
  for (const n of NATURAL) {
    for (const lang of LANGS) {
      it(`${n.itemId} (${lang}): "${n[lang]}" ranks a key record in the top ${n.top}, with no H9 or H10 record in the top 8`, () => {
        const step = momentStep(n.itemId);
        const records = SEEK_QUESTIONS.find((s) => s.itemId === n.itemId)!.records;
        const rank = rankOf(n[lang], step, lang, records);
        expect(rank, `step ${step}`).not.toBeNull();
        expect(rank!, `step ${step}`).toBeLessThanOrEqual(n.top);
        expect(exposed(n[lang], step, lang)).toEqual([]);
      });
    }
  }
});

describe("the finding (B2), reproduced on revision (bn)'s retrieval", () => {
  it("the tour's example and the practice question pulled the grid operator's record (H9) into the top 8; the 16.00 forecast was 7th", () => {
    expect(exposed("Mikä on viimeisin sääennuste?", 10, "fi", withoutBo(retrievalConfigOf("fi")))).toEqual([`${DESIGNED_EVENT_IDS.gridRecord} at rank 4, step 10`]);
    expect(exposed("Mikä on sääennuste?", 7, "fi", withoutBo(retrievalConfigOf("fi")))).not.toEqual([]);
    expect(exposed("Mitä lisäyksiköitä on hälytetty?", 7, "fi", withoutBo(retrievalConfigOf("fi")))).not.toEqual([]);
    const forecast = hybridRetrieve("Mikä on viimeisin sääennuste?", reachableAtoms(scenario.atoms, 10), null, withoutBo(retrievalConfigOf("fi")), "fi").map((r) => r.atom.id);
    expect(forecast.indexOf("evt.wx.04") + 1).toBe(7);
    expect(hybridRetrieve("Mikä on viimeisin sääennuste?", reachableAtoms(scenario.atoms, 10), null, undefined, "fi")[0]!.atom.id).toBe("evt.wx.04");
  });

  it("'Mitä EK11 ilmoitti?' and 'Mitä EK14 ilmoitti?' did not reach their keys in the top 8", () => {
    for (const [q, step, key] of [["Mitä EK11 ilmoitti?", 7, "evt.c07.032"], ["Mitä EK14 ilmoitti?", 10, "evt.c10.028"]] as const) {
      const top = hybridRetrieve(q, reachableAtoms(scenario.atoms, step), null, withoutBo(retrievalConfigOf("fi")), "fi").map((r) => r.atom.id);
      expect(top, q).not.toContain(key);
    }
  });
});
