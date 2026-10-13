/**
 * The session file (SPEC/04 §10: "append-only JSONL, one file per session, with a self-describing
 * header") as it is uploaded and as the one-click export writes it (SPEC/05 §9):
 *
 *   {"header":{…LogHeader…}}
 *   {"seq":0,"tVirtual":0,"tWallOffsetMs":0,"kind":"session_started","detail":{…}}
 *   …one line per record, in seq order…
 *   {"manifest":{…}}                       ← the last line (server on completion, or browser export)
 *
 * Lines are `JSON.stringify` of the objects as logged, so identical sessions give identical bytes.
 * The manifest line closes the file and lets anyone check it: `sha256` covers every line before it
 * (joined by "\n", with a final "\n"), and `lines` counts them.
 */

import { assertGapless, type LogHeader, type LogRecord } from "./log.js";
import { sha256Hex } from "./sha256.js";

export const SESSION_FILE_FORMAT = "fire-sim-session-jsonl/1";

export interface SessionManifest {
  readonly format: typeof SESSION_FILE_FORMAT;
  readonly sessionId: string;
  readonly lines: number;
  readonly records: number;
  readonly sha256: string;
  /** Who closed the file: the upload server on completion, or the participant's browser export. */
  readonly writtenBy: "server" | "browser_export";
  /** Present on the server's manifest: chunks received, and the server's wall clock on completion. */
  readonly chunks?: number;
  readonly completedAtIso?: string;
  /** Present on a browser export: whether the session had reached COMPLETE. */
  readonly sessionComplete?: boolean;
}

/** The session file's lines (header + records), without a manifest. Records must be gapless (I5). */
export function sessionFileLines(header: LogHeader, records: readonly LogRecord[]): string[] {
  assertGapless(records);
  return [JSON.stringify({ header }), ...records.map((r) => JSON.stringify(r))];
}

/** The text the manifest's `sha256` covers: the lines joined by "\n", with a final "\n". */
export function linesText(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

export function manifestLine(manifest: SessionManifest): string {
  return JSON.stringify({ manifest });
}

/** The whole file the participant downloads when the upload cannot complete (or in a demonstration). */
export function exportSessionFile(header: LogHeader, records: readonly LogRecord[], sessionComplete: boolean): string {
  const lines = sessionFileLines(header, records);
  const body = linesText(lines);
  const manifest: SessionManifest = {
    format: SESSION_FILE_FORMAT, sessionId: header.sessionId, lines: lines.length, records: records.length,
    sha256: sha256Hex(body), writtenBy: "browser_export", sessionComplete,
  };
  return `${body}${manifestLine(manifest)}\n`;
}

/** The file name of an export: `session-<sessionId>.jsonl`. */
export function exportFileName(sessionId: string): string {
  return `session-${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.jsonl`;
}
