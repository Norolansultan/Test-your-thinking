/**
 * The play harness's Haku transport (`tools/play/`): what `/api/thinker` answers when the proxy has no model — the proxy's own
 * handler (`server/thinker/handler.ts` `handleThinkerRequest`) with no model client (`client: null`, the handler's `no_api_key`
 * path) and no vector index (`vector: null`, the lexical half alone, as `tools/demo-bridge/serve.ts` runs it). So the request is
 * validated and time-gated by the handler itself (`reachableAtoms` at the step of the request's view and virtual time,
 * `app/retrieval/time-gate.ts`), retrieved over lexically, and answered with the app's four-part template
 * (`templateThinkerAnswer`, `app/session/template-answer.ts`) over the records retrieved, flagged `fallback: true`,
 * `fallbackReason: "no_api_key"`, `retrievalMode: "lexical_only"`. It is NOT the study's model: the harness says so wherever it
 * prints an answer.
 *
 * The Open Thinker and the guide group's premise lookup are not served: the harness plays the Haku group (cell `radio`), which
 * has neither; a call to either fails as a network error would, so the session takes its own fallback.
 */

import type { ScenarioContract } from "../../app/scenario/types.js";
import type { ThinkerRequest, ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { OpenThinkerTransport, ThinkerTransport } from "../../app/session/thinker-transport.js";
import type { PremiseReviewTransport } from "../../app/session/plan-review-transport.js";
import { handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { NO_PREMISE_EVIDENCE } from "../demo-bridge/serve.js";

/** The handler's dependencies with no model and no index: the proxy's template fallback over lexical retrieval. */
export function noModelDeps(scenario: ScenarioContract, nowMs: () => number): ThinkerDeps {
  return {
    scenario,
    vector: null,
    prompt: loadSystemPrompt("fi", "standard"),
    promptEn: loadSystemPrompt("en", "standard"),
    premiseEvidence: NO_PREMISE_EVIDENCE,
    expectedModelVersion: null,
    sessionModelVersions: new Map(),
    client: null,
    appendLog: async () => undefined,
    nowMs,
    nowIso: () => "1970-01-01T00:00:00.000Z", // no log is written; the handler's log line only
  };
}

/** Haku's chat answered by the proxy's no-model path; any refusal (an HTTP 4xx/5xx) is thrown, as the browser's transport would. */
export function noModelHakuTransport(scenario: ScenarioContract, nowMs: () => number): ThinkerTransport {
  const deps = noModelDeps(scenario, nowMs);
  return async (request: ThinkerRequest): Promise<ThinkerResponse> => {
    const result = await handleThinkerRequest(deps, request);
    if (result.status !== 200) throw new Error(`haku: the proxy refused the request (${result.status}: ${result.body.error})`);
    return result.body;
  };
}

/** Not served in the Haku group: fails as an unreachable proxy does. */
export const unavailableOpenTransport: OpenThinkerTransport = async () => { throw new Error("the Open Thinker is not served by the play harness"); };
export const unavailablePremiseTransport: PremiseReviewTransport = async () => { throw new Error("the premise lookup is not served by the play harness"); };
