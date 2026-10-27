/**
 * The training incident's screen (SPEC/08 (bp) §bp.1, SPEC/15 (bp)): the lock on the live map and the blank memory-check map (its
 * bounds, frame, presets and tiles), the feedback's drawing, and — checked at the source, as the other screens' hooks are — that the
 * screen is played on the session's real components (MapView, the TAK toolbar and panes, the SPAM card, the freeze screen), that the
 * Thinker pane is never in it, that Haku is never opened for the participant, and that the retired screens are gone.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };
import { tilesMeeting, trainingMapLock } from "../../app/render/ui/training-lock.js";
import { TRAINING_COLOURS, trainingFeedbackFeatures } from "../../app/render/ui/training-overlay.js";
import { trainingPanes } from "../../app/render/ui/components/TrainingStage.js";
import { widenBox } from "../../app/session/training/area.js";
import { AREA, TRAINING_FIXTURE } from "../session/training-fixture.js";

const src = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");

describe("the training's lock (SPEC/08 (bp) §bp.1)", () => {
  it("the lock box is the square plus its 100 m margin (tiles, answers); presets 2.5 km (the whole square) and 1 km, in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      const lock = trainingMapLock(TRAINING_FIXTURE, lang);
      expect(lock.area).toEqual(AREA);
      expect(lock.bounds).toEqual(widenBox(AREA, 100));
      expect(lock.bounds.north - AREA.north).toBeCloseTo(100 / 111_320, 8);
      expect(lock.presets.map((p) => [p.label, p.widthM])).toEqual([[lang === "fi" ? "2,5 km" : "2.5 km", null], ["1 km", 1_000]]);
    }
  });

  it("loads only the basemap tiles meeting the lock: the north-east corner's one tile", () => {
    const tiles = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as [number, number][] }));
    const met = tilesMeeting(tiles, widenBox(AREA, 100));
    expect(met.map((t) => t.url)).toEqual(["/maps/topo/0_3.webp"]);
    expect(tilesMeeting(tiles, { south: -90, west: -180, north: 90, east: 180 })).toHaveLength(16);
  });

  // The frame, the lowest zoom and `maxBounds` are tested geometrically on MapLibre's own transform (`training-lock-frame.spec.ts`,
  // review 27 Oct 2026); here only that the maps take them from `lockLimits` at their size, and the lock's other parts.
  it("MapView and FreezeMap take their limits from `lockLimits` at their size, on every resize; tiles, presets; no reference overlay or rows", () => {
    const map = src("components/MapView.tsx");
    expect(map).toMatch(/readonly lock\?: MapLock \| undefined;/);
    expect(map).toMatch(/const limits = lock \? lockLimits\(lock, width, containerRef\.current\.clientHeight \|\| 720, LIVE_LOCK_PADS\) : null;/);
    expect(map).toMatch(/maxBounds: limits \? limits\.maxBounds : panBounds\(extent, PAN_LIMIT_M\)/);
    expect(map).toMatch(/minZoom: limits \? first\.zoom/);
    expect(map).toMatch(/lockLimits\(lockNow, el\.clientWidth \|\| 1280, el\.clientHeight \|\| 720, LIVE_LOCK_PADS\);\s*map\.setMaxBounds\(null\);\s*map\.setMinZoom\(camera\.zoom\);\s*map\.setMaxBounds\(maxBounds\);/);
    // A map at its lowest zoom (its frame) is refitted on a resize, whatever the participant tried; zoomed in, it gets new limits.
    expect(map).toMatch(/map\.on\("moveend", \(\) => \{ atLockFrameRef\.current = map\.getZoom\(\) <= map\.getMinZoom\(\) \+ 1e-6; \}\);\s*map\.on\("resize", \(\) => \{ if \(atLockFrameRef\.current\) onDefaultRef\.current = true; else if \(!onDefaultRef\.current\) applyLock\(map, lock\); \}\);\s*\}\s*map\.on\("resize", \(\) => \{ if \(onDefaultRef\.current\) frameDefault\(map\); \}\);/);
    expect(map).toMatch(/\(lock \? tilesMeeting\(TOPO_TILES, lock\.bounds\) : TOPO_TILES\)/);
    expect(map).toMatch(/if \(!lock\) addOverlayLines\(map\);/);
    expect(map).toMatch(/const levels = lock\?\.presets \?\? ZOOM_LEVELS/);
    expect(map).toMatch(/legendPresence\(snapshot\.renderTree\.cycleInfo, snapshot\.currentEnvelope !== null, drawn, lock === undefined\)/);
    expect(map).not.toMatch(/lockMaxBounds/);
    const freezeMap = src("components/FreezeMap.tsx");
    expect(freezeMap).toMatch(/lockLimits\(lock, el\.clientWidth \|\| 600, el\.clientHeight \|\| 600, FREEZE_LOCK_PADS\)/);
    expect(freezeMap).toMatch(/relimit\(\); \/\/ locked: the frame's limits from the start/);
    expect(freezeMap).toMatch(/map\.on\("resize", \(\) => \{ if \(atFrame\.current\) onDefault\.current = true; else if \(!onDefault\.current\) relimit\(\); \}\);\s*\}\s*map\.on\("resize", \(\) => \{ if \(onDefault\.current\) refit\(\); \}\);/);
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
    expect(screen).toMatch(/<FreezeScreen key=\{item\.id\} freeze=\{snapshot\.freeze\} orchestrator=\{orchestrator\} showLevels=\{false\} progress=\{\{ position: view\.position, count: view\.itemCount \}\} lock=\{lock\} note=\{trainingUi\(lang, "freezeNote"\)\} \/>/);
    const freeze = src("components/FreezeScreen.tsx");
    expect(freeze).toMatch(/progress\?: \{ readonly position: number; readonly count: number \} \| undefined; readonly lock\?: MapLock \| undefined;/);
    // Review 27 Oct 2026, finding 5: the training's note replaces the session's "the clock has stopped" (its cap runs above it).
    expect(freeze).toMatch(/\{note \?\? t\.freezeNote\}/);
    expect(freeze).toMatch(/<FreezeMap extent=\{extent\} lock=\{lock\}/);
  });

  it("the memory exposure shows what to remember, not the blank map's instruction; S5 says when the cap ended the items (review 27 Oct 2026)", () => {
    const panels = src("components/TrainingPanels.tsx");
    const study = panels.slice(panels.indexOf("export function TrainingStudyPanel("), panels.indexOf("export function TrainingFeedbackPanel("));
    expect(study).toMatch(/<Glossed text=\{trainingUi\(lang, "memoryExposure"\)\} surface="training" \/>/);
    expect(study).not.toMatch(/\.stem\b|TRAINING_TEXT\[lang\]\.item/);
    expect(stage).toMatch(/\{view\.phase === "study" && <TrainingStudyPanel secondsLeft=\{studySecondsLeft\} \/>\}/);
    // The stem ("Merkitse kartalle, missä EK53 oli.") comes with the blank map, as the freeze screen's prompt.
    expect(src("../../session/training/view.ts")).toMatch(/promptFi: TRAINING_TEXT\[lang\]\.item\(item\.id\)\.stem, kind: item\.answer === "point" \? "map_point" : "choice"/);
    const demo = panels.slice(panels.indexOf("export function TrainingDemoPage("));
    expect(demo).toMatch(/\{capEnded && <p data-testid="training-cap-ended" role="status"[^>]*>\{trainingUi\(lang, "capEnded"\)\}<\/p>\}/);
    expect(screen).toMatch(/<TrainingDemoPage cell=\{orchestrator\.logHeader\.cell\} secondsLeft=\{left\.demo\} capEnded=\{view\.endReason === "timeout"\}/);
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
