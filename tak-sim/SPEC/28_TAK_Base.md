# 28 — TAK base: the simulation as a Team Awareness Kit common operating picture

**Status:** Governing for the TAK-based build (`tak-sim/`). Adopted 13 Oct 2026.
**Scope:** how the participant's screen, the scenario's traffic and the exports follow the Team Awareness Kit (TAK; ATAK / WinTAK / iTAK, tak.gov) conventions. Nothing in the study design changes: `00`–`27` still decide *what* the participant sees and *when*; this file decides *how it looks and how it is encoded*.

> **Changelog**
> - **13 Oct 2026** — created. The researcher asked for "a new simulation which utilises the tak.gov simulation as a base, with everything discussed added". Decided with the researcher the same day: (1) the TAK base is a **TAK-style web simulation with Cursor on Target (CoT)**, not a live TAK Server feed and not an ATAK plugin (both would break I3 / I7, §7); (2) the build lives in the public repository `Test-your-thinking/tak-sim/`, with the full study content, by the researcher's choice (§8).

---

## 1. Why TAK

TAK is the situational-awareness suite that fire services already train on (CAL FIRE / FIRIS, DHS S&T trainings): a map-centred common operating picture (COP), unit symbols in MIL-STD-2525, GeoChat, drone video, range-and-bearing, overlays, data packages. Building the instrument on TAK conventions gives participants a screen that looks and behaves like a tool they could meet in service, and gives the study an encoding (CoT) that real TAK clients can open.

What is **not** taken from TAK: any TAK binary, plugin SDK or server. ATAK-CIV source is GPL-3.0 (I7 bans it); the tak.gov downloads need an account and are not redistributable. Everything here is a clean-room implementation of the publicly documented CoT event schema and the TAK user-interface conventions.

## 2. The pipeline

```
ScenarioContract ─► engine / orchestrator ─► render boundary (Renderable*, I4) ─► app/tak/compile.ts ─► CotEvent[]
                                                     │                                         │
                                                     └─► MapView geometry layers (SPEC/12)      ├─► TAK UI (contacts, GeoChat, 2525 symbols,
                                                                                                │          overlay manager, drone video, R&B)
                                                                                                └─► tools/tak/export.ts (CoT XML, data package)
                                                                                                         └─► tools/tak/replay.ts (outside study runs only)
```

1. **CoT is compiled only from `Renderable*` types.** `app/tak/compile.ts` imports nothing from `app/scenario/` except types that the render boundary already exposes; its input type is the render tree plus the public unit roster. Truth therefore cannot reach a CoT event by construction (I4), and a test walks every compiled event of every view with `assertNoTruthKeysPresent` and greps the serialised XML for the truth field names (`flag`, `breachGeometry`, `isOmissionCycle`, `actualPerimeterAtEnd`, `consistentWithEnvelope`, `whatWasHappening`).
2. **The fire and projection geometry is still drawn by the existing MapView layers.** SPEC/12's rules on the projection (one boundary, no gradient, no nested bands, validity label) are load-bearing for the primary DV and are not re-implemented. The CoT stream *mirrors* those shapes (as `u-d-f` drawings) for the exports and the overlay manager, but the participant's map keeps the tested layers.
3. **Units, aircraft and drones are drawn as MIL-STD-2525 symbols** (milsymbol, MIT) from their CoT type, replacing the old icon set in the TAK shell. The classic shell (`?klassinen`) keeps the old icons for comparison.

## 3. The CoT event model (`app/tak/cot.ts`)

One `CotEvent` per object per view step, following the public CoT 2.0 base schema:

| Field | Value in this simulation |
|---|---|
| `version` | `"2.0"` |
| `uid` | deterministic: `TAKSIM-<KIND>-<id>` (e.g. `TAKSIM-UNIT-EK11`, `TAKSIM-AIR-DR2`, `TAKSIM-SHAPE-PERIM-V07`); GeoChat `GeoChat.<senderUid>.<room>.<atomId>` |
| `type` | CoT type atoms (§4) |
| `how` | `m-g` (machine, GPS/AVL) for units and aircraft; `h-e` (human entered) for drawings and chat; `m-p` (machine predicted) for the projection |
| `time` / `start` / `stale` | ISO-8601 UTC derived from **virtual time only** (I2): the incident day is **Friday 26 July 2030**, Finnish summer time (UTC+3), so 13:00 local = `2030-07-26T10:00:00.000Z`. `stale` = the next view step, or the projection's validity horizon |
| `point` | `lat`, `lon` (WGS84, 7 decimals), `hae` (0 unless known), `ce`/`le` (9999999.0 when unknown, the CoT convention) |
| `detail` | `contact@callsign`, `__group@name/role`, `remarks`, `status@battery` (drones), `track@course/speed`, `link` (polygon vertices for shapes), `strokeColor`/`fillColor`/`labels_on`, `__chat` + `chatgrp` for GeoChat, `sensor@fov/azimuth/range` for drone cameras, and one custom element `__taksim` (`view`, `step`, `kind`, `source`) for the instrument's own bookkeeping |

**Serialisation is deterministic** (I1): attributes in a fixed order, numbers formatted with fixed decimals, events sorted by (`time`, `uid`). Serialising the same view twice is byte-identical, and a parse → serialise round trip is the identity.

## 4. Type mapping (`app/tak/symbols.ts`)

| Object | CoT type | 2525C SIDC (milsymbol) | Note |
|---|---|---|---|
| Rescue unit / tanker / forest-fire unit (EK*, KY*, VPK, OUT*) | `a-f-G-E-V` | `SFGPEV---------` | ground vehicle; label = callsign |
| Water shuttle (EK13) | `a-f-G-E-V` | `SFGPEV---------` | remarks say shuttle |
| Hose-laying robot (UGV1) | `a-f-G-E-X` | `SFGPEX---------` | unmanned ground equipment |
| Thermal multicopter (DR1, DR2), water drone (VD1) | `a-f-A-M-H-Q` | `SFAPMHQ--------` | rotary-wing UAV; battery in `status` |
| VTOL mapping drone (DR3) | `a-f-A-M-F-Q` | `SFAPMFQ--------` | fixed-wing UAV |
| Helicopter (HELI1) | `a-f-A-C-H` | `SFAPCH---------` | civil rotary wing |
| Spotter aircraft (SPOT) | `a-f-A-C-F` | `SFAPCF---------` | civil fixed wing |
| Participant (incident commander, command post) | `a-f-G-U-C` | `SFGPU-----A----` | the TAK "self" marker; ATAK's default self type, drawn with the headquarters staff (the generic `SFGPUC` reads "CBT") |
| Reported fire perimeter / detached front | `u-d-f` | — | red stroke, translucent fill |
| Projection envelope | `u-d-f` | — | `how="m-p"`, `stale` = validity horizon |
| Drone sensor footprint | `u-d-f` | — | `sensor` detail on the platform event |
| Spread-rate mark | `b-m-p-s-m` | — | spot marker with bearing and rate in remarks |
| Report / radio traffic (bubble, message log) | `b-t-f` | — | GeoChat; room by source (§5) |

The mapping is **DRAFT pending the domain reviewers** (`11` §7.29). It changes only symbols, never content.

## 5. The TAK shell (participant screen)

The default shell of `tak-sim` is the TAK shell; `?klassinen` restores the classic layout of `06`. The shell used is logged in the session header (`uiShell: "tak" | "classic"`), so data from the two shells are never pooled silently (`00` §6: a change in what the participant sees is a major change).

Layout, after ATAK/WinTAK:

- **Map** fills the window. Top-left: the self callsign and role, the scenario clock, the wind. Bottom-left: the cursor's coordinates in **MGRS** and lat/lon (mgrs, MIT), the scale bar. North-up, no rotation.
- **Toolbar** (right edge, vertical, icon + label): *Overlay Manager*, *Contacts*, *GeoChat*, *Video* (drones), *Range & Bearing*, *Haku* (search), and *Thinker* (AI group only, from the capability matrix — never shown to the Haku group).
- **Side pane** (right, ~380 px) opens one tool at a time and never covers the map's centre. **Haku, the Thinker and the index search open with the message log under them** (review 13 Oct 2026): as in the classic right column, pushed reports stay on screen while a participant searches or asks, so using a tool — which only the AI group has for the Thinker — never hides the pushed traffic.
- **The directive** (from V8, `27`) is a full-width strip between the status strip and the map, never over the map (it hid the places it names).
- **The participant's own plan marks are off by default** (review 13 Oct 2026; SPEC/12 does not provide for them under the projection); the Overlay Manager can show them. The decision strip (judgement, plan, SPAM, visible probes) stays at the bottom, unchanged; freezes still blank the whole screen (`08` §4).
- **GeoChat**: the message log as chat rooms (`app/tak/geochat.ts`) — *All Chat Rooms*, *Ground units* (EK/KY/OUT, VPK, UGV1), *Air & drones* (DR1–3, VD1, SPOT, HELI1, the drone team), *Command* (P2, P3, the situation picture, the emergency centre), *Support & weather* (weather station and forecast, water supply, agencies). Rooms by source, not by sector: a unit's sector changes between views, its source does not. Every message keeps its original wording, time and source; the room only groups them. Haku and Thinker keep their own panes (they are not people; presenting the Thinker as a chat contact would change the manipulation).
- **Contacts**: every unit and aircraft with callsign, type (roster), last-report time, task, water %; selecting one centres the map (logged). **No battery level** (QA 13 Oct 2026): the drones' battery reports are Haku-only records (`T2_system`), never pushed, so showing them would hand the participant information the design makes them search for. The CoT export may carry the modelled battery (it is not the participant's screen).
- **Overlay Manager**: toggles for symbol labels, sensor footprints, past perimeters, rate marks, the participant's own plan marks. **The projection and the current perimeter cannot be hidden** (they carry the primary DV).
- **Video**: one tile per drone in the air — a deterministic synthetic thermal frame of what the drone's footprint covers (from renderable data only), its callsign and footprint (no battery, as in Contacts). No real video, no network.
- **Range & Bearing**: two clicks give distance (m) and true bearing; the line stays until cleared. Logged as map use.

Every tool interaction is logged through `logMapUse` with a `tak_*` kind (opened pane, selected contact, toggled overlay, R&B measurement, chat room viewed) so tool use is analysable alongside Haku and Thinker use.

## 6. Exports and TAK interoperability (outside study runs)

- `npm run tak:export` writes `dist-tak/`: one CoT XML file per view (`V00.cot.xml` … `V14.cot.xml`), a timed stream `scenario.cot.jsonl` (virtual-time offset + XML per line) and **one TAK data package per view** `packages/tak-sim-V00.zip` … `V14.zip`: the view's picture at its last step plus all of the view's GeoChat, one event per entry `<uid>/<uid>.cot`, `MANIFEST/manifest.xml` with a `uid` parameter per content, in the layout ATAK, WinTAK or iTAK import as map items (not yet tried in a real client). Two runs are byte-identical.
- `npm run tak:replay -- --host <h> --port <p> [--proto tcp|udp] [--speed N]` streams the timed CoT to a TAK Server (TCP 8087 default) or to the SA multicast (`239.2.3.1:6969`, UDP) so a real TAK client can follow the scenario — for demonstrations, reviewers and the domain experts. It lives in `tools/` and nothing under `app/` may import it or `node:net`/`node:dgram` (I3, test).

## 7. Invariants

| Invariant | How the TAK base keeps it |
|---|---|
| I1 determinism | `app/tak` is under the determinism lint; ids and times derive from scenario ids and virtual time; serialisation sorted and fixed-format; export twice = byte-identical (test) |
| I2 no wall-clock | CoT times from virtual time only |
| I3 no network | no TAK server during a run; the replay tool is offline tooling; import-boundary test |
| I4 no truth in render | compile takes `Renderable*` only; truth-key walk + XML grep over every view (test) |
| I5 logging | TAK tool use goes through the existing durable `logMapUse` path |
| I6 retrieval closure | unchanged (Haku, Thinker unchanged) |
| I7 licence | milsymbol (MIT), mgrs (MIT); no TAK code; ATAK-CIV (GPL) not used |

## 8. The white-cell / exercise-control display (EXCON)

From the researcher's August design (the white cell's map, "continuous realistic change", in the style of Command: Modern Operations): a **separate, researcher-only page** `excon.html` (`npm run excon`, dev server only). It shows, per view and with a time slider and playback speed, the **truth** picture (the CA perimeter at the step's end, flags, designed events F7 / rekindle / omission / contradiction, branch truth) beside **the participant's picture** (the reported perimeter, the projection, units and drones, the CoT stream). It reads truth, so:

- it is served **only by the dev server** (a dev-only Vite plugin serves `app/excon/excon.html` at `/excon.html`); it is not a build input, so no build ever contains it;
- a Vite build guard fails any build whose output contains an `app/excon` module or an "excon" file, `npm run build:prod` re-scans `dist/ui` (`tools/deploy/excon-guard.ts`), and the production server answers 404 for any path containing "excon";
- `test/excon/isolation.spec.ts` checks that nothing outside `app/excon` imports it and that the participant entry's import graph never reaches it.

**Public repository.** The researcher chose to keep this build, with the full content and answer keys, in the public `Test-your-thinking` repository (13 Oct 2026), knowing participants could in principle find the keys. Before data collection, either make the repository private or move the build to the private `Fire-rescue-simulation` repository (`11` §7.29).

## 9. Open items (registered in `11` §7.29)

1. Domain review of the 2525 / CoT type mapping (§4) and the GeoChat room grouping (§5).
2. Whether the TAK shell is the study's shell or a parallel demonstration; the pilot so far ran the classic shell (`?klassinen`). A switch is a major change (`00` §6).
3. The public-repository exposure of the answer keys (§8).
4. Whether Haku and Thinker results should also be posted into GeoChat (currently not: they would look like people).
