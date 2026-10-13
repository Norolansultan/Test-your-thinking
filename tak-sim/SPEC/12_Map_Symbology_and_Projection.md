# 12 — Map symbology and projection rendering

**Version 3.0 · 16 September 2026.** New document. Closes the open item `11` §3.1 (the visual encoding system) and answers three questions the earlier set left unspecified: how the projection is drawn, whether it is graded by probability, and what is drawn on units and aircraft.

---

## 1. The three questions, answered up front

| Question | Answer | Section |
|---|---|---|
| Is the projection graded — nested bands, darker red = higher chance? | **No. One envelope, one boundary.** Graded bands make the primary measure undefined | §3 |
| Is anything drawn showing where a unit should go? | **Only where the participant has sent it**, in the anticipated-status convention. Never a machine recommendation | §6 |
| Is magnitude of change shown? | **Yes — on the fire, as a reported rate, not on the units as a plan** | §5 |

The reasoning matters more than the answers. Two of the answers are counter-intuitive, and a builder who does not understand why will reintroduce the problem the first time the map looks sparse.

---

## 2. What operational practice actually does

### 2.1 Probability surfaces — and the documented misreading

The US **FSPro** model inside WFDSS produces exactly what the question describes: nested burn-probability contours from a large ensemble of simulations, at breaks around 0.2%, 5%, 10%, 20%, 30%, 40%, 60% and 80%.

It also carries, in its own documentation, the warning that makes this design decision for us:

> "It is important to remember that the different colors in an FSPro map represent burn probability contours, **NOT fire perimeters or fire shapes**."

and

> "The resulting burn probability maps are **easily misinterpreted as a fire progression** … FSPro results show probability contours NOT daily progression perimeters!"

An agency that has used graded probability contours operationally for two decades finds it necessary to warn trained users, in bold, that the bands are not perimeters. That is a strong signal about what a graded surface does to a reader under time pressure.

### 2.2 Deterministic construal error

The same finding is established experimentally in the hurricane forecast literature. The "cone of uncertainty" is a probability region, and people consistently read it as an object:

- they read the outer boundary as a hard safety line;
- they read the widening of the cone as the storm *growing* rather than as forecast uncertainty increasing.

Ruginski and colleagues (2016) and Broad and colleagues (2007, on the 2004 Florida season) document the misinterpretations. The general pattern is named the **deterministic construal error**: a probabilistic display construed as a statement about a single determinate object.

This is not a reason never to show uncertainty. It is a reason not to show uncertainty **in the geometry that a study is asking people to judge**.

### 2.3 Time-of-arrival isochrones

The dominant operational form in tactical products — Technosylva's Wildfire Analyst and Tactical Analyst, FARSITE, Prometheus — is the **time-of-arrival isochrone**: nested bands showing where the head is expected at +1 h, +2 h, +3 h. These are not probability; they are time. They are the most-used form because they answer the commander's actual question, which is *when does it reach the road*.

Isochrones are rejected here too, for a different reason (§7.2).

### 2.4 Military practice — the one convention worth stealing

MIL-STD-2525 and NATO APP-6 encode a distinction this design needs and had not specified: **status**. `STATUS_PRESENT` versus `STATUS_ANTICIPATED` (also called planned) is a first-class attribute of every symbol, rendered as a **solid frame for present and a dashed frame for anticipated or planned**.

The present/anticipated status is exactly the distinction between "this unit is here" and "this unit is going here". It is the right way to draw an allocation without drawing a recommendation, and it is adopted in §6.

---

## 3. Why graded bands break this study specifically

Three arguments. The first alone is decisive.

### 3.1 The judged artifact must have one boundary

The primary measure is a containment judgement: *will the fire stay inside this envelope*, answered three ways with a confidence, twenty times. That judgement presupposes an unambiguous inside and outside.

Draw three nested bands and "the envelope" is undefined. One participant judges against the 80% band, another against the outer 5% band, a third against something in between — and none of them tells you which band they judged. Between-participant variance in **which line was judged** becomes indistinguishable from variance in **judgement accuracy**, which is the dependent variable. Calibration computed on top of that is calibration of an unknown quantity.

There is no scoring rule that recovers this. The answer key is polygon containment with a declared tolerance (`08` §6); with three polygons there are three answer keys and no way to know which one applies to a given response.

**This is not a preference. A graded envelope makes H2, the primary hypothesis, untestable.**

### 3.2 It hands back the cue the study removes

The study's claim is that machine integration delivers a forecast without the cues by which its reliability is judged (`01` §1). A display that renders the machine's own uncertainty as visible gradation gives part of that cue back, for free, in every condition.

Displayed uncertainty is a genuinely interesting manipulation — *does displayed uncertainty repair the metacognitive collapse?* — and it is a **fourth arm or a follow-up study**, not a rendering choice. Putting it in all three conditions weakens the manipulation and measures nothing about it, because there is no ungraded comparison.

### 3.3 The known misreading lands on the measured judgement

§2.1 and §2.2 together show that under time pressure, readers treat the outer boundary of a graded region as a hard line and read band width as magnitude rather than uncertainty. In this study the participant is asked, twenty times, to judge exactly that boundary. Importing a documented perceptual confound into the dependent variable is not a trade worth making for visual richness.

---

## 4. What is drawn instead — the envelope

### 4.1 Geometry

**One polygon. One crisp boundary. One stated horizon.**

```
Stroke      2 px, solid, the projection hue, full opacity
Fill        the same hue at 12% opacity, FLAT — no gradient of any kind
Horizon     rendered as a label anchored to the polygon:
            "ennuste voimassa klo 15:05 saakka"
Attribution rendered with it: which system produced it, and at what time
```

**No gradient, deliberately.** An unlabelled gradient is read as probability whether or not it means probability. The value-suppressing-palette literature (Correll, Moritz & Heer) is consistent on this: a gradient the designer does not intend semantically is a gradient the reader will interpret semantically. If the design does not mean a gradient, it must not draw one.

### 4.2 Uncertainty is carried as an attribute, not as geometry

The envelope is not certain, and the display does not pretend otherwise. It carries the same four-value `Certainty` vocabulary as everything else (`04` §1), rendered on the **stroke**, not the area:

| Certainty | Stroke | Rationale |
|---|---|---|
| `confirmed` | solid | |
| `probable` | solid, lighter weight | |
| `uncertain` | dashed | Consistent with the anticipated-status convention in §6 |
| `unknown` | dashed + the explicit `unknown` badge | Never rendered as an absent envelope |

This gives honest uncertainty communication **without ambiguating the boundary being judged**. The inside/outside test is unchanged; only the reader's warrant for the line changes.

Certainty is identical across the three conditions, like every other property of the envelope (`02` §2).

### 4.3 The participant's own correction

When a participant answers `fundamentally_wrong` and draws a corrected projection, it is drawn in a **visually distinct treatment** — a different hue, heavier stroke — and both polygons remain on screen until the cycle closes.

Keeping both visible simultaneously is the point: the correction is scored for relative accuracy against the machine's envelope (`08` §6.1), and a participant who cannot see both while allocating cannot exhibit doubt–action coherence one way or the other.

---

## 5. Rate of spread — where magnitude belongs

The request for magnitude is right. Magnitude belongs on the fire, and it must be an **observation, not a projection**.

### 5.1 The rate mark

> **Withdrawn as a rendering rule, 8 Oct 2026:** rate marks are not drawn on the map (revision (y) at the end).

At the fire head, and at each active flank, a directional mark whose **length is the distance the fire has been reported to travel over one cycle horizon** at the last reported rate. Twenty minutes at 9 m/min is 180 m, drawn to the map's scale so it can be laid against the envelope by eye.

```
Geometry    a tapered arrow from the reported perimeter point, along the
            reported direction, length = reportedRate * 1200 s, to scale
Label       Plex Mono: "9 m/min · EK11 · 16:42 (12 min)"
            value, source, observation time, and age
Staleness   graded with age, per §8
Absence     when no rate has been reported for that flank, NOTHING is drawn
            and the flank carries the explicit `unknown` badge
```

### 5.2 Why this is the right addition, and why it is safe

The rate mark puts the study's central cognitive act on the map without performing it. The participant can lay the reported rate against the projected envelope and see whether the two agree. That comparison — reports versus projection — is precisely what `06` §4.3 says the study measures, as opposed to the perceptual change-detection the study deliberately removes.

The rate mark is safe because it is **authored data with provenance and age, subject to every other rule in the design**. It is a T1 atom. It has a source class with a reliability. It goes stale. And at the cycles where the record thins, it is simply absent. During the crown-run gap (`03` §7.3) there is no rate mark on that flank at all, which renders eighty-one minutes of organisational silence as a visible hole in the picture rather than as apparent stability.

**Authoring obligation.** The rate marks are authored per cycle per flank alongside the perimeters, and they are subject to Gate 1. If a rate mark and its envelope visibly disagree at every breach cycle, containment accuracy goes to ceiling and calibration becomes uninterpretable. The mix of agreeing, disagreeing, stale and absent rate marks is a **tuned quantity**, set in pilot 2, exactly like the containment item difficulty.

### 5.3 Rate marks by flag

Indicative authoring pattern, to be tuned in pilot 2:

| Flag | Typical rate-mark state |
|---|---|
| `holds` | Present, current, consistent with the envelope |
| `breach_quantitative` | Present but **stale** (20–60 min old), or current and only marginally inconsistent |
| `breach_categorical` | **Absent** on the breaching flank, or present on a flank that is not the one that fails |
| Omission cycle (12) | Present and current on the surface flanks, showing a *slowing* fire. Nothing represents subsurface smouldering, because no observation of it exists |

The omission-cycle row is the omission mechanism made visual: every mark on the map is accurate, current and reassuring, and the thing that matters is not on the map because nobody observed it.

---

## 6. Units, aircraft and the arrow question

Three different things could be drawn on a unit. They are not the same thing and the design treats them differently.

### 6.1 (a) Where the unit is — **included**

Solid-framed symbol at the last reported position, with the position's age. Never rendered as present-at-last-known-position; staleness is graded and visible (`06` §3).

### 6.2 (b) Where the participant has sent it — **included, in the anticipated convention**

When the participant assigns a formation or asset to a sector and task, the map shows it, borrowing the MIL-STD-2525 status convention directly:

```
Solid symbol      last reported position          "it is here"
Dashed symbol     assigned sector                 "it is going here"
Thin dashed line  between the two                 the assignment
Task label        on the dashed symbol            what it was sent to do
```

This is **the participant's own order echoed back**, not a recommendation. It is state display in exactly the sense the standard intends, and it is strictly an improvement to the measurement. A participant who cannot see their own plan cannot reason about it. Allocation robustness, safety and decision-space narrowing are all measures of a plan the participant is assumed to be able to hold in view.

The allocation display is identical across conditions, and it appears only after the participant has allocated.

### 6.3 (c) Where the machine says it should go — **excluded**

Kalle's own instinct on this — *"Or perhaps no"* — is right. Four things break if machine tasking arrows are drawn.

**The manipulation moves boundary.** The study's claim is about the **integration** boundary: the machine combines information that the human then acts on. A tasking arrow moves the machine to the **decision** boundary. That is a larger and different manipulation, and the two cannot be separated post hoc.

**Doubt–action coherence dies.** That measure asks whether a participant who rejects the projection then allocates consistently with their own correction (`08` §6.2). With arrows on the map, the participant is choosing between their correction and the machine's instruction. You would be measuring **compliance with a recommendation** — automation bias in tasking, a well-studied phenomenon — instead of the thing nobody has measured, which is whether a stated doubt survives contact with a decision.

**H5 collapses trivially.** Between-participant divergence in `substitutive` would fall toward zero because everyone followed the same arrows. The hypothesis predicts convergence *on a wrong picture through unnoticed integration*; convergence through explicit instruction is a different finding wearing the same number.

**Equal access is broken.** `directed` would receive no arrows. The conditions would then differ in what participants are *told to do*, not only in how information reaches them, and the capability matrix (`02` §2) would no longer hold.

### 6.4 The follow-up study this makes obvious

(c) is excluded from **this** study, not from the programme. A fourth condition — call it `directive`, where the machine integrates *and* recommends tasking — is the natural next experiment, and it is exactly the meaningful-human-control and responsibility-gap question the literature chapter already sets up.

**The architecture must not preclude it.** `AllocationRecommendation` is therefore defined in the data model (§10) and is simply never populated in this study's scenario. A later scenario populates it; the renderer already knows how to draw it in the anticipated convention with a machine attribution; and the engine needs no change. This costs one type and one unused branch now, and saves a fork later.

### 6.5 Aircraft

The drone and helicopter follow the same rules, with two additions:

- **Sensor footprint.** A sensor footprint is rendered while the platform is airborne and **disappears when the platform is grounded**. The coverage gap after the drone goes down (cycle 8) is then visible as an absence, rather than inferable only from missing reports.
- **Endurance.** Endurance is shown as remaining time, with its own staleness, because the battery warning is a load-bearing T4 item (`02` §3.2).

---

## 7. Rejected alternatives, and what it would take to adopt each

Recorded so they are not re-proposed, and so a later study can pick them up deliberately.

### 7.1 Graded probability bands

**Rejected** per §3. To adopt:

- make it a fourth condition against an ungraded control;
- accept a larger recruitment;
- restate the containment judgement against a single named band declared in the manifest and in the briefing.

This is a good study. It is not this one.

### 7.2 Time-of-arrival isochrones (+20, +40, +60 min)

**Rejected**, though tempting — it is the dominant operational form and it would add realism cheaply.

The reason is independence. Showing +40 and +60 at cycle *N* gives the participant information about cycle *N+1* and *N+2*'s envelopes before those judgements are made. The twenty containment judgements would no longer be independent observations, which is the assumption every item-level model in `09` §7 rests on. Isochrones would also create an unauthored inconsistency channel: a participant comparing this cycle's +20 band against last cycle's +40 band has found a discrepancy nobody wrote, scored, or controlled.

To adopt: reduce to one judgement per session, or author the isochrone consistency explicitly across all twenty cycles as an additional truth surface. Both are expensive.

### 7.3 Ensemble or spaghetti perimeters

**Rejected.** Same defect as §3.1 — no single boundary to judge — plus the requirement to author an ensemble rather than a perimeter, which multiplies the geometry authoring by the ensemble size.

### 7.4 Animated perimeter growth

**Already rejected** in `06` §4.2, for reasons that stand: it converts the task into visual extrapolation, and it would shrink the `assistive`–`substitutive` difference toward nothing because a participant who can watch the fire advance does not need the channel's integration.

### 7.5 A soft or feathered envelope edge

**Rejected.** More realistic and less measurable: a feathered edge makes polygon containment scoring ambiguous at exactly the tolerance distances that decide the dependent variable.

---

## 8. The visual encoding system

This closes `11` §3.1. Five orthogonal properties must coexist on one map without collapsing into noise, remain legible for colour-vision deficiency, and survive a mediocre laptop panel.

**The rule: no property is carried by hue alone.** Every one has a redundant non-colour channel.

| Property | Values | Primary channel | Redundant channel |
|---|---|---|---|
| **Certainty** | confirmed · probable · uncertain · unknown | Stroke style: solid · solid light · dashed · dashed + badge | A glyph in the element's label row |
| **Staleness** | 0–5 · 5–15 · 15–40 · 40+ min | Opacity: 100 · 85 · 70 · 55% | Age in minutes, always printed in Plex Mono |
| **Unknown** | — | The `unknown` badge, an outlined glyph | Literal text *ei tiedossa*. **Never an empty cell** |
| **Urgency** (channel signals only) | 0 · 1 · 2 · 3 | Left-edge bar weight | Numeral printed in the signal row |
| **Standard identity** | own formation · aerial asset · fire · civilian/value at risk | Hue | Symbol shape, distinct at 16 px |

### 8.1 Hue assignments

Four hues only, plus the basemap. More than four and the map stops reading at a glance.

| Element | Hue | Notes |
|---|---|---|
| Own formations and assets | Cyan-blue | The MIL-STD friendly convention, which participants with any exercise background will read instantly |
| Fire — reported perimeter | Deep orange | The observed thing |
| Fire — projection envelope | Magenta-red | **Deliberately different from the reported perimeter.** The participant must never confuse what was observed with what was projected; that confusion is the whole study, and the display must not cause it |
| Participant's own correction | Yellow-green | Distinct from both |
| Values at risk, civilians | Neutral dark outline | |
| Basemap | Desaturated grey-green | Deliberately low-salience (`06` §3) |

The reported-versus-projected hue separation is the counterpart of the serif/sans rule for human report versus system output (`06` §3.1): the same distinction, carried twice, in two modalities.

### 8.2 Constraints that are tested, not assumed

Every hue pair in §8.1 is checked under deuteranopia and protanopia simulation and must remain distinguishable by shape alone with hue removed entirely. Every staleness step must be distinguishable at 100% and 125% text scaling. The whole encoding is verified on a low-gamut panel, because participants run this on their own machines. These are named tests in §11.

---

## 9. Per-cycle rendering

What the map shows at each cycle's projection reveal. Authored alongside the perimeters; this table is the authoring brief, and the specific rate values come from the domain reviewer (`11` §2.1).

| # | Flag | Envelope certainty | Rate marks | What the picture invites |
|---|---|---|---|---|
| 1 | H | `uncertain` | Head only, 20 min old, from the first arriving unit | Little to go on. The initial-uncertainty state is visible, not hidden |
| 2 | H | `probable` | Head + south flank, current | The picture firms up. Baseline for what "agreeing" looks like |
| 3 | Q | `probable` | Head current; **nothing on the second ignition** | A new fire with no rate reported. The envelope covers it anyway |
| 4 | H | `confirmed` | All flanks current | Reassuring and correct. Necessary — not every cycle is a trap |
| 5 | Q | `confirmed` | Head current, **but no map layer shows the stand it is entering** (no stand or fuel layer is drawn; revision (al): this row said the boundary was on a "reference layer", which does not exist; Kuusimäki is a name on the basemap, its spruce known from the records) | Mechanism M3. The rate is right for the fuel it is in and wrong for the fuel it is entering |
| 6 | **C** | `probable` | **Head mark absent** — the run started between reports | Categorical breach with nothing on the map to predict it, except the T4 ember warning from cycle 4 |
| 7 | H | `confirmed` | All flanks current | Recovery |
| 8 | Q | `probable` | Aerial-derived marks stop; **sensor footprint disappears** | The drone is grounded. Coverage loss is visible as an absence |
| 9 | **C** | `uncertain` | North flank **40 min stale**, others current | The wind backs onto a flank nobody has observed since the drone went down |
| 10 | H | `confirmed` | All flanks current, **all showing a slowing fire** | Apparent success. Every mark is accurate and the picture is wrong |
| — | | **HINGE** | | |
| 11 | H | `confirmed` | All current | Compliance. The private doubt is in the traffic, not on the map |
| 12 | **C + om** | `confirmed` | **Current, accurate, and showing continued slowing** | **The omission.** Nothing represents subsurface burning because nothing observed it. The map is honest and incomplete |
| 13 | H | `probable` | Current; the water route is a reference-layer feature, not a fire feature | The line fails where cycle 11's traffic said it would |
| 14 | Q | `uncertain` | Two flanks current, one absent | |
| 15 | **C** | `probable` | Present but **measuring surface spread while depth is the problem** | The rate mark is correct and answers the wrong question |
| 16 | H | `confirmed` | Current | Bridge limit is a reference-layer fact |
| 17 | Q | `probable` | **Gusts are in the weather series, not in the rate mark** | Mechanism M2, discoverable only by querying the weather |
| 18 | H | `probable` | **North flank carries two rate marks from two sources, different values, both current** | **The contradiction, visible on the map as two marks.** In `substitutive` the channel resolves them into one signal and the map still shows both — the seam exists and nothing points at it |
| 19 | Q | `uncertain` | Degrading as crews rotate | Fatigue in the data, not only in the participant |
| 20 | H | `probable` | Partial | Handover with an incomplete picture, as real ones are |

**Cycle 18 is worth a second look.** The two rate marks are on the map in every condition. In `directed` and `assistive` nothing has reconciled them, so a participant who looks sees two numbers. In `substitutive` the channel has emitted one settled signal, and the map still shows both marks — the evidence is present, unaltered, and unremarked. Equal access, unequal likelihood of looking (`02` §4), rendered.

---

## 10. Data model additions

Added to `04_Data_Model.md`. The types are defined here and the canonical copy lives there.

```ts
interface Envelope {
  // ... existing fields ...
  readonly certainty: Certainty;        // NEW — rendered on the stroke, §4.2
  readonly attribution: string;         // NEW — which system, at what time
}

/** An observed rate of spread. Data, not projection. §5 */
interface RateMark {
  readonly id: string;
  readonly cycle: CycleIndex;
  readonly flank: "head" | "north" | "south" | "east" | "west" | "rear";
  readonly anchor: LatLon;              // on the reported perimeter
  readonly bearingDeg: number;
  readonly rateMetresPerMinute: number;
  readonly provenance: Provenance;      // source, observedAt, age, certainty
  readonly consistentWithEnvelope: boolean;  // TRUTH. Never rendered
}
// A flank with no RateMark for a cycle renders the `unknown` badge.
// Absence is authored, never incidental.

/** The participant's own allocation, drawn in anticipated status. §6.2 */
interface AllocationMark {
  readonly assetId: string;
  readonly fromPosition: LatLon;        // solid symbol, last reported
  readonly toSectorId: string;          // dashed symbol, assigned
  readonly taskId: string;
  readonly assignedAtCycle: CycleIndex;
}

/** DEFINED AND NEVER POPULATED IN THIS STUDY. §6.4 */
interface AllocationRecommendation {
  readonly assetId: string;
  readonly toSectorId: string;
  readonly taskId: string;
  readonly machineAttribution: string;
  readonly certainty: Certainty;
}

interface SensorFootprint {
  readonly platformId: string;
  readonly cycle: CycleIndex;
  readonly geometry: Polygon | null;    // null once grounded — absence is the signal
}
```

**CI assertion:** `scenario.allocationRecommendations.length === 0`. The type exists so the architecture does not fork later; a scenario that populates it in this study is a defect, and the check says so out loud.

---

## 11. What must be tested

Added to `10_Build_Plan_and_Acceptance.md` under M3.

`test/render/envelope-single.spec` — exactly one envelope polygon is rendered per cycle, with no gradient fill and no nested geometry. This is the guard on §3.1 and it is the most important test in this document.

`test/render/no-recommendation.spec` — no allocation mark is rendered that the participant did not create. Asserted by driving a full scenario with zero allocations and checking the map carries no anticipated-status symbol.

`test/render/rate-absence.spec` — a flank with no authored `RateMark` renders the `unknown` badge and not an empty space.

`test/render/cvd.spec` — every hue pair in §8.1 remains distinguishable by shape with hue removed, under deuteranopia and protanopia simulation.

`test/render/staleness.spec` — the four staleness steps are distinguishable at 100% and 125% text scale, and the age is always printed.

`test/render/hue-separation.spec` — reported perimeter and projection envelope are never rendered in the same hue, in any state, including during change highlighting.

---

## 12. Open items this document creates

Added to `11_Open_Design_Register.md`.

**The rate-mark consistency mix** (§5.2) is a tuned quantity and is not yet set. It interacts directly with Gate 1: too many disagreeing marks and containment accuracy goes to ceiling. Pilot 2 sets it.

**The exact rate values per flank per cycle** (§9) come from the domain reviewer along with the spread rates, and are the same blocking item as `11` §2.1.

**Whether the graded-envelope variant becomes a fourth arm** (§7.1). This is a real study and a real decision, and it is downstream of the participant-pool question (`11` §1.1). Do not commit until the pool is known.

**Symbol shapes** for the four standard identities, distinct at 16 px. Not drawn. Small, but it blocks `test/render/cvd.spec`.

---

## Revision 24 Sep 2026 — wind, aircraft and detached fronts on the preview map

- **Wind** is an overlay in the map's lower-left corner, not a map layer. It shows a compass with the arrow pointing downwind (north is always up; the map cannot rotate), and the reading in Plex Mono: `LOU 230° · 5 m/s`, source and time. It gives direction and **mean** speed only (`18` revision (k) §k.4). Being station data, it belongs to the same class as a rate mark: observation, not projection.
- **Units and aircraft** are labelled symbols in the own-formation hue: a rectangle for ground units and a dome for aircraft (the MIL-STD-2525 friendly frames of §8). Aircraft tracks are thin dashed lines. Sensor footprints are a very light fill with a dotted outline, drawn beneath the fire layers.
- **Detached fronts** (the Rahkasuo front from cycle 13) are drawn in the reported-perimeter style. The envelope's detached parts are drawn in the envelope style. Both are islands of the one boundary (§3.1).
- **Not yet built:** position age and staleness opacity on units (§8), rate-mark symbols, and endurance display (§6.5).

---

## Revision 24 Sep 2026 (b) — projection colours, unit type glyphs, hover cards

Supersedes the envelope and correction rows of §8.1 and the stroke table of §4.2.

- **Red and orange are reserved for the real, current fire** (reported perimeter; later IR heat, satellite hotspots, burnt area), following wildfire mapping convention (US perimeter standard, VIIRS/MODIS age colouring, Copernicus EMS). The projection envelope is therefore no longer magenta-red.
- **Projection envelope: indigo `#4b2aa8`.** Progression maps colour older perimeters cool (blue/purple), so an indigo polygon alone could be read as an old perimeter. It is never drawn without its other two cues: the stroke is **always dashed** and the fill is **flat 8% tint plus a 45° hatch**, and it always carries a label anchored at its northernmost point: `AI-ENNUSTE · T+20 min`, the horizon (`ennuste voimassa klo … saakka`) and the attribution. Still one polygon, one boundary, no gradient (§4.1).
- **Certainty (§4.2) moves from dash-vs-solid to dash length and weight**, since the projection is now always dashed: `confirmed` 2 px, dash 6-2; `probable` 1.5 px, dash 6-2; `uncertain` 2 px, dash 2-2; `unknown` 2 px, dash 2-2 plus the text *varmuus: ei tiedossa* in the label.
- **Participant correction: yellow `#ffe600`** dashes on a 5 px dark casing. The earlier yellow-green failed colour-vision-deficiency separation from the orange perimeter (CIELAB ΔE ≈ 16 deuteranopia, 20 protanopia).
- **Unit type glyphs.** Inside the solid own-formation frame (§8, rectangle = ground, dome = aircraft), a single-colour line glyph in the same hue: fire engine (rescue units), tracked robot (UGV1), drone (DR1–3, from the user-supplied drone drawing), helicopter (HELI1), aeroplane (SPOT). Inline SVG, so identical on every machine and no network use (I3); not colour emoji. Frames stay solid — dashed remains reserved for participant allocations (§6.2). Identical across conditions.
- **Hover card** on each unit: id and type, crew, origin, and for aircraft endurance or reporting route (SPEC/18 §8.1). The §8.1 notes column (fault injections) is never shown.
- **Not changed yet:** the basemap still draws roads in red (`tools/topo-map/render.py`), which conflicts with the reserved-red rule and with §8.1's grey-green basemap. Isochrones (T+10 inside the 20-min horizon; T+30 would leak the next cycle's envelope, §7.2) are deferred.
- **Reported perimeter: bright red `#ff2d1a`, 2.5 px** (was deep orange), matching the red-for-active-fire convention.
- **Projection shown from the start of the cycle** (`substitutive` only; `directed` still has no envelope, SPEC/15 §10.1). It sits on the map throughout exploration beside the reports it can be checked against: the question is whether participants verify it or trust it. `envelope_revealed` is therefore logged at cycle start, so any latency measured from it now includes the exploration phase.
- **Crews and vehicles** (`18` revision (m)): a crew working the fire edge on foot and its vehicle on the road are two own-formation symbols. The crew is labelled, with a task glyph in its frame (water, pump, peat, fire break, shovel). The vehicle is smaller and unlabelled, with the vehicle glyph. They are joined by a solid line, which is 2 px when it is a hose line and a faint 1 px link otherwise. The line is never dashed (§6.2).

---

## Revision 24 Sep 2026 (c): fire and projection display rules

**Supersedes** the projection colour of revision (b) (indigo, hatched, "AI-ENNUSTE · T+20"), and the rule in §3 and §7.2 that the projection has one boundary only. Styling lives in `app/render/ui/fire-theme.json`. Drawing is in `app/render/ui/fire-layers.ts`, and the data is built by `tools/fire-ca/fire-display.ts`.

**Core rule.**
- **Line style is time:** solid means observed, dashed means predicted.
- **Colour is time:** grey is past, red is now, and light red dashed is the AI projection.
- **No blue or purple** in the fire or projection layers. Blue means own forces, and many participants have military training.
- **Never colour alone:** line style, labels and the legend carry the same meaning.
- **Tests:** `test/render/fire-theme.spec.ts` checks the no-blue rule and that the projection is never heavier than the fire edge.

**Past fire.**
- **Earlier perimeters:** the last three reported perimeters, drawn 1 px #8A8178, fading from 90 % to 35 % opacity. Each has a monospace clock label.
- **Burnt area:** the fire as reported one cycle earlier, filled #3A322D at 85 %, with no outline.
- **Severity:** no severity data exists, so there is no severity shading.

**Current fire.**
- **Uncontained edge:** #D62828, 2.5 px, with ticks every 12 px.
- **Contained edge:** #1C1B19, 2.5 px. It is used within the arc secured by the cycle-10 control event, from cycle 11 on, wherever the edge has not moved since.
- **Head fire:** the uncontained edge within 300 m of the observed head, drawn with an orange glow (#FF7A1A, blur 5 px).
- **Burning zone:** what burned since the previous report, filled #6E3A24 at 70 %.
- **Spot fires:** a detached reported fire under 1 ha is drawn as a spot fire: an 8 px red point with a white 2 px ring and a callsign (PP1, …). The ring is dashed when no drone camera covers it (unconfirmed).
- **Drone thermal detections:** sampled hot cells under a drone footprint in the bands burned in the last two cycles. Each cell's age is how far through the band the fire had travelled when it arrived. Colours are #D62828 for under 10 min, #F77F00 for 10–20 min and #FCBF49 for 20–30 min; older detections are not shown.
- **Tick side:** unverified. nwcg.gov refused automated access, so PMS 936 could not be checked. Ticks are drawn on the unburned side, `tickSide: "outside"` in the theme. **Confirm against PMS 936 and change the theme if needed.**

**AI projection.**
- **Isochrones:** T+10, T+20 and T+30 are cut from the same ensemble runs at the same burn share: half the steps, all of them, then 1.5×.
- **Scoring is unchanged:** T+20 is still the scored envelope, and the rebuild reproduces every flag and the T+20 polygon byte for byte. The other two lines add nothing to what is scored.
- **Lines:** #E07A5F dashed 8/6 px, 2.5, 2 and 1.5 px wide.
- **Fill:** the T+30 area only, #F4A6A0 at 15 %.
- **Labels:** "T+10" and "T+20", and "AI PROJECTION · T+30 MIN" on the outermost line, placed at each line's furthest point in the direction of spread.
- **Certainty controls opacity:** likely 100 %, moderate 70 %, uncertain 45 %. Certainty is read from `envelope.certainty` through `projectionCertaintyOf` (confirmed → likely, probable → moderate, uncertain or unknown → uncertain). The AI answer uses the same function when asked about the projection, so the two cannot disagree.
- **`accuracy_label`** (correct, partly or incorrect, derived from the flag) is truth and is stripped at the render boundary.

**Drawing order**, bottom to top:
1. Terrain
2. Burnt area
3. Earlier perimeters
4. T+30 fill
5. Burning zone, head glow, edges, ticks and spot fires
6. Isochrone lines
7. Detections
8. Units

Text labels are DOM markers (the style has no glyphs), so they sit above the canvas.

**Conditions.** In the radio condition (`directed`) there is no projection and no AI legend entry. In the AI condition the projection is always visible, with no toggle.

**Legend.** Bottom-left, with samples drawn from the theme. The wind overlay moved to the top-left.

**Open questions for the researcher.**
1. **Tick side:** confirm it against NWCG, as above.
2. **Horizon mismatch:** T+30 is now the headline projection, but the judgement is still scored against truth at T+20, while the own-estimate prompt asks about 30 minutes. Either score at T+30 (the CA would have to derive flags at 30 min, which changes the canonical flag sequence) or relabel.
3. **Label language:** the projection label is English, as specified, while the rest of the interface is Finnish. `labelOuter` in the theme changes it.
- **Scale bar** (24 Sep 2026): a metric scale bar sits in the bottom-right corner (MapLibre `ScaleControl`, max 140 px). It follows every zoom change and is identical in both conditions.
- **Projection legibility, legend size** (24 Sep 2026, user feedback that the projection read too faintly):
  - **Isochrone widths:** 2.5, 2.25 and 2 px (were 2.5, 2 and 1.5). They still narrow with horizon and are never thicker than the 2.5 px fire edge.
  - **Certainty opacity:** likely 100 %, moderate 85 %, uncertain 65 % (were 100, 70 and 45 %).
  - **T+30 fill:** 20 % (was 15 %).
  - **Halo:** each isochrone gets a white halo 2 px wider than the line, at 80 %. The halo is dashed in the same rhythm, so it never reads as a solid (observed) line.
  - **Colour:** unchanged, so the projection is still less saturated than the fire edge (`test/render/fire-theme.spec.ts`).
  - **Legend:** 10 px text with smaller samples.
- **Projection as arrival-time bands** (24 Sep 2026, user feedback: the projection was too pale to read):
  - **Change:** replaces the single light T+30 fill with three filled bands, 0–10, 10–20 and 20–30 min. Each band is an isochrone minus the one inside it; the first is minus the reported fire. The bands therefore never overlap each other, and never cover the burnt area or the current fire.
  - **Fills:** #E8735A at 45 %, #EF9676 at 33 % and #F4B49B at 24 %, strongest nearest the fire and lighter outward.
  - **Lines:** the isochrone lines are darker, #B8462B, dashed, over a dashed white halo.
  - **Certainty:** still scales every band's opacity.
  - **Weaker than the fire:** the bands stay less saturated than the #D62828 fire edge and lighter than the burnt area (`test/render/fire-theme.spec.ts`).
  - **Why bands:** operational simulators shade arrival time: FARSITE with a yellow-to-red arrival-time ramp, CSIRO Spark with hue-shaded arrival time and isochrones, and WFDSS FSPro with filled probability zones. Cheong et al. (2016, *IJGIS* 30(7), 180 participants) found a bare boundary among the worst encodings under time pressure, and a hue-based one the best.
  - **Scoring:** unchanged. The T+20 envelope and all flags are byte-identical after the rebuild.
- **Projection darkened** (24 Sep 2026, user feedback: easier to recognise):
  - **Bands:** #C8553D at 55 %, #D8745A at 45 % and #E39A80 at 36 %.
  - **Lines and labels:** isochrone lines #9E3A22, labels #7A2616.
  - **Still weaker than the real fire:** less saturated than the #D62828 edge, lighter than the burnt area, and fading outward (`test/render/fire-theme.spec.ts`).
- **Projection as one flowing ramp, outer line only** (24 Sep 2026, after reviewing legibility with the user):
  - **Problem:** the bands are often only 30–80 m wide. Three dashed isochrone lines, each with a white halo, stacked onto the ticked red edge and the grey past perimeters, and the result could not be read. The band colours were also too close to each other to show direction and speed.
  - **Colour:** the bands are now one hue with even lightness steps toward the fire: #BE4A32 at 75 %, #D97A5E at 55 % and #E39A80 at 36 %. Over the basemap these read as about #CB735F, #E4AF9C and #EDD0C3. The 20–30 min colour is unchanged.
  - **Lines:** only the T+30 boundary is drawn, as a thin dashed line (`lineMinutes: [30]`), so "dashed = predicted" still holds. There are no halos, and the T+10, T+20 and T+30 labels stay.
  - **Supersedes:** revision (c)'s "one dashed line per time step". The time steps are now carried by the fill.
  - **For the pilot:** check that the dark 0–10 min band is not confused with the burning zone (#6E3A24). The red edge separates them, but they are both warm and dark.
- **Natural fire outlines** (24 Sep 2026, user feedback: the fire and its spread looked angular):
  - **Cause:** outlines followed the CA's 25 m cell staircase, and the 8-neighbour spread made 45° facets, so fires looked octagonal.
  - **What real fronts look like:** smooth, lobed and roughly elliptical along the wind (Anderson 1983; Alexander 1985). FARSITE and Prometheus draw them as the envelope of elliptical Huygens wavelets.
  - **Fix:** every fire outline in the build (reported, earlier perimeters, burnt area, burning zone, edge segments, envelope, isochrones, bands, drone loop) is resampled at half a cell and Taubin-smoothed: λ 0.5, μ −0.53, 8 passes, reach ±2. This is `FIRE_OUTLINE` in `tools/fire-ca/geometry.ts`. Area changes by less than 1 %, and the line moves by well under one cell.
  - **Small pieces:** in the area layers, pieces and unburned islands under 6 cells (about 0.4 ha) are dropped, because they cannot be rounded and would stay as sharp squares.
  - **Unaffected:** flags come from the masks and are unchanged, and so is the radio traffic. Crews spread along the smoothed edge, so their positions shift by up to 79 m. The deployment rules (road, hose length) still hold.
  - **Basemap unchanged:** it uses the same tracer without smoothing.
- **Readability pass** (24 Sep 2026, after a critical review with the user):
  - **Drone coverage hidden by default.** A drone's sensor footprint and its track, including DR3's loop around the whole fire, read as extra blue dotted fire lines once the outlines were smoothed. They now appear only while the pointer is on that aircraft. A grounded drone is still a visible gap, because its symbol is absent (§6.5).
  - **Basemap without fire colours** (`tools/topo-map/render.py`, re-rendered with `npm run map:render`; the fuel grids and scenario are unchanged):
    - roads are grey instead of MML red;
    - open rock is neutral grey instead of MML pink, which looked like the projection;
    - contours are muted instead of orange-brown.
  - **Each cycle opens on the fire.** The view is centred on the T+30 projection (the reported fire in the radio condition), at the smallest fixed zoom level that shows all of it. It is the same for everyone in a condition.
  - **Labels.** Only the outermost projection horizon is labelled, as "AI-ENNUSTE · T+30 MIN". Fire labels try four positions around their point and take the first one that clears every unit symbol and every higher-priority label (spot fire, then projection, then earlier perimeter); otherwise they are hidden until the view changes.
  - **Drone detections** are hollow rings in the same age colours, so they are not mistaken for the red edge or for filled spot fires.
  - **Earlier perimeters** are #CFC6BA instead of #8A8178. They always lie over the dark burnt fill, where the spec colour was nearly invisible.
- **Seamless projection bands** (24 Sep 2026, user feedback: gaps between the first and second band):
  - **Cause:** the bands were traced and Taubin-smoothed one by one. The outer edge of one band and the hole of the next started as the same cell boundary, but smoothing moved them in opposite directions and left slivers of basemap. Dropping pieces under 6 cells left further holes.
  - **Fix:** the renderer now builds each band from the isochrone lines themselves (`bandFeatures`, `fire-layers.ts`): the T+m area minus the next-inner isochrone (or the current fire, for the first band). Holes are re-wound opposite to their outer ring, because MapLibre classifies rings by winding.
  - **Result:** two neighbouring bands share exactly one ring, with no gap and no overlap, and the colours run straight from one band into the next.
  - **Unchanged:** the precomputed `projectionBands` in the bundle stay for export and tests, but are no longer drawn.

### Amendment 2 Oct 2026: the projection reaches exactly to the next situation

**Researcher decision.** Isochrones are at ½ and 1 of the view's horizon (`ISOCHRONE_FRACTIONS = [0.5, 1]`). Two bands, the outer dashed line and the label "LEVIÄMISENNUSTE · T+20 MIN" (merged views: T+40) end where the next situation begins.

**Why.** The former T+30 band (T+60 in merged views) reached beyond the next view, so every fire looked short of its projection.

**Unchanged.** The envelope and every flag are the same: the horizon snapshot never depended on the extra steps.

### Amendment 2 Oct 2026 (later): only growing parts are drawn; the label sits on the live front

- **What is drawn.** A part of the projection is drawn as a dashed line and bands only when it grows: its area exceeds the fire inside it by more than `growthMinHa` (0.1 ha). From 16:40 the held 100 ha fire no longer gets a dashed line on its edge, so it does not look projected.
- **Where the label goes.** The label goes on the part that grows most, which during the two-fire period is the rekindled front. Before, it sat ~2 km away on the old fire at V10 and V11.
- **When nothing grows** anywhere (V9, the omission), every part is drawn as before: the dashed line on the fire's edge and the usual label. A label of its own in the omission view would cue it, so V8 and V9 stay identical in form. Revised 3 Oct 2026 after review; the first version had an "EI ENNUSTETTUA LEVIÄMISTÄ" label.
- **The rule lives in one place.** `app/render/projection-growth.ts` holds it, and `test/render/projection-growth.spec.ts` tests it. A fire ring counts as inside a projected part when ≥ 90 % of its vertices are inside it or within 30 m of its outline; before, one vertex decided it.
- **Earlier perimeters.** Each earlier perimeter carries one ring per part of at least 1 ha. The rekindled front's 17:20 and 17:40 edges are therefore drawn; before, only the main fire's were.
- **Flags.** No flag changes; this is render-only, apart from the `perimeters_past` rings.

---

## Revision 8 Oct 2026 (y) — rate marks are not drawn on the map

Researcher decision, 8 Oct 2026. **Supersedes §5.1–§5.3 as a rendering rule, §9's "Rate marks" column as something the participant sees, the cycle-18 two-mark contradiction of §9 (row 18) and the paragraph "Cycle 18 is worth a second look", and §11's rate-mark tests.**

- **Not drawn.** No rate mark is rendered on the map, in any cell or view. The render tree does not read `rateMarks`. The observed rate reaches the participant only through the records: the pushed reports, and the Haku and Thinker answers over them.
- **Still built, truth-side.** `buildRateMarks` (`demo-map.ts`) still builds one head mark per view (and per merged view's second step, `StepBoundary.rateMarks`) for the transcript and the analysts' review. Its §9 rules are kept as data rules only:
  - no head mark at step 6 (the crown run started between reports; the step-6 crown run of 38 m/min is accepted, `24` revision (y));
  - at **step 9**, no drone is up, so the head mark is **HELI1's eye estimate, a band: "noin 5–10 m/min, arvio" / "about 5–10 m/min, estimate"** (`rateBand`, `rateMarkText`). It replaces DR1's 40-minute-old reading (fix pass 4, M1, 7 Oct 2026). The same figure, as a band marked as an estimate, is what HELI1's report says.
- **Withdrawn: step 18's two-source marks on the map.** The north flank's two current marks (EK14 0.5 m/min, SPOT 6 m/min) are no longer "the contradiction, visible on the map as two marks". The step-18 contradiction (H3) now rests on the records alone: EK14's and SPOT's reports in the message log and the database. `buildRateMarks` still emits both marks truth-side, for audit only.
- **Why.** A drawn rate mark beside the envelope did the comparison that the freeze items measure, and its absence at step 6 was itself a cue. Sectors are not drawn either (`16` revision (y) §y.6).

---

## Revision 8 Oct 2026 (aa) — the projection label in English sessions

The label on the outermost isochrone is, in Finnish, "ennuste voimassa klo HH:MM saakka" (§4, `projectionValidityLabelFi`). In an English session it reads **"forecast valid until HH:MM"** (`projection-validity.ts`, the horizon's clock; `fire-layers.ts` draws it on a second line). Nothing else in this document changes: the rate marks stay undrawn (revision (y)), the sectors stay undrawn, and the projection looks the same in every cell.

---

## Revision 9 Oct 2026 (ah) — bands off the burned ground, edge casings, the quiet edge, the Fire zoom

Map-display review, 9 Oct 2026. Styling stays in `fire-theme.json`; the rules of revision (c) hold (solid = observed, dashed = predicted; no blue or purple; never colour alone).

- **Bands are a true difference (F1).** Each arrival-time band is its isochrone minus the current fire — perimeter, detached fronts, burnt area and burning zone — and minus every inner isochrone, computed as a polygon difference (`projectionBands`, `app/render/polygon-ops.ts`). Before, the fire was cut out only when the fire ring's first vertex lay inside the isochrone; that vertex (the origin) lies outside the smoothed isochrone in V1–V5 and on the detached front in V10–V14, so the first band (#BE4A32) was painted over the burned area and the burning zone, and burned ground read as "burns within 10 min" (V6: the detached fronts' holes crossed the isochrone's outline, which MapLibre's triangulation cannot draw). `test/render/projection-bands.spec.ts` samples every view, the practice view included. Consequence: where the projection only traces the fire's edge (V9, the omission) no band remains, only the dashed outer line — as the geometry says.
- **Casings (F6).** The contained edge (#1C1B19, 2.5 px) is drawn over a light casing (#F4F1EC, 5 px); the black line was invisible over the #3A322D burnt fill.
- **Quiet edge.** A `perimeter_current` part with status `"inactive"` (not spreading, no crew on it) is drawn solid mid grey #8C857C, 2 px, over a light casing (#F4F1EC, 4.5 px): neither the red of a spreading edge nor the black of a contained one, darker and wider than the earlier perimeters (#CFC6BA, 1 px). No ticks, no glow. Legend: "Hiljainen reuna (ei leviä)" / "Quiet edge (not spreading)". Any other status string draws nothing.
- **Head glow.** #FF9F1C, 13 px, blur 4, 95 % (was #FF7A1A, 9 px, blur 5, 85 %): over the projection band the old glow could not be seen.
- **Legend.** Adds the burning zone and the head, and shows the contained and quiet edges on a strip of burnt fill, as on the map. Drawing order: burnt area · earlier perimeters · bands · burning zone · head glow · quiet edge (casing, line) · contained edge (casing, line) · uncontained edge and ticks · spot fires · isochrone line · detections.
- **Labels** try eight more placements, avoid the wind box, the zoom buttons, the legend and the scale bar, and stay inside the map (the projection label was hidden in V5 and sat under the zoom buttons in V6).
- **The Fire zoom (F10)** frames the active fire: the uncontained edge and the main pieces of the bands (pieces of at least 0.2 ha and 5 % of the band area); when the projection grows nowhere (V9), the whole fire and its projection (`app/render/fire-frame.ts`). It is fitted inside the map clear of the overlays, at any width between the Sector (2 km) and Area (20 km) levels, and re-fitted when the map's size changes until the participant moves the map; Area and Sector then centre on the same frame. Before, the fixed 6 km level was centred on the projection's main polygon: at 1280×529 the head or the origin fell off the map, and from V10 on it centred on the held old fire. The framing depends on the window size, as before.
- **Layout.** The map keeps at least 300 px of height and the column under it scrolls (a situation question and the allocation together had squeezed it to 99 px at 1280×529); below 1000 px of window width the right column goes under the map. A "loading the map" note covers the map until MapLibre's first `idle` (at most 20 s); the memory-check map takes no tap until then, so its item cannot be completed before the participant has seen the basemap, and its card no longer shrinks under the map, so the confidence buttons are never over it. The period countdown is hidden once the view's time has run out.

---

## Revision 9 Oct 2026 (aj) — the camera never moves by itself

Researcher decision, 9 Oct 2026: "Do not zoom to the certain fire points. The user needs to notice themselves and zoom to the correct position." **Supersedes revision (ah)'s "The Fire zoom (F10)", `23` §8's *Palo* row ("the whole fire, default") and `15` r.12's addendum "framing the freeze map".** This is a situation-awareness study: a camera that goes to the fire's active edge, a spot fire or a flare-up tells the participant where to look, and in V13 the (ah) framing put the north-edge flare-up US2 — the planted contradiction — in the frame on every screen.

- **No automatic camera move, anywhere.** A new view, an event, a spot fire, a flare-up, a unit's click: none of them moves the camera. The live map's snapshot effect updates the layers only; `app/render/fire-frame.ts` (the active-fire framing) is removed, and nothing on the map reads the view to place the camera. After the participant has moved the map, only the participant and the preset buttons move it.
- **One neutral opening frame.** The live map opens on the scenario's extent — the study area, about 7 × 7 km around the ignition (`scenario.extent`), fitted whole inside the map with 16 px clear on every side (`extentCamera`, `app/render/map-frame.ts`): the extent's centre, at the zoom where both its width and its height fit. A wide map shows basemap beyond the extent's east and west, a tall one beyond its north and south; nothing inside the extent is ever cut off, so everything drawn is on screen for everyone at the start, whatever the window's shape. The frame reads nothing from the view, so it is identical for every participant and every view at a given map size; it follows the map's size (the decision strip, a situation question, the tour closing) until the participant first moves the map. Chosen over a per-view reset to the same frame because a reset would itself be an automatic move that undoes the participant's own placing at the moment a new view arrives; and over a fixed 6 km width because that cuts the extent's north and south on a low window and not its east and west, which would make the direction of a cue depend on the window's shape.
- **Presets.** *Alue* / Area and *Lohko* / Sector set a fixed ground width (20 km, 2 km) about the participant's own current centre; they no longer centre on the fire. *Palo* / Fire returns to the opening frame, the whole study area — not the fire's bounds, a spot fire or the active front. The labels and the level ids are unchanged.
- **The memory-check map (`FreezeMap`)** opens on the same extent, in a square box (the study area is square), so the frame points at no answer and the map fills its box: the fire-as-reported frame of `15` r.12, fitted by height into a wide low box, had shown black bands beyond the basemap at the sides (V14 at 1280×529). The participant may still zoom in and pan, never further out than the opening frame; `freezeMapFrame` is removed. `test/session/freeze-map-frame.spec.ts` checks that every map key lies inside the extent with its tolerance to spare.
- **Tests:** `test/render/map-display.spec.ts` (the frame, the pan limit, the presets, the source of both maps: no `fitBounds`/`cameraForBounds`/`flyTo`, every `jumpTo`/`easeTo` reads nothing from the snapshot).
- **Consequence to watch in the pilot.** At the opening frame the practice fire (100 m) is a few pixels; the guided tour's "fire" step points at that small box. The participant zooms in; a tour wording that says so can follow if the pilot shows it is needed.

**Addendum (aj), 9 Oct 2026 (researcher):** every view starts from the same place. When a new view opens, the live map returns to the "Fire" (Palo) frame, the opening frame of the whole study area, whatever the participant did in the view before. Within a view nothing moves the camera but the participant and the presets. The reset depends only on the view index changing, never on what the view contains (MapView `viewRef`; test/render/map-display.spec.ts).

## Revision 10 Oct 2026 (al) — the basemap after the map review panel

Researcher's approval of the map review panel's recommendations, 10 Oct 2026. **Tiles only**: everything below is drawn by `tools/topo-map/render.py` from `content/site/build/topo-features.json` (`ponds`, `clearings`, `powerCorridorPx`, written by `tools/topo-map/build.ts`). None of it enters the land cover or the fire model's grids (`content/site/*.asc` are byte-identical in content; the CA is not re-run on new terrain), and the tiles still carry terrain only — the labels, grid, sectors and road/water-point names of the live map are `map-overlay`'s, drawn on the live map and never on the FreezeMap.

- **Farm pond at W2** (Lahdenkylän lampi): a pond of r ≈ 35 m, its centre 40 m north of `POND_W2` (2250, −2250), so the water point is on its south shore, 60 m from the main road (vesialue fill, shoreline). Not in `landCover()`, so no record's ground type changes (EK13 at W2 is still "Ajoneuvo maantiellä/soratiellä", never on water).
- **110 kV line**: a heavier line (2 px) with a cross tick and a pylon dot every 250 m (a 110 kV span), on its **36 m cleared corridor**, drawn as open ground under fields, mires and water (the fire model has had the corridor since `24` §11 as `cleared_corridor`).
- **Log landing** at the R2 / Honkaharju forest-road junction (`R2_FR`, EK16's safety zone): 60 × 40 m of open ground in the junction's south-east corner, thin outline.
- **Mire hatching and ditches lighter and thinner** (vaikeakulkuinen suo: (150, 210, 236), 1 px, was (61, 182, 223), 2 px; ditches (88, 160, 212), was the legend's (0, 113, 187)), so the blue unit markers do not fade into Rahkasuo.
- **Not drawn**: the origin's clear-cut (researcher: it would cue the rekindle site).
- §9's cycle-5 row no longer promises a stand "reference layer"; none exists.
- `render.py` runs its numpy passes in strips of 1000 rows (same arithmetic; peak memory, not the picture, changed). Deterministic: a second run writes the same bytes (checked on `topo/1_2.webp`).


---

## Revision 10 Oct 2026 (al) — map use logged, unit declutter, US2's label, the reference overlay, the legend

Map review panel, recommendations approved by the researcher, 10 Oct 2026. The rules of (aj) hold: the camera never moves by itself, every view opens on the Palo frame. Nothing new is drawn on the memory-check map (`FreezeMap` shows the plain basemap only); nothing on the live map changes with the view, highlights a change, carries a "new" badge, gives a fire a minimum size or labels a particular edge or spot; no safety zones, escape routes or fuel shading.

- **Map use is logged (`07` revision (al)).** `viewport_changed` is emitted at last: throttled to 4 Hz while the map moves and one record when it settles (centre, zoom, bearing 0, the map's pixel size, the visible bounds, the view, the cause and what moved it: wheel, drag, touch, keyboard, a preset, the frame), one at each view start (the map's size then) and one on a resize (`app/render/viewport-log.ts`). Free zoom by wheel, trackpad and pinch stays on (decision) and is logged that way; double-click zoom, box zoom and rotation stay off. Pointer on a unit marker or stack badge: `element_enter` / `element_leave` / `click`. The memory-check map logs each tap with its zoom, centre and size (`freeze_map_pick`); the live map logs which fire labels are shown whenever that set changes (`map_labels_placed`). Regions of interest for the analysis (`09` revision (al)) are data, `app/render/map-rois.ts`: US2 at V13, the origin's south edge at V9–V10, the head at V4–V6. Nothing on the map reads them.
- **Unit declutter (`app/render/unit-declutter.ts`, `app/render/ui/unit-stacks.ts`).** At the Palo frame one pixel is 10–17 m, so five or six markers on one stretch of edge sat on each other and their labels ran together ("VD1 L1 21 15"). Deterministic, in an order fixed by the markers' keys and screen positions only: markers that overlap within 180 m of a stack's first marker form a **stack badge** — the count in a double own-forces frame, the members' call signs under it — placed at the middle of its members; pointing at it fans the members out on a ring, each with a leader line to its true position. Remaining overlaps are pushed apart, each marker at most 200 m from its true position (a badge only as far as keeps every member within 200 m); a marker drawn off its point gets a leader line. Overlaps still left are merged into a stack when that keeps every member within 200 m of the badge. Markers also move off the spot-fire symbols. Re-run after every settled move and every data change; zoomed in, stacks open up by themselves. Tested: every displayed marker or its badge stays under 200 m of the true position in every view at six map sizes; the layout does not depend on input order; 3069 overlapping pairs across the views and sizes fall to 82 (a line of crews along R2 at V13–V14 is longer than 200 m of offset can spread at that zoom).
- **US2's label (`app/render/label-placement.ts`).** Spot-fire labels never yield to unit markers and are drawn above them (z-order: overlay labels < units < fire labels < spot labels < a hovered unit); other labels keep clear of the units. Tested: V13's US2 label is placed at the map sizes of a 1280 × 720 and a 1280 × 529 window, with and without the right column, and at every map size from 800 × 300 to 1280 × 720.
- **Minimum window size.** Below 1100 × 500 a cover asks the participant to enlarge the window (fi/en, `WindowSizeGuard.tsx`); the session is not paused; shown and removed are logged (`window_size_warning`). 1280 × 529 is above it.
- **Earlier-perimeter times** sit on their own line: each takes the first free point among fixed bearings about the spread direction (0, ±25, ±50, ±75, ±100°), centred on its ring, so the times read in time order outward (V9 had shown "16:40 / 17:00 / 16:20" around one point). Rings that run together where the label goes (the fire stood still: V9's 16:20 and 16:40) share one label in time order, "16:20 · 16:40".
- **Own units over blue terrain:** a white casing round every unit frame and a dark pill with a light outline under each call sign.
- **Reference overlay, live map only (`app/render/ui/map-overlay.ts`; data `app/render/ui/map-overlay.json`, written at build time by `scripts/build-map-overlay.ts`).** A faint 1 km ETRS-TM35FIN grid (no numbers); road labels R1, R2, R3 (west and east); the R3 bridge, "R3:n silta (Kotkanjoki)" / "R3 bridge (Eagle River)" — the name the records use, never a load limit (the limit is V14's key and first on record at 18:20); the water points W1–W3 (a dark droplet and the id; W3 on the west bank, map-tiles (al)); "110 kV" along the power line, never its state; the command post as an own-forces flag, "JP" / "CP". No label lies within 600 m of US2 or 400 m of the old fire's north edge (tested).
- **Sectors L1–L4** are drawn from VP on, in every view alike: neutral grey (#5F646B) dashed outlines and the codes only, 2.6 km from the ignition towards each sector's middle (`site-scenario.json` `sectors`). Supersedes revision (y)'s "sectors are not drawn either" (and `16` (y) §y.6) for the map.
- **The region's other fires** (`regionFires` in the scenario export, map-tiles (al): Kuikkalammen palo ~8.8 km NW, Kaitajärven palo ~8.4 km E, consistent with DR3's 17:59 text) are small dark-red diamonds with name and size, shown only at the widest zoom: at or beyond the Area level and wider than the Palo frame, so never on the opening frame at any window shape.
- **Legend:** two columns, collapsible (open at the start for everyone; the toggle is logged as `layer_toggled`, `layerId: "legend"`). The second column, "Yksiköt ja kartta" / "Units and map": own unit, crew on foot and vehicle, hose line, a stack of units, aircraft (track and footprint on pointing), sector boundary, water point, command post, road, power line, water, the 1 km grid, another fire in the region.
- **The "Lohko" / "Sector" button reads "2 km"** in both languages (it named no sector); the level id stays `lohko`. The practice tour's zoom step says so and asks the participant to zoom in to see the fire (thinker-v2, `ui.ts` tour texts).
- **Tests:** `test/render/{unit-declutter,label-placement,map-overlay,map-display}.spec.ts`, `test/telemetry/map-use.spec.ts`.
- **Open:** the marker and label sizes in the tests are modelled from the CSS (10 px monospace, the overlays' boxes); a pilot screenshot pass at 1280 × 529 and 1920 × 1080 should confirm them. The grid has no coordinate numbers. The cover below 1100 × 500 does not pause the clock.

---

## Revision 10 Oct 2026 (am) — a closer opening frame, no water points, a quieter map

Researcher, after looking at revision (al) at a 1280 × 529 window (map ~920 × 420 px): "Each scenario should start from a closer look, a little bit closer than the Fire view. We should not point out where the water-taking places are immediately. The units and the map [overlays] are making the map visibility too small. Remove the unnecessary things from the legend and then from the map if needed." The rules of (aj) and (al) hold: the camera never moves by itself or toward anything the scenario knows; the stimulus is identical for every participant at a given window size; nothing new on the memory-check map (`FreezeMap` keeps the whole extent and the plain basemap); every map-use record stays.

- **Opening frame: a fixed 5 × 5 km box** about the extent's centre (the ignition), contain-fitted into the map with the 16 px margin (`app/render/map-frame.ts` `OPENING_BOX_M`, `boxAroundCentre`, `openingCamera`). Every view (VP, V1–V14) opens on it and returns to it at its start; it follows the map's size until the participant moves the map, as before. It reads only the extent. The **"Fire" / "Palo" button still shows the whole ~7 × 7 km study area** (`extentCamera`); no preset button is lit on the opening frame. `viewport_changed` with cause `view_start` logs this frame (`07` (am)). Per-view check (tested, `map-display.spec.ts`): the furthest point of any view's fire layers and spread projection (perimeters, burnt area, burning zone, spot fires, detections, the envelope and its isochrones) from the centre is ~2.26 km on one axis (V7–V14's north edge and projection; VP ≤ 0.13 km, V1–V4 ≤ 1.1 km, V5–V6 ≤ 2.2 km), inside the box's 2.5 km half-side, and every such point is on screen, 16 px clear of the edge, at 920 × 420 and at the 300 px minimum height. No larger box was needed. At 920 × 420 the scale is ~12.9 m/px (was ~18).
- **Water points removed from the map and the legend.** The W1–W3 droplets and ids are gone from the overlay; the W2 pond stays as terrain in the tiles; the water points are named only in the radio texts.
- **1 km grid removed** (nothing in the session refers to grid squares; it added lines over the fire). `map-overlay.json` still carries the build's grid data, unused.
- **Legend:** starts **collapsed** for everyone, a small "▸ Selite" / "▸ Legend" button; the participant's toggles are logged as before (`layer_toggled`, `layerId: "legend"`). The practice tour's legend step shows it open while that step is on screen (`tour.ts` `announceTourStep`; identical for everyone, not logged as a participant toggle). Open, it is **one compact column listing only the symbols drawn now** (`legendPresence`): the view's fire symbols present (earlier perimeters, burnt area, burning zone, uncontained edge, head, contained and quiet edges, confirmed and unconfirmed spot fires, detections), the projection once revealed, own unit, crew–vehicle and hose line when a crew works away from its vehicle, a stack when the current camera draws a badge, aircraft when airborne, sector boundary, road and power line always, another fire only when the widest zoom shows one. Removed rows: water point, command post, basemap water, grid. It scrolls rather than grow past the map's height less 92 px.
- **Units:** at the opening frame (wider than 3.5 m/px, `unitLabelsShown`) markers are **compact** — a 16 × 12 frame (vehicle 12 × 9), no call sign; the call sign and task are in the hover card — and stack badges show the count only (members fan out on pointing, as before). From about the 2 km zoom on, the full 24 × 18 markers with call signs and badge member names return. Markers and badges are also **pushed off the fire's uncontained edge** (head included) within the same 200 m cap, with a leader line to the true position (`unit-declutter.ts` `fixedLines`, `pushOffSegment`): across V5–V14 and the six test map sizes the edge samples under a drawn marker fall from 604 to 77, and overlapping markers from 1107 to 1. Spot-fire symbols stay fixed obstacles, and spot labels still never yield to units (US2's label placed at every map size from 800 × 300 to 1280 × 720, tested at the new frame). The fire's canvas layers cannot be drawn above DOM markers, hence the push.
- **Overlay text smaller:** road ids, the bridge name, "110 kV" and the sector codes at 9 px (were 10–11). The **command post** stays (the sector descriptions and a memory-check item refer to it) but its flag and "JP" / "CP" now sit up and left of the point (`CP_OFFSET_PX`), clear of the R1 label ~300 m east and of a unit staged on the point (V7–V10), tested at the opening and Fire frames.
- **Wind panel** compact: a 36 px rose and two text lines (was 52 px and three).
- **Tests:** `test/render/{map-display,map-overlay,unit-declutter,label-placement}.spec.ts`.
- **Open:** a pilot screenshot pass at 1280 × 529 should confirm the compact markers read on the basemap; whether the legend's tour opening needs a sentence in the tour text ("open it with the button") is left to the tour owner.

---

## Revision 10 Oct 2026 (ap) — the memory-check map fills its card and opens on the live map's frame

Researcher, 10 Oct 2026: on "Mark the head of the fire on the map" the map showed really small. Measured at 1280 × 529: a 210 × 210 px square (the box was square and capped at `clamp(200px, 40vh, 360px)`, so never above 360 px even on a large screen) showing the whole 7 × 7 km study area.

- **Size** (`FreezeMap.tsx`): the map fills the card, full width and the height left under the question, at least 200 px (1189 × 237 at 1280 × 529; on a ~1920 × 950 window about 700 px high). A map item's confidence row moved beside its question (`FreezeScreen.tsx`) to give the map the height; option items are unchanged.
- **Frame:** opens on the live map's opening frame, the fixed 5 × 5 km box about the extent's centre (`openingCamera`, revision (am)) instead of the whole extent; zooming out is allowed as far as the whole study area. Still content-independent (revision (aj)): the frame reads nothing from a view and points at no answer. Every map key of every freeze lies a tolerance inside the box (`test/session/freeze-map-frame.spec.ts`).
- **Pan and zoom limit:** the basemap itself (~20 × 20 km, from the tile corners) instead of 12 km from the centre, so a wide, low box never shows black beyond the basemap: MapLibre zooms in as far as needed. On a very low window the 5 km box's north and south edges can then fall just outside the view; the participant pans or zooms out.
- **Checked in the browser** (demo session, English, `reasoning_intent`, 1280 × 529): practice + all seven freezes (46 items, 9 map picks), the five situation questions, the directive check and the V13/V14 after-view probes; no console errors. Found, not changed: at this height the directive check's and the V14 after-view item's last option sits at the panel's bottom edge and needs a scroll.
