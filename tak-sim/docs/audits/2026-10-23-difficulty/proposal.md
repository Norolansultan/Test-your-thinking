# Proposal, 23 Oct 2026: teach the information rule, give a search lesson, test and support map reading

**Status:** DRAFT for the researcher (RC), the native speaker (Finnish wording) and the expert panel (items). Nothing here is built. It rests on `audit.md`.
**Constraints kept everywhere:**
- identical for both groups;
- content-free with respect to the situation: it names kinds of information, never what to look for in this scenario;
- no points, scores or outcome feedback in the measured session (`32` §1);
- every new screen and click is logged.

**Parts:**
- this file: (a) the rule in the primer and the tour, (b) the practice search lesson, (f) the pilot acceptance criteria, (g) parity, keys, the told split and power;
- `proposal-map.md`: (c) the map-reading pretest and the practice map tasks, (d) the map clarity changes;
- `proposal-items.md`: (e) the fixes item by item, for the panel.

---

## Summary

The audit finds two separate problems.

**Seeking.** Without searching, two thirds of the scored items can be answered (68 %), one in five only in part (21 %), and one in ten not at all (11 %). A quarter of the items have a key record that only a search reaches. Yet nothing tells participants that the message log is incomplete. The tour and the primer actually say that the reports "arrive in the message log".
- The fix is cheap and identical for all: state the rule (a), show it working in the practice view with one item that only Haku can answer and feedback naming the record (b), and add a content-free "new records" cue on the Haku button (a.4).

**The rest of the difficulty is not seeking.** It comes from:
- map reading (11 freeze items; five are points on a blank basemap);
- projections whose figures no record states (7 items);
- domain-knowledge items;
- a burst of records arriving 37–40 s before the V2 and V4 freezes.

These need different fixes:
- a short map pretest as a covariate, and two practice map tasks (c);
- cheap map labels and the same reference overlay on the freeze map (d);
- item-level fixes for the panel (e).

## (a) The rule: primer and tour wording

### a.1 The rule, in one sentence (used everywhere)

> **en:** The message log shows only part of the traffic. The units' own reports and answers, drone and sensor data, weather forecasts and the units' status are in the records: find them with Haku, as you would ask the command centre by radio.
> **fi (DRAFT):** Viestiloki näyttää vain osan liikenteestä. Yksiköiden omat ilmoitukset ja vastaukset, droonien ja anturien tiedot, sääennusteet ja yksiköiden tila ovat kirjauksissa: löydät ne Hausta, kuten kysyisit johtokeskukselta radiolla.

It names kinds of information that any incident has. It names no place, unit, time or event of this scenario.

### a.2 Tour (everyone, experts included; `app/i18n/ui.ts` `tour.steps`)

The `log` step's text is replaced:

| | Title | Body |
|---|---|---|
| en | Message log: only part of the traffic | Reports passed to you arrive here with their sender and time. This is only part of the traffic. The units' own reports and answers, drone and sensor data, weather forecasts and the units' status (water, hours on shift, location) are kept in the records. You find them with Haku. |
| fi (DRAFT) | Viestiloki: vain osa liikenteestä | Sinulle välitetyt ilmoitukset tulevat tähän lähettäjän ja kellonajan kanssa. Se on vain osa liikenteestä. Yksiköiden omat ilmoitukset ja vastaukset, droonien ja anturien tiedot, sääennusteet ja yksiköiden tila (vesi, työvuoron pituus, sijainti) säilyvät kirjauksissa. Ne löydät Hausta. |

A sentence is added to the `haku` step, before `HAKU_CHAT_*`:

| | Added sentence |
|---|---|
| en | Ask Haku as you would ask the command centre by radio: in your own words, about anything the log does not show you. The number on the button tells how many new records have arrived in this period. |
| fi (DRAFT) | Kysy Hausta kuten kysyisit johtokeskukselta radiolla: omin sanoin mitä tahansa, mitä viestiloki ei näytä. Painikkeen luku kertoo, montako uutta kirjausta tällä jaksolla on tullut. |

The V1 tool reminder (`toolsHaku`), which everyone sees at V1:

| | Body (replaces "Search is available to you throughout the session, also in the decision phase.") |
|---|---|
| en | Search is available throughout the session, also in the decision phase. Remember: the message log shows only part of the traffic. The rest is in the records. |
| fi (DRAFT) | Haku on käytössäsi koko istunnon ajan, myös päätösvaiheessa. Muista: viestiloki näyttää vain osan liikenteestä, loput ovat kirjauksissa. |

In the Thinker group the Thinker reminders stay as they are. The Thinker reaches the same records, and its text already says so.

### a.3 Primer (public sessions; `content/glossary/primer.{fi,en}.json`, page `screen`)

The `screen` page's second paragraph and its check question are replaced. The check question tests the rule.

| | Text |
|---|---|
| body[1] en | On the right is the message log. It shows only part of the traffic: the reports passed to you. Everything else (the units' own reports and status answers, drone and sensor data, weather forecasts) is in the records. You find it with Haku, as you would ask the command centre by radio. At the bottom you make your plan. |
| body[1] fi (DRAFT) | Oikealla on viestiloki. Se näyttää vain osan liikenteestä: sinulle välitetyt ilmoitukset. Kaikki muu (yksiköiden omat ilmoitukset ja tilavastaukset, droonien ja anturien tiedot, sääennusteet) on kirjauksissa. Löydät ne Hausta, kuten kysyisit johtokeskukselta radiolla. Alhaalla teet suunnitelman. |
| question en | A drone has measured something, but it is not in the message log. Where can you find it? |
| options en | (0) Nowhere: if it is not in the log, it was not reported · **(1) With Haku, in the records** · (2) In the map legend |
| explanation en | The message log shows only part of the traffic. Everything recorded, drone measurements included, can be found with Haku. |
| question fi | Drooni on mitannut jotain, mutta mittaus ei näy viestilokissa. Mistä löydät sen? |
| options fi | (0) Ei mistään: jos se ei ole lokissa, sitä ei ole ilmoitettu · **(1) Hausta, kirjauksista** · (2) Kartan selitteestä |
| explanation fi | Viestiloki näyttää vain osan liikenteestä. Kaiken kirjatun, myös droonien mittaukset, löydät Hausta. |

The question id changes (`primer.q.screen` becomes `primer.q.records`), so that old and new answers are never pooled.

**Expert sessions see no primer** (`35` §1). For them the rule is carried by the tour (a.2) and the practice lesson (b). If the researcher wants one more, a one-card "Where the information is" screen before VP can show a.1 with one "Next" button (logged `briefing_advanced` `briefing.records_rule`, with its dwell), the same for both groups.

### a.4 The "N new records" cue (both groups)

A badge on the Haku button reads "**12 new records**" / "**12 uutta kirjausta**".
- **Count:** the records released at this view's start, or at its step boundary, that are not in the message log (the time gate's newly reachable atoms minus the pushed ones).
- **When it updates:** at the view's start and at the step boundary. It never updates on a record's content.
- **When it resets:** it goes to 0 when Haku is opened.
- **Thinker group:** the same badge, on the Haku button only, because Haku is everyone's tool.
- **Logged:** `records_badge_updated {view, count}` and `records_badge_cleared {view, count, viaOpen}`.

It is content-free in what it says, but **the count varies from view to view** (9–93; `summary.md`). The no-fit views' counts (V9 42, V10 36, V14 93) are not systematically higher than the fit views' (V11 76, V12 81, V13 46), so the count does not flag them. Still, it is a number derived from the records, and `30` §4 keeps the consult notice from ever being triggered by a record. **Recommended default: the number-free version.** It shows "New records" / "Uusia kirjauksia" at every view's start and at the step boundary, the same in every view. The numbered version is an RC option.

## (b) The practice view's search lesson

### b.1 The practice view as built

- VP is step W2 (12.00–12.20). Its records are 13 pushed and 9 recorded only (`evt.vp.000`, `.006`, `.009`, `.010`, `.012`, `.014`, `.016`, `.019`, `evt.wx.01`).
- Its freeze (at 69 s) has four items: `infra` (W1, pushed), `first_target` (pushed), `r1_arrival` (pushed figures) and `head_now` (map).
- **Every practice item is answerable from the log and the map**, so the practice view teaches that the log is enough.
- Haku is open in VP for both groups, and the Thinker for the guide group (revision (am)).

### b.2 The new practice item (VP, L1, only findable with Haku)

**Recommended (A): the forecast.** The record is `evt.wx.01` (T2, recorded 12.07): "Forecast: Finnish Meteorological Institute, local forecast for the fire area 12–20 (issued at 12.00): dry in the afternoon, wind from the south-west 4–6 m/s, gusts 8–10 m/s. …"

| | |
|---|---|
| id | `freeze.practice.forecast` (L1, goal containment, choice; placed after `infra`) |
| stem fi (DRAFT) | Mitä sääennuste lupaa iltapäivän tuulesta? |
| stem en | What does the weather forecast say about the afternoon wind? |
| key | **fi** "Lounaistuulta 4–6 m/s, puuskissa 8–10 m/s" · **en** "South-west 4–6 m/s, gusts 8–10 m/s" |
| distractors | "Lounaistuulta 4–6 m/s, iltapäivällä sadekuuroja" (South-west 4–6 m/s, showers in the afternoon) · "Lounaistuuli voimistuu 10–12 m/s:iin, ukkosta" (South-west strengthening to 10–12 m/s, thunder) · "Lounaistuuli heikkenee tyyneksi iltapäivällä" (South-west easing to calm in the afternoon) |
| why these | All four agree with the map's wind arrow (south-west, 4 m/s), so the arrow cannot answer it. Only the forecast record separates them. No pushed VP record states a forecast. |
| findability (lexical) | "Mikä on sääennuste?" → `evt.wx.01` is 1st. "sääennuste iltapäivä tuuli" → 1st (`npx tsx` on `hybridRetrieve` at step −3). |

**Alternative (B), if the panel finds (A) too close to V5's wind items:** the forest register, `evt.vp.012` (T2): "the point of origin is this year's clear-cut, dry pine heath around it; mineral soil, carries machines".
- Stem: "Mitä metsävararekisteri kertoo syttymäkohdan ympäristöstä?" / "What does the forest register say about the area around the point of origin?"
- Key: "Kuivaa mäntykangasta, maapohja kantaa koneet" / "Dry pine heath; the ground carries machines".
- Distractors: "Kosteaa korpea, koneet uppoavat" (wet spruce mire, machines sink) · "Nuorta kuusikkoa, maa kivikkoista" (young spruce, stony ground) · "Ojitettua suota, turve kuivaa" (drained mire, dry peat).
- It ranks 3rd for "Mitä metsävararekisteri kertoo maastosta?".

The trade-off between (A) and (B):
- (A) teaches the class of record that the scored items most need and that is never pushed (every forecast is recorded only).
- That raises V5's `ek14_shelter` accuracy for both groups. This is the intended effect, and it is equal for both groups (see g).
- (B) teaches the rule without touching any scored item's basis.

### b.3 The practice feedback (after the practice freeze; VP only, everyone, never in a main view)

After the practice freeze is submitted, one screen lists each practice item with **where its information was**. It shows the item's correct answer too: the practice is not measured, and seeing the answer anchors the lesson. The researcher may choose the source-only version, which shows no answer (RC, g.3).

| Item | en | fi (DRAFT) |
|---|---|---|
| `infra` | Water point W1: in the message log (VOL1, 12.09). | Vesipiste W1: viestilokissa (VPK, klo 12.09). |
| `forecast` | **This was not in the message log.** It was in the weather service's forecast record (12.07). You could have found it with Haku, for example "What is the weather forecast?". The message log shows only part of the traffic. | **Tämä ei ollut viestilokissa.** Se oli Ilmatieteen laitoksen ennustekirjauksessa (klo 12.07). Olisit löytänyt sen Hausta, esimerkiksi "Mikä on sääennuste?". Viestiloki näyttää vain osan liikenteestä. |
| `first_target` | In the message log (EK11, 12.01 and 12.07) and on the map: the head's direction. | Viestilokissa (EK11, klo 12.01 ja 12.07) ja kartalla: kärjen suunta. |
| `r1_arrival` | Worked out: EK11 gave 320 m and 4 m/min, so about 80 minutes. | Päätelty: EK11 ilmoitti 320 m ja 4 m/min, joten noin 80 minuuttia. |
| `head_now` | On the map: your mark and the head (the edge furthest downwind) are shown together (`proposal-map.md` c.3). | Kartalla: merkintäsi ja kärki (myötätuulen puoleisin reuna) näytetään yhdessä (`proposal-map.md` c.3). |

Then one closing line:
- **en:** "In the periods to come, many reports are only in the records. Use Haku, or Thinker, when the log does not tell you enough."
- **fi:** "Tulevissa jaksoissa moni ilmoitus on vain kirjauksissa. Käytä Hakua – tai Thinkeriä – kun loki ei kerro tarpeeksi."
- The guide group's line names the Thinker; the Haku group's line names only Haku. This is the one wording difference, and it mirrors the existing training texts (`introTextsFor`).

Logged: `practice_feedback_shown {itemIds, dwellMs}`. Seeking in the practice is logged as it is now: `ai_chat_query_submitted` in view 0.

## (f) Pilot acceptance criteria and the telemetry that computes them

| Criterion (pilot 2; DRAFT thresholds, RC) | Target | Computed by |
|---|---|---|
| The rule is understood (public sessions) | ≥ 80 % correct at the first attempt on `primer.q.records` | `primer_check` |
| Seeking starts early | **≥ 90 % of participants submit at least one Haku or Thinker question by V2's freeze**; ≥ 70 % in VP | `isInformationSeekingAct` (`derived-measures.ts`) on `ai_chat_query_submitted` / `query_submitted`, by view |
| Seeking continues | Median ≥ 1 question per view in V1–V7 and in V8–V14. Share of views with no seeking act ≤ 40 % | `cyclesWithNoDrawerOpened`-style count of the same records; `timeToFirstInformationSeekingActMs` |
| Key records reached | For the 14 items whose key needs a recorded record: the key record retrieved before the freeze in ≥ 50 % of sessions | `freezeItemExposure` / `atomExposure` (routes `haku_chat`, `thinker`, `digest`, `recent`) |
| Items discriminate | **Per-item accuracy 30–85 % for L2/L3** and 40–95 % for L1. No item below 30 % in both groups, which would be a floor (chance is 25 %). | `freezeItemScores`; SPAM `spamMeasures` |
| Confidence is used | Lowest-confidence (25) share ≤ 40 % per participant | `lowestConfidenceShare` |
| Freezes fit their cap | Timeouts ≤ 5 % of freezes; no item missing in > 10 % | `freeze_submitted.timedOut`, missing items |
| Late items | The 8 late items' accuracy is not lower than their view's other items by more than 15 points | `freezeItemScores` × the audit's `late_lt60s` |
| Map | Map-point error median ≤ the tolerance. Map-dependent items' accuracy is correlated with the pretest score (reported, not a gate). | `haversineMetres` in `freezeItemScores`; the pretest (`proposal-map.md` c) |
| Background groups | Firefighters, military and novices: L2/L3 accuracy reported per background. No background group under 35 % on the H2 window. | `freezeItemScores` × the questionnaire's `role.rank` and the public background items |
| The cue and the notice are seen | The consult notice is opened in ≥ 30 % of the views where it is shown. The badge is cleared by opening Haku in ≥ 50 % of views. | `consultExposure`; the new `records_badge_*` records |
| Group parity of seeking | The Haku-question count differs by < 20 % between groups in phase A. The Thinker group's own questions are counted apart. | the same records, by cell |

If seeking stays under the target after these changes, the next step is not to push more records (which would remove seeking). It is to raise the practice lesson to two items and repeat the rule card at V2's start.

## (g) What affects parity, keys, the told split and power, and how to keep them safe

| Change | Parity | Keys | Told split (H2t) | Power | Safe-keeping |
|---|---|---|---|---|---|
| a.2–a.3 the rule in the tour and the primer | Identical texts in both groups | None | More searching in **both** groups. `aiStatedKey` counts Haku answers, so the AI-told share rises in both and the "neither" stratum shrinks. | H2t (49 % at a small effect, `30` (az)) may fall. H2 itself gains if accuracy moves off the floor. | Re-run `tools/power/h2-power.ts` with pilot 2's `toldClass` rates before the lock. The change is a treatment revision before pilot 2, so no data are pooled across it (`30` §2). |
| a.4 the records badge | Identical (Haku button, both groups) | None | As above | Raises exposure | The number-free default. A count is a record-derived signal: RC, and keep it the same in fit and no-fit views. |
| b the practice item and feedback | Identical, except the closing line's tool name (as the training texts already differ) | Practice only, not scored | (A) teaches that forecasts are in the records, so V5's `ek14_shelter` and `wind_shift` become AI-told more often in both groups | Neutral to positive | The feedback is shown only in VP, before any measure, and gives no score. Source-only variant if the researcher reads `32` §1 strictly (see g.3). |
| c the pretest | Identical | None | None | A covariate: adds precision | Shown before VP, never fed back |
| d the map labels and the freeze-map overlay | Identical | Map-point keys are unchanged, but **their difficulty changes** | None | Positive if the map items leave the floor | Decide before pilot 2. The source-memory fact `cabins_nw` (`expected: map`) is unaffected: the cottages are already labelled. |
| e the item fixes | Identical | **The keys change** for re-authored items; added records change some items' told class (pushed → stream-told) | Every pushed addition moves an item to stream-told and out of H2t's contrast | Each removed floor item helps H2. Keep **24 L2/L3 items** in the H2 window. | The panel decides per item (`proposal-items.md`). Re-run `freeze-table.ts`, `freeze-bank.spec.ts` (recall guard), the told-class tests and `h2-power.ts`. |

**g.1 Parity rule kept.** No change differs between `radio` and `reasoning_intent`, except the practice feedback's closing line, which names the tool each group has (the training texts already differ in the same way). Nothing is pushed by a group's tool. The Thinker gets no new content.

**g.2 Source memory.** Three facts labelled `record_only` in `source-memory.ts` (`pp2_560`, `ek15_arrival`, `ek14_fuel`) have **every record pushed** in the built scenario (`evt.c07.028`; `atom.radio.10.2` and `evt.c10.032`; `evt.c07.036` and `evt.c10.017`). Their `expected` class is a covariate, so this is a side finding to correct whatever is decided here. Teaching the rule raises Haku use, which shifts the `ai_likely` facts' sources towards "Haku". That is the measure working, not a confound.

**g.3 Outcome feedback.** `32` §1 bans outcome feedback "in the session" because feedback moves confidence, which is H2's outcome. The practice feedback (b.3) comes before any scored item and is identical for everyone. It may still calibrate confidence a little for both groups. Two options:
- the version with answers, which teaches more;
- the source-only version, which shows where the information was and no answer.

Choose before pilot 2 and pre-register it.
