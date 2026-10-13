# 03 — Scenario master

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Consolidates `03_Scenario_Authoring_v2.md`, `07_Scenario_Concepts.md`, `08_Incident_Scenario_20_Cycles.md`, `09_Realism_Review_and_Hidden_Information.md` and `10_Records_and_Querying_Design.md`. Supersedes all five.

> **Changelog**
> - **4 Oct 2026 (t)** — the participant's superior is P2, not P3 (§4's "duty officer (P3) above" superseded). See the amendment at the end.
> - **25 Sep 2026 (p)** — session cut to 1 practice + 14 views by merging steps; the rekindle arc added to steps 10–13 (`26`).
> - **23 Sep 2026 (j)** — no asking (`02` revision (j)): T3 retired; the `directed` response script and the reply-latency check are removed; per-cycle T3 cues are converted or withdrawn. See the revision at the end.
> - **17 Sep 2026 (g)** — `18` world state adopted: cycle 1 renamed, starting force, cycles 8 and 14, crown-run gap re-timed, §8 and §10 notes. Query database content specified in `19`.
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Warm-up block, course-of-action step and probe placement changed. See `15`, `16`.

This is the authoring specification and the content plan. The builder implements the structures; the author (with the domain reviewer) fills them.

---

## 1. Region and extent

### 1.1 The box

Southeast Finland, the forested lake district south and southwest of Lappeenranta — Luumäki, Savitaipale, Miehikkälä, Ylämaa and the eastern edge of the Kouvola area.

```
Extent (WGS84), approximately 50 × 50 km
  south  60.62 N        north  61.07 N
  west   26.68 E        east   27.60 E
  centre ~60.845 N, 27.14 E
```

Coordinates are held internally as WGS84 lat/lon. The ETRS-TM35FIN (EPSG:3067) equivalent is derived at bundle build only, at the single conversion boundary (`05` §5).

### 1.2 Why the box is shifted west of due south

A 50 × 50 km box placed due south of Lappeenranta (centre ~60.85 N, 28.19 E) would extend past the Finnish–Russian border across a substantial part of its area. The border trends northeast from the Gulf of Finland through Vaalimaa to Nuijamaa; at the southern latitudes of such a box it sits near 27.8 E and at the northern latitudes near 28.5 E.

That is unacceptable for three reasons:

- The national data sources cover Finland only, so a cross-border extent produces a map with a blank half.
- A fire approaching an international border introduces cross-border coordination questions that distract from the manipulation and complicate ethics review.
- The extent would sit in a sensitive zone for no research gain.

The chosen box keeps roughly ten kilometres of buffer from the border at its closest point while remaining southeast Finland, south of Lappeenranta, in exactly the intended terrain. Lappeenranta lies about thirty kilometres east of the northeastern corner, which keeps the city out of the scenario and the region recognisable.

### 1.3 Terrain character

Managed boreal forest — pine-dominated on dry mineral sites, spruce on richer ground, birch in mixtures and along watercourses — with stand ages from recent regeneration to mature timber, which is what produces defensible variation in spread rate. Drumlin and esker formations give slope. Peatlands, some drained. Numerous small and medium lakes, with the southwestern arms of the Saimaa system to the northeast. A dense gravel forest-road network of variable load capacity. Scattered farmsteads, villages and a high density of summer houses near water, which supplies values at risk. Valtatie 6 crosses the north, Valtatie 26 the south; a railway runs Kouvola–Lappeenranta. The Salpa Line fortifications cross the area and are a real, map-visible feature.

**The extent straddles two rescue-service regions** (South Karelia and Kymenlaakso). This is kept deliberately: a multi-authority incident is realistic here and gives the `lateral` origin a natural basis.

### 1.4 Required divergence declaration

Finnish wildfires are typically small; a fire requiring sustained multi-unit incident command sits at the upper end of national experience and occurs in drought. The scenario deliberately places itself there.

This must appear in `ValidityClaim.knownDivergences`: *fire magnitude is at the severe end of Finnish experience, chosen so that the task requires multi-unit command, not to represent a typical incident.* Stating it pre-empts the obvious objection from a reviewer who fights fires for a living.

### 1.5 Data sources

All CC BY 4.0 or equivalent; all resolved into the asset bundle at build time.

| Layer | Source | Notes |
|---|---|---|
| Basemap, terrain, roads, water, place names | Maanmittauslaitos (MML) | Use the `WGS84_Pseudo-Mercator` tile variant where offered, so no reprojection layer exists |
| Forest stand data | Suomen metsäkeskus | Species, age, basal area, crown base height, thinning history |
| Weather series, FWI components | Ilmatieteen laitos (FMI) | Authored series, not live |
| Peatland, land cover | Syke | |
| Incident doctrine and case material | Pelastusopisto investigation reports | Narrative grounding only; no content copied |

---

## 2. Structure

### 2.1 Clocks

**One cycle advances the incident by twenty virtual minutes.** Twenty cycles is six hours and forty minutes — a realistic duration for this arc, long enough for smouldering to surface, short enough to stay within one operational period.

Every rate of spread then converts to a distance the participant can check: 5 m/min over twenty minutes is 100 m; 18 m/min is 360 m. **The projection envelope's horizon is always the next cycle boundary, twenty minutes out**, and it is rendered as such (*ennuste voimassa klo HH:MM saakka*).

Real time per cycle averages 3.5 minutes. Task time is about 70 minutes. See `08` §5 for the per-cycle budget.

### 2.2 The cycle

> **[SUPERSEDED 2026-09-17]** A course-of-action choice is inserted before the allocation, and SPAM probes can occur inside the working period. Updated sequence in the amendment below.

```
cycle_start
  → world redraw to the new timestamp; changed elements highlighted, decaying
  → working period — clock running; bubbles arrive at authored times;
      in `substitutive`, the channel pushes at a fixed offset into this period
  → [cycles with expectation marking] expectation prompt — picture visible, clock halted
  → projection reveal with validity horizon
  → judgement, confidence, and failure location or corrected projection
      — picture visible, clock halted
  → verification window — clock halted, tools available, revision permitted
  → [cycles 2, 5, 9, 13, 16, 19] recall probes — picture BLANKED, clock halted
  → allocation and free-text rationale — clock halted
  → cycle_end; clock advances twenty virtual minutes
```

Expectation marking is placed **late** in the cycle, after the working period: the delay between encountering the information and performing the generative act is the active ingredient, not the act itself.

### 2.3 Phases

| Phase | Cycles | Character |
|---|---|---|
| **A** | 1–10 | Initial attack through apparent success. Paper 1's clean window. |
| **Hinge** | between 10 and 11 | Duty officer delivers strategic guidance. **Five-minute real-time pause**, participant-dismissible, is placed here. |
| **B** | 11–20 | Re-establishment, conflict, contradiction, handover. Paper 2's window. Fatigue is highest and is modelled. |

---

## 3. The fire science the scenario runs on

The Canadian FWI system is the backbone, and it gives a principled way to make the machine's projection wrong rather than arbitrarily wrong.

| Component | Lag | Governs |
|---|---|---|
| FFMC | hours | Fine surface fuels; ignition and surface spread |
| DMC | ~12 days | Loosely compacted duff; moderate-depth consumption |
| DC | ~52 days | Deep compacted organic layers; smouldering and persistence |
| ISI | — | Wind × FFMC → rate of spread |
| BUI | — | DMC + DC → fuel available, depth of burn |
| FWI | — | ISI × BUI → intensity |
| ROS | — | FWI + FBP fuel type → metres per minute |

### 3.1 Four failure mechanisms, each physically principled

**M1 — the shower that isn't.** A brief shower raises fine fuel moisture; FFMC drops within hours. ISI falls, modelled ROS falls, and the projection says the fire is slowing. But DC has a fifty-two day memory: after a long drought the deep layers are still bone dry, BUI stays high, and the ground keeps burning below the surface. The surface looks beaten and is not. **This is the omission mechanism** and it is authored at cycle 12.

**M2 — mean wind versus gusts.** ISI takes a wind speed as input. A projection driven by ten-minute mean wind under-predicts runs driven by gusts, and the gusts arrive before the mean does.

**M3 — the fuel-type boundary.** Green deciduous in summer is a low-spread fuel and works as a natural break. Mature spruce is the opposite: high spread, genuine crown-fire potential. A projection using a stale or coarse fuel map treats the stand boundary as continuous, and ROS multiplies when the head crosses it.

**M4 — spotting.** Crown fire lofts embers past the head. No envelope projects a discontinuous jump.

### 3.2 Indicative rates — to be confirmed by the domain reviewer

Green deciduous surface fire 0.5–2 m/min; peatland surface 2–3 m/min; mineral-soil pine and spruce surface 4–11 m/min; active crown fire in spruce 15–25 m/min in a limited window.

Reference case: Kalajoki 2021 recorded 2–3 m/min on peat accelerating to 9–11 m/min on mineral soil, with a crown run at 15–20 m/min for about ninety minutes.

**Rates cycle by cycle are the judgement the author cannot make alone.** They are the first item on the domain reviewer's list (`11` §1.2).

### 3.3 Weather timeline

The weather is authored once, as a series, and **weather drives fire, never the reverse**. Wind is moderated to realistic Finnish summer values: mean 8–9 m/s gusting 12–14 m/s at the wind event, not the extreme values in earlier drafts. The shower at cycle 10 delivers **1–3 mm**, which is enough to change FFMC and not enough to touch DC.

---

## 4. The incident

The starting force is four ground formations (EK11, EK12, EK14, KY21), a volunteer brigade (VPK), a three-aircraft drone team (DR1–DR3) and a civilian harvester at the outset (`18` §8). Together this is approximately a *pelastusjoukkue* under a *joukkueenjohtaja* acting as *pelastustoiminnan johtaja*, with a duty officer (P3) above. The participant occupies this command level. Escalation to a *pelastuskomppania* occurs in phase A and is a decision the participant is party to but does not make alone.

### 4.1 The twenty cycles

| # | Title | Flag | Realism element | Hidden information |
|---|---|---|---|---|
| 1 | Command handover *(was: Arrival)* | H | Participant takes command from EK11's leader; EK14 and KY21 en route with ETAs; conflicting size estimates (11 ha drone vs 15 ha EK11); berry pickers possibly in the forest | T3 access road condition |
| 2 | Establishing the line | H | Escape routes when placing units | T4 two units informally agree a boundary |
| 3 | The second ignition | Q | Cause genuinely open | T2 ember damage on intervening ground; T3 ridge fuel is lichen-heath |
| 4 | Junction | H | Water-point selection | **T4 `t4.water_state`** |
| 5 | Into the spruce | Q | Crown-fire preconditions present in stand data | T3 stand unthinned, low crown base |
| 6 | Crowning | **C** | Near-miss report; standing dead trees | **T4 `t4.ember_warning`**, passed two cycles earlier |
| 7 | Resources and span of control | H | Duty officer asks a question; span of control | T3 arriving unit lacks terrain capability |
| 8 | Aerial support and the airspace problem | Q | Helicopter arrives after its requested lead time; DR1 and DR3 grounded north of R1, DR2 keeps flying over the south sector | T4 drone operator had warned a crew about battery |
| 9 | The wind backs | **C** | Summer-house occupancy uncertain; police liaison | T3 new head running on ground not covered since the drone was grounded |
| 10 | Apparent success | H | Shower 1–3 mm; crews report the sector **in hand**, never *extinguished* | T2 DC and BUI have barely moved; T3 ground warm underfoot, peat smell |
| — | **HINGE — strategic guidance from the duty officer; five-minute pause** | | | |
| 11 | Compliance and the first doubt | H | Relief planning begins | **T4 `t4.private_doubt`** |
| 12 | Smouldering | **C + OMISSION** | — | T2 ditch-maintenance record; T3 private briefing detail |
| 13 | Re-establishment | H | Water shuttle route cut by fire crossing the road | T3 depth of burn |
| 14 | The conflict | Q | The region requests KY21 and the VTOL drone DR3 for another fire; hinge rule 3 forbids release before thermal confirmation; case made to the duty officer, not to the region | T4 the second incident's crews discussing their own situation |
| 15 | Peat and depth | **C** | Hand tools and excavation; hoses marginal | T3 water not penetrating without agent |
| 16 | Reinforcement and unfamiliar ground | H | Bridge load limit; unfamiliar crews | T2 road register; T4 arriving unit asking a local unit for guidance |
| 17 | Second wind event | Q | Evacuation advisory decision | T3 occupancy confirmed for two houses |
| 18 | **The contradiction** | H | — | **T4 the lateral traffic that reconciles the aerial and ground reports** |
| 19 | Consequence | Q | Crew fatigue forcing rotation | T3 time on task |
| 20 | Handover | H | Handover including safety state | T4 outgoing crews briefing incoming ones |

### 4.2 Flag sequence

```
Cycle   1  2  3  4  5  6  7  8  9 10 | 11 12 13 14 15 16 17 18 19 20
Flag    H  H  Q  H  Q  C  H  Q  C  H |  H C+o  H  Q  C  H  Q  H  Q  H
```

`H` = holds · `Q` = quantitative breach · `C` = categorical breach · `C+o` = categorical breach that is also the authored omission.

**Ten holds, six quantitative, four categorical.** Containment base rate is fifty percent, which is what the measurement requires.

**Failures alternate with recoveries throughout.** An unbroken run of failures produces wholesale abandonment of the channel, which collapses the manipulation instead of measuring it. This alternation constraint is validated in CI against the authored flags.

### 4.3 Probe placement

> **[SUPERSEDED 2026-09-17]** Replaced by `15` §4.2.

```
Recall freezes (blanked)   cycles 2, 5, 9, 13, 16, 19
Containment judgement      every cycle, 1–20
Expectation marking        ten cycles, alternating; odd-cycle order A and
                           even-cycle order B, counterbalanced by participant code
Falsification items        three, at cycles 7, 14, 19
Uncertainty probe          cycle 18 (open), cycle 20 (forced-choice backup)
Coverage confidence        cycle 20
```

---

## 5. The contradiction and the omission

The scenario contains exactly one contradiction and exactly one omission. Both are typed markers on the scenario contract, not prose (`04` §2).

**The contradiction, cycle 18.** The aerial observer reports the northern flank accelerating; EK14 on that flank reports the line holding. Both are true to their own vantage. The reconciling detail — EK14 can see only its own sector — sits in T4 lateral traffic, reachable by all three routes (`02` §4.1).

Three contradiction candidates of graded subtlety are authored; pilot 2 selects among them. The selection is recorded in the scenario version.

**The omission, cycle 12.** The omission is a development that falls outside every displayed envelope **categorically** — not merely further in the same direction. The shower at cycle 10 makes the surface look beaten while DC keeps the deep layers burning; smouldering surfaces at cycle 12 in a location no envelope ever represented. This is the distinction between noticing a projection is imprecise and noticing that a possibility was never represented.

---

## 6. Projection envelopes

### 6.1 Form

Each envelope is a polygon for the next twenty virtual minutes, with the validity horizon rendered on screen. Envelopes are authored, not modelled. There are twenty envelopes, one per cycle, plus twenty **revision envelopes** if the request-a-revised-projection option in `08` §7 is adopted.

> **[AMENDED 2026-09-23]** Envelopes and perimeters are now generated at authoring time by the cellular automaton in `24`, then frozen. They remain authored artefacts: nothing is modelled at run time.

### 6.2 Accuracy mix and the declared divergence

| Flag | Target share | Count in twenty |
|---|---|---|
| `holds` | 45–55% | 10 |
| `breach_quantitative` | ~30% | 6 |
| `breach_categorical` | 15–20% | 4 |

This breach rate is higher than a well-tuned operational system would produce. **That is a deliberate measurement choice and must be declared** in `knownDivergences`: without error variance there is nothing to calibrate against. Participants are not told the rate.

Thirty containment items are authored for twenty slots, so that the pilot can tune difficulty into the 60–80% band by selecting among them.

---

## 7. The observation corpus

### 7.1 Record types

Each record type is named with its real Finnish counterpart, for realism. **Field structures are confirmed with the domain reviewer, not treated as authoritative here.**

| Type | Real counterpart | Character |
|---|---|---|
| Task record | Hätäkeskus / ERICA task | Structured, created once, rarely updated. Caller's account, first address, initial resource assignment |
| Situation log | Field command system entries | Free text typed by whoever had a hand free. The main record, and the most degraded |
| Unit status | Status codes | Semi-structured: *matkalla*, *kohteessa*, *vapautunut*. Entered late, or not at all |
| Radio traffic log | Virve group call metadata | Who called whom, when, on which group. Content only where someone wrote it down |
| Unit-to-unit traffic | Lateral calls between crews | Tier 4. Never reported upward |
| Aerial observation | Drone or aircraft report | Timestamped, precise, and **stops** when the aircraft is grounded |
| Reference data | Stand, road, water, maintenance registers | Accurate, complete, and out of date |

**Reference data is the only clean source. Everything a human typed under pressure is not.**

### 7.2 The clumsiness catalogue

Fourteen forms of degradation, each authored deliberately. The Finnish wording is rewritten into real register by the domain reviewer; the *forms* are the specification.

| # | Form | Example | Why it matters |
|---|---|---|---|
| 1 | Place named locally, not mappably | `15:42 EK12 ojan varrella savua, ei liekkiä, tarkistetaan` | "By the ditch." Which ditch. The area has many |
| 2 | Number without unit or direction | `16:05 tuuli kääntyny, nyt n. 8` | Eight m/s? Backed to what? |
| 3 | Hearsay not marked as hearsay | `16:20 kuulemma pohjoisreunalla kipinöi` | Who said so, and did they see it |
| 4 | Timestamp is when typed, not when observed | `17:10 (tilanne n. 16:35) linja pitää` | Thirty-five minutes stale, and only this entry says so |
| 5 | Status entered late or never | Unit shows `kohteessa` since 14:20 and has moved twice | The field is not wrong; it is abandoned |
| 6 | Two people log one event differently | `16:44 EK11 palo ylittänyt tien` / `16:47 P3 tien ylitys ei vahvistettu` | Both stand. Neither is retracted |
| 7 | **The record thins under load** | Nothing between 17:30 and 18:50 — the crown run | The most important item. Authored deliberately, never left to chance |
| 8 | Implication without cause | `18:55 emme pääse Susisaareen` | Road blocked, fire across it, bogged, or unsafe? The decision differs |
| 9 | Silence from a competent unit is identical to silence from a unit in trouble | Nothing from a sector for forty minutes | Nothing distinguishes "fine, busy" from "lost comms" from "in difficulty" |
| 10 | Correction without a marked change | An entry that read 2 ha now reads 5 ha | No history, no author, no time of change |
| 11 | Two locations for one report | Caller's coordinates and first unit's differ by 300 m | Both are in the record |
| 12 | Free text in a structured field | A paragraph in a one-value field | The parser takes the first token and discards the rest |
| 13 | Abbreviation collision | Local shorthand meaning different things to writer and reader | |
| 14 | **The report made by voice and never written** | A call in the traffic log — time, caller, group — with no content | The best query hook in the corpus |

Item 14 deserves emphasis. Seeing that EK12 called P3 for four minutes at 17:38, inside the gap, with no content logged, is a strong and realistic invitation to ask.

### 7.3 The gap taxonomy

| Gap class | Example | What the machine does | What a commander must do |
|---|---|---|---|
| **Imprecise** | "by the ditch" | Resolves to a point and renders it as certain | Notice the precision is invented |
| **Misfiled** | In another unit's log, or in lateral traffic | May not aggregate it at all | Think to look elsewhere |
| **Stale** | Status last set two hours ago | Carries the last value forward without marking it | Check the age of what they are reading |
| **Workload gap** | Nothing logged during the crown run | Shows no change, which renders as nothing happening | Read the silence as a signal |
| **Voice-only** | Call logged, content not | Has nothing to aggregate | Ask what was said |
| **Never recorded** | Under-canopy wind, duff depth, crew fatigue | Cannot know it exists | Ask a person |

**The workload gap and the stale carry-forward are the two that matter.** Both convert missing information into apparent stability, and both do it silently. Everything in the architecture — `unknown` as a first-class renderable state, graded visible staleness, informative silence — exists to make these visible. The `substitutive` channel deliberately does not make them visible.

#### Worked example — the crown-run gap

```
14:52  EK11   palo saavuttanut kuusikon reunan, käyttäytyminen muuttunut
14:58  DR3    kuva päivitetty
        ——— no entries ———
16:05  EK11   tilanne rauhoittunut omalla lohkolla
```

*(Re-timed 17 Sep 2026 to the crown run at cycles 5–7, `18` §7.)* Seventy-three minutes with nothing in the log, because everyone was working. The channel renders no change. A commander reads the silence.

### 7.4 Source classes with learnable reliability

The corpus has three or four source classes whose reliability differs between classes and stays **consistent** across the incident — an experienced brigade, a newly formed or volunteer unit, an aerial sensor feed, a member of the public. Consistency makes reliability learnable within the session, and learnable reliability is what makes source discrimination measurable.

### 7.5 Deliberate noise

The corpus includes authored irrelevant and low-value atoms, so that querying has a cost and selection is a skill. Without them, every query returns something useful and the corpus is a lookup table.

---

## 8. Channel signal vocabulary

**The `substitutive` condition cannot be built until this vocabulary exists.** The vocabulary is six to eight situation categories for the wildfire domain, fixed before the study and defined with the domain reviewer, each expressible with urgency 0–3 and a certainty value. See `11` §1.3 — this is the blocking item.

Authoring rules for the signal stream, once the vocabulary exists:

- Aggregate across sources and name them.
- Vary certainty expressions deliberately and in a recorded pattern, since interpretation of verbal probability terms is itself a source of divergence worth reporting.
- Emit the all-clear on its fixed cadence whenever nothing has changed.
- **Never emit content absent from the corpus.**
- **Never flag the contradiction.**
- Drop the authored T4 item from the traffic summary without flagging that anything was dropped.

Compression, not expansion, is the design principle.

---

## 9. Counterfactual branches

Counterfactual branches are at least **five** authored alternative developments that do not occur, produced by varying the weather timeline or the discrete events. They are never rendered. They exist to score allocation robustness, allocation safety and decision-space narrowing, and to define what counts as off-branch.

Branches are easy to postpone and impossible to omit: three secondary measures and several probes reference them.

---

## 10. Authoring budget

| Artifact | Quantity |
|---|---|
| T1 pushed bubbles | 90–120 |
| T2 system-queryable atoms | 80–110 |
| T3 ask-a-person atoms | 70–100 |
| T4 lateral traffic atoms | 50–70 |
| Projection envelopes | 20 (+20 revision envelopes if `08` §7 is adopted) |
| Channel signal sets with authored omissions | 20 |
| Duty-officer messages | 20 |
| Containment items | 30 authored for 20 slots |
| Contradiction candidates | 3, graded |
| Counterfactual branches | ≥ 5 |
| `directed` response script | 1, covering the whole corpus |
| Allocation viability / robustness / safety table | 20–60 allocations × ≥ 5 branches × 3 scores |

**Estimated: 110–150 hours.** Authoring is the largest single non-code task in the project and must be scheduled explicitly, not absorbed. Retrieval keys are generated semi-automatically from content and then reviewed, rather than hand-written.

---

## 11. Validation checklist

These checks run in CI over the authored bundle. Each one is a build-blocking assertion.

1. Exactly one contradiction marker; exactly one omission marker.
2. Every load-bearing fact has three resolvable routes, one per condition.
3. Flag sequence matches §4.2 exactly; no run of more than two consecutive breaches.
4. Containment base rate is 45–55% `holds`.
5. Every probe resolves against an entry in `invariants`; no probe references a missing invariant.
6. Every atom has a tier, a source class, a provenance record and a truth annotation.
7. Tier shares fall within the §3 bands.
8. All three load-bearing T4 items are present, reachable, and have a named downstream consequence cycle.
9. Every channel signal's content is traceable to authored corpus atoms; none is generative.
10. The channel never emits a signal flagging the contradiction.
11. Authored `directed` reply latency distribution matches `assistive` retrieval latency distribution.
12. Every envelope carries a validity horizon equal to the next cycle boundary.
13. `ValidityClaim.knownDivergences` contains the breach-rate declaration, the fire-magnitude declaration, and the simulated-responder declaration.
14. No `TruthAnnotation` field is reachable from any render-layer type.

---

## 12. For the domain reviewer

The reviewer is asked to rule on, in order of importance:

- Rates of spread, cycle by cycle.
- Whether four formations plus a drone is the right starting allocation for an incident of this size in this region, and when a real commander would escalate.
- Drone endurance, sensor payload, and the airspace deconfliction rule when a helicopter arrives — including whether grounding the drone is automatic or negotiated.
- Whether the ditch-slash re-ignition mechanism is recognised in southeast Finland and not only in the west.
- Whether the released-formations conflict in phase B is a realistic regional decision.
- The exact field structures of the seven record types.
- The Finnish register of every authored record.
- **The six to eight channel categories**, which remain the blocking item.

---

## Amendment 2026-09-17

**Updated cycle sequence.**

```
cycle_start
  → world redraw; changes highlighted
  → working period — clock running; bubbles at authored times;
      [SPAM cycles] online probe at authored offset (clock keeps running)
  → [expectation cycles] expectation prompt — visible, clock halted
  → projection reveal
  → judgement, confidence, breach point or correction — visible, clock halted
  → verification window
  → [freeze cycles] five SA items (2 × L1, 2 × L2, 1 × L3) with confidence — BLANKED, clock halted
  → course-of-action choice + confidence  (+ alignment feedback and final choice, reasoning-AI via-AI cell, phase B)
  → allocation and rationale
  → cycle_end
```

**Prologue.** Five additional cycles W1–W5 covering the first hours of the same fire, before cycle 1 (`15` §3). The prologue is identical for everyone. It must not pre-empt the omission, the contradiction or the load-bearing T4 items. It adds to the authoring budget: ~40–60 atoms, 5 envelopes, 5 decision items, items for 2 freezes, 1 SPAM item. Cycle 1's title ('Arrival') and virtual start time must be re-authored to follow on from W5.

**Authoring budget additions (§10).** Decision items: 30 for 25 slots, with alignment feedback per option for phase B (`16` §5). SPAM items: 10 for 6 slots. Intent recall items for phase B. Information packages for the retrieval engine (`14` §4).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

**Branch statements (handoff §5.3, §11).** For every cycle that can carry a `fundamentally_wrong` response, author **four** short Finnish branch statements of similar length and specificity, drawn from the counterfactual branches (§9), plus the fixed *Ei mikään näistä*. At the omission cycle (12), **no statement may describe the omitted development**, so *Ei mikään näistä* is the correct choice. Budget: 25 cycles × 4 statements, reviewed with the string table.

**Intent lines (Paper 2).** Every phase-B package needs an `intentLineFi` (`14` revision (d)). Budget: one line per phase-B package, reviewed with the domain reviewer.

**Push removed.** The pushed channel signal sets (§5, `04` §6 `ChannelSignalSet`) are not used in this study. The contradiction at cycle 18 reaches the AI group only through answers to queries about the northern flank; its integrated answer must present the conflict as settled.

**Branch-list ground truth (added 17 Sep 2026).** Each cycle's list of four statements must contain **exactly one statement that describes what actually happens by the horizon** (including, on cycles where the envelope holds, the development the envelope describes) and **three authored counterfactuals**. At the omission cycle, all four are counterfactuals and *Ei mikään näistä* is the correct answer. Statements describe development only up to the current horizon, never beyond it. Which statement is true is stored as truth and stripped before rendering (I4). The domain reviewer checks that the true statement is not identifiable by length, detail or wording.

---

## Revision 17 Sep 2026 (g) — world state adopted

- **`18_Scenario_World_State.md` is the concrete world for this scenario** (setting, intent texts, geography, weather series, fire behaviour, unit and drone timelines, values at risk, injected faults). Its numbers remain subject to domain review (`18` §13).
- **§8 channel vocabulary** is not needed while the AI is pull-only; it is kept for a later study and is no longer blocking.
- **§10 budget additions:** five prologue cycles; civilian resources (harvester, farmers); fault events F1–F6 (`18` §10); satellite hotspot and SAR layers; the query-database content in `19` (radio transcripts, metadata-only entries, hover history, registers).
- **§11 validation additions:** fault events occur at their authored cycles; every load-bearing item has a route in both conditions in use (`19` §6).

---

## Revision 23 Sep 2026 (h) — location and fire geometry

- **§1.1:** the box is where the site is searched for, not the map the participant sees. The site is chosen by the procedure in `23`; the participant's map covers the scenario footprint plus about 1.5 km (`23` §8).
- **§6.1:** envelopes and perimeters come from the cellular automaton in `24` (see the marker in §6.1).
- **§4.2, open:** the fire model shows that the authored quantitative breaches (2–3 m/min, i.e. 40–60 m per cycle) are at or below any sensible containment tolerance, and that a second ignition ahead of the head (cycle 3, W3) is by definition a detached new front. Both need a decision before the flag sequence is final (`24` §8, `11` §7.5).

---

## Revision 23 Sep 2026 (j) — no asking

Follows `02` revision (j) and `19` revision (b).

- **Cycle table, "T3 …" entries.** Each entry is either converted to a recorded trace (T2, or T4 if lateral) with an authored, usually later, record time, or withdrawn to world state. This follows the disposal rule in `02` revision (j), and `19` revision (b) R.1 records the per-item decisions. Specifically:
  - cycle 1 access road: converted (log line, cycle 2);
  - cycle 10 warm ground and peat smell: **withdrawn**, so the omission cue set is unchanged;
  - cycle 12 private briefing detail: withdrawn;
  - cycle 17 occupancy: converted (POL on YHTEISTOIMINTA);
  - cycle 19 time on task: already T2.

  The rest are decided at authoring.
- **"Never recorded" row (hidden-information table).** The route "Ask a person" becomes **"None: not reachable by any participant."** The row now describes world state, not information.
- **Budget (§10).** The rows "T3 ask-a-person atoms 70–100" and "`directed` response script 1" are removed. Conversions add about 10–25 records (`19` R.4).
- **Validation (§11).** Check 11 (authored `directed` reply latency matches `assistive` retrieval latency) is **removed**: there are no authored replies, and every query surface uses `25`'s fixed 2.5 s. `04` revision (j) adds a check: no load-bearing atom may depend on asking or be unrecorded.
- **Hidden-contradiction design.** The cycle-18 reconciling detail is reachable only from the 19:06 log entry. Before 19:06, the contradiction can be *detected* (both reports are pushed) but not *explained*. Detection is the measure, so this is acceptable. Pilot 2 gate 5 (`10`) checks it still lands in 20–70%.

---

## Revision 25 Sep 2026 (p) — views and the rekindle

**`26` governs the session structure from here on.** §4.1's twenty rows remain the **steps** of the world state. The participant sees 14 views built from them (`26` §3), plus one practice view (W5). §4.2's flag sequence is replaced by `26` §3 for views, and §4.3 by `26` §4.

**Rekindle (`26` §5).** At step 10 the L3 sector leader moves KY21 and VPK to the north flank against VPK's recorded objection. The omission at step 12 surfaces with no crew on L3, and crews return at step 13. The step-10 cue withdrawal of revision (g) stands. The objection is the only new cue.

---

## Amendment 4 Oct 2026 (t) — the superior is P2

**Supersedes** §4's "with a duty officer (P3) above". The participant's superior, who gives the V1 intent and the hinge directive, is **P2** (*päivystävä palopäällikkö*, the duty fire chief): in Finnish rescue services P3 is usually the incident commander's own level (`18` revision (t) §t.1, `02` revision (t)). The four hinge rules are replaced by one directive (`18` revision (t)). The history above is left as written. **Open** (`11` §7.16.1): the title, whether a superior who is not the incident commander would restrict tactics or only set aims, and the participant's command level for a 120–160 ha fire with an evacuation (P2 or higher as incident commander?).
