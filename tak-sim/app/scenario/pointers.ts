/**
 * Revision (bm), 25 Oct 2026 (researcher decision; SPEC/09 (bm), SPEC/18 (bm)): "report filed" pointers. In the play-tests nothing on
 * screen prompted the right question, so key records went unseen. A pointer is a short pushed radio line saying that a report has been
 * received, never what it says: the search stays necessary, and a participant who heard the pointer and did not look ("knew but didn't
 * check", metacognitive control) is told apart from one who never knew the record existed.
 *
 * Revision (bn), 25 Oct 2026 (review S4; SPEC/18 (bn)): units do not announce "… kirjattu" in VIRVE practice; the RECEIVING command
 * centre acknowledges. Every pointer is now an acknowledgement by the rescue department's command centre, call sign **JOKE**
 * (pelastuslaitoksen johtokeskus; "Command centre" in English), which is no H9/H10 source (VERKKOYHTIÖ, JOHTOPAIKKA, HELI1): "JOKE:
 * EK12:n tilanneilmoitus vastaanotettu." The line names the reporting source (`name`, the address, like the sender) and the kind of
 * report, and the verb varies (vastaanotettu / kuitattu / kirjattu, each in reals and decoys alike), so no one template is the most
 * recognisable pattern. The tour's records step says it (`app/i18n/ui.ts` `hakuRecords`: "Kun johtokeskus (JOKE) kuittaa radiossa
 * yksikön ilmoituksen, yksityiskohdat löytyvät kirjauksista.").
 *
 * - **Real** pointers (6) point to the recorded key record of a seek-dependent item: H2's V2 `south_flank`, `area_40` (and SPAM V3.b),
 *   V5 `hose_short`, `reinforcements`, V7 `north_help`, and V12 `front_toward`. **Decoys** (6) point to recorded reports that no freeze or
 *   SPAM item asks about, so a pointer never means "this will be asked"; every view with a real pointer has a decoy too, and two views
 *   without a real one (V9, V11) have one, so pointers come in freeze and non-freeze views alike. Revision (bn): the decoys' sources
 *   mirror the reals' mix — three ground units, two drone sources, one command source (reals: EK12, EK11, EK14; DR3, SPOT; P2) — and
 *   their windows mirror the reals' (three from a view's start to its freeze, one from a step boundary to the freeze, as V12's real
 *   one; `pointer-measures.ts` compares within windows). KY23's access line (a template twin of EK14's, review S4) is no longer one.
 * - **Content-free.** The body names the kind of report only: no figure, direction, state, unit (beyond the source it names) or place,
 *   and no content word that any freeze or SPAM option or key shares, in either language (`test/scenario/pointers.spec.ts`). "johto-"
 *   is avoided in the body (it shares a stem with V7 `cp_safe`'s "johtopaikka"); the sender JOKE is the address, not content.
 * - **Timing.** A pointer is in its record's step (delivered in the same burst that makes the record reachable, `time-gate.ts`) and
 *   its clock is at or after the record's, under a minute after it.
 * - **H9/H10 untouched.** No pointer to the F7 or rekindle records, none naming their sources (the grid operator, the command-post
 *   operator, HELI1), and none naming VPK or KY21 in V7–V8; the 16.00 forecast (V7 `rekindle_sector`, `cp_safe`) gets none, as it would
 *   cue H10's rekindle items.
 * - **Push cap** (`tools/fire-ca/view-traffic.ts` `displaceForPointers`): a pointer counts as a pushed item. A pointer to a record held
 *   for seeking (revision (bk)) takes the slot the held record kept; any other pointer over the cap displaces a generated record —
 *   a repeat first, then logistics — never one a freeze or SPAM item rests on, nor an air asset's change of state
 *   (`SITE_SCENARIO.pointerDisplaced`; revision (bn)).
 * - **Measure** (`app/telemetry/pointer-measures.ts`): whether a Haku or Thinker answer within the pointer's window retrieved its record.
 *
 * The pointer mark (`InfoAtom.pointer`) is analysis only: never rendered, never logged (the log names the atom), never reached by the
 * query tools (`reachableAtoms`). Both groups receive the same pointers. Finnish DRAFT (native and domain check); the English is in
 * `content/i18n/authored.en.json`.
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import type { InfoAtom, NavCategoryId, PointerMark } from "./types.js";
import { STEP_SECONDS } from "./views.js";

/** Revision (bn): the call sign that acknowledges every pointed report — the rescue department's command centre (no H9/H10 source). */
export const POINTER_SENDER = "JOKE";

export interface PointerDef {
  /** `atom.ptr.<step>.<n>`. */
  readonly id: string;
  /** The world-state step: the pointed record's own step. */
  readonly step: number;
  /** Seconds into the step: at or after the pointed record's clock. */
  readonly atS: number;
  /** Revision (bn): the source whose report is acknowledged — the pointed record's source (call sign or source id). */
  readonly about: string;
  /** Revision (bn): how the line names that source (the address, excluded from the content check like the sender). */
  readonly name: { readonly fi: string; readonly en: string };
  /** The line, the sender (JOKE) first. Finnish DRAFT. */
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

const unit = (id: string) => ({ fi: `${id}:n`, en: `${id}'s` });

export const POINTERS: readonly PointerDef[] = [
  // V2, first step (13.40–14.00), the view's start to its freeze. Decoy: EK14's situation report on the north edge (13.54); EK12's twin.
  { id: "atom.ptr.2.0", step: 2, atS: 900, about: "EK14", name: unit("EK14"), fi: "JOKE: EK14:n tilanneilmoitus kuitattu.", to: "evt.c02.026", kind: "decoy", nav: "palo", serves: [] },
  // V2, second step (14.00–14.20), the step boundary to the freeze. Real: EK12's 14.08 flank report, held for seeking ((bk)), the key
  // record of `south_flank`.
  { id: "atom.ptr.3.0", step: 3, atS: 540, about: "EK12", name: unit("EK12"), fi: "JOKE: EK12:n tilanneilmoitus vastaanotettu.", to: "evt.c03.021", kind: "real", nav: "palo", serves: ["freeze.2.south_flank"], takesHeldSlot: true },
  // Real: DR3's 14.15 perimeter survey, `area_40`'s seek record and SPAM V3.b's key record.
  { id: "atom.ptr.3.1", step: 3, atS: 990, about: "DR3", name: unit("DR3"), fi: "JOKE: DR3:n kehäkartoitus kuitattu.", to: "evt.c03.035", kind: "real", nav: "ilma", serves: ["freeze.2.area_40", "probe.s.cycle_3.b"] },
  // V5 (15.20–15.40). Real: EK11's 15.35 hose request, held ((bk)), `hose_short`'s key record. Not "tarvike-" (the root of the `tired`
  // option's "tarvitsee") and not "pyyntö" (beside `reinforcements`). English "replenishment order received", not "equipment order filed"
  // (review S4; the suggested "supply request" shares "resupplied" and "requested" with SPAM V6.c's and V8.b's options).
  { id: "atom.ptr.7.0", step: 7, atS: 990, about: "EK11", name: unit("EK11"), fi: "JOKE: EK11:n täydennystilaus vastaanotettu.", to: "evt.c07.032", kind: "real", nav: "vesi_reitit", serves: ["freeze.5.hose_short"], takesHeldSlot: true },
  // Real: P2's 15.30 dispatch, held ((bk)), `reinforcements`' key record. Not "hälytystiedot" (the key option's "hälytettyä") nor
  // "lisäyksiköt" (the `none` option's), nor "resurssi-" (a kind that would say "units").
  { id: "atom.ptr.7.1", step: 7, atS: 660, about: "P2", name: unit("P2"), fi: "JOKE: P2:n viesti kirjattu.", to: "atom.demo.7.1", kind: "real", nav: "yksikot", serves: ["freeze.5.reinforcements"], takesHeldSlot: true },
  // Decoy: the drone team's 15.20 flight status.
  { id: "atom.ptr.7.2", step: 7, atS: 210, about: "DRONERYHMÄ", name: { fi: "drooniryhmän", en: "the drone team's" }, fi: "JOKE: drooniryhmän lentotilanne vastaanotettu.", to: "evt.c07.005", kind: "decoy", nav: "ilma", serves: [] },
  // V7 (16.20–16.40). Real: EK14's 16.35 line to EK15 (recorded, T4), `north_help`'s key record. Not "saapumisohje" or "kulkuohje"
  // (they would say that reaching the line takes instructions) and no word of the options ("linja", "auto", "kalusto", "reitti").
  { id: "atom.ptr.10.0", step: 10, atS: 960, about: "EK14", name: unit("EK14"), fi: "JOKE: EK14:n viesti kirjattu.", to: "evt.c10.028", kind: "real", nav: "yksikot", serves: ["freeze.7.north_help"] },
  // Decoy (revision (bn), was DR3's 16.30 sensor log): EK13's 16.28 line to EK11 (T4, the basin on its way), the twin of EK14's line.
  { id: "atom.ptr.10.1", step: 10, atS: 540, about: "EK13", name: unit("EK13"), fi: "JOKE: EK13:n viesti kirjattu.", to: "evt.c10.014", kind: "decoy", nav: "vesi_reitit", serves: [] },
  // V9 (17.00–17.20), no freeze. Decoy (revision (bn), was KY23's access line to KY21, a template twin of EK14's): DR3's 17.11 sensor log.
  { id: "atom.ptr.12.0", step: 12, atS: 750, about: "DR3", name: unit("DR3"), fi: "JOKE: DR3:n anturiloki vastaanotettu.", to: "evt.c12.037", kind: "decoy", nav: "ilma", serves: [] },
  // V11 (17.40–18.20), no freeze, its second step. Decoy (revision (bn), was DR3's 17.55 survey): the 18.15 situation picture, the
  // command source's twin of P2's line (no item asks an area after V10).
  { id: "atom.ptr.15.0", step: 15, atS: 990, about: "TILANNEKUVA", name: { fi: "tilannekuvan", en: "situation picture" }, fi: "JOKE: tilannekuvan päivitys kirjattu.", to: "evt.c15.037", kind: "decoy", nav: "palo", serves: [] },
  // V12, second step (18.40–19.00), the step boundary to the freeze. Real: SPOT's 18.42 sighting of the head towards Lahdenkylä,
  // `front_toward`'s key record.
  { id: "atom.ptr.17.0", step: 17, atS: 180, about: "SPOT", name: { fi: "SPOTin", en: "SPOT's" }, fi: "JOKE: SPOTin havainnot kuitattu.", to: "atom.demo.17.1", kind: "real", nav: "ilma", serves: ["freeze.12.front_toward"] },
  // Decoy (revision (bn), was OUT1's 18.32 call for a guide in the first step): EK13's 18.57 line to EK12 (T4, the basin on its way),
  // in the same window as the real one beside it.
  { id: "atom.ptr.17.1", step: 17, atS: 1110, about: "EK13", name: unit("EK13"), fi: "JOKE: EK13:n viesti kuitattu.", to: "evt.c17.039", kind: "decoy", nav: "vesi_reitit", serves: [] },
];

/** The pointers of `step` as pushed atoms, delivered `offsetS` + their `atS` seconds into the view (as `demo-story.ts` `storyAtoms`). */
export function pointerAtoms(step: number, offsetS: number): { atoms: InfoAtom[]; pushed: { id: string; t: number }[] } {
  const atoms: InfoAtom[] = [];
  const pushed: { id: string; t: number }[] = [];
  for (const p of POINTERS.filter((x) => x.step === step)) {
    const at = asVirtualTime((step - 1) * STEP_SECONDS + p.atS);
    atoms.push({
      // Revision (bn): the command centre speaks from above (as P2 and the situation picture, `demo-story.ts`).
      id: p.id, tier: "T1_pushed", origin: "above", cycle: step as CycleIndex, loadBearing: false, navCategory: p.nav,
      routes: { directed: { kind: "pushed" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "pushed" } },
      record: { kind: "situation_log", entryId: `log.${p.id}`, authorUnitId: POINTER_SENDER, text: p.fi },
      // A radio call is heard as it is said (as `demo-map.ts` `radioAtoms`).
      provenance: {
        sourceId: POINTER_SENDER, sourceClassId: "sc.experienced", sourceReliability: "known-good",
        observedAt: at, recordedAt: at, deliveredAt: at, certainty: { kind: "confirmed" }, supports: [], contradicts: [],
      },
      degradation: [], retrievalKeys: [POINTER_SENDER.toLowerCase(), p.about.toLowerCase()], truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
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
