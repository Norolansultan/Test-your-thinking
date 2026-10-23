# Difficulty audit — computed summary (`tools/review/difficulty-audit.ts`)

Generated; do not edit by hand. Passive = a participant who never searches can answer (yes); partly = part of the basis is pushed or drawn.

## Per view (the practice view VP included, not scored)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| VP freeze | 4 | 4/4 (100 %) | 0/4 (0 %) | 0/4 (0 %) | 0/4 (0 %) | 1/4 (25 %) | 0/4 (0 %) |
| V2 freeze | 8 | 4/8 (50 %) | 3/8 (38 %) | 1/8 (13 %) | 1/8 (13 %) | 3/8 (38 %) | 3/8 (38 %) |
| V4 freeze | 8 | 6/8 (75 %) | 2/8 (25 %) | 0/8 (0 %) | 2/8 (25 %) | 1/8 (13 %) | 5/8 (63 %) |
| V5 freeze | 8 | 6/8 (75 %) | 0/8 (0 %) | 2/8 (25 %) | 3/8 (38 %) | 1/8 (13 %) | 0/8 (0 %) |
| V7 freeze | 8 | 6/8 (75 %) | 2/8 (25 %) | 0/8 (0 %) | 1/8 (13 %) | 1/8 (13 %) | 0/8 (0 %) |
| V10 freeze | 6 | 4/6 (67 %) | 1/6 (17 %) | 1/6 (17 %) | 2/6 (33 %) | 2/6 (33 %) | 0/6 (0 %) |
| V12 freeze | 6 | 2/6 (33 %) | 3/6 (50 %) | 1/6 (17 %) | 3/6 (50 %) | 3/6 (50 %) | 0/6 (0 %) |
| V14 freeze | 6 | 6/6 (100 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) | 0/6 (0 %) |
| V3 spam | 2 | 1/2 (50 %) | 1/2 (50 %) | 0/2 (0 %) | 1/2 (50 %) | 0/2 (0 %) | 0/2 (0 %) |
| V6 spam | 2 | 1/2 (50 %) | 0/2 (0 %) | 1/2 (50 %) | 1/2 (50 %) | 0/2 (0 %) | 0/2 (0 %) |
| V8 spam | 1 | 1/1 (100 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) |
| V11 spam | 1 | 1/1 (100 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) | 0/1 (0 %) |

## Per SA level (scored items only)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| L1 | 18 | 15/18 (83 %) | 2/18 (11 %) | 1/18 (6 %) | 5/18 (28 %) | 4/18 (22 %) | 3/18 (17 %) |
| L2 | 16 | 12/16 (75 %) | 2/16 (13 %) | 2/16 (13 %) | 7/16 (44 %) | 1/16 (6 %) | 4/16 (25 %) |
| L3 | 22 | 11/22 (50 %) | 8/22 (36 %) | 3/22 (14 %) | 2/22 (9 %) | 6/22 (27 %) | 1/22 (5 %) |

## Per probe kind (scored items only)

| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |
|---|---|---|---|---|---|---|---|
| freeze | 50 | 34/50 (68 %) | 11/50 (22 %) | 5/50 (10 %) | 12/50 (24 %) | 11/50 (22 %) | 8/50 (16 %) |
| SPAM | 6 | 4/6 (67 %) | 1/6 (17 %) | 1/6 (17 %) | 2/6 (33 %) | 0/6 (0 %) | 0/6 (0 %) |
| all | 56 | 38/56 (68 %) | 12/56 (21 %) | 6/56 (11 %) | 14/56 (25 %) | 11/56 (20 %) | 8/56 (14 %) |
| H2 window (V2–V7 freeze L2/L3) | 24 | 16/24 (67 %) | 6/24 (25 %) | 2/24 (8 %) | 3/24 (13 %) | 4/24 (17 %) | 5/24 (21 %) |

## Records per view: what the stream shows and what waits in the records

| View | Pushed to the log | Recorded only (Haku / Thinker), of the view's steps | Share pushed |
|---|---|---|---|
| VP | 13 | 9 | 13/22 (59 %) |
| V1 | 18 | 23 | 18/41 (44 %) |
| V2 | 18 | 70 | 18/88 (20 %) |
| V3 | 12 | 35 | 12/47 (26 %) |
| V4 | 17 | 80 | 17/97 (18 %) |
| V5 | 17 | 29 | 17/46 (37 %) |
| V6 | 18 | 57 | 18/75 (24 %) |
| V7 | 18 | 28 | 18/46 (39 %) |
| V8 | 18 | 47 | 18/65 (28 %) |
| V9 | 16 | 42 | 16/58 (28 %) |
| V10 | 10 | 36 | 10/46 (22 %) |
| V11 | 18 | 76 | 18/94 (19 %) |
| V12 | 17 | 81 | 17/98 (17 %) |
| V13 | 18 | 46 | 18/64 (28 %) |
| V14 | 18 | 93 | 18/111 (16 %) |

## Items whose key rests on a map fact (or a fact on no surface) that no record states before the moment

- `freeze.2.junction_hour` (L3): no record states the fire's distance to the R1/R2 junction; extrapolate the drawn head along its direction with the scale bar and the pushed rate (DR1 7.1 m/min); the map's ~950 m now is the lure
- `freeze.2.head_later` (L3): an hour on; V2's projection ends at 40 minutes: extrapolate the drawn head and rate on the blank basemap
- `freeze.4.crown_drops` (L3): no record before step 7 and no map layer shows a broadleaf strip (the basemap has no forest types); only knowledge that brook valleys carry birch, cued by the name Koivuoja / Birch Creek; the map shows where the brook lies ahead of the head
- `freeze.4.head_later` (L3): 20 minutes on, inside V4's 40-minute projection (a breach view: the key lies beyond the isochrone); placed on the blank basemap
- `freeze.7.cp_safe` (L3): no record states the fire's distance to the command post (~760 m) before V8: the scale bar and the wind arrow; the turn away from the CP is in the recorded forecast
- `freeze.10.area_total_hour` (L3): no area is pushed in phase B and the map prints none; the recorded 17.35 survey (153.6 ha, 'no edge moved') is the lure, so even a seeker must add the new front's growth from the drawn perimeters
- `freeze.12.head_later` (L3): an hour on; V12's projection ends at 19.20: extrapolate on the blank basemap

## Freeze items whose last key record arrives less than 60 s before the freeze

- `freeze.2.ek11_between` (L2): lead 40 s; atom.radio.3.0:T1_pushed:pushed_before:V2:40s, atom.demo.3.0:T1_pushed:pushed_before:V2:40s, evt.c03.007:T1_pushed:pushed_before:V2:40s
- `freeze.2.south_flank` (L2): lead 40 s; evt.c03.021:T1_pushed:pushed_before:V2:40s
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
| `freeze.2.area_40` | fi | Kuinka suuri palanut ala on? | 3 | evt.c02.028: 2; evt.c03.035: 1 |
| `freeze.2.area_40` | en | How large is the burnt area? | 3 | evt.c02.028: —; evt.c03.035: — |
| `freeze.4.infra` | fi | Voiko Haukilammelta täyttää säiliöitä? | 6 | evt.c06.003: 1 |
| `freeze.4.infra` | en | Can tankers fill up at Pike Pond? | 6 | evt.c06.003: 4 |
| `freeze.5.infra` | fi | Mikä on tien R1 tilanne? | 7 | evt.c07.016: — |
| `freeze.5.infra` | fi | tiehavainto tie R1 | 7 | evt.c07.016: 4 |
| `freeze.5.infra` | en | What is the state of road R1? | 7 | evt.c07.016: — |
| `freeze.5.infra` | en | road report road R1 | 7 | evt.c07.016: 4 |
| `freeze.5.ek14_shelter` | fi | Mikä on sääennuste? | 7 | evt.wx.03: — |
| `freeze.5.ek14_shelter` | fi | Miten tuuli muuttuu? | 7 | evt.wx.03: — |
| `freeze.5.ek14_shelter` | en | What is the weather forecast? | 7 | evt.wx.03: 4 |
| `freeze.5.ek14_shelter` | en | How will the wind change? | 7 | evt.wx.03: — |
| `freeze.5.wind_shift` | fi | Mikä on sääennuste? | 7 | evt.wx.03: —; evt.wx.02: 5 |
| `freeze.5.wind_shift` | en | What is the weather forecast? | 7 | evt.wx.03: 4; evt.wx.02: 5 |
| `freeze.7.infra` | fi | Voiko Kotkanjoelta täyttää säiliöitä? | 10 | evt.c10.023: 3 |
| `freeze.7.infra` | en | Can tankers fill up at Eagle River? | 10 | evt.c10.023: 7 |
| `freeze.10.ek12_water` | fi | Saako EK12 lisää vettä? | 13 | evt.c13.035: — |
| `freeze.10.ek12_water` | en | Is EK12 getting more water? | 13 | evt.c13.035: — |
| `freeze.10.cabins_distance` | fi | Kuinka kaukana palo on Mökkirannasta? | 13 | evt.c11.015: — |
| `freeze.10.cabins_distance` | en | How far is the fire from the Lakeside Cottages? | 13 | evt.c11.015: 7 |
| `freeze.10.area_total_hour` | fi | Kuinka suuri palanut ala on? | 13 | evt.c13.034: 2 |
| `freeze.10.area_total_hour` | en | How large is the burnt area? | 13 | evt.c13.034: — |
| `freeze.12.longest_shift` | fi | Kuinka kauan miehistöt ovat olleet kentällä? | 17 | evt.c17.008: —; evt.c17.024: —; evt.c17.033: —; evt.c17.029: 6 |
| `freeze.12.longest_shift` | en | How long have the crews been in the field? | 17 | evt.c17.008: —; evt.c17.024: —; evt.c17.033: —; evt.c17.029: 8 |
| `freeze.12.f7` | fi | Onko sähkölinja jännitteinen? | 17 | f7.grid_record: 1; f7.heli_line_clearance: 4 |
| `freeze.12.f7` | en | Is the power line live? | 17 | f7.grid_record: 1; f7.heli_line_clearance: 2 |
| `freeze.12.front_toward` | fi | Mihin suuntaan palon kärki etenee? | 17 | atom.demo.17.1: 2 |
| `freeze.12.front_toward` | en | Which way is the head of the fire spreading? | 17 | atom.demo.17.1: 2 |
| `probe.s.cycle_3.b` | fi | Kuinka suuri palanut ala on? | 4 | evt.c03.035: 2 |
| `probe.s.cycle_3.b` | en | How large is the burnt area? | 4 | evt.c03.035: — |
| `probe.s.cycle_6.b` | fi | Mikä on tien R1 tilanne? | 8 | evt.c07.016: —; evt.c08.012: — |
| `probe.s.cycle_6.b` | fi | tiehavainto tie R1 | 8 | evt.c07.016: —; evt.c08.012: 4 |
| `probe.s.cycle_6.b` | en | What is the state of road R1? | 8 | evt.c07.016: —; evt.c08.012: — |
| `probe.s.cycle_6.b` | en | road report road R1 | 8 | evt.c07.016: —; evt.c08.012: 4 |
