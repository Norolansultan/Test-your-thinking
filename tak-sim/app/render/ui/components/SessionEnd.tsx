/**
 * The end of the session (SPEC/05 §9): completes the session (COMPLETE, `session_completed`), then
 * uploads the log (`app/telemetry/session-end.ts`). If the upload cannot complete, a retry and the
 * one-click export of the session file; in a demonstration the export is always offered.
 */

import { useEffect, useState } from "preact/hooks";
import type { SessionOrchestrator } from "../../../session/orchestrator.js";
import type { LogHeader, LogRecord } from "../../../telemetry/log.js";
import { exportFileName, exportSessionFile } from "../../../telemetry/session-file.js";
import { finishSession, uploadFinished, type EndState, type SessionEndDeps } from "../../../telemetry/session-end.js";
import { uploadSession } from "../../../telemetry/session-upload.js";
import type { SessionStatus } from "../../../telemetry/session-registry.js";
import { useLang } from "../i18n.js";

/** Saves the session file through the browser's download (a Blob URL; no network). */
export function downloadSessionFile(header: LogHeader, records: readonly LogRecord[], complete: boolean): void {
  const blob = new Blob([exportSessionFile(header, records, complete)], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(header.sessionId);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SessionDataPanel({ state, onRetry, onDownload }: { readonly state: EndState; readonly onRetry: () => void; readonly onDownload: () => void }) {
  const { t } = useLang();
  const d = t.sessionData;
  const message = state.phase === "uploaded" ? d.uploaded : state.phase === "failed" ? d.uploadFailed : d.uploading;
  return (
    <div data-testid="session-data" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
      <p role={state.phase === "failed" ? "alert" : "status"} style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {state.phase === "failed" && <button style={buttonStyle} onClick={onRetry}>{d.retryUpload}</button>}
        {state.offerDownload && <button style={buttonStyle} onClick={onDownload}>{d.download}</button>}
      </div>
    </div>
  );
}

export function SessionEnd({ orchestrator, demo, setStatus }: { readonly orchestrator: SessionOrchestrator; readonly demo: boolean; readonly setStatus?: ((status: SessionStatus) => Promise<void>) | undefined }) {
  const { t } = useLang();
  const [state, setState] = useState<EndState>({ phase: "completing", offerDownload: demo });
  const deps: SessionEndDeps = {
    completeSession: () => orchestrator.completeSession(),
    engineState: () => orchestrator.engineState,
    header: orchestrator.logHeader,
    records: () => orchestrator.logRecords(),
    upload: (input) => uploadSession(input),
    ...(setStatus ? { setStatus } : {}),
    demo,
  };
  useEffect(() => { void finishSession(deps, setState); }, []);
  const download = () => { void orchestrator.logRecords().then((records) => downloadSessionFile(orchestrator.logHeader, records, orchestrator.engineState === "COMPLETE")); };
  return (
    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, padding: 24 }}>
      <p style={{ maxWidth: 560, lineHeight: 1.5, margin: 0 }}>{t.done}</p>
      <SessionDataPanel state={state} onRetry={() => void uploadFinished(deps, setState)} onDownload={download} />
      {demo && <p style={{ opacity: 0.7, margin: 0, fontSize: 14 }}>{t.sessionData.demoDownloadNote}</p>}
    </div>
  );
}

export const buttonStyle = {
  padding: "12px 24px", fontSize: 15, borderRadius: 8, border: "1px solid #3a3f44", background: "#2a2f34", color: "#e8eaed", cursor: "pointer",
};
