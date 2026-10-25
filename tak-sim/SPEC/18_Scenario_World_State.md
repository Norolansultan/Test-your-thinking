# 18 — Scenario world state (draft for domain review)

**Version 0.2 · 17 September 2026 · Status: adopted into the scenario (`03` revision (g)); all numbers pending domain review (`11` §1.2).** Fills the gaps listed in `11` §7.3.

Every number here is a *proposal* chosen for internal consistency and plausibility. Place names marked **[nimi]** are placeholders to be bound to real MML features in QGIS.

> **Changelog**
> - **25 Oct 2026 (bk)** — three pushed records held for seeking (recorded, same text, same step and clock), so that H2 depends on information seeking again (`09` (bk), `30` (bk)): EK12's 14.08 report (V2), EK11's 15.35 hose request (V5), P2's 15.30 dispatch of the reinforcements (V5). No record added, removed or re-worded; parity unchanged. See the revision at the end.
> - **25 Oct 2026 (bh)** — records for the play-test replay's decisions (DRAFT Finnish): DR2 17.21 "Huoltotie R2 ajettavissa" (no "vielä", R3); the brook Korpioja renamed Myllyoja / Mill Brook (R5; its one record, the 15.2x crossing, and ae.1's table); the step-5 DR1/DR3 R1 stretch named by the R2 junction (R7). See the revision at the end.
> - **24 Oct 2026 (bg)** — records for the play-test decisions (DRAFT Finnish): the helicopter's request and ETA in the handover (V1), CO readings when asked on the esker (14.08) and the forest road (18.45), DR1's birch-strip line (V3), P2's 15.00 forecast headline (V4), the reinforcements' dispatch and ETAs (V5), the 17.05 situation picture with the area (V9); the R1 road reports of 14.46–14.48 on a stretch of their own; VPK's evacuation radio says "P2:n evakuointipäätös". See the revision at the end.
> - **20 Oct 2026 (ba)** — `33`: §5's features keep their names and relations on the rebuilt site; the power line is 20 kV; content re-keyed (`docs/audits/2026-10-20-map/content/changes.md`).
> - **19 Oct 2026 (ay)** — `31`: a provisional flame-length table per step and segment (the phase-B bands were 2–3× short for the scripted rates); the station's T/RH every step; LCES lines for the R2 crews, KY21's 18:26 escape route into the black, EK16's reason for holding to 19:21; §7 row 12 and §6 rows 10+ stale; §8.1's KY21 note reads "eri puhetavat"; the roster names no real region; call signs and terms await Pelastusopisto's VERIFY list. See the revision at the end.
> - **10 Oct 2026 (ak)** — commander review of every unit position, VP–V14: KY21 holds the Honkaharju road through the 18:40–19:00 stop and withdraws at 19:00 on an indicator trigger; the 14:45 crown-run trigger point is indicator-based; EK11's 15:20 line worded as drawn; one open item (V5) for the researcher (ak.1–ak.4).
> - **9 Oct 2026 (aj)** — rekindles ignite on the old edge; EK12's and EK14's 15:40–16:20 positions (the south-east flank; the safety zone in the black); LCES lines on record, the `downwind` safety check (aj.1–aj.4).
> - **9 Oct 2026 (ah)** — review fixes: the weather series and forecasts after the re-authored winds; the 19:00 contradiction is a north-edge holdover (US2); KY21 and EK14 work up the flanks, the crown-run withdrawal goes to a safety zone in the black, EK11 to the old east edge at 17:00; no stacked units; AVL follows a move; radio safety lines; the mop-up patrol; DR3 names the south-east front (ah.1–ah.6).
> - **9 Oct 2026 (ae)** — English place names and codes in English sessions: the one mapping table (`app/i18n/place-names.ts`, copied in ae.1, with each map label's position), VPK → VOL1, AVL → Vehicle location, PP/US → SF/RK (ae.2); the English map variant.
> - **9 Oct 2026 (ad)** — EK11 hands command over to the participant at 13:21; L4 secured at 16:40 with L1 (not with L2 at 16:20); road crews hold `road_line`s; EK13 between runs is on stand-by; KY21's V14 report names the crossing (ad.1–ad.4).
> - **8 Oct 2026 (ab)** — generator realism after persona round 5: lateral water only when it beats the basin; firebreak sections; sprinklers at 100 m with a 10-minute basin; an 8 m³ basin and 6–8 m³ deliveries; burnouts lit at about 400 m; thermal rate records with their window and spot jumps; the station's T and RH; the helicopter's ground-safety line; the V9 SPOT record names L3; 979 events. See the revision at the end.
> - **8 Oct 2026 (aa)** — weather text (18:01 forecast RH 25–30 % with a drying north-westerly; a local reason for the 16:20 south-easterly); KY23 (17:00) and EK16 (17:40) released by the region; VD1 80 l per drop with an 11 m/s gust cutoff; DR1/DR2 restricted sortie at 18:40; VD1 and UGV1 autonomous; refills in the present tense; sprinklers ready until 300 m; "liian kuuma" rule; areas 125.3 ha at 16:20 and 174.8 ha at 19:40; flags 14 / 14. See the revision at the end.
> - **6–8 Oct 2026 (y)** — the world after the persona reviews: the EK13 water shuttle and basins; sprinkler lines of 100–300 m; burnouts proposed and closed; DR3 leaves at 17:59; EK16 and KY23 held by the region; the shift change at 19:20; rekindles anchored to the burned edge; new areas (~175.9 ha at 20:00); the step-6 crown run of 38 m/min accepted; V14 no-fit; §6 rain row stale. See the revision at the end.
> - **4 Oct 2026 (t), review round 2** — revision (t) amended in place (DEFAULTS, `11` §7.16.1): the directive reworded (safety and the region's situation, not thin readiness; no forecast); phase A not coded for alignment; V9–V10 keys on the new front's sector (L3); V11–V12 keys `barrier_line` or `protect_values`; V13 fits; the design claim restated (t.4).
> - **4 Oct 2026 (t)** — §4.2 superseded: one directive from P2 replaces the four hinge rules; the issuer is P2, not P3; per-view fit with the deciding records, pushed or recorded only. See the revision at the end.
> - **25 Sep 2026 (p)** — steps are grouped into 14 views (`26`); rekindle moves at steps 10 and 13 change §8.2 for KY21 and VPK.
> - **25 Sep 2026 (o)** — fault F7 added to §10: the planted false record (`02` revision (o) §5).
> - **0.3 · 23 Sep 2026** — tier T3 retired (`02` revision (j)); see the revision at the end.
> - **0.2 · 17 Sep 2026** — adopted into `03`; §12 changes applied there.
> - 0.1 · 17 Sep 2026 — first full draft: incident setting, available information in 2030, intent and hinge guidance, geography, weather series, fire behaviour, unit, drone and air timelines, values at risk, injected faults, prologue, lessons embedded.

---

## 1. Design stance

**Time frame: an incident around 2030.** The participant works with what a southeast-Finland rescue department could plausibly have by then — not a showcase of every emerging technology. More sensors do not remove the study's problem; they enlarge it. Each new feed arrives at a different latency, with a different reliability, and at least one of them silently fails. These differences are what make integration hard, and why an AI that integrates is attractive.

**Four rules for "future" realism:**
1. **Only technology already fielded or in late trials by 2026** is assumed operational in 2030. Anything newer appears only as a pilot with one unit.
2. **Every source has a latency, a failure mode and a reliability class.** Nothing is instant and nothing is complete.
3. **Old limits persist:** smoke blocks optics; drones and helicopters do not share airspace freely; radio and data coverage has holes in forest valleys; firefighters on foot are not tracked; deep smouldering is invisible from above after rain.
4. **The machine never sees more than the data it is given**, and its fuel data is older than the forest (M3).

**Design references carried in** (details in §11):
- *Kalajoki (Rautio) 2021:* re-ignition from smouldering ditch spoil after apparent control; late escalation; surveillance-aircraft reports not reaching the command post; water supply failure; weather services underused; long shifts; farmers' tankers used.
- *Sweden 2018 (SOU 2019:7):* slow and cautious starts; operations ended too early and fires flared again; weak initial situational picture; helicopter use delayed by cost; shortages of pumps, hose and fuel; multiple lightning ignitions; confusion about who was in command; civilians taking part.
- *Västmanland 2014:* ignition from forestry work.
- *Nick Ruest's `wildfire-robotics` (MIT):* mandatory provenance on every observation; "unknown" exposed rather than silently substituted; an explicit simulator-validity claim; command lifecycle separating authorisation from decision; deterministic fault campaigns (link loss, sensor faults) as authored events.

---

## 2. Setting

| Item | Value |
|---|---|
| Date | A Friday in late July, school holidays, the fourth week of a drought |
| Region | Southeast Finland, inside the `03` §1.1 box, near the South Karelia–Kymenlaakso boundary |
| Ignition point | **[nimi]** harvesting block, ≈ 60.90 N, 27.35 E (to be placed on a real mature pine/spruce mosaic from Metsäkeskus data, ≥ 10 km from the border) |
| Cause | Sparks from a harvester working a dry clear-cut (Västmanland pattern). The operator calls 112 at 11:32 |
| Fire danger | FMI forest-fire warning in force for the region for 9 days |
| Regional situation | Holiday staffing; a dry thunderstorm line passes the region from 13:30, igniting further fires (Ljusdal pattern) |
| Participant | *Joukkueenjohtaja* acting as *pelastustoiminnan johtaja* (PTJ). Follows the incident from 11:40 en route; **takes command at 13:20** (start of cycle 1) |
| Above the participant | Duty officer **P3** (regional, remote) |
| Incident end in scenario | 20:00 handover to the night organisation |

---

## 3. Information available in 2030 — the source inventory

Tier as in `02` §3: T1 pushed · T2 system-queryable · T3 ask a person · T4 lateral traffic.

| Source | Status by 2030 | Tier | Latency | Reliability class | Failure mode used in scenario |
|---|---|---|---|---|---|
| Emergency centre task record (ERICA) | Operational | T2 | Minutes | High for what the caller said | First location 300 m off (clumsiness #11) |
| Field command system entries (KEJO-type) | Operational | T1/T2 | Typed when a hand is free | Variable | Record thins under load (#7) |
| Vehicle positions (AVL) | Operational for vehicles | T1 | ~30 s | High | GPS drift on EK12 (fault F2); **crews on foot are not tracked** |
| Unit status codes | Operational | T2 | Entered late or never | Low | EK12 shows *kohteessa* since 13:40 while moving (#5) |
| Broadband authority radio (Virve 2.0-type), voice + data | Operational | T1 (voice), T4 (lateral) | Live | High where coverage exists | Dead zone in the northern valley (fault F3) |
| **Drone group** — two thermal multicopters + one long-endurance VTOL | Operational in larger departments | T1 (perimeter updates), T2 (imagery) | 1–5 min | High while airborne | Battery limits; grounded when the helicopter works; thermal saturation in crown fire (F4); rain-cooled surface hides smouldering |
| Volunteer fire-spotting aircraft | Operational in fire-warning periods | T1 | 5–15 min, via voice relay | Medium | Report not entered for 20 min (Kalajoki lesson) |
| Satellite thermal hotspots (polar orbiters; geostationary coarse detection; emerging small-sat constellations) | Operational (coarse); small-sat constellations partly available | T2 | 20–60 min | Medium; coarse position | Crown-run hotspots appear two cycles late (F5); smoke and cloud gaps |
| SAR imagery through smoke | Available on tasking | T2 | Hours | High but late | Arrives after the incident's key decisions (cycle 16) |
| FMI forecast, warnings and index | Operational | T2 | Hourly | High for means, weaker for gusts | **Gusts under-forecast locally** (M2); not pushed (Kalajoki lesson) |
| Portable weather station at the command point | Operational | T1 | 1 min | High, but one point | Sheltered by forest; under-reads open-ground wind |
| Forest stand data (Metsäkeskus, laser-scan based) | Operational | T2 | Static | Good but **dated** | Last scan predates a thinning and a storm-damage salvage: fuel boundary wrong (M3) |
| Peat and ditch network data | Operational | T2 | Static | Good | Ditch-maintenance record in a separate register (T2 cycle 12) |
| Road register (load limits) | Operational | T2 | Static | High | Bridge limit not shown on the map layer (cycle 16) |
| Water-point register | Operational | T2 | Static | Medium | One point dry this summer (T4 `t4.water_state`) |
| National spread-simulation service → **the machine's envelope** | In use / late trial | T1 (envelope) | Per cycle | Deliberately 50% | Uses mean wind, stale fuel map, no spotting, no deep ground fire (M1–M4) |
| Body-worn heat-stress sensors | **Pilot, one unit (EK11)** | T2 | 1 min | Medium | Only EK11 is instrumented; others unknown |
| Hose-laying ground robot (UGV) | **Pilot, arrives with reinforcements** | T1 (position), T3 (operator) | Live | Medium | Stuck on soft ground once (cycle 19) |
| Public warning (vaaratiedote / cell broadcast) | Operational | — | Minutes after decision | High | Decision authority lies with the police and the emergency centre |
| Civilians: harvester operator, farmers with slurry tankers, cabin owners | Real resources | T3 | By phone | Mixed | Enthusiastic, untracked, outside the command structure (Sweden 2018) |

**Deliberately not available:** position of firefighters on foot; reliable detection of ground fire below 10 cm after rain; a validated spread model for drained peat; shared airspace for drones and helicopters; live data from the second incident.

---

## 4. Commander's intent

The two texts below are what Paper 2 scores against. They are written to create a clear "old strategy" that later options can still follow.

### 4.1 Initial intent — prologue and phase A (from P3 at 13:00, W5)

> **Tavoite:** palo rajataan **[nimi] metsäautotien**, **[nimi] lammen** ja eteläisen suoalueen väliin.
> **Painopiste:** kärjen pysäyttäminen koillisessa ennen kuusikkoa ja pohjoiskyljen hallinta.
> **Toimintatapa:** suora hyökkäys siellä, missä teho sallii.
> **Resurssit:** yksikkö vapautetaan heti, kun sen lohko on hallinnassa — kesäloma-aika, alueen valmius on ohut.

*Contain between the forest road, the pond and the southern bog. Priority: stop the head in the northeast before the spruce and control the north flank. Direct attack where intensity allows. Release a unit as soon as its sector is in hand.*

### 4.2 Hinge guidance — phase B (from P3 at 16:40, after the pause)

> Alueella on nyt kolme maastopaloa. **Uusi linja:**
> 1. **Ihmiset ja asutus ensin.** Valmistaudu **[nimi] Mökkirannan** ja **[nimi] kylän** evakuointiin yhdessä poliisin kanssa.
> 2. **Puolustava toiminta.** Linjat teiden, vesistöjen ja vanhan linnoitusuran varaan. Ei miehistöä kärjen eteen kuusikossa.
> 3. **Ei vapautuksia ennen varmistusta.** Lohkoa ei vapauteta ennen kuin jälkisammutus on varmistettu lämpökameralla vähintään 30 metrin syvyyteen ojitusalueilla.
> 4. **Resurssit P3:n kautta.** Alue voi siirtää yksiköitä toiselle palolle klo 17.40 alkaen.

*There are now three wildfires in the region. New line: (1) people and settlement first — prepare evacuation of the lakeside cabins and the village with the police; (2) defensive action on roads, water and the old fortification track, no crews ahead of the head in spruce; (3) no sector released until mop-up is thermally confirmed to 30 m depth in ditched ground; (4) resources through P3; the region may move units to another fire from 17:40.*

**What changes, and what "old strategy" looks like in phase B:** direct attack at the head; releasing units once a sector looks in hand; offensive use of resources over protection of people. Rules 3 and 4 collide deliberately at cycle 14.

---

## 5. Geography

> **[AMENDED 2026-09-23]** SALPA removed; site chosen by `23`; see the amendment at the end of this document.

Distances are from the ignition point **IGN**. The author binds each item to a real feature.

| Id | Feature | Position | Role |
|---|---|---|---|
| IGN | Harvesting block, dry pine heath | 0 | Origin |
| R1 | Forest road **[nimi]**, gravel, E–W | 400 m N | First line; spot fire crossing W3 |
| RIDGE | Lichen-heath esker ridge | 800–1,200 m NE | Second ignition (cycle 3) ahead of the head |
| SPR | Mature, unthinned spruce, low crown base | 1.3–2.2 km NE | Crown run (cycles 5–7). Stand data shows it as thinned (M3) |
| BIRCH | Birch–aspen strip along a brook | 2.3 km NE | Where the crown run drops (cycle 7) |
| POND | Pond **[nimi]** | 1.5 km NW | Water point W1 |
| LAKE-N | Lake **[nimi]** with 14 cabins (**Mökkiranta**) | 2.5 km NW | Values at risk after the wind backs (cycle 9) |
| VALLEY-N | Wet valley north of R1 | 1–2 km N | Radio dead zone (F3); EK14's sector |
| BOG-S | Drained peatland, ditched; **ditch maintenance 2024** with spoil banks | 0.6–1.8 km S/SE | Smouldering and the omission (cycle 12); peat depth (15) |
| R2 | Forest road **[nimi]**, water-shuttle route | Along the E side, crossing BOG-S's east edge | Cut by fire (cycle 13) |
| SALPA | Old fortification track (Salpa Line), cleared corridor | 2 km S, E–W | Defensive line in phase B |
| BRIDGE | Timber bridge on R3, load limit 16 t | 3 km E | Reinforcement route problem (cycle 16) |
| VILLAGE-E | Village **[nimi]**: 9 houses, 2 farms | 3.5–4 km SE | Evacuation advisory (cycle 17) |
| W2 | Farm pond at VILLAGE-E | 3.8 km SE | Water point; shallow |
| W3 | River crossing **[nimi]** | 4 km NE | Reliable water point, long shuttle |
| PL | 110 kV power line, NE–SW | 1.5 km E | Smoke under the line; grid operator asks for a status report (cycle 6) |
| CP | Command point at R1/R3 junction | 1 km W | Participant's location; portable weather station |

### Sectors (lohkot)

| Sector | Area | Phase A | Phase B |
|---|---|---|---|
| **L1 Pohjoinen** | North flank, R1 to VALLEY-N and LAKE-N | EK14 | EK14 + relief |
| **L2 Kärki** | Head, RIDGE → SPR → BIRCH | EK11, EK12 | Defensive only (rule 2) |
| **L3 Etelä** | BOG-S, ditches, SALPA | VPK | KY21, then reinforcements |
| **L4 Länsi** | Origin and rear, CP | Harvester operator, VPK | Mop-up |

---

## 6. Weather series

> **Stale (8 Oct 2026):** the shower of row 10 was withdrawn on 2 Oct 2026; there is no rain at any time. See revision (y) §y.6.

The FWI-system columns are **scenario-internal values** computed with the standard equations, so that the failure mechanisms are physically consistent. Participants see FMI-style forecasts, the warning and the portable-station readings, not these columns.

Wind is given as the direction it blows *from*. ISI is computed for the mean wind (what the machine uses) and for the gust (what the fire meets).

| Cycle | Time | Wind from | Mean m/s | Gust m/s | T °C | RH % | Rain mm | FFMC | DMC | DC | ISI mean | ISI gust | BUI | FWI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W1 | 11:40 | SW 225 | 4 | 7 | 26 | 32 | 0 | 90 | 70 | 480 | 8.9 | 15.3 | 103 | 29 |
| W2 | 12:00 | SW 225 | 4 | 7 | 27 | 30 | 0 | 91 | 70 | 480 | 10.2 | 17.6 | 103 | 32 |
| W3 | 12:20 | SW 230 | 5 | 9 | 27 | 29 | 0 | 91 | 70 | 480 | 12.3 | 25.3 | 103 | 36 |
| W4 | 12:40 | SW 230 | 5 | 8 | 28 | 28 | 0 | 92 | 70 | 480 | 14.1 | 24.3 | 103 | 40 |
| W5 | 13:00 | SW 230 | 5 | 9 | 28 | 28 | 0 | 92 | 70 | 481 | 14.1 | 29.2 | 103 | 40 |
| 1 | 13:20 | SW 230 | 5 | 9 | 28 | 27 | 0 | 92 | 71 | 481 | 14.1 | 29.2 | 104 | 40 |
| 2 | 13:40 | SW 230 | 5 | 9 | 29 | 27 | 0 | 92 | 71 | 481 | 14.1 | 29.2 | 104 | 40 |
| 3 | 14:00 | SW 235 | 6 | 11 | 29 | 26 | 0 | 93 | 71 | 481 | 19.5 | 48.3 | 104 | 49 |
| 4 | 14:20 | SW 230 | 6 | 10 | 29 | 26 | 0 | 93 | 71 | 481 | 19.5 | 40.3 | 104 | 49 |
| 5 | 14:40 | SW 230 | 6 | 11 | 29 | 26 | 0 | 93 | 71 | 482 | 19.5 | 48.3 | 104 | 49 |
| 6 | 15:00 | SW 225 | **7** | **13** | 29 | 25 | 0 | 93 | 71 | 482 | 23.4 | **69.4** | 104 | 55 |
| 7 | 15:20 | SW 220 | 6 | 11 | 28 | 27 | 0 | 93 | 72 | 482 | 19.5 | 48.3 | 105 | 50 |
| 8 | 15:40 | SSW 200 | 6 | 10 | 27 | 30 | 0 | 92 | 72 | 482 | 16.9 | 35.0 | 105 | 45 |
| 9 | 16:00 | **S→SE 160** | 5 | 9 | 25 | 38 | 0 | 91 | 72 | 482 | 12.3 | 25.3 | 105 | 37 |
| 10 | 16:20 | SE 130 | 4 | 7 | 22 | 60 | **2.0** | **82** | 70 | **482** | 2.9 | 5.1 | **103** | 13 |
| 11 | 16:40 | S 180 | 3 | 5 | 21 | 62 | 0 | 78 | 70 | 482 | 1.6 | 2.3 | 103 | 8 |
| 12 | 17:00 | SW 240 | 3 | 6 | 22 | 55 | 0 | 80 | 70 | 482 | 2.0 | 3.4 | 103 | 9 |
| 13 | 17:20 | W 270 | 5 | 8 | 23 | 48 | 0 | 84 | 70 | 482 | 4.6 | 7.9 | 103 | 18 |
| 14 | 17:40 | W 280 | 5 | 10 | 23 | 45 | 0 | 86 | 70 | 482 | 6.0 | 14.9 | 103 | 22 |
| 15 | 18:00 | WNW 290 | 6 | 11 | 23 | 43 | 0 | 87 | 70 | 482 | 8.3 | 20.5 | 103 | 28 |
| 16 | 18:20 | NW 310 | 6 | 10 | 22 | 44 | 0 | 88 | 70 | 482 | 9.6 | 19.7 | 103 | 31 |
| 17 | 18:40 | **NW 315** | **9** | **14** | 21 | 42 | 0 | 89 | 70 | 482 | 19.0 | **47.1** | 103 | 48 |
| 18 | 19:00 | NW 315 | 7 | 12 | 20 | 45 | 0 | 89 | 70 | 482 | 13.2 | 32.8 | 103 | 38 |
| 19 | 19:20 | NW 320 | 6 | 11 | 20 | 48 | 0 | 88 | 70 | 482 | 9.6 | 23.7 | 103 | 31 |
| 20 | 19:40 | NW 320 | 5 | 9 | 19 | 52 | 0 | 87 | 70 | 482 | 6.9 | 14.3 | 103 | 25 |

**The meteorology is one coherent story:** a southwesterly afternoon with gusts (M2) → winds **back** ahead of a weak front (cycle 9) → a 2 mm shower as it passes (cycle 10) → winds **veer** to the northwest and strengthen in cooler, gusty air behind it (cycle 17).

**M1 in the numbers:** after the shower, FFMC falls from 91 to 82 and ISI collapses, so a surface-based projection says "slowing". DC stays at 482, because 2 mm is below the DC rain threshold, and BUI stays above 100. The deep layers are as dry as before.

**Flag for the reviewer:** DC ≈ 480 is high for Finland but plausible in a long drought. FFMC is treated as varying within the day for scenario purposes; the standard system computes it once daily.

---

## 7. Fire behaviour by cycle

ROS is in metres per minute; "20-min advance" is what the participant can check against the envelope. Area is the authored burned area at cycle end.

| Cycle | Head ROS (actual) | Envelope assumed | Flag | What happens | Area ha |
|---|---|---|---|---|---|
| W1 | 3 | 3 | H | Surface fire in harvest slash and pine heath, running NE | 1 |
| W2 | 4 | 4 | H | Head approaches R1 | 3 |
| W3 | 6 (gust) | 4 | Q | Spot fire 30 m across R1; VPK knocks it down | 5 |
| W4 | 5 | 5 | H | Line along R1 holds in the west | 8 |
| W5 | 7 | 5 | Q | Head accelerates in open pine at the block edge | 11 |
| 1 | 6 | 6 | H | Command handover. Size estimates conflict: 11 ha (drone) vs 15 ha (EK11) | 14 |
| 2 | 6 | 6 | H | Lines being established on both flanks | 18 |
| 3 | 7 + spotting | 7 | Q | **Second ignition on RIDGE**, 250 m ahead. Cause open: ember spotting, or lightning from the passing thunderstorm line | 24 |
| 4 | 7 | 7 | H | Junction of main fire and ridge fire; water-point selection | 30 |
| 5 | 11 | 7 | Q | Head enters SPR. Stand data shows it as thinned; it was not (M3) | 38 |
| 6 | 18–22 | 8 | **C** | **Crown run** in SPR with spotting 200–400 m (M2 + M3 + M4). Near-miss: EK12 crew withdraws | 58 |
| 7 | 8 | 8 | H | Crown run drops in BIRCH; surface fire continues | 70 |
| 8 | 8 | 6 | Q | Helicopter working the head; drones grounded north of R1; spread faster than modelled on the NE edge | 82 |
| 9 | 7 on north flank | 1–2 (flank) | **C** | **Winds back:** the north flank becomes a head running NW toward LAKE-N, on ground unobserved since cycle 8 | 96 |
| 10 | 1–2 | 2 | H | Shower. Crews report L1 and L2 **in hand**. Steam, peat smell in BOG-S | 100 |
| — | — | — | — | **HINGE 16:40** | — |
| 11 | 1 | 1 | H | Quiet. Relief planning. `t4.private_doubt` from VPK about the bog | 101 |
| 12 | 3 surface, new front | not represented | **C + omission** | **Smouldering in the 2024 ditch-spoil banks in BOG-S surfaces** as open fire on the SE edge, outside every envelope | 104 |
| 13 | 4 | 4 | H | Fire crosses R2: the water shuttle is cut | 110 |
| 14 | 6 | 4 | Q | SE edge spreads in dry pine between ditches; region asks to release KY21 and the VTOL drone | 118 |
| 15 | 1 surface; burn depth 20–40 cm | surface only | **C** | Deep burning in the humus layer and stump roots on the mineral soil north of the Honkaharju road (revision (al); was "deep ground fire in drained peat": Rahkasuo's drained peat lies ~170 m south of the road, beyond the fire until 19:00); water does not penetrate without wetting agent | 122 |
| 16 | 5 | 5 | H | Reinforcements arrive via R3; BRIDGE limit stops the heavy tanker | 128 |
| 17 | 10 (gusts) | 7 | Q | **Second wind event:** NW gusts drive the SE head toward VILLAGE-E (Kalajoki-type 9–11 m/min on mineral soil) | 142 |
| 18 | 7 | 7 | H | **Contradiction:** spotting aircraft reports the north flank accelerating; EK14 reports its line holding | 152 |
| 19 | 9 | 7 | Q | Head gusts past SALPA corridor's east end; crews rotating out | 164 |
| 20 | 5 | 5 | H | Head held on SALPA and the village fields; handover | 172 |

Flags match `03` §4.2 exactly (10 H, 6 Q, 4 C in cycles 1–20). Prologue: 3 H, 2 Q, no C.

**Scale check:** ~170 ha in 8 h 20 min is at the severe end of Finnish experience, comparable in order of magnitude to Kalajoki 2021, and far below Swedish 2018 fires. This fits the `03` §1.4 divergence statement.

### 7.1 The contradiction (cycle 18), resolved in geography

The spotting aircraft sees a new spot fire 150 m **north of the east end of EK14's line**, across a forest track, and reports "the north flank is accelerating". EK14 sees only its own line, which is holding. The reconciling T4 item: EK14's crew leader tells the neighbouring relief unit on their direct group that "something is smoking behind the track to the east, not ours". Both reports are true.

### 7.2 The omission (cycle 12), resolved in geography

The 2024 ditch maintenance left 1–1.5 m spoil banks of dry peat along three ditches in BOG-S. Fire entered them at cycles 6–9 via spotting and smouldered under the surface. The shower cooled the surface. The drones that could have caught it were grounded or tasked north. Thermal after rain showed only steam. At 17:00 the fire surfaces 600 m beyond the south edge of every envelope. The ditch-maintenance record exists — in the forest-use register, not on the map (T2).

> **Amended 1 Oct 2026 (content review, researcher decision):** distances follow the fire model. In the frozen CA run the new front surfaces about **1.64 km** from the reported perimeter (bearing ≈164°, V9 flag gap 1630 m), not 600 m; every generated distance to it uses the CA value. The open fire is reported at 17:01 by the spotter aircraft **SPOT** (`atom.demo.12.0`, on patrol in step 12), not by KY21, which is on L1B about 2 km away and cannot see the bog. KY21 is still the unit that returns at V10.

---

## 8. Units and aircraft

### 8.1 Order of battle

| Id | Type | Crew | From | Notes |
|---|---|---|---|---|
| EK11 | Rescue engine + tanker | 1+5 | South Karelia, nearest full-time station | First unit; body-worn sensors (pilot) |
| VPK | Volunteer brigade, tank truck | 1+3 | Local | Knows the ground; untracked hand crews |
| EK12 | Rescue engine | 1+4 | South Karelia | AVL drift (F2) |
| EK14 | Forest-fire unit (terrain vehicle + trailer) | 1+3 | South Karelia | North flank |
| KY21 | Rescue engine + forest-fire container | 1+4 | Kymenlaakso | Cross-border unit; different call-sign conventions |
| DRONE | Drone team: DR1, DR2 (thermal multicopters, ~35 min per battery), DR3 (VTOL, ~2.5 h, perimeter mapping) | 3 | Regional drone unit | Operators on the ground at CP |
| HELI1 | Helicopter with bucket | — | State aviation, requested at 14:20 | Arrives 15:40, after its requested lead time |
| SPOT | Volunteer spotting aircraft | 2 | Fire-warning patrol | Voice reports via emergency centre |
| HARV | Harvester and operator (civilian) | 1 | Forest contractor | Digs a mineral-soil line in L4 |
| FARM | Two farmers with slurry tankers (civilian) | 2 | VILLAGE-E | Water in phase B |
| EK15, EK16, KY23 | Reinforcement engines (company level) | 1+4 each | Neighbouring stations | Escalation decided at cycle 7 |
| OUT1, OUT2 | Reinforcements from outside the region | 1+4 each | Other region | Unfamiliar ground; arrive cycle 16 |
| UGV1 | Hose-laying ground robot (pilot) + operator | 1 | Arrives with OUT1 | Stuck once in soft ground (cycle 19) |
| POL | Police patrol | 2 | — | Evacuation authority |
| P3 | Duty officer | — | Remote | Source of intent |

### 8.2 Timeline

| Cycle | EK11 | VPK | EK12 | EK14 | KY21 | Drone team | Air | Others |
|---|---|---|---|---|---|---|---|---|
| W1 | En route | En route | — | — | — | — | — | HARV on scene |
| W2 | On scene, R1 west | On scene, L4 | En route | — | — | DR1 launched from EK11 | — | |
| W3 | R1 | Spot fire N of R1 | En route | — | — | DR1 over head | — | |
| W4 | R1 east | L4 | On scene | En route | — | DR1 battery swap | — | FMI gust forecast in T2 |
| W5 | Head, L2 | L4 | L2 | En route | En route | DR1 | — | P3 intent |
| 1 | L2 | L3 | L2 | Arriving L1 | ETA 25 min | Team arrives: DR1–3 | SPOT on patrol | Berry pickers possibly in forest |
| 2 | L2 | L3 | L2 | L1 | ETA 5 min | DR3 mapping loop | | EK11 and EK14 agree a boundary (T4) |
| 3 | L2 ridge | L3 | L2 | L1 | Arrives, L3 | DR1 on ridge fire | | Thunderstorm line north of area |
| 4 | L2 | L4 | L2 | L1 | L3 | DR2 link drop 3 min (F1) | | `t4.water_state`: W1 low |
| 5 | L2 | L4 | L2 → SPR edge | L1 | L3 | DR3 thermal on SPR | | |
| 6 | L2 withdraws | L4 | **Near-miss, withdraws** | L1 | L3 | DR3 thermal saturated (F4) | SPOT reports crown fire | `t4.ember_warning` (from cycle 4); grid operator call |
| 7 | L2 BIRCH | L4 | Status stale (F2) | L1 | L3 | DR2 battery low (T4 warning) | HELI1 ETA 20 min | **Escalation to company** requested |
| 8 | L2 | L4 | L2 | L1 | L3 | **DR1, DR3 grounded** (heli area N of R1); DR2 over L3 only | **HELI1 working head** | Satellite hotspots from cycle 6 appear (F5) |
| 9 | L2 | L4 | L2 | L1, radio dead zone (F3) | L3 | DR2 battery swap | HELI1 | Cabin occupancy unknown; POL contacted |
| 10 | "In hand" | L3 | "In hand" | "In hand", voice only | L3 | DR3 relaunch, rain on optics | HELI1 refuelling | EK15 arrives |
| **Hinge** | | | | | | | | P3 guidance |
| 11 | Relief planning | L3, private doubt | L2 | L1 | L3 | DR1 to LAKE-N cabins | HELI1 on standby | EK16, KY23 arrive |
| 12 | L2 | L3 | L2 | L1 | L3 → SE | DR2 to BOG-S | — | **Surfacing fire in BOG-S** |
| 13 | → L3 | L3 | L2 | L1 | L3 | DR2 | — | R2 cut; FARM tankers offered |
| 14 | L3 | L3 | L2 | L1 | **Release requested** | **DR3 release requested** | — | Second incident crews on shared group (T4) |
| 15 | L3 | L3 | L3 | L1 | L3 | DR2 | — | Wetting agent short; hose short (Sweden 2018) |
| 16 | L3 | L4 | L3 | L1 | L3 | DR1 | SAR image arrives | OUT1, OUT2, UGV1 arrive; BRIDGE blocks heavy tanker |
| 17 | L3 SE | Evacuation help | L3 | L1 | L3 | DR1 over VILLAGE-E | HELI1 recalled to other fire | POL: evacuation advisory; public warning |
| 18 | L3 | VILLAGE-E | L3 | L1 line holding | L3 | DR2 | **SPOT: north flank accelerating** | Lateral traffic reconciles |
| 19 | **Crew ~7.5 h on task** | Rotating | L3 | L1 | L3 | DR1 | — | UGV1 stuck; heat-stress readings high on EK11 |
| 20 | Handover | Handover | Handover | Handover | Handover | Handover | — | Night organisation arrives |

---

## 9. Values at risk

| Id | What | Where | People | Becomes critical |
|---|---|---|---|---|
| V1 | 14 cabins, Mökkiranta | LAKE-N | Occupancy unknown until cycle 17 (holiday Friday) | Cycle 9 |
| V2 | Village: 9 houses, 2 farms with livestock | VILLAGE-E | ~25 residents | Cycle 17 |
| V3 | Berry pickers | Forest, unknown | Unknown | Cycle 1 |
| V4 | 110 kV power line | PL | — | Cycle 6 |
| V5 | Water shuttle route | R2 | — | Cycle 13 |
| V6 | Salpa Line structures (protected heritage) | SALPA | — | Cycle 19 |
| V7 | Crews | All | ~30 → ~50 | Cycles 6, 19 |

---

## 10. Injected faults (Ruest-style fault campaign)

Faults are authored, deterministic, and logged as truth.

| Id | Cycle | Fault | What the participant can notice |
|---|---|---|---|
| F1 | 4 | DR2 data link drops for 3 minutes | Frozen footprint, stale timestamp |
| F2 | 7 | EK12 AVL position drifts 400 m | Position disagrees with the crew's radio report |
| F3 | 9–10 | Radio dead zone in VALLEY-N | EK14 traffic becomes voice-relayed, logged without content |
| F4 | 6 | DR3 thermal saturation over the crown fire | Implausibly uniform hot area; perimeter unusable |
| F5 | 6 → 8 | Satellite hotspots from the crown run arrive two cycles late | Hotspots appear where fire already was |
| F6 | 12 | Rain-cooled surface hides smouldering from thermal | Only steam visible; the omission |
| F7 | 8 → end | Command-post operator logs the 110 kV line (V4) as "de-energised, confirmed"; it stays live, never corrected (`02` revision (o) §5) | Contradicts the grid operator's cycle-6 record; no confirmation exists anywhere |

---

## 11. Where each lesson appears

| Lesson | Source | Cycle(s) |
|---|---|---|
| Ignition from forestry work | Västmanland 2014 | W1 |
| Multiple ignitions, including lightning | Ljusdal 2018 | 3 (ambiguous), hinge (three fires in region) |
| Weather services underused; gust forecast available but not pushed | Kalajoki 2021 | W4, 5–6 |
| Slow, cautious start; escalation late | SOU 2019:7; Kalajoki | 7 (escalation), 8 (helicopter late) |
| Surveillance-aircraft reports delayed or not entered | Kalajoki | 6, 18 |
| Apparent control, then re-ignition from smouldering ditch spoil | Kalajoki | 10–12 |
| Operations ended too early; rule against early release | SOU 2019:7 | Hinge rule 3, 14 |
| Water supply fails when most needed | Kalajoki | 4, 13 |
| Shortages of hose, pumps, wetting agent | SOU 2019:7 | 15 |
| Civilians as resources, outside command | Ljusdal 2018; Kalajoki farmers | W1, 13, 17 |
| Unclear responsibility when the region steps in | Ljusdal 2018 | 14 |
| Unfamiliar reinforcements, load limits | SOU 2019:7 | 16 |
| Long shifts and fatigue | Kalajoki | 19 |
| Provenance on every observation; unknown shown as unknown | wildfire-robotics | All atoms |
| Authored fault campaign | wildfire-robotics | §10 |
| Authorisation separated from decision | wildfire-robotics | Drone tasking: operator proposes, PTJ authorises, logged as separate events |

---

## 12. Changes applied to `03` (revision (g))

| Item | Change |
|---|---|
| Cycle 1 title | "Arrival" → **"Command handover"** (*Johtovastuun siirto*), since the prologue covers arrival |
| §7.3 worked example (crown-run gap at 17:12–18:51) | Re-time to the crown run at cycles 5–7: **gap 14:52–16:05** |
| §4 starting force | "Four formations plus a drone" → four formations, a volunteer brigade, a three-aircraft drone team and a civilian harvester |
| §4.1 cycle 8 | "Drone grounded" → DR1 and DR3 grounded north of R1; DR2 keeps flying over L3 |
| §4.1 cycle 14 | Released formations → KY21 and DR3 requested by the region |
| §8 channel vocabulary | Not needed while the AI is pull-only; keep for a later study |
| §10 budget | Add: 5 prologue cycles, 2 civilian resources, fault events F1–F6, satellite and SAR layers |

---

## 13. Questions for the domain reviewer

1. Are the ROS values and the 170 ha end state plausible for this terrain and weather?
2. Would a *joukkueenjohtaja* take command at 13:20 for an 11 ha fire, and escalate at cycle 7?
3. Is a three-aircraft drone team realistic for a southeast-Finland department by 2030? Grounding rule with a helicopter?
4. Is the ditch-spoil re-ignition mechanism recognised in this region?
5. Is the hinge guidance realistic in content and wording, and would a duty officer issue it at 16:40?
6. Does the region realistically request KY21 and the VTOL drone for another fire?
7. Call signs, record fields and Finnish register throughout.
8. Is harvester line-digging and farmers' tanker use realistic, and how would it be recorded?

---

## Amendment 23 Sep 2026 — location and geometry

- **§2 ignition point and §5 geography:** the site is chosen by the search in `23`. The coordinate in §2 is a starting point for the search, not a decision. Every **[nimi]** is bound after the search, with real or invented names (`23` §7).
- **§5 distances:** after the search they become measured values. The fire model (`24`) checks them against the rates in §7. On today's rates the south-east front reaches at most about 2.8 km, short of VILLAGE-E at 3.5–4 km (`23` §6).
- **Place names:** real names as printed on the MML basemap (`23` §7).
- **The Salpa Line is removed from the scenario** (decision 23 Sep 2026). Replacements:
  - **§4.2 hinge guidance, rule 2:** *"Linjat teiden, vesistöjen ja vanhan linnoitusuran varaan"* becomes *"Linjat teiden ja vesistöjen varaan"*;
  - **§5 SALPA row:** deleted. The phase-B defensive line **L-B** is a forest road or field edge about 2 km south of IGN, bound on the chosen site;
  - **§5 sector L3 Etelä:** BOG-S, ditches and L-B;
  - **§7 cycles 19–20:** "past SALPA corridor's east end" becomes "past the east end of L-B"; "held on SALPA and the village fields" becomes "held on L-B and the village fields";
  - **§9 V6** (Salpa Line structures): deleted;
  - **`19` §3 heritage register row:** deleted.
- **The site's one hard requirement on ground** is that the fire can spread widely enough (`23` §3 H6); the other §5 features may be substituted by similar real ones.
- **§7:** perimeters and envelopes are generated from §6 and §7 by the cellular automaton in `24`.

---

## Revision 23 Sep 2026 (j) — tier T3 retired

Follows `02` revision (j) and `19` revision (b).

- **§3 tier column.** Every "T3" entry means: the source knows it, but the participant can reach it only through a recorded trace, if one exists. Examples are the UGV operator, civilians by phone, and the drone operator. The per-item decisions are in `19` R.1.
- **The world state keeps everything.** Withdrawn knowledge still happens in the world and still shapes outcomes: crew exhaustion, depth of burn, warm ground in BOG-S. It is ground truth, not information. Nothing in this document is deleted because the participant can no longer ask about it.
- **§10 fault F3** (radio dead zone, EK14 traffic voice-relayed and logged without content) is unchanged. It now matters more: that metadata-only entry is the only trace, and nobody can ask what was said.
- **Civilians** (harvester operator, farmers, cabin owners) reach the record only through emergency-centre task records (`19` §3.2).

---

## Revision 24 Sep 2026 (k) — the incident bound to the generated site

Follows `24` §11 and `23` §11–§14. Where this revision and the sections above differ, this revision applies.

### k.1 §7 rates changed so the flags hold on the ground

| Cycle | Head ROS actual (was) | Envelope assumed (was) | Change in "what happens" |
|---|---|---|---|
| W3 | 6 (6) | 3 (4) | Spot fire lands 70 m ahead of the head, across R1 |
| W5 | 8 (7) | 2.5 (5) | — |
| 3 | 7 (7) | 5 (7) | Second ignition on RIDGE **140 m** ahead (was 250 m) |
| 6 | 18–22 | 8 | Spotting **200–250 m** ahead (was 200–400 m) |
| 14 | 7 (6) | 2 (4) | — |
| 17 | 11 (10) | 5 (7) | Still within Kalajoki's 9–11 m/min on mineral soil |
| 19 | 9 (9) | 4 (7) | "Past the east end of L-B" |

The authored areas in §7 remain targets. The CA gives 56 ha at cycle 6 and 164 ha at cycle 20 (`24` §11).

### k.2 §5 features bound to the generated site

Positions are bearing and distance from IGN (ETRS-TM35FIN 519 000 E, 6 746 000 N).

| Id | Bound to | Position |
|---|---|---|
| R1 | Gravel road through (0, 400 m) | 400 m N |
| RIDGE | Kuivakangas esker | 045°, 1.0 km |
| SPR | Kuusimäki | 047°, 1.75 km |
| BIRCH | Birch strip along Koivuoja | 045°, 2.3 km |
| POND / W1 | Haukilampi | 315°, 1.5 km |
| LAKE-N / V1 | Karhujärvi; Mökkiranta on its SE shore | 320°, 2.5 km |
| BOG-S | Rahkasuo (ditched, 2024 spoil banks) | 168°, 1.25 km |
| R2 | Gravel road along x = 1.5 km, R1 → Lahdenkylä | E side |
| BRIDGE / W3 | Timber bridge over Kotkanjoki on R3; W3 is the river at the bridge (was "4 km NE") | 083°, 3.1 km |
| VILLAGE-E / V2 / W2 | Lahdenkylä (moved in to 3.0 km, `23` §6) | 135°, 3.0 km |
| CP | R1/R3 junction | 292°, 1.1 km |
| L-B | The Lahdenkylä field edge and R2's southern leg | SE, 2–3 km |

**Finding, open:** in the CA the Rahkasuo front stays about 1 km west of R2 all afternoon, so **"fire crosses R2" (cycle 13) does not happen on the ground**. Either the water-shuttle route V5 is re-bound to a forest road across Rahkasuo, or the cycle-13 beat becomes "the fire threatens the shuttle route". **Decision needed** with the domain reviewer. The demo's story text still reads "fire crossed the service road".

### k.3 §8.3 (new) — where units and aircraft are

`tools/fire-ca/deployment.ts` binds §8.2's timeline to the ground. Positions are anchors, resolved against each cycle's **reported** fire:

- **Sector edge** (`edge:L1`, `L1B`, `L3`, `L3SE`, `L4`, or a feature such as `RIDGE`): the crew stands 40 m outside the burned cell nearest the sector's anchor point. Crews sharing an anchor work their own 150 m stretch of edge.
- **Head flank** (`head:L`, `head:R`): 300 m either side of the head, measured across the previous cycle's wind. EK11 takes the left (north) flank of the head and EK12 the right.
- **Fixed feature** (`at:CP`, `R1_MID`, `R2_BOG`, `VILLAGE`, …): withdrawals, transit, evacuation help and the handover.
- **Stale**: the unit's last position repeats: EK12 in cycle 7 (F2 AVL drift), EK14 in cycle 9 (F3 radio dead zone), UGV1 in cycle 19 (stuck).

Sector anchors: L1 north flank (−0.3, +1.15 km); L1B, the north flank after the backing wind, toward Karhujärvi (−0.8, +1.35 km); L3 Rahkasuo; L3SE, the SE front toward Lahdenkylä (+1.6, −1.5 km); L4 origin and rear (−0.45, −0.05 km).

Reinforcements appear as they arrive: EK15 in cycle 10, to L1B; EK16 and KY23 in cycle 11, to L3/L3SE; OUT1, OUT2 and UGV1 in cycle 16, at the bridge (the heavy tanker stops there), then L3SE. All units are at CP for the handover in cycle 20.

**Aircraft** (`AIR_PLAN`):
- **DR1 and DR2** (thermal multicopters) fly out from CP and orbit their target at 120 m, with a 300 m ground footprint.
- **DR3** (VTOL) flies the whole perimeter 150 m outside it; its footprint is the perimeter plus 300 m.
- **HELI1** shuttles its bucket between Haukilampi (W1) and the head in cycles 8–9.
- **SPOT** flies a 2.5 km patrol circuit when it reports (cycles 1, 3, 6, 17, 18).

Drone coverage over the day:

| Cycles | Airborne drones |
|---|---|
| 1–7 | DR1 over the head (the ridge fire in 3); DR2 over L3 from 4; DR3 on its mapping loop, or thermal over SPR in 5–6 |
| 8 | DR2 only, over L3: DR1 and DR3 grounded for the helicopter |
| 9 | None (DR2 battery swap): the north flank is unobserved, as `12` §9 requires |
| 10–14 | DR3 relaunched on its loop; DR1 over Mökkiranta in 11–12 |
| 12 | DR2 over the main fire's south edge, not over the surfacing point: the omission is unobserved |
| 13 onwards | DR2 over Rahkasuo, then the SE front |
| 17 | DR1 over Lahdenkylä |

A footprint is drawn only while its platform is airborne (`12` §6.5).

### k.4 §6 wind on the map

Every cycle shows the portable station's reading at CP, taken at the cycle's start: the direction it blows **from** and the **mean** speed. Gusts stay in the weather record only, so mechanism M2 still has to be queried (`12` §9 cycle 17). The reading is identical in every condition. **For the reviewer:** at 16:00 the reading already shows the backed wind (160°), a legitimate verification cue against cycle 9's envelope. If that makes cycle 9 too easy, the station reading can lag by one reading (10 min).

---

## Revision 24 Sep 2026 (l) — units move for a reason; the fire's contact with roads and brooks is on the radio

Supersedes the positioning rule of revision (k) §k.3.

### l.1 Units hold a stretch; they move only with a logged reason

A unit's day is a list of **moves** (`tools/fire-ca/deployment.ts` `UNIT_PLAN`). Between moves it **holds**: it keeps its own stretch of the fire's edge, the unburned edge cell nearest its last position. It drifts outward only as the fire grows past it. A move is the only way to change stretch, and every move carries a reason:

| Reason | Example on the radio |
|---|---|
| arrive | "EK14 saapunut pohjoisreunalle (lohko L1)." |
| reassign | "EK11 siirtyy Kuivakankaan harjulle (uusi syttymä harjulla)." |
| withdraw | "EK12 vetäytyy R1:n ja R2:n risteykseen (läheltä piti -tilanne latvapalossa)." |
| water | "VPK lähtee täydentämään vettä: Haukilammelle (vesipiste W1)… Poissa linjalta noin 20 min." |
| return | "EK11 palaa linjalle, Koivuojan koivikkoon." |
| rest | "EK11 siirtyy johtopaikalle (miehistö ollut kentällä 7,5 tuntia, vaihto)." |
| evacuation | "VPK avustaa evakuoinnissa, Lahdenkylään (poliisin evakuointikehotus)." |

The message goes out in the cycle the unit appears in its new place, so the map and the log agree. **Water runs** are now part of the day: VPK to W1 in cycle 5, EK12 to W3 in 10, and EK11 to W2 in 16. **Handover** (cycle 20) happens with crews in place: the night organisation relieves them on the line, not at the command point.

**Build rule:** `site-export.ts` refuses to build if a unit moves more than 450 m between cycles without a move. `test/scenario/site-scenario.spec.ts` checks the same on the frozen bundle. Holding crews move 0–130 m a cycle.

Stale positions stay silent by design. EK12 in cycle 7 (F2) and EK14 in cycle 9 (F3) keep their last reported position with no message; that is the fault. UGV1 getting stuck (cycle 19) is announced by OUT1.

### l.2 Crossings, stops and holds on the radio

`tools/fire-ca/crossings.ts` reads the CA's cycle masks against the roads and brooks of `24` §12:

- **Crossed:** the fire reached both sides of the line during the cycle. The message says how it crossed: embers (the cycle has authored spotting), a gust-driven head (gust at the line's threshold, running with the wind) or creeping. It also says what the nearest crew could do: it put the crossing out (creeping), it tried and failed, it had to withdraw, or no crew was within 600 m, so nothing could be done. The message is delivered at the start of the next cycle, from the nearest unit, at most two per cycle.
- **Stopped:** the fire newly met a line along at least 100 m and did not get over it. Reported once per line, at most one per cycle, and never for a line crossed in the same or previous cycle.
- **Held:** an authored suppression event with a radio line, such as EK14 at R1 in cycle 4, delivered mid-cycle.

These are pushed log items (tier T1). They replace routine filler, so the tier stays in its 90–120 band.

**The cycle-13 beat (revision (k) §k.2, finding still open):** the CA's Rahkasuo front never crosses R2, and the log would now contradict a story line saying it did. The demo text reads "the fire threatens R2; the water route is at risk" until the reviewer decides.

---

## Revision 24 Sep 2026 (m) — crews on foot, vehicles on roads, and what each unit is doing

**The problem.** Units were placed on the fire edge, 40 m out, with no regard to the road network. Measured against `tools/topo-map/roads.ts`, most engines stood 300–600 m from any road a truck can drive, some of them deep in forest. A fire engine cannot get there. Its crew can, on foot, laying hose.

**Rule.** Each ground unit has a crew position (where it works, `units`, unchanged) and, when the crew works the edge on foot, a separate vehicle position (`unitWork.vehicle`):

| Unit | Vehicle access | Where the vehicle is |
|---|---|---|
| Engines and tankers (EK11, EK12, KY21, EK15, EK16, KY23, OUT1, OUT2, VPK) | Road: II/III class or metsäautotie (`TRUCK_ROADS`) | The nearest point on such a road that is at least 60 m from the reported fire |
| EK14, forest-fire unit (terrain vehicle + trailer) | Off-road | Drives into the forest to about 80 m behind its crew, toward the nearest road or track |
| UGV1, hose-laying robot | — | It is the machine; no separate vehicle |

At a point (command point, water point, road junction, village) crew and vehicle are together, on the nearest truck road.

**Tasks** (`UnitTask`, `deployment.ts` `taskFor`): on a fire edge the default is suppression through a hose line from the vehicle. It becomes **peat work** (soaking and digging) wherever the crew stands on bog (`landCover`: drained, open or pine bog), because peat fire is not put out from the surface. The forest-fire unit **pumps from natural water**; the robot **lays hose**. At a point the reason sets the task: water refill, rest, withdrawn to the road, evacuation help, staging, transit. Authored exceptions: VPK's mop-up at the ignition point (cycles 4–9), EK15 cutting a **fire break** toward the Karhujärvi cabins (from cycle 11), OUT2 cutting a fire break in front of Lahdenkylä (from cycle 17), and OUT1, OUT2 and UGV1 **blocked** at the R3 bridge (cycle 16).

**Hose lines.** Where the task takes water from the vehicle, the hose length is the straight distance × 1.15 (hose follows the ground), in 20 m lengths. The build fails above 800 m (`MAX_HOSE_M`), because a longer line cannot be laid and supplied by one engine crew. In the current build the longest line is 760 m (EK11, cycle 12), and the south-east front runs 660–720 m. These are long but plausible with forest-fire hose. The domain reviewer should confirm the limit, or add relay pumps for these.

**Stale reports** (F2 AVL drift, F3 dead zone) freeze the whole picture of the unit, including vehicle and task, like its position.

**On the map** (SPEC/12 revision 24 Sep (b)): the crew is the labelled symbol with a task glyph (water drop, pump, peat, fire break, shovel). Its vehicle is a smaller, unlabelled symbol. A solid line joins them: 2 px when it is a hose line, and faint when it is only the walking link. The hover card says what the crew is doing, how many are on foot, and how much hose is laid.

**Not changed:** crew positions, the fire, flags and radio traffic, except the two move reasons now naming the fire breaks. Road connectivity is not checked: a vehicle parks on the nearest usable road, whether or not the route to it is open. The task assignments are synthetic content for domain review, like the rest of §8.

---

## Revision 24 Sep 2026 (n): the traffic corpus, the water drone, and the interaction-log format

**Traffic corpus** (`tools/fire-ca/traffic.ts`, built into `site-scenario.json` `traffic`, 692 events). Crews, drones, aircraft, the weather station and AVL speak cycle by cycle. Everything is generated from what they can observe at that moment, never from truth or the future:
- the reported fire: area, length and head direction;
- the head rate observed over the last 20 minutes;
- the wind now;
- the ground under the unit;
- the unit's task, hose length and time on scene;
- spot fires and drone detections.

The rules that shape it:
- **The first crew's size-up** (EK11, cycle 1): size, smoke, fuel, fire behaviour, rate, wind, nearest settlements, plan and requests. It arrives in the first two minutes.
- **Every arrival** gives its own short size-up and task. VPK adds local knowledge (roads, water).
- **Crews at the head** report every cycle. Others report every other cycle, or when they move. When the head runs faster than 6 m/min, head crews add warnings about spotting.
- **Drones:** a report to command, three sensor-feed lines, and spot-fire confirmations.
- **SPOT, HELI1 and the water drone** report what they see and what they drop.
- **Weather station** readings and **AVL** position lines go to the system log (T2).
- **Ask-a-unit answers** (T3): water, road access, hose length, time on scene.
- **Lateral traffic between neighbours** (T4): boundaries, hose, water, wind shifts, smoke they cannot see.

The corpus is template-generated with a fixed seed, built once and frozen, so it is identical for every participant and in both conditions. The texts are synthetic content and need domain review.

**Water drone VD1** (forward-looking): **(8 Oct 2026, revision (aa): 80 l per drop, not 300 l; autonomous, no plan tasks)** an autonomous heavy-lift drone that scoops about 300 l per trip from the water point nearest its target (Haukilampi, Lahdenkylän lampi or Kotkanjoki) and drops it on the fire.
- **When:** it arrives with the company-level reinforcements in cycle 11 and works cycles 11–19.
- **Where:** the north flank toward Karhujärvi, the head, Rahkasuo, then the south-east front toward Lahdenkylä (`AIR_PLAN`).
- **On the map:** a dome symbol with a slung-load glyph, and a hover card marking it as a vision.
- **No effect on the model:** its drops are not modelled in the CA, like HELI1's. The fire, the flags and the scoring are unchanged.

**Interaction-log format: JSON Lines** (`npm run corpus:export`, written to `content/corpus/interaction-log.jsonl` with `interaction-log.schema.json`).
- **One line per event:** each line is a flat JSON object: `id, cycle, sim_time_s, timestamp, actor, actor_type, addressee, location, place, lat, lon, event_type, task, content, tier, channel, nav, lang`.
- **Why flat:** vector stores such as Chroma, Qdrant and pgvector filter only on scalar metadata. `content` is the text to embed, and every other field is a filter.
- **Why JSON Lines:** it streams, diffs and appends line by line, and loads directly into pandas, DuckDB or a vector store.
- **Joining:** `id` equals the corpus atom id, so a log line and the atom behind it always join.
- **No truth:** no truth annotation is exported.
- **Reproducible:** a re-run produces a byte-identical file.

**Open (later):** live imagery from the drones. Hovering a drone would open its current camera view. It needs imagery produced for each cycle from the same reported, never true, fire state, and it is not built yet.

---

## Revision 25 Sep 2026 (p) — rekindle moves

§8.2, as amended by `26` §5: at step 10, **KY21 and VPK move from L3 to L1B** (reason `reassign`, against VPK's recorded objection). At steps 11–12 they are on L1B. At step 13 they **return to L3**. §7 and the fire model are unchanged. The step numbers in this document are world-state steps. Views are defined in `26`.

---

## Revision 1 Oct 2026 — phase B widened

§7 rates changed so the burned area at 20:00 is back near the authored 172 ha (`24` revision 1 Oct 2026). Where this table and k.1 or §7 differ, this table applies. All flags are unchanged.

| Cycle | Head ROS actual (was) | Envelope assumed (was) |
|---|---|---|
| 12 | 6 (3) | not represented (1 in the CA) |
| 13 | 9 (4) | 9 (4) |
| 14 | 11 (7) | 6 (2) |
| 18 | 9 (7) | 9 (7) |
| 20 | 7 (5) | 7 (5) |

The CA now gives 168 ha at cycle 20 (was 133). At cycle 13 the Rahkasuo front is still about 770 m west of R2, so "Fire crosses R2" does not happen in the CA.

### Amendment 2 Oct 2026: weather forecasts in the corpus

**Why.** A SAGAT review found that the participant saw only weather observations (the station, `SAA`) and reports of a wind shift after it had happened. The briefing says the spread projection uses a wind forecast, so without a forecast the only way to project the weather was through the machine. Six forecast records now provide a human-readable route (`tools/fire-ca/traffic-forecast.ts`).

**The records.**
- **Source:** `SÄÄENNUSTE`, its own source as §3 requires (Ilmatieteen laitos (the Finnish Meteorological Institute), hourly; T2 system log; `nav` "saa"; not pushed). They are found through Haku or Thinker.
- **Ids:** their own sequence, `evt.wx.01`–`06`. All 947 earlier records are unchanged (checked line by line).
- **Wording:** authored, not drawn at random; Finnish and English were written side by side.

| Id | Received | View | Content |
|---|---|---|---|
| wx.01 | 12:07 | VP | Afternoon outlook: SW 4–6, gusts 8–10, dry, forest fire warning; late afternoon turning S and easing; NW in the evening |
| wx.02 | 13:21 | V1 | Weak cold front at about 16–17; wind turns S before it; showers; W, then NW |
| wx.03 | 15:03 | V4 (step 6) | Wind turning SW → S at 15.30–16.00, on to SE after 16, easing to 4–5 m/s; showers 16–17 |
| wx.04 | 16:01 | V6 (step 9) | Showers 16.15–17.00, 1–3 mm; SE, then S, SW after 17 |
| wx.05 | 17:01 | V9 | Rain passed; W 17–18; NW strengthening in the evening, gusts over 10 |
| wx.06 | 18:01 | V11 (step 15) | NW strengthening 18.30–19.00 to 7–9 m/s, gusts 12 (gusts under-forecast; mechanism M2) |

**Consistency with the model.** The forecasts agree with the forcing: 15:40 SSW, 16:00 S, 16:20 SE with 2 mm of rain, 17:20 W, 18:40 NW at 9 m/s gusting 14. They are imprecise as real forecasts are, and never contradict the truth.

**Answer key.** wx.03 (with wx.02) is the key for the Level-3 SAGAT item on the wind shift.

### Amendment 2 Oct 2026: no shower; the rekindle at the origin

**Supersedes §6's 2 mm shower at 16:20–16:40 and §7's step 10 and step 12 rows.**

- **No rain at any time.** The weather stays dry, and the forecasts say so: a weak dry front. The lull at steps 10–11 is the wind easing (SE 4 → S 3 m/s) and backing, with the head running back over its own burnt ground. The fire model never had a rain variable; only the narrative changes.
- **Step 12:** the origin's south edge flares up as the wind turns west (`26` amendment of 2 Oct). BOG-S remains a terrain feature but no longer carries the omission.
- **Step 15:** deep burning in dry humus and stumps, not peat; the head rate is 6 m/min.
- **Weather in the communications:** six forecasts. The 16:00 forecast gives the turn to the west after 17:00, which is the human route to anticipating the flare-up.

### Amendment 2 Oct 2026 (later): fire, positions and projection audit

Three read-only audits (fire behaviour, crew and vehicle positions, projection per view) were applied. Views stay 14/14; step-level checks 22/25 (14, 19, 20 differ, all unscored; V11 is depth-categorical and V14 = 19+20 is Q).

**Forcing (`scenario-18.ts`).**
- **Crown run made the fastest phase:** step 5 rosActual 11 → 14, step 6 20 → 30 (FBP C-2 at ISI 15–20: 22–31 m/min), spotting 300 and 400 m (was 200/250, overrun inside the step). Step 7 gets two `before_report` spots 250 and 330 m ahead, shown as PP1/PP2 on the 15:20 map; envelope 8 → 9.
- **Lull staged:** step 10 wind 130/3/5 (was 4/7), envelope 2 → 1. L2 and L4 are secured at step 10 and L1 at step 11, so the NW edge creeps one more step. Area at 16:20 is 123.6 ha.
- **Evening rates:** rekindle and evening rates lowered to fit 3–5 m/s: step 12 6 → 4, step 13 9 → 7, step 14 11 → 8.
- **Wind event raised (researcher, 3 Oct 2026):**
  - 18:20 now 9 m/min (was 7); the machine stays at 7, so V12 keeps Q, now with 9 escaped cells.
  - 19:00 now 11 m/min (was 9), with the envelope at 11 so V13 holds.
  - Area at 19:40 is 160.3 ha (was 157.4).
  - The V14 growth-trend key, computed from the CA, becomes "same" (was "more").
  - Road units without a hose line now also stand within a 600 m fire-free walk of a usable road. OUT2's firebreak crew had been cut off at 19:40.
- **Freeze and probe key atoms are found by content** (`freeze-keys.ts` `trafficId`), not by generated ids, which shift on every regeneration.
- **Step 19 envelope 4 → 3:** keeps V14's quantitative margin (11 cells; it was 3–5).
- **Practice W2 envelope 4 → 3.**
- **Step-18 contradiction spot:** moved to 1170 m @8° (3 Oct review; 12° sat on EK15's crew-to-truck line), north of EK14's crew. At 1350 m @30° it lay in ground that had already burned and never ignited. SPOT's rate mark now sits on the spot fire.
- **Review fixes, 3 Oct 2026:**
  - A crew cut off from every road by the fire is now a build error.
  - A kept vehicle spot needs the full 60 m clearance.
  - The way back to the crew's own vehicle is worded as such in the smoke and route-checked lines.
  - A burned-out verge is reported as "palanut alue tien reunassa — ei liekkejä, ajettavissa", not "palo noin 10 m tiestä".
  - Known remaining graze: EK11's hose line at 15:20 passes ~20 m inside the smoothed outline of a crown-run spot fire, which the map draws as an icon.

**Positions (`placement.ts`).**
- **Crew spot:** on the outer edge with the standoff; never on an unburned island, in the head's cone (±60°, two steps of run + 200 m) or where the fire gets during the step.
- **Vehicle:** on the crew's side of the fire, so the hose line and the walk cross no fire. It stays where it was until that spot is no longer valid; a crew whose truck moved says so in its answer.
- **Hose limit:** a hose crew stands within reach (800 m / 1.15 − 20) of a usable road.
- **Separation:** no two crews or vehicles share a spot.
- **Bridge stops:** OUT1, OUT2 and UGV1 now stop at the east end of the R3 bridge.
- **Stale units at 16:20:** KY21 and VPK stay shown on L3 until their move at 16:22.
- **Mop-up:** from step 11, a crew on an edge with no fire within 300 m is shown as mop-up.

**Messages.**
- **Escape route:** the crew's own vehicle when the way there is clear, else the nearest named route whose path crosses no fire.
- **Road class:** read from the vehicle's position.
- **Head and rates:**
  - The head is the live front's: spot fires under 1 ha don't count while a front grows elsewhere.
  - Crews and the map quote the measured advance.
  - Drones classify a separate fire by connectivity (so the 39 m/min crown run is no longer a "separate fire").
- **R2 distance:** the drone's R2 distance is to the whole road.
- **Other wording:**
  - VD1 drop counts fit 20 minutes.
  - EK14 pumps from a portable tank.
  - DR3 and VD1 are tasked north at steps 10–12, so nothing images the origin before the flare-up.
  - DR2 follows the SE front at step 15.
  - The thermal request is dropped when a drone already covers the crew.

---

## Revision 4 Oct 2026 (t) — one directive from P2 replaces the four hinge rules

Researcher decision of 4 Oct 2026. **This supersedes §4.2 in full:** the four rules, their English gloss, and the paragraph "What changes, and what 'old strategy' looks like in phase B", including "Rules 3 and 4 collide deliberately at cycle 14". It also supersedes:
- §2's "Above the participant: Duty officer **P3**", §8.1's P3 row and §4.1's "from P3";
- §11's row "Operations ended too early; rule against early release — Hinge rule 3, 14";
- §13 question 5, as far as it concerns the four rules.

The rekindle arc (`26` §5 and the amendments of 2 Oct) is unchanged. The decision task is in `16` revision (t), and the hypotheses are in `01` and `09` revisions (t).

### t.1 The directive

It is delivered once at the hinge (16:40, on entering V8), word for word the same in both groups, from the participant's superior. It is a **DRAFT** for native and domain review (`11` §7.16):

> **FI:** *Alueella on kolme maastopaloa. Henkilöstön turvallisuuden ja alueen kokonaistilanteen vuoksi siirrytään puolustavaan toimintaan: linjat teiden ja vesistöjen varaan, ei suoraa hyökkäystä palon reunaan. Ensisijainen tavoite on suojata Lahdenkylä ja Mökkiranta.*
>
> **EN:** *There are three wildfires in the region. For the crews' safety and the region's overall situation we move to defensive action: lines on roads and water, no direct attack on the fire's edge. The first aim is to protect Lahdenkylä and Mökkiranta.*

**Round 2 (4 Oct 2026, DEFAULT, `11` §7.16.1).** Was: *"Alueella on kolme maastopaloa ja valmius on ohut. Siirrytään puolustavaan toimintaan: …"* ("…and readiness is thin. We move to defensive action: …"). Thin readiness argues for holding units, not for a defensive posture, so the reason read backwards. The reason is now the crews' safety and the region's overall situation. The directive does not mention the forecast. The V1 intent (§4.1's posture line, from P2) carries no release sentence: one added in the first build was removed (it changed the phase-A stimulus inside H10's anticipation window). The directive message expects no reply (the participant cannot transmit).

The directive reverses phase A's posture (§4.1: *suora hyökkäys siellä, missä teho sallii*, direct attack where intensity allows) and changes how the rest of the incident is led. **It deliberately does not fit every view** (t.3). Telling when it fits takes facts from the records.

**Issuer: P2** (*päivystävä palopäällikkö*, the duty fire chief), not P3. In Finnish rescue services P3 is usually the incident commander's own level, so a directive from P3 to a commander acting as PTJ would read as an order between equals. The V1 intent message comes from the same superior and is also labelled P2. **DRAFT:** the domain reviewer confirms the title, and whether P2 or the command centre would set posture for an incident of this size (`11` §7.16).

### t.2 What was dropped, and why

| Old rule (§4.2) | Now | Why |
|---|---|---|
| 1. People and settlement first; prepare evacuation with the police | Kept **only as the stated aim**: "the first aim is to protect Lahdenkylä and Mökkiranta". Evacuation is no longer an instruction. It happens as world events (the police advisory at step 17, VPK helping in Lahdenkylä) | An aim leaves the posture to the commander. An instruction to prepare evacuation would be a second rule to comply with |
| 2. Defensive action on roads and water; no crews ahead of the head in spruce | Becomes the directive's core: defensive action, lines on roads and water, **no direct attack on the fire's edge** | One posture rule, firm enough that attacking an edge is a deviation |
| 3. No release before a thermal check to 30 m in ditched ground | **Dropped** | It cued the rekindle. Delivered at V8, between VPK's thermal-check objection (V7) and the flare-up (V9), it pointed to the origin's edge inside H10's anticipation window (V7–V8) and contaminated it (`26` revision (t)) |
| 4. Resources through P3; the region may move units from 17:40 | **Dropped as a rule.** It becomes world events only: DR3 is taken for another fire at 17:59, and its landing record says so | A rule about the region's claims on units adds a compliance item unrelated to posture. The directive does **not** say "no more resources", because reinforcements arrive at step 16 (OUT1, OUT2, UGV1) |

With rules 3 and 4 gone, the deliberate collision at step 14 (V11) is gone too. H8, which read it, is withdrawn (`01` revision (t)).

**Not changed.** This is a hard constraint: the Thinker index cannot be rebuilt in this environment. No corpus record's text, tier or id changes, and no atom is added. One pushed record therefore still mentions the old rule. It is EK11's story line at step 14 (V11): *"Alue pyytää KY21:tä toiselle palolle. Ei vapauteta ennen lämpökameravarmistusta."* ("The region asks for KY21 for another fire. No release before a thermal-camera check.") After this revision it reads as a crew leader's own position, not as a quoted rule. It is open for review (`11` §7.16).

The directive is a duty-officer message, not a corpus atom (as before; `02` revision (t)). It stays in the message log for the rest of the session. It is **not searchable by Haku or Thinker** until the index is rebuilt (`11` §7.16).

### t.3 Fit per view (phase B)

The table is read from the frozen CA run (`site-scenario.json`: the steps' `areaHa`, `wind` and `headRos`) and from the records. Records are named by source, time and content, the way the key file finds them (`freeze-keys.ts` `trafficId`), never by generated id.
- The **sound posture** column is a **DRAFT** key. The expert panel confirms or replaces it (`16` revision (t), `11` §7.16).
- Phase A has no sound keys (null), and is not coded for alignment either (round 2): the phase-A intent is conditional ("where intensity allows"), so a phase-A posture is reported descriptively.
- **The new front's sector** (V9–V10) is computed from the data: the first reported detached front in steps 12–13, by its centroid (`demo-directive.ts` `newFrontSector`). It is **L3**. A direct attack is sound there only.

| View | Situation (CA run) | Fit | Draft sound key | Deciding facts and where they are |
|---|---|---|---|---|
| V8 16:40–17:00 (step 11) | Lull. The area stays at 123.6 ha, and the CA measures no head advance. Wind S 3 m/s | Neutral | Not scored | EK14 at 16:44: the north edge is creeping at about 2 m/min (pushed). VPK's echo to EK14 (recorded) |
| V9 17:00–17:20 (12) | The wind turns W, and the origin's old south edge flares up ~200 m ESE of the ignition point. It is small in the CA (no V9 record gives a size), and no crew is on L3 (KY21 and VPK are on L1B) | **No** | `direct_attack` on the new front's sector (L3) | SPOT at 17:01: open fire and smoke SE of the origin, outside the old south edge, ~200 m from the origin (pushed). Crew positions on the map, and their move messages at step 10 (pushed) |
| V10 17:20–17:40 (13) | A new front of ~1.1 ha (124.7 ha in all at 17:20, 126.2 at 17:40). KY21, VPK, EK11 and EK16 move to it | **No** | `direct_attack` on the new front's sector (L3) | DR2's thermal report at 17:25 on the south edge (L3): a separate fire, ~1.1 ha, flames 0.3–1 m (pushed). EK16 at 17:28 and VPK at 17:32: spreading NE at about 1 m/min, the line holds (both pushed). DR3's perimeter survey at 17:35: a separate new fire, ~1.1 ha (pushed) |
| V11 17:40–18:20 (14+15) | Steady growth to the E and SE, 126.2 → 131.2 ha. Wind W 5–6 m/s | **Yes** | `barrier_line` or `protect_values` (round 2: protecting settlements is the directive's own aim) | DR2's measurements: 150 m in 17:20–17:40 (7.5 m/min; recorded) and 7.3 m/min at 18:05 (pushed). Crews report 6–8 m/min. **The 18:00 forecast** (Ilmatieteen laitos, received 18:01): NW strengthening 18:30–19:00 to 7–9 m/s, gusts 12 (**recorded only**). The 17:00 forecast (recorded only, reachable from V9) already gives the evening turn to NW, gusts over 10 m/s |
| V12 18:20–19:00 (16+17) | The wind event: NW 9 m/s, gusts 14 at 18:40. The CA head advances at 8.5, then 10.6 m/min. The Honkaharju forest road stops the fire | **Yes** | `barrier_line` or `protect_values` | EK11 at 18:41–18:42: the head runs SE at about 10 m/min, gusts 14 (pushed). EK12 at ~18:43: the fire stopped at the Honkaharju forest road along about 250 m; the road cut the surface fire (pushed). DR1 at 18:25: 5.0 m/min (recorded) |
| V13 19:00–19:20 (18) | The head crosses the Honkaharju road in gusts. The line held there is lost, but the directive names no line (and "Honkaharju" is not a road name on the map) | **Yes** (round 2; was "literal reading fails") | `barrier_line` (at the next barrier, R2) or `protect_values` | OUT2 at ~19:01: the head crossed the Honkaharju forest road in gusts; OUT2 tried to hold the line, but the fire got over (pushed). DR2 at 19:05: SE at about 10.6 m/min (pushed). DR2's road check at 19:06: R2 ~560 m from the fire, passable (**recorded only**) |
| V14 19:20–20:00 (19+20) | The SE front approaches R2. Lahdenkylä is the nearest settlement | **Yes** | `barrier_line` or `protect_values` | DR1's road check at 19:26: R2 ~530 m from the fire, passable (**recorded only**). EK14's story line at ~19:22: the SE front is ~200 m from R2 and the water route may be cut (pushed; see t.5). OUT1 at ~19:41: the head crossed the Honkaharju road again, further east, in gusts (pushed) |

**Fit is the researcher's design reading, not a key.** The panel judges soundness from the same records. It is not told which views were designed not to fit (`16` revision (t)).

### t.4 Pushed and recorded-only deciding facts

No record changes tier in this revision (the hard constraint in t.2). As things stand:
- **Recorded only** (reached through Haku or Thinker): the 17:00 and 18:00 forecasts of the evening wind event (V11) and the drones' R2 road distances (V13, V14).
- **Pushed:** V10's crew and drone reports of the new front (DR2 at 17:25, EK16, VPK, DR3 at 17:35), V12's stop at the Honkaharju road (EK12) and V13's crossing report (OUT2).

**Why the pushed facts stay pushed:**
- **Realism.** A crew reports at once, by radio, a new fire it is working, a fire stopped at a road, or a lost line. Demoting these reports to the record would make the command post quieter than any real one.
- **No text change.** Changing a record's tier means rebuilding the corpus and the Thinker index, which cannot be done here.

**The design claim, restated (round 2, `11` §7.16.2 a).** The directive's fit is visible from the map and the pushed reports in V9, V10 and V12–V14. **V11 is the one view whose fit rests on a recorded-only record**, the FMI forecast. The keys' basis texts cite only records the participant can see by the view's end, never a CA-only value (`demo-directive.ts`).

**What this costs.** In V9 and V10 the participant does not have to search to learn that the directive does not fit. They have to apply what they have been told. The search load falls in V11 (the forecast) and in V13–V14 (where R2 stands). The fit contrast therefore measures applying the directive more than finding the facts that bear on it. This is stated with the results (`09` revision (t)).

### t.5 Data checks made for this revision

- **Area and wind** agree with t.3:
  - Area: 123.6 ha at steps 10–11, then 124.7 (step 12), 126.2 (13), 129.4 (14), 131.2 (15), 136.9 (16), 143.9 (17), 150.9 (18), 155.7 (19) and 160.9 (20).
  - Wind: from 180° at 3 m/s at step 11, 240° at 3 m/s at step 12, 270° at 5 m/s at step 13, and 315° at 9 m/s gusting 14 at step 17.
- **V10's rate.** The crews in V10 report about 1 m/min. DR2's later measurement (recorded, in V11) gives 150 m for 17:20–17:40. The panel should judge V10's key against what V10 shows, and note the later measurement.
- **The R2 distance in V14 disagrees between records.**
  - EK14's pushed line says ~200 m.
  - DR1's recorded road check at 19:26 says ~530 m.
  - The CA gives ~500 m from the reported perimeter at 19:40, and ~370 m from the true perimeter at 20:00.
  - `26` (amendment of 2 Oct) also says "about 200 m at step 19".
  
  The pushed line cannot be reworded here (t.2). This is open (`11` §7.16).
- **Lahdenkylä** is about 1.6–1.8 km from the fire at 19:40–20:00 in the CA. DR1's record at 18:46 gives ~2.3 km.

### t.6 Change control

The directive changes what participants see, so by `00` §6 it is a **major** change of the scenario contract. No study data have been collected, so no data are split.

---

## Revision 6–8 Oct 2026 (y) — the world after the persona reviews (fix passes 2–4)

Researcher decisions of 6–8 Oct 2026 and the generator fix passes. The values were read from `app/scenario/site-scenario.json` and `content/corpus/interaction-log.jsonl` (974 records) on 8 Oct 2026. **Where this revision and earlier text differ, this revision applies.** Times are scenario clock.

### y.1 Water: the EK13 shuttle and basins

- **EK13 is a water shuttle** (vedensiirto / vesiajo). It carries about 14 m³ to **basins at the lines**, and it fills only at the water points W1 (Haukilampi) and W2. Its AVL task reads "vesiajossa, toimittaa vettä altaalle" while it carries water, and "täyttää" only at W1/W2. The roster names it as a shuttle.
- **The scripted refills are basin deliveries now.** The scripted drive-off refills (VPK 14:41, EK12 16:21, EK11 18:21) became EK13 basin deliveries, or they carry an explicit in-world reason. Status replies cite the last fill ("Viimeksi täytetty klo 13.54 (EK13:n vesiajo)").
- **After 17:41,** EK13 works via W2 to the R2 and Honkaharju lines. R2 is the tankers' water route: a fact pushed before V10 (`r2_meaning`, researcher decision of 6 Oct 2026).
- **Road register:** `ref.road.r1` is a metsäautotie with a bearing capacity of **32 t** (was 12 t, below a loaded tanker).

### y.2 Sprinkler lines and burnouts

> **Superseded in part by revision (ab) §ab.2:** sprinklers connect at about 100 m or at the first embers, the basin lasts about 10 minutes and EK13 tops it up; burnouts are proposed at 700 m and lit at about 400 m.

- **Sprinkler lines:** 100–300 m per engine, fed from a basin. While a line is open, its water draw is realistic (500–1200 l/min per line). Before the fire is within about 300 m, the line is reported as "valmiina, vesi kytketään altaasta kun palo on noin 300 m päässä". Crews no longer lay 900 m in one step.
- **Burnouts** (taustapoltto) are proposed by the crews and asked of command. Each one is closed in the record:

  | Proposed | By, where | Closed |
  |---|---|---|
  | 18:06 | VPK, Honkaharju forest road | 18:42: cancelled, wind too strong (9 m/s, gusts 14) |
  | 18:26 | EK16, Honkaharju | 18:47: cancelled, wind too strong; the road is held with sprinklers |
  | 19:26 | KY21, R2 | 19:55: cancelled; the front did not come near the road before the night shift |

### y.3 Units and aircraft

- **DR3** lands at **17:59**: the region has asked for it for another fire (the world event that replaced hinge rule 4, revision (t)).
- **EK16 and KY23** arrive at the command post at 16:42–16:43, **held in reserve by the region** for another fire ("käyttöön alueen luvalla"). KY23 moves to the north edge (L1) at 17:01 and EK16 to the Honkaharju road at 17:41. No record releases them (`11` §7.18). **Superseded by revision (aa): the region releases KY23 at 17:00 and EK16 at 17:40.**
- **OUT1, OUT2 and UGV1** reach R2_S one step later (a 20 km detour; researcher decision of 6 Oct 2026).
- **Shift change at 19:20.** The next shift takes over EK11's vehicle and its line on R2 with no gap (19:22). VPK's question about the two households that refuse to leave is answered: the police continue alone, and VPK returns to the R2 line (19:21).
- **Evacuation of Lahdenkylä** is decided by the incident commander (JOHTO) and carried out by the police (Rescue Act §36; researcher decision of 6 Oct 2026). VPK assists from 18:41.
- **Drones report the road stretch in view** (this reverts the whole-road reports of 2 Oct 2026). DR2 reports the Honkaharju forest road 18:00–19:40.
- **V1/V2** carry a "dense spruce ahead" report (`fuel_ahead`).

### y.4 Fire values (supersede §7, k.1, the 1 Oct and 2 Oct tables, and t.3 where they differ)

> **Areas, head rates and flags in this table are superseded by revision (aa) §aa.3** (125.3 ha at 16:20, 174.8 ha at 19:40, flags 14 / 14).

| Quantity | Now | Was |
|---|---|---|
| Area at 16:20 (step 10) | **128.6 ha** | 123.6 |
| Area at 19:40 (step 20 start) | **173.6 ha** | 160.3 / 157.4 |
| Area at 20:00 | **~175.9 ha** | ~168–172 |
| Step-6 crown run, achieved head rate | **38 m/min**, accepted (researcher default, 6 Oct 2026) | — |
| V9 rekindle | **~120 m** from the point of origin, outside the old south edge; the 17:10 second pass records ~0.5–1 ha, flames under a metre, edge east ~3 m/min | ~200 m |
| V10 new front | **~0.8 ha**, flames 0.3–1 m (DR2 thermal 17:25; DR3 mapping 17:35); sectors L2 + L3 | ~1.1 ha; L3 |
| V11 south-east front | **~6.7 m/min** (DR2, recorded) | ~7.5 |
| V14 flare-up | **~130 m west** of the point of origin, ~0.3 ha, flames under a metre (SPOT 19:23 and 19:30); sectors L1 + L4 | — (V14 was fit) |
| V14 distance to R2 | **~380 m at 19:47** (DR2's road report, recorded) | DR1 ~530 m at 19:26 |

- **Rekindles are anchored to the actual burned edge** (researcher decision, 6 Oct 2026). They are not reworded, and the CA's backing spread is not used.
- **The V14 step-20 flare-up outline is drawn clipped** while SPOT reports it burning (`reportedDetached`); this was accepted on 8 Oct 2026.
- **VPK at 16:09 (step 9, L3)** reports the edge creeping and smouldering (≤1 m/min backing in a 5 m/s southerly), consistent with the 16:20 "in hand" report (FF1).

### y.5 t.3, restated for V14

| View | Fit | Draft sound key | Deciding records |
|---|---|---|---|
| V14 19:20–20:00 (19+20) | **No** (round 2, 5 Oct 2026) | `direct_attack` on the flare-up (L1/L4), or as the secondary sector with the main effort in L3 (`16` revision (y)) | SPOT 19:23 (pushed) and 19:30 (recorded); DR2 ~380 m to R2 at 19:47 (recorded); VPK evacuation (pushed) |

This supersedes t.3's V14 row. EK14's ~200 m and DR1's ~530 m are not the basis.

### y.6 §6, the weather series: the rain row is stale

The 2 Oct 2026 amendment removed the shower: there is **no rain at any time**. §6's row 10 (2.0 mm, FFMC 82, ISI 2.9, FWI 13), the rows after it that follow from it, and the "M1 in the numbers" paragraph describe the withdrawn shower. The forcing actually used is in `site-scenario.json` (step 10: wind from 130°, 3 m/s, gusts 5) and `24`. The FWI columns are not recomputed. §6 stays a design record and is not the source of any participant-visible value.

### y.7 Declined (researcher, 7 Oct 2026)

- a public warning and berry pickers (FF12);
- rewording the evacuation decision beyond y.3.

---

## Revision 8 Oct 2026 (aa) — the world after the final fix pass (realism; weather text; releases; autonomous assets)

Researcher decisions of 8 Oct 2026 (D3, D4) and the generator fix pass 5 (`tools/fire-ca/traffic*.ts`, `deployment.ts`, `app/scenario/site-scenario.json`). The values were read from `site-scenario.json` (879 traffic records, 54 radio lines) on 8 Oct 2026. **Where this revision and revision (y) differ, this revision applies.** Times are scenario clock. The fire forcing (`scenario-18.ts`) is the researcher's and is described in `24` revision (aa).

### aa.1 Weather text (D4): text only

- **18:01 forecast (`evt.wx.06`):** the north-westerly strengthens between 18:30 and 19:00 to 7–9 m/s, gusts 12 m/s, and eases to 5–6 m/s after 19:30. It is dry: **the drying north-westerly lowers the relative humidity to 25–30 %**, temperature 20–22 °C.
- **16:01 forecast (`evt.wx.04`):** the 16:20 backing to the south-east has a **stated local reason**: the south-easterly (3–5 m/s, easing) is local, outflow ahead of the front, strengthened by the flow along Karhujärvi and the esker. After 17 the wind turns through the south and south-west to the west.
- The forcing, the fire rates and the areas do not change with these texts. The humidity series after 17:01 (35–40 %) is the earlier text's; only 18:01 changes it.

### aa.2 Units and aircraft

> **Superseded in part by revision (ab):** the building sprinklers' "within about 300 m" is now 100 m (ab.2); the weather text is extended (ab.4).

- **Release records.** EK16 and KY23, held by the region from 16:42 (y.3), are now released by radio: **"Alue vapauttaa KY23:n käyttöönne" at 17:00** (view 9, pushed, 30 s into the step) and **"Alue vapauttaa EK16:n käyttöönne" at 17:40** (view 11, pushed). Each precedes the unit's move (KY23 to the north edge at 17:01, EK16 to the Honkaharju road at 17:41). This closes y.3's "No record releases them".
- **VD1 and UGV1 are autonomous background assets (D3).** The briefing and the roster say so ("autonominen"); the plan gives them no tasks and the `task.water-drop` and `task.hose-lay` options are gone. The drone works on its operator's judgement at the burning edge; the robot lays hose with its crew.
- **VD1 drops 80 l per round** (§ "Water drone VD1" above said about 300 l per trip; superseded) and **stops dropping when the gusts at drop height exceed 11 m/s**, resuming the step they fall below it (the 18:40 step has gusts of 14 m/s, the 19:00 step 12 m/s). Its system log states the load, the wind at drop height and whether the drops are paused.
- **DR1 and DR2 (multicopters) fly a restricted sortie at 18:40:** above a 13 m/s gust they hold position at 100 m and image in shorter periods; the flight log says so. Otherwise their altitude is 100–120 m, and the mapping loop flies at 120 m.
- **Edge directions in the drone reports** are the outward normal where the edge advanced most (burned interior to outside), not the drift of the fresh cells' centroid, which flipped on a slow edge. An edge slower than **2 m/min is reported as backing**, against the wind.
- **Refills and moves are in the present tense.** The map shows a unit at its water point from the step's start, so the messages state the present ("meillä vesi vähissä, … allas tulee noin N min päästä"), not an announcement of a move that has happened.
- **Building sprinklers** stand "ready" and the water goes on only when the fire is **within about 300 m** (`SPRINKLER_ON_M`); the road lines of y.2 follow the same rule.
- **"Liian kuuma suoraan hyökkäykseen."** A crew says an edge or the head is too hot for direct attack only within about 300 m of it and with flames that warrant it; otherwise the crew watches. The rate it quotes is the rate that makes it too hot.
- Units arrive and are released as in y.3; the shift change (19:20), the evacuation decision (JOHTO decides, police carry out) and the burnouts table (y.2) are unchanged.

### aa.3 Fire values superseding y.4 (site-scenario.json, step clocks as exported)

| Quantity | Now | Was (y.4) |
|---|---|---|
| Area at 16:20 (step 10) | **125.3 ha** | 128.6 |
| Area at 19:40 (step 20) | **174.8 ha** | 173.6 |
| Area at 20:00 | not exported to the site file; not re-derived here | ~175.9 |
| Achieved head rate, steps 10–15 (m/min) | 3.5, 0, 3.5, 6.7, 8.8, 5.2 | (steps 11–15 in `24` y: 0, 5.3, 8.4, 8.8, 6.3) |
| View flags | **14 of 14** match | 13 of 14 |

The thermal-inertia change of the researcher (`24` revision (aa)) is the cause. The V9 to V14 front sizes of y.4 (the ~120 m rekindle, ~0.8 ha, ~6.7 m/min, ~130 m west, ~380 m to R2) were not re-read in this pass (verified 8 Oct 2026 against 6b48622: all still hold. SPOT 17:01 "noin 120 m syttymäkohdasta" and 17:10 "0,5–1 ha", edge east ~3 m/min; DR2 17:25 "noin 0,8 ha", liekit 0,3–1 m, DR2 17:31 confirms ~130 m SE; DR2 17:45 and 17:46 "6,7 m/min"; SPOT 19:23 "noin 130 m" west and 19:30 "noin 0,3 ha"; DR2 19:47:55 "noin 380 m tiestä" at R2; the bundle gives 125.3 ha at step 10, 174.8 ha at step 20, achieved head rates 3.5, 0, 3.5, 6.7, 8.8, 5.2 for steps 10 to 15, and 14 / 14 flags; the rekindle polygon centroid is ~130 m from the ignition point, 0.7 ha at 17:00); the V14 freeze item `se_front_r2` is keyed on the CA's south-east front at ~237 m from R2 at the end of step 20, and the records give ~380–400 m before it (KY21, DR2).

---

## Revision 8 Oct 2026 (ab) — the world after fix pass 6: water, firebreaks, sprinklers, burnouts, weather, rate records

The generator realism pass of 8 Oct 2026 after persona round 5 (the firefighter persona, FF5; `tools/fire-ca/traffic*.ts`, `app/scenario/demo-story.ts`, `app/scenario/site-scenario.json`, `content/corpus/interaction-log.jsonl`). **Where this revision and revisions (y) and (aa) differ, this revision applies.** The fire (`scenario-18.ts`, the CA) is unchanged: the areas (125.3 ha at step 10, 174.8 ha at step 20), the achieved head rates and the 14 / 14 view flags in `site-scenario.json` are the values of revision (aa) (read from the file on 8 Oct 2026). The corpus is regenerated: **979 events** (was 981); hashes `site-scenario` c6c79a20178f and corpus 37710604974e (as reported by the generator pass; they change with any regeneration, the manifest holds the corpus hash).

### ab.1 Water

- **A neighbour's help is offered only when it beats the basin** (`traffic-water.ts`, `stepWater`). A crew running low asks a neighbour for water only if a giver is on the **same road, within 300 m** (vehicles side by side, about 2 minutes) and that help arrives before its basin does. Before, any giver within 700 m was asked, though a hose to a unit 700 m away takes about 20 minutes (the persona's evt.c15.005 and .009). The lateral water share is otherwise as in revision (y).
- **The folding basin holds 8 m³** (was 3 m³, less than one 6 m³ delivery of the EK13 shuttle, `y.1`). The shuttle still carries about 14 m³ and delivers 6 m³ per run. **The Lahdenkylä farmer's slurry tanker delivers 6–8 m³** (was 6–9), within the basin. The shuttle's load is stated as "Vettä kyydissä noin N m³" / "About N m³ of water aboard".

### ab.2 Firebreaks, sprinklers, burnouts

- **Firebreaks** (`task: firebreak`): each crew reports **its own section**, not a shared total: **30–50 m at its first step and 60–80 m more per step** (saws, 150–250 m/h), with a spread that grows with the steps. This supersedes the earlier "150 m plus 140 m per step".
- **Sprinklers** (`SPRINKLER_ON_M` = **100**, was 300): a line stands ready and the water is connected **when the fire is about 100 m away or embers cross the road**; the **basin lasts about 10 minutes and EK13 tops it up**. The "ready" report says so ("allas riittää noin 10 min, EK13 täydentää"). This supersedes aa.2's "within about 300 m" and y.2's "valmiina, vesi kytketään altaasta kun palo on noin 300 m päässä".
- **Burnouts:** a crew **proposes** one when the front is within **700 m** of its road (`BURNOUT_PROPOSE_M`, was 600) and **lights** it when the front is about **400 m** away (`BURNOUT_LIGHT_M`, was 250): at 200 m a burn cannot burn out the strip before the fire arrives. The proposal text reads "kun rintama on noin 400 m päässä" / "when the front is about 400 m away". The burnouts table of y.2 (proposed, closed) stands. The directive coding treats a burnout from a held road as in line and not a plan option (`16` revision (ab)).

### ab.3 Aircraft and rate records

- **Helicopter bucket drops** (the helicopter's water_drop report) now state the ground-safety line: "Pudotusalue ilmoitettu yksiköille, miehet pois alta (kuitattu)" / "Drop zone announced to the units, men clear of it (acknowledged)".
- **Wind-limit wording** (VD1's system log): "Jatkaa, kun puuskat eivät enää ylitä rajaa" / "Resuming when the gusts no longer exceed the limit"; "tuuli ei ole enää yli rajan" for the resumed state. The limit itself (11 m/s gusts at drop height) is unchanged (aa.2).
- **Thermal rate records carry their window**: a drone's edge report reads "etenemä … m klo hh.mm–hh.mm (kahden kuvan vertailu), N m/min" and the lateral edge text now has "(klo hh–hh)", so a rate is read as the average over its window and not as the current rate; and a record **says when the rate includes the spot-fire jumps** ("sisältää pistepalojen hypyt" / "includes the spot-fire jumps": a crown run's rate that counts spot fires merged with the head, e.g. DR1's 38 m/min, evt.c07.010). No number changes.

### ab.4 Weather

- **18:01 forecast (`evt.wx.06`):** "the north-westerly brings **dry continental air and the dew point falls**; humidity drops to 25–30 %, temperature 20–22 °C". This adds the mechanism to aa.1; the numbers are unchanged.
- **The weather station reports temperature and humidity three times**, in the first station line of the step: **16:20 (step 10): 25 °C, 38 %; 18:00 (step 15): 22 °C, 28 %; 19:20 (step 19): 20 °C, 26 %** (`SAA_TH`). They agree with the forecast text (dry, falling humidity). The station otherwise reports wind only, as before.

### ab.5 The V9 SPOT record names its sector

SPOT's 17:10 flyover (`demo-story.ts`, recorded, 600 s into the step) now reads "syttymäkohdan kaakkoispuolen uusi palo noin 0,5–1 ha **(lohko L3, syttymäkohdan kaakkoispuolella)**": it names the sector (L3), where the new front is, which is the deciding fact of the no-fit views V9 and V10 (`16` y.4). Before, the sector had to be inferred from the position. The text is recorded (searchable), not pushed. Its English text is in `authored.en.json`.

### ab.6 Stale text pointed here

aa.2's "Building sprinklers … within about 300 m" and "road lines of y.2 follow the same rule" (ab.2); y.1's basin of 3 m³ (the y.1 text does not give it; the generator did) and y.2's "noin 300 m päässä" (ab.2); y.2's burnout lighting distance if it is read as 200 m (ab.2); aa.1's weather paragraph is extended, not replaced (ab.4). The values in aa.3 stand (the fire is unchanged).

---

## Revision 9 Oct 2026 (ad) — fix pass 7 (`11` §7.20)

### ad.1 EK11's handover (item 7)

The first-arriving officer hands command over to the participant, the incident commander: EK11's 13:21 bubble reads "Johtovastuu siirretty teille. Kärki koilliseen. EK14 ja KY21 tulossa." / "Command handed over to you. …" (was "Johtovastuu otettu", "command assumed", which said EK11 held command).

### ad.2 The units' tasks in V11–V14 (item 4)

- The crews on the road lines (EK11, EK12, KY21, EK16, VPK, OUT1, OUT2) have the task **`road_line`** — "Pitää linjaa tiellä: sadetinlinja ja letku valmiina tien varressa" / "Holding the road line: sprinkler line and hose ready along the road" — in place of "Palokatkon raivaus moottorisahoilla" at a road anchor, which their radio contradicted (sprinkler lines, basins). The water use, the reports and the burnout traffic are unchanged (only the label and the AVL wording change).
- EK13 between water runs is "Valmiudessa seuraavaa vesiajoa varten" / "On stand-by for the next water run" on its card (was "Odottaa tehtävää", which invited tasking); its AVL already said so.
- Every other unit on scene already had a visible task: EK15 and KY23 firebreaks on the north flank, EK14 mop-up and pump attack, VPK the evacuation (17:00–19:20), OUT1/OUT2/UGV1 blocked at the bridge then off the map on the detour (step 17), EK11's outgoing crew at the command post after the 19:20 shift change (its vehicle and line kept by the next shift). VD1 and UGV1 stay autonomous background assets (8 Oct); their reports say what they do. OUT2's move reason reads "sadetinlinja Lahdenkylän suojaksi" (was "palokatko").

### ad.3 KY21's V14 report (item 6)

KY21, on R2 north of the forest-road junction from 18:40, radioed at 19:4x "ei omaa reunaa, palo 400 m länteen" — the fire north of the Honkaharju road, which reads as that road still holding — with no word of the head that crossed it (EK16, pushed 19:22). Its pushed V14 report now says "kärki ylitti metsäautotien ja on nyt lounaassamme, menee kaakkoon kohti tietä R2 risteyksen eteläpuolella. Omalla pätkällämme ei reunaa; metsäautotien pohjoispuolella palo noin 400 m länteen." (`deployment.ts` `LINE_REPORTS`; the draws are still made). It agrees with the crossing and the `road_crossed` key ("the road no longer stops the head"), and its 400 m is no longer read as the south-east front's distance to R2.

### ad.4 L2 and L4 in different steps (item 8)

The rear (L4, 260°–330°) is secured at step 11 (16:40) with the north flank it adjoins (L1, 330°–20°: one arc, worked by the north-flank crews), no longer with the head (L2) at step 10. Effects: 14 / 14 view flags; the forest road's stop (18.40–19.00, EK16) and crossing (19.00–19.20) unchanged; V10, V12 and V14's report-keyed keys unchanged except V10's area band (`08` ad); V14's flare-up polygon 0.22 / 0.52 ha at 19:20 / 20:00 (was 0.28 / 0.66; SPOT's recorded "noin 0,3 ha" kept). Rejected: L4 at step 9 (the head reaches the forest road a step early and crosses with no stop) and at step 12 (no crew near the rear at 17:00).

---

## Revision 9 Oct 2026 (ae) — English place names and codes in English sessions

Researcher decision, 9 Oct 2026: "Change the place names to English ones so we can skip the introduction to different terms." An English session names every place in English, on the map and in every text, and translates the Finnish codes; the English glossary (R2) is gone (`15` ae). Finnish sessions are unchanged: the Finnish corpus, map (`topo.webp`, `topo/`) and texts are byte for byte as before.

### ae.1 The mapping table (the one source)

**The authoritative table is `app/i18n/place-names.ts` (`PLACE_NAMES_EN`); this section copies it.** Every English text and the English map take their names from it: the generated records' English (`tools/fire-ca/site-export.ts` applies `englishNames` to the bundle's `english` map), the authored English and the scenario labels, questions and options (`content/i18n/*.en.json`, rewritten with it), the Thinker's English questions (`tools/thinker/authored-questions.ts`, `content/thinker/neutral-eval.en.json`), and the English basemap (`tools/topo-map/build.ts` writes `labelsEn` with `englishLabel`; `render.py` draws the `maps/topo-en/` tiles; `MapView` and `FreezeMap` load them in English sessions). `test/i18n/place-names.spec.ts` checks that every map label has its English from the table at the same point and in the same style, that every place in the table is on the map, and that no English text names a Finnish place, a Finnish code or a Finnish-shaped place name outside the table.

Position: the map label's anchor (the left end of the text, as `render.py` draws it), km east and north of the ignition point (IGN). Style: the map's label style (water: blue italic; village: bold; place: plain; bog and terrain: brown italic).

| Finnish | English | Style | Label at (km E, km N of IGN) |
|---|---|---|---|
| Karhujärvi | Bear Lake | water | −1.6, 1.9 |
| Haukilampi | Pike Pond | water | −1.1, 1.1 |
| Kotkanjoki | Eagle River | water | 3.3, 1.9 |
| Koivuoja | Birch Creek | water | 0.9, 2.4 |
| Myllyoja (Korpioja until (bh)) | Mill Brook (Alder Creek until (bh)) | water | −1.6, 1.6 |
| Lahdenkylä | Bay Village | village | 2.4, −2.5 |
| Mökkiranta | Lakeside Cottages | place | −1.2, 1.6 |
| Rahkasuo | Moss Bog | bog | 0.3, −1.2 |
| Kuivakangas | Dry Heath | terrain | 1.1, 0.8 |
| Kuusimäki | Spruce Hill | terrain | 1.3, 1.2 |
| Honkaharju | Pine Ridge | terrain | 0.3, −0.3 |
| Hiekkala | Sandy Hamlet | place | −0.7, −6.5 |
| Iso-Rahkasuo | Great Moss Bog | bog | −2.4, −0.3 |
| Korpilaakso | Fern Valley | terrain | −2.3, 1.3 |
| Iso-Hirvijärvi | Great Elk Lake | water | 8.4, −8.8 |
| Suo-oja | Marsh Creek | water | 4.7, 3.5 |
| Rahkapuro | Peat Creek | water | 5.5, −5.5 |
| Mustajärvi | Black Lake | water | −4.0, 3.8 |
| Pitkäjärvi | Long Lake | water | 3.1, −6.9 |
| Ahvenlampi | Perch Pond | water | 5.1, −3.3 |
| Valkealampi | White Pond | water | 6.8, 4.9 |
| Kaitajärvi | Narrow Lake | water | 7.7, −0.6 |
| Särkijärvi | Roach Lake | water | 6.8, 7.2 |
| Pirttilampi | Cabin Pond | water | −5.4, −8.0 |
| Kivijärvi | Stone Lake | water | −1.6, −8.4 |
| Ruokolampi | Reed Pond | water | −9.0, −8.2 |
| Heinäjärvi | Hay Lake | water | −8.7, 5.9 |
| Kuikkalampi | Loon Pond | water | −6.8, 6.5 |
| Hauklampi | Hawk Pond | water | −8.6, −0.2 |
| Rinne (farm) | Hillside Farm | place | −8.1, 1.5 |
| Mäkelä (farm) | Knoll Farm | place | 5.3, 4.3 |
| Niemelä (farm) | Point Farm | place | −3.1, 7.3 |
| Koivula (farm) | Greenwood Farm | place | 7.8, −2.2 |
| Harju (farm) | Oakley Farm | place | −5.5, −4.4 |
| Peltola (farm) | Meadow Farm | place | 3.9, 9.2 |

The first eleven are named in the scenario's records, items or directive; the rest are on the map only. Most translate the Finnish; Hauklampi is Hawk Pond (not a second Pike Pond), and the farms, whose Finnish names are surnames, get English farm names. The names are distinct from each other and from every unit call sign (tested). Spot heights on the English map use a decimal point (123.1, not 123,1).

A word the English text put after a Finnish name to say what it was goes with the name, as does its article: "the Korpioja brook" → "Alder Creek", "the Mökkiranta cabins" → "the Lakeside Cottages", "Lahdenkylä village" → "Bay Village", "Haukilampi pond" → "Pike Pond". Other descriptive words stay ("the Spruce Hill spruce stand", "the Dry Heath esker", "the Bay Village pond (W2)", "the Eagle River bridge (W3)", "the forest road (Pine Ridge)").

### ae.2 Codes

| Finnish (shown before) | English session now | Where |
|---|---|---|
| VPK (vapaaehtoinen palokunta), the call sign | **VOL1**; source name "Volunteer fire brigade VOL1"; roster "Volunteer fire brigade, tanker" | records, map marker and hover card, on-scene list, message log, Thinker context, debrief (`unitCallSign`, `labels.en.json`) |
| AVL EK11: … (vehicle-location log) | Vehicle location EK11: … | records |
| PP1, PP2 (pistepalo, spot fire) | SF1, SF2 | records and the map's spot-fire labels (`codeIn`) |
| US1 (uudelleensyttymä, rekindle) | RK1 | records and the map's labels |

Unchanged, and why: the unit call signs EK.., KY.., DR1–DR3, VD1, HELI1, UGV1, OUT1, OUT2 and SPOT are codes in any language, and the roster's hover card on every marker gives each one's type and origin; P2 is always written "duty fire chief (P2)"; L1–L4 appear as "sector L1" or "L1-North"; R1–R3 as "road R1"; W1–W3 as "water point W1 (Pike Pond)". The Finnish sources are named in English since 6 Oct (`sourceName`). The data keep the Finnish ids (VPK, PP1): the logged records, the retrieval passages' source id (`14` revision (v), frozen) and the answer keys are unchanged.


---

## Revision 9 Oct 2026 (ah) — review fixes: winds, the north-edge holdover, units, safety lines

Scenario-realism review of 9 Oct 2026. The fire forcing and its reasons are in `24` revision (ah); this revision gives the world-state side. **Where this revision and earlier ones differ, this revision applies.**

### ah.1 §6, the weather series (supersedes the wind column for these rows)

15:40 **SSE 165** (was SSW 200); 16:00 **SE 140** (was S–SE 160); 16:20 SE 130; 16:40 S 180; 17:00 **WNW 285** (was SW 240): the weak dry front passes and the wind veers sharply; 17:20 **WNW 285** (was W 270); 17:40 **WNW 290** (was 280); 18:00 **WNW 300** (was 290); 18:20 NW 310; 18:40 NW 315 (9 m/s, gusts 14); 19:00 NW 315; 19:20 and 19:40 **NW 325** (was 320). Speeds, temperatures and humidities are unchanged. The forecasts follow (`traffic-forecast.ts`): 15:03 "SW turning through S to SE between 15.30 and 16.00"; 16:01 "the front passes at about 17: S first, then quickly WNW 3–5 m/s"; 17:01 "the front has passed, WNW"; 18:01 unchanged. Story texts: HELI1 16:00 "Tuuli kääntynyt kaakkoon"; SPOT 17:01 "tuulen käännyttyä länsiluoteeseen"; SPOT 17:10 "Reuna etenee itäkaakkoon … Savu painuu itäkaakkoon" (English with them).

### ah.2 §7.1, the contradiction: a holdover, not an upwind spot fire

At 19:00 an old edge flares up on the north edge, ~300 m north-east of EK14's crew, east of its stretch (`24` ah.4): the map shows **US2** (was spot fire PP4). SPOT (pushed): "Pohjoisreuna leimahtanut uudelleen, havaittu uutta savua ja liekkejä uran itäpuolella" (was "Pohjoisreuna kiihtyy …"); EK14: "Oma linjamme pitää, ei muutosta". The V14 backup key reads "SPOT: pohjoisreuna leimahtanut uudelleen, uutta savua — EK14: oma linjamme pitää, ei muutosta". SPOT's smoke-column report says an old edge has flared up (not a spot fire); a drone confirming a rekindle far from the origin adds "vanhan reunan tuntumassa".

### ah.3 Units (§8.2, revisions (l), (y), (ad))

| Unit | Change |
|---|---|
| KY21 | 13:40–14:40 on the origin's south edge; **14:40–16:00 up the south flank towards the head** (`edge:L2S`, the origin left to VOL1's mop-up); 16:00 back to the origin's south edge as the wind turns; 16:20 to the north edge (unchanged, against VOL1's objection) |
| EK14 | **15:40–16:00 up the north flank towards the head** (`edge:L1N`); 16:20 to the north edge, Karhujärvi side (unchanged) |
| EK11, EK12 | the crown-run withdrawal at 15:00 goes to **road R1 in the burned area, the safety zone** (`at:R1_BLACK`; was R1 east and the R1/R2 junction, ~1 km out in unburned forest) |
| EK11 | at 15:31 radios PP1 behind it and pulls the crew out through the black; at 15:42 "the fire crossed the brook beside us … all accounted for"; stays on the Koivuoja line (V6's SPAM key) |
| EK11 | **17:00–17:40 on the old fire's east edge**, mop-up, downwind in the north-westerly (was the dead north-east tip) |
| north-edge crews | anchor moved north-west (-500, 1600): they stand on the Karhujärvi side, ~900 m from either rekindle |
| all | no two units within 60 m; fire-break and mop-up crews walk along their stretch (≤ 220 m from where they took it over) |

**AVL (M8):** a unit whose map report is stale on its move step (KY21 and VOL1 at 16:20) is logged by AVL later in that step at the new place (16:35, 16:38: "north flank, Bear Lake side").

### ah.4 Safety lines

A crew within 20 m of the burning zone, in ground the fire burns during the step, or with fire on its line to its vehicle radios how it stays safe (`deployment.ts` EXTRA_RADIO; checked by `tools/validate/crew-safety.ts` and `test/validate/crew-safety.spec.ts`): EK11 13:40 (direct attack, escape route into the black, lookout); EK14 14:40 (pump at the edge); EK11 15:31 and 15:42 (above); EK14 16:20 back from the radio dead zone ("the turned edge reached our old line after 16.00; we moved out ahead of it … all accounted for").

### ah.5 The mop-up patrol and the drone's sector name

**Mop-up patrol** (`traffic-patrol.ts`, own ids `evt.op.01`–`04`, T2, from V10): the region's forestry contractor (two forwarders with 10 m³ water tanks, four men, from 16:45) patrols the old fire's east and south-east edge (L2) and logs rounds at 17:25, 18:05, 18:50 (a stump flares up inside the line in the gusts, put out) and 19:25. **DR3's mapping** names the rekindled front "Kaakkoisrintama" / "South-east front" (was "L2-Koillinen" by bearing). The food request names a supply request in both drawn variants.

### ah.6 Values (site-scenario.json)

Areas 125.1 ha at 16:20, 162.8 ha at 19:40; view flags 14 / 14; the forest road stops the head at 18:40–19:00 and the head crosses at 19:00–19:20; 992 traffic records.

---

## Revision 9 Oct 2026 (aj) — rekindles from the old fire; V5–V8 unit positions; LCES lines

Scenario-realism follow-up of 9 Oct 2026. The fire side is in `24` revision (aj), the views in `26` revision (aj). **Where this revision and earlier ones differ, this revision applies.**

### aj.1 §7.1–7.2, the rekindles

Each old edge that flares up again (17:00 the origin's south edge, 19:00 the north edge's holdover, 19:20 the origin's west edge) ignites on the burned edge, through the held line (fire crept under it through roots and humus), so the new fire touches the old one in the grid and on the map (`24` aj.2). The 17:00 rekindle's centre is ~65 m from the point of origin (SPOT's "noin 120 m syttymäkohdasta" is the far side of the patch at 17:01; its text is unchanged); the holdover is ~140 m east of KY23's crew, ~290 m east-north-east of EK14's, ≥ 100 m off every crew-to-vehicle line; the west flare-up's centre is ~115 m west of the origin (`ORIGIN_W`).

### aj.2 Units (§8.2)

| Unit | Change |
|---|---|
| EK11 | 15:20: the Koivuoja line as before, its LCES said in the move (PP1 and PP2 known beyond the brook, escape route through the black to the truck, lookout). 15:31 out, 15:40 at the truck, 16:00 back on the line: unchanged |
| EK12 | **15:40–16:00: the crown-run lobe's south-east flank from R1** (`edge:L2SE`; was the tip across Koivuoja beside PP2–PP3, 2.6 km from its 15:20 place, 650 m of hose through the crown-run ground). 16:20 W3, 16:40 the north edge: unchanged |
| EK14 | **15:40–16:20: at its terrain vehicle on road R1 in the middle of the burned stretch** (`zone:R1_BLACK_MID`, (350, 412), black since ~14:30) as the wind backs to SSE and the north flank becomes the head (was `edge:L1N`, up the flank towards the head, with the fire burning to within 25 m of it in both steps); stale at 16:00 (F3); 16:20 to the Karhujärvi-side line as before, its 16:20 line re-worded ("we waited at the terrain vehicle on road R1 in the burned area until the turned edge had passed our old line") |
| EK15 | 16:40 move carries its LCES (escape route into the black, lookout) |
| all others | unchanged; every V8 (16:40) position checked: 25–56 m outside the edge that stopped at 16:20, drives ≤ 3 km on roads |

### aj.3 Safety lines (§ ah.4)

`tools/validate/crew-safety.ts` adds `downwind` (a crew downwind of fire that runs at it within the step's run distance). 15 findings on the bundle, all explained. New recorded (T2) lines: EK11 13:24 "kärjen molemmat laidat suorassa sammutuksessa … perääntymistie palaneelle alueelle, tähystäjät nimetty"; EK11 14:45 "laukaisupiste sovittu: jos latvapalo syttyy, EK11 ja EK12 irtautuvat kärjen laidoilta palaneelle alueelle ja tielle R1"; KY21 18:26 "laukaisupiste: kun rintama on noin 150 m tiestä, siirrymme tielle R2"; EK16's 18:4x report adds "perääntymistie tietä pitkin R2:lle, autot käännettyinä, tähystäjä nimetty".

### aj.4 Values (site-scenario.json)

Areas 127.9 ha at 17:20, ~156 ha at 19:40; view flags 14 / 14; the forest road stops the head at 18:40–19:00 and the head crosses at 19:00–19:20; the south-east front ~557 m from R2 at 19:40; DR2's 19:05 rate 10.1 m/min; 1006 traffic records.

---

## Revision 10 Oct 2026 (ak) — commander review of every unit position

Researcher's request of 10 Oct 2026: go through each view as a fire commander — would the crews be put there, could they go there, from the strategic-benefit and safety point of view; if not, move them. Every unit on every map from VP to V14 was judged on three counts: useful work at the right place, LCES (escape route, safety zone, downwind of a running edge, hot black, distance to the edge against the step's spread), and feasibility (travel by road, hose length from the vehicle, water). The fire side (`24`) is unchanged; the views are in `26` revision (ak). **Where this revision and earlier ones differ, this revision applies.**

### ak.1 Verdicts (§8.2)

Kept as they were, with the reason: V1–V3 the head crews in direct attack on a 6–7 m/min surface fire with low flames, trucks on R1 either side of the head's crossing, escape into the black (EK11's 13:24 and 13:4x lines); EK14's pump at the north edge by R1 (its terrain vehicle behind it); VPK and KY21 on the origin's south side. V4 the head crews at the flanks of a head accelerating into the spruce — kept as designed for the near miss (keyed in V4's `work_danger` and `ek12_where`), with the trigger point re-worded (ak.2). V6 EK12 on the south-east flank, the upwind flank in the backed wind; EK14 in the safety zone in the black (sound LCES; the cost is one three-person unit idle for forty minutes, accepted). V7–V8 the north crews 9–48 m outside an edge that stopped at 16:20–16:40, trucks on the road north of the fire with hose lines of 100–680 m over unburned ground, none inside the black. V9–V10 EK11 on the old east edge the north-westerly puts downwind; no crew on L3 (the designed omission). V11 the road lines on the Honkaharju forest road 160–820 m ahead of a 4 m/min front and the R2 fallback line started early by the rested EK11 (the directive's lines on roads). V12–V14 EK16 holding its stretch of the road, 310–520 m ahead of the head in the wind event with its escape route along the road, withdrawing at 19:20 once the head had crossed 600 m to its west; the R2 line (EK11, EK12, OUT1, OUT2, UGV1, VPK from 19:20) 450–1100 m from the front; the shuttle and the aircraft as before.

Changed:

| Unit | Change |
|---|---|
| KY21 | **18:20–19:00: holds its road line (FR_W) through the stop; withdraws to R2 at 19:00, not 18:40.** The front meets the road at 18:40–19:00 a hundred metres east of its engine and the road stops it; KY21 reports the stop at 19:0x (was EK16, 560 m away); in the 19:00 gusts sparks cross the road and its trigger fires: it moves to R2 (`kipinät ylittävät tien puuskissa emmekä saa niitä kiinni`). The crossing at 19:00–19:20 (EK16's report) is then fifty metres from its old spot with nobody near. Before: it left at 18:40 with the edge 28 m off on a trigger point ("150 m from the road") it had already passed when it said it at 18:26 — the stretch the fire then stopped at and crossed stood empty. Holding to 19:20 was tried and rejected: the map's traced outline then has the crew inside the fire at 19:00 and the crossing burns through its spot. |
| EK11 | 15:20 move worded as the map draws it: the line from the burned edge in front of Koivuoja (`linja palaneen reunasta ojan edessä`; was "ojan takaa", the far bank, where the crew never stood). Position unchanged (ak.4). |

### ak.2 Safety lines (§ ah.4, aj.3)

- EK11 14:45 (recorded): the trigger point before the crown run is an indicator that precedes the danger — `kun yksittäiset puut alkavat soihduta tai liekit ylittävät kaksi metriä … odottamatta latvapaloa` (was "jos latvapalo syttyy", a trigger on the danger itself, with EK12 90 m from a head that then ran at 30 m/min).
- KY21 18:26 (recorded): the edge ~100 m from the road, sprinklers on when the edge reaches it; trigger: sparks lighting the south side of the road that the crew cannot catch at once; escape route east along the road to R2, lookout. It covers 18:40–19:00 too (`tools/validate/crew-safety.ts` `17:KY21`, `inStep: 16`; a separate 18:4x line was tried and dropped — the T2 tier sits at the top of its share band). EK11 14:05 (recorded): the esker ignition attacked from the north flank, never from between the head and the new fire, escape into the black (`3:EK11`, `4:EK11`). 17 findings on the bundle, all explained (the step-17 `overrun` is the traced outline at the road's verge covering the road point the crew stands on).

### ak.3 Keyed texts

`demo-probes.ts` contradiction backup: the non-contradictory pair "the road stopped the fire — the head crossed it" is now KY21's stop and EK16's crossing (was EK16 at both); `labels.en.json` with it. `freeze-bank-b.ts` `road_crossed` and `demo-directive.ts` V13 bases name KY21 as the stop's reporter. `view-traffic.ts`: DR2's 19:05 thermal on the south-east front stays pushed whatever the cap (the V13 basis and a cited pair; KY21's move message would otherwise have pushed it under — DR1's second village thermal at 19:0x is the record demoted instead). `test/scenario/freeze-bank.spec.ts`: the stop is `atom.radio.18.4` (KY21's move precedes it).

### ak.4 Open items for the researcher

1. **V5 (15:20), EK11 at the Koivuoja head.** On the map the crew stands at the leading edge of a head that was crowning ten minutes earlier, with PP1 already 55 m behind it and 500 m of hose from a truck on the forest road — and it got there from the safety zone on R1 (2.5 km by road, 500 m of hose) in the twenty minutes the run was still going. A commander would have it on the lobe's south-east flank 150–200 m back from the tip, arriving at 15:40 at the earliest. It is kept because V5's PP1 arc (the pull-back at 15:31, the 15:42 line, V6's SPAM item "the fire crossed, the line is broken" against "EK11 withdrew to the road", DR1's three confirmations as the V5 Thinker's matches) is keyed on it; moving the crew moves PP1 and those keys. Decide: keep the arc as is, or re-plant PP1 on a flank position (a re-design of V5–V6's items).
2. **V4 (14:40), EK12 at the head and the near miss.** Both reviewers would have EK12 on the flank ~250 m behind the head (ak.5: tried, and blocked by the V5 Thinker fixture's scoring tie). Kept at the spruce edge as designed and keyed; the trigger point is now indicator-based (ak.2), so the near miss reads as the run outpacing a correct trigger rather than a crew waiting for the crown fire to start. If the fixture may move, the `edge:L2SF` anchor in the history of `deployment.ts` is the position.
3. **V8 (16:40), the head marker on the crews.** The map's head mark (3.5 m/min, DR3) sits on the stopped north edge among EK14, EK15 and KY21 (25–56 m); a display matter for the map's head rule, not a position.
4. **V4 (14:40), EK11's truck.** With the fire reaching R1 at the crew's old parking spot, the generator re-parks the truck on the forest road 1 km north (780 m of hose; the crew's 14:4x report says so). Relaxing the parking rule to a flank road's clearance changes nothing: a straight hose line to R1 west crosses the fire's north-west bulge. Realistic enough (a crew re-lays along the edge) but a long line at the worst moment; left as is.
5. **A forest machine for the firebreaks** (cmdr-incident): EK15's and KY23's firebreaks on the north edge are cut by engine crews; in Finland a harvester, forwarder or excavator would build that line. A scenario-realism item, not a position.

### ak.5 The two commander reviewers' findings (cmdr-finnish, cmdr-incident)

Adopted:

| Finding | Change |
|---|---|
| Both HIGH: EK12 to the head at the spruce edge at 14:40 (`edge:SPR`, 90 m from a head accelerating at 14 m/min into unthinned spruce, past a hose attack's flame-length limit) | **Agreed, tried, backed out** — see the rejected list below. The 14:45 trigger point is indicator-based meanwhile (ak.2). |
| cmdr-incident HIGH: EK11 at the esker ignition 140 m ahead of the head (14:00) with no LCES line | EK11's 14:05 line (recorded): attack from the north flank, never between the head and the spot, escape into the black; `crew-safety.ts` `3:EK11`/`4:EK11` cite it. Position unchanged (on the north flank beside the tip, the spot north-east of it). |
| Both HIGH: EK16 on the forest road ahead of the head with no trigger point and an escape route along the road | EK16's 18:4x report carries a trigger (the head 200 m from the road or the first spot south of it) and a safety zone that is not downwind (the R2 junction clearing, 600 m east). Checked: the head crosses the road 600 m **west** of EK16 (crossings.ts, (375, −393) against FR_E (987, −587)), so the route east is never cut; the edge is ~170 m off at 19:20 when EK16 withdraws. |
| Both MEDIUM: three engines bunched at the R2/forest-road junction | **EK12 at 18:00 to R2 south of the junction** (`at:R2_MID`, (1507, −1182); was `at:R2_FR`, 70 m from EK11). The R2 line then runs KY21 (north, from 19:00), EK11 (junction), EK16 (from 19:20), EK12, OUT2, OUT1, VPK (from 19:20): each engine its own stretch over 900 m. |
| cmdr-incident MEDIUM: EK12's 16:40 return to "the head's south flank" with no task | said as mop-up on a stretch in hand (`kärki hallinnassa, jälkisammutus`). |
| Both: the 14:45 trigger point on precursors, not on crowning | done (ak.2). |

Rejected, with the reason:

- **EK12 on the flank behind the head at 14:40 (both HIGH).** Agreed on the merits and tried: an `edge:L2SF` anchor at (850, 650) put the crew at (888, 657), 225 m behind the head on the lobe's south-east flank, hose 300 m, and the near miss at 15:00 still read well. Backed out because the step-5 records it changes re-seed every later generated draw, and at V5 the frozen Thinker retrieval (`test/server/thinker-review-ah.spec.ts` C2, the (ah) reviewer's guard that DR1's three spot-fire confirmations reach the model) then loses DR1's PP2 confirmation to the planted F7 grid record on a scoring tie — tried at four neighbouring anchors and on `edge:L2S`, the same every time. A property of the instrument, not of the position: the researcher decides whether the V5 fixture may move with it (ak.4, item 2).
- **V5 (15:20) EK11 on the Koivuoja line (both HIGH).** Agreed on the merits — it is ak.4's first open item — but not changed here: the position carries the planted PP1 arc (the 15:31 pull-back, the 15:42 line, V6's SPAM item, DR1's confirmations as the V5 Thinker's matches), and every alternative (the flank 150–200 m back; the burned side of the crossing; the anchor end with the spots named) either moves PP1 off the crew-to-truck line or names the spots the Thinker test forbids. A researcher decision.
- **KY21 at 18:20–19:00 (cmdr-finnish: withdraw at 18:20; cmdr-incident: the 18:40 withdrawal and the 150 m trigger were right).** Neither: the 150 m trigger had already passed when it was said, and leaving at 18:20 or 18:40 abandons the road line before the road is tested — the stretch the fire then stopped at (18:40–19:00) and crossed (19:00–19:20) stood empty and the crossing report said "no units near" under a directive that put the crews on the roads. KY21 now holds through the stop with a consistent trigger and leaves at 19:00 as sparks cross (ak.1).
- **EK16 withdrawing at 19:00–19:10 instead of 19:20 (cmdr-finnish).** Its stretch gets the fire only at 19:20 (edge 310 m at 19:00, 167 m at 19:20); with the 200 m trigger now stated, the 19:20 withdrawal is the trigger firing. Flames in its report stay 1–2 m (cmdr-incident suggested 2–3 m): DR2's 19:05 thermal says 1–2 m and the two reports are a cited non-contradictory pair in the contradiction backup.
- **EK14 and KY21 into the black during the crown run (cmdr-finnish HIGH).** Both are 600–1000 m behind the head, EK14 in heather at the R1 heel, KY21 on the pine-heath flank; the run and its lateral crowning are in the Kuusimäki spruce 400 m and more ahead of them, both have the black at their backs and KY21's 14:4x message names its assembly point. No finding in `crew-safety.ts` at step 6 for either.
- **A patrol crew on L3 at 16:20–17:00 (cmdr-incident MEDIUM), and the commander asking the region for KY23/EK16 for the new fire at 17:00 (cmdr-finnish MEDIUM).** The omission is the study's planted V9 (SPEC/26 §5): no crew on L3 and none at the new front in V10, by design; the region's hold on EK16/KY23 is the in-world reason (fix pass 2, FC5).
- **VPK, the tanker, taken for the evacuation at 18:40 (cmdr-incident MEDIUM).** A researcher decision (D1, 6 Oct 2026) keyed through VPK's request at 19:1x, the police answer and its return at 19:20 (`vpkRelief`); the line's water is the shuttle's basins (EK13) and KY21's own container.
- **KY23 released at 17:00 and sent to the north firebreak, 1.1 km from the rekindle (cmdr-finnish MEDIUM: the radio should offer the commander the choice).** The region's release at 17:00:30 ("KY23 on nyt johdon käytettävissä") is that offer, in-world; the move that follows is the planned one (SPEC/26 §5: no crew at the new front before V11), and the participant's allocation does not move units (identical stimulus). Nothing changed.
- **V1 EK12 "kärki noin 200 m meistä pohjoiseen" against a marker 48 m from the burning edge (cmdr-finnish LOW).** They agree: the head mark is 201 m north of the crew (bearing 353°), the crew stands on the head's right flank 48 m outside the edge. Nothing changed.
- **A recorded decision "L3 patrolled by DR2" for the V7–V9 gap (cmdr-incident MEDIUM).** DR2 is not on L3 at 16:20–17:00 (battery swap, then the north flank: `AIR_PLAN`), so the line would be false, and a recorded decision would turn the planted omission into a decision and point at the rekindle. The sector leader's release message already carries "lohko 3 hallinnassa". Nothing changed.
- **A forest machine for the firebreaks (cmdr-incident).** Not a position; recorded as an open item for the researcher (ak.4).

### ak.6 Values (site-scenario.json)

Areas unchanged (127.9 ha at 17:20, ~156 ha at 19:40); view flags 14 / 14; the road stops the head at 18:40–19:00 and the head crosses at 19:00–19:20; 1007 traffic records (was 1006); crew safety 17 findings, 0 unexplained; the Finnish neutral evaluation unchanged (collapse3 .6765 / .5162; rule selects collapse3); the V7 objection's documented broad-question rank 243 → 244 (`test/engine/rekindle.spec.ts`).

## Revision 10 Oct 2026 (al) — the map review panel's recommendations

Researcher's approval, 10 Oct 2026. The fire model's grids are not touched (`content/site/*.asc` identical in content; the CA is not re-run on new terrain); the fire, the 14 / 14 view flags, the keys and the planted arc (V7 "in hand", the V9 omission, V13 US2, F7's planted "line de-energised") hold. Identical stimulus.

### al.1 The basemap (tiles only; `12` revision (al))

The W2 farm pond (r ≈ 35 m, `POND_W2` on its drivable south shore), the 110 kV line heavier with pylon ticks every 250 m and its 36 m cleared corridor, a 60 × 40 m log landing at the R2 junction `R2_FR` (EK16's safety zone), and lighter, thinner mire hatching and ditches. None of it is in `landCover()`, so no record's ground type changes (`siteTrafficHelpers().landCoverAt`; EK13 at W2 still stands on the road, never in water). The origin's clear-cut is not drawn (researcher: it would cue the rekindle site).

### al.2 W3 and the bridge's one name

- **W3 is off the bridge**: `BRIDGE_W3` (the feature id is kept) moves from the 16 t bridge deck (3050, 390) to the **west bank** at (3040, 372), ~18 m south of R3 and ~10 m from the water. No tanker fills standing on a load-limited bridge.
- **One name for the R3 bridge: "R3:n silta (Kotkanjoki)"**, in English "R3 bridge (Eagle River)" (`englishNames` maps Kotkanjoki). Every record uses it (it replaces "Kotkanjoen silta" and the bare "R3:n silta"): the move places ("R3:n sillan (Kotkanjoki) länsirannalle, vesipiste W3", "R3:n sillan (Kotkanjoki) itäpäähän"), the AVL and log places (`traffic-places.ts`, `traffic.ts`), the water log ("R3:n silta (Kotkanjoki), W3"), the drones' road and water-point names (`traffic-drones.ts`), and "Viimeksi täytetty klo …, R3:n silta (Kotkanjoki)." (a comma, not nested brackets).
- **The V7 water item** reads "Onko vesipiste W3 (Kotkanjoki) …" (was "(Kotkanjoen silta)"): the freeze items may not say "sillan" before V12, where the bridge's limit is first on record (`test/scenario/freeze-items.spec.ts`). Its key atom is EK12's "täytti säiliön, R3:n silta (Kotkanjoki)" (`demo-probes.ts`).
- The name and W3's coordinate were sent to `map-overlay`, which draws the live map's road and water-point labels.

### al.3 EK16 off the 110 kV corridor; burnouts near the line

- **`FR_E` moves 150 m west along the Honkaharju road**, (950, −561) → (810, −510): it stood 8 m from the line, inside its 36 m corridor; now ~127 m (EK16's crew, drawn at its stretch of the road, ~70 m).
- **Measured after the regeneration:** the head crosses the road at 19:00–19:20 ~450 m west of `FR_E` (~520 m from EK16's crew; was ~600 m), still to the west, so the escape route east is never cut; the safety zone is now the **log landing** at the R2 junction, ~720 m east along the road, and EK16's 18:4x report names it: "Perääntymistie tietä pitkin itään R2:n risteyksen puutavaran varastoalueelle (turva-alue)". The trigger point (the head ~200 m from the road, or the first spot south of it) is unchanged. EK16 now stands ~185 m downwind of the running head on the 18:40 map too; its 18:4x report explains it (`crew-safety.ts` `17:EK16`; 18 findings, 0 unexplained).
- **Burnouts near the line** (`traffic.ts` `burnoutStretch`): a road crew within 300 m of the 110 kV line proposes its burnout on the stretch away from it ("tien reunasta asemastamme länteen"), with no word about the line. No officer burns out beside a line whose status he has not confirmed, and the line's status is F7's planted record, asked at V12: nothing before the V12 freeze speaks of it. With EK16 nearer the head, the 18:06 proposal is now EK16's (was VPK's from `FR_MID`), and VPK makes none; EK16 calls its own off at 18:47 in the wind (gusts 14). The corpus has 1005 records (was 1007). No record mentions the power line or its status (checked: "voimalinj", "sähkölinj", "110 kV", "jännite" absent from the bundle, as before).

### al.4 The region's other two fires

P2's directive says the region has three fires; DR3 leaves "toiselle palolle" at 17:59 and EK16/KY23 are held "toisen palon varalta", but no record names or places them. The export now carries a static **`regionFires`** (top level of `site-scenario.json`, typed in `SiteScenarioBundle`): `{ id, nameFi, nameEn, haFi, haEn, at: LatLon }[]` — RF1 "Kuikkalammen palo" / "Loon Pond fire", ~8.8 km north-west, "noin 40 ha"; RF2 "Kaitajärven palo" / "Narrow Lake fire", ~8.4 km east, "noin 15 ha". Both more than 8 km from IGN and inside the 20 km Area frame. For the live map's Area level only (`map-overlay`); no record's text changes.

### al.5 Texts

- **V11's depth** (step 15, KY21): "Tien pohjoispuolella palo palaa syvällä kunttakerroksessa ja kantojen juurissa, 20–40 cm. Vesi ei imeydy kuivaan kunttaan. Harkitaan kasteluainetta." The depth is placed where it can be: KY21's line is on the mineral soil north of the road; Rahkasuo's drained peat begins ~170 m south of the road, which the fire reaches only after 19:00 (§7 table, step 15 row; `branch-statements.ts` cites the new text).
- `scenario-18.ts`, steps 12–16 comment: the ground falls gently south from the origin to the forest road (~93 → 87 m); Honkaharju is a low sand rise, the esker is Kuivakangas; the north-westerly, not the slope, drives the front south.
- **Sector descriptions** (L1–L4 by terrain, neutral, fi and en) were sent to `thinker-v2`, which owns `app/scenario/briefing.ts`.

### al.6 Open item (after the pilot): F3's radio dead zone

F3's dead zone is keyed to EK14 at `R1_BLACK_MID` (350, 412), on open road on the burned stretch of R1 at ~89 m, while the northern valley it stands for lies at 73–75 m. A dead zone on a road crest is implausible. **Not moved** (researcher: after the pilot); recorded here so the next position pass fixes it.

### al.7 Values (site-scenario.json)

The fire unchanged (areas, flags 14 / 14, the road's stop at 18:40–19:00 and the crossing at 19:00–19:20); 1005 traffic records (was 1007); crew safety 18 findings, 0 unexplained; the Finnish neutral evaluation collapse3 .6765 / .5187 (was .5162; rule selects collapse3); the V7 objection's documented broad-question rank 244 → 245 (`test/engine/rekindle.spec.ts`).


## Revision 19 Oct 2026 (ay) — the world after the fire, tactical and radio audits (`31` §2.3, §2.4, §5)

- **Flame lengths (RC for the keys).** Byram's relation applied to the quoted phase-B bands (1–2 m at 7.9–10 m/min) implies 0.2–0.5 kg/m² burned, against 2–3.3 from Kalajoki's rate/flame pairs (3–4 m/min ↔ 2.6 m; 5–7 ↔ 4–4.4 m; flank ≈ 0.6–0.7 × head). A **provisional flame-length table** per step and segment is authored in `tools/fire-ca/` and the records' bands follow it (DR2, EK16, KY21, SPOT; DR2 18:25 and KY21 18:26 reconciled), before the panel sees any record set. FMI/Prometheus HFI or the SMP table replaces it. The 38 m/min crown run stays (`24` ah.7); its pushed line carries the spot-jump caveat and the front rate without the jumps (radio FB-01).
- **Weather.** The station reports T and RH every step, including 17:00, 19:00, 19:40 and 20:00; the evening dries (RH 38 → 28 → 26 %, dew point ≈ 9.7 → −0.1 °C) with no recovery — FMI confirms. **§6's rows from 16:20 on (shower, RH 60 %) are stale**; the station's values govern. **§7 row 12 and §7.2** still place the rekindle's source "600 m or 1.64 km out" in the 2024 spoil banks; the CA has it ~65 m from the origin on the old edge (`24` aj).
- **Crew safety on record.** The R2 crews (EK11, EK12, EK16, KY21, OUT1, OUT2, VPK) state an escape route and a named safety zone (the log landing at the R2 junction, the Lahdenkylä fields) for 19:00–20:00; KY21's 18:26 escape route runs into the black by the north track (its stated "east to R2" crossed the contact stretch); EK16's 19:0x record says why it holds past its trigger (fire 90–190 m west, route open, lookout) and it withdraws at 19:21 as before. No L4 precursor is added before US3 (it would pre-announce V14's deciding fact).
- **Realism fixes (radio.md, WP-1):** the generator's duplicated sentences, identical fillers, nested brackets, the 3 000 m lookout, the 4 % tank, UGV1's status, lateral traffic only between neighbours, P2 (not the emergency centre) releasing units, one spelling "drooni", "Sääasema" as the station's display name, KY23's 19:21 line naming the north edge and the Karhujärvi side (so it is not taken for V14's deciding flare-up), SPOT 19:15 naming the north edge, "Uusi palo etenee itään" at V10, "palon voimakkuus" in the phase-A intent, English "north edge" and "from the …" winds. Records a key regex cites are not reworded until the terminology pass (`31` WP-6).
- **§8.1.** KY21's note reads "eri puhetavat" (SM 2021:35 is one national scheme). The roster shows "oma pelastuslaitos" / "naapuripelastuslaitos" instead of Etelä-Karjala and Kymenlaakso; VD1, UGV1 and DR3 are marked trials ("kokeilu"); OUT1/OUT2 are "raskas säiliöyksikkö". Whether EK/KY are real codes that collide with real units, the number structure, VPK's and the UAS call signs, P2's form and the talk-group plan are Pelastusopisto's VERIFY list (`radio.md`); a corpus-wide rename follows only a confirmed collision.

## Revision 20 Oct 2026 (ba) — the rebuilt site (`33`)

§5's feature table holds on the rebuilt site within the contract's tolerances. "110 kV" reads "20 kV" throughout (owner: the regional distribution company; DRAFT 20 kV safety distances for the domain reviewer). Unit positions, travel times and the radio texts that moved are listed in `docs/audits/2026-10-20-map/content/changes.md`.

## Revision 24 Oct 2026 (bg) — records for the play-test decisions

Source: `docs/audits/2026-10-23-playtest/analysis.md` §3 and §6 and the researcher's decisions of 24 Oct 2026. Every new Finnish text is a **DRAFT** for the native and domain check, written to the radio conventions (sender first, one breath, facts before requests, hh.mm); English beside it in `content/i18n/authored.en.json` (story beats) and the generator's `L(fi, en)` pairs (radio). Records are group-neutral: both groups get every record in the same view, tier and moment. The new records are story beats (`demo-story.ts`) appended to their step, so no other record's id, index, text or tier moves; the generated traffic is unchanged but for the three records below (D8, D11), checked by regenerating the bundle (`npm run fire:ca`: no other traffic, radio or English entry differs, and the per-view push cap demotes nothing).

| Decision | Record (id) | Step, clock, tier | Finnish (DRAFT) | Basis |
|---|---|---|---|---|
| D9 (a) helicopter | `atom.demo.1.0` (amended handover) | 1, 13.21, pushed | "… Sammutushelikopteri pyydetty; se on alueen toisella palolla, P2:n arvio perillä noin klo 15.40." | HELI1 first over the head at 15.41 (story 8.0); DR1 and DR3 land for it at 15.39. Said in the handover: V1 pushes 18, the generator's cap, and a beat of its own would demote a generated V1 record |
| D9 (c) CO, esker | `atom.demo.3.2` | 3, 14.08, T3 (asked) | "EK11 (kysyttäessä): Häkämittari harjulla noin 25 ppm, savun kääntyessä hetkittäin noin 50 ppm. Raja 75 ppm ei ylity, työskentelemme ilman paineilmalaitteita." | EK11 ~70 m from the head on its right (south-east) flank; the SW wind carries the head's smoke north-east: a danger-area reading (MPV25: immediate danger when the 15-minute 75 ppm limit is exceeded) |
| D3 birch strip | `atom.demo.4.1` | 4, 14.27, pushed (V3) | "Kärjen edessä alkaa pian Kuusimäen kuusikko, joka jatkuu koilliseen noin kilometrin. Kuusikon takana Koivuojan varressa on kapea koivikko ja haavikko." (DR1; no metre figures, so the geometry contract needs no new relation) | the fuel grids (`tools/topo-map/landcover.ts`): spruce 1.3–2.2 km from the origin on the head's bearing, the head ~1.1 km out at 14.20; the birch–aspen strip 2.25–2.45 km. The fuel only, not what the fire does in it |
| D7 forecast | `atom.demo.6.2` | 6, 15.05, pushed (V4's second step) | "Sääennusteen päivitys klo 15.00: tuuli kääntyy lounaasta etelän kautta kaakkoon klo 15.30–16.00 ja heikkenee samalla 4–5 m/s:iin." (P2) | `evt.wx.03` (recorded, 15.03), the full forecast, stays recorded; the build checks the headline says what it says. The 16.00 update stays recorded only: its front and west-north-west turn would cue V7's rekindle item (H10) |
| D9 (b) reinforcements | `atom.demo.7.1` | 7, 15.30, pushed (V5) | "Lisäyksiköitä hälytetty: EK15 saapuu johtopaikalle arviolta klo 16.20, EK16 ja KY23 arviolta klo 16.40." (P2) | the arrivals at the CP: EK15 16.22 (radio 10), EK16 and KY23 16.42–16.43 (radio 11); that the region holds EK16 and KY23 is said on arrival, as before |
| D5 area | `atom.demo.12.2` | 12, 17.05, pushed (V9) | "Tilannekuva klo 17.05: palorajan kartta päivitetty yksiköiden ilmoitusten ja droonikuvien perusteella. Palanut ala noin 152,6 ha. Syttymäkohdan kaakkoispuolen uusi palo ei ole vielä kartalla." (TILANNEKUVA) | the 17.00 map's area, the fire model's at the end of step 11 (checked in the build, `V9_PICTURE`); the generated situation pictures' form (recorded, from 18.15); the rekindle is not on that map (SPOT 17.01) |
| D9 (c) CO, forest road | `atom.demo.17.2` | 17, 18.45, T3 (asked) | "EK16 (kysyttäessä): Häkämittari metsäautotiellä (Honkaharju) noin 45 ppm, savun painuessa tielle hetkittäin yli 100 ppm. Paineilmalaitteet valmiina, 15 minuutin raja 75 ppm ei vielä ylity." | EK16 ~360 m south-east of the head, downwind in the north-westerly (9 m/s, gusts 14): near the limit, apparatus ready (MPV25) |
| D8 road reports | `evt.c05.013`, `evt.c05.023` (DR1 14.46, DR3 14.48) | 5, T2 | "tie R1 Kuivakankaan **kohdalla**, …" (was "Kuivakankaan eteläpuolella") | at 14.46–14.48 DR1 and DR3 saw the flank on R1 at the esker's foot (3–4 m flames, unsafe) while DR2 saw R1 ~310 m west (low fire, with care), all three under one stretch name: one stretch read unsafe and passable in two minutes. A new stretch anchor (`traffic-drones.ts` STRETCHES) names the esker's foot; only these two reports move. DR2's 15.07 "no flames" is SPAM V6.b's documented stale lure (`demo-probes.ts`) and its 15.27/15.47 reports the V5 R1 and V6.b keys: unchanged |
| D11 evacuation | `atom.radio.17.0` (VPK 18.41) | 17, pushed | "VPK: avustamme evakuoinnissa, Lahdenkylään; **P2:n** evakuointipäätös, poliisi toteuttaa." (was "johdon", command's) | the decision is the strategic level's, not taken on the participant's behalf; en "P2's evacuation decision, carried out by the police" |

**Pushed counts** (SPEC/26 §6, 6–20; the generator's cap 18): V3 12 → 13, V4 17 → 18, V5 17 → 18, V9 16 → 17; V1 stays 18. The T3 answers are counted with the recorded records. **The Thinker index is carried, not rebuilt** (`npm run thinker:index -- --carry` before `npm run corpus:export`): the new and changed records hold provisional vectors of their nearest previous records; a real rebuild with the embedding model (both languages) is required before any session.

## Revision 25 Oct 2026 (bh) — records for the play-test replay's decisions

Source: `docs/audits/2026-10-23-playtest/analysis.md` §10.4 and the researcher's decisions of 25 Oct 2026 (R3, R5, R7). Every new Finnish text is a **DRAFT** for the native and domain check, written to the radio conventions; the English beside it (`content/i18n/authored.en.json` for the story beat, the generator's `L(fi, en)` pairs and `place-names.ts` for the rest). Both groups receive the same records (parity unchanged); no record is added or removed, so the pushed counts and the corpus (1004 records) are unchanged.

| Decision | Record (id) | Step, clock, tier | Finnish (DRAFT) | Basis |
|---|---|---|---|---|
| R3 V10 `infra` | `atom.demo.13.0` (DR2) | 13, 17.21, pushed | "Uusi palo etenee itään vanhan eteläreunan suuntaisesti. Huoltotie R2 ajettavissa, uusi palo runsaan kilometrin päässä tiestä. …" (was "Huoltotie R2 **vielä** ajettavissa") | en "Service road R2 is passable; …" (was "still passable"). "Vielä" read as "for now" and led all five play-test runs to V10 `infra`'s "threatened" option; the road's state is unchanged (the new front 1.1–1.2 km off) |
| R5 the brook's name | `atom.radio.7.2` | 7, 15.2x, pushed | "Kipinät lensivät **Myllyojan** yli, uusi palo toisella puolella. …" (was "Korpiojan") | en "Embers flew over Mill Brook; …" (was "Alder Creek"). The name comes from the generator (`tools/topo-map/water.ts` `BROOKS`, `crossings.ts`), the English from `place-names.ts`; the geometry is unchanged |
| R7 the R1 stretches | `evt.c05.013` (DR1 14.46), `evt.c05.023` (DR3 14.48) | 5, T2 | "DR1 tiehavainto: tie R1 **vajaa kilometri R2:n risteyksestä länteen**, palo noin 10 m tiestä — liekit tien reunassa (liekit 3–4 m), ajo ei turvallista …" (was "Kuivakankaan kohdalla", (bg) D8) | en "road R1 just under a kilometre west of the R2 junction". The stretch lies on R1 ~840 m west of the junction (the contract's `distance.R1_R2.R1_STRETCH_W_OF_R2`, ±15 %, and `on_road.R1_STRETCH_W_OF_R2.R1`) |

**R5, the name.** Korpioja / "Alder Creek" was confusable with Koivuoja / "Birch Creek" (both play-test players read the brook's two labels as two brooks). **Myllyoja / "Mill Brook"** starts with no "Ko-", and no other place name of the contract or `place-names.ts` begins "Myl" or contains "Mill". Koivuoja keeps its name (its birch strip is `crown_drops`' key). Changed wherever the name is shown: the generator and the bundle, `place-names.ts`, the contract (feature `MYLLYOJA`, was `KORPIOJA`), the briefing's L1 sector text, the items (`08` bh.5), the Thinker's gazetteer (`server/thinker/model.ts`) and neutral evaluation, the overlay's second label and the basemap's label (`12` (bh)); ae.1's table above reads the new name. Kept as ids: the item slug `korpioja_spot`.

**R7, the stretches.** Two R1 stretches ~210 m apart had one map label between them ("Kuivakankaan eteläpuolella", the DR2 series, and (bg)'s "Kuivakankaan kohdalla", the two step-5 reports), and a play-test player searched the second and got the first's opposite state. A map label per stretch is not possible within `12` (al): both lie 40–250 m from V13's old north edge, inside the 400 m the reference overlay keeps clear. So the step-5 stretch is named by a map feature instead: the R1/R2 junction, which the map shows (R1 meets the labelled R2), found with the scale bar; "Kuivakangas" now names one R1 stretch only, which lies south of the esker's labelled south-western half. No figure is written: an "800 m" beside "R2" reads as V10 `front_r2_80`'s key (650–950 m from R2) to the recall guard and the key statements. **SPAM V6.b's design is intact:** its two key reports (DR2 15.27, 15.47) and the designed stale lure (DR2 15.07, "palanut alue tien reunassa — ei liekkejä, ajettavissa") keep their stretch and text, and V5 `infra` reads the same series.

**Thinker index carried, not rebuilt** (`npm run thinker:index -- --carry` before `npm run corpus:export`): the four reworded records keep their own previous vectors (583 Finnish and 646 English vectors now carried of 1004; one more each, the crossing radio); a real rebuild with the embedding model (both languages) is required before any session. In the lexical half, play-test question L15 ("latest road report road R1 south of Dry Heath", V6) now ranks the designed lure first and the 15.47 key record second, 0.03 behind (it was first by a hair): two records no longer name Dry Heath, which weighs the term a little more (`test/retrieval/d10-retrieval.spec.ts`; for the retrieval owner).

## Revision 25 Oct 2026 (bk) — three records held for seeking (H2's seek-dependent items)

Source: the researcher's decision of 25 Oct 2026 (H2 depends on information seeking again; `09` (bk), `30` (bk)); the items in `08` (bk). A treatment revision before pilot 2 (`30` §2). Three records that were pushed are now **recorded only**: they keep their text, step, clock and source, and are reached by Haku, the Thinker or the record views. Nothing is added, removed or re-worded, so the corpus keeps its 1004 records and both groups receive the same records (parity unchanged).

| Record (id) | Step, clock, source | Was → is | Text (unchanged) | Item it now makes seek-dependent; why safe to hold |
|---|---|---|---|---|
| `evt.c03.021` | 3, 14.08, EK12 | T1 pushed (V2, at the boundary) → **T2 recorded** | "EK12, kärki, eteläsivusta: pintapaloa kuivaa männikkökangasta, liekit 1–2 m. Letkulinja 680 m, paine riittää." | V2 `south_flank` (with EK12's recorded 13.51 report). Fire behaviour and a working line; no danger, withdrawal or request. EK12's 13.20 report (V1) stays pushed — the stale state a non-searcher holds |
| `evt.c07.032` | 7, 15.35, EK11 | T1 pushed (V5) → **T2 recorded** | "EK11, Koivuoja: linjaa jo 600 m, varaletkua alle 200 m. Tarvitsemme lisää 76 mm syöttöletkua, 42 mm työletkua sekä jakoliittimen." | V5 `hose_short`. A supply request, non-critical. EK11's 15.24 "the head runs past us" and its PP1 withdrawal (radio 7.4) stay pushed |
| `atom.demo.7.1` | 7, 15.30, P2 | pushed (V5; (bg) D9 (b)) → **recorded** | "Lisäyksiköitä hälytetty: EK15 saapuu johtopaikalle arviolta klo 16.20, EK16 ja KY23 arviolta klo 16.40." | V5 `reinforcements` (replaces `wind_shift`). Non-critical ETAs; EK11's request "Pyydetään lisäyksiköitä" (story 7.0) and every arrival (radio 10.2, 11) stay pushed. D9's content gap stays filled: the record answers "Milloin lisäyksiköt saapuvat?" first (lexical) |

**How.** The two generated reports are held by the generator after the push cap (`tools/fire-ca/view-traffic.ts` `HELD_FOR_SEEKING`, `holdForSeeking`; each pattern must match exactly one pushed record of its step, else `npm run fire:ca` fails); `app/scenario/site-scenario.json` differs from the previous build in those two records' `tier` only. The story beat carries `heldForSeeking: true` (`demo-story.ts`): recorded, but it still counts toward the view's cap (`countsTowardCap`), so no other record is promoted into its slot. **Pushed counts:** V2 18 → 17, V5 18 → 16; every other view unchanged; the validator's tier bands hold (`npm run validate:scenario`). Every crew-danger, withdrawal, entrapment and live-line record stays pushed.

**Thinker index carried, not rebuilt** (`npm run thinker:index -- --carry` before `npm run corpus:export`, the order above): no indexed text changed, so the carry keeps every vector (583 Finnish and 646 English vectors carried of 1004, as before; the corpus export differs in the three records' tier only); the real rebuild with the embedding model (both languages) is still required before any session.
