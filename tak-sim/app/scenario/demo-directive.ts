/**
 * The directive's answer key (phase-B directive redesign, researcher decision 4 Oct 2026) — DRAFT,
 * the sound postures for the expert panel to confirm. TRUTH: scoring only, never shown and never
 * passed to the session (neither the session, the render layer nor the scenario builder imports
 * this file; `test/boundary/directive-keys-boundary.spec.ts`).
 *
 * At the hinge (16:40) P2 replaces phase A's offensive intent with one directive (`DIRECTIVE_FI` in
 * `demo-scenario.ts`): defensive action, lines on roads and water, no direct attack on the fire's
 * edge, protect Lahdenkylä and Mökkiranta. It deliberately does not fit every view. Per main view:
 * - `aligned`: the postures within the directive (phase B: `barrier_line`, `protect_values`); null
 *   in phase A (review round 2, 4 Oct 2026, DEFAULT): phase A's intent is conditional ("direct
 *   attack where intensity allows"), so a phase-A posture is reported descriptively, never coded
 *   as aligned or against; `againstSecondaryTaskId` (fix pass 2, 7 Oct 2026, researcher-approved):
 *   alignment reads the whole plan, so in phase B a plan whose secondary sector attacks directly is
 *   against the directive whatever the main posture;
 * - `sound`: the postures the situation calls for, or null where not scored (phase A, not
 *   authored; V8, the lull);
 * - `soundSectors` (round 2): where a sound posture is sound only in some sectors, those sectors;
 *   at V9–V10 a direct attack is sound only when the main effort is on the new front (`NEW_FRONT`),
 *   at V14 on the flare-up (`SECOND_REKINDLE`); fix pass 2 (7 Oct 2026): a front straddling a sector
 *   boundary accepts every sector its mapped polygon touches (V9–V10 L2 or L3, V14 L1 or L4), and at
 *   V11–V13 a barrier line or protecting values is sound only in the observed head's sector
 *   (`headSector`); all computed from the data, never hard-coded;
 * - `soundSecondary` (researcher decision 6 Oct 2026, V14; V9–V10 since fix pass 2): a plan is also
 *   sound when its secondary sector carries the named task in one of the named sectors while its main
 *   effort, with a posture within the directive, is in one of the named main-effort sectors (the
 *   flare-up attacked directly as the secondary sector while the main effort protects Lahdenkylä, or,
 *   at V9–V10, works anywhere else); with `againstSecondaryTaskId` such a plan codes C, not A;
 * - `fit`: whether the directive fits the view — `neutral` (not in force yet, or nothing to decide
 *   on), `yes` or `no`. V13 is `yes` (round 2): the directive names no line, so the crossing of a
 *   forest road does not break it; the next barrier (R2) is still a road;
 * - `basis`: the facts, and `basisAtomIds` the records they rest on, found BY CONTENT
 *   (`recordAtomId`), never by generated id, so a record that disappears fails the build. A basis
 *   cites only records the participant can see by the view's end (round 2: no CA-only values).
 *
 * Where the fit is visible (phase-B corpus rebuild, 4 Oct 2026, agent D branch — needs the Thinker
 * index rebuilt): V9's flare-up (SPOT, story) is pushed and gives no size. V10's crews on the new front
 * radio only that it is new and small and that they are on it (pushed); its measured size (~1.1 ha,
 * flames 0.3–1 m: DR2's thermal image at 17:25 and DR3's mapping at 17:35) is recorded only, and no
 * V10 record gives a rate (the crews' former "noin 1 m/min" was the floor of a zero measurement,
 * against the CA's ~150 m in 17:20–17:40; DR2 measures that at 17:45, recorded, V11). V11's fit rests
 * on the FMI forecast (SÄÄENNUSTE, T2). V12's stop at the forest road (EK12) and V13's crossing (OUT2,
 * now timed 18.40–19.00, the gust the station gave then) are pushed. V14's pushed line (EK12, step 19)
 * says only that the south-east front is heading for R2; the distance (~380 m at 19:47) is in DR2's recorded
 * road report (step 20).
 *
 * Round 2 (researcher decisions 5 Oct 2026, agent D branch — needs the Thinker index rebuilt): V9 gets
 * the flare-up's size and rate in a recorded record (SPOT's second pass at 17.10, story step 12); in V10
 * no crew is on the new front (the crews come back south at step 14, to lines on roads), so its existence
 * is pushed by DR2's story line and the crews' "we are on it" lines are gone; V14 becomes a no-fit view:
 * the origin's old west edge flares up again before 19:20 in sector L4, where no crew works
 * (`scenario-18.ts` step 19). Its existence is pushed (DR2's story line, 19:23), its size recorded only
 * (SPOT's second pass at 19:30, ~0.3 ha, flames under a metre); the map draws it at 0.28 ha at 19:20 and
 * 0.66 ha at 20:00 (its polygons), spreading south-east towards the forest road and Rahkasuo's drained peat. DRAFT for
 * the panel: whether a small flare-up can carry the main effort while the south-east front runs for R2
 * (SPEC/27 §7.4's first constraint) is the open domain question; the key says it can, as at V9–V10.
 *
 * SPEC/31 (19 Oct 2026, RC; DRAFT for the panel): V14's flare-up is sound only through the secondary route
 * (§3.2, coa F2): `sound` is empty and `soundSectors` gone, so a main-effort direct attack on it codes as unsound,
 * while `soundSecondary`, `boundarySectors` and `againstSecondaryTaskId` are unchanged. V9–V10 accept L2 across the
 * boundary in the boundary-accepted sensitivity coding only (coa F13, `boundarySectors`). The flames the bases quote
 * are the provisional flame-length table's (§3.11, `tools/fire-ca/flame-table.ts`): V9 2–3 m, V10 2–3 m, V14 1–2 m
 * (was under a metre / 0.3–1 m). The V14 premise P2 is no longer contradicted (`premise-evidence.json`, §3.4).
 *
 * Open (4 Oct 2026): the directive is not a corpus atom, so Haku and Thinker cannot find it (needs
 * `npm run thinker:index` on a machine with the model if it is to become one); H8 (rule 3 vs rule 4)
 * is withdrawn. EK11's step-14 story line no longer states the dropped release rule (rebuild). The
 * radio calls the forest road "Honkaharju", a name the map does not show.
 *
 * Verified 4 Oct 2026 against `site-scenario.json` (the reported detached front per step, and the
 * traffic and radio below) and `demo-story.ts`.
 */

import type { MainEffortPosture, SecondaryTaskId } from "./plan-types.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { CYCLE_STORY } from "./demo-story.js";
import { areaHa, centroid, distanceToLineM, headNow, inPolygon, nearestSectorOf, projectionHeadAtEndOf, sectorOf, siteStep, truthHeadAtEndOf } from "./freeze-keys.js";
import type { Polygon } from "../engine/primitives.js";
import type { CycleIndex } from "../engine/primitives.js";
import { sortedKeys } from "../engine/deterministic-object.js";

export type DirectiveFit = "neutral" | "yes" | "no";

export interface DirectiveKey {
  /** Null in phase A: reported descriptively only. */
  readonly aligned: readonly MainEffortPosture[] | null;
  /** A plan whose secondary sector carries this task is against the directive, whatever its main posture (phase B). */
  readonly againstSecondaryTaskId?: SecondaryTaskId;
  readonly sound: readonly MainEffortPosture[] | null;
  /** A sound posture listed here is sound only when the plan's main effort is one of its sectors. */
  readonly soundSectors?: Readonly<Partial<Record<MainEffortPosture, readonly string[]>>>;
  /** Sectors accepted only across a sector boundary (fix pass 3): a plan sound only through one is flagged for sensitivity. */
  readonly boundarySectors?: readonly string[];
  /** Also sound: this secondary task in one of `sectors`, the main effort in one of `mainEffortSectors` with one of `mainEffortPostures`. */
  readonly soundSecondary?: {
    readonly taskId: SecondaryTaskId;
    readonly sectors: readonly string[];
    readonly mainEffortSectors: readonly string[];
    readonly mainEffortPostures: readonly MainEffortPosture[];
  };
  readonly fit: DirectiveFit;
  readonly basis: string;
  readonly basisAtomIds: readonly string[];
}

/**
 * TRUTH: the atom id of the one record of `step` whose text matches `re` — a generated traffic
 * record (`evt.…`), a radio item (`atom.radio.<step>.<k>`, `radioAtoms`) or a story bubble
 * (`atom.demo.<step>.<k>`, `storyAtoms`). Like `trafficId` (`freeze-keys.ts`): a key whose record
 * no longer exists throws, failing the build, instead of pointing at another message; so does a
 * pattern that matches more than one record (review 4 Oct 2026), so a regenerated corpus can never
 * silently move a key's basis to a different message.
 */
export function recordAtomId(step: number, re: RegExp): string {
  return findRecord(step, re).id;
}

function findRecord(step: number, re: RegExp): { readonly id: string; readonly text: string } {
  const hits = [
    ...SITE_SCENARIO.traffic.filter((x) => x.cycle === step && re.test(x.content)).map((x) => ({ id: x.id, text: x.content })),
    ...SITE_SCENARIO.radio.filter((r) => r.cycle === step).flatMap((r, k) => (re.test(r.text) ? [{ id: `atom.radio.${step}.${k}`, text: r.text }] : [])),
    ...(CYCLE_STORY[step as CycleIndex]?.bubbles ?? []).flatMap((b, k) => (re.test(b.text) ? [{ id: `atom.demo.${step}.${k}`, text: b.text }] : [])),
  ];
  if (hits.length === 0) throw new Error(`directive key: no step-${step} record matches ${re}`);
  if (hits.length > 1) throw new Error(`directive key: step-${step} pattern ${re} matches ${hits.length} records (${hits.map((h) => h.id).join(", ")}); make it specific`);
  return hits[0]!;
}

/**
 * TRUTH: the first capture group of the one record of `step` that `re` matches, as a dotted decimal ("0,8" -> "0.8"): the basis
 * texts below read the figures they quote from the records, so a regenerated corpus cannot leave a stale number in a basis
 * (fix pass 5, 8 Oct 2026: the old texts quoted 1.0 ha and 8.4 m/min against records saying 0.8 ha and 6.7 m/min).
 */
function recordFigure(step: number, re: RegExp): string {
  const m = re.exec(findRecord(step, re).text);
  if (!m?.[1]) throw new Error(`directive key: the step-${step} record matching ${re} has no capture group`);
  return m[1].replace(",", ".");
}

/** V9's and V10's steps (`views.ts`), where the new front appears. */
const NEW_FRONT_STEPS = [12, 13] as const;

/**
 * TRUTH: every sector a mapped front touches (fix pass 2, 7 Oct 2026, researcher-approved): the sectors of
 * its polygon's vertices (or the nearest sector, for a vertex in a gap between sectors), in id order. The
 * sectors are wedges from the point of origin, so a rekindle at the origin straddles a boundary; a plan on
 * either side of it is on the front.
 */
export function frontSectors(front: Polygon): string[] {
  const ids = new Set(front[0]!.slice(0, -1).map((v) => sectorOf(v) ?? nearestSectorOf(v)).filter((x): x is string => x !== null));
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * TRUTH: the new front's sector (review round 2, 4 Oct 2026): the sector of the first reported
 * detached front in V9–V10's steps (the front the map draws), by its centroid, or the nearest sector
 * when the centroid falls in a gap between sectors (`nearestSectorOf`). Computed from the data so a
 * regenerated bundle cannot leave a stale sector in the key; it throws when there is no such front.
 * Verified 4 Oct 2026: step 13, L3 (step 12's map has no detached front yet; the CA truth has it in L3
 * from step 12; DR2's step-13 thermal names "eteläreuna (L3)").
 */
export function newFrontSector(): { readonly step: number; readonly sector: string; readonly sectors: readonly string[] } {
  for (const step of NEW_FRONT_STEPS) {
    const front = siteStep(step).reportedDetached[0];
    if (!front) continue;
    const sector = nearestSectorOf(centroid(front));
    if (sector) return { step, sector, sectors: frontSectors(front) };
  }
  throw new Error(`directive key: no reported detached front in steps ${NEW_FRONT_STEPS.join(", ")}`);
}

export const NEW_FRONT = newFrontSector();

/** V14's first step (`views.ts`), where the second rekindle is first on the map. */
const SECOND_REKINDLE_STEP = 19;

/**
 * TRUTH: the second rekindle's sector (round 2, 5 Oct 2026): the reported detached front of V14's first
 * step that the CA did not have at the end of the step before (so not V13's spot fire, which persists),
 * by its centroid, or the nearest sector (`nearestSectorOf`). Computed from the data like `NEW_FRONT`; it
 * throws when there is no such front. Verified 5 Oct 2026: L4 (the origin's old west edge; ~130 m west of
 * the ignition point since 6 Oct 2026, anchored to the burned edge, was ~200 m).
 */
export function secondRekindleSector(): { readonly step: number; readonly sector: string; readonly sectors: readonly string[] } {
  const before = siteStep(SECOND_REKINDLE_STEP - 1);
  const old = [before.truthAtEnd, ...before.truthDetached];
  for (const front of siteStep(SECOND_REKINDLE_STEP).reportedDetached) {
    const c = centroid(front);
    if (old.some((p) => inPolygon(c, p))) continue;
    const sector = nearestSectorOf(c);
    if (sector) return { step: SECOND_REKINDLE_STEP, sector, sectors: frontSectors(front) };
  }
  throw new Error(`directive key: no new reported detached front in step ${SECOND_REKINDLE_STEP}`);
}

export const SECOND_REKINDLE = secondRekindleSector();

/** The areas, in hectares to two places, of the flare-up's outline on the map at V14's first step and at its second (the polygon, not a record). */
const MAP_FLARE_UP_HA = (() => {
  const first = siteStep(SECOND_REKINDLE.step).reportedDetached.find((f) => frontSectors(f).includes(SECOND_REKINDLE.sector))!;
  const c = centroid(first);
  const d = (f: Polygon) => Math.hypot(centroid(f).lat - c.lat, centroid(f).lon - c.lon);
  const second = [...siteStep(SECOND_REKINDLE.step + 1).reportedDetached].sort((a, b) => d(a) - d(b))[0]!;
  return { first: areaHa(first).toFixed(2), second: areaHa(second).toFixed(2) };
})();

const PHASE_B: readonly MainEffortPosture[] = ["barrier_line", "protect_values"];

/**
 * SPEC/31 coa F13 (sensitivity only): the sectors are not drawn on the map and V10's story says the new fire "etenee itään"; its polygon
 * spans bearings 112–183° from the origin and its V11 outline reaches 97°, across the L2/L3 boundary (100°). A plan aiming at the new fire
 * in L2 is therefore counted as on it in the boundary SENSITIVITY coding of V9–V10 (`boundarySectors`), never in the primary, which stays
 * the computed sectors (`NEW_FRONT`). `16` y.4 and `27` y.1 are aligned by the integrator.
 */
const SENSITIVITY_SECTOR = "L2";
const withSensitivity = (sectors: readonly string[]): string[] => [...new Set([...sectors, SENSITIVITY_SECTOR])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const SENSITIVITY_NOTE = `Sensitivity (SPEC/31 coa F13): ${SENSITIVITY_SECTOR} is accepted across the boundary in the boundary coding only (the front runs east along the old south edge towards it)`;

/** TRUTH: the crews holding a road line at V14's end (step 20; the R2 crews), from the bundle, in id order (coa F16: the basis said "five"). */
const R2_CREWS: readonly string[] = (() => {
  const work = siteStep(20).unitWork;
  return sortedKeys(work).filter((u) => work[u]!.task === "road_line");
})();

/** Phase B's whole-plan alignment (fix pass 2): a secondary direct attack is against the directive. */
const AGAINST_SECONDARY: SecondaryTaskId = "task.direct-attack";

/** Every sector id, for a main effort that may be anywhere. */
const ALL_SECTORS: readonly string[] = SITE_SCENARIO.sectors.map((x) => x.id);

/**
 * TRUTH: the sector of the head the map shows during `step` (`observedHead.anchor`), or the nearest one
 * (fix pass 2, 7 Oct 2026: V11–V13's barrier line and protection are sound only there; L3 on 7 Oct 2026).
 */
export function headSector(step: number): string {
  const s = nearestSectorOf(headNow(step));
  if (!s) throw new Error(`directive key: the step-${step} head lies in no sector`);
  return s;
}

/** The margin within which a head counts as on a sector boundary (the build check, `directive-sectors.spec.ts`, wants keyed fires ≥50 m inside). */
const BOUNDARY_MARGIN_M = 50;

/**
 * TRUTH: the head's sector and every sector whose boundary lies within `BOUNDARY_MARGIN_M` of the head
 * (fix pass 2, 7 Oct 2026: at 17:40 and 18:20 the head is within 50 m of the L2/L3 line, so a key on its
 * sector alone would flip with a few metres of drift), in id order.
 */
export function headSectors(step: number): string[] {
  const p = headNow(step);
  const near = SITE_SCENARIO.sectors.filter((x) => x.geometry.some((ring) => distanceToLineM(p, ring) < BOUNDARY_MARGIN_M)).map((x) => x.id);
  return [...new Set([headSector(step), ...near])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * D3 (fix pass 6, researcher decision 8 Oct 2026), stated in the basis of V11-V13: a burnout proposed from a held road is a barrier-line
 * technique, so it is IN LINE with the directive; it is not a plan option (the posture and the secondary task are), so no plan is scored
 * on it, and the Open Thinker says the directive does not cover it (SPEC/16).
 */
const BURNOUT_IN_LINE = "; a burnout proposed from a held road is in line with the directive (a barrier-line technique) and is not a plan option, so no plan is scored on it";

/** The sectors of `all` other than `core`: those accepted only across a boundary. */
const across = (all: readonly string[], core: string): string[] => all.filter((x) => x !== core);

/** V11–V13's sound postures, each only in the sectors of the head the view's map shows (its first step). */
const onHead = (step: number): NonNullable<DirectiveKey["soundSectors"]> => ({ barrier_line: headSectors(step), protect_values: headSectors(step) });

/** TRUTH: Lahdenkylä's sector (L3 on 6 Oct 2026, the sector of the south-east front heading for it), computed from the map. */
export const VILLAGE_SECTOR: string = (() => {
  const s = nearestSectorOf(SITE_SCENARIO.features["VILLAGE"]!);
  if (!s) throw new Error("directive key: Lahdenkylä lies in no sector");
  return s;
})();

const phaseA = (view: number): DirectiveKey => ({
  aligned: null, sound: null, fit: "neutral", basisAtomIds: [],
  basis: `V${view}, phase A: the intent in force is phase A's, conditional (SPEC/18 §4.1, "direct attack where intensity allows"; P2's V1 message states it): the posture is reported descriptively, not coded as aligned; the directive is not yet issued; sound postures not authored`,
});

export const DIRECTIVE_KEYS: Readonly<Record<number, DirectiveKey | null>> = {
  0: null, // VP: practice, not scored
  1: phaseA(1), 2: phaseA(2), 3: phaseA(3), 4: phaseA(4), 5: phaseA(5), 6: phaseA(6), 7: phaseA(7),
  8: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: null, fit: "neutral",
    // 8 Oct 2026 (the re-tuned fire model): the north edge runs 3.5 m/min at 16:20–16:40 (was 1.8); V8 stays unscored.
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): EK12's 16:42 line is recorded now (it was pushed), so VPK's pushed 16:42 line —
    // holding the north edge with hand tools while the basin comes — carries the pushed basis.
    basis: "16:40, the lull: no movement on the head's south flank, hot stumps dug out, the line held (EK12, recorded; the crew reports only its own stretch, FF1); on the north edge VPK holds the edge with hand tools while its water is low (VPK, pushed); the north edge creeps ~3.5 m/min (DR3, recorded); nothing to decide the posture on — not scored",
    basisAtomIds: [
      recordAtomId(11, /^EK12, kärki, eteläsivusta: reunalla ei liikettä, kuumia kantoja kaivetaan auki/),
      recordAtomId(11, /^VPK täällä pohjoisreuna, Karhujärven puoli\. Vettä säiliössä enää noin \d+ %.*pidämme reunaa käsityökaluin/),
      recordAtomId(11, /^DR3 mittaus: pohjoisreunan etenemä \d+ m klo 16\.20–16\.40/),
    ],
  },
  9: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: ["direct_attack"], soundSectors: { direct_attack: withSensitivity(NEW_FRONT.sectors) }, boundarySectors: withSensitivity(across(NEW_FRONT.sectors, NEW_FRONT.sector)), fit: "no",
    // Fix pass 2 (7 Oct 2026): the new front is attacked directly as the secondary sector, the main effort anywhere within the directive, is sound too.
    soundSecondary: { taskId: AGAINST_SECONDARY, sectors: withSensitivity(NEW_FRONT.sectors), mainEffortSectors: ALL_SECTORS, mainEffortPostures: PHASE_B },
    // SPEC/31 (coa F16, D1): the figures are read from SPOT's record; its flames follow the provisional flame-length table (§3.11; were
    // "under a metre"), so the direct attack is one from the black along the flanks — the panel keys it (V9-f).
    basis: `17:00–17:20: open flame and smoke outside the origin's old south edge, ~120 m from the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m), not on the map before (SPOT, pushed); the step's radio moves no crew there. Its size and rate are recorded only: ~${recordFigure(12, /^SPOT, toinen ylilento klo 17\.10: syttymäkohdan kaakkoispuolen uusi palo noin (\d+,\d–\d+) ha/)} ha, flames ${recordFigure(12, /^SPOT, toinen ylilento klo 17\.10: .*liekit (\d+(?:,\d+)?–\d+) m/)} m, the edge running east ~${recordFigure(12, /^SPOT, toinen ylilento klo 17\.10: .*arviolta (\d+) m\/min/)} m/min (SPOT's second pass, 17.10; flames from the provisional flame-length table, SPEC/31 §3.11) — small enough that a direct attack on the new front (sector ${NEW_FRONT.sector}${NEW_FRONT.sectors.length > 1 ? `, or ${NEW_FRONT.sectors.filter((x) => x !== NEW_FRONT.sector).join(", ")} across the boundary it touches` : ""}), from the black along its flanks, stops it; a barrier line gives it the stand. The front is not on the map until V10: the sectors are those its V10 polygon touches (fix pass 2, 7 Oct 2026: ${NEW_FRONT.sectors.length > 1 ? `the neighbour is ${NEW_FRONT.sectors.filter((x) => x !== NEW_FRONT.sector).join(", ")}, not L4` : "since review fixes (ah) it touches no neighbour"}; the sectors tile from the origin since 6 Oct 2026, A9; SPEC/11 §7.16.1 D14). ${SENSITIVITY_NOTE}`,
    basisAtomIds: [
      recordAtomId(12, /^Avotulta ja savua syttymäkohdan kaakkoispuolella, vanhan eteläreunan ulkopuolella, noin 120 m syttymäkohdasta/),
      recordAtomId(12, /^SPOT, toinen ylilento klo 17\.10: syttymäkohdan kaakkoispuolen uusi palo noin 0,5–1 ha/),
    ],
  },
  10: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: ["direct_attack"], soundSectors: { direct_attack: withSensitivity(NEW_FRONT.sectors) }, boundarySectors: withSensitivity(across(NEW_FRONT.sectors, NEW_FRONT.sector)), fit: "no",
    soundSecondary: { taskId: AGAINST_SECONDARY, sectors: withSensitivity(NEW_FRONT.sectors), mainEffortSectors: ALL_SECTORS, mainEffortPostures: PHASE_B },
    // Fix pass 5 (8 Oct 2026): the figures are read from the records (DR2 and DR3 give 0.8 ha, the map's polygon 0.70 ha); the key rests on the
    // records up to 17:40 only: DR2's 17:45 rate belongs to V11. SPEC/31 §3.11: DR2's flames follow the provisional table (were 0.3–1 m); the
    // fire/tactical audit expects V10 may be keyed mixed by the panel (a flank attack from the anchor marginal at these flames).
    basis: `17:20–17:40: the new fire in sector ${NEW_FRONT.sector} (its polygon touching ${NEW_FRONT.sectors.join(" and ")}) spreads east along the old south edge (DR2, pushed), and no crew or asset is on it (round 2: the crews come back south at step 14); its size is recorded only: ${recordFigure(13, /^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25: erillinen palo kuva-alalla, noin (\d+,\d) ha/)} ha, flames ${recordFigure(13, /^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25: .*liekit (\d+(?:,\d+)?–\d+) m/)} m (DR2 thermal 17:25; DR3 mapping 17:35: ${recordFigure(13, /^DR3 kehäkartoitus valmis klo 17\.35:.*Erillinen uusi palo, noin (\d+,\d) ha/)} ha), and the map's polygon draws it at ${areaHa(siteStep(13).reportedDetached[0]!).toFixed(2)} ha: small enough to attack directly from the black, along its flanks, in its sector. The V9 record gives ~3 m/min at 17:10. Review note: key on records up to 17:40 only (nothing recorded after 17:40, such as DR2's 17:45 rate, is a basis for this view's key). ${SENSITIVITY_NOTE}`,
    basisAtomIds: [
      recordAtomId(13, /^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25: erillinen palo kuva-alalla, noin \d+,\d ha, liekit/),
      recordAtomId(13, /^DR3 kehäkartoitus valmis klo 17\.35:.*Erillinen uusi palo, noin \d+,\d ha/),
      recordAtomId(13, /^Uusi palo etenee itään vanhan eteläreunan suuntaisesti/), // radio DF-02 (SPEC/31): was "Uusi rintama"
    ],
  },
  11: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: ["barrier_line", "protect_values"], soundSectors: onHead(14), boundarySectors: across(headSectors(14), headSector(14)), fit: "yes",
    // Fix pass 5 (8 Oct 2026): the rates are read from DR2's two measurements (17.20–17.40 and 17.40–18.00), which the researcher's fire model moved.
    // SPEC/31 §3.3, §3.11: their flames (the provisional table) are read too; the panel keys V11 with a 20–40 min horizon (coa F5).
    basis: `17:40–18:20: the south-east front grows steadily, ${recordFigure(14, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.20–17\.40 \(kahden kuvan vertailu\), (\d+,\d) m\/min/)} m/min over 17.20–17.40 (${recordFigure(14, /^DR2 mittaus: kaakkoisrintaman etenemä (\d+) m klo 17\.20–17\.40/)} m, flames ${recordFigure(14, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.20–17\.40 .*liekit (\d+(?:,\d+)?–\d+) m/)} m) and ${recordFigure(15, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.40–18\.00 \(kahden kuvan vertailu\), (\d+,\d) m\/min/)} m/min over 17.40–18.00 (${recordFigure(15, /^DR2 mittaus: kaakkoisrintaman etenemä (\d+) m klo 17\.40–18\.00/)} m, flames ${recordFigure(15, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.40–18\.00 .*liekit (\d+(?:,\d+)?–\d+) m/)} m) (DR2, recorded; the provisional flame-length table); the FMI forecast (SÄÄENNUSTE, recorded only) gives the evening wind event — north-west and strengthening, gusts over 10 m/s (17.00), 7–9 m/s, gusts 12 from 18.30 (18.00): a line on a barrier ahead of it, or protecting the settlements the directive names, in the head's sector (${headSectors(14).join(" or ")}, within 50 m of its boundary; fix pass 2)${BURNOUT_IN_LINE}`,
    basisAtomIds: [
      recordAtomId(14, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.20–17\.40/),
      recordAtomId(15, /^DR2 mittaus: kaakkoisrintaman etenemä \d+ m klo 17\.40–18\.00/),
      recordAtomId(12, /^Ennuste: Ilmatieteen laitos, ennusteen päivitys \(annettu klo 17\.00\).*tuuli kääntyy illalla luoteeseen ja voimistuu/),
      recordAtomId(15, /^Ennuste: Ilmatieteen laitos, ennusteen päivitys \(annettu klo 18\.00\): tuuli kääntyy luoteeseen ja voimistuu/),
    ],
  },
  12: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: ["barrier_line", "protect_values"], soundSectors: onHead(16), boundarySectors: across(headSectors(16), headSector(16)), fit: "yes",
    // 6 Oct 2026: the Honkaharju stop is radioed at step 18 since the rekindles were anchored to the burned edge (was step 17, KY21): V13's.
    // SPEC/31 (F16, §3.11): the figures are read from the records; EK16's flames follow the provisional table (were 1–2 m).
    basis: `18:20–19:00: the head runs ~${recordFigure(17, /^Kärki lähestyy metsäautotietä luoteesta, etenee kaakkoon arviolta (\d+) m\/min/)} m/min, flames ${recordFigure(17, /^Kärki lähestyy metsäautotietä luoteesta, .*liekit (\d+(?:,\d+)?–\d+) m/)} m (EK16, on the forest road ahead of it, holding the road, pushed; EK11 until round 2), north-west wind gusting ${recordFigure(17, /^Sääasema johtopaikalla: tuuli luoteesta 9,0 m\/s, puuskissa (\d+,\d), lämpötila/)} m/s (weather station, recorded): too fast and too hot for a direct attack; a line on the road ahead of it, in the head's sector (${headSectors(16).join(" or ")}, within 50 m of its boundary; fix pass 2)${BURNOUT_IN_LINE}`,
    basisAtomIds: [
      recordAtomId(17, /^Kärki lähestyy metsäautotietä luoteesta, etenee kaakkoon arviolta 10 m\/min/),
      // SPEC/31 D3: the station's step-start reading now gives temperature, humidity and dew point too.
      recordAtomId(17, /^Sääasema johtopaikalla: tuuli luoteesta 9,0 m\/s, puuskissa 14,0, lämpötila/),
    ],
  },
  13: {
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: ["barrier_line", "protect_values"], soundSectors: onHead(18), boundarySectors: across(headSectors(18), headSector(18)), fit: "yes",
    // 6 Oct 2026: one step later since the rekindles were anchored to the burned edge (was: crossed 18.40–19.00, radioed at step 18).
    // Fix pass 2 regen (FF3): EK16 holds the road through step 18 and withdraws at step 19 (V14), so V13 no longer cites the withdrawal.
    // SPEC/31 coa F16: the stop's length and the head's rate are read from the records (the text said ~700 m and ~10.6 m/min against 500 m and 10.1).
    basis: `19:00–19:20: the forest road stopped the fire over ~${recordFigure(18, /^Palo pysähtyi metsäautotien \(Honkaharju\) kohdalle klo 18\.40–19\.00 noin (\d+) metrin matkalta/)} m in 18.40–19.00 (KY21, which held that stretch until 19:00 — revision (ak); pushed; the re-tuned fire model of 8 Oct 2026 restores the stop), the head pressing it at ~${recordFigure(18, /^DR2 lämpökuva, kaakkoisrintama klo 19\.05: reuna etenee kaakkoon noin (\d+,\d) m\/min/)} m/min with flames ${recordFigure(18, /^DR2 lämpökuva, kaakkoisrintama klo 19\.05: .*liekit (\d+(?:,\d+)?–\d+) m/)} m (DR2 thermal 19.05, pushed; round 2: the lines are on the roads); the directive names no line, so it still fits: the next barrier (service road R2) or protecting Lahdenkylä, in the head's sector (${headSectors(18).join(" or ")}, within 50 m of its boundary; fix pass 2)${BURNOUT_IN_LINE}`,
    basisAtomIds: [
      recordAtomId(18, /^Palo pysähtyi metsäautotien \(Honkaharju\) kohdalle klo 18\.40–19\.00/),
      recordAtomId(18, /^DR2 lämpökuva, kaakkoisrintama klo 19\.05: reuna etenee kaakkoon noin 11,5 m\/min/), // SPEC/33 stage 9 (20 Oct 2026): 11,5 on the rebuilt map (was 10,1; revision (aj): 10,6 before)
    ],
  },
  // Round 2 (researcher decision 5 Oct 2026): a late no-fit view (SPEC/27 §7.4 candidate (ii)), which
  // breaks the order confound (no-fit V9, V10, V14; fit V11–V13). Was fit "yes" on the south-east front.
  14: {
    // SPEC/31 §3.2 (coa F2, RC; WP-3's coding reads this shape): V14 is sound ONLY through the secondary route — `sound` is empty (no main-effort
    // posture is sound; with `soundSectors` gone and `sound` still ["direct_attack"] a direct attack would have been sound in every sector), so a
    // main effort on the flare-up codes D (rescue first, counter the greatest threat; SPEC/27 §7.4's first constraint). `boundarySectors`,
    // `soundSecondary` and `againstSecondaryTaskId` unchanged; `soundVia` is reported per view.
    aligned: PHASE_B, againstSecondaryTaskId: AGAINST_SECONDARY, sound: [], boundarySectors: across(SECOND_REKINDLE.sectors, SECOND_REKINDLE.sector), fit: "no",
    // Researcher decision 6 Oct 2026: the flare-up attacked directly as the secondary sector, the main effort protecting Lahdenkylä, is sound
    // (fix pass 2, 7 Oct 2026: and against the directive, so it codes C).
    soundSecondary: { taskId: AGAINST_SECONDARY, sectors: SECOND_REKINDLE.sectors, mainEffortSectors: [VILLAGE_SECTOR], mainEffortPostures: PHASE_B },
    // SPEC/31 coa F16: the figures are read from the records and the bundle (the text said "five crews": seven hold R2).
    basis: `19:20–20:00: the origin's old west edge has flared up again ~130 m west of the point of origin (SPOT, pushed, 19:23), in sector ${SECOND_REKINDLE.sector} (its polygon touching ${SECOND_REKINDLE.sectors.join(" and ")}), where no crew works; its size is recorded only: ~${recordFigure(19, /^SPOT, toinen ylilento klo 19\.30: syttymäkohdan länsipuolen uusi palo noin (\d+,\d) ha/)} ha, flames ${recordFigure(19, /^SPOT, toinen ylilento klo 19\.30: .*liekit (\d+(?:,\d+)?–\d+) m/)} m (SPOT's second pass, 19.30; the provisional flame-length table, SPEC/31 §3.11; fix pass 2 regen: DR2 stays over the south-east front), and the map's polygon draws it at ${MAP_FLARE_UP_HA.first} ha at 19:20 and ${MAP_FLARE_UP_HA.second} ha at 20:00 — small and low enough to attack directly before the north-westerly (station, recorded) runs it south-east to the forest road and Rahkasuo's drained peat; holding it on a barrier gives it the night. The south-east front heads for R2 (EK12, pushed; ~${recordFigure(20, /^DR2 tiehavainto: tie R2 .*palo noin (\d+) m tiestä/)} m at 19:4x, DR2's road report, recorded; revision (aj): was ~450 m, review fixes (ah): ~380 m), where ${R2_CREWS.length} crews (${R2_CREWS.join(", ")}) and the water shuttle already hold the road and Lahdenkylä is being evacuated with residents still in their houses (VPK, pushed): the directive's lines are in place there, and they are the main effort. Sound only through the secondary route (SPEC/31 §3.2, RC): the main effort, within the directive, in Lahdenkylä's sector (${VILLAGE_SECTOR}), the flare-up attacked directly as the secondary sector; a main effort on the flare-up while the head runs at R2 and the village codes D (rescue first, counter the greatest threat; SPEC/27 §7.4's first constraint). DRAFT for the panel (V14-b, V14-d)`,
    basisAtomIds: [
      recordAtomId(19, /^Uutta savua ja liekkejä syttymäkohdan länsipuolella, vanhan länsireunan ulkopuolella/),
      recordAtomId(19, /^SPOT, toinen ylilento klo 19\.30: syttymäkohdan länsipuolen uusi palo noin 0,3 ha/),
      recordAtomId(19, /^Kaakkoisrintama etenee kohti huoltotietä R2/),
      recordAtomId(20, /^DR2 tiehavainto: tie R2 .*palo noin \d+ m tiestä/),
      recordAtomId(18, /^VPK täällä Lahdenkylä\. Kaksi taloa ilmoittaa jäävänsä/),
    ],
  },
};

/**
 * The projection-direction key (SPEC/16 revision (x), SPEC/08 revision (x) "second reading"; built in fix pass 7, 9 Oct 2026,
 * revision (ad)) — TRUTH, analysis only, never sent to the screen. Exploratory.
 *
 * Two readings of whether a participant relied on the view's spread projection rather than on the reported development:
 *
 * 1. **The plan** (`PROJECTION_DIRECTION_KEYS`). For each breach view: the sector(s) the projection's head points into at the view's
 *    end (the vertex of its isochrone for that clock furthest along the head bearing, `projectionHeadAtEndOf`) and the sector(s) of the
 *    reported development the projection missed (authored from the flag, checked against the bundle). A view whose two sets share a
 *    sector, or whose breach is non-spatial (V11, depth), does not discriminate and is not read: V6, V9 and V14 discriminate. A main effort in a projected sector only reads `projection`, in
 *    a reported one only `reported` (`projectionDirectionReading`, `app/telemetry/projection-direction.ts`).
 * 2. **A numeric L3 freeze item** (`projectionOptionFor` in `freeze-keys.ts`). Where the view's projection, read like the report-keyed key at the item's
 *    clock, falls in another option than the report-keyed key, that option is the item's `projectionOptionId`; an answer choosing it
 *    reads as projection-anchored (`projectionChoiceReliance`). Built for V14 `se_front_r2`, where the map-point reading is weak (the
 *    two heads are ~106 m apart, inside the 300 m tolerance).
 *
 * Caveat (stated in SPEC/09 revision (ad)): in V14 the projection's band is also the band of the distance on record now (the projection
 * under-runs a quantitative breach, as a reading that does not project at all would), so "projection-anchored" there reads "did not
 * extrapolate the reports"; and in V14 the reported development (the second rekindle, L4) is the view's no-fit deciding fact, so the plan
 * reading coincides with the directive coding there.
 */

export interface ProjectionDirectionKey {
  readonly view: number;
  readonly flag: string;
  /** Sectors the projection's head points into at the view's end. */
  readonly projected: readonly string[];
  /** Sectors of the reported development the projection missed; empty for a non-spatial breach. */
  readonly reported: readonly string[];
  /** The two sets share no sector and both are non-empty: the plan can tell them apart. */
  readonly discriminates: boolean;
  readonly basis: string;
}

/**
 * Authored per breach view from its flag and `flagReason` (SPEC/16 revision (x)), each sector checked against the bundle at import
 * (`checked`), so a regenerated bundle cannot leave a stale sector in the key:
 * - V2, V4, V12 (the breach runs further in, or spots ahead of, the projected direction) and V11 (depth) do not discriminate;
 * - V6: the projection runs the head on to the north-east (L2); the wind backs to the south and the north flank (L1) runs (HELI1, pushed
 *   16:01 "pohjoisreuna aktivoitunut");
 * - V9: the projection has the head in the north (no growth anywhere); the old edge flares up south-east of the origin, `NEW_FRONT`
 *   (SPOT, pushed 17:01);
 * - V14: the projection runs the south-east front on (its head in L3); the origin's old west edge flares up, `SECOND_REKINDLE` (SPOT,
 *   pushed 19:23) — the view's no-fit deciding fact, so this reading coincides with the directive coding in V14.
 */
const AUTHORED: Readonly<Record<number, { readonly projected: readonly string[]; readonly reported: readonly string[]; readonly why: string }>> = {
  2: { projected: ["L2"], reported: ["L2"], why: "the head runs further along the projected bearing" },
  4: { projected: ["L2"], reported: ["L2"], why: "the crown run and its spots run ahead of the head, in the projected direction" },
  6: { projected: ["L2"], reported: ["L1"], why: "the wind backs to the south and the north flank becomes the head (HELI1, pushed 16:01)" },
  9: { projected: ["L2"], reported: [NEW_FRONT.sector], why: "the old south edge flares up south-east of the origin (SPOT, pushed 17:01)" },
  11: { projected: ["L3"], reported: [], why: "a non-spatial breach (depth, not area)" },
  12: { projected: ["L3"], reported: ["L3"], why: "the south-east front runs further along the projected bearing" },
  14: { projected: ["L3"], reported: [SECOND_REKINDLE.sector], why: "the origin's old west edge flares up again (SPOT, pushed 19:23)" },
};

/** Throws when an authored sector disagrees with the bundle (the projection's head at the view's end; the reported front's sector). */
function checked(view: number): ProjectionDirectionKey | null {
  const v = SITE_SCENARIO.views.find((x) => x.index === view)!;
  const flag = String(v.derivedFlag);
  if (v.practice || flag === "holds") return null;
  const a = AUTHORED[view];
  if (!a) throw new Error(`projection-direction key: breach view V${view} has no authored key`);
  const discriminates = a.projected.length > 0 && a.reported.length > 0 && !a.reported.some((s) => a.projected.includes(s));
  // Only a discriminating key is read, so only its projected sector is checked (V12's isochrone vertex rule picks the held fire's edge).
  const head = nearestSectorOf(projectionHeadAtEndOf(view, v.steps.at(-1)!));
  if (discriminates && !a.projected.includes(head ?? "")) throw new Error(`projection-direction key V${view}: the projection's head lies in ${head}, authored ${a.projected.join(", ")}`);
  if (view === 6 && nearestSectorOf(truthHeadAtEndOf(9)) === "L2" && siteStep(9).wind.fromDeg < 135) throw new Error("projection-direction key V6: the wind no longer backs south at step 9"); // (ah): SE 140 since the winds were re-authored
  return { view, flag, projected: a.projected, reported: a.reported, discriminates,
    basis: `V${view} (${flag}; ${v.flagReason}): the projection's head at the view's end lies in ${a.projected.join(", ")}; ${a.why}${a.reported.length ? ` (${a.reported.join(", ")})` : ""}` };
}

/** Every breach view's key, in view order. */
export const PROJECTION_DIRECTION_KEYS: readonly ProjectionDirectionKey[] = SITE_SCENARIO.views
  .map((v) => checked(v.index)).filter((k): k is ProjectionDirectionKey => k !== null);
