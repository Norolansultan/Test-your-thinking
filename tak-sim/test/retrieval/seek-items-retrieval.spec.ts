/**
 * Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk), SPEC/09 (bk)): the H2 items converted to seek-dependent are fair to a
 * searcher. Criterion b: at least two natural questions per language (`tools/review/seek-questions.ts`) rank a key record in the
 * lexical top 3 over the records the time gate releases at the item's moment (lexical, as the play harness runs Haku; the vector half
 * needs the embedding model, which this environment does not have — as `d10-retrieval.spec.ts`). Criterion c: the option a
 * non-searcher holds from the stream is a lure, resting on a record pushed before the moment, never the key. And the key records the
 * questions find are recorded, never pushed, so the audit classes the items seek-dependent (passive "partly" or "no").
 */

import { describe, expect, it } from "vitest";
import { tr } from "../../app/i18n/text.js";
import { hybridRetrieve, retrievalConfigOf } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { auditItems } from "../../tools/review/difficulty-audit.js";
import { SEEK_QUESTIONS, SEEK_TOP_K } from "../../tools/review/seek-questions.js";

const scenario = buildDemoScenario();
const audit = auditItems();
const pushed = new Set([scenario.practice.cycle, ...scenario.cycles].flatMap((c) => c.pushedAtomIds));
const auditOf = (id: string) => audit.find((i) => i.id === id)!;
const itemOf = (id: string) => scenario.freezes.flatMap((f) => f.items).find((it) => it.id === id)!;

/** The step the time gate has reached at the item's moment (a merged view's second step after its boundary; as the audit computes it). */
function momentStep(id: string): number {
  const a = auditOf(id);
  const spec = scenario.cycles.find((c) => c.index === a.view)!;
  const first = spec.startsAtVirtual / STEP_SECONDS + 1;
  return first + (spec.steps === 2 && a.momentS >= spec.minViewSeconds / 2 ? 1 : 0);
}

/** The best rank (1-based) of `records` for `question` at `step`, or null when none is retrieved. */
function bestRank(question: string, step: number, records: readonly string[], lang: "fi" | "en"): number | null {
  const ids = hybridRetrieve(question, reachableAtoms(scenario.atoms, step), null, { ...retrievalConfigOf(lang), topK: Number.MAX_SAFE_INTEGER }, lang).map((r) => r.atom.id);
  const ranks = records.map((id) => ids.indexOf(id)).filter((k) => k >= 0);
  return ranks.length ? Math.min(...ranks) + 1 : null;
}

/**
 * Criterion c: what a non-searcher holds from the stream at the moment, and the option it makes (a lure). V2: EK12's 13.20 report
 * (flames 2–3 m, moving east); V5 hose: PP1 behind EK11, the men pulled off the line (revision (bn): the `withdrawn` lure, false at the
 * freeze: the recorded 15.35 request says the crew is back on the line); V5 reinforcements: EK11's
 * request for more units (none yet); V7: EK14 through the burned area to its new line in its terrain vehicle.
 */
const STREAM_DEFAULT: Readonly<Record<string, { readonly option: string; readonly record: string }>> = {
  "freeze.2.south_flank": { option: "flames", record: "evt.c01.004" },
  "freeze.5.hose_short": { option: "withdrawn", record: "atom.radio.7.4" }, // revision (bn): the pushed withdrawal itself, false at the freeze
  "freeze.5.reinforcements": { option: "none", record: "atom.demo.7.0" },
  "freeze.7.north_help": { option: "burned", record: "atom.radio.10.5" },
};

describe("revision (bk): the converted seek-dependent H2 items", () => {
  it("are the four converted items, each in phase A, seek-dependent by the audit, its questions' records its recorded key records", () => {
    expect(SEEK_QUESTIONS.map((q) => q.itemId)).toEqual(Object.keys(STREAM_DEFAULT));
    for (const q of SEEK_QUESTIONS) {
      const a = auditOf(q.itemId), it = itemOf(q.itemId);
      expect(a.view, q.itemId).toBeLessThanOrEqual(7);
      expect(["partly", "no"], q.itemId).toContain(a.hand.passive);
      expect(a.needsSearch, q.itemId).toBe(true);
      for (const id of q.records) {
        expect(it.keyAtomIds, q.itemId).toContain(id);
        expect(pushed.has(id), `${q.itemId}: ${id} is pushed`).toBe(false);
        expect(a.atoms.find((x) => x.id === id)?.status, `${q.itemId}: ${id}`).toBe("recorded_before");
      }
    }
  });

  for (const q of SEEK_QUESTIONS) {
    for (const lang of ["fi", "en"] as const) {
      it(`${q.itemId} (${lang}): at least two natural questions find a key record in the top ${SEEK_TOP_K} at the item's moment`, () => {
        expect(q[lang].length).toBeGreaterThanOrEqual(2);
        const step = momentStep(q.itemId);
        for (const question of q[lang]) {
          const rank = bestRank(question, step, q.records, lang);
          expect(rank, `${question} (step ${step})`).not.toBeNull();
          expect(rank!, `${question} (step ${step})`).toBeLessThanOrEqual(SEEK_TOP_K);
        }
      });
    }
  }

  it("each question names no key: none uses a word only the key option has (not the stem, not a lure)", () => {
    // Words of five letters or more, cut to five (the retrieval's prefix stem).
    const stems = (text: string) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 5).map((w) => w.slice(0, 5)));
    for (const q of SEEK_QUESTIONS) {
      const it = itemOf(q.itemId);
      for (const lang of ["fi", "en"] as const) {
        const text = (fi: string) => (lang === "fi" ? fi : tr("en", fi));
        const shared = new Set([...stems(text(it.promptFi)), ...it.options.filter((o) => !o.correct).flatMap((o) => [...stems(text(o.labelFi))])]);
        const keyOnly = [...stems(text(it.options.find((o) => o.correct)!.labelFi))].filter((w) => !shared.has(w));
        for (const question of q[lang]) {
          const asked = stems(question);
          expect(keyOnly.filter((w) => asked.has(w)), `${q.itemId}: ${question}`).toEqual([]);
        }
      }
    }
  });

  it("criterion c: the option the stream gives a non-searcher is a lure, its record pushed before the moment", () => {
    for (const [id, d] of Object.entries(STREAM_DEFAULT)) {
      const it = itemOf(id), a = auditOf(id);
      const option = it.options.find((o) => o.id === d.option);
      expect(option, id).toBeDefined();
      expect(option!.correct, id).toBe(false);
      const view = [scenario.practice.cycle, ...scenario.cycles].find((c) => c.pushedAtomIds.includes(d.record));
      expect(view, `${id}: ${d.record} is not pushed`).toBeDefined();
      expect(view!.index, id).toBeLessThanOrEqual(a.view);
      if (view!.index === a.view) {
        const at = view!.deliveryOffsetsSeconds[view!.pushedAtomIds.indexOf(d.record)]!;
        const arrives = view!.stepBoundary && at >= STEP_SECONDS ? view!.minViewSeconds / 2 : 0;
        expect(arrives, id).toBeLessThanOrEqual(a.momentS);
      }
    }
  });
});
