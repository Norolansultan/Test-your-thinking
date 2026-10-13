# 06 — UI and interaction

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Consolidates `13_Settled_Shape_and_Layout.md` §3 and the surviving parts of `02_Architecture_v2.md` AD-15 and AD-17. **Supersedes the four-region layout** described in the archived AD-15.

> **Changelog**
> - **23 Sep 2026 (j)** — Radio drawer removed in both groups; the right panel for the no-AI group becomes a message log; the tutorial covers Haku only. See the revision at the end.
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Course-of-action panel, SPAM overlay, warm-up and tutorial. See `15`, `16`.

---

## 1. The principle

The map is the work surface. Everything else is either pushed onto it or lives behind a button.

This principle reduces the information architecture to one decision: what is on the surface and what is one click away. It also **improves the measurement**. A drawer behind a button makes opening it an act, and therefore a measure:

- time from cycle start to first open;
- how long it stays open;
- which tab within it is used;
- how often it is opened per cycle;
- whether it is ever opened at all.

A participant who never opens the search drawer during a cycle has told you something precise that a permanently-visible panel would have hidden.

---

## 2. The layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ klo 14:35  ·  jakso 4/20  ·  EK11 ● EK12 ● EK14 ○ DRONE1 ●  ·  3 uutta│  status strip
├───────────────────────────────────────────────────┬──────────────────┤
│                                                   │  SAAPUVAT        │
│                                                   │  ┌────────────┐  │
│                    MAP                            │  │ 14:31 EK12 │  │
│         perimeter · envelope · units              │  │ ojan var...│  │
│         bubbles · own marked geometry             │  └────────────┘  │
│                                                   │  ┌────────────┐  │
│                                                   │  │ 14:28 DRONE│  │  report rail
│                                                   │  └────────────┘  │
│                                                   │                  │
│  [ Haku ]   [ Avaa tekoäly ]   [ Radio ]          │                  │
└───────────────────────────────────────────────────┴──────────────────┘
```

### 2.1 Persistent

**The map**, occupying most of the viewport. It shows unit and asset markers, observation bubbles, the fire perimeter as last reported, the projection envelope with its validity horizon, and the participant's own marked geometry.

**A status strip**, thin, along the top edge: incident clock, cycle number, own formations with status and the **age** of each status, and the count of unread reports.

**An incoming report rail** along one side. New bubbles announce themselves in the rail as they arrive and can be opened from the rail or from the map. Items scroll away. **Nothing is pushed again after its arrival.** The rail is scrollable back **within the current cycle only**. Older items live in the search drawer, which is what makes searching necessary rather than optional.

### 2.2 Behind buttons

**`Haku` — the search drawer.** One button, present in **every** condition, opening a panel that widens over the map. Inside it: situation log, traffic log, unit status with ages, and reference data (stand, road, water, maintenance).

Contents differ by condition exactly as the capability matrix specifies (`02` §2). In `directed` the drawer offers browsing and filtering by unit or time window, and the traffic log by named unit only. In `assistive` and `substitutive` the same drawer additionally carries a free-text field searching across all of it.

**`Avaa tekoäly` — the AI drawer.** Present in `assistive` and `substitutive`; **absent in `directed`**, not disabled. In `assistive` it returns corpus facts verbatim with source and time. In `substitutive` it does that and also answers within the channel's vocabulary.

**`Radio` — the radio panel.** Present in all three conditions. The participant uses it to address a named formation or the duty officer. Requests are typed, not spoken. The study needs *what participants asked* to be comparable across conditions. Speech would exist only as audio, which requires transcription that is expensive, lossy and arrives too late to inform piloting. The realism cost of typing is accepted deliberately and declared.

### 2.3 Pushed, therefore not behind a button

In `substitutive` the channel's signal set appears **in the report rail** alongside incoming reports, visually distinguished, at its fixed cadence including the all-clear. It cannot sit behind a button, because being pushed is the manipulation.

### 2.4 The probe surface

The probe surface takes over the viewport when a probe begins. In `PROBING_VISIBLE` the map and envelope remain rendered beneath or beside it. In `PROBING_BLANKED` the map, rail, drawers and status strip are all removed.

### 2.5 Drawer behaviour — settled

A drawer **persists across the cycle boundary**, so a participant who left it open is not silently reset. Its state is logged at every boundary.

A drawer is dismissible by clicking the map or pressing Escape. Both dismissal routes are logged distinctly.

Only one drawer is open at a time; opening a second closes the first, and both events are logged.

At the minimum viewport (1280 × 800) the drawer occupies at most 55% of the width, so the map remains usable beneath it. Below that viewport size, the pre-flight check refuses the session.

---

## 3. Information-design rules

Derived from one principle: **read models expose freshness, provenance, uncertainty, limitations and validity horizons, and never silently substitute data.**

**Every displayed element carries a visible source and an observation time.** Nothing appears without provenance.

**Staleness is visible and graded, not binary.** A unit position whose last report is twelve minutes old is rendered as stale, never as present-at-last-known-position.

**`unknown` has a visual form of its own**, distinct from `zero`, `absent` and `stale`. This is the single most important rule and the easiest to lose: a blank cell reads as "nothing there" when it should read as "not known".

**Certainty is rendered from the same four-value vocabulary the channel uses** — `confirmed`, `probable`, `uncertain`, `unknown` — with one consistent visual encoding everywhere it appears.

**The basemap is deliberately low-salience** so it does not compete with the situational layer or the channel. Extraneous visual load is not a manipulated variable and must not be introduced accidentally.

**Layer state is explicit and logged.** A participant with a layer switched off has a different picture and the analysis must know.

### 3.1 Typography

```
Plex Sans   interface chrome, labels, probe text, report body
Plex Mono   unit designators, timestamps, coordinates, grid references,
            wind values — anything to be read back or compared character by character
Plex Serif  long-form ground reports, marking them typographically as
            human-authored prose distinct from system output
```

**The serif/sans distinction is not decoration.** A participant must be able to tell at a glance whether they are reading a human report or a system-generated signal, because confusing the two would confound the channel manipulation. Typeface is one of the cheapest ways to carry that distinction. It is applied consistently and documented in the validity claim.

Self-hosted, SIL OFL 1.1, subset to Latin plus Finnish diacritics (`05` §8).

### 3.2 The visual encoding system

Five properties each need a distinct visual treatment: certainty (four values), staleness (graded), tier provenance, urgency (four levels) and the `unknown` state. Each treatment needs to:

- survive together on one map without collapsing into noise;
- remain legible for colour-vision deficiency;
- work on a poor laptop panel.

**Specified in `12` §8.** The governing rule is that no property is carried by hue alone: every one has a redundant non-colour channel. `12` also settles how the projection envelope is drawn (one boundary, no gradation — `12` §3), what is drawn on units and aircraft (`12` §6), and the reported-rate mark that carries magnitude (`12` §5).

---

## 4. The time and interaction model

### 4.1 Stepped world, continuous information

**The world state advances in discrete steps at cycle boundaries.** The fire perimeter, unit positions and asset positions are redrawn once per cycle and then hold still. The map presents a *last reported situation at a stated time* — "tilanne klo 14:35" — not a live view. **Nothing animates.**

**Information arrives continuously within the cycle.** Observation bubbles appear at authored offsets across the working period, so reports accrue while the participant is reading, in an order that matters and at a rate they cannot fully absorb. This is where tempo, workload and attention allocation live.

**The clock is visible and running during the working period, and halted during every probe.** Participants must be able to reason about elapsed time and rates, so the scenario clock and each element's age are always on screen.

### 4.2 Why the fire must not animate

If the perimeter moves smoothly, participants extrapolate visually from motion. Visual extrapolation is a perceptual task and a *different* task from the one under study. Animation would also swamp the manipulation: a participant who can watch the fire advance does not need the channel's integration, so the difference between `assistive` and `substitutive` would shrink toward nothing and the primary contrast would null out for reasons having nothing to do with the hypothesis.

An animated perimeter is also less realistic, not more. No incident commander watches a live animated perimeter. They receive periodic timestamped reports and reason forward from them, which is exactly what the stepped model reproduces.

### 4.3 Change highlighting

At the start of each cycle the map redraws and the changed elements are briefly and explicitly marked — new perimeter, moved units, new reports — with the marking decaying after a few seconds.

The reason is the same as for not animating the fire, in miniature. Without highlighting, the participant must detect change by comparing the new picture against a remembered one, which is a visual change-detection task adding variance unrelated to the construct. **The change detection this study measures is between reports and the projection, not between two map frames.** Remove the perceptual version so the cognitive one is measurable.

### 4.4 Validity horizons are rendered, always

Every projection carries its horizon on screen — *ennuste voimassa klo 15:05 saakka* — and every situational element carries its observation time and age. A projection without a stated horizon cannot be judged for containment; an element without an age cannot be judged for staleness. Both are measures.

### 4.5 What the participant can and cannot do

> **[SUPERSEDED 2026-09-17]** Participants can also choose a course of action each cycle; see amendment.

**Can:**

- open bubbles and read reports;
- send radio requests;
- query (where available);
- request lateral traffic;
- pan within the extent and change between fixed zoom levels;
- toggle layers;
- mark an expectation;
- judge the projection, mark a failure location, draw a corrected projection;
- assign formations and assets to sectors and tasks;
- write a short rationale.

**Cannot:**

- move units directly on the map;
- alter the fire;
- change the weather;
- affect what happens next.

### 4.6 Allocations are recorded and scored, and they do not change the scenario

The fire develops as authored regardless of what is assigned where. This is deliberate and it is the price of the study's central property: **every participant must face an identical event stream**, or projection accuracy is not comparable between them and the primary measures collapse.

State plainly in the briefing:

- that the incident develops according to its own dynamics, fixed in advance so that all participants face the same situation;
- that decisions are recorded and evaluated.

Officers understand a scripted exercise. What damages engagement is discovering the scripting late and feeling misled, not being told at the start.

**Do not tell participants their decisions "do not matter."** They are scored for robustness and safety against the branch set, and the relationship between a stated doubt and the subsequent allocation is a primary measure.

### 4.7 The contingent-delivery variant, and why it is rejected

An attractive middle path exists: allocations could determine *which* reports arrive as pushed bubbles. Assigning a unit to a sector would then produce observations from that sector, while the fire stays scripted. Agency is preserved, the fire stays comparable, and a new measure appears — whether participants allocate to fight fire or to gather information.

**Rejected for this study** because it breaks the identical-event-stream property the primary measures depend on: different participants would see different pushed information, and between-participant divergence in judgements could no longer be attributed to reasoning rather than to inputs.

Recorded as a candidate for a later study, where agency rather than comparability is the question.

---

## 5. Language

**Everything the participant sees is Finnish.** There are no literal strings in components. All text resolves through `i18n/` from a single string table. The single table is also what makes the Finnish register reviewable as a unit by the domain reviewer.

Probe wording rules:

- No leading terms.
- The uncertainty probe must not mention conflict, inconsistency, or reports disagreeing, or it becomes a prompt rather than a measure.
- Numeric items state their unit.
- Categorical options are mutually exclusive and exhaustive, with an explicit *ei tiedossa* where "don't know" is a meaningful answer.

**The string table is a deliverable and is not yet written.** See `11` §2.4.

---

## 6. Accessibility and refusal

The instrument is not a public product and does not need to meet a general accessibility standard, but two things are required for validity rather than compliance.

Colour is never the sole carrier of certainty, staleness or urgency — shape, position or label carries it too. Otherwise a participant with colour-vision deficiency is in a different condition from everyone else.

Text is resizable to 125% without layout collapse, since participants run this on their own machines at their own settings.

Where an environment cannot support the instrument, the pre-flight check **refuses and records the refusal**. It never degrades silently: a degraded session produces data that looks valid and is not.

---

## Amendment 2026-09-17

**Course-of-action panel.** Four option cards in seeded order, a confidence slider, and a confirm button, shown before the allocation surface. For reasoning-AI participants in the guidance-via-AI cell, in phase B:

- first, the alignment statement appears in the AI drawer style after the initial choice;
- then a final-choice prompt follows, with the initial option pre-selected.

**SPAM overlay.** A small non-modal card at the top of the map: first a ready prompt with *Valmis*, then the question and a confidence slider. The map and tools remain usable. The overlay must not cover the projection envelope or the report rail.

**Freezes.** Five SA items per freeze, each followed by a confidence slider (0–100), same component as Type J. L3 items use the blank-map point or polygon input.

**Prologue and tutorial.** The prologue uses the `directed` layout for everyone. The tutorial then introduces the AI drawer (AI groups) or a matched-length neutral map exercise (no-AI group).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

- **No alignment feedback panel** (removed).
- **Tutorial:** AI participants learn the query drawer (what it answers, phrasing, two practice queries); no-AI participants get a matched-length radio and browsing tutorial.
- **Branch list:** after the correction polygon is committed, a list of four statements plus *Ei mikään näistä* (always last), single choice, no text field.
- **Confidence sliders** render without a thumb until first touched.
- **Cell 3:** intent lines appear as a distinct final line inside AI answers, same typography as the answer, no highlight colour.

---

## Revision 23 Sep 2026 (h) — the Haku drawer is the query builder

In every group, the `Haku` drawer (§2.3) is the structured query builder of `25`: three rows of choices (MITÄ, KUKA, MILLOIN) and a search button. The AI group's free-text field sits below it. The builder, the free-text field and the AI drawer all show results after the same fixed delay of 2.5 s (`25` §5). Each result shows source, observation time and content.

---

## Revision 23 Sep 2026 (i) — the two-phase screen layout

**Supersedes §2's layout diagram and persistent-elements list.** Implements the two-phase cycle (`15` §9–§10).

```
┌──────────────────────────────────────────────────────────────────────┐
│ klo 14:35 · jakso 4/20 (vaihe A) · EK11 ● EK12 ● EK14 ○ · condition  │  top bar, 56 px
├───────────────────────────────────────────┬────────────────────────┤
│                                            │  SELECTED ON MAP        │
│                   MAP                     │  title · status · lines │
│         (~544 px tall, ~920 px wide)      │  source · time          │
├───────────────────────────────────────────┤──────────────────────────┤
│  DECISION STRIP (~300 px, gated by phase) │  AI CHAT   or  RADIO LOG │
│  1 · Judgement / own projection           │  (condition-dependent,  │
│  2 · Course of action (if the cycle has   │   persistent through    │
│      one)                                 │   both phases)          │
│  3 · Allocate units                       │                          │
└───────────────────────────────────────────┴────────────────────────┘
```

**Top bar** (unchanged content from the existing status strip, §2.1, restyled): clock, cycle index, phase (A/B), own-formation status, condition label (dev/preview builds only — never shown to a real participant), current cycle phase (exploration/decision/freeze).

**Decision strip** is empty/locked during the exploration phase — no judgement, course-of-action or allocation control renders. It populates on entering the decision phase. Its three steps are gated in order, as today (§2.1, the course-of-action amendment).

**Right column.** The "selected on map" card is **new** (not yet built; open item below). Below it, the condition-dependent panel from `15` §10.2 replaces the report rail as the permanent right-column content: AI chat (LLM reasoning) or a timestamped radio log (Radio), both persistent across the whole session, not scoped to one cycle. The rail's existing "new bubble announces itself, then scrolls away within the cycle" behaviour (§2.1) is retained *inside* the radio-log panel's content, not as a separate rail.

**Open item.** The "selected on map" detail card (click a marker, see its title/status/lines/source/time in the right column) is speced here but not yet built — it needs map-click infrastructure beyond the existing breach-point-picking mode. Tracked in `11`.

---

## Revision 23 Sep 2026 (j) — no Radio drawer

Follows `02` revision (j). **Supersedes the `Radio` button in the §2 layout, the "`Radio` — the radio panel" paragraph, "send radio requests" in the interaction list, and the "radio and browsing" tutorial wording.**

- **Drawer buttons.** Haku group: `[ Haku ]` only. Haku + LLM group: `[ Haku ]  [ Avaa tekoäly ]`. There is no `[ Radio ]` button in either group. Remove it; do not disable it.
- **Right panel, Haku group.** The "RADIO LOG" of `15` §10.2 keeps its content: the pushed bubbles as a running, timestamped log (time, callsign, message). It is **renamed** so it does not suggest the participant can transmit. Working label *Viestiloki*, pending the native reviewer. It has no input field.
- **Right panel, Haku + LLM group.** Unchanged: AI chat.
- **Tutorial.** The Haku group gets a matched-length **Haku** tutorial: two practice queries in the builder, the same count as the AI group's practice queries. The AI group's tutorial is unchanged, and both groups learn the builder in the shared part.
- **Briefing.** State plainly that the participant cannot contact units and works from what is reported and recorded. Participants must not discover this by looking for a radio.

---

## Revision 24 Sep 2026 — wind indicator

The map carries a wind indicator in its lower-left corner (`12` revision 24 Sep 2026): the command-point station's direction and mean speed at the cycle's start, identical in every condition. It is always visible, so it is not a layer and has no layer state to log.

---

## Revision 25 Sep 2026: right column the same for both groups; tools off the map

**Layout.** The right column (`RightPanel.tsx`, 360 px) is the same in both conditions:
1. **Tool buttons at the top:** **Haku** for everyone, and **Tekoäly** in the AI condition only.
2. **The open tool** below the buttons, taking at most about 58 % of the height.
3. **The message log (Viestiloki)** at the bottom, always visible and identical in both groups.

**Nothing opens over the map.** The tool bar under the map and the overlay drawers are removed.

**One AI interface.** The separate "Avaa tekoäly" drawer is removed. It ran the same retrieval as Haku's free-text search, returned a raw list, added the Haku delay, and was **not logged**. Its duplicate, unlogged use was a measurement gap. The AI condition's only extra is now the Tekoäly tool: the four-part answer (vastaus, perusteet, varmuus, mikä muuttaisi), a persistent history, and every question logged as `ai_chat_query_submitted`.

**Unchanged:** Haku's free-text field still follows the capability matrix (`crossSourceFreeTextQuery`). This matches the augmentation design (Haku vs Haku + LLM; the shape of the LLM condition is still open).
