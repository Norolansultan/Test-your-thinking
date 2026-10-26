# 35 — The public-audience version: the same study, explained for people without a fire-rescue background

**Status:** Governing from 21 Oct 2026 for what it names. Extends `30`, `32`; changes nothing in the expert sessions.
**Scope:** a setting of the study instrument for participants from the general population (Paper 4: does the Paper 3 model, trained on experts, work with non-experts; expertise as a moderator of AI reliance). The researcher, 21 Oct 2026: "test the same simulation with random people … build the more gamable research solution which could be utilized with wider audience."

> **Changelog**
> - **26 Oct 2026 (bp)** — the training incident in a public session (`15` (bp)): the same training after the primer; the glossary layer covers its texts (surface `training`); the one screen that shows a right answer is now the training's feedback. See the revision at the end.
> - **25 Oct 2026 (bl)** — the training teaches how to search, not that one must (`15` (bl); researcher decision): the tour's new step "What the records hold" and the practice feedback's search lesson (the example question, the record a search would have shown and, because it is unscored practice, the right answer and the participant's own) are the same in a public session, in both groups and both languages. §4's "no outcome feedback" holds for everything scored. See the revision at the end.
> - **25 Oct 2026 (bi)** — R12 (researcher decision, 25 Oct 2026; replay analysis §10.3 e): the plan's two "line" choices are told apart. The glossary's one entry "puolustuslinja (linjan pito)" / "defensive line (holding a line)" becomes two: **defensive line / puolustuslinja** (the posture: a line chosen ahead of the fire and prepared before it arrives) and **holding a line / linjan pito** (the secondary task: an existing line kept so that the fire does not cross it). **91 terms.** This document sets no number of terms; the glossary test's bound moves from 90 to 91 with this revision. The English labels say which line ("Defensive line ahead of the fire, on a road or water"; "Hold an existing line on a road or water"; were "Defensive line on a road or water" and "Holding the line on a road or water"); the Finnish labels are unchanged (DRAFT, native check). See the revision at the end.
> - **24 Oct 2026 (play-test)** — the glossary gains four terms the records use and no entry covered (`docs/audits/2026-10-23-playtest/analysis.md` lead 7): burnout / taustapoltto, trigger point / laukaisupiste, release rule / vapautussääntö and humus layer / kunttakerros, with the forms the records inflect them in (taustapolttoa, Laukaisupiste, vapautussäännön, kunttakerroksessa, kunttaan; tested against the scenario's records); 90 terms. Definitions generic and plain, never about the situation (§1); Finnish DRAFT, domain check pending (§8 item 2).
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

- During the session nothing changes (no points, scores, outcome feedback, branching): `32` §1 holds. (The one screen that shows a right answer is the practice feedback's records item, which is unscored practice: `15` (bl).)
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

## Revision 25 Oct 2026 (bi) — the two "line" choices (R12)

The replay (`docs/audits/2026-10-23-playtest/analysis.md` §10.3 e, §10.4 R12) found that a novice cannot tell the posture "Puolustuslinja tien tai vesistön varaan" / "Defensive line on a road or water" from the secondary task "Linjan pito tiellä tai vesistöllä" / "Holding the line on a road or water", and the glossary defined both with one entry. The researcher chose (25 Oct 2026) glossary entries and, where the labels live in this build's own texts, self-explanatory English labels.

- **Glossary** (`content/glossary/terms.{fi,en}.json`, generic definitions, §1; DRAFT, domain check §8 item 2):
  - `defensive_line` — **puolustuslinja** / **defensive line** (forms *puolustuslinj\**; *defensive line\**, *barrier line\**): "Palon edelle ennalta valittu linja, esimerkiksi tie tai vesistö, jolle palon eteneminen pyritään pysäyttämään. Linja valmistellaan ja sitä vahvistetaan ennen kuin palo saapuu." / "A line chosen ahead of the fire, e.g. along a road or water, at which its spread is to be stopped. The line is prepared and strengthened before the fire reaches it."
  - `hold_line` (new) — **linjan pito (olemassa oleva linja)** / **holding a line (an existing line)** (forms *linjan pit\**; *hold\* an existing line\**, *holding a line*, *holding the line*, *hold the line*, *holds the line*): "Jo olemassa olevan linjan, kuten tien, vesistön tai raivatun kaistan, varmistaminen niin, ettei palo pääse sen yli. Linjaa vartioidaan ja kastellaan, ja sen yli syntyvät pistepalot sammutetaan." / "Keeping an existing line, such as a road, water or a cleared strip, so that the fire does not cross it. The line is watched and wetted, and spot fires that start beyond it are put out."
  - **91 terms** (was 90). §3 item 2 fixes the list, not its length, so the test's bound moves to 60–91 (`test/explain/glossary-terms.spec.ts`), which also checks that each of the two plan labels is glossed by its own term in both languages. The layer stays identical in both groups.
- **English labels** (`app/i18n/ui.ts`; both audiences, both groups; the logged ids `barrier_line`, `task.hold-line` unchanged): posture "**Defensive line ahead of the fire, on a road or water**"; secondary task "**Hold an existing line on a road or water**". The tour's definition line for the task (`briefing.ts` `SECONDARY_TASK_DEFINITIONS_EN`) opens with the new label, as its test requires. The Open Thinker's plan context names the options by these labels (`openPlanContext`), so it follows. **Finnish labels unchanged**: "Linjan pito" already says an existing line is held; DRAFT, native check.
- Expert sessions have no glossary; they get the English labels only.

## Revision 25 Oct 2026 (bl) — the records step and the practice feedback's search lesson

> **[PARTLY SUPERSEDED 2026-10-26, revision (bp)]** The practice feedback's search lesson is retired; its teaching moves to the training incident's S3 (`15` (bp)).

Source: `15` (bl) (the researcher's decision of 25 Oct 2026: teach how to search, not that one must). Both are the same in a public and an expert session and in both groups; the tour (not the glossary layer) carries the new step, and the glossary marks nothing in it (the practice screens have no glossary marks, as before).

- **The tour's `hakuRecords` step** ("What the records hold" / "Mitä kirjauksista löytyy"): what the command post's records hold beyond the message log and how to ask Haku for it — by topic, by place, by source and time — with three examples from the practice view. It does not say that searching is needed for the memory checks or the scores, and names no scored item's subject; the only authorities named are "other authorities".
- **The practice feedback** shows, for the item found by search, the example question, the record a search would have shown and the practice's right answer, then the participant's own. Practice, unscored; no scored item's key can reach the screen. §4's "no outcome feedback in the session" is unchanged for everything scored.
- The English names the tool "Search", as the public texts do (`15` (bl) lists the one word changed from the researcher's text). Finnish DRAFT (native check).

## Revision 26 Oct 2026 (bp) — the training incident in a public session

Source: `08` (bp), `15` (bp). **The training is the same in a public session and an expert session, in both groups and both languages.** It stands where (bj)'s map training stood: after the primer (expert sessions: after the pre-session item), before the intro video and VP.

- **Primer.** The primer's "done" button still leads on to the next step; the (be) revision's line "After the primer the map-reading pretest …" now reads "the training incident". The primer's `screen` page, its information rule and its check `primer.q.records` are unchanged: the training teaches how to ask; it does not repeat the primer's questions.
- **The explanation layer** (`35` §3) covers the training's texts as it covers the freeze's and the SPAM card's: a glossary term in a training text is marked and opens its definition, logged as `glossary_opened` with the surface `"training"` (a new value of `GlossarySurface`; `07` (bb)). The items the training shows through `FreezeScreen` and the question card keep their own surfaces (`freeze`, `spam`). The glossary adds no term: the training's texts use only plain words and the terms of the existing list (burnt area, head of the fire, fill point, …); a new term would need a definition and a domain check (§8). The layer is the same in both groups.
- **No outcome feedback in the session** (`32` §1; §4): the training is unscored practice, and its feedback shows the right answer after every item, right or wrong. The training's keys are the training's own and never a scored item's (`08` (bp) §bp.8). The sentence "The one screen that shows a right answer is the practice feedback's records item" (`15` (bl)) now reads: the training's feedback, which is unscored practice.
- **`?laajuus=a`** (scope phase A): the training is part of the pre-V1 steps in both scopes; nothing changes there.
- **The public mission card** on the training text after VP is unchanged.
- **The expert sessions** change as `15` (bp) says; the identity test's normaliser removes the training's records (`15` (bp) §bp.7).
