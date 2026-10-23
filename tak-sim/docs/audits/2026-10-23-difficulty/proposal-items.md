# Proposal (e), 23 Oct 2026: fixes item by item, for the expert panel

**Status:** DRAFT. Each row gives the problem (from `audit.md` §4–§5), the options (add the information to a record, move timing, or replace the item), a recommendation, and what it touches.
- The Finnish record texts are DRAFTs for the radio-realism check and the native speaker.
- Every figure a new record states is computed at build time from the scenario (`freeze-keys.ts` helpers), never typed. The build fails if the figure drifts from the map, as the existing `trafficFigure` and `keyBand` rules do.
- After any change, re-run `tools/review/freeze-table.ts`, `tools/review/difficulty-audit.ts`, `test/scenario/freeze-bank.spec.ts` (the recall guard and the told classes) and `tools/power/h2-power.ts`.

Legend for "Touches":
- **K**: the key changes;
- **T**: the told class changes (a pushed key record makes the item `stream_told`; this needs non-empty `keyAtomIds`, so a record added only to `basisAtomIds` leaves it unchanged);
- **H2**: the H2 window (24 L2/L3 items in V2–V7) must keep its count and levels.

## e.1 Keys that rest on a map fact, or a fact on no surface, that no record states

| Item | Problem | Options | Recommendation | Touches |
|---|---|---|---|---|
| **V2 `junction_hour`** (L3) | The fire's distance to the R1/R2 junction has to be measured with the scale bar, then extrapolated | **A.** Add a pushed record at step 2 (V2's first step, at 0 s), in the water shuttle's voice. fi: "EK13, tie R1: ajoimme R1/R2-risteyksen kautta, palon reuna noin {d} m risteyksestä länteen." en: "EK13, road R1: we drove through the R1/R2 junction; the fire's edge is about {d} m west of the junction." {d} is the drawn fire's distance at step 2 (`deliveredPointDistanceAt`), ~950 m today, which is the item's lure. **B.** Teach the measure tool (`proposal-map.md` d5) and keep the item as a map item. **C.** Replace. | **A** (with d5 in any case). The key stays report-keyed: {d} less the pushed DR1 rate (7.1 m/min) × 60 min gives ~525 m, inside 400–700, the same band as the map-keyed ~554 m. The build checks that the two agree. | basis only, not K or T; H2 unchanged |
| **V4 `crown_drops`** (L3) | No record before step 7, and no map layer, shows the broadleaf strip; only knowledge and the place name answer it | **A.** Add a recorded (T2) forest-register record at step 5, beside the existing `ref.stand.*` reference records. fi: "Metsävararekisteri: Koivuojan laaksossa noin 100–150 m levyinen koivu- ja haapavaltainen lehtimetsävyöhyke; Kuusimäen kuusikko päättyy sen reunaan." en: "Forest register: along the Birch Creek valley a broadleaf strip of birch and aspen, about 100–150 m wide; the Spruce Hill spruce stand ends at its edge." **B.** Push it. **C.** Replace it with a consequence item whose basis is pushed. | **A**. The fact becomes findable (channel c), the key still needs knowledge (crown fires drop in broadleaf), and the item stays "neither" in H2t. B would make it close to recall. | basis only; H2 unchanged |
| **V7 `cp_safe`** (L3) | No record states the fire's distance to the CP; the turn away from the CP is in the recorded forecast | **A.** Extend EK15's pushed arrival radio (`atom.radio.10.2`). fi: "EK15: saavuimme johtopaikalle; palo näkyy noin {d} m itään, savu painuu koilliseen." en: "EK15: we have arrived at the command post; the fire is about {d} m to the east, the smoke drifts north-east." {d} = `distanceToReportedM(10, F.CP)`. **B.** Rely on d5 (the measure tool) and the pretest covariate. | **A**. Check two things: the source-memory fact `ek15_arrival` still matches its key statements (it does: they match "EK15 … johtopaik"), and the smoke's direction agrees with step 10's wind. | basis only; source-memory atom text changes (re-hash) |
| **V10 `area_total_hour`** (L3) | No area is pushed in phase B, the map prints none, and the recorded survey is the lure | **A.** Push DR3's 17.35 survey (`evt.c13.034`, step 13, at 0 s in V10), and add one pushed step-13 line with the new front's size and rate. fi: "SPOT, kolmas kierros klo 17.25: uusi palo noin {a} ha, reuna etenee itä-kaakkoon noin {r} m/min." en: "SPOT, third pass at 17.25: the new fire is about {a} ha, its edge spreading east-south-east at about {r} m/min." {a} and {r} come from step 13's drawn detached front and rate mark. Do **not** push SPOT's 17.10 pass (`atom.demo.12.1`) in V9: V9 is a keyed no-fit view, and more pushed news of the new fire there would change H13's stimulus. With A, a non-searcher has 153.6 ha now and the new front's size and rate. The key (155–167 ha) then needs the front's growth, a projection, and the lure (143–155 ha, "no edge moved") stays. **C.** Replace it with another phase-B containment L3, drafted with the SAGAT skill (report-keyed on pushed records, the 1.3× option rule). | **A** if the panel accepts that a ~1 ha front at 3–4 m/min grows 4–10 ha in an hour (the key's margin). Otherwise **C**. V10 is also a keyed no-fit view, but its freeze comes after the plan (`30` §5.1), and the added line only puts figures on what the pushed story beat 13.0 ("the new fire is spreading east along the old south edge") and the drawn front already show. | T unchanged (no `keyAtomIds`); phase B, outside the H2 window; the panel checks V10's record set for H13 |
| **V2, V4, V12 `head_later`** (L3, map points) | The head an hour (V2, V12) or 20 minutes (V4) on, placed on the blank basemap | **B.** The freeze-map reference overlay (`proposal-map.md` d6) and the pretest covariate. **C.** If pilot accuracy is < 30 % in both groups, replace V2's and V12's with a choice item (the sector or road the head reaches). V4's stays, because it carries `projectionPoint` for the projection-reliance measure. | **B** first; **C** only on pilot evidence | V4: none. V2 and V12 under C: K |

## e.2 Late information: second-step records 37–40 s before the freeze (V2, V4)

The affected items:
- V2 `ek11_between`, `south_flank`, `ek11_point` (lead 40 s);
- V4 `infra`, `ek12_where`, `fastest_spread`, `head_unattended`, `return_danger` (lead 37 s).

| Option | What changes | Cost |
|---|---|---|
| **i. Keep it and pre-register the lead as an item covariate** | Nothing in the stimulus. The analysis adds `late_lt60s` (from `items.csv`) or the lead in seconds. | None. The eight items measure reading under load as well as SA. |
| ii. The V2 and V4 freezes at the view's end (`FREEZE_AT_VIEW_END` gains 2 and 4), as in phase B | Lead ≥ 65 s. "Now" becomes the view's end, so the L3 horizons are re-stated (`nowStepOf`, `minutesAhead`). | The phase-A freezes lose their random moment in two of four views (V5 and V7 keep theirs). The plan precedes the freeze. The keys of the "now"-dependent items are re-checked (`freeze-bank.spec.ts`). |
| iii. Draw the merged views' moment from [boundary + 40 s, min − 20 s] = [105, 110] | V4 moves from 102 to ≥ 105; leads become 40–45 s | Gains little |
| iv. A longer minimum for merged views | Impossible inside the 150 s cap with the 20 s rule (the window [125, 110] is empty) | — |

**Recommendation: i now, and ii as a pre-registered fallback** if pilot 2 shows the late items more than 15 points below their view's other items (`proposal.md` §f).

## e.3 Items a non-searcher cannot answer

| Item | Design intent | Options | Recommendation | Touches |
|---|---|---|---|---|
| **V2 `area_40`** (L3) | Report-keyed through the drawn maps; the growth series is recorded only | **A.** Push DR3's 13.55 survey (`evt.c02.028`, step 2, at 0 s): 13.8 ha, 3.7 ha new in 20 minutes. Carried on for three steps it gives ~25 ha, inside 20–35, the same band as the map-keyed ~24.8 ha and the truth's ~29.7 ha. | **A.** It is V3's stale SPAM lure (~14 ha) and stays one there, because V3 asks for the *latest* survey. V3.b (14.15 against 14.35) is unchanged. | basis only (`keyAtomIds` empty); H2 unchanged |
| **V5 `infra`** (L1) | Retrieval-dependent L1 (`31` F18) | **A.** Push DR2's 15.27 road report. **B.** Keep it, with the rule taught (a), the badge (a.4) and analysis conditional on exposure. | **B.** Pushing it would also make SPAM V6.b partly passive. | none |
| **V5 `ek14_shelter`** (L3) | The forecast turn is recorded only; F07 removed it from the stem | **A.** Push the 15.00 forecast update (`evt.wx.03`) at step 6 (V4). **B.** Keep it, with the practice lesson (b, option A) that teaches that forecasts are in the records. | **B.** Pushing would make it stream-told (`keyAtomIds` = `evt.wx.03`) and would remove the one class of record that is never pushed, the clearest test of seeking. | none under B; T under A |
| **V12 `f7`** (L2) | The verification item (H9): the planted record against the operator's log | Keep | Keep | none |
| **SPAM V6.b** (L2) | Retrieval-dependent by design | **A.** Name the two reports' times in the stem. fi: "Miten tien R1 tila Kuivakankaan eteläpuolella muuttui DR2:n tiehavainnoissa klo 15.27 ja 15.47?" en: "How did the state of road R1 south of Dry Heath change in DR2's road reports at 15.27 and 15.47?" The older report is otherwise crowded out by earlier R1 reports (`audit.md` §4.1). **B.** Keep. | **A.** The stem points at records, not at the key. Check that `spam-second.spec.ts` still finds both key records. | none (the key is unchanged) |

## e.4 Domain-knowledge items (no change proposed; reported)

These items need fire-behaviour knowledge a novice lacks: V2 `spruce_behaviour`, V4 `return_danger`, `crown_drops` and `korpioja_spot`, and V5 `road_jump`.
- The public primer's "fire shape" page already covers crown fire and embers starting spot fires. The glossary marks the terms.
- For experts the items are fair.
- Novices' accuracy on these items is an expertise effect to report (`35` §7), not a design fault.
- The one exception is `crown_drops`, which also lacks its fact (e.1).
