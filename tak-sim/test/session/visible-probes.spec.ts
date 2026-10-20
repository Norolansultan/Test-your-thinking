/**
 * Type U in the running session (readiness round, agent H, 5 Oct 2026; `visible-probes.ts`, placement
 * in `demo-probes.ts`; Type E withdrawn with H6, Type F with Type J, 6 Oct 2026): the schedule's timing
 * against the cap, SPAM, the freeze and the decision panel; delivery and raw telemetry; the view's clock standing
 * still; the tools locked during a probe; the derived measures from raw records with the keys from the
 * scenario; I4 (no key on the screen side, no render import of a key module).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { ProbeToolsLockedError, SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { AREA_FOLLOW_UP_PROMPT_FI, CONTRADICTION_BACKUP_AUTHORED, SPAM_ANSWER_TIMEOUT_MS, SPAM_OFFSET_MS, SPAM_VIEWS, U_OPEN_AT_SECONDS } from "../../app/scenario/demo-probes.js";
import { DECISION_OPENS_AFTER_S, VIEW_MAX_SECONDS } from "../../app/scenario/views.js";
import { probeKeysOf } from "../../app/scenario/probe-keys.js";
import { uncertaintyMeasures } from "../../app/telemetry/probe-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { allocateAndConfirm, answerSpamNow, passHinge, PLAN } from "./view-flow.js";

const scenario = buildDemoScenario();
const probes = scenario.probeSchedule.probes;
const visibleProbes = probes.filter((p) => p.type === "U");
const CODE = "P-1";

function start(code: string, extra: Record<string, unknown> = {}) {
  const o = new SessionOrchestrator(scenario, "substitutive", { participantCode: code, visibleProbes: true, thinker: { transport: vi.fn() }, ...extra });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

/** Answers the open visible probe with a fixed answer of its kind. */
async function answer(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const p = snap().visibleProbe!;
  if (p.kind === "area") await o.submitProbeArea(true, ["east_old_head", "north_edge"]);
  else if (p.kind === "choice") await o.submitProbeChoice(p.options[0]!.id, p.collectsConfidence ? 75 : undefined);
  else await o.submitProbeScale(50);
}

/** The view to its minimum (freezes, probes and SPAM answered — SPAM's prompt no longer expires, revision (ag)), then the plan; probes after the view too. */
async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const view = snap().currentCycle;
  // The practice view's cap equals its minimum (180 s): it is run out only past its SPAM prompt (see `runOutView`), and `allocateAndConfirm` lets the rest of its minimum pass.
  const practice = snap().practice;
  let spamSeen = false;
  const done = () => practice ? spamSeen && snap().spam === null && snap().step === "allocation" : snap().minimumReached && snap().spam === null && snap().step !== "probe";
  while (!done() && snap().currentCycle === view && snap().step !== "complete") {
    if (snap().spam !== null) spamSeen = true;
    if (snap().step === "freeze") await o.submitFreeze([]);
    else if (snap().step === "probe") await answer(o, snap);
    else if (snap().spam !== null) await answerSpamNow(o, snap);
    else await vi.advanceTimersByTimeAsync(1_000);
  }
  await allocateAndConfirm(o, snap);
  while (snap().step === "probe") await answer(o, snap);
  if (snap().step === "training") await o.completeTraining();
  if (snap().step === "hinge_pause") await passHinge(o);
}

async function fullSession(code: string) {
  const s = start(code);
  await s.o.start();
  while (s.snap().step !== "complete") await completeView(s.o, s.snap);
  return { ...s, records: await s.o.logRecords() };
}

const ofView = (records: readonly LogRecord[], view: number) => {
  const startAt = records.findIndex((r) => r.kind === "cycle_start" && (r.detail as { cycle: number }).cycle === view);
  const end = records.findIndex((r, i) => i > startAt && r.kind === "cycle_end");
  return records.slice(startAt, end + 1);
};
const presentedIn = (rs: readonly LogRecord[]) => rs.filter((r) => r.kind === "probe_presented").map((r) => r.detail as { probeId: string; atViewSeconds: number | null; cycle: number; decisionStep: string | null });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the schedule: where U goes, against the view's other moments", () => {
  it("every U probe has a delivery: open at 100 s in V13, the backup and coverage after V14; no Type E, F or J", () => {
    for (const p of visibleProbes) expect(p.delivery, p.id).toBeDefined();
    for (const t of ["E", "F", "J"]) expect(probes.filter((p) => (p.type as string) === t), t).toEqual([]);
    expect(probes.filter((p) => p.type === "U").map((p) => [p.cycle, p.delivery])).toEqual([
      [13, { at: "view_seconds", seconds: U_OPEN_AT_SECONDS }], [14, { at: "after_view" }], [14, { at: "after_view" }],
    ]);
  });

  it("V13's open U: no freeze, SPAM or step boundary in V13; inside the minimum (always delivered, never in the final countdown); the contradicting reports pushed at the view's start", () => {
    const v13 = scenario.cycles.find((c) => c.index === 13)!;
    expect(v13.hasFreeze).toBe(false);
    expect(v13.stepBoundary).toBeNull();
    expect(SPAM_VIEWS.has(13)).toBe(false);
    expect(U_OPEN_AT_SECONDS).toBeLessThanOrEqual(v13.minViewSeconds - 20);
    expect(U_OPEN_AT_SECONDS).toBeGreaterThan(SPAM_OFFSET_MS / 1000 + SPAM_ANSWER_TIMEOUT_MS / 1000); // and V13 carries no SPAM (above): the ready prompt no longer expires (revision (ag))
    for (const id of [scenario.contradiction.premiseAtomId, scenario.contradiction.counterAtomId]) expect(v13.pushedAtomIds).toContain(id);
  });

  it("no visible probe names a tool or a conflict (the open U is non-leading, SPEC/08 §3.5)", () => {
    for (const p of visibleProbes) expect(p.prompt, p.id).not.toMatch(/haku|thinker|tekoäly|työkalu/i);
    for (const p of visibleProbes.filter((x) => x.id !== scenario.contradiction.backupProbeId)) expect(p.prompt, p.id).not.toMatch(/ristiriit|epäjohdonmuk|eriäv/i);
    const open = probes.find((p) => p.id === scenario.contradiction.detectionProbeId)!;
    expect(open.prompt).not.toMatch(/ristiriit|raport|eriä|pohjois|EK14|SPOT/i);
  });

  it("the backup's key is the arranged position of the authored pair (TRUTH, an invariant)", () => {
    const backup = probes.find((p) => p.id === scenario.contradiction.backupProbeId)!;
    const key = scenario.invariants.find((i) => i.name === "contradiction.pair")!.expected;
    expect(backup.response.kind === "categorical" && backup.response.options.find((o) => o.id === key)!.fi).toBe(CONTRADICTION_BACKUP_AUTHORED.key);
    expect(backup.response.kind === "categorical" && backup.response.options.at(-1)!.fi).toBe(CONTRADICTION_BACKUP_AUTHORED.none);
    expect(scenario.invariants.find((i) => i.name === "coverage.all_inside")!.expected).toBe(false);
  });

  it("the backup's pairs cite real pushed reports", () => {
    const pushed = scenario.atoms.filter((a) => a.tier === "T1_pushed").map((a) => (a.record as { text?: string; content?: string }).text ?? (a.record as { content?: string }).content ?? "");
    for (const re of [/^Pohjoisreuna leimahtanut uudelleen, havaittu uutta savua/, /^Oma linjamme pitää, ei muutosta/, /^Kärki lähestyy metsäautotietä luoteesta, etenee kaakkoon arviolta 10 m\/min/, /^DR2 lämpökuva, kaakkoisrintama.*11,5 m\/min/,
      /^Palo pysähtyi metsäautotien \(Honkaharju\) kohdalle/, /^Palon kärki ylitti metsäautotien \(Honkaharju\) klo 19\.00–19\.20 puuskissa \(12 m\/s\)/, /^DR3 kehäkartoitus valmis klo 14\.35: palanut ala noin 24,3 ha/, /^SPOT: .*Palanut ala ilmasta arvioiden noin 160 ha/] /* SPEC/33 stage 9: 11,5, 24,3, 160 (were 10,1, 17,8, 140) */) {
      expect(pushed.some((t) => re.test(t)), String(re)).toBe(true);
    }
  });
});

describe("delivery in a whole session", () => {
  it("no Type E in a whole session: nothing presented at the panel, no area marked, no E order in the header", async () => {
    const { records } = await fullSession(CODE);
    expect((records[0]!.detail as { counterbalance?: unknown }).counterbalance).toBeUndefined();
    expect((records[0]!.detail as { visibleProbes?: boolean }).visibleProbes).toBe(true);
    expect(records.filter((r) => r.kind === "expectation_marked")).toEqual([]);
    expect(presentedIn(records).filter((p) => p.probeId.startsWith("probe.e."))).toEqual([]);
    expect(presentedIn(records).filter((p) => p.atViewSeconds === DECISION_OPENS_AFTER_S)).toEqual([]);
  });

  it("V13's U at 100 s; the backup and coverage after V14 has ended; nothing else", async () => {
    const { records } = await fullSession(CODE);
    expect(presentedIn(records).map((p) => p.probeId)).toEqual(["probe.u.cycle_13", "probe.u.cycle_14", "probe.u.coverage.cycle_14"]);
    const u13 = presentedIn(ofView(records, 13)).find((p) => p.probeId === "probe.u.cycle_13")!;
    expect(u13.atViewSeconds).toBe(U_OPEN_AT_SECONDS);
    const end14 = records.findIndex((r) => r.kind === "view_ended" && (r.detail as { cycle: number }).cycle === 14);
    const after = records.slice(end14).filter((r) => r.kind === "probe_presented" || r.kind === "probe_submitted").map((r) => [r.kind, (r.detail as { probeId: string }).probeId]);
    expect(after).toEqual([
      ["probe_presented", "probe.u.cycle_14"], ["probe_submitted", "probe.u.cycle_14"],
      ["probe_presented", "probe.u.coverage.cycle_14"], ["probe_submitted", "probe.u.coverage.cycle_14"],
    ]);
    expect(presentedIn(records.slice(end14)).every((p) => p.atViewSeconds === null && p.cycle === 14)).toBe(true);
    // Nothing in the practice view.
    expect(presentedIn(ofView(records, 0))).toEqual([]);
  });

  it("the view's clock stands still during a probe: V13's open U takes nothing from the cap, and the moments after it keep their view times", async () => {
    const { o, snap } = start(CODE);
    await o.start();
    while (snap().currentCycle !== 13) await completeView(o, snap);
    await vi.advanceTimersByTimeAsync(U_OPEN_AT_SECONDS * 1000);
    expect(snap().step).toBe("probe");
    const left = snap().secondsLeft;
    await vi.advanceTimersByTimeAsync(VIEW_MAX_SECONDS * 2 * 1000); // far past the cap in real time
    expect(snap().step).toBe("probe");
    expect(snap().currentCycle).toBe(13);
    expect(snap().secondsLeft).toBe(left);
    await o.submitProbeArea(false, []);
    expect(snap().step).toBe("allocation");
    const toMinimum = snap().minViewSeconds - U_OPEN_AT_SECONDS;
    await vi.advanceTimersByTimeAsync((toMinimum - 1) * 1000);
    expect(snap().minimumReached).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(snap().minimumReached).toBe(true);
  });

  it("during a probe: the map and the projection stay, Haku and Thinker are locked, the panel is held; all restored after", async () => {
    const { o, snap } = start(CODE);
    await o.start();
    while (snap().currentCycle !== 13) await completeView(o, snap);
    await vi.advanceTimersByTimeAsync(U_OPEN_AT_SECONDS * 1000);
    expect(snap().visibleProbe).toMatchObject({ type: "U", kind: "area", followUpFi: AREA_FOLLOW_UP_PROMPT_FI, collectsConfidence: false });
    const shownOrder = snap().visibleProbe!.options.map((x) => x.id);
    expect(snap().renderTree.cycleInfo).not.toBeNull();
    expect(snap().currentEnvelope).not.toBeNull();
    expect(snap().toolsLocked).toBe(true);
    expect(() => o.searchAtoms("EK11")).toThrow(ProbeToolsLockedError);
    await expect(o.askAiChat("missä kärki on?")).rejects.toThrow(ProbeToolsLockedError);
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/in step probe/);
    // Answers are checked: parts only after yes, at least one after yes, known parts, no repeats; the wrong kind is refused.
    await expect(o.submitProbeArea(false, ["north_edge"])).rejects.toThrow(/only after yes/);
    await expect(o.submitProbeArea(true, [])).rejects.toThrow(/at least one/);
    await expect(o.submitProbeArea(true, ["reports"])).rejects.toThrow(/not an option/);
    await expect(o.submitProbeArea(true, ["weather", "weather"])).rejects.toThrow(/repeats/);
    await expect(o.submitProbeScale(50)).rejects.toThrow();
    await o.submitProbeArea(true, ["weather", "north_edge"]);
    expect(snap().visibleProbe).toBeNull();
    expect(snap().toolsLocked).toBe(false);
    expect(o.searchAtoms("EK11")).toBeDefined();
    await expect(o.submitProbeArea(false, [])).rejects.toThrow(); // one answer
    const records = await o.logRecords();
    const submitted = records.filter((r) => r.kind === "probe_submitted");
    // The parts in the order shown, with that order; the presented record carries the same order.
    expect(submitted.at(-1)!.detail).toEqual({ probeId: "probe.u.cycle_13", response: { unsure: true, areas: shownOrder.filter((id) => id === "weather" || id === "north_edge"), optionOrder: shownOrder } });
    expect(records.filter((r) => r.kind === "probe_presented").at(-1)!.detail).toMatchObject({ probeId: "probe.u.cycle_13", optionIds: shownOrder });
  });

  it("no visible probe without the option (the specs written before it), nor in the practice view", async () => {
    const o = new SessionOrchestrator(scenario, "directed", {});
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(box.snap!.visibleProbe).toBeNull();
    expect((await o.logRecords())[0]!.detail).toMatchObject({ visibleProbes: false });
  });
});

describe("derived measures from raw records (keys from the scenario, never from the log)", () => {
  it("the V13 area hit, the backup's correctness and confidence, and the coverage Brier score", async () => {
    const { records } = await fullSession(CODE);
    const keys = probeKeysOf(scenario);
    expect(keys.contradictionArea).toEqual({ probeId: "probe.u.cycle_13", key: "north_edge" });
    const u = uncertaintyMeasures(records, keys);
    const order = (records.find((r) => r.kind === "probe_presented" && (r.detail as { probeId: string }).probeId === "probe.u.cycle_13")!.detail as { optionIds: string[] }).optionIds;
    expect(u.area).toMatchObject({ probeId: "probe.u.cycle_13", view: 13, atViewSeconds: U_OPEN_AT_SECONDS, unsure: true, areaHit: true, keyPosition: order.indexOf("north_edge") });
    expect(u.backup).toMatchObject({ optionId: "a", confidence: 75, correct: keys.contradictionPair!.key === "a" });
    expect(u.coverage).toMatchObject({ value: 50, allInside: false, brier: 0.25 });
    // Nothing derived is in the log: no record carries a correctness or an overlap.
    expect(JSON.stringify(records)).not.toMatch(/"correct"|"overlap"|"actualInside"|failure mode|Diagnostic/);
  });

});

describe("I4: no key reaches the screen", () => {
  it("the snapshot never carries a backup key flag or the CA truth while a probe is on screen", async () => {
    const { o, snap } = start(CODE);
    // Every snapshot published while a probe is on screen (U at V13 and after V14).
    const seen: string[] = [];
    const probesSeen = new Set<string>();
    o.subscribe((s) => { if (s.visibleProbe) { seen.push(JSON.stringify(s)); probesSeen.add(s.visibleProbe.probeId); } });
    await o.start();
    while (snap().step !== "complete") await completeView(o, snap);
    expect(probesSeen.size).toBe(3);
    for (const s of seen) {
      expect(s).not.toMatch(/"correct"|isActualDevelopment|actualPerimeterAtEnd|invariantName|"expected"/);
    }
  });

  it("no file under app/render imports the key or measure modules", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
    walk("app/render");
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+"[^"]*(probe-keys|probe-measures|branch-statements|demo-probes)[^"]*"/);
  });
});
