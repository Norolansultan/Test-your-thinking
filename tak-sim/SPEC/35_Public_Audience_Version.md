# 35 — The public-audience version: the same study, explained for people without a fire-rescue background

**Status:** Governing from 21 Oct 2026 for what it names. Extends `30`, `32`; changes nothing in the expert sessions.
**Scope:** a setting of the study instrument for participants from the general population (Paper 4: does the Paper 3 model, trained on experts, work with non-experts; expertise as a moderator of AI reliance). The researcher, 21 Oct 2026: "test the same simulation with random people … build the more gamable research solution which could be utilized with wider audience."

> **Changelog**
> - **23 Oct 2026 (be, the difficulty audit)** — the primer's screen page states the information rule (the message log is only part of the traffic; the rest is in the records, found with Haku) and its check question tests it (new id `primer.q.records`, replacing `primer.q.screen`, so old and new answers are never pooled); the primer's "done" button no longer names the practice. The map-reading pretest follows the primer (expert sessions: at the same point, after the pre-session item). See the revision at the end.
> - **23 Oct 2026 (personal results, `36`)** — the commander profile on screen (§4) becomes optional and is **off by default** in every audience: personal results (the profile, development tips, comparison bands) are sent after the study closes (`36`). `?profiili=heti` still shows it on screen after the session (demonstrations, teaching before a lecture), in either audience; logged in the header (`immediateProfile`). Every session (both audiences) gains the results step after the questionnaire (`results_optin`, format 0.14.0). §4, §6 and §9 P1/P3 read with this revision.
> - **21 Oct 2026 (game mode removed)** — this version replaces game mode (`29`, `34`, withdrawn; researcher decision): there is one simulation for everyone, the study's own (Haku / guide groups), and the public-audience version is that same simulation with more explanation. The demonstration start page gains a version switch (§2).
> - **21 Oct 2026** — created. Finnish texts DRAFT (native check); glossary definitions DRAFT (domain check); the consent, background items and the profile are RC items (§8).

---

## 1. The rule: explain the words, never the situation

A public session runs the **same stimulus** as an expert session: the scenario, the records and their wording and timing, the views and their lengths, the freezes and their items and keys, SPAM, the plan task, the plan review, Haku and the guide, the two groups and their allocation. Only an **explanation layer** is added, and it is:

- **generic** — what a word, a symbol or a role means, never what this situation means (that is what the freezes measure and, for one group, what the guide does);
- **identical in both groups** — the layer never differs between Haku and the guide;
- **logged** — every use is a record, so its use is a covariate.

Expert sessions are unchanged (no layer, no profile).

## 2. The setting

- `?yleiso` on a study link (with `?tuotanto`) sets `SessionOptions.audience = "public"`; default `"expert"`. Logged in the header (`audience`).
- `?laajuus=a` sets `SessionOptions.scope = "phaseA"`: the session ends at the hinge (VP + V1–V7, Paper 1's views) and goes to the questionnaire; default `"full"`. Logged (`scope`). Public sessions default to `full`; `phaseA` exists for panels where 100 min is too long.
- Distribution: a public link carries the real scenario, so it is never published openly while expert recruitment runs (the recruitment gate, `31` P-12, `docs/DEPLOYMENT.md` §2.1); it is given only to panel participants with codes, or after expert data collection closes.
- The demonstration (no `?tuotanto`): a version switch above the group buttons on the start page, "Ammattilaisversio / Yleisöversio" (fi DRAFT; en "Professional version / Public version"), default professional, sets the audience for either group (`app/render/ui/VersionSwitch.tsx`); `?yleiso` preselects the public version. It is never shown under `?tuotanto`, and with the recruitment gate on the start page is not served at all.

## 3. The explanation layer

1. **Primer (Perehdytys), before the practice view, ~12 min.** 7 short pages, each with a schematic illustration (not the study map) and one check question (wrong answer → the explanation, then the question again; logged). Topics: the incident commander's job and the plan; the units and their call signs (EK = fire engine, tanker, forest-fire unit, drones, helicopter); fire shape (head, flanks, heel) and what drives it (wind, slope, fuel, dry peat); anchoring and flanking; water (tank sizes, refilling, shuttles); safety (escape routes, a live power line: no water within 15 m); the screen (map, message log, Haku / the guide, freezes, confidence).
2. **Glossary on text.** Terms from a fixed list (`content/glossary/terms.{fi,en}.json`) are marked (dotted underline) wherever text appears: message log, records, freeze items and options, SPAM, plan and review panels, Haku results and the guide's answers. Hover or tap shows the word's plain-language definition. The same list and marking for both groups.
3. **Help card (Sanasto ja ohjeet).** A button always on screen: the glossary A–Z, the call-sign roster with unit types, the map legend. No checklist, no tactics.

Not in the layer: hints, checklists of what to check, situation explanations, changed wording, changed timing.

## 4. Research-safe game feel

- During the session nothing changes (no points, scores, outcome feedback, branching): `32` §1 holds.
- **Framing:** a mission card at the start ("You are the incident commander …") and chapter titles on the views' progress strip (same text both groups).
- **Commander profile, after the questionnaire** (public only; **since 23 Oct 2026 off by default in every audience, shown only with `?profiili=heti`; otherwise sent after the study closes, `36`**): the participant's own pattern, never the answer key:
  - calibration: how well confidence matched accuracy (over / under / well calibrated) across the freezes;
  - checking: how often deciding records were opened before acting;
  - tool use: Haku / guide questions asked, and how often the plan changed at the review;
  - comparison with the expert median (from the expert sample once collected; placeholder until then).
  No item, key or correct answer is shown, so the profile cannot leak answers to later participants.

## 5. Public questionnaire

Consent and debrief texts for the general population. The background section replaces the firefighter items (`role.rank`, `years.service`, `incidents.commanded`, `service.country`) with: age band; education; management experience (none / team lead / manager / executive); first-responder or military background (none / some / professional); gaming frequency; AI-assistant use frequency. All other items are the same.

## 6. Records (telemetry format 0.13.0)

Header: `audience`, `scope`. Records: `primer_page` (page id, dwell), `primer_check` (question id, chosen, correct, attempt), `glossary_opened` (term id, surface, view), `help_card_opened` (section), `profile_shown`.

## 7. Analysis (to pre-register for Paper 4)

The expert model frozen before public data; transfer of discrimination (AUROC) and calibration separately; recalibration on a held-out share; the Paper 3 baseline and permutation null; expertise as moderator of AI reliance (quasi-experimental); primer score and glossary use as covariates.

## 8. Researcher items (RC)

1. Ethics approval for the general population; consent text.
2. Native check of all Finnish texts; domain check of glossary definitions and primer.
3. Pilot: primer length and check difficulty; whether view lengths suit novices (any change is a pre-registered constant).
4. Panel and language choice (fi / en).

## 9. Work packages and acceptance

| WP | Content | Acceptance |
|---|---|---|
| P1 Session | `audience`, `scope` options from the URL; header; record kinds (0.13.0); orchestrator: primer step before VP, scope end at the hinge, public questionnaire and consent, profile step; `AudienceContext` provided | Tests: expert session byte-identical in records except the header fields; public session runs primer → VP … → questionnaire → profile; `phaseA` ends at the hinge |
| P2 Explanation layer | Primer screen and content; glossary terms, matcher and tooltip on every text surface; help card | Tests: matcher (word boundaries, inflected Finnish forms, no match inside other words), terms fi/en complete, same marking for both cells |
| P3 Profile | `commanderProfile(records)` pure; profile screen | Unit tests on synthetic logs; never exposes keys |

`npx tsc --noEmit -p .`, `npm run lint:determinism`, `npm test`, `npm run build:web` pass.

## Revision 23 Oct 2026 (be) — the information rule in the primer (the difficulty audit)

Source: `docs/audits/2026-10-23-difficulty/audit.md` §1 (the primer said the message log is "where the units' reports arrive" and its check question was keyed "In the message log") and `proposal.md` (a.3).

- **Page `screen`, second paragraph** (fi DRAFT, en): "On the right is the message log. It shows only part of the traffic: the reports passed to you. Everything else (the units' own reports and status answers, drone and sensor data, weather forecasts) is in the records. You find it with Search, as you would ask the command centre by radio. At the bottom you make your plan."
- **Its check question** `primer.q.records` (was `primer.q.screen`; a new id so the two are never pooled): "A drone has measured something, but it is not in the message log. Where can you find it?" — (0) Nowhere: if it is not in the log, it was not reported · **(1) With Search, in the records** · (2) In the map legend; the explanation restates the rule. The primer's own key, about the screen, never a study item's.
- **Generic** (§1): it names kinds of information any incident has, no place, unit, time or event of the scenario; the same in both groups. The expert sessions, which have no primer, get the rule through the tour (`15` (be)).
- **After the primer** the map-reading pretest (`15` (be), `08` (be)), then the intro video and VP; the "done" button reads "Done – continue" / "Valmis – jatka".
- **Pilot criterion** (`09` (be)): ≥ 80 % correct at the first attempt on `primer.q.records` (`primer_check`), DRAFT threshold.
