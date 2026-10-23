/**
 * The practice view's measuring task (difficulty audit, 23 Oct 2026, `docs/audits/2026-10-23-difficulty/proposal-map.md` c.3 item 2):
 * a second practice SPAM item under the same "ready" as the first (`probe.s.practice.b`), asking how far the R3 bridge is from the
 * fire, to be measured with the measure tool (the TAK shell's R&B) or the scale bar. Practice only: not scored, identical in every
 * cell, and its feedback (`practice-feedback.ts`, after VP) teaches the tool, never the situation — the bridge is a labelled feature
 * and no scored item asks its distance (V14's infrastructure item asks its load limit, from pushed records).
 *
 * The key is COMPUTED, never typed: the straight-line distance from the fire (both the point of origin and VP's drawn head) to the
 * bridge's mid-point, put in the nearest of the four ascending bands; the build fails unless both distances fall in the same band and
 * the next band is at least 30 % farther (`PRACTICE_MEASURE`). The key is TRUTH like every key: exported for tests and the feedback
 * screen's after-VP text, never put into the probe. Finnish DRAFT; English in `content/i18n/labels.en.json`.
 */

import type { LatLon } from "../engine/primitives.js";
import { SPAM_ANSWER_TIMEOUT_MS } from "./demo-probes.js";
import { headNow } from "./freeze-keys.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import type { PracticeViewIndex, ProbeSpec } from "./types.js";
import { secondSpamProbeId } from "./views.js";
import { PRACTICE_SPAM_ID, PRACTICE_SPAM_INVARIANT } from "./practice-spam.js";

export const PRACTICE_MEASURE_ID = secondSpamProbeId(PRACTICE_SPAM_ID);
export const PRACTICE_MEASURE_INVARIANT = `${PRACTICE_SPAM_INVARIANT}.b`;
export const PRACTICE_MEASURE_PROMPT_FI = "Kuinka kaukana palosta on R3:n silta (Kotkanjoki)? Voit mitata Mittaa-työkalulla tai mittakaavajanalla.";
/** The options, ascending (an ordinal item keeps its order), in km. */
export const PRACTICE_MEASURE_BANDS_KM: readonly number[] = [1, 3, 5, 8];
const bandLabelFi = (km: number) => `Noin ${km} km`;

/** Metres between two points (local equirectangular; error far below a band's width at 3 km). */
export function metresBetween(a: LatLon, b: LatLon): number {
  const k = (Math.PI / 180) * 6_371_000;
  return Math.hypot((b.lat - a.lat) * k, (b.lon - a.lon) * k * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180));
}

/** True bearing from `a` to `b`, degrees 0–360. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const dy = b.lat - a.lat, dx = (b.lon - a.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** The eight compass points, from north clockwise (feedback text). */
const COMPASS_FI = ["pohjoiseen", "koilliseen", "itään", "kaakkoon", "etelään", "lounaaseen", "länteen", "luoteeseen"] as const;
const COMPASS_EN = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

/** TRUTH: the computed key and the facts the after-VP feedback states (tests, the feedback screen). */
export const PRACTICE_MEASURE = (() => {
  const f = SITE_SCENARIO.features;
  const w = f.R3_BRIDGE_W, e = f.R3_BRIDGE_E;
  if (!w || !e) throw new Error("practice measure: the R3 bridge's ends are not in the scenario export");
  const bridge = { lat: (w.lat + e.lat) / 2, lon: (w.lon + e.lon) / 2 };
  const fromOrigin = metresBetween(SITE_SCENARIO.ignition, bridge), fromHead = metresBetween(headNow(-3), bridge);
  const bandOf = (m: number) => PRACTICE_MEASURE_BANDS_KM.reduce((best, km, i) => (Math.abs(km * 1000 - m) < Math.abs(PRACTICE_MEASURE_BANDS_KM[best]! * 1000 - m) ? i : best), 0);
  const key = bandOf(fromOrigin);
  if (bandOf(fromHead) !== key) throw new Error(`practice measure: origin ${fromOrigin.toFixed(0)} m and head ${fromHead.toFixed(0)} m fall in different bands`);
  // The margin: the distance's error to the next-nearest band is at least 30 % of that band's distance more than to the key's.
  for (const m of [fromOrigin, fromHead]) {
    const own = Math.abs(PRACTICE_MEASURE_BANDS_KM[key]! * 1000 - m);
    const other = Math.min(...PRACTICE_MEASURE_BANDS_KM.filter((_, i) => i !== key).map((km) => Math.abs(km * 1000 - m)));
    if (other < own + 0.3 * m) throw new Error(`practice measure: ${m.toFixed(0)} m is too close to another band`);
  }
  const sector = Math.round(bearingDeg(SITE_SCENARIO.ignition, bridge) / 45) % 8;
  return {
    bridge, fromOriginM: Math.round(fromOrigin), fromHeadM: Math.round(fromHead), keyIndex: key, keyKm: PRACTICE_MEASURE_BANDS_KM[key]!,
    keyOptionId: "abcd"[key]!, directionFi: COMPASS_FI[sector]!, directionEn: COMPASS_EN[sector]!,
  };
})();

/** The practice measuring item as the scenario carries it: no key. */
export function buildPracticeMeasure(): Omit<ProbeSpec, "cycle"> & { readonly cycle: PracticeViewIndex } {
  return {
    id: PRACTICE_MEASURE_ID, type: "S", mode: "ONLINE", cycle: 0, orderWithinCycle: 2, invariantName: PRACTICE_MEASURE_INVARIANT,
    prompt: PRACTICE_MEASURE_PROMPT_FI, response: { kind: "categorical", options: PRACTICE_MEASURE_BANDS_KM.map((km, i) => ({ id: "abcd"[i]!, fi: bandLabelFi(km) })) },
    answerTimeoutMs: SPAM_ANSWER_TIMEOUT_MS, collectsConfidence: true, contentKind: "situation", saLevel: 1,
  };
}
