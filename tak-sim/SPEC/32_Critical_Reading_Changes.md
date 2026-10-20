# 32 — Changes after the critical reading of 20 Oct 2026: plan review at commitment, SDT analysis, trust calibration, validation

**Status:** Governing from 20 Oct 2026 for what it names. Where it conflicts with `30`, `09`, `08` or `07`, this document wins; each carries a revision note pointing here.
**Scope:** the changes adopted after the critical reading of two AI-generated documents ("Measuring Stealth Metacognition", a Gemini chat; "Human-AI Decision-Making PhD Research", a deep-research report) against arXiv, PsyArXiv, PubMed, Scholar Gateway and Consensus searches (20 Oct 2026); what was rejected and why; the work packages and their acceptance.

> **Changelog**
> - **20 Oct 2026** — created. Researcher instruction of 20 Oct 2026: "read all the suggestions, create a plan what to fix and how, then fix them". Every change below is DRAFT until the pilot; the RC items in §8 stay the researcher's.

---

## 1. What the reading concluded

- **Keep the measures.** SAGAT freezes with confidence (own SA), SPAM with the tools (team SA), the told split and source memory measure what the study asks. No source found validates log-based SA against SAGAT or SPAM; logs are an addition to be validated (§6), never a replacement.
- **Keep the guide non-recommending.** Recommendation-driven AI moved participants' decision criterion at equal accuracy (Benk & Miller 2026); reasoning traces raised trust, not performance (Fernandes et al. 2026); wrong LLM recommendations were accepted 73.9 % of the time (Surdilla et al. 2026).
- **Keep every participant's stimulus identical.** No points, scores, outcome feedback, branching, adaptive difficulty or random events in the session; game mode stays separate (`29`).
- **Change four things:** how the premise check reaches the guide group in phase B (§3); how Paper 2 is analysed (§4); trust calibration (§5); validation and analysis details (§6–§7).

## 2. Rejected, with the reason (added to `30` §9)

| Suggestion | Source | Why not |
|---|---|---|
| Drop SAGAT and SPAM for stealth measures | Gemini | SAGAT is the most sensitive direct SA measure (Endsley 2019; Moens et al. 2026); Paper 3 needs probe labels; no validation of log-SA exists |
| One end-of-run freeze | Gemini | One moment, five items: no calibration estimate (bias needs ≈ 40 items, Fox et al. 2024) |
| Guide that pushes recommendations; "leader voice" that recommends and streams its chain of thought | Gemini | Breaks "assess, never enforce"; anchors the criterion; traces raise trust, not performance |
| Opaque vs transparent chain-of-thought study | Gemini | An explanation-style study needing a recommender in both arms |
| In-game trust micro-pulses | Gemini | Concurrent ratings change decisions (Double & Birney 2024; Li et al. 2023); habituate (Eisele et al. 2021) |
| A deliberately wrong premise flag | Gemini | Changes H13's key; the projection-error schedule and the planted record already give "imperfect AI" moments |
| Time-pressure factor; a three-arm Study 2; MCDA weights; NLP intent grammar | Report | Not with 100 professionals in one web session; candidates for the student sample (`30` §7) |
| Closed-loop adaptive "director" | Both | Needs its own evaluation with new participants |
| Webcam facial action units; SEEV eye tracking | Report | No eye tracker; biometrics are GDPR special-category data |
| Scores, leaderboards, outcome feedback in the session | Game question | Feedback moves confidence (Stone et al. 2023, 2025), the outcome of H2; divergent stimuli break the keys |

## 3. The plan review at commitment (phase B, both groups)

**Why.** H13 had 53 % power at exposure .8 and δ 1.0 because the premise line reached only those who asked. Showing it when the plan becomes final makes exposure 1 by design, and the change between the plan before and after the review measures reliance directly (decide first, then see the AI: Buçinca et al. 2021).

**When.** In V8–V14, once per view, at the moment the plan would become final:
- the minimum length is reached with a plan recorded (`trigger: "minimum_reached"`), or
- a plan is recorded after the minimum (`trigger: "plan_after_minimum"`).

The merged views' step boundary falls at half the minimum length, so the review always reflects all of the view's records. An open SPAM item or freeze holds the review as it holds the view's end. No plan by the cap: no review.

**What it shows.** Both groups: the plan as recorded and two buttons, "Vahvista kohdennus" (keep) and "Muuta kohdennusta" (revise). The guide group also sees the premise lines — the fixed template of `30` §3.3, never model text — looked up on the server from the premise-evidence table at the view's records clock (`POST /api/thinker/premise-review`, guide cell only, no model call). A cited record opens in the message log (`plan_review_record_opened`). When the lookup fails, the guide group sees the neutral review and the record carries `premiseError`.

**Time.** The view's clock stands still while the review is open (as in a freeze). Keep ends the view (`participant_confirm` or `minimum_length`, as before). Revise opens the allocation again; the view ends when the revision is recorded, with no second review; if fewer than 45 s (`REVIEW_REVISION_MIN_SECONDS`) are left before the cap, the cap moves to give 45 s (`capExtendedToSeconds`). The cap reached while the review is open closes it (`choice: "time_cap"`); the plan stands.

**Records** (format 0.12.0, `07`): `plan_review_shown`, `plan_review_record_opened`, `plan_review_closed`. The review's premise lines are AI-stated text for the told split (`aiStatedKey`) and for exposure.

**Analysis.** H13–H15 code the final plan (intention to treat, as before). New, per keyed view: the plan's cell before the review and after it, `revisedAtReview`, the dwell, and whether a cited record was opened. H17 becomes: in the guide group, the share of no-fit views whose plan moved to C at the review, and opening the cited record before keeping or revising. `30` §3.4 "pull only" becomes "pull, plus the review at commitment"; the consult notification and the chip stay.

## 4. Paper 2 as signal detection

- Per keyed view, `departed` = the final plan departs from the directive by the act coding (C or D in a no-fit view; not aligned in a fit view). A departure in a no-fit view is a hit; in a fit view a false alarm.
- **Discrimination** is H15 (group × fit on alignment, logit). **Criterion** is the group's main effect on departing over all six keyed views, with fit as a covariate (H15c, new secondary). H15 is blind to the compliance amplifier; H15c sees it.
- **Primary (RC, before the lock).** H13 stays primary unless pilot 2's fit-view departure rate in the Haku group is at least 15 %; then H15 becomes primary and H13 its pre-stated component. The rule is fixed now; only its input comes from the pilot.
- `paper2-power.ts` gains the review scenarios (exposure 1.0) and the H15c column.

## 5. Trust calibration without new in-session items

- **Questionnaire.** `tools.trust` and `thinker.trust` become the 3-item S-TIAS (McGrath et al. 2025): "I am confident in …", "… is reliable", "I can trust …", 1 = not at all … 7 = extremely, averaged; Haku for everyone, the Thinker for the guide group. Finnish wording DRAFT (translation and back-translation, native check).
- **Stated vs actual.** `reliability.projection` against the projection's correct share in the error schedule; a signed gap per participant.
- **Behaviour.** Reliance on the projection when it is wrong vs right (`projectionReliance`, now named a trust-calibration component), the planted value held (H9), and opening a cited record before acting on it (§3).
- **The Thinker's own calibration.** An audit tool marks hedged and unhedged Thinker answers and exports a blind sheet for coding their correctness; AUROC of stated certainty against correctness is reported (people follow an AI's stated confidence even when it is wrong: Lee et al. 2024).
- **Never** a wrong premise flag; **no** in-session trust items.

## 6. Validation of the log measures (pilot 2)

- **Cued recall, n ≈ 15–20 pilot participants**, moderated by video call with screen recording (consent addendum). After the questionnaire the researcher replays 4–5 marked moments (a deciding record's arrival, a freeze's start, the review, one AI answer) and asks "What were you doing and thinking here?" Two coders code the recall (checking, relying on the AI, unsure where to look, overloaded, other); the match rate with the log indicators (§7) is reported (Fan et al. 2022: about 55 % after validation).
- **One new item** after the session block: "How much did the questions that stopped the exercise disrupt your work?" (1–7; `freeze.intrusiveness`).

## 7. New measures and analysis rules

| Measure | Definition | Where |
|---|---|---|
| Roadblock latency | View seconds from a deciding record's arrival (premise table atoms, the planted record) to the first relevant act: opening it, a plan coded C, or (guide) opening it from the review | `roadblock-measures.ts` |
| Lowest-confidence share | Share of freeze answers at 25 % by participant (exploratory "don't know" index) | `freeze-measures.ts` |
| AI answer length | Characters of AI answers shown per participant and view (covariate for confidence) | `teaming-measures.ts` |
| Plan before / after review | §3 | `review-measures.ts` |
| Departure (SDT) | §4 | `review-measures.ts` |
| Trust gap | §5 | `trust-measures.ts` |

Analysis rules (`09`, pre-registered):
- **Resolution** at group level only, hierarchically, adjusted for accuracy (no metacognition measure is independent of accuracy; few trials make individual estimates unreliable: Guggenmos 2021, Rahnev 2025); one bias index (H2's gap) and one resolution index (H2r's GLM slope).
- **Source memory** scored with a source-monitoring model as sensitivity (Zindulka et al. 2025).
- **Paper 3** must beat a baseline that knows only the item's difficulty and the person's mean confidence; significance by a label-permutation null (1000 permutations within participant).
- **Reactivity**: the `afterFreeze` splits; SPAM `readyLatencyMs` analysed separately (experts delay accepting, Loft et al. 2016).
- **RPD indicators (exploratory)**: `last.possibilities`, `last.basis` (experience vs projection vs AI), decision time, projection reliance, and experience (`years.service`, `incidents.commanded`) as moderator.

## 8. Researcher items (RC)

1. The review's wording (fi/en) and the 45 s revision window — native check, pilot.
2. The primary-switch rule of §4 (threshold 15 %).
3. S-TIAS Finnish wording; ethics notice for the changed questionnaire.
4. Pilot-2 cued recall: consent addendum, ethics.
5. Release the post-session replay with expert comparison, and game mode, only after data collection closes (`29` §2).

## 9. Work packages and acceptance

| WP | Content | Acceptance |
|---|---|---|
| 1 Review flow | Orchestrator step, review panel, server endpoint, records, told split | Tests: review once per phase-B view at the final moment, clock paused, keep/revise/cap paths, guide-only lines from the table, none in phase A or the practice view; CI green |
| 2 Measures | §3 analysis, §4 SDT, §5 trust gap, §7 roadblock, lowest-confidence, answer length, uncertainty audit | Unit tests on synthetic logs; CI green |
| 3 Questionnaire | S-TIAS, `freeze.intrusiveness` | Tests; fi/en texts; DRAFT marks |
| 4 Power | Review scenarios, H15c | Reference row reproduces `30` (az) exactly |
| 5 Specs | `30` (ba), `09`, `08`, `07`, `11` | Revision notes point here |
| 6 Design Basis v4 | The researcher's Claude Doc: a new tab aligned with `30` and this document; v3 kept | Tab added, v3 untouched |
