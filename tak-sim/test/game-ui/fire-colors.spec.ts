/**
 * Game mode screen: the fire layer's colours by cell state and by the age of the player's knowledge, and the fuel
 * overlay's palette.
 */

import { describe, expect, it } from "vitest";
import { CELL, FUEL } from "../../app/game/contracts.js";
import { cellRgba, flickerNoise, FRESH_S, FUEL_COLORS, FUEL_LEGEND, knownRgba, NEVER_SEEN, STALE_S, staleness } from "../../app/game/ui/fire-colors.js";
import { GAME_TEXT } from "../../app/game/ui/text.js";

const sat = ([r, g, b]: readonly number[]) => Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
const lum = ([r, g, b]: readonly number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;

describe("fire colours from the player's picture", () => {
  it("never observed, unburned and fuel-less cells are transparent", () => {
    expect(knownRgba(NEVER_SEEN, 0)[3]).toBe(0);
    expect(cellRgba(CELL.unburned, 0)[3]).toBe(0);
    expect(cellRgba(CELL.noFuel, 0)[3]).toBe(0);
  });

  it("flaming is orange to yellow and opaque; it flickers with the noise", () => {
    const lo = cellRgba(CELL.burning, 0, 0);
    const hi = cellRgba(CELL.burning, 0, 1);
    for (const c of [lo, hi]) {
      expect(c[0]).toBe(255);
      expect(c[0]).toBeGreaterThan(c[1]);
      expect(c[1]).toBeGreaterThan(c[2]);
      expect(c[3]).toBeGreaterThan(200);
    }
    expect(hi[1]).toBeGreaterThan(lo[1]); // brighter, yellower at the top of the flicker
  });

  it("crowning is brighter than a surface fire", () => {
    expect(lum(cellRgba(CELL.burning, 0, 0.5, true))).toBeGreaterThan(lum(cellRgba(CELL.burning, 0, 0.5, false)));
  });

  it("smouldering is a dull red, burned out charcoal, put out blue-grey", () => {
    const sm = cellRgba(CELL.smouldering, 0);
    expect(sm[0]).toBeGreaterThan(sm[1] * 3);
    expect(lum(sm)).toBeLessThan(lum(cellRgba(CELL.burning, 0)));
    const out = cellRgba(CELL.burnedOut, 0);
    expect(lum(out)).toBeLessThan(60);
    expect(sat(out)).toBeLessThan(15);
    const ext = cellRgba(CELL.extinguished, 0);
    expect(ext[2]).toBeGreaterThan(ext[0]);
    expect(ext[3]).toBeGreaterThan(0);
  });

  it("stale knowledge fades and loses colour with age; fresh knowledge does not", () => {
    expect(staleness(0)).toBe(0);
    expect(staleness(FRESH_S)).toBe(0);
    expect(staleness(STALE_S)).toBe(1);
    expect(staleness(10 * STALE_S)).toBe(1);
    for (const s of [CELL.burning, CELL.smouldering, CELL.extinguished]) {
      const fresh = cellRgba(s, 0);
      const mid = cellRgba(s, (FRESH_S + STALE_S) / 2);
      const old = cellRgba(s, STALE_S);
      expect(mid[3]).toBeLessThan(fresh[3]);
      expect(old[3]).toBeLessThan(mid[3]);
      expect(old[3]).toBeGreaterThan(0); // still on the map: the player saw it once
      expect(sat(old)).toBeLessThan(sat(fresh));
    }
  });

  it("a stale flaming cell no longer flickers", () => {
    expect(cellRgba(CELL.burning, STALE_S, 0)).toEqual(cellRgba(CELL.burning, STALE_S, 1));
  });

  it("the flicker noise is 0..1, varies by cell and time, and is a pure function", () => {
    const vals = new Set<number>();
    for (let i = 0; i < 50; i++) {
      for (const ms of [0, 45, 90, 1234]) {
        const v = flickerNoise(i, ms);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        expect(flickerNoise(i, ms)).toBe(v);
        vals.add(Math.round(v * 100));
      }
    }
    expect(vals.size).toBeGreaterThan(20);
  });
});

describe("fuel overlay", () => {
  it("colours all 13 fuel classes distinctly, with a legend name for each in both languages", () => {
    expect(FUEL_LEGEND).toHaveLength(13);
    const seen = new Set<string>();
    for (const code of FUEL_LEGEND) {
      const c = FUEL_COLORS[code];
      expect(c, `fuel ${code}`).toBeDefined();
      expect(c![3]).toBeGreaterThan(0);
      seen.add(c!.slice(0, 3).join(","));
      expect(GAME_TEXT.fi.fuel[code]).toBeTruthy();
      expect(GAME_TEXT.en.fuel[code]).toBeTruthy();
    }
    expect(seen.size).toBe(13);
    expect(Object.values(FUEL).every((code) => FUEL_COLORS[code] !== undefined)).toBe(true);
  });
});
