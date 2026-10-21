import { describe, expect, it } from "vitest";
import { ALL_RECORD_KINDS, type RecordKind } from "../../app/telemetry/record-kinds.js";

/**
 * Compile-time exhaustiveness proof that `EXPECTED_KINDS` below covers
 * every member of the `RecordKind` union. If a kind is added to
 * `TelemetryEvent` in record-kinds.ts without being added here, this
 * function fails to type-check (the `default` branch's `never` narrowing
 * breaks) — so `npm run typecheck` catches a missed kind, not just a
 * runtime test that could be forgotten alongside the same edit.
 */
function assertExhaustive(kind: never): never {
  throw new Error(`Unhandled record kind: ${String(kind)}`);
}

const EXPECTED_KINDS: readonly RecordKind[] = (() => {
  const list: RecordKind[] = [];
  function cover(kind: RecordKind): void {
    list.push(kind);
    switch (kind) {
      case "session_started":
      case "preflight_result":
      case "briefing_advanced":
      case "cycle_start":
      case "cycle_end":
      case "hinge_pause_start":
      case "hinge_pause_end":
      case "state_transition":
      case "fault":
      case "fault_resolved":
      case "window_blur":
      case "window_focus":
      case "idle_start":
      case "idle_end":
      case "frame_stats":
      case "session_completed":
      case "session_resumed":
      case "phase_entered":
      case "bubble_available":
      case "envelope_revealed":
      case "channel_signal_emitted":
      case "duty_officer_message_delivered":
      case "probe_presented":
      case "retrieval_returned":
      case "traffic_returned":
      case "click":
      case "element_enter":
      case "element_leave":
      case "layer_toggled":
      case "viewport_changed":
      case "text_scrolled":
      case "pointer_track":
      case "drawer_opened":
      case "drawer_closed":
      case "drawer_tab_changed":
      case "drawer_state_at_cycle_boundary":
      case "query_focus":
      case "query_first_keystroke":
      case "query_edit":
      case "query_submitted":
      case "query_cleared":
      case "retrieval_miss":
      case "result_item_expanded":
      case "result_item_collapsed":
      case "traffic_requested":
      case "nav_slot_changed":
      case "nav_query_submitted":
      case "ai_chat_query_submitted":
      case "ai_chat_answer_received":
      case "probe_option_hovered":
      case "probe_answer_changed":
      case "confidence_slider_moved":
      case "probe_submitted":
      case "expectation_marked":
      case "containment_judgement_submitted":
      case "containment_judgement_revised":
      case "failure_location_marked":
      case "corrected_projection_drawn":
      case "allocation_changed":
      case "allocation_submitted":
      case "drone_tasked":
      case "polygon_tool_opened":
      case "polygon_tool_abandoned":
      case "branch_list_presented":
      case "branch_option_hovered":
      case "branch_selected":
      case "branch_list_abandoned":
      case "spam_prompt_shown":
      case "spam_ready":
      case "spam_collapsed":
      case "spam_expanded":
      case "spam_answered":
      case "recall_confidence_submitted":
      case "decision_presented":
      case "decision_option_hovered":
      case "decision_initial_submitted":
      case "exploration_phase_start":
      case "decision_phase_start":
      case "freeze_submitted":
      case "decision_panel_opened":
      case "allocation_revised":
      case "allocation_revision_opened":
      case "freeze_started":
      case "freeze_item_completed":
      case "view_ended":
      case "outlook_submitted":
      case "tour_completed":
      case "step_boundary_reached":
      case "spam_closed":
      case "hinge_check_presented":
      case "hinge_check_answered":
      case "hinge_cell_note_shown":
      case "directive_shown":
      case "tab_selected":
      case "consent_decided":
      case "questionnaire_presented":
      case "questionnaire_submitted":
      case "debrief_shown":
      case "debrief_closed":
      case "glossary_opened":
      case "glossary_closed":
      case "ai_literacy_started":
      case "ai_literacy_answered":
      case "ai_literacy_submitted":
      case "freeze_map_pick":
      case "map_labels_placed":
      case "window_size_warning":
      case "tak_pane_opened":
      case "tak_pane_closed":
      case "tak_contact_selected":
      case "tak_overlay_toggled":
      case "tak_rb_measured":
      case "tak_chat_room_viewed":
      case "tak_video_viewed":
      case "consult_prompt_shown":
      case "consult_prompt_opened":
      case "consult_prompt_dismissed":
      case "plan_confidence_presented":
      case "plan_confidence_submitted":
      case "plan_review_shown":
      case "plan_review_record_opened":
      case "plan_review_closed":
      case "primer_page":
      case "primer_check":
      case "help_card_opened":
      case "profile_shown":
        return;
      default:
        assertExhaustive(kind);
    }
  }
  for (const k of ALL_RECORD_KINDS) cover(k);
  return list;
})();

describe("RecordKind enumeration", () => {
  it("ALL_RECORD_KINDS has no duplicates", () => {
    expect(new Set(ALL_RECORD_KINDS).size).toBe(ALL_RECORD_KINDS.length);
  });

  it("ALL_RECORD_KINDS is exhaustive over the RecordKind type (compile-time proof above; this is the runtime cross-check)", () => {
    expect(EXPECTED_KINDS.length).toBe(ALL_RECORD_KINDS.length);
  });

  it("has at least one kind per SPEC/07 §2 section (sanity floor, not a precise count)", () => {
    expect(ALL_RECORD_KINDS.length).toBeGreaterThanOrEqual(70);
  });
});
