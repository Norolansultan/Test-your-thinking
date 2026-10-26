# Play harness — LLM players without a browser

A CLI that lets an LLM "player" play the TAK wildfire command session turn by turn, as a participant would. It runs the **real
session engine** headless — the app's `SessionOrchestrator` over `buildDemoScenario()`, with the options the app gives a study
session (`?tuotanto`: study shell, AI-literacy test, the training incident, intro video, guided tour, visible probes, SA levels
hidden, nothing skippable) — in the **Haku group** (cell `radio`), on a **virtual clock**. The player sees what
the participant's screen shows, in the session language, with the app's own strings; the live map as a PNG drawn by the app's own
`MapView`. Expert (`--audience expert`) and public (`--audience public`, SPEC/35: primer, glossary, help card) sessions both run.

```sh
# from tak-sim/
npm run play -- start --run /tmp/run1 --audience expert --lang fi
npm run play -- look --run /tmp/run1
npm run play -- haku "Mistä vettä saa?" --run /tmp/run1
npx tsx tools/play/play.ts wait 30 --run /tmp/run1          # the same, without npm
```

Flags: `--run <dir>` (required: the run's directory), `--no-map` (no PNGs: text only, about 1.2 s a command).

## What a run is

`<run>/actions.json` is the run: its configuration and every command the player issued, with the virtual milliseconds each of its
costs spent. Every call **replays** it into a fresh session (a whole session replays in about 0.4 s), applies one command, prints
the result, draws its images and saves. A refused command (wrong screen, bad arguments) prints `Refused: …` and is not recorded.
A run that no longer replays to the same virtual time (the app changed since it was played) stops with an error instead of
drifting. The play-test runs of 23–24 Oct 2026 replay only on a checkout before the consult notice's R6 timing (commit `93d67ce`,
25 Oct 2026: a `wait` that the old 60 s notice ended no longer ends there); score them on `8789fcb`, where Haku's template answers
are also the ones the players saw (B6 changed them in `62a10f8`). `<run>/transcript.md` gets every command and what it printed (refused ones too); `<run>/screens/NNN-*.png` the images.
Keep run directories outside `tools/` (or in `tools/play/.smoke/`, which git ignores).

## Commands

Lines starting `»` are the harness's own (how to answer, the period's elapsed seconds); everything else is the app's text.
Every command ends with a status line and what the participant would have noticed meanwhile (new messages, a freeze, the SPAM
prompt, the period's end). Use `look` after any command to see the screen; it lists only the messages that came in since your last
`look` (with a count of the earlier ones), and `look --all` lists the whole message log.

| Command | Screen | Cost (s) |
|---|---|---|
| `start --audience expert\|public --lang fi\|en` | a new run; consent, the AI-literacy test (skipped) and the browser check are completed neutrally; prints the first screen, the pre-session form (runs started before 25 Oct 2026 had it completed neutrally: fatigue 4/7, the rest blank) | — |
| `look`, `look --all` | the screen as text; the message log's rows since the last `look`, after a count of the earlier ones (`look --all`: every row, the new ones marked `*`; 25 Oct 2026, B10); in a view also the live map PNG; during a freeze only the freeze screen (the app blanks the map and log) | 0 |
| `continue` | leaves the training incident's intro and section cards, an item's feedback and S5's recording; the guided tour, the intro video, the group's training text, the hinge's directive and the debrief | card 8, feedback 10, S5 60; tour 60, video 60, training text 45, hinge 30 + 5, debrief 20 |
| `wait [seconds]` | lets time run (default 10, at most 300); stops early when something changes (a freeze, the SPAM prompt, new messages, the decision panel, the minimum, the period's end) | as waited |
| `haku "<question>"` | Haku's chat: opens the pane, types (the records gate at the moment it is sent), shows the answer, back to GeoChat. On the training's S3 cards: its Search, over the training's own records only (logged `training_haku_*`, never `ai_chat_*`) | 15 + 15 |
| `chip` | V8–V14 (the Haku group): clicks the suggested question above Haku's input ("What is new in this period's records?"), which `look` shows exactly when the app does; asked through Haku's path, logged `viaChip` (25 Oct 2026, B1). The guide group's Thinker chip never shows in this harness (it plays the Haku group) | 2 + 15 |
| `haku-history` | Haku's earlier answers | 5 |
| `map alue\|7km\|2km\|in\|out\|reset [center=x,y]`, `map legend` | moves the live map as the zoom buttons, the wheel and a drag do (x,y: pixels of the last map image; `7km` is the whole study area, the button read "Palo" until 24 Oct 2026 and `palo` still replays); shows or hides the legend | 3 |
| `contacts [call sign]` | the TAK Contacts pane (type, task, water, last message); with a call sign the map centres on it | 8 |
| `measure x1,y1 x2,y2` | Range & Bearing between two pixels of the last map image; the line stays on the map. In the training: pixels of its map image (its grid's labels); the readings go with the item's answer (`measures`), and nothing is logged (its map use is not) | 8 |
| `consult open\|dismiss` | the consult notification's buttons | 2 |
| `plan main=L2 posture=direct_attack secondary=none\|L3:task.hold-line drones=carry_on\|L1:task.thermal-survey [departure=yes reason=crew_safety]` | sets the plan form (as its buttons allow) | 10 |
| `confirm` / `revise` | records the plan ("Vahvista kohdennus") / reopens it ("Muuta kohdennusta") | 2 / 2 |
| `plan-confidence 25\|50\|75\|100` | the plan's confidence after a main view | 4 |
| `review keep\|change` | the plan review (phase B) | 4 |
| `spam-ready`, `spam-collapse`, `spam-expand` | the SPAM ready prompt | 2, 1, 1 |
| `spam-answer <letter> <confidence>` (`spam-answer <confidence>` for the confidence alone) | the SPAM question; the choice is final; its answer window's time left is on the card, as in the app | 10 |
| `freeze-answer <letter\|x,y> <confidence>` / `freeze-submit` | the freeze, one item at a time (the one on screen), no going back; a map item is answered in the freeze map PNG's pixel coordinates. Options are lettered a, b, c … and no item or option id is shown, as in the app (some ids name the key); runs played before 24 Oct 2026, which named the item and the option id, still replay | 10 / 2 |
| `probe-answer no` · `probe-answer yes a,b` · `probe-answer <letter> [confidence]` · `probe-answer <value>` | the visible probes (V13, V14) | 10 |
| `hinge-answer <letter>` | the hinge's question | 10 |
| `hinge-fatigue <1–7>` | the hinge's optional fatigue item, once its question is answered (one click; again: the last one counts; 25 Oct 2026, B2) | 3 |
| `training-answer <letter \| x,y> [confidence]` | the training incident's item on screen, once, final: a choice by its letter, a point by the image's grid (its own pixels, the labels in the margin: the live map's, or the memory item's blank map); a question card (S3) and the memory-check rehearsal (S4) take the confidence too. Its feedback follows (`look`), left with `continue` | 20 |
| `map 2.5km\|1km\|reset [center=x,y]` | the training's live map, locked to its square: its two zoom buttons | 3 |
| `primer-answer <n>`, `primer-retry`, `primer-next`, `primer-back` | the primer (public) | 10, 5, 20, 20 |
| `glossary <term>`, `help [glossary\|roster\|legend] [letter]` | the glossary and the help card (public; logged as the app logs them) | 5, 10 |
| `quest-answer <item> <option\|number>` / `quest-submit` | the questionnaires (25 Oct 2026, B2): the pre-session form (fatigue 1–7, hours slept 0–24, and in an expert session the recent shift) and, after the session, the source-memory items, the self-estimate (0–100 %) and the group's influence items (periods 0–14; 0–100 in tens) are the player's; the rest of the post-session form is left blank (every item is optional) | 6 / 5 (pre), 20 (post) |
| `score [--force]` | **analyst only**: `<run>/score.md` and `score.json` | — |

The costs are in `costs.ts` (one place, DRAFT guesses at a practised participant's pace). `look` is free. The results step after
the questionnaire ("Personal results after the study") is answered no, neutrally, like the steps before the session.

## The map

The live map PNG is the app's own `MapView` in the TAK shell's mode (`map-page.ts`, bundled with esbuild, drawn by MapLibre in
headless Chromium through Playwright): the basemap tiles, the reference overlay (sector outlines and names, roads, the bridge, the
power line, the command post, the settlements, the brook's second label (Myllyoja)), the fire as reported (burnt area, burning zone, edges, head, spot fires, drone
detections, earlier perimeters with their times), the projection with its labels, the units with their call signs and stacks,
the TAK info card (clock, wind), the coordinate readout with the scale bar, and the legend (open: the harness's default, as the
tour opens it; `map legend` collapses it). North is up; the app draws no north arrow. The camera is the app's opening frame at a
1000 × 680 map (the TAK map's size at a 1440 × 900 window with GeoChat open) until the player moves it; a new view opens on the
opening frame again, as in the app. A `map_point` freeze item's map is the plain basemap (the app's memory-check map shows nothing
else) over the study area, with a pixel grid labelled in the PNG's own coordinates; `freeze-grid.ts` turns x,y back into WGS84 with
the app's basemap projection (`basemap-px.ts`). Playwright is imported from `PLAY_PLAYWRIGHT` (default
`/opt/node22/lib/node_modules/playwright/index.mjs`), the browser from `PLAY_CHROMIUM` (default `/opt/pw-browsers/chromium`).

## The training incident (revision (bp), 26 Oct 2026)

The map training and VP's practice freeze and feedback are retired; the training incident takes the map training's step
(`training_incident`, after the pre-session item and, in a public session, the primer; before the intro video). `look` prints its intro,
its section cards, each item (stem and options in the session language, the tools open for it: S1 the map and R&B, S2 the message log
too, S3's question cards also Search and the card's 60 s, S4 the freeze screen with confidence), the memory item's exposure (`wait` it
out) and blank map, the feedback after every item (the app's words, `TRAINING_TEXT`), S5's recording of the group's tool (the Haku
group's here), and the cap's countdown. Its live map is the app's `MapView` over the training's scene, locked to its square, with work
package B's overlay (`drawTrainingOverlay`: the item's marks, the memory unit, the feedback's drawing) and a grid labelled in the PNG's
own pixels (play-test B12: a point read off the labels is the point answered). The seams to B's orchestrator (the step, the snapshot's
training view, the training methods) are in `training-host.ts`; before the merge a training screen is refused with that reason.

## Scoring (analyst only)

`score` replays the run and writes, for every freeze and SPAM item of the difficulty audit (`tools/review/difficulty-audit.ts`:
its moment and key records), the player's answer, the key, right or wrong, the confidence, and for each key record whether the
player had it before the item's moment — in the message log (pushed and delivered), returned by one of their Haku questions (which
one), or never — read from the session's own log (`atomExposure`; the freeze's anchor is `freeze_started`, a SPAM item's its answer,
as the tools stay usable while it is open). Then every Haku question with the records it returned and the later items those were
key to. The keys never reach the player's screens; `test/tools/play.spec.ts` checks it.

## Smoke

`npx tsx tools/play/smoke.ts [outDir]` plays a whole session in both audiences with a dumb policy (waits, every item's first
option at confidence 50, one Haku question a period — from V8 the chip —, the same plan every period, kept at the review, the
questionnaires' items and the hinge's fatigue item answered) and replays each run from disk. On the development container (25 Oct
2026): expert/fi 328 commands, virtual 53 min, played in 0.4 s, replayed in 0.4 s; public/en 351 commands, virtual 57 min, 0.4 s and
0.3 s; the consult notice in 8 of 14 views in both (the dumb policy plans before 60 s in most single-step views, R6), 7 chip
questions. A CLI command takes about 1.2 s without a map (tsx start-up, the
scenario's build, the replay) and about 3 s with the freeze map, about 5 s with the live map (Chromium, MapLibre, the tiles).
Revision (bp), 26 Oct 2026: the smoke plays the training incident through (each card and feedback left, the memory unit waited out,
each item's first option or the middle of its map, confidence 50 where asked, one Search question on the first S3 card, S5 left) and
checks its pages in the session language; it needs work package B's orchestrator, and stops with that refusal before the merge.

## Limitations

- **Haku is the template fallback, not the study's model.** No model is available offline: the transport is the proxy's own
  handler with no model client (`client: null`, its `no_api_key` path) and no vector index (lexical-only retrieval, as
  `tools/demo-bridge` runs it), time-gated by the handler. The answer is the app's four-part template over the records retrieved
  (`template-answer.ts`): the top record's text, up to three sources with their clocks, its certainty. The study's answers are
  written by a model over hybrid retrieval and will differ; every Haku answer is labelled so.
- **No real-time pressure** but the virtual-time costs: the player can think for as long as it likes between commands, and `look`
  is free. The period's caps, the freeze's cap, the SPAM answer window and the training's 12-minute cap and 60 s cards run on the costs only.
- The UI's micro-interactions are not simulated: hovers, pointer tracks, camera records (`viewport_changed`), the TAK shell's
  mount records, the window-size guard. The records the measures read are kept: Haku's `tab_selected` and pane records, the SPAM
  card's and freeze screen's answer changes, Contacts and Range & Bearing records, the legend toggle.
- The intro video's content and the primer's illustrations are not available as text. The guided tour is printed whole (its
  pointers at screen elements are not shown); since revision (bp) its steps refer back to the training. The Video and Overlay Manager
  panes are not offered.
- The live map is drawn at one window size; the opening frame (and so what the first look shows) depends on it, as in the app.
