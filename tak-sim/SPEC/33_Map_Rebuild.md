# 33 — Map rebuild: a credible south-east Finnish site for the scripted fire (SPARC)

**Status:** Governing from 20 Oct 2026 for the generated site (`23` §11–§17), its fuel and elevation grids, the fire's re-run on them and the checks of everything that depends on the map. Where it conflicts with `23`, `18` §5 or `24`, this document wins; each gets a revision note.
**Scope:** Specification, pseudocode, architecture, refinement gates and completion of the rebuild. Researcher instruction of 20 Oct 2026: "remove the map and create it again with the skills and tools … realistic from a topographical map point of view … firefighters should not find illogical flaws … then check unit positions and other variables." Run as a ruflo-coordinated swarm (§6).

---

## 1. Decisions (answered on the researcher's instruction "answer those questions yourself")

| # | Question | Decision | Why |
|---|---|---|---|
| a | Real searched site or fictional terrain | **Fictional, calibrated to the south-east Finnish inland landscape** (Kymenlaakso–South Karelia, IGN at ETRS-TM35FIN 519 000 E, 6 746 000 N as now) | No recognition risk; the order of battle (`18` §8.1) stays valid; MML, Luke and Paituli hosts are blocked from this environment |
| b | Keep the scenario's spatial story or re-author it | **Keep it.** The map is re-fitted to the story (§3 contract) | Every freeze key, premise, panel key, radio text and source-memory fact stays valid; re-keying would reopen the expert panel |
| c | Data | **Offline**, from documented rules: the MML 1:50 000 legend already encoded in `23` §13 and `render.py`, the landscape rules of §2.3, the fuel classes of `24` | No network to Finnish geodata; thresholds are planning values for the domain reviewer to confirm (§5 gate R) |

"Realistic feeling, not 100 % realistic": the target is that a Finnish fire officer studying the map for an hour finds no illogical feature. Exact statistics matter less than the absence of tells.

## 2. Specification

### 2.1 Flaws of the current map that must go (seen 20 Oct 2026)

1. A straight-sided road rectangle around the fire area, and roads running straight through mires (Iso-Rahkasuo).
2. The main river (Kotkanjoki) ruler-straight N–S in an artificial parallel-contour canyon; Koivuoja a straight line.
3. Mires as a triangle (Rahkasuo), a near-circle (Iso-Rahkasuo) and cloud-like noise everywhere else; drained mires without ditches.
4. Fields as convex blobs, not rectangular parcels with field ditches.
5. A visibly smoothed, featureless fire area against noisy surroundings; isolated round lakes with no inlet or outlet; concentric artificial contour ellipses (Kuivakangas).

### 2.2 Invariants

EPSG:3067; the 20 × 20 km extent and three zoom levels; IGN's position; shared ids (cycle, fact, unit, segment, sector); the fire's authored rates and timeline (`24`); the open loop; identical stimulus; parity; the place names in the scenario's texts (new names only for unnamed features); deterministic build (fixed seed, integer-hash noise, no `Math.random`).

### 2.3 Realism rules (testable; planning values, domain reviewer confirms)

| Theme | Rule | Check |
|---|---|---|
| Relief | Glacial moraine terrain: relief within ±10 km about 60–110 m; 5 m contours (2.5 m auxiliaries in flat ground); landforms elongated NW–SE (ice flow), no concentric ellipses | `realism_report`: relief range, slope histogram, contour shape index |
| Eskers | Honkaharju and Kuivakangas as long, narrow sandy ridges (2–6 km, 10–25 m high, NW–SE) carrying pine heath, a road along or across the crest | ridge length, height, fuel class on crest |
| Water | Streams flow downhill with monotone surfaces, meander on flat ground, straight only where ditched; every lake larger than 5 ha has an outlet; streams join lakes or the river; no uphill flow, no sinks except lakes and mires | `hydro_check`: 0 uphill segments, 0 orphan lakes, 0 sinks outside lakes and mires |
| Mires | In flat lowlands and basins (slope < 2 %), irregular lobed outlines, open bog centres with pine-bog margins; drained mires carry a parallel ditch grid (≈ 40–60 m spacing) ending in a main ditch to a stream; mire share of land 15–30 % | shape compactness and convexity limits; ditches present on every drained mire; share |
| Fields | Rectangular parcels (≈ 50–150 m wide, 100–500 m long) on low flat mineral or clay ground near the village, farms and water; field ditches along parcel edges; a farm road to each field block | parcel rectangularity; distance to settlement and water |
| Forest and fuel | Pine heath on eskers and dry sand; spruce on moraine slopes and fertile lowland; mixed and young stands and recent clear-cuts at plausible shares; fuel follows soil and relief (`24` classes) | fuel × landform table |
| Roads | Hierarchy: the maantie, gravel roads, forest roads (metsäautotie) branching at near right angles, tracks; roads keep to firm mineral ground, cross mires only on a short straight causeway and water only at a bridge or culvert; no closed rectangles, no road through a lake or across open bog lengthwise; dead ends at turning places | `road_check`: 0 water crossings without a bridge, mire length per road below a limit, hierarchy connectivity |
| Settlement | Houses along roads, at field edges, cottages on lake shores with a track; the village at a road junction near fields and water | building rules |
| Infrastructure | The 110 kV line as a straight cleared corridor with towers, crossing roads at an angle; firebreak value of roads, ditches and the corridor consistent with the fire texts | geometry |
| Cartography | MML-style colours and symbols; fi/en labels (`23` §16); legible at the three zoom levels; no label or symbol overlaps at the scenario's key places | `cartography-geoviz` review, screenshots |

## 3. The geometry contract (stage 0, before any terrain)

Extract every feature and relation the study depends on into `content/site/contract.json`:
- features: IGN, Kotkanjoki and its bridge, Koivuoja, Korpioja, R1, R2, the Honkaharju forest road, Lahdenkylä, Mökkiranta, Karhujärvi, Haukilampi, Rahkasuo, Iso-Rahkasuo, Kuivakangas, Kuusimäki, the 110 kV line, the command point, water draw and scoop points, sectors and their boundaries, unit start points and routes;
- relations: distances, bearings, "ahead of the fire", road-to-front distances, arrival times, everything quoted by freeze and SPAM items (`08`), the premise-evidence table, radio and situation texts, panel keys V8–V14, source-memory facts.

Each entry carries its tolerance and the files that use it. `contract_check` proves every keyed text and item maps to an entry and that the built map meets every relation.

## 4. Pseudocode (stages; each deterministic, input → output → skill → check)

0. Contract: scenario texts, items and keys → `contract.json` + `contract_check` (current map must pass first).
1. Terrain: glacial base (NW–SE drumlin and esker field, rock knolls, basins) → DEM 25 m and 4 m render surface → `terrain-hydrology` → realism_report (relief).
2. Hydrology: depression filling, flow accumulation, river and brooks traced on it, lakes in basins with outlets, monotone surfaces, carved valleys without parallel-contour canyons → `terrain-hydrology` → `hydro_check`.
3. Mires and soil: wetness index → mire polygons (lobed), drained subset with ditch grids; soil map (sand on eskers, clay in valleys, moraine elsewhere, peat) → `geo-data-engineering` → shape limits, share.
4. Land cover and fuel: soil × relief × management → forest types, fields (rectangular parcels near the village and farms), clear-cuts → `24` fuel grids (truth and machine) → `geo-data-engineering`, `spatial-statistics` → fuel × landform table.
5. Roads, buildings, power line: rules of §2.3 grown over the new ground, the scenario's named roads placed to the contract → `geo-data-engineering` → `road_check`.
6. Contract fit: place IGN and named features to satisfy §3 within tolerance; if impossible, stop and report the failing relation.
7. Fire re-run: the cellular automaton on the new grids, calibrated to the authored rates, perimeters and spot fires to the timeline → `wildfire-fire-behaviour-check` → fire_check 0 LIKELY_ERROR.
8. Units and logistics: unit positions on reachable ground, travel times on the new road graph against the radio's arrival times, water draw points and scoop lakes, LACES, safety zones → `wildfire-tactical-check` → tactical_check.
9. Texts and items: place and distance mentions in radio and situation texts → `wildfire-radio-realism`; freeze and SPAM keys (map items, distances) → `wildfire-sagat-probes`; panel options if a posture key moved → `wildfire-coa-authoring`; parity → `wildfire-scenario-pipeline` parity_check.
10. Render: fi and en basemaps, MML style → `cartography-geoviz` → screenshots at the three zoom levels.

## 5. Architecture and refinement gates

- `tools/topo-map/`: one module per stage; outputs versioned with sha256 in a manifest; the old map is archived under `content/site/archive/2026-10-20/` and deleted only after every gate passes.
- New checks: `tools/topo-map/checks/{contract,hydro,road,realism}.ts`, run by `npm run map:check` and in CI.
- Gates: **A** terrain (realism_report, hydro_check 0) · **B** fire (fire_check 0 LIKELY_ERROR) · **C** tactics (tactical_check: every placement feasible or accepted in writing) · **D** content (contract_check 0, parity_check 0, every re-keyed item listed old → new) · **R** review (a reviewer agent on the diff; a firefighter-eye checklist for the domain reviewer; screenshots).

## 6. Execution (ruflo swarm)

Hierarchical swarm (`swarm init --topology hierarchical --max-agents 8 --strategy specialized`), the integration owner (this session) holds the shared manifests and lockfiles. Writing agents get isolated worktrees and non-overlapping files:

| Agent | Stages | Files |
|---|---|---|
| contract | 0 | `content/site/contract.json`, `tools/topo-map/checks/contract.ts` |
| terrain | 1–6 | `tools/topo-map/*.ts` (terrain, hydrology, soil, land cover, roads, places, build) |
| cartographer | 10 | `tools/topo-map/render.py`, legend and style |
| fire | 7 | `tools/fire-ca/**`, `content/site/build/fire-ca.*` |
| tactics-content | 8–9 | `app/scenario/**`, `content/**` texts and items |
| reviewer | R | read-only |

Order: contract → terrain (cartographer in parallel on style) → fire → tactics-content → reviewer → integration and CI.

## 7. Completion

`npm run ci` green; `npm run build:web`; screenshots of both basemaps at three zooms in `docs/audits/2026-10-20-map/`; `23`, `18` and `24` carry revision notes; the panel packet regenerated if any key moved (`npm run review:panel`); `11` lists what needs a person (the domain reviewer's realism sign-off, any re-keyed item for the panel).

## 8. Open-source adoptions (research of 20 Oct 2026; licences verified from each repo's LICENSE, `docs/audits/2026-10-20-map-oss-licences.txt`)

Only MIT, BSD, ISC, Apache-2.0 or CC0 code is ported or depended on; GPL/AGPL work is read as papers only. Ported code keeps its notice (Apache-2.0 also a NOTICE entry).

| Stage | Adopt | How |
|---|---|---|
| 1 Terrain | Own NW–SE drumlin and esker ridge functions; distance-field ridges after redblobgames/mapgen4 (Apache-2.0) | idea / port |
| 2 Hydrology | Priority-Flood (Barnes et al. 2014, from the paper); `mourner/flatqueue` (ISC); mapgen4 `assignDownslope`/`assignFlow`; Azgaar Fantasy-Map-Generator (MIT) lake-outlet search (`lakes.ts`) and depression resolution | write / depend / port |
| 3 Mires | Topographic wetness index and height above nearest drainage after makepath/xarray-spatial (MIT) `twi_d8`, `hand_d8`: mire where TWI high, HAND < ≈ 1.5 m, slope < 2 %; own ditch grids; `mapbox/polylabel` (ISC), `simplify-js` (BSD-2) | port / depend |
| 4 Land cover | Oriented-box field parcelling after stavguo/obb-parcelling (MIT); fuel classes after the Pelastusopisto MAST report and the CFFDRS FBP fuel types (reference) | port / reference |
| 5 Roads | Azgaar `routes-generator.ts` cost function with road reuse and the Urquhart skeleton; `anvaka/ngraph.path` (MIT) A* on a slope, mire and water cost grid | port / depend |
| 7 Fire | xiazeyu/PyTorchFire (MIT), the same Alexandridis model made differentiable, offline to calibrate parameters to the authored perimeters; xarray-spatial `fire.py` to cross-check the flame table | tool / port |
| 8 Logistics | OSM water-point attribute model (`emergency=suction_point`, `fire_water_pond`, `water_tank`) as facts | schema |
| 10 Render | MML maastokartta raster documentation (reference) for colours and symbols; openstreetmap-carto symbols (CC0); `d3-contour`, `delaunator` (ISC) | reference / depend |
| Checks | xarray-spatial and WhiteboxTools (MIT) as independent hydrology checks in `hydro_check` (pinned versions), so the check does not merely confirm our own algorithm | tool |

Not used: richdem, pysheds, fastscapelib, Cell2Fire, ForeFire, cffdrs, WISE and FireSTARR (as code), ELMFIRE, pyretechnics, FreeTAKServer, ATAK-CIV, OpenFireMap rules (GPL, AGPL, CC BY-SA, non-commercial or unverified licences); fluvial-erosion terrain generators (non-glacial look).

**For the domain reviewer:** IGN's nominal position (≈ 60.84 N, 27.35 E) lies near the First Salpausselkä around Kouvola–Luumäki. The site is fictional, but a local officer would expect that ridge; either keep the extent free of a Salpausselkä-sized ridge and say the site is fictional, or move the nominal CRS anchor north of it (no change to local geometry).
