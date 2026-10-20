# 23 — Choosing the fire's location on the map

**Version 0.1 · 23 September 2026 · Status: adopted in principle (real terrain, searched site); the site itself is not yet chosen.** Replaces the ad-hoc placement in the preview build. Governs `18` §2 (ignition point) and `18` §5 (geography), which carry amendment markers. The fire itself is generated on the chosen site by the cellular automaton in `24`.

> **Changelog**
> - **20 Oct 2026 (ba)** — `33`: the generated site is rebuilt (glacial terrain, Priority-Flood hydrology, lobed drained mires, field parcels, routed roads, MML Karttapaikka style, cased roads, a 20 kV line). §11–§17 describe the previous generator. See the revision at the end.
> - **9 Oct 2026 (ae)** — §16: the English basemap (the same map, its labels from `app/i18n/place-names.ts`, `18` ae.1); English sessions load it.
> - **0.2 · 23 Sep 2026** — decisions: real place names as on the basemap (§7); three fixed zoom levels, the widest for other groups in later scenarios (§8); the Salpa Line is dropped (§4); **spread capacity is the main site criterion** (§3 H6, §5).
> - 0.1 · 23 Sep 2026 — created. Decision: a real site, found by a search against written criteria, not a fictional terrain.

---

## 1. The problem this document fixes

The location of the fire was never chosen. It happened by accident:

- `18` §2 gives an approximate point (≈ 60.90 N, 27.35 E) and marks every feature in `18` §5 **[nimi]**, "to be bound to real MML features in QGIS". That binding never happened.
- The preview build moved the ignition 27 km south to 60.66 N, 27.27 E **because that was where the one available map sheet (L521) had coverage**, and then placed every landmark at a fixed offset from it, whatever the real map shows there. A fire officer would see the "pond" in a field and "road R1" where there is no road.
- The site decides who responds. Near Hamina the nearest full-time station is in Kymenlaakso; `18` §8.1 assumes South Karelia's EK11 is nearest and KY21 is the cross-border unit. Moving the site silently changes the order of battle.

The procedure below reverses the order: **write the requirements, find a real place that meets them, then fit the scenario to that place.**

---

## 2. Decision: real terrain, searched site

A real site keeps what `03` §1.5 already relies on: the MML basemap officers recognise, and a real forest-stand grid from Metsäkeskus — which the fire model in `24` needs as its fuel map. Fictional terrain (the approach of the Harjula instrument, ADR-010 in the reference repository) would place features exactly but would need a generated fuel map and an expert realism check of its own.

Fictional terrain remains the **fallback** if no real site satisfies the hard constraints in §3.

---

## 3. Hard constraints

A candidate site is rejected if any of these fails.

| # | Constraint | Source |
|---|---|---|
| H1 | Inside the `03` §1.1 box (60.62–61.07 N, 26.68–27.60 E) | `03` §1.1 |
| H2 | At least 10 km from the national border, measured from every point of the scenario footprint, not only the ignition | `03` §1.2 |
| H3 | Within about 10 km of the South Karelia–Kymenlaakso rescue-region boundary, and on the side that makes EK11–EK14 the nearest units and KY21 the cross-border unit | `03` §1.3, `18` §8.1 |
| H4 | No town or dense settlement inside the footprint; the village is the only settlement at risk | `03` §1.2, `18` §9 |
| H5 | Not inside a Natura 2000 or other protected area | realism; ethics review |
| H6 | **The fire can spread widely enough.** The connected burnable patch around the ignition is at least 1,000 ha (several times the authored ~170 ha), and at least 75% of the ground 0.5–4 km out is fuel in each spread direction: NE (phase A head), NW (cycle 9), SE (phase B). Measured by `tools/fire-ca/screen.ts`; printed by `npm run fire:ca` | `18` §7, `24` |
| H7 | The whole footprint plus a 1 km margin is covered by the data in `03` §1.5 | `05` §8 |

**H6 is the constraint that matters most.** The other features in §4 are wanted, but most can be moved or substituted; a site where lakes, fields or clear-cuts stop the fire cannot be rescued by authoring.

---

## 4. The feature template

`18` §5, restated as checkable conditions. Bearing and distance are from the ignition point **IGN**. Tolerances are proposals: ±30° in bearing and ±25% in distance unless stated. These are **wanted, not hard**: a feature that is missing can be substituted by a similar real one, as long as H6 holds.

| Id | Must be | Bearing, distance | Data layer |
|---|---|---|---|
| IGN | Harvesting block on dry pine heath, mature pine/spruce mosaic around it | — | Metsäkeskus stands; MML |
| R1 | Gravel forest road running roughly E–W | N, 400 m | MML roads |
| RIDGE | Esker ridge with lichen heath | NE, 0.8–1.2 km | MML elevation; Metsäkeskus |
| SPR | Mature, unthinned spruce, low crown base | NE, 1.3–2.2 km | Metsäkeskus |
| BIRCH | Birch–aspen strip along a brook | NE, ~2.3 km | Metsäkeskus; MML water |
| POND | Pond usable as a water point | NW, ~1.5 km | MML water |
| LAKE-N | Lake with a shore of summer cottages | NW, ~2.5 km | MML water, buildings |
| VALLEY-N | Wet valley | N, 1–2 km | MML elevation |
| BOG-S | Drained, ditched peatland | S–SE, 0.6–1.8 km | Syke peatland; MML ditches |
| R2 | Forest road crossing the bog's east edge | E side | MML roads |
| PL | 110 kV power line | E, ~1.5 km | MML power lines |
| BRIDGE | Timber bridge with a load limit on a reinforcement route | E, ~3 km | Road register |
| VILLAGE-E | Village with houses and farms | SE, 3.5–4 km (see §6) | MML buildings |
| W3 | River crossing usable as a water point | NE, ~4 km | MML water |

**The Salpa Line is not used** (decision 23 Sep 2026). The phase-B defensive line is a forest road, a field edge or a watercourse on the chosen site (`18` amendment 23 Sep 2026).

---

## 5. Procedure

1. **Spread capacity first.** In QGIS, find large continuous forest blocks within the `03` §1.1 box: at least about 4 km across with few lakes, fields or recent clear-cuts, pine-dominated on dry sites, with drained peatland on one side. Most of the region falls out here.
2. **Candidate ignition points.** In each block, find dry pine-heath stands with a mature spruce stand 1.3–2.2 km on one side. The direction from ignition to spruce fixes the scenario's "NE".
3. **Score the rest of the template** (§4) for each candidate: how many features fall within tolerance, and by how much each one misses.
4. **Screen with the fire model.** Export each shortlisted site's fuel and elevation rasters (ESRI ASCII grid, ETRS-TM35FIN, 25 m cells; `24` §7) and run the incident through the cellular automaton. Keep sites that **pass the spread screen (H6)** and where the burned area reaches the authored order of magnitude (~170 ha by cycle 20). Then prefer sites where the landmark timings of `18` §7 come out right: the head reaches R1 in W2–W3, the ridge in cycle 3, the spruce in cycle 5, the birch strip in cycle 7.
5. **Shortlist three; the domain reviewer chooses** (`11` §1.2).
6. **Rebind the scenario to the chosen site:**
   - replace every **[nimi]** in `18` with the real feature's real name (§7);
   - replace the relative distances in `18` §5 with the measured ones;
   - rerun the fire model, and adjust **rates or timings, never the geography**, until the flags and landmark timings hold;
   - re-derive the order of battle (`18` §8.1) from which stations are actually nearest.
7. **Set the map extent** to the scenario footprint plus a margin (§8), not to whatever sheet is at hand.

---

## 6. Distances and fire speed are linked

The authored rates of spread in `18` §7 imply how far the fire can get. Adding up the head's rate cycle by cycle:

- the head reaches about 0.9 km by cycle 3 and 1.2 km by cycle 5 — consistent with RIDGE and SPR;
- the south-east front gains only about 1 km over cycles 12–20, reaching at most about 2.8 km from IGN — **short of the village at 3.5–4 km**.

The demo generator already moved the village to 2.2 km for this reason (the "22" second-pass review). The spec and the code disagree today. After the site is chosen, the village's real distance is a measurement, and the rates in `18` §7 must be made consistent with it. The fire model in `24` performs this check automatically.

---

## 7. Place names — decided: real names

**Decision (23 Sep 2026): use the real names, as printed on the MML basemap.** It is the simplest option: nothing is suppressed or invented, and the basemap and the records name the same features. Every **[nimi]** in `18` becomes the real feature's name. Familiarity with the area is still asked in the questionnaire and handled as `09` §6.2 already specifies.

---

## 8. Map extent, zoom and coordinates

- **Zoom levels — decided: three fixed levels.** Later scenarios add **other groups working the same fire** (neighbouring sectors, other formations), not only the participant's own, so the map must be able to show more than the participant's own sector.

  | Level | Finnish label | Ground width across the map | What it is for |
  |---|---|---|---|
  | Region | *Alue* | 20 km | Other groups' sectors, a second fire in the region, approach routes |
  | Incident | *Palo* | the study area, ~7 km (was 6 km) | The opening frame: the whole scenario extent, never the fire's own bounds (`12` revision (aj), 9 Oct 2026) |
  | Sector | *2 km* (was *Lohko*; `12` revision (al)) | 2 km | Close inspection; marking and drawing |

  *(Revision (al), 10 Oct 2026: wheel, trackpad and pinch zoom are on and every camera change is logged as `viewport_changed`, `07` revision (al); double-click zoom stays off. The sentence below is kept as first written.)* Free zoom (wheel, double-click, pinch) is off; panning is allowed within 12 km of the incident. Implemented in `app/render/ui/components/MapView.tsx` (`ZOOM_LEVELS`). At the sector level one screen pixel is under 2 m at 1280 px width, which bounds the breach-point and correction tolerances in `08` §6.1. The zoom level in force when a point or polygon is marked must be recoverable from the log (`viewport_changed` carries the zoom, `07` §2.3), so tolerances can be interpreted per level. The preview does not emit `viewport_changed` yet.
- **Extent.** The data bundle must cover the region level: about 24 × 24 km around the incident, not the 50 × 50 km `03` §1.1 box. The box is where the site is searched for, not what the participant sees.
- **Grid.** Records state positions by the real place names (§7) and, where the source would give one, an ETRS-TM35FIN grid reference. `18` §3's "first location 300 m off" is written that way.

---

## 9. Georeferencing the preview basemap (done)

The preview basemap is MML 1:50,000 sheet **L521**. Its extent is fixed by the ETRS-TM35FIN map-sheet grid — E 500 000–548 000 m, N 6 714 000–6 738 000 m — and its corners are now computed exactly (`tools/fire-ca/tm35.ts`) and used in `app/render/ui/components/MapView.tsx`. The earlier single-landmark calibration had put the west edge about 620 m too far east. L521 is a preview basemap only; the chosen site will very likely lie on other sheets.

---

## 10. Open items

Registered in `11` §7.5: the site search itself (§5), the spread-screen thresholds (§3 H6), and re-deriving the order of battle for the chosen site (§5 step 6). Names (§7), zoom levels (§8) and the Salpa Line (§4) are decided.

**Superseded by §11**: the "searched, real site" decision in §2 was replaced by the generated site (`tools/topo-map/terrain.ts`). §5's search procedure and this section's open items assumed a real-site search; they no longer apply. §12 verifies the generated site against this document's own §4 feature template instead.

---

## 11. Generated terrain (SPEC/23 §11, 23 Sep 2026)

See the topo-map build pipeline (`tools/topo-map/{terrain,build,render}.ts/.py`, `MEMORY` of this
session's map work) for the generation itself. This section exists so the pivot from §2's decision
is on record, not silent (matching this project's convention of superseding rather than overwriting).

**Why generated, not searched.** The real-site search in §5 was never completed (`11` §7.5, still
open when this section was added). Rather than leave the scenario on the old placeholder
Hamina-area placement (the exact problem §1 describes: landmarks that don't match the ground L521
shows), the site is procedurally generated to satisfy §3's hard constraints and §4's feature
template directly, by construction — every feature in §4 is placed at the template's own bearing
and distance from IGN, not fitted after the fact to a found place.

**Open, unresolved by this pivot:** real Metsäkeskus stand data and a real fuel map (§2's stated
reason to prefer a real site) do not exist for generated terrain; `standClass()` in terrain.ts is
itself synthetic. This is the same cost §2 named for the "fictional terrain" fallback it was
written against, now accepted. Real names (§7) do not apply either — the generated site's names
(Lahdenkylä, Kotkanjoki, Kuivakangas, etc.) are invented, not MML-sourced.

## 12. Feature-template verification (23 Sep 2026)

Checked numerically against §4's table (bearing/distance from IGN, ±30°/±25% tolerance per §4):

| Id | Template | Generated (terrain.ts) | Within tolerance |
|---|---|---|---|
| IGN | Dry pine heath, mature pine/spruce mosaic | `standClass(0,0)` = `pine_heath`; `landCover` = forest | ✓ by construction |
| R1 | Gravel road, E–W, N 400 m | Road literally routed through `(0, 400)` | ✓ exact |
| RIDGE | Esker, NE 0.8–1.2 km | `ESKER_CENTRE = polar(45°, 1000 m)` | ✓ exact |
| SPR | Mature spruce, NE 1.3–2.2 km | `polar(47°, 1750 m)` | ✓ exact |
| POND | NW ~1.5 km | `polar(315°, 1500 m)` | ✓ exact |
| LAKE-N | NW ~2.5 km | `polar(320°, 2500 m)` | ✓ exact |
| BOG-S | Drained peat, S–SE 0.6–1.8 km | `inBogS`: bearing 135–200°, distance 600–1800 m | ✓ exact |
| BRIDGE | E ~3 km | `{x:3050,y:390}` → bearing 83°, 3075 m | ✓ within ±30° of due E (60–120°) |
| VILLAGE-E | SE 3.5–4 km | `polar(135°, 3000 m)` | Intentional deviation, already documented in §6 (fire cannot reach 3.5–4 km; moved to reachable distance) |

No tolerance misses. **H6 re-run 23 Sep 2026** (`npm run fire:ca`, after this session's terrain
changes — added swamp coverage, more tracks): **PASS** — connected burnable patch 4960 ha (need ≥
1000), NE (phase A head) 100%, NW (cycle 9) 92%, SE (phase B) 99%.

## 13. Relief, mires and roads refined against the MML legend (23 Sep 2026)

Supersedes the generated site's relief, mire and minor-road generation from §11. Feature placement (§12) is unchanged. The
reference is the MML *Maastokartta 1:50 000 merkkienselite* (5.9.2025, `maastokartta_karttamerkkien_selite_2025.pdf`, p. 2),
with L521 as the visual example. Symbol colours were sampled from the PDF. Widths and dashes use the legend's millimetres at
1:50 000 (1 mm = 12.5 px on the 4 m/px map).

- **Relief** (`terrain.ts` `knollField`/`elevation`). Bedrock knolls up to ~34 m (soft cap) on a NW–SE grain, with flat
  peat-filled hollows between them. The knolls are damped under fields, near IGN (sand plain) and along the esker, which keeps
  its designed ~20 m prominence. In the central 10 km, 5 m contour crossings rose from 1.4 to 4.0 per km, and to 4.8 per km
  over the whole map. L521 measures ≥ 5.2 per km, a lower bound because its contours merge at 12 m/px. The central 10 km
  now spans 68.5–123.2 m (was 68.0–108.5 m), with a mean slope of 3.2% (was 1.1%). The contour interval is unchanged and
  matches the legend: *pääkäyrä* every 5 m and *johtokäyrä* every 20 m.
- **Mires**. Mires fill the knoll-field hollows, graded out toward IGN and kept off IGN and the NE ridge/SPR/birch sector.
  The legend's types are now separate: *suo, puuton* has an ochre fill; *suo, metsäinen* has a pale blue-grey fill;
  *vaikeakulkuinen* mire adds horizontal blue lines 30 m apart; *soistuma* is a pale fringe. Ditched mires (L521's dominant
  pattern) get solid *oja* lines 45 m apart, each mire in its own direction, and BOG-S keeps 20°. Over the whole map: open
  mire 6.0%, forested mire 7.9%, ditched mire 13.5%. Difficult-mire lines, soistuma and avokallio (now a plain grey-pink
  fill on knoll tops, 4.9%) are cosmetic and do not reach the fuel grid.
- **Roads** (`roads.ts`, new). Forest roads now leave existing roads roughly at right angles. They steer around water,
  mires and steep slopes, curve gently, and join other roads, so the network has junctions and loops. Side roads, *ajopolku*
  and *polku* branch off them, and each farmstead has an access road. The symbols follow the legend: II-class roads are red
  with a dark dashed centreline; III-class roads (the §4 roads R1–R3) are thin red; *ajotie* is solid black; *ajopolku* and
  *polku* are black dashes. The old brown symbols do not appear in the legend. The network has 230 km of forest road,
  107 km of *ajopolku* and 15 km of *polku*.

**Verification finding** *(resolved 24 Sep 2026: `fire:ca` now defaults to the generated grids, `24` §11)*. `npm run fire:ca` runs on `template-site.ts`, not on the generated `content/site/*.asc` grids, and
nothing in the repository loads those grids. The §12 H6 figures therefore describe the template, not the generated terrain. The
same `spreadCapacity` screen was run on the generated grids through `loadRealSite`, before and after this change:

| H6 screen | Connected patch | NE | NW | SE | Result |
|---|---|---|---|---|---|
| `fire:ca` (template), before and after | 4960 ha | 100% | 92% | 99% | PASS |
| Generated grids, before this change | 4947 ha | 99% | 92% | 99% | PASS |
| Generated grids, after this change | 4947 ha | 99% | 92% | 99% | PASS |

The result is unchanged because every mire fuel (`open_bog`, `drained_peat`) is burnable. Only `water` and `built` break the
screen, and neither changed. Within 4 km, the fuel mix shifted from pine heath 68.1% to 57.9%, drained peat 8.3% to 21.1% and
open bog 5.3% to 5.4%. This affects spread rate but not connectivity. All §12 features were re-checked at their fixed positions:
IGN is still forest and `pine_heath`; R1 still passes through (0, 400); the NE sector is unchanged (bog 4.0% → 3.8%,
spruce 44.0% → 44.2%); BOG-S is still drained peat. Georeferencing (`site-meta.json`) is unchanged.

**Additions in the same pass.** Everything below lies beyond the fire-ca burn footprint, which reaches at most ~3.5 km
from IGN. Buildings and labels moved to `places.ts`, and the fixed roads moved to `roads.ts`.

- **Iso-Hirvijärvi**: the district's big lake, in the SE corner (centre 12.3 km from IGN, r 1.5 km, level 70 m). It is cut
  by the south and east sheet edges, has bays, points and three islands, and its shores ease down over ~800 m. It is 5.4 km
  from the nearest other lake and clear of the main roads and the river.
- **Small fields**: three road-aligned parcels (4.7–6.6 ha, legend *pelto*). Two are at the new hamlet Hiekkala, and one is
  on the maantie east of Lahdenkylä. They are field-only `FARMS` entries, 4.5–6.9 km from IGN, so they fall outside the
  4 km H6 radius.
- **Southern roads**: a III-class *yksityistie* branches from the southern maantie. It runs through Hiekkala (five houses
  with outbuildings), crosses Kotkanjoki on a second timber bridge (`BRIDGE_S`, 8.6 km from IGN) and ends at cottages on
  Iso-Hirvijärvi. A second road runs from Hiekkala to cottages on Pirttilampi. Their nearest approach to IGN is 3.8 km, at
  the maantie junction. Forest roads now seed from them. Non-main road length is 128 km in the strip south of y = −4 km,
  against 160 km in the strip north of y = +4 km.
- **Road ends**: most dead ends now lead somewhere. Shore ends get a summer cottage with a sauna at the water. Other
  forest-road ends often get a house with an outbuilding, or a hunting cabin. Ends on peat stay bare. Outside 4.5 km of
  IGN, 58/100 forest-road and 34/145 *ajopolku* dead ends carry a building. The 1:50 000 legend gives residential and
  holiday buildings one symbol (dark, *asuin-, loma-, … rakennuksia*); saunas, barns and huts use *muita rakennuksia*
  (light grey, outlined). No building was added within 4.5 km of IGN. The 42 dead ends there remain bare forest-road
  endings, listed in the `map:build` log. Buildings went from 45 to 217; the 27 within 4.5 km are exactly the designed
  village and Mökkiranta.
- **H6 after the additions**: on the generated grids, 4947 ha, NE 99%, NW 92%, SE 99% → PASS. `fire:ca` (template):
  4960 ha, 100/92/99% → PASS. Both are unchanged, because the new water, fields and buildings all lie outside the 4 km
  screen radius.

**Second pass: Kotkanjoki re-traced, valleys carved, fields reshaped.** These figures supersede the counts above where they
differ. The ground without hydrography moved to `terrain-base.ts`; `terrain.ts` re-exports it and adds the water.

- **River course.** The hand-drawn river ran almost straight N–S over the new knolls. Measured along it on the DEM, it
  climbed 210 m in total, with up to 35 m of rise after a low. It is now a least-cost path over the uncarved terrain on a
  50 m grid, with cost `exp((e − 70)/6)`, so it seeks low ground. It passes Pitkäjärvi (a flat step, now 71.5 m) and the
  mires on its way, and is smoothed and gently meandered: 23.6 km for 20.0 km straight, a sinuosity of 1.18. It passes
  exactly through BRIDGE (3050, 390). Within 4.5 km of IGN it is held to the designed course (max deviation 140 m, mean
  35 m inside 4 km).
- **Flow and profile.** The river flows south → north, with the DEM's regional slope, from 80.8 m at the south edge to
  67.9 m at the north edge. Its surface is a running minimum 1.2 m below its banks. Sampled every 10 m on the DEM there
  are 0 uphill steps (largest rise 0.01 m).
- **Valley.** A carve raster lowers the terrain to water level plus a cross-profile: an 8 m channel, banks, a ~100 m
  floodplain meadow, then walls steepening outward. The river therefore always lies at the bottom of a valley a few
  hundred metres wide. Contours stop at the river's banks, as for any river drawn as an area. Where they meet it, 12 form
  V's pointing upstream and none point downstream; the other 26 meetings are the long arms of V's, which are long and narrow
  at a lowland gradient of ~0.55 m/km.
- **Brooks.** They follow the terrain downhill with the same carving. Each brook's water level sits 0.6 m below the lowest
  ground within 60 m, so no brook rides along a spur.
  - Korpioja flows through Karhujärvi, whose level drops from 74.0 to 73.4 m as a step in its profile.
  - Koivuoja's designed line crossed Korpioja; it now ends in it as a confluence. It still passes the BIRCH strip at
    2.3 km NE.
  - Two tributaries, Suo-oja and Rahkapuro, drain the wettest large mires more than 5 km from IGN.
  - On all four, the largest 10 m rise is ≤ 0.08 m (interpolation) and the worst rise after a low is ≤ 0.1 m.
  - Of 17 V-apexes on the brooks, 9 point upstream. The 8 downstream-pointing ones lie where Suo-oja skirts the toe of a
    knoll, and are that knoll's own contours.
- **Crossings and buildings.** There are 4 bridges, one wherever a main or gravel road crosses the river: BRIDGE,
  BRIDGE_S (now at (4267, −7803)), and the northern and southern maantie. R3 east is now pinned exactly through BRIDGE.
  Forest roads, tracks and paths never step over water, so there are 0 unbridged crossings. No building stands within
  120 m of the river (its valley floor), and road-end cottages go only to lake shores.
- **Fields.** Farm and village fields are now star-shaped polygons with straight edges, elongated 1.5–2.2× along an axis,
  instead of noisy circles. Lahdenkylä's fields are stretched N–S along the river valley, and each farmstead keeps an
  unfielded 80 m yard. The three small fields above remain. Fields cover 1.0% of the map (was 1.2%) and 2.8% within 4 km
  of IGN (was 3.6%). They are burnable, so H6 is unaffected.
- **Counts, before §13 → now**:
  - buildings 45 → 191 (96 residential/holiday, 95 other)
  - lake polygons 14 → 15 (+ Iso-Hirvijärvi)
  - field polygons 7 → 10
  - bridges 1 → 4
  - brooks 2 → 4
  - Buildings within 4.5 km of IGN: 27 → 27, exactly VILLAGE-E and Mökkiranta. 33 dead ends there remain bare (listed by
    `map:build`).
  - Outside that zone, 52/83 forest-road dead ends carry a building.
- **Verification (final).** H6 on the generated grids: 4945 ha, NE 99%, NW 92%, SE 99% → PASS. `fire:ca` (template):
  4960 ha, 100/92/99% → PASS, 18/25 flags. Within 4 km the fuel is 1.6% water, 0.0% built. §12 features are all at their
  template positions; the esker's prominence is 20.4 m. Typecheck is clean and 403/403 tests pass.

---

## 14. The scenario placed on the generated site (24 Sep 2026)

Until this change the demo scenario placed its ignition at the old sheet-L521 point (60.659 N, 27.275 E), about 21 km south of the generated basemap (60.76–60.94 N). Its fire, units and extent were not on the map the participant saw. The scenario is now built from the CA run on this site's own grids (`24` §11), converted through ETRS-TM35FIN. IGN is 60.8488 N, 27.3496 E, matching `site-meta.json`, and the extent is IGN ± 3.5 km. The features of §4 are bound in `18` revision (k) §k.2.

---

## 15. Road density thinned (24 Sep 2026)

The road generator (`tools/topo-map/roads.ts`) made the forest-road network about twice as dense as managed southern-Finnish forest. Near the fire, gravel plus forest roads ran at 1.6 km/km² within 3 km of IGN. Forest-road branching is now spaced 2.1–2.6 km (was 1.3–1.6 km) and tracks 1.4 km (was 1.1 km). The fixed scenario roads R1–R3, the cottage road and the peat spur are unchanged.

| Within 3 km of IGN | Before | After |
|---|---|---|
| Gravel roads (fixed) | 0.47 km/km² | 0.47 |
| Forest roads | 1.14 | 0.55 |
| Tracks | 0.50 | 0.19 |

Across the whole 20 km map, forest roads now run at 164 km (was 230 km). The map, the fuel grids and the basemap tiles were regenerated (`npm run map`). The §12 features are unchanged, and the H6 spread screen still passes at 4,945 ha.

---

## 16. The English basemap (9 Oct 2026, revision (ae))

English sessions load the same basemap with English labels: `npm run map:build` writes, beside each label of §11 and §13, its English (`labelsEn` in `content/site/build/topo-features.json`, from `app/i18n/place-names.ts` via `englishLabel` in `tools/topo-map/places.ts`; a label without an English name fails the build), and `python tools/topo-map/render.py` draws the map once and its labels twice: the Finnish onto `topo.webp` and `topo/` (byte-identical to before) and the English onto the 16 tiles of `app/render/ui/public/maps/topo-en/`. `MapView` and `FreezeMap` load `topo-en` in English sessions (`topoTileUrl`). The English labels sit at the Finnish labels' anchors in the same styles; spot heights take a decimal point. The table, with each label's position, is `18` ae.1. Both steps are deterministic: a second run writes the same bytes (verified 9 Oct 2026 by SHA-256 of all tiles). `L521.png`, the MML reference sheet, is not loaded by any session.

---

## 17. Map review panel (10 Oct 2026, revision (al))

- **§8, the Region (Alue) level** now has its "second fire in the region": the export's static `regionFires` (two fires, more than 8 km from IGN, inside the 20 km frame; `18` al.4), drawn on the live map at the Area level by the map overlay, not on the tiles.
- **§11, the generated terrain** gains three tile-only features — the W2 farm pond, the 110 kV line's 36 m cleared corridor (with a heavier line and pylon ticks), the log landing at the R2 junction — and lighter mire hatching (`12` revision (al)). `render.py` draws them from `topo-features.json` (`ponds`, `clearings`, `powerCorridorPx`); they are not in `landCover()` or the fire grids, and `npm run map:build` rewrites `content/site/*.asc` with the same content. The origin's clear-cut is not drawn (researcher decision).
- **Open (after the pilot):** F3's radio dead zone at `R1_BLACK_MID` sits on open road at ~89 m, the valley at 73–75 m (`18` al.6).

## Revision 20 Oct 2026 (ba) — the site rebuilt (`33`)

The generator of §11–§15 is replaced by `33` §4 (stages 1–6) under the geometry contract of `33` §3: every named feature keeps its relations to IGN and to the scenario (0 violations, `npm run map:check`). The basemap follows the researcher's Karttapaikka examples (`33` §9) except that public roads are cased, not red (`33` (ba)). The power line is a 20 kV distribution line with a 10 m corridor (`33` (bc)); the main road crosses one mire on an embankment ≤ 650 m (`33` (bb)). Evidence: `docs/audits/2026-10-20-map/`.
