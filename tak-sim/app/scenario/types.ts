/**
 * The scenario data model — SPEC/04_Data_Model.md, "authoritative over
 * every prose description of data elsewhere."
 *
 * This file reconciles 04's base text with every dated amendment and
 * revision through 2026-09-17 into a single current state, per the
 * precedence rules in SPEC/00 §1: "Amendments dated 17 September 2026...
 * the document it points to (14, 15 or 16, or the file's own dated
 * amendment) wins over the marked text, regardless of file number." Where
 * 04 itself carries several dated revisions on one topic (e.g.
 * `ConditionId` was revised four times), the LAST one wins; superseded
 * intermediate shapes are not reproduced here.
 *
 * Deliberately NOT merged in yet, per 04's own closing note ("Decision
 * types are defined in 16 §7 and information packages in 14 §3.2; both
 * are authoritative as written there until merged here"):
 *   - `InfoPackage` and the retrieval engine's types (SPEC/14 §3.2) — M5.
 *   - `DecisionOption` / `DecisionItem` / `DecisionResponse` (SPEC/16 §7) — M8.
 * Building those now, ahead of the milestone that needs them, would mean
 * guessing at a design that has already been revised four times in the
 * source documents; better to add them when M5/M8 actually starts and the
 * fork registered in SPEC/11 §7.1 (embedding model, package topic list)
 * has something to build against.
 *
 * Scope note carried over from `engine/cycle-sequencer.ts`: prologue
 * (W1-W5) placement on the virtual timeline is unresolved (SPEC/17 §3,
 * item S1). `WarmupIndex` exists as a type because probes and cycle specs
 * reference it, but nothing here invents a timing answer for it.
 */

import type { CycleIndex, GeoExtent, LatLon, Polygon, VirtualTime, WarmupIndex } from "../engine/primitives.js";

// ---------------------------------------------------------------------------
// §1 primitives not already in engine/primitives.ts
// ---------------------------------------------------------------------------

export type Tier = "T1_pushed" | "T2_system" | "T3_person" | "T4_lateral";
export type Origin = "below" | "lateral" | "above" | "sensor";
export type SourceReliability = "known-good" | "unproven" | "degraded";

export type Certainty =
  | { readonly kind: "confirmed" }
  | { readonly kind: "probable"; readonly basis: string }
  | { readonly kind: "uncertain"; readonly basis: string }
  | { readonly kind: "unknown" }; // MUST be representable and renderable — never `undefined`.

// ---------------------------------------------------------------------------
// §1 amendment / revisions — condition ids, cells, echelon
// ---------------------------------------------------------------------------

/** Revision 2026-09-17 (f), final: `assistive` is defined but unused in this study (CI asserts no session is configured with it). */
export type ConditionId = "directed" | "assistive" | "substitutive";

/** Revision 2026-09-17 (f), final. Replaces `SessionConfig.guidanceMode`. */
export type Cell = "radio" | "reasoning_once" | "reasoning_intent";

/** Amendment 2026-09-17, §11. */
export type Echelon = "command" | "supervisory" | "crew";

export type Phase = "A" | "B";

// ---------------------------------------------------------------------------
// §2 the scenario contract
// ---------------------------------------------------------------------------

export interface ExpectedInvariant {
  readonly name: string; // e.g. "containment.cycle_04"
  readonly expected: number | string | boolean;
  readonly tolerance: number; // >= 0; 0 for categorical
  readonly unit?: string; // "m", "deg", "m/min" — documentation, not logic
}

export interface ValidityClaim {
  readonly represents: readonly string[];
  readonly doesNotRepresent: readonly string[];
  readonly authoredBy: string;
  readonly reviewedBy: readonly string[]; // domain reviewers, named
  readonly sourceBasis: readonly string[]; // incidents, doctrine, data drawn on
  readonly knownDivergences: readonly string[]; // where it is deliberately unrealistic
}

/**
 * `knownDivergences` must contain at minimum (SPEC/04 §2): the deliberate
 * breach-rate choice; the fire magnitude relative to Finnish experience;
 * and the fact that the `directed` responder is simulated rather than a
 * person. Checked by tag in {@link REQUIRED_DIVERGENCE_TAGS}.
 */
export const REQUIRED_DIVERGENCE_TAGS = ["breach-rate", "fire-magnitude", "simulated-responder"] as const;
export type RequiredDivergenceTag = (typeof REQUIRED_DIVERGENCE_TAGS)[number];

export interface ContradictionMarker {
  readonly id: string;
  readonly cycle: CycleIndex; // the VIEW: V13 (step 18, SPEC/26 §3)
  readonly premiseAtomId: string; // the aerial report
  readonly counterAtomId: string; // the ground report
  readonly reconcilingAtomId: string; // the T4 traffic that explains it
  readonly subtlety: "low" | "medium" | "high"; // pilot selects among three
  readonly detectionProbeId: string; // the closed area item (revision (ai); was the open uncertainty probe)
  readonly backupProbeId: string; // the forced-choice item
}

export interface OmissionMarker {
  readonly id: string;
  readonly cycle: CycleIndex; // the VIEW: V9 (step 12, SPEC/26 §3)
  readonly mechanism: "M1_holdover" | "M2_gusts" | "M3_fuel_boundary" | "M4_spotting"; // M1 was "M1_shower" until 2 Oct 2026
  readonly outsideEveryEnvelope: true; // literal; asserted in CI
  readonly developmentAtomIds: readonly string[];
}

export interface AlignmentRule {
  readonly id: string;
  readonly appliesToSectors: readonly string[];
  readonly alignedTasks: readonly string[];
  readonly misalignedTasks: readonly string[];
}

export interface HingeSpec {
  readonly afterCycle: 7; // SPEC/26 §3: between V7 and V8 (16:40, after step 10)
  readonly guidanceMessageId: string;
  readonly pauseSeconds: 300; // real time, participant-dismissible
  readonly intentStatement: string; // Finnish; restated by the channel
  readonly alignmentRules: readonly AlignmentRule[]; // how allocations are scored
  /**
   * The manipulation check (phase-B round 2, brief D3, 4 Oct 2026): one forced-choice item on the
   * hinge screen after the directive, both groups; Continue is enabled once it is answered. The
   * item carries no key: its key is the invariant `manipulationCheckInvariant` (TRUTH, scoring only),
   * as a SPAM probe's is, so nothing here can reach the render layer as truth. Absent: no check.
   */
  readonly manipulationCheck?: ManipulationCheckItem;
}

/** A forced-choice item with no key (the key is an invariant): prompt and options, in the order shown. */
export interface ManipulationCheckItem {
  readonly id: string;
  readonly promptFi: string;
  readonly options: readonly { readonly id: string; readonly labelFi: string }[];
  /** The invariant (`ScenarioContract.invariants`) that holds the key option id. TRUTH. */
  readonly invariantName: string;
}

/** SPEC/12 §10: "DEFINED AND NEVER POPULATED IN THIS STUDY." §6.4. */
export interface AllocationRecommendation {
  readonly assetId: string;
  readonly toSectorId: string;
  readonly taskId: string;
  readonly machineAttribution: string;
  readonly certainty: Certainty;
}

export interface ScenarioContract {
  readonly id: string; // stable, human-readable, never reused
  readonly version: string; // semver; any content change bumps it
  readonly seed: bigint; // u64
  readonly constructs: readonly string[]; // what this scenario probes
  readonly validity: ValidityClaim; // mandatory
  readonly extent: GeoExtent;
  readonly cycleCount: 14; // SPEC/26 D1: the main views V1-V14 (the practice view is `practice`)
  readonly virtualSecondsPerStep: 1200; // SPEC/26 §2: one world-state step is twenty minutes; a view spans one or two
  readonly startVirtualClock: string; // "HH:MM" shown to the participant
  readonly invariants: readonly ExpectedInvariant[]; // the answer key
  readonly contradiction: ContradictionMarker; // exactly one
  readonly omission: OmissionMarker; // exactly one
  readonly probeSchedule: ProbeSchedule;
  readonly cycles: readonly CycleSpec[]; // the main views, length 14, index 1-14; their steps cover 1-20 once, in order
  readonly practice: PracticeView; // SPEC/26 D3: VP, step W5 — outside every scored array
  readonly atoms: readonly InfoAtom[];
  readonly envelopes: readonly Envelope[]; // length 14, one per main view
  readonly channelSets: readonly ChannelSignalSet[]; // length 14
  readonly dutyOfficerMessages: readonly DutyOfficerMessage[];
  readonly branches: readonly Branch[]; // >= 5
  readonly branchStatements: readonly BranchStatement[]; // SPEC/03 revision (d), SPEC/04 revision (d)
  readonly allocationSpace: AllocationSpace;
  readonly allocationRecommendations: readonly AllocationRecommendation[]; // SPEC/12 §10: CI asserts length === 0 in this study
  readonly hinge: HingeSpec;
  readonly sourceClasses: readonly SourceClass[];
  readonly decisionItems: readonly DecisionItem[]; // SPEC/16; one per main view (SPEC/26 §4)
  readonly freezes: readonly FreezeSpec[]; // SPEC/15 §9; one per cycle with hasFreeze
}

// ---------------------------------------------------------------------------
// §3 information atoms
// ---------------------------------------------------------------------------

export type RecordSurface =
  | "situation_log"
  | "traffic_log"
  | "unit_status"
  | "reference_stand"
  | "reference_road"
  | "reference_water"
  | "reference_maintenance"
  | "task_record"
  | "weather_series";

export interface TrafficSelector {
  readonly byUnit?: string;
  readonly byGroup?: string;
  readonly byTimeWindow?: readonly [VirtualTime, VirtualTime];
}

export type Route =
  | { readonly kind: "pushed" } // T1
  | { readonly kind: "ask_unit"; readonly unitId: string } // T3, T4
  | { readonly kind: "ask_duty_officer" }
  | { readonly kind: "request_traffic"; readonly selector: TrafficSelector } // T4
  | { readonly kind: "browse"; readonly surface: RecordSurface } // T2
  | { readonly kind: "free_text"; readonly exampleQueries: readonly string[] }
  | { readonly kind: "channel"; readonly signalSetCycle: CycleIndex };

/**
 * SPEC/02 revision (g): routes in use for the two groups this study
 * configures. `directed` -> browse | request_traffic | ask_unit.
 * `substitutive` -> free_text | ask_unit. `assistive` and the `channel`
 * route are unused (kept in the type so a later study can reinstate them
 * without an engine change).
 */
export interface Routes {
  readonly directed: Route | null; // non-null required if loadBearing
  readonly assistive: Route | null;
  readonly substitutive: Route | null;
}

export interface Provenance {
  // participant-visible
  readonly sourceId: string; // unit designator or sensor id
  readonly sourceClassId: string; // -> SourceClass
  readonly sourceReliability: SourceReliability;
  readonly observedAt: VirtualTime; // when it happened
  readonly recordedAt: VirtualTime; // when it was typed — may differ (degradation 4)
  readonly deliveredAt: VirtualTime | null; // when it reaches the participant; null for pull-only
  readonly certainty: Certainty;
  readonly supports: readonly string[]; // atom ids
  readonly contradicts: readonly string[]; // atom ids
}

/** SPEC/04 revision (g): explains why an item is, or is not, in the searchable database (SPEC/19). */
export type ChannelOfUtterance = "talk_group" | "dmo" | "phone" | "face_to_face" | "emergency_call";

export interface TruthAnnotation {
  // NEVER rendered. NEVER crosses the boundary.
  readonly isGroundTruth: boolean;
  readonly isDecoy: boolean;
  readonly contradictionRole?: "premise" | "counter-evidence" | "reconciling";
  readonly relevantInvariants: readonly string[];
  readonly tierRationale?: string; // why this fact sits at this tier
  readonly saidOn?: ChannelOfUtterance; // revision (g)
}

export interface Consequence {
  readonly description: string;
  readonly manifestsAtCycle: CycleIndex;
  readonly measureId: string; // e.g. "t4_discovery.private_doubt"
}

export interface SourceClass {
  readonly id: string;
  readonly label: string; // Finnish, participant-visible
  readonly reliability: SourceReliability; // CONSISTENT across the whole incident
  readonly replyLatency: LatencyDistribution; // for `directed`
}

export interface LatencyDistribution {
  readonly kind: "lognormal";
  readonly medianSeconds: number;
  readonly sigma: number;
  readonly minSeconds: number;
  readonly maxSeconds: number;
}

/**
 * SPEC/25 §3: the fixed topic list of the structured query builder (the MITÄ slot). Generic and
 * identical in every cycle; no category exists for a single load-bearing item.
 */
export type NavCategoryId =
  | "palo" // Palo ja leviäminen
  | "saa" // Sää
  | "yksikot" // Yksiköt ja miehistö
  | "vesi_reitit" // Vesi, tiet ja reitit
  | "maasto" // Maasto ja metsävarat
  | "kohteet" // Kohteet ja väestö
  | "ilma" // Ilma-alukset ja dronet
  | "johto"; // Johto ja ohjeet

export interface InfoAtom {
  readonly id: string; // deterministic: hash(scenarioId, index)
  readonly tier: Tier;
  readonly origin: Origin;
  readonly cycle: CycleIndex; // the cycle it belongs to
  readonly loadBearing: boolean; // if true, `routes` must have all three
  readonly navCategory: NavCategoryId; // SPEC/25 §3 — authored topic, reviewed with the corpus
  readonly routes: Routes;
  readonly record: RecordPayload; // the discriminated union, §4
  readonly provenance: Provenance; // participant-visible
  readonly degradation: readonly Degradation[]; // §5
  readonly retrievalKeys: readonly string[]; // generated, then reviewed
  readonly truth: TruthAnnotation; // analysis only; STRIPPED at the boundary
  readonly consequence?: Consequence; // for load-bearing atoms
}

// ---------------------------------------------------------------------------
// §4 record sub-schemas
// ---------------------------------------------------------------------------

export interface TaskRecord {
  readonly kind: "task_record";
  readonly taskId: string;
  readonly callerAccount: string; // Finnish free text, as given
  readonly firstAddress: string;
  readonly reportedCoord: LatLon | null;
  readonly firstUnitCoord: LatLon | null; // may differ — degradation 11
  readonly initialAssignment: readonly string[]; // unit ids
  readonly taskType: string; // ERICA-style code
}

export interface SituationLogEntry {
  readonly kind: "situation_log";
  readonly entryId: string;
  readonly authorUnitId: string;
  readonly text: string; // Finnish, degraded as authored
  readonly supersedesEntryId?: string; // degradation 10: silent correction
  readonly structuredFieldOverflow?: string; // degradation 12: the discarded remainder
}

export interface UnitStatusRecord {
  readonly kind: "unit_status";
  readonly unitId: string;
  readonly status: "matkalla" | "kohteessa" | "vapautunut" | "ei_tiedossa";
  readonly setAt: VirtualTime; // the age is the point
  readonly position: LatLon | null;
  readonly positionSetAt: VirtualTime | null;
  readonly abandoned: boolean; // degradation 5: not updated since
}

export interface TrafficLogEntry {
  readonly kind: "traffic_log";
  readonly callerId: string;
  readonly calleeId: string;
  readonly group: string; // Virve talkgroup
  readonly startedAt: VirtualTime;
  readonly durationSeconds: number;
  readonly content: string | null; // null = degradation 14, voice-only
}

export interface LateralTrafficEntry {
  // TIER 4. Never pushed, in any condition.
  readonly kind: "lateral_traffic";
  readonly speakerUnitId: string;
  readonly addresseeUnitId: string; // both, so laterality is visible
  readonly at: VirtualTime;
  readonly content: string; // Finnish
  readonly droppedFromChannelSummary: boolean; // authored, per cycle
}

export interface AerialObservation {
  readonly kind: "aerial_observation";
  readonly platform: AirKind;
  readonly platformId: string;
  readonly at: VirtualTime;
  readonly geometry: Polygon | LatLon;
  readonly text: string;
  readonly available: boolean; // false once the platform is grounded
}

export interface ReferenceDatum {
  readonly kind: "reference";
  readonly surface: Extract<RecordSurface, `reference_${string}`>;
  readonly featureId: string;
  readonly fields: Readonly<Record<string, string | number | null>>;
  readonly registerUpdatedAt: string; // ISO date. Accurate, complete, OUT OF DATE
}

export interface WeatherObservation {
  readonly kind: "weather";
  readonly at: VirtualTime;
  readonly windMeanMs: number;
  readonly windGustMs: number;
  readonly windDirectionDeg: number;
  readonly temperatureC: number;
  readonly relativeHumidity: number;
  readonly precipitationMm: number;
  readonly ffmc: number;
  readonly dmc: number;
  readonly dc: number;
  readonly isi: number;
  readonly bui: number;
  readonly fwi: number;
}

/** SPEC/04 revision (g): recorded, machine-transcribed authority talk-group traffic (SPEC/19 §3.5-3.6). */
export interface RadioTrafficRecord {
  readonly kind: "radio_traffic";
  readonly talkGroup: "JOHTO" | "TOIMINTA-1" | "TOIMINTA-2" | "ILMA" | "YHTEISTOIMINTA"; // placeholders, SPEC/19 §2
  readonly startAt: VirtualTime;
  readonly durationS: number;
  readonly speaker: string;
  readonly addressees: readonly string[];
  readonly transcriptFi: string | null; // null = metadata only
  readonly transcriptionConfidence: "low" | "medium" | "high" | null;
  readonly lateral: boolean; // T4 when true
}

export type RecordPayload =
  | TaskRecord
  | SituationLogEntry
  | UnitStatusRecord
  | TrafficLogEntry
  | LateralTrafficEntry
  | AerialObservation
  | ReferenceDatum
  | WeatherObservation
  | RadioTrafficRecord;

// ---------------------------------------------------------------------------
// §5 degradation encoding
// ---------------------------------------------------------------------------

export type DegradationForm =
  | "local_place_name" // 1
  | "unitless_number" // 2
  | "unmarked_hearsay" // 3
  | "typed_not_observed_time" // 4
  | "stale_status" // 5
  | "conflicting_duplicate" // 6
  | "workload_gap" // 7  — a property of a SPAN, see below
  | "implication_no_cause" // 8
  | "ambiguous_silence" // 9  — a property of a SPAN
  | "silent_correction" // 10
  | "dual_location" // 11
  | "field_overflow" // 12
  | "abbreviation_collision" // 13
  | "voice_only"; // 14

export type GapClass = "imprecise" | "misfiled" | "stale" | "workload_gap" | "voice_only" | "never_recorded";

export interface Degradation {
  readonly form: DegradationForm;
  readonly note: string; // what exactly is degraded, for the reviewer
  readonly gapClass: GapClass;
}

/** Forms 7 and 9 are spans, not records. They are authored as absences. */
export interface RecordGap {
  readonly id: string;
  readonly surface: RecordSurface;
  readonly unitId: string | null; // null = the whole log thinned
  readonly from: VirtualTime;
  readonly to: VirtualTime;
  readonly form: "workload_gap" | "ambiguous_silence";
  readonly whatWasHappening: string; // truth-side only; NEVER rendered
}

// ---------------------------------------------------------------------------
// §6 cycles, envelopes, channel — plus SPEC/12 §5, §10 rendering additions
// ---------------------------------------------------------------------------

/** SPEC/12 §10 §5: an observed rate of spread. Data, not projection. A flank with none for a cycle renders the `unknown` badge. */
export interface RateMark {
  readonly id: string;
  readonly cycle: CycleIndex;
  readonly flank: "head" | "north" | "south" | "east" | "west" | "rear";
  readonly anchor: LatLon; // on the reported perimeter
  readonly bearingDeg: number;
  readonly rateMetresPerMinute: number;
  /** A rate judged by eye (fix pass 4): shown as this band, "arvio", instead of the figure (`rateMarkText`). */
  readonly rateBand?: readonly [number, number];
  readonly provenance: Provenance; // source, observedAt, age, certainty
  readonly consistentWithEnvelope: boolean; // TRUTH. Never rendered
}

/**
 * SPEC/18 §6: the portable weather station's reading at the command point, taken at the cycle's
 * start. Direction and MEAN speed only: gusts stay in the weather series, where mechanism M2 is
 * discoverable only by querying it (SPEC/12 §9 cycle 17). Equal in every condition.
 */
export interface CycleWind {
  readonly observedAt: VirtualTime;
  readonly fromDeg: number; // direction the wind blows FROM, degrees true
  readonly meanMs: number;
  readonly sourceFi: string;
}

/**
 * One interaction-log event (SPEC/18 revision (n)): the unit of the incident's traffic corpus.
 * FLAT on purpose — every field a scalar — so the log can be written as JSON Lines, filtered by
 * metadata and vectorised on `content` (Chroma, Qdrant, pgvector and the like accept only flat
 * scalar metadata). No truth: generated from what units and sensors can observe at the time.
 */
export interface InteractionEvent {
  readonly id: string; // "evt.c01.012"
  readonly cycle: number; // the world-state STEP, 1–20 (W1–W5 are −4…0; SPEC/26 §2)
  /**
   * SPEC/26 §6: the map view the event belongs to — 0 = the practice view VP (step W5), 1–14 =
   * V1–V14; null = prologue history (W1–W4), searchable but never pushed.
   */
  readonly session_view: number | null;
  readonly sim_time_s: number; // seconds from the start of step 1 (13:20)
  readonly timestamp: string; // wall clock, "13:22:40"
  readonly actor: string; // "EK11", "DR2", "VD1", "SAA"
  readonly actor_type: ActorType;
  readonly addressee: string | null; // "JOHTO" for reports up; a unit id for lateral traffic; null for feeds
  readonly location: string | null; // sector, "L2-Koillinen"
  readonly place: string | null; // nearest named place, "Kuivakangas"
  readonly lat: number | null;
  readonly lon: number | null;
  readonly event_type: EventType;
  readonly task: string | null; // the actor's task or flight mode at the time
  readonly content: string; // Finnish
  readonly tier: Tier;
  readonly channel: "radio_command" | "radio_lateral" | "sensor_feed" | "ask_unit" | "system_log";
  readonly nav: NavCategoryId;
  readonly lang: "fi";
}

export type ActorType =
  | "fire_team" | "volunteer_brigade" | "forest_fire_unit" | "robot"
  | "drone" | "water_drone" | "helicopter" | "spotter_aircraft" | "weather_station" | "command";

export type EventType =
  | "size_up" | "observation" | "report" | "warning" | "coordination" | "request"
  | "status" | "detection" | "water_drop" | "weather" | "task_update";

/**
 * Airborne platforms. `water_drone` is the study's forward-looking element (SPEC/18 revision (n)):
 * an autonomous heavy-lift drone that scoops water and drops it on the fire, arriving with the
 * reinforcements.
 */
export type AirKind = "drone" | "helicopter" | "fixed_wing" | "water_drone";

/** SPEC/12 §6.5: an airborne platform's reported position and where it is flying this cycle. */
export interface AircraftPosition {
  readonly platformId: string;
  readonly kind: AirKind;
  readonly position: LatLon;
  readonly track: readonly LatLon[];
}

/**
 * What a ground unit is doing this cycle (SPEC/18 revision (m)). A crew on the fire edge works on
 * foot; its vehicle stays where a vehicle can go.
 */
export type UnitTask =
  | "hose_attack" // suppression with water through a hose line from the vehicle
  | "pump_attack" // suppression with a portable pump from natural water (forest-fire unit)
  | "peat_soak" // peat fire: soaking and digging the smouldering bog edge
  | "firebreak" // cutting a fire break with chainsaws ahead of the fire
  | "road_line" // holding a control line on a road: a sprinkler line or pre-laid hose along it, fed from a basin (fix pass 7, 9 Oct 2026; was "firebreak" at a road anchor)
  | "mop_up" // mop-up with hand tools and water behind the fire
  | "hose_laying" // the hose-laying robot extending a line
  | "refill" // vehicle refilling its tank at a water point
  | "water_shuttle" // the tanker carrying water from a water point to the basins at the lines (fix pass 3, 7 Oct 2026)
  | "rest" // crew rest and maintenance at the command point
  | "withdrawn" // pulled back to a road for safety
  | "evacuation" // assisting the police evacuation
  | "staging" // arrived, waiting for a task at the command point
  | "transit" // driving to a new sector
  | "blocked"; // stopped: the route cannot take the vehicle

export interface UnitWork {
  readonly task: UnitTask;
  /** Where the vehicle is when the crew works away from it on foot; null when crew and vehicle are together. */
  readonly vehicle: LatLon | null;
  /** Length of the hose line from the vehicle to the crew, metres; null when no line is laid. */
  readonly hoseM: number | null;
  /**
   * Water in the vehicle's tank at the time the map shows (the step's start), percent — the same
   * tank model the crews quote when asked (`tools/fire-ca/traffic-water.ts`). Null: no tank (the
   * forest-fire unit pumps natural water, the robot carries hose). Absent in bundles before 2 Oct 2026.
   */
  readonly waterPct?: number | null;
}

/**
 * What the fire layers draw in a cycle (SPEC/12 revision 24 Sep (c) §7): observed fire only —
 * reported perimeters, their burnt area, detections — never truth. Field names are the spec's.
 */
export interface FireDisplay {
  /**
   * Earlier reported perimeters, newest first, at most three; `time` is the clock they were reported at ("13:00").
   * Each ring of `geometry` is the outline of one part of the fire then (the main fire first, then any separate
   * front of at least 1 ha), not an outer ring with holes.
   */
  readonly perimeters_past: readonly { readonly time: string; readonly geometry: Polygon }[];
  /**
   * The current reported edge as segments; ring direction is counter-clockwise, so the unburned side is on the right.
   * `uncontained`: the edge advanced since the last report; `contained`: quiet, within about 150 m of a crew working a
   * line there (hose line, pump, fire break, road line, mop-up); `inactive`: quiet, not spreading, no crew (a secured
   * sector or a stretch a crew left) — review fixes (ah), 9 Oct 2026, F2.
   */
  readonly perimeter_current: readonly { readonly status: "uncontained" | "contained" | "inactive"; readonly is_head: boolean; readonly line: readonly LatLon[] }[];
  /** Burned out: the fire as reported one cycle earlier. No severity in the scenario data yet. */
  readonly burnt_area: { readonly geometry: readonly Polygon[]; readonly severity: null };
  /** Burning zone: what burned since the previous report (polygons with holes). */
  readonly burning_zone: readonly Polygon[];
  readonly spot_fires: readonly { readonly position: LatLon; readonly confirmed: boolean; readonly callsign: string }[];
  /** Drone thermal detections; `time` is simulation seconds (0 = start of cycle 1; earlier is negative). */
  readonly detections: readonly { readonly position: LatLon; readonly time: number }[];
}

/** SPEC/12 revision 24 Sep (c) §3: the projection's certainty as the map and the AI answer both state it. */
export type ProjectionCertainty = "likely" | "moderate" | "uncertain";

/**
 * An arrival-time band of the projection: where the fire is projected to arrive between two
 * horizons (0–10, 10–20, 20–30 min). Polygons with holes, so bands never overlap each other or
 * the current fire — the FARSITE / Spark arrival-time shading.
 */
export interface ProjectionBand {
  readonly fromMinutes: number;
  readonly toMinutes: number;
  readonly polygons: readonly Polygon[];
}

export interface Isochrone {
  readonly minutes: number;
  readonly polygon: Polygon;
  readonly detachedParts: readonly Polygon[];
}

/** SPEC/12 §10: disappears (null geometry) once the platform is grounded — absence is the signal. */
export interface SensorFootprint {
  readonly platformId: string;
  readonly cycle: CycleIndex;
  readonly geometry: Polygon | null;
}

/**
 * SPEC/12 §6.2, §10: the participant's own allocation, echoed back on the
 * map in the anticipated-status convention (solid symbol at the reported
 * position, dashed symbol at the assigned sector). No truth field — but a
 * real one must exist only for an asset the participant actually assigned
 * (SPEC/12 §11 `test/render/no-recommendation.spec`); it is never authored
 * scenario content, so it does not appear in `ScenarioContract` itself,
 * unlike `AllocationRecommendation`.
 */
export interface AllocationMark {
  readonly assetId: string;
  readonly fromPosition: LatLon; // solid symbol, last reported
  readonly toSectorId: string; // dashed symbol, assigned
  readonly taskId: string;
  readonly assignedAtCycle: CycleIndex | PracticeViewIndex;
}

/**
 * One map VIEW (SPEC/26 §2): what the participant experiences as a cycle. `index` is the view
 * number (1-14 for the main views); the world-state steps it covers are `steps` consecutive steps
 * starting at step `startsAtVirtual / 1200 + 1`. A merged view (`steps: 2`) shows its first step's
 * map, and its envelope projects to the end of its second step.
 */
export interface CycleSpec {
  readonly index: CycleIndex;
  readonly phase: Phase;
  readonly title: string; // internal; not shown
  readonly startsAtVirtual: VirtualTime; // (first step - 1) * 1200; the practice view (W5) starts at -1200
  /** SPEC/26 §3: how many 20-minute steps the view spans. */
  readonly steps: 1 | 2;
  readonly clockLabel: string; // "14:35", shown on the map
  readonly pushedAtomIds: readonly string[]; // T1, with per-atom delivery offsets
  readonly deliveryOffsetsSeconds: readonly number[]; // parallel array, virtual seconds into the view (>= 1200: a merged view's second step, SPEC/26 §2)
  readonly perimeter: Polygon; // last reported situation
  readonly detachedFronts: readonly Polygon[]; // reported fire detached from `perimeter` (spot fires, the BOG-S front)
  readonly unitPositions: Readonly<Record<string, LatLon>>; // where each unit works (its crew)
  readonly unitWork: Readonly<Record<string, UnitWork>>; // task, vehicle and hose line, same keys
  readonly fire: FireDisplay; // what the fire layers draw (observed only)
  readonly aircraft: readonly AircraftPosition[]; // airborne platforms only; a grounded one is absent
  readonly wind: CycleWind;
  readonly actualPerimeterAtEnd: Polygon; // TRUTH. Resolves the judgement.
  readonly actualDetachedAtEnd: readonly Polygon[]; // TRUTH. Detached fire at the horizon
  readonly probeIds: readonly string[];
  readonly gaps: readonly RecordGap[];
  readonly rateMarks: readonly RateMark[]; // SPEC/12 §5
  readonly sensorFootprints: readonly SensorFootprint[]; // SPEC/12 §6.5, §10
  /** The view's minimum length, in seconds (researcher decision 1 Oct 2026, replacing SPEC/26 §4's
   * locked exploration phase): 120 for a single-step view, 150 for a merged one (`views.ts`). The view
   * ends at the later of this and the participant's confirmation. Always the real value in the
   * contract; a development preview may scale it at run time only, and says so in the log header
   * (`app/session/preview.ts`). */
  readonly minViewSeconds: number;
  /** SPEC/15 §9–§10: the view has a SAGAT freeze. Every view has a decision item (SPEC/26 §4:
   * SPEC/15 §9's decision-free cycles are withdrawn). */
  readonly hasFreeze: boolean;
  /** When the freeze interrupts, in whole seconds into the view (pausing the view's time), or null
   * without a freeze. Pre-planned at build time from the seed, identical for every participant,
   * within [25, minViewSeconds − 20] (`freezeOffsetSecondsFor` in `views.ts`). It interrupts whatever
   * the participant is doing, exploring or mid-decision (decision 1 Oct 2026, superseding SPEC/15
   * §9's "placed before the decision phase, never after a response"). */
  readonly freezeAtSeconds: number | null;
  /**
   * SPEC/30 §5.1 (19 Oct 2026): the freeze comes after the plan is final — at the view's end, after the
   * plan-confidence item, before the next view — instead of at a pre-planned moment (`freezeAtSeconds`
   * is then null). Only with `hasFreeze`; absent (or false) everywhere else. Set from `FREEZE_AT_VIEW_END`.
   */
  readonly freezeAtViewEnd?: boolean;
  /** SPEC/26 §2: in a merged view, the map's units and aircraft at the second step; null in a single-step view. */
  readonly stepBoundary: StepBoundary | null;
}

/**
 * SPEC/26 §2: a merged view shows its first step's map; when the second step's virtual time is
 * reached inside the view, unit and aircraft positions (and the clock) move on to the second
 * step's, so the map agrees with the second step's move messages. The fire, the envelope and the
 * wind reading stay the view's (the wind indicator is read at the start of the view, SPEC/26 §6).
 */
export interface StepBoundary {
  readonly atVirtual: VirtualTime; // the second step's start: startsAtVirtual + 1200
  readonly clockLabel: string;
  readonly unitPositions: Readonly<Record<string, LatLon>>;
  readonly unitWork: Readonly<Record<string, UnitWork>>;
  readonly aircraft: readonly AircraftPosition[];
  readonly sensorFootprints: readonly SensorFootprint[];
  /** The second step's observed rates (SPEC/12 §9's step rules apply to it: none at step 6, a 40-minute-old one at step 9). */
  readonly rateMarks: readonly RateMark[];
}

/** SPEC/26 D3: the practice view's index. Main views are 1-14. */
export type PracticeViewIndex = 0;

/** A view the session shows: a main view or the practice view (same shape, index 0). */
export type ViewSpec = CycleSpec | PracticeView["cycle"];
/** The envelope of a main view or of the practice view. */
export type ViewEnvelope = Envelope | PracticeView["envelope"];
/** A candidate development of a main view or of the practice view. */
export type ViewBranchStatement = BranchStatement | PracticeView["branchStatements"][number];

/**
 * SPEC/26 D3: the practice view VP — step W5 (13:00-13:20), the prologue cut to one view. Not
 * scored, no AI, a short practice freeze. It is index 0 and held apart from `cycles`,
 * `envelopes` and `channelSets`, so no count, flag sequence or base rate ever includes it. Its
 * envelope carries the CA's derived flag for completeness; nothing checks or scores it.
 */
export interface PracticeView {
  readonly cycle: Omit<CycleSpec, "index"> & { readonly index: PracticeViewIndex };
  readonly envelope: Omit<Envelope, "cycle"> & { readonly cycle: PracticeViewIndex };
  /** SPEC/26 §4: the 2-item practice freeze (not scored). */
  readonly freeze: Omit<FreezeSpec, "cycle"> & { readonly cycle: PracticeViewIndex };
  /** The normal decision phase, practised: one course-of-action item (not scored). */
  readonly decisionItem: Omit<DecisionItem, "cycle"> & { readonly cycle: PracticeViewIndex };
  /** Candidate developments for a `fundamentally_wrong` practice judgement (not scored). */
  readonly branchStatements: readonly (Omit<BranchStatement, "cycle"> & { readonly cycle: PracticeViewIndex })[];
  /** The practice SPAM item (5 Oct 2026, `practice-spam.ts`): not scored, no key here. */
  readonly spam?: Omit<ProbeSpec, "cycle"> & { readonly cycle: PracticeViewIndex };
}

// ---------------------------------------------------------------------------
// SPEC/16 §7 — course-of-action decision task, revision (d) shape (one choice
// with confidence per cycle; no alignment-feedback fields).
// ---------------------------------------------------------------------------

export type DecisionAlignment = "aligned" | "against";
export type DecisionSoundness = "sound" | "unsound";

export interface DecisionOption {
  readonly id: string;
  readonly labelFi: string;
  readonly alignment: DecisionAlignment;
  readonly soundness: DecisionSoundness;
}

export interface DecisionItem {
  readonly id: string;
  readonly cycle: CycleIndex;
  readonly promptFi: string;
  readonly options: readonly [DecisionOption, DecisionOption, DecisionOption, DecisionOption];
}

// ---------------------------------------------------------------------------
// SPEC/15 §9–§10 — the SAGAT-style freeze (Type R). (The Haku group's
// own-projection step of SPEC/15 §10.1 is withdrawn, SPEC/15 revision (o).)
// ---------------------------------------------------------------------------

export type FreezeItemLevel = "L1" | "L2" | "L3";

export interface FreezeItemOption {
  readonly id: string;
  readonly labelFi: string;
  readonly correct: boolean; // TRUTH, never rendered
}

export interface FreezeItem {
  readonly id: string;
  readonly level: FreezeItemLevel;
  readonly promptFi: string;
  /** `choice` items only; a `map_point` item has none. */
  readonly options: readonly FreezeItemOption[];
  /**
   * The answer format (2 Oct 2026): `choice` (the default when absent) — one of four options;
   * `map_point` — the participant taps one point on a blank map (basemap only: no fire, no units,
   * no projection), scored by its distance to `mapKey`.
   */
  readonly kind?: "choice" | "map_point";
  /** TRUTH, scoring only (`map_point` items): the key point and the distance within which a tap is correct. */
  readonly mapKey?: { readonly point: LatLon; readonly toleranceM: number };
  /**
   * TRUTH, analysis only (`head_later` items; revision (x), 6 Oct 2026): where the view's projection puts
   * the head at the item's clock. A tap nearer this than `mapKey.point` reads as anchored on the
   * projection (the exploratory projection-reliance measure, `projectionReliance`).
   */
  readonly projectionPoint?: LatLon;
  /**
   * TRUTH, analysis only (fix pass 7, 9 Oct 2026; the projection-direction key, `projectionOptionFor` in `freeze-keys.ts`): on a numeric L3 choice item,
   * the option the view's projection implies at the item's clock, where it differs from the report-keyed answer. An answer with this
   * option reads as projection-anchored (`projectionChoiceReliance`). Never sent to the screen.
   */
  readonly projectionOptionId?: string;
  /**
   * TRUTH, scoring only: the corpus atoms (or for L3, the CA steps' derived facts) the answer key
   * rests on — so an L1 error can be read against whether the key's information had arrived
   * (`freezeItemExposure`). Ids of `InfoAtom`s; empty or absent when the key rests on no single record.
   */
  readonly keyAtomIds?: readonly string[];
  /** The goal the item serves (draft goal set before a GDTA, SPEC/08 amendment 2 Oct): safety | values | containment | resources. */
  /**
   * SPEC/30 §5.3: how an AI answer would state this item's key, for `aiStatedKey` (analysis only, never shown):
   * regular-expression sources, matched case-insensitively against Haku and Thinker answers shown before the
   * freeze, per session language. Absent: the generic band and sector matching applies.
   */
  readonly keyStatements?: { readonly fi: readonly string[]; readonly en: readonly string[] };
  readonly goal?: "safety" | "values" | "containment" | "resources";
}

export interface FreezeSpec {
  readonly cycle: CycleIndex;
  readonly items: readonly FreezeItem[]; // 5 in the real instrument (SPEC/15 §4.4); fewer in preview
}

export type Flag = "holds" | "breach_quantitative" | "breach_categorical";

export interface Envelope {
  readonly cycle: CycleIndex;
  readonly polygon: Polygon; // exactly one. Never nested — see 12 §3
  /**
   * Disjoint parts of the SAME boundary: the projection over a front detached from the main fire
   * (SPEC/18 §7 cycle 12 onwards, the BOG-S front). One threshold, several islands — not a second,
   * nested band, so SPEC/12 §3.1's single boundary still holds. Usually empty.
   */
  readonly detachedParts: readonly Polygon[];
  readonly certainty: Certainty; // rendered on the stroke, not as bands
  readonly attribution: string; // which system produced it, and when
  readonly horizonVirtual: VirtualTime; // the end of the view's last step (20 or 40 min after its start)
  readonly horizonLabel: string; // "ennuste voimassa klo 15:05 saakka"
  readonly flag: Flag; // TRUTH. Never rendered.
  /** The projection as isochrones at ½, 1 and 1½ of the horizon (T+10/20/30, or T+20/40/60 in a merged view); the horizon one is `polygon`, the scored boundary. */
  readonly isochrones: readonly Isochrone[];
  /** The same projection as arrival-time bands between the isochrones. */
  readonly bands: readonly ProjectionBand[];
  /** TRUTH, scoring only — never shown (SPEC/12 revision 24 Sep (c) §7). Derived from `flag`. */
  readonly accuracy_label: "correct" | "partly" | "incorrect";
  readonly breachGeometry?: Polygon; // TRUTH. Where it fails.
  readonly containmentToleranceMetres: number; // declared, used in scoring
  readonly isOmissionCycle: boolean;
}

/** Optional feature, SPEC/08 §7 — decision deferred to pilot. Defined so the type exists if adopted. */
export interface RevisionEnvelope {
  readonly cycle: CycleIndex;
  readonly polygon: Polygon;
  readonly flag: Flag;
}

/** Closed vocabulary of 6-8, fixed before the study. Not currently blocking: SPEC/03 revision (g) — the channel is unused while the AI is pull-only. */
export type SituationCategory = string & { readonly __brand: "SituationCategory" };

export interface ChannelSignal {
  readonly category: SituationCategory;
  readonly urgency: 0 | 1 | 2 | 3; // orthogonal to category
  readonly certainty: Certainty;
  readonly attribution: readonly string[]; // named sources
  readonly quiet: boolean; // explicit all-clear
  readonly text: string; // from the closed template set only
  readonly derivedFromAtomIds: readonly string[]; // CI: all must exist
}

export interface ChannelSignalSet {
  readonly cycle: CycleIndex;
  readonly emitAtOffsetSeconds: number; // fixed offset into the working period
  readonly signals: readonly ChannelSignal[];
  readonly trafficSummary: string; // the T4 compression
  readonly trafficSummaryOmitsAtomIds: readonly string[]; // AUTHORED. Not incidental.
  readonly restatesIntent: boolean; // phase B only
  readonly alignmentFlag?: "aligned" | "diverging" | "unknown";
}

export interface DutyOfficerMessage {
  readonly cycle: CycleIndex;
  readonly at: VirtualTime;
  readonly text: string; // Finnish
  readonly isStrategicGuidance: boolean; // true exactly once, at the hinge
  readonly expectsReply: boolean;
}

// ---------------------------------------------------------------------------
// §7 allocation and branches
// ---------------------------------------------------------------------------

export interface Sector {
  readonly id: string;
  readonly label: string;
  readonly geometry: Polygon;
}

/** Crews ("pelastusyksikko", "sailioauto", "maastoyksikko") and the drone teams' assets ("drone", "vesidrooni", "robotti"). */
export type AssetType = "pelastusyksikko" | "sailioauto" | "maastoyksikko" | "helikopteri" | "drone" | "vesidrooni" | "robotti" | "johtoauto";

export interface Asset {
  readonly id: string; // "EK11", "HELI1", "DRONE1"
  readonly label: string;
  readonly type: AssetType;
  /** The first view in which the asset is on scene; 0 = already in the practice view (`allocation.ts`). */
  readonly availableFromCycle: CycleIndex | PracticeViewIndex;
  readonly availableUntilCycle: CycleIndex | null;
  /** Views in which the asset is on scene but cannot be tasked (a drone with every battery empty, `allocation.ts`). */
  readonly unavailableInViews?: readonly CycleIndex[];
}

export interface TaskOption {
  readonly id: string;
  readonly label: string;
  readonly appliesToTypes: readonly string[];
}

export interface Allocation {
  readonly assignments: Readonly<
    Record<
      string /* assetId */,
      {
        readonly sectorId: string;
        readonly taskId: string;
      }
    >
  >;
}

export interface AllocationScore {
  readonly allocationKey: string; // canonical sorted serialisation
  readonly perBranch: Readonly<
    Record<
      string /* branchId */,
      {
        readonly viable: boolean;
        readonly robust: boolean;
        readonly safe: boolean; // crew exposure. SCORED SEPARATELY.
        readonly optionsForeclosed: readonly string[];
      }
    >
  >;
}

export interface AllocationSpace {
  readonly sectors: readonly Sector[];
  readonly assets: readonly Asset[];
  readonly tasks: readonly TaskOption[];
  readonly viability: readonly AllocationScore[]; // pre-computed, 20-60 allocations
}

export interface Branch {
  readonly id: string;
  readonly label: string;
  readonly divergesAtCycle: CycleIndex;
  readonly variedFactor: "weather" | "discrete_event" | "resource";
  readonly description: string;
  readonly perimeterByCycle: Readonly<Record<number, Polygon>>;
}

/**
 * SPEC/03 revision (d), SPEC/04 revision (d): the per-cycle Finnish
 * phrasing of a candidate development, presented after a `fundamentally_wrong`
 * judgement (HANDOFF §5.3). `branchId` is this statement's own id — distinct
 * from the ~5 scenario-level {@link Branch} entries it is drawn from; there
 * are up to 4 statements x 25 cycles, far more than 5 branches.
 */
export interface BranchStatement {
  readonly branchId: string;
  readonly cycle: CycleIndex | WarmupIndex;
  readonly statementFi: string;
  /** TRUTH. Exactly one true per cycle, none at the omission cycle. Stripped before render (I4). */
  readonly truth: BranchStatementTruth;
}

export interface BranchStatementTruth {
  /**
   * Whether this statement is what actually develops by the view's horizon, derived from the CA
   * (`branch-statements.ts`, 5 Oct 2026); null = not scored (no defensible truth for the view).
   */
  readonly isActualDevelopment: boolean | null;
}

// ---------------------------------------------------------------------------
// §8 probes — amendment (Type S / PROBING_ONLINE) + revision (d) (branch choice)
// ---------------------------------------------------------------------------

export type ProbeType = "R" | "J" | "F" | "U" | "S"; // S = SPAM, online (amendment); E (expectation marking) withdrawn with H6, 6 Oct 2026
export type ProbeMode = "PROBING_VISIBLE" | "PROBING_BLANKED" | "ONLINE"; // amendment

export interface LocalisedOption {
  readonly id: string;
  readonly fi: string;
}

export type ResponseSpec =
  | { readonly kind: "categorical"; readonly options: readonly LocalisedOption[] }
  | { readonly kind: "numeric"; readonly min: number; readonly max: number; readonly step: number; readonly unit: string }
  | { readonly kind: "confidence"; readonly min: 0; readonly max: 100 }
  | { readonly kind: "map_point" }
  /**
   * V13's closed area item (revision (ai), 9 Oct 2026; replaces the open free-text Type U): "anything
   * you are unsure about or would check?" yes/no, then — only on yes — which parts of the picture
   * (any number). The options' order is drawn once from the scenario seed (the same for everyone) at the session (`option-order.ts`), the
   * `fixedLastIds` kept last in their given order; the ids are language-neutral.
   */
  | { readonly kind: "area_check"; readonly followUpPrompt: string; readonly options: readonly LocalisedOption[]; readonly fixedLastIds: readonly string[] }
  | { readonly kind: "containment_three_way" }; // see 08 §3.2

export interface ProbeSpec {
  readonly id: string;
  readonly type: ProbeType;
  readonly mode: ProbeMode; // blanking is a probe property
  readonly cycle: CycleIndex | WarmupIndex; // amendment
  readonly orderWithinCycle: number;
  readonly invariantName: string; // must exist in `invariants`
  readonly prompt: string; // Finnish
  readonly response: ResponseSpec;
  readonly offsetInWorkingPeriodMs?: number; // required iff type === "S"
  // (readyTimeoutMs withdrawn, revision (ag), 9 Oct 2026: the SPAM ready prompt does not expire.)
  readonly answerTimeoutMs?: number; // S only, default 60000 (revision (ag))
  readonly collectsConfidence: boolean; // true for R, J, S
  readonly contentKind: "situation" | "intent";
  readonly saLevel?: 1 | 2 | 3; // required for R and S
  /** F, U (5 Oct 2026): where in the view the session delivers the probe (`demo-probes.ts`, placement decisions). */
  readonly delivery?: ProbeDelivery;
}

/**
 * Where a visible probe (Type U; E and F withdrawn 6 Oct 2026) is delivered in its view (readiness round,
 * 5 Oct 2026): `view_seconds` — at a fixed moment on the view's clock, interrupting
 * whatever the participant is doing (as a freeze does); `after_view` — after the view has ended.
 * The view's clock stands still while one is open (SPEC/15 r.12's rule for the freeze).
 */
export type ProbeDelivery =
  | { readonly at: "view_seconds"; readonly seconds: number }
  | { readonly at: "after_view" };

export interface ProbeSchedule {
  readonly probes: readonly ProbeSpec[];
}

/** The three-way containment response. The binary is DERIVED, never collected. */
export type ContainmentJudgement = "holds" | "partly_wrong" | "fundamentally_wrong";

/**
 * The "fundamentally wrong" follow-up (researcher decision 2 Oct 2026, SPEC/08 amendment): the
 * direction in which the fire will go beyond the projection (eight compass sectors on the
 * north-up map, or all round) and how far beyond its edge. Replaces the one-tap fixed-shape area,
 * whose size and shape came from the tool, not the participant. Quick (~5 s), no motor skill in
 * the answer, scoreable against the actual perimeter, and a light act before a freeze.
 */
export const CORRECTION_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "all"] as const;
export type CorrectionDirection = (typeof CORRECTION_DIRECTIONS)[number];
/** How far beyond the projection's edge, metres. */
export const CORRECTION_REACHES = ["under_200m", "200_500m", "over_500m"] as const;
export type CorrectionReach = (typeof CORRECTION_REACHES)[number];
export interface StructuredCorrection {
  readonly direction: CorrectionDirection;
  readonly reach: CorrectionReach;
}
export function isStructuredCorrection(value: unknown): value is StructuredCorrection {
  const c = value as Partial<StructuredCorrection> | null;
  return !!c && (CORRECTION_DIRECTIONS as readonly string[]).includes(c.direction as string) && (CORRECTION_REACHES as readonly string[]).includes(c.reach as string);
}

/** SPEC/04 revision (d): starts unset; submission requires non-null. */
export type ConfidenceValue = number | null;

export interface ContainmentResponse {
  readonly judgement: ContainmentJudgement;
  readonly confidence: ConfidenceValue; // 0-100, or null until the participant interacts
  readonly breachPoint?: LatLon; // required iff partly_wrong
  readonly correction?: StructuredCorrection; // required iff fundamentally_wrong (2 Oct 2026; was a drawn polygon)
  readonly selectedBranchId?: string | "none_of_these"; // only after fundamentally_wrong
  readonly branchPresentedOrder?: readonly string[]; // four authored + "none_of_these" last
}

// ---------------------------------------------------------------------------
// §11 session configuration — revision (d): Cell replaces guidanceMode
// ---------------------------------------------------------------------------

export interface SessionConfig {
  readonly condition: ConditionId;
  readonly participantCode: string;
  readonly scenario: ScenarioContract;
  readonly pointerTrackHz: 0 | 10; // 0 = off (default)
  readonly idleThresholdSeconds: 5;
  readonly hingePauseSeconds: 300;
  readonly allowResume: true; // see 05 §7
  readonly echelon: Echelon;
  readonly warmupEnabled: true;
  readonly cell: Cell;
}

// ---------------------------------------------------------------------------
// Well-known constants referenced by the validator (SPEC/03 §4.2, §6.2, §10; SPEC/02 §3)
// ---------------------------------------------------------------------------

/**
 * SPEC/26 §3: the exact flag sequence of the fourteen main views (V1–V14; the practice view is
 * not scored). Seven holds, three quantitative, four categorical. Phase A: H Q H C H C H;
 * phase B: H C H C Q H Q. Replaces SPEC/03 §4.2's 20-cycle sequence, which survives as the
 * per-step authoring check in `tools/fire-ca/scenario-18.ts`.
 */
export const CANONICAL_FLAG_SEQUENCE: readonly Flag[] = [
  "holds", "breach_quantitative", "holds", "breach_categorical", "holds", "breach_categorical", "holds", // V1-V7
  "holds", "breach_categorical", "holds", "breach_categorical", "breach_quantitative", "holds", "breach_quantitative", // V8-V14
];

/** SPEC/03 §6.2: containment base rate target band. */
export const CONTAINMENT_HOLDS_MIN = 0.45;
export const CONTAINMENT_HOLDS_MAX = 0.55;

/**
 * SPEC/02 §3: per-tier absolute count bands (the table's literal "Count"
 * column — unambiguous, unlike deriving a "share" fraction would be, since
 * the total corpus size is itself only a range, 290-400).
 */
/**
 * SPEC/02 §3 as revised 24 Sep 2026 (researcher's decision): a real incident generates far more
 * traffic than the first design's 290–400 items — especially at the start and whenever the fire
 * moves — so the bands were raised. Total 600–900.
 *
 * T1's floor is 180, approved by the researcher on 25 Sep 2026 (SPEC/26 §6; supersedes the
 * SPEC/02 24 Sep floor of 200 for the 14-view session): SPEC/26 §6 caps pushed volume at 6–20 per
 * main view and moves routine items of over-full views to T2, and the 14-view corpus sat at 201
 * before that thinning.
 *
 * Corpus revision of 1 Oct 2026 (review items 3, 4, 6, 7): drone products and coverage lines,
 * water-supply log lines, situation-specific lateral traffic and crew requests grow the corpus to
 * about 900–1300 records. Pushed volume is still capped per view (`view-traffic.ts`
 * `PUSH_CAP_PER_VIEW`), so the growth lands in T2 and T4: their ceilings rise to 520 and 200.
 * T1 and T3 bands are unchanged.
 */
export const TIER_COUNT_BANDS: Readonly<Record<Tier, { readonly min: number; readonly max: number }>> = {
  T1_pushed: { min: 180, max: 320 },
  T2_system: { min: 220, max: 520 },
  T3_person: { min: 110, max: 200 },
  T4_lateral: { min: 70, max: 200 },
};

/** SPEC/02 §3.2: the three named load-bearing T4 items. */
export const LOAD_BEARING_T4_IDS = ["t4.ember_warning", "t4.private_doubt", "t4.water_state"] as const;

/**
 * The designed content events' authored atoms (`designed-events.ts`): fault F7 (SPEC/02 revision (o)
 * §5) and the rekindle arc (SPEC/26 §5). Load-bearing: `gridRecord`, `planted` and `objection`
 * (with `t4.private_doubt`, the rekindle's echo, among the T4 ids above).
 */
export const DESIGNED_EVENT_IDS = {
  gridRecord: "f7.grid_record", // step 6, the grid operator: line live, de-energising requested
  planted: "f7.planted_record", // step 8, the command-post operator: "110 kV linja jännitteetön, vahvistettu." FALSE
  heliLineClearance: "f7.heli_line_clearance", // step 9, HELI1 keeps clear of the line
  inHand: ["rekindle.in_hand.ky21", "rekindle.in_hand.vpk", "rekindle.in_hand.log"], // step 10, L3 "in hand"
  objection: "rekindle.objection", // step 10, VPK on TOIMINTA-2
  overruled: "rekindle.overruled", // step 10, KY21 (the L3 sector leader) on TOIMINTA-2
} as const;
