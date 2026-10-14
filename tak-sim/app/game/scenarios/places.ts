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
  /** Karhujärvi with Mökkiranta's cabins on its south-east shore. */
  MOKKIRANTA: fromIgn(320, 2.5),
  /** Rahkasuo: ditched peat with the 2024 spoil banks. */
  RAHKASUO: fromIgn(168, 1.25),
  /** The bridge over Kotkanjoki on R3 (W3). */
  KOTKANJOKI: fromIgn(83, 3.1),
  /** Lahdenkylä village (V2), with its farm pond W2. */
  LAHDENKYLA: fromIgn(135, 3.0),
  /** Command point at the R1/R3 junction. */
  CP: fromIgn(292, 1.1),
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
