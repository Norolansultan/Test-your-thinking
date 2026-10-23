# 36 — Personal results after the study

**Status:** Governing from 23 Oct 2026 for what it names. Extends `35` §4 (the commander profile) and `07` (format 0.14.0); changes no stimulus and no measure.
**Decision (researcher, 23 Oct 2026):** to make the study appealing to fire-rescue and military participants, every participant may receive personal results — their commander profile, development tips and a comparison with other participants and experts — **sent after the study closes**, not shown during or right after the session.

> **Changelog**
> - **23 Oct 2026** — created. Finnish texts DRAFT (native check); the contact-data wording is an ethics-board item (§7).

---

## 1. Why

Participation appeal. Professionals give 100 minutes; a personal, practical result in return is a reason to take part and to recommend the study to colleagues. Sending it only after data collection closes keeps the stimulus identical for everyone: nothing about the exercise, and no hint of what was measured, reaches people who have not yet taken part.

## 2. What is sent

One short report per participant who asked for it (`npm run results:reports`, §5):

- **The commander profile** (`35` §4, `app/telemetry/profile.ts`): calibration (confidence against accuracy: well / over / under, and whether confidence told right from wrong), checking (how often a look-up came before acting: often / sometimes / rarely), tool use (searches and Thinker questions; plan reviews and how often the plan changed).
- **2–4 development tips** chosen by rules from the profile (`app/telemetry/profile-tips.ts`): generic practice advice, each tied to one profile condition, improvement before reinforcement, at most one per dimension; two general tips fill up when the data are thin.

  | Condition | Tip |
  |---|---|
  | overconfident | before committing, ask what would change your mind |
  | underconfident | trust what you have checked: state the judgement and its reason |
  | checked rarely before deciding | a two-source rule for key facts |
  | ≥ 3 chat questions, under a third of them open questions | also ask what you might be missing |
  | no search and no question | ask one focused question |
  | confidence the same (or higher) when wrong | notice what your confidence rests on |
  | checked sometimes | make checking a habit, not a reaction |
  | well calibrated / checked often | reinforce (keep saying how sure you are / keep checking within a time limit) |

  "Open question" is a keyword heuristic over the participant's own question text, used for this choice only; it is not a measure.
- **Comparison bands** for three metrics (the calibration gap |confidence − accuracy|, the checking share, the number of questions): the mid-rank percentile band — lowest quarter, middle half, highest quarter — against every completed study session of the **same background** and, when the expert sample exists, the participant's value against the **expert median** (closer / about the same / further; margins in `tools/results/comparison.ts`). Background, from the study's own items (no new item): *fire* — a professional session whose `role.rank` is not "other"; *military* — a public session answering "as a profession" to `public.responder` (the item does not separate rescue, police and military work, so the report says "military and other professional responders"); *other* — everyone else. No band is computed in a group of fewer than 10 sessions (the report says the group is too small), so no report can reveal another person's result.

## 3. What is never sent

No item text, no answer key, no item-level right or wrong, no exact score (bands only; the profile's percentages stay out), no other participant's value or identity. Every report carries a reliability note (one session, a few dozen answers; a one-band difference may be chance). A test scans generated reports against the freeze banks (`test/results/`, the leak scan of `test/profile/`).

## 4. When, and to whom

Only after data collection has closed (all audiences, all panels). The report belongs to the participant alone. Employers, schools and teachers who help recruit get **group results only**, never an individual's.

## 5. The flow

1. **Session end (every session, both audiences, both groups, identical):** after the post-session questionnaire and before the debrief, the step "Personal results after the study" — the explanation, an optional email field, an explicit consent ("send my personal results to this address after the study closes; my address is stored separately from my answers and deleted after sending"), and Skip as prominent as Send. The address goes from the screen to `POST /api/results-contact` `{sessionId, email, lang}`; the session log records only `results_optin {optedIn}` (true once the server stored the address). Without a server the step says so and offers "try again" or "continue without results" (`optedIn: false`).
2. **The on-screen profile** (`35` §4) is off by default in every audience; `?profiili=heti` shows it after the results step (demonstrations, teaching before a lecture); logged in the header (`immediateProfile`).
3. **Storage:** the server appends one JSON line per contact to `RESULTS_CONTACT_DIR/contacts.jsonl` (default `logs/results-contacts`, never inside `SESSION_LOG_DIR`; 0700/0600), validated, rate-limited per client address, never printed. The research data and their download never contain an address.
4. **After the study closes:** `npm run results:reports -- --logs <SESSION_LOG_DIR> --contacts <RESULTS_CONTACT_DIR> --out <dir> [--expert-reference <json>]` writes one self-contained HTML report per contact (fi/en by the contact's language, the study's look, print-friendly) and `mailing-list.csv`. The researcher sends them from their own email. Then `--purge --confirm-sent` deletes the contact files and the mailing list.
5. **The debrief** says that requested results arrive after the study closes.

## 6. Analysis

`results_optin` is descriptive (the share who asked); it is not a pre-registered measure. It comes after every measure, so it cannot affect them. The profile computed for a report is the analysis' own fold (`commanderProfile`), never stored back into the data.

## 7. Researcher items (RC)

1. Ethics board: the contact-data wording on the step (controller, retention, deletion date), and that the results are sent after closure; the placeholder line on the step marks it.
2. Native check of the Finnish step, debrief paragraph, tips and report texts.
3. The expert reference (`--expert-reference`) once the expert sample is collected: the medians of `ExpertReference`.
4. Whether a dedicated military-background item is wanted (a new item is a measure change; not added).
