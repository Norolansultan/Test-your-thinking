/**
 * Game mode weather (app/game/weather/weather.ts): interpolation, fine-fuel moisture, radio wording.
 */

import { describe, expect, it } from "vitest";
import type { WeatherKey } from "../../app/game/contracts.js";
import { angleDiffDeg, describeWeatherEn, describeWeatherFi, fineFuelMoisture, weatherAt } from "../../app/game/weather/weather.js";

const KEYS: readonly WeatherKey[] = [
  { atS: 0, windFromDeg: 225, windMs: 4, gustMs: 7, tempC: 20, rh: 40 },
  { atS: 3600, windFromDeg: 135, windMs: 8, gustMs: 13, tempC: 26, rh: 24 },
  { atS: 7200, windFromDeg: 350, windMs: 6, gustMs: 9, tempC: 22, rh: 30 },
];

describe("weatherAt", () => {
  it("holds the first and last keys outside their span", () => {
    expect(weatherAt(KEYS, -100)).toEqual({ windFromDeg: 225, windMs: 4, gustMs: 7, tempC: 20, rh: 40 });
    expect(weatherAt(KEYS, 99_999).windFromDeg).toBe(350);
  });

  it("interpolates linearly, the wind backing along the shorter arc", () => {
    const w = weatherAt(KEYS, 1800);
    expect(w.windFromDeg).toBeCloseTo(180, 9); // SW → SE through S
    expect(w.windMs).toBeCloseTo(6, 9);
    expect(w.gustMs).toBeCloseTo(10, 9);
    expect(w.tempC).toBeCloseTo(23, 9);
    expect(w.rh).toBeCloseTo(32, 9);
    // SE 135 → N 350: the shorter arc is through E and N (−145°), not through S and W.
    const v = weatherAt(KEYS, 3600 + 1800);
    expect(v.windFromDeg).toBeCloseTo(62.5, 9);
  });

  it("wraps through north and accepts keys out of order", () => {
    const keys: WeatherKey[] = [
      { atS: 600, windFromDeg: 20, windMs: 5, gustMs: 5, tempC: 15, rh: 50 },
      { atS: 0, windFromDeg: 340, windMs: 5, gustMs: 5, tempC: 15, rh: 50 },
    ];
    expect(weatherAt(keys, 300).windFromDeg).toBeCloseTo(0, 9);
    expect(weatherAt(keys, 450).windFromDeg).toBeCloseTo(10, 9);
    expect(angleDiffDeg(350, 10)).toBe(20);
    expect(angleDiffDeg(10, 350)).toBe(-20);
  });

  it("never reports gusts below the mean", () => {
    const keys: WeatherKey[] = [{ atS: 0, windFromDeg: 0, windMs: 9, gustMs: 4, tempC: 15, rh: 50 }];
    expect(weatherAt(keys, 0).gustMs).toBe(9);
    expect(() => weatherAt([], 0)).toThrow();
  });
});

describe("fineFuelMoisture", () => {
  it("is ~6 % on a warm 30 % afternoon, drier when hotter and drier, wetter in fog", () => {
    const m = fineFuelMoisture({ tempC: 20, rh: 30 });
    expect(m).toBeGreaterThan(5);
    expect(m).toBeLessThan(7);
    expect(fineFuelMoisture({ tempC: 28, rh: 20 })).toBeLessThan(m);
    expect(fineFuelMoisture({ tempC: 12, rh: 95 })).toBeGreaterThan(20);
    for (let rh = 0; rh < 100; rh += 5) {
      expect(fineFuelMoisture({ tempC: 20, rh: rh + 5 })).toBeGreaterThanOrEqual(fineFuelMoisture({ tempC: 20, rh }) - 0.5);
    }
  });
});

describe("radio wording", () => {
  const w = { windFromDeg: 225, windMs: 6.2, gustMs: 10.4, tempC: 24.4, rh: 30.2 };

  it("speaks Finnish and English", () => {
    expect(describeWeatherFi(w)).toBe("Tuuli lounaasta 6 m/s, puuskissa 10");
    expect(describeWeatherEn(w)).toBe("Wind from the south-west 6 m/s, gusting 10");
    expect(describeWeatherFi(w, true)).toBe("Tuuli lounaasta 6 m/s, puuskissa 10, lämpötila 24 °C, ilmankosteus 30 %");
    expect(describeWeatherFi({ ...w, windFromDeg: 92, gustMs: 6.5 })).toBe("Tuuli idästä 6 m/s");
    expect(describeWeatherFi({ ...w, windFromDeg: 0, windMs: 0.2, gustMs: 0.4 })).toBe("Tyyntä");
    expect(describeWeatherEn({ ...w, windFromDeg: 315 })).toBe("Wind from the north-west 6 m/s, gusting 10");
  });
});
