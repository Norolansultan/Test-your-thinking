/**
 * Session logs → `responses.csv` and `exposure.csv` for `score_freezes.py` (`tools/skills/responses.ts`), on the sessions
 * the repository already builds: the telemetry coverage script (`test/telemetry/scripted-session.ts`, every record kind
 * once) and whole sessions driven by the SPEC/30 helpers (`test/session/spec30-helpers.ts`), whose freezes are answered
 * here (the helpers submit them empty): P-SK1 in the Haku group, and P-SK2 in the guide group (`reasoning_intent`), whose
 * Open Thinker answers come from a scripted proxy carrying the model's context (`GUIDE_CONTEXT`, format 0.11.0), so the
 * export's `digest` and `recent` routes and the analysis folds that read them run end to end on a driven session.
 *
 * With SKILLS_SESSIONS_DIR set, the session files are also written there (for running the skills' scripts by hand).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { exportSessionFile } from "../../app/telemetry/session-file.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, FreezeItemAnsweredDetail } from "../../app/telemetry/record-kinds.js";
import {
  atomExposure, F7_GRID_ATOM_ID, F7_PLANTED_ATOM_ID, freezeItemExposure, freezeItemScores, H2_PRIMARY_WINDOW, plantedExposure, type ExposureOptions,
} from "../../app/telemetry/freeze-measures.js";
import { errorClasses, exposureConditionalScores } from "../../app/telemetry/error-classes.js";
import { aiStatedKey, recordReleaseTimes } from "../../app/telemetry/ai-stated-key.js";
import { h2tSplit } from "../../app/telemetry/teaming-measures.js";
import { MAP_POINT_OPTION_ID } from "../../app/session/freeze-answers.js";
import type { OpenThinkerTransport } from "../../app/session/thinker-transport.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { runScriptedSession } from "../telemetry/scripted-session.js";
import { completeView, scenario, startSession, type Running } from "../session/spec30-helpers.js";
import { convertSessions, parseSessionFile, recordCycles } from "../../tools/skills/responses.js";
import { main as skillsExport } from "../../tools/skills/export.js";
import { buildItems } from "../../tools/skills/items.js";
import { buildChannels } from "../../tools/skills/facts.js";
import { inBox } from "../../tools/skills/geo.js";

const items = buildItems(scenario);
const { facts, radio } = buildChannels(scenario);
const CONFIDENCES = [25, 50, 75, 100] as const;

type ScreenItem = { readonly id: string; readonly options: readonly { readonly id: string }[] };
/** How a driver picks a choice item's option: P-SK1 rotates; P-SK2 answers wrong (every scored item then has an error class). */
type Pick = (view: number, item: ScreenItem, i: number) => string;
const rotating: Pick = (_view, it, i) => it.options[i % it.options.length]!.id;
const wrong: Pick = (view, it, i) =>
  scenario.freezes.find((f) => f.cycle === view)?.items.find((x) => x.id === it.id)?.options.find((o) => !o.correct)?.id ?? rotating(view, it, i);

/** Answers a freeze's items: a choice item by `pick`, a map item at the ignition point; confidence rotating. */
function answersFor(r: Running, pick: Pick): FreezeItemAnsweredDetail[] {
  const view = r.snap().currentCycle as number;
  return (r.snap().freeze?.items ?? []).map((it, i) => (it.kind === "map_point"
    ? { itemId: it.id, optionId: MAP_POINT_OPTION_ID, confidence: CONFIDENCES[i % 4]!, point: SITE_SCENARIO.ignition }
    : { itemId: it.id, optionId: pick(view, it, i), confidence: CONFIDENCES[i % 4]! }));
}

/**
 * The guide group's scripted proxy (SPEC/31 §3.6, format 0.11.0): what reached the Open Thinker's model without a search when the
 * participant asked at a view's start — ids as the proxy's `latestDigest` (newest record per source) and `recentMatches` (the current
 * step's records) could put them there, none of them pushed in the AI condition, none searched by the driver:
 * - V5 (step 7): the digest holds the newest forecast `evt.wx.03` (step 6), the key record of V5's L3 item `freeze.5.ek14_shelter`
 *   (H2's window), and the grid operator's record (F7's contradicting record, step 6); the recent matches hold DR2's road record
 *   `evt.c07.017` (step 7), the key of V5's retrieval-only L1 item `freeze.5.infra` (sagat F30).
 * - V6 (step 8): the digest holds the planted false record (step 8; H9's `plantedExposure`).
 */
const GUIDE_CONTEXT: ReadonlyMap<number, { readonly digest: readonly string[]; readonly recent: readonly string[] }> = new Map([
  [5, { digest: ["evt.wx.03", F7_GRID_ATOM_ID], recent: ["evt.c07.017"] }],
  [6, { digest: [F7_PLANTED_ATOM_ID], recent: [] }],
]);
/** V5's items the context reaches: the key by the digest, the key by the recent matches, and one with only one of its two key records. */
const DIGEST_ITEM = "freeze.5.ek14_shelter", RECENT_ITEM = "freeze.5.infra", HALF_ITEM = "freeze.5.wind_shift";
/** An answer that states no freeze key (the driver's question is not about one). */
const GUIDE_ANSWER = "Tarkista tilannekuva ennen päätöstä.";

const guideTransport: OpenThinkerTransport = async (req) => {
  const context = GUIDE_CONTEXT.get(req.view);
  if (!context) throw new Error(`the scripted proxy has no context for V${req.view}`);
  return {
    answer: GUIDE_ANSWER, retrieved: [], modelId: "test-model", promptHash: "c".repeat(64), latencyMs: 2_900, fallback: false, fallbackReason: null,
    retrievalMode: "hybrid", promptVariant: "standard", digestAtomIds: [...context.digest], recentAtomIds: [...context.recent],
  };
};

/**
 * A whole session, every freeze answered; its session file. The Haku group (P-SK1), or with `guide` the guide group: the driver
 * asks the Open Thinker at the start of each view in `GUIDE_CONTEXT` (before its freeze), and answers every choice item wrong.
 */
async function drivenSession(participantCode: string, guide = false): Promise<string> {
  const r = guide
    ? await startSession("reasoning_intent", { participantCode, thinker: { openTransport: guideTransport, wait: async () => {} } })
    : await startSession("radio", { participantCode });
  const pick = guide ? wrong : rotating;
  const submit = r.o.submitFreeze.bind(r.o);
  r.o.submitFreeze = (responses, options) => submit(responses.length > 0 ? responses : answersFor(r, pick), options);
  for (let v = 0; v <= 14; v++) {
    if (guide && GUIDE_CONTEXT.has(r.snap().currentCycle as number)) await r.o.askOpenThinker("Mitä minun pitäisi tarkistaa nyt?");
    await completeView(r);
  }
  return exportSessionFile(r.o.logHeader, await r.o.logRecords(), true);
}

/** The same session as an older proxy and browser logged it (format 0.10.0): no `digestAtomIds`, no `recentAtomIds`. */
function withoutContextIds(text: string): string {
  const s = parseSessionFile(text);
  const header: LogHeader = { ...s.header, formatVersion: "0.10.0" };
  const records = s.records.map((r): LogRecord => {
    if (r.kind === "session_started") return { ...r, detail: header };
    if (r.kind !== "ai_chat_answer_received") return r;
    const { digestAtomIds: _d, recentAtomIds: _r, ...detail } = r.detail as AiChatAnswerReceivedDetail;
    return { ...r, detail };
  });
  return exportSessionFile(header, records, true);
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
  files.push({ name: "session-P-SK2.jsonl", text: await drivenSession("P-SK2", true) });
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
    expect(exposureCsv.split("\n")[0]).toBe("participant,fact_id,first_seen_cycle,route");
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
    expect(a.exposureRetrievedOnlyCsv).toBe(b.exposureRetrievedOnlyCsv);
    expect(new Set(a.responses.map((r) => r.participant))).toEqual(new Set(["P-SK1", "scripted-participant", "P-SK2"]));
  });

  it("counts the model's context (routes digest and recent, format 0.11.0) in exposure.csv, and leaves it out of the retrieved-only file", () => {
    const s = parseSessionFile(files[0]!.text);
    const before = convertSessions([files[0]!.text], scenario);
    const unseen = scenario.atoms.map((a) => a.id).filter((id) => !before.exposure.some((e) => e.fact_id === id));
    const [digestId, recentId, fallbackId] = unseen;
    const last = s.records[s.records.length - 1]!;
    const answer = (seq: number, fallback: boolean, digest: string[], recent: string[]): LogRecord => ({
      seq: seq as LogRecord["seq"], tVirtual: last.tVirtual, tWallOffsetMs: last.tWallOffsetMs + seq, kind: "ai_chat_answer_received",
      detail: { tool: "open_thinker", retrieved: [], fallback, fallbackReason: fallback ? "timeout" : null, digestAtomIds: digest, recentAtomIds: recent },
    });
    const records = [...s.records, answer(s.records.length, false, [digestId!], [recentId!]), answer(s.records.length + 1, true, [fallbackId!], [])];
    const withIds = convertSessions([exportSessionFile(s.header, records, true)], scenario);
    const row = (rows: readonly { fact_id: string; route: string }[], id: string) => rows.find((r) => r.fact_id === id)?.route ?? null;
    expect([row(withIds.exposure, digestId!), row(withIds.exposure, recentId!), row(withIds.exposure, fallbackId!)]).toEqual(["digest", "recent", null]);
    expect([row(withIds.exposureRetrievedOnly, digestId!), row(withIds.exposureRetrievedOnly, recentId!)]).toEqual([null, null]);
    expect(withIds.exposureRetrievedOnlyCsv).toBe(before.exposureRetrievedOnlyCsv);
    expect(withIds.exposure.length).toBe(before.exposure.length + 2);
    for (const e of before.exposureRetrievedOnly) expect(["digest", "recent"]).not.toContain(e.route);
  });
});

describe("a driven guide-group session whose answers carry the model's context (format 0.11.0, SPEC/31 §3.6)", () => {
  const guide = () => files.find((f) => f.name === "session-P-SK2.jsonl")!.text;
  const records = () => parseSessionFile(guide()).records;
  const RETRIEVED_ONLY: ExposureOptions = { includeModelContext: false };
  /** P-SK2's exposure rows by the model's context: V5's answer is in cycle (step) 7, V6's in 8; sorted by cycle, then id. */
  const CONTEXT_ROWS = ["P-SK2,evt.c07.017,7,recent", "P-SK2,evt.wx.03,7,digest", `P-SK2,${F7_GRID_ATOM_ID},7,digest`, `P-SK2,${F7_PLANTED_ATOM_ID},8,digest`];
  const v5Item = (id: string) => scenario.freezes.find((f) => f.cycle === 5)!.items.find((it) => it.id === id)!;

  it("is the fixture it claims: guide group, answers before the freezes with valid ids released by then, none reaching the participant otherwise", () => {
    const s = parseSessionFile(guide());
    expect(s.header).toMatchObject({ participantCode: "P-SK2", cell: "reasoning_intent", formatVersion: "0.12.0" });
    const answers = s.records.filter((r) => r.kind === "ai_chat_answer_received");
    expect(answers.map((r) => r.detail as AiChatAnswerReceivedDetail).map((d) => [d.view, d.tool, d.fallback, d.retrieved, d.digestAtomIds, d.recentAtomIds]))
      .toEqual([...GUIDE_CONTEXT].map(([view, c]) => [view, "open_thinker", false, [], c.digest, c.recent]));
    const freezeAt = (view: number) => s.records.find((r) => r.kind === "freeze_started" && (r.detail as { cycle: number }).cycle === view)!.seq;
    expect(answers[0]!.seq).toBeLessThan(freezeAt(5));
    expect(answers[1]!.seq).toBeLessThan(freezeAt(12));
    const released = recordReleaseTimes(scenario.atoms);
    const contexts = [...GUIDE_CONTEXT.values()];
    answers.forEach((r, i) => {
      for (const id of [...contexts[i]!.digest, ...contexts[i]!.recent]) {
        const atom = scenario.atoms.find((a) => a.id === id);
        expect(atom, id).toBeDefined();
        expect(atom!.routes.substitutive?.kind, id).not.toBe("pushed");
        expect(released.get(id), id).toBeLessThanOrEqual(r.tVirtual as number);
      }
    });
    // Never pushed, searched or retrieved: without the model's context none of them ever reaches the participant.
    const all = [...GUIDE_CONTEXT.values()].flatMap((c) => [...c.digest, ...c.recent]);
    expect(atomExposure(s.records, all, Number.MAX_SAFE_INTEGER, RETRIEVED_ONLY).filter((e) => e.reached)).toEqual([]);
    // The digest's record is the key of a phase-A L3 item in H2's window (and score_freezes.py's fact for it); the recent one is
    // the key of V5's retrieval-only L1 item; the half item needs the earlier forecast too.
    expect(v5Item(DIGEST_ITEM)).toMatchObject({ level: "L3", keyAtomIds: ["evt.wx.03"], basisKind: "record", basisAtomIds: ["evt.wx.03"] });
    expect(H2_PRIMARY_WINDOW.views).toContain(5);
    expect(items.find((i) => i.id === DIGEST_ITEM)!.fact_ids).toEqual(["evt.wx.03"]);
    expect(v5Item(RECENT_ITEM)).toMatchObject({ level: "L1", keyAtomIds: ["evt.c07.017"] });
    expect(v5Item(HALF_ITEM).keyAtomIds).toEqual(["evt.wx.03", "evt.wx.02"]);
  });

  it("the export writes the digest and recent rows into exposure.csv, and none into exposure_retrieved_only.csv", async () => {
    const dir = mkdtempSync(join(tmpdir(), "skills-responses-"));
    try {
      const paths = files.map((f) => { const p = join(dir, f.name); writeFileSync(p, f.text); return p; });
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await skillsExport(["--responses", ...paths, "--out", dir]);
      log.mockRestore();
      const rows = (name: string) => readFileSync(join(dir, name), "utf8").trim().split("\n").slice(1);
      const exposure = rows("exposure.csv"), retrievedOnly = rows("exposure_retrieved_only.csv");
      const byModelContext = (r: string) => /,(digest|recent)$/.test(r);
      expect(exposure.filter(byModelContext)).toEqual(CONTEXT_ROWS);
      expect(retrievedOnly.filter(byModelContext)).toEqual([]);
      const contextIds = new Set(CONTEXT_ROWS.map((r) => r.split(",")[1]));
      expect(retrievedOnly.filter((r) => r.startsWith("P-SK2,") && contextIds.has(r.split(",")[1]))).toEqual([]);
      // Nothing that first came by the model's context was retrieved later: the sensitivity is the primary file without those rows.
      expect(exposure.filter((r) => !byModelContext(r))).toEqual(retrievedOnly);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("V5's L3 item reached only by the digest: EXPOSED_WRONG by the pre-registered definition, NOT_EXPOSED retrieved-only; told neither", () => {
    const rs = records();
    const row = (id: string, opts: ExposureOptions = {}) => errorClasses(rs, scenario.freezes, opts).find((r) => r.itemId === id)!;
    expect(row(DIGEST_ITEM)).toMatchObject({ view: 5, level: "L3", correct: false, errorClass: "EXPOSED_WRONG", exposed: true, routes: ["digest"], stated: false });
    expect(row(DIGEST_ITEM, RETRIEVED_ONLY)).toMatchObject({ errorClass: "NOT_EXPOSED", exposed: false, routes: [] });
    // One of two key records in the digest is not exposure under either definition.
    expect(row(HALF_ITEM)).toMatchObject({ errorClass: "NOT_EXPOSED", exposed: false, routes: ["digest"] });
    expect(row(HALF_ITEM, RETRIEVED_ONLY)).toMatchObject({ errorClass: "NOT_EXPOSED", exposed: false, routes: [] });
    const key = (opts: ExposureOptions = {}) => freezeItemExposure(rs, scenario.freezes, opts).find((e) => e.itemId === DIGEST_ITEM)!;
    expect(key()).toMatchObject({ view: 5, allReached: true, keyAtoms: [{ atomId: "evt.wx.03", reached: true, route: "digest", routes: ["digest"] }] });
    expect(key(RETRIEVED_ONLY)).toMatchObject({ allReached: false, keyAtoms: [{ atomId: "evt.wx.03", reached: false, route: null, routes: [] }] });
    // The told class reads the stream and the answers' text, not the model's context: the digest pushed nothing to the participant
    // and the answer stated no key, so the item stays in H2t's "neither" stratum under both exposure definitions.
    const stated = aiStatedKey(rs, scenario.freezes);
    expect(stated.find((s) => s.itemId === DIGEST_ITEM)).toMatchObject({ view: 5, stated: false, keyPushed: false, toldClass: "neither" });
    const split = h2tSplit(freezeItemScores(rs, scenario.freezes), stated);
    expect(split.neither.pairs.map((p) => p.itemId)).toContain(DIGEST_ITEM);
    expect([...split.streamTold.pairs, ...split.aiTold.pairs].map((p) => p.itemId)).not.toContain(DIGEST_ITEM);
  });

  it("V5's retrieval-only L1 item reached by the recent matches: exposed by the pre-registered definition, not retrieved-only (sagat F30)", () => {
    const f30 = (opts: ExposureOptions = {}) => exposureConditionalScores(records(), scenario.freezes, { ...opts, itemIds: [RECENT_ITEM] });
    expect(f30()).toEqual([{ view: 5, itemId: RECENT_ITEM, level: "L1", correct: false, allReached: true, routes: ["recent"] }]);
    expect(f30(RETRIEVED_ONLY)).toEqual([{ view: 5, itemId: RECENT_ITEM, level: "L1", correct: false, allReached: false, routes: [] }]);
  });

  it("H9's plantedExposure counts the guide's digest: the grid record (V5) and the planted one (V6) before the V12 freeze; neither retrieved-only", () => {
    expect(plantedExposure(records())).toMatchObject({
      view: 12, metPlanted: true, metGrid: true, exposure: "planted_and_grid",
      planted: { route: "digest", routes: ["digest"] }, grid: { route: "digest", routes: ["digest"] },
    });
    expect(plantedExposure(records(), 12, RETRIEVED_ONLY)).toMatchObject({ metPlanted: false, metGrid: false, exposure: "neither" });
  });

  it("as an old log (format 0.10.0, no ids) it still parses and gives the rows it gave before: the retrieved-only ones; the other sessions' rows are unchanged", () => {
    const old = withoutContextIds(guide());
    const s = parseSessionFile(old);
    expect(s.header.formatVersion).toBe("0.10.0");
    expect(s.records.length).toBe(records().length);
    for (const r of s.records.filter((x) => x.kind === "ai_chat_answer_received")) {
      expect(r.detail).not.toHaveProperty("digestAtomIds");
      expect(r.detail).not.toHaveProperty("recentAtomIds");
    }
    const before = convertSessions([old], scenario), now = convertSessions([guide()], scenario);
    expect(before.responsesCsv).toBe(now.responsesCsv);
    expect(before.exposureCsv).toBe(before.exposureRetrievedOnlyCsv);
    expect(before.exposureCsv).toBe(now.exposureRetrievedOnlyCsv);
    expect(now.exposure.length).toBe(before.exposure.length + CONTEXT_ROWS.length);
    expect(errorClasses(s.records, scenario.freezes)).toEqual(errorClasses(records(), scenario.freezes, RETRIEVED_ONLY));
    expect(plantedExposure(s.records)).toMatchObject({ exposure: "neither" });
    const others = convertSessions(files.filter((f) => f.name !== "session-P-SK2.jsonl").map((f) => f.text), scenario);
    const all = convertSessions(files.map((f) => f.text), scenario);
    const notGuide = <T extends { readonly participant: string }>(rows: readonly T[]) => rows.filter((r) => r.participant !== "P-SK2");
    expect(notGuide(all.responses)).toEqual(others.responses);
    expect(notGuide(all.exposure)).toEqual(others.exposure);
    expect(notGuide(all.exposureRetrievedOnly)).toEqual(others.exposureRetrievedOnly);
  });
});
