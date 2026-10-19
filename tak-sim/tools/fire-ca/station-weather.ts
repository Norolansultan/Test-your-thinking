/**
 * The command post weather station's temperature and humidity, every step (SPEC/31 §5 data item D3; SPEC/18 revision
 * (ay)). The wind is the forcing's (`scenario-18.ts`); this is the rest of what the station reads.
 *
 * - Phase A (13:20–16:00, steps 1–9): SPEC/18 §6's design rows, unchanged.
 * - From 16:20 the station's own earlier readings are kept (16:20 25 °C / 38 %, 18:00 22 / 28 %, 19:20 20 / 26 %;
 *   fix pass 6) and the steps between them are filled monotonically: the dry continental air behind the 17:00 front
 *   (the FMI forecasts of 16:00, 17:00 and 18:00, `traffic-forecast.ts`) dries the evening; there is NO evening
 *   recovery (no RH rise, no lull, `SPEC/27` §7.4(i) not implemented) — FMI to confirm the 10 °C dew-point drop.
 *   SPEC/18 §6's rows from 16:20 on (the withdrawn shower, RH 60 %) are stale.
 * - The 20:00 reading (`END_OF_DAY`) closes the day; the session ends then, so no record carries it (kept for the skills'
 *   data export, `tools/skills`, outside WP-1, to read when it is regenerated).
 * - Dew point by the Magnus formula (a = 17.62, b = 243.12 °C), rounded to 0.1 °C.
 *
 * DRAFT for FMI's check; values are design values, not observations.
 */

/** Step → [temperature °C, relative humidity %]; step 21 is 20:00, the end of the day. */
export const STATION_TH: Readonly<Record<number, readonly [number, number]>> = {
  1: [28, 27], 2: [29, 27], 3: [29, 26], 4: [29, 26], 5: [29, 26], 6: [29, 25], 7: [28, 27], 8: [27, 30], 9: [25, 38],
  10: [25, 38], 11: [25, 38], 12: [24, 37], 13: [24, 35], 14: [23, 32], 15: [22, 28], 16: [22, 27], 17: [21, 27],
  18: [21, 26], 19: [20, 26], 20: [20, 26], 21: [19, 27],
};

/** The 20:00 reading's step key (the end of step 20). */
export const END_OF_DAY = 21;

/** Dew point (°C, one decimal) by the Magnus formula. */
export function dewPointC(tempC: number, rhPct: number): number {
  const a = 17.62, b = 243.12;
  const g = Math.log(rhPct / 100) + (a * tempC) / (b + tempC);
  const td = (b * g) / (a - g);
  const r = Math.round(td * 10) / 10;
  return r === 0 ? 0 : r;
}

/** The station's reading at the start of step n (or 20:00 for `END_OF_DAY`). */
export function stationReading(n: number): { readonly tempC: number; readonly rhPct: number; readonly dewC: number } | null {
  const th = STATION_TH[n];
  return th ? { tempC: th[0], rhPct: th[1], dewC: dewPointC(th[0], th[1]) } : null;
}
