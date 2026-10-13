/**
 * TRUTH: the answer keys of the visible probes (Type U; Type E withdrawn with H6, Type F and the branch
 * choice with Type J, 6 Oct 2026), gathered from the scenario for the ANALYSIS
 * (`app/telemetry/probe-measures.ts`), as `spamKeysOf` does for SPAM (readiness round, 5 Oct 2026).
 * Nothing here reaches the session's screen: the orchestrator gives the screen probes without keys
 * (`VisibleProbeView`), and nothing under `app/render` may import this file
 * (`test/session/visible-probes.spec.ts`, I4).
 *
 * - U area item (V13, revision (ai)): the part of the picture the contradiction concerns (invariant
 *   `contradiction.area_hit`, `north_edge`).
 * - U backup: the key option as shown (invariant `contradiction.pair`); coverage: whether the actual
 *   development stayed inside every projection (invariant `coverage.all_inside`).
 */

import type { ScenarioContract } from "./types.js";

export interface ProbeKeys {
  readonly contradictionArea: { readonly probeId: string; readonly key: string } | null;
  readonly contradictionPair: { readonly probeId: string; readonly key: string } | null;
  readonly coverage: { readonly probeId: string; readonly allInside: boolean } | null;
}

export function probeKeysOf(scenario: Pick<ScenarioContract, "probeSchedule" | "invariants">): ProbeKeys {
  const inv = new Map(scenario.invariants.map((i) => [i.name, i.expected]));
  const probes = scenario.probeSchedule.probes;
  const areaProbe = probes.find((p) => p.type === "U" && p.invariantName === "contradiction.area_hit");
  const areaKey = areaProbe ? inv.get(areaProbe.invariantName) : undefined;
  const pairProbe = probes.find((p) => p.type === "U" && p.invariantName === "contradiction.pair");
  const pairKey = pairProbe ? inv.get(pairProbe.invariantName) : undefined;
  const coverageProbe = probes.find((p) => p.type === "U" && p.invariantName === "coverage.all_inside");
  const allInside = coverageProbe ? inv.get(coverageProbe.invariantName) : undefined;
  return {
    contradictionArea: areaProbe && typeof areaKey === "string" ? { probeId: areaProbe.id, key: areaKey } : null,
    contradictionPair: pairProbe && typeof pairKey === "string" ? { probeId: pairProbe.id, key: pairKey } : null,
    coverage: coverageProbe && typeof allInside === "boolean" ? { probeId: coverageProbe.id, allInside } : null,
  };
}
