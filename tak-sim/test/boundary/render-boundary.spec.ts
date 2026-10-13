import { describe, expect, it } from "vitest";
import {
  TruthLeakError,
  assertNoTruthKeysPresent,
  toRenderable,
  type RenderableAtom,
  type _Check,
} from "../../app/boundary/render-boundary.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { asVirtualTime } from "../../app/engine/primitives.js";

// ---------------------------------------------------------------------------
// M2 acceptance: "the truth-boundary static guard (04 §9 _Check) compiles."
// A broken guard (one that let `truth` leak into RenderableAtom) would make
// `_Check` collapse to `never`, and the line below would then fail to
// type-check — so `npm run typecheck` (wired into CI) fails the build, not
// silently pass it. This is the guard's proof of life, not just its existence.
// ---------------------------------------------------------------------------
type StaticGuardHolds = _Check extends never ? "FAIL: _Check collapsed to never — TruthAnnotation is reachable from RenderableAtom" : "ok";
const staticGuardProof: StaticGuardHolds = "ok";
void staticGuardProof;

function makeAtom(overrides: Partial<InfoAtom> = {}): InfoAtom {
  return {
    id: "atom.test.1",
    tier: "T2_system",
    origin: "below",
    cycle: 3,
    loadBearing: false,
    navCategory: "palo",
    routes: { directed: { kind: "browse", surface: "situation_log" }, assistive: null, substitutive: { kind: "free_text", exampleQueries: ["mitä tapahtui?"] } },
    record: {
      kind: "situation_log",
      entryId: "log.1",
      authorUnitId: "EK11",
      text: "15:02 EK12 vetäydyttiin kuusikon reunalta.",
    },
    provenance: {
      sourceId: "EK11",
      sourceClassId: "sc.experienced",
      sourceReliability: "known-good",
      observedAt: asVirtualTime(120),
      recordedAt: asVirtualTime(130),
      deliveredAt: asVirtualTime(140),
      certainty: { kind: "confirmed" },
      supports: [],
      contradicts: [],
    },
    degradation: [{ form: "typed_not_observed_time", note: "recorded ten minutes after observation", gapClass: "imprecise" }],
    retrievalKeys: ["vetäytyminen", "kuusikko"],
    truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: ["containment.cycle_03"] },
    ...overrides,
  };
}

describe("toRenderable — invariant I4", () => {
  it("copies exactly the allowlisted fields", () => {
    const atom = makeAtom();
    const renderable = toRenderable(atom);
    expect(renderable).toEqual({
      id: atom.id,
      record: atom.record,
      provenance: atom.provenance,
      degradationVisible: ["typed_not_observed_time"],
    });
  });

  it("never includes a `truth` key", () => {
    const renderable = toRenderable(makeAtom());
    expect(Object.prototype.hasOwnProperty.call(renderable, "truth")).toBe(false);
  });

  it("never includes tier, origin, cycle, loadBearing, routes, retrievalKeys or consequence", () => {
    const renderable = toRenderable(makeAtom({ consequence: { description: "x", manifestsAtCycle: 8, measureId: "m" } }));
    const forbiddenKeys = ["tier", "origin", "cycle", "loadBearing", "routes", "retrievalKeys", "consequence", "truth"];
    for (const key of forbiddenKeys) {
      expect(Object.prototype.hasOwnProperty.call(renderable, key)).toBe(false);
    }
  });

  it("degradationVisible carries only the form tag, never the reviewer-only note", () => {
    const atom = makeAtom({
      degradation: [{ form: "unmarked_hearsay", note: "reviewer: verify with EK14 before shipping", gapClass: "imprecise" }],
    });
    const renderable = toRenderable(atom);
    expect(renderable.degradationVisible).toEqual(["unmarked_hearsay"]);
    expect(JSON.stringify(renderable)).not.toContain("reviewer:");
  });

  it("deep-freezes the returned object and its nested objects", () => {
    const renderable = toRenderable(makeAtom());
    expect(Object.isFrozen(renderable)).toBe(true);
    expect(Object.isFrozen(renderable.provenance)).toBe(true);
    expect(Object.isFrozen(renderable.record)).toBe(true);
    expect(() => {
      // @ts-expect-error — intentionally violating the readonly/frozen contract to prove it's enforced at runtime too
      renderable.id = "mutated";
    }).toThrow(TypeError);
  });

  it("is total: never throws on a well-typed atom of any record kind", () => {
    const kinds: InfoAtom["record"][] = [
      { kind: "task_record", taskId: "t1", callerAccount: "x", firstAddress: "y", reportedCoord: null, firstUnitCoord: null, initialAssignment: [], taskType: "X100" },
      { kind: "unit_status", unitId: "EK12", status: "matkalla", setAt: asVirtualTime(0), position: null, positionSetAt: null, abandoned: false },
      { kind: "weather", at: asVirtualTime(0), windMeanMs: 5, windGustMs: 9, windDirectionDeg: 230, temperatureC: 28, relativeHumidity: 27, precipitationMm: 0, ffmc: 92, dmc: 71, dc: 481, isi: 14, bui: 104, fwi: 40 },
    ];
    for (const record of kinds) {
      expect(() => toRenderable(makeAtom({ record }))).not.toThrow();
    }
  });
});

describe("assertNoTruthKeysPresent — the defensive runtime walk", () => {
  it("passes for a clean object graph", () => {
    expect(() => assertNoTruthKeysPresent({ a: { b: [1, 2, { c: "d" }] } })).not.toThrow();
  });

  it("catches a truth key nested arbitrarily deep", () => {
    const sneaky = { a: { b: [{ c: { isGroundTruth: true } }] } };
    expect(() => assertNoTruthKeysPresent(sneaky)).toThrow(TruthLeakError);
  });

  it("catches a truth key smuggled inside an open ReferenceDatum-style fields record", () => {
    const sneaky = { fields: { tierRationale: "should never be here" } };
    expect(() => assertNoTruthKeysPresent(sneaky)).toThrow(/tierRationale/);
  });

  it("reports the path to the leak", () => {
    try {
      assertNoTruthKeysPresent({ record: { fields: { saidOn: "dmo" } } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TruthLeakError);
      expect((e as TruthLeakError).path).toBe("record.fields");
      expect((e as TruthLeakError).key).toBe("saidOn");
    }
  });

  it("does not false-positive on array indices or unrelated keys that merely resemble truth fields in value, not name", () => {
    expect(() => assertNoTruthKeysPresent({ isGroundTruthy: "not the real key" })).not.toThrow();
  });
});

// Type-level exercise: RenderableAtom is assignable where InfoAtom is not,
// proving the boundary actually narrows the surface rather than just
// re-exporting InfoAtom under a new name.
type _NarrowsAway = "truth" extends keyof RenderableAtom ? "FAIL: RenderableAtom still has a truth key" : "ok";
const _narrowsAwayProof: _NarrowsAway = "ok";
void _narrowsAwayProof;
