# Content on the rebuilt map: what changed (SPEC/33 stages 8–9, gate D)

20 Oct 2026, the tactics-content stage. Base: `128ec68` (the fire re-run on the rebuilt grids). Skills used: `wildfire-sagat-probes`
(re-keying), `wildfire-tactical-check` (positions, LACES, `tactical_check.py`), `wildfire-radio-realism` (every text touched),
`wildfire-scenario-pipeline` (`parity_check.py`, gates). Every Finnish text below is a DRAFT for the native-speaker check; every key
for the domain reviewer and, where marked, the expert panel.

Rules kept for every re-key: the key comes from the delivered reports; bands keep their margins (V2 and V5 area 2 / 5 ha, V10 area
2.5 ha, distances 50 m, V14 retired band 40 m); the 1.3× option-length rule holds (`freeze-items.spec.ts`); no key sits on a band edge
(`bandOf` throws below the margin); a report's time, call sign and channel are unchanged unless the fire forced a new figure; the same
fact reaches both groups in the same step (`parity_check.py`, below).

## 1. Freeze items and probes

| File / id | Old → new | Why |
|---|---|---|
| `freeze-bank.ts` V2 `area_40` (L3) | bands 15/25/35 → **20/35/50**; key `m15_25` → **`m20_35`**; options "Alle 20 / 20–35 / 35–50 / Yli 50 hehtaaria" | reports' extrapolation 24.8 ha sat 0.2 ha from the 25 edge; now 24.8 (margin 4.8) and the truth 29.7 (5.3) share 20–35; lures: map now 13.7 ha, DR3 14.15 survey 18.3 ha (both under 20) |
| `freeze-bank.ts` V5 `area_hour` (L3) | bands 80/110/140 → **90/140/190**; key `m110_140` → **`m140_190`** | the 15.35 survey (76.4 ha + 3 × 35.8) gives 183.8 and the truth 148.3, both in the open top band (no key statements); now margins 6.2 / 8.3; map now ~77 ha under 90 |
| `freeze-bank.ts` V5 `infra` (L1, R1) | key `open` → **`with_care`** | DR2's 15.27 report now reads "palo noin 10 m tiestä — matalaa paloa tien reunassa (liekit alle 0,3 m), ajettavissa varoen" (was "palanut alue … ei liekkejä, ajettavissa") |
| `freeze-bank.ts` V5 `lines_breached` (L2) | prompt "Mitä metsäautotien ja Korpiojan ylitykset merkitsevät palon rajaamiselle?" → **"Mitä Korpiojan ylitys merkitsee palon rajaamiselle nyt?"**; key "Tie ja oja eivät enää rajaa paloa" → **"Korpiojan takana palaa uusi palo, jota kukaan ei sammuta"**; distractors → "Ylityskohta on jo sammutettu, ja Korpioja rajaa palon", "EK11 pitää ylityskohdan Koivuojan linjaltaan käsin", "Uusi palo sammuu itsestään ojan kosteaan rantaan"; key atoms: Korpioja crossing (radio 7.1) + EK11 15.25 | the Kuusimäki forest-road crossing no longer exists (no forest road on the crown run's path); the item now relates the one crossing to where the crews are, and says nothing about Koivuoja (`road_jump` asks it) |
| `freeze-bank.ts` V5 `road_jump` (L3; slug kept) | prompt "Pitääkö Kuusimäen metsäautotie palon muualla …" → **"Pysäyttääkö Koivuoja palon etenemisen seuraavan 40 minuutin aikana?"**; options → "Ei, kipinät lentävät ojan yli ja sytyttävät uuden palon" (key `again`), "Ei, palo ryömii ojan yli matalana pintapalona", "Kyllä, kosteat rannat pysäyttävät palon ojaan", "Kyllä, EK11:n linja ojan varressa pitää palon"; basis records: Koivuoja stop (7.2, the lure) + Korpioja crossing (7.1) | the second Kuusimäki-road crossing is gone; on the new fire the surface fire stops at Koivuoja at 15.00–15.20 and embers cross it at 15.20–15.40 (radio 8, pushed in V6) |
| `freeze-bank.ts` V2 `ek11_between` (L2) | key unchanged; key atom regex "olemme kärjen **vasemmalla** sivustalla" → "**oikealla**"; basis "~150 m" → "~100 m", "left flank" → "right flank" | on the new esker EK11's crew stands on the head's right (south-east) flank, ~130 m south of the new ignition |
| `freeze-bank.ts` V2 `south_flank` (L2) | key unchanged; key atoms → EK12 13.20 (head ~300 m north) and EK12 14.08 (flames 1–2 m, 680 m line, pressure enough) | the step-3 "lipsuu paikoin" / "kärki etenee … meidän ohi" reports are now step-2 recorded records |
| `freeze-bank.ts` V5 `hose_short` (L2) | key atom "linjaa jo **500** m" → "**600** m" | EK11's hose line is longer on the new ground |
| `freeze-bank-b.ts` V10 `area_total_hour` (L3) **panel view** | bands 129/138/148 → **143/155/167**; key (`gt148`, rejected) → **`m155_167`** | reports 158.2, truth 163.8 (margins 3.2 / 3.2); lures: map now ~154 ha, DR3 17.35 survey 153.6 ha (143–155) |
| `freeze-bank-b.ts` V10 `front_r2_80` (L3) **panel view** | bands 400/700/1000 → **350/650/950**; key `m700_1000` → **`m650_950`**; options "Alle 350 / 350–650 / 650–950 / Yli 950 metrin päässä" | truth 746 m sat 46 m from the 700 edge; now reports 869 (margin 81), truth 746 (96); "runsaan kilometrin" (~1.3 km) the lure over 950 |
| `freeze-bank-b.ts` V14 retired `se_front_r2` band | 150/450/650 → **150/400/650**; `m450_650` → **`m400_650`** | 487 m sat 37 m from 450 (needs 40); now 87 |
| `freeze-bank-b.ts` V14 `se_front_r2` (L3) **panel view** | key `not_yet` unchanged; records KY21 19.52 + EK11 19.43 → **KY21 19.47 + OUT1 19.52**; trigger from KY21's own line (was EK11's); nearest 550 → **500 m**; rate 10.1 → **11.5 m/min**; at 20.20 ~270 m vs trigger 100 m | EK11's step-20 "ei omaa reunaa, palo … m länteen" is no longer generated (it reports the cancelled burnout) |
| `demo-probes.ts` V12 `f7` (L2) **panel view** | prompt "Mitä 110 kV voimajohdon tila merkitsee sammutustyölle johdon lähellä?" → **"Mitä 20 kV:n sähkölinjan tila merkitsee sammutustyölle linjan lähellä?"**; options and key `live` unchanged | SPEC/33 (bc) |
| `demo-probes.ts` SPAM V3 (L1) | key "Noin 18 ha" → **"Noin 24 ha"**; scale 10/18/25/35 → **14/24/35/45 ha** | DR3 14.35 survey 24,3 ha (was 17,8); stale lure the 13.55 survey 13,8 ha |
| `demo-probes.ts` SPAM V3.b (L2) | key "Kiihtynyt, uutta alaa lähes kaksi kertaa enemmän" → **"…noin kolmanneksen enemmän"**; distractor "Hidastunut, uutta alaa noin puolet vähemmän" → **"…noin kolmanneksen vähemmän"** | 4,4 → 6,0 ha new (was 2,6 → 4,8) |
| `demo-probes.ts` SPAM V6.b (L2) | key "Paloa on taas tien reunassa, ajettavissa vain varoen" → **"Ei muutosta, matalaa paloa tien reunassa, ajettavissa varoen"**; distractor "Ei muutosta, tie on yhä ajettavissa ilman paloa" → **"Liekit ovat voimistuneet, ajo ei ole turvallista"** | both latest DR2 R1 reports (15.27, 15.47) now say low fire, with care |
| `demo-probes.ts` U backup (V14) | "…DR2: kaakkoisrintama etenee noin 10,1 m/min" → **11,5**; "DR3: palanut ala noin 17,8 ha (klo 14.35) — SPOT: … noin 140 ha" → **24,3 ha … 160 ha** | the records' figures |
| `source-memory.ts` `head_rate_1420` | "10,6 metriä minuutissa" → **10,8**; record "210 m" → **220 m** | DR1 14.25 |
| `source-memory.ts` `pp3_600` → **`pp2_560`** | "Pistepalo PP3 … noin 600 metriä" → **"Pistepalo PP2 … noin 560 metriä"** | the crown run throws two spot fires now (PP1 270 m, PP2 560 m) |
| `branch-statements.ts` V3, V4 (withdrawn Type J, still built) | V3 "S, 100 m" → **"SW, 100 m"**; V4 "new front" → **"NE, 600 m"** (true), "60 ha" → **"100 ha"** | V3's south was grey (101 m); V4's spots merge by 15:20 (grey by construction) and 45 ha was grey for 60 |

**Directive keys (panel, V8–V14).** The posture coding (`aligned`, `sound`, sectors, `fit`, `soundSecondary`) is unchanged. V8 gains a pushed basis record (VPK 16.42 "pidämme reunaa käsityökaluin") because EK12's 16.42 line is now recorded, and its basis text says so. Computed basis figures moved: V10 "0.9 / 0.9 / 0.89 ha" → **1.0 / 1.0 / 0.97 ha**; V11 "7.9 m/min (160 m) and 4.5 m/min (90 m)" → **7.6 (150 m) and 4.0 (80 m)**; V13 DR2 19.05 **11,5 m/min** (was 10,1); V14 the flare-up's polygon **0.15 ha at 19:20 and 0.36 ha at 20:00** (was 0.21 / 0.26). At 20:00 (not drawn: V14's map is step 19's) the flare-up's outline touches L3 by one vertex where L1, L3 and L4 meet at the origin; the key's sectors (L1, L4) are read from step 19 and are unchanged.

**The panel packet was regenerated** (`npm run review:panel`, gitignored `review-packet/panel/`): V10's two L3 keys moved, V14's `se_front_r2` basis records changed, F7's prompt and the directive bases changed, and every view's record set changed with the regenerated corpus (V8 530, V9 588, V10 634, V11 728, V12 827, V13 890, V14 1002 records).

## 2. Texts (radio, story, situation records)

| File / record | Old → new | Why |
|---|---|---|
| `demo-story.ts` `atom.demo.1.1` (DR1 13:20) | "…noin **30** m tien pohjoispuolella" → "noin **50** m" (+ English) | the 13:20 head is ~45–53 m past R1 |
| `demo-story.ts` `atom.demo.2.0` (DR1 13:40) | "…noin **400** m päässä, alkaa tiheä kuusikko (Kuusimäki)" → "noin **500** m" (+ English) | along the head's line the continuous stand begins ~550 m ahead of the 13:40 head (fuel grid traced every 25 m) |
| `demo-story.ts` `atom.demo.3.0` (EK11 14:0x) | "Uusi savu Kuivakankaan harjulla, noin **150** m kärjestä" → "noin **100** m" (+ English) | the RIDGE ignition is 100 m ahead (fire stage) |
| `deployment.ts` EK11 14:05 (recorded) | "uusi palo harjulla noin **150** m kärjen edessä. Hyökkäämme siihen **pohjoissivustalta**" → "noin **100** m … **eteläsivustalta**" (+ English) | the crew is ~130 m south of the ignition on the head's right flank |
| `deployment.ts` KY23 19:21 (pushed) | "savua ja pientä liekkiä noin 120 m pohjoiseen, uran itäpuolella, autolle menevän reitin vieressä. Perääntymistie autolle länsikautta, kaikki tallessa." → **"savua koillisessa noin puolen kilometrin päässä, uran itäpuolella EK14:n linjan suunnalla. Meidän kohdallamme ei paloa, kaikki tallessa."** (+ English) | the holdover is ~545 m NE of KY23's crew (~260 m from EK14's), nowhere near its way to the truck; at that range a crew sees smoke, not flame |
| `deployment.ts` new KY21 15:07 (recorded) | — → "KY21: eteläsivustalla latvapalo menee meistä koilliseen ohi. Työskentelemme palaneen reunasta, perääntymistie palaneelle alueelle, tähystäjä seuraa kärkeä. Kaikki tallessa." | crew-safety: 3 m from the crown run's burning edge |
| `deployment.ts` new VPK 15:47 (recorded) | — → "VPK: tuulen kääntyessä reuna lähti kohdallamme liikkeelle. Siirryimme palaneelle alueelle, perääntymistie palaneen kautta autolle. Vahvuus tarkistettu, kaikki tallessa." | crew-safety: the backed wind runs the mop-up edge over VPK's stretch (overrun) |
| `deployment.ts` new KY21 16:47 (recorded) | — → "KY21: pohjoisreunalla me ja VPK olemme reunassa kiinni, etelätuuli painaa reunaa meitä kohti. Työskentelemme palaneen reunasta, perääntymistie palaneelle alueelle, tähystäjä nimetty, kaikki tallessa." | crew-safety: both crews within 10 m of the burning north edge, downwind in the southerly |
| `deployment.ts` VPK 14:42 water trip (recorded) | generated "VPK: lähdemme täyttämään vettä, Haukilammelle, vesipiste W1; … Poissa linjalta noin **20** min, palaamme noin **15.01**." → authored (`said`) "… Poissa linjalta noin **30** min, palaamme noin **15.10**." (+ English) | road route from VPK's truck (Honkaharju road) to W1 is 6.2 km one way on the rebuilt road graph: 27.6 min round trip at 450 m/min before filling |
| `designed-events.ts` `f7.grid_record` | "Verkkoyhtiön käyttökeskus: 110 kV voimajohto palon itäpuolella … Johdon poiskytkentää on pyydetty …" → **"Alueen verkkoyhtiön käyttökeskus: 20 kV:n sähkölinja palon itäpuolella on edelleen jännitteinen. Linjan poiskytkentää on pyydetty, tieto kytkennästä annetaan erikseen. Toistaiseksi turvaetäisyydet voimassa."** (+ English "The local distribution company's control centre: the 20 kV power line …") | SPEC/33 (bc): the regional distribution company owns a 20 kV line |
| `designed-events.ts` `f7.planted_record` | "110 kV linja jännitteetön, vahvistettu." → **"20 kV linja jännitteetön, vahvistettu."** (+ English) | H9's logic unchanged: the log says de-energised and confirmed; the company's own record says only requested |
| `designed-events.ts` `f7.heli_line_clearance` | "Reitti kiertää 110 kV voimajohdon … johdon päälle" → **"Reitti kiertää 20 kV:n sähkölinjan, pysymme reilusti erossa johtimista emmekä pudota vettä linjan päälle."** (+ English) | 20 kV |
| `labels.en.json` `VERKKOYHTIÖ` | "Grid company" → **"Distribution company"** | the owner is the local distribution company, not the national grid operator |
| `study-texts.ts` debrief, fi / en | "110 kV voimajohto … verkkoyhtiön oma kirjaus" → **"20 kV:n sähkölinja … Linja oli … alueen verkkoyhtiön oma kirjaus"**; "the 110 kV power line … the grid operator's own record" → **"the 20 kV power line … the local distribution company's own record"** | the planted-record paragraph |
| `Legend.tsx` | "Voimalinja 110 kV" / "Power line 110 kV" → **"Sähkölinja 20 kV" / "Power line 20 kV"** | |
| `map-overlay.json`, `build-map-overlay.ts`, `map-overlay.ts` | label "110 kV" → **"20 kV"**; the overlay regenerated, so the R1/R2/R3 label anchors now sit on the rebuilt roads (R1 ~55 m north of its old anchor) | the old anchors lay off the rebuilt roads |
| `app/excon/world.ts`, `TimelineBar.tsx` | "110 kV" → "20 kV"; "grid operator" → "distribution company" | |
| `tools/thinker/authored-questions.ts`, `content/thinker/authored-queries*.json` | "110 kV linja", "voimajohto", "onko 110 kV linja jännitteetön?" → **"20 kV linja", "sähkölinja", "onko 20 kV linja jännitteetön?"**; English "110 kV line", "is the 110 kV line de-energised?" → "20 kV …"; planted probes "voimajohdon" → "sähkölinjan", "110 kV" → "20 kV" | the query vectors of the renamed questions are CARRIED from the old texts until `npm run thinker:index` runs with the model |
| `content/thinker/neutral-eval.json` n10 | needs "Kipinät lensivät metsäautotien" (gone) + Korpioja (7.2) → **Korpioja only (7.1)**; exclusions "110 kV" → "20 kV" (both files) | the Kuusimäki-road crossing is gone |
| comments: `freeze-bank-core.ts`, `types.ts`, `briefing.ts`, `freeze-measures.ts`, `traffic.ts`, `template-site.ts`, `crew-safety.ts`, `eval-neutral.ts`, `README.md`, `content/thinker/manifest.json` | "110 kV" → "20 kV" (with "110 kV before SPEC/33 (bc)") | |

The safety distances. No study text quotes a number (the grid record says "turvaetäisyydet voimassa", F7's key "turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin"), so no figure changed. For the domain reviewer (DRAFT, planning values to confirm with Pelastusopisto / SFS 6002): a live 20 kV overhead line — persons, tools and machines ≥ 2 m from the conductors (3 m for 110 kV); water spray ≥ 5 m and a solid jet ≥ 10 m from live parts above 1 kV; a fallen conductor ≥ 20 m (step voltage); the line's wooden poles burn, so a fire under the line can drop a live conductor. The burnout rule (no burnout within 300 m of the line without confirmed de-energising, `traffic.ts`) is kept.

## 3. Unit positions, safety and logistics

- **crew-safety: 19 findings, 0 unexplained** (was 8 unexplained and 4 stale exemptions). No unit was moved: each finding is a crew working from the burned edge or stepping into it, which doctrine allows with a stated LCES line. Added lines (above) for KY21 step 6, VPK step 8, KY21 + VPK step 11; existing records cover EK11 step 1 (its handover line), EK12 step 2 (the handover line, same assignment), EK11 step 8 (its 15:42 line). Stale exemptions removed: 5:EK14, 5:EK12, 11:EK15, 16:KY21 (no finding on the new map).
- **`tactical_check.py`, 21 cycles** (export of this tree): ground 143/163 INFEASIBLE (112 on LACES fields alone, i.e. crews that state no escape route or safety zone in their current posting; 24 on the MPV25 smoke-zone proxy; 19 on the US-based PROVISIONAL flame limits for direct attack, phase A); 20 feasible with warnings; aircraft 56 feasible + 4 with warnings; unverifiable checks as before (no CO values, the MPV25 lay limit and line production MISSING). Before the rebuild: 140/163, 110 LACES-only. The same categories; for the panel.
- **Travel times and water**: `npm run map:check` 0 violations, so every contract route holds on the rebuilt road graph (CP–W1, W1/W2/W3 → R2 junction, FR_E → log landing, the OUT1/OUT2 detour); the drive times the radio states were also measured as road routes from each vehicle's position on the rebuilt graph (450 m/min): VPK's step-5 W1 trip was 6.2 km one way, so its text now says 30 min / back 15.10 (was 20 min / 15.01); EK12's step-10 W3 trip (1.9 km, back 16.41) and OUT1/OUT2 on R2 at 19.05 hold. EK13's shuttle promises ("perillä noin klo …") hold for 8 of 10 deliveries (road route within ±1.5 min of the generator's straight × 1.4). Water points W1, W2, W3 and the scoop points sit where the contract places them.
- **Two shuttle deliveries that do not hold on the road graph** (not changed, for the fire/terrain owner): EK11 step 10 (16:23, "perillä noin klo 16.34", truck at site (1894, 1746)) and EK12 step 13 (17:35, "… 17.43", truck at (674, 1791)). Both trucks sit on the northern forest-road piece, which the rebuilt graph joins to W1/W3 only by a ~36 km route (the two trucks are 2.3 km apart on it); the generator's estimate is 2.5–2.6 km. Either the northern piece needs an on-map link (tools/topo-map) or the vehicles need a parking spot on the connected network (tools/fire-ca `placement.ts`); a text fix would have to say "noin 80 min", which no crew would accept.
- **The consistency-review failure** (DR2's R2 stretch 560 m against the fire's nearest 491 m) is gone: DR2's 19:47 report states 500 m.
- **Left for the panel / fire owner**: `placement.ts` reports that at step 2 EK11's truck (on R1 by the black) has no parking spot reachable by road outside the burning zone; from 19:00 the south-east front burns under the live 20 kV line (CA: 7 m at 19:00, 1 m at 19:20) and no record says so (by design nothing may speak of the line's state before V12; whether a crew or DR2 should report the fire at the line after V12 is for the domain reviewer).

## 4. Gate D

1. `npm run map:contract:extract` (tolerances unchanged), then `npm run map:check`: **0 violations**, 2 known, both now listed with the rebuilt map's reason: `kuusimaki_400m_ahead` (text now "noin 500 m", value 500; the 25–70° wedge measure reads 0 m because spruce patches lie inside the 13:40 fire, which no text can fix) and `detour_any_truck_road` (∞: no on-map truck route avoids the bridge, as the radio's maantie detour says; ∞ cannot meet a finite value). Text coverage: 0 unmatched (the `fire.to_road` text rule now reads any direction "… edellisestä ylityksestä", the 16:47 R1 crossing is 500 m "länteen").
2. `parity_check.py` (pipeline skill) on the export of this tree: **H vs G 0 problems** (all 62 items; phase A with L1=2,L2=2,L3=4; phase B with L1=2,L2=2,L3=2; VP + SPAM + hinge). Raw pushed-vs-retrievable 780 problems, all the designed kinds (759 recorded facts, 21 item dependencies on recorded facts), as before (784).
3. `npm run validate:scenario`: all checks passed; crew safety 0 unexplained.
4. Freeze table: `freeze-table.md` in this folder (SPEC/08 not edited).
5. Panel packet regenerated (above).

## 5. For the expert panel

- V10 `area_total_hour` and `front_r2_80`: bands and keys moved (above).
- V12 `f7`: the line is 20 kV, its owner the regional distribution company.
- V14 `se_front_r2`: the basis records changed (KY21 19.47 and OUT1 19.52, DR2 11,5 m/min).
- The directive keys' bases V8, V10, V11, V13, V14 (figures above; posture coding unchanged); V14's flare-up touches L3 at 20:00.
- Phase-A items re-authored for the domain reviewer: V5 `lines_breached`, `road_jump`; V5 `infra` key `with_care`; V2 and V5 area bands.

## 6. For the native-speaker check

Every Finnish string in sections 1 and 2: the V5 items' prompts and options; the SPAM V3/V3.b/V6.b options; the U-backup pairs;
the source-memory statements; DR1 13:20 / 13:40, EK11 14:0x story bubbles; EK11 14:05; KY23 19:21; VPK 14:42 water trip; the three new LCES lines
(KY21 15:07, VPK 15:47, KY21 16:47); the three F7 records; F7's prompt; the debrief paragraph; the legend label "Sähkölinja 20 kV".

## 7. Files outside the content scope that had to change

- `tools/fire-ca/deployment.ts` (texts of EXTRA_RADIO and three new LCES lines; comments), `traffic.ts` and `template-site.ts`
  (comments only): the texts the brief lists live there. The fire model is untouched; `content/site/build/fire-ca.json` and
  `fire-ca.geojson` regenerate byte-identical; only the bundle's radio and traffic changed.
- `content/site/contract.json`: regenerated by the extractor; the curated `fire.to_road` text rule and the two known violations' notes edited.
- `tools/topo-map/checks/contract-specs.ts` still names the POWER_LINE feature "110 kV voimajohto" (its generated label in
  `contract.json`): not edited here (tools/topo-map is another stage's).
- Render and analysis data that encoded the old fire: `app/render/map-rois.ts` (V13 US2 box and the V4–V6 head boxes recomputed);
  `test/render/unit-declutter.spec.ts` bound 0.2 → 0.3 (179 of 700 edge samples stay under a marker on the rebuilt map, mostly DR3's
  orbit over the zig-zag north edge at V7–V8; for the render owner).

## 8. Tests changed

Expectations that encoded the old fire or the 110 kV wording were updated, each with a comment: `test/scenario/{freeze-bank,
freeze-items, freeze-new-l3, freeze-table, open-items-fixpass7, branch-statements, designed-events, directive, source-memory, spam,
spam-second, traffic-revision, briefing}.spec.ts`, `test/engine/{planted, rekindle, retrieval}.spec.ts`, `test/retrieval/{english-retrieval,
haku-english, neutral-eval, routine-collapse}.spec.ts`, `test/server/{thinker-english, thinker-review-ah}.spec.ts`, `test/i18n/{study-texts,
thinker-en}.spec.ts`, `test/render/{label-placement, map-overlay, unit-declutter}.spec.ts`, `test/session/visible-probes.spec.ts`,
`test/tak/compile.spec.ts`, `test/telemetry/source-memory-measures.spec.ts`, `test/tools/{skills-extras, skills-laces, skills-responses}.spec.ts`.

## 9. Still open

- The Thinker index is PROVISIONAL (`npm run thinker:index -- --carry`; 531 fi / 599 en vectors carried; the renamed 20 kV authored
  queries carry the old texts' vectors). Before any session: `npm run thinker:index` with the model, then `npm run thinker:eval -- --write`.
- Prometheus (gate A) not run; the fire stays PROVISIONAL (fire stage).
- `test/game/world-build.spec.ts`, `test/game/world-load.spec.ts` fail (the game world is built from the old grids): the game agent's.
