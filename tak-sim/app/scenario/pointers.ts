/**
 * Revision (bm), 25 Oct 2026 (researcher decision; SPEC/09 (bm), SPEC/18 (bm)): "report filed" pointers. In the play-tests nothing on
 * screen prompted the right question, so key records went unseen. A pointer is a short pushed radio line saying that a report has been
 * filed ("EK12: tilanneilmoitus kirjattu."), never what it says: the search stays necessary, and a participant who heard the pointer and
 * did not look ("knew but didn't check", metacognitive control) is told apart from one who never knew the record existed. The tour's
 * records step says it (`app/i18n/ui.ts` `hakuRecords`: "Kun yksikkö kertoo radiossa, että tiedot on kirjattu, yksityiskohdat löytyvät
 * kirjauksista.").
 *
 * - **Real** pointers (6) point to the recorded key record of a seek-dependent item: H2's V2 `south_flank`, `area_40` (and SPAM V3.b),
 *   V5 `hose_short`, `reinforcements`, V7 `north_help`, and V12 `front_toward`. **Decoys** (6) point to recorded reports that no freeze or
 *   SPAM item asks about, so a pointer never means "this will be asked"; every view with a real pointer has a decoy too, and two views
 *   without a real one (V9, V11) have one, so pointers come in freeze and non-freeze views alike. Decoys mirror the reals' kinds (a
 *   unit's situation update, a drone's survey or log, a unit's instructions, a request).
 * - **Content-free.** The body names the kind of report only: no figure, direction, state, unit or place, and no content word that any
 *   freeze or SPAM option or key shares, in either language (`test/scenario/pointers.spec.ts`). The sender is the call sign of a source
 *   already in use (sender first, one breath; `wildfire-radio-realism`).
 * - **Timing.** A pointer is in its record's step (delivered in the same burst that makes the record reachable, `time-gate.ts`) and
 *   its clock is at or after the record's.
 * - **H9/H10 untouched.** No pointer to the F7 or rekindle records, none from their sources (the grid operator, the command-post
 *   operator, HELI1), and none from VPK or KY21 in V7–V8; the 16.00 forecast (V7 `rekindle_sector`, `cp_safe`) gets none, as it would
 *   cue H10's rekindle items.
 * - **Push cap** (`tools/fire-ca/view-traffic.ts` `displaceForPointers`): a pointer counts as a pushed item. A pointer to a record held
 *   for seeking (revision (bk)) takes the slot the held record kept; any other pointer over the cap displaces a routine generated record
 *   (logistics first), never one a freeze or SPAM item rests on (`SITE_SCENARIO.pointerDisplaced`).
 * - **Measure** (`app/telemetry/pointer-measures.ts`): whether a Haku or Thinker answer after the pointer retrieved its record.
 *
 * The pointer mark (`InfoAtom.pointer`) is analysis only: never rendered, never logged (the log names the atom), never reached by the
 * query tools (`reachableAtoms`). Both groups receive the same pointers. Finnish DRAFT (native and domain check); the English is in
 * `content/i18n/authored.en.json`.
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import type { InfoAtom, NavCategoryId, Origin, PointerMark } from "./types.js";
import { STEP_SECONDS } from "./views.js";

export interface PointerDef {
  /** `atom.ptr.<step>.<n>`. */
  readonly id: string;
  /** The world-state step: the pointed record's own step. */
  readonly step: number;
  /** Seconds into the step: at or after the pointed record's clock. */
  readonly atS: number;
  /** The source id (call sign); the text starts with its spoken form. */
  readonly sender: string;
  /** The line, sender first. Finnish DRAFT. */
  readonly fi: string;
  readonly to: string;
  readonly kind: PointerMark["kind"];
  /** The pointed record's navigation category (the test holds them equal). */
  readonly nav: NavCategoryId;
  /** Real: the items whose key (or seek) record it points to. Decoy: none. Analysis only. */
  readonly serves: readonly string[];
  /** The pointed record is held for seeking (revision (bk)): the pointer takes the slot the record kept under the push cap. */
  readonly takesHeldSlot?: true;
}

export const POINTERS: readonly PointerDef[] = [
  // V2, first step (13.40–14.00). Decoy: EK14's situation update on the north edge (13.54); the twin of EK12's below.
  { id: "atom.ptr.2.0", step: 2, atS: 900, sender: "EK14", fi: "EK14: tilanneilmoitus kirjattu.", to: "evt.c02.026", kind: "decoy", nav: "palo", serves: [] },
  // V2, second step (14.00–14.20). Real: EK12's 14.08 flank report, held for seeking ((bk)), the key record of `south_flank`.
  { id: "atom.ptr.3.0", step: 3, atS: 540, sender: "EK12", fi: "EK12: tilanneilmoitus kirjattu.", to: "evt.c03.021", kind: "real", nav: "palo", serves: ["freeze.2.south_flank"], takesHeldSlot: true },
  // Real: DR3's 14.15 perimeter survey, `area_40`'s seek record and SPAM V3.b's key record.
  { id: "atom.ptr.3.1", step: 3, atS: 990, sender: "DR3", fi: "DR3: kehäkartoitus valmis, kirjattu.", to: "evt.c03.035", kind: "real", nav: "ilma", serves: ["freeze.2.area_40", "probe.s.cycle_3.b"] },
  // V5 (15.20–15.40). Real: EK11's 15.35 hose request, held ((bk)), `hose_short`'s key record. Not "tarvike-" (the root of the
  // `tired` option's "tarvitsee") and not "pyyntö" (the `reinforcements` option "on vasta pyydetty" beside it).
  { id: "atom.ptr.7.0", step: 7, atS: 990, sender: "EK11", fi: "EK11: täydennystilaus kirjattu.", to: "evt.c07.032", kind: "real", nav: "vesi_reitit", serves: ["freeze.5.hose_short"], takesHeldSlot: true },
  // Real: P2's 15.30 dispatch, held ((bk)), `reinforcements`' key record. Not "hälytystiedot" (the key option's "hälytettyä") nor
  // "lisäyksiköt" (the `none` option's).
  { id: "atom.ptr.7.1", step: 7, atS: 660, sender: "P2", fi: "P2: resurssitilanne kirjattu.", to: "atom.demo.7.1", kind: "real", nav: "yksikot", serves: ["freeze.5.reinforcements"], takesHeldSlot: true },
  // Decoy: the drone team's 15.20 flight status.
  { id: "atom.ptr.7.2", step: 7, atS: 210, sender: "DRONERYHMÄ", fi: "Drooniryhmä: lentotilanne päivitetty, kirjattu.", to: "evt.c07.005", kind: "decoy", nav: "ilma", serves: [] },
  // V7 (16.20–16.40). Real: EK14's 16.35 line to EK15 (recorded, T4), `north_help`'s key record. Not "saapumisohje" or "kulkuohje"
  // (they would say that reaching the line takes instructions) and no word of the options ("linja", "auto", "kalusto", "reitti").
  { id: "atom.ptr.10.0", step: 10, atS: 960, sender: "EK14", fi: "EK14: ohjeet kirjattu.", to: "evt.c10.028", kind: "real", nav: "yksikot", serves: ["freeze.7.north_help"] },
  // Decoy: DR3's 16.30 sensor log.
  { id: "atom.ptr.10.1", step: 10, atS: 690, sender: "DR3", fi: "DR3: lentoloki kirjattu.", to: "evt.c10.019", kind: "decoy", nav: "ilma", serves: [] },
  // V9 (17.00–17.20), no freeze. Decoy: KY23's 17.18 line to KY21 (the twin of EK14's in V7, after it).
  { id: "atom.ptr.12.0", step: 12, atS: 1150, sender: "KY23", fi: "KY23: ohjeet kirjattu.", to: "evt.c12.050", kind: "decoy", nav: "yksikot", serves: [] },
  // V11 (17.40–18.20), no freeze. Decoy: DR3's 17.55 perimeter survey (no item asks an area after V10).
  { id: "atom.ptr.14.0", step: 14, atS: 990, sender: "DR3", fi: "DR3: kehäkartoitus valmis, kirjattu.", to: "evt.c14.033", kind: "decoy", nav: "ilma", serves: [] },
  // V12, first step (18.20–18.40). Decoy: OUT1's 18.32 call for a local guide.
  { id: "atom.ptr.16.0", step: 16, atS: 780, sender: "OUT1", fi: "OUT1: tukipyyntö kirjattu.", to: "evt.c16.031", kind: "decoy", nav: "vesi_reitit", serves: [] },
  // V12, second step (18.40–19.00). Real: SPOT's 18.42 sighting of the head towards Lahdenkylä, `front_toward`'s key record.
  { id: "atom.ptr.17.0", step: 17, atS: 180, sender: "SPOT", fi: "SPOT: havainnot kirjattu.", to: "atom.demo.17.1", kind: "real", nav: "ilma", serves: ["freeze.12.front_toward"] },
];

/** The drones and the drone team report as sensors; P2 and the spotter aircraft from above; the crews from below (as `demo-story.ts`). */
const isSensor = (id: string): boolean => /^DR\d$/.test(id) || id === "DRONERYHMÄ";
const isAbove = (id: string): boolean => id === "P2" || id === "SPOT";
const originOf = (id: string): Origin => (isSensor(id) ? "sensor" : isAbove(id) ? "above" : "below");

/** The pointers of `step` as pushed atoms, delivered `offsetS` + their `atS` seconds into the view (as `demo-story.ts` `storyAtoms`). */
export function pointerAtoms(step: number, offsetS: number): { atoms: InfoAtom[]; pushed: { id: string; t: number }[] } {
  const atoms: InfoAtom[] = [];
  const pushed: { id: string; t: number }[] = [];
  for (const p of POINTERS.filter((x) => x.step === step)) {
    const at = asVirtualTime((step - 1) * STEP_SECONDS + p.atS);
    atoms.push({
      id: p.id, tier: "T1_pushed", origin: originOf(p.sender), cycle: step as CycleIndex, loadBearing: false, navCategory: p.nav,
      routes: { directed: { kind: "pushed" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "pushed" } },
      record: { kind: "situation_log", entryId: `log.${p.id}`, authorUnitId: p.sender, text: p.fi },
      // A radio call is heard as it is said (as `demo-map.ts` `radioAtoms`).
      provenance: {
        sourceId: p.sender, sourceClassId: isSensor(p.sender) ? "sc.sensor" : "sc.experienced", sourceReliability: "known-good",
        observedAt: at, recordedAt: at, deliveredAt: at, certainty: { kind: "confirmed" }, supports: [], contradicts: [],
      },
      degradation: [], retrievalKeys: [p.sender.toLowerCase()], truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
      pointer: { to: p.to, kind: p.kind },
    });
    pushed.push({ id: p.id, t: offsetS + p.atS });
  }
  return { atoms, pushed };
}

/** Pointers in view `steps` that count as one more pushed item each: every one but those taking a held record's slot. */
export function pointersCountedInSteps(steps: readonly number[]): number {
  return POINTERS.filter((p) => steps.includes(p.step) && !p.takesHeldSlot).length;
}
