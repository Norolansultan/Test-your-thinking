/**
 * SPEC/25 — the structured KUKA × MITÄ × MILLOIN query builder.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime, type CycleIndex } from "../../app/engine/primitives.js";
import { assertClosedOverCorpus } from "../../app/retrieval/closure.js";
import {
  checkNavigationCoverage,
  NAV_CATEGORIES,
  NAV_MIN_DECOYS_PER_LOAD_BEARING,
  navigate,
  navigationNow,
  navigationSources,
} from "../../app/retrieval/navigation.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { InfoAtom, NavCategoryId } from "../../app/scenario/types.js";

function atom(id: string, category: NavCategoryId, source: string, observedAt: number, opts: { loadBearing?: boolean; reference?: boolean } = {}): InfoAtom {
  const cycle = Math.min(20, Math.floor(observedAt / 1200) + 1) as CycleIndex;
  return {
    id, tier: "T2_system", origin: "below", cycle, loadBearing: opts.loadBearing ?? false, navCategory: category,
    routes: { directed: { kind: "browse", surface: "situation_log" }, assistive: null, substitutive: null },
    record: opts.reference
      ? { kind: "reference", surface: "reference_road", featureId: id, fields: {}, registerUpdatedAt: "2024-09-01" }
      : { kind: "situation_log", entryId: id, authorUnitId: source, text: id },
    provenance: { sourceId: source, sourceClassId: "sc", sourceReliability: "known-good", observedAt: asVirtualTime(observedAt), recordedAt: asVirtualTime(observedAt), deliveredAt: null, certainty: { kind: "confirmed" }, supports: [], contradicts: [] },
    degradation: [], retrievalKeys: [], truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
  };
}

const corpus: readonly InfoAtom[] = [
  atom("a", "palo", "EK11", 100),
  atom("b", "palo", "EK11", 900),
  atom("c", "palo", "EK12", 1500),
  atom("d", "saa", "EK11", 1500),
  atom("e", "palo", "VPK", 3000), // in the future at t = 2400
  atom("r", "vesi_reitit", "register", 0, { reference: true }),
];

describe("navigate", () => {
  const now = asVirtualTime(2400);

  it("filters by category and returns newest first, ties by id", () => {
    expect(navigate({ category: "palo", sourceId: null, window: "whole_incident" }, corpus, now).map((a) => a.id)).toEqual(["c", "b", "a"]);
  });

  it("never returns anything observed after now — the future does not exist", () => {
    const ids = navigate({ category: "palo", sourceId: null, window: "whole_incident" }, corpus, now).map((a) => a.id);
    expect(ids).not.toContain("e");
  });

  it("filters by source (KUKA)", () => {
    expect(navigate({ category: "palo", sourceId: "EK11", window: "whole_incident" }, corpus, now).map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("'latest' returns the most recent item per source", () => {
    expect(navigate({ category: "palo", sourceId: null, window: "latest" }, corpus, now).map((a) => a.id)).toEqual(["c", "b"]);
  });

  it("'last_cycle' keeps the last twenty minutes, and static register data always", () => {
    expect(navigate({ category: "palo", sourceId: null, window: "last_cycle" }, corpus, now).map((a) => a.id)).toEqual(["c"]);
    expect(navigate({ category: "vesi_reitit", sourceId: null, window: "last_cycle" }, corpus, now).map((a) => a.id)).toEqual(["r"]);
  });

  it("is closed over the corpus (I6): every result is the same object reference", () => {
    const results = navigate({ category: "palo", sourceId: null, window: "whole_incident" }, corpus, now);
    expect(() => assertClosedOverCorpus(results, corpus)).not.toThrow();
  });

  it("does not reorder the caller's corpus", () => {
    const before = corpus.map((a) => a.id);
    navigate({ category: "palo", sourceId: null, window: "whole_incident" }, corpus, now);
    expect(corpus.map((a) => a.id)).toEqual(before);
  });
});

describe("navigationSources", () => {
  it("lists every source in the whole incident, sorted — including ones not yet heard from", () => {
    expect(navigationSources(corpus)).toEqual(["EK11", "EK12", "register", "VPK"].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });
});

describe("categories", () => {
  it("are eight fixed, generic topics", () => {
    expect(NAV_CATEGORIES.map((c) => c.id)).toEqual(["palo", "saa", "yksikot", "vesi_reitit", "maasto", "kohteet", "ilma", "johto"]);
  });
});

describe("checkNavigationCoverage (validator #16)", () => {
  it("flags a load-bearing item whose category is otherwise empty", () => {
    const lonely = [atom("lb", "kohteet", "VPK", 100, { loadBearing: true })];
    const failures = checkNavigationCoverage(lonely);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.atomId).toBe("lb");
  });

  it(`passes once ${NAV_MIN_DECOYS_PER_LOAD_BEARING} ordinary items sit beside it by its cycle`, () => {
    const withDecoys = [
      atom("lb", "kohteet", "VPK", 1300, { loadBearing: true }),
      atom("d1", "kohteet", "EK11", 100),
      atom("d2", "kohteet", "EK12", 200),
      atom("d3", "kohteet", "KY21", 1250),
    ];
    expect(checkNavigationCoverage(withDecoys)).toEqual([]);
  });

  it("the demo scenario satisfies it", () => {
    expect(checkNavigationCoverage(buildDemoScenario().atoms)).toEqual([]);
  });

  it("navigationNow is the end of the cycle's working period", () => {
    expect(navigationNow(3)).toBe(3600);
  });
});
