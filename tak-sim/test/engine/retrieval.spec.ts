/**
 * SPEC/14 revision (q), `retrieval.spec`: the time gate (no record after the current virtual time),
 * determinism (the same question and time give the same ids and scores twice), and code tokens
 * (`EK11`, `L3`) found by the hybrid retrieval. Plus the tokeniser, the gate's step arithmetic and
 * the stale-index guard.
 */

import { describe, expect, it } from "vitest";
import { hybridRetrieve, passageText, StaleIndexError, THINKER_RETRIEVAL_CONFIG, tokenise, vectorIndexOf } from "../../app/retrieval/hybrid.js";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { AUTHORED_QUESTIONS, ALL_AUTHORED_QUESTIONS } from "../../tools/thinker/authored-questions.js";
import { ids, indexFile, retrieveAt, scenario, stepAtViewStart } from "./thinker-fixtures.js";

describe("the time gate (SPEC/14 revision (q) step 1)", () => {
  it("maps a view and a virtual time to the step reached, and rejects times outside the view", () => {
    const v6 = scenario.cycles.find((c) => c.index === 6)!; // steps 8–9
    expect(stepAtVirtualTime(v6, v6.startsAtVirtual)).toBe(8);
    expect(stepAtVirtualTime(v6, v6.startsAtVirtual + STEP_SECONDS)).toBe(9); // after the step boundary
    expect(stepAtVirtualTime(v6, v6.startsAtVirtual + 2 * STEP_SECONDS)).toBe(9); // the view's end is still its last step
    expect(stepAtVirtualTime(v6, v6.startsAtVirtual - 1)).toBeNull();
    expect(stepAtVirtualTime(v6, v6.startsAtVirtual + 2 * STEP_SECONDS + 1)).toBeNull();
    expect(stepAtVirtualTime(v6, Number.NaN)).toBeNull();
  });

  it("never returns a record from a step not yet reached, in any view, for any authored question", () => {
    for (const view of scenario.cycles.map((c) => c.index)) {
      const step = stepAtViewStart(view);
      for (const q of ALL_AUTHORED_QUESTIONS) {
        for (const r of retrieveAt(view, q)) expect(r.atom.cycle, `${r.atom.id} in V${view} for "${q}"`).toBeLessThanOrEqual(step);
      }
    }
  }, 15_000); // every view × every authored question: ~5 s on a loaded machine, past the default 5 s

  it("is Haku's rule: the candidates are exactly the atoms of every step reached", () => {
    const step = stepAtViewStart(7);
    expect(reachableAtoms(scenario.atoms, step)).toEqual(scenario.atoms.filter((a) => a.cycle <= step));
  });
});

describe("determinism (I1 for retrieval)", () => {
  it("gives the same ids and scores for the same question and time on two runs", () => {
    for (const q of ALL_AUTHORED_QUESTIONS) {
      const a = retrieveAt(7, q).map((r) => [r.atom.id, r.score]);
      const b = retrieveAt(7, q).map((r) => [r.atom.id, r.score]);
      expect(b).toEqual(a);
    }
  });

  it("returns at most top-k, sorted by score, ties newer first", () => {
    for (const q of ALL_AUTHORED_QUESTIONS) {
      const r = retrieveAt(12, q);
      expect(r.length).toBeLessThanOrEqual(THINKER_RETRIEVAL_CONFIG.topK);
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.score).toBeLessThanOrEqual(r[i - 1]!.score);
        if (r[i]!.score === r[i - 1]!.score) expect(r[i]!.atom.provenance.observedAt).toBeLessThanOrEqual(r[i - 1]!.atom.provenance.observedAt);
      }
    }
  });
});

describe("code tokens (SPEC/14 revision (q): EK11, L3, TOIMINTA-2)", () => {
  it("keeps codes whole, drops a case ending after a colon, and prefix-stems words", () => {
    expect(tokenise("TOIMINTA-2: KY21:n L1:lle, 20 kV sähkölinjan")).toEqual(["toiminta-2", "ky21", "l1", "20", "kv", "sähkö"]); // SPEC/33 (bc): the line is 20 kV
  });

  it("finds EK11's records for 'EK11' and L3's records for 'L3' (per-source cap lifted)", () => {
    const uncapped = { ...THINKER_RETRIEVAL_CONFIG, maxPerSource: null };
    const ek11 = retrieveAt(12, AUTHORED_QUESTIONS.codes[0], uncapped);
    expect(ek11).toHaveLength(THINKER_RETRIEVAL_CONFIG.topK);
    for (const r of ek11) expect(passageText(r.atom)).toMatch(/EK11/);
    const l3 = retrieveAt(12, AUTHORED_QUESTIONS.codes[1], uncapped);
    expect(l3).toHaveLength(THINKER_RETRIEVAL_CONFIG.topK);
    for (const r of l3) expect(passageText(r.atom)).toMatch(/\bL3\b/);
  });

  it("runs the lexical half alone when no query vector exists (the browser's local fallback)", () => {
    const r = hybridRetrieve("EK11", reachableAtoms(scenario.atoms, 16), null);
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(passageText(x.atom)).toMatch(/EK11/);
    expect(ids(hybridRetrieve("EK11", reachableAtoms(scenario.atoms, 16), null))).toEqual(ids(r));
  });
});

describe("the frozen index", () => {
  it("has one vector per atom, from one embedder", () => {
    expect(indexFile.atoms).toHaveLength(scenario.atoms.length);
    expect(new Set(indexFile.atoms.map((a) => a.id))).toEqual(new Set(scenario.atoms.map((a) => a.id)));
    for (const a of indexFile.atoms) expect(a.v).toHaveLength(indexFile.dim);
  });

  it("refuses a record whose text changed since the build", () => {
    const atom = scenario.atoms[0]!;
    const stale = vectorIndexOf({ ...indexFile, atoms: indexFile.atoms.map((a) => (a.id === atom.id ? { ...a, textHash: "0" } : a)) });
    expect(() => stale.vectorOf(atom)).toThrow(StaleIndexError);
  });
});
