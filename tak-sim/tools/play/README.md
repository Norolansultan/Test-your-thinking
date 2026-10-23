# Play harness — LLM players without a browser

A CLI that lets an LLM "player" play the TAK wildfire command session turn by turn, as a participant would. It runs the **real
session engine** headless — the app's `SessionOrchestrator` over `buildDemoScenario()`, with the options the app gives a study
session (`?tuotanto`: study shell, AI-literacy test, intro video, map-reading pretest, practice feedback, guided tour, visible
probes, SA levels hidden, nothing skippable) — in the **Haku group** (cell `radio`), on a **virtual clock**. The player sees what
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
drifting. `<run>/transcript.md` gets every command and what it printed (refused ones too); `<run>/screens/NNN-*.png` the images.
Keep run directories outside `tools/` (or in `tools/play/.smoke/`, which git ignores).

## Commands

Lines starting `»` are the harness's own (how to answer, the period's elapsed seconds); everything else is the app's text.
Every command ends with a status line and what the participant would have noticed meanwhile (new messages, a freeze, the SPAM
prompt, the period's end). Use `look` after any command to see the whole screen.

| Command | Screen | Cost (s) |
|---|---|---|
| `start --audience expert\|public --lang fi\|en` | a new run; consent, the AI-literacy test (skipped), the browser check and the pre-session fatigue item (4/7) are completed neutrally; prints the first screen | — |
| `look` | the screen as text; in a view also the live map PNG; during a freeze only the freeze screen (the app blanks the map and log) | 0 |
| `continue` | leaves the guided tour, the intro video, the practice feedback, the training text, the hinge's directive and the debrief | tour 60, video 60, feedback 45, training 45, hinge 30 + 5, debrief 20 |
| `wait [seconds]` | lets time run (default 10, at most 300); stops early when something changes (a freeze, the SPAM prompt, new messages, the decision panel, the minimum, the period's end) | as waited |
| `haku "<question>"` | Haku's chat: opens the pane, types (the records gate at the moment it is sent), shows the answer, back to GeoChat | 15 + 15 |
| `haku-history` | Haku's earlier answers | 5 |
| `map alue\|palo\|2km\|in\|out\|reset [center=x,y]`, `map legend` | moves the live map as the zoom buttons, the wheel and a drag do (x,y: pixels of the last map image); shows or hides the legend | 3 |
| `contacts [call sign]` | the TAK Contacts pane (type, task, water, last message); with a call sign the map centres on it | 8 |
| `measure x1,y1 x2,y2` | Range & Bearing between two pixels of the last map image; the line stays on the map | 8 |
| `consult open\|dismiss` | the consult notification's buttons | 2 |
| `plan main=L2 posture=direct_attack secondary=none\|L3:task.hold-line drones=carry_on\|L1:task.thermal-survey [departure=yes reason=crew_safety]` | sets the plan form (as its buttons allow) | 10 |
| `confirm` / `revise` | records the plan ("Vahvista kohdennus") / reopens it ("Muuta kohdennusta") | 2 / 2 |
| `plan-confidence 25\|50\|75\|100` | the plan's confidence after a main view | 4 |
| `review keep\|change` | the plan review (phase B) | 4 |
| `spam-ready`, `spam-collapse`, `spam-expand` | the SPAM ready prompt | 2, 1, 1 |
| `spam-answer <letter> <confidence>` (`spam-answer <confidence>` for the confidence alone) | the SPAM question; the choice is final | 10 |
| `freeze-answer <letter\|x,y> <confidence>` / `freeze-submit` | the freeze, one item at a time (the one on screen), no going back; a map item is answered in the freeze map PNG's pixel coordinates. Options are lettered a, b, c … and no item or option id is shown, as in the app (some ids name the key); runs played before 24 Oct 2026, which named the item and the option id, still replay | 10 / 2 |
| `probe-answer no` · `probe-answer yes a,b` · `probe-answer <letter> [confidence]` · `probe-answer <value>` | the visible probes (V13, V14) | 10 |
| `hinge-answer <letter>` | the hinge's question | 10 |
| `pretest-answer <item> <option>` | the map-reading pretest (its extract as a PNG) | 20 |
| `primer-answer <n>`, `primer-retry`, `primer-next`, `primer-back` | the primer (public) | 10, 5, 20, 20 |
| `glossary <term>`, `help [glossary\|roster\|legend] [letter]` | the glossary and the help card (public; logged as the app logs them) | 5, 10 |
| `quest-answer <item> <option>` / `quest-submit` | the post-session questionnaire: the source-memory items are the player's; the rest is left blank (every item is optional) | 6 / 20 |
| `score [--force]` | **analyst only**: `<run>/score.md` and `score.json` | — |

The costs are in `costs.ts` (one place, DRAFT guesses at a practised participant's pace). `look` is free. The results step after
the questionnaire ("Personal results after the study") is answered no, neutrally, like the steps before the session.

## The map

The live map PNG is the app's own `MapView` in the TAK shell's mode (`map-page.ts`, bundled with esbuild, drawn by MapLibre in
headless Chromium through Playwright): the basemap tiles, the reference overlay (sector outlines and names, roads, the bridge, the
power line, the command post, the settlements), the fire as reported (burnt area, burning zone, edges, head, spot fires, drone
detections, earlier perimeters with their times), the projection with its labels, the units with their call signs and stacks,
the TAK info card (clock, wind), the coordinate readout with the scale bar, and the legend (open: the harness's default, as the
tour opens it; `map legend` collapses it). North is up; the app draws no north arrow. The camera is the app's opening frame at a
1000 × 680 map (the TAK map's size at a 1440 × 900 window with GeoChat open) until the player moves it; a new view opens on the
opening frame again, as in the app. A `map_point` freeze item's map is the plain basemap (the app's memory-check map shows nothing
else) over the study area, with a pixel grid labelled in the PNG's own coordinates; `freeze-grid.ts` turns x,y back into WGS84 with
the app's basemap projection (`basemap-px.ts`). Playwright is imported from `PLAY_PLAYWRIGHT` (default
`/opt/node22/lib/node_modules/playwright/index.mjs`), the browser from `PLAY_CHROMIUM` (default `/opt/pw-browsers/chromium`).

## Scoring (analyst only)

`score` replays the run and writes, for every freeze and SPAM item of the difficulty audit (`tools/review/difficulty-audit.ts`:
its moment and key records), the player's answer, the key, right or wrong, the confidence, and for each key record whether the
player had it before the item's moment — in the message log (pushed and delivered), returned by one of their Haku questions (which
one), or never — read from the session's own log (`atomExposure`; the freeze's anchor is `freeze_started`, a SPAM item's its answer,
as the tools stay usable while it is open). Then every Haku question with the records it returned and the later items those were
key to. The keys never reach the player's screens; `test/tools/play.spec.ts` checks it.

## Smoke

`npx tsx tools/play/smoke.ts [outDir]` plays a whole session in both audiences with a dumb policy (waits, every item's first
option at confidence 50, one Haku question a period, the same plan every period, kept at the review) and replays each run from
disk. On the development container (23 Oct 2026): expert/fi 314 commands, virtual 52 min, played in 0.4 s, replayed in 0.4 s;
public/en 338 commands, virtual 57 min, 0.5 s and 0.4 s. A CLI command takes about 1.2 s without a map (tsx start-up, the
scenario's build, the replay) and about 3 s with the freeze map or the pretest extract, about 5 s with the live map (Chromium,
MapLibre, the tiles).

## Limitations

- **Haku is the template fallback, not the study's model.** No model is available offline: the transport is the proxy's own
  handler with no model client (`client: null`, its `no_api_key` path) and no vector index (lexical-only retrieval, as
  `tools/demo-bridge` runs it), time-gated by the handler. The answer is the app's four-part template over the records retrieved
  (`template-answer.ts`): the top record's text, up to three sources with their clocks, its certainty. The study's answers are
  written by a model over hybrid retrieval and will differ; every Haku answer is labelled so.
- **No real-time pressure** but the virtual-time costs: the player can think for as long as it likes between commands, and `look`
  is free. The period's caps, the freeze's cap, the SPAM answer window and the pretest's four minutes run on the costs only.
- The UI's micro-interactions are not simulated: hovers, pointer tracks, camera records (`viewport_changed`), the TAK shell's
  mount records, the window-size guard. The records the measures read are kept: Haku's `tab_selected` and pane records, the SPAM
  card's and freeze screen's answer changes, Contacts and Range & Bearing records, the legend toggle.
- The intro video's content and the primer's illustrations are not available as text. The guided tour is printed whole (its
  pointers at screen elements are not shown). The Video and Overlay Manager panes are not offered.
- The live map is drawn at one window size; the opening frame (and so what the first look shows) depends on it, as in the app.
