/**
 * SPEC/35 §1, §9 P1: the public-audience version changes nothing in an expert session. A whole study-shell session (consent, the
 * AI literacy test, the preflight, the pre-session item, the intro video, VP, the training, V1–V14 with the hinge, the post-session
 * questionnaire, the debrief, the end) is run in each cell with the options the app gives it, and its records are compared with
 * the same run's records before the layer was built (commit fccaa56, telemetry format 0.12.0): identical, byte for byte, except
 * the header's new fields (`audience`, `scope`) and its format version in `session_started`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogRecord } from "../../app/telemetry/log.js";
import { sha256Hex } from "../../app/telemetry/sha256.js";
import { TELEMETRY_FORMAT_VERSION } from "../../app/telemetry/record-kinds.js";
import { driveSession, newStudySession, wholeSession } from "./public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The records with `session_started`'s header stripped of the fields 0.13.0 adds or changes. */
function withoutNewHeaderFields(records: readonly LogRecord[]): string {
  return records.map((r) => {
    if (r.kind !== "session_started") return JSON.stringify(r);
    const { formatVersion: _version, audience: _audience, scope: _scope, ...rest } = r.detail as Record<string, unknown>;
    return JSON.stringify({ ...r, detail: rest });
  }).join("\n");
}

/** The digests of the same runs at fccaa56 (before SPEC/35 P1): 502 records each. */
const BEFORE: Readonly<Record<"radio" | "reasoning_once" | "reasoning_intent", string>> = {
  radio: "b0a7259d27a6e269585745d12f47a5220ed95e2c6f7d72039f16023b4675fd46",
  reasoning_once: "16221cec25e37ce70aeeeb97cfa6774bdf314eba280bd02a80c4ea1e3f2d96ee",
  reasoning_intent: "e35af1bf9d6301e75f702dbb33dd5d642c70ca372cc54e540d750957eda977ec",
};

describe("an expert session is unchanged by the public-audience version (SPEC/35 §1)", () => {
  for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
    it(`${cell}: the records are those of 0.12.0 except the header's new fields`, async () => {
      const { o, records } = await wholeSession({ cell });
      expect(records).toHaveLength(502);
      expect(sha256Hex(withoutNewHeaderFields(records))).toBe(BEFORE[cell]);
      // The header's new fields are present, with the expert defaults.
      expect(o.logHeader).toMatchObject({ formatVersion: TELEMETRY_FORMAT_VERSION, audience: "expert", scope: "full" });
      expect(records[0]!.detail).toEqual(o.logHeader);
      expect(records.some((r) => ["primer_page", "primer_check", "glossary_opened", "help_card_opened", "profile_shown"].includes(r.kind))).toBe(false);
    }, 60_000);
  }

  it("a session given `audience: \"expert\"` and `scope: \"full\"` explicitly writes the same records as one given neither", async () => {
    const a = await wholeSession({});
    const b = await wholeSession({ audience: "expert", scope: "full" });
    expect(b.records.map((r) => JSON.stringify(r))).toEqual(a.records.map((r) => JSON.stringify(r)));
  }, 60_000);

  it("the explanation layer's callbacks write nothing in an expert session, and it has no primer", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["exploration"]);
    expect(snap().practice).toBe(true);
    const before = (await o.logRecords()).length;
    await o.recordAudienceEvent({ kind: "glossary_opened", termId: "fire.head", surface: "message_log" });
    await o.recordAudienceEvent({ kind: "help_card_opened", section: "glossary" });
    expect(await o.logRecords()).toHaveLength(before);
    await expect(o.primerPage("p1.role", 1_000)).rejects.toThrow(/expert session has no primer/);
    await expect(o.finishPrimer()).rejects.toThrow(/finishPrimer in step/);
  });
});
