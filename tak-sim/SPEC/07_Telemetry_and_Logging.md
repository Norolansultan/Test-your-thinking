# 07 — Telemetry and logging

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Expands `02_Architecture_v2.md` §8 into a complete, buildable enumeration and adds the drawer, traffic-request and tier-discovery records the layout and routing decisions require.

> **Changelog**
> - **24 Oct 2026 (bf)** — format **0.16.0** (adopted before pilot 2, `30` (bf)): `hinge_fatigue_rated` (the hinge's optional fatigue item); the header's `assignment.stratum` (profession × leads others); `ai_chat_query_submitted.viaChip` also with `tool: "haku"` (the Haku group's chip); new questionnaire item ids (pre: `sleep.hours`, `shift.recent`; post: `accuracy.perceived`, `influence.plan_views.*`, `influence.answers.*`); the allocation table's version 2. See the revision at the end.
> - **23 Oct 2026 (be)** — format **0.15.0** (the difficulty audit, `docs/audits/2026-10-23-difficulty/`): the map-reading pretest's `map_pretest_started` / `_answer` / `_completed`, the practice feedback's `practice_feedback_shown`; the header's `mapPretest` and `practiceFeedback`; VP's fifth freeze item and second SPAM item. The "New records" badge is not logged. Main views write the records of 0.14.0. See the revision at the end.
> - **23 Oct 2026 (bc)** — format **0.14.0** (`36`, personal results after the study): `results_optin { optedIn }` in every session after the post-session questionnaire (never the address); the header's `immediateProfile`; `profile_shown` only with it. See the revision at the end.
> - **21 Oct 2026 (bb)** — format **0.13.0** (`35`, the public-audience version): header fields `audience` and `scope`; `primer_page`, `primer_check`, `help_card_opened`, `profile_shown`; `glossary_opened` in a new shape. Expert sessions write the records of 0.12.0. See the revision at the end.
> - **20 Oct 2026 (ba)** — format **0.12.0** (`32` §3): `plan_review_shown`, `plan_review_record_opened`, `plan_review_closed`. See the revision at the end.
> - **19 Oct 2026 (ay)** — format **0.11.0** (`31` §3.6): `ai_chat_answer_received` gains `digestAtomIds` (the guide's digest; empty for Haku) and `recentAtomIds` (both tools), so exposure can count what reached the model without a search; the new post-session item ids; `consult_prompt_shown.atViewSeconds` may be later than 60 when the notice yields to a freeze. See the revision at the end.
> - **19 Oct 2026 (ax)** — format **0.10.0** (`30`): `consult_prompt_shown` / `_opened` / `_dismissed`, `plan_confidence_presented` / `_submitted`; `ai_chat_query_submitted.viaChip`; `query_focus` / `query_first_keystroke` / `query_edit` gain `field` and `cycle`, `pointer_track` gains `cycle` and `viewportPx`; the first emitters of `pointer_track`, the query kinds, `decision_option_hovered`, `probe_option_hovered`, `probe_answer_changed` and `frame_stats`. See the revision at the end.
> - **13 Oct 2026 (av)** — the TAK shell (`28` §5): header field `uiShell` (`"tak" | "classic"`; a resumed log without it resumes as classic) and seven map-use kinds `tak_pane_opened`, `tak_pane_closed`, `tak_contact_selected`, `tak_overlay_toggled`, `tak_rb_measured`, `tak_chat_room_viewed`, `tak_video_viewed`. See the revision at the end.
> - **10 Oct 2026 (am)** — the Thinker practice (`15` revision (am)): Open Thinker records in the practice view carry `view` 0 like every practice record (no browser record field changes; analysis drops them by that tag, inside the `phase_entered` practice … phase_a bracket); the Thinker server's JSONL line (both tools) gains **`practice`** (true for view 0), and an Open Thinker line in VP has `intentBlock` null and `verdict`/`verdicts` null. The tour step opens the Thinker tab, logged as `tab_selected open_thinker`.
> - **10 Oct 2026 (al)** — `ai_chat_answer_received.aiVerdicts` (per-option verdicts); the chats send `queryId`; the Thinker server lines gain `queryId`, `attempts`, and for the Open Thinker `verdicts`, `citationIssues`, `directiveQuoted`, `historyHashes`, `userContentHash`. See the revision at the end.
> - **9 Oct 2026 (ai)** — closed items: V13's area item logs `{unsure, areas, optionOrder}` and its option order in `probe_presented.optionIds`; the V14 backup's `probe_submitted.confidence`; the questionnaire's multi-select answers (option-id lists with `optionOrder`, `notShown`) and `questionnaire_presented.multiOptionOrders`; `plan.departureReason` is a closed enum. No free text is logged from the participant except the Search/Thinker questions. See the revision at the end.
> - **9 Oct 2026 (ad)** — `freeze_submitted` may carry `timedOut: true` (the freeze's 180 s cap) and `missing` (the items not answered, in a timed-out, skipped or partial submission); `markFreezeItemAnswered` takes the confirmed answer.
> - **9 Oct 2026 (ac)** — `ai_literacy_started`, `ai_literacy_answered` (each 1–7 rating as given) and `ai_literacy_submitted` (`endReason` completed | timeout | skipped); the header's `aiLiteracyTest`; no score in the log (§3). See the revision at the end.
> - **8 Oct 2026 (ab)** — `ai_chat_answer_received.aiVerdict`, `plan.departureNoted` / `departureReason`, `usage.modelVersion`, the Open Thinker server line's `verdict` and `digest`; new derived measures. See the revision at the end.
> - **8 Oct 2026 (aa)** — `directive_shown` and `tab_selected` added; `hinge_cell_note_shown` no longer emitted; the reading grace after answers; derived measures for the directive coding and the Open Thinker. See the revision at the end.
> - **6–8 Oct 2026 (y)** — format 0.9.4 (unreleased, not bumped): attention records emitted (`window_blur` / `window_focus`, `idle_start` / `idle_end` net of waits); per-item freeze answer times and `freeze_item_completed`; `cycle_end.totalRealDurationMs` real; `ai_chat_*` carry `tool`; directive adherence gains `afterFreeze`, `h14Aligned`, `soundVia`, `viaBoundarySector`; `linjaus` fields no longer written. See the revision at the end.
> - **5 Oct 2026 (u, reconciled)** — phase-B logging reconciled with the build (`27` 1.1): `assignment` in the header; `hinge_cell_note_shown`; the server's `systemPromptHash` and `participantCode`.
> - **4 Oct 2026 (u)** — phase-B logging for `27`: the header's real cell; `linjaus` in `ai_chat_answer_received` (`reasoning_intent`, V8–V14); the hinge check. Requirements only; the format bump is set by the build. See the revision at the end.
> - **4 Oct 2026 (t), review round 2** — format 0.9.4 (same version, not yet released) adds `step_boundary_reached`; `hinge_pause_end` carries the real dwell; directive adherence codes the plan in force at view end with `afterBoundary`, gives every keyed view a row, and is sector-aware. See the revision at the end.
> - **4 Oct 2026 (t)** — format 0.9.4: `allocation_submitted.plan` and `allocation_revised.plan` carry `posture`; directive adherence is a derived measure, computed in analysis only. See the revision at the end.
> - **1 Oct 2026 (r)** — format 0.8.0: `decision_panel_opened`, `allocation_revised`, `freeze_started`, `view_ended`; `source` on freeze item answers; `language` in the header; new derived measures (commitment time, revisions). See the revision at the end.
> - **25 Sep 2026 (q)** — `ai_chat_query_submitted` gains the retrieval and generation fields (`14` revision (q)).
> - **23 Sep 2026 (j)** — radio requests retired; source selection is measured from the KUKA slot; log format 0.4.0. See the revision at the end.
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **3.1 · 17 Sep 2026** — SPAM, recall-confidence, decision and retrieval-package records.

---

## 1. Principle

**Capture raw events with precise timing and identity. Derive nothing at runtime.**

Dwell, latency, reformulation intervals, revisit counts and reliance measures are all computed in analysis, from pairs of enter/leave and onset/action records. Storing a derived value makes an analysis bug permanent and unfixable.

Every record carries `seq`, `tVirtual` and `tWallOffsetMs` (`04` §10). `seq` is gapless; a gap is a detected data-loss event.

**There is no volume argument for capturing less.** A twenty-cycle session produces roughly 6,000–10,000 records without the pointer track and about 45,000 with it at 10 Hz. At ~200 bytes per record that is 2 MB, or 9 MB with the track. A missing field discovered at analysis costs a measure that does not exist; an unused field costs nothing.

---

## 2. Record kinds

The complete enumeration. Adding a kind is a `formatVersion` bump.

### 2.1 Session and lifecycle

| Kind | Detail |
|---|---|
| `session_started` | The header (`04` §10) |
| `preflight_result` | Benchmark scores, viewport, refusal reason if any |
| `briefing_advanced` | Screen id, dwell |
| `cycle_start` | Cycle index, phase, virtual clock label |
| `cycle_end` | Cycle index, total real duration |
| `hinge_pause_start` / `hinge_pause_end` | Real duration, whether dismissed early |
| `state_transition` | From state, to state, trigger |
| `fault` / `fault_resolved` | Fault class, elapsed wall-clock gap |
| `window_blur` / `window_focus` | Relevant to exclusion rules |
| `idle_start` / `idle_end` | Threshold 5 s of no pointer or keyboard input |
| `frame_stats` | Per cycle: median frame time, long-task count. Identifies degraded machines |
| `session_completed` | |
| `session_resumed` | Resume count, interval since interruption, cycle replayed |

### 2.2 Stimulus onsets — the latency anchors

**Latency is meaningless without a defined zero.** These records exist to provide it.

| Kind | Detail |
|---|---|
| `bubble_available` | Atom id, map position, tier, source id |
| `envelope_revealed` | Cycle index, envelope id |
| `channel_signal_emitted` | Cycle index, the full signal payload including the traffic summary |
| `duty_officer_message_delivered` | Message id, whether it is the strategic guidance |
| `probe_presented` | Probe id, type, mode, option set |
| `retrieval_returned` | Query id, returned atom ids **in rank order** |
| `unit_reply_delivered` | Request id, addressee, atom ids returned, authored latency applied |
| `traffic_returned` | Request id, selector, entry ids in order |

### 2.3 Pointer and element interaction

```ts
interface ClickDetail {
  targetKind: "bubble" | "unit" | "drone" | "envelope" | "sector"
            | "map_background" | "drawer_control" | "drawer_tab" | "probe_option"
            | "result_item" | "channel_signal" | "rail_item" | "slider"
            | "status_strip_item" | "other";
  targetId: string | null;
  mapCoord?: { lat: number; lon: number };   // WGS84
  viewportRef: number;                        // seq of the last viewport_changed
  pointerType: "mouse" | "pen" | "touch";
  button: number;
}
```

| Kind | Detail |
|---|---|
| `click` | `ClickDetail` |
| `element_enter` / `element_leave` | Target identity. Together these give dwell and revisit counts |
| `layer_toggled` | Layer id, new state |
| `viewport_changed` | Centre, zoom, bounding box. Throttled to 4 Hz while panning, plus one settle record |
| `text_scrolled` | Element id, **maximum scroll fraction reached** — the only evidence a long report was read to the end |
| `pointer_track` | Optional, default off, configurable rate (10 Hz). Enable for an attention-allocation proxy without eye tracking |

### 2.4 Drawers — the reliance measures

The layout decision (`06` §1) makes these the cleanest reliance measures in the design. They did not exist in the previous telemetry spec.

| Kind | Detail |
|---|---|
| `drawer_opened` | Drawer (`haku` \| `tekoaly` \| `radio`), cycle index, **latency from `cycle_start`**, opening route (button, keyboard) |
| `drawer_closed` | Drawer, dwell, closing route (button, map click, Escape, replaced by another drawer) |
| `drawer_tab_changed` | Drawer, from tab, to tab |
| `drawer_state_at_cycle_boundary` | Which drawer, if any, was open when the cycle advanced |

Derived in analysis, never at runtime:

- time to first drawer open per cycle;
- drawer-open fraction of working period;
- **cycles in which no drawer was opened at all**.

### 2.5 Query capture — what was asked

The requirement is that query content and composition behaviour be recoverable in full.

| Kind | Detail |
|---|---|
| `query_focus` | Input receives focus |
| `query_first_keystroke` | Time to first character; the gap from `query_focus` is a composition-onset measure |
| `query_edit` | Emitted on backspace runs or clearing, **with a count, not per keystroke** — enough to detect reformulation without keystroke-level content |
| `query_submitted` | **The verbatim text**, character count, composition duration, query id, and the reformulation chain index within the cycle |
| `query_cleared` | Abandoned without submission, **with the text as typed**. An abandoned query is a strong signal and is usually discarded by instrumented systems |
| `retrieval_miss` | Query id and text, distinct from `retrieval_returned` |
| `result_item_expanded` / `result_item_collapsed` | Which returned atoms were actually opened, in what order |

**In `directed`, the same records apply to the radio panel**, with an additional `addressee` field recording which named formation was chosen. **Unit choice is a measure in its own right.**

| Kind | Detail |
|---|---|
| `radio_request_submitted` | Addressee, verbatim text, composition duration |
| `traffic_requested` | Selector (`byUnit` \| `byGroup` \| `byTimeWindow`), the full selector value |

`traffic_requested` carries the selector because **whose traffic someone chooses to read is a measure** (`02` §3.4).

**Query text is participant-authored free text and is personal data.** It is stored locally, pseudonymised with the session, uploaded to EU hosting under a processing agreement, and named explicitly in the data-protection documentation.

### 2.6 Probe and decision interaction

| Kind | Detail |
|---|---|
| `probe_option_hovered` | Pre-selection consideration |
| `probe_answer_changed` | From and to, **every change before submission** |
| `confidence_slider_moved` | Value and timestamp, throttled to 10 Hz while dragging, plus a final settle record. **Hesitation and reversal on a confidence scale are informative and invisible if only the final value is stored** |
| `probe_submitted` | Probe id, final response. The full input history is recoverable from preceding records (*revision (ai): V13's area item and the V14 backup's confidence, see the revision at the end*) |
| `expectation_marked` | Marked geometry and confidence |
| `containment_judgement_submitted` | Three-way judgement, confidence, and the breach point or the structured correction (`correction` {direction, reach}, format 0.8.2; earlier `correctedProjection`) |
| `containment_judgement_revised` | **A distinct kind. Never the same record mutated** |
| `failure_location_marked` | Marked point or polygon |
| `corrected_projection_drawn` | Polygon, vertex count, drawing duration |
| `allocation_changed` | Asset, previous sector and task, new sector and task |
| `allocation_submitted` | The full assignment plus the free-text rationale |

### 2.7 Discovery events — derived at analysis, anchored here

This section adds no new record kind. Tier-4 discovery for the three load-bearing items is computed from `traffic_returned`, `unit_reply_delivered` and `result_item_expanded` against the authored atom ids. The instrument must therefore log **atom ids on every delivery**, which §2.2 requires. Nothing is inferred from text.

---

## 3. What must never be logged

**Anything that would let the runtime score.** No record contains a correctness value, a flag, a truth annotation, or a comparison against an invariant. **Scoring happens entirely in the analysis pipeline.** There are two reasons: a runtime that scores can bias a subsequent probe, and a log that contains the answer key cannot be shared.

**Raw keystroke content of a query in progress.** Only `query_submitted` and `query_cleared` carry text; `query_edit` carries a count.

**Any personal identifier.** The participant code is pseudonymous. The mapping from code to person lives outside the log, under separate access control.

---

## 4. Derived measures — computed in analysis only

Listed here so the raw records above can be checked for sufficiency. If a measure below cannot be computed from §2, a record is missing.

| Measure | Computed from |
|---|---|
| Judgement latency | `containment_judgement_submitted.t` − `envelope_revealed.t` |
| Time to first information-seeking act in a cycle | First `drawer_opened` \| `radio_request_submitted` \| `query_submitted` − `cycle_start` |
| Dwell per element | Paired `element_enter` / `element_leave` |
| Report read-through | `text_scrolled.maxFraction` per atom |
| Reformulation chain length | `query_submitted` records sharing a cycle, by chain index |
| Abandonment rate | `query_cleared` ÷ (`query_cleared` + `query_submitted`) |
| Confidence reversal count | Direction changes within a `confidence_slider_moved` run |
| Drawer reliance | Drawer-open fraction of the working period, per cycle |
| Channel attention (`substitutive`) | `element_enter` on `channel_signal` targets, dwell, and whether any signal was opened |
| Source-selection tracking | `radio_request_submitted.addressee` against authored `SourceClass.reliability` |
| Tier-4 discovery | §2.7 |
| Doubt–action coherence | `containment_judgement_submitted` + `allocation_submitted` + the authored viability table |
| Revision rate | `containment_judgement_revised` ÷ `containment_judgement_submitted` |
| Fatigue trajectory | Per-cycle latencies and information-seeking counts against cycle index |

---

## 5. Volume and retention

Roughly 2 MB per session without the pointer track, 9 MB with it. A hundred participants is under 1 GB.

Retention, access control and the DPIA are specified in `09` §8. The log contains free text the participant wrote and is therefore personal data in its entirety, not only in the query fields.

---

## Amendment 2026-09-17

| Kind | Detail |
|---|---|
| `spam_prompt_shown` | Probe id, onset (virtual and wall offset) |
| `spam_ready` | Latency from onset; or `spam_ready_timeout` |
| `spam_answered` | Response, latency from ready; or `spam_answer_timeout` |
| `recall_confidence_submitted` | Probe id, value (plus slider movement records as §2.6) |
| `decision_*` | As `16` §8 |
| `retrieval_returned` (extended) | Ranked package ids, package types, scores (fixed precision) — `14` §5 |
| `phase_entered` | `warmup` \| `tutorial` \| `phase_a` \| `hinge` \| `phase_b` |

The log header additionally records `guidanceMode` and `echelon`.

**LLM-query coding (Paper 3).** Query text is already captured verbatim (§2.5). Coding for SA level, function, grounding and framing is done in analysis, blind to condition, using the coding manual (`11` §4.2).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

| Kind | Detail |
|---|---|
| `polygon_tool_opened` / `polygon_tool_abandoned` | Probe id |
| `corrected_projection_drawn` | Polygon, vertex count, drawing duration (raw onset/offset only) |
| `branch_list_presented` | Statement ids in order |
| `branch_option_hovered` | Statement id |
| `branch_selected` | Statement id or `none_of_these` |
| `branch_list_abandoned` | Probe id |
| `retrieval_returned` (extended) | + `intentLineShown: boolean` |

Removed: `alignment_feedback_shown`, `decision_final_submitted`. Log header records `cell` instead of `guidanceMode`.

---

## Revision 23 Sep 2026 (h) — query-builder records

Adds two record kinds to §2.5; the log format becomes **0.2.0** (`TELEMETRY_FORMAT_VERSION`):

- `nav_slot_changed` — slot (`category` | `source` | `window`) and its new value; the sequence is the search path;
- `nav_query_submitted` — query id, the three slots, and the ids of exactly the items shown.

The search path is derived in analysis, never at run time (§1).

---

## Revision 23 Sep 2026 (i) — phase-tagged queries and the two-phase cycle

Implements `15` §9's logging obligation. Log format becomes **0.3.0**.

- `nav_query_submitted`, `nav_slot_changed`, and the AI-chat and radio-log query records all gain a `phase: "exploration" | "decision"` field, set from the orchestrator's current cycle phase at the moment the query is logged, never inferred later.
- New record kinds: `exploration_phase_start` (cycle, budgeted duration), `decision_phase_start` (cycle, whether the cycle carries a decision item), `freeze_start` / `freeze_end` (already implied by `PROBING_BLANKED`, now explicitly bracketing the freeze relative to the phases above).
- `CycleSpec` gains `explorationSeconds` (per-cycle override, default 90) and `hasDecisionItem: boolean`, logged once per cycle in `cycle_start`'s detail so the schedule is auditable from the log alone.

---

## Revision 23 Sep 2026 (j) — radio requests retired

Follows `02` revision (j). Log format becomes **0.4.0**.

- `radio_request_submitted` is **retired**: never emitted, and the validator rejects it in a 0.4.0 log. The "in `directed` the same records apply to the radio panel, with `addressee`" rule is superseded.
- The `drawer_opened` drawer enum becomes `haku | tekoaly`.
- **Message-log reading**: new `message_log_scrolled` record (cycle, first and last visible entry ids, dwell). This keeps the Haku group's T1 log observable, as the report rail's records already are.
- **Derived measures (§ derived table), restated:**
  - *Time to first information-seeking act in a cycle*: first `drawer_opened` | `nav_query_submitted` | `query_submitted` − `cycle_start`.
  - *Source-selection tracking*: KUKA values in `nav_slot_changed` (slot = `source`) and `nav_query_submitted`, against authored `SourceClass.reliability`. This replaces `radio_request_submitted.addressee`.
- Revision (i)'s `phase` field applies to `nav_*`, AI-chat and `message_log_scrolled` records. The "radio-log query records" it named do not exist.
- **Metadata-only records** (`19` §3.6): opening one is logged with its record id, since it marks something said that nobody can retrieve.

---

## Revision 25 Sep 2026 (q) — Thinker log fields

`ai_chat_query_submitted` (and a new `ai_chat_answer_received`) carry:
- the question text;
- the view and the virtual time;
- the retrieved record ids with their fused scores, in rank order;
- the model id, the prompt hash and the full answer text;
- the latency and `fallback: true | false`.

These fields are the exposure record for H9 and H10 and for the coding of unprompted conflict flags.

---

## Revision 1 Oct 2026 — drone taskings

Format 0.7.0. The allocation now covers the drone teams' assets as well as the crews (`16` revision 1 Oct 2026).

| Kind | Detail |
|---|---|
| `drone_tasked` | One per drone-team asset (drone, water drone `vesidrooni`, robot `robotti`) in an `allocation_submitted`, logged right after it in the same view: `view`, `assetId`, `assetType`, `targetSectorId`, `taskId`, `clockLabel`. The record's `tVirtual` is the time of the order. Crews appear in `allocation_submitted` only. |

The world does not respond: no record, item or position changes because of a tasking (identical stimulus).

**Derived measure (§4):** *drone survey in a window*, from `drone_tasked` only. Defined in `16` revision 1 Oct 2026.

---

## Revision 1 Oct 2026 (r) — the open view, revisions, freeze offsets, the source question

Follows `15` revision (r), `16` revision (r) and `08` revision (r). Format **0.8.0**.

### New record kinds

| Kind | Detail |
|---|---|
| `decision_panel_opened` | `cycle`, `atViewSeconds` (view time at opening; 20 s by default). The anchor for decision commitment time |
| `allocation_revised` | `cycle`, `revision` (1, 2, …), `marks` (the full revised assignment: `assetId`, `sectorId`, `taskId` per asset). Logged when a participant who has confirmed before the minimum changes the allocation. **A distinct record; `allocation_submitted` is never mutated** (§2.6 principle). Followed by one `drone_tasked` per drone-team asset in the revised marks, as after `allocation_submitted` |
| `freeze_started` | `cycle`, `atViewSeconds` (the pre-planned offset), `decisionCommittedBeforeFreeze` (true when `allocation_submitted` was logged in this view before the freeze), `decisionStep` (the panel step the participant was on: `exploration` before the panel opened, `judging`, `confidence`, `follow_up_breach_point`, `follow_up_correction` (`follow_up_draw` before format 0.8.2), `follow_up_branch`, `verification`, `outlook` (0.9.0), `allocation`, `coa` (before 0.9.0), or `awaiting_view_end` after confirming early; a revision in progress reads `allocation`) |
| `view_ended` | `cycle`, `viewSeconds` (view time at the end, freeze time excluded), `endedBy`: `participant_confirm` (confirmed after the minimum) or `minimum_length` (confirmed earlier; the view ended at the minimum) |

### Changed records

- **Freeze item answers** gain `source`: `map` \| `message_log` \| `search` \| `own_inference` \| `thinker`. `thinker` is offered only in the AI condition and never in the practice view.
- **`exploration_phase_start`** is still emitted at view start. Its `explorationSeconds` now means the seconds before the decision panel opens. **`decision_phase_start`** is no longer emitted; the kind stays defined. `decision_panel_opened` replaces it.
- **`CycleSpec`** (logged in `cycle_start`): `explorationSeconds` is renamed `minViewSeconds` (120 single-step, 150 merged), and `freezeAtSeconds` is added (the build-time offset; null when the view has no freeze). The schedule stays auditable from the log alone (revision (i)).
- **`phase`** on query records (revision (i)): `exploration` before `decision_panel_opened`, `decision` after.
- **Header:** `language` (`fi` \| `en`), the session language chosen on the first page; absent in logs written before 1 Oct 2026.

### Derived measures (§4), added — computed in analysis only

| Measure | Computed from |
|---|---|
| Decision commitment time | `allocation_submitted.t` − `decision_panel_opened.t`, view time, freeze time excluded |
| Confirmation time | Time of the course-of-action answer relative to `decision_panel_opened` |
| Early confirmation | `view_ended.endedBy = minimum_length` |
| Allocation revisions | Count of `allocation_revised` per view; whether any revision changed an asset's sector or task; time of each revision from the confirmation |
| Commitment relative to a merged view's second step | `allocation_submitted.t` against the second step's arrival |
| Freeze-position covariate | `freeze_started.decisionCommittedBeforeFreeze`, `decisionStep` |
| Source attribution | `source` per freeze item; checked against the view's Haku, Thinker and message-log records (exploratory, `08` revision (r)) |
| Probe reactivity | Probe-independent measures (above, plus §4's information-seeking measures) in views with and without a blanked freeze |

The drone-survey and anticipation measures read every allocation version: `drone_tasked` is emitted after both `allocation_submitted` and `allocation_revised` (`16` revision (r)).

### Review amendment (2 Oct 2026) to revision (r)

- **Time base.** Every record's `tWallOffsetMs` is the real milliseconds since the session started (monotonic clock, faked in tests), for the orchestrator's records as well as the judgement steps' and the query tools'. Until 2 Oct 2026 it was 0 everywhere, so revision (r)'s commitment and revision times could not be computed. These derived measures are differences of `tWallOffsetMs`; a freeze's duration is included in them (subtract `freeze_started` … `freeze_submitted` where the view time is wanted).
- **`cycle_start`** also carries `minViewSeconds` and `freezeAtSeconds`, so each view's schedule is auditable from the log alone.
- **New record `allocation_revision_opened`** {cycle, atViewSeconds}: the participant opened "Muuta kohdennusta". `allocation_revised` follows only if they resubmit.

### Format 0.9.0 (2 Oct 2026; `16` revision (s), `15` r.10, `25` revision 2 Oct)

- **New `outlook_submitted`** {cycle, development, developmentConfidence, resourcesNeeded, resourcesConfidence}.
- **`allocation_submitted.plan` and `allocation_revised.plan`** {mainEffort, secondary {sectorId, taskId} | null, drones {sectorId, taskId} | null} replace the per-unit `assignments` and `marks`.
- **`drone_tasked`** is written once per observation drone team on scene when the plan tasks the drones.
- **Not emitted any more:** `decision_presented` and `decision_initial_submitted` (the course-of-action item is withdrawn). The plan's submission is the commitment and the confirmation.
- **`view_ended.endedBy`** may be `time_cap` (the 180 s cap), with `stepAtEnd`.
- **`cycle_start.navSources`** is the KUKA list offered in that view.
- **Derived measures:**
  - `outlookScores` (against `OUTLOOK_KEYS`);
  - `sectorAnticipation` (H10, `REKINDLE_CREW_ANTICIPATION`);
  - `droneSurveyTiming`, unchanged.

### Amendment 2 Oct 2026 — freeze item scoring, exposure and calibration (format 0.9.2)

**Records.** `freeze_submitted.responses[]` ({itemId, optionId, confidence, source?, point?}, `FreezeItemAnsweredDetail`):
- **`point`** is present on a `map_point` item's answer (the tapped point, WGS84). Its `optionId` is `"map_point"`.
- **`source`** is asked, and present, **on L2/L3 items only**. It is absent on L1 answers.
- The format version becomes **0.9.2**. The integrator bumps the constant in `record-kinds.ts`.

**Derived measures** (`app/telemetry/freeze-measures.ts`). These are pure functions over the log and the freeze content (`FreezeSpec[]`, passed in). They name no item, so they work on any item bank.

| Measure | Computed from |
|---|---|
| `freezeItemScores(records, freezes)` | One row per answered item: {view, itemId, level, goal, kind, correct, distanceM, confidence, source}. **`choice` items:** correct when the chosen option is `correct: true`. **`map_point` items:** haversine distance from `point` to `mapKey.point`, correct when ≤ `mapKey.toleranceM`; no point logged = incorrect, `distanceM` null. An answer whose item is not in the content passed for that view is skipped. An unknown option id, or a map item without `mapKey`, throws. F7's planted option is simply wrong here; H9 codes it separately. |
| `freezeItemExposure(records, freezes)` | For each answered item with `keyAtomIds`, per key atom: {atomId, reached, route, routes, msBeforeFreeze}, plus `allReached`. **Reached** means the atom arrived before the view's `freeze_started` (the submission when no start was logged). **Routes:** `bubble` (`bubble_available.atomId`), `haku` (`nav_query_submitted.resultAtomIds`), `thinker` (`ai_chat_answer_received.retrieved[].id`; retrieved for the answer, which does not prove the answer's text relayed it), and from older formats `traffic` (`traffic_returned.entryIds`) and `result_expanded` (`result_item_expanded.atomId`). `retrieval_returned` carries package ids and is not read. A Thinker answer that arrives during the freeze does not count. `msBeforeFreeze` is real milliseconds from the earliest arrival to `freeze_started`. **Use:** read an L1 error as "not yet arrived" or "arrived and lost" (`11` §7.14). |
| `calibrationPairs(scores, filter)` | The confidence–accuracy pairs of a level/view window, with n, mean confidence, proportion correct, the Brier score (mean of (confidence/100 − correct)²) and the over/under-confidence gap (mean confidence/100 − proportion correct; > 0 means overconfident). The default filter is `H2_PRIMARY_WINDOW`: L2/L3 in V2, V4, V5 and V7. Any other filter also works (for example L1 for exposure readings, or phase B). |

### Format 0.9.3 (2 Oct 2026)

`freeze_submitted` answers carry no `source`: the source question is withdrawn (`08` amendment). The field remains in the type for logs written before 0.9.3. `freezeItemScores.source` is null for new logs.

---

## Revision 4 Oct 2026 (t) — format 0.9.4: the posture in the plan

Follows `16` revision (t) and `18` revision (t).

### Changed records

- **`allocation_submitted.plan` and `allocation_revised.plan`** gain **`posture`**: `direct_attack` \| `barrier_line` \| `protect_values`. This is the posture of the main effort. It is required in every view, so every plan written in format 0.9.4 or later carries it. It is absent from logs written before 0.9.4, where it reads as missing, never as a default. The plan is now {mainEffort, posture, secondary {sectorId, taskId} \| null, drones {sectorId, taskId} \| null}.
- **`drone_tasked`** is unchanged.
- **`duty_officer_message_delivered`** is unchanged. The hinge message keeps its id (`duty.hinge`). Its text is the directive of `18` revision (t). The sender label (P2) is display only, and is not logged. The message expects no reply (round 2: the participant cannot transmit).
- **`step_boundary_reached`** {cycle, atViewSeconds} is **added** (round 2, 4 Oct 2026). The orchestrator emits it once per merged view, when the view reaches its second step (half its minimum length, scaled in a preview; 65 s of 130 s), before the second step's pushed items. It lets a plan be placed before or after the boundary.
- **`hinge_pause_end`** carries the real dwell (round 2): `realDurationMs` is the real time between `hinge_pause_start` and the dismissal (the directive's reading time on the hinge screen); `dismissedEarly` is `realDurationMs < pauseSeconds × 1000`. Before, both were placeholders (0, true).
- The format version becomes **0.9.4**. The integrator bumps `TELEMETRY_FORMAT_VERSION` in `record-kinds.ts`.

### Derived measure (§4), added — computed in analysis only

Nothing about alignment or soundness is logged. The runtime does not know the keys (I4; §1, "derive nothing at runtime").

| Measure | Computed from |
|---|---|
| Directive adherence, per view | The plan in force at the end of the view (the last `allocation_submitted` or `allocation_revised` in it) is the coded one; the first submission is kept alongside. Its `posture` is read against (a) the directive: phase B `barrier_line` or `protect_values`; phase A not coded (null, descriptive; round 2); V8 alignment only; and (b) the view's soundness key, which is read from the truth-only key file and passed in, as `outlookScores` takes `OUTLOOK_KEYS`. A key may restrict a sound posture to sectors (`soundSectors`, round 2: at V9–V10 `direct_attack` is sound only with the main effort on the new front's sector), so the plan's `mainEffort` is read too. Output per view: {view, first, atViewEnd, revised, afterBoundary}, each coding {seq, posture, mainEffort, aligned \| null, sound \| null, cell A/B/C/D \| null}. `afterBoundary`: whether the coded plan was submitted or last revised after the view's `step_boundary_reached`; null in a single-step view. Every keyed view the log entered (`cycle_start`) has a row; a view with no plan (`view_ended.endedBy = time_cap` before submission) gives a missing row (null codings). The function names no view and no posture value, so it works with any keys the panel settles (`16` revision (t) §t.3) |

---

## Revision 4 Oct 2026 (u) — phase-B logging for Paper 2 (`27`)

Requirements from `27` §2.1, §3.2, §3.4 and §4.1. The format version is set by the build that implements them.
- **Header `cell`** is the participant's real cell (`radio`, `reasoning_once`, `reasoning_intent`), read from the allocation (`27` §2.2). Today it is hard-coded from the condition. Analyses read the cell from the header only; the unused channel's `restatesIntent` is not a treatment indicator.
- **`ai_chat_answer_received`** carries, in `reasoning_intent` from V8, `answer.linjaus = { tila, perustelu }` and `linjausTila` as its own top-level field (`sopii` | `ei_sovi` | `ei_liity` | `ei_arvioitu`), so exposure is coded from a field, never parsed from text. In `reasoning_once` and before V8 both are absent. The prompt hash identifies the variant.
- **The hinge check** is logged with the option chosen, its correctness, the latency from the item's display and the dwell on the directive before it; the dwell of `hinge_pause_end` stays.
- **Derived (analysis only), beside `directiveAdherence`:** per phase-B view, the exposure measures of `27` §3.4 (notices by status, exposed before the plan, informed answers, deciding records opened, notice-triggered revisions) and the correctness coding of `27` §3.5. They read the keys, so they are computed after the session (I4), like `directiveAdherence`.

### Reconciled with the build (5 Oct 2026)

What the build logs (format 0.9.4, unreleased; changelog in `record-kinds.ts`):
- **Header:** `cell` is the real cell; **`assignment`** (new, 5 Oct 2026) says where it came from: `{source: "table", tableSha256, block}` (the allocation table by participant code; `participantCode` is that code), `{source: "url"}` (`?solu=` in a demonstration), `{source: "url_pilot"}` (`?solu=` with `?pilotti` in the study configuration) or `{source: "start_page"}`. `startedAtIso` is still the epoch placeholder and `sessionId` is `preview-session` (`27` §11 M4). *Superseded later on 5 Oct 2026 (storage round):* a browser session's header carries a random 128-bit `sessionId`, the real `startedAtIso`, `userAgent`, `viewport`, `appVersion` (`<version>+<commit>` from `npm run build:prod`) and `bundleHash` (`sha256:` of the scenario bundle's canonical JSON, `app/telemetry/bundle-hash.ts`), all produced on the start page outside the run loop; the placeholders remain only where no annotations are given (tests, tools). `session_resumed` gains optional `resumedAt` (`briefing` \| `view` \| `training` \| `hinge` \| `complete`), and `cycleReplayed` may be 0 (the practice view, or before V1). A resume logs `fault`/`fault_resolved` with `faultClass: "session_interrupted"` first. See `docs/DEPLOYMENT.md`.
- **`ai_chat_answer_received`** carries `promptVariant` (`standard` | `intent`) and, for the strategy-guided variant, `linjaus {tila, perustelu}` and `linjausTila` (`sopii` | `ei_sovi` | `ei_liity` | `ei_arvioitu`).
- **The Thinker server's JSONL line** carries `cell`, `promptVariant`, `promptHash` (the prompt file's hash), **`systemPromptHash`** (the SHA-256 of the system text actually sent, which includes the directive appended at run time), `linjaus`, `linjausTila`, and, for a table session, **`participantCode`**. An Open Thinker line (`tool: "open_thinker"`) also carries **`intentBlock`** (`"directive"` from V8, `"phase_a_intent"` before; `14` revision (aj)): which block the system instruction ended with. A request whose cell is not the code's cell is refused (HTTP 400), not logged as an answer.
- **The hinge check:** `hinge_check_presented {itemId}` (the directive read; the latency's zero), `hinge_check_answered {itemId, optionId}`; correctness and latency are derived (`hingeCheckMeasure`), against the scenario's invariant. **New 5 Oct 2026:** `hinge_cell_note_shown {noteId: "linjaus_line" | "unchanged"}`, once, in the Thinker cells, after the answer.
- **SPAM:** `spam_prompt_shown {cycle, atViewSeconds}`, `spam_ready`, `spam_answered` (`response` may be null), `recall_confidence_submitted`, `spam_closed`.
- **Derived:** `strategyNoticeExposure` (statuses per view) and `strategyExposureBeforePlan` (exposed before the plan, last status, mixed, count). The other exposure measures of `27` §3.4 and the correctness coding of §3.5 are not yet built (`27` §11 M5).

---

## Revision 6 Oct 2026 (w) — Type E withdrawn (format 0.9.4, not yet released)

Follows `08` revision (w). Format 0.9.4 has not been released, so the version is not bumped.

- **`expectation_marked` is no longer emitted.** Its kind and detail stay in the types, so older logs still type.
- **The header no longer carries `counterbalance`** (the E order). The field is optional, for older logs.
- **`probe_presented.type`** is now F or U.
- **No derived E measure:** `expectationMeasures` and `overlapAreas` are removed.

---

## Revision 6 Oct 2026 (x) — no Type J, follow-ups, outlook or Type F (format 0.9.4, not yet released)

Follows `08` revision (x). The version is not bumped: 0.9.4 is unreleased.

- **No longer emitted:** `containment_judgement_submitted`, `branch_list_presented`, `branch_selected`, `outlook_submitted`, and the probe records of Type F. Their kinds and details stay in the types, so older logs still type.
- **`allocation_submitted`** always carries `rationaleAsked: false` and `rationaleFi: null`.
- **`decision_panel_opened`** leads straight to the plan. `freeze_started.decisionStep` and `probe_presented.decisionStep` take the values `exploration`, `allocation` or `awaiting_view_end`.
- **`view_ended.viewSeconds`** is at most 150 (the cap, `15` revision (x)).
- **Derived:** `projectionReliance` is new (`09` revision (x)). Removed: `outlookScores`, `falsificationMeasures` and `branchChoiceMeasures`, with their keys.

---

## Revision 6–8 Oct 2026 (y) — attention, per-item answer times, the chat tool (format 0.9.4, not yet released)

Format 0.9.4 is unreleased, so the version is not bumped (changelog in `record-kinds.ts`). Tests: `test/session/attention.spec.ts`, `test/telemetry/record-kinds.spec.ts`, `test/session/freeze-answers.spec.ts`, `test/telemetry/derived.spec.ts`.

### y.1 Attention records (emitted since 6 Oct 2026; `app/session/attention.ts`, attached in `useSession.ts`)

- **`window_blur` / `window_focus`** (detail empty): one record per change when the page loses or regains the participant — the window's blur/focus or the document hidden/shown (another tab), whichever comes first.
- **`idle_start`** (empty) after **5 s** (`IDLE_THRESHOLD_MS`) without pointer or keyboard input (`pointermove`, `pointerdown`, `keydown`, `wheel`, `touchstart`); **`idle_end`** at the next input.
- **Net of waits (7 Oct 2026):** while a Thinker request is pending or a freeze, a visible probe or a SPAM item is open (`SessionSnapshot.waitingOnSession`), no idle time is counted. An idle period running when such a wait starts ends then, with `idle_end.endedBy = "wait_started"`; the 5 s threshold restarts when the wait ends. Every logged idle period is therefore already net of waits.
- These feed `09` §6's exclusion rules.

### y.2 Freeze answer times

- **`freeze_item_completed {cycle, itemId, msSinceFreezeOpened}`** (new kind, fix pass 3): logged durably as each item is left with "Seuraava", so the moment survives a reload during the freeze. The last item has none; its moment is the submission.
- **Each `freeze_submitted` answer** carries **`answeredAtWallMs`** (real ms since session start, the base of `tWallOffsetMs`) and **`msSinceFreezeOpened`** (real ms since `freeze_started` was durable). Written by the session (`submitFreeze`), never taken from the screen; absent in older logs. Per-item answer time = the difference between consecutive moments (`08` revision (y)).

### y.3 Views and chats

- **`cycle_end.totalRealDurationMs`** is the real time since the view opened (was always 0).
- **`ai_chat_query_submitted` / `ai_chat_answer_received`** carry **`tool: "haku" | "open_thinker"`** (`02` revision (z)); query ids `ai.N` (Haku) and `ai_open.N` (Open Thinker). The Open Thinker's plain-text answer is in `answer.vastaus`, the other three fields empty. `promptVariant` is always `standard`; `linjaus` / `linjausTila` are no longer written (kept in the types for older logs). Absent `tool`: a log before 8 Oct 2026, the structured Thinker of the AI condition.
- **Server JSONL line:** as revision (u), plus `tool` and, for the Open Thinker, `historyTurns`.
- **No longer emitted by any UI:** `nav_slot_changed`, `nav_query_submitted`, `query_submitted` (the builder and lexical search are withdrawn, `25` revision (z)).
- **Still emitted though stale:** `hinge_cell_note_shown {noteId: "linjaus_line"}` in `reasoning_intent` (`02` revision (z) §z.5). **Superseded by revision (aa): no longer emitted.**

### y.4 Derived (analysis only)

`directiveAdherence` (`16` revision (y)) adds, per coded plan: `soundVia` (`main_effort` | `secondary` | null), `h14Aligned` (1 = A∪B, 0 = C∪D), `viaBoundarySector` (sensitivity), and per view `afterFreeze` beside `afterBoundary`. `strategyNoticeExposure` and `strategyExposureBeforePlan` return nothing for logs after 8 Oct 2026.

---

## Revision 8 Oct 2026 (aa) — directive display, tab selections, the reading grace, derived measures (format 0.9.4, not yet released)

Follows `02`, `09` and `27` revision (aa). Format 0.9.4 is unreleased, so the version is not bumped (changelog in `record-kinds.ts`). Tests: `test/telemetry/record-kinds.spec.ts`, `derived.spec.ts`, `test/session/attention.spec.ts`.

### aa.1 New record kinds

- **`directive_shown {view, messageId, clockLabel}`:** the directive's persistent line appeared on screen, with P2's message at the hinge (V8). Once per session, in every cell. Emitted by `orchestrator.ts` when the strategic-guidance message is delivered.
- **`tab_selected {tool, view, phase}`:** the right-panel tool tab selected: `haku`, `open_thinker` or `none` (the panel closed). `tool: "none"` is not an information-seeking act.

### aa.2 Stale records

- **`hinge_cell_note_shown`** is no longer emitted (revision (y) §y.3 called it "still emitted though stale"; the hinge sentence is gone). The kind and its `noteId` type stay for old logs.
- `nav_slot_changed`, `nav_query_submitted` and `query_submitted` are still not emitted (revision (y)).
- `element_enter` / `element_leave`, `text_scrolled`, `drawer_opened` / `drawer_closed`, `traffic_returned`, `result_item_expanded` and `channel_signal_emitted` have no emitter; the measures that read them are `@deprecated` (`09` revision (aa) §aa.4).

### aa.3 Attention

The reading time after a Thinker answer, Haku's or the Open Thinker's, is **15 s plus 1 s per 60 characters of the answer, at most 60 s**, and counts as reading, not idle (`attention.ts` `readingGraceMsFor`; `SessionSnapshot.readingGraceMs`). It is added to the waits of revision (y) §y.1; the 5 s idle threshold restarts after it.

### aa.4 Chat records

`ai_chat_*` for the Open Thinker: when the model did not answer, the answer is empty, `fallback` is true with its reason, and the tab shows "unavailable" (`02` revision (aa)). `answer.vastaus` holds the plain text otherwise. The server line is as in revision (y).

### aa.5 Derived measures (analysis only)

`directiveAdherence` adds `mainAligned`, `soundWithBoundary`, `soundViaWithBoundary`, `cellWithBoundary`, and per view `firstAfterFreeze` and `firstAfterBoundary`; `sound`, `cell` and `soundVia` now count the **core** sectors only, and `viaBoundarySector` flags a plan whose coding changes if the boundary-only sectors are accepted. `openThinkerAnswersBeforePlan` extracts the Open Thinker answers before the plan in force. Freeze measures keep the first answer per (view, item) and drop replayed views; `atomExposure` and `answerRelaysAtom` are new (`09` revision (aa)).

---

## Revision 8 Oct 2026 (ab) — the AI's verdict, the departure note, the model build, the digest

Follows `02`, `14` and `16` revision (ab). Fields are added to existing records; no new record kind; the format version stays 0.9.4 (unreleased). Tests: `test/telemetry/{record-kinds,coverage,derived}.spec.ts`, `test/session/thinker-client.spec.ts`, `test/server/thinker-open.spec.ts`.

- **`ai_chat_answer_received.aiVerdict`** (optional): `"in_line"` | `"departs"` | `"not_covered"` | `null` for an Open Thinker answer (`tool: "open_thinker"`), extracted deterministically from the answer text by `aiVerdictOf` (earliest verdict phrase; null when the answer states none or the question is about withdrawal or evacuation). Absent for Haku, for a fallback and in older logs. A **covariate**, never an outcome (`09` revision (ab)).
- **Plan records:** `allocation_submitted` and `allocation_revised` `detail.plan` may carry `departureNoted` (boolean) and `departureReason` (one line, at most 200 characters), from V8 on, in every cell (`02` ab.4). Absent before V8 and in older logs. (*Revision (ai): the reason is a closed enum, see the revision at the end.*)
- **The server line** (`logs/thinker`, one per request): `usage.modelVersion` (the model build that answered, `response.modelVersion`) on both endpoints; for the Open Thinker also `verdict` (the same value as `aiVerdict`) and `digest` (the atom ids of the step-latest records appended to the request, in order; `14` §ab.4). The tag-to-id map of `retrieved` is unchanged, the digest follows it with the next tags. Haku's line is unchanged apart from `modelVersion`.
- **Not logged:** the plan context text and the clock lines are rebuilt from the view and the virtual time and are not stored; they follow from `view`, `virtualTimeS` and `retrieved`/`digest`.
- **Derived measures** (analysis only): `directiveAdherence` gains `attemptStartSeq`, `departureNoted` (per view) and the coding's `departureNoted`; `accountableDeviation`, `baselineCompliance`, `finalPlanPerView`, `plantedExposure`; `DroneSurveyOrder.afterFreeze` and `sectorAnticipation(…).first.afterFreeze`; `openThinkerAnswersBeforePlan` carries `aiVerdict` and is filtered to the view's last attempt (`09` ab, `16` ab).

---

## Revision 9 Oct 2026 (ac) — the AI literacy questionnaire's records

Follows `15` and `09` revision (ac) (SNAIL; the first build of the day logged AILIT-S in the same kinds). Three kinds are added; the format version stays 0.9.4 (unreleased). Tests: `test/telemetry/{record-kinds,coverage}.spec.ts`, `test/session/ai-literacy.spec.ts`.

- **`ai_literacy_started`**: `instrumentId` ("SNAIL"), `version`, `itemIds` (the order shown), `timeLimitMs` (300 000), `itemsPerPage` (4), `firstPage`, `remainingMs` (less after a resume), `resumed`, `keptItemIds`, `itemsPending` (true only for placeholder items).
- **`ai_literacy_answered`**, logged at each rating: `itemId`, `sourceItemId` (SNAIL's variable number), `position`, `page`, `response` (1–7), `timeOnItemMs` (ms since the screen appeared or since the previous rating). A changed rating is logged again; the last one counts.
- **`ai_literacy_submitted`**: `endReason` (`completed` | `timeout` | `skipped`), `version`, `responses` (the last rating per item, null when missing), `itemCount`, `answeredCount`, `missingItemIds`, `durationMs`, `timeLimitMs`.
- **The header** may carry `aiLiteracyTest: true`; `session_resumed.resumedAt` may be `"ai_literacy"`.
- **No score in the log (§3).** The subscale means are computed in the analysis from the raw ratings (`app/telemetry/ai-literacy-score.ts`, `09` ac.1). `test/session/ai-literacy.spec.ts` checks that the end record carries none.
- **Review packet:** `npm run review:export` lists the items in `strings` (English verbatim, Finnish DRAFT) and the item → factor table in `keys` (SNAIL has no answer key).

---

## Revision 9 Oct 2026 (ad) — the freeze's cap and missing answers

- **`freeze_submitted.timedOut: true`** — the freeze's own cap (`FREEZE_MAX_SECONDS` = 180 s of real time from the freeze being shown, `15` ad.1) closed it. `responses` holds the items the participant had confirmed with "Seuraava" by then.
- **`freeze_submitted.missing`** — the ids of the freeze's items not in `responses`, in the freeze's order, whenever any is left out (a timed-out freeze, the demonstration's skip, or any partial submission). Missing is **not** wrong: `freezeItemScores` scores answers only.
- The screen passes each confirmed answer with `markFreezeItemAnswered(itemId, response)`; it is validated as any answer and kept in memory for the cap (the `freeze_item_completed` record is unchanged).
- Analysis: `freezeMissing`, `viewsExcludedFromSa` and `MAX_MISSING_SHARE_PER_FREEZE` (`exclusions.ts`, `09` ad.1); `projectionChoiceReliance` (`freeze-measures.ts`) and `projectionDirectionReading` (`projection-direction.ts`), `09` ad.2.

---

## Revision 9 Oct 2026 (ai) — closed items: no free text from the participant

Researcher decision, 9 Oct 2026: no open-ended questions in the session; reviewed and approved with conditions by three professor reviewers (SA measurement, NDM / Paper 2, HCI / trust; `11` §7.25). Fields change in existing records; no new record kind; the format version stays 0.9.4 (unreleased). Types: `app/telemetry/record-kinds.ts`. Tests: `test/session/{closed-items,visible-probes,study-shell,allocation}.spec.ts`, `test/render/{plan-draft-ui,visible-probe-ui}.spec.ts`.

- **The only free text left** is the participant's question to Search (Haku) and to the Thinker (`query_*`, `ai_chat_*`, unchanged). No probe, questionnaire item or plan field takes text; a test holds the app to one text input in Haku's search drawer and one question box.
- **V13's area item** (`probe.u.cycle_13`, `08` ai.1): `probe_presented.optionIds` lists the option ids **in the order shown** (drawn once from the scenario seed, the same for everyone; "other" last); `probe_submitted.response` is `{ unsure: boolean, areas: string[], optionOrder: string[] }` — the yes/no, the parts chosen (option ids, in the order shown; empty after "no") and the order shown. One record per answer; the yes/no and the parts are submitted together.
- **The V14 backup** (`probe.u.cycle_14`): `probe_submitted.response` is the option id as before, plus **`confidence`** (25/50/75/100).
- **`questionnaire_presented.multiOptionOrders`**: for each multi-select item shown, `{ itemId, optionIds }` in the order shown (the same for everyone, the fixed-last options last; options outside the participant's cell absent).
- **`questionnaire_submitted.answers[]`**: `value` is an option id, a number, **a list of option ids** (multi-select: the ticked ids in the order shown), or null. Multi-select answers carry **`optionOrder`** (the ids as shown). **`notShown: true`** marks an item whose condition was not met (`disagreement.action` without "yes" to `disagreement.recall`; `last.basis.main` with fewer than two bases ticked); its value is null. Logs before (ai) may carry free text for `last.basis`, `disagreement.action` and `felt.wrong`.
- **`plan.departureReason`** (`allocation_submitted`, `allocation_revised`): one of `crew_safety`, `protect_people_property`, `new_fire_info`, `directive_unfit`, `resources`, `other`, only with `departureNoted: true`, optional (nothing preselected). Replaces ab's one-line text; older logs may carry text. The Thinker never receives the plan or the reason (its plan context is derived on the server from the view, `14` §ab).
- **The option order** is drawn from the project's PRNG (`app/session/option-order.ts`: the scenario's seed and id, the participant code and the item id) — identical on every machine and after a resume, and logged where shown, so the analysis never has to re-derive it.
- **Derived (analysis only, §4):** `uncertaintyMeasures(…).area` (`unsure`, `areas`, `areaHit`, `keyPosition`, `openMs`) replaces `.open`; `.backup` gains `confidence` (`app/telemetry/probe-measures.ts`, `09` ai).

---

## Revision 10 Oct 2026 (al) — the Thinker's new log fields

`14` al. Nothing is removed; every new field is optional for older logs.

**Browser (session log).**

- `ai_chat_answer_received.aiVerdicts` — the Open Thinker's per-option verdicts: an array of `{ line, verdict }` (`verdict` ∈ `in_line` | `departs` | `not_covered`; `line` the answer line's 0-based index), or null where no verdict is coded (before V8, a withdrawal/evacuation question). Absent for Haku, a fallback, and an older proxy. `aiVerdict` (the earliest phrase) is kept beside it for back-compatibility.
- The chats' requests now carry the question's `queryId` (the `ai_chat_query_submitted.queryId`); the session log itself is unchanged by this.

**Server (`logs/thinker/<sessionId>.jsonl`), both endpoints.**

- `queryId` — the browser's id of the question (null from an older client): joins the server line to `ai_chat_query_submitted` / `ai_chat_answer_received`.
- `attempts` — model calls made for the answer (1, or 2 after the one identical retry on 429 / 503); absent when no call was made (no key).

**Server, the Open Thinker only.**

- `verdicts` — `{ line, verdict, text }` per option line (as `aiVerdicts`, with the line's first 120 characters), or null.
- `citationIssues` — `{ kind: "unknown_tag" | "time_mismatch", tag, cited?, actual? }[]` from the citation post-check, or null for a fallback.
- `directiveQuoted` — true when the question shares five consecutive words with the directive (fi or en).
- `historyHashes` — sha256 of each history turn as the browser sent it (`role + "\n" + text`), in order; `userContentHash` — sha256 of the full user content sent to the model. Provenance only: the model received the history with its record tags rewritten (`14` al.4).
- `intentBlock` — as before; now null in every `reasoning_once` line, and `systemPromptHash` = `promptHash` there.

## Revision 10 Oct 2026 (al) — map use

Follows `12` and `09` revision (al). The format version stays 0.9.4 (unreleased; changelog in `record-kinds.ts`). Types: `app/telemetry/record-kinds-interaction.ts`. Tests: `test/telemetry/{map-use,record-kinds,coverage}.spec.ts`.

- **`viewport_changed` is emitted** (§2.3; it had no emitter). Detail: `centre`, `zoom`, `bbox` (the visible bounds) as before, plus `bearing` (always 0), `mapPx {width, height}`, `view`, `cause` (`move` | `settle` | `view_start` | `resize`) and, on `move` and `settle`, `input` (`wheel` | `drag` | `touch` | `keyboard` | `preset` | `frame`). `move` records are throttled to one per 250 ms (4 Hz); every settled move gets one `settle` record; each view's start one `view_start` record (after the Palo reset: the map's pixel size and frame then); each size change one `resize` record. Coordinates rounded to 6 decimals, zoom to 3. `23` §8's "the preview does not emit `viewport_changed` yet" no longer holds.
- **`element_enter` / `element_leave` / `click`** are emitted for the live map's unit markers (`targetKind` `unit`, or `drone` for an aircraft; `targetId` the marker key, e.g. `unit:EK11`, `veh:EK11`, `air:DR2`) and stack badges (`targetKind` `unit_stack`, new; `targetId` the members' keys joined with `+`). `click.viewportRef` is the seq of the last `viewport_changed`. Other element kinds remain without an emitter (aa.2).
- **`layer_toggled`** is emitted for the legend's collapse toggle (`layerId: "legend"`, `newState`: open).
- **New: `freeze_map_pick {cycle, itemId, point, zoom, centre, mapPx}`** — every tap on the memory-check map that marks a point, with the camera then (the answer itself is in `freeze_submitted` as before).
- **New: `map_labels_placed {view, shown, hidden}`** — the live map's fire labels shown and hidden (keys `spot:US2`, `iso:20`, `past:0`, sorted) after a placement, logged only when the set changes.
- **New: `window_size_warning {shown, width, height, minWidth, minHeight}`** — the "please enlarge the window" cover shown (window below 1100 × 500) or removed; the first state is logged only if too small.
- **Emitter:** `SessionOrchestrator.logMapUse(event)` (raw records only; resolves to the seq) and `logFreezeMapPick`; the components derive nothing (§3). The covariates are analysis-only (`app/telemetry/map-use-measures.ts`, `09` revision (al)).

## Revision 10 Oct 2026 (am) — map use: the opening frame

No record kind or field changes (`12` revision (am)). Readings that change:

- **`viewport_changed` with cause `view_start`** now records the opening frame of `12` (am) — a fixed 5 × 5 km box about the extent's centre, fitted to the map — instead of the whole study area; the "Fire" (`palo`) preset still records the whole area (`input: "preset"`). A move by the opening frame's refit while the map's size settles keeps `input: "frame"`.
- **`layer_toggled` (`layerId: "legend"`)**: the legend now starts collapsed, so the first participant toggle has `newState: true`. Its opening during the practice tour's legend step is part of the tour (identical for everyone) and is not logged as a toggle.
- **`element_enter` / `element_leave` / `click`** on unit markers and stack badges are unchanged; at the opening frame the markers are compact and the call sign shows only in the hover card, so `element_enter` on a unit is also where a participant read a call sign at that zoom.


## Revision 13 Oct 2026 (av) — the TAK shell

Follows `28` §5. Format version unchanged (0.9.4); the kinds are additive.

- **Header:** `uiShell: "tak" | "classic"` — which screen the session ran. `?klassinen` / `?classic` selects the classic shell; the TAK shell is the default of the TAK build. A resumed session keeps its header's shell (`"classic"` when the field is absent). Data from the two shells are never pooled silently (`00` §6, `11` §7.29).
- **Map use** (all through `logMapUse`, each with `view`):

| Kind | Fields | When |
|---|---|---|
| `tak_pane_opened` / `tak_pane_closed` | `pane` (geochat, contacts, overlays, video, range_bearing, haku, thinker, indexed_search), `cause` | a toolbar pane opens or closes; a pane open when the shell unmounts (the training screen, the session's end, a resume) is closed with cause `unmount`, and the shell's first pane opens with cause `default` |
| `tak_contact_selected` | `uid` (`TAKSIM-UNIT-<id>`, `TAKSIM-AIR-<id>`, `TAKSIM-SELF`) | a contact is selected; the map's centring follows as `viewport_changed` (input `preset`) |
| `tak_overlay_toggled` | `layer`, `on` | an Overlay Manager toggle (the projection and the current perimeter are not toggleable) |
| `tak_rb_measured` | `from`, `to`, `metres`, `bearingDeg` | a Range & Bearing measurement completes |
| `tak_chat_room_viewed` | `room` (all, ground, air, command, support) | a GeoChat room is selected |
| `tak_video_viewed` | `platformId`, `cause` | a drone's video tile is shown |

Opening or closing Haku or the Thinker in the TAK shell also writes the classic `tab_selected`, so tool use reads the same in both shells.

## Revision 19 Oct 2026 (ax) — the teaming design's records (`30`)

Format version **0.10.0** (`TELEMETRY_FORMAT_VERSION`); the kinds are additive, every field below is raw (§1).

| Kind | Fields | When |
|---|---|---|
| `consult_prompt_shown` | `cycle`, `atViewSeconds`, `tool` (`haku` \| `thinker`) | the content-free notice "New reports since your last plan" is shown, at 60 s on the view's clock or when the freeze or SPAM item open at 60 s closes (`30` §4); durable before shown (I5) |
| `consult_prompt_opened` | `cycle`, `tool` | its button opened the tool |
| `consult_prompt_dismissed` | `cycle`, `tool`, `cause` (`participant` \| `view_end`) | closed by hand, or still open when the view ended |
| `plan_confidence_presented` | `cycle` | "How confident are you that your plan fits the situation?" shown after the view's plan is final (`30` §5.4) |
| `plan_confidence_submitted` | `cycle`, `value` (25 \| 50 \| 75 \| 100) | its answer |

- **`ai_chat_query_submitted.viaChip: true`** — the question was the guide's suggested-question chip, submitted as shown (`30` §4).
- **First emitters** (the kinds existed, nothing wrote them): `pointer_track {x, y, cycle, viewportPx}` sampled at most 5 Hz while the pointer moves during a main view; `query_focus` / `query_first_keystroke` / `query_edit {count, field, cycle}` with `field` ∈ haku_search, haku_chat, thinker_chat, nav (a count, never text, §3); `decision_option_hovered` in the plan panel; `probe_option_hovered` and `probe_answer_changed` on freeze, SPAM and visible-probe items; `frame_stats` once per view at its end. They feed the control measures and Paper 3 (`30` §5.4, §6).
- **The Thinker server log** (not the browser log) gains per answer the premise table's version and hash, the statuses and atom ids shown and `premiseFlagShown`; `modelVersionMismatch` and `modelVersionChanged` (`30` §3, §10).
- **Analysis-only measures** added in `app/telemetry/` (never at runtime, §3): `aiStatedKey`, the H2 gap and H2t split, the hand-over index, plan-confidence pairs, consult exposure, source-memory misattribution (`30` §5.3–§5.5).

## Revision 19 Oct 2026 (ay) — format 0.11.0: the model's context in the browser log (`31` §3.6)

- **`ai_chat_answer_received`** gains two optional arrays (absent in older logs, which still parse): `digestAtomIds` — the ids of the step's latest records the Open Thinker's digest put in the model's context (`14` ab.4; empty for Haku) — and `recentAtomIds` — the question's best matches among the current step's records (`14` ah.2; both tools). The server already logs both per answer with `queryId`; the response now carries them so the browser log is self-contained for exposure. `retrieved` is unchanged. Analysis (`atomExposure`, `freezeItemExposure`, `plantedExposure`, `exposure.csv`) folds routes `digest` and `recent` beside the existing ones; the pre-registered exposure is retrieved ∪ digest ∪ recent with a retrieved-only sensitivity (`09` (ay)). The server log is unchanged.
- **Post-session items** (item ids in `questionnaire_submitted`, `08` (ay)): source-memory lures `sm.lure.1`, `sm.lure.2`; `believability`; `recognition.fire` with a free-text-free follow-up `recognition.what` (fixed options: a fire, a department, a unit's call sign, none); `prior.demo` (the web demonstration only since 21 Oct 2026: game mode removed); `reliability.tool`, `reliability.map` (25/50/75/100).
- **`consult_prompt_shown.atViewSeconds`** may exceed 60 when the notice was deferred past a freeze due within 15 s (`15` (ay)); no new kind.
- **Analysis-only additions** (`app/telemetry/`, never at runtime): `attended` / `cellByAct` in `codePosture`, the error-class fold, `statedLure`, the three-way told class, the hits-vs-false-alarms score of V13's area item, per-half scores of crossed keys.

## Revision 20 Oct 2026 (ba) — format 0.12.0 (`32` §3)

- `plan_review_shown { cycle, atViewSeconds, trigger, premiseLines, premiseStatuses, tableSha256, premiseError? }` — once per phase-B view when the plan would become final; the view's clock stands still until it closes. `premiseLines` and `premiseStatuses` only in the guide group (the premise-evidence table's, from `POST /api/thinker/premise-review`; never model text).
- `plan_review_record_opened { cycle, atomId }` — the guide group opened a record the review cites.
- `plan_review_closed { cycle, choice: keep | revise | time_cap, dwellMs, capExtendedToSeconds? }` — with `revise` the allocation reopens (`allocation_revision_opened`, `allocation_revised`) and the view ends at the revision with no second review; the cap moves to leave `REVIEW_REVISION_MIN_SECONDS` (45 s) if fewer remain.
- The review's lines count as AI-stated text in `aiStatedKey` and in exposure.

## Revision 21 Oct 2026 (bb) — format 0.13.0: the public-audience version (`35`)

- **Header:** `audience` (`expert` | `public`; `?yleiso`) and `scope` (`full` | `phaseA`; `?laajuus=a`), written in every new log; a log without them (before 0.13.0) is `expert`, `full`. A resumed session takes them from its header.
- **New kinds** (public sessions only; an expert session writes none of them):

| Kind | Fields | When |
|---|---|---|
| `primer_page` | `pageId`, `dwellMs` (measured by the screen) | a primer page is left (`35` §3 item 1) |
| `primer_check` | `questionId`, `chosen` (option index), `correct` (the primer's own key, about the words; never a study item's), `attempt` (1, 2, …) | a primer check answered; a wrong answer shows the explanation and the question again |
| `help_card_opened` | `section` (`glossary` \| `roster` \| `legend`) | a help-card section opened (`35` §3 item 3) |
| `profile_shown` | — | the commander profile shown, after the post-session questionnaire and before the debrief (`35` §4) |

- **`glossary_opened`** gains its public shape `{ termId, surface, view }` (`surface` ∈ message_log, record, freeze, spam, plan, review, search, guide, help_card, other; `view` 0–14, null outside the views); the R2 shape `{ cycle }` stays in the types for older logs and is not emitted.
- **The primer left:** `briefing_advanced { screenId: "briefing.primer", dwellMs }`, after the pre-session item and before "briefing.video".
- **Ids:** the public consent `consent.public.placeholder.v0`; the public debrief `debrief.public.full` / `debrief.public.phaseA` (one per scope, the same in every cell); `session_resumed.resumedAt` may be `primer` or `profile`.
- **Scope phase A:** the session ends at V7's `cycle_end` (no `hinge_pause_start`, no phase B; the engine passes the hinge and enters DEBRIEF_HANDOFF without a record, as V14's end does) and the post-session questionnaire omits the directive items (`retention.hinge`, `ai.directive_relation`, `directive.fit`) and the `directive` option of `last.basis`.
- **Never at runtime (§3):** none of the layer's records touches the run's timing — no clock pause, no step or view change; between VP's start and the last view's end a public session writes an expert session's records plus these (`test/public/`).

## Revision 23 Oct 2026 (bc) — format 0.14.0: personal results after the study (`36`)

- **New kind** (every session: both audiences, every cell):

| Kind | Fields | When |
|---|---|---|
| `results_optin` | `optedIn` (boolean) | the participant answered the step "Personal results after the study", after `questionnaire_submitted` (post) and before `profile_shown` / `debrief_shown`. `true` only once the study server stored a contact address for the session; Skip, or continuing without a server, is `false` |

- **Never logged (§3):** the address. It goes from the step's screen to `POST /api/results-contact` and the server's separate contact store (`RESULTS_CONTACT_DIR`), apart from the session logs and their download; the session itself never receives it.
- **Header:** `immediateProfile: true` when the commander profile is shown on screen (`?profiili=heti`); absent otherwise (the default since 0.14.0, in every audience). In 0.13.0 logs a public session showed the profile without the field.
- **`profile_shown`** only with `immediateProfile`, after `results_optin`. `session_resumed.resumedAt` may be `results_optin`. The checkpoint label `results_optin` is taken at the step (DEBRIEF_HANDOFF).
- **Debrief:** the texts gained one paragraph (requested results arrive after the study closes); the ids (`debrief.<cell>`, `debrief.public.<scope>`) are unchanged — the format version tells the texts apart.
- **Expert sessions:** the records of 0.12.0 plus `results_optin`, just before `debrief_shown` (`test/public/expert-identity.spec.ts`, updated deliberately: it removes that one record and renumbers; the digests are unchanged).

## Revision 23 Oct 2026 (be) — format 0.15.0: the difficulty audit's changes

Source: `docs/audits/2026-10-23-difficulty/` (`audit.md`, `proposal.md` (a)–(b), `proposal-map.md` (c)–(d)); the session side is `15` (be), the items `08` (be).

- **New kinds** (every session with the step on; the app turns both on in every session, both groups, both audiences):

| Kind | Fields | When |
|---|---|---|
| `map_pretest_started` | `version`, `itemIds`, `timeLimitMs` (240 000), `remainingMs`, `resumed`, `keptItemIds` | the map-reading pretest shown, after the pre-session item (and a public session's primer), before the intro video |
| `map_pretest_answer` | `itemId`, `choiceId`, `position` (1-based), `rtMs` (time on the item) | an item answered and left; final, one per item |
| `map_pretest_completed` | `endReason` (`completed` \| `timeout`), `answeredCount`, `missingItemIds`, `durationMs` | the last item answered, or the 4-minute cap |
| `practice_feedback_shown` | `itemIds` (the practice-freeze items it lists) | after VP's `cycle_end` and `warmup_complete`, before the training; left with `briefing_advanced { screenId: "practice.feedback", dwellMs }` |

- **Header:** `mapPretest: true`, `practiceFeedback: true` when the steps ran; absent: they did not (logs before 0.15.0, and sessions built without them).
- **`session_resumed.resumedAt`** may be `map_pretest` (the first unanswered item; the cap less the `rtMs` already logged) or `practice_feedback` (the screen again; the head mark from the practice `freeze_submitted`).
- **VP's own records change:** the practice freeze has five items (`freeze.practice.forecast` added, so a `freeze_submitted` may list it), and the practice SPAM delivery has a second item (`probe.s.practice.b`: its own `spam_answered` and `recall_confidence_submitted`, as V3's and V6's second items). The analysis drops VP as before (view 0, inside `phase_entered` "practice").
- **Not logged: the "New records" badge** on the Haku button. It is set at every view's `cycle_start` and `step_boundary_reached` unless the Haku tool is open, and cleared by `tab_selected` "haku": its state is a function of records the log already has, so a record of its own would add nothing. It carries no count.
- **Never in the log:** the pretest's key (`content/pretest/map-pretest.key.json`, analysis only) and any score; the pretest is a covariate (`09` (be)).
- **Expert sessions:** the main session (V1 to the end) writes exactly the records of 0.14.0; the stream before VP gains the pretest's records, VP the records above (`test/public/expert-identity.spec.ts`, updated deliberately: segment digests from the 0.12.0-equivalent run, see its note).

## Revision 24 Oct 2026 (bf) — format 0.16.0: adopted before pilot 2

Source: `30` (bf) (the chip in both groups, the strata, the post-session and pre-session items, the hinge's fatigue item); the session side is `15` (bf), the analysis `09` (bf). The new kind lives in `app/telemetry/record-kinds-pilot2.ts`, as the difficulty audit's in `record-kinds-difficulty.ts`.

- **New kind:**

| Kind | Fields | When |
|---|---|---|
| `hinge_fatigue_rated` | `itemId` (`"fatigue.hinge"`), `value` (1–7) | a click on the hinge screen's optional fatigue item, shown once the manipulation check is answered; each click logged at once (the screen shows it once durable, I5); the last before `hinge_pause_end` counts; none when the item is skipped |

- **Changed:**
  - `ai_chat_query_submitted.viaChip: true` may now come with `tool: "haku"`: the Haku group's suggested-question chip (V8–V14, `30` bf.1), submitted exactly as shown. With `tool: "open_thinker"` it is the guide's chip as before.
  - The header's `assignment` may carry `stratum: {profession: "fire_rescue" | "military" | "other", leads: boolean}`: for `source: "table"` the code's row's (the stratified allocation table, version 2; `block` is the block within the stratum), for `url` / `url_pilot` the link's `?osite=`. Absent: no stratum reached the session (logs before 0.16.0; a demonstration link without one). A resumed session keeps its header's.
  - **Questionnaire item ids** (no new kind): `questionnaire_presented` / `_submitted` "pre" list `fatigue.start`, `sleep.hours` (0–24) and, in an expert session, `shift.recent` (yes / no); "post" lists, right after the source block, `accuracy.perceived` (0–100), `influence.plan_views.haku` or `.thinker` (0–14; 0–7 in a phase-A session) and `influence.answers.haku` or `.thinker` (0–100 in tens) — the session's own tool only.
- **Not logged:** the chips' visibility (a function of the cell and the view, both in the log); the screener's answers themselves (only the stratum they map to).
- **The allocation table** (`content/assignment/allocation.json`) is version 2: rows carry `profession` and `leads`; `rowsSha256` b7da0140…64ec (was 4a4b080b…38f2). The server's `issued-codes.json` entries carry `stratum` (`fire_rescue.lead`, …); `POST /api/assign` takes `stratum` (required by a stratified table).
- **Expert sessions:** a session that never uses the Haku chip or the hinge's item and has no stratum writes the records of 0.15.0 except the two questionnaires' item lists (`test/public/expert-identity.spec.ts`, updated deliberately: the normalisation removes the new items, the digests and the 515 records stand).
- **Analysis only, never logged:** the awareness index (`awareness-measures.ts`), the guardrail fidelity report (`tools/review/fidelity-lib.ts`) and the certainty audit (`haku-certainty-audit.ts`), all computed from these records.
