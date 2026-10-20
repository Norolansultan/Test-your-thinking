/**
 * Game mode (SPEC/29): `content/game/world.json` decoded (`app/game/world/load.ts`) matches its sources — the 25 m
 * grids cell for cell, the command post and ignition point where the site and the map overlay put them, lakes on
 * water — and carries the water points, settlements, assets and entry nodes the game needs.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FUEL, type XY } from "../../app/game/contracts.js";
import { decodeBase64, encodeBase64, getWorld, loadWorld } from "../../app/game/world/load.js";
import { cellOf, distance } from "../../app/game/world/grid.js";
import { localToLngLat, tm35ToLocal } from "../../app/game/world/geo.js";
import { parseAsciiGrid } from "../../tools/fire-ca/ascii-grid.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const world = getWorld();
const MARGIN = 1500;
const inMargin = (p: XY) => p.x >= -MARGIN && p.x <= 10_000 + MARGIN && p.y >= -MARGIN && p.y <= 10_000 + MARGIN;

/** Metres between two WGS84 points (equirectangular; fine at metre scale). */
function metresApart(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.PI / 180;
  const dx = (a[0] - b[0]) * k * 6_371_000 * Math.cos(a[1] * k);
  const dy = (a[1] - b[1]) * k * 6_371_000;
  return Math.sqrt(dx * dx + dy * dy);
}

describe("base64", () => {
  it("round-trips every length and byte value", () => {
    for (let n = 0; n < 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n * 31) & 0xff);
      expect([...decodeBase64(encodeBase64(bytes))]).toEqual([...bytes]);
    }
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect([...decodeBase64(encodeBase64(all))]).toEqual([...all]);
    expect(encodeBase64(new TextEncoder().encode("Mökki"))).toBe("TcO2a2tp");
    expect(() => decodeBase64("ab$c")).toThrow(/invalid base64/);
  });
});

describe("decoded world", () => {
  it("is the 400 × 400, 25 m grid at TM35 514000 / 6741000", () => {
    expect(world.grid).toEqual({ cols: 400, rows: 400, cellM: 25, originTm35: { east: 514_000, north: 6_741_000 } });
    expect(world.fuel.length).toBe(160_000);
    expect(world.elevation.length).toBe(160_000);
  });

  it("matches fuel_truth.asc and elevation.asc cell for cell (row 0 north)", () => {
    const fuel = parseAsciiGrid(read("content/site/fuel_truth.asc"));
    const elev = parseAsciiGrid(read("content/site/elevation.asc"));
    let worst = 0;
    for (let row = 0; row < 400; row++) {
      for (let col = 0; col < 400; col++) {
        const src = (399 - row) * 400 + col; // parseAsciiGrid keeps row 0 south
        const i = row * 400 + col;
        if (world.fuel[i] !== fuel.values[src]) throw new Error(`fuel differs at row ${row} col ${col}`);
        worst = Math.max(worst, Math.abs(world.elevation[i]! - elev.values[src]!));
      }
    }
    expect(worst).toBeLessThan(0.051);
    // The file's first data row is the north edge: its first values as written.
    const ascFirst = read("content/site/fuel_truth.asc").split("\n")[6]!.trim().split(/\s+/).slice(0, 16).map(Number);
    expect([...world.fuel.subarray(0, 16)]).toEqual(ascFirst);
    expect(world.elevation[0]).toBeCloseTo(Number(read("content/site/elevation.asc").split("\n")[6]!.trim().split(/\s+/)[0]), 4);
  });

  it("puts the command post and the ignition point where the site and the map overlay do", () => {
    const site = JSON.parse(read("content/site/site.json")) as { commandPointTm35: { eastM: number; northM: number }; ignitionTm35: { eastM: number; northM: number } };
    expect(world.commandPost).toEqual(tm35ToLocal(world.grid, { east: site.commandPointTm35.eastM, north: site.commandPointTm35.northM }));
    expect(world.commandPost).toEqual({ x: 4000, y: 5400 });
    const ign = tm35ToLocal(world.grid, { east: site.ignitionTm35.eastM, north: site.ignitionTm35.northM });
    expect(ign).toEqual({ x: 5000, y: 5000 });
    expect(cellOf(world, ign)).toBe(199 * 400 + 200);
    const overlay = JSON.parse(read("app/render/ui/map-overlay.json")) as { commandPost: { lat: number; lon: number } };
    expect(metresApart(localToLngLat(world.grid, world.commandPost), [overlay.commandPost.lon, overlay.commandPost.lat])).toBeLessThan(1);
    // The command post is on the road network (the R1/R3 junction).
    expect(world.roads.nodes.some((n) => distance(n, world.commandPost) < 1)).toBe(true);
  });

  it("puts every lake and pond label inside the grid on water cells", () => {
    const lakes = world.labels.filter((l) => l.style === "water" && /(järvi|lampi)$/.test(l.textFi) && cellOf(world, l.at) >= 0);
    // On the rebuilt map (SPEC/33) Mustajärvi lies west of the grid; Särkijärvi and Kivijärvi's label are inside it.
    expect(lakes.map((l) => l.textFi)).toEqual(expect.arrayContaining(["Karhujärvi", "Haukilampi", "Särkijärvi", "Kivijärvi"]));
    for (const l of lakes) expect([l.textFi, world.fuel[cellOf(world, l.at)]]).toEqual([l.textFi, FUEL.water]);
  });

  it("keeps labels (Finnish and English), assets and the power line within the grid plus margin", () => {
    expect(world.labels.length).toBeGreaterThan(10);
    for (const l of world.labels) {
      expect(inMargin(l.at)).toBe(true);
      expect(l.textEn.length).toBeGreaterThan(0);
    }
    expect(world.labels.find((l) => l.textFi === "Karhujärvi")?.textEn).toBe("Bear Lake");
    for (const a of world.assets) expect(inMargin(a.at)).toBe(true);
    expect(world.powerLine.length).toBeGreaterThanOrEqual(2);
    for (const p of world.powerLine) expect(inMargin(p)).toBe(true);
  });

  it("has houses, barns and the 20 kV line's wooden poles every 60–80 m (SPEC/33 (bc))", () => {
    const kinds = new Map<string, number>();
    for (const a of world.assets) kinds.set(a.kind, (kinds.get(a.kind) ?? 0) + 1);
    expect(kinds.get("house")).toBeGreaterThan(20);
    expect(kinds.get("barn")).toBeGreaterThan(5);
    const poles = world.assets.filter((a) => a.kind === "power_pylon");
    expect(poles.length).toBeGreaterThan(150);
    for (const p of poles) expect(p.id).toMatch(/^pole-\d{3}$/);
    for (const p of poles) expect(p.value).toBe(20);
    for (const h of world.assets.filter((a) => a.kind === "house")) expect(h.value).toBe(100);
    for (let k = 1; k < poles.length; k++) {
      const d = distance(poles[k - 1]!.at, poles[k]!.at);
      expect(d).toBeGreaterThanOrEqual(60);
      expect(d).toBeLessThanOrEqual(80);
    }
    expect(new Set(world.assets.map((a) => a.id)).size).toBe(world.assets.length);
  });

  it("stands no building in water: every house and barn on the grid is on a cell that is not a lake", () => {
    const wet = world.assets.filter((a) => a.kind !== "power_pylon" && cellOf(world, a.at) >= 0 && world.fuel[cellOf(world, a.at)] === FUEL.water);
    expect(wet.map((a) => a.id)).toEqual([]);
    // Mökkiranta's shore cabin the 25 m raster put in Karhujärvi (house-024) stands on the shore.
    const cabin = world.assets.find((a) => a.id === "house-024")!;
    expect(cabin.settlementId).toBe("mokkiranta");
    expect(world.fuel[cellOf(world, cabin.at)]).not.toBe(FUEL.water);
  });

  it("takes every name from the map: no numbered or generic settlement or water names", () => {
    // Only clusters the map names are settlements (Hiekkala's label lies just beyond the world's labels, so the names
    // are listed rather than looked up).
    expect(world.settlements.map((s) => s.nameFi)).toEqual(["Lahdenkylä", "Mökkiranta", "Niemelä", "Koivula", "Hiekkala"]);
    for (const s of world.settlements) expect(s.nameFi).not.toMatch(/^Asutus\b/);
    for (const w of world.waterPoints) {
      expect(w.nameFi).not.toMatch(/^(Järvi|Lampi|Joki|Oja) \d/);
      expect(w.nameEn).not.toMatch(/^(Lake|Pond|River|Brook) \d/);
    }
    // Unnamed water is named after a map label: the village's farm pond (W2), a lake beside Pitkäjärvi.
    expect(world.waterPoints.find((w) => w.nameFi === "Lahdenkylän lampi")?.nameEn).toBe("Bay Village Pond");
    expect(world.waterPoints.some((w) => w.nameFi === "Pikku-Pitkäjärvi" && w.nameEn === "Little Long Lake")).toBe(true);
  });

  it("has the directive's two settlements, each with its houses", () => {
    const byName = new Map(world.settlements.map((s) => [s.nameFi, s]));
    for (const [fi, en] of [["Lahdenkylä", "Bay Village"], ["Mökkiranta", "Lakeside Cottages"]] as const) {
      const s = byName.get(fi);
      expect(s, fi).toBeDefined();
      expect(s!.nameEn).toBe(en);
      expect(s!.assetIds.length).toBeGreaterThanOrEqual(10);
      for (const id of s!.assetIds) expect(world.assets.find((a) => a.id === id)?.settlementId).toBe(s!.id);
    }
    expect(byName.get("Lahdenkylä")!.id).toBe("lahdenkyla");
    expect(byName.get("Mökkiranta")!.id).toBe("mokkiranta");
    // Settlement membership is consistent both ways.
    for (const a of world.assets) {
      if (a.settlementId !== null) expect(world.settlements.find((s) => s.id === a.settlementId)?.assetIds).toContain(a.id);
    }
  });

  it("has water points with road access, named, on the network the command post is on", () => {
    const withRoad = world.waterPoints.filter((w) => w.roadNode !== null);
    expect(withRoad.length).toBeGreaterThanOrEqual(3);
    expect(new Set(world.waterPoints.map((w) => w.id)).size).toBe(world.waterPoints.length);
    for (const w of withRoad) expect(world.roads.nodes[w.roadNode!]).toEqual(w.at);
    for (const w of world.waterPoints) {
      expect(w.nameFi.length).toBeGreaterThan(0);
      expect(w.nameEn.length).toBeGreaterThan(0);
      // Lakes' scoop points inside the grid are on open water.
      if ((w.kind === "lake" || (w.kind === "pond" && w.nameFi !== "Lahdenkylän lampi")) && cellOf(world, w.scoop) >= 0) expect(world.fuel[cellOf(world, w.scoop)]).toBe(FUEL.water);
    }
    expect(world.waterPoints.find((w) => w.nameFi === "Karhujärvi")?.roadNode).not.toBeNull();
    expect(world.waterPoints.some((w) => w.kind === "river" && w.roadNode !== null)).toBe(true);
  });

  it("has 3–6 entry nodes on the playable area's edge, on main or gravel roads", () => {
    expect(world.entryNodes.length).toBeGreaterThanOrEqual(3);
    expect(world.entryNodes.length).toBeLessThanOrEqual(6);
    for (const id of world.entryNodes) {
      const p = world.roads.nodes[id]!;
      const onEdge = Math.min(Math.abs(p.x), Math.abs(p.x - 10_000), Math.abs(p.y), Math.abs(p.y - 10_000)) < 0.05;
      expect(onEdge).toBe(true);
      expect(world.roads.edges.some((e) => (e.a === id || e.b === id) && (e.cls === "main" || e.cls === "gravel"))).toBe(true);
    }
  });

  it("rejects a malformed file", () => {
    const json = JSON.parse(read("content/game/world.json")) as Record<string, unknown>;
    expect(() => loadWorld({ ...json, format: "other" })).toThrow(/not a/);
    expect(() => loadWorld({ ...json, fuel: encodeBase64(new Uint8Array(10)) })).toThrow(/fuel has 10 cells/);
    expect(() => loadWorld({ ...json, entryNodes: [1e9] })).toThrow(/entry node/);
    expect(() => loadWorld(null)).toThrow();
  });
});
