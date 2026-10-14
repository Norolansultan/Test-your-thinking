# 29 — Game mode: a live, playable fire-ground on the study's terrain

**Status:** Governing for game mode (`app/game/`). Adopted 14 Oct 2026.
**Scope:** a separate mode in which the fire is simulated live, the player commands the units, and orders change the outcome. It reuses the study's terrain and TAK screen conventions. It is **not** the research instrument and changes nothing in it.

> **Changelog**
> - **14 Oct 2026** — created. The researcher asked to "think the simulation critically", to rebuild the map, environment and fire model, and to make the simulation game-like. A critical read of the instrument (summary in §1) found that nothing a participant or a crew does reaches the fire. Decision: build that as a separate game mode (§2), never as a change to the study.

---

## 1. What the study's simulation is, and why a game needs more

- **Map.** Fictional generated terrain (SPEC/23 §11), drawn offline into one 5000 px raster (4 m/px, 20 × 20 km) and cut into 4 × 4 image tiles. Roads, water, bogs and 157 buildings exist as vectors in map pixels (`content/site/build/topo-features.json`) but never reach the browser; labels are baked in; forest type is not drawn, so the fuel the fire runs on is invisible.
- **Environment.** Fuel and elevation grids of 400 × 400 cells at 25 m (10 × 10 km): 13 fuel classes, synthetic stand pattern, pine heath 57 %, drained peat 23 %. Weather as data is only wind per 20 minutes; temperature and humidity exist only in prose.
- **Fire.** The Alexandridis (2008) cellular automaton, run offline with a frozen seed; per 20-minute cycle the number of steps is calibrated so the head matches an authored rate, so live wind barely matters. Spot fires and rekindles are hand-placed. Shipped as 20-minute polygon snapshots.
- **Suppression.** None reaches the fire: hose lines, tanks, drops and breaks exist only as text in the traffic corpus.
- **Units.** Scripted moves by cycle; positions snapped to the CA's fire edge afterwards; no movement model; they jump between snapshots.
- **The participant** can look, search, ask and record a plan the world ignores — deliberately (SPEC/00 §5): the study measures judgement under identical stimulus.

A game needs the opposite: continuous time, a fire that responds to wind, terrain, moisture and water, units that move and run out of water and battery, consequences, and an outcome.

## 2. Separation from the study

1. Game mode is offered on the demonstration start page only. Under `?tuotanto` (the study) it is not shown and its code is never loaded (a separate, lazily imported chunk).
2. Nothing it produces enters the study's session log, telemetry, IndexedDB session store or upload; data from game mode are never pooled with study data.
3. Its default scenarios do not replay the study's incident minute by minute; the terrain and units are shared, the story and timing are the game's own. A participant who has played the game has learned the terrain, so participants must not be given game mode before their session.
4. The study's seven invariants bind the instrument, not the game. Game mode keeps I1 in a weaker form — the same scenario, seed and command log replay the same game on one engine (integer hashing for randomness, virtual time; the determinism lint applies) — but floating-point results may differ across browsers, which is acceptable for a game and would not be for the study.

## 3. Architecture (`app/game/`, contracts in `contracts.ts`)

| Part | Folder | What it does |
|---|---|---|
| World | `world/`, `tools/game/build-world.ts` → `content/game/world.json` | Fuel and elevation grids; the topo vectors converted to local metres: road graph with A* routing and off-road legs, water draw points and scoop points, buildings as assets with values, settlements, the 110 kV line, labels (fi/en), command post, entry nodes |
| Fire and weather | `fire/`, `weather/` | Elliptical rate-of-spread cellular model: wind, slope and fine-fuel moisture (temperature, RH, applied water) set the rate per direction; flaming residence time, smouldering and rekindle, crown fire and ember spotting by integer hashing; water extinguishes or cools; fire breaks remove fuel; a forecast tool runs a copy forward |
| Game loop | `sim/`, `scenarios/` | Units with speeds, tanks, pumps, hose, fire-break rate, sensors, endurance and crew safety limits; orders (move, attack, hose line, fire break, refill, shuttle, recon, drop, protect, hold); fog of war from sensor ranges; assets burn unless protected; radio traffic in Finnish and English; scripted events (power line de-energised, units recalled, wind warnings); objectives, points and grade; command log and replay |
| Screen | `ui/` | The TAK look: live fire drawn on the topo basemap with a fuel overlay, the player's fogged picture, 2525 unit symbols, unit selection and orders on the map, GeoChat fed by the radio, wind, clock and speed controls (pause, 1×–60×), forecast overlay, objectives, briefing and debrief with the score |

## 4. Open items

1. All fuel, rate-of-spread, intensity, unit and scoring numbers are PROVISIONAL game values with a one-line rationale each in code; a domain reviewer may tune them.
2. Whether game mode should later serve as training before a study session (it would then have to use different terrain).
