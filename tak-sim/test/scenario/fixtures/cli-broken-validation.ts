import { buildValidScenario } from "./valid-scenario.js";
import type { ScenarioContract } from "../../../app/scenario/types.js";

/** Passes construction but fails validateScenario() — SPEC/12 §10: allocationRecommendations must be empty in this study. */
export const scenario: ScenarioContract = {
  ...buildValidScenario(),
  allocationRecommendations: [
    { assetId: "EK11", toSectorId: "L1", taskId: "task.direct-attack", machineAttribution: "system", certainty: { kind: "confirmed" } },
  ],
};
