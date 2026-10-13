# 02 — Conditions and information routing

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Consolidates `11_Condition_Specification.md` and `09_Realism_Review_and_Hidden_Information.md` Part 3. Supersedes both.

> **Changelog**
> - **11 Oct 2026 (au)** — 210 = 3 × 70: permuted blocks of 42, 14 : 14 : 14; Haku 70, Thinker cells 70 + 70 (140 pooled). See the revision at the end.
> - **10 Oct 2026 (al)** — the Thinker cells separated again: `reasoning_intent`'s Open Thinker holds P2's orders (opening intent, then the directive) as data at the end of its system instruction; `reasoning_once`'s has its own prompt without them (the directive is in the banner and the log). Haku unchanged in every cell; the participant information says truthfully what each Thinker holds. See the revision at the end.
> - **9 Oct 2026 (ad)** — the tools' empty-chat notes are one sentence for every tool, identical but for the tool's name, with "the answer can be wrong or incomplete"; the hinge screen has no per-cell note (§ad.1).
> - **8 Oct 2026 (ab)** — the Open Thinker assesses and never enforces (the directive is an order, not a safety finding; judges only plan options; options without a recommendation); the records clock and the digest; its history cleared at V8; Haku says the directive is in the banner; the departure note in both conditions from V8. See the revision at the end.
> - **8 Oct 2026 (aa)** — the directive reaches both conditions (P2's radio message at V8 and a persistent on-screen line, `directive_shown`); the Open Thinker is directive-aware; the capability-matrix rows `hakuChat` and `openThinker`; the Open Thinker's explicit "unavailable" state; VD1 and UGV1 autonomous. See the revision at the end.
> - **8 Oct 2026 (z)** — Haku / Open Thinker redesign (researcher): the Haku tab is a structured AI chat (`/api/thinker`, standard prompt) for **every** cell, the practice view included; the AI group's only extra tool is the Open Thinker (`/api/thinker-open`). The `linjaus` / intent manipulation (revision (u)) is **withdrawn**. The capability matrix restated. See the revision at the end.
> - **6 Oct 2026 (y)** — free text for both groups (search parity): Haku's free-text search was the AI group's only; superseded two days later by revision (z).
> - **5 Oct 2026 (u, reconciled)** — cell 3 and the assignment reconciled with the build (`27` 1.1): opaque `?solu=k4|m7|t2` for demonstrations and pilots; the allocation table by participant code for the study.
> - **4 Oct 2026 (u)** — cell 3 is the strategy-guided Thinker (`27`); supersedes revision (t)'s "intent-line split still open" and, for phase B, "cells 2 and 3 are one group in every analysis"; assignment from a pre-generated table; the directive stays out of the corpus in phase B. See the revision at the end.
> - **4 Oct 2026 (t)** — the superior who issues the intent and the hinge directive is P2, not P3; the directive is not searchable; the Paper 2 intent-line split (cell 3) is still open, not implemented. See the revision at the end.
> - **25 Sep 2026 (q)** — §4 superseded by `14` revision (q): Thinker is a live LLM over deterministic retrieval.
> - **25 Sep 2026 (p)** — F7 item references moved to views V7 and V12 (`26`).
> - **25 Sep 2026 (o)** — projection shown to both groups (revision (i) withdrawn); an autonomous-assets setting, identical for both groups and not a manipulation; the AI is an augmenting analysis agent, closed and deterministic; one planted false record. See the revision at the end.
> - **23 Sep 2026 (j)** — the radio is removed as a participant tool. Groups become **Haku** (no AI, 70) and **Haku + LLM** (130, split 65 / 65). Tier T3 is retired; load-bearing unrecorded knowledge gains a recorded route. See revision (j) at the end.
> - **17 Sep 2026 (g)** — §3.3 restated for the two groups in use; channel route unused; see `19`.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Group labels (F3), request-driven reasoning AI (F2) and guidance-mode split (F4). See `14`, `15`, `16`.

This document is the manipulation. If the builder gets one document exactly right, it is this one.

---

## 1. The three conditions

| id | Finnish label | What it is |
|---|---|---|
| `directed` | *(not shown to participant)* | The participant obtains field information by selecting a named formation or the duty officer and sending a typed request, radio-style. Integration is theirs. |
| `assistive` | | Adds machine retrieval: a free-text query returns source-attributed corpus facts **verbatim**. Integration is still theirs. |
| `substitutive` | | Adds machine integration: a channel **pushes** a reconciled situational picture each cycle, unasked. |

**Primary contrast: `substitutive` versus `assistive`.** This contrast is the integration boundary, and it is where the hypothesis lives. `directed` is the baseline and the test of source-selection behaviour.

### 1.1 Why the condition is named `directed` and not `human`

Sessions are unsupervised and remote, so there is no live confederate. The responder is automated: authored replies, delivered after an authored latency per source class.

The condition therefore does not support a claim about human-versus-machine mediation. It supports a claim about **directed versus pooled retrieval** — you must decide whom to ask. This limitation is recorded in `ValidityClaim.knownDivergences` and stated in the limitations. Source-selection behaviour remains a measure. It is arguably cleaner than it would be with a confederate, because no person's behaviour can vary.

**Latency matching is a hard requirement.** Authored `directed` reply latency must match the distribution of `assistive` retrieval latency, or tempo is confounded with condition. CI asserts the two distributions over the authored corpus.

### 1.2 Three rules that make the manipulation work

**The substitutive channel is pushed, not offered.**

> **[SUPERSEDED 2026-09-17]** For now the reasoning-AI condition is request-driven, served by the closed engine in `14`. The pushed channel remains a possible later addition (`14` §7). An integration the participant must request remains assistive, and an available-but-unused capability yields a null that means nothing.

**The channel is a designed signal system, not a summariser.** It has:

- a closed vocabulary of six to eight situation categories;
- urgency graded 0–3 and orthogonal to category;
- certainty as an explicit value, including `unknown`;
- named source attribution;
- a fixed-cadence explicit all-clear, so that silence means channel failure rather than absence of events.

Prose is excluded deliberately. Prose smuggles in an explanation design, which is a separate large variable and not this study's question.

**Provenance is held constant.** `assistive` labels every returned fact with originating unit or sensor and observation time, so the contrast with `directed` varies channel rather than provenance visibility.

---

## 2. The capability matrix

> **11 Oct 2026 (aq):** a third tab, "Indexed search" (the original index-based search, `25` revision (aq)), is shown in the demonstration only, never under `?tuotanto`; it is not a capability-matrix row and not part of the study.

What each condition can do, across every surface. Build this table; it is the specification.

| Surface | `directed` | `assistive` | `substitutive` |
|---|---|---|---|
| Map, unit and asset markers, bubbles | identical | identical | identical |
| Projection envelope with validity horizon | identical | identical | identical |
| Status strip and report rail | identical | identical | identical |
| Radio panel — ask a named formation | yes | yes | yes |
| Radio panel — ask the duty officer | yes | yes | yes |
| Unit status and its age | yes | yes | yes |
| Reference data (stand, road, water, maintenance) | browse by map object | browse **and** free-text query | browse **and** free-text query |
| Situation log | scroll, filter by unit or time window | **free-text search across it** | free-text search |
| Traffic log | request by named unit only | **query by unit, group, time window or content** | query, **and summarised into the channel** |
| Cross-source free-text query | no | yes | yes |
| `Avaa tekoäly` drawer present | **no** | yes | yes |
| Pushed integrated channel signals | no | no | **yes** |

**Read the matrix as a ladder.** A `directed` participant has access to everything but must navigate it themselves, one source and one unit at a time. `assistive` adds machine retrieval across sources — the same facts, found faster, returned verbatim with provenance. `substitutive` adds machine integration — the facts combined, reconciled and pushed without being asked for.

The step from *cross-source free-text query* to *pushed integrated channel* is the assistive-to-substitutive boundary.

**Deliberately identical across all three:** the map, the bubble stream and its timing, the envelope and its accuracy, the probe schedule, the duty officer's behaviour, the ability to ask any named formation anything, and the underlying information space. **Nothing is knowable in one condition and unknowable in another.**

---

## 3. The four information tiers

Every atom in the corpus carries a tier. The tier determines how it can reach the participant.

| Tier | What it is | Route | Count | Share |
|---|---|---|---|---|
| **T1 — pushed** | Map state, unit positions, incoming reports as bubbles | Automatic, at authored times within the working period | 90–120 | ~30% |
| **T2 — system-queryable** | Stand data, FWI values, road and water registers, maintenance history, weather series, situation log entries | Browse (all conditions) or free-text query (`assistive`, `substitutive`) | 80–110 | ~25% |
| **T3 — ask a person** | Ground observations only a formation leader or the duty officer can give. Never logged anywhere | Directed request to a named source | 70–100 | ~25% |
| **T4 — unit-to-unit lateral traffic** | What formations said **to each other**, never reported upward | Only by requesting that traffic, or by a unit mentioning it when asked | 50–70 | ~20% |
| | | | **290–400** | |

### 3.1 Tier 4 is the point

Crews coordinate laterally all the time. A unit warns its neighbour; two units agree a boundary between them; someone mentions to the crew beside them, rather than to command, that their water is running low. None of that is concealment — it is people telling the person who needs to know. But it means the commander's picture is missing things the organisation collectively knows.

**Information that exists in the system, is never pushed, and requires the participant to think to ask for it.**

What lives in T4 across the incident:

- a crew warns the neighbouring crew about embers landing in their sector, two cycles before anyone reports spotting upward;
- two units informally agree to shift the boundary between their sectors, so the map's sector assignment no longer matches who is actually where;
- a unit mentions its water will last twenty minutes;
- the drone operator warns a ground crew the battery is nearly done, before the drone goes offline;
- **a crew reports upward that the line is holding and tells the crew beside them that they are not sure**;
- a unit mentions standing dead trees making its planned approach unsafe;
- the neighbouring region's formation tells its own commander something that reaches this participant only on request.

That fifth item is the strongest contradiction available, because nobody is wrong or lying. There are two records, each true to its own audience, and the discrepancy is visible only to someone who looks at both.

### 3.2 The three load-bearing T4 items

Each item has a downstream consequence that a participant who found the item could have anticipated. Each item is a named measure.

| id | Item | Appears | Consequence |
|---|---|---|---|
| `t4.ember_warning` | Crew warns neighbour about embers landing | Cycle 6, referring to cycle 4 | Spotting reported upward at cycle 8 |
| `t4.private_doubt` | Crew reports the line holding, tells neighbour it is unsure | Cycle 11 | Line fails at cycle 13 |
| `t4.water_state` | Unit tells neighbour its water will last twenty minutes | Cycle 4 | Water shuttle route cut at cycle 13 |

### 3.3 What each condition does with tier 4

In `directed`, the participant can request traffic from a named formation and read it raw.

In `assistive`, the participant can query the traffic log and receive matching entries verbatim.

In `substitutive`, the channel has access to the traffic and **summarises it into the situational picture, dropping the significant item.** The summary is accurate and useful and it loses the one line that mattered.

The machine did not fail, lie, or hallucinate. It compressed, correctly, and the compression removed the thing that would have changed the decision.

### 3.4 Design rules for tier 4

Traffic is timestamped and attributed to **both speaker and addressee**, so its lateral nature is visible.

Volume must be large enough that reading all of it is infeasible within a cycle, so selection matters. **Whose traffic someone chooses to read is a measure**, and every traffic request is logged with its selector.

It is never pushed, in any condition.

The `substitutive` channel's traffic summary is **pre-authored per cycle** like every other channel output, so what it drops is controlled rather than incidental. The drop must not be flagged.

---

## 4. The reachability rule

**Every load-bearing fact must be reachable in every condition, by that condition's own means.**

This rule is stronger than "reachable by at least one query". That weaker rule has a fatal consequence. The contradiction and the T4 traffic live in records. If `directed` cannot search records, detection in `directed` collapses for reasons of access rather than cognition — which destroys H3's prediction that detection is similar in `directed` and `assistive`.

So **for every load-bearing fact, three routes must exist**, one per condition. The atom record carries them (`04` §3, `InfoAtom.routes`). CI validates that all three are present and resolvable. A load-bearing fact with fewer than three routes is a scenario defect, not a subtlety.

### 4.1 Worked example — cycle 18

The aerial observer reports the northern flank accelerating. The ground formation on that flank reports the line holding.

**`directed`:** both reports arrive as bubbles. To resolve the inconsistency the participant must decide whom to ask and type a request — the aerial observer, EK14, or EK14's neighbour. Asking the neighbour reveals that EK14 can see only its own sector. Asking neither leaves the inconsistency carried forward unnoticed.

**`assistive`:** the same two bubbles. A query for the northern flank returns both entries verbatim with sources and times, adjacent. Seeing them side by side makes the tension visible without holding both in mind. A further query into the traffic log returns the lateral exchange that explains it. The comparison is *easier* here than in `directed`, and that is expected — the assistive tool is genuinely assistive.

**`substitutive`:** the same two bubbles, and then a single settled channel signal incorporating both, marking no conflict. The raw entries remain queryable. The traffic log is still available. Nothing is hidden. There is simply no visible seam, and attention moves on.

Equal access, unequal likelihood of looking. That is the design working.

---

## 5. Information rate — the workload confound

`substitutive` receives strictly more pushed content, which raises the question of whether the condition differs in workload rather than in integration.

There are three reasons it should not:

- The channel emits compact structured signals from a closed vocabulary, not prose — reading a signal set takes seconds.
- The channel *replaces* work rather than adding it: a participant who reads a reconciled picture need not reconcile the sources.
- The all-clear cadence means the channel is frequently saying nothing has changed.

**One measurement obligation, not optional:** perceived workload is collected in the post-session questionnaire and reported per condition. If `substitutive` shows higher workload, the interpretation of any calibration difference changes. This is checked, not assumed.

---

## 6. One cycle, three ways

Cycle 18 as each group experiences it. This belongs verbatim in the methods chapter.

**`directed`.** Two bubbles appear: the aerial observation of acceleration on the northern flank, and EK14's report that the line is holding. The participant reads both. To resolve the inconsistency they must decide whom to ask and type a request. If they ask EK14's neighbour, they learn EK14 can see only its own sector. If they ask neither, the reports sit unreconciled.

**`assistive`.** The same two bubbles. A free-text query for the northern flank returns both entries verbatim, with sources and times, adjacent. A further query into the traffic log returns the lateral exchange that explains it.

**`substitutive`.** The same two bubbles, then the channel's signal set: northern flank, urgency 2, certainty *probable*, attribution naming both sources, with a single coherent statement of the flank's state. The conflict has been resolved into a picture. The raw entries are still queryable. There is no visible seam.

---

## 7. The duty officer, and the Paper 2 hinge

### 7.1 The duty officer

The duty officer is identical in all three conditions: the same messages at the same times, by the same route. The duty officer provides context and is the source of strategic guidance; the duty officer is not a manipulated variable in Paper 1. The participant may address the duty officer in any condition, and those exchanges are logged with the same telemetry as formation requests.

### 7.2 Guidance mode is nested, not crossed

> **[SUPERSEDED 2026-09-17]** Replaced by the split design in the amendment below. The six-cell prohibition still holds: the design has four cells, not six.

The guidance at the hinge was once specified as either delivered once by radio or continuously maintained through the channel. Crossing those two guidance modes with three conditions gives six cells at fifteen participants each. That is not viable.

**Resolution: nest guidance mode inside condition.**

| Condition | How strategic guidance arrives in phase B |
|---|---|
| `directed` | Once, as a duty-officer message. Not repeated. Retrievable by scrolling back in the situation log |
| `assistive` | Once, as a message. Retrievable by query |
| `substitutive` | Once as a message, **and thereafter continuously maintained by the channel**, which restates current intent and flags whether each decision aligns with it |

Paper 2's contrast is then `substitutive` against `directed` in phase B: intent delivered once versus intent continuously maintained and alignment-checked.

**The cost, stated plainly.** Guidance mode is now confounded with integration level. A difference in intent survival between those two conditions cannot be attributed to the guidance mechanism alone. Paper 2's claim is about the *whole package* — a channel that both integrates and maintains intent — not about continuous guidance in isolation. This goes in the limitations.

**The alternative,** if the isolated claim matters more: run Paper 2 as a separate study with its own participants and two conditions. Cleaner, and costs a second recruitment. Do not commit until the participant pool is known (`11` §1.1).

**The six-cell design is off the table** and must not appear in any document, pre-registration or analysis script.

---

## Amendment 2026-09-17

**Group labels (F3, provisional).** No AI = `directed`; query AI = `assistive`; reasoning AI = `substitutive`. `assistive` returns fact packages (verbatim atoms); `substitutive` returns situation, meaning and projection packages (`14` §3.1).

**Guidance design (F4).** There is one strategic guidance, delivered at the hinge.

**Decided 17 Sep 2026 (c): only one AI group is split — the reasoning-AI group.**

| Cell | Paper 1 group | Guidance in phase B | Planned n (of 200; 210 = 3 × 70 from revision (au)) |
|---|---|---|---|
| 1 | No AI | Once, duty-officer message | ~67 |
| 2 | Query AI | Once, as cell 1 | ~67 |
| 3 | Reasoning AI | Once, as cell 1 | ~33 |
| 4 | Reasoning AI | Maintained by AI: restates intent and gives alignment feedback on each choice (`16` §4) | ~33 |

Phase A is identical for every participant, so it remains Paper 1's clean window. Paper 1 models include guidance mode as a covariate for phase B. **Paper 2's primary contrast is cell 4 vs. cell 3** — same AI, same content, guidance delivered once vs. maintained by the AI. A secondary contrast compares cell 4 with all once-guidance participants (cells 1–3), with condition as a covariate.

*Allocation option, not decided:* recruiting the reasoning-AI group larger than the other two (e.g. 60 / 60 / 80 → 40 per guidance cell) raises Paper 2 power at a small cost to Paper 1.

Allocation is stratified on echelon and the `09` §2 variables, with guidance mode randomised within the reasoning-AI group.

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

### Groups

| Cell | Paper 1 group | Phase A | Phase B guidance | n |
|---|---|---|---|---|
| 1 | **No AI** (`directed`) | Radio, browsing | Duty-officer message once | **70** |
| 2 | **AI** | AI query drawer + radio, browsing | Duty-officer message once | **65** |
| 3 | **AI** | AI query drawer + radio, browsing | Duty-officer message once **+ AI answers framed against the commanded strategy** | **65** |

This replaces the three-group and four-cell tables above. There is **one AI condition**; the query-AI / reasoning-AI distinction is withdrawn. Condition id for the AI group: **open** (`substitutive` kept as a placeholder; `11` §7.1).

### The AI group is pull-only

The AI never pushes. Participants obtain its integrated answers **only by asking** (`14`). What they ask, when, and how it relates to their calibration is the core of Paper 1. This deliberately reverses v3.0 §1.2 ("pushed, not offered"): the study now measures metacognition **through** information seeking rather than under unrequested integration.

To prevent a null through non-use, AI participants receive **group-specific training** at the start (`15` §2 tutorial): what the AI can answer, how to phrase a question, two practice queries. The no-AI group gets a matched-length training on radio and browsing. Use is logged and an engagement floor is pre-registered.

### Maintained guidance (cell 3)

When a cell-3 participant asks the AI about anything in the database during phase B, the answer is the same package cell 2 receives **plus an authored line relating it to the commanded strategy** ("Tämä koskee nykyistä painopistettä: …" / "Ei vaikuta nykyiseen painopisteeseen."). Nothing is pushed, and there is **no feedback on the participant's choices**. Guidance is maintained only as far as the participant asks.

Consequences:
- The strength of the manipulation depends on query volume. Query count in phase B is a mediator and must be reported per cell.
- The intent lines advise on relevance, never on tasking: no unit, sector or allocation is recommended (`12` §6.3 holds).

### Contrasts

- **Paper 1 primary:** cell 1 vs. cells 2 + 3, **phase A** (identical treatment within the AI group).
- **Paper 1 secondary:** cell 1 vs. cell 2 across all cycles (both receive guidance once).
- **Paper 2 primary:** cell 3 vs. cell 2, phase B.
- **Paper 2 secondary:** cell 3 vs. cells 1 + 2.

Randomisation: 70 / 130 stratified on echelon and the `09` §2 variables; the AI group is split 65 / 65 at assignment (concealed until the hinge).

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

### Groups

| Cell | Paper 1 group | Id | What the AI returns | Phase B guidance | n (default) |
|---|---|---|---|---|---|
| 1 | **Radio** | `directed` | — (radio, browsing) | Duty-officer message once | 70 |
| 2 | **LLM** | `assistive` | Facts: verbatim source records on request | Once | 65 |
| 3 | **LLM reasoning** | `substitutive` | Integrated answers in the fixed template on request | Once | ~32 |
| 4 | **LLM reasoning** | `substitutive` | As cell 3 | Once **+ intent line in every AI answer** | ~33 |

- The LLM-reasoning group is **one group** in Paper 1 (cells 3 + 4); it is divided only at the hinge.
- Both LLM groups are **pull-only**, with group-specific training at the start. Revision (d)'s pull-only rule and intent-line mechanism stand; its single-AI-group table is withdrawn.
- Condition ids are the v3.0 ids (closes F3).

### Contrasts

- **Paper 1 primary:** LLM reasoning vs. LLM, phase A — the v3.0 integration contrast, now under pull-only access. Radio vs. the LLM groups is secondary.
- **Paper 1 phase B:** cells 1, 2 and 3 all receive guidance once and remain comparable; cell 4 is modelled separately.
- **Paper 2 primary:** cell 4 vs. cell 3, phase B.
- **Paper 2 secondary:** cell 4 vs. cells 1–3 (condition as covariate; confounded with AI type).

### Group sizes — open

Paper 2 uses only the LLM-reasoning group, so its size sets Paper 2's power:

| Allocation (Radio / LLM / LLM reasoning) | Paper 2 cells | Paper 1 primary (LLM vs. reasoning) |
|---|---|---|
| 70 / 65 / 65 (default) | ~32 / 33 | 65 vs. 65 |
| 60 / 60 / 80 | 40 / 40 | 60 vs. 80 |
| 50 / 50 / 100 | 50 / 50 | 50 vs. 100 |

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

### Groups (final)

| Cell | Paper 1 group | Id | What the AI returns | Phase B guidance | n |
|---|---|---|---|---|---|
| 1 | **Radio** | `directed` | — (radio, browsing) | Duty-officer message once | 70 |
| 2 | **LLM reasoning** | `substitutive` | Integrated answers in the fixed template, on request | Once | 65 |
| 3 | **LLM reasoning** | `substitutive` | As cell 2 | Once **+ intent line in every AI answer** | 65 |

`assistive` (LLM returning facts) is **not used** in this study. It stays defined in the code as an unused condition so a later study can reinstate it without an engine change.

### Contrasts

- **Paper 1 primary:** LLM reasoning (cells 2 + 3) vs. Radio, phase A.
- **Paper 1 secondary:** cell 2 vs. cell 1, all cycles (both receive guidance once).
- **Paper 2 primary:** cell 3 vs. cell 2, phase B.
- **Paper 2 secondary:** cell 3 vs. cells 1 + 2.

Randomisation: 70 / 130, stratified on echelon and the `09` §2 variables; LLM reasoning split 65 / 65 at assignment, concealed until the hinge.

---

## Revision 17 Sep 2026 (g) — tier 4 with a pull-only AI

§3.3 is restated for the groups in use:

- **Radio (`directed`):** browse the traffic surface by group, unit and time, or ask a named unit.
- **LLM reasoning (`substitutive`):** ask the AI. A **broad** question returns an integrated answer that omits the load-bearing line; a **narrow** question naming the unit, time or topic returns an answer whose sources contain it. Or ask a named unit.
- Lateral knowledge said on **direct-mode radio, by phone or face to face is not in the database** in either group and is reachable only by asking (`19` §4).

The channel summary in §3.3–§3.4 is not used in this study. Which channel each load-bearing item travels on is fixed in `19` §6.

---

## Revision 23 Sep 2026 (h) — the query builder in both groups

Both groups get the structured query builder of `25`: topic (MITÄ) × source (KUKA) × time window (MILLOIN) over the same closed corpus. It replaces the Radio group's separate browse and filter surfaces as the way that group finds information, and it is **identical in both groups**. The AI group keeps its free-text field and the AI drawer on top, so the AI is the only difference between the groups. Asking a named unit (the Radio drawer) is unchanged. In the capability matrix (§2) the builder is a surface identical across conditions (`categoryQueryBuilder`).

---

## Revision 23 Sep 2026 (i) — Radio loses the projection envelope

**Supersedes the §2 capability-matrix row "Projection envelope with validity horizon: identical" for `directed` only; the row remains `identical` between `assistive`/`substitutive` (the latter unused in this study, per revision (f)).**

Radio (`directed`) has no machine and therefore nothing to render as a machine projection. Decision-phase step 1 becomes a production task, not a judgement of a shown artifact — full detail, rationale and the resulting cross-condition-comparability open item are in `15` §10.1. `12` §3–§4 (the single-envelope, no-gradient argument) now applies only to the envelope LLM-reasoning participants see; it does not apply to Radio, which has none to draw.

---

## Revision 23 Sep 2026 (j) — the radio is removed as a participant tool

**Supersedes every earlier section and revision of this document where they conflict.** In particular it supersedes §1's `directed` definition, §1.1, the §2 rows "Radio panel — ask a named formation / the duty officer", §3's T3 row, §4's three-route rule, §7.1's "may address the duty officer", and revisions (f)–(i) wherever they name the Radio drawer or the ability to ask a unit.

### Decision

The participant **cannot transmit**. There is no Radio drawer, no request to a named formation, no request to the duty officer, in either group. Information is found only through the Haku query builder (`25`), and in the AI group additionally through the AI drawer.

**Radio as a source stays.** Crews still talk on the radio inside the scenario. Recorded talk-group traffic remains in the database as transcripts and metadata (`19` §3.5–§3.6) and is found through Haku like any other record. Pushed bubbles are unchanged. Only the participant's ability to *ask* is removed.

### Groups

| Cell | Group | Id (code) | Tools | Phase B guidance | n |
|---|---|---|---|---|---|
| 1 | **Haku** (no AI) | `directed` | Haku query builder, message log, map | Duty-officer message once | 70 |
| 2 | **Haku + LLM** | `substitutive` | As cell 1 + AI drawer (integrated answers on request) | Once | 65 |
| 3 | **Haku + LLM** | `substitutive` | As cell 2 | Once **+ intent line in every AI answer** | 65 |

Group sizes, the 65 / 65 split, pull-only AI, the intent-line mechanism and the contrasts of revision (f) are unchanged. Revision (i) is unchanged: cell 1 has no projection envelope. **The AI is now the only difference between the groups**; revision (h) already made the query builder identical, and removing the Radio drawer removes the last shared-but-separate surface.

**Condition ids.** `directed` is kept as the code identifier for cell 1 so no engine or telemetry schema changes on id alone. Its meaning is redefined: *no machine integration; the participant navigates recorded information by hand.* The name no longer describes the condition. Whether to rename it is registered in `11` (F3 reopened).

### Why

The design question is integration. With the query builder identical in both groups (revision (h)), the Radio drawer was the one remaining channel whose use depended on a skill — choosing whom to ask — that is not the manipulation, and whose replies were authored text the AI could not see. Removing it makes the contrast *the same recorded world, navigated by hand vs. integrated by a machine on request*.

### What is withdrawn

1. **The directed-vs-pooled claim (§1.1).** There is no directed request, so there is nothing to contrast with pooled retrieval. §1.1's limitation statement and its latency-matching rule for authored replies lapse. Response latency is the uniform 2.5 s of `25` for every query surface.
2. **Tier T3 (ask a person).** Retired. The tier table becomes T1 pushed · T2 system-queryable · T4 lateral traffic (recorded lines only). T3 atoms are disposed of by the rule below.
3. **Asking the duty officer.** The duty officer still sends the same messages at the same times, including the hinge guidance (§7, revision (f)). The participant cannot address the duty officer.
4. **"Which units are asked" as a source-selection measure** (`01`). Source selection is re-operationalised as the choice of the KUKA (source) slot in the query builder, against authored `SourceClass.reliability` (`07` revision).
5. **The AI's blind spot as a between-group difference.** Knowledge that was never recorded is now unreachable in *both* groups, so "the AI cannot know what was said on direct radio" no longer distinguishes them. The AI's remaining designed weakness is the broad-question drop (`14` §4), which is unaffected.

### The reachability rule, restated (supersedes §4)

**Every load-bearing fact must be reachable in both groups through a recorded, searchable record.** Two routes per load-bearing atom: `directed` = Haku (browse / query builder); `substitutive` = Haku or AI (free text). No load-bearing atom may depend on asking. CI asserts this (`10` revision).

### Disposal rule for T3 and unrecorded knowledge

Each atom whose only route was asking a person is handled one of two ways:

- **Convert** — if a real organisation would plausibly leave a trace: a line a crew leader types into the situation log, a relay on a recorded talk group, a status or logistics entry, a task-record addition. The atom becomes T2 (or T4 if the trace is lateral) with a new `recordedAt` time, which is usually **later** than when the knowledge existed. The delay is part of the realism and must be authored, not zeroed.
- **Withdraw** — if nothing plausible would record it. The knowledge stays in the world state (`18`) as ground truth that shapes outcomes, but it is not an atom and is reachable by nobody.

`19` §4 and §6 carry the per-item decisions for the load-bearing items. For the remaining 70–100 T3 replies the decision is made during corpus authoring and checked by the domain reviewer.

### Worked example, cycle 18, restated

**Haku.** Two bubbles: the aerial observer reports the northern flank accelerating; EK14 reports the line holding. The participant can query *Palon tila* × KUKA = EK14 or the observer × *Viimeiset 20 min*, see both entries adjacent, and from 19:06 find the log line that explains EK14's limited view. Before 19:06 the explanation is not available to anyone.

**Haku + LLM.** The same, plus the AI. A broad question returns one settled answer with no visible conflict; a narrow question returns both reports among its sources.

### Costs, stated plainly

- **Realism.** A commander on the ground who cannot call a crew is not a real incident commander. The participant is still framed as commander (decision 23 Sep 2026). This gap is declared in the limitations. It is the strongest argument for the advisor or planning-officer framing parked in `11`, which would make a systems-only information role realistic.
- **Coverage.** Knowledge that exists only in people's heads is now invisible. The study measures metacognition over *recorded* information only, and says so.
- **Measures lost.** Addressee choice, request wording, and time to first radio request.

### Consequential amendments

`00`, `01`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `14`, `15`, `18`, `19` and `25` carry a revision dated 23 Sep 2026 pointing here. `12` needs none: its "`directed` receives no arrows" argument still holds. The dated review snapshots `13` and `17` are records of their day and are not amended.

---

## Revision 24 Sep 2026: tier bands raised (researcher's decision)

**Why.** A real incident produces far more traffic than the original 290–400 items, especially at the start and whenever the fire moves. The first corpus also met its bands with content-free filler, about half of it ("Rutiinikirjaus n: tilanne ennallaan", "Kuittaus, jatketaan samalla tavalla").

**New bands** (`TIER_COUNT_BANDS`, `app/scenario/types.ts`), total 600–900:

| Tier | Band |
|---|---|
| T1 pushed | 200–320 |
| T2 system-queryable | 220–360 |
| T3 ask a person | 110–200 |
| T4 unit-to-unit | 70–140 |

**What fills them.** All the filler is removed. The traffic corpus of `18` revision (n) replaces it. The demo scenario now holds 772 atoms (T1 256, T2 292, T3 140, T4 84; 599 distinct texts). Between 6 and 20 items are pushed per cycle, most in cycle 1 and in the arrival cycles.

**Consequence.** The participant's information load is higher than in the original design, and this changes what the load-related measures mean. Record it in the analysis plan before the pilot.

## Revision 25 Sep 2026 (o) — projection for both groups, the autonomous-assets setting, and the shape of the LLM condition

**Supersedes revision (i) and every earlier section where they conflict.** Decided by the researcher on 25 Sep 2026.

### 1. The projection is shown to both groups

Revision (i) is withdrawn. Both groups see the same projection envelope every cycle and judge it with the same Type J step (`08` §3.2). `12` §3–§4 (one envelope, one boundary, identical across conditions) applies to both groups again. The Haku group's every-cycle "Oma ennusteesi" task (`15` §10.1) is withdrawn (`15` revision (o)).

**Why.** The projection is not the manipulation. The research question is how an LLM that retrieves and integrates recorded situation information affects the commander's understanding and decisions. With revision (i), the groups differed in two things (the AI and the envelope), and step 1 of the decision phase was a different task in each group. Now **the AI is again the only difference between the groups**, and Type J is a symmetric measure across them.

### 2. Setting: a near future with autonomous assets, identical for both groups

The incident is framed as a near-future operation in which some assets act on their own within pre-agreed tasks: the water drone VD1 (`18` revision (n)), the observation drones and the aerial observer. Crews carry out pre-agreed tasks and move by their own plan.

- **Same text for both groups.** The setting is described in the briefing (`09` §4) and says the same, word for word, in both groups. It states facts about the assets and makes **no claim about the reliability of any AI**. The AI is not mentioned in the shared setting text. *(Since revision (ae), 9 Oct 2026, there is no briefing page: these sentences open the practice tour's welcome popup, `15` ae.1.)*
- **Not a manipulation.** The degree of autonomy (assets directed by the commander, assisting, or acting on their own) is not varied in Paper 1. It is a candidate manipulation for a later study.
- **What it does for realism.** Scripted unit movements are now explained by the setting rather than by an incident commander nobody sees. This narrows the realism gap declared in revision (j) (a commander who cannot transmit) but does not close it. The limitation stays declared (`09` revision (o)).
- **No new assets.** The setting uses the assets `18` already has. Adding more asset types is registered as open (`11` §7.7).

### 3. Haku + LLM: the AI is the command post's analysis agent

- **Shape: augmentation, confirmed.** The AI is added to Haku and never replaces it. The right column (`06` revision 25 Sep 2026) already implements this: Haku for everyone, and the Tekoäly tool in cells 2 and 3.
- **Name and framing.** The agent is called **Thinker** (researcher's decision, 25 Sep 2026). The name is used on the tool button (replacing *Tekoäly*), in the answer header and in the training. In the group-specific training (`15` §2), Thinker is introduced as the command post's **analysis agent**: it reads the same recorded information as Haku and answers when asked.
- **Haku group.** The setting is the same. Their training describes only the tools they have and does not mention that another configuration has an agent.
- **Pull-only, the intent-line split of cells 2 and 3, and group sizes are unchanged.**

### 4. Thinker is a live LLM over deterministic retrieval (superseded by `14` revision (q))
The world stays identical for everyone. Thinker answers live (`claude-opus-5-5`, temperature 0) from records chosen by deterministic, time-gated hybrid retrieval, and every answer is logged in full. This replaces the closed responder decided earlier the same day. Reasons, pipeline and tests are in `14` revision (q).

### 5. Designed failure: one planted false record that is never corrected

The AI's designed failures so far are failures of integration: the broad-question drop (`14` §4) and the settled answer at cycle 18 (H3). This revision adds a failure of **input**: a false situation record that Thinker passes on.

**Form (decided 25 Sep 2026): a data-entry error in the shared dataset.** One false record enters the database because a person using the system entered it wrongly. The error is in the data itself, not in the AI. It is the same record in both groups: the Haku group can find it through Haku, and Thinker reads it from the same data. The stimulus therefore stays identical. **It stays in the system (decided 25 Sep 2026).** No correcting record is ever added. The participant has to recognise that the record is wrong from other records that contradict it. Thinker relays the false record for the rest of the session whenever an answer draws on it. *Rejected:* the AI misstating a correct record (only one group would see it); a correcting record.

**The record (`18` §10, fault F7).**
- **Step 8, 15:4x (view V6, `26`).** The command-post operator types into the situation log (*tilannepäiväkirja*): *110 kV linja jännitteetön, vahvistettu.* ("110 kV line de-energised, confirmed.")
- **Truth.** The line (V4) is live throughout the incident. The operator logged the de-energisation *request* as if it had been confirmed.
- **What contradicts it, in both groups through Haku:** the grid operator's cycle-6 record (the line stays energised; de-energising has been requested), the absence of any confirmation from the grid operator, and later crew and HELI1 traffic that still treats the line as a hazard. The cycle-6 record is authored if the corpus does not already carry it.
- **Why this record.** The error is realistic (a request logged as done) and safety-relevant: HELI1 is working the head from cycle 8, and allocations near the line depend on it. It stays false for the whole incident, so recognising it at any time counts. It does not touch the omission (12), the contradiction (18) or the water route.

1. **Checkable.** The record carries its author and time (the command-post operator), and Thinker's BASIS cites it. The grid operator's cycle-6 record is load-bearing: the reachability rule (revision (j)) applies, and CI asserts it.
2. **Scored against truth.** An SA item in the freeze of view V7 and one in V12 (`26` §4, different wording) concern the line's status. Holding "de-energised" is scored as wrong and coded for H9. Allocations and courses of action are scored against the true state.
3. **No effect on the world.** The fire, the flags and the scoring of the Type J judgement do not change.
4. **Disclosed in the debrief** (`09` §5.1, revision (o)).

### Consequential amendments

`01`, `08`, `09`, `11`, `14`, `15` and `18` (§10, fault F7) carry revision (o). `12` needs no text change: its §3–§4 argument applies to both groups again, as stated in §1 above. Code is not changed yet (`11` §7.7).

---

## Revision 4 Oct 2026 (t) — the issuer is P2; the intent-line split is still open

Follows `18` revision (t): one directive replaces the four hinge rules.

### The issuer (§7.1)

The participant's superior, the source of both the V1 intent message and the hinge directive, is **P2** (*päivystävä palopäällikkö*, the duty fire chief). In Finnish rescue services P3 is usually the incident commander's own level, so it is not the level that sets an incident commander's posture. "Duty officer" in §7 and in later revisions means P2 from this revision on. **DRAFT:** the domain reviewer confirms the title, and whether P2 or the command centre would set posture for an incident of this size (`11` §7.16).

**Unchanged from §7.1 and revision (j):**
- The superior's messages are the same in both groups, at the same times, by the same route. They open their view (V1, V8) in the message log, where they stay for the rest of the session.
- The participant cannot address the superior (revision (j)).
- The messages are **not corpus atoms**. The directive is therefore not reachable through Haku or Thinker; only scrolling back in the message log reaches it. Making it searchable needs `npm run thinker:index` on a machine with the embedding model (`11` §7.16).

### The intent-line split (cell 3) is still open

Revision (f)'s cell 3 (the same Thinker answers as cell 2, plus an intent line relating each answer to the commanded strategy) is **not implemented**. Cells 2 and 3 are assigned and logged (`SessionConfig.cell`), but their Thinker answers do not differ. Until the split is built:
- Paper 2 does not use the cell 3 against cell 2 contrast. Its hypotheses are restated without it (`01` revision (t)).
- Cells 2 and 3 are one group in every analysis (Haku + LLM). Paper 1 already pools them (revision (o)).
- If the split is built later, the intent line must restate the directive of `18` revision (t), not the four withdrawn rules. Its contrast is then a new hypothesis, pre-registered as such (`09` revision (t)).

Open: `11` §7.16.

---

## Revision 4 Oct 2026 (u) — cell 3 built as the strategy-guided Thinker (`27`)

Follows `27` §2–§3. **This supersedes**, in revision (t):
- **"The intent-line split (cell 3) is still open"** and its three bullets. Cell 3 is built as the strategy-guided Thinker (`reasoning_intent`): from V8, its Thinker answers carry a fifth field, `linjaus`, a status (`sopii` / `ei_sovi` / `ei_liity`) and one sentence on whether the recorded situation fits the directive in force, with no recommendation (`14` revision (u), `27` §3.2). It restates the directive of `18` revision (t), not the withdrawn rules. Its contrast with cell 2 is Paper 2's primary (H13, `01` revision (u)).
- **"Cells 2 and 3 are one group in every analysis"** — now true for phase A only, where the cells are identical. Phase-B analyses keep the cell (`27` §1.4).

**Unchanged:** the cells and sizes of revisions (f) and (j) (70 / 65 / 65); the issuer P2; the directive's delivery.

**Assignment.** In study mode the cell comes from a pre-generated allocation table bound to the participant code (permuted blocks of 42, 14 : 14 : 14 since revision (au), 11 Oct 2026; before: 40, 14 : 13 : 13; stratified by language only; this supersedes revision (f)'s stratification on echelon and the `09` §2 variables, which become covariates), never from a URL parameter the participant or the recruiter can choose. The `?solu=haku|thinker|ohjattu` parameter serves the demonstration and pilots only. The two Thinker cells are concealed from the participant until the hinge (`27` §2.2). The header logs the real cell.

**The directive stays out of the corpus in phase B** (supersedes, for phase B, the open item of `11` §7.16 "The directive is not searchable"). As a record it would reach `reasoning_once`'s Thinker for some questions, which could then assess fit unmeasured; kept out, every cell reaches it through the message log only, and only `reasoning_intent`'s prompt relates answers to it (`27` §3.1).

### Reconciled with the build (5 Oct 2026)

Revision (u) above was written before the build was seen. What exists (`27` §2.2, §11):
- **Assignment.** The study link is `?tuotanto&koodi=<code>`; the cell **and the session language** come from the committed allocation table `content/assignment/allocation.json` (seed 20261005; blocks of 42, 14 : 14 : 14 (revision (au)); en 6 blocks, fi 1 block; regenerated byte-identically by `tools/assignment/generate.ts`). A study link without a code does not start; `?solu=` in the study is refused unless the link also carries `?pilotti`; a code with `?solu=` is refused. **Revision (af), 9 Oct 2026:** a study link without a code is the shared link — on start, the hosted study server issues the next allocation code (`27` af); without that server the page says the link is not active.
- **The URL parameter** for demonstrations and pilots is `?solu=k4|m7|t2` (opaque codes; `k4` Haku `radio`, `m7` Thinker `reasoning_once`, `t2` strategy-guided `reasoning_intent`), not `haku|thinker|ohjattu` as written above: "ohjattu" named the guided cell in the link.
- **The header** logs `participantCode`, `cell`, `language` and `assignment` (`table` with the table's hash and block, or `url`, `url_pilot`, `start_page`); only `table` sessions enter a confirmatory analysis. The participant never sees the cell.
- **Researcher decision:** the table is bundled with the app (no server for the Haku cell), not stored outside the recruitment workflow as `27` §2.2 asks; see `27` §11 M1.

---

## Revision 6 Oct 2026 (x) — the projection is shown, not judged

Revision (o)'s "both groups judge the envelope (Type J)" is withdrawn (`01` revision (x)). The projection is still shown to both groups, the same in each, from the view's start. Nothing asks the participant to judge it.

---

## Revision 6 Oct 2026 (y) — free text for both groups

Researcher decision (6 Oct 2026; closes the 6 Oct blocker 5): Haku's free-text search over the whole corpus is identical in every condition (`capability-matrix.ts` `crossSourceFreeTextQuery: true` in the shared row). This supersedes §2's row "Cross-source free-text query: no" for `directed`. Revision (z) replaces the surface it applied to.

---

## Revision 8 Oct 2026 (z) — Haku is a structured AI chat for everyone; the AI group's extra tool is the Open Thinker; the `linjaus` manipulation is withdrawn

Researcher decision, 8 Oct 2026. **Supersedes** revision (u)'s cell 3 as the strategy-guided Thinker, revision (o) §3's "Haku for everyone, and the Tekoäly tool in cells 2 and 3" as a statement of what the tools are, and revision (y)'s surface. Built in `app/session/thinker-protocol.ts`, `queries.ts`, `RightPanel.tsx`, `server/thinker/{handler,http,model,config}.ts`, `server/thinker/prompt-open.{fi,en}.md`; tested in `test/server/thinker-open.spec.ts`, `thinker-server.spec.ts`, `test/session/thinker-client.spec.ts`.

### z.1 The two tools

| | **Haku** (every cell) | **Thinker / Open Thinker** (AI condition only) |
|---|---|---|
| Endpoint | `/api/thinker` | `/api/thinker-open` |
| Cells | `radio`, `reasoning_once`, `reasoning_intent` | `reasoning_once`, `reasoning_intent` (`substitutive`); a `radio` request is refused |
| Views | VP (practice) and V1–V14 | V1–V14 (main views only) |
| Prompt | the standard prompt (`prompt.{fi,en}.md`), four fields: vastaus · perusteet · varmuus · mikä muuttaisi | `prompt-open.{fi,en}.md`: conversational, **may suggest options and recommend**, plain text |
| History | none (each question alone; a request with history is refused) | the last turns, **at most 10**, alternating, the participant's first; a model turn cut to 4000 characters |
| `linjaus` | never | never |
| Retrieval | the same time-gated hybrid retrieval (`14` revision (q)) | the same |
| Model | `gemini-3.5-flash` (was `gemini-3.8-flash` until the 8 Oct 2026 live test), temperature 0, thinking budget 0 | the same model, temperature 0, thinking budget 0 |
| Fallback | the deterministic template over local lexical retrieval (`14` step 6) | the same local template, as plain text, logged as a fallback with its reason |
| Latency floor | 2.5 s | 2.5 s |
| Request cap | question ≤ 500 characters; body ≤ 16 KiB | question ≤ 500 characters; body ≤ 64 KiB |

Both prompts are **frozen**: hashed into `content/thinker/manifest.json` (`prompt`, `promptEn`, `promptOpen`, `promptOpenEn`), and the server refuses to start on a mismatch. The withdrawn strategy-guided prompt (`prompt.intent.*.md`) stays hashed so old logs can be read; no request is answered with it (`thinkerPromptVariant` is kept for old logs only).

**Free text is in both groups:** every participant asks Haku in their own words. The briefing and training say so in the same words for both groups; the AI group's training adds one sentence for Thinker (`briefing.ts` `HAKU_CHAT_*`, `OPEN_THINKER_*`).

### z.2 The capability matrix, restated (supersedes §2 and revisions (h), (j), (o), (y) where they conflict)

| Surface | `directed` (cell 1, Haku) | `substitutive` (cells 2 and 3, Haku + Thinker) |
|---|---|---|
| Map, markers, bubbles, projection envelope, status strip, message log | identical | identical |
| Query builder (KUKA × MITÄ × MILLOIN), lexical free-text search | withdrawn from the UI (8 Oct 2026) | withdrawn |
| Ask a named formation or the superior (P2) | no | no |
| **Haku: structured AI chat, free text, four fields** | **yes** | **yes**, identical |
| **Open Thinker: conversational AI with history, may recommend** | **no** | **yes** |
| Pushed integrated channel | no | no |

`assistive` stays defined in `capability-matrix.ts` and unused. The code's matrix still carries the descriptive rows of §2 (`referenceData`, `situationLog`, `trafficLog`), which no surface reads, and `aiDrawerPresent` (true in `substitutive`), which now gates the Open Thinker tab.

**The difference between the groups is now the Open Thinker (directive-aware from the final fix pass, revision (aa)), not "AI vs no AI":** both groups put free-text questions to an LLM over the same records. The Haku group's answers are constrained to the four-field form without recommendation by design of the form, not by an explicit rule (`27` P5 / M3); the Open Thinker may recommend. Paper 1's H2 contrast (Haku vs Haku + LLM) therefore reads as *structured retrieval-and-summary vs the same plus an open advisory conversation*. This changes what H2 measures; `01`/`09` must restate it (`11` §7.18).

### z.3 What is withdrawn

The `linjaus` / intent manipulation of revision (u) and `27` §3.2 is **withdrawn**. This removes:
1. The strategy-guided prompt's use: no answer carries the fifth field `linjaus` (`sopii` / `ei_sovi` / `ei_liity` / `ei_arvioitu`) in any cell or view.
2. The `linjaus` line on screen (`DirectiveLine` deleted from `RightPanel.tsx`).
3. **The only difference between cells 2 and 3.** `reasoning_once` and `reasoning_intent` are still assigned (allocation table, 14 : 14 : 14) and logged, but their treatments are now identical (**by design; revision (aa): both get the same directive-aware Open Thinker**).
4. Every measure derived from the status: `strategyNoticeExposure`, `strategyExposureBeforePlan` (both return nothing for logs after 8 Oct 2026), the status's right/wrong coding (`16` revision (u), `27` §3.5), H17, and the `linjaus`-based exposure of H13–H15 (`27` revision (z)).
5. The prompt audit rows P1–P10 of `27` §3.2–§3.3 as a manipulation check (they describe a prompt no participant now sees).

### z.4 Logging

`ai_chat_query_submitted` and `ai_chat_answer_received` carry **`tool: "haku" | "open_thinker"`** (absent in older logs: the old structured Thinker). Query ids are `ai.N` for Haku and `ai_open.N` for the Open Thinker. `promptVariant` is always `standard` in new logs; `linjaus` and `linjausTila` are absent (`07` revision (y)).

### z.5 Not yet reconciled in code (reported to the lead, 8 Oct 2026)

> **Superseded by revision (aa) for the first bullet:** the hinge sentence and the debrief paragraph are gone from the code. The second bullet (the withdrawn Haku panel) stands.

- The hinge screen still logs and shows the `reasoning_intent` sentence about a "Linjaus" line (`orchestrator.ts` `hingeCellNoteId`, `ui.ts` `linjaus_line`), and the debrief still tells `reasoning_intent` participants that Thinker's answers had a directive line (`study-texts.ts`). Both describe a feature that no longer exists.
- The Haku navigation panel (query builder and lexical free-text search, `Drawers.tsx` `HakuPanel`) is **withdrawn from the UI** by the same decision (confirmed 8 Oct 2026; `25` revision (z)); `capability-matrix.ts` still describes `categoryQueryBuilder: true`, now without a surface.

---

## Revision 8 Oct 2026 (aa) — the directive reaches both conditions and stays on screen; the Open Thinker is directive-aware; the matrix rows

Researcher decisions of 8 Oct 2026 (final round: D1, D2, D3). **Amends revision (z)** where it says the two Thinker cells have "identical treatments" and "no manipulation" (§z.3 item 3): the cells are still identical, but the AI group's tool now carries the directive. Built in the final fix pass: `orchestrator.ts`, `snapshot.ts`, `RightPanel.tsx`, `server/thinker/{model,handler}.ts`, `prompt-open.{fi,en}.md`, `capability-matrix.ts`, `queries.ts`. Design and hypotheses: `27` revision (aa).

### aa.1 Directive delivery (D1), identical in every cell

- At V8 (on leaving the hinge) P2 (JOHTO) sends the directive as a **radio message** to **both** conditions. The same text stays on screen as a **persistent line** at the top of the right panel, labelled "Johdon linjaus" / "Command directive", from V8 to the end (`SessionSnapshot.directiveInForce`). Its display is logged once (`directive_shown`, `07` revision (aa)). Nothing is shown before V8 or in the practice view.
- The hinge screen no longer carries a per-cell sentence: `hinge_cell_note_shown` is not emitted, and the debrief no longer describes a "Linjaus" line (§z.5's first bullet is resolved).

### aa.2 The Open Thinker is directive-aware (D2)

> **Superseded in part by revision (ab):** the Open Thinker assesses and never enforces; the second bullet below ("relates the commander's reasoning to the higher strategy … what would justify departing") reads as `ab.1`, and the plan context now carries the records clock and a digest (`ab.2`).

The Open Thinker's prompt and context change; **Haku does not**. Both AI cells get the same prompt. The Open Thinker now:
- cites records as [T#, time], marks inference and unknowns, and gives options with trade-offs;
- relates the commander's reasoning to the higher strategy, saying whether it is in line and, if it departs, what in the records would justify departing; the commander decides;
- observes a life-safety hard stop (withdrawal and evacuation are raised as questions, never advised as orders);
- receives, with every question, a server-built plan context: the clock, the sectors L1–L4 with labels, the crews, drone teams and autonomous assets on scene, the plan's posture and secondary-task options, and the intent in force (the phase-A intent before V8, the directive verbatim from V8). **9 Oct 2026 (`14` revision (aj)):** the intent in force is no longer a plan-context line but the last block of the **system instruction** (the frozen prompt plus the block, hashed as `systemPromptHash`), and rule 5 asks the model to weigh each plan option against the directive; still both Thinker cells, never Haku.

§z.1's table row "Prompt" for the Open Thinker ("conversational, may suggest options and recommend, plain text") is extended accordingly; the prompt is still frozen and hashed (`promptOpen`, `promptOpenEn`). **The `linjaus` status stays withdrawn**: the Open Thinker's relation to the directive is free text, and no field is parsed.

### aa.3 The capability matrix rows (`capability-matrix.ts`)

| Row | `directed` | `assistive` (unused) | `substitutive` |
|---|---|---|---|
| `crossSourceFreeTextQuery` | true | true | true |
| `hakuChat` | true | true | true |
| `openThinker` | **false** | false | **true** |
| `aiDrawerPresent` | false | true | true (gates the Open Thinker tab) |
| `referenceData`, `situationLog`, `trafficLog`, `pushedChannelSignals` | descriptive rows of §2; no surface reads them | | |

`hakuChat` is in the shared (identical) row; `openThinker` is the one manipulation. §z.2's table stands; this adds the two rows by name.

### aa.4 Open Thinker fallback: an explicit "unavailable" state

When the model does not answer (a wrong-shaped reply, a timeout, a network failure or the proxy's own fallback) the Open Thinker tab shows **"Thinker is unavailable right now — ask again or use Haku"** (`thinkerUnavailable`), **never a record excerpt** (commander review M1, 8 Oct 2026). This supersedes §z.1's "the same local template, as plain text". The turn is logged as a fallback with its reason and an empty answer; an unanswered turn is not sent to the model as history. Haku's fallback is unchanged: the deterministic template (`14` step 6).

### aa.5 Autonomous assets (D3)

The water drone **VD1** and the hose-laying robot **UGV1** are autonomous background assets in both groups. The briefing and the roster say so; the plan gives them no tasks, and the dead `task.water-drop` and `task.hose-lay` options are removed. They remain visible on the map and in the roster (`16` §on scene).

### aa.6 Stale text pointed here

§z.3 item 3 ("their treatments are now identical", read as "no difference at all"); §z.5 (both bullets: the hinge sentence and the debrief are fixed; the query-builder bullet stands); §z.2's closing paragraph (the difference between the groups is the Open Thinker, now directive-aware).

---

## Revision 8 Oct 2026 (ab) — the Open Thinker assesses and never enforces; the departure note; Haku and the directive

Researcher decisions of 8 Oct 2026 after persona round 5 (D1, D5, D7; `14` revision (ab) has the evidence and the prompt text). Built in fix pass 6: `server/thinker/{model,handler}.ts`, `prompt-open.{fi,en}.md`, `prompt.{fi,en}.md`, `app/session/queries.ts`, `DecisionPanels.tsx`, `plan-types.ts`, `allocation.ts`.

### ab.1 The Open Thinker's stance (supersedes §aa.2's second bullet)

§aa.2 said the Open Thinker "relates the commander's reasoning to the higher strategy, saying whether it is in line and, if it departs, what in the records would justify departing". Persona round 5 showed the live model turning that into enforcement. The rules are now (frozen in `prompt-open.*`, quoted in `14` §ab.2):

- **It assesses, it never enforces.** The directive is a duty officer's order, not a safety finding; departing from it is never "unsafe" by itself, and the Open Thinker never says a plan "violates" it.
- **It judges a tactic against the directive only when the tactic is a plan option** (the main effort's postures and the secondary sector's tasks): "in line" or "departs". For any other tactic (for example a crew's burnout) it says the directive does not cover it and leaves the call to the commander. A burnout from a held road is in line in the coding (`16` revision (ab)) but is not a plan option.
- **The absence of a record is not evidence** that something is not happening or that departing is unjustified; it says what is missing and what would settle it.
- **A departure can be justified** by a small, new or unattended fire, or by a concrete risk the directive did not foresee; it names the records and adds "Departures are reported up the chain." (a statement, not an order).
- **No imperatives** ("must", "should", "immediately", "cease"), no instruction to shift tasks; **at least two options** with trade-offs on a decision question; **no "safer option" stance and no recommendation**. Life safety: crews or residents in danger are raised as a question only; for a question about withdrawing or evacuating it gives the newest safety records and questions and **no verdict** against the directive.
- About 100 words, plain text. Its relation to the directive is still free text, but the verdict is also extracted deterministically (`14` §ab.5).

Still **one prompt for both AI cells**; the cells remain identical by design (§aa, `27` revision (aa)). §aa.2's third bullet ("a life-safety hard stop") stands and is now rules 6 and 8.

### ab.2 What the Open Thinker is given (adds to §aa.2)

The plan context now states two clocks: the clock at the question (the window start) and **the time the records have been received up to** (the latest observation in the step). Every request also carries a **digest of the step's eight newest records** (five from sources that are not units on scene, three from the units; `14` §ab.4). The Open Thinker's **conversation is cleared once**, at the first view from V8 on, so phase-A advice does not carry into phase B. Haku has the records clock in its user content and nothing else of the above.

### ab.3 Haku and the directive (D7)

Haku does not know the directive: P2's messages are not corpus records. Asked what the higher command has ordered or intends, Haku's prompt now says that the directive is in the banner and not in its records and that it cannot confirm it, instead of answering with an unrelated record at "Certain" (round 5, V8). Haku stays neutral (no plan context, no directive text, no history). This does not make Haku a directive-aware tool; the contrast of `27` is unchanged.

### ab.4 The departure note (D5), identical in both conditions

From V8 the plan panel carries an optional **"I am departing from the command directive"** checkbox (Finnish "Poikkean johdon linjauksesta") with a one-line reason (at most 200 characters, optional, only with the checkbox). It is offered in every cell and every view from V8 (`DEPARTURE_NOTE_FROM_VIEW`), is not offered before, and changes nothing else in the panel. It is logged in the plan: `allocation_submitted` and `allocation_revised` `detail.plan.departureNoted` / `departureReason` (`07` revision (ab)); `allocation.ts` rejects a note before V8, a reason without the note, a multi-line reason or one over the cap. **Purpose:** to separate a deliberate, reported departure from one that went unreported, which the Open Thinker's "Departures are reported up the chain" otherwise leaves unmeasurable. No tool transmits it: there is no channel up the chain in the simulation, by design (`11` §7.18.4). No prompt or text tells the participant to use it. Measure: `accountableDeviation` (`16` revision (ab), `27` revision (ab)).

### ab.5 Stale text pointed here

§aa.2's second bullet and its sentence "relates the commander's reasoning to the higher strategy" (read as ab.1); `14` revision (z)'s "The prompt invites options and recommendations" and revision (aa)'s untested-prompt bullet (`14` revision (ab)); §z.1's table row "Prompt" for the Open Thinker ("may suggest options and recommend") now reads "may give options with trade-offs and never recommends one".

---

## Revision 9 Oct 2026 (ad) — the notes' scope

### ad.1 The hinge and the tools' notes (`11` §7.20 item 5)

- **The hinge screen** has carried no per-cell sentence since revision (aa) (the `linjaus` sentence, `hinge_cell_note_shown`, is no longer shown or logged): the screen is the hint, the directive, the check and Continue, identical in every cell. Nothing to change there.
- **The remaining note whose scope differed** was the empty-chat note: the Haku tab said "Ei kysymyksiä vielä. Thinker vastaa vain kysyttäessä." in both groups, naming a tool the Haku group does not have and saying nothing of error. Now every tool's empty chat says the same sentence with its own name: "Ei kysymyksiä vielä. {Haku|Thinker} vastaa vain kysyttäessä, ja vastaus voi olla väärä tai puutteellinen." / "No questions yet. {Search|Thinker} answers only when asked, and its answer can be wrong or incomplete." (`ui.ts` `noQuestions(tool)`; test `open-items-fixpass7.spec.ts`).

---

## Revision 10 Oct 2026 (al) — the two Thinker cells differ again, by one thing

Review panel, 10 Oct 2026 (researcher approved). **Supersedes revision (aa)'s "the Open Thinker is directive-aware … identical by design" for the two Thinker cells and `14` (aj)'s "both Thinker cells".** The capability matrix is otherwise unchanged; Haku's chat is the same in all three cells and never holds the directive.

| Cell | Haku chat | Open Thinker | What the Open Thinker holds besides the records |
|---|---|---|---|
| `radio` (Haku) | standard prompt | — | — |
| `reasoning_once` | standard prompt | `prompt-open.once.*` | nothing: the same information as Search (plus the plan context); asked about the directive, it says the directive is in the banner and the message log; if the participant quotes an order's text, it may assess the quoted text |
| `reasoning_intent` | standard prompt | `prompt-open.*` + the order block | the text of P2's orders as issued: the opening intent (V1–V7), the directive verbatim (V8–V14), framed as data to assess against (`14` al.2–al.3) |

- **The manipulation** is now the order block and rule 5 in the `reasoning_intent` Thinker's system instruction, nothing else: the same model and settings, the same records, plan context (with the same place-name line), digest and history handling, and the same wording elsewhere. Both prompts are frozen and hashed in `content/thinker/manifest.json`.
- **The directive reaches every participant as before** (P2's radio message at V8 and the persistent banner, `directive_shown`), so the contrast is "a Thinker that relates the options to the directive" against "a Thinker that does not hold it", with the directive equally visible on the screen.
- **What the participant is told** (`15`, the V1 tool tour; `app/scenario/briefing.ts`): `reasoning_once` — the Thinker "reads the same information received so far as Search"; `reasoning_intent` — the same sentence, plus "Thinker also holds the text of the duty fire chief's (P2) orders as issued: the opening intent and, once it is issued, the directive." True for each cell; the Haku cell's texts are unchanged.
- **The departure note** on the plan stays identical in both conditions; the Open Thinker no longer says "Departures are reported up the chain" (only the AI group heard it).

### au. 210 = 3 × 70 (11 Oct 2026)

Researcher decision. The planned sample is **210** in three equal cells of **70** (`radio`, `reasoning_once`, `reasoning_intent`). The allocation table uses permuted blocks of **42**, **14 : 14 : 14** (before: 200, blocks of 40, 14 : 13 : 13, 70 : 65 : 65), stratified by language as before, regenerated with `tools/assignment/generate.ts` (`rowsSha256` 3f813613…8ccd). Haku is 70; the two Thinker cells, identical by design and pooled for Paper 1, are 140. Older tables in this file that show 65 per Thinker cell, a 70 / 130 split or "of 200" describe earlier revisions; the cell sizes are now 70 / 70 / 70. Power: to recompute for n = 210 (`09` au, `27` au).
