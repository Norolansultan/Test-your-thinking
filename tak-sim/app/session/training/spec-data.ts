/**
 * PLACEHOLDER (bp integration stub): work package A replaces this file with the built training (`content/training/incident.json`).
 * Same exports; code against the `TrainingSpec` type, never against these values.
 */

import type { TrainingSpec } from "./spec";

export const TRAINING: TrainingSpec = {
  version: "training-placeholder",
  capMs: 720_000,
  cardWindowMs: 60_000,
  demoMinDwellMs: 10_000,
  now: { virtualTimeS: -10_920, label: "10.18" },
  area: { bounds: { south: 0, west: 0, north: 0, east: 0 }, lockMarginM: 100, centre: { lat: 0, lon: 0 } },
  roadLabels: [],
  scenes: {} as TrainingSpec["scenes"],
  items: [],
  sections: [],
};
