/**
 * SPEC/29 §2.3 and revision (ay) rule 1 (`31` P-12): THE list of the study's keyed moments — the times and
 * places a game scenario must not replay, because a professional who has played it would carry foreknowledge
 * (or a planted prior) into a session. One list, in one place; `study-separation.spec.ts` checks every game
 * scenario against it, and checks that each moment catches the timeline it was written against.
 *
 * Times are the incident's clock ("HH:MM"); the study's step n starts at 13:20 + (n − 1) × 20 min
 * (`app/scenario/views.ts`, `STEP_SECONDS`). Places are the game's local metres, which are the study's map
 * (SPEC/18 (k): the ignition point IGN at TM35FIN 519 000 E, 6 746 000 N is local (5000, 5000)). Test-only:
 * nothing here ships with the game.
 */

import type { GameScenario, RadioMessage, XY } from "../../app/game/contracts.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";

/** Minutes after midnight at the start of the study's step `n` (step 1 starts 13:20). */
export function stepStartMin(n: number): number {
  return 13 * 60 + 20 + ((n - 1) * STEP_SECONDS) / 60;
}

/** "HH:MM" of minutes after midnight. */
export function clock(min: number): string {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The study's point of origin (SPEC/18 (k)). */
export const ORIGIN: XY = { x: 5000, y: 5000 };
/** Lahdenkylä's centre on the shared map (`content/game/world.json`, settlement `lahdenkyla`). */
export const LAHDENKYLA_CENTRE: XY = { x: 7159, y: 2718 }; // rebuilt map (SPEC/33); was (7156, 2700)

/** Words of the line being switched off or not (F7): "jännitteetön / jännitteettömäksi", "kytketty", "maadoitettu", "de-energised"… */
export const LINE_SWITCHING = /jännitteett?ö|kytket|kytkentä|poiskytk|maadoit|de-?energi|disconnect|earthed|switched off/i;
/** Words of people refusing to leave (V14's deciding fact). */
export const REFUSAL = /kieltäyty|kieltäytyy|refus/i;
/** Words of an evacuation. */
export const EVACUATION = /evaku|evacuat/i;
/** Lahdenkylä by either name. */
export const NAMES_LAHDENKYLA = /lahdenkyl|bay village/i;
/** A north-westerly by name. */
export const NORTH_WESTERLY = /luoteis|luoteeseen|north-?west/i;
/** The units the study's region asks back (KY21, DR3 at V11; HELI1 at SPEC/18 cycle 17). */
export const RECALLED_IN_STUDY = ["KY21", "DR3", "HELI1"] as const;

export interface KeyedMoment {
  readonly id: string;
  /** What the study keys there, and where it is defined. */
  readonly study: string;
  /** The window on the incident's clock, minutes after midnight, inclusive. */
  readonly fromMin: number;
  readonly toMin: number;
  /** No ignition in this circle that is lit in the window or up to `leadMin` before it, and no message placed in it during the window. */
  readonly place?: { readonly at: XY; readonly radiusM: number; readonly leadMin: number };
  /** No `power_line_dead` event in the window, and no message (or briefing of a scenario overlapping the window) in its words. */
  readonly lineSwitch?: true;
  /** No `units_recalled` event in the window, and none of these units recalled at any time. */
  readonly recall?: { readonly anyTime: readonly string[] };
  /** No wind in the window (sampled each minute) from this sector (degrees, inclusive) at or above `minMs`. */
  readonly wind?: { readonly fromDeg: readonly [number, number]; readonly minMs: number };
  /** No message text (window only, unless `anyTime`) for which this holds. */
  readonly text?: { readonly anyTime: boolean; readonly says: (t: string, m: RadioMessage) => boolean };
  /** No briefing or message names these clock times ("17:00", "17.00"; "klo 17" for a full hour). */
  readonly clocks?: readonly string[];
}

const END = stepStartMin(21); // the end of step 20 (V14), 20:00
const near = (m: RadioMessage, p: XY, r: number): boolean => m.at !== undefined && Math.hypot(m.at.x - p.x, m.at.y - p.y) <= r;

export const KEYED_MOMENTS: readonly KeyedMoment[] = [
  {
    id: "origin_rekindle",
    study: "V9 (step 12, 17:00): the origin's old south edge flares up ~120 m from the point of origin, SPOT reports it at 17:01 — H10's anticipation and the V7 `rekindle_sector` key (`app/scenario/designed-events.ts`, SPEC/26 2 Oct amendment and (y.2)); V14 (step 19, 19:23): the second flare-up ~130 m west of the origin (`SECOND_REKINDLE`); from V7 (step 10) the crews leave the edge against VPK's objection",
    fromMin: stepStartMin(10), toMin: END,
    place: { at: ORIGIN, radiusM: 600, leadMin: 60 },
    clocks: ["17:00", "17:01", "17:10", "19:23"],
  },
  {
    id: "phase_b_front",
    study: "V10–V14 (steps 13–20): the rekindled front runs east and south-east from the origin's old south edge over the Honkaharju road toward R2 and Lahdenkylä (SPEC/26 (y.2), SPEC/27 §7.2–7.3); SPEC/18 cycle 12's surfacing in Rahkasuo's ditch-spoil banks (BOG-S) lay in the same ground",
    fromMin: stepStartMin(11), toMin: END,
    place: { at: { x: (ORIGIN.x + LAHDENKYLA_CENTRE.x) / 2, y: (ORIGIN.y + LAHDENKYLA_CENTRE.y) / 2 }, radiusM: 1600, leadMin: 60 },
  },
  {
    id: "f7_line",
    study: "F7 (H9; V12's freeze item): the 20 kV line (110 kV before SPEC/33 (bc)) is live for the whole incident; the distribution company's record (step 6, 15:06) says it is still live and de-energising is requested, the planted situation-log record (step 8, 15:46) says 'de-energised, confirmed' (`app/scenario/designed-events.ts`, `F7_TRUTH_INVARIANT`)",
    fromMin: 11 * 60 + 20, toMin: END, // the fire is lit about 11:20 (SPEC/18 §2)
    lineSwitch: true,
    clocks: ["15:06", "15:30", "15:46"],
  },
  {
    id: "unit_recall",
    study: "V11 (steps 14–15, 17:40–18:20): the region asks to release KY21 and the VTOL drone DR3 (H8, rule 3 against rule 4; EK11's step-14 line, DR3's 17:59 landing); SPEC/18 cycle 17 (18:40): HELI1 recalled to another fire",
    fromMin: stepStartMin(13), toMin: stepStartMin(18),
    recall: { anyTime: RECALLED_IN_STUDY },
    text: { anyTime: true, says: (t) => RECALLED_IN_STUDY.some((u) => new RegExp(`\\b${u}\\b`).test(t)) && /toiselle palolle|another fire|vapaut|release/i.test(t) },
    clocks: ["17:40", "17:59", "18:40"],
  },
  {
    id: "refusing_households",
    study: "V14 (step 18, 19:18, pushed): two households in Lahdenkylä refuse to leave — residents in Lahdenkylä decide V14's key (`31` §3.2); SPEC/18 cycle 17: the police's evacuation advisory for Lahdenkylä. No game message has anyone refuse to leave, anywhere, and none evacuates Lahdenkylä",
    fromMin: 0, toMin: 24 * 60,
    text: { anyTime: true, says: (t, m) => REFUSAL.test(t) || (EVACUATION.test(t) && (NAMES_LAHDENKYLA.test(t) || near(m, LAHDENKYLA_CENTRE, 1500))) },
    clocks: ["19:18"],
  },
  {
    id: "evening_northwesterly",
    study: "V12 (steps 16–17, 18:20–19:00): the second wind event, north-westerly gusts at 18:40 driving the south-east head at Lahdenkylä (SPEC/18 cycle 17; the L3 items `village_distance`, `head_later` and V14's R2 items), forecast on record from 17:00 (the wind turns west at step 12)",
    fromMin: stepStartMin(12), toMin: END,
    wind: { fromDeg: [280, 350], minMs: 5 },
    text: { anyTime: true, says: (t) => NORTH_WESTERLY.test(t) && NAMES_LAHDENKYLA.test(t) },
    clocks: ["19:00"],
  },
  {
    id: "north_flank_contradiction",
    study: "V13 (step 18, 19:00): H3's contradiction — a spot fire ~150 m north of EK14's line, 1170 m at 8° from the origin; SPOT reports the north flank accelerating while EK14 reports its line holding (SPEC/18 §7.1, (ah.2)). Not replayed before; listed so that no scenario starts to",
    fromMin: stepStartMin(17), toMin: stepStartMin(19) + 20,
    place: { at: { x: Math.round(ORIGIN.x + 1170 * Math.sin((8 * Math.PI) / 180)), y: Math.round(ORIGIN.y + 1170 * Math.cos((8 * Math.PI) / 180)) }, radiusM: 500, leadMin: 30 },
  },
];

/** The minutes of a scenario on the incident's clock. */
export const clockOf = (s: GameScenario, atS: number): number => s.startClockMin + atS / 60;

export { END as STUDY_END_MIN };
