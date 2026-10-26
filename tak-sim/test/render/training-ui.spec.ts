/**
 * The training incident's screen (SPEC/08 (bp) §bp.1, SPEC/15 (bp)): the lock on the live map and the blank memory-check map (its
 * bounds, frame, presets and tiles), the feedback's drawing, and — checked at the source, as the other screens' hooks are — that the
 * screen is played on the session's real components (MapView, the TAK toolbar and panes, the SPAM card, the freeze screen), that the
 * Thinker pane is never in it, that Haku is never opened for the participant, and that the retired screens are gone.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };
import { lockMaxBounds, tilesMeeting, trainingMapLock } from "../../app/render/ui/training-lock.js";
import { TRAINING_COLOURS, trainingFeedbackFeatures } from "../../app/render/ui/training-overlay.js";
import { trainingPanes } from "../../app/render/ui/components/TrainingStage.js";
import { widenBox } from "../../app/session/training/area.js";
import { AREA, TRAINING_FIXTURE } from "../session/training-fixture.js";

const src = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");

describe("the training's lock (SPEC/08 (bp) §bp.1)", () => {
  it("bounds the map at the square plus its 100 m margin; presets 2.5 km (the whole square) and 1 km, in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      const lock = trainingMapLock(TRAINING_FIXTURE, lang);
      expect(lock.area).toEqual(AREA);
      expect(lock.bounds).toEqual(widenBox(AREA, 100));
      expect(lock.bounds.north - AREA.north).toBeCloseTo(100 / 111_320, 8);
      expect(lockMaxBounds(lock)).toEqual([[lock.bounds.west, lock.bounds.south], [lock.bounds.east, lock.bounds.north]]);
      expect(lock.presets.map((p) => [p.label, p.widthM])).toEqual([[lang === "fi" ? "2,5 km" : "2.5 km", null], ["1 km", 1_000]]);
    }
  });

  it("loads only the basemap tiles meeting the lock: the north-east corner's one tile", () => {
    const tiles = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as [number, number][] }));
    const met = tilesMeeting(tiles, widenBox(AREA, 100));
    expect(met.map((t) => t.url)).toEqual(["/maps/topo/0_3.webp"]);
    expect(tilesMeeting(tiles, { south: -90, west: -180, north: 90, east: 180 })).toHaveLength(16);
  });

  it("MapView takes the lock as an optional prop: frame, lowest zoom, maxBounds, tiles, presets; no reference overlay", () => {
    const map = src("components/MapView.tsx");
    expect(map).toMatch(/readonly lock\?: MapLock \| undefined;/);
    expect(map).toMatch(/maxBounds: lock \? lockMaxBounds\(lock\) : panBounds\(extent, PAN_LIMIT_M\)/);
    expect(map).toMatch(/const first = lock \? extentCamera\(lock\.area, width, containerRef\.current\.clientHeight \|\| 720, FRAME_PAD_PX\) : opening;/);
    expect(map).toMatch(/minZoom: lock \? first\.zoom/);
    expect(map).toMatch(/const at = lockRef\.current \? lockedFrame\(map, lockRef\.current\) : \{ center, zoom \};/);
    expect(map).toMatch(/\(lock \? tilesMeeting\(TOPO_TILES, lock\.bounds\) : TOPO_TILES\)/);
    expect(map).toMatch(/if \(!lock\) addOverlayLines\(map\);/);
    expect(map).toMatch(/const levels = lock\?\.presets \?\? ZOOM_LEVELS/);
    const freezeMap = src("components/FreezeMap.tsx");
    expect(freezeMap).toMatch(/if \(lock\) map\.setMaxBounds\(lockMaxBounds\(lock\)\);/);
    expect(freezeMap).toMatch(/const frame = \(\) => \(lock \? extentCamera\(lock\.area,/);
    expect(freezeMap).toMatch(/\(lock \? tilesMeeting\(TOPO_TILES, lock\.bounds\) : TOPO_TILES\)/);
    for (const f of ["components/MapView.tsx", "components/FreezeMap.tsx", "components/FreezeScreen.tsx", "components/TrainingScreen.tsx", "components/TrainingStage.tsx", "components/TrainingPanels.tsx", "training-overlay.ts", "training-lock.ts"]) {
      expect(src(f).split("\n").length).toBeLessThan(500);
    }
  });
});

describe("the feedback's drawing (SPEC/08 (bp) §bp.5)", () => {
  it("a point item: the right place in a green ring, the participant's mark joined to it", () => {
    const item = TRAINING_FIXTURE.items.find((it) => it.answer === "point")!;
    const key = (item.key as { point: { lat: number; lon: number } }).point;
    const mark = { lat: key.lat + 0.001, lon: key.lon };
    const { lines, points } = trainingFeedbackFeatures({ answer: { point: mark } }, item);
    expect(points.map((p) => [p.properties.colour, p.properties.ring])).toEqual([[TRAINING_COLOURS.key, 1], [TRAINING_COLOURS.answer, 0]]);
    expect(lines.some((l) => l.geometry.type === "LineString" && JSON.stringify(l.geometry.coordinates) === JSON.stringify([[mark.lon, mark.lat], [key.lon, key.lat]]))).toBe(true);
  });

  it("a choice item: its feedback line and routes; no point drawn", () => {
    const item = TRAINING_FIXTURE.items.find((it) => it.answer === "choice" && it.feedback.line)!;
    const { lines, points } = trainingFeedbackFeatures({ answer: { choiceId: "a" } }, item);
    expect(points).toEqual([]);
    expect(lines.map((l) => l.properties.colour)).toEqual([TRAINING_COLOURS.line]);
  });
});

describe("the training's screen is the session's own components (SPEC/15 (bp) §bp.2)", () => {
  const screen = src("components/TrainingScreen.tsx"), stage = src("components/TrainingStage.tsx");

  it("the live stage: MapView locked, the TAK toolbar with only the item's tools, GeoChat, R&B, Haku; S3's card is the SPAM card", () => {
    expect(stage).toMatch(/<MapView snapshot=\{snapshot\} extent=\{orchestrator\.mapExtent\} tak=\{tak\} lock=\{lock\}>/);
    expect(stage).toMatch(/<SpamCard spam=\{snapshot\.spam\} orchestrator=\{orchestrator\} \/>/);
    expect(stage).toMatch(/<GeoChatPane /);
    expect(stage).toMatch(/<RangeBearingPane /);
    expect(stage).toMatch(/<HakuPane snapshot=\{snapshot\} orchestrator=\{orchestrator\} \/>/);
    expect(stage).toMatch(/drawTrainingOverlay\(handle\.map, view, item, lang\)/);
    expect(stage).toMatch(/orchestrator\.noteTrainingMeasure\(/);
    expect(trainingPanes({ map: true, rb: true, log: false, haku: false })).toEqual(["range_bearing"]);
    expect(trainingPanes({ map: true, rb: true, log: true, haku: true })).toEqual(["geochat", "range_bearing", "haku"]);
    expect(trainingPanes({ map: false, rb: false, log: false, haku: false })).toEqual([]);
  });

  it("S4 is the freeze screen, one item at a time with the training's progress and the locked blank map", () => {
    expect(screen).toMatch(/<FreezeScreen key=\{item\.id\} freeze=\{snapshot\.freeze\} orchestrator=\{orchestrator\} showLevels=\{false\} progress=\{\{ position: view\.position, count: view\.itemCount \}\} lock=\{lock\} \/>/);
    const freeze = src("components/FreezeScreen.tsx");
    expect(freeze).toMatch(/progress\?: \{ readonly position: number; readonly count: number \} \| undefined; readonly lock\?: MapLock \| undefined;/);
    expect(freeze).toMatch(/<FreezeMap extent=\{extent\} lock=\{lock\}/);
  });

  it("no Thinker pane anywhere in the training; Haku never opened for the participant; nothing logged by the screen", () => {
    for (const s of [screen, stage, src("components/TrainingPanels.tsx")]) {
      expect(s).not.toMatch(/ThinkerPane|OpenAiChat|askOpenThinker/);
      expect(s).not.toMatch(/logMapUse|logTabSelected|logPanelUse/);
    }
    expect(stage).toMatch(/useState<TakPaneId \| null>\(view\.tools\.log \? "geochat" : null\)/);
    expect(stage).not.toMatch(/setPane\("haku"\)/);
  });

  it("the session view draws it for its step; the shell no longer has the map training; the retired screens are gone", () => {
    expect(src("components/SessionView.tsx")).toMatch(/if \(snapshot\.step === "training_incident"\) return provide\(<TrainingScreen snapshot=\{snapshot\} orchestrator=\{orchestrator\} \/>\);/);
    expect(src("components/StudyShell.tsx")).not.toMatch(/map_pretest|MapTrainingScreen/);
    for (const gone of ["app/render/ui/components/MapTrainingScreen.tsx", "app/render/ui/components/PracticeFeedbackScreen.tsx", "app/render/ui/map-training-overlay.ts", "app/session/map-training.ts", "app/session/map-training-spec.ts", "app/session/practice-feedback.ts", "app/i18n/map-training-texts.ts", "app/i18n/difficulty-texts.ts"]) {
      expect(existsSync(gone)).toBe(false);
    }
  });
});
