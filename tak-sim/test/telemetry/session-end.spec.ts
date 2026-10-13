/**
 * The end screen's logic (SPEC/05 §9, I3; `app/telemetry/session-end.ts`): the session completes
 * (COMPLETE, `session_completed`) before the upload starts; a failed upload leaves the one-click
 * export and a retry; a demonstration always offers the export. Driven over a real session.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishSession, uploadFinished, type EndState } from "../../app/telemetry/session-end.js";
import { uploadSession, type SessionUploadInput } from "../../app/telemetry/session-upload.js";
import type { SessionStatus } from "../../app/telemetry/session-registry.js";
import type { SessionOrchestrator } from "../../app/session/orchestrator.js";
import { runThrough } from "../session/session-run.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

let finished: SessionOrchestrator | null = null;
async function atEnd(): Promise<SessionOrchestrator> {
  // One whole session (VP..V14 with the hinge), shared by the tests; each starts from its end screen.
  if (!finished) finished = (await runThrough(14)).o;
  return finished;
}

function deps(o: SessionOrchestrator, upload: (input: SessionUploadInput) => Promise<void>, demo: boolean, statuses: SessionStatus[]) {
  return {
    completeSession: () => o.completeSession(), engineState: () => o.engineState, header: o.logHeader,
    records: () => o.logRecords(), upload, setStatus: async (s: SessionStatus) => void statuses.push(s), demo,
  };
}

describe("the end of the session", () => {
  it("completes first, then uploads: the upload sees COMPLETE and session_completed as the last record", async () => {
    const o = await atEnd();
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    const seen: SessionUploadInput[] = [];
    const states: EndState[] = [];
    const statuses: SessionStatus[] = [];
    const end = await finishSession(deps(o, async (input) => void seen.push(input), false, statuses), (s) => states.push(s));
    expect(end).toEqual({ phase: "uploaded", offerDownload: false });
    expect(states.map((s) => s.phase)).toEqual(["completing", "uploading", "uploaded"]);
    expect(statuses).toEqual(["complete", "uploaded"]);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.engineState).toBe("COMPLETE");
    expect(seen[0]!.records.at(-1)!.kind).toBe("session_completed");
    expect(seen[0]!.records.at(-2)!.detail).toEqual({ from: "DEBRIEF_HANDOFF", to: "COMPLETE", trigger: "handoff_complete" });
  });

  it("a failed upload offers the export and a retry; the retry that succeeds marks the session uploaded", async () => {
    const o = await atEnd();
    const statuses: SessionStatus[] = [];
    let online = false;
    const upload = async () => { if (!online) throw new Error("offline"); };
    const end = await finishSession(deps(o, upload, false, statuses), () => {});
    expect(end).toMatchObject({ phase: "failed", offerDownload: true, error: "offline" });
    expect(statuses).toEqual(["complete"]);
    online = true;
    const retried = await uploadFinished(deps(o, upload, false, statuses), () => {});
    expect(retried).toEqual({ phase: "uploaded", offerDownload: false });
    expect(statuses).toEqual(["complete", "uploaded"]);
  });

  it("the real uploader against no server fails into the export", async () => {
    const o = await atEnd();
    const failing = (input: SessionUploadInput) => uploadSession(input, { http: { fetch: () => Promise.reject(new Error("no server")) }, sleep: async () => {} });
    expect(await finishSession(deps(o, failing, false, []), () => {})).toMatchObject({ phase: "failed", offerDownload: true });
  });

  it("the screen: SessionView shows SessionEnd at the end; the export button follows offerDownload, the retry a failure", () => {
    const view = readFileSync("app/render/ui/components/SessionView.tsx", "utf8");
    expect(view).toMatch(/snapshot\.step === "complete"\) \{\s*return <SessionEnd/);
    const end = readFileSync("app/render/ui/components/SessionEnd.tsx", "utf8");
    expect(end).toMatch(/state\.offerDownload && <button[^>]*onClick=\{onDownload\}/);
    expect(end).toMatch(/state\.phase === "failed" && <button[^>]*onClick=\{onRetry\}/);
    expect(end).toMatch(/finishSession\(deps, setState\)/);
  });

  it("a demonstration offers the export throughout, also after a successful upload", async () => {
    const o = await atEnd();
    const states: EndState[] = [];
    await finishSession(deps(o, async () => {}, true, []), (s) => states.push(s));
    expect(states.every((s) => s.offerDownload)).toBe(true);
  });
});
