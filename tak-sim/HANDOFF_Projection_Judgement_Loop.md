# Build brief — the projection judgement loop

**For a build session with no prior context. Self-contained; read it all before writing code.**

Kalle Koivunen, LUT University · 17 September 2026 · derived from `SPEC/08` §3.2, `SPEC/12`, `SPEC/03` §9

---

## 1. What you are building, in five sentences

A researcher is running a controlled experiment on wildfire incident commanders. They sit in front of a map of a scripted fire, and once per cycle a machine shows them a **projection** — a polygon saying where the fire will be twenty minutes from now. The experiment measures whether the commander can tell when that projection is wrong, and how confident they are while getting it right or wrong.

This brief covers **one slice**: the moment the projection appears and what the participant does with it. That slice is the primary dependent variable of the entire study. Nothing else in the system matters as much.

---

## 2. The one thing that must not be broken

> **The participant's response is collected three ways. The binary is derived in analysis, never collected in the interface.**

A tempting simplification is a yes/no button — *will it hold?* — because the statistics eventually want a binary. Do not build that. A three-way response can always be collapsed to a binary afterwards. A binary can never be expanded back, and the collapse loses the two measures the study is actually distinctive for:

- **false rejection** — the participant says the projection is wrong when it was right
- **relative accuracy** — when the participant overrode the machine, was their own answer better than the machine's?

If you build a binary, those two measures do not exist, and nobody will notice until analysis, by which point every session has been run.

---

## 3. The loop

One cycle of the scenario. The clock is a **virtual** clock — scenario time, twenty minutes per cycle — that runs during the working period and **halts** for every step from the reveal onward.

```
  working period          clock RUNNING
      ↓                   reports arrive; participant reads, queries, asks units
  [some cycles] expectation marking      clock HALTED, map VISIBLE
      ↓                   "mark where you expect the fire to reach" + confidence
      ↓                   — happens BEFORE the reveal, and only on scheduled cycles
  PROJECTION REVEAL       clock HALTED, map VISIBLE
      ↓                   the envelope polygon appears with its validity horizon
  JUDGEMENT               clock HALTED, map VISIBLE      ← this brief, §4
      ↓                   three-way response
  CONFIDENCE              clock HALTED, map VISIBLE      ← §4.3
      ↓                   0–100
  FOLLOW-UP               clock HALTED, map VISIBLE      ← §5, branches on the judgement
      ↓
  VERIFICATION WINDOW     clock HALTED, tools available
      ↓                   participant may query, then may REVISE the judgement
      ↓                   a revision is a NEW record, never a mutation
  (other probes)
      ↓
  ALLOCATION              clock HALTED
      ↓                   assign formations and assets, plus a free-text rationale
  cycle end               clock advances twenty virtual minutes
```

**The map stays visible throughout this whole sequence.** Some other probes in the study blank the display; these do not. Judging a polygon you cannot see is not a judgement, it is a memory test. Blanking is a property of an individual probe, declared in the scenario data — never a property of the halt.

---

## 4. The judgement

### 4.1 The response

Three options, always in this order, never randomised:

| id | Finnish label (placeholder — a native reviewer will rewrite) | Meaning | Follow-up |
|---|---|---|---|
| `holds` | *Ennuste pitää* | The fire will stay inside this envelope | none |
| `partly_wrong` | *Osittain väärä* | Broadly right, but it breaks somewhere | mark the breach **point** |
| `fundamentally_wrong` | *Perustavasti väärä* | This does not describe what will happen | **draw your own projection**, then §5.3 |

The distinction between the middle and bottom options is the design's core and must survive into the wording. `partly_wrong` means *the shape is roughly right and it fails at a place I can point to*. `fundamentally_wrong` means *the shape is wrong; here is what I think happens instead*. If participants cannot tell those apart, the measure degrades — this is the single most important thing to test in pilot.

### 4.2 What must be on screen while they answer

The envelope polygon, one boundary, crisp stroke, flat low-opacity fill. **Never a gradient and never nested probability bands** — with three nested bands "the envelope" has no referent, different participants judge against different lines, and the dependent variable becomes uninterpretable. This is settled and is not a matter of taste.

The validity horizon as text: *ennuste voimassa klo 15:05 saakka*.

The envelope's own certainty, carried on the **stroke** (solid / light / dashed / dashed-plus-badge for confirmed / probable / uncertain / unknown) — not as area shading.

The last reported fire perimeter, in a **different hue from the envelope**. The participant must never confuse what was observed with what was projected. That confusion is the study's subject matter; the display must not cause it.

The participant's own expectation marking, if they made one this cycle.

### 4.3 Confidence

0–100 slider, immediately after the judgement, before the follow-up.

**Log every movement, not just the final value**, throttled to 10 Hz while dragging plus a settle record. Hesitation and reversal on a confidence scale are informative and are invisible if only the endpoint is stored. Do not start the slider at a default that biases — start it unset and require an explicit interaction.

---

## 5. The follow-up — where the interesting data is

### 5.1 `holds` → nothing

Move to the verification window.

### 5.2 `partly_wrong` → one point

The participant clicks a single map point where they think the envelope breaks. Store the coordinate. Scored in analysis as distance to the nearest actual breach — or, if no breach occurred, recorded as a **false rejection with an unanchored mark**.

### 5.3 `fundamentally_wrong` → draw, *then* choose

Two steps, in this order, and **the order is the design**.

**Step one — draw.** A polygon tool on the map. The participant draws where they think the fire will actually be at the horizon. Cap vertices (12 is plenty), allow undo, allow restart, do not allow submission of fewer than 3 vertices.

**Step two — choose.** *Only after the drawing is committed*, present a short list of candidate developments and ask which best describes where the situation is going. These are not invented at runtime: they are the scenario's **authored counterfactual branches** (the study already requires at least five), phrased as short Finnish statements, plus one fixed final option:

```
○  Palo kiertää harjun pohjoispuolelta ja pysähtyy tielle
○  Latvapalo jatkuu kaakkoon, nopeus kasvaa
○  Palo hidastuu pinnalla mutta jatkuu syvällä
○  Uusi syttymä leviää erikseen luoteeseen
○  Ei mikään näistä          ← ALWAYS present, ALWAYS last
```

Both the drawn polygon and the chosen branch are kept. They answer different questions and the disagreement between them is itself a measure.

### 5.4 Why draw before choose — do not reorder this

**Drawing is generative; choosing is recognition.** They are different cognitive acts, and the study's mechanism hypothesis is specifically about a generative act. If you show the list first, the participant reads the options, recognises one, and draws it — and you have measured recognition while believing you measured generation.

**The list would otherwise destroy the study's hardest measure.** One cycle in the scenario carries a deliberate *omission*: something happens that no envelope ever represented — not "further in the same direction" but a possibility that was never on the map at all. The study wants to know whether anyone notices that a possibility was missing. Hand the participant a menu before they have committed to their own answer and you have handed them the omission. Generate first, and the menu becomes a second, independent question rather than a hint.

**`Ei mikään näistä` is load-bearing**, for the same reason. At the omission cycle it is the correct answer. Remove it and you force everyone into a wrong option; make it optional and a builder will drop it as clutter.

### 5.5 What the pairing gives you

| Datum | What it supports |
|---|---|
| The drawn polygon | Relative accuracy — was the human's override closer to the truth than the machine's projection? The most interpretable single number the study produces |
| The chosen branch | Categorical, identical across participants, and it links straight to the pre-computed allocation viability table (allocations are already scored against every branch) |
| Drawn vs chosen agreement | A participant who draws one development and selects another is incoherent at the moment of rejection — diagnostic, and available from no other measure |
| Chosen branch vs subsequent allocation | **Doubt–action coherence.** Did the stated doubt change the decision, or did they reject the projection and then allocate as though it were right? |

That last row is the measure the researcher most wants and it is computed entirely from records you are already capturing plus the authored viability table. Nothing extra is needed at runtime.

---

## 6. Revision

After the follow-up, the verification window opens: tools become available, the participant may query or ask a unit, and **may change their judgement**.

A revision is a **separate log record** (`containment_judgement_revised`), never an edit of the original. Both stand. The revision rate, and what happened between the two, is an analysis of its own.

---

## 7. Scoring — build none of it

**The runtime must not score anything.** Not accuracy, not distance, not overlap, not correctness of the chosen branch. Two reasons: a runtime that knows the answer can leak it into a subsequent probe, and a log that contains the answer key cannot be shared with collaborators.

Ground truth lives in the scenario bundle behind a type boundary and is stripped before anything reaches the render layer. The runtime's job is to record what happened, precisely and completely.

For context only — this is what analysis will do, and it tells you which fields must exist:

| Case | Scored as |
|---|---|
| `holds`, envelope held | Correct acceptance |
| `holds`, breach occurred | Miss — graded by whether the breach was quantitative or categorical |
| `partly_wrong`, breach occurred | Distance from marked point to nearest actual breach |
| `partly_wrong`, no breach | False rejection; the mark has no referent |
| `fundamentally_wrong`, categorical breach | Correct rejection + correction quality (overlap, and containment of the actual perimeter) |
| `fundamentally_wrong`, envelope held | False rejection with a substituted projection — correction quality still scored; its distance from the outcome is the cost of the rejection |
| Any rejection | Relative accuracy: was the correction closer to the outcome than the envelope was? |

---

## 8. Telemetry for this slice

Every record carries a gapless sequence number, virtual time, and a wall-clock offset used only as annotation.

```
envelope_revealed              cycle, envelope id            ← the latency zero
probe_presented                probe id, mode, options
probe_option_hovered           which option, when
probe_answer_changed           from, to                      ← every change pre-submission
confidence_slider_moved        value, timestamp (10 Hz + settle)
containment_judgement_submitted  judgement, confidence, breachPoint? | correctedPolygon?
corrected_projection_drawn     polygon, vertex count, drawing duration
branch_selected                branch id (or "none_of_these"), selection latency
branch_option_hovered          which, when                   ← consideration before commitment
containment_judgement_revised  full response again, distinct kind
allocation_submitted           assignments + free-text rationale
```

Latency is meaningless without a defined zero, which is why `envelope_revealed` exists as its own record. **Derive nothing at runtime** — no dwell times, no computed latencies. Store the raw pairs; analysis computes from them. A derived value stored at runtime makes an analysis bug permanent.

---

## 9. Edge cases — decide these now

**Degenerate polygons.** A two-vertex scribble, a polygon covering the whole map, a breach point in the middle of a lake. **Accept, log, and move on.** Do not validate the participant's judgement. A rejection the interface refuses is a measurement that never happened, and "the participant drew something absurd" is itself data.

**Abandonment.** If they open the polygon tool and close it without drawing, log that. Same for an unanswered branch list.

**Back-navigation.** Once the judgement is submitted, they cannot un-submit — only revise, which creates a new record. Make that clear in the interface before the first submission.

**Resume.** If the session is interrupted mid-cycle, the cycle replays from its start on resume and the interruption is logged as a fault span. Resuming mid-judgement is not supported; do not try.

**Determinism.** No `Math.random()`, no `Date.now()`, no `crypto.randomUUID()` anywhere in this path. Option order is fixed. Ids derive from a seeded hash. The same inputs must produce a byte-identical log on any machine.

---

## 10. Do not build

No probability bands, gradients, or nested envelopes — §4.2.
No time-of-arrival isochrones beyond the single horizon: showing +40 min leaks information about the next cycle's judgement and breaks the independence the analysis assumes.
No animation of the fire. The perimeter redraws at cycle boundaries and holds still.
No machine-suggested correction, and no machine-suggested allocation. The machine projects; it never recommends. An arrow saying where a unit should go would convert doubt–action coherence into a compliance measure.
No feedback about correctness, ever, during the session.
No language model anywhere in this path.

---

## 11. Open for this slice

**The branch statements themselves** — five or more short Finnish phrasings of the authored counterfactuals, per cycle. Not written. They must be roughly equal in length and specificity, or length alone will predict selection.

**Whether the branch list appears on every rejection or only on `fundamentally_wrong`.** The brief above says only the latter, which keeps `partly_wrong` cheap. Worth testing in pilot: extending it to `partly_wrong` would give branch data on roughly twice as many cycles, at perhaps ten seconds each.

**Time budget.** Currently 40 s for a `holds` cycle, 60 s for a rejection with correction. Adding the branch choice pushes a rejection toward 70–75 s. Across ten rejection cycles that is two minutes added to a session already near 100 minutes. Confirm against the fatigue budget in pilot.

**Wording of the three options** — the `partly_wrong` / `fundamentally_wrong` distinction. Pilot-critical, per §4.1.
