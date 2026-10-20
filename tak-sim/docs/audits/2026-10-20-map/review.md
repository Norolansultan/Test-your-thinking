# Map rebuild: gate R review and logistics fixes (SPEC/33 §5 gate R)

20 Oct 2026, the logistics-fixup stage. Base: `303baf8` (content re-keyed, gate D). Reviewed: the diff since `9ed3403` for
`tools/topo-map`, `tools/fire-ca`, `app/scenario` and `content`, read with a firefighter's eye (skills `wildfire-tactical-check`,
`wildfire-radio-realism`): units on impossible ground, times the road graph cannot meet, water sources, the fire against its
barriers, names against map features, keys against reports, parity. Every Finnish string below is a DRAFT for the native-speaker check.

## 1. Fixed in this stage

| # | Flaw a firefighter would see | Fix | Evidence |
|---|---|---|---|
| F1 | The Koivuoja forest road (the north band's spur that ends at Koivuoja, ~1.1 km north of R1) joined the network only by a ~36 km loop through the north. EK11's truck stood on it 15:20–16:20 and EK12's 16:40–17:40 (on its sister spur), so neither could have driven there, and EK13's basins "perillä 16.34" / EK12's "perillä 16.41" from W3 were impossible. | A forest road from the spur's end south, across Koivuoja (culvert), to R1 at ~(1710, 455), routed like every generated forest road (`roads.ts` `koivuojaLink`, id `koivuoja_link`), added last so every other road stays as generated; the spur's end leaves the dead-end list. | Fuel grids change only by the link's 53 road cells (one a Koivuoja brook cell); `fire-ca.json` / `fire-ca.geojson` byte-identical; `map:check` 0 violations (network faces 3, none rectangular). Road route W1 → EK11's truck 4.9 km (16.34 promised, 16.35–16.36 on the road), W3 → EK12's truck 5.1 km (16.41 promised, ~16.38). |
| F1a | — | The link is not a parking place (`deployment.ts` `NO_PARKING_ROAD_IDS`). As one, it would take EK11's 15:20 truck to the far side of Koivuoja (a 420 m line, not 600 m), re-seed the traffic from step 7 and break V5 `hose_short`'s key atom ("linjaa jo 600 m"). The bundle stays byte-identical. | Open item R2 below. |
| F2 | At 13:40 EK11's truck stood on R1 exactly where the head's west flank crosses the road by 14:00 (`placement.ts` logged "no parking spot reachable"), and stayed there to be burned over. | A vehicle the step's flank will run over, with no road round the fire, backs out along its road at once, ahead of the flank, up to 200 m, to the road point nearest its crew clear of the step's front by the vehicle clearance (60 m) whose line to the crew crosses none of it (`placement.ts` `backOut`). | EK11's truck moves ~100 m west on R1, line 240 → 340 m; the only bundle change is that and EK14's terrain vehicle 30 m further west (vehicle spacing). No traffic draw moved. Crew safety: 18 findings, 0 unexplained (the stale exemption `2:EK11` removed). |
| F3 | From 19:00 the south-east front reaches the live 20 kV line (CA: 201 m at 19:00, 7 m at 19:20, 1 m at 19:40) and no record said so. | `designed-events.ts` `f7.grid_at_line` (step 18, 19:18, recorded T2, situation log, both groups, the same atom): "Alueen verkkoyhtiön käyttökeskus: palo on nyt 20 kV:n sähkölinjan kohdalla kaakkoisrintamalla. Linja on edelleen jännitteinen. Poiskytkentää on pyydetty ja asentaja on matkalla erottimelle, tieto kytkennästä annetaan erikseen. Turvaetäisyydet voimassa, palava pylväs voi pudottaa johtimen maahan." (+ English, ExCon timeline). | After V12's F7 freeze (19:00, view end), so it cues nothing there; V14's six items ask nothing about the line, roads or water routes it could cue. H9 intact: the planted record stays the only one saying "jännitteetön", nothing supersedes it (`designed-events.spec.ts`, `planted.spec.ts`). The Thinker index carried (PROVISIONAL, 532 fi / 600 en vectors carried). VERIFY (native, domain): "asentaja on matkalla erottimelle". |
| F4 | `contract-map.ts` / `contract-specs.ts` named the line "110 kV voimajohto". | "20 kV:n sähkölinja" / "20 kV power line", match `20 kV|sähkölinj|voimajoh|power line`; the note says 20 kV on wooden poles; `contract.json` re-extracted (only those fields moved); comments in `terrain.ts`, `render.py`, `render_style.py`. | `map:check` 0 violations, coverage 0 unmatched. |
| F5 | `unit-declutter.spec.ts` bound relaxed 0.2 → 0.3. Cause: the declutter, not the positions — on the rebuilt map's jagged north edge (V6–V8, DR3's orbit) a push off one segment landed the marker on the next. | `unit-declutter.ts` `clearOfLines`: one push when it clears every segment within the cap, else the nearest spot within the cap clear of every segment, else the spot that hides the least edge; searches start from the marker's home (stable, deterministic). Bound back to 0.2. | 179 → 39 of 700 edge samples hidden (94 % less); the 200 m cap, overlap and determinism tests pass. |
| F6 | Kotkanjoki ran a ruler-straight 280 m reach through the R3 bridge with a hairpin at each end (`water.ts` pinned `below → BRIDGE → above`): a tell at the place OUT1/OUT2 stop and W3 is. | `channels.ts` `throughPin`: the 260 m either side of the bridge replaced by Bézier bends that keep the river's own heading and cross the bridge square to R3. | Grid changes confined to x 2760–3190, y 140–790 (≥ 600 m from any fire); fire byte-identical; hydro check 0 uphill / 0 sinks; W3 still on the west bank ~12 m from the water; render `after` at the bridge in tiles 1_2 and 2_2. |
| F7 | V10 `ek12_water` basis said "due 17.41"; the record says 17.43. | Basis text corrected (`freeze-bank-b.ts`). | — |
| F8 | Game world (`content/game/world.json`): with the north band joined, its roads, water points and the `routeOnRoads` candidates changed; a point in the forest east of Kotkanjoki was routed by a 36 km loop. | World regenerated; the router also tries the nearest node in each of 8 directions (`app/game/world/roads.ts`); the tests say the north band is now on the network (`world-roads.spec.ts`) and accept a side-named "Pikku-Pitkäjärvi (itä)" (`world-load.spec.ts`). | `test/game` 278/278. |

## 2. Findings left open

| # | Severity | Finding | Evidence | Proposed fix |
|---|---|---|---|---|
| R1 | HIGH | The water shuttle's times are straight line × 1.4 (`traffic-water.ts` `ROAD_DETOUR`), not the road graph. Besides EK12's 17.43 (the road route from VPK's line is 5.8 km, ~13 min, so ~17.51), every leg to or from the Honkaharju forest road is 2–3 km longer by road than promised: EK12 13.45 → "13.54" (road ~14.01), EK12 14.36 → "14.42" (~14.46), KY21 18.01 → "18.10" (~18.17); the fills back to W1 from there run 6.2 km. The Honkaharju road reaches W1 only by R1 → R2 → its east end. The content stage's "8 of 10 hold" compared nearest water point to truck, not the shuttle's actual legs. | Every leg logged with both measures (scratch, this stage); legs off by +4 to +10 min: (−1061, 1061) ↔ (340, −406) +6.7, (845, 430) → (340, −406) +4.1, (−290, 412) → (674, 1791) +7.6, (−46, −330) → W1 +8.6, (674, 1791) → W1 +10.2. | Drive the shuttle on the truck-road graph (`roadDistance` over `TRUCK_ROADS`, the 16 t bridge closed — tried here and reverted: it re-times the day's water story, re-seeds the traffic from step 2 and breaks V5 `hose_short`, so it needs the content/SAGAT owner to re-key the water-dependent atoms and the panel to see V5, V8, V10). Alternative on the map: a forest-road link from the Honkaharju road's west end to R3 west of IGN (check that the fire's grids do not change and revert VPK's 14.42 text to 20 min). |
| R2 | MEDIUM | With the Koivuoja link, EK11's 15:20–16:20 truck could stand 420 m from its crew on the link south of Koivuoja instead of 600 m on the north spur; F1a keeps the authored spot. A reviewer may ask why the longer line. In its favour: the crew and its truck stay on the same side of Koivuoja (its escape route to the truck does not cross the brook). | `NO_PARKING_ROAD_IDS`; the first build without it moved EK11's step-7 truck to (1976, 1475), hose 420 m, 563 bundle changes. | Domain reviewer decides; if the link is to be used, re-key V5 `hose_short` and the step-7–10 EK11 records. |
| R3 | MEDIUM | EK12's mop-up crew 16:40–17:40 lays a 780 m line (the 800 m maximum) from the dead end of the north spur across Koivuoja to the lobe's north-west edge. A crew mopping up would not hang on such a line; its truck is also the end of a 6.5 km road from the CP. | `site-scenario.json` steps 11–14; the head:R anchor's nearest valid spot with a fire-free line to any truck road. | Re-anchor EK12 at step 11 (e.g. `edge:L2SE`, its 15:40 stretch on R1's side, 320 m line); moves its pushed LCES line, the T4 lateral and V10's key atom ("vesi loppumassa (25 %)"): content/SAGAT owner and the panel. |
| R4 | LOW | EK13's map position between legs is interpolated on the straight line (`shuttlePosition`), then snapped to the nearest road point, which may lie on a road it is not driving. | `traffic-water.ts`. | Interpolate along the road route once R1 is done. |
| R5 | LOW | `content/changes.md` §3 still says the shuttle promises hold for 8 of 10 and lists two failures; R1 supersedes it. | — | Next content pass. |

**Status (20 Oct 2026, the R1/R3 pass, §4).** R1, R3, R4 and R5 are resolved (§4). **R2 is decided: no change.** EK11's 15:20–16:20
truck keeps its authored spot on the north spur (a 600 m line): the crew and its truck stay on the same side of Koivuoja, so its escape
route to the truck never crosses the brook, which the spot fires PP1/PP2 and the 15:40 crossing beside it make the deciding point;
the Koivuoja link stays a road to drive, not to park on (`NO_PARKING_ROAD_IDS`), and V5 `hose_short` keeps "linjaa jo 600 m".

Checked and found sound: every crew and vehicle on dry ground and every road vehicle within 15 m of a truck road, all 21 steps (no
unit in a lake, no vehicle on open bog); the W1 refills stand on the Mökkiranta road 4 m from Haukilampi's north shore; W3 on the
west bank; the fire's barrier sequence and the contract's fire relations (`map:check`); names against map features (coverage 0
unmatched); keys against reports (`validate:scenario` all checks passed); parity of the new record by construction (one recorded atom,
the situation log, both groups, step 18).

## 3. Checks (this stage's tree)

`npx tsc --noEmit -p .` clean; `npm run lint:determinism` clean; `npm run map:check` 0 violations (2 known), hydro / road / realism
pass; `npm run validate:scenario` all checks passed, crew safety 18 findings, 0 unexplained; `npm test` 246 files, 2805 tests
passed. Regenerated: `map:build`, `map:render` (tiles 1_2, 2_2 and the overview), `fire:ca` (fire outputs byte-identical; bundle: F2
only), `map:contract:extract` (the line's labels; W3–river 10.6 → 11.4 m), `thinker:index -- --carry` (PROVISIONAL), `corpus:export`,
`game:world`. `tools/fire-ca/deployment.ts` was already over 500 lines (757) before this stage.

## 4. R1/R3 resolution (20 Oct 2026)

Decisions set by the researcher (not reopened here): drive the water shuttle on the truck-road graph, the 16 t bridge closed, with no
new road on the map (R1); interpolate its map position along the road it drives (R4); re-anchor EK12's mop-up on its 15:40 stretch on
R1's side (R3); keep EK11's spot (R2, §2); update `content/changes.md` §3 (R5, done). Every Finnish string below is a DRAFT for the
native-speaker check.

**What changed.**

- `tools/fire-ca/road-route.ts` (new, 57 lines): the truck-road graph (`TRUCK_ROADS`: the maantie, gravel and forest roads, the
  Koivuoja link included as a road to drive), cut 40 m round the 16 t bridge, built with the contract check's own `roadGraph` and its
  `road_route` parameters, so a drive time and a `travel_time.*` relation measure the same road; `truckRoute` gives the length and the
  route (`contract-geom.ts` `roadPath`, Dijkstra with the route kept), `alongRoute` a point along it.
- `traffic-water.ts`: every shuttle drive is the road route at 450 m/min (`ROAD_DETOUR` gone); a fill goes to the nearest water point
  by road among W1 and W3 until 18.00 (the points command chose; from the Honkaharju road W3, 4.0 km, not W1, 5.8 km), W2 too from
  18.00 as before; `shuttlePosition` walks the route (R4). At 18.00 a shuttle waiting at a phase-A point moves to its phase-B stand-by
  at the R2 junction and the water log says so ("Vesihuoltoloki: EK13 siirtyy valmiuteen R2:n ja metsäautotien risteykseen
  kaakkoisrintaman linjoja varten, perillä klo 18.06."; on the road graph its last phase-A job ended at 17.52 and it would otherwise sit
  full at W3 for an hour while the south-east front's crews called slurry tankers). A truck the plan moves at the next step waits up to
  ten minutes into that step for a basin already on its way (EK12, 14.47), else the crew asks from its new line (KY21 at 14.38 would
  have been promised a basin at 15.16 at the line it left at 14.40). A unit's own water trip (`refillTrip`: leaves as the move is
  radioed, drives, fills 7 min, drives back) sets both the move's message and the fill.
- `deployment.ts` (759 lines, was 764): VPK's step-5 W1 trip is the standard sentence with the road trip (its `said` override gone) and
  it is back on its line on the 15:20 map (was 15:00; it is filling at W1 until 15.01); its reason now names the line EK13 was really
  at ("EK13 oli kiinni EK12:n linjalla"; it said KY21's, whose delivery came 20 minutes later); EK12's step-10 reason says why it drives
  itself ("säiliö oli tyhjä; ajamme itse, vesipiste on lähellä ja EK13 jää muiden linjojen käyttöön"; it said EK13 was busy at KY21's
  line while EK13 stood full at a water point); EK12 step 11 `edge:L2SE` (R3); no parking point within 40 m of the 16 t bridge. VPK's step-8 LCES
  line (recorded) and crew-safety's `8:VPK` exemption are removed: back at 15.15 VPK takes a stretch of L4 the backed wind does not
  run over (crew safety finds nothing there).
- `site-export.ts`: a water-point anchor takes no nudge (EK12's nudge parked it east of the bridge, across the 16 t bridge from W3 and
  unreachable on the road graph; now on the west bank, 35 m from W3); a water move's message carries the trip.

**Shuttle legs and promised times** (old: the gate-R tree, straight line × 1.4; new: this tree. Every new promise is the road-graph
time truncated to the minute, as the radio says it, so each lies within ±1 min of the road-graph time by construction; the old ones
were 4–10 min early wherever the Honkaharju road or the north spur was involved).

| # | Leg (request) | From | To | Road km (old leg → new leg) | Old promise | New promise = road graph |
|---|---|---|---|---|---|---|
| 1 | EK12 basin (13.45) | W1 Haukilampi | EK12's truck, Honkaharju road | 5.80 | 13.54 | 14.01 |
| 2 | VPK basin (13.53) | EK12's basin | VPK's truck, Honkaharju road | 0.41 | 13.59 ("noin 5 min") | 14.05 |
| 3 | EK11 basin (14.21) | W1 → W3 (filled 14.22) | EK11's truck on R1 | 2.62 → 2.22 | 14.30 | 14.30 |
| 4 | EK12 basin (14.36 → 14.37) | EK11's basin on R1 | EK12's truck, Honkaharju road | 3.17 | 14.42 | 14.47 ("noin 10 min") |
| 5 | KY21 basin (15.01) | W1 → W3 | KY21's truck on R1 | 2.57 → 2.27 | 15.10 | 15.11 |
| 6 | KY21 basin (15.50 → 15.53) | KY21's last basin | KY21's truck on R1 | 0.03 | 15.53 | 15.56 |
| 7 | EK11 basin (16.22 → 16.27) | W1 → W3 | EK11's truck, Koivuoja forest road | 4.87 → 2.70 | 16.34 | 16.36 ("noin 9 min") |
| 8 | KY21 basin (16.41) | EK11's basin | KY21's truck on R1 west | 3.37 | 16.52 | 16.51 |
| 9 | VPK basin (16.42 → 16.47) | W1 | VPK's truck on R1 west | 1.47 | 17.08 | 17.08 |
| 10 | EK12 basin (17.35) | VPK's basin on R1 west | EK12's truck: north spur → R1 by L2SE (R3) | 5.72 → 1.52 | 17.43 (road: 17.51) | 17.41 |
| 11 | KY21 basin (18.01) | W1 | KY21's truck, Honkaharju road | 5.81 | 18.10 (road: 18.17) | — EK13 is moving to stand-by (18.00–18.06); a Lahdenkylä farmer's slurry tanker fills KY21 at 18.08 (the phase-B rule) |
| 12 | EK12 basin (18.57) | R2 junction stand-by | EK12's truck on R2 | 0.35 | 19.01 | 19.00 |
| 13 | KY21 basin (19.30 → 19.36) | R2 junction stand-by | KY21's truck on R2 | 0.21 | 19.33 | 19.39 |
| 14 | VPK's own trip (step 5) | VPK's truck, Honkaharju road | W1 and back | 6.00 each way | "noin 30 min, palaamme noin 15.10"; full "14.47", "perillä 15.01" | "noin 35 min, palaamme noin 15.15"; full 15.01, "perillä 15.15" |
| 15 | EK12's own trip (step 10) | EK12's truck on R1 (L2SE) | W3 and back | 1.84 each way | "noin 20 min, palaamme noin 16.41"; full "16.27", "perillä 16.41" | "noin 15 min, palaamme noin 16.36"; full 16.32, "perillä 16.36" |
| 16 | EK13 to stand-by (18.00) | W3 | R2 junction | 2.81 | — | "perillä klo 18.06" (water log) |

EK13's fills: W3 14.22, 15.03, 16.09, 17.52; W1 17.02; W2 19.11, 19.50 (were W1 14.11, 14.55, 16.06, 17.02, 17.56; W2 18.25, 19.12,
19.46). The leg times were logged from the shuttle's own legs on both trees (scratch, this pass).

**Items whose stem, basis or record ids changed.** No key moved: every freeze item, SPAM item, source-memory fact and directive key
has the same answer (compared item by item, the gate-R tree against this one). For the expert panel to re-check:

| Item | Key (old → new) | What changed |
|---|---|---|
| V10 `ek12_water` (L2) | `brought` → `brought` | stem "…sen työlle kärjen eteläsivustalla?" → "…sen työlle **kaakkoissivustalla**?" (+ English); key atoms re-derived: "EK12, kaakkoissivusta: vesi loppumassa (25 %) … arvio klo 17.41" and EK13's "perillä noin klo 17.41" (were "EK12, kärki, eteläsivusta … 17.43"); basis |
| V14 `se_front_r2` (L3) | `not_yet` → `not_yet` | the ~100 m trigger is read from OUT1's pushed R2 line (KY21's step-20 line draws a wording without the figure); records KY21 19.52 / OUT1 19.56 (were 19.47 / 19.52), still 500 m nearest, ~270 m at 20.20 |
| V5 `hose_short` (L2) | `hose` → `hose` | basis: EK11's tank 67 % at 15.25 (was 63 %), read from the record; 15.24 for the head running past |
| V7 `relief_next` (L3) | `VPK` → `VPK` | VPK's pushed relief request (V8) is 16.52 in the other generated wording ("Pyydämme vuoronvaihtoa tai lepovuoroa"); basis times read from the records |
| V4 `head_unattended` (L2) | `free` → `free` | EK11's line 15.03 (was 15.02, reworded, the same "Odotamme tiellä"); VPK is refilling at W1 at 15:00 (was on the origin) |
| V2 `south_flank` (L2) | `held_low` → `held_low` | basis: the recorded step-2 lines quoted, EK13's basin 14.01 (was 13.54); key atom id |
| V5 `lines_breached`, `road_jump` | `no_barrier`, `again` unchanged | radio ids 7.1 → 7.2 and 7.2 → 7.3 (VPK's return now goes out in step 7) |
| V4 `return_danger` | `spots` unchanged | basis DR1 15.31 |
| V4 `infra` (W1) | `available` unchanged | key record VPK's fill at W1, step 6 15.01 (was step 5, 14.47) |
| Ids only (same records, same answers) | unchanged | V2 `ek11_between`, V4 `fastest_spread`, V5 `area_hour`, V7 `lull_meaning` (EK11's 16.2x line reworded: "… (varmistamatta). Linja pitää."), V10 `cabins_distance`; SPAM V3, V3.b, V6.b; source memory `head_rate_1420`, `intensity_1440`, `pp2_560`, `smoke_visibility`, `ek14_fuel` (EK14 now "noin 70 min", was 40) |
| Directive keys V8, V11, V14 (panel) | coding unchanged | V8 basis (EK12 "kaakkoissivusta: … Reuna sammuu hitaasti", VPK 25 %); V11, V14 basis record ids |

H9 and H13 are untouched: the F7 items, the planted record and the V14 directive key's coding are unchanged, and no water record feeds
them (V14's key only re-derived one record id). The Thinker index is carried (`thinker:index -- --carry`, PROVISIONAL: 575 fi / 638 en
vectors carried); with it the rekindle objection ranks 8th for "kyteekö syttymäkohta" at V7, inside top-k as SPEC/26 §5 intends (was
10th), 15th for "VPK syttymäkohta" (16th) and 229th for the broad question (237th) — `test/engine/rekindle.spec.ts` documents it.

**Bundle.** The traffic re-seeds from step 2 (each step's draws follow its water events): 223 of 860 Finnish records reworded or
re-timed, the corpus 1002 → 998 atoms. Positions: EK13 throughout; VPK steps 5–8 (W1 at 15:00, back at 15:20) and its step-3 truck
26 m (spacing); EK12 steps 10–14 (west bank of W3; L2SE on R1's side, line 780 → 300–320 m, truck 1.4 km from the north spur's dead
end to R1); EK14's terrain vehicle 2–3 m (spacing). No other unit moved.

**Checks (this tree).** `npx tsc --noEmit -p .` clean; `npm run lint:determinism` clean (app, tools); `npm run map:check` 0 violations
(2 known), coverage 0 unmatched, hydro / road / realism pass; `npm run validate:scenario` all checks passed, crew safety 17 findings, 0
without a radio safety line; `npm test` 246 files, 2805 tests passed. Parity (`parity_check.py` on `npm run skills:export`): Haku
vs guide 0 problems over 62 items; pushed vs retrievable 775, all the designed kinds (754 recorded facts, 21 item dependencies on
recorded facts; 780 at gate D). Regenerated: `fire:ca` (`fire-ca.json` / `fire-ca.geojson` byte-identical, the grids untouched; bundle
above), `map:contract:extract` (no change), `corpus:export`, `thinker:index -- --carry`, `review:panel`, the freeze table
(`content/freeze-table.md`). `game:world` not needed: the game world reads no bundle or water route.

**Open.** VPK's own trip goes to W1 (6.0 km by road) though W3 is 4.5 km and W2 3.6 km: the authored choice (the local brigade's "Haukilammelta
saa vettä", the point command chose); for the domain reviewer. At 14:40 the map shows EK12's truck at its new place while it waits up
to seven minutes for the basin at the old one (the step-start snapshot). Native-speaker check: the two reasons, the stand-by log line
and V10's stem above.
