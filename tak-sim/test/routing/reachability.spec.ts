/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M5: "`test/routing/reachability.spec`
 * asserts every load-bearing atom is reachable in all three conditions
 * *by executing the authored route*, not by inspecting the field."
 * Scoped per SPEC/04 revision (g)'s `test/scenario/routes-two-groups.spec`
 * to the two conditions actually configured for this study: "every
 * load-bearing atom reachable in `directed` and `substitutive`."
 */

import { describe, expect, it } from "vitest";
import { executeRoute, isReachableByExecutingItsOwnRoute } from "../../app/routing/route-executor.js";
import { buildValidScenario } from "../scenario/fixtures/valid-scenario.js";
import { LOAD_BEARING_T4_IDS } from "../../app/scenario/types.js";

describe("reachability — every load-bearing atom, executing its own directed and substitutive routes", () => {
  const scenario = buildValidScenario();
  const loadBearing = scenario.atoms.filter((a) => a.loadBearing);

  it("the fixture actually has load-bearing atoms to test (sanity)", () => {
    expect(loadBearing.length).toBeGreaterThan(0);
  });

  it.each(loadBearing.map((a) => a.id))("%s is reachable in `directed` by executing its route", (atomId) => {
    const atom = scenario.atoms.find((a) => a.id === atomId)!;
    expect(atom.routes.directed).not.toBeNull();
    expect(isReachableByExecutingItsOwnRoute(atom, atom.routes.directed!, scenario.atoms)).toBe(true);
  });

  it.each(loadBearing.map((a) => a.id))("%s is reachable in `substitutive` by executing its route", (atomId) => {
    const atom = scenario.atoms.find((a) => a.id === atomId)!;
    expect(atom.routes.substitutive).not.toBeNull();
    expect(isReachableByExecutingItsOwnRoute(atom, atom.routes.substitutive!, scenario.atoms)).toBe(true);
  });

  it("the three named load-bearing T4 items specifically (SPEC/02 §3.2) are reachable in both conditions in use", () => {
    for (const id of LOAD_BEARING_T4_IDS) {
      const atom = scenario.atoms.find((a) => a.id === id);
      expect(atom).toBeDefined();
      expect(isReachableByExecutingItsOwnRoute(atom!, atom!.routes.directed!, scenario.atoms)).toBe(true);
      expect(isReachableByExecutingItsOwnRoute(atom!, atom!.routes.substitutive!, scenario.atoms)).toBe(true);
    }
  });

  it("the contradiction's reconciling atom (the load-bearing T4 item that resolves cycle 18) is reachable in both conditions", () => {
    const atom = scenario.atoms.find((a) => a.id === scenario.contradiction.reconcilingAtomId)!;
    expect(atom).toBeDefined();
    if (atom.routes.directed) {
      expect(isReachableByExecutingItsOwnRoute(atom, atom.routes.directed, scenario.atoms)).toBe(true);
    }
    if (atom.routes.substitutive) {
      expect(isReachableByExecutingItsOwnRoute(atom, atom.routes.substitutive, scenario.atoms)).toBe(true);
    }
  });
});

describe("reachability — this is a real check, not a vacuous one (negative control)", () => {
  it("a route that does NOT actually surface the atom is correctly reported unreachable", () => {
    const scenario = buildValidScenario();
    const atom = scenario.atoms.find((a) => a.loadBearing)!;
    // A route pointing at a unit this atom was never sourced from must not "reach" it.
    const wrongRoute = { kind: "ask_unit" as const, unitId: "DEFINITELY_NOT_THE_SOURCE_UNIT" };
    expect(isReachableByExecutingItsOwnRoute(atom, wrongRoute, scenario.atoms)).toBe(false);
  });

  it("executeRoute for `pushed`, `ask_duty_officer` and `channel` returns empty rather than a false positive (out of this study's scope, per module doc)", () => {
    const scenario = buildValidScenario();
    expect(executeRoute({ kind: "pushed" }, scenario.atoms)).toEqual([]);
    expect(executeRoute({ kind: "ask_duty_officer" }, scenario.atoms)).toEqual([]);
    expect(executeRoute({ kind: "channel", signalSetCycle: 1 }, scenario.atoms)).toEqual([]);
  });
});

describe("reachability — browse and request_traffic route kinds resolve to real corpus subsets", () => {
  it("browse('reference_maintenance') surfaces the omission's reference atom", () => {
    const scenario = buildValidScenario();
    const results = executeRoute({ kind: "browse", surface: "reference_maintenance" }, scenario.atoms);
    expect(results.some((a) => a.id === "atom.omission.development")).toBe(true);
  });

  it("request_traffic({byUnit}) surfaces lateral traffic from that unit only", () => {
    const scenario = buildValidScenario();
    const results = executeRoute({ kind: "request_traffic", selector: { byUnit: "EK12" } }, scenario.atoms);
    expect(results.length).toBeGreaterThan(0);
    for (const atom of results) {
      if (atom.record.kind === "lateral_traffic") {
        expect([atom.record.speakerUnitId, atom.record.addresseeUnitId]).toContain("EK12");
      }
    }
  });
});
