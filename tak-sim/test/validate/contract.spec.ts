import { describe, expect, it } from "vitest";
import { ScenarioConstructionError, createScenarioContract, type ContractViolationReason } from "../../app/scenario/contract.js";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import type { ScenarioContract } from "../../app/scenario/types.js";

function expectReason(input: ScenarioContract, reason: ContractViolationReason): void {
  try {
    createScenarioContract(input);
    expect.unreachable(`expected construction to throw with reason "${reason}"`);
  } catch (e) {
    expect(e).toBeInstanceOf(ScenarioConstructionError);
    expect((e as ScenarioConstructionError).reason).toBe(reason);
  }
}

describe("createScenarioContract — the baseline fixture itself is valid", () => {
  it("does not throw", () => {
    expect(() => createScenarioContract(buildValidScenario())).not.toThrow();
  });

  it("returns the same object (no mutation, no defensive copy required by the contract)", () => {
    const input = buildValidScenario();
    expect(createScenarioContract(input)).toBe(input);
  });
});

describe("createScenarioContract — every SPEC/04 §2 throw case, individually", () => {
  it("throws on empty id", () => {
    expectReason({ ...buildValidScenario(), id: "" }, "empty-id");
  });

  it("throws on whitespace-only id", () => {
    expectReason({ ...buildValidScenario(), id: "   " }, "empty-id");
  });

  it("throws on empty constructs", () => {
    expectReason({ ...buildValidScenario(), constructs: [] }, "empty-constructs");
  });

  it("throws on zero invariants", () => {
    expectReason({ ...buildValidScenario(), invariants: [] }, "zero-invariants");
  });

  it("throws on a non-finite numeric invariant expected value", () => {
    const s = buildValidScenario();
    expectReason({ ...s, invariants: [{ name: "x", expected: NaN, tolerance: 0 }] }, "invalid-invariant");
  });

  it("throws on a negative invariant tolerance", () => {
    const s = buildValidScenario();
    expectReason({ ...s, invariants: [{ name: "x", expected: true, tolerance: -1 }] }, "invalid-invariant");
  });

  it("does not throw for a categorical (boolean) invariant with a finite/zero tolerance", () => {
    const s = buildValidScenario();
    expect(() =>
      createScenarioContract({ ...s, invariants: [{ name: "x", expected: "holds", tolerance: 0 }] }),
    ).not.toThrow();
  });

  it("throws when the contradiction marker is missing", () => {
    const s = buildValidScenario();
    expectReason({ ...s, contradiction: undefined as never }, "contradiction-count");
  });

  it("throws when the omission marker is missing", () => {
    const s = buildValidScenario();
    expectReason({ ...s, omission: undefined as never }, "omission-count");
  });

  it("throws when the validity claim is missing entirely", () => {
    const s = buildValidScenario();
    expectReason({ ...s, validity: undefined as never }, "invalid-validity-claim");
  });

  it("throws when the validity claim is incomplete (empty knownDivergences)", () => {
    const s = buildValidScenario();
    expectReason({ ...s, validity: { ...s.validity, knownDivergences: [] } }, "invalid-validity-claim");
  });

  it("throws when the validity claim has an empty authoredBy", () => {
    const s = buildValidScenario();
    expectReason({ ...s, validity: { ...s.validity, authoredBy: "" } }, "invalid-validity-claim");
  });

  it("throws when the probe schedule is missing", () => {
    const s = buildValidScenario();
    expectReason({ ...s, probeSchedule: undefined as never }, "missing-probe-schedule");
  });

  it("throws when the extent is missing", () => {
    const s = buildValidScenario();
    expectReason({ ...s, extent: undefined as never }, "missing-extent");
  });

  it("throws when the extent has a non-finite bound", () => {
    const s = buildValidScenario();
    expectReason({ ...s, extent: { ...s.extent, north: NaN } }, "missing-extent");
  });

  it("throws when cycles.length !== 14 (too few; SPEC/26 §3)", () => {
    const s = buildValidScenario();
    expectReason({ ...s, cycles: s.cycles.slice(0, 13) }, "wrong-cycle-count");
  });

  it("throws on the old twenty-cycle length (SPEC/26 replaces it)", () => {
    const s = buildValidScenario();
    const twenty = Array.from({ length: 20 }, (_, i) => s.cycles[i % 14]!);
    expectReason({ ...s, cycles: twenty }, "wrong-cycle-count");
  });

  it("throws when cycles.length !== 14 (too many)", () => {
    const s = buildValidScenario();
    expectReason({ ...s, cycles: [...s.cycles, s.cycles[0]!] }, "wrong-cycle-count");
  });

  it("throws when envelopes.length !== 14", () => {
    const s = buildValidScenario();
    expectReason({ ...s, envelopes: s.envelopes.slice(0, 13) }, "wrong-envelope-count");
  });

  it("throws when channelSets.length !== 14", () => {
    const s = buildValidScenario();
    expectReason({ ...s, channelSets: s.channelSets.slice(0, 13) }, "wrong-channel-set-count");
  });

  it("throws when the practice view is missing or not index 0 (SPEC/26 D3)", () => {
    const s = buildValidScenario();
    expectReason({ ...s, practice: undefined as unknown as typeof s.practice }, "missing-practice-view");
    expectReason({ ...s, practice: { ...s.practice, cycle: { ...s.practice.cycle, index: 1 as unknown as 0 } } }, "missing-practice-view");
  });

  it("throws when a view spans more than two steps (SPEC/26 D2)", () => {
    const s = buildValidScenario();
    const cycles = s.cycles.map((c, i) => (i === 0 ? { ...c, steps: 3 as unknown as 1 } : c));
    expectReason({ ...s, cycles }, "invalid-step-spans");
  });

  it("throws when the step spans skip a step (merge, don't skip)", () => {
    const s = buildValidScenario();
    // V2 claims one step instead of two: step 3 is covered by no view, and V3 starts late.
    const cycles = s.cycles.map((c) => (c.index === 2 ? { ...c, steps: 1 as const } : c));
    expectReason({ ...s, cycles }, "invalid-step-spans");
  });

  it("throws when the views are out of order", () => {
    const s = buildValidScenario();
    const cycles = s.cycles.slice();
    [cycles[0], cycles[1]] = [cycles[1]!, cycles[0]!];
    expectReason({ ...s, cycles }, "invalid-step-spans");
  });

  it("throws when the views stop short of step 20", () => {
    const s = buildValidScenario();
    const cycles = s.cycles.map((c) => (c.index === 14 ? { ...c, steps: 1 as const } : c));
    expectReason({ ...s, cycles }, "invalid-step-spans");
  });

  it("throws on fewer than five branches", () => {
    const s = buildValidScenario();
    expectReason({ ...s, branches: s.branches.slice(0, 4) }, "insufficient-branches");
  });

  it("throws on a T1_pushed atom with no delivery time", () => {
    const s = buildValidScenario();
    const badAtom = { ...s.atoms[0]!, tier: "T1_pushed" as const, provenance: { ...s.atoms[0]!.provenance, deliveredAt: null } };
    expectReason({ ...s, atoms: [badAtom, ...s.atoms.slice(1)] }, "t1-missing-delivery-time");
  });

  it("throws on a load-bearing atom with fewer than three routes", () => {
    const s = buildValidScenario();
    const loadBearingIndex = s.atoms.findIndex((a) => a.loadBearing);
    expect(loadBearingIndex).toBeGreaterThanOrEqual(0);
    const original = s.atoms[loadBearingIndex]!;
    const degraded = { ...original, routes: { ...original.routes, assistive: null } };
    const atoms = s.atoms.slice();
    atoms[loadBearingIndex] = degraded;
    expectReason({ ...s, atoms }, "load-bearing-insufficient-routes");
  });

  it("does not throw when a non-load-bearing atom has fewer than three routes", () => {
    const s = buildValidScenario();
    const nonLoadBearingIndex = s.atoms.findIndex((a) => !a.loadBearing);
    const original = s.atoms[nonLoadBearingIndex]!;
    const atoms = s.atoms.slice();
    atoms[nonLoadBearingIndex] = { ...original, routes: { ...original.routes, assistive: null, substitutive: null } };
    expect(() => createScenarioContract({ ...s, atoms })).not.toThrow();
  });
});
