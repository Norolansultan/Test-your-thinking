import { describe, expect, it } from "vitest";
import {
  toRenderableBranchStatement,
  toRenderableCycle,
  toRenderableEnvelope,
  toRenderableRateMark,
} from "../../app/boundary/render-boundary.js";
import { asVirtualTime } from "../../app/engine/primitives.js";
import type { BranchStatement, CycleSpec, Envelope, RateMark } from "../../app/scenario/types.js";

const SQUARE = [
  [
    { lat: 60.8, lon: 27.0 },
    { lat: 60.8, lon: 27.01 },
    { lat: 60.81, lon: 27.01 },
    { lat: 60.81, lon: 27.0 },
    { lat: 60.8, lon: 27.0 },
  ],
];

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    cycle: 12,
    polygon: SQUARE,
    detachedParts: [],
    certainty: { kind: "confirmed" },
    attribution: "system",
    horizonVirtual: asVirtualTime(12 * 1200),
    horizonLabel: "ennuste voimassa klo 17:20 saakka",
    flag: "breach_categorical",
    isochrones: [{ minutes: 10, polygon: SQUARE, detachedParts: [] }, { minutes: 20, polygon: SQUARE, detachedParts: [] }],
    accuracy_label: "incorrect",
    bands: [{ fromMinutes: 0, toMinutes: 10, polygons: [SQUARE] }],
    breachGeometry: SQUARE,
    containmentToleranceMetres: 50,
    isOmissionCycle: true,
    ...overrides,
  };
}

describe("toRenderableEnvelope — invariant I4", () => {
  it("strips flag and breachGeometry (explicit TRUTH fields, SPEC/04 §6)", () => {
    const renderable = toRenderableEnvelope(makeEnvelope());
    expect(Object.prototype.hasOwnProperty.call(renderable, "flag")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(renderable, "breachGeometry")).toBe(false);
    // SPEC/12 revision 24 Sep (c) §7: the scoring label is truth too.
    expect(Object.prototype.hasOwnProperty.call(renderable, "accuracy_label")).toBe(false);
    expect(renderable.isochrones.map((i) => i.minutes)).toEqual([10, 20]);
    expect(renderable.projectionCertainty).toBe("likely");
  });

  it("strips isOmissionCycle — not literally TRUTH-tagged in the spec, but revealing it spoils the omission's purpose", () => {
    const renderable = toRenderableEnvelope(makeEnvelope());
    expect(Object.prototype.hasOwnProperty.call(renderable, "isOmissionCycle")).toBe(false);
  });

  it("keeps everything a participant is meant to see", () => {
    const renderable = toRenderableEnvelope(makeEnvelope());
    expect(renderable).toEqual({
      cycle: 12,
      polygon: SQUARE,
      detachedParts: [],
      isochrones: [{ minutes: 10, polygon: SQUARE, detachedParts: [] }, { minutes: 20, polygon: SQUARE, detachedParts: [] }],
      bands: [{ fromMinutes: 0, toMinutes: 10, polygons: [SQUARE] }],
      projectionCertainty: "likely",
      certainty: { kind: "confirmed" },
      attribution: "system",
      horizonVirtual: asVirtualTime(12 * 1200),
      horizonLabel: "ennuste voimassa klo 17:20 saakka",
      containmentToleranceMetres: 50,
    });
  });

  it("this is a genuine leak an unwary implementation could produce: spreading the full Envelope would carry isOmissionCycle straight through", () => {
    // Demonstrates the bug this function exists to prevent — not asserting toRenderableEnvelope does this, asserting the naive alternative would.
    const naive = { ...makeEnvelope() };
    expect(Object.prototype.hasOwnProperty.call(naive, "isOmissionCycle")).toBe(true);
  });

  it("freezes its output", () => {
    const renderable = toRenderableEnvelope(makeEnvelope());
    expect(Object.isFrozen(renderable)).toBe(true);
  });
});

describe("toRenderableRateMark — invariant I4", () => {
  function makeMark(overrides: Partial<RateMark> = {}): RateMark {
    return {
      id: "rate.1",
      cycle: 6,
      flank: "head",
      anchor: { lat: 60.8, lon: 27.0 },
      bearingDeg: 45,
      rateMetresPerMinute: 18,
      provenance: {
        sourceId: "EK11",
        sourceClassId: "sc.experienced",
        sourceReliability: "known-good",
        observedAt: asVirtualTime(6 * 1200),
        recordedAt: asVirtualTime(6 * 1200),
        deliveredAt: asVirtualTime(6 * 1200),
        certainty: { kind: "probable", basis: "observed" },
        supports: [],
        contradicts: [],
      },
      consistentWithEnvelope: false,
      ...overrides,
    };
  }

  it("strips consistentWithEnvelope (explicit TRUTH, SPEC/12 §10)", () => {
    const renderable = toRenderableRateMark(makeMark());
    expect(Object.prototype.hasOwnProperty.call(renderable, "consistentWithEnvelope")).toBe(false);
  });

  it("keeps the rest", () => {
    const renderable = toRenderableRateMark(makeMark());
    expect(renderable.id).toBe("rate.1");
    expect(renderable.rateMetresPerMinute).toBe(18);
    expect(renderable.provenance.sourceId).toBe("EK11");
  });
});

describe("toRenderableCycle — invariant I4", () => {
  function makeCycle(overrides: Partial<CycleSpec> = {}): CycleSpec {
    return {
      index: 12,
      phase: "B",
      title: "Smouldering (internal title, never shown)",
      startsAtVirtual: asVirtualTime(11 * 1200),
      steps: 1,
      clockLabel: "17:00",
      pushedAtomIds: ["atom.secret.upcoming"],
      deliveryOffsetsSeconds: [30],
      perimeter: SQUARE,
      detachedFronts: [],
      unitPositions: { EK11: { lat: 60.8, lon: 27.0 } },
      unitWork: { EK11: { task: "hose_attack", vehicle: { lat: 60.801, lon: 27.0 }, hoseM: 120 } },
      fire: { perimeters_past: [], perimeter_current: [], burnt_area: { geometry: [], severity: null }, burning_zone: [], spot_fires: [], detections: [] },
      aircraft: [],
      wind: { observedAt: asVirtualTime(11 * 1200), fromDeg: 240, meanMs: 3, sourceFi: "Sääasema" },
      actualPerimeterAtEnd: SQUARE,
      actualDetachedAtEnd: [SQUARE],
      probeIds: ["probe.j.cycle_12"],
      gaps: [{ id: "gap.1", surface: "situation_log", unitId: null, from: asVirtualTime(0), to: asVirtualTime(100), form: "workload_gap", whatWasHappening: "crown run in progress — the spoiler" }],
      rateMarks: [],
      sensorFootprints: [{ platformId: "DRONE1", cycle: 12, geometry: null }],
      minViewSeconds: 120,
      hasFreeze: false,
      freezeAtSeconds: null,
      stepBoundary: null,
      ...overrides,
    };
  }

  it("strips actualPerimeterAtEnd (explicit TRUTH: 'Resolves the judgement')", () => {
    const renderable = toRenderableCycle(makeCycle());
    expect(Object.prototype.hasOwnProperty.call(renderable, "actualPerimeterAtEnd")).toBe(false);
  });

  it("strips actualDetachedAtEnd (the detached fire at the horizon is TRUTH too)", () => {
    const renderable = toRenderableCycle(makeCycle());
    expect(Object.prototype.hasOwnProperty.call(renderable, "actualDetachedAtEnd")).toBe(false);
  });

  it("passes the observed wind, airborne platforms and reported detached fronts through", () => {
    const aircraft = [{ platformId: "DR1", kind: "drone" as const, position: { lat: 60.8, lon: 27.0 }, track: [{ lat: 60.8, lon: 27.0 }] }];
    const renderable = toRenderableCycle(makeCycle({ aircraft, detachedFronts: [SQUARE] }));
    expect(renderable.wind).toEqual({ observedAt: asVirtualTime(11 * 1200), fromDeg: 240, meanMs: 3, sourceFi: "Sääasema" });
    expect(renderable.aircraft).toEqual(aircraft);
    expect(renderable.detachedFronts).toEqual([SQUARE]);
  });

  it("strips gaps entirely — a gap's whole point is to render as nothing (SPEC/04 §5)", () => {
    const renderable = toRenderableCycle(makeCycle());
    expect(Object.prototype.hasOwnProperty.call(renderable, "gaps")).toBe(false);
    expect(JSON.stringify(renderable)).not.toContain("the spoiler");
  });

  it("strips title ('internal; not shown')", () => {
    const renderable = toRenderableCycle(makeCycle());
    expect(Object.prototype.hasOwnProperty.call(renderable, "title")).toBe(false);
  });

  it("strips the push-scheduling fields (pushedAtomIds, deliveryOffsetsSeconds, probeIds) — spoilers of what's coming, and not the render layer's job to read ahead", () => {
    const renderable = toRenderableCycle(makeCycle());
    for (const key of ["pushedAtomIds", "deliveryOffsetsSeconds", "probeIds"]) {
      expect(Object.prototype.hasOwnProperty.call(renderable, key)).toBe(false);
    }
  });

  it("recursively strips truth from nested rate marks", () => {
    const cycle = makeCycle({
      rateMarks: [
        {
          id: "rate.1", cycle: 12, flank: "south", anchor: { lat: 60.8, lon: 27.0 }, bearingDeg: 90, rateMetresPerMinute: 5,
          provenance: { sourceId: "EK11", sourceClassId: "sc.experienced", sourceReliability: "known-good", observedAt: asVirtualTime(0), recordedAt: asVirtualTime(0), deliveredAt: asVirtualTime(0), certainty: { kind: "confirmed" }, supports: [], contradicts: [] },
          consistentWithEnvelope: true,
        },
      ],
    });
    const renderable = toRenderableCycle(cycle);
    expect(Object.prototype.hasOwnProperty.call(renderable.rateMarks[0], "consistentWithEnvelope")).toBe(false);
  });

  it("keeps sensorFootprints as-is (no truth field on that type)", () => {
    const renderable = toRenderableCycle(makeCycle());
    expect(renderable.sensorFootprints).toEqual([{ platformId: "DRONE1", cycle: 12, geometry: null }]);
  });
});

describe("toRenderableBranchStatement — invariant I4", () => {
  it("strips truth (BranchStatementTruth.isActualDevelopment — SPEC/04 revision 2026-09-17)", () => {
    const statement: BranchStatement = {
      branchId: "stmt.1",
      cycle: 12,
      statementFi: "Palo hidastuu pinnalla mutta jatkuu syvällä.",
      truth: { isActualDevelopment: true },
    };
    const renderable = toRenderableBranchStatement(statement);
    expect(Object.prototype.hasOwnProperty.call(renderable, "truth")).toBe(false);
    expect(renderable).toEqual({ branchId: "stmt.1", cycle: 12, statementFi: "Palo hidastuu pinnalla mutta jatkuu syvällä." });
  });
});
