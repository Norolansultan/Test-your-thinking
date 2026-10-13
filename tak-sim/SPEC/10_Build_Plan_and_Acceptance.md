# 10 — Build plan and acceptance

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). New document. Replaces the build-order and testing sections of `02_Architecture_v2.md`.

> **Changelog**
> - **25 Sep 2026 (q)** — pilot 1 checks how often the designed events reach AI participants (`14` revision (q)).
> - **23 Sep 2026 (j)** — radio removed (`02` revision (j)): radio module and responder dropped; route tests restated; new no-ask checks. See the revision at the end.
> - **17 Sep 2026 (g)** — tests for `19`.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — M5–M8 and M10 extended for `14`, `15`, `16`.

---

## 1. How to use this

Each milestone has a **definition of done** consisting of named automated tests. A milestone is not complete because the feature works; it is complete when its tests pass in CI and the golden fixtures are committed.

Milestones M1–M4 can proceed while the scenario is being authored. **M5 onward is blocked on authored content**, and `substitutive` specifically is blocked on the channel vocabulary (`11` §1.3).

---

## 2. Milestones

### M1 — Engine and determinism

Virtual clock, cycle sequencer, seeded PRNG, freeze state machine including both probe modes and `HINGE_PAUSE`, append-only log with the self-describing header.

**Done when:**

- `test/golden/engine.spec` replays three reference input sequences and produces byte-identical logs against committed fixtures.
- `test/lint/determinism.spec` asserts no banned API is reachable from `engine/`.
- `test/log/gapless.spec` asserts `seq` gaplessness under induced storage failure.
- The freeze machine's transition table is exhaustively tested including `FAULT_PAUSED` from every state.

### M2 — Scenario contract and validator

Contract loader, the construction-throws list (`04` §2), and the CI validator implementing all fourteen checks in `03` §11.

**Done when:**

- `test/validate/contract.spec` asserts every throw case individually.
- `tools/validate` runs against a fixture scenario and against a set of deliberately broken scenarios, failing each for the expected reason.
- The truth-boundary static guard (`04` §9 `_Check`) compiles.

### M3 — Render boundary and map

`toRenderable`, the three I4 guards, MapLibre with PMTiles from the bundle, the stepped world model, change highlighting, validity-horizon rendering, staleness and certainty encoding.

**Done when:**

- `test/boundary/no-truth.spec` walks the live render tree at every logged `seq` of a golden run and asserts no reachable object contains any `TruthAnnotation` key.
- `test/render/epsg.spec` asserts no reprojection occurs at runtime and that a known coordinate lands within one metre of its expected pixel.
- `test/render/unknown.spec` asserts `unknown`, `absent`, `zero` and `stale` render distinctly.
- The six symbology tests in `12` §11 all sit here. Two of them guard measures rather than appearance: `test/render/envelope-single.spec` (one boundary, no gradient, no nested geometry) and `test/render/no-recommendation.spec` (no allocation mark the participant did not create).

### M4 — Telemetry

Every record kind in `07` §2, IndexedDB persistence, upload queue, resume.

**Done when:**

- `test/telemetry/coverage.spec` drives a scripted session and asserts every record kind in `07` §2 is emitted at least once with every required field.
- `test/telemetry/derived.spec` computes every measure in `07` §4 from a golden log — **a measure that cannot be computed is a missing record and fails the build**.
- `test/telemetry/resume.spec` interrupts at each cycle boundary and asserts correct resume.
- `test/telemetry/upload.spec` interrupts the upload at three points and asserts completion.

### M5 — Routing, retrieval and the three conditions

The capability matrix, tier-to-route resolution, retrieval with seeded latency, the radio panel with the authored responder, the traffic request surface, the drawers.

**Done when:**

- `test/routing/matrix.spec` asserts, cell by cell, that each condition can reach exactly what `02` §2 says and nothing more.
- `test/routing/reachability.spec` asserts every load-bearing atom is reachable in all three conditions **by executing the authored route**, not by inspecting the field.
- `test/retrieval/closure.spec` asserts the retrieval return type admits only corpus atoms and that no code path constructs a novel string.
- `test/retrieval/latency.spec` asserts the `directed` and `assistive` latency distributions match within a declared tolerance.
- `test/retrieval/recall.spec` runs the pilot-1 Finnish query corpus and asserts a recall floor.

### M6 — Channel

Signal emission, all-clear cadence, the authored traffic summary and its omissions, phase-B intent restatement and alignment flags.

**Blocked on the channel vocabulary.**

**Done when:**

- `test/channel/provenance.spec` asserts every emitted signal's content traces to authored atoms.
- `test/channel/contradiction.spec` asserts no signal at cycle 18 flags the conflict.
- `test/channel/omission.spec` asserts the three load-bearing T4 items are omitted from the traffic summary at their cycles, with no flag.
- `test/channel/cadence.spec` asserts the all-clear appears on schedule.

### M7 — Probes

All five types, both freeze modes, the three-way judgement with its conditional follow-ups, the polygon drawing tool, the confidence slider with its movement capture.

**Done when:**

- `test/probes/schedule.spec` asserts the `08` §5.3 schedule for both counterbalance orders.
- `test/probes/three-way.spec` asserts the follow-up is required and only required in the correct branches, and that no binary is ever written to the log.
- `test/probes/blanking.spec` asserts `PROBING_BLANKED` removes map, rail, drawers and status strip from the DOM, not merely from view.
- `test/probes/invariant-link.spec` asserts every probe resolves to an existing invariant.

### M8 — Allocation and scoring inputs

The allocation surface, the rationale field, and the pre-computed viability, robustness and safety table.

**Done when:**

- `test/allocation/space.spec` asserts the space size lands in 20–60 meaningful distinct allocations.
- `test/allocation/table.spec` asserts every allocation has viability, robustness and safety scored against every branch, and that a participant-drawn projection can be scored against the branch set (required if `08` §7 is adopted).

### M9 — Replay viewer

**Done when:** `test/replay/fidelity.spec` replays a golden log and asserts an identical render tree at every logged `seq`. The truth overlay is toggleable and defaults to off.

### M10 — Pre-flight, briefing, training, questionnaire

**Done when:**

- the pre-flight refuses below the declared threshold and records the refusal;
- the training scenario's competence gate blocks progression on failure;
- the questionnaire is unreachable before cycle 20 completes and the debrief is unreachable before the questionnaire completes.

### M11 — Analysis pipeline

Scoring against the invariant list, blind-coding export, the derived-measure computation, the pre-registered models.

**Done when:**

- `test/analysis/scoring.spec` scores a golden log against a hand-computed expected result for every row of the `08` §6 tables including all six rejection cases.
- The pipeline runs end to end on pilot-1 data.

---

## 3. Ordering and blocking

```
M1 ─┬─ M2 ─┬─ M3 ─┬─ M5 ─┬─ M7 ─┬─ M10 ─ pilot 1
    │      │      │      │      │
    └─ M4 ─┘      └──────┴─ M8 ─┘
                         │
              [vocab] ─ M6 ─ pilot 3 (substitutive)
                         │
                   M9 ─ M11 ─ pilot 2 exit gates
```

`directed` and `assistive` are fully buildable and pilotable without M6. **If the channel vocabulary is delayed, build and pilot those two arms rather than waiting** — but do not begin main collection on a partial design.

---

## 4. Continuous integration

Every push runs, in order:

- type check with strict settings;
- lint including the determinism bans and the module boundary rules;
- **licence scan against the allowlist, transitively**;
- unit tests;
- the golden-run determinism test;
- the truth-boundary integration test;
- the scenario validator against all fixture scenarios;
- the telemetry coverage and derived-measure tests.

**Any failure blocks merge.** The golden-run and truth-boundary tests are never skipped, quarantined or marked flaky. If either becomes flaky, the flakiness is the bug.

---

## 5. Acceptance for data collection

The instrument is not ready for main collection until all of the following hold.

| # | Criterion | Established by |
|---|---|---|
| 1 | All CI checks green on the release commit | CI |
| 2 | Golden fixtures committed and reproducing on three machines | M1 |
| 3 | Every derived measure in `07` §4 computable from a real pilot log | Pilot 1 |
| 4 | Containment accuracy within 60–80% | **Pilot 2 gate** |
| 5 | Contradiction detection in `directed` within 20–70% | **Pilot 2 gate** |
| 6 | Contradiction selected and recorded in the scenario version | Pilot 2 |
| 7 | Channel engagement in `substitutive` above a declared floor | Pilot 3 |
| 8 | Session timing within the `08` §5.2 budget ±15% | Pilot 3 |
| 9 | Attrition and upload completeness measured | Pilot 3 |
| 10 | Power simulation run on pilot-3 variance components | Pilot 3 |
| 11 | Pre-registration locked | After 10 |
| 12 | Ethics approval and the DPIA in force | Before pilot 1 |
| 13 | Participant pool verified at the required size | **Before M5 configuration** |
| 14 | Domain reviewer sign-off on the scenario | Before pilot 2 |

Criteria 4, 5 and 13 can each invalidate the design rather than the build. They are the ones to front-load.

---

## Amendment 2026-09-17

| Milestone | Addition | Tests |
|---|---|---|
| M5 | Closed hybrid retrieval engine (`14`) replaces keyword-only retrieval | `test/engine/*` (`14` §9) |
| M6 | Request-driven reasoning packages instead of pushed channel (for now); AI alignment feedback in phase B | `test/decision/feedback.spec` |
| M7 | Type S and `PROBING_ONLINE`; recall confidence; the `15` §4.2 schedule | `test/probes/schedule.spec` updated; `test/probes/online.spec` (clock not halted, tools enabled); `test/probes/no-collision.spec` (no R and S in the same cycle; none in 1, 12 or 18); `test/probes/levels.spec` (every freeze has exactly 2 × L1, 2 × L2, 1 × L3) |
| M8 | Course-of-action panel and option–allocation mapping | `test/decision/*` (`16` §9) |
| M10 | Warm-up block, tutorial, mechanics-only competence gate; AI literacy moves to the pre-session component | `test/session/warmup.spec` (all groups get identical prologue content and `directed` capabilities in W1–W5) |

**M6 is no longer blocked on the channel vocabulary** as long as reasoning AI is request-driven; it is blocked instead on the reasoning-package topic list (`14` §10).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

| Milestone | Change |
|---|---|
| M5 | Two conditions; three cells; AI engine pull-only (`test/engine/no-push.spec`) |
| M6 | No pushed channel. Intent-line variant for cell 3 (`test/engine/intent-line.spec`); envelope-consistency lint |
| M7 | Handoff adopted: fixed option order, draw-then-choose, *Ei mikään näistä* last, unset sliders, vertex limits (`test/probes/branch-order.spec`, `test/probes/draw-before-choose.spec`, `test/probes/slider-unset.spec`) |
| M8 | Decision task without feedback (`test/decision/no-feedback.spec`) |
| M10 | Group-specific training |

`test/scenario/branch-truth.spec` — every cycle's branch list has exactly one `isActualDevelopment` statement, except the omission cycle, which has none; the flag never reaches the render layer.

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

M5: three conditions, four cells (`test/session/cells.spec`: the intent-line cell exists only within `substitutive`). `test/engine/condition.spec` reinstated.

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

M5: two conditions in use, three cells (`test/session/cells.spec`); `assistive` present in code, rejected by session configuration.

**Revision 17 Sep 2026 (g).** `test/scenario/routes-two-groups.spec` (every load-bearing atom reachable in `directed` and `substitutive`); `test/scenario/unrecorded.spec` (atoms with `saidOn` DMO, phone or face-to-face never appear in any searchable surface or engine index); `test/scenario/faults.spec` (F1–F6 at their authored cycles); `test/engine/broad-vs-narrow.spec` (load-bearing lines absent from broad-question answers, present in narrow-question sources).

---

## Revision 23 Sep 2026 (h) — tests added

- **M2:** scenario-validator check #16, `navigation-coverage` (`25` §6).
- **M5:** `test/retrieval/navigation.spec` — category, source and time-window filtering; nothing from the future; closure over the corpus (I6); the decoy rule. `test/routing/matrix.spec` asserts the builder is identical across conditions.
- **Authoring tools:** `test/fire-ca/` — the cellular automaton of `24` (determinism, calibration, flag derivation, tracing, coordinate conversion).

---

## Revision 23 Sep 2026 (j) — no radio

Follows `02` revision (j).

- **M5 scope.** "The radio panel with the authored responder, the traffic request surface" are **dropped**. There is no radio module, no responder and no reply-latency model. The Radio drawer and its UI are removed from the build, not hidden.
- **Tests removed.**
  - `test/retrieval/latency.spec`'s `directed` vs. `assistive` latency match: replaced by `25`'s uniform 2.5 s, which `test/retrieval/navigation.spec` already asserts.
  - `test/engine/latency.spec`'s match against `directed` replies.
- **Tests restated.**
  - `test/scenario/routes-two-groups.spec`: every load-bearing atom has a `directed` route of `browse` and a `substitutive` route of `browse` or `free_text`. **No atom uses `ask_unit` or `request_traffic`.**
  - `test/scenario/unrecorded.spec` is **unchanged** and still required. Unrecorded atoms never appear in a searchable surface or engine index. New: **no load-bearing atom is unrecorded** unless a recorded atom carries the same fact (`04` revision (j)).
  - `test/engine/broad-vs-narrow.spec` now includes `t4.water_state` (`19` revision (b) R.2).
  - `test/routing/matrix.spec` asserts that no condition has a Radio drawer, and that the AI drawer is the only surface that differs between conditions.
- **Telemetry.** The validator rejects `radio_request_submitted` in a 0.4.0 log (`07` revision (j)).
- **Pilot 2 gate 5** (contradiction detection within 20–70%) applies to the Haku group.

---

## Revision 25 Sep 2026 (q) — pilot 1 event-rate check

From the Thinker logs of pilot 1, for the AI group: the share of participants who receive F7 in an answer, who receive the rekindle objection, and who receive both V13 reports; and the share of answers in which the model flags F7 on its own. **Proposal:** an event reaching fewer than 10% of AI participants is revisited before the main study. Also checked: Thinker's latency against the 2.5 s floor, and the fallback rate.
