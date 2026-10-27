/**
 * A scripted session that emits every single `RecordKind` at least once —
 * SPEC/10_Build_Plan_and_Acceptance.md M4: "`test/telemetry/coverage.spec`
 * drives a scripted session and asserts every record kind in `07` §2 is
 * emitted at least once with every required field." TypeScript enforces
 * "every required field" at each call site below (a missing field is a
 * compile error, per `TelemetryEvent`'s per-kind detail shapes); this
 * script's job is making sure every kind is actually exercised at least
 * once, so the coverage test's job is checking that against the full
 * enumeration.
 */

import { asVirtualTime } from "../../app/engine/primitives.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const HEADER: LogHeader = {
  formatVersion: "0.1.0",
  sessionId: "scripted-session",
  participantCode: "scripted-participant",
  condition: "directed",
  scenarioId: "scripted-scenario",
  scenarioVersion: "0.1.0",
  seed: "1",
  bundleHash: "scripted-bundle",
  appVersion: "0.1.0",
  startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "scripted-session-harness",
  viewport: { w: 1280, h: 800, dpr: 1 },
  counterbalance: { expectationOrder: "A" },
  cell: "radio",
  echelon: "command",
};

const T0 = asVirtualTime(0);

const EVENTS: readonly TelemetryEvent[] = [
  // §2.1
  { kind: "session_started", detail: HEADER },
  { kind: "preflight_result", detail: { benchmarkScore: 90, viewport: { w: 1280, h: 800, dpr: 1 }, refusalReason: null } },
  { kind: "briefing_advanced", detail: { screenId: "briefing.1", dwellMs: 4000 } },
  { kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } },
  { kind: "cycle_end", detail: { cycle: 1, totalRealDurationMs: 180000 } },
  { kind: "hinge_pause_start", detail: { pauseSeconds: 300 } },
  { kind: "hinge_pause_end", detail: { realDurationMs: 120000, dismissedEarly: true } },
  { kind: "state_transition", detail: { from: "RUNNING", to: "FREEZING", trigger: "freeze" } },
  { kind: "fault", detail: { faultClass: "storage_failure" } },
  { kind: "fault_resolved", detail: { faultClass: "storage_failure", elapsedWallClockGapMs: 5000 } },
  { kind: "window_blur", detail: {} },
  { kind: "window_focus", detail: {} },
  { kind: "idle_start", detail: {} },
  { kind: "idle_end", detail: {} },
  { kind: "frame_stats", detail: { cycle: 1, medianFrameTimeMs: 16, longTaskCount: 0 } },
  { kind: "session_completed", detail: {} },
  { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 60000, cycleReplayed: 3 } },
  { kind: "phase_entered", detail: { phase: "phase_a" } },

  // §2.2
  { kind: "bubble_available", detail: { atomId: "atom.1", mapPosition: { lat: 60.8, lon: 27.0 }, tier: "T1_pushed", sourceId: "EK11" } },
  { kind: "envelope_revealed", detail: { cycle: 1, envelopeId: "envelope.cycle_1" } },
  { kind: "channel_signal_emitted", detail: { cycle: 1, signals: [{ category: "fire_behaviour", urgency: 1, certainty: { kind: "probable", basis: "aggregated" }, attribution: ["EK11"], quiet: false, text: "placeholder signal" }], trafficSummary: "placeholder summary", restatesIntent: false } },
  { kind: "duty_officer_message_delivered", detail: { messageId: "duty.1", isStrategicGuidance: false } },
  { kind: "probe_presented", detail: { probeId: "probe.j.cycle_1", type: "J", mode: "PROBING_VISIBLE", optionIds: ["holds", "partly_wrong", "fundamentally_wrong"] } },
  { kind: "retrieval_returned", detail: { queryId: "q.1", packageIds: ["pkg.1"], packageTypes: ["situation"], scores: [0.9], intentLineShown: false } },
  { kind: "traffic_returned", detail: { requestId: "req.2", selector: { byUnit: "EK12" }, entryIds: ["traffic.1"] } },

  // §2.3
  { kind: "click", detail: { targetKind: "bubble", targetId: "atom.1", viewportRef: 0, pointerType: "mouse", button: 0 } },
  { kind: "element_enter", detail: { targetKind: "rail_item", targetId: "atom.1" } },
  { kind: "element_leave", detail: { targetKind: "rail_item", targetId: "atom.1" } },
  { kind: "layer_toggled", detail: { layerId: "layer.hotspots", newState: false } },
  { kind: "viewport_changed", detail: { centre: { lat: 60.8, lon: 27.0 }, zoom: 12, bbox: { south: 60.6, north: 61.0, west: 26.7, east: 27.6 }, bearing: 0, mapPx: { width: 920, height: 450 }, view: 1, cause: "settle", input: "wheel" } },
  { kind: "text_scrolled", detail: { elementId: "report.1", maxScrollFraction: 1 } },
  { kind: "pointer_track", detail: { x: 512, y: 300 } },

  // §2.4
  { kind: "drawer_opened", detail: { drawer: "haku", cycle: 1, latencyFromCycleStartMs: 5000, openingRoute: "button" } },
  { kind: "drawer_closed", detail: { drawer: "haku", dwellMs: 12000, closingRoute: "escape" } },
  { kind: "drawer_tab_changed", detail: { drawer: "haku", fromTab: "situation_log", toTab: "traffic_log" } },
  { kind: "drawer_state_at_cycle_boundary", detail: { openDrawer: null } },

  // §2.5
  { kind: "query_focus", detail: {} },
  { kind: "query_first_keystroke", detail: {} },
  { kind: "query_edit", detail: { count: 2 } },
  { kind: "query_submitted", detail: { text: "pohjoisreuna tilanne", charCount: 20, compositionDurationMs: 4000, queryId: "q.1", reformulationChainIndex: 0 } },
  { kind: "query_cleared", detail: { text: "abandoned query" } },
  { kind: "retrieval_miss", detail: { queryId: "q.2", text: "ei tuloksia" } },
  { kind: "result_item_expanded", detail: { atomId: "atom.1" } },
  { kind: "result_item_collapsed", detail: { atomId: "atom.1" } },
  { kind: "traffic_requested", detail: { selectorKind: "byUnit", selector: { byUnit: "EK12" } } },
  { kind: "nav_slot_changed", detail: { slot: "category", value: "palo" } },
  { kind: "nav_query_submitted", detail: { queryId: "nav.1", category: "palo", sourceId: null, window: "last_cycle", resultAtomIds: ["atom.1"], phase: "exploration" } },
  { kind: "ai_chat_query_submitted", detail: { queryId: "ai.1", text: "onko pohjoisreuna kiihtynyt?", view: 1, virtualTimeS: 0, phase: "decision", tool: "open_thinker" } },
  { kind: "ai_chat_answer_received", detail: { queryId: "ai.1", text: "onko pohjoisreuna kiihtynyt?", view: 1, virtualTimeS: 0, retrieved: [{ id: "atom.1", fusedScore: 1 }], retrievalMode: "hybrid", modelId: "claude-opus-5-5", promptHash: "0".repeat(64), answer: { vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" }, latencyMs: 3100, fallback: false, fallbackReason: null, phase: "decision", promptVariant: "standard", tool: "open_thinker", aiVerdict: "in_line" } },

  // §2.6
  { kind: "probe_option_hovered", detail: { probeId: "probe.j.cycle_1", optionId: "holds" } },
  { kind: "probe_answer_changed", detail: { probeId: "probe.j.cycle_1", from: null, to: "holds" } },
  { kind: "confidence_slider_moved", detail: { probeId: "probe.j.cycle_1", value: 70, settle: false } },
  { kind: "probe_submitted", detail: { probeId: "probe.j.cycle_1", response: { judgement: "holds" } } },
  { kind: "expectation_marked", detail: { probeId: "probe.e.cycle_1", markedGeometry: [[{ lat: 60.8, lon: 27.0 }]], confidence: 60 } },
  { kind: "containment_judgement_submitted", detail: { probeId: "probe.j.cycle_1", judgement: "holds", confidence: 70 } },
  { kind: "containment_judgement_revised", detail: { probeId: "probe.j.cycle_1", judgement: "partly_wrong", confidence: 40, breachPoint: { lat: 60.81, lon: 27.01 } } },
  { kind: "failure_location_marked", detail: { probeId: "probe.j.cycle_1", markedPoint: { lat: 60.81, lon: 27.01 } } },
  { kind: "corrected_projection_drawn", detail: { probeId: "probe.j.cycle_1", polygon: [[{ lat: 60.8, lon: 27.0 }, { lat: 60.81, lon: 27.0 }, { lat: 60.81, lon: 27.01 }]], vertexCount: 3, drawingDurationMs: 15000 } },
  { kind: "allocation_changed", detail: { assetId: "EK11", previousSectorId: null, previousTaskId: null, newSectorId: "L1", newTaskId: "task.direct-attack" } },
  { kind: "allocation_submitted", detail: { plan: { mainEffort: "L1", posture: "direct_attack", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: null }, rationaleAsked: true, rationaleFi: "placeholder rationale" } },
  { kind: "drone_tasked", detail: { view: 7, assetId: "DR2", assetType: "drone", targetSectorId: "L3", taskId: "task.thermal-survey", clockLabel: "16:20" } },
  { kind: "polygon_tool_opened", detail: { probeId: "probe.j.cycle_1" } },
  { kind: "polygon_tool_abandoned", detail: { probeId: "probe.j.cycle_1" } },
  { kind: "branch_list_presented", detail: { probeId: "probe.j.cycle_1", statementIds: ["stmt.1", "stmt.2", "stmt.3", "stmt.4", "none_of_these"] } },
  { kind: "branch_option_hovered", detail: { statementId: "stmt.1" } },
  { kind: "branch_selected", detail: { statementId: "none_of_these" } },
  { kind: "branch_list_abandoned", detail: { probeId: "probe.j.cycle_1" } },

  // Amendment
  { kind: "spam_prompt_shown", detail: { probeId: "probe.s.cycle_3", cycle: 3, atViewSeconds: 25 } },
  { kind: "spam_collapsed", detail: { probeId: "probe.s.cycle_3" } },
  { kind: "spam_expanded", detail: { probeId: "probe.s.cycle_3" } },
  { kind: "spam_ready", detail: { probeId: "probe.s.cycle_3", timedOut: false } },
  { kind: "spam_answered", detail: { probeId: "probe.s.cycle_3", response: "b", timedOut: false } },
  { kind: "recall_confidence_submitted", detail: { probeId: "probe.r.cycle_2", value: 55 } },

  // Decision task
  { kind: "decision_presented", detail: { itemId: "decision.cycle_1", presentedOptionOrder: ["A", "B", "C", "D"] } },
  { kind: "decision_option_hovered", detail: { optionId: "A" } },
  { kind: "decision_initial_submitted", detail: { optionId: "A", confidence: 80, latencyFromPresentationMs: 6000 } },

  // Two-phase cycle (SPEC/15 §9, 23 Sep 2026)
  { kind: "exploration_phase_start", detail: { cycle: 1, explorationSeconds: 20 } },
  { kind: "decision_phase_start", detail: { cycle: 1 } },
  { kind: "freeze_submitted", detail: { cycle: 2, responses: [{ itemId: "freeze.2.1", optionId: "opt.1", confidence: 60, answeredAtWallMs: 70000, msSinceFreezeOpened: 6000 }] } },

  // The view's flow (researcher decision 1 Oct 2026)
  { kind: "decision_panel_opened", detail: { cycle: 1, atViewSeconds: 20 } },
  { kind: "allocation_revision_opened", detail: { cycle: 1, atViewSeconds: 96.5 } },
  { kind: "allocation_revised", detail: { cycle: 1, revision: 1, plan: { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: { sectorId: "L3", taskId: "task.thermal-survey" } } } },
  { kind: "outlook_submitted", detail: { cycle: 1, development: "worsens", developmentConfidence: 75, resourcesNeeded: true, resourcesConfidence: 50 } },
  { kind: "tour_completed", detail: { cycle: 0, tour: "practice", stepsSeen: 13, dwellMs: 95_000 } },
  { kind: "freeze_started", detail: { cycle: 2, atViewSeconds: 64, decisionCommittedBeforeFreeze: false, decisionStep: "judging" } },
  { kind: "freeze_item_completed", detail: { cycle: 2, itemId: "freeze.2.1", msSinceFreezeOpened: 6000 } },
  { kind: "view_ended", detail: { cycle: 1, viewSeconds: 120, endedBy: "minimum_length" } },
  { kind: "step_boundary_reached", detail: { cycle: 2, atViewSeconds: 65 } },
  { kind: "spam_closed", detail: { probeId: "probe.s.cycle_3", cycle: 3 } },
  { kind: "hinge_check_presented", detail: { itemId: "hinge.manipulation_check" } },
  { kind: "hinge_check_answered", detail: { itemId: "hinge.manipulation_check", optionId: "b" } },
  { kind: "hinge_cell_note_shown", detail: { noteId: "linjaus_line" } },
  { kind: "directive_shown", detail: { view: 8, messageId: "duty.guidance", clockLabel: "16:40" } },
  { kind: "tab_selected", detail: { tool: "open_thinker", view: 8, phase: "exploration" } },
  // The study shell (5 Oct 2026, work package I)
  { kind: "consent_decided", detail: { decision: "accepted", attested: true, textId: "consent.placeholder.v0", dwellMs: 12_000 } },
  { kind: "questionnaire_presented", detail: { questionnaireId: "post", itemIds: ["retention.hinge"], retentionOptionOrder: ["c", "d", "a", "b"] } },
  { kind: "questionnaire_submitted", detail: { questionnaireId: "post", answers: [{ itemId: "retention.hinge", value: "c" }], dwellMs: 300_000 } },
  { kind: "debrief_shown", detail: { textId: "debrief.reasoning_intent" } },
  { kind: "debrief_closed", detail: { textId: "debrief.reasoning_intent", dwellMs: 90_000 } },
  { kind: "glossary_closed", detail: { cycle: 2, dwellMs: 4_000 } },
  // SPEC/35 (0.13.0): the public-audience version (`glossary_opened` in its public shape; the R2 shape `{ cycle }` is no longer emitted)
  { kind: "glossary_opened", detail: { termId: "fire.head", surface: "message_log", view: 3 } },
  { kind: "primer_page", detail: { pageId: "p1.role", dwellMs: 41_000 } },
  { kind: "primer_check", detail: { questionId: "q1.role", chosen: 2, correct: false, attempt: 1 } },
  { kind: "help_card_opened", detail: { section: "roster" } },
  { kind: "profile_shown", detail: {} },
  // SPEC/36 (0.14.0): personal results after the study
  { kind: "results_optin", detail: { optedIn: true } },
  // The difficulty audit's changes (0.15.0): the map-reading pretest — since 0.17.0 the map training in its step — and the practice feedback
  { kind: "map_pretest_started", detail: { version: "map-training-2026-10-25", itemIds: ["training.t1.place"], timeLimitMs: 300_000, remainingMs: 300_000, resumed: false, keptItemIds: [] } },
  { kind: "map_pretest_answer", detail: { itemId: "training.t1.place", position: 1, rtMs: 9_000, measures: [312], point: { x: 171.5, y: 494 }, errorM: 5 } },
  { kind: "map_pretest_feedback_left", detail: { itemId: "training.t1.place", position: 1, dwellMs: 7_500 } },
  { kind: "map_pretest_completed", detail: { endReason: "completed", answeredCount: 1, missingItemIds: [], durationMs: 16_500 } },
  { kind: "practice_feedback_shown", detail: { itemIds: ["freeze.practice.infra", "freeze.practice.forecast"] } },
  // The training incident (0.18.0, SPEC/07 (bp)); the map training's and the practice feedback's kinds above are retired, still typed
  { kind: "training_started", detail: { version: "training-2026-10-26", sectionIds: ["s1", "s2", "s3", "s4", "s5"], itemIds: ["training.s1.place", "training.s3.records1"], capMs: 720_000, remainingMs: 720_000, resumed: false, keptItemIds: [] } },
  { kind: "training_section_left", detail: { sectionId: "s1", dwellMs: 6_000 } },
  { kind: "training_answer", detail: { itemId: "training.s1.place", sectionId: "s1", position: 1, rtMs: 14_000, measures: [], point: { lat: 60.93, lon: 27.51 }, errorM: 42 } },
  { kind: "training_feedback_left", detail: { itemId: "training.s1.place", position: 1, dwellMs: 9_000 } },
  { kind: "training_haku_asked", detail: { queryId: "trn.1", itemId: "training.s3.records1", text: "Mitä DR8 ilmoitti klo 10.05?", charCount: 28, atItemMs: 7_000 } },
  { kind: "training_haku_answered", detail: { queryId: "trn.1", itemId: "training.s3.records1", retrieved: [{ id: "trn.r06", fusedScore: 2 }], retrievalMode: "lexical_only", retrievalLanguage: "fi", answerSource: "template", modelId: null, promptHash: null, fallback: true, fallbackReason: "network_error", latencyMs: 2_500, answer: { vastaus: "v", perusteet: "p", varmuus: "m", muuttaisi: "u" } } },
  { kind: "training_demo_shown", detail: { demoId: "haku", exampleIds: ["ex1", "ex2"], dwellMs: 61_000 } },
  { kind: "training_completed", detail: { endReason: "completed", answeredCount: 13, missingItemIds: [], durationMs: 540_000 } },
  { kind: "training_cap_reached", detail: { remainingItemIds: ["training.s4.records"], atItemId: "training.s4.map", activeMs: 720_000 } },
  // Adopted before pilot 2 (0.16.0): the hinge's optional fatigue item
  { kind: "hinge_fatigue_rated", detail: { itemId: "fatigue.hinge", value: 4 } },
  // The AI literacy test (9 Oct 2026, revision (ac))
  { kind: "ai_literacy_started", detail: { instrumentId: "SNAIL", version: "snail-31.2023.v1", itemIds: ["snail.V01", "snail.V02"], timeLimitMs: 300_000, itemsPerPage: 4, firstPage: 0, remainingMs: 300_000, resumed: false, keptItemIds: [], itemsPending: false } },
  { kind: "ai_literacy_answered", detail: { itemId: "snail.V01", sourceItemId: "V01", position: 1, page: 0, response: 5, timeOnItemMs: 6_000 } },
  { kind: "ai_literacy_submitted", detail: { endReason: "skipped", version: "snail-31.2023.v1", responses: [{ itemId: "snail.V01", response: 5 }, { itemId: "snail.V02", response: null }], itemCount: 2, answeredCount: 1, missingItemIds: ["snail.V02"], durationMs: 30_000, timeLimitMs: 300_000 } },
  // Map use (10 Oct 2026, revision (al))
  { kind: "freeze_map_pick", detail: { cycle: 4, itemId: "freeze.c4.ek12_where", point: { lat: 60.85, lon: 27.35 }, zoom: 13.4, centre: { lat: 60.849, lon: 27.35 }, mapPx: { width: 360, height: 360 } } },
  { kind: "map_labels_placed", detail: { view: 13, shown: ["iso:40", "past:0", "spot:US2"], hidden: [] } },
  { kind: "window_size_warning", detail: { shown: true, width: 1000, height: 480, minWidth: 1100, minHeight: 500 } },
  // The TAK shell's tools (13 Oct 2026, SPEC/28 §5)
  { kind: "tak_pane_opened", detail: { pane: "geochat", view: 3, cause: "toolbar" } },
  { kind: "tak_pane_closed", detail: { pane: "geochat", view: 3, cause: "replaced" } },
  { kind: "tak_contact_selected", detail: { uid: "TAKSIM-UNIT-EK11", view: 3 } },
  { kind: "tak_overlay_toggled", detail: { layer: "past_perimeters", on: false, view: 3 } },
  { kind: "tak_rb_measured", detail: { from: { lat: 60.85, lon: 27.33 }, to: { lat: 60.86, lon: 27.35 }, metres: 1543.2, bearingDeg: 47.12, view: 3 } },
  { kind: "tak_chat_room_viewed", detail: { room: "air", view: 3 } },
  { kind: "tak_video_viewed", detail: { platformId: "DR2", view: 3, cause: "select" } },
  // SPEC/30 (19 Oct 2026)
  { kind: "consult_prompt_shown", detail: { cycle: 3, atViewSeconds: 60, tool: "thinker" } },
  { kind: "consult_prompt_opened", detail: { cycle: 3, tool: "thinker" } },
  { kind: "consult_prompt_dismissed", detail: { cycle: 4, tool: "thinker", cause: "view_end" } },
  { kind: "plan_confidence_presented", detail: { cycle: 3 } },
  { kind: "plan_confidence_submitted", detail: { cycle: 3, value: 75 } },
  // SPEC/32 §3 (20 Oct 2026)
  { kind: "plan_review_shown", detail: { cycle: 9, atViewSeconds: 120, trigger: "minimum_reached", premiseLines: ["P1 … — no longer holds: SPOT 17.01."], premiseStatuses: [{ premiseId: "P1", status: "contradicted", atomIds: ["atom.demo.12.0"] }, { premiseId: "P2", status: "not_contradicted", atomIds: [] }], tableSha256: "0".repeat(64) } },
  { kind: "plan_review_record_opened", detail: { cycle: 9, atomId: "atom.demo.12.0" } },
  { kind: "plan_review_closed", detail: { cycle: 9, choice: "revise", dwellMs: 8200, capExtendedToSeconds: 165 } },
];

export interface ScriptedSessionResult {
  readonly records: readonly LogRecord[];
}

export async function runScriptedSession(): Promise<ScriptedSessionResult> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const event of EVENTS) {
    await appendTelemetryEvent(log, T0, 0, event);
  }
  return { records: await log.readAll() };
}
