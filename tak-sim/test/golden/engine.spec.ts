/**
 * M1 acceptance test (SPEC/10_Build_Plan_and_Acceptance.md, M1):
 * "test/golden/engine.spec replays three reference input sequences and
 * produces byte-identical logs against committed fixtures."
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, runReferenceSequence } from "./reference-runner.js";
import { REFERENCE_SEQUENCES } from "./reference-sequences.js";

const here = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(here, "fixtures", `${name}.json`), "utf8");
}

describe("golden run — byte-identical against committed fixtures", () => {
  for (const [name, spec] of Object.entries(REFERENCE_SEQUENCES)) {
    it(`"${name}" matches its committed fixture exactly`, async () => {
      const result = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
      const actual = canonicalJson(result);
      const expected = readFixture(name);
      expect(actual).toBe(expected);
    });

    it(`"${name}" is byte-identical across two independent runs (same scenario id, seed, input sequence)`, async () => {
      const a = canonicalJson(await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions));
      const b = canonicalJson(await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions));
      expect(a).toBe(b);
    });
  }

  it("a different seed changes the recorded PRNG draws (sanity: the harness isn't accidentally constant)", async () => {
    const spec = REFERENCE_SEQUENCES["short-mixed-probes"];
    const a = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
    const b = await runReferenceSequence(spec.scenarioId, 999999n, spec.actions);
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it("a different scenarioId with the same numeric seed diverges (SPEC/05 §3: seed mixed with scenarioId hash)", async () => {
    const spec = REFERENCE_SEQUENCES["short-mixed-probes"];
    const a = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
    const b = await runReferenceSequence("a-completely-different-scenario-id", spec.seed, spec.actions);
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it("every record's seq is gapless from 0 in every fixture run", async () => {
    for (const spec of Object.values(REFERENCE_SEQUENCES)) {
      const result = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
      result.records.forEach((r, i) => expect(r.seq).toBe(i));
    }
  });

  it("tVirtual is non-decreasing across every fixture's records (monotonic virtual time)", async () => {
    for (const spec of Object.values(REFERENCE_SEQUENCES)) {
      const result = await runReferenceSequence(spec.scenarioId, spec.seed, spec.actions);
      for (let i = 1; i < result.records.length; i++) {
        expect(result.records[i]!.tVirtual).toBeGreaterThanOrEqual(result.records[i - 1]!.tVirtual);
      }
    }
  });
});
