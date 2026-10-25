# Difficulty audit — computed summary (`tools/review/difficulty-audit.ts`)

Generated; do not edit by hand. Passive = a participant who never searches can answer (yes); partly = part of the basis is pushed or drawn.

## Per view (the practice view VP included, not scored)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| VP freeze | 5 | 4/5 (80 %) | 0/5 (0 %) | 1/5 (20 %) | 1/5 (20 %) | 1/5 (20 %) | 0/5 (0 %) |
| V2 freeze | 8 | 3/8 (38 %) | 4/8 (50 %) | 1/8 (13 %) | 2/8 (25 %) | 3/8 (38 %) | 2/8 (25 %) |
| V4 freeze | 8 | 7/8 (88 %) | 1/8 (13 %) | 0/8 (0 %) | 2/8 (25 %) | 1/8 (13 %) | 5/8 (63 %) |
| V5 freeze | 8 | 5/8 (63 %) | 3/8 (38 %) | 0/8 (0 %) | 4/8 (50 %) | 1/8 (13 %) | 0/8 (0 %) |
| V7 freeze | 8 | 5/8 (63 %) | 2/8 (25 %) | 1/8 (13 %) | 2/8 (25 %) | 1/8 (13 %) | 0/8 (0 %) |
| V10 freeze | 6 | 4/6 (67 %) | 2/6 (33 %) | 0/6 (0 %) | 2/6 (33 %) | 2/6 (33 %) | 0/6 (0 %) |
| V12 freeze | 6 | 2/6 (33 %) | 3/6 (50 %) | 1/6 (17 %) | 4/6 (67 %) | 3/6 (50 %) | 0/6 (0 %) |
| V14 freeze | 6 | 6/6 (100 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) |
| V3 spam | 2 | 1/2 (50 %) | 1/2 (50 %) | 0/2 (0 %) | 1/2 (50 %) | 0/2 (0 %) | 0/2 (0 %) |
| V6 spam | 2 | 1/2 (50 %) | 0/2 (0 %) | 1/2 (50 %) | 1/2 (50 %) | 0/2 (0 %) | 0/2 (0 %) |
| V8 spam | 1 | 1/1 (100 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) |
| V11 spam | 1 | 1/1 (100 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) |

## Per SA level (scored items only)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| L1 | 18 | 15/18 (83 %) | 3/18 (17 %) | 0/18 (0 %) | 6/18 (33 %) | 4/18 (22 %) | 3/18 (17 %) |
| L2 | 16 | 9/16 (56 %) | 4/16 (25 %) | 3/16 (19 %) | 10/16 (63 %) | 1/16 (6 %) | 3/16 (19 %) |
| L3 | 22 | 12/22 (55 %) | 9/22 (41 %) | 1/22 (5 %) | 2/22 (9 %) | 6/22 (27 %) | 1/22 (5 %) |

## Per probe kind (scored items only)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| freeze | 50 | 32/50 (64 %) | 15/50 (30 %) | 3/50 (6 %) | 16/50 (32 %) | 11/50 (22 %) | 7/50 (14 %) |
| SPAM | 6 | 4/6 (67 %) | 1/6 (17 %) | 1/6 (17 %) | 2/6 (33 %) | 0/6 (0 %) | 0/6 (0 %) |
| all | 56 | 36/56 (64 %) | 16/56 (29 %) | 4/56 (7 %) | 18/56 (32 %) | 11/56 (20 %) | 7/56 (13 %) |
| H2 window (V2–V7 freeze L2/L3, composite items) | 23 | 14/23 (61 %) | 7/23 (30 %) | 2/23 (9 %) | 6/23 (26 %) | 3/23 (13 %) | 4/23 (17 %) |

## Items scored outside H2 and the SA composites (`scored_for`)

- `freeze.4.head_later` (L3): exploratory
- `freeze.12.f7` (L2): h9_only

## L3 horizons from the header's "now" (play-test R1: the stems state the clock only)

| View | Items: minutes from the end of the latest reports' span to the key's clock |
|---|---|
| V2 | `area_40` 20, `spruce_behaviour` 60, `junction_hour` 40, `head_later` 40 |
| V4 | `return_danger` 20, `crown_drops` 20, `korpioja_spot` 20, `head_later` 0 |
| V5 | `ek14_shelter` 20, `reinforcements` 80, `area_hour` 40, `road_jump` 20 |
| V7 | `rekindle_sector` 40, `cabins_reach` 40, `cp_safe` 40, `relief_next` 20 |
| V10 | `area_growth_hour` 60, `front_r2_80` 80 |
| V12 | `village_distance` 40, `head_later` 60 |
| V14 | `se_front_r2` 20, `flare_next` 60 |

## Records per view: what the stream shows and what waits in the records

| View | Pushed to the log | Recorded only (Haku / Thinker), of the view's steps | Share pushed |
|---|---|---|---|
| VP | 13 | 9 | 13/22 (59 %) |
| V1 | 18 | 23 | 18/41 (44 %) |
| V2 | 18 | 74 | 18/92 (20 %) |
| V3 | 13 | 35 | 13/48 (27 %) |
| V4 | 18 | 80 | 18/98 (18 %) |
| V5 | 18 | 32 | 18/50 (36 %) |
| V6 | 18 | 57 | 18/75 (24 %) |
| V7 | 18 | 30 | 18/48 (38 %) |
| V8 | 18 | 47 | 18/65 (28 %) |
| V9 | 18 | 42 | 18/60 (30 %) |
| V10 | 10 | 36 | 10/46 (22 %) |
| V11 | 18 | 77 | 18/95 (19 %) |
| V12 | 18 | 83 | 18/101 (18 %) |
| V13 | 18 | 46 | 18/64 (28 %) |
| V14 | 18 | 93 | 18/111 (16 %) |

## Pointers (revisions (bm), (bn)): the command centre's acknowledgements, pushed, content-free, counted among the pushed above

| Pointer | View | Clock | Line | Source it names | Record it points to | Kind | Window | Items whose record it is |
|---|---|---|---|---|---|---|---|---|
| `atom.ptr.2.0` | V2 | 13.55 | JOKE: EK14:n tilanneilmoitus kuitattu. | EK14 | `evt.c02.026` | decoy | view start → freeze | — |
| `atom.ptr.3.0` | V2 | 14.09 | JOKE: EK12:n tilanneilmoitus vastaanotettu. | EK12 | `evt.c03.021` | real | step boundary → freeze | `freeze.2.south_flank` |
| `atom.ptr.3.1` | V2 | 14.16 | JOKE: DR3:n kehäkartoitus kuitattu. | DR3 | `evt.c03.035` | real | step boundary → freeze | `freeze.2.area_40`, `probe.s.cycle_3.b` |
| `atom.ptr.7.0` | V5 | 15.36 | JOKE: EK11:n täydennystilaus vastaanotettu. | EK11 | `evt.c07.032` | real | view start → freeze | `freeze.5.hose_short` |
| `atom.ptr.7.1` | V5 | 15.31 | JOKE: P2:n viesti kirjattu. | P2 | `atom.demo.7.1` | real | view start → freeze | `freeze.5.reinforcements` |
| `atom.ptr.7.2` | V5 | 15.23 | JOKE: drooniryhmän lentotilanne vastaanotettu. | DRONERYHMÄ | `evt.c07.005` | decoy | view start → freeze | — |
| `atom.ptr.10.0` | V7 | 16.36 | JOKE: EK14:n viesti kirjattu. | EK14 | `evt.c10.028` | real | view start → freeze | `freeze.7.north_help` |
| `atom.ptr.10.1` | V7 | 16.29 | JOKE: EK13:n viesti kirjattu. | EK13 | `evt.c10.014` | decoy | view start → freeze | — |
| `atom.ptr.12.0` | V9 | 17.12 | JOKE: DR3:n anturiloki vastaanotettu. | DR3 | `evt.c12.037` | decoy | view start → view end | — |
| `atom.ptr.15.0` | V11 | 18.16 | JOKE: tilannekuvan päivitys kirjattu. | TILANNEKUVA | `evt.c15.037` | decoy | step boundary → view end | — |
| `atom.ptr.17.0` | V12 | 18.43 | JOKE: SPOTin havainnot kuitattu. | SPOT | `atom.demo.17.1` | real | step boundary → freeze | `freeze.12.front_toward` |
| `atom.ptr.17.1` | V12 | 18.58 | JOKE: EK13:n viesti kuitattu. | EK13 | `evt.c17.039` | decoy | step boundary → freeze | — |

Displaced from the stream to the records by the pointers (`site-scenario.json` `pointerDisplaced`, none an item's record, no air asset's change of state, repeats first since (bn)): `evt.c03.039`, `evt.c03.029`, `evt.c07.036`, `evt.c10.025`, `evt.c10.020`, `evt.c15.027`, `evt.c17.010`.

## Items whose key rests on a map fact (or a fact on no surface) that no record states before the moment

- `freeze.2.junction_hour` (L3): no record states the fire's distance to the R1/R2 junction; extrapolate the drawn head along its direction with the scale bar and the pushed rate (DR1 7.1 m/min); the map's ~950 m now is the lure
- `freeze.2.head_later` (L3): an hour on; V2's projection ends at 40 minutes: extrapolate the drawn head and rate on the blank basemap
- `freeze.4.head_later` (L3): at 15.20, the end of the header's span (0 minutes from its 'now'), inside V4's 40-minute projection (a breach view: the key lies beyond the isochrone); placed on the blank basemap; the key implies ~38 m/min, the pushed DR3 15.05 says 14.1; exploratory, outside H2 and the composites (play-test R2)
- `freeze.7.cp_safe` (L3): no record states the fire's distance to the command post (~760 m) before V8: the scale bar and the wind arrow; the turn away from the CP is in the recorded forecast
- `freeze.12.head_later` (L3): an hour on; V12's projection ends at 19.20: extrapolate on the blank basemap

## Freeze items whose last key record arrives less than 60 s before the freeze

- `freeze.2.ek11_between` (L2): lead 40 s; atom.radio.3.0:T1_pushed:pushed_before:V2:40s, atom.demo.3.0:T1_pushed:pushed_before:V2:40s, evt.c03.007:T1_pushed:pushed_before:V2:40s
- `freeze.2.ek11_point` (L1): lead 40 s; atom.radio.3.0:T1_pushed:pushed_before:V2:40s
- `freeze.4.infra` (L1): lead 37 s; evt.c06.003:T2_system:recorded_before:V4:37s, evt.c06.007:T1_pushed:pushed_before:V4:37s
- `freeze.4.ek12_where` (L1): lead 37 s; atom.radio.6.1:T1_pushed:pushed_before:V4:37s
- `freeze.4.fastest_spread` (L2): lead 37 s; atom.demo.6.0:T1_pushed:pushed_before:V4:37s, evt.c06.017:T1_pushed:pushed_before:V4:37s, evt.c06.019:T2_system:recorded_before:V4:37s
- `freeze.4.head_unattended` (L2): lead 37 s; atom.radio.6.0:T1_pushed:pushed_before:V4:37s, atom.radio.6.1:T1_pushed:pushed_before:V4:37s, evt.c06.008:T1_pushed:pushed_before:V4:37s
- `freeze.4.return_danger` (L3): lead 37 s; atom.demo.6.0:T1_pushed:pushed_before:V4:37s

## Findability of the recorded-only key records (Haku's retrieval, lexical half, top 8)

| Item | Lang | Question | Step reached | Rank of each recorded key record (— = not in the top 8) |
|---|---|---|---|---|
| `freeze.2.infra` | fi | Mikä on tien R1 tilanne? | 3 | evt.c03.018: 4; evt.c02.013: — |
| `freeze.2.infra` | fi | tiehavainto tie R1 | 3 | evt.c03.018: 1; evt.c02.013: — |
| `freeze.2.infra` | en | What is the state of road R1? | 3 | evt.c03.018: 5; evt.c02.013: — |
| `freeze.2.infra` | en | road report road R1 | 3 | evt.c03.018: 1; evt.c02.013: — |
| `freeze.2.south_flank` | fi | Miten kärki etenee EK12:n kohdalla? | 3 | evt.c02.022: 1; evt.c03.021: — |
| `freeze.2.south_flank` | fi | Millaista paloa EK12:n kohdalla on? | 3 | evt.c02.022: 2; evt.c03.021: — |
| `freeze.2.south_flank` | fi | Miten kärki käyttäytyy eteläsivustalla? | 3 | evt.c02.022: 2; evt.c03.021: 4 |
| `freeze.2.south_flank` | en | How is the fire behaving on EK12's flank? | 3 | evt.c02.022: 1; evt.c03.021: 2 |
| `freeze.2.south_flank` | en | What is EK12 reporting from the south flank? | 3 | evt.c02.022: 2; evt.c03.021: 3 |
| `freeze.2.south_flank` | en | What is the fire doing at EK12's section? | 3 | evt.c02.022: 2; evt.c03.021: 4 |
| `freeze.2.area_40` | fi | Kuinka suuri palanut ala on? | 3 | evt.c02.028: 2; evt.c03.035: 1 |
| `freeze.2.area_40` | en | How large is the burnt area? | 3 | evt.c02.028: —; evt.c03.035: — |
| `freeze.4.infra` | fi | Voiko Haukilammelta täyttää säiliöitä? | 6 | evt.c06.003: 1 |
| `freeze.4.infra` | en | Can tankers fill up at Pike Pond? | 6 | evt.c06.003: 4 |
| `freeze.5.infra` | fi | Mikä on tien R1 tilanne? | 7 | evt.c07.016: — |
| `freeze.5.infra` | fi | tiehavainto tie R1 | 7 | evt.c07.016: 3 |
| `freeze.5.infra` | en | What is the state of road R1? | 7 | evt.c07.016: — |
| `freeze.5.infra` | en | road report road R1 | 7 | evt.c07.016: 3 |
| `freeze.5.hose_short` | fi | Mitä EK11 tarvitsee? | 7 | evt.c07.032: 1 |
| `freeze.5.hose_short` | fi | Mitä tarvikkeita EK11 tarvitsee? | 7 | evt.c07.032: 1 |
| `freeze.5.hose_short` | en | What equipment does EK11 need? | 7 | evt.c07.032: 3 |
| `freeze.5.hose_short` | en | What does EK11 need on its line? | 7 | evt.c07.032: 1 |
| `freeze.5.ek14_shelter` | fi | Mikä on sääennuste? | 7 | evt.wx.03: — |
| `freeze.5.ek14_shelter` | fi | Miten tuuli muuttuu? | 7 | evt.wx.03: — |
| `freeze.5.ek14_shelter` | en | What is the weather forecast? | 7 | evt.wx.03: 4 |
| `freeze.5.ek14_shelter` | en | How will the wind change? | 7 | evt.wx.03: — |
| `freeze.5.reinforcements` | fi | Milloin lisäyksiköt saapuvat? | 7 | atom.demo.7.1: 1 |
| `freeze.5.reinforcements` | fi | Onko lisäyksiköitä tulossa? | 7 | atom.demo.7.1: 2 |
| `freeze.5.reinforcements` | en | Have reinforcements been dispatched? | 7 | atom.demo.7.1: 1 |
| `freeze.5.reinforcements` | en | Are reinforcements coming? | 7 | atom.demo.7.1: 2 |
| `freeze.7.infra` | fi | Voiko Kotkanjoelta täyttää säiliöitä? | 10 | evt.c10.023: 3 |
| `freeze.7.infra` | en | Can tankers fill up at Eagle River? | 10 | evt.c10.023: 7 |
| `freeze.7.north_help` | fi | Miten EK14:n linjalle pääsee? | 10 | evt.c10.028: 1 |
| `freeze.7.north_help` | fi | Kuinka lähelle EK14:ää pääsee? | 10 | evt.c10.028: 2 |
| `freeze.7.north_help` | fi | Pääseekö EK14:n linjalle? | 10 | evt.c10.028: 1 |
| `freeze.7.north_help` | en | Can a fire engine get to EK14? | 10 | evt.c10.028: 1 |
| `freeze.7.north_help` | en | Can vehicles get through to EK14's line? | 10 | evt.c10.028: 1 |
| `freeze.10.ek12_water` | fi | Saako EK12 lisää vettä? | 13 | evt.c13.035: — |
| `freeze.10.ek12_water` | en | Is EK12 getting more water? | 13 | evt.c13.035: — |
| `freeze.10.cabins_distance` | fi | Kuinka kaukana palo on Mökkirannasta? | 13 | evt.c11.015: — |
| `freeze.10.cabins_distance` | en | How far is the fire from the Lakeside Cottages? | 13 | evt.c11.015: 7 |
| `freeze.10.area_growth_hour` | fi | Kuinka nopeasti uusi palo kasvaa? | 13 | atom.demo.12.1: 7; evt.c13.010: —; evt.c13.034: 8 |
| `freeze.10.area_growth_hour` | en | How fast is the new fire growing? | 13 | atom.demo.12.1: 2; evt.c13.010: —; evt.c13.034: — |
| `freeze.12.longest_shift` | fi | Kuinka kauan miehistöt ovat olleet kentällä? | 17 | evt.c17.008: —; evt.c17.024: —; evt.c17.033: —; evt.c17.029: 6 |
| `freeze.12.longest_shift` | en | How long have the crews been in the field? | 17 | evt.c17.008: —; evt.c17.024: —; evt.c17.033: —; evt.c17.029: 8 |
| `freeze.12.f7` | fi | Onko sähkölinja jännitteinen? | 17 | f7.grid_record: 1; f7.heli_line_clearance: 4 |
| `freeze.12.f7` | en | Is the power line live? | 17 | f7.grid_record: 1; f7.heli_line_clearance: 2 |
| `freeze.12.front_toward` | fi | Mihin suuntaan palon kärki etenee? | 17 | atom.demo.17.1: 2 |
| `freeze.12.front_toward` | en | Which way is the head of the fire spreading? | 17 | atom.demo.17.1: 2 |
| `probe.s.cycle_3.b` | fi | Kuinka suuri palanut ala on? | 4 | evt.c03.035: 2 |
| `probe.s.cycle_3.b` | en | How large is the burnt area? | 4 | evt.c03.035: — |
| `probe.s.cycle_6.b` | fi | Mikä on tien R1 tilanne? | 8 | evt.c07.016: —; evt.c08.012: — |
| `probe.s.cycle_6.b` | fi | tiehavainto tie R1 | 8 | evt.c07.016: —; evt.c08.012: 3 |
| `probe.s.cycle_6.b` | en | What is the state of road R1? | 8 | evt.c07.016: —; evt.c08.012: — |
| `probe.s.cycle_6.b` | en | road report road R1 | 8 | evt.c07.016: —; evt.c08.012: 3 |
