# 31 — Skills review, 19 Oct 2026: decisions on the six phase-1 reports

**Status:** Governing for the decisions below. Where it conflicts with `30`, `08`, `09`, `15`, `16`, `18`, `24`, `26`, `27` or `29`, this document wins; each carries a revision note (ay) pointing here. Decisions marked **RC** change a pre-registered outcome's definition and are taken here subject to the researcher's confirmation before the pre-registration locks.
**Scope:** every finding of `docs/audits/2026-10-19-skills/` (sagat, radio, coa, fire_tactical, parity_measures), the conflicts with `30` they raise, the data the scenario must add before Gate A, the people list, and the phase-3 work packages.

> **Changelog**
> - **24 Oct 2026 (bg)** — F13's header ("the screen's clock at the freeze") is superseded by the play-test's one definition of "now" (`08` (bg) bg.1): the span of the period's latest reports. §3.8's view-end "now" (V10 17.40, V12 19.00, V14 20.00) and its horizons stand, each L3 stem now names its clock, and V12 `head_now` is keyed at 19.00.
> - **21 Oct 2026 (bc)** — game mode was removed on 21 Oct 2026 (`29` withdrawn; one simulation for everyone, the public-audience version `35` replaces it). P-12's game timeline, WP-5's game items and phase-4 review note 3 with its fail-closed fix (the build's game gate) lapse. The recruitment gate stays in the server for the demonstration (`docs/DEPLOYMENT.md` §2.1); the prior-use item asks about the web demonstration only (`prior.demo`).
> - **19 Oct 2026 (az)** — §3.12's re-runs done after WP-3 (figures in `30` (az)); WP-1 to WP-5 merged and reconciled; the act coding reads the core front for the primary (RC with §3.1); what phase 3 leaves open. See the revision at the end.
> - **19 Oct 2026** — created (phase 2 of the skills review; reports at commit 588908b, scenario export 3631cd4).

---

## 1. What was reviewed and how

Six read-only audits, run with the installed wildfire skills against the scenario export (`npm run skills:export`, commit 3631cd4; items and keys as at 7394df8, unchanged since), were read in full and checked against the code and content they cite: `app/telemetry/derived-measures.ts` (`soundness`, `codePosture`), `app/scenario/demo-directive.ts`, `content/thinker/premise-evidence.json` and `directive-premises.json`, `server/thinker/premise-check.ts` and `handler.ts`, `app/scenario/freeze-bank*.ts`, `demo-probes.ts`, `views.ts`, `app/telemetry/freeze-measures.ts`, `app/game/scenarios/*`, the specs they cite, and `site-scenario.json` for the V14 records. One claim was tested: `test/scenario/freeze-bank.spec.ts` passes at 588908b although both pushed step-20 records (`evt.c20.005` "palo 600 m länteen", `evt.c20.033` "palo noin 550 m länteen", plain spaces, tier T1) state `se_front_r2`'s key band, so the repository's own recall guard is blind to them (sagat F02 stands; the guard is repaired in WP-2). Principles applied, in order: the validity of the two primaries (H2, H13), then the secondaries; the smallest change that removes a threat; no session time without its cost and gain; the identical-stimulus and determinism invariants; anything that redefines a pre-registered primary is marked **RC**. The reports are in `docs/audits/2026-10-19-skills/` (`README.md` lists them).

## 2. Decision table

Decision: **fix** (phase 3, code or content), **people** (a reviewer decides; §6), **pilot** (measured in pilot 2, then decided), **no** (no change). Owner: WP-1…WP-6 (§7), INT (integrator: spec text), R (researcher), DR (domain reviewer), PN (expert panel), NS (native speaker), PO (Pelastusopisto), FMI, PL (pilot 2). Fire-tactical findings carry ids FT-… assigned here; parity findings P-….

### 2.1 sagat.md

| Id | Decision | What changes, or why not | Owner |
|---|---|---|---|
| F01 `growth_next` | fix, **RC** | Re-author: the key's basis must be delivered by the freeze (the drawn perimeters and pushed surveys/rates); re-band so the report-keyed and truth bands coincide under the margin rule, else replace the item; a test that every report-keyed basis step is drawn or pushed before the freeze (§3.5) | WP-2, DR |
| F02 `se_front_r2` | fix | Replace with a consequence item at a stated horizon from "now" = 20:00 (report-keyed; §3.8); the recall guard repaired so it sees pushed records of the view's last step (§1); the two road-crew lines stay (§4 radio 4) | WP-2 |
| F03 `head_later` tolerance | fix | Rule and test: an L3 map key lies ≥ 2 × tolerance from the head drawn at "now"; V14 `head_later` replaced by a non-map L3 item (no truth exists after 20:00); V2's horizon lengthened if it fails | WP-2 |
| F04 SPAM V6.b | fix | Re-author as an L2 or L3 item whose key follows from records reachable at 25 s into V6; R1's projection to the domain reviewer | WP-2, DR |
| F05 H-T two items | pilot | H-T analysed as an item-level mixed logistic model (measure × group, item random effects); pilot 2 decides whether two more SPAM L2/L3 items (+1.5 min) are worth it | WP-3, PL |
| F06 `lull_meaning` | fix | Replace the defensible distractor with a clearly false state | WP-2, DR |
| F07 `wind_shift` → `ek14_shelter` | fix | Drop "ennusteen mukaan"; `ek14_shelter` ordered before `wind_shift`; source-memory fact `wind_forecast_se` swapped (F17) | WP-2 |
| F08 L3 horizons | fix | Every L3 stem names its horizon from "now" (`keySteps`) | WP-2 |
| F09 knowledge items | pilot | `spruce_behaviour`, `crown_drops` kept for the domain review; pilot 2 accuracy > 90 % means a situation-specific rewrite | DR, PL |
| F10 L2 = recall | fix | The six L2 items rewritten to integrate two records or relate one to a goal (DRAFT, domain review); H2 sensitivity without stream-told items pre-registered (§3.6) | WP-2, DR |
| F11 scrambled bands | fix | Ordinal bands in ascending order; band items outside the position balance | WP-2 |
| F12 180 s cap | fix | `FREEZE_MAX_SECONDS` 240 for 8-item freezes (cost: ≤ +1 min per phase-A freeze, worst case; median 0); order stays fixed (identical stimulus); timeouts by position reported in pilot 2 | WP-2, PL |
| F13 no clock in the freeze | fix | Header states "now" (the screen's clock at the freeze, `08` y.1): fi/en templates, native check | WP-2, NS |
| F14 `road_crossed` | fix | Ask a consequence the stem does not contain | WP-2 |
| F15 polarity tell | fix | Two options per polarity with different reasons in `road_jump`, `cp_safe`, `cabins_reach` | WP-2 |
| F16 `aiStatedKey` | fix | Count answers after the basis record and in the freeze's view or the one before; element-tied patterns; `statedLure` class reported with H2t | WP-3, WP-2 (patterns) |
| F17 source memory | fix | Two false lure facts; scoring for overlapping sources defined; `ai_likely` facts recorded-only and uncued (+~20 s) | WP-2, DR, NS |
| F18 R1 stretch | fix | Name the stretch in the V2, V5 infra items and V6.b; flag retrieval-dependent | WP-2, DR |
| F19 `relief_next` | fix | Key on an explicit pushed record, or widen the margin | WP-2, DR |
| F20 V6 SPAM distractor | fix | A clearly different state | WP-2, DR |
| F21 V13 area item | fix | Scored as hits against false alarms in analysis; no UI change | WP-3 |
| F22 stale bases | fix | Basis numbers computed at build time; the item table regenerated into `08` by the package | WP-2 |
| F23 notice at 60 s vs freeze | fix | The notice is deferred until after the freeze when the freeze is due within 15 s (deterministic, identical); test | WP-2 |
| F24 V7 cues H10 | fix / pilot | `ky21_where` distractor replaced; the pilot comparison of `08` (2 Oct) stands | WP-2, PL |
| F25 cross-probe cues | fix | Re-authored with F01 | WP-2 |
| F26 implausible distractors | fix | Replaced | WP-2 |
| F27 wording fi/en | fix | Fixed, then native review | WP-2, NS |
| F28 V14 `shift_meaning` | fix | Replaced by a life-safety or values item (the freeze is after the plan) | WP-2, DR |
| F29 `cabins_distance` tense | fix | Present tense | WP-2 |
| F30 retrieval-only L1 | fix (analysis) | Reported conditional on `freezeItemExposure` (with the digest folded in, P-2) | WP-3 |
| F31 chance by format | fix (analysis) | Format covariate and chance-corrected sensitivity pre-registered | WP-3, INT |
| F32 crossed keys | fix (analysis) | Each half scored for diagnostics | WP-3 |
| Conflicts 1–10 | — | Settled in §4 | — |
| Proposal (a) Agent-SA | no / fix | No in-session items; F7, `rekindle_sector`, the V14 backup tagged `family: verification`; two post-session perceived-reliability items (+30 s, exploratory) | WP-2, WP-3 |
| Proposal (b) QASA | no | Not in the professional study; a lure-acceptance index from the bank's existing lures (exploratory); QASA to the student sample | WP-3, R |
| Proposal (c) error classes | fix | §3.9 | WP-2, WP-3 |

### 2.2 coa.md

| Id | Decision | What changes, or why not | Owner |
|---|---|---|---|
| F1 label decides C/B | fix, **RC** | (c) act-based primary coding, label-based as sensitivity (§3.1); (b) one-line task definitions in the practice tour; (a) the panel rates the probe plans | WP-3, WP-2, PN |
| F2 V14 main effort on L4 | fix, **RC** | V14 sound only through the secondary route; main-effort L4 codes D; `soundVia` reported (§3.2) | WP-1, PN |
| F3 V14 P2 | fix, **RC** | `not_contradicted`, matching V13; `30` §3 wording corrected (§3.4) | WP-1, PN |
| F4 P1 vague | fix, **RC** | P1 re-worded (DRAFT) to name "no new fire or rekindle since the directive"; crew safety is not made a premise (V11 stays fit); notes corrected | WP-1, PN, NS |
| F5 V11 weak | people | Panel keys with an explicit 20–40 min horizon and the whole record set, after the flame table (§3.11); fallback pre-registered (§3.3); `27` §7.2 V11 row stale | PN, INT |
| F6 V13/V14 flare-ups | people / fix | Panel instruction keys on edge state and crew presence; V13 secondary attacks reported separately | PN, WP-3 |
| F7 expressivity | people, pilot | No plan-form change before pilot 2 (it is the primary's instrument); V12-e probe to the panel; pilot 2 reads blocked intentions from `decision_option_hovered` | PN, DR, PL |
| F8 "Linjan pito" | fix | "Linjan pito tiellä tai vesistöllä" (en likewise), native check | WP-2, NS |
| F9 labels, "hyökkäys" | people | With TE-06/07; the fixed order stays (identical stimulus) and is stated in the pre-registration | NS, DR, INT |
| F10 V12 freeze cues A | fix | V12's freeze after the plan too (`FREEZE_AT_VIEW_END` = {10, 12, 14}); F7 and H3 unaffected (§3.8) | WP-2 |
| F11 mild cues | fix / no | Departure reason "Uusi tieto palosta"; V13 list "Länsipuoli"; the rest recorded in the pre-registration | WP-2, INT |
| F12 crews pre-do A | no | A limitation, read against the base-rate group; no corpus or CA change for a secondary | INT |
| F13 L2 for V9–V10 | fix (analysis) | L2 added to V9–V10's `boundarySectors` (sensitivity only; the primary stays computed); `16` y.4 and `27` y.1 aligned with the build | WP-1, INT |
| F14 burnouts | people | Domain reviewer confirms; `BURNOUT_IN_LINE` kept out of the panel packet | DR, R |
| F15 no CO | fix (export) / people | A CO/zone proxy from the smoke rule in the export, no records; the panel is told CO is unknown and does not decide soundness | WP-4, PN |
| F16 stale basis figures | fix | Read with `recordFigure` | WP-1 |
| F17 placeholder bank | no (spec) | `demo-decisions.ts` formally retired in `16` (ay) | INT |
| Conflicts 1–6 | — | Settled in §4 | — |

### 2.3 radio.md

| Id | Decision | What changes, or why not | Owner |
|---|---|---|---|
| CS-01 EK/KY real codes | people → fix | VERIFY 1–2 first; roster region labels become "oma / naapuripelastuslaitos" now; the corpus-wide rename only on a confirmed collision, in the deferred pass (WP-6) | PO, WP-1, WP-6 |
| CS-02 numbering | people | VERIFY 1; renumber in WP-6 | PO |
| CS-03 OUT1/OUT2 | people → fix | Invented Finnish-style codes in WP-6 (touches V14 infra keys) | WP-6 |
| CS-04 VPK not a code | people → fix | WP-6 (both languages one unit) | PO, WP-6 |
| CS-05 SPOT | people → fix | "Palolento N" form in WP-6, with DF-01's framing | PO, WP-6 |
| CS-06 drone/drooni | fix | One spelling in the corpus; UAS call-sign form VERIFY | WP-1, PO |
| CS-07 P2 form | people | VERIFY 4 | PO |
| CS-08 `18` §8.1 note | fix (spec) | "eri puhetavat" | INT |
| TG-01 air traffic / ILMA | people | Talk-group plan VERIFY 5; no change before the pilot | PO |
| TG-02 lateral non-neighbours | fix | Generator: lateral traffic only between neighbours | WP-1 |
| TG-03 Hätäkeskus releases | fix | Sender P2, "vapautettu käyttöönne"; VERIFY 7 may adjust | WP-1, PO |
| TG-04 thin command | no | Kalajoki-realistic; a limitation | INT |
| ST-01 narrator voice (key) | people → fix | Term VERIFY 10; rewritten in WP-6 (the V5 items it keys are rewritten by F10 first) | WP-6 |
| ST-02 "kyti" | fix | Reworded (with CO-03) | WP-1 |
| ST-03 duplicated sentence | fix | Generator join fixed (c20.033, c17.004, c14.025) | WP-1 |
| ST-04 lookout 3 000 m | fix | Capped | WP-1 |
| ST-05 4 % tank | fix | Consistent minutes | WP-1 |
| ST-06 UGV1 contradiction | fix | Status template by state | WP-1 |
| ST-07 nested brackets | fix | Move messages as speech (key regexes guard the cited ones) | WP-1 |
| ST-08 identical fillers | fix | 2–3 phrasings per template, unit detail | WP-1 |
| ST-09 sender repetition | no | Deliberate variety (`18`) | — |
| ST-10 question before facts (key) | people → fix | WP-6 | WP-6 |
| ST-11 times | no | Dots are the study's convention (`30` §3) | — |
| TE-01 pistepalo (key) | people → fix | VERIFY 10; WP-6 | PO, WP-6 |
| TE-02 taustapoltto | people | VERIFY 10 | PO |
| TE-03 laukaisupiste | people | VERIFY 10 | PO |
| TE-04 perääntymistie/-reitti | fix | One form (the majority); "pakotie" VERIFY | WP-1, PO |
| TE-05 komentopaikka | fix | "johtopaikan" in `briefing.ts` | WP-2 |
| TE-06 "teho" | fix | "palon voimakkuus" in the phase-A intent (an atom: re-index) | WP-1 |
| TE-07 suora hyökkäys | people | VERIFY 10; one coordinated change (directive, intent, labels, keys) in WP-6 if confirmed | PO, R |
| TE-08 kylläinen | fix | Reworded | WP-1 |
| TE-09 (key) 6.0 | people → fix | With TE-01 in WP-6 | WP-6 |
| TE-10 (key) 9.1 | people → fix | WP-6 (V8 SPAM key regex follows) | WP-6 |
| TE-11 harvester digs | people | VERIFY 14 | DR |
| TE-12 "SAA" | fix | Display name "Sääasema"; the id stays | WP-1 |
| TE-13 capital mid-sentence | fix | Generator | WP-1 |
| LE-01 long messages (key 17.1) | no | Safety detail is wanted; 17.1 is V12's basis; the pushed median is fine | — |
| CA-01 near-future assets | fix | Roster marks VD1, UGV1, DR3 "kokeilu"; VD1 kept | WP-1, DR |
| CA-02 KY21 container | people | VERIFY 1 | PO |
| CA-03 OUT1 heavy tanker | fix | Roster type "raskas säiliöyksikkö" (no record change) | WP-1 |
| CA-04 contractor patrol | no | Plausible one-off | DR |
| CA-05 HELI1 label | no | Generic label is fine | — |
| FB-01 51–68 m/min pushed | fix | Pushed line carries the spot-jump caveat and the front rate without the jumps (FT-C6 FD) | WP-1 |
| CO-01 KY23 vs SPOT in V14 | fix | KY23's line names the north edge and the Karhujärvi side (the deciding fact must not be confusable) | WP-1 |
| CO-02 SPOT 19:15 no place | fix | Names the north edge; the H3 contradiction and designed-event ids unchanged (tests) | WP-1 |
| CO-03 R1 edge | fix | With ST-02 | WP-1 |
| CO-04 labels before confirmation | fix | "varmistamatta" | WP-1 |
| CO-05 (key V10 infra) | people → fix | WP-6 | WP-6 |
| CO-06 (key V11 SPAM) | people → fix | WP-6 | WP-6 |
| DF-01 SPOT second pass framing | people | The `27` §7.1 question; option (c) adopted now: the briefing says units' answers to the command post appear in the records | DR, WP-2 |
| DF-02 "uusi rintama" | fix | "Uusi palo etenee itään …" (V10 basis regex follows) | WP-1 |
| DF-03 V14 R2 distance pushed | no (records) | §4 radio 4: the item is redesigned (F02); the distance is not V14's deciding quantity | — |
| EN-01 kaakkoissivusta | fix | Translated | WP-1 |
| EN-02 north flank/edge | fix | "north edge" throughout; "flank" for *sivusta* | WP-1 |
| EN-03 Lakeside Cottages leak | fix | "the cottages at Bear Lake" | WP-1 |
| EN-04 evacuation decision | fix | "command's" | WP-1 |
| EN-05 wind wording | fix | "from the …" | WP-1 |
| EN-06 kytöpesäke | fix | "smouldering spots" | WP-1 |
| EN-07 times | no | The dot format is the study's convention in both languages | — |
| EN-08 VPK/VOL1 | people | With CS-04 | PO |
| EN-09 teho/intensity | fix | Via TE-06 | WP-1 |
| VERIFY 1–15 | people | §6 item 5 | PO, DR |
| Conflicts 1–7 | — | §4 | — |

### 2.4 fire_tactical.md

| Id | Decision | What changes, or why not | Owner |
|---|---|---|---|
| FT-C5/C7/C8/C11/C12 pairing flags | fix (export) | Time-aligned fields (data item D2) | WP-4 |
| FT-C6 38 m/min | no (fire) / fix (records) | Accepted (`24` ah.7); records give the front rate without the jumps (FB-01); FWI 55 / ISI 23 to FMI | WP-1, FMI |
| FT-C12/C18/C20 RH missing | fix | Station T/RH every step incl. 17:00, 19:00, 19:40, 20:00 (D3); dew-point drop to FMI | WP-1, FMI |
| FT-C12 spec text | fix (spec) | `18` §7 row 12 and §7.2 stale (the spoil bank is ~65 m from the origin, `24` aj) | INT |
| FT-C13/C16/C17 flame bands | fix, **RC** (keys) | Flame-length table (D1, §3.11); DR2 18:25 vs KY21 18:26 reconciled | WP-1, FMI, PN |
| FT-C14 slow-down authored | fix (spec) | Stated in `24` (ay) as a timing choice | INT |
| FT-C19 US3 upwind | people | Weakest rekindle; FMI/DR judge; no fire change | FMI, DR |
| FT-C19 L4 precursor (D9) | no | It would pre-announce V14's deciding fact (`27` §7.1); a non-locational patrol cue is for the domain reviewer | DR |
| FT-C20 no evening lull | no | The lull of `27` §7.4(i) is not implemented by design (V14's no-fit is the flare-up); RH 26 % to FMI | FMI |
| FT scale 160 ha | no | The briefing already frames a severe-end event | — |
| FT Prometheus request | people | The researcher sends it; thresholds 0.2.0-proposed pre-registered; status PROVISIONAL in the pre-registration | R, FMI, PO |
| FT-T3/T7 phase A | people | Water-supply hydraulics and the c3 head to the panel; no key change (phase A uncoded) | PN |
| FT-T12/T13 reference allocation | people | The panel's record set carries the anchor-and-flank reading | PN |
| FT-T14/15 V11 mixed | people | As coa F5 | PN |
| FT-T16/17 KY21 escape route | fix | KY21's 18:26 record names the escape into the black (the north track) | WP-1 |
| FT-T18 EK16 past trigger | fix | EK16's 19:0x record states why it holds (fire 90–190 m west, route open, lookout); the withdrawal stays at 19:21 (V13's information unchanged) | WP-1 |
| FT-T19/20 V14 | fix | As coa F2; LCES lines for the R2 crews (D8) | WP-1 |
| FT keys V9/V12/V13 | no | Hold | — |
| FT data D1–D11 | — | §5 | — |
| FT export artefacts (aircraft LACES, EK14 `unknown`, segment convention) | fix | D2, D11; segments measured from the active front | WP-4 |

### 2.5 parity_measures.md

| Id | Decision | What changes, or why not | Owner |
|---|---|---|---|
| P-1 between-group parity 0 | no | Holds by construction; the pre-registration states that the skill's parity rule applies between groups (radio conflict 1) | INT |
| P-2 digest and recent unlogged | fix | The answer carries `digestAtomIds` (guide) and `recentAtomIds` (both tools); `ai_chat_answer_received` logs them; `atomExposure`, `freezeItemExposure`, `plantedExposure`, `exposure.csv` fold routes `digest` and `recent`; exposure = retrieved ∪ digest ∪ recent, sensitivity retrieved-only (§3.6) | WP-3 |
| P-3 three-way told split | fix, **RC** (H2t) | stream-told / AI-told / neither; H2t on the last two, the first reported (§3.6) | WP-3 |
| P-4 `score_freezes.py` classes | fix / no | The repository's five-class fold with NOT_APPLICABLE and `basisAtomIds` (§3.9); the script only as a per-subset cross-check in pilot 2; its classes not adopted | WP-2, WP-3 |
| P-5 map metric | fix (spec) | Haversine pre-registered | INT |
| P-6 believability, recognition items | fix | Post-session items with exclusion rules (+~20 s) | WP-2, INT |
| P-7 stratification on experience | no / fix (spec) | Command experience pre-registered as covariate and imbalance check; no change to the allocation table | R, INT |
| P-8 model pin | people | `30` §8 | R |
| P-9 self-paced 30 s | fix (spec) | Time-in-view pre-registered as a covariate | INT |
| P-10 late no-fit view | no | V14 is in the build (`demo-directive.ts` fit "no") | — |
| P-11 pre-registration list | fix (spec) | `09` (ay) | INT |
| P-12 game mode replays keyed events | fix | Timeline changed (17:00 rekindle, 15:30 line, 17:40 recall, refusing households); demo and game gated during recruitment; prior-demo item with exclusion; debrief use after recruitment (game parts lapsed 21 Oct 2026, (bc): game mode removed; the demo gate and the item stay) | WP-5, WP-2, R |
| P-13 pipeline status | — | Gate A: §5; B: coa F1–F3 + panel; D: sagat F01/F02/F04; C: P-2 | — |

## 3. Decisions that change measures or hypotheses

**3.1 H13 codes the act, not the label (coa F1; RC).** Primary coding: in V9, V10 and V14 a plan *attends* the keyed front when its main effort is a direct attack on the front's sector(s), or its secondary task on those sectors is direct attack, mop-up or hold-line — on condition that the panel rates the probe plans V9-f, V10-f and V14-d as sound; an attending plan with an aligned main posture is C (its secondary act is against the directive's "no direct attack on the edge" whatever the label; a hose crew on a spreading rekindle is a direct attack in Finnish usage). The current label-based coding becomes the sensitivity. If the panel rates mop-up or hold-line on the deciding front unsound, the build's coding stays primary. Also: one-line definitions of the secondary tasks in the tour (identical for all), and "Linjan pito" renamed (F8). Effect: the C base rate rises in both groups; δ is unchanged; `paper2-power.ts` is re-run with pilot-2 base rates per view.

**3.2 V14's key holds only through the secondary route (coa F2, FT; RC).** `soundSectors.direct_attack` is removed from V14; `soundSecondary` (direct attack on `SECOND_REKINDLE` with the main effort aligned in Lahdenkylä's sector) remains; a main effort on the 0.3 ha flare-up with the head at ~550 m from R2 and residents in Lahdenkylä codes D (rescue first, greatest threat; `27` §7.4's first constraint now applied to V14). `soundVia` is reported per view. Effect: V14's C rate falls; H13 keeps three views; power re-run. Panel confirms (V14-b).

**3.3 V11 and the fallbacks (coa F5, conflict 1).** V11 stays keyed fit; the panel keys it with an explicit 20–40 min horizon and the whole record set after the flame table. Pre-registered fallback: a view the panel keys mixed or without 4-of-5 agreement is reported, not coded; H13 then runs on the remaining no-fit views and H14/H15 on the remaining fit views; `paper2-power.ts` gains a two-view case (the §11 reading 4 of `30` does not cover it).

**3.4 The premise table (coa F3, F4; RC).** V14 P2 becomes `not_contradicted` (the directive names no line; R2 is held, as V13's own note reasons; the flag pointed the guide at the SE head where a direct attack is D). V14 P1 stays contradicted (SPOT 19:23). P1 is re-worded (DRAFT, panel and native speaker) so that a new fire or a rekindle since the directive contradicts it in V9, V10 and V14 and nothing else does; the crew-safety rationale is not made a premise, so V11 stays fit. The V11/V12 notes drop "as the directive foresees". `30` §3's "sparks over R2" reads "sparks over the Honkaharju forest road". A treatment revision before any session: no pooling issue. The flag still fires in V14, so `30` §11's exposure assumption stands. The table is re-hashed (`npm run thinker:index -- --manifest-only`) after the panel.

**3.5 H2's items (sagat F01–F03, F06–F08, F10, F11, F14, F15, F24–F29; conflict 2; RC for F01).** The window stays 24 L2/L3 items in V2, V4, V5, V7, so `30` §11's H2 rows stand. Report-keyed numeric L3 keys stay primary (`08` ab D4) with two rules: the basis must be delivered by the freeze (test), and where the report-keyed and truth bands disagree a dual-key sensitivity (credit either) is pre-registered; F01 is re-authored so they agree. The six L2 items are rewritten as comprehension items (DRAFT, domain review). A format covariate (map vs choice) and a chance-corrected sensitivity are pre-registered (F31).

**3.6 Told / not told, three ways, and the digest (parity P-2, P-3; sagat F16; RC for H2t).** `aiStatedKey` counts only answers shown after the item's basis record and in the freeze's view or the one before, with element-tied patterns, and gains `statedLure`. Each L2/L3 item is classed stream-told (every key record pushed before the freeze), AI-told (stated by a shown answer, key recorded or computed) or neither; H2t contrasts the last two and reports the first. The guide's digest and both tools' recent matches reach the model without a search and were unlogged in the browser: the answer now carries their ids, the browser logs them, and exposure is defined as retrieved ∪ digest ∪ recent with a retrieved-only sensitivity; H9's `plantedExposure` uses the same definition. Effect on power: the "neither" stratum holds at most 16 items (8 are stream-told), so `30` §11's H2t figure (63 % at 30 % stated) is an upper bound; `h2-power.ts` is re-run with the split.

**3.7 Team understanding (sagat F04, F05; conflict 1, 7).** V6.b is re-authored on reachable records. The second items are "tool-aided probes": accuracy with the tools at hand, no latency-as-SA claim. H-T is analysed as an item-level mixed logistic model (own vs team × group, item random effects), not as a two-item difference; pilot 2 decides on more items.

**3.8 Freezes: "now", horizons, V12, the cap, the clock, the notice (sagat conflicts 3, 8; coa F10; F12, F13, F23).** For a view-end freeze "now" is the view's end (V10 17:40, V12 19:00, V14 20:00: the screen's clock, `08` y.1), stated in the freeze header; its L3 items are re-horizoned from it (V14's have no truth after 20:00, so they are report-keyed extrapolations without a truth band). V12's freeze moves after the plan (`FREEZE_AT_VIEW_END` = {10, 12, 14}): its items name Lahdenkylä and cue A in a fit view; F7's key records (steps 6–8) and H3's view (V13) are untouched; the cost is a possible cue into V13 (fit, H14). Every L3 stem names its horizon. The cap is 240 s for 8-item freezes. The consult notice is deferred past a freeze due within 15 s.

**3.9 Error classes (sagat (c), parity P-4).** `freeze-measures.ts` gains a descriptive fold: CORRECT, NOT_EXPOSED, EXPOSED_WRONG, STATED_WRONG, STATED_LURE, NOT_APPLICABLE, seq-anchored and route-aware (digest included), from each L3 item's `basisAtomIds` and `basisKind` ∈ {record, map, knowledge, ca_truth} (map counts as exposed; knowledge and ca_truth are NOT_APPLICABLE). These fields never reach the session or the render layer (`test/boundary/no-truth.spec.ts`). `score_freezes.py` is a pilot-2 cross-check on per-subset files only. The haversine map metric is pre-registered.

**3.10 Post-session block (sagat F17, proposal (a); parity P-6, P-12).** Two lure facts in source memory; believability, recognition ("reminded you of a real fire?", with the department and units) and prior demo/game use items (demo only since 21 Oct 2026, (bc)), each with a pre-registered exclusion or sensitivity rule; two perceived-reliability items (exploratory). About +1.5 min; `15` (ay) carries the shortening order.

**3.11 The flame-length table (FT; RC for the keys).** The phase-B flame bands are 2–3× short for the scripted rates (Byram; Kalajoki pairs 3–4 m/min ↔ 2.6 m, 5–7 ↔ 4–4.4 m). A provisional table per step and segment is authored in `tools/fire-ca/` and the records follow it, before the panel sees any record set; otherwise the panel keys on inconsistent physics and re-keys later. It may make V10 marginal and strengthens D at V11 and A at V12–V14 (§5); the panel decides. FMI/Prometheus HFI replaces it when available.

**3.12 Power re-runs before the pre-registration.** `h2-power.ts`: the three-way split. `paper2-power.ts`: act-based C base rates per view, V14's secondary route, the two-view fallback, exposure from pilot 2. H-T: pilot 2.

## 4. Conflicts with `30` settled

| Report: conflict | Decision |
|---|---|
| sagat 1 SPAM with tools, two items | Kept; named "tool-aided probe"; accuracy only (§3.7) |
| sagat 2 report vs truth keys | Report-keyed primary with delivered basis; dual-key sensitivity (§3.5) |
| sagat 3 freezes after the plan | Kept and extended to V12; "now" = view end, stated; re-horizoned (§3.8) |
| sagat 4 random freeze moment | Kept; "plan committed before the freeze" pre-registered as a covariate (`15` r.3) |
| sagat 5 Agent-SA | None in session; verification tags and log measures |
| sagat 6 QASA | Not in the professional study |
| sagat 7 H-T difference score | Item-level model (§3.7) |
| sagat 8 L3 horizons | Every stem names its horizon |
| sagat 9 `08` rule (d) | Restated: no L3 key may be read off the screen (the envelope's head is a lure read by `projectionReliance`, never a key) and every horizon lies within the scenario's data; the "never at the envelope's horizon" wording is retired (`08` (ay)) |
| sagat 10 chance correction | Format covariate and sensitivity (§3.5) |
| coa 1 grid vs cells | Probe plans kept; fallback pre-registered (§3.3) |
| coa 2 what the panel keys | The posture × sector × secondary key is derived from the panel's plan ratings (`16` t.3 extended) |
| coa 3 cueing | V12 after the plan; V8/V11 SPAM and V13's U item recorded in the pre-registration |
| coa 4 information rule | "Reachable by the view's end"; the panel sees every reachable record, marked pushed or recorded |
| coa 5 premise statuses | §3.4 |
| coa 6 fixed vs shuffled options | Fixed order kept (identical stimulus), stated; labels parallel after the native check |
| radio 1 parity | Between groups, not pushed vs recorded; `parity_check.py` not run as a gate |
| radio 2 premise line | No conflict |
| radio 3 recorded-only quantities | Kept (`27` §7.1); briefing says units' answers to the command post appear in the records; domain reviewer on DF-01/02 |
| radio 4 V14 R2 distance pushed | Records stay; `27` §7.2's V14 row is stale (V14's deciding quantity is the flare-up's size); the item is redesigned (F02) |
| radio 5 real area codes | VERIFY first; rename only on a confirmed collision (WP-6) |
| radio 6 text-only delivery | No conflict |
| radio 7 Kalajoki dynamics | Kept, slurry tanker included; the recognition item and exclusion rule carry the risk |

## 5. Data the scenario must add before Gate A

| # | Item | Where | Keys it could change | Owner |
|---|---|---|---|---|
| D1 | Flame-length table per step and segment (provisional, Byram/Kalajoki; Prometheus HFI later); record bands follow | `tools/fire-ca/` (new module read by the traffic generators), records, `cycles.json` `fl_*` | V10 (may become mixed), V11 (toward D), V9 (flank attack only); V12–V14 stronger | WP-1 |
| D2 | Time-aligned export: fire type, flame band, bearing in the rate's window; bearing null at rate 0; spotting dated to its source step; `smouldering_spots` from "voivat kyteä" | `tools/skills/` | None (removes 5 false flags) | WP-4 |
| D3 | Station T/RH/dew point every step, incl. 17:00, 19:00, 19:40, 20:00 (no evening recovery) | records | None unless a recovery were authored (it is not) | WP-1 |
| D4 | CO/zone proxy per crew position from the downwind/smoke rule | export `placements[]` | None; soundness of KY21 (c17), EK16 (c18) for the panel | WP-4 |
| D5 | Crew sizes (`persons`) | export | None | WP-4 |
| D6 | Hose carried and layout per unit; MPV25 lay limit (MISSING → PO) | export, thresholds | Feasibility of the secondary route in V9/V14 (one unit vs two), not the posture | WP-4, PO |
| D7 | Shift hours | export | None | WP-4 |
| D8 | LCES lines for the R2 crews 19:00–20:00 (escape route, named safety zone); KY21 18:26; EK16 19:0x | records | None; the panel's A-soundness rests on them | WP-1 |
| D9 | L4 precursor | — | Rejected (§2.4) | DR |
| D10 | Prometheus inputs: tuned grid and lookup, hourly weather with FWI codes, ignition polygons, breaching | external | The validation itself; phase-A forcing if out of tolerance | R, FMI |
| D11 | EK14 typed as an equipment-class unit | export | None | WP-4 |

## 6. People, before the pilot (merges `30` §8 and `11` §7.30)

1. **Researcher:** repository private or keys out before recruitment; the demonstration gated during recruitment (game mode removed 21 Oct 2026, (bc)); confirm the RC decisions (§3.1, 3.2, 3.4, 3.5 F01, 3.6, 3.11) before the pre-registration; send the Prometheus request; model pin and weekly probe; strata sizes; command experience as covariate; the pre-registration additions of `09` (ay); run the power tools (§3.12).
2. **Expert panel (one packet, after WP-1):** rating sheets for V9–V14 including the probe plans; each view's full record set (pushed/recorded marked) after the flame table; instructions: horizon 20–40 min, edge state and crew presence for flare-ups, CO unknown, burnouts not rated; ≥ 4 of 5; the key derived from the ratings; decides coa F1, F2, F5, F6; the premise table's statuses and P1's wording before hashing; FT-T3/T7 (phase-A water supply), whether KY21/EK16 would be pulled earlier.
3. **Domain reviewer:** the items of §2.1 marked DR (F01, F04, F06, F09, F10, F17–F20, F28), the R1 stretch, the V14 backup pair, the source-memory facts, rule (d) as restated, `27` §7.1 (deciding quantities by radio; DF-01/02 framing), TE-11, CA-01/02/04, TG-04, coa F7 and F14, a non-locational cue before US3, the flame table's credibility to Finnish firefighters.
4. **Native speaker:** every new or changed Finnish text: the freeze header, task definitions, "Linjan pito tiellä tai vesistöllä", P1, the rewritten items and distractors, lure facts, the post-session items, the briefing sentence, record rewrites of WP-1.
5. **Pelastusopisto (VERIFY 1–15 of radio.md):** call-sign scheme and collisions, VPK and UAS forms, P2's form, talk groups, who releases units, spotting-flight reporting, the §7.1 question, terms (heite, taustapoltto, laukaisupiste, pakotie, suora sammutus), "missä teho sallii", transcription plausibility, near-future assets, the harvester, the 51–68 m/min line. Answers feed WP-6.
6. **FMI / Pelastusopisto (PromS):** the Prometheus ensemble (7 members, gust member, Finnish lookup), the flame table, the dew-point drop and RH 26 % evening, FWI 55 / ISI 23 within Finnish experience, US3 on the upwind edge, MPV25 tables 3–7.
7. **Ethics board:** the notification, plan-confidence item, source-memory block incl. lures, the new post-session items, two groups of 50.
8. **Pilot 2 measures:** `aiStatedKey` rates by class (> 15 % AI-told → rewrite), exposure (consult opened, chip, decision questions before the plan, digest reach), session length and freeze timeouts by position, V6.b/V3.b accuracy (H-T item count), knowledge-item ceilings (F09), blocked plan intentions (coa F7), plan-confidence reactivity, the `score_freezes.py` cross-check, C base rates per view under both codings.

## 7. Phase-3 work packages

Each package runs in its own worktree with the file ownership below; nothing outside its list is edited. A package that finds it needs another's file records the need in its hand-off and the integrator reconciles. Every package runs `npm run ci` before hand-off. Spec text is the integrator's, except WP-2's regenerated item table.

**WP-1 Scenario content, keys and the Thinker index** (the only package that re-indexes). Owns: `tools/fire-ca/**`, `tools/thinker/**`, `tools/validate/**`, `app/scenario/demo-story.ts`, `demo-scenario.ts`, `site-scenario.json`, `site-meta.json`, `demo-directive.ts`, `designed-events.ts`, `traffic-atoms.ts`, `app/render/ui/unit-roster.ts`, `app/i18n/place-names.ts`, `app/i18n/text.ts` (source names), `content/corpus/**`, `content/i18n/authored.en.json`, `records.en.overrides.json`, **`content/thinker/**` incl. `manifest.json`**, `content/site/**`; tests `test/scenario/{traffic-*,site-scenario,unit-deployment,designed-events,directive*,consistency-review,rekindle-contiguity,branch-statements,validator,open-items-fixpass7}.spec.ts`, `test/server/premise-check.spec.ts`, `premise-handler.spec.ts`, `test/engine/{rekindle,planted}.spec.ts`, `test/retrieval/**`, `test/i18n/**`, `test/boundary/directive-keys-boundary.spec.ts`, `test/fire-ca/**`. Changes: D1 flame table and record bands; D3 RH series; D8 LCES lines, KY21 18:26, EK16 19:0x; coa F2, F13 (sensitivity), F16; premise table F3/F4 (DRAFT) and `directive-premises.json` P1; radio TE-06, TE-04, TE-08, TE-12, TE-13, ST-02–ST-08, TG-02, TG-03, CS-06, CA-01, CA-03, FB-01, CO-01–CO-04, DF-02, EN-01–EN-06; roster region labels (CS-01). Rule: a record cited by a key regex outside this package's files (freeze banks, `demo-probes.ts`, `source-memory.ts`, `keyStatements`) is not reworded; the build's throw-on-no-match enforces it; such rewrites go to WP-6. Acceptance: `npm run thinker:index` (both languages) run once at the end, manifest hashes current, `npm run validate:scenario` clean, 14/14 flags, designed-event ids and ranks documented, `test/server/premise-check.spec.ts` asserts V14 P2 not contradicted and P1's new text, a flame/rate consistency check added to `tools/validate/fire-physics-checker.ts`, V9–V14 basis texts read figures with `recordFigure`.

**WP-2 Items, probes, session timing and participant texts.** Owns: `app/scenario/freeze-bank*.ts`, `freeze-keys.ts`, `freeze-key-statements.ts`, `demo-probes.ts`, `probe-keys.ts`, `practice-spam.ts`, `source-memory.ts`, `views.ts`, `contract.ts`, `briefing.ts`, `types.ts` (item fields only), `app/session/{consult-notice,view-clock,orchestrator,questionnaire,freeze-answers,option-order}.ts`, `app/render/ui/components/{FreezeScreen,ConsultNotice,SpamCard,VisibleProbeCard}.tsx`, `app/render/ui/tour.ts`, `app/i18n/{ui,study-texts}.ts`, `content/i18n/labels.en.json`, `SPEC/08` §y.6 table regeneration (+ `tools/review/freeze-table.ts` if none exists); tests `test/scenario/{freeze-*,spam*,source-memory,demo-schedule,practice-*,views,briefing}.spec.ts`, `test/session/**`, `test/render/**`, `test/boundary/{no-truth,render-boundary*}.spec.ts`. Changes: sagat F01–F04, F06–F08, F11–F15, F17–F20, F22–F29, proposal (a) tags and the two post-session items; coa F1(b), F8, F10, F11; TE-05; DF-01 (c) briefing sentence; P-6, P-12 post-session items; `basisAtomIds`/`basisKind` on L3 items (analysis metadata, never in the session). Acceptance: tests for the delivered-basis rule, the ≥ 2 × tolerance rule, the horizon-in-stem rule, ascending bands, the 15 s notice gap, V12 at view end (`freeze-at-view-end`, `demo-schedule`), the repaired recall guard (must fail on 588908b's `se_front_r2`, pass after), `no-truth` still passing, the 2/2/4 and 2/2/2 mixes and the 1.3× rule, `keyStatements` on every rewritten L2/L3 item, the item table regenerated.

**WP-3 Analysis, telemetry, the answer record and power.** Owns: `app/telemetry/**`, `server/thinker/**` (code only; content is WP-1's), `app/session/{queries,thinker-protocol,thinker-transport,open-answer,template-answer,chat-display}.ts`, `tools/power/**`, `tools/review/export.ts`; tests `test/telemetry/**`, `test/server/**` except the two premise specs (WP-1) and `production-server.spec.ts` (WP-5), `test/engine/thinker-fixtures.ts`, `test/log/**`. Changes: coa F1(c) act-based primary coding with the label coding as sensitivity (`codePosture` gains `attended`, `cellByAct`); `soundVia` per view in the export; coa F6 (V13 secondary attacks reported); P-2 digest/recent ids in the response and `ai_chat_answer_received` (format 0.11.0, `07` (ay)), routes `digest`/`recent` in exposure, `plantedExposure`; P-3 three-way split in `h2tSplit`; F16 windows, element patterns, `statedLure`; §3.9 error-class fold; F21, F30, F32; H-T item-level model inputs; the lure-acceptance index; the power tools' new cases (§3.12). Acceptance: `derived.spec` covers the V9/V10/V14 probe plans under both codings; `freeze-measures.spec` covers the fold on a session with and without digest ids; old logs (no ids) still parse; `test/server/thinker-open.spec.ts` asserts the ids in the response; the server log unchanged.

**WP-4 Export for Gate A.** Owns: `tools/skills/**`, `dist/skills/**`; tests `test/tools/**`. Changes: D2, D4, D5, D7, D11, segment convention from the active front, aircraft exempt from LACES fields. Acceptance: the export regenerates byte-identically from a clean tree; `fire_check.py` on the new `cycles.json` shows the five pairing flags gone; DATA_SOURCES documents each new field.

**WP-5 Game mode and recruitment gating.** Owns: `app/game/**`, `content/game/**`, `server/production/**`, `tools/deploy/**`, `docs/DEPLOYMENT.md`; tests `test/game/**`, `test/game-ui/**`, `test/server/production-server.spec.ts`. Changes: P-12 timeline (no event at the study's keyed times or places: 17:00 origin rekindle, 15:30 line de-energising, 17:40 recall, refusing households at Lahdenkylä, the 19:00 north-westerly at Lahdenkylä), a `RECRUITMENT_GATE` flag that hides the demonstration and game start page, `29` §2.3's rule as a test over the scenarios. Acceptance: `npm run game:balance` re-run and recorded; the gating test; nothing under `?tuotanto` changed.

**WP-6 (deferred: after VERIFY 1–15) Call signs and terminology.** Owns, when it runs, WP-1's and WP-2's regex files for the cited records only, by agreement with the integrator: CS-01–CS-05, CS-07, ST-01, ST-10, TE-01, TE-02, TE-03, TE-07, TE-09, TE-10, CO-05, CO-06, DF-01's framing, EN-08. One re-index; before the main study, after pilot 2 if the answers are late (pilot and main study are not pooled).

Order: WP-1, WP-2, WP-3, WP-4 and WP-5 run in parallel; the integrator merges WP-1 last (the re-index), then runs `npm run ci` and `npm run skills:export`, and prepares the panel packet.

## Revision 19 Oct 2026 (az) — integration of WP-1 to WP-5

Merged in the planned order, WP-1 last: WP-3 and WP-2 (`cf12140`), WP-4 (`fb0e7cb`), WP-5 (`4b38cc8`), WP-1 (`47c9a41`); integration fixes `0bc6a85` and `3d3b101`. At `0bc6a85`: `npm run ci` passes (227 test files, 2655 tests; typecheck and determinism lint clean) and `npm run validate:scenario` is clean (crew safety: 18 findings, each with a radio safety line). WP-5's game timelines and gate are recorded in `29` (az); the power re-runs in `30` (az); the item table in `08` (az).

**Reconciled at integration.**
1. **Key regexes.** Six key regexes WP-2 added after WP-1's base cited records WP-1 had reworded into first-person radio style (EK14 ×2, KY21, EK16, VPK, EK11); they now match the new wording: the same records and the same values. The `residents` basis computes its radio ids (the police record is 18.6 since D8's LCES line took 18.5).
2. **The act coding reads the core front for the primary (RC, with §3.1).** WP-3 read the keyed front with its boundary sectors in both codings. Once F13 made L2 a boundary sector at V9–V10, a mop-up or held line on L2 coded D on the primary act coding, against F13's "sensitivity only". Now `attended` and `cellByAct` read the core sectors; the boundary sectors enter only `cellByActWithBoundary`, as in the label coding. V14's L1 side follows the same rule: a mop-up there codes B on the primary and C in the sensitivity (WP-3 coded it D). The review packet marks boundary sectors as the sensitivity's. The researcher confirms this with §3.1.
3. **TE-06** applied ("missä palon voimakkuus sallii"; `labels.en.json` key and `directive.spec`).
4. **The export's flame values.** The loader took WP-1's `flameAt(rate, landCover)` for a step lookup; it now reads `flameTable(steps)` and uses the table only where the records follow it (phase B). Phase A keeps quoting its records, so their mismatches stay visible.

**Left open by phase 3.**
- **The Thinker index is PROVISIONAL.** The embedding host returned 403 in this container. WP-1 built the index with `npm run thinker:index -- --carry`: vectors for the changed records (210 fi, 281 en) are carried from the previous index, and the manifest is marked PROVISIONAL. TE-06 changed the V1 intent after that build. Before pilot 2, on a machine that can reach the model: `npm run thinker:index` (both languages), then `npm run thinker:eval -- --write`. The lexical eval still selects collapse3, and 4 need snapshots have drifted.
- **Phase-A flames.** 24 phase-A records state flames their rate cannot give (e.g. DR1 "1–2 m" at 7–10.6 m/min); the table is computed for phase A but those records are unchanged (panel, WP-6). `fire_check.py` on the export at `3d3b101`: 0 LIKELY_ERROR, 3 REVIEW and 1 INFO, all in the phase-A crown run. Step 5 is a crown run at 14.1 m/min (Kalajoki: 15–30). Step 6 is a 38 m/min "surface" step with 400 m spotting and no active crown. Both go to the panel and FMI (§6 items 2 and 6). The phase-B flame flags of steps 17–19 are gone.
- **For WP-6.** Eight move messages keep their logged wording (ST-07: EK11@3, EK11@6, EK12@6, EK14@8, EK15@10, OUT1@16, OUT2@16, VPK@19); "kylläinen" remains in `evt.c06.015` and `evt.c06.017` (cited by the freeze bank).
- `tools/fire-ca/traffic.ts` and `deployment.ts` exceed the 500-line rule (they did before WP-1); a split is a separate refactor.

**Phase 4: the independent review (19 Oct 2026).** A reviewer model separate from the implementers read the integrated diff (`b884cf4..114070e`), ran the suite and traced every finding. It found **no blocking defect in code**. It confirmed the act-coding change of item 2: reading the core front for the primary keeps the act coding parallel to the label coding it replaces. It also confirmed that no key moved silently (every key resolves to the same record before and after WP-1, except the authored band changes), that the premise check flags V9, V10 and V14 (P1) and nothing in V11–V13, that phase-B records follow the flame table, and that the (az) power reading is fair. Its findings and what was done:
1. **H15 and H13 read different alignment** in the no-fit views (V9-f: a departure for H13, aligned for H15). Fixed at `19418c9`: H15 reads the act's alignment (`h15Aligned`), the label's is its sensitivity; power in `30` (az). **RC with §3.1.**
2. **§3.1's sentence is wider than the code at V14.** "An attending plan with an aligned main posture is C" reads, as built: *C when the key's secondary route accepts the main effort (V9–V10: any sector with an aligned posture; V14: Lahdenkylä's sector, §3.2), else D.* The researcher confirms this wording with §3.1; the panel rates the plans without it.
3. **The recruitment gate with an ungated build.** The server refuses only the chunk carrying the game's marker; a gated server serving an *ungated* build would still serve the game's other chunks by their hashed names. Gated builds delete them (`game-gate.ts`) and `main.ts` warns, so this is deployment discipline: build with `RECRUITMENT_GATE=1` (`docs/DEPLOYMENT.md`). *Lapsed 21 Oct 2026 (bc): game mode removed; a gated deployment is a normal build served with the gate.*
4. **§3.9's "these fields never reach the session"** is too strong. `basisAtomIds`, `basisKind` and `family` are copied into the session's item objects, as `keyAtomIds` already were; the screen whitelist (`screenFreezeItem`, `app/session/freeze-answers.ts`; `test/session/freeze-screen.spec.ts`) keeps them off the screen. Read §3.9 as "never reach the screen or the render layer".
5. **V14 `flare_next` is near stream-told.** The pushed 19.42 line ("Savu painuu kaakkoon Rahkasuon suuntaan") nearly states the key "spreads south-east", and the recall guard does not see "savu painuu kaakkoon". This goes to the domain reviewer; if the item is kept, it is classed stream-told in H2t.
6. **Export flame field shape.** In phase B the export's flame band is the table's point value; DATA_SOURCES says so (export package of phase 4).
7. `tools/validate/fire-physics-checker.ts` still prints an ERROR for the authored crown-run collapse at 15:20 (30 → 8 m/min, FT-C14). It is not part of `validate:scenario`; nothing regressed.

**Also in phase 4.** The pipeline status against Gates A–D is in `docs/audits/2026-10-19-skills/pipeline_status.md`: A blocked on the Prometheus run; B, the panel, now has its packet (`npm run review:panel`, blinded, with a leakage test); C and D pass with review items. The proposed Prometheus thresholds (0.2.0-proposed) are committed in `docs/audits/2026-10-19-skills/fire_tactical/`. The panel packet's generator makes three DRAFT plan-text edits that the flame table made necessary (V11 S, V14 X, V11 Z; `PLAN_EDITS`), for the researcher to confirm. The export now carries each crew's own LACES statements with their record ids (`6fcb385`, `tools/skills/laces.ts`): ground placements failing the tactical check fall from 163 to 140 of 163, "no comms" from 163 to 0; the 110 failing on LACES alone are crews that state no escape route or safety zone in their posting (for the panel). Open choice for the researcher: a task relabel at the same spot (attack → mop-up as the edge goes cold) restarts the posting, so the crew must restate its route.

**Phase-4 fixes (20 Oct 2026).** What could be fixed without people was fixed; `npm run ci` passes (229 files, 2696 tests) and `validate:scenario` is clean.
- **Radio wording WP-1 had to leave:** TE-08 ("kylläinen" → "lämpökameran kuva saturoitunut latvapalon kohdalla, reunaa ei erota", `evt.c06.015`, `.017`) and ST-07 (the eight move messages in first-person radio form; their regexes updated; same records and values). Drafts for the native speaker.
- **Phase-A flames follow the table (RC with §3.11).** The records of every step 1–20 now state the table's bands (crown above 12 m/min: "liekit puiden latvojen yli", class 5/5); the flame/rate check in `validate:scenario` covers all steps (24 phase-A findings before, 0 after). No key changed value. For the researcher and the domain reviewer: **V2 `south_flank`** (key "Reuna pysyy matalana") is now contradicted in wording by EK12's 14:06 record ("liekit 2–3 m") though its 14:08 record says "matalaa paloa" — re-key or re-author; **EK11's 14:45 trigger point** was raised from two to three metres (the flanks are 2.4–2.9 m from 13:20, so a two-metre trigger was met before it was set; DRAFT); the "low fire" narrative lines left as written (`evt.c02.008`, `c02.021`, `c03.023`, `c04.019`, `c05.008`, `c07.007`, `atom.radio.2.1`) and the practice step's "0,3–1 m" (`evt.vp.002`, `.008`; outside the table) are for the domain reviewer. `fire_check.py`: 0 LIKELY_ERROR, 2 REVIEW, 1 INFO (the crown run's calibrated rates at steps 5–6: FMI, panel).
- **V14 `flare_next`** now keys on the records its basis cites (stream-told); it fails the extended recall guard (stories 19.3 and 20.1 say the smoke goes south-east) and is marked for the domain reviewer, kept.
- **Checker noise:** the authored crown-run collapse (15:20, FT-C14) prints `[AUTHORED]`, any other drop still errors.
- **Recruitment gate fails closed:** a gated server refuses to start with a build that still holds the game (review note 3). *Lapsed 21 Oct 2026 (bc) with game mode.*
- **Panel packet:** V8's record set and premise questions added (27 questions).
- **Exposure routes tested end to end:** a guide-group test session with digest and recent ids; `exposure.csv` carries the routes, the retrieved-only file excludes them.
- The Thinker index stays PROVISIONAL (carried again; 259 fi / 326 en vectors carried): `huggingface.co` is still blocked here.
