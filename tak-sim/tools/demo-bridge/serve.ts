/**
 * DEMONSTRATION ONLY. The proxy's own handler (`server/thinker/handler.ts`) run in the page: the same validation, time gate,
 * lexical-only retrieval, prompt assembly, answer checks and fallbacks, with browser dependencies — no vector index (`vector:
 * null`, the lexical half over the published records), no log file, the model call answered by `sample`
 * (`sample-client.ts`). Every 200 response is marked {@link DEMO_BRIDGE_MODEL_ID}; the browser accepts that outside the study only.
 *
 * The guide group's premise data is not here: the premise-evidence table is EMPTY ({@link NO_PREMISE_EVIDENCE}), so with the
 * directive in force the handler takes its own path for a view the table does not cover — no premises block for the model, no
 * premise line and no verdicts in the answer — and never reads the directive premises. The plan review's premise lookup is not
 * served at all (`install.ts`).
 *
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.4): a `corpus: "training"` request (the training incident's Haku) is answered by the
 * same handler over the training's own records (`data.training`), lexical only, with the same prompts, marked with the bridge's model
 * id as every bridge answer; the session's records are never its candidates.
 */

import { DEMO_BRIDGE_MODEL_ID, type ThinkerTool } from "../../app/session/thinker-protocol.js";
import { handleOpenThinkerRequest, handleThinkerRequest, type ThinkerDeps } from "../../server/thinker/handler.js";
import type { PremiseEvidence } from "../../server/thinker/premise-check.js";
import { scenarioOfBridge, trainingOfBridge, type DemoBridgeData } from "./data.js";
import { sampleModelClient, type SampleFn } from "./sample-client.js";

/** An empty premise-evidence table: it covers no view, so `premiseCheck` is null everywhere (the handler's no-entry path). */
export const NO_PREMISE_EVIDENCE: PremiseEvidence = { version: 0, draft: true, directivePremisesSha256: "", views: {}, sha256: "" };

export interface BridgeClock {
  /** A monotonic millisecond clock, for the latency. */
  readonly nowMs: () => number;
  readonly nowIso: () => string;
}

/** The page's clocks (outside the run loop: the proxy's latency and log time, as on the server). */
export const browserClock: BridgeClock = {
  nowMs: () => performance.now(), // determinism-lint-allow: the demo bridge's latency, the proxy's own measure (outside the run loop)
  nowIso: () => new Date().toISOString(), // determinism-lint-allow: the demo bridge's log time (no log is written)
};

export interface BridgeResult { readonly status: number; readonly body: unknown }

export interface BridgeServer {
  /** One request to `/api/thinker` (`haku`) or `/api/thinker-open` (`open_thinker`), the parsed body; never rejects. */
  serve(tool: ThinkerTool, body: unknown): Promise<BridgeResult>;
}

/** The browser's `ThinkerDeps` for one chat: Haku's calls use the runtime's default caching, the Open Thinker's `cache: false`. */
export function browserThinkerDeps(sample: SampleFn, data: DemoBridgeData, tool: ThinkerTool, clock: BridgeClock = browserClock, sessionModelVersions = new Map<string, string>()): ThinkerDeps {
  return {
    scenario: scenarioOfBridge(data.scenario),
    training: trainingOfBridge(data.training),
    vector: null,
    ...data.prompts,
    premiseEvidence: NO_PREMISE_EVIDENCE,
    // No pin: the study proxy's pin (`THINKER_EXPECTED_MODEL_VERSION`) is a server setting and stays as it is.
    expectedModelVersion: null,
    sessionModelVersions,
    client: sampleModelClient(sample, { cache: tool === "haku" }),
    appendLog: async () => undefined,
    nowMs: clock.nowMs,
    nowIso: clock.nowIso,
  };
}

export function createBridgeServer(sample: SampleFn, data: DemoBridgeData, clock: BridgeClock = browserClock): BridgeServer {
  const builds = new Map<string, string>();
  const deps = { haku: browserThinkerDeps(sample, data, "haku", clock, builds), open_thinker: browserThinkerDeps(sample, data, "open_thinker", clock, builds) };
  return {
    async serve(tool, body) {
      try {
        const result = tool === "haku" ? await handleThinkerRequest(deps.haku, body) : await handleOpenThinkerRequest(deps.open_thinker, body);
        return result.status === 200 ? { status: 200, body: { ...result.body, modelId: DEMO_BRIDGE_MODEL_ID } } : result;
      } catch (e) {
        // As the server's HTTP layer (`http.ts`): a thrown handler is a 500.
        console.error("demo bridge: request failed", e instanceof Error ? e.message : e);
        return { status: 500, body: { error: "internal error" } };
      }
    },
  };
}
