/**
 * The training's map chrome against the main scenario's names (SPEC/08 (bp) §bp.2, §bp.8; review 27 Oct 2026, findings 2, 3 and 7):
 * every interface word the training's live map and its panes show — the legend's rows in each of the training's scenes, the GeoChat
 * rooms and pane, the compact info card (its clock and wind), the coordinate readout, the toolbar's tools, the zoom buttons — names no
 * call sign, contract place or feature, road code or scored subject of the main scenario (the rules of `test/training/names.spec.ts`),
 * and holds no clock at or after 11.32. The legend lists the sector, road and power-line rows on the session's map only; DR8's log
 * lines are filed with the air and drones.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };
import { LEGEND_MAP_TEXT, LEGEND_ROWS, legendPresence, type LegendRow } from "../../app/render/ui/components/Legend.js";
import { geoChatRooms } from "../../app/render/ui/tak/shell.js";
import { trainingMapLock } from "../../app/render/ui/training-lock.js";
import { trainingPanes } from "../../app/render/ui/components/TrainingStage.js";
import { tr } from "../../app/i18n/text.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import type { Lang } from "../../app/i18n/lang.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { trainingLogRows } from "../../app/session/training/corpus.js";
import { trainingClockLabel, trainingSceneOf } from "../../app/session/training/view.js";
import type { TrainingView } from "../../app/session/training/host.js";
import { contractPatterns, readContract } from "../../tools/review/training-contract.js";
import { MAIN_CALL_SIGNS, MAIN_SUBJECTS } from "../training/texts-corpus.js";

const LANGS: readonly Lang[] = ["fi", "en"];
const REFERENCE: readonly LegendRow[] = ["sector", "road", "power"];
const NONE = { stacks: false, region: false };

/** The scenes the training's live map draws: S1's, the incident's, and the memory exposure's (S1's with the memory unit alone). */
function trainingScenes() {
  const memory = TRAINING.items.find((it) => it.memory)!;
  const view = (phase: TrainingView["phase"], scene: "s1" | "incident") => ({ phase, tools: { map: true, rb: false, log: false, haku: false }, scene } as unknown as TrainingView);
  return [
    { name: "s1", cycle: trainingSceneOf(TRAINING, view("question", "s1"), TRAINING.items[0]!) },
    { name: "incident", cycle: trainingSceneOf(TRAINING, view("question", "incident"), TRAINING.items.find((it) => it.scene === "incident")!) },
    { name: "exposure", cycle: trainingSceneOf(TRAINING, view("study", "s1"), memory) },
  ];
}

/** A legend row's words, as `Legend` writes them: the fire's from the theme (translated), own forces' and reference rows' from its table. */
function rowWords(row: LegendRow, lang: Lang): string {
  const own = LEGEND_MAP_TEXT[lang] as Record<string, string>;
  if (row in own) return own[row]!;
  return tr(lang, (theme.legend as unknown as Record<string, string>)[row]!);
}

/** Every interface word the training's live map and panes show in `lang`. */
function chromeStrings(lang: Lang): { readonly where: string; readonly text: string }[] {
  const t = UI_TEXT[lang];
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text: string) => out.push({ where, text });
  // The legend: its title and toggles, and each row any training scene lists.
  add("legend.title", tr(lang, theme.legend.title));
  add("legend.show", LEGEND_MAP_TEXT[lang].show);
  add("legend.hide", LEGEND_MAP_TEXT[lang].hide);
  for (const s of trainingScenes()) for (const row of legendPresence(s.cycle, false, NONE, false)) add(`legend.${s.name}.${row}`, rowWords(row, lang));
  // GeoChat: its title, its rooms, its notes; the toolbar's tools and panes the training opens.
  for (const [room, label] of Object.entries(t.tak.geochat.rooms)) add(`geochat.room.${room}`, label);
  add("geochat.empty", t.tak.geochat.empty);
  add("geochat.readOnly", t.tak.geochat.readOnly);
  add("geochat.unread", t.tak.geochat.unread(2));
  for (const pane of trainingPanes({ map: true, rb: true, log: true, haku: true })) { add(`toolbar.${pane}`, t.tak.toolbar[pane]); add(`pane.${pane}`, t.tak.paneTitle[pane]); }
  add("toolbar.aria", t.tak.toolbarAria);
  add("pane.close", t.tak.closePane);
  // The compact info card: its clock's label and value, the wind in each scene.
  add("card.scenarioTime", t.tak.scenarioTime);
  add("card.clock", trainingClockLabel(TRAINING));
  for (const s of trainingScenes()) {
    const w = s.cycle?.wind;
    if (!w) continue;
    const compass = t.compass[Math.round((((w.fromDeg % 360) + 360) % 360) / 45) % 8]!;
    add(`wind.${s.name}`, `${compass} ${String(w.fromDeg).padStart(3, "0")}° · ${w.meanMs} m/s`);
    add(`wind.${s.name}.source`, `${t.wind} · ${tr(lang, w.sourceFi)}`);
    add(`wind.${s.name}.aria`, t.windAria(compass, w.fromDeg, w.meanMs));
  }
  // The coordinate readout and the zoom buttons.
  add("coords.mgrs", t.tak.mgrs);
  add("coords.hint", t.tak.cursorHint);
  add("coords.scale", t.tak.scale);
  for (const p of trainingMapLock(TRAINING, lang).presets) add(`zoom.${p.id}`, p.label);
  add("loading", t.mapLoading);
  return out;
}

describe("the training's map chrome names nothing of the main scenario (findings 2 and 3)", () => {
  it("the locked map's legend lists no sector, road or power-line row in any training scene; the session's map lists them", () => {
    for (const s of trainingScenes()) {
      const locked = legendPresence(s.cycle, false, NONE, false), session = legendPresence(s.cycle, false, NONE);
      for (const row of REFERENCE) {
        expect(locked.has(row), `${s.name}: ${row}`).toBe(false);
        expect(session.has(row), `${s.name}: ${row} (session)`).toBe(true);
      }
    }
    // The incident's legend still explains what the training's map draws: the fire and the unit.
    const incident = legendPresence(trainingScenes()[1]!.cycle, false, NONE, false);
    expect([...incident]).toEqual(LEGEND_ROWS.filter((r) => incident.has(r)));
    expect(incident.has("uncontained") && incident.has("unit")).toBe(true);
    // S1's map draws none of the rows: the legend is not shown at all (an empty legend opened onto nothing).
    expect(legendPresence(trainingScenes()[0]!.cycle, false, NONE, false).size).toBe(0);
    expect(readFileSync("app/render/ui/components/Legend.tsx", "utf8")).toMatch(/if \(rowList\.length === 0\) return null;/);
  });

  it("no chrome word names a call sign, contract place or feature, road code or scored subject; no clock at or after 11.32", () => {
    const patterns = contractPatterns(readContract("."));
    for (const lang of LANGS) {
      const all = chromeStrings(lang);
      expect(all.length).toBeGreaterThan(30);
      for (const c of all) {
        expect(c.text.trim().length, `${lang} ${c.where}`).toBeGreaterThan(0);
        expect(c.text, `${lang} ${c.where}`).not.toMatch(MAIN_CALL_SIGNS);
        expect(c.text, `${lang} ${c.where}`).not.toMatch(MAIN_SUBJECTS);
        for (const p of patterns) expect(p.re.test(c.text), `${lang} ${c.where}: ${p.id}`).toBe(false);
        for (const m of c.text.matchAll(/(?<![\d,.])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d,])/g)) {
          expect(Number(m[1]) * 60 + Number(m[2]), `${lang} ${c.where}`).toBeLessThan(11 * 60 + 32);
        }
      }
    }
    // Before the review the legend held "Lohkoraja L1–L4", "Tie R1–R3" and "Sähkölinja 20 kV": the rules above catch each of them.
    expect(LEGEND_MAP_TEXT.fi.road).toMatch(MAIN_CALL_SIGNS);
    expect(LEGEND_MAP_TEXT.en.power).toMatch(MAIN_SUBJECTS);
  });

  it("the compact info card shows the clock and the wind only — no call sign or role — and its clock is the training's now", () => {
    const chrome = readFileSync("app/render/ui/tak/TakMapChrome.tsx", "utf8");
    const compact = chrome.slice(chrome.indexOf("{compact ? ("), chrome.indexOf(") : ("));
    expect(compact).toMatch(/\{t\.tak\.scenarioTime\}/);
    expect(compact).toMatch(/<WindIndicator wind=\{wind\} inline \/>/);
    expect(compact).not.toMatch(/selfCallsign|selfRole|selfSymbolSvg/);
    expect(trainingClockLabel(TRAINING)).toBe("10:18");
    expect(readFileSync("app/render/ui/components/TrainingStage.tsx", "utf8")).toMatch(/<TakInfoCard compact clockLabel=\{trainingClockLabel\(TRAINING\)\} wind=\{snapshot\.renderTree\.cycleInfo\?\.wind\} \/>/);
  });
});

describe("GeoChat files the training's drone with the air and drones (finding 7)", () => {
  it("S3's log: DR8's line in the air room; EK51's and EK52's with the ground units; nothing under support", () => {
    const rooms = geoChatRooms(trainingLogRows(TRAINING.now.label));
    const of = (room: string) => rooms.find((r) => r.room === room)!.entries.map((x) => x.entry.from);
    expect(of("air")).toEqual(["DR8"]);
    expect(new Set(of("ground"))).toEqual(new Set(["EK51", "EK52"]));
    expect(of("support")).toEqual([]);
    expect(of("command")).toEqual([]);
  });
});
