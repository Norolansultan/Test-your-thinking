/**
 * SPEC/28 §5 Video: one tile per drone in the air, a synthetic thermal frame drawn from renderable data only — the
 * drone's footprint and the reported fire inside it, white-hot on dark. Deterministic (I1): the same scene gives the same
 * pixel buffer, byte for byte, whatever was drawn before; no clock, no randomness, no network.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { assertNoTruthKeysPresent, toRenderableCycle, type RenderableCycle } from "../../app/boundary/render-boundary.js";
import { videoFeeds } from "../../app/render/ui/tak/shell.js";
import { footprintSize, frameHash, renderThermalFrame, thermalSceneOf, THERMAL_FRAME_SIZE } from "../../app/render/ui/tak/thermal-frame.js";

const scenario = buildDemoScenario();
const cycleOf = (index: number): RenderableCycle => toRenderableCycle(scenario.cycles.find((c) => c.index === index)!);
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Mean brightness of a frame, 0–255. */
const mean = (d: Uint8ClampedArray) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]!; return s / (d.length / 4); };
const hot = (d: Uint8ClampedArray, min = 235) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i]! >= min) n++; return n; };

describe("video feeds", () => {
  it("one tile per drone in the air, by id; helicopters and spotter aircraft have none; a grounded drone has none", () => {
    expect(videoFeeds(cycleOf(5)).map((f) => f.platformId)).toEqual(["DR1", "DR2", "DR3"]);
    expect(videoFeeds(cycleOf(6)).map((f) => f.platformId)).toEqual(["DR2"]); // DR1 and DR3 grounded; HELI1 is not a drone
    expect(videoFeeds(cycleOf(9)).map((f) => f.platformId)).toEqual(["DR1", "DR2", "DR3", "VD1"]); // SPOT is not a drone
    expect(videoFeeds(cycleOf(9)).find((f) => f.platformId === "DR3")!.takKind).toBe("uav_fixed");
    expect(videoFeeds(null)).toEqual([]);
    for (const i of [1, 5, 9, 13]) assertNoTruthKeysPresent(videoFeeds(cycleOf(i)));
  });
});

describe("the synthetic thermal frame", () => {
  const cycle = cycleOf(5);
  const feeds = videoFeeds(cycle);
  const scene = (id: string) => thermalSceneOf(feeds.find((f) => f.platformId === id)!.footprint!, cycle.fire);

  it("is deterministic: the same scene gives the same pixel buffer and hash, whatever was drawn in between", () => {
    const a = renderThermalFrame(scene("DR1"));
    renderThermalFrame(scene("DR3"));
    const b = renderThermalFrame(scene("DR1"));
    expect(a.width).toBe(THERMAL_FRAME_SIZE.width);
    expect(a.data.length).toBe(THERMAL_FRAME_SIZE.width * THERMAL_FRAME_SIZE.height * 4);
    expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true);
    expect(frameHash(b)).toBe(frameHash(a));
    expect(frameHash(a)).toMatch(/^[0-9a-f]{8}$/);
    // A scene rebuilt from a fresh renderable cycle (new objects, same data) gives the same frame too.
    const again = renderThermalFrame(thermalSceneOf(videoFeeds(cycleOf(5)).find((f) => f.platformId === "DR1")!.footprint!, cycleOf(5).fire));
    expect(frameHash(again)).toBe(frameHash(a));
  });

  it("differs between footprints and between views (it shows what the footprint covers)", () => {
    const hashes = new Set(["DR1", "DR2", "DR3"].map((id) => frameHash(renderThermalFrame(scene(id)))));
    expect(hashes.size).toBe(3);
    const v9 = cycleOf(9);
    const dr1v9 = thermalSceneOf(videoFeeds(v9).find((f) => f.platformId === "DR1")!.footprint!, v9.fire);
    expect(frameHash(renderThermalFrame(dr1v9))).not.toBe(frameHash(renderThermalFrame(scene("DR1"))));
  });

  it("is white-hot on dark: the reported fire edge inside the footprint is hot, the ground cool; no fire, no hot pixels", () => {
    const withFire = renderThermalFrame(scene("DR1"));
    expect(hot(withFire.data)).toBeGreaterThan(30);
    expect(mean(withFire.data)).toBeLessThan(110);
    const noFire = renderThermalFrame(thermalSceneOf(feeds[0]!.footprint!, null));
    expect(hot(noFire.data, 200)).toBe(0);
    expect(mean(noFire.data)).toBeLessThan(70);
    for (let i = 3; i < withFire.data.length; i += 4) expect(withFire.data[i]).toBe(255);
  });

  it("a drone without a footprint gets a uniform dark frame; the footprint's size is its box on the ground", () => {
    const empty = renderThermalFrame({ footprint: [], burnt: [], burning: [], edges: [], spots: [], detections: [] });
    expect(new Set(Array.from(empty.data.filter((_, i) => i % 4 === 0))).size).toBe(1);
    const size = footprintSize(feeds[0]!.footprint!);
    expect(size.widthM).toBeGreaterThan(300);
    expect(size.widthM).toBeLessThan(1200);
    expect(size.heightM).toBeGreaterThan(300);
  });

  it("reads no clock, draws no random number and makes no request", () => {
    for (const f of ["app/render/ui/tak/thermal-frame.ts", "app/render/ui/tak/VideoPane.tsx"]) {
      const src = code(f);
      expect(src, f).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date\(|crypto\.|fetch\(|XMLHttpRequest|WebSocket|<video|<img/);
    }
  });
});
