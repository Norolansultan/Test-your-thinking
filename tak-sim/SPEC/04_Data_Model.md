# 04 — Data model

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). New document. It closes the largest gap in the previous set: record sub-schemas, tier and reachability fields, degradation encoding and allocation scoring were specified in prose and existed in no schema.

> **Changelog**
> - **25 Sep 2026 (p)** — `cycleCount` becomes 14 plus a practice view; per-view step span (`26` §7).
> - **23 Sep 2026 (j)** — radio removed (`02` revision (j)): cell `radio` → `haku`; `ask_unit` and `request_traffic` routes unused; no load-bearing atom may be unrecorded. See the revision at the end.
> - **17 Sep 2026 (g)** — radio transcript and metadata record fields; routes for the two groups in use.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Probe type S and online mode; confidence on recall items; warm-up cycles; guidance mode and echelon in session configuration; decision types (`16` §7); information packages (`14` §3.2).

**This file is authoritative over every prose description of data elsewhere.** All types are TypeScript, compiled in strict mode with `exactOptionalPropertyTypes` on. Everything is `readonly` at rest; nothing in the scenario bundle is mutated at runtime.

---

## 1. Primitives

```ts
/** Virtual seconds from scenario start. The only time any logic reads. */
type VirtualTime = number & { readonly __brand: "VirtualTime" };

/** Monotonic, gapless record index within a session. */
type Seq = number & { readonly __brand: "Seq" };

type EpsgCode = number & { readonly __brand: "EPSG" };
const WGS84         = 4326 as EpsgCode;
const ETRS_TM35FIN  = 3067 as EpsgCode;   // Finnish national CRS
const WEB_MERCATOR  = 3857 as EpsgCode;

type AltitudeDatum = "MSL" | "WGS84_ELLIPSOID" | "AGL";

interface LatLon { readonly lat: number; readonly lon: number; }   // always WGS84
type Ring    = readonly LatLon[];                                   // closed, CCW
type Polygon = readonly Ring[];                                     // [outer, ...holes]

interface GeoExtent {
  readonly crs: EpsgCode;          // WGS84 for authored content
  readonly south: number; readonly north: number;
  readonly west: number;  readonly east: number;
}

type ConditionId = "directed" | "assistive" | "substitutive";
type CycleIndex  = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20;
type Phase       = "A" | "B";

type Certainty =
  | { readonly kind: "confirmed" }
  | { readonly kind: "probable";  readonly basis: string }
  | { readonly kind: "uncertain"; readonly basis: string }
  | { readonly kind: "unknown" };          // MUST be representable and renderable

type Tier = "T1_pushed" | "T2_system" | "T3_person" | "T4_lateral";
type Origin = "below" | "lateral" | "above" | "sensor";
type SourceReliability = "known-good" | "unproven" | "degraded";
```

**Note on `Certainty`.** `unknown` is a value, never `undefined`, never an empty string, never a missing field. `unknown`, `absent`, `zero` and `stale` are four different things and each has its own visual form (`06` §3).

---

## 2. The scenario contract

A scenario cannot be constructed unless it declares what it probes and what counts as correct. Construction throws on every violation listed below, so there is no partially-valid scenario: a scenario either passes every check or does not exist.

```ts
interface ScenarioContract {
  readonly id: string;                    // stable, human-readable, never reused
  readonly version: string;               // semver; any content change bumps it
  readonly seed: bigint;                  // u64
  readonly constructs: readonly string[]; // what this scenario probes
  readonly validity: ValidityClaim;       // mandatory
  readonly extent: GeoExtent;
  readonly cycleCount: 20;                // literal; the engine is not variable-length
  readonly virtualSecondsPerCycle: 1200;  // literal: twenty minutes
  readonly startVirtualClock: string;     // "HH:MM" shown to the participant
  readonly invariants: readonly ExpectedInvariant[];  // the answer key
  readonly contradiction: ContradictionMarker;        // exactly one
  readonly omission: OmissionMarker;                  // exactly one
  readonly probeSchedule: ProbeSchedule;
  readonly cycles: readonly CycleSpec[];              // length 20
  readonly atoms: readonly InfoAtom[];
  readonly envelopes: readonly Envelope[];            // length 20
  readonly channelSets: readonly ChannelSignalSet[];  // length 20
  readonly dutyOfficerMessages: readonly DutyOfficerMessage[];
  readonly branches: readonly Branch[];               // >= 5
  readonly allocationSpace: AllocationSpace;
  readonly hinge: HingeSpec;
  readonly sourceClasses: readonly SourceClass[];
}
```

**Construction throws on:**

- empty `id`;
- empty `constructs`;
- zero invariants;
- any invariant with a non-finite expected value or negative tolerance;
- not exactly one contradiction;
- not exactly one omission;
- missing or incomplete validity claim;
- missing probe schedule;
- missing extent;
- `cycles.length !== 20`;
- `envelopes.length !== 20`;
- `channelSets.length !== 20`;
- fewer than five branches;
- any atom whose `tier` is `T1_pushed` without a delivery time;
- any load-bearing atom with fewer than three routes.

```ts
interface ExpectedInvariant {
  readonly name: string;          // e.g. "containment.cycle_04"
  readonly expected: number | string | boolean;
  readonly tolerance: number;     // >= 0; 0 for categorical
  readonly unit?: string;         // "m", "deg", "m/min" — documentation, not logic
}

interface ValidityClaim {
  readonly represents: readonly string[];
  readonly doesNotRepresent: readonly string[];
  readonly authoredBy: string;
  readonly reviewedBy: readonly string[];      // domain reviewers, named
  readonly sourceBasis: readonly string[];     // incidents, doctrine, data drawn on
  readonly knownDivergences: readonly string[];// where it is deliberately unrealistic
}
```

`knownDivergences` must contain at minimum:

- the deliberate breach-rate choice;
- the fire magnitude relative to Finnish experience;
- the fact that the `directed` responder is simulated rather than a person.

CI asserts all three are present by tag.

```ts
interface ContradictionMarker {
  readonly id: string;
  readonly cycle: CycleIndex;                      // 18
  readonly premiseAtomId: string;                  // the aerial report
  readonly counterAtomId: string;                  // the ground report
  readonly reconcilingAtomId: string;              // the T4 traffic that explains it
  readonly subtlety: "low" | "medium" | "high";    // pilot selects among three
  readonly detectionProbeId: string;               // the open uncertainty probe
  readonly backupProbeId: string;                  // the forced-choice item
}

interface OmissionMarker {
  readonly id: string;
  readonly cycle: CycleIndex;                      // 12
  readonly mechanism: "M1_shower" | "M2_gusts" | "M3_fuel_boundary" | "M4_spotting";
  readonly outsideEveryEnvelope: true;             // literal; asserted in CI
  readonly developmentAtomIds: readonly string[];
}

interface HingeSpec {
  readonly afterCycle: 10;
  readonly guidanceMessageId: string;
  readonly pauseSeconds: 300;                      // real time, participant-dismissible
  readonly intentStatement: string;                // Finnish; restated by the channel
  readonly alignmentRules: readonly AlignmentRule[];  // how allocations are scored
}

interface AlignmentRule {
  readonly id: string;
  readonly appliesToSectors: readonly string[];
  readonly alignedTasks: readonly string[];
  readonly misalignedTasks: readonly string[];
}
```

---

## 3. Information atoms

Every piece of authored content the participant can ever encounter is an `InfoAtom`. The tier determines routing; the record sub-schema determines rendering.

```ts
interface InfoAtom {
  readonly id: string;                 // deterministic: hash(scenarioId, index)
  readonly tier: Tier;
  readonly origin: Origin;
  readonly cycle: CycleIndex;          // the cycle it belongs to
  readonly loadBearing: boolean;       // if true, `routes` must have all three
  readonly routes: Routes;
  readonly record: RecordPayload;      // the discriminated union, §4
  readonly provenance: Provenance;     // participant-visible
  readonly degradation: readonly Degradation[];  // §5
  readonly retrievalKeys: readonly string[];     // generated, then reviewed
  readonly truth: TruthAnnotation;     // analysis only; STRIPPED at the boundary
  readonly consequence?: Consequence;  // for load-bearing atoms
}
```

### 3.1 Routes — the reachability rule made checkable

```ts
interface Routes {
  readonly directed:    Route | null;  // non-null required if loadBearing
  readonly assistive:   Route | null;
  readonly substitutive:Route | null;
}

type Route =
  | { readonly kind: "pushed" }                                    // T1
  | { readonly kind: "ask_unit";     readonly unitId: string }     // T3, T4
  | { readonly kind: "ask_duty_officer" }
  | { readonly kind: "request_traffic"; readonly selector: TrafficSelector }  // T4
  | { readonly kind: "browse";       readonly surface: RecordSurface }        // T2
  | { readonly kind: "free_text";    readonly exampleQueries: readonly string[] }
  | { readonly kind: "channel";      readonly signalSetCycle: CycleIndex };

type RecordSurface =
  | "situation_log" | "traffic_log" | "unit_status"
  | "reference_stand" | "reference_road" | "reference_water"
  | "reference_maintenance" | "task_record" | "weather_series";

interface TrafficSelector {
  readonly byUnit?: string;
  readonly byGroup?: string;
  readonly byTimeWindow?: readonly [VirtualTime, VirtualTime];
}
```

**CI assertion:** `atoms.filter(a => a.loadBearing).every(a => a.routes.directed && a.routes.assistive && a.routes.substitutive)`.

### 3.2 Provenance and truth are separate types

```ts
interface Provenance {                     // participant-visible
  readonly sourceId: string;               // unit designator or sensor id
  readonly sourceClassId: string;          // -> SourceClass
  readonly sourceReliability: SourceReliability;
  readonly observedAt: VirtualTime;        // when it happened
  readonly recordedAt: VirtualTime;        // when it was typed — may differ (degradation 4)
  readonly deliveredAt: VirtualTime | null;// when it reaches the participant; null for pull-only
  readonly certainty: Certainty;
  readonly supports: readonly string[];    // atom ids
  readonly contradicts: readonly string[]; // atom ids
}

interface TruthAnnotation {                // NEVER rendered. NEVER crosses the boundary.
  readonly isGroundTruth: boolean;
  readonly isDecoy: boolean;
  readonly contradictionRole?: "premise" | "counter-evidence" | "reconciling";
  readonly relevantInvariants: readonly string[];
  readonly tierRationale?: string;         // why this fact sits at this tier
}

interface Consequence {
  readonly description: string;
  readonly manifestsAtCycle: CycleIndex;
  readonly measureId: string;              // e.g. "t4_discovery.private_doubt"
}

/** Rendering types defined in `12_Map_Symbology_and_Projection.md` §10 and
 *  reproduced there in full: RateMark, AllocationMark, SensorFootprint, and
 *  AllocationRecommendation (defined, and asserted empty in this study). */

interface SourceClass {
  readonly id: string;
  readonly label: string;                  // Finnish, participant-visible
  readonly reliability: SourceReliability; // CONSISTENT across the whole incident
  readonly replyLatency: LatencyDistribution;  // for `directed`
}

interface LatencyDistribution {
  readonly kind: "lognormal";
  readonly medianSeconds: number;
  readonly sigma: number;
  readonly minSeconds: number;
  readonly maxSeconds: number;
}
```

`supports` and `contradicts` act as graph edges between atoms. They let the contradiction be authored as a **relation** rather than hidden in prose, and that is what makes detection scorable automatically.

**Latency matching (`02` §1.1) is asserted over `SourceClass.replyLatency` against the `assistive` retrieval latency model. Both are seeded and deterministic.**

---

## 4. Record sub-schemas

The seven record types from `03` §7.1, typed. Every atom's `record` is one of these.

```ts
type RecordPayload =
  | TaskRecord | SituationLogEntry | UnitStatusRecord | TrafficLogEntry
  | LateralTrafficEntry | AerialObservation | ReferenceDatum | WeatherObservation;

interface TaskRecord {
  readonly kind: "task_record";
  readonly taskId: string;
  readonly callerAccount: string;          // Finnish free text, as given
  readonly firstAddress: string;
  readonly reportedCoord: LatLon | null;
  readonly firstUnitCoord: LatLon | null;  // may differ — degradation 11
  readonly initialAssignment: readonly string[];   // unit ids
  readonly taskType: string;               // ERICA-style code
}

interface SituationLogEntry {
  readonly kind: "situation_log";
  readonly entryId: string;
  readonly authorUnitId: string;
  readonly text: string;                   // Finnish, degraded as authored
  readonly supersedesEntryId?: string;     // degradation 10: silent correction
  readonly structuredFieldOverflow?: string;  // degradation 12: the discarded remainder
}

interface UnitStatusRecord {
  readonly kind: "unit_status";
  readonly unitId: string;
  readonly status: "matkalla" | "kohteessa" | "vapautunut" | "ei_tiedossa";
  readonly setAt: VirtualTime;             // the age is the point
  readonly position: LatLon | null;
  readonly positionSetAt: VirtualTime | null;
  readonly abandoned: boolean;             // degradation 5: not updated since
}

interface TrafficLogEntry {
  readonly kind: "traffic_log";
  readonly callerId: string;
  readonly calleeId: string;
  readonly group: string;                  // Virve talkgroup
  readonly startedAt: VirtualTime;
  readonly durationSeconds: number;
  readonly content: string | null;         // null = degradation 14, voice-only
}

interface LateralTrafficEntry {            // TIER 4. Never pushed, in any condition.
  readonly kind: "lateral_traffic";
  readonly speakerUnitId: string;
  readonly addresseeUnitId: string;        // both, so laterality is visible
  readonly at: VirtualTime;
  readonly content: string;                // Finnish
  readonly droppedFromChannelSummary: boolean;  // authored, per cycle
}

interface AerialObservation {
  readonly kind: "aerial_observation";
  readonly platform: "drone" | "helicopter" | "fixed_wing";
  readonly platformId: string;
  readonly at: VirtualTime;
  readonly geometry: Polygon | LatLon;
  readonly text: string;
  readonly available: boolean;             // false once the platform is grounded
}

interface ReferenceDatum {
  readonly kind: "reference";
  readonly surface: Extract<RecordSurface, `reference_${string}`>;
  readonly featureId: string;
  readonly fields: Readonly<Record<string, string | number | null>>;
  readonly registerUpdatedAt: string;      // ISO date. Accurate, complete, OUT OF DATE
}

interface WeatherObservation {
  readonly kind: "weather";
  readonly at: VirtualTime;
  readonly windMeanMs: number;
  readonly windGustMs: number;
  readonly windDirectionDeg: number;
  readonly temperatureC: number;
  readonly relativeHumidity: number;
  readonly precipitationMm: number;
  readonly ffmc: number; readonly dmc: number; readonly dc: number;
  readonly isi: number;  readonly bui: number; readonly fwi: number;
}
```

---

## 5. Degradation encoding

The fourteen clumsiness forms are data, not prose. Each authored record declares which forms it carries. CI can then check how the forms are distributed, and analysis can control for them.

```ts
type DegradationForm =
  | "local_place_name"        // 1
  | "unitless_number"         // 2
  | "unmarked_hearsay"        // 3
  | "typed_not_observed_time" // 4
  | "stale_status"            // 5
  | "conflicting_duplicate"   // 6
  | "workload_gap"            // 7  — a property of a SPAN, see below
  | "implication_no_cause"    // 8
  | "ambiguous_silence"       // 9  — a property of a SPAN
  | "silent_correction"       // 10
  | "dual_location"           // 11
  | "field_overflow"          // 12
  | "abbreviation_collision"  // 13
  | "voice_only";             // 14

interface Degradation {
  readonly form: DegradationForm;
  readonly note: string;               // what exactly is degraded, for the reviewer
  readonly gapClass: GapClass;
}

type GapClass =
  | "imprecise" | "misfiled" | "stale"
  | "workload_gap" | "voice_only" | "never_recorded";

/** Forms 7 and 9 are spans, not records. They are authored as absences. */
interface RecordGap {
  readonly id: string;
  readonly surface: RecordSurface;
  readonly unitId: string | null;      // null = the whole log thinned
  readonly from: VirtualTime;
  readonly to: VirtualTime;
  readonly form: "workload_gap" | "ambiguous_silence";
  readonly whatWasHappening: string;   // truth-side only; NEVER rendered
}
```

**The gap is authored, not emergent.** The eighty-one minutes of silence during the crown run is a `RecordGap`. It is declared in the bundle, validated in CI, and rendered as nothing at all. If the gap is left to chance, it will not happen.

---

## 6. Cycles, envelopes, channel

```ts
interface CycleSpec {
  readonly index: CycleIndex;
  readonly phase: Phase;
  readonly title: string;                       // internal; not shown
  readonly startsAtVirtual: VirtualTime;        // (index-1) * 1200
  readonly clockLabel: string;                  // "14:35", shown on the map
  readonly pushedAtomIds: readonly string[];    // T1, with per-atom delivery offsets
  readonly deliveryOffsetsSeconds: readonly number[];  // parallel array, real seconds
  readonly perimeter: Polygon;                  // last reported situation
  readonly unitPositions: Readonly<Record<string, LatLon>>;
  readonly actualPerimeterAtEnd: Polygon;       // TRUTH. Resolves the judgement.
  readonly probeIds: readonly string[];
  readonly gaps: readonly RecordGap[];
}

type Flag = "holds" | "breach_quantitative" | "breach_categorical";

interface Envelope {
  readonly cycle: CycleIndex;
  readonly polygon: Polygon;              // exactly one. Never nested — see 12 §3
  readonly certainty: Certainty;          // rendered on the stroke, not as bands
  readonly attribution: string;           // which system produced it, and when
  readonly horizonVirtual: VirtualTime;         // always the next cycle boundary
  readonly horizonLabel: string;                // "ennuste voimassa klo 15:05 saakka"
  readonly flag: Flag;                          // TRUTH. Never rendered.
  readonly breachGeometry?: Polygon;            // TRUTH. Where it fails.
  readonly containmentToleranceMetres: number;  // declared, used in scoring
  readonly isOmissionCycle: boolean;
}

interface RevisionEnvelope {                    // optional feature, `08` §7
  readonly cycle: CycleIndex;
  readonly polygon: Polygon;
  readonly flag: Flag;
}

type SituationCategory = string & { readonly __brand: "SituationCategory" };
// Closed vocabulary of 6-8, fixed before the study. BLOCKING: see 11 §1.3.

interface ChannelSignal {
  readonly category: SituationCategory;
  readonly urgency: 0 | 1 | 2 | 3;              // orthogonal to category
  readonly certainty: Certainty;
  readonly attribution: readonly string[];      // named sources
  readonly quiet: boolean;                      // explicit all-clear
  readonly text: string;                        // from the closed template set only
  readonly derivedFromAtomIds: readonly string[];  // CI: all must exist
}

interface ChannelSignalSet {
  readonly cycle: CycleIndex;
  readonly emitAtOffsetSeconds: number;         // fixed offset into the working period
  readonly signals: readonly ChannelSignal[];
  readonly trafficSummary: string;              // the T4 compression
  readonly trafficSummaryOmitsAtomIds: readonly string[];  // AUTHORED. Not incidental.
  readonly restatesIntent: boolean;             // phase B only
  readonly alignmentFlag?: "aligned" | "diverging" | "unknown";
}

interface DutyOfficerMessage {
  readonly cycle: CycleIndex;
  readonly at: VirtualTime;
  readonly text: string;                        // Finnish
  readonly isStrategicGuidance: boolean;        // true exactly once, at the hinge
  readonly expectsReply: boolean;
}
```

**CI assertions on the channel:**

- every `derivedFromAtomIds` entry resolves to a real atom;
- no signal's `derivedFromAtomIds` includes both the contradiction's premise and counter atoms with a `conflict` category;
- `trafficSummaryOmitsAtomIds` at the three load-bearing T4 cycles includes the load-bearing atom;
- `quiet` sets appear at the authored all-clear cadence.

---

## 7. Allocation and branches

```ts
interface AllocationSpace {
  readonly sectors: readonly Sector[];
  readonly assets: readonly Asset[];
  readonly tasks: readonly TaskOption[];
  readonly viability: readonly AllocationScore[];  // pre-computed, 20-60 allocations
}

interface Sector { readonly id: string; readonly label: string; readonly geometry: Polygon; }

interface Asset {
  readonly id: string;                            // "EK11", "HELI1", "DRONE1"
  readonly label: string;
  readonly type: "pelastusyksikko" | "sailioauto" | "maastoyksikko"
               | "helikopteri" | "drone" | "johtoauto";
  readonly availableFromCycle: CycleIndex;
  readonly availableUntilCycle: CycleIndex | null;
}

interface TaskOption { readonly id: string; readonly label: string; readonly appliesToTypes: readonly string[]; }

interface Allocation {
  readonly assignments: Readonly<Record<string /*assetId*/, {
    readonly sectorId: string; readonly taskId: string;
  }>>;
}

interface AllocationScore {
  readonly allocationKey: string;                 // canonical sorted serialisation
  readonly perBranch: Readonly<Record<string /*branchId*/, {
    readonly viable: boolean;
    readonly robust: boolean;
    readonly safe: boolean;                       // crew exposure. SCORED SEPARATELY.
    readonly optionsForeclosed: readonly string[];
  }>>;
}

interface Branch {
  readonly id: string;
  readonly label: string;
  readonly divergesAtCycle: CycleIndex;
  readonly variedFactor: "weather" | "discrete_event" | "resource";
  readonly description: string;
  readonly perimeterByCycle: Readonly<Record<number, Polygon>>;
}
```

**A robust-but-unsafe allocation is a distinct and reportable outcome.** Safety is not folded into viability.

---

## 8. Probes

> **[SUPERSEDED 2026-09-17]** `ProbeType`, `ProbeMode` and `ProbeSpec` are extended in the amendment below.

```ts
type ProbeType = "R" | "J" | "E" | "F" | "U";
type ProbeMode = "PROBING_VISIBLE" | "PROBING_BLANKED";

interface ProbeSchedule { readonly probes: readonly ProbeSpec[]; }

interface ProbeSpec {
  readonly id: string;
  readonly type: ProbeType;
  readonly mode: ProbeMode;                       // blanking is a probe property
  readonly cycle: CycleIndex;
  readonly orderWithinCycle: number;
  readonly invariantName: string;                 // must exist in `invariants`
  readonly prompt: string;                        // Finnish
  readonly response: ResponseSpec;
  readonly counterbalanceGroup?: "A" | "B";       // expectation-marking order
}

type ResponseSpec =
  | { readonly kind: "categorical"; readonly options: readonly LocalisedOption[] }
  | { readonly kind: "numeric"; readonly min: number; readonly max: number;
      readonly step: number; readonly unit: string }
  | { readonly kind: "confidence"; readonly min: 0; readonly max: 100 }
  | { readonly kind: "map_point" }
  | { readonly kind: "map_polygon"; readonly maxVertices: number }
  | { readonly kind: "free_text"; readonly maxChars: number }
  | { readonly kind: "containment_three_way" };   // see 08 §3.2

interface LocalisedOption { readonly id: string; readonly fi: string; }

/** The three-way containment response. The binary is DERIVED, never collected. */
type ContainmentJudgement = "holds" | "partly_wrong" | "fundamentally_wrong";

interface ContainmentResponse {
  readonly judgement: ContainmentJudgement;
  readonly confidence: number;                    // 0-100
  readonly breachPoint?: LatLon;                  // required iff partly_wrong
  readonly correction?: StructuredCorrection;     // required iff fundamentally_wrong (2 Oct 2026; was correctedProjection: Polygon, see `08` amendment)
}
// StructuredCorrection = { direction: "N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"|"all"; reach: "under_200m"|"200_500m"|"over_500m" }
```

---

## 9. The render boundary

**Invariant I4 in type form.** Nothing on the truth side may be reachable from the render side.

```ts
/** Everything the render layer may ever see. */
interface RenderableAtom {
  readonly id: string;
  readonly record: RecordPayload;
  readonly provenance: Provenance;
  readonly degradationVisible: readonly DegradationForm[];  // only what is inferable
}

/** The only function permitted to cross. Exhaustive, total, and unit-tested. */
declare function toRenderable(atom: InfoAtom): RenderableAtom;

/** Compile-time guard: RenderableAtom must not structurally admit TruthAnnotation. */
type AssertNoTruth<T> = T extends { truth: unknown } ? never : T;
type _Check = AssertNoTruth<RenderableAtom>;   // must not be `never`
```

Three guards enforce the boundary:

- **Runtime guard:** a frozen deep-clone at the boundary, plus a property-presence assertion in development builds.
- **Static guard:** the conditional type above.
- **Integration test:** walks the live render tree and asserts that no object graph reachable from it contains any key of `TruthAnnotation`.

All three exist; none alone is sufficient.

---

## 10. The log

The log is append-only JSONL, one file per session, with a self-describing header.

```ts
interface LogHeader {
  readonly formatVersion: string;
  readonly sessionId: string;                     // pseudonymous
  readonly participantCode: string;               // pseudonymous
  readonly condition: ConditionId;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly seed: string;                          // bigint as decimal string
  readonly bundleHash: string;                    // content hash of the asset bundle
  readonly appVersion: string;
  readonly startedAtIso: string;                  // wall clock, annotation only
  readonly userAgent: string;
  readonly viewport: { readonly w: number; readonly h: number;
                       readonly dpr: number };
  readonly counterbalance: { readonly expectationOrder: "A" | "B" };
}

interface LogRecord {
  readonly seq: Seq;                // gapless from 0
  readonly tVirtual: VirtualTime;
  readonly tWallOffsetMs: number;   // annotation only; never read by logic
  readonly kind: RecordKind;
  readonly detail: unknown;         // narrowed per kind; see 07
}
```

`RecordKind` and every `detail` shape are enumerated in `07_Telemetry_and_Logging.md` §2. That enumeration is the complete list; adding a kind is a format-version bump.

---

## 11. Session configuration

> **[SUPERSEDED 2026-09-17]** `SessionConfig` is extended in the amendment below.

```ts
interface SessionConfig {
  readonly condition: ConditionId;
  readonly participantCode: string;
  readonly scenario: ScenarioContract;
  readonly pointerTrackHz: 0 | 10;      // 0 = off (default)
  readonly idleThresholdSeconds: 5;
  readonly hingePauseSeconds: 300;
  readonly allowResume: true;           // see 05 §7
}
```

Condition assignment is **not** made by the client. The client receives its condition from the allocation service at session start and records it in the header. Block randomisation with stratification is described in `09` §2.

---

## Amendment 2026-09-17

```ts
// §1 addition
type WarmupIndex = `W${1 | 2 | 3 | 4 | 5}`;     // prologue cycles, before main cycle 1

// §8 replacement of the two unions
type ProbeType = "R" | "J" | "E" | "F" | "U" | "S";        // S = SPAM, online
type ProbeMode = "PROBING_VISIBLE" | "PROBING_BLANKED" | "ONLINE";

// ProbeSpec additions
interface ProbeSpecAdditions {
  readonly cycle: CycleIndex | WarmupIndex;
  readonly offsetInWorkingPeriodMs?: number;   // required iff type === "S"
  // readyTimeoutMs withdrawn 9 Oct 2026 (`27` revision (ag)): the SPAM ready prompt does not expire
  readonly answerTimeoutMs?: number;           // S only, default 60000 (`27` (ag))
  readonly collectsConfidence: boolean;        // true for R, J, S, E
  readonly contentKind: "situation" | "intent";
  readonly saLevel?: 1 | 2 | 3;                  // required for R and S
}

// §11 SessionConfig additions
interface SessionConfigAdditions {
  readonly guidanceMode: "once" | "via_ai";    // "via_ai" only possible when condition === "substitutive"
  readonly echelon: "command" | "supervisory" | "crew";
  readonly warmupEnabled: true;
}
```

Decision types are defined in `16` §7 and information packages in `14` §3.2; both are authoritative as written there until merged here.

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

```ts
// Conditions and cells
type ConditionId = "directed" | "ai";             // id for the AI group still open (11 §7.1); "ai" is a placeholder
type Cell = "no_ai" | "ai_once" | "ai_via_ai";    // SessionConfig.cell; replaces guidanceMode

// Type J additions (handoff)
interface ContainmentResponseAdditions {
  readonly selectedBranchId?: string | "none_of_these";   // only after fundamentally_wrong
  readonly branchPresentedOrder?: readonly string[];      // four authored + "none_of_these" last
}
interface BranchStatement {
  readonly branchId: string;
  readonly cycle: CycleIndex | WarmupIndex;
  readonly statementFi: string;
}
// Correction polygon: minVertices 3, maxVertices 12

// Confidence
type ConfidenceValue = number | null;             // null until the participant interacts; submission requires non-null
```

`ChannelSignalSet` and `AllocationRecommendation` remain defined and are never populated in this study.

```ts
// BranchStatement addition (17 Sep 2026)
interface BranchStatementTruth {
  readonly isActualDevelopment: boolean;   // TRUTH. Exactly one true per cycle, none at the omission cycle. Stripped before render (I4).
}
```

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

```ts
type ConditionId = "directed" | "assistive" | "substitutive";   // Radio · LLM · LLM reasoning (replaces the "ai" placeholder)
type Cell = "radio" | "llm" | "reasoning_once" | "reasoning_intent";
```

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

```ts
type ConditionId = "directed" | "assistive" | "substitutive";  // "assistive" defined but unused in this study
type Cell = "radio" | "reasoning_once" | "reasoning_intent";
```
CI asserts no session is configured with `assistive`.

## Revision 17 Sep 2026 (g)

```ts
// Radio traffic records (see 19 §3.5–3.6)
interface RadioTrafficRecord {
  readonly talkGroup: "JOHTO" | "TOIMINTA-1" | "TOIMINTA-2" | "ILMA" | "YHTEISTOIMINTA"; // placeholders
  readonly startAt: VirtualTime;
  readonly durationS: number;
  readonly speaker: string;
  readonly addressees: readonly string[];
  readonly transcriptFi: string | null;                 // null = metadata only
  readonly transcriptionConfidence: "low" | "medium" | "high" | null;
  readonly lateral: boolean;                            // T4 when true
}
type ChannelOfUtterance = "talk_group" | "dmo" | "phone" | "face_to_face" | "emergency_call";
// TruthAnnotation addition: saidOn: ChannelOfUtterance  (explains why an item is or is not in the database)
```

Routes in use:

- `directed` → `browse` | `request_traffic` | `ask_unit`
- `substitutive` → `free_text` | `ask_unit`

`assistive` and the `channel` route are unused. CI checks two things:

- every load-bearing atom has a non-null route for both conditions in use;
- load-bearing transcripts have `transcriptionConfidence` of medium or high.

---

## Revision 23 Sep 2026 (h) — navigation category

`InfoAtom` gains a required field, `navCategory: NavCategoryId`, the authored topic used by the query builder (`25` §3). `NavCategoryId` is one of `"palo" | "saa" | "yksikot" | "vesi_reitit" | "maasto" | "kohteet" | "ilma" | "johto"`. The canonical type is in `app/scenario/types.ts`. Scenario-validator check #16 (`navigation-coverage`) enforces `25` §6.

---

## Revision 23 Sep 2026 (j) — no asking

Follows `02` revision (j). **Supersedes revision (g)'s "Routes in use" and revision (f)'s `Cell` type.**

```ts
type ConditionId = "directed" | "assistive" | "substitutive";  // ids unchanged; "directed" now means Haku (no AI)
type Cell = "haku" | "reasoning_once" | "reasoning_intent";   // "radio" renamed "haku"
```

Routes in use:

- `directed` → `browse` (the query builder, `25`)
- `substitutive` → `browse` | `free_text`

The `ask_unit` and `request_traffic` route kinds stay in the `Route` union so a later study can reinstate them. **CI asserts that no atom in this study uses them.** `SourceClass.replyLatency` is unused; every query surface uses the fixed 2.5 s of `25`.

`RadioTrafficRecord` is unchanged: recorded talk-group traffic is still data.

**New CI assertions:**

- no load-bearing atom has `truth.saidOn` in `"dmo" | "phone" | "face_to_face"` unless a separate recorded atom carries the same fact (`19` revision (b) R.1);
- every load-bearing atom has a non-null route for `directed` and `substitutive`, and neither route is `ask_unit` or `request_traffic`.

**ValidityClaim.** The divergence "the `directed` responder is simulated rather than a person" (§3) is obsolete: there is no responder. Replace it with **"the participant cannot transmit; information is limited to recorded and pushed sources"**.

---

## Revision 25 Sep 2026 (p) — views

`ScenarioContract.cycleCount: 20` becomes 14 main views plus one practice view. Each `CycleSpec` gains `steps: 1 | 2` (its span in 20-minute world-state steps) and `explorationSeconds` of 90 or 120. The flag sequence type holds the 14 flags of `26` §3.
