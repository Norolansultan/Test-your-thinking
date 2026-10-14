# SPEC — Verification of machine-generated projections in wildfire incident command

**Programme:** Doctoral study, Kalle Koivunen, LUT University
**Spec version:** 3.0 · 13 September 2026
**Status:** Governing. This directory replaces every prior design document.

> **Changelog**
> - **14 Oct 2026 (aw)** — index row for `29` (game mode): a separate live, playable mode; the instrument and its invariants are unchanged.
> - **13 Oct 2026 (av)** — index row for `28` (TAK base): the TAK-based build in `Test-your-thinking/tak-sim/`; TAK shell default, classic shell `?klassinen`, `uiShell` in the header; open items in `11` §7.29.
> - **11 Oct 2026 (au)** — planned sample 210 = 3 × 70 (blocks of 42, 14 : 14 : 14); Haku 70, Thinker cells 70 + 70; Paper 2 70 vs 70. `02`/`09`/`27` revisions (au); power to recompute.
> - **9 Oct 2026 (af)** — one shared study link, `?tuotanto`: the hosted study server (`AUTO_ASSIGN=1`) issues the next unused allocation code when the participant presses start, persisted so no code is issued twice; never on a local run; the header logs `assignmentSource`; `ASSIGN_CELLS` restricts the codes to some cells for a pilot only (`27` af; `02`, `11`, `15`; `docs/DEPLOYMENT.md` §7.1).
> - **9 Oct 2026 (ae)** — English sessions name places and codes in English, on the map and in every text, from one table (`app/i18n/place-names.ts`; `18` ae); the briefing page and the English glossary are removed (`15` ae); `11` §7.21.
> - **9 Oct 2026 (ad)** — fix pass 7: the researcher's open items of `11` §7.18 (V10's two-hour L3, the projection-direction key, the freeze's cap and missing answers, the units' tasks in V11–V14, the tool notes, KY21's V14 report, EK11's handover, L4 secured at 16:40, water drops and hose lays) decided and built; `11` §7.20 closes them (`02`, `07`, `08`, `09`, `15`, `16`, `18`, `24`).
> - **9 Oct 2026 (ac)** — the AI literacy questionnaire is the first task after consent, before the preflight: **SNAIL** (Laupichler et al. 2023; 31 self-report items, 7-point scale, TU/CA/PA; verbatim English, DRAFT Finnish), for comparability with Fernandes et al. (2026). It has a 5-minute cap and can be skipped, and it runs in every cell, study and demonstration (`15`, `09`, `07`, `11` §7.19). It replaces the pre-session AI-literacy component and, as amended the same day, AILIT-S. No new hypothesis.
> - **8 Oct 2026 (ab)** — fix pass 6 (persona round 5): the Open Thinker assesses and never enforces (`14`, `02`, `27`); recency, clocks and digest; report-keyed numeric freeze items (`08`); the departure note, the AI's verdict and the baseline covariate (`16`, `09`, `27`); generator realism (`18`, `24`, `26`); open items in `11` §7.18.4. See the revision at the end.
> - **8 Oct 2026 (aa)** — final fix pass: `27` resolves Paper 2 (a directive-aware Open Thinker against Haku, 130 vs 70; the directive on screen from V8); `01`/`09` restate Paper 1 (no no-LLM control); `08` item table regenerated; `18`/`24`/`26` world and realism changes, flags 14 / 14. Index rows and the conditions row below read accordingly.
> - **8 Oct 2026 (z)** — file roles after the Haku / Open Thinker redesign: `02` (z) Haku is a structured LLM chat for every cell, the AI group adds the Open Thinker, `linjaus` withdrawn; `14` serves both chats; `25`'s query builder is withdrawn from the UI (kept as a record); `27`'s manipulation is withdrawn and Paper 2 is OPEN (`27` revision (z), `11` §7.18; **superseded by (aa): Paper 2 is resolved, `27` revision (aa)**). The conditions row below is superseded: Haku (70, structured LLM chat) · Haku + Open Thinker (130, cells 2 and 3 now identical).
> - **4 Oct 2026 (u)** — index row for `27` (phase B and Paper 2: design, manipulation, measures, power; governing for phase B). The three cells are built as `02` revisions (f)/(j) specified, with cell 3 now the strategy-guided Thinker (`27` §2–§3); the conditions row below reads accordingly. On phase B and Paper 2, `27` wins over `01`, `02`, `07`, `08`, `09`, `14`, `15`, `16` and `26` regardless of file number (§1 rule 4): each of those files carries a revision (u) note that says so.
> - **25 Sep 2026 (q)** — I1, I3 and I6 carry a Thinker exception: live generation through the study's proxy (`14` revision (q)).
> - **23 Sep 2026 (j)** — radio removed as a participant tool (`02` revision (j)). Conditions are **Haku (70) · Haku + LLM (130)**. Tier T3 is retired. The conditions row and the tier glossary below are superseded accordingly.
> - **23 Sep 2026 (i)** — index rows for `23` (site selection), `24` (fire spread model) and `25` (query builder). Numbers 20–22 are left to the scenario-content documents in progress outside this directory.
> - **17 Sep 2026 (h)** — `18` adopted; index row for `19`.
> - **17 Sep 2026 (g)** — index row for `18` (scenario world-state draft).
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — study-shape table updated for `15` v1.1 and the single split AI group.
> - **17 Sep 2026 (b)** — study shape updated (§2), precedence rule 5 added (§1), index rows for `15` and `16`. Invariants unchanged.
> - **17 Sep 2026 (a)** — index rows added for `13` (non-governing) and `14` (proposed).

---

## 0. How to read this if you are the builder

You are building a single-page web application that runs one scripted wildfire incident. It runs in Finnish, for one participant at a time, unsupervised, on that participant's own computer.

The application presents a map, delivers scripted information, asks scripted questions at scripted moments, and records everything the participant did with microsecond-honest timing. It does not simulate fire, does not call a language model, and does not score anything.

Read in this order:

| # | File | What it settles |
|---|---|---|
| **00** | `00_README.md` | Precedence, vocabulary, the seven invariants, what is not yet decided |
| **01** | `01_Experiment_Design.md` | Why the thing exists; hypotheses; what must be measurable |
| **02** | `02_Conditions_and_Information_Routing.md` | The three arms; the capability matrix; the four information tiers |
| **03** | `03_Scenario_Master.md` | The twenty cycles, the fire science, the flag sequence, the map extent |
| **04** | `04_Data_Model.md` | **Every type. Start here if you are writing code.** |
| **05** | `05_System_Architecture.md` | Modules, determinism, freeze machine, asset bundle, replay |
| **06** | `06_UI_and_Interaction.md` | The layout, the time model, typography, information-design rules |
| **07** | `07_Telemetry_and_Logging.md` | Every record the instrument emits |
| **08** | `08_Probes_and_Instruments.md` | The probe taxonomy, the three-way judgement, scoring definitions |
| **09** | `09_Methods_and_Analysis.md` | Protocol, exclusions, analysis plan, power, ethics |
| **10** | `10_Build_Plan_and_Acceptance.md` | Milestones and the tests that must pass |
| **11** | `11_Open_Design_Register.md` | **What is still missing. Read before estimating.** |
| **12** | `12_Map_Symbology_and_Projection.md` | How the projection is drawn, why it is not graded, what goes on units |
| 13 | `13_Plan_Reconciliation_2026-09-17.md` | *Working document, not governing.* Conflicts between v3.0 and the 16–17 Sep plan decisions; forks registered in `11` §7 |
| 14 | `14_Retrieval_and_Response_Engine.md` | *Proposed.* Closed retrieval engine for query AI and reasoning AI; LLM-compiled information packages. **Since revision (q)/(z):** hybrid time-gated retrieval and the live model (`gemini-3.8-flash`) behind both the Haku chat (`/api/thinker`) and the Open Thinker (`/api/thinker-open`) |
| **15** | `15_Session_Structure_and_Probe_Schedule.md` | **Governing.** Prologue, 10 freezes × 5 items / 6 SPAM / 9 unprobed, session timing, participants |
| **16** | `16_Decision_Task.md` | **Governing.** Four-option course-of-action choice combined with allocation (Paper 2) |
| 17 | `17_Pre_Build_Review_2026-09-17.md` | *Review, not governing.* Design problems P1–P8, L3 inventory, handoff comparison |
| 18 | `18_Scenario_World_State.md` | *Adopted; pending domain review.* Setting, 2030 source inventory, intent and hinge texts, geography, weather series, fire behaviour, unit and drone timelines, faults |
| 19 | `19_Query_Database_Content.md` | *Proposed.* What the searchable database holds, how team communication enters it, what is never recorded, per-cycle inventory, routes for load-bearing items |
| 23 | `23_Site_Selection.md` | *Adopted in principle; site not yet chosen.* How the fire's real location is found — spread capacity first; real place names; three fixed zoom levels |
| 24 | `24_Fire_Spread_Model.md` | *Adopted in principle; parameters provisional.* The Alexandridis (2008) cellular automaton that generates the truth perimeters and the envelopes offline; deriving flags; findings on the template site |
| 25 | `25_Query_Navigation.md` | *Withdrawn from the UI 8 Oct 2026 (revision (z)); kept as a record.* The KUKA × MITÄ × MILLOIN query builder and lexical free-text search; decoy rule; telemetry |
| **26** | `26_Fifteen_Views_and_Rekindle.md` | **Governing.** 1 practice + 14 map views from merged steps; the rekindle arc |
| **27** | `27_Phase_B_Paper2_Design.md` | **Governing for phase B (V8–V14) and Paper 2.** The three cells and their assignment; the strategy-guided Thinker (`linjaus` field) as the manipulation; H13–H17; power; scenario inputs; threats and decisions **8 Oct 2026: the `linjaus` manipulation is withdrawn; Paper 2's contrast was OPEN (revision (z)); **resolved by revision (aa): a directive-aware Open Thinker against Haku (130 vs 70).** |
| **28** | `28_TAK_Base.md` | **Governing for the TAK-based build (`tak-sim/`).** The screen as a TAK common operating picture (ATAK/WinTAK conventions: 2525 symbols, GeoChat, Contacts, Overlay Manager, drone video, Range & Bearing, MGRS); every object as a Cursor-on-Target event compiled from the render boundary only; CoT export, TAK data package and replay outside study runs; the researcher-only EXCON truth display. Changes how things look and are encoded, never what or when (`00`–`27` decide that) |
| **29** | `29_Game_Mode.md` | **Governing for game mode (`app/game/`).** A separate, playable mode on the study's terrain: live fire (wind, slope, moisture, water, breaks, spotting), units the player commands, fog of war, radio, scenarios and scoring. Never offered or loaded under `?tuotanto`; its data are never pooled with the study's |

If a statement in 01–10 conflicts with a statement in `11_Open_Design_Register.md`, the register wins. The register marks that item as undecided, and an undecided item must not be guessed.

---

## 1. Precedence

1. `00_README.md` §3 (invariants) overrides everything.
2. `04_Data_Model.md` overrides prose descriptions of data anywhere else. Where a document describes a field in words and the data model types it, the type is authoritative.
3. `11_Open_Design_Register.md` overrides any document that appears to settle an item the register lists as open.
4. Otherwise, lower file number wins on questions of *what the study is*; higher file number wins on questions of *how it is built*.
5. **Amendments dated 17 September 2026.** Where a section in `01`–`10` carries a `[SUPERSEDED 2026-09-17]` marker, the document it points to (`14`, `15` or `16`, or the file's own dated amendment) wins over the marked text, regardless of file number.

**All previous documents are archived.** `01_Experiment_Design_v2.md`, `02_Architecture_v2.md`, `03_Scenario_Authoring_v2.md`, `04_Methods_v2.md`, `05_Probe_and_Freeze_Design.md`, `07_Scenario_Concepts.md`, `08_Incident_Scenario_20_Cycles.md`, `09_Realism_Review_and_Hidden_Information.md`, `10_Records_and_Querying_Design.md`, `11_Condition_Specification.md`, `12_Consistency_Audit_and_Open_Design.md`, `13_Settled_Shape_and_Layout.md`, `Paper1_Test_Specification.md` and all v1 files are historical record only. **Do not build from them.** They contain superseded cycle counts (eight, nine), a superseded condition name (`human`), a superseded two-scenario structure, and a superseded four-region layout.

---

## 2. The shape of the study, in one page

| Property | Value | Locked by |
|---|---|---|
| Scenarios | **One** | 01 §2 |
| Cycles | **Twenty** | 03 §2 |
| Sittings | **One continuous session**, with a single five-minute pause between cycles 10 and 11 | 09 §3 |
| Prologue (warm-up) | **Five cycles W1–W5** of the same incident before cycle 1, identical for everyone, no AI; then a 3-min interface tutorial | 15 §3 |
| Virtual time per cycle | **Twenty minutes.** Twenty cycles = 6 h 40 min of incident | 03 §2.1 |
| Real time per cycle | ~3.5 min average | 08 §5 |
| Task time | ~100 min incl. prologue; whole session **~140 min** including briefing and questionnaire | 15 §2 |
| Conditions | **Haku (70) · Haku + LLM (130)**, between subjects. Both groups have the same query builder and neither can contact units. The LLM is pull-only and its group is split **65 / 65** at the hinge (guidance once vs. intent line in AI answers). *(Until 23 Sep: Radio · LLM reasoning.)* **Superseded by (aa): Haku (70, structured LLM chat) · Haku + Open Thinker (130, cells 2 and 3 identical by design, directive-aware Open Thinker); no query builder; the directive reaches both groups.** | 02 revisions (f), (j), (z), (aa) |
| Participants | **210 firefighters** (3 × 70; revision (au); before: 200), mostly incident-command level | 15 §8 |
| Containment judgements per participant | **Twenty** (+5 in the prologue) | 08 §3.2 |
| Expectation-marking cycles | Ten (alternating), counterbalanced | 08 §3.3 |
| Blanked SA freezes | **Ten** (2 prologue + 8 main), **five items each** (2 × L1, 2 × L2, 1 × L3), confidence per item | 15 §4 |
| SPAM probes | **Six** (1 prologue + main cycles 3, 7, 11, 15, 20) | 15 §5 |
| Cycles with no SA probe | **Nine** (W1, W5, and main cycles 1, 4, 8, 10, 12, 17, 18) | 15 §4.2 |
| Course-of-action choice | Every cycle, four options (aligned/against × sound/unsound), plus allocation | 16 |
| Embedded contradiction | Exactly one, at cycle 18 | 03 §5 |
| Embedded omission | Exactly one, at cycle 12 | 03 §5 |
| Strategic-guidance hinge | Between cycles 10 and 11 | 03 §4 |
| Administration | Remote, unsupervised, participant's own computer, hosted web app | 05 §2 |
| Proxy validation | **Temporal holdout** — develop on cycles 1–10, evaluate on cycles 11–20 | 09 §7.3 |
| Licence target | MIT, clean-room, no AGPL/SSPL/source-available anywhere in the tree | 05 §9 |

---

## 3. The seven hard invariants

Violating any one of these invalidates collected data. Each has a named automated test in `10_Build_Plan_and_Acceptance.md`.

**I1 — Determinism.** Same scenario id, same version, same seed, same input sequence ⇒ byte-identical log, on any machine, at any time. No `Date.now()`, `performance.now()`, `Math.random()`, `crypto.getRandomValues()`, or UUID v4 anywhere reachable from the run loop. Iteration order is sorted, never insertion order.

**I2 — No wall-clock in logic.** Virtual time is the only time any decision, schedule or transition reads. Wall-clock appears in the log solely as the annotation field `tWallOffsetMs`.

**I3 — No network during a run.** Once the session begins, zero outbound requests until the run ends. All tiles, fonts, terrain, forest data, weather series and scenario content resolve into a content-hashed asset bundle beforehand. Telemetry uploads occur only after the run, or from a queue on a separate origin-isolated worker that is inert while `RUNNING`.

**I4 — Truth never reaches the render layer.** `TruthAnnotation` is stripped at a type boundary before any payload crosses into rendering. Truth leaking into the render layer is the bug class that would silently invalidate the study and remain invisible until analysis.

**I5 — Crash-safe, gapless logging.** Every record is durably persisted before the UI acknowledges the action that produced it. `seq` is gapless; a gap is a detected data-loss event and is reported, never silently tolerated.

**I6 — Retrieval closure.** The query subsystem can only return authored corpus content. It is structurally incapable of generating text. There is no language model in the instrument. The `substitutive` channel emits pre-authored structured signals, not generated prose.

**I7 — Licence purity.** MIT, BSD, ISC, Apache-2.0, CC0 for code; SIL OFL 1.1 for fonts; CC BY 4.0 for data. CI fails the build on anything else. **Voikko is specifically excluded** — it is GPL and would contaminate the MIT grant. Anything not originated by the author lives in `vendor/` with its licence header intact and an entry in `THIRD_PARTY_NOTICES.md`.

---

## 4. Vocabulary

Terms used with a fixed meaning throughout. Where a Finnish term is the participant-facing string, it is given.

| Term | Meaning |
|---|---|
| **Cycle** | One iteration of the fixed sequence in 03 §2.2. Twenty per session. Advances virtual time by twenty minutes. |
| **Bubble** | A pushed observation record that appears on the map and in the report rail. Tier 1. |
| **Atom** | Any single authored information record, of any tier. The corpus is 290–400 atoms. |
| **Tier** | T1 pushed / T2 system-queryable / T4 unit-to-unit lateral traffic (recorded lines only). T3 (ask a person) was retired on 23 Sep 2026. See 02 §3 and revision (j). |
| **Envelope** | The machine's projection of where the fire will be at the next cycle boundary, drawn as a polygon with a stated validity horizon (*ennuste voimassa klo HH:MM saakka*). |
| **Flag** | The authored truth about an envelope: `holds`, `breach_quantitative`, `breach_categorical`. Never rendered. |
| **Channel** | The `substitutive` condition's pushed integrated signal stream. Closed vocabulary, not prose. |
| **Signal** | One `ChannelSignal`: category, urgency 0–3, certainty, attribution, quiet flag. |
| **Probe** | A scripted question. Types R, J, E, F, U. See 08. |
| **Freeze** | A halt of the virtual clock for a probe. Two modes: `PROBING_VISIBLE`, `PROBING_BLANKED`. |
| **Hinge** | The point between cycles 10 and 11 where the duty officer delivers strategic guidance. Divides phase A from phase B. |
| **Branch** | An authored counterfactual development that does not occur. Used to score allocation robustness and safety. Never rendered. |
| **Contradiction** | The single authored pair of mutually inconsistent reports plus the lateral traffic that reconciles them. Cycle 18. |
| **Omission** | The single authored development that falls outside every envelope *categorically* — a possibility never represented. Cycle 12. |
| **Load-bearing fact** | An atom whose discovery would change a decision. Subject to the three-route reachability rule, 02 §4. |
| **Haku** | The search drawer. Present in all conditions; contents differ by condition. |
| **Avaa tekoäly** | The AI drawer. Present in `assistive` and `substitutive` only. |

---

## 5. Non-goals

Stated so nobody builds them.

No fire model. Fire behaviour is hand-authored from FWI reasoning (03 §3) and stored as geometry. The instrument replays; it does not compute spread.

No language model, in any condition. See I6.

No live multi-user operation. One participant, one session, no server-side game state.

No participant agency over the world. Allocations are recorded and scored; the incident develops as authored regardless. This lack of agency is deliberate and load-bearing — see 06 §4.

No adaptive difficulty, no trial-by-trial feedback, no runtime scoring. A runtime that scores can bias a subsequent probe.

No mobile or tablet support. Desktop or laptop with a minimum viewport of 1280 × 800.

No Russian-side map coverage. The extent is bounded to keep ~10 km of buffer from the Finnish–Russian border (03 §1.2).

---

## 6. Change control

The scenario corpus and the code are versioned independently and both are content-hashed.

Any change to authored content bumps `ScenarioContract.version` (semver). Any change that alters what a participant could see or when they could see it is a **major** bump and invalidates comparison with data collected under a previous major. Data collected across a major boundary is analysed separately or discarded; there is no merging.

Any change to these spec files is recorded in a changelog block at the top of the file, with date and the reason. A change that touches §3 of this file requires the whole set to be re-read for consequences, because every other document assumes the invariants.

---

## Revision 25 Sep 2026 (q) — invariant exceptions for Thinker

Follows `14` revision (q). The exceptions apply **only to Thinker**, only in the Haku + LLM group, and nothing else changes.

- **I1 (determinism):** everything stays deterministic except Thinker's wording. Its retrieval is deterministic, and its answers are logged and replayed from the log.
- **I3 (no network during a run):** Thinker's requests to the study's own proxy are allowed while `RUNNING`. No other outbound request is allowed.
- **I6 (retrieval closure):** Haku and every other surface remain closed. Thinker generates text, but only from the records its retrieval returns, and its output is logged.

---

## Revision 8 Oct 2026 (aa) — file roles after the final fix pass

- **`27`** is resolved: Paper 2 contrasts a **directive-aware Open Thinker** (cells 2 and 3 pooled, 130) with **Haku** (70). The command's directive reaches both conditions as P2's radio message at V8 and as a persistent on-screen line. The primary outcome is whole-plan alignment. The conditions row of §3 reads: **Haku (70, structured LLM chat) · Haku + Open Thinker (130, cells 2 and 3 identical by design)**.
- **`01`, `09`:** Paper 1 has no no-LLM control; H1, H2 and H9 are an Open Thinker increment over a structured LLM chat.
- **`02`, `07`, `14`:** the directive on screen (`directive_shown`), the directive-aware Open Thinker prompt and plan context, the capability-matrix rows `hakuChat` and `openThinker`, the explicit "unavailable" state.
- **`08`:** the freeze item table regenerated (every freeze 2 L1 / 2 L2 / 2 L3).
- **`12`, `18`, `24`, `26`:** the English projection label; the weather text, releases and drone/water realism; the thermal-inertia retune and 14 / 14 flags; the directive at V8.
- **`11` §7.18.3:** what is closed and what stays open for the researcher.


---

## Revision 8 Oct 2026 (ab) — file roles after fix pass 6 (persona round 5)

- **`14`** carries the Open Thinker's frozen prompt (it **assesses, never enforces**; rules 1–8 quoted), Haku's recency and banner rules, the two clocks, the digest, the recency boost, the AI's verdict and `modelVersion`, and the documented post-freeze mismatch of the frozen neutral evaluation (the declared `collapse3` kept; the rule now narrowly selects `collapse3+cap3`).
- **`02`, `27`, `16`:** the Open Thinker's stance; the departure note in both conditions from V8; a burnout from a held road is in line and not a plan option; the phase-A share is not a covariate (baseline = practice view + V1); the AI's verdict and `accountableDeviation`; resume-aware coding.
- **`08`:** numeric L3 items are keyed on the delivered **reports** (linear extrapolation), map and direction items on the truth; five keys moved; the item table regenerated.
- **`09`, `07`:** the idle scope, H10's `afterFreeze`, H9's `plantedExposure`, H5's `finalPlanPerView`, the redacted coding sheet; the new log fields.
- **`18`, `24`, `26`:** the generator realism pass (water, firebreaks, sprinklers, burnouts, weather, rate records, the V9 SPOT sector); the fire itself unchanged, 14 / 14 flags, 979 events.
- **`11` §7.18.4:** what this pass closed (including the retrieval mismatch: declared `collapse3` kept) and what stays open: the live word-count overshoot, the departure note's lack of a recipient, pilot checks, the consent placeholder, the exclusion-threshold pre-registration.

---

## Revision 9 Oct 2026 (ad) — fix pass 7, the researcher's open items

The register's open items carried in `11` §7.18.2 item 18, §7.18.3 item 8 and §7.18.4 item 7 are decided (delegated by the researcher) and built; `11` §7.20 lists each with where it is specified. Regeneration is byte-identical; 14 / 14 view flags; the fit/no-fit assignment of V9–V14 is unchanged.
