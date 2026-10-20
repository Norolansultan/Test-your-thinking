/**
 * SPEC/14 revision (q), `planted.spec`: the F7 atom (SPEC/02 revision (o) §5) is retrievable from
 * step 8 and ranks in top-k for the authored power-line questions; the grid operator's record is
 * reachable through Haku; no atom confirms de-energisation. Retrieval is asserted, never text.
 *
 * Actual behaviour with the declared parameters (not tuned; a finding for the pilot check, SPEC/10
 * revision (q)): F7 ranks first for "20 kV linja" and "onko 20 kV linja jännitteetön?" (110 kV before SPEC/33 (bc)) at V6, V7
 * and V12. For "sähkölinja" (was "voimajohto") the grid record ranks first — its text says "sähkölinja", F7's says
 * "linja". Before the routine-line collapse (1 Oct 2026) F7 was 8th at V6 but 9th, outside top-k,
 * at V7 and V12. With the frozen configuration (collapse, no per-source cap; chosen on the neutral
 * evaluation only, re-run on the final 926-record corpus) it was 6th at V6, 8th at V7 and outside
 * top-k at V12; after the content-consistency fixes of 1 Oct 2026 (selection re-run, collapse3
 * still selected) it is 6th at V6, 7th at V7 and 7th at V12 — now inside top-k at V12 as well
 * (not tuned; reported to the researcher).
 */

import { describe, expect, it } from "vitest";
import { retrieveClosed } from "../../app/retrieval/closure.js";
import { navigate, navigationNow } from "../../app/retrieval/navigation.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { GRID_OPERATOR_SOURCE } from "../../app/scenario/designed-events.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { recordText } from "../../app/session/template-answer.js";
import { AUTHORED_QUESTIONS } from "../../tools/thinker/authored-questions.js";
import { ids, retrieveAt, retrieveAtStep, scenario } from "./thinker-fixtures.js";

const F7 = DESIGNED_EVENT_IDS.planted;
const GRID = DESIGNED_EVENT_IDS.gridRecord;
const [LINE, POWER_LINE, NATURAL] = AUTHORED_QUESTIONS.powerLine;

describe("F7 under retrieval", () => {
  it("is not a candidate before step 8 and is from step 8 (V6)", () => {
    expect(reachableAtoms(scenario.atoms, 7).map((a) => a.id)).not.toContain(F7);
    expect(reachableAtoms(scenario.atoms, 8).map((a) => a.id)).toContain(F7);
    expect(ids(retrieveAtStep(7, LINE))).not.toContain(F7);
  });

  it.each([6, 7, 12])("ranks first for the line questions in V%i", (view) => {
    expect(ids(retrieveAt(view, LINE))[0]).toBe(F7);
    expect(ids(retrieveAt(view, NATURAL))[0]).toBe(F7);
  });

  // SPEC/33 (bc), 20 Oct 2026: the line is a 20 kV distribution line, so the word question is "sähkölinja" (was "voimajohto", whose
  // F7 ranks were 5th, 6th, 7th). Both designed records now say "sähkölinja"/"linja"; the query vector is carried from "voimajohto"
  // until `npm run thinker:index` runs with the model (PROVISIONAL, `content/thinker/manifest.json`).
  it("for 'sähkölinja' ranks in top-k at V6, V7 and V12, below the grid record (actual behaviour, documented)", () => {
    // 6 Oct 2026 generator fixes (regenerated traffic): 4th, 5th, 6th (were 6th, 7th, 7th); fix pass 2 (7 Oct 2026): 4th, 5th, 5th;
    // fix pass 3 (7 Oct 2026): 5th, 6th, 6th; the 8 Oct thermal-inertia baseline: 5th, 7th, 7th; the 8 Oct fire retune: 5th, 6th, 6th — still in top-k.
    expect(ids(retrieveAt(6, POWER_LINE)).indexOf(F7)).toBe(1); // 2nd (SPEC/33 (bc))
    expect(ids(retrieveAt(7, POWER_LINE)).indexOf(F7)).toBe(2); // 3rd
    expect(ids(retrieveAt(12, POWER_LINE)).indexOf(F7)).toBe(3); // 4th (7th for "voimajohto" since review fixes (ah), 9 Oct 2026)
    for (const view of [6, 7, 12]) expect(ids(retrieveAt(view, POWER_LINE))[0]).toBe(GRID);
  });
});

describe("the grid operator's record (step 6)", () => {
  it("is reachable through Haku: the builder and the free-text search", () => {
    const corpus = reachableAtoms(scenario.atoms, 8);
    const built = navigate({ category: "vesi_reitit", sourceId: GRID_OPERATOR_SOURCE, window: "whole_incident" }, corpus, navigationNow(8));
    expect(built.map((a) => a.id)).toContain(GRID);
    expect(retrieveClosed(LINE, corpus).map((a) => a.id)).toContain(GRID);
  });
});

describe("no atom confirms de-energisation", () => {
  it("only the planted F7 record says the line is dead", () => {
    const deEnergised = /jännitteetö|jännitteettö|poiskytketty|kytketty pois|virraton|virrattom/i;
    const confirming = scenario.atoms.filter((a) => deEnergised.test(recordText(a.record))).map((a) => a.id);
    expect(confirming).toEqual([F7]);
  });
});
