/**
 * The end of a session (SPEC/05 §9), as the end screen runs it — kept free of the DOM so it is
 * tested directly (`test/telemetry/session-end.spec.ts`):
 *
 * 1. `completeSession()` — DEBRIEF_HANDOFF -> COMPLETE and `session_completed`, durable (I5);
 * 2. the registry marks the session `complete` (a reload now offers the upload, not a resume);
 * 3. only now, with the engine in COMPLETE, the upload starts (I3);
 * 4. on success the registry marks it `uploaded`; on failure the screen offers a retry and the
 *    one-click export. In a demonstration the export is always offered.
 */

import type { EngineState } from "../engine/freeze-machine.js";
import type { LogHeader, LogRecord } from "./log.js";
import type { SessionStatus } from "./session-registry.js";
import type { SessionUploadInput } from "./session-upload.js";

export type EndPhase = "completing" | "uploading" | "uploaded" | "failed";

export interface EndState {
  readonly phase: EndPhase;
  /** The one-click export: after a failed upload, and always in a demonstration. */
  readonly offerDownload: boolean;
  readonly error?: string;
}

export interface SessionEndDeps {
  readonly completeSession: () => Promise<void>;
  readonly engineState: () => EngineState;
  readonly header: LogHeader;
  readonly records: () => Promise<readonly LogRecord[]>;
  readonly upload: (input: SessionUploadInput) => Promise<void>;
  /** The registry's status update; absent when the session has no registry entry (in-memory sessions). */
  readonly setStatus?: (status: SessionStatus) => Promise<void>;
  readonly demo: boolean;
}

export async function finishSession(deps: SessionEndDeps, onState: (state: EndState) => void): Promise<EndState> {
  const emit = (state: EndState) => { onState(state); return state; };
  emit({ phase: "completing", offerDownload: deps.demo });
  try {
    await deps.completeSession();
    await deps.setStatus?.("complete");
  } catch (e) {
    return emit({ phase: "failed", offerDownload: true, error: e instanceof Error ? e.message : String(e) });
  }
  return uploadFinished(deps, onState);
}

/** The upload alone (the retry button, or a finished session found on load). */
export async function uploadFinished(deps: Omit<SessionEndDeps, "completeSession">, onState: (state: EndState) => void): Promise<EndState> {
  const emit = (state: EndState) => { onState(state); return state; };
  emit({ phase: "uploading", offerDownload: deps.demo });
  try {
    await deps.upload({ engineState: deps.engineState(), header: deps.header, records: await deps.records() });
  } catch (e) {
    return emit({ phase: "failed", offerDownload: true, error: e instanceof Error ? e.message : String(e) });
  }
  try { await deps.setStatus?.("uploaded"); } catch { /* the server has the file; a stale status only re-offers an idempotent upload */ }
  return emit({ phase: "uploaded", offerDownload: deps.demo });
}
