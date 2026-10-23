# Proposal (c, d), 23 Oct 2026: a map-reading pretest, practice map tasks and map clarity

**Status:** DRAFT; it belongs to `proposal.md`. It is identical for both groups and names nothing in the incident.

## (c) Map reading: pretest and practice tasks

### c.1 Why

- Eleven scored freeze items need the map (`audit.md` §4.2): five are points placed on the blank basemap, and the others need a distance by scale bar, a slope, or which feature lies where.
- Firefighters read topographic maps less often than soldiers, and novices may not read them at all.
- A short pretest gives the analysis a **covariate** for these items, and lets the panel see whether a low score explains a map item's floor. It is never fed back to the participant, and it is never an exclusion criterion.

### c.2 The pretest: 5 items (+1 optional) on a neutral extract

**The extract.**
- **Recommended:** a second render of the same generator with another seed, cropped to 2.5 × 2.5 km. Same style, terrain the participant never sees.
- **Cheaper:** a crop of the study basemap far from the incident: `app/render/ui/public/maps/topo.webp`, pixels x 4375–5000 and y 0–625 (TM35 E 526 500–529 000, N 6 753 500–6 756 000). That is about 9 km north-east of the point of origin, outside the incident extent and outside every key, record and item. It holds Kaitajärvi (a named lake), drained and open mires with ditches, field parcels, houses, a cased main road, forest roads and tracks, the power line, and 5 m contours. Kaitajärvi appears in no record, item or radio text: only in the place-name list (`place-names.ts`).
  - The crop is visible at the live map's widest zoom (20 km), but nothing there is relevant to the incident.
  - The pretest comes before VP, so it cannot cue the session.
- **Same look as the session:** the same palette and type (`render_style.py`), the English labels from `topo-en` in English sessions, a scale bar (0–500 m) and a north arrow.

**The overlay drawn on the pretest image only:**
- a 4 × 4 grid of 625 m squares labelled A–D (columns) and 1–4 (rows);
- point marks 1, 2, A, B and ★;
- an area mark X.

**The build.** A tool, `tools/review/map-pretest.ts` (to be written; tools only), reads `content/site/build/topo-features.json` and `content/site/elevation.asc`. It places the marks by the rules below and writes three outputs: the image, the item texts and a key file. **Keys are computed, never typed.** Each key must keep a margin: a distance at least 30 % from the other options, a slope ratio of at least 2, and a nearest-water gap of at least 40 %. Otherwise the build fails and the marks move.

| # | Skill | Stem (en / fi DRAFT) | Options (the key is computed; draft key from a visual check of the crop) | Mark rule |
|---|---|---|---|---|
| P1 | Find a named place | In which square is the southern end of Kaitajärvi? / Missä ruudussa on Kaitajärven eteläpää? | B2 · C3 · **D4** · A1 | The lake polygon's southernmost vertex; the distractors are other squares the lake or its name touches |
| P2 | Steeper slope | Which slope is steeper, at 1 or at 2? / Kumpi rinne on jyrkempi, kohdassa 1 vai 2? | 1 · 2 · Equally steep · The map cannot tell | Two points on slopes whose gradients (elevation grid) differ by a factor of ≥ 2; key = the steeper |
| P3 | Nearest water | Where is the nearest place to draw water for a pump at ★? / Mistä ★:n kohdalla lähimmin saisi vettä pumpulle? | the lake · the brook · the pond · No water within 1 km | ★ on a house; the nearest open water (lake, pond, brook) by straight line; the second nearest ≥ 1.4 × farther |
| P4 | Recognise a mire | What does area X show? / Mitä alue X esittää? | **A drained mire** · A field · A lake · A clear-cut | X on a drained-mire polygon with its ditch grid |
| P5 | Distance with the scale | How far is it in a straight line from A to B? / Kuinka pitkä on linnuntie A:sta B:hen? | 300 m · 600 m · 1 200 m · 2 000 m (ascending) | A and B on two features (a house and a road junction) whose distance is within ±10 % of one option |
| P6 (optional) | Direction | In which direction is the lake from A? / Missä suunnassa järvi on A:sta? | North-east · South-east · South-west · North-west | The bearing from A to the lake's centroid, ≥ 20° from a sector boundary |

**Administration.**
- **When:** after the background questions, before VP, in both groups (experts and the public).
- **Time:** 4 minutes in all. The image stays visible, there is no confidence item and no feedback. The items are in fixed order (P1–P6) and the options in the order shown above.
- **Logging:** a new record kind, `pretest_item_submitted {itemId, choiceId, rtMs}`, and `pretest_completed {timedOut}`. The key lives in the analysis only, as every key does.
- **Score:** 0–5 (or 0–6), used as a covariate:
  - on the map-dependent items (`items.csv` `map_dependence` = required or helps), item-level;
  - on map-point error (`haversineMetres`).
- **Before use:** two people check the key file against the image. Pilot it with 5 novices; an item answered correctly by every one of them is too easy and gets new marks.

### c.3 Practice-view map tasks (VP only, with feedback)

1. **The head mark, with feedback (the practice freeze's `head_now`).** After the practice freeze, the feedback screen (`proposal.md` b.3) shows the blank basemap with the participant's mark and the true head, the drawn W2 fire outline, and one line:
   - en: "The head is the fire's front furthest downwind. Your mark is shown in blue, the head in red. On the blank map you place it by the roads and terrain around it."
   - fi: "Kärki on palon myötätuulen puoleisin reuna. Merkintäsi näkyy sinisenä, kärki punaisena. Tyhjälle kartalle sijoitat sen ympäröivien teiden ja maaston avulla."
   - Logged: `practice_feedback_shown`.
2. **Measuring a distance (a second practice SPAM item, under the same "ready" as the first; `probe.s.practice.b`).**
   - **Stem:** "Kuinka kaukana palosta on R3:n silta (Kotkanjoki)? Voit mitata Mittaa-työkalulla tai mittakaavajanalla." / "How far from the fire is the R3 bridge (Eagle River)? You can measure with the R&B tool or the scale bar."
   - **Options (ascending):** about 1 km · **about 3 km** · about 5 km · about 8 km.
   - **Key:** about 3 km (computed: the bridge `BRIDGE_W3` is ~3.06 km from the point of origin and ~2.8 km from the W2 head). No VP record states this distance.
   - **Feedback (practice only):** "R3:n silta on noin 3 km palosta itään. Mittaa-työkalu: valitse Mittaa ja napauta kartalta kahta kohtaa." / "The R3 bridge is about 3 km east of the fire. The R&B tool: choose R&B and tap two points on the map."
   - **Why this distance:** the bridge is a labelled feature, and no scored item asks its distance (V14's `infra` asks its load limit, from pushed records). Measuring it teaches the tool, not the situation.

## (d) Map clarity changes (identical for everyone)

| # | Change | Where | Cost | Effect / caution |
|---|---|---|---|---|
| d1 | **Overlay labels larger**: sector codes and road labels from 9 px to 11–12 px, with a light halo | `OVERLAY_FONT_PX`, `map-overlay.ts` | **Cheap** (a constant; screenshot check) | Readable on laptops; the 600 m clearance test (`map-overlay.spec.ts`) still applies |
| d2 | **Sector labels with names**: "L1 Pohjoinen", "L2 Koillinen", "L3 Etelä", "L4 Länsi" (en North, North-east, South, West) | `map-overlay.ts` | **Cheap** | The tour already gives these names; items ask by sector (V4 `fastest_spread`, V7 `rekindle_sector`) |
| d3 | **Water points W1–W3 labelled** (a small blue "W1 Haukilampi" mark) | `map-overlay.ts` (they were removed in revision (am)) | **Cheap**, but it **reverses a researcher decision** (RC) | The radio names them and the infra items ask about them (VP, V4 W1, V7 W3). Labelling them takes away a map search that measures nothing in the study. The items ask availability, not location, so no key moves. |
| d4 | **Settlement labels in the overlay**: "Mökkiranta (loma-asuntoja)", "Lahdenkylä" | `map-overlay.ts` | **Cheap** | They are on the basemap already; the overlay makes them legible at every zoom. They are values the items ask about (V7, V10, V12), so it should be the same for everyone, as it is. |
| d5 | **The Measure (R&B) tool taught in the tour**: a step after `zoom`, "Mittaa: napauta kahta kohtaa, niin näet etäisyyden ja suunnan" / "R&B: tap two points to see the distance and bearing" | `tour.ts`, `ui.ts` | **Cheap** | The tool exists (`RangeBearingPane`) and is logged (`tak_rb_measured`), but no tour step names it |
| d6 | **The freeze map gets the static reference overlay** (sector outlines, road labels, CP), never the fire or the units | `FreezeMap.tsx` | **Cheap** in code; a **measurement decision** (RC) | Map points then test spatial memory of the fire against named references, not basemap literacy. The keys and tolerances stay; difficulty falls (for V12 `head_now`, the map points of V2, V5 and V10, and the `head_later` items). Decide before pilot 2. |
| d7 | **An optional simplified operational layer**: a toggle in the Overlay Manager that greys contours, ditches and small tracks to 30 % and keeps roads, water, settlements, sectors and the fire at full strength | a second tile set from `render.py` with a "simplified" style flag; `OverlayManagerPane.tsx` | **Medium** (a second render, a toggle, its logging `layer_toggled`) | Helps novices find the incident's features. It is optional and logged, and its use is a covariate. Everyone sees the same default, so parity holds. |
| d8 | **Hectares and distances stay off the map** | — | — | Printing areas or distances would change the report-keyed items' lures and keys. Use records instead (`proposal-items.md`). |

The cheap set is d1, d2, d4 and d5, and it can go into the next build. d3 and d6 need a researcher decision before pilot 2. d7 waits until pilot 2 shows whether the map-dependent items stay at the floor for novices.
