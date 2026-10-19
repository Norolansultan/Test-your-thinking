/**
 * SPEC/30 §5.5: the seven source-memory facts (`app/scenario/source-memory.ts`) — true (each rests on records that exist and state it),
 * from phase A, a mix of what an AI answer would likely state and what only the records or the map give; detectable in an AI answer by
 * their keyStatements in both languages; and never stated by a probe (freeze, SPAM, hinge check), so a participant cannot have learnt
 * one from a question.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SOURCE_MEMORY_FACTS, sourceItemId } from "../../app/scenario/source-memory.js";
import { SPAM_ITEMS, SPAM_SECOND_ITEMS } from "../../app/scenario/demo-probes.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { statesFact } from "../../app/telemetry/source-memory-measures.js";

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id);
const lastStep = (view: number) => MAIN_VIEWS.find((v) => v.index === view)!.steps.at(-1)!;

describe("the source-memory facts (SPEC/30 §5.5)", () => {
  it("are seven, with unique ids and item ids, from phase A (V1–V7), each with both statements and DRAFT-reviewable records", () => {
    expect(SOURCE_MEMORY_FACTS).toHaveLength(7);
    expect(new Set(SOURCE_MEMORY_FACTS.map((f) => f.id)).size).toBe(7);
    expect(new Set(SOURCE_MEMORY_FACTS.map((f) => sourceItemId(f.id))).size).toBe(7);
    for (const f of SOURCE_MEMORY_FACTS) {
      expect(f.view, f.id).toBeGreaterThanOrEqual(1);
      expect(f.view, f.id).toBeLessThanOrEqual(7);
      expect(f.statementFi.length, f.id).toBeGreaterThan(20);
      expect(f.statementEn.length, f.id).toBeGreaterThan(20);
      expect(f.atomIds.length, f.id).toBeGreaterThan(0);
    }
  });

  it("mix what an AI answer would likely state with what only the records or the map give", () => {
    const kinds = SOURCE_MEMORY_FACTS.map((f) => f.expected);
    expect(kinds.filter((k) => k === "ai_likely").length).toBeGreaterThanOrEqual(2);
    expect(kinds.filter((k) => k === "record_only").length).toBeGreaterThanOrEqual(2);
    expect(kinds.filter((k) => k === "map").length).toBeGreaterThanOrEqual(1);
  });

  it("rest on records that exist, the first on hand by the fact's view and every one within phase A (pushed or recorded)", () => {
    for (const f of SOURCE_MEMORY_FACTS) {
      for (const id of f.atomIds) {
        expect(atom(id), `${f.id}: ${id}`).toBeDefined();
        expect(Number(atom(id)!.cycle), `${f.id}: ${id}`).toBeLessThanOrEqual(lastStep(7));
      }
      expect(Math.min(...f.atomIds.map((id) => Number(atom(id)!.cycle))), f.id).toBeLessThanOrEqual(lastStep(f.view));
    }
  });

  it("are true: the keyStatements match each fact's own statements and at least one of its records, in Finnish and in English", () => {
    for (const f of SOURCE_MEMORY_FACTS) {
      for (const s of [...f.keyStatements.fi, ...f.keyStatements.en]) expect(() => new RegExp(s, "i"), `${f.id}: ${s}`).not.toThrow();
      expect(statesFact(f.statementFi, f, "fi"), `${f.id} fi statement`).toBe(true);
      expect(statesFact(f.statementEn, f, "en"), `${f.id} en statement`).toBe(true);
      const fi = f.atomIds.map((id) => recordText(toRenderable(atom(id)!).record));
      expect(fi.some((t) => statesFact(t, f, "fi")), `${f.id} fi records: ${fi.join(" | ")}`).toBe(true);
      const en = f.atomIds.map((id) => recordEn(id)).filter((t): t is string => t !== undefined);
      expect(en.length, `${f.id}: English records`).toBeGreaterThan(0);
      expect(en.some((t) => statesFact(t, f, "en")), `${f.id} en records: ${en.join(" | ")}`).toBe(true);
    }
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
    expect(statesFact("DR1:n mukaan kärki eteni klo 14.00–14.20 noin 10,6 m/min koilliseen.", rate, "fi")).toBe(true);
    expect(statesFact("The head was moving at about 10.6 m/min towards the north-east.", rate, "en")).toBe(true);
    expect(statesFact("Kärki eteni noin 7,1 m/min.", rate, "fi")).toBe(false);
    const cabins = SOURCE_MEMORY_FACTS.find((f) => f.id === "cabins_nw")!;
    expect(statesFact("The Lakeside Cottages are 2.1 km north-west of the head.", cabins, "en")).toBe(true);
    expect(statesFact("Lakeside Cottages: occupancy unknown.", cabins, "en")).toBe(false);
  });
});
