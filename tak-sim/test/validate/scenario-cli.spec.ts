import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkScenarioFile, formatOutcome } from "../../tools/validate/scenario.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "scenario", "fixtures");

describe("checkScenarioFile / formatOutcome — M2 acceptance: tools/validate against a fixture scenario and deliberately broken scenarios", () => {
  it("a valid scenario module passes with exit code 0", async () => {
    const outcome = await checkScenarioFile(join(fixturesDir, "cli-valid.ts"));
    expect(outcome.outcome).toBe("ok");
    const { lines, exitCode } = formatOutcome(outcome);
    expect(exitCode).toBe(0);
    expect(lines.join("\n")).toContain("all checks passed");
  });

  it("a scenario that fails construction is reported with its specific reason, exit code 1", async () => {
    const outcome = await checkScenarioFile(join(fixturesDir, "cli-broken-construction.ts"));
    expect(outcome.outcome).toBe("construction-failed");
    if (outcome.outcome !== "construction-failed") throw new Error("unreachable");
    expect(outcome.error.reason).toBe("empty-id");
    const { lines, exitCode } = formatOutcome(outcome);
    expect(exitCode).toBe(1);
    expect(lines.join("\n")).toContain("empty-id");
  });

  it("a scenario that fails validation is reported with the specific failing check, exit code 1", async () => {
    const outcome = await checkScenarioFile(join(fixturesDir, "cli-broken-validation.ts"));
    expect(outcome.outcome).toBe("validation-failed");
    if (outcome.outcome !== "validation-failed") throw new Error("unreachable");
    expect(outcome.result.failures.some((f) => f.check === "no-allocation-recommendations")).toBe(true);
    const { lines, exitCode } = formatOutcome(outcome);
    expect(exitCode).toBe(1);
    expect(lines.join("\n")).toContain("no-allocation-recommendations");
  });

  it("a module with no scenario export throws a clear error", async () => {
    // reuse an existing, unrelated fixture module that has no `scenario`/`default` export
    await expect(checkScenarioFile(join(fixturesDir, "valid-scenario.ts"))).rejects.toThrow(/does not export/);
  });
});
