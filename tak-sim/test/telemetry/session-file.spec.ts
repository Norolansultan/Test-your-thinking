/**
 * The session file and its hashes (SPEC/04 §10, SPEC/05 §9; 5 Oct 2026): the dependency-free
 * SHA-256 agrees with node:crypto; the bundle hash is the SHA-256 of the scenario's canonical JSON,
 * independent of key order; the export carries a manifest that verifies the file.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { canonicalJson, scenarioBundleHash } from "../../app/telemetry/bundle-hash.js";
import { sha256Hex } from "../../app/telemetry/sha256.js";
import { exportFileName, exportSessionFile, linesText, sessionFileLines } from "../../app/telemetry/session-file.js";
import { GapDetectedError, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";

const nodeSha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256Hex", () => {
  it.each(["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "Äänekoski — palo ✓ 🔥", "x\ny\n"])("agrees with node:crypto for %j", (s) => {
    expect(sha256Hex(s)).toBe(nodeSha(s));
  });
});

describe("the bundle hash", () => {
  it("canonical JSON sorts keys at every depth, keeps array order, writes a bigint as a string", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 10n }, u: undefined })).toBe('{"a":{"c":"10","d":[3,{"y":2,"z":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("is sha256: + the SHA-256 of the scenario bundle's canonical JSON, the same on every build of the contract", () => {
    const hash = scenarioBundleHash(buildDemoScenario());
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hash).toBe(`sha256:${nodeSha(canonicalJson(buildDemoScenario()))}`);
    expect(scenarioBundleHash(buildDemoScenario())).toBe(hash);
  });

  it("changes when the stimulus changes", () => {
    const s = buildDemoScenario();
    const changed = { ...s, atoms: s.atoms.slice(1) };
    expect(scenarioBundleHash(changed)).not.toBe(scenarioBundleHash(s));
  });
});

const HEADER: LogHeader = {
  formatVersion: "0.1.0", sessionId: "0123456789abcdef0123456789abcdef", participantCode: "p", condition: "directed", scenarioId: "s",
  scenarioVersion: "0.1.0", seed: "1", bundleHash: "sha256:00", appVersion: "0.1.0", startedAtIso: "2026-10-05T10:00:00.000Z",
  userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 }, counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
};
const rec = (seq: number, kind: string): LogRecord => ({ seq: asSeq(seq), tVirtual: asVirtualTime(0), tWallOffsetMs: seq * 10, kind, detail: {} });

describe("the session file", () => {
  it("is the header line, then one line per record in seq order", () => {
    const lines = sessionFileLines(HEADER, [rec(0, "session_started"), rec(1, "cycle_start")]);
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toEqual({ header: HEADER });
    expect(JSON.parse(lines[2]!)).toMatchObject({ seq: 1, kind: "cycle_start" });
  });

  it("refuses a log with a gap (I5)", () => {
    expect(() => sessionFileLines(HEADER, [rec(0, "a"), rec(2, "b")])).toThrow(GapDetectedError);
  });

  it("the export ends with a manifest whose sha256 and line count verify everything before it", () => {
    const text = exportSessionFile(HEADER, [rec(0, "session_started"), rec(1, "session_completed")], true);
    const lines = text.trimEnd().split("\n");
    const { manifest } = JSON.parse(lines.pop()!) as { manifest: Record<string, unknown> };
    expect(manifest).toMatchObject({ format: "fire-sim-session-jsonl/1", sessionId: HEADER.sessionId, lines: 3, records: 2, writtenBy: "browser_export", sessionComplete: true });
    expect(manifest.sha256).toBe(nodeSha(linesText(lines)));
    expect(exportFileName(HEADER.sessionId)).toBe(`session-${HEADER.sessionId}.jsonl`);
    expect(exportFileName("../x")).toBe("session-___x.jsonl");
  });
});
