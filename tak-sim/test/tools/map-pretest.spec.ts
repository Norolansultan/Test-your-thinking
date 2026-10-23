/**
 * The map-reading pretest's build (difficulty audit, 23 Oct 2026; `tools/review/map-pretest.ts`, `proposal-map.md` c.2): the keys are
 * computed from the site data, never typed — the committed outputs are exactly what the tool writes now; the extract lies outside the
 * incident and names nothing of it; every item has its key among its options; the participant's file carries no key; the marks keep
 * their distance; the margins the rules demand hold.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMapPretest, CROP, json, previewSvg, readTopoFeatures } from "../../tools/review/map-pretest.js";
import { MAP_PRETEST } from "../../app/session/map-pretest.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";

const built = buildMapPretest(readTopoFeatures("."));
const key = JSON.parse(readFileSync("content/pretest/map-pretest.key.json", "utf8")) as { items: Record<string, { key: string }> };

describe("the map-reading pretest's build (difficulty audit c.2)", () => {
  it("writes exactly the committed files: the participant's spec, the key and the checkers' preview (keys computed, never typed)", () => {
    expect(json(built.spec)).toBe(readFileSync("content/pretest/map-pretest.json", "utf8"));
    expect(json(built.key)).toBe(readFileSync("content/pretest/map-pretest.key.json", "utf8"));
    expect(previewSvg(built.spec, "../../../app/render/ui/public/maps/topo/0_3.webp")).toBe(readFileSync("docs/audits/2026-10-23-difficulty/map-pretest-preview.svg", "utf8"));
    expect(MAP_PRETEST).toEqual(built.spec);
  });

  it("the participant's file carries no key; every item's key (in the key file) is one of its options", () => {
    expect(JSON.stringify(MAP_PRETEST)).not.toMatch(/"key"|correct/);
    expect(MAP_PRETEST.items.map((i) => i.id)).toEqual(Object.keys(key.items)); // determinism-lint-allow: a test reads a JSON object's keys
    for (const item of MAP_PRETEST.items) {
      expect(item.options.length, item.id).toBe(4);
      expect(new Set(item.options.map((o) => o.id)).size, item.id).toBe(4);
      expect(item.options.map((o) => o.id), item.id).toContain(key.items[item.id]!.key);
      for (const o of item.options) expect(o.fi.length > 0 && o.en.length > 0, `${item.id} ${o.id}`).toBe(true);
    }
    expect(MAP_PRETEST.items.length).toBeGreaterThanOrEqual(5);
    expect(MAP_PRETEST.timeLimitMs).toBe(240_000);
  });

  it("the extract lies outside the incident's extent and names nothing the session names (Kaitajärvi is in no record, item or radio text)", () => {
    const e = SITE_SCENARIO.extent;
    const ne = wgs84ToTm35({ lat: e.north, lon: e.east });
    const west = 509_000 + CROP.x0 * 4, north = 6_756_000 - CROP.y0 * 4, south = north - CROP.size * 4;
    expect(west > ne.eastM || south > ne.northM).toBe(true);
    const scenario = buildDemoScenario();
    const texts = [
      ...scenario.atoms.map((a) => recordText(toRenderable(a).record)),
      ...[...scenario.freezes, scenario.practice.freeze].flatMap((f) => f.items.flatMap((it) => [it.promptFi, ...it.options.map((o) => o.labelFi)])),
      ...scenario.probeSchedule.probes.map((p) => p.prompt),
    ];
    for (const t of texts) expect(t, t.slice(0, 60)).not.toMatch(/Kaitajärv|Narrow Lake/);
  });

  it("the marks are inside the extract and at least 40 px (160 m) apart; the area mark and the stems name what the marks show", () => {
    const m = MAP_PRETEST.marks;
    expect(m.map((x) => x.label).sort((a, b) => (a < b ? -1 : 1))).toEqual(["1", "2", "A", "B", "X", "★"]);
    for (const a of m) {
      expect(a.x > 0 && a.x < CROP.size && a.y > 0 && a.y < CROP.size, a.id).toBe(true);
      for (const b of m) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(40);
    }
    expect(m.find((x) => x.label === "X")!.kind).toBe("area");
  });

  it("the rules' margins hold: the slope ratio ≥ 2.5, the nearest water ≥ 1.4 × nearer than the next and than any ditch, the distance within 3 % of its option, the direction ≥ 20° from N/E/S/W", () => {
    const k = built.key.items as Record<string, Record<string, unknown>>;
    expect(k["pretest.p2.slope"]!.ratio as number).toBeGreaterThanOrEqual(2.5);
    expect(k["pretest.p3.water"]!.ratio as number).toBeGreaterThanOrEqual(1.4);
    const water = k["pretest.p3.water"]!.metres as Record<string, number>;
    expect(k["pretest.p3.water"]!.ditchMetres as number).toBeGreaterThanOrEqual(1.4 * water[k["pretest.p3.water"]!.key as string]!);
    const option = Number(String(k["pretest.p5.distance"]!.key).slice(1));
    expect(Math.abs((k["pretest.p5.distance"]!.metres as number) - option)).toBeLessThanOrEqual(0.03 * option);
    expect(k["pretest.p6.direction"]!.fromCardinalDeg as number).toBeGreaterThanOrEqual(20);
    expect(k["pretest.p1.square"]!.gridLineGapPx as number).toBeGreaterThanOrEqual(12);
  });
});
