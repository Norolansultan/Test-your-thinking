# Scenario pipeline status (phase 4): tak-sim at 114070e, after WP-1 to WP-5

Read-only status report, 19 Oct 2026, against the release gates of `wildfire-scenario-pipeline`
(`references/geoai_handoffs.md`: A fire validated → tactics → B panel ratings → C parity clean → D items fair → map → pilot).
It re-runs every script the wildfire skills ship on the current build and compares the result with the phase-1 reports in
this folder. Decisions and owners are those of `SPEC/31` (§2, §5, §6, revision (az)); nothing here changes them.

**Build.** Commit `114070e` (clean worktree). `npm run skills:export` wrote the package `dist/skills/scenario/` with version
`114070edc10a`; a second export to scratch is byte-identical (`diff -r`: no difference). `npm run ci` passes at this commit
(typecheck, determinism lint, 227 test files, 2656 tests). Skills: fire-behaviour-check (envelope 0.1.0), tactical-check
(config 0.2.0), scenario-pipeline (`parity_check.py`), sagat-probes (`score_freezes.py`). Raw outputs:
`/tmp/claude-0/-home-user/f4c97d84-cd2f-5439-9eeb-476ca5afe486/scratchpad/status/`.

## Status at a glance

**Open gate: A.** The skill's rule is that no later gate is final while an earlier one is open, so C and D below are the
state of their checks, not released gates.

| Gate | Status | Evidence (script: counts) | What still blocks it | Owner |
|---|---|---|---|---|
| A fire | **blocked** (external Prometheus run, D10) | `fire_check.py`: 0 LIKELY_ERROR, 3 REVIEW, 1 INFO (phase 1: 0 / 9 / 0); `perimeter_compare.py` not run (no ensemble) | Prometheus ensemble and comparison; the phase-A crown run (steps 5–6) | Researcher, FMI, panel |
| Tactics (no letter) | reference material, **review items** | `tactical_check.py`, 21 cycles: 163/163 ground placements INFEASIBLE (133 on null LACES fields only), 60/60 aircraft feasible; 262 unverifiable checks | LACES fields not exported; MPV25 lay limit, line production and hose carried missing | Panel, Pelastusopisto |
| B panel | **not started** | No script; packet parts exist (rating sheet DRAFT, `review:export`) | Packet assembly and instructions; the ratings (≥ 4 of 5) | Researcher/INT, panel, native speaker |
| C parity | **pass with review items** | `parity_check.py`: between groups 0 problems (phase 1: 0); raw pushed-vs-retrievable 781 by design (phase 1: 784) | VERIFY 1–15 and the WP-6 pass; native review of WP-1 rewrites | Pelastusopisto, WP-6, native speaker |
| D items | **pass with review items** | `parity_check.py` on items: 0 between groups, level mix exact (2/2/4 ×4, 2/2/2 ×3); `score_freezes.py` runs on the export | Domain and native review of the rewritten items; RC confirmations | Domain reviewer, native speaker, researcher |

## Gate A — fire validated: blocked

**Commands.** `python3 -I fire_check.py dist/skills/scenario/ground_truth/cycles.json --out status/fire_check.json`.
`perimeter_compare.py` was not run: `dist/skills/scenario/spatial/` holds only `perimeters_scripted.geojson` and
`barriers.geojson`; no Prometheus member exists (D10).

**Result: 0 LIKELY_ERROR, 3 REVIEW, 1 INFO**, all in the phase-A crown run (same as `SPEC/31` (az) at `3d3b101`):

| Cycle | Level | Rule | Message (script) |
|---|---|---|---|
| 5 (14:40) | REVIEW | ros_envelope | active_crown head ROS 14.1 m/min outside Kalajoki range 15–30 |
| 5 (14:40) | INFO | missing_spotting | crowning cycle has no spotting distance |
| 6 (15:00) | REVIEW | ros_envelope | surface head ROS 38 m/min outside Kalajoki range 0.5–11 |
| 6 (15:00) | REVIEW | spotting | spotting 400 m without active crown (Kalajoki max ~300 m) |

Step 6's type is `surface` because its window record (DR1 `evt.c07.011`, intensity class 4/5, "intense surface fire with
torching") describes 15:00–15:20; DATA_SOURCES keeps class 4 as surface and notes a reviewer may read it passive crown.

**Rules the export cannot exercise:** ISI (`isi` null in every cycle), length/breadth (no `lb_ratio`), the Prometheus band
(no `prometheus` field). The script still checks FL and ROS each against its own band, not against each other (as in phase 1).

**Changed since `fire_tactical.md` (9 REVIEW at `3631cd4`):**
- Resolved (7): c7 spotting 330 m without crown (spotting now dated to step 6, D2); c8 direction 55°; c11 ROS 0 and
  direction 50° (held: type and bearing null); c12 direction 105° (window bearing 105° = downwind of 285°); c12 and c18
  reignition with RH missing (RH 37 % and 26 %, D3).
- Remaining in changed form (2): c5 (was "surface 14.1 > 11", now "active crown 14.1 < 15": the re-paired reading the
  phase-1 audit predicted); c6 (was "active crown 38 > 30", now "surface 38 > 11").
- New (2): c6 spotting 400 m without active crown (the step-6 spots now sit with a step typed surface); c5 INFO.
- Not a script flag but the main phase-1 finding: phase-B flames now come from the flame table (cycles 11–20,
  `fl_source` "flame table"; head 2.97–4.4 m at 4.5–10.6 m/min). Phase A (0–10) still quotes the records; `SPEC/31` (az):
  24 phase-A records state flames their rate cannot give.

**Data items D1–D11 (`SPEC/31` §5), checked in the export:**

| # | State in the export | Evidence |
|---|---|---|
| D1 flame table | phase B done; phase A records unchanged | `fl_source` per cycle; `SPEC/31` (az) |
| D2 time-aligned fields | done | DATA_SOURCES "One window per cycle"; 7 flags gone |
| D3 T/RH every step | done | `rh_pct` null in no cycle; `dew_point_c` null in cycle 0 only |
| D4 CO-zone proxy | done (proxy; `co_ppm` null) | 163 ground placements: 29 immediate_danger, 11 danger, 123 rescue_ops |
| D5 crew sizes | done | `persons` filled in 221 of 223 unit rows |
| D6 hose carried, MPV25 lay limit | **open** | `hose_available_m` null in 223/223 unit rows; `max_manual_hose_lay_m` MISSING in config 0.2.0 |
| D7 shift hours | done | `hours_on_shift` filled in 157/223 (null before a crew's first statement, aircraft) |
| D8 LCES lines | in the records; **not exported** | KY21 18:26 `atom.radio.16.3` (escape on foot north into the burned area); EK16 19:04 `atom.radio.18.5` (why it holds); R2 crews' routes and safety zones 19:04–19:58 (`evt.c18.012` … `evt.c20.045`); placements' `escape_route`, `safety_zone`, `comms` null in 163/163 |
| D9 L4 precursor | rejected (`SPEC/31` §2.4) | — |
| D10 Prometheus inputs | **open** (external) | no ensemble; request in `fire_tactical.md` |
| D11 EK14 type | done | EK14 `hose_team` |

**Remaining for Gate A.** The proposed comparison thresholds (`compare_thresholds.proposed.json`, 0.2.0-proposed) exist only
in the phase-1 scratch folder, not in the repository; the skill requires them fixed before any comparison (researcher).
Sending the Prometheus request is open in `SPEC/31` §6 item 1, and (az) does not record it sent (researcher, D10). FMI/PromS: the ensemble, the flame table against HFI,
FWI 55 / ISI 23, the evening RH 26 % and dew-point drop, US3 on the upwind edge (`SPEC/31` §6 item 6). Panel and FMI: the
step-5/6 flags (§6 items 2, 6). Panel and WP-6: the 24 phase-A flame records. Domain reviewer: the flame table's credibility.

## Tactics — reference allocations for the panel: review items

**Commands.** Each cycle extracted to its own file (the script reads one cycle; DATA_SOURCES), then
`python3 -I tactical_check.py cycleNN.json --out cycleNN.result.json --geojson cycleNN.verdicts.geojson` for all 21 cycles.
The phase-1 keyed steps (3, 7, 12–20) are in the table; the other cycles are in the scratch folder.

| Step (view) | Ground INFEASIBLE | of which LACES only | zone proxy fail | intensity fail | Aircraft feasible | Unverifiable | Script's anchor |
|---|---|---|---|---|---|---|---|
| 3 (V2) | 6/6 | 3 | 3 | 0 | 3/3 | 9 | rear segment |
| 7 (V5) | 6/6 | 1 | 5 | 0 | 3/3 | 8 | rear segment |
| 12 (V9) | 9/9 | 9 | 0 | 0 | 5/5 | 18 | burned.main (old black) |
| 13 (V10) | 9/9 | 9 | 0 | 0 | 3/3 | 17 | burned.main |
| 14 (V11) | 9/9 | 8 | 1 (VPK) | 0 | 3/3 | 13 | burned.main |
| 15 (V11) | 9/9 | 9 | 0 | 0 | 3/3 | 13 | burned.main |
| 16 (V12) | 12/12 | 9 | 3 (EK16, KY21, VPK) | 0 | 3/3 | 13 | burned.main |
| 17 (V12) | 9/9 | 7 | 2 (EK16, KY21) | 0 | 4/4 | 12 | burned.main |
| 18 (V13) | 12/12 | 11 | 1 (EK16) | 0 | 4/4 | 16 | burned.main |
| 19 (V14) | 12/12 | 12 | 0 | 0 | 4/4 | 17 | burned.main |
| 20 (V14) | 12/12 | 12 | 0 | 0 | 3/3 | 16 | burned.main |
| All 21 cycles | 163/163 | 133 | 29 | 1 (c10 EK14, 3 m > 2.4 m) | 60/60 (3 with warnings) | 262 | none in 0–2, 8–10 |

Thresholds: hand-tool 1.2 m and equipment 2.4 m flame length PROVISIONAL (US-based); aerial limit MISSING. Unverifiable
(262): 151 "no CO value" (the script reads `co_ppm` only, not the zone proxy), 82 manual hose-lay limit MISSING, 16 phase-A
segments without a flame value, 13 phase-A flanks without intensity. The indirect-line timing check never runs: no placement
carries `line_length_m`, and line production is MISSING. Water: `water_confirmed` null everywhere, so every hose, engine
and tanker attack carries the warning "water supply status not given".

**Changed since `fire_tactical.md`.**
- Run 1 (the export as is) is unchanged for ground crews: 0 feasible in every keyed step, because the LACES fields are null
  (DATA_SOURCES: "every ground placement fails LACES until those are authored"). The phase-1 run 2/2b filled them from the
  records with the auditor's own scripts; that is not a skill check and was not repeated.
- Resolved: aircraft no longer fail LACES (`laces_exempt`, "n/a (airborne)"); EK14 is typed `hose_team`, so its intensity
  and water checks run; phase-B segments carry flame values (no "segment without flame" in cycles 11–20); the script finds the
  old black as anchor in every phase-B step (phase 1: NONE FOUND); smouldering spots get a unit (EK14 at c13, c19); old-fire
  crews sit on no segment, so they no longer count as flanks of the new front (`segment_id` null in 63 of 163).
- The zone proxy reproduces run 2b's downwind failures (KY21, VPK at c16; KY21, EK16 at c17; EK16 at c18) and adds EK16 at
  c16, VPK at c14 and 22 crew-steps in phase A (c1–c7). It is a PROVISIONAL proxy (DATA_SOURCES), not a CO measurement.
- The records now answer FT-T16/17 (KY21's escape into the black) and FT-T18 (EK16's reason to hold); the script cannot
  see either while the LACES fields stay null.
- New: c10 EK14 direct attack on the head at 3 m exceeds the PROVISIONAL 2.4 m (phase 1 did not run c10; EK14 was `unknown`).

**Owners.** Panel: soundness from the records (LCES lines, KY21/EK16 timing, FT-T3/T7 phase-A water; `SPEC/31` §2.4,
§6 item 2). Pelastusopisto: MPV25 tables 3–7 (lay limit), line production, hose carried (D6). Exporting the D8 lines
as placement fields is assigned to no work package in `SPEC/31` §5 or §7.

## Gate B — expert panel ratings: not started (readiness only)

What the panel needs (`SPEC/31` §6 item 2) and what exists now:

| Need | Exists? | Evidence |
|---|---|---|
| Rating sheets V9–V14 with the probe plans | yes, DRAFT | `coa_rating_sheet.csv`: 34 plans (V09 6, V10 6, V11 6, V12 5, V13 5, V14 6), unchanged since `588908b`; key in `coa_option_key.csv` |
| Each view's full record set, pushed and recorded marked, after the flame table | generator yes; flame table phase B only | `npm run review:export` (run to scratch): 1002 corpus records with `view` and `delivery` columns, 126 draft keys, 1180 strings; 24 phase-A records not on the table |
| Instructions: horizon 20–40 min, edge state and crew presence for flare-ups, CO unknown, burnouts not rated, ≥ 4 of 5, key from the ratings | **no** | not found in the repository outside `SPEC/` (searched) |
| Decisions it must take: coa F1, F2, F5, F6; premise statuses and P1 before hashing; FT-T3/T7; KY21/EK16 | build changed, panel not asked | F1 act coding (WP-3), F2 V14 secondary route (WP-1), F3 V14 P2 `not_contradicted` (WP-1): all RC; P1 DRAFT; table re-hash after the panel (§3.4) |
| The packet itself | **no** | `SPEC/31` §7: the integrator prepares it after the merge; (az) does not record it done |

Since phase 1 (`coa.md`, P-13): the three blocking coa findings F1–F3 are implemented in the build, pending the panel and
the researcher's RC confirmation. Native speaker: the sheet's Finnish plans and P1's wording.

## Gate C — parity between groups: pass with review items

**Commands.** `parity_check.py facts.json radio.json ai_packages.json items.json` (raw), and the between-group pair built
from the export as in `parity_measures.md`: H = the 246 pushed messages + 21 `haku.cNN` packages; G = H + 21
`thinker.cNN` packages (no digest packages: the export has none).

| Run | Facts delivered | Items | Problems |
|---|---|---|---|
| Raw: pushed vs retrievable | 1004 | 62 | **781** = 760 `channel_missing` (758 recorded + `duty.v1`, `duty.v8`) + 21 `item_uses_unavailable_fact` (14 items). By design (DATA_SOURCES; `SPEC/27` §7.1) |
| **H vs G**, all items | 1004 | 62 | **0** |
| H vs G, phase A, `--level-mix L1=2,L2=2,L3=4` | 1004 | 32 | **0** |
| H vs G, phase B, `--level-mix L1=2,L2=2,L3=2` | 1004 | 18 | **0** |
| H vs G, VP + SPAM + hinge | 1004 | 12 | **0** |

Haku and Thinker packages are identical fact for fact (1002 each, 0 difference); no fact is delivered before `cycle_true_from`.

**Changed since `parity_measures.md`.**
- Raw 784 → 781 (recorded facts 761 → 758; facts 1007 → 1004); between groups 0 → 0.
- The "no-search" pair (158 problems) was not re-run: the digest is not in the export (phase 1 computed it with the repo's
  functions). Its finding, P-2, is fixed in the build: exposure is retrieved ∪ digest ∪ recent with a retrieved-only
  sensitivity (WP-3; DATA_SOURCES "Responses"). The skill pipeline cannot exercise it yet: the test sessions convert to
  244 exposure rows, all route `bubble` (Haku group, no chat answers), so `exposure.csv` equals
  `exposure_retrieved_only.csv`.
- Radio content (the radio skill has no script; term counts in the record text of `facts.json`): "drone-" spelling in
  Finnish text 0 (CS-06 done),
  "kaakkoissivusta" untranslated in English 0 (EN-01 done); remaining: "pistepalo" in 14 records (TE-01, VERIFY 10) and
  "kylläinen" in `evt.c06.015`, `evt.c06.017` (WP-6, `SPEC/31` (az)); call signs EK/KY/OUT/SPOT/VPK unchanged (CS-01–05).

**Owners.** Pelastusopisto: VERIFY 1–15 of `radio.md`. WP-6: the deferred call-sign and terminology pass, the eight ST-07
move messages, "kylläinen". Native speaker: WP-1's record rewrites. Domain reviewer: `SPEC/27` §7.1, DF-01/02.

## Gate D — items fair: pass with review items

**Commands.** The parity runs above (items in both groups, level mix). `score_freezes.py items.json responses.csv
--exposure exposure.csv` on the export's items and on per-subset files (H2 window, main freezes, phase A, phase B, main
SPAM), with responses from the test sessions (`SKILLS_SESSIONS_DIR=<scratch> npx vitest run
test/tools/skills-responses.spec.ts`, then `npm run skills:export -- --responses … --out <scratch>`: 65 responses).
The sagat skill has no other script; its query rules are reviewer checks.

| Subset (P-SK1, synthetic driver, not data) | n | Accuracy | Conf / gap / Brier | L3 classes |
|---|---|---|---|---|
| H2 window (L2/L3 of V2, V4, V5, V7) | 24 | .042 | .677 / .635 / .529 | 13 EXPOSED_WRONG, 2 NOT_EXPOSED, 1 CORRECT |
| Main freezes | 50 | .120 | .595 / .475 / .431 | 19 EXPOSED_WRONG, 2 NOT_EXPOSED, 1 CORRECT |
| Main SPAM | 6 | .167 | .500 / .333 / .250 | — |

**Changed since `sagat.md` and `parity_measures.md`.**
- The three Gate-D blockers (P-13: F01, F02, F04) are re-authored in the bank: `freeze.4.growth_next` is gone, replaced
  by `freeze.4.return_danger` (L3, 40-min horizon); `freeze.14.se_front_r2` now asks whether R2's sprinklers must be turned
  on within 20 minutes; V6.b is an L2 item keyed on `evt.c07.016`, `evt.c08.013`, both available in both groups by its
  cycle (H vs G: 0). Also F03: V14 `head_later` is replaced by `flare_next` (non-map). Content is DRAFT (domain review).
- Level mix unchanged and exact: V2, V4, V5, V7 2/2/4; V10, V12, V14 2/2/2; VP 2/1/1.
- Remaining script-level flags: 22 of 50 main-freeze items have empty `fact_ids` (20 L3 + 2 L1 map items; phase 1: 22) and
  `items.json` carries no basis ids, so the script still classes most wrong L3 answers EXPOSED_WRONG (H2: 13 of 15; phase 1:
  11 of 13). By `SPEC/31` P-4 and §3.9 the repository's fold is primary and the script a pilot-2 cross-check, so this is
  not a blocker. The scripted fixture row `freeze.2.1` is not in the bank and is still dropped silently.
- The P-SK1 figures differ from phase 1 (H2 gap .510 → .635) because the items changed under a fixed synthetic answer
  pattern; they are not comparable as data.

**Owners.** Domain reviewer: the items `SPEC/31` §2.1 marks DR (F01, F04, F06, F09, F10, F17–F20, F28). Native speaker:
rewritten items, distractors, freeze header, lures. Researcher: RC for F01's key (§3.5) and the told split (§3.6).
Pilot 2: F05, F09, F12, F24 and the `score_freezes.py` cross-check with a guide-group session (digest and recent routes).

## Script failures

None. Every script ran with exit 0 on the export's shape. Two shape notes, documented in DATA_SOURCES and not failures:
`tactical_check.py` reads one cycle (extracted per cycle), and it treats the null LACES fields as missing.

## Before the pilot (ordered, per gate)

**Gate A (fire)**
1. Researcher: commit the comparison thresholds (0.2.0-proposed) to the repository and send the Prometheus request (D10).
2. FMI/PromS: run the 7-member ensemble with the Finnish lookup; return HFI, the flame-table check, FWI/ISI, evening RH, US3.
3. Researcher: `perimeter_compare.py` on the ensemble per the scope rules; revise the forcing if out of tolerance; re-run
   `fire_check.py`; write the methods paragraph with real numbers.
4. Panel and FMI: the step-5/6 crown-run flags (3 REVIEW, 1 INFO). Panel and WP-6: the 24 phase-A flame records.
5. Researcher: confirm the provisional flame table (RC, §3.11) and record the fire as PROVISIONAL in the pre-registration.

**Tactics**
1. Pelastusopisto: MPV25 tables 3–7 (manual lay limit), line production rates, hose carried per unit (D6).
2. Panel: LCES soundness from the records (D8 lines), KY21/EK16 timing, phase-A water (FT-T3/T7).

**Gate B (panel)**
1. Researcher/INT: assemble the packet: rating sheets, `review:export` record sets, written instructions (§6 item 2).
2. Native speaker: the sheet's plans and P1's wording.
3. Panel: rate V9–V14 (≥ 4 of 5); decide F1, F2, F5, F6, the premise statuses and P1.
4. Researcher: confirm the RC decisions (§3.1, 3.2, 3.4); re-hash the premise table after the panel.

**Gate C (parity)**
1. Pelastusopisto: VERIFY 1–15.
2. WP-6: call signs and terms, ST-07, "kylläinen"; one re-index; then re-run `parity_check.py` (expect 0 between groups).
3. Native speaker: WP-1's record rewrites. Domain reviewer: `SPEC/27` §7.1, DF-01/02.
4. Researcher: rebuild the PROVISIONAL Thinker index (`npm run thinker:index`, `thinker:eval -- --write`) before pilot 2.

**Gate D (items)**
1. Domain reviewer and native speaker: the DRAFT items, lures and freeze header.
2. Researcher: RC for F01's key and the three-way told split.
3. Re-run `parity_check.py` with the 2/2/4 and 2/2/2 mixes after any item change.
4. Pilot 2: the listed pilot decisions and the `score_freezes.py` cross-check on per-subset files with a guide-group session.

**Then:** map review with `cartography-geoviz` (not run in phase 1 or here), the pilot with firefighters, and the
scenario version frozen for pre-registration.
