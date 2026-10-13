/**
 * SPEC/28 §5: the shell a session runs in is logged in its header (`uiShell: "tak" | "classic"`), so data from the two
 * shells are never pooled silently (SPEC/00 §6). It arrives with the header's annotations — chosen on the start page,
 * outside the run loop, never read by the session — so identical inputs still give an identical log (I1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_ANNOTATIONS, sessionHeader, type HeaderAnnotations } from "../../app/session/header.js";
import { sessionFileLines } from "../../app/telemetry/session-file.js";
import { runThrough, scenario } from "../session/session-run.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const tak: HeaderAnnotations = { ...FIXED_ANNOTATIONS, uiShell: "tak" };
const classic: HeaderAnnotations = { ...FIXED_ANNOTATIONS, uiShell: "classic" };

describe("the header's uiShell", () => {
  it("records the shell the launcher annotated, and nothing when none was (tests, tools, logs before 13 Oct 2026)", () => {
    expect(sessionHeader(scenario, "substitutive", "P-1", "en", null, false, "reasoning_once", undefined, tak).uiShell).toBe("tak");
    expect(sessionHeader(scenario, "directed", "P-1", "fi", null, true, "radio", undefined, classic).uiShell).toBe("classic");
    expect(sessionHeader(scenario, "directed", "P-1", "fi", null)).not.toHaveProperty("uiShell");
  });

  it("is in the running session's header and its session_started record", async () => {
    const { o } = await runThrough(-1, { annotations: tak });
    expect(o.logHeader.uiShell).toBe("tak");
    const records = await o.logRecords();
    const started = records.find((r) => r.kind === "session_started");
    if (started) expect((started.detail as { uiShell?: string }).uiShell).toBe("tak");
    expect(sessionFileLines(o.logHeader, records)[0]).toContain('"uiShell":"tak"');
  });

  it("changes only the header between a TAK and a classic session with otherwise identical inputs", async () => {
    vi.setSystemTime(0);
    const a = await runThrough(0, { annotations: tak });
    const la = sessionFileLines(a.o.logHeader, await a.o.logRecords());
    vi.setSystemTime(0);
    const b = await runThrough(0, { annotations: classic });
    const lb = sessionFileLines(b.o.logHeader, await b.o.logRecords());
    expect(lb).toHaveLength(la.length);
    const differing = la.map((line, i) => (line === lb[i] ? null : i)).filter((i) => i !== null);
    expect(differing.length).toBeGreaterThan(0);
    for (const i of differing) expect(la[i]).toContain('"uiShell":"tak"');
    expect(differing.every((i) => i! <= 1)).toBe(true); // the header line and the session_started record only
  });
});
