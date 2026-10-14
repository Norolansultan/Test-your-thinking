/**
 * Game mode weather: keyframe interpolation, fine-fuel moisture and the radio wording.
 *
 * Weather between keyframes is linear in time; the wind direction turns along the shorter arc
 * (a backing SW → SE wind goes through S, never through N). Before the first key the first applies,
 * after the last the last. Pure functions of their inputs (virtual time only; SPEC/00 §3 I1–I2).
 */

import type { Weather, WeatherKey } from "../contracts.js";

/** Signed shortest turn from `fromDeg` to `toDeg`, degrees in [−180, 180). */
export function angleDiffDeg(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

/** Normalises a bearing to [0, 360). */
export function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function isSorted(keys: readonly WeatherKey[]): boolean {
  for (let i = 1; i < keys.length; i++) if (keys[i]!.atS < keys[i - 1]!.atS) return false;
  return true;
}

function plain(k: Weather): Weather {
  return { windFromDeg: normDeg(k.windFromDeg), windMs: k.windMs, gustMs: Math.max(k.gustMs, k.windMs), tempC: k.tempC, rh: k.rh };
}

/** The weather at `tS` from keyframes (any order; ties keep their given order). */
export function weatherAt(keys: readonly WeatherKey[], tS: number): Weather {
  if (keys.length === 0) throw new Error("weatherAt: no weather keys");
  const ks = isSorted(keys) ? keys : [...keys].sort((a, b) => a.atS - b.atS);
  const first = ks[0]!;
  if (tS <= first.atS) return plain(first);
  const last = ks[ks.length - 1]!;
  if (tS >= last.atS) return plain(last);
  let i = 1;
  while (ks[i]!.atS < tS) i++;
  const a = ks[i - 1]!;
  const b = ks[i]!;
  const span = b.atS - a.atS;
  const f = span > 0 ? (tS - a.atS) / span : 1;
  const lerp = (x: number, y: number) => x + (y - x) * f;
  const windMs = lerp(a.windMs, b.windMs);
  return {
    windFromDeg: normDeg(a.windFromDeg + angleDiffDeg(a.windFromDeg, b.windFromDeg) * f),
    windMs,
    gustMs: Math.max(windMs, lerp(a.gustMs, b.gustMs)),
    tempC: lerp(a.tempC, b.tempC),
    rh: lerp(a.rh, b.rh),
  };
}

/**
 * Fine dead-fuel moisture, percent of dry weight: the equilibrium moisture content of Simard (1968),
 * as used by the US NFDRS (temperature in °F inside the formula). PROVISIONAL as the fire model's
 * dryness input: it ignores time lag, shading and rain. Clamped to 2–40 %.
 */
export function fineFuelMoisture(w: Pick<Weather, "tempC" | "rh">): number {
  const h = Math.min(100, Math.max(0, w.rh));
  const tF = w.tempC * 1.8 + 32;
  let emc: number;
  if (h < 10) emc = 0.03229 + 0.281073 * h - 0.000578 * h * tF;
  else if (h < 50) emc = 2.22749 + 0.160107 * h - 0.01478 * tF;
  else emc = 21.0606 + 0.005565 * h * h - 0.00035 * h * tF - 0.483199 * h;
  return Math.min(40, Math.max(2, emc));
}

const POINTS_FI = ["pohjoisesta", "koillisesta", "idästä", "kaakosta", "etelästä", "lounaasta", "lännestä", "luoteesta"] as const;
const POINTS_EN = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

/** 8-point compass index (0 = N … 7 = NW) of a bearing. */
export function compassIndex(deg: number): number {
  return Math.round(normDeg(deg) / 45) % 8;
}

function windParts(w: Weather): { calm: boolean; ms: number; gust: number | null } {
  const ms = Math.round(w.windMs);
  const gust = Math.round(w.gustMs);
  return { calm: w.windMs < 0.5, ms, gust: gust >= ms + 2 ? gust : null };
}

/**
 * Radio wording, Finnish: "Tuuli lounaasta 6 m/s, puuskissa 10". With `detail`, temperature and
 * humidity follow ("…, lämpötila 24 °C, ilmankosteus 30 %").
 */
export function describeWeatherFi(w: Weather, detail = false): string {
  const p = windParts(w);
  let s = p.calm ? "Tyyntä" : `Tuuli ${POINTS_FI[compassIndex(w.windFromDeg)]!} ${p.ms} m/s`;
  if (!p.calm && p.gust !== null) s += `, puuskissa ${p.gust}`;
  if (detail) s += `, lämpötila ${Math.round(w.tempC)} °C, ilmankosteus ${Math.round(w.rh)} %`;
  return s;
}

/** Radio wording, English: "Wind from the south-west 6 m/s, gusting 10". */
export function describeWeatherEn(w: Weather, detail = false): string {
  const p = windParts(w);
  let s = p.calm ? "Calm" : `Wind from the ${POINTS_EN[compassIndex(w.windFromDeg)]!} ${p.ms} m/s`;
  if (!p.calm && p.gust !== null) s += `, gusting ${p.gust}`;
  if (detail) s += `, temperature ${Math.round(w.tempC)} °C, humidity ${Math.round(w.rh)} %`;
  return s;
}
