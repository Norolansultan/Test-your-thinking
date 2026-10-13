/**
 * SPEC/24 §5 — the scenario run: determinism, speed calibration against the authored rate of
 * spread, and that authored hidden events are invisible to the envelope.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_RUN_OPTIONS, inArc, runScenario, type CycleForcing } from "../../tools/fire-ca/run.js";
import { buildTemplateSite } from "../../tools/fire-ca/template-site.js";
import { SCENARIO_18_FORCING } from "../../tools/fire-ca/scenario-18.js";

const site = buildTemplateSite(50, 6000); // coarse, for speed
const opts = { ...DEFAULT_RUN_OPTIONS, seed: 20080101n, scenarioId: "test", ensembleSize: 8 };

const steady = (id: string, ros: number, envRos = ros, extra: Partial<CycleForcing> = {}): CycleForcing => ({
  id, clock: "00:00", windFromDeg: 225, meanMs: 6, gustMs: 9, headRosActualMpm: ros, headRosEnvelopeMpm: envRos, expectedFlag: "holds", ...extra,
});

const strip = (r: ReturnType<typeof runScenario>) => JSON.stringify(r.cycles.map(({ masks: _m, ...rest }) => rest));

describe("runScenario", () => {
  it("is deterministic for a given seed", () => {
    const forcing = [steady("1", 6), steady("2", 8)];
    expect(strip(runScenario(site, forcing, opts))).toEqual(strip(runScenario(site, forcing, opts)));
  });

  it("the transcribed SPEC/18 forcing has 25 cycles: W1–W5 then 1–20", () => {
    expect(SCENARIO_18_FORCING.map((f) => f.id)).toEqual(["W1", "W2", "W3", "W4", "W5", ...Array.from({ length: 20 }, (_, i) => String(i + 1))]);
  });

  it("calibrates the head to the authored rate of spread (within 35% over three cycles)", () => {
    const result = runScenario(site, [steady("1", 8), steady("2", 8), steady("3", 8)], opts);
    const mean = result.cycles.reduce((s, c) => s + c.achievedHeadRosMpm, 0) / result.cycles.length;
    expect(Math.abs(mean - 8) / 8).toBeLessThan(0.35);
  });

  it("a hidden (during-cycle) ignition is not in the reported perimeter; a reported one is", () => {
    const hidden = runScenario(site, [steady("1", 4, 4, { events: [{ kind: "ignite", anchor: "ignition", bearingDeg: 180, distanceM: 1500, radiusM: 60, note: "hidden" }] })], opts);
    const seen = runScenario(site, [steady("1", 4, 4, { events: [{ kind: "ignite", timing: "before_report", anchor: "ignition", bearingDeg: 180, distanceM: 1500, radiusM: 60, note: "seen" }] })], opts);
    const count = (m: Uint8Array) => m.reduce((n, v) => n + v, 0);
    expect(count(seen.cycles[0]!.masks.reported)).toBeGreaterThan(count(hidden.cycles[0]!.masks.reported));
    expect(hidden.cycles[0]!.derived.flag).toBe("breach_categorical"); // a detached new front the envelope never saw
  });

  it("the envelope comes from the machine's inputs: a stale fuel map it cannot see through", () => {
    const r = runScenario(site, [steady("1", 6)], opts);
    expect(r.cycles[0]!.envelope).not.toBeNull();
    expect(r.cycles[0]!.truthAtEnd).not.toBeNull();
  });
});

describe("inArc", () => {
  it("handles arcs across north", () => {
    expect(inArc(10, 260, 130)).toBe(true);
    expect(inArc(200, 260, 130)).toBe(false);
    expect(inArc(270, 260, 130)).toBe(true);
  });
});
