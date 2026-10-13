/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M5: "`test/retrieval/closure.spec`
 * asserts the retrieval return type admits only corpus atoms and that no
 * code path constructs a novel string."
 */

import { describe, expect, it } from "vitest";
import {
  assertClosedOverCorpus,
  RetrievalClosureViolationError,
  retrieveClosed,
  type RetrievalFunction,
} from "../../app/retrieval/closure.js";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";

describe("RetrievalFunction — the static half: the type signature cannot admit a string", () => {
  // Type-level check, not a runtime assertion: `retrieveClosed` satisfies
  // `RetrievalFunction`, whose return type is `readonly InfoAtom[]`. If a
  // future edit changed it to return `string[]` or `{ text: string }[]`,
  // this assignment would fail to compile — caught by `npm run typecheck`.
  const _typeProof: RetrievalFunction = retrieveClosed;
  void _typeProof;

  it("is a runtime function (the type proof above is what actually matters here)", () => {
    expect(typeof retrieveClosed).toBe("function");
  });
});

describe("assertClosedOverCorpus — the runtime half: every result is a real corpus reference", () => {
  const scenario = buildValidScenario();

  it("passes for retrieveClosed's real output against the real corpus", () => {
    const results = retrieveClosed("EK12", scenario.atoms);
    expect(() => assertClosedOverCorpus(results, scenario.atoms)).not.toThrow();
  });

  it("passes trivially for an empty result set", () => {
    expect(() => assertClosedOverCorpus([], scenario.atoms)).not.toThrow();
  });

  it("negative control: a cloned atom (same content, different object identity) fails the check — this is what I6 is actually guarding against", () => {
    const original = scenario.atoms[0]!;
    const clone = { ...original }; // structurally identical, but NOT the same reference — exactly what a "novel construction" bug would produce
    expect(() => assertClosedOverCorpus([clone], scenario.atoms)).toThrow(RetrievalClosureViolationError);
  });

  it("negative control: a wholly synthesised atom-shaped object fails the check", () => {
    const fake = { ...scenario.atoms[0]!, id: "atom.generated.not-real", record: { kind: "situation_log" as const, entryId: "fake", authorUnitId: "GPT", text: "a generated sentence no one authored" } };
    expect(() => assertClosedOverCorpus([fake], scenario.atoms)).toThrow(/atom\.generated\.not-real/);
  });
});

describe("retrieveClosed — real, closed, deterministic ranking", () => {
  const scenario = buildValidScenario();

  it("every result is a genuine reference into the corpus array", () => {
    const results = retrieveClosed("pohjoisreuna", scenario.atoms);
    expect(results.length).toBeGreaterThan(0);
    for (const atom of results) {
      expect(scenario.atoms.includes(atom)).toBe(true); // reference equality, not deep equality
    }
  });

  it("returns nothing generated: a query with no corpus overlap returns an empty array, never a fabricated fallback string", () => {
    const results = retrieveClosed("täysin tuntematon hakusana joka ei osu mihinkään", scenario.atoms);
    expect(results).toEqual([]);
  });

  it("is deterministic: identical query and corpus produce identical ranked output", () => {
    const a = retrieveClosed("EK12 pohjoisreuna", scenario.atoms);
    const b = retrieveClosed("EK12 pohjoisreuna", scenario.atoms);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("ties are broken by atom id, not insertion order (I1)", () => {
    // Two atoms both matching equally on a shared token; the ranked order must be id-sorted among ties.
    const results = retrieveClosed("placeholder", scenario.atoms);
    const tiedIds = results.filter((a) => a.retrievalKeys.includes("placeholder")).map((a) => a.id);
    const sorted = [...tiedIds].sort();
    expect(tiedIds).toEqual(sorted);
  });

  it("case-insensitive and punctuation-tolerant matching", () => {
    const lower = retrieveClosed("pohjoisreuna", scenario.atoms).map((a) => a.id);
    const upperWithPunctuation = retrieveClosed("POHJOISREUNA?", scenario.atoms).map((a) => a.id);
    expect(upperWithPunctuation).toEqual(lower);
  });

  it("ranks records with the query's word whole above stem matches, and keeps a compound's longer stem (fix pass 3)", () => {
    const demo = buildDemoScenario().atoms;
    const words = (a: { retrievalKeys: readonly string[] }) => a.retrievalKeys.join(" ").toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""));
    const r = retrieveClosed("pohjoisreuna", demo);
    for (const a of r) expect(words(a).some((w) => w.startsWith("pohjoisr"))).toBe(true); // not every "pohjoi-" word
    const whole = r.map((a) => words(a).includes("pohjoisreuna"));
    expect(whole.indexOf(false)).toBeGreaterThan(0);
    expect(whole.slice(whole.indexOf(false))).not.toContain(true); // every whole-word record comes first
  });

  it("Finnish words meet by the prefix stem; codes stay whole (researcher decision, 7 Oct 2026)", () => {
    // "pohjoisreunalla" and "pohjoisreuna" share the stem "pohjo".
    expect(retrieveClosed("pohjoisreunalla", scenario.atoms).map((a) => a.id)).toEqual(retrieveClosed("pohjoisreuna", scenario.atoms).map((a) => a.id));
    const demo = buildDemoScenario().atoms;
    const ek1 = retrieveClosed("EK11", demo); // a code is matched whole, never by a prefix
    expect(ek1.length).toBeGreaterThan(0);
    for (const atom of ek1) expect(atom.retrievalKeys.join(" ").toLowerCase()).toMatch(/(^|[^\p{L}\p{N}])ek11($|[^\p{L}\p{N}])/u);
  });
});
