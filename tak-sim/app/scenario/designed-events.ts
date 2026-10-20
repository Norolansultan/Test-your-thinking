/**
 * The two designed content events, as authored corpus atoms — SYNTHETIC PLACEHOLDER CONTENT: every
 * Finnish text here is a DRAFT for native-speaker and domain review (`content/demo/README.md`).
 *
 * 1. Fault F7, the planted false record (SPEC/02 revision (o) §5, SPEC/18 §10). The power line — a 20 kV distribution line on
 *    wooden poles since SPEC/33 (bc), 20 Oct 2026 (was 110 kV) — (V4) is live for the whole incident. At step 6 the regional
 *    distribution company's control room records that
 *    it is still energised and that de-energising has been requested (load-bearing). At step 8
 *    the command-post operator logs the request as done: "20 kV linja jännitteetön, vahvistettu."
 *    It is never corrected, and no record anywhere confirms de-energisation. Later traffic still
 *    treats the line as a hazard; at step 18 (19:18), when the south-east front reaches the line, the company's second
 *    call says it is still live and de-energising requested (SPEC/33 gate R). The truth is the invariant `F7_TRUTH_INVARIANT` ("live").
 * 2. The rekindle arc (SPEC/26 §5; revised 2 Oct 2026: no shower, the rekindle is at the origin). At
 *    step 10 (V7), as the wind eases and backs, crews report L3, the origin's south side, in hand; the
 *    L3 sector leader (KY21's leader) moves KY21 and VPK to the north flank (the moves are radio,
 *    `tools/fire-ca/deployment.ts`); VPK's leader objects on TOIMINTA-2 (load-bearing) and is
 *    overruled. The echo (`t4.private_doubt`, step 11) is authored with the other T4 seeds in
 *    `demo-scenario.ts`.
 *
 * The power-line items sit under "Vesi, tiet ja reitit" (SPEC/25 §3): the line is infrastructure,
 * and "Kohteet ja väestö" holds almost nothing else, so it would single them out (SPEC/25 §6).
 *
 * Every atom here is RECORDED (T2), never pushed (SPEC/02 revision (o) §5; SPEC/26 §5). Talk-group
 * transcripts are kept as situation-log entries, as the incident's other recorded radio is
 * (`demo-map.ts` `radioAtoms`), so the query builder and search find them the same way. Nothing is
 * special-cased in retrieval (SPEC/14 revision (q)).
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import { DESIGNED_EVENT_IDS, type Consequence, type EventType, type ExpectedInvariant, type InfoAtom, type InteractionEvent, type NavCategoryId, type Origin } from "./types.js";
import { STEP_SECONDS } from "./views.js";

/** Non-unit sources (the query builder's KUKA list shows them as they are). */
export const GRID_OPERATOR_SOURCE = "VERKKOYHTIÖ"; // the regional distribution network company's control room (alueen verkkoyhtiön käyttökeskus); generic, no real company (SPEC/33 (bc): the 20 kV line's owner, not the national grid operator)
export const COMMAND_POST_SOURCE = "JOHTOPAIKKA"; // the command-post operator, who keeps the situation log (tilannepäiväkirja)

/** SPEC/02 revision (o) §5: the line's true state for the whole incident. V12's freeze item, the only one on the line, scores against it (`demo-probes.ts`). */
export const F7_TRUTH_INVARIANT: ExpectedInvariant = { name: "f7.power_line_state", expected: "live", tolerance: 0 };

interface DesignedSeed {
  readonly id: string;
  readonly step: CycleIndex;
  /** Seconds into the step. */
  readonly atS: number;
  readonly source: string;
  readonly origin: Origin;
  readonly sourceClassId: "sc.experienced" | "sc.sensor";
  readonly nav: NavCategoryId;
  /** Finnish, DRAFT for review. */
  readonly text: string;
  readonly keys: readonly string[];
  /** Substitutive (free-text) route: narrow questions that reach it. */
  readonly queries: readonly string[];
  readonly isGroundTruth?: false;
  readonly tierRationale: string;
  readonly loadBearing?: Consequence;
  /** A talk-group transcript: machine-transcribed, so not "confirmed" (SPEC/26 §5: confidence medium). */
  readonly transcript?: true;
}

const SEEDS: readonly DesignedSeed[] = [
  // --- F7 -------------------------------------------------------------------------------------------
  {
    id: DESIGNED_EVENT_IDS.gridRecord, step: 6, atS: 360, source: GRID_OPERATOR_SOURCE, origin: "above", sourceClassId: "sc.experienced", nav: "vesi_reitit",
    // SPEC/33 (bc), 20 Oct 2026: a 20 kV distribution line on wooden poles, owned by the regional distribution network company (its
    // control room takes the request to de-energise); was "110 kV voimajohto". DRAFT Finnish for the native check.
    text: "Alueen verkkoyhtiön käyttökeskus: 20 kV:n sähkölinja palon itäpuolella on edelleen jännitteinen. Linjan poiskytkentää on pyydetty, tieto kytkennästä annetaan erikseen. Toistaiseksi turvaetäisyydet voimassa.",
    keys: ["20", "kv", "sähkölinja", "linja", "jännite", "verkkoyhtiö", "käyttökeskus", "poiskytkentä"],
    queries: ["20 kV linja", "sähkölinja"],
    tierRationale: "a phone call to the command post, logged (T2); SPEC/02 revision (o) §5 — the record that contradicts F7",
    loadBearing: { description: "the grid operator's own record: the line is live and de-energising is only requested; contradicts the F7 planted record from step 8", manifestsAtCycle: 8, measureId: "f7.grid_record" },
  },
  {
    id: DESIGNED_EVENT_IDS.planted, step: 8, atS: 360, source: COMMAND_POST_SOURCE, origin: "above", sourceClassId: "sc.experienced", nav: "vesi_reitit",
    text: "20 kV linja jännitteetön, vahvistettu.",
    keys: ["20", "kv", "linja", "sähkölinja", "jännite", "tilannepäiväkirja", "johtopaikka"],
    queries: ["20 kV linja", "sähkölinja"],
    isGroundTruth: false,
    tierRationale: "SPEC/02 revision (o) §5: a data-entry error in the situation log (the request logged as confirmed); never corrected",
    loadBearing: { description: "F7: false for the whole incident; holding 'de-energised' is scored wrong and coded for H9", manifestsAtCycle: 8, measureId: "h9.f7_false_value" },
  },
  {
    id: DESIGNED_EVENT_IDS.heliLineClearance, step: 9, atS: 420, source: "HELI1", origin: "sensor", sourceClassId: "sc.sensor", nav: "vesi_reitit",
    text: "HELI1: kauhalennot kärkeen jatkuvat. Reitti kiertää 20 kV:n sähkölinjan, pysymme reilusti erossa johtimista emmekä pudota vettä linjan päälle.",
    keys: ["heli1", "20", "kv", "sähkölinja", "johtimet", "kauha"],
    queries: ["HELI1 sähkölinja"],
    tierRationale: "SPEC/02 revision (o) §5: later traffic still treating the line as a hazard (recorded, not a correction)",
  },
  {
    // SPEC/33 gate R (20 Oct 2026): the south-east front reaches the line in 19:00–19:20 (the CA's front 201 m from it at 19:00, 7 m at
    // 19:20, 1 m at 19:40) and no record said so, where an incident commander expects word of it. The company's second call, at 19:18,
    // in V13 — after V12's F7 freeze at 19:00, the only item on the line (V14's items ask nothing of it). Like its step-6 record it says
    // live and only requested, never de-energised: H9's planted record stays the only one that says so, and nothing supersedes it.
    // DRAFT Finnish.
    id: DESIGNED_EVENT_IDS.gridAtLine, step: 18, atS: 1080, source: GRID_OPERATOR_SOURCE, origin: "above", sourceClassId: "sc.experienced", nav: "vesi_reitit",
    text: "Alueen verkkoyhtiön käyttökeskus: palo on nyt 20 kV:n sähkölinjan kohdalla kaakkoisrintamalla. Linja on edelleen jännitteinen. Poiskytkentää on pyydetty ja asentaja on matkalla erottimelle, tieto kytkennästä annetaan erikseen. Turvaetäisyydet voimassa, palava pylväs voi pudottaa johtimen maahan.",
    keys: ["20", "kv", "sähkölinja", "linja", "jännite", "verkkoyhtiö", "käyttökeskus", "poiskytkentä", "pylväs", "kaakkoisrintama"],
    queries: ["20 kV linja", "sähkölinja"],
    tierRationale: "a phone call to the command post, logged (T2), as the company's step-6 record: the line still live when the fire reaches it (not a correction of the planted record)",
  },
  // --- Rekindle, step 10 (V7) -----------------------------------------------------------------------
  {
    id: DESIGNED_EVENT_IDS.inHand[0], step: 10, atS: 15, source: "KY21", origin: "below", sourceClassId: "sc.experienced", nav: "palo",
    text: "KY21: Lohko 3 hallinnassa. Tuuli heikentynyt, syttymäkohdan eteläreunalla ei näy savua.",
    keys: ["ky21", "lohko", "l3", "hallinnassa", "syttymäkohta", "eteläreuna", "reuna"],
    queries: ["ky21"],
    tierRationale: "SPEC/26 §5: crew status as the wind eases (recorded; broad questions about the origin's edge meet these first)",
  },
  {
    id: DESIGNED_EVENT_IDS.inHand[1], step: 10, atS: 35, source: "VPK", origin: "below", sourceClassId: "sc.experienced", nav: "palo",
    text: "VPK: Syttymäkohdan eteläreuna rauhoittunut, avotulta ei näy. Linja pitää.",
    keys: ["vpk", "syttymäkohta", "eteläreuna", "reuna", "rauhoittunut", "hallinnassa"],
    queries: ["vpk"],
    tierRationale: "SPEC/26 §5: crew status as the wind eases (recorded)",
  },
  {
    id: DESIGNED_EVENT_IDS.inHand[2], step: 10, atS: 50, source: COMMAND_POST_SOURCE, origin: "above", sourceClassId: "sc.experienced", nav: "palo",
    text: "Tilannepäiväkirja: lohko L3 (syttymäkohdan eteläpuoli) hallinnassa, ilmoittaja KY21.",
    keys: ["tilannepäiväkirja", "lohko", "l3", "syttymäkohta", "hallinnassa"],
    queries: ["lohko L3"],
    tierRationale: "SPEC/26 §5: the in-hand status as logged (recorded)",
  },
  {
    id: DESIGNED_EVENT_IDS.objection, step: 10, atS: 65, source: "VPK", origin: "below", sourceClassId: "sc.experienced", nav: "palo",
    text: "Syttymäkohdan reunalla kannot ja hakkuutähteet voivat vielä kyteä pinnan alla. Jos tuuli kääntyy, se voi syttyä uudelleen. Pitäisi tarkistaa lämpökameralla ennen kuin lähdetään.",
    keys: ["vpk", "syttymäkohta", "reuna", "kannot", "hakkuutähteet", "kytee", "kyteä", "tuuli", "lämpökamera", "toiminta-2"],
    queries: ["VPK syttymäkohta", "kyteekö syttymäkohta"],
    tierRationale: "SPEC/26 §5: VPK's leader to the L3 sector leader on TOIMINTA-2, recorded transcript (T2, confidence medium)",
    transcript: true,
    loadBearing: { description: "the overruled warning: the origin's south edge is not checked before the crews leave, and it flares up there at step 12 when the wind turns west", manifestsAtCycle: 12, measureId: "warning_uptake.rekindle_objection" },
  },
  {
    id: DESIGNED_EVENT_IDS.overruled, step: 10, atS: 80, source: "KY21", origin: "below", sourceClassId: "sc.experienced", nav: "johto",
    text: "Ei ole väkeä tarkistukseen. Lohko on hallinnassa, siirrytään L1:lle.",
    keys: ["ky21", "lohko", "hallinnassa", "tarkistus", "l1", "siirto", "toiminta-2"],
    queries: ["KY21 siirto"],
    tierRationale: "SPEC/26 §5: the L3 sector leader's reply on TOIMINTA-2, recorded transcript (T2)",
    transcript: true,
  },
];

/**
 * How each item reads in the interaction log (`tools/corpus/export.ts`, SPEC/18 revision (n)).
 * `positionStep`: the step whose unit positions place it. A step's map shows its moves done, but
 * the step-10 reports and the exchange come from the bog, before KY21 and VPK leave it.
 */
export const DESIGNED_LOG: Readonly<Record<string, { readonly addressee: string | null; readonly channel: InteractionEvent["channel"]; readonly event_type: EventType; readonly positionStep?: number }>> = {
  [DESIGNED_EVENT_IDS.gridRecord]: { addressee: null, channel: "system_log", event_type: "report" },
  [DESIGNED_EVENT_IDS.planted]: { addressee: null, channel: "system_log", event_type: "status" },
  [DESIGNED_EVENT_IDS.heliLineClearance]: { addressee: "JOHTO", channel: "radio_command", event_type: "report" },
  [DESIGNED_EVENT_IDS.gridAtLine]: { addressee: null, channel: "system_log", event_type: "report" },
  [DESIGNED_EVENT_IDS.inHand[0]]: { addressee: "JOHTO", channel: "radio_command", event_type: "status", positionStep: 9 },
  [DESIGNED_EVENT_IDS.inHand[1]]: { addressee: "JOHTO", channel: "radio_command", event_type: "status", positionStep: 9 },
  [DESIGNED_EVENT_IDS.inHand[2]]: { addressee: null, channel: "system_log", event_type: "status" },
  [DESIGNED_EVENT_IDS.objection]: { addressee: "KY21", channel: "radio_command", event_type: "warning", positionStep: 9 }, // TOIMINTA-2
  [DESIGNED_EVENT_IDS.overruled]: { addressee: "VPK", channel: "radio_command", event_type: "coordination", positionStep: 9 }, // TOIMINTA-2
};

export function designedEventAtoms(): InfoAtom[] {
  return SEEDS.map((s) => {
    const at = (s.step - 1) * STEP_SECONDS + s.atS;
    return {
      id: s.id, tier: "T2_system", origin: s.origin, cycle: s.step, loadBearing: s.loadBearing !== undefined, navCategory: s.nav,
      routes: {
        directed: { kind: "browse", surface: "situation_log" },
        assistive: { kind: "browse", surface: "situation_log" },
        substitutive: { kind: "free_text", exampleQueries: s.queries },
      },
      record: { kind: "situation_log", entryId: `log.${s.id}`, authorUnitId: s.source, text: s.text },
      provenance: {
        sourceId: s.source, sourceClassId: s.sourceClassId, sourceReliability: "known-good",
        observedAt: asVirtualTime(at), recordedAt: asVirtualTime(at + 10), deliveredAt: null,
        certainty: s.transcript ? { kind: "probable", basis: "TOIMINTA-2, machine transcript, confidence medium" } : { kind: "confirmed" },
        supports: [], contradicts: [],
      },
      degradation: [],
      retrievalKeys: [...s.keys],
      truth: {
        isGroundTruth: s.isGroundTruth ?? true, isDecoy: false, tierRationale: s.tierRationale,
        relevantInvariants: s.id.startsWith("f7.") ? [F7_TRUTH_INVARIANT.name] : [],
      },
      ...(s.loadBearing ? { consequence: s.loadBearing } : {}),
    };
  });
}
