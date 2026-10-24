/**
 * SPEC/07 §2.3–§2.5: the pointer, drawer and query-capture record details, split out of
 * `record-kinds.ts` (which re-exports them and pairs each with its kind) to keep that file short.
 * The same principles hold here: raw events only, nothing derived, nothing banned by SPEC/07 §3.
 */

import type { CycleIndex, LatLon, VirtualTime } from "../engine/primitives.js";
import type { PracticeViewIndex } from "../scenario/types.js";

// ---------------------------------------------------------------------------
// §2.3 Pointer and element interaction
// ---------------------------------------------------------------------------

export type ClickTargetKind =
  | "bubble" | "unit" | "drone" | "envelope" | "sector" | "map_background" | "drawer_control" | "drawer_tab"
  | "probe_option" | "result_item" | "channel_signal" | "rail_item" | "slider" | "status_strip_item" | "other"
  // SPEC/07 revision (al): a stack badge of unit markers (`targetId`: the members' marker keys joined with "+").
  | "unit_stack";

export interface ClickDetail {
  readonly targetKind: ClickTargetKind;
  readonly targetId: string | null;
  readonly mapCoord?: LatLon;
  readonly viewportRef: number; // seq of the last viewport_changed
  readonly pointerType: "mouse" | "pen" | "touch";
  readonly button: number;
}
export interface ElementEnterLeaveDetail {
  readonly targetKind: ClickTargetKind;
  readonly targetId: string | null;
}
export interface LayerToggledDetail {
  readonly layerId: string;
  readonly newState: boolean;
}
/**
 * The live map's camera (SPEC/07 §2.3, emitted from revision (al), 10 Oct 2026): throttled to 4 Hz while the map moves,
 * plus one record when it settles, one at each view start (the map's pixel size then) and one on a resize. `bbox` is
 * the visible bounds. The fields after `bbox` are absent in logs before revision (al) (none emitted the kind).
 */
export interface ViewportChangedDetail {
  readonly centre: LatLon;
  readonly zoom: number;
  readonly bbox: { readonly south: number; readonly north: number; readonly west: number; readonly east: number };
  /** Always 0: rotation is off (`dragRotate: false`, pinch does not rotate). */
  readonly bearing?: 0;
  /** The map's size in CSS pixels. */
  readonly mapPx?: { readonly width: number; readonly height: number };
  /** The view on screen (0 = VP). */
  readonly view?: number;
  /**
   * `move`: while moving (throttled); `settle`: the move ended; `view_start`: a new view opened on the Palo frame
   * (and the map's first frame); `resize`: the map's size changed.
   */
  readonly cause?: "move" | "settle" | "view_start" | "resize";
  /**
   * What moved the map (on `move` and `settle`): `wheel` (mouse wheel or trackpad), `drag`, `touch` (pinch or
   * one-finger pan), `keyboard`, `preset` (a zoom button), `frame` (the opening frame refitted to a new size).
   */
  readonly input?: "wheel" | "drag" | "touch" | "keyboard" | "preset" | "frame";
}
/** A tap on the memory-check map (`FreezeMap`), with its camera then (revision (al)). */
export interface FreezeMapPickDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly itemId: string;
  readonly point: LatLon;
  readonly zoom: number;
  readonly centre: LatLon;
  readonly mapPx: { readonly width: number; readonly height: number };
}
/** Which fire labels the live map shows after a placement, when the set changes (revision (al)). Keys: `spot:US2`, `iso:20`, `past:0`. */
export interface MapLabelsPlacedDetail {
  readonly view: number;
  readonly shown: readonly string[];
  readonly hidden: readonly string[];
}
/** The "please enlarge the window" cover shown or removed (revision (al)); the window's inner size in CSS pixels. */
export interface WindowSizeWarningDetail {
  readonly shown: boolean;
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
}
// ---------------------------------------------------------------------------
// SPEC/28 §5 — the TAK shell's tools (13 Oct 2026), logged through `logMapUse` like the map's own records
// ---------------------------------------------------------------------------

/** The TAK shell's side panes (one open at a time; `app/render/ui/tak/`). `indexed_search` is the demonstration's third search tab. */
export type TakPaneId = "overlays" | "contacts" | "geochat" | "video" | "range_bearing" | "haku" | "thinker" | "indexed_search";
/**
 * A pane opened or closed. `cause`: `toolbar` — its toolbar button; `close_button` — the pane's ×; `replaced` — another pane
 * opened in its place; `default` — the GeoChat pane the shell opens each time it mounts (the classic shell's always-visible
 * message log); `tour` — the guided tour opened it (the Thinker practice); `unmount` — closed because the shell unmounted
 * (the training screen, the session's end, a resume), so every opening has its closing (SPEC/07 revision (av)).
 *
 * `overlays`: only on the mount's `default` opening — the Overlay Manager's full state then (every layer, keys sorted), so
 * the map's layers can be rebuilt from the log alone (this record, then the `tak_overlay_toggled` records after it).
 */
export interface TakPaneDetail {
  readonly pane: TakPaneId;
  readonly view: number;
  readonly cause: "toolbar" | "close_button" | "replaced" | "default" | "tour" | "unmount";
  readonly overlays?: Readonly<Record<TakOverlayLayer, boolean>>;
}
/** A contact chosen in the Contacts pane (the map is centred on it, a participant move). `uid` follows SPEC/28 §3: `TAKSIM-UNIT-<id>`, `TAKSIM-AIR-<id>`, `TAKSIM-SELF`. */
export interface TakContactSelectedDetail {
  readonly uid: string;
  readonly view: number;
}
/** The Overlay Manager's layers. The projection and the current perimeter are not among them: they cannot be hidden (SPEC/28 §5). */
export type TakOverlayLayer = "labels" | "footprints" | "past_perimeters" | "rate_marks" | "plan_marks";
export interface TakOverlayToggledDetail {
  readonly layer: TakOverlayLayer;
  readonly on: boolean;
  readonly view: number;
}
/** A Range & Bearing measurement: two points, the ellipsoidal distance (m, WGS84) and the true initial bearing (°) from the first to the second. */
export interface TakRbMeasuredDetail {
  readonly from: LatLon;
  readonly to: LatLon;
  readonly metres: number;
  readonly bearingDeg: number;
  readonly view: number;
}
/** A GeoChat room shown (`app/tak/geochat.ts`); `all` is "All Chat Rooms". */
export interface TakChatRoomViewedDetail {
  readonly room: "all" | "ground" | "air" | "command" | "support";
  readonly view: number;
}
/** A drone's video tile shown: `pane` — on screen when the Video pane opened or the drone took off while it was open; `select` — enlarged by a click. */
export interface TakVideoViewedDetail {
  readonly platformId: string;
  readonly view: number;
  readonly cause: "pane" | "select";
}

export interface TextScrolledDetail {
  readonly elementId: string;
  readonly maxScrollFraction: number; // 0-1
}
export interface PointerTrackDetail {
  readonly x: number;
  readonly y: number;
  /** SPEC/30 §5.4 (19 Oct 2026, the first emitter): the view the sample belongs to and the viewport size it is relative to. */
  readonly cycle?: number;
  readonly viewportPx?: readonly [number, number];
}
/** SPEC/30 §5.4: which text field a `query_focus` / `query_first_keystroke` / `query_edit` belongs to. */
export type QueryField = "haku_search" | "haku_chat" | "thinker_chat" | "nav";
export interface QueryFieldDetail {
  readonly field?: QueryField;
  readonly cycle?: number;
}

// ---------------------------------------------------------------------------
// §2.4 Drawers
// ---------------------------------------------------------------------------

/** SPEC/07 revision (j): there is no radio drawer — the participant cannot transmit. */
export type DrawerId = "haku" | "tekoaly";
export interface DrawerOpenedDetail {
  readonly drawer: DrawerId;
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly latencyFromCycleStartMs: number;
  readonly openingRoute: "button" | "keyboard";
}
export interface DrawerClosedDetail {
  readonly drawer: DrawerId;
  readonly dwellMs: number;
  readonly closingRoute: "button" | "map_click" | "escape" | "replaced_by_another_drawer";
}
export interface DrawerTabChangedDetail {
  readonly drawer: DrawerId;
  readonly fromTab: string;
  readonly toTab: string;
}
export interface DrawerStateAtCycleBoundaryDetail {
  readonly openDrawer: DrawerId | null;
}

// ---------------------------------------------------------------------------
// §2.5 Query capture
// ---------------------------------------------------------------------------

export interface QueryEditDetail {
  readonly count: number; // NOT per-keystroke content (SPEC/07 §3)
  /** SPEC/30 §5.4: the field (absent in logs before the first emitter, 19 Oct 2026). */
  readonly field?: QueryField;
  readonly cycle?: number;
}
/**
 * A free-text query (Haku's free-text field, the Thinker cells; final review 6 Oct 2026: it was not
 * logged at all). `reformulationChainIndex` counts the free-text queries of the view from 0.
 * `compositionDurationMs` is absent: the screen does not time the typing (no clock in the render layer).
 * `resultAtomIds` is what was shown, in rank order (the exposure route `haku`, `freeze-measures.ts`);
 * `language` the search's language (SPEC/14 revision (v)); `view` and `phase` as the builder's.
 */
export interface QuerySubmittedDetail {
  readonly text: string; // verbatim — personal data, see SPEC/07 §2.5
  readonly charCount: number;
  readonly compositionDurationMs?: number;
  readonly queryId: string;
  readonly reformulationChainIndex: number;
  readonly view?: number;
  readonly language?: "fi" | "en";
  readonly resultAtomIds?: readonly string[];
  readonly phase?: "exploration" | "decision";
}
export interface QueryClearedDetail {
  readonly text: string; // as typed, abandoned without submission
}
export interface RetrievalMissDetail {
  readonly queryId: string;
  readonly text: string;
}
export interface ResultItemDetail {
  readonly atomId: string;
}
export interface TrafficRequestedDetail {
  readonly selectorKind: "byUnit" | "byGroup" | "byTimeWindow";
  readonly selector: { readonly byUnit?: string; readonly byGroup?: string; readonly byTimeWindow?: readonly [VirtualTime, VirtualTime] };
}
/** SPEC/25 §7: one slot of the query builder changed. The sequence of these is the search path. */
export interface NavSlotChangedDetail {
  readonly slot: "category" | "source" | "window";
  readonly value: string | null; // null source = "Kaikki"
}
/** SPEC/25 §7: a builder query submitted, and exactly which items were shown (exposure, not a measure). */
export interface NavQuerySubmittedDetail {
  readonly queryId: string;
  readonly category: string;
  readonly sourceId: string | null;
  readonly window: "latest" | "last_cycle" | "whole_incident";
  readonly resultAtomIds: readonly string[];
  readonly phase: "exploration" | "decision"; // SPEC/15 §9, SPEC/07 revision (i)
}
/**
 * The Thinker question, logged at submission (`substitutive` only) — SPEC/15 §10.2, SPEC/07
 * revisions (i) and (q). The answer follows as `ai_chat_answer_received` with the same `queryId`.
 */
/**
 * Which chat a question went to (D3, 8 Oct 2026): `haku` — the Haku tab's structured chat
 * (`/api/thinker`, every cell) — or `open_thinker` — the AI condition's Open Thinker
 * (`/api/thinker-open`). Absent in older logs: the structured Thinker (then the AI condition's only).
 */
export type AiChatTool = "haku" | "open_thinker";

export interface AiChatQuerySubmittedDetail {
  readonly queryId: string;
  readonly text: string;
  readonly view: number;
  readonly virtualTimeS: number;
  readonly phase: "exploration" | "decision";
  readonly tool?: AiChatTool;
  /**
   * SPEC/30 §4: the question was a suggested-question chip, submitted as shown — the guide's (`tool: "open_thinker"`) or, since 0.16.0
   * (revision (bf), 24 Oct 2026), the Haku group's (`tool: "haku"`).
   */
  readonly viaChip?: true;
}
/**
 * SPEC/07 revision (q): Thinker's answer — the exposure record for H9 and H10. Retrieved ids with
 * their fused scores in rank order, the model id, the prompt hash, the full answer, the latency
 * (the proxy's, or the browser's wait when it fell back locally) and the fallback flag. The fused
 * score is logged as `fusedScore`: a retrieval rank score, not a correctness value (§3 bans `score`).
 */
export interface AiChatAnswerReceivedDetail {
  readonly queryId: string;
  readonly text: string;
  readonly view: number;
  readonly virtualTimeS: number;
  readonly retrieved: readonly { readonly id: string; readonly fusedScore: number }[];
  /** `hybrid_fi_fallback` (SPEC/14 revision (v), demonstration only): an English question retrieved with the Finnish treatment. */
  readonly retrievalMode: "hybrid" | "lexical_only" | "hybrid_fi_fallback";
  readonly modelId: string;
  readonly promptHash: string;
  readonly answer: { readonly vastaus: string; readonly perusteet: string; readonly varmuus: string; readonly muuttaisi: string };
  readonly latencyMs: number | null;
  readonly fallback: boolean;
  readonly fallbackReason: string | null;
  readonly phase: "exploration" | "decision";
  /**
   * Phase B round 2 (D2; 0.9.4, unreleased): which prompt answered — `standard` (the four parts) or
   * `intent` (the strategy-guided prompt: cell `reasoning_intent`, V8–V14).
   */
  readonly promptVariant: "standard" | "intent";
  /** The `intent` variant's fifth field, in full; absent for `standard`. `ei_arvioitu` = no model answered. */
  readonly linjaus?: { readonly tila: "sopii" | "ei_sovi" | "ei_liity" | "ei_arvioitu"; readonly perustelu: string };
  /** `linjaus.tila` as its own field, so exposure ("received ei_sovi at V10") is coded without parsing the answer. */
  readonly linjausTila?: "sopii" | "ei_sovi" | "ei_liity" | "ei_arvioitu";
  /** SPEC/14 revision (v): the language retrieval ran in (English passages, tokeniser and index, or Finnish). */
  readonly retrievalLanguage?: "fi" | "en";
  /** D3 (8 Oct 2026): which chat answered. The Open Thinker's plain-text answer is in `answer.vastaus`, the other fields empty. */
  readonly tool?: AiChatTool;
  /**
   * D6 (8 Oct 2026): the Open Thinker's fit verdict on the directive, extracted server-side from the
   * answer text (`aiVerdictOf`): `in_line`, `departs`, `not_covered`, or null when the answer states none.
   * Absent for Haku, for a fallback, and in older logs. A covariate, never an outcome.
   */
  readonly aiVerdict?: "in_line" | "departs" | "not_covered" | null;
  /**
   * Revision (al), 10 Oct 2026: the verdict of each option line of the answer (`aiVerdictsOf`: a line's
   * last verdict phrase decides), the analysis value; `aiVerdict` (the earliest phrase) is kept for
   * back-compatibility. Null where no verdict is coded (phase A, withdrawal/evacuation); absent for
   * Haku, a fallback and older logs.
   */
  readonly aiVerdicts?: readonly { readonly line: number; readonly verdict: "in_line" | "departs" | "not_covered" }[] | null;
  /**
   * SPEC/14 revision (aq), 11 Oct 2026: the structured Open Thinker answer's kind (`lookup`, `options`, `safety`), its exact option
   * verdicts (`departure_justifiable` kept apart from `departs`) and its premise statuses; absent for Haku, a fallback and older logs.
   */
  readonly aiKind?: "lookup" | "options" | "safety";
  readonly aiVerdictsExact?: readonly ("fits" | "departs" | "departure_justifiable" | "not_covered" | null)[];
  readonly aiPremiseStatuses?: readonly ("supported" | "contradicted" | "not_addressed")[];
  /** Revision (ar), 11 Oct 2026: the authored premises' ids (P1...), in the order of `aiPremiseStatuses`. Absent in (aq) logs, whose premises were free text and are not comparable. */
  readonly aiPremiseIds?: readonly string[];
  /**
   * Format 0.11.0 (SPEC/07 (ay), SPEC/31 §3.6, parity P-2): the ids of the step's latest records the Open Thinker's digest put in the
   * model's context without a search (`latestDigest`, SPEC/14 ab.4) — empty for Haku's chat, which has no digest. Absent in older logs,
   * from an older proxy and on the browser's local fallback (no model was asked). The proxy's own log carries the same ids as `digest`.
   */
  readonly digestAtomIds?: readonly string[];
  /**
   * Format 0.11.0: the question's best matches among the current step's records that reached the model beside `retrieved`
   * (`recentMatches`, SPEC/14 ah.2), both tools. Absent as `digestAtomIds`; the proxy's log carries them as `recent`.
   */
  readonly recentAtomIds?: readonly string[];
}
