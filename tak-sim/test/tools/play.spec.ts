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
  it("never carries a freeze or SPAM key, and lists a key option exactly as the others", async () => {
    const { outputs, logChecks } = await playToV4();
    const all = outputs.join("\n");
    expect(logChecks).toBeGreaterThan(5);
    // The play reached the items the check is about.
    expect(all).toContain("[freeze.practice.infra]");
    expect(all).toMatch(/\[freeze\.2\./);
    expect(all).toContain("Situation question");
    expect(all).toContain("TEMPLATE FALLBACK");
    // No key record id, no key field, no map key's coordinates.
    const keyAtoms = new Set<string>([...auditItems().flatMap((i) => i.atoms.map((a) => a.id)), ...Object.values(SPAM_KEY_ATOMS).flat(), ...Object.values(SPAM_SECOND_KEY_ATOMS).flat(), practiceSpamKeyRecordId()]);
    expect(keyAtoms.size).toBeGreaterThan(10);
    for (const id of keyAtoms) expect(all).not.toContain(id);
    expect(all).not.toMatch(/keyAtomIds|basisAtomIds|mapKey|projectionPoint|projectionOptionId|truthOptionId|"correct"|correct:/);
    const freezeItems = [...scenario.practice.freeze.items, ...scenario.freezes.flatMap((f) => f.items)];
    for (const it of freezeItems) if (it.mapKey) for (const v of [it.mapKey.point.lat, it.mapKey.point.lon]) expect(all).not.toContain(v.toFixed(4));
    // A key option's line is the same as every other option's: "  <id>: <label>", nothing added.
    const shownLine = (id: string, label: string) => new RegExp(`^  ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: ${tr("en", label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
    for (const it of freezeItems.filter((x) => all.includes(`[${x.id}]`) && x.kind !== "map_point")) {
      for (const o of it.options) expect(all).toMatch(shownLine(o.id, o.labelFi));
    }
    const spamKeys = spamKeysOf(scenario.probeSchedule.probes, scenario.invariants);
    const spams = [scenario.practice.spam!, ...scenario.probeSchedule.probes.filter((p) => p.type === "S" && Number(p.cycle) <= 3)];
    for (const p of spams) {
      if (p.response.kind !== "categorical" || !all.includes(tr("en", p.prompt))) continue;
      const key = spamKeys.get(p.id) ?? (p.id === scenario.practice.spam!.id ? PRACTICE_SPAM_KEY_OPTION : null);
      expect(key).not.toBeNull();
      for (const o of p.response.options) expect(all).toMatch(shownLine(o.id, o.fi));
    }
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
