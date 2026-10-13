import { describe, expect, it } from "vitest";
import { validateScenario, type ValidatorCheckId } from "../../app/scenario/validator.js";
import { buildValidScenario } from "./fixtures/valid-scenario.js";
import type { InfoAtom, ScenarioContract } from "../../app/scenario/types.js";

function failsWith(scenario: ScenarioContract, check: ValidatorCheckId): void {
  const result = validateScenario(scenario);
  expect(result.ok).toBe(false);
  expect(result.failures.some((fl) => fl.check === check)).toBe(true);
}

describe("validateScenario — the baseline fixture passes all fifteen checks", () => {
  it("is ok with zero failures", () => {
    const result = validateScenario(buildValidScenario());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("validateScenario — each check fires on a deliberately broken variant (SPEC/03 §11 + SPEC/12 §10)", () => {
  it("#1 markers-well-formed: a marker references a non-existent atom", () => {
    const s = buildValidScenario();
    failsWith({ ...s, contradiction: { ...s.contradiction, premiseAtomId: "atom.does-not-exist" } }, "markers-well-formed");
  });

  it("#2 load-bearing-routes: a load-bearing atom is missing a route", () => {
    const s = buildValidScenario();
    const idx = s.atoms.findIndex((a) => a.loadBearing);
    const atoms = s.atoms.slice();
    atoms[idx] = { ...atoms[idx]!, routes: { ...atoms[idx]!.routes, substitutive: null } };
    failsWith({ ...s, atoms }, "load-bearing-routes");
  });

  it("#3 flag-sequence: two envelope flags are swapped", () => {
    const s = buildValidScenario();
    const envelopes = s.envelopes.slice();
    const tmp = envelopes[0]!.flag; // V1 holds, V2 quantitative (SPEC/26 §3)
    envelopes[0] = { ...envelopes[0]!, flag: envelopes[1]!.flag };
    envelopes[1] = { ...envelopes[1]!, flag: tmp };
    failsWith({ ...s, envelopes }, "flag-sequence");
  });

  it("#3 flag-sequence: also fires on a run of three consecutive breaches, independent of exact-match", () => {
    const s = buildValidScenario();
    const envelopes = s.envelopes.map((e, i) => (i === 9 ? { ...e, flag: "breach_quantitative" as const } : e)); // V10 was `holds`, sits between two breach views (V9, V11)
    const result = validateScenario({ ...s, envelopes });
    expect(result.failures.some((fl) => fl.check === "flag-sequence" && fl.message.includes("consecutive"))).toBe(true);
  });

  it("#4 containment-base-rate: too many breaches", () => {
    const s = buildValidScenario();
    const envelopes = s.envelopes.map((e) => ({ ...e, flag: "breach_quantitative" as const }));
    failsWith({ ...s, envelopes }, "containment-base-rate");
  });

  it("#5 probe-invariant-links: a probe references a missing invariant", () => {
    const s = buildValidScenario();
    const probes = s.probeSchedule.probes.slice();
    probes[0] = { ...probes[0]!, invariantName: "no.such.invariant" };
    failsWith({ ...s, probeSchedule: { probes } }, "probe-invariant-links");
  });

  it("#6 atom-completeness: an atom references an undeclared source class", () => {
    const s = buildValidScenario();
    const atoms = s.atoms.slice();
    atoms[0] = { ...atoms[0]!, provenance: { ...atoms[0]!.provenance, sourceClassId: "sc.unknown" } };
    failsWith({ ...s, atoms }, "atom-completeness");
  });

  it("#7 tier-shares: too few T4 atoms", () => {
    const s = buildValidScenario();
    const t4 = s.atoms.filter((a) => a.tier === "T4_lateral");
    const nonT4 = s.atoms.filter((a) => a.tier !== "T4_lateral");
    failsWith({ ...s, atoms: [...nonT4, ...t4.slice(0, 10)] }, "tier-shares");
  });

  it("#8 load-bearing-t4-presence: one of the three named T4 items is missing", () => {
    const s = buildValidScenario();
    const atoms = s.atoms.filter((a) => a.id !== "t4.water_state");
    failsWith({ ...s, atoms }, "load-bearing-t4-presence");
  });

  it("#9 channel-traceability: a channel signal cites a non-existent atom", () => {
    const s = buildValidScenario();
    const channelSets = s.channelSets.slice();
    channelSets[0] = {
      ...channelSets[0]!,
      signals: [{ category: "x" as never, urgency: 0, certainty: { kind: "confirmed" }, attribution: [], quiet: false, text: "x", derivedFromAtomIds: ["atom.ghost"] }],
    };
    failsWith({ ...s, channelSets }, "channel-traceability");
  });

  it("#10 channel-no-contradiction-flag: a signal at the contradiction cycle cites both premise and counter", () => {
    const s = buildValidScenario();
    const channelSets = s.channelSets.map((set) =>
      set.cycle === s.contradiction.cycle
        ? {
            ...set,
            signals: [
              {
                category: "x" as never,
                urgency: 1 as const,
                certainty: { kind: "probable" as const, basis: "x" },
                attribution: ["SPOT", "EK14"],
                quiet: false,
                text: "x",
                derivedFromAtomIds: [s.contradiction.premiseAtomId, s.contradiction.counterAtomId],
              },
            ],
          }
        : set,
    );
    failsWith({ ...s, channelSets }, "channel-no-contradiction-flag");
  });

  it("#11 latency-distribution-well-formed: sigma is zero", () => {
    const s = buildValidScenario();
    const sourceClasses = s.sourceClasses.slice();
    sourceClasses[0] = { ...sourceClasses[0]!, replyLatency: { ...sourceClasses[0]!.replyLatency, sigma: 0 } };
    failsWith({ ...s, sourceClasses }, "latency-distribution-well-formed");
  });

  it("#11 latency-distribution-well-formed: min > max", () => {
    const s = buildValidScenario();
    const sourceClasses = s.sourceClasses.slice();
    sourceClasses[0] = { ...sourceClasses[0]!, replyLatency: { ...sourceClasses[0]!.replyLatency, minSeconds: 500 } };
    failsWith({ ...s, sourceClasses }, "latency-distribution-well-formed");
  });

  it("#12 envelope-horizon: an envelope's horizon isn't the next cycle boundary", () => {
    const s = buildValidScenario();
    const envelopes = s.envelopes.slice();
    envelopes[0] = { ...envelopes[0]!, horizonVirtual: 99999 as never };
    failsWith({ ...s, envelopes }, "envelope-horizon");
  });

  it("#12 envelope-horizon: a merged view's envelope must reach the end of its second step (SPEC/26 §2)", () => {
    const s = buildValidScenario();
    const v2 = s.cycles.find((c) => c.index === 2)!; // steps 2+3: 13:40-14:20
    expect(v2.steps).toBe(2);
    const envelopes = s.envelopes.map((e) => (e.cycle === 2 ? { ...e, horizonVirtual: (v2.startsAtVirtual + 1200) as never } : e));
    failsWith({ ...s, envelopes }, "envelope-horizon");
  });

  it("#13 validity-claim-divergence-tags: a required declaration is missing", () => {
    const s = buildValidScenario();
    failsWith(
      { ...s, validity: { ...s.validity, knownDivergences: s.validity.knownDivergences.filter((d) => !d.startsWith("fire-magnitude:")) } },
      "validity-claim-divergence-tags",
    );
  });

  it("#14 no-truth-leak: a truth-annotation key is smuggled into an atom's record payload", () => {
    const s = buildValidScenario();
    const atoms = s.atoms.slice();
    const corruptedRecord = { ...atoms[0]!.record, isGroundTruth: true } as unknown as InfoAtom["record"];
    atoms[0] = { ...atoms[0]!, record: corruptedRecord };
    failsWith({ ...s, atoms }, "no-truth-leak");
  });

  it("#15 no-allocation-recommendations: the study must never populate this", () => {
    const s = buildValidScenario();
    failsWith(
      { ...s, allocationRecommendations: [{ assetId: "EK11", toSectorId: "L1", taskId: "task.direct-attack", machineAttribution: "system", certainty: { kind: "confirmed" } }] },
      "no-allocation-recommendations",
    );
  });
});

describe("validateScenario — collects multiple independent failures in one pass", () => {
  it("reports both broken checks when two things are wrong at once", () => {
    const s = buildValidScenario();
    const broken: ScenarioContract = {
      ...s,
      contradiction: { ...s.contradiction, premiseAtomId: "atom.ghost" },
      allocationRecommendations: [{ assetId: "x", toSectorId: "y", taskId: "z", machineAttribution: "system", certainty: { kind: "unknown" } }],
    };
    const result = validateScenario(broken);
    const checks = new Set(result.failures.map((fl) => fl.check));
    expect(checks.has("markers-well-formed")).toBe(true);
    expect(checks.has("no-allocation-recommendations")).toBe(true);
  });
});
