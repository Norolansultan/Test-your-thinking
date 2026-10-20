/**
 * Game mode scenarios: the incident's places in local metres (x east, y north from the fuel grid's
 * south-west corner), from SPEC/18 revision (k) §k.2 — bearing and distance from the ignition point
 * IGN at TM35FIN 519 000 E, 6 746 000 N, which is local (5000, 5000). Scenarios use these only as
 * positions; settlements are named, and resolved against the world when a game is created.
 */

import type { RadioMessage, WeatherKey, XY } from "../contracts.js";

function fromIgn(bearingDeg: number, km: number): XY {
  const r = (bearingDeg * Math.PI) / 180;
  return { x: Math.round(5000 + km * 1000 * Math.sin(r)), y: Math.round(5000 + km * 1000 * Math.cos(r)) };
}

export const PLACES = {
  /** The harvesting block where the fire starts. */
  IGN: { x: 5000, y: 5000 },
  /** R1, the gravel road 400 m north of the origin (a point on it). */
  R1: { x: 5000, y: 5400 },
  /** Kuivakangas esker: the ridge ignition. */
  KUIVAKANGAS: fromIgn(45, 1.0),
  /** Kuusimäki: mature, unthinned spruce (crown-run country). */
  KUUSIMAKI: fromIgn(47, 1.75),
  /** Koivuoja birch strip. */
  KOIVUOJA: fromIgn(45, 2.3),
  /** Haukilampi, water point W1. */
  HAUKILAMPI: fromIgn(315, 1.5),
  /** Mökkiranta: among the cabins on Karhujärvi's south-east shore (on the rebuilt map, SPEC/33). */
  MOKKIRANTA: fromIgn(320, 2.2),
  /** Rahkasuo: ditched peat with the 2024 spoil banks. */
  RAHKASUO: fromIgn(168, 1.25),
  /** The bridge over Kotkanjoki on R3 (W3). */
  KOTKANJOKI: fromIgn(83, 3.1),
  /** Lahdenkylä village (V2), with its farm pond W2. */
  LAHDENKYLA: fromIgn(135, 3.0),
  /** Command point at the R1/R3 junction. */
  CP: fromIgn(292, 1.1),
  // "Evening wind" (the game's own story, SPEC/29 (ay)): lightning strikes in the forest north of Korpioja and
  // Karhujärvi, each a few hundred metres off the nearest forest road, well outside anything the study's fire
  // reaches. On the rebuilt map (SPEC/33) the Koivuoja strike moved 1.3 km north into spruce (at the old place,
  // by the Koivuoja road in birch, it burned 5 ha left alone) and the late strike 270 m west-north-west (the old
  // place is the brook, where nothing lights), so that the evening stays hard (`npm run game:balance`).
  /** Pine 2.1 km east-north-east of Mökkiranta, between Karhujärvi and Koivuoja. */
  STRIKE_KORPIOJA: { x: 5600, y: 7300 },
  /** Pine on drained peat 1.8 km north-north-east of Mökkiranta, beyond Karhujärvi's north-east shore. */
  STRIKE_KARHUJARVI: { x: 4300, y: 8300 },
  /** Spruce 1.1 km north-east of Koivuoja. */
  STRIKE_KOIVUOJA: { x: 6750, y: 8250 },
  /** The strike that smoulders in a tree (birch and aspen west of the brook) and flares up later. */
  STRIKE_LATE: { x: 4750, y: 8000 },
} as const;

/** Settlement names the scenarios protect; resolved against the world at game creation. */
export const LAHDENKYLA = "Lahdenkylä";
export const MOKKIRANTA = "Mökkiranta";

/** Seconds after the scenario's start for a clock time "HH:MM". */
export function at(startClockMin: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  return ((h ?? 0) * 60 + (m ?? 0) - startClockMin) * 60;
}

export function radio(
  atS: number, from: string, room: RadioMessage["room"], priority: RadioMessage["priority"], textFi: string, textEn: string, pos?: XY,
): RadioMessage {
  const base = { atS, from, room, textFi, textEn, priority };
  return pos === undefined ? base : { ...base, at: pos };
}

/** A weather keyframe from the clock: wind from (deg), mean and gust (m/s), temperature, humidity. */
export function wx(startClockMin: number, hhmm: string, windFromDeg: number, windMs: number, gustMs: number, tempC: number, rh: number): WeatherKey {
  return { atS: at(startClockMin, hhmm), windFromDeg, windMs, gustMs, tempC, rh };
}
