/**
 * SPEC/30 §5.5, `31` F17: the nine source-memory facts (`app/scenario/source-memory.ts`) — seven true (each rests on records that exist
 * and state it) and two false lures (no record states them); from phase A, a mix of what an AI answer would likely state (recorded only,
 * never pushed), a pushed control, what only the records or the map give; detectable in an AI answer by their keyStatements in both
 * languages; and never stated by a probe (freeze, SPAM, hinge check), so a participant cannot have learnt one from a question.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SOURCE_ANSWER_CLASS, SOURCE_MEMORY_FACTS, isLure, lureEndorsed, sourceItemId } from "../../app/scenario/source-memory.js";
import { SPAM_ITEMS, SPAM_SECOND_ITEMS } from "../../app/scenario/demo-probes.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { statesFact } from "../../app/telemetry/source-memory-measures.js";

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id);
const lastStep = (view: number) => MAIN_VIEWS.find((v) => v.index === view)!.steps.at(-1)!;
const trueFacts = SOURCE_MEMORY_FACTS.filter((f) => !isLure(f));
const lures = SOURCE_MEMORY_FACTS.filter(isLure);
const fiText = (id: string) => recordText(toRenderable(atom(id)!).record);
const pushedIds = new Set(scenario.cycles.flatMap((c) => c.pushedAtomIds));

describe("the source-memory facts (SPEC/30 §5.5, `31` F17)", () => {
  it("are nine (seven true, two lures), with unique ids and item ids, from phase A (V1–V7), each with both statements; records for the true ones only", () => {
    expect(SOURCE_MEMORY_FACTS).toHaveLength(9);
    expect(trueFacts).toHaveLength(7);
    expect(lures).toHaveLength(2);
    expect(new Set(SOURCE_MEMORY_FACTS.map((f) => f.id)).size).toBe(9);
    expect(new Set(SOURCE_MEMORY_FACTS.map((f) => sourceItemId(f.id))).size).toBe(9);
    for (const f of SOURCE_MEMORY_FACTS) {
      expect(f.view, f.id).toBeGreaterThanOrEqual(1);
      expect(f.view, f.id).toBeLessThanOrEqual(7);
      expect(f.statementFi.length, f.id).toBeGreaterThan(20);
      expect(f.statementEn.length, f.id).toBeGreaterThan(20);
      if (isLure(f)) expect(f.atomIds, f.id).toEqual([]);
      else expect(f.atomIds.length, f.id).toBeGreaterThan(0);
    }
  });

  it("mix what an AI answer would likely state with a pushed control, what only the records or the map give, and two lures", () => {
    const kinds = SOURCE_MEMORY_FACTS.map((f) => f.expected);
    expect(kinds.filter((k) => k === "ai_likely").length).toBeGreaterThanOrEqual(2);
    // Difficulty audit (23 Oct 2026) §7 item 1: `pp2_560`, `ek15_arrival` and `ek14_fuel` were `record_only`, but their records are all
    // pushed; they are `pushed` now (four pushed facts, none record-only).
    expect(kinds.filter((k) => k === "record_only")).toHaveLength(0);
    expect(kinds.filter((k) => k === "map").length).toBeGreaterThanOrEqual(1);
    expect(SOURCE_MEMORY_FACTS.filter((f) => f.expected === "pushed").map((f) => f.id)).toEqual(["head_rate_1420", "pp2_560", "ek15_arrival", "ek14_fuel"]);
    expect(kinds.filter((k) => k === "lure")).toHaveLength(2);
  });

  it("difficulty audit §7: a fact's class matches its records — a `pushed` fact has a pushed record stating it, a `record_only` fact none", () => {
    for (const f of trueFacts) {
      const statedByPushed = f.atomIds.some((id) => pushedIds.has(id) && statesFact(fiText(id), f, "fi"));
      if (f.expected === "pushed") expect(statedByPushed, f.id).toBe(true);
      if (f.expected === "record_only") expect(statedByPushed, f.id).toBe(false);
    }
  });

  it("the true ones rest on records that exist, the first on hand by the fact's view and every one within phase A (pushed or recorded)", () => {
    for (const f of trueFacts) {
      for (const id of f.atomIds) {
        expect(atom(id), `${f.id}: ${id}`).toBeDefined();
        expect(Number(atom(id)!.cycle), `${f.id}: ${id}`).toBeLessThanOrEqual(lastStep(7));
      }
      expect(Math.min(...f.atomIds.map((id) => Number(atom(id)!.cycle))), f.id).toBeLessThanOrEqual(lastStep(f.view));
    }
  });

  it("are detectable: the keyStatements compile and match each fact's own statements, in Finnish and in English", () => {
    for (const f of SOURCE_MEMORY_FACTS) {
      for (const s of [...f.keyStatements.fi, ...f.keyStatements.en]) expect(() => new RegExp(s, "i"), `${f.id}: ${s}`).not.toThrow();
      expect(statesFact(f.statementFi, f, "fi"), `${f.id} fi statement`).toBe(true);
      expect(statesFact(f.statementEn, f, "en"), `${f.id} en statement`).toBe(true);
    }
  });

  it("the true ones are true: the keyStatements match at least one of the fact's records, in Finnish and in English", () => {
    for (const f of trueFacts) {
      const fi = f.atomIds.map(fiText);
      expect(fi.some((t) => statesFact(t, f, "fi")), `${f.id} fi records: ${fi.join(" | ")}`).toBe(true);
      const en = f.atomIds.map((id) => recordEn(id)).filter((t): t is string => t !== undefined);
      expect(en.length, `${f.id}: English records`).toBeGreaterThan(0);
      expect(en.some((t) => statesFact(t, f, "en")), `${f.id} en records: ${en.join(" | ")}`).toBe(true);
    }
  });

  it("`31` F17: the lures are false — no record of the session states one, in Finnish or English", () => {
    for (const f of lures) for (const a of scenario.atoms) {
      expect(statesFact(fiText(a.id), f, "fi"), `${f.id} stated by ${a.id}`).toBe(false);
      const en = recordEn(a.id);
      if (en !== undefined) expect(statesFact(en, f, "en"), `${f.id} stated by ${a.id} (en)`).toBe(false);
    }
  });

  it("`31` F17: the ai_likely facts are recorded only — no pushed record states one — and the pushed control is pushed", () => {
    const ai = SOURCE_MEMORY_FACTS.filter((f) => f.expected === "ai_likely");
    for (const f of ai) {
      for (const id of f.atomIds) expect(pushedIds.has(id), `${f.id}: ${id}`).toBe(false);
      for (const id of pushedIds) expect(statesFact(fiText(id), f, "fi"), `${f.id} stated by pushed ${id}`).toBe(false);
    }
    for (const control of SOURCE_MEMORY_FACTS.filter((f) => f.expected === "pushed")) {
      expect(control.atomIds.some((id) => pushedIds.has(id) && statesFact(fiText(id), control, "fi")), control.id).toBe(true);
    }
  });

  it("`31` F17: the overlapping sources are one class (Haku's results are records); a lure answered with any source is a false memory", () => {
    expect(SOURCE_ANSWER_CLASS).toEqual({ self: "own", records: "record", haku: "record", thinker: "ai", unknown: "unknown" });
    const lure = lures[0]!, fact = trueFacts[0]!;
    for (const a of ["self", "records", "haku", "thinker"]) expect(lureEndorsed(lure, a), a).toBe(true);
    expect(lureEndorsed(lure, "unknown")).toBe(false);
    expect(lureEndorsed(lure, null)).toBeNull();
    expect(lureEndorsed(fact, "self")).toBeNull();
  });

  it("are never stated by a probe: no freeze item, SPAM item or the hinge check states one, in either language", () => {
    const probeTexts = [
      ...[...scenario.freezes, scenario.practice.freeze].flatMap((fr) => fr.items.flatMap((it) => [it.promptFi, ...it.options.map((o) => o.labelFi)])),
      ...[...Object.values(SPAM_ITEMS), ...Object.values(SPAM_SECOND_ITEMS)].flatMap((s) => [s.prompt, ...s.options]),
      scenario.hinge.manipulationCheck!.promptFi, ...scenario.hinge.manipulationCheck!.options.map((o) => o.labelFi),
    ];
    for (const f of SOURCE_MEMORY_FACTS) for (const t of probeTexts) {
      expect(statesFact(t, f, "fi"), `${f.id} stated by "${t}"`).toBe(false);
      expect(statesFact(tr("en", t), f, "en"), `${f.id} stated by "${tr("en", t)}"`).toBe(false);
    }
  });

  it("an AI answer stating a fact in passing is detected; one naming the topic without the fact is not", () => {
    const rate = SOURCE_MEMORY_FACTS.find((f) => f.id === "head_rate_1420")!;
    expect(statesFact("DR1:n mukaan kärki eteni klo 14.00–14.20 noin 10,8 m/min koilliseen.", rate, "fi")).toBe(true);
    expect(statesFact("The head was moving at about 10.8 m/min towards the north-east.", rate, "en")).toBe(true);
    expect(statesFact("Kärki eteni noin 7,1 m/min.", rate, "fi")).toBe(false);
    const cabins = SOURCE_MEMORY_FACTS.find((f) => f.id === "cabins_nw")!;
    expect(statesFact("The Lakeside Cottages are 2.1 km north-west of the head.", cabins, "en")).toBe(true);
    expect(statesFact("Lakeside Cottages: occupancy unknown.", cabins, "en")).toBe(false);
    const injury = SOURCE_MEMORY_FACTS.find((f) => f.id === "lure_injury")!;
    expect(statesFact("EK12:n miehistössä ei loukkaantumisia.", injury, "fi")).toBe(false);
    expect(statesFact("EK12 reported no injuries.", injury, "en")).toBe(false);
  });
});
