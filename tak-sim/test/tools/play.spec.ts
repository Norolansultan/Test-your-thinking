/**
 * The play harness (`tools/play/`): a short scripted play — the practice view and V1–V3, through a freeze (V2; VP has none since
 * revision (bp)) and SPAM (VP, V3) and Haku's template fallback — prints nothing of the answer keys: no item's key record ids (`keyAtomIds`, the audit's basis
 * records, SPAM's key records), no map key's coordinates, no key field, and a key option is listed exactly as every other option is;
 * `look` lists exactly the snapshot's message log (`radioLog`), in order, as the app's row shows it. A run on disk replays to the
 * same screen, a refused command is not recorded, and the freeze map's x,y reads back the point the image shows there.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { spamKeysOf } from "../../app/telemetry/spam-measures.js";
import { SPAM_KEY_ATOMS, SPAM_SECOND_KEY_ATOMS } from "../../app/scenario/demo-probes.js";
import { PRACTICE_SPAM_KEY_OPTION, practiceSpamKeyRecordId } from "../../app/scenario/practice-spam.js";
import { basemapPx } from "../../app/render/ui/basemap-px.js";
import { recordIn, sourceName, tr } from "../../app/i18n/text.js";
import { PlaySession } from "../../tools/play/session.js";
import { runCommand } from "../../tools/play/commands.js";
import { dumbPolicy } from "../../tools/play/smoke.js";
import { playCommand, readRun, replayRun, startRun } from "../../tools/play/run.js";
import { FREEZE_MAP_MARGIN_PX, freezeFrame, freezePointAt, latLonAtBasemapPx } from "../../tools/play/freeze-grid.js";
import { auditItems } from "../../tools/review/difficulty-audit.js";

const scenario = buildDemoScenario();
const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** Plays VP–V3 with the smoke's dumb policy, a `look` before every command; every output the player saw. */
async function playToV4(): Promise<{ readonly outputs: string[]; readonly logChecks: number }> {
  const session = await PlaySession.create({ audience: "expert", lang: "en" });
  const outputs: string[] = [];
  const asked = new Set<number>();
  const ctx = { runDir: "/nonexistent", withMap: false };
  let logChecks = 0;
  try {
    for (let guard = 0; session.snap().currentCycle < 4 && guard < 600; guard++) {
      session.begin(null);
      // B10 (25 Oct 2026): every other look is `look --all` (the whole log); the others list only the rows since the last look.
      const whole = guard % 2 === 0;
      const seenBefore = session.seenLog;
      const look = await runCommand(session, "look", whole ? ["--all"] : [], ctx);
      outputs.push(look);
      const s = session.snap();
      if (["exploration", "allocation", "awaiting_view_end"].includes(s.step) && s.tour === null) {
        // The message log in `look`: exactly the snapshot's rows (the new ones, or all), in order, as `MessageLogRow` shows them.
        const lines = look.split("\n");
        const start = lines.findIndex((l) => l.startsWith("-- GeoChat · All Chat Rooms"));
        const seen = Math.min(seenBefore, s.radioLog.length);
        const expected = whole ? s.radioLog : s.radioLog.slice(seen);
        let at = start + 1;
        if (!whole && seen > 0) { expect(lines[at]).toBe(`» ${seen} earlier message(s) not repeated (\`look --all\` lists the whole log).`); at++; }
        const rows = lines.slice(at, at + expected.length).map((l) => l.slice(2));
        expect(rows).toHaveLength(expected.length);
        expected.forEach((e, i) => {
          expect(rows[i]!.startsWith(e.clockLabel)).toBe(true);
          expect(rows[i]).toContain(`${sourceName("en", e.from)}: `);
          expect(rows[i]!.endsWith(e.id ? recordIn("en", e.id, e.text) : tr("en", e.text))).toBe(true);
        });
        expect(lines[at + expected.length]).not.toMatch(/^[ *] \d/); // nothing more listed
        logChecks++;
      }
      const [cmd, ...args] = dumbPolicy(session, asked);
      session.begin(null);
      outputs.push(await runCommand(session, cmd, args, ctx));
    }
  } finally { session.dispose(); }
  return { outputs, logChecks };
}

describe("the play harness's player-facing output", () => {
  it("never carries a freeze or SPAM key or an item id, and lists a key option exactly as the others", async () => {
    const { outputs, logChecks } = await playToV4();
    const all = outputs.join("\n");
    expect(logChecks).toBeGreaterThan(5);
    // The play reached the items the check is about.
    const freezeItems = [...scenario.practice.freeze.items, ...scenario.freezes.flatMap((f) => f.items)];
    const shown = freezeItems.filter((x) => all.includes(tr("en", x.promptFi)));
    expect(scenario.practice.freeze.items).toEqual([]); // revision (bp): VP has no freeze
    expect(shown.some((x) => x.id.startsWith("freeze.2."))).toBe(true);
    // The app shows no item ids (some name the key, e.g. `freeze.5.ek14_shelter`), so the harness shows none either.
    expect(all).not.toMatch(/freeze\.(practice|\d+)\./);
    expect(all).toContain("Situation question");
    expect(all).toContain("TEMPLATE FALLBACK");
    // No key record id, no key field, no map key's coordinates.
    const keyAtoms = new Set<string>([...auditItems().flatMap((i) => i.atoms.map((a) => a.id)), ...Object.values(SPAM_KEY_ATOMS).flat(), ...Object.values(SPAM_SECOND_KEY_ATOMS).flat(), practiceSpamKeyRecordId()]);
    expect(keyAtoms.size).toBeGreaterThan(10);
    for (const id of keyAtoms) expect(all).not.toContain(id);
    expect(all).not.toMatch(/keyAtomIds|basisAtomIds|mapKey|projectionPoint|projectionOptionId|truthOptionId|"correct"|correct:/);
    for (const it of freezeItems) if (it.mapKey) for (const v of [it.mapKey.point.lat, it.mapKey.point.lon]) expect(all).not.toContain(v.toFixed(4));
    // A key option's line is the same as every other option's: "  <letter>) <label>" (in the order the screen gives), nothing added.
    const shownLine = (label: string) => new RegExp(`^  [a-z]\\) ${tr("en", label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
    for (const it of shown.filter((x) => x.kind !== "map_point")) {
      for (const o of it.options) expect(all).toMatch(shownLine(o.labelFi));
      for (const o of it.options) expect(all).not.toContain(`  ${o.id}: `);
    }
    const spamKeys = spamKeysOf(scenario.probeSchedule.probes, scenario.invariants);
    const spams = [scenario.practice.spam!, ...scenario.probeSchedule.probes.filter((p) => p.type === "S" && Number(p.cycle) <= 3)];
    for (const p of spams) {
      if (p.response.kind !== "categorical" || !all.includes(tr("en", p.prompt))) continue;
      const key = spamKeys.get(p.id) ?? (p.id === scenario.practice.spam!.id ? PRACTICE_SPAM_KEY_OPTION : null);
      expect(key).not.toBeNull();
      for (const o of p.response.options) expect(all).toMatch(shownLine(o.fi));
    }
  });
});

describe("the play harness's cosmetics (play-test, 24 Oct 2026)", () => {
  it("an English run prints English only, shows the SPAM card's time left, and its period readout never runs backwards", async () => {
    const { outputs } = await playToV4();
    const all = outputs.join("\n");
    // (a) The screen descriptions the app has no string for are in the session language only.
    for (const fi of ["Esittely", "Työkalumuistutus", "lukittu", "Päätösosio"]) expect(all).not.toContain(fi);
    expect(all).toMatch(/^-- Guided tour \(\d+\) --$/m);
    expect(all).toMatch(/^-- Tool reminder \(\d+\) --$/m);
    // Finding 3: the open SPAM item shows its answer window's time left, as the card does.
    expect(all).toMatch(/^-- Situation question(?: · Question \d of \d)? --  Time to answer \d+ s$/m);
    // (b) Revision (bp): the practice feedback and its head map are retired; VP's label is the first look's.
    expect(all).not.toContain("practice feedback");
    expect(all).toMatch(/^» \[First look · /m);
    // (c) Within a period the readout only grows: after a freeze, the plan's confidence reads the period's end, not the freeze.
    const last = new Map<string, number>();
    const readouts = [...all.matchAll(/^» \[(First look|Period \d+ \/ 14) · [^\]]* · period (\d+) s\]$/gm)];
    expect(readouts.some((m) => m[0].includes("plan_confidence"))).toBe(true);
    for (const m of readouts) {
      const v = Number(m[2]);
      expect(v, m[0]).toBeGreaterThanOrEqual(last.get(m[1]!) ?? 0);
      last.set(m[1]!, v);
    }
    // (d) The roster row keeps the help card's colon ("From: …").
    expect(readFileSync("tools/play/help.ts", "utf8")).toContain("` · ${T.from}: ${r.from}`");
  });
});

describe("a play run on disk", () => {
  it("records each command with its costs, replays to the same screen, and records no refused command", async () => {
    const dir = mkdtempSync(join(tmpdir(), "play-spec-"));
    dirs.push(dir);
    const first = await startRun(dir, { audience: "public", lang: "fi" }, { withMap: false });
    expect(first.ok).toBe(true);
    expect(first.text).toContain("Perehdytys");
    const refused = await playCommand(dir, "training-answer", ["x", "y"], { withMap: false });
    expect(refused.ok).toBe(false);
    expect((await playCommand(dir, "primer-answer", ["1"], { withMap: false })).ok).toBe(true);
    const run = readRun(dir);
    expect(run.actions.map((a) => a.cmd)).toEqual(["look", "primer-answer"]);
    expect(run.actions[1]!.costsMs).toEqual([10_000]);
    const look = await playCommand(dir, "look", [], { withMap: false });
    const again = await replayRun(dir);
    again.dispose();
    expect(again.clock.now()).toBe(readRun(dir).actions.at(-1)!.atMs);
    expect(look.text).toContain("Perehdytys");
    const transcript = readFileSync(join(dir, "transcript.md"), "utf8");
    expect(transcript).toContain("REFUSED");
    expect(transcript).toContain("`primer-answer 1`");
  });
});

describe("the freeze map's grid", () => {
  it("reads back the point the image shows at an x,y, inside the study area only", () => {
    const extent = scenario.extent;
    const f = freezeFrame(extent);
    const mid = freezePointAt(FREEZE_MAP_MARGIN_PX + f.widthPx / 2, FREEZE_MAP_MARGIN_PX + f.heightPx / 2, extent);
    expect("point" in mid).toBe(true);
    const p = (mid as { point: { lat: number; lon: number } }).point;
    const px = basemapPx(p);
    expect(Math.abs(px.x - (f.x0 + f.w / 2))).toBeLessThan(0.5);
    expect(Math.abs(px.y - (f.y0 + f.h / 2))).toBeLessThan(0.5);
    const back = latLonAtBasemapPx(basemapPx({ lat: 60.85, lon: 27.35 }), extent);
    expect(back.lat).toBeCloseTo(60.85, 5);
    expect(back.lon).toBeCloseTo(27.35, 5);
    expect("error" in freezePointAt(1, 1, extent)).toBe(true);
  });
});

/** Plays with the smoke's dumb policy until `until` holds (a `look` is not needed for the policy). */
async function playUntil(session: PlaySession, until: (s: ReturnType<PlaySession["snap"]>) => boolean): Promise<void> {
  const ctx = { runDir: "/nonexistent", withMap: false };
  const asked = new Set<number>();
  for (let guard = 0; !until(session.snap()) && guard < 2000; guard++) {
    const [cmd, ...args] = dumbPolicy(session, asked);
    session.begin(null);
    await runCommand(session, cmd, args, ctx);
  }
  expect(until(session.snap())).toBe(true);
}

describe("the replay's harness fixes (25 Oct 2026)", () => {
  const ctx = { runDir: "/nonexistent", withMap: false };
  const run = async (session: PlaySession, cmd: string, args: string[] = []) => { session.begin(null); return runCommand(session, cmd, args, ctx); };
  const inView = (s: ReturnType<PlaySession["snap"]>) => ["exploration", "allocation", "awaiting_view_end"].includes(s.step) && s.tour === null;

  it("B10: `look` lists only the messages since the last look, after a count of the earlier ones; `look --all` lists the whole log", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en", waitStopsOnMessages: true, questionnairesPlayed: true });
    try {
      await playUntil(session, (s) => s.currentCycle === 1 && inView(s) && s.radioLog.length > 3);
      const first = await run(session, "look");
      const n = session.snap().radioLog.length;
      expect(first).toContain(`-- GeoChat · All Chat Rooms (${n}) --`);
      const again = await run(session, "look");
      expect(again).toContain(`» ${n} earlier message(s) not repeated (\`look --all\` lists the whole log).`);
      expect(again).toContain("» No new messages since your last look.");
      const row = /^[ *] \d\d[.:]\d\d/;
      expect(again.split("\n").filter((l) => row.test(l))).toEqual([]);
      const all = await run(session, "look", ["--all"]);
      expect(all.split("\n").filter((l) => row.test(l))).toHaveLength(n);
      await expect(run(session, "look", ["--everything"])).rejects.toThrow(/look \[--all\]/);
      expect(readFileSync("tools/play/README.md", "utf8")).toContain("`look --all`");
    } finally { session.dispose(); }
  });

  it("B1: the Haku chip is on screen in V8–V14 exactly when the app shows it, and `chip` asks it through Haku's path (`viaChip`)", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en", waitStopsOnMessages: true, questionnairesPlayed: true });
    try {
      const chipLine = "Search · Suggested question: [What is new in this period's records?] → `chip`";
      await playUntil(session, (s) => s.currentCycle === 7 && inView(s));
      expect(session.snap().hakuChip).toBe(false);
      expect(await run(session, "look")).not.toContain(chipLine);
      await expect(run(session, "chip")).rejects.toThrow(/no suggested question/);
      await playUntil(session, (s) => s.currentCycle === 8 && inView(s));
      expect(session.snap().hakuChip).toBe(true);
      expect(await run(session, "look")).toContain(chipLine);
      const out = await run(session, "chip");
      expect(out).toContain("> What is new in this period's records?");
      expect(out).toContain("TEMPLATE FALLBACK");
      const submitted = (await session.o.logRecords()).filter((r) => r.kind === "ai_chat_query_submitted" && (r.detail as { viaChip?: boolean }).viaChip === true);
      expect(submitted.map((r) => (r.detail as { view: number; text: string; tool: string }))).toEqual([expect.objectContaining({ view: 8, text: "What is new in this period's records?", tool: "haku" })]);
      expect(session.snap().suggestedQuestion).toBe(false); // the guide's chip is never the Haku group's
    } finally { session.dispose(); }
  }, 30_000);

  it("B2: the pre-session form, the post-session self-estimate and influence items and the hinge's fatigue item are the player's", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en", waitStopsOnMessages: true, questionnairesPlayed: true });
    try {
      // The pre-session form is on screen, not completed for the player (consent and the AI literacy test still are).
      expect(session.snap()).toMatchObject({ step: "questionnaire", questionnaire: { id: "pre" } });
      const pre = await run(session, "look");
      for (const id of ["fatigue.start", "sleep.hours", "shift.recent"]) expect(pre).toContain(`[${id}]`);
      await expect(run(session, "quest-answer", ["sleep.hours", "25"])).rejects.toThrow(/sleep.hours: a whole number 0–24/);
      await expect(run(session, "quest-answer", ["fatigue.start", "8"])).rejects.toThrow(/one of 1, 2, 3, 4, 5, 6, 7/);
      await run(session, "quest-answer", ["fatigue.start", "3"]);
      await run(session, "quest-answer", ["sleep.hours", "7"]);
      await run(session, "quest-answer", ["shift.recent", "no"]);
      await run(session, "quest-submit");
      const submittedPre = (await session.o.logRecords()).find((r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "pre")!;
      expect((submittedPre.detail as { answers: { itemId: string; value: unknown }[] }).answers).toEqual([
        { itemId: "fatigue.start", value: 3 }, { itemId: "sleep.hours", value: 7 }, { itemId: "shift.recent", value: "no" },
      ]);
      // The hinge's optional fatigue item, once its check is answered.
      await playUntil(session, (s) => s.step === "hinge_pause" && s.hingeFatigue !== null);
      expect(await run(session, "look")).toContain("`hinge-fatigue <1–7>`");
      await run(session, "hinge-fatigue", ["5"]);
      expect((await session.o.logRecords()).filter((r) => r.kind === "hinge_fatigue_rated").map((r) => r.detail)).toEqual([{ itemId: "fatigue.hinge", value: 5 }]);
      // The post-session form: the source-memory items and the self-estimate and the Haku group's influence items.
      await playUntil(session, (s) => s.step === "questionnaire" && s.questionnaire?.id === "post");
      const post = await run(session, "look");
      for (const id of ["accuracy.perceived", "influence.plan_views.haku", "influence.answers.haku"]) expect(post).toContain(`[${id}]`);
      expect(post).not.toContain("[influence.plan_views.thinker]");
      await run(session, "quest-answer", ["accuracy.perceived", "60"]);
      await run(session, "quest-answer", ["influence.answers.haku", "30"]);
      await expect(run(session, "quest-answer", ["influence.answers.haku", "35"])).rejects.toThrow(/one of 0, 10, 20/);
      await run(session, "quest-submit");
      const post2 = (await session.o.logRecords()).find((r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "post")!;
      const answers = new Map((post2.detail as { answers: { itemId: string; value: unknown }[] }).answers.map((a) => [a.itemId, a.value]));
      expect(answers.get("accuracy.perceived")).toBe(60);
      expect(answers.get("influence.answers.haku")).toBe(30);
      expect(answers.get("influence.plan_views.haku")).toBeNull(); // optional: left blank
    } finally { session.dispose(); }
  }, 30_000);

  it("B2: a run started before 25 Oct 2026 still has its pre-session form completed neutrally, so it replays as played", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en", waitStopsOnMessages: true });
    try {
      expect(session.snap().step).not.toBe("questionnaire");
      const pre = (await session.o.logRecords()).find((r) => r.kind === "questionnaire_submitted")!;
      expect((pre.detail as { answers: { itemId: string; value: unknown }[] }).answers[0]).toEqual({ itemId: "fatigue.start", value: 4 });
    } finally { session.dispose(); }
  });
});

describe("messages that come in while a command runs", () => {
  it("are reported, and stop a `wait`, in a run that asks for it (24 Oct 2026: the shared log list hid every one)", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en", waitStopsOnMessages: true });
    const ctx = { runDir: "/nonexistent", withMap: false };
    const asked = new Set<number>();
    try {
      // To the start of V2 with the smoke's policy.
      for (let guard = 0; !(session.snap().currentCycle === 2 && session.snap().step === "exploration" && session.snap().tour === null) && guard < 600; guard++) {
        const [cmd, ...args] = dumbPolicy(session, asked);
        session.begin(null);
        await runCommand(session, cmd, args, ctx);
      }
      expect(session.snap().currentCycle).toBe(2);
      const logAtStart = session.snap().radioLog.length;
      // Waits stop at whatever a participant would notice (the decision panel opening, too); wait on until the log grows.
      let out = "";
      for (let i = 0; i < 10 && session.snap().radioLog.length === logAtStart && session.snap().step !== "freeze"; i++) {
        session.begin(null);
        out = await runCommand(session, "wait", ["200"], ctx);
      }
      // V2's second step comes in as one burst before the freeze: the wait stops there and says so.
      expect(session.snap().radioLog.length).toBeGreaterThan(logAtStart);
      expect(out).toMatch(/new message\(s\) in the log/);
      expect(session.snap().step).not.toBe("freeze");
    } finally { session.dispose(); }
  });
});
