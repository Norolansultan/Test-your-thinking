/**
 * The scenario validator CLI — SPEC/10_Build_Plan_and_Acceptance.md, M2:
 * "`tools/validate` runs against a fixture scenario and against a set of
 * deliberately broken scenarios, failing each for the expected reason."
 *
 * Takes the path to a module that exports a `scenario` (or default
 * export) of type `ScenarioContract`, runs it through
 * {@link createScenarioContract} (structural construction checks, SPEC/04
 * §2) and then {@link validateScenario} (content checks, SPEC/03 §11 +
 * SPEC/12 §10), and reports.
 *
 * There is no real asset-bundle format yet (`tools/bundle/` is not
 * built — it is the only module permitted outbound network access per
 * SPEC/05 §8, and is separate work). Until it exists, this tool's input is
 * a TypeScript/JavaScript module rather than a bundle file; the module
 * boundary here (`loadScenario`) is exactly where bundle-loading would
 * plug in later without changing anything downstream.
 */

import { pathToFileURL } from "node:url";
import { ScenarioConstructionError, createScenarioContract } from "../../app/scenario/contract.js";
import { validateScenario, type ValidationResult } from "../../app/scenario/validator.js";
import type { ScenarioContract } from "../../app/scenario/types.js";

export async function loadScenario(modulePath: string): Promise<ScenarioContract> {
  const mod: Record<string, unknown> = await import(pathToFileURL(modulePath).href);
  const candidate = (mod["scenario"] ?? mod["default"]) as ScenarioContract | undefined;
  if (!candidate) {
    throw new Error(`${modulePath} does not export "scenario" or a default export`);
  }
  return candidate;
}

export type ScenarioCheckOutcome =
  | { readonly outcome: "construction-failed"; readonly error: ScenarioConstructionError }
  | { readonly outcome: "validation-failed"; readonly scenario: ScenarioContract; readonly result: ValidationResult }
  | { readonly outcome: "ok"; readonly scenario: ScenarioContract; readonly result: ValidationResult };

/** Loads, constructs and validates the scenario at `modulePath`. Never throws for an invalid scenario — that is reported in the return value, not as a JS exception, so callers (CLI, tests) can inspect the reason uniformly. */
export async function checkScenarioFile(modulePath: string): Promise<ScenarioCheckOutcome> {
  const raw = await loadScenario(modulePath);
  let scenario: ScenarioContract;
  try {
    scenario = createScenarioContract(raw);
  } catch (e) {
    if (e instanceof ScenarioConstructionError) {
      return { outcome: "construction-failed", error: e };
    }
    throw e;
  }
  const result = validateScenario(scenario);
  return result.ok ? { outcome: "ok", scenario, result } : { outcome: "validation-failed", scenario, result };
}

export function formatOutcome(outcome: ScenarioCheckOutcome): { readonly lines: readonly string[]; readonly exitCode: 0 | 1 } {
  if (outcome.outcome === "construction-failed") {
    return { lines: [`construction failed [${outcome.error.reason}]: ${outcome.error.message}`], exitCode: 1 };
  }
  if (outcome.outcome === "ok") {
    return { lines: [`"${outcome.scenario.id}" v${outcome.scenario.version} — all checks passed`], exitCode: 0 };
  }
  const lines = [`"${outcome.scenario.id}" v${outcome.scenario.version} — ${outcome.result.failures.length} check(s) failed`, ""];
  for (const failure of outcome.result.failures) {
    lines.push(`  [${failure.check}] ${failure.message}`);
  }
  return { lines, exitCode: 1 };
}

// CLI entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const modulePath = process.argv[2];
  if (!modulePath) {
    console.error("usage: validate-scenario <path-to-module-exporting-a-ScenarioContract>");
    process.exit(2);
  }
  const outcome = await checkScenarioFile(modulePath);
  const { lines, exitCode } = formatOutcome(outcome);
  const log = exitCode === 0 ? console.log : console.error;
  for (const line of lines) log(line);
  process.exit(exitCode);
}
