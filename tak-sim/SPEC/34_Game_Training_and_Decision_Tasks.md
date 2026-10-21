# 34 — Game mode: training course, decision tasks and the instructions panel

**Status:** Governing for game mode (`app/game/`) from 21 Oct 2026. Extends `29`; changes nothing in the study instrument.
**Scope:** three additions to game mode, asked for by the researcher on 21 Oct 2026 ("make it more like the other simulation [XVR]; a longer introduction that teaches the most critical things to check, explained before the simulation runs; instructions available all the time; everybody has the same simulation and solves a static task in each scenario … execute this in the game mode").

> **Changelog**
> - **21 Oct 2026** — created. Every Finnish text is DRAFT for the native-speaker check; every doctrine statement is DRAFT for the domain reviewer.

---

## 1. Why in game mode only

The study stays as `30` and `32` fix it: identical scripted views, freezes that blank the screen, no scores or outcome feedback. Teaching participants the scenario's critical cues before the session would teach to the freeze items and do the guide's job for both groups (`32` §1). Game mode is professional development offered after data collection (`29` (ba)), so it may teach, give feedback and score. The recruitment gate, the lazily loaded chunk and the separation rules of `29` §2 and (ay) apply to everything here.

## 2. The start page of game mode

Three tracks, in this order:

1. **Perehdytys / Training course** — modules that teach each element a fire-ground commander must check (§3). Recommended first; nothing is locked.
2. **Tehtävät / Decision tasks** — fixed situations, one task each, the same for every player (§4).
3. **Vapaa peli / Free play** — the existing scenarios (`29` §4), unchanged.

Progress (modules passed, tasks done and their best result) is kept in the browser (`localStorage`, key prefix `tak-game.`, every read and write in try/catch, the page works without it). Nothing goes to the study's stores or the server.

## 3. Training course

A module = 2–4 short explanation pages (text, one illustration drawn from the game map where useful) → one hands-on **exercise** (a small decision task, §4, on its own part of the map) → 2–3 **check questions** (multiple choice; a wrong answer shows the explanation and the question again; the module is passed when every question has been answered right once).

Modules (topic id → content):

| # | Topic | What it teaches |
|---|---|---|
| 1 | `map` | Reading the maastokartta: contours and slope, mires and their ditches, fields, roads by class and what a truck can use, water points, the 20 kV line, the fuel layer |
| 2 | `fire` | Fire behaviour cues: wind and slope push the head, fuel types (pine heath, spruce, drained peat), flanks and the heel, spotting, smouldering in peat and the rekindle risk |
| 3 | `recon` | The picture: the map shows only what units have seen; drones and their endurance; when the picture is old |
| 4 | `orders` | The orders: direct attack, hose line, fire break, drops, protect; anchor and flank (start from a barrier, work along the flanks toward the head) |
| 5 | `water` | Water logistics: tank sizes, how long a line lasts, refill points, the tanker's shuttle, road distance vs straight line |
| 6 | `safety` | Crew safety: LACES (lookouts, communications, escape routes, safety zones), the crews' intensity limit, the live power line (no water within 15 m until de-energised on request), smoke |
| 7 | `mopup` | Mop-up and handover: the fire is not out while it smoulders; checking edges with the thermal drone |

The exercises are short (5–15 game minutes, fast-forwardable) and check one thing each (e.g. module 3: "find the second fire with DR1 before 10:20").

## 4. Decision tasks

A decision task is a fixed situation and one task. Everyone gets the same one:

- **Fixed:** scenario, pre-burn, weather and seed are constants of the task; a replay never changes the seed (unlike free play).
- **Planning phase:** the game opens paused at the task's moment. The player reads the task and the picture and gives orders; the clock cannot run. "Toteuta / Commit" ends planning.
- **Run:** the game runs from the commit to the task's horizon at high speed with no further orders (`allowLaterOrders: false`, the default). A task may allow later orders when its point is reacting to an event.
- **Result:** each criterion met or not, with the reason; the reference plan (expert commands, replayed on the same seed) shown beside the player's outcome, with its explanation and the teaching points. Points and a grade as in free play, so players can compare; never pooled with study data.

Tasks (topic → task), 6–8 in all, each on a part of the map and at a time that touches no study keyed moment (`29` (ay); the separation test covers tasks):

| Topic | Task |
|---|---|
| `orders` | First arriving units: anchor at the road and flank toward the head, keep the fire under N ha in 40 min |
| `water` | Keep two attacking engines supplied for 45 min with one tanker and the nearest water by road |
| `safety` | A fire under the live 20 kV line: contain it without any water within 15 m before the line is de-energised; request de-energising |
| `recon` | Two smoke reports, one picture: find and size both fires in 15 min with the drones you have |
| `fire` | Wind shift forecast at +30 min: place the crews so no crew is on the new head's path when it turns |
| `protect` | Three cabins and a farm in the fire's path, resources for two: protect the ones that can be saved |
| `mopup` | A contained fire in drained peat: find and put out the smouldering edge so it does not rekindle within 60 min |

Each task ships its reference command list and is validated by a test: the reference meets every criterion; doing nothing meets fewer than all.

## 5. Instructions panel (Ohjeet / Instructions)

Available on every game screen (course, tasks, free play) from the toolbar, always the same place:

1. **This task** — the task's text and criteria (tasks and exercises).
2. **Checklist** — the commander's situation check as a short card: fire (where is the head, how fast, toward what), weather (wind now and forecast), terrain and fuel, people and property at risk, resources (who is where, water left), water supply, safety (LACES, the power line, smoke), the picture's age. Generic doctrine, never a hint for the current task.
3. **Orders and keys** — the existing help list.
4. **Map symbols** — the legend.

## 6. Realism toward XVR

Within the 2D TAK screen: units drive along roads (exists), the live fire and smoke (exist), the fuel layer (exists). No 3D view is built; XVR's on-scene 3D is out of scope (noted for later).

## 7. Acceptance

- `npx tsc --noEmit -p .`, `npm run lint:determinism`, `npm test` pass; the study's tests untouched except the separation test widened to cover tasks and course exercises.
- Every task's and exercise's reference meets all its criteria on its fixed seed; idle play does not.
- No keyed study moment touched (separation test).
- The study build (`?tuotanto`) loads no new code (the game chunk stays lazy).
- Every course and task text in fi and en; fi marked DRAFT in the content files.
