/**
 * The training incident's build (SPEC/08 (bp) §bp.9, `15` (bp) §bp.7): `npm run training:build` rewrites the committed files byte for
 * byte (every key computed from the site, the contract and the corpus, never typed); the app's `TRAINING` is exactly the built spec;
 * the shape the session relies on (13 items in S1–S4, S5 empty, the cap, the card window, the exposure, "now"); the option order is
 * seeded, the same every build, and the key's place varies; `basemapLatLon` inverts `basemapPx`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTraining, CAP_MS, trainingFiles, TRAINING_VERSION } from "../../tools/review/training.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { memoryExposureScene, sceneOf } from "../../app/session/training/scenes.js";
import { basemapLatLon, basemapPx } from "../../app/render/ui/basemap-px.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";

const built = buildTraining(".");
const files = trainingFiles(built);

describe("the training incident's build (SPEC/08 (bp) §bp.9)", () => {
  it("writes exactly the committed files, and writes the same bytes twice", () => {
    for (const [path, body] of Object.entries(files)) expect(body, path).toBe(readFileSync(path, "utf8"));
    const again = trainingFiles(buildTraining("."));
    for (const [path, body] of Object.entries(files)) expect(again[path], path).toBe(body);
  });

  it("the app's TRAINING is the built spec", () => {
    expect(JSON.parse(JSON.stringify(TRAINING))).toEqual(JSON.parse(JSON.stringify(built.spec)));
    expect(TRAINING.version).toBe(TRAINING_VERSION);
  });

  it("has 13 items in S1–S4 (4, 2, 3, 4) and an empty S5, in order, with the cap, the card window, S5's delay and 'now'", () => {
    expect(TRAINING.items.map((it) => it.id)).toEqual([
      "training.s1.place", "training.s1.measure", "training.s1.slope", "training.s1.water", "training.s2.now", "training.s2.project",
      "training.s3.records1", "training.s3.older", "training.s3.records2", "training.s4.memory", "training.s4.log", "training.s4.map", "training.s4.records",
    ]);
    expect(TRAINING.items.map((it) => it.position)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(TRAINING.sections.map((s) => [s.id, s.itemIds.length])).toEqual([["s1", 4], ["s2", 2], ["s3", 3], ["s4", 4], ["s5", 0]]);
    expect(TRAINING.capMs).toBe(CAP_MS);
    expect(CAP_MS).toBe(720_000);
    expect(TRAINING.cardWindowMs).toBe(60_000);
    expect(TRAINING.demoMinDwellMs).toBe(10_000);
    expect(TRAINING.now).toEqual({ virtualTimeS: -10_920, label: "10.18" });
    expect(TRAINING.items.map((it) => it.mode)).toEqual(["live", "live", "live", "live", "live", "live", "card", "card", "card", "freeze", "freeze", "freeze", "freeze"]);
    expect(TRAINING.items.filter((it) => it.optional).map((it) => it.id)).toEqual(["training.s1.slope"]);
    expect(TRAINING.items.filter((it) => it.covariate).map((it) => [it.id, it.covariate])).toEqual([
      ["training.s1.place", "point_visible"], ["training.s3.records1", "seek_first"], ["training.s4.memory", "point_memory"],
    ]);
    const mem = TRAINING.items.find((it) => it.memory)!;
    expect(mem.memory).toMatchObject({ unit: "EK53", exposureMs: 8_000 });
    expect(mem.key).toEqual({ point: mem.memory!.at });
  });

  it("every choice key is one of its options, the options are unique, a point item has none", () => {
    for (const it of TRAINING.items) {
      if (it.answer === "point") { expect(it.options, it.id).toEqual([]); expect("point" in it.key, it.id).toBe(true); continue; }
      const ids = it.options.map((o) => o.id);
      expect(new Set(ids).size, it.id).toBe(ids.length);
      expect("optionId" in it.key && ids.includes(it.key.optionId), it.id).toBe(true);
    }
  });

  it("the option order is seeded (the same every build) and the key's place varies", () => {
    const order = (built.key.optionOrder as Record<string, { keyPosition: number }>);
    const places = Object.values(order).map((o) => o.keyPosition);
    expect(new Set(places).size).toBeGreaterThanOrEqual(3);
    expect(Math.max(...[1, 2, 3, 4].map((p) => places.filter((x) => x === p).length))).toBeLessThanOrEqual(places.length / 2);
    for (const it of TRAINING.items.filter((i) => i.answer === "choice")) expect(order[it.id]!.keyPosition, it.id).toBe(it.options.findIndex((o) => "optionId" in it.key && o.id === it.key.optionId) + 1);
  });

  it("the scenes: s1 calm, no fire, no units; the incident's fire mapped at 10.00 with its head, EK51 at the tail, the wind from the spread's reverse", () => {
    const { s1, incident } = TRAINING.scenes;
    expect(s1.perimeter).toEqual([]);
    expect(Object.keys(s1.unitPositions)).toEqual([]);
    expect(s1.wind.meanMs).toBe(0);
    expect(incident.clockLabel).toBe("10:00");
    expect(incident.startsAtVirtual).toBe(-12_000);
    expect(incident.index).toBe(0);
    expect(Object.keys(incident.unitPositions)).toEqual(["EK51"]);
    expect(incident.fire.perimeter_current.filter((s) => s.is_head)).toHaveLength(1);
    expect(incident.fire.burnt_area.geometry).toHaveLength(1);
    const dir = (built.key.items as Record<string, Record<string, unknown>>)["training.s2.now"]!.direction;
    expect(incident.wind.fromDeg).toBe({ ne: 225, n: 180, e: 270, nw: 135, se: 315 }[dir as string]);
    const ring = incident.perimeter[0]!;
    expect(ring[0]).toEqual(ring.at(-1));
    expect(memoryExposureScene(TRAINING).unitPositions).toEqual({ EK53: TRAINING.items[9]!.memory!.at });
    expect(sceneOf(TRAINING, "training.s2.now")).toBe(incident);
  });

  it("the area: the 2.5 km square of the basemap's north-east corner, the lock 100 m beyond it", () => {
    const b = TRAINING.area.bounds;
    const sw = wgs84ToTm35({ lat: b.south, lon: b.west }), ne = wgs84ToTm35({ lat: b.north, lon: b.east });
    expect(sw.eastM).toBeGreaterThan(526_400);
    expect(ne.eastM).toBeLessThan(529_100);
    expect(sw.northM).toBeGreaterThan(6_753_400);
    expect(ne.northM).toBeLessThan(6_756_100);
    expect(TRAINING.area.lockMarginM).toBe(100);
  });
});

describe("basemapLatLon (revision (bp))", () => {
  it("inverts basemapPx to a fraction of a pixel, and agrees with the TM35 projection within 3 m", () => {
    for (const p of [{ x: 4375, y: 0 }, { x: 4700.5, y: 312.25 }, { x: 4999, y: 624 }, { x: 1250, y: 1250 }, { x: 2600.3, y: 3999.9 }]) {
      const q = basemapPx(basemapLatLon(p));
      expect(Math.hypot(q.x - p.x, q.y - p.y), JSON.stringify(p)).toBeLessThan(0.05);
      const tm = wgs84ToTm35(basemapLatLon(p));
      expect(Math.hypot(tm.eastM - (509_000 + p.x * 4), tm.northM - (6_756_000 - p.y * 4)), JSON.stringify(p)).toBeLessThan(3);
    }
  });
});
