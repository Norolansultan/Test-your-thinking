/**
 * Session logs → `responses.csv` and `exposure.csv` for `score_freezes.py` (`tools/skills/responses.ts`), on the sessions
 * the repository already builds: the telemetry coverage script (`test/telemetry/scripted-session.ts`, every record kind
 * once) and a whole session driven by the SPEC/30 helpers (`test/session/spec30-helpers.ts`, the Haku group), whose
 * freezes are answered here (the helpers submit them empty).
 *
 * With SKILLS_SESSIONS_DIR set, the session files are also written there (for running the skills' scripts by hand).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { exportSessionFile } from "../../app/telemetry/session-file.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import type { FreezeItemAnsweredDetail } from "../../app/telemetry/record-kinds.js";
import { MAP_POINT_OPTION_ID } from "../../app/session/freeze-answers.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { runScriptedSession } from "../telemetry/scripted-session.js";
import { completeView, scenario, startSession, type Running } from "../session/spec30-helpers.js";
import { convertSessions, parseSessionFile, recordCycles } from "../../tools/skills/responses.js";
import { buildItems } from "../../tools/skills/items.js";
import { buildChannels } from "../../tools/skills/facts.js";
import { inBox } from "../../tools/skills/geo.js";

const items = buildItems(scenario);
const { facts, radio } = buildChannels(scenario);
const CONFIDENCES = [25, 50, 75, 100] as const;

/** Answers a freeze's items: a choice item by a rotating option, a map item at the ignition point; confidence rotating. */
function answersFor(view: Running): FreezeItemAnsweredDetail[] {
  return (view.snap().freeze?.items ?? []).map((it, i) => (it.kind === "map_point"
    ? { itemId: it.id, optionId: MAP_POINT_OPTION_ID, confidence: CONFIDENCES[i % 4]!, point: SITE_SCENARIO.ignition }
    : { itemId: it.id, optionId: it.options[i % it.options.length]!.id, confidence: CONFIDENCES[i % 4]! }));
}

/** A whole session in the Haku group, every freeze answered; its session file. */
async function drivenSession(participantCode: string): Promise<string> {
  const r = await startSession("radio", { participantCode });
  const submit = r.o.submitFreeze.bind(r.o);
  r.o.submitFreeze = (responses, options) => submit(responses.length > 0 ? responses : answersFor(r), options);
  for (let v = 0; v <= 14; v++) await completeView(r);
  return exportSessionFile(r.o.logHeader, await r.o.logRecords(), true);
}

function scriptedSessionFile(records: readonly LogRecord[]): string {
  const header = records.find((x) => x.kind === "session_started")!.detail as LogHeader;
  return exportSessionFile(header, records, true);
}

const files: { name: string; text: string }[] = [];

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  files.push({ name: "session-P-SK1.jsonl", text: await drivenSession("P-SK1") });
  files.push({ name: "session-scripted.jsonl", text: scriptedSessionFile((await runScriptedSession()).records) });
  const out = process.env.SKILLS_SESSIONS_DIR;
  if (out) { mkdirSync(out, { recursive: true }); for (const f of files) writeFileSync(join(out, f.name), f.text); }
}, 300_000);
afterAll(() => vi.useRealTimers());

describe("session logs as score_freezes.py's responses and exposure", () => {
  it("reads a session file back: the header and every record, gapless", () => {
    const s = parseSessionFile(files[0]!.text);
    expect(s.header.participantCode).toBe("P-SK1");
    expect(s.records.length).toBeGreaterThan(100);
  });

  it("gives every answered item of the driven session one row: all freeze items, every SPAM item, the hinge check", () => {
    const { responses } = convertSessions([files[0]!.text], scenario);
    const ids = new Set(items.map((i) => i.id));
    for (const r of responses) expect(ids.has(r.item_id), r.item_id).toBe(true);
    const byProbe = (p: string) => responses.filter((r) => items.find((i) => i.id === r.item_id)!.probe === p).length;
    expect(byProbe("freeze")).toBe(items.filter((i) => i.probe === "freeze").length);
    expect(byProbe("spam")).toBe(items.filter((i) => i.probe === "spam").length);
    expect(byProbe("hinge_check")).toBe(1);
    expect(new Set(responses.map((r) => r.item_id)).size).toBe(responses.length);
  });

  it("rescales confidence to 0..1, writes map answers as E;N in EPSG:3067 and times every answer", () => {
    const { responses, responsesCsv } = convertSessions([files[0]!.text], scenario);
    expect(responsesCsv.split("\n")[0]).toBe("participant,item_id,answer,confidence,rt_s");
    for (const r of responses.filter((x) => x.item_id !== "hinge.manipulation_check")) expect([0.25, 0.5, 0.75, 1]).toContain(r.confidence);
    const maps = responses.filter((r) => items.find((i) => i.id === r.item_id)!.type === "point");
    expect(maps.length).toBe(items.filter((i) => i.type === "point").length);
    for (const r of maps) {
      const [e, n] = r.answer.split(";").map(Number);
      expect(inBox([e!, n!]), r.answer).toBe(true);
    }
    for (const r of responses) expect(r.rt_s === null || r.rt_s >= 0, r.item_id).toBe(true);
  });

  it("folds exposure into first-seen cycles: known facts only, cycles 0–20, a pushed fact first seen in the cycle it is pushed", () => {
    const { exposure, exposureCsv } = convertSessions([files[0]!.text], scenario);
    expect(exposureCsv.split("\n")[0]).toBe("participant,fact_id,first_seen_cycle");
    const known = new Set(facts.map((f) => f.id));
    expect(exposure.length).toBeGreaterThan(100);
    for (const e of exposure) {
      expect(known.has(e.fact_id), e.fact_id).toBe(true);
      expect(e.first_seen_cycle >= 0 && e.first_seen_cycle <= 20).toBe(true);
    }
    const pushedAt = new Map(radio.flatMap((m) => m.fact_ids.map((id) => [id, m.cycle] as const)));
    const seen = new Map(exposure.map((e) => [e.fact_id, e.first_seen_cycle]));
    for (const [id, cycle] of pushedAt) if (seen.has(id)) expect(seen.get(id), id).toBe(cycle);
  });

  it("places records in cycles by their view and virtual time, never backwards within a view", () => {
    const s = parseSessionFile(files[0]!.text);
    const cycles = recordCycles(s.records, scenario);
    expect(Math.max(...cycles)).toBe(20);
    expect(cycles.every((c, i) => i === 0 || c >= cycles[i - 1]!)).toBe(true);
  });

  it("reads the telemetry coverage script's session too: its SPAM answer and hinge check, its unknown freeze item kept as given", () => {
    const { responses } = convertSessions([files[1]!.text], scenario);
    expect(responses.find((r) => r.item_id === "probe.s.cycle_3")?.answer).toBe("b");
    expect(responses.find((r) => r.item_id === "hinge.manipulation_check")?.answer).toBe("b");
    expect(responses.find((r) => r.item_id === "freeze.2.1")?.confidence).toBe(0.6);
  });

  it("converts several sessions into one file per measure, deterministically", () => {
    const a = convertSessions(files.map((f) => f.text), scenario), b = convertSessions(files.map((f) => f.text), scenario);
    expect(a.responsesCsv).toBe(b.responsesCsv);
    expect(a.exposureCsv).toBe(b.exposureCsv);
    expect(new Set(a.responses.map((r) => r.participant))).toEqual(new Set(["P-SK1", "scripted-participant"]));
  });
});
