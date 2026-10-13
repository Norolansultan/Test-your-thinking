import { buildValidScenario } from "./valid-scenario.js";
import type { ScenarioContract } from "../../../app/scenario/types.js";

/** Fails createScenarioContract() — empty id (SPEC/04 §2). */
export const scenario: ScenarioContract = { ...buildValidScenario(), id: "" };
