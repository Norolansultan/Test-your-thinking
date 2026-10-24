/**
 * The play harness (`tools/play/`): a short scripted play — the practice view and V1–V3, through a freeze (VP, V2) and SPAM (VP,
 * V3) and Haku's template fallback — prints nothing of the answer keys: no item's key record ids (`keyAtomIds`, the audit's basis
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
      const look = await runCommand(session, "look", [], ctx);
      outputs.push(look);
      const s = session.snap();
      if (["exploration", "allocation", "awaiting_view_end"].includes(s.step) && s.tour === null) {
        // The message log in `look`: exactly the snapshot's rows, in order, as `MessageLogRow` shows them.
        const lines = look.split("\n");
        const start = lines.findIndex((l) => l.startsWith("-- GeoChat · All Chat Rooms"));
        const rows = lines.slice(start + 1, start + 1 + s.radioLog.length).map((l) => l.slice(2));
        expect(rows).toHaveLength(s.radioLog.length);
        s.radioLog.forEach((e, i) => {
          expect(rows[i]!.startsWith(e.clockLabel)).toBe(true);
          expect(rows[i]).toContain(`${sourceName("en", e.from)}: `);
          expect(rows[i]!.endsWith(e.id ? recordIn("en", e.id, e.text) : tr("en", e.text))).toBe(true);
        });
        expect(lines[start + 1 + s.radioLog.length]).not.toMatch(/^\s{2}\d/); // nothing more listed
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
    expect(shown.some((x) => x.id === "freeze.practice.infra")).toBe(true);
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
  it("an English run prints English only, shows the SPAM card's time left and the feedback map's whereabouts, and its period readout never runs backwards", async () => {
    const { outputs } = await playToV4();
    const all = outputs.join("\n");
    // (a) The screen descriptions the app has no string for are in the session language only.
    for (const fi of ["Esittely", "Työkalumuistutus", "lukittu", "Päätösosio"]) expect(all).not.toContain(fi);
    expect(all).toMatch(/^-- Guided tour \(\d+\) --$/m);
    expect(all).toMatch(/^-- Tool reminder \(\d+\) --$/m);
    // Finding 3: the open SPAM item shows its answer window's time left, as the card does.
    expect(all).toMatch(/^-- Situation question(?: · Question \d of \d)? --  Time to answer \d+ s$/m);
    // (b) The practice feedback names its head map, even when no image is drawn (`--no-map`).
    expect(all).toContain("an image, not drawn with --no-map; `look` without --no-map draws it.");
    expect(all).toContain("The practice feedback is on screen, with a map of the head and your mark");
    // (c) Within a period the readout only grows: after a freeze, the plan's confidence reads the period's end, not the freeze.
    const last = new Map<string, number>();
    const readouts = [...all.matchAll(/^» \[(Practice|Period \d+ \/ 14) · [^\]]* · period (\d+) s\]$/gm)];
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
    const refused = await playCommand(dir, "pretest-answer", ["x", "y"], { withMap: false });
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
