# Fire re-run on the rebuilt map (SPEC/33 stage 7, gate B) — methods note

20 Oct 2026. Grids of `abf6060` (rebuilt terrain, mires, fuel and roads; 20 kV line with a 10 m corridor). Seed 20080101,
25 m cells, 24-member envelope ensemble, burn share 0.2, tolerance 50 m. Model parameters unchanged (`BOREAL_PROVISIONAL`:
p_h 0.45, c1 0.045, c2 0.6, a 0.078); authored head rates, winds, flags and timeline unchanged (`tools/fire-ca/scenario-18.ts`).
Skill: `wildfire-fire-behaviour-check` (envelope 0.1.0). Prometheus: **not yet run** (D10 open).

## What was recalibrated

The CA's speed is authored, not modelled: each cycle's number of CA steps is calibrated on uniform pine heath to the authored
head rate (`run.ts` `cellsPerStep`, `stepsFor`). Re-running that procedure on the new grids gives the same step counts as before
(the calibration does not depend on the site). What the new ground changed is where the fire goes and what it meets, so the
authored events that are positioned on the ground were re-placed (each re-placement chosen by a sweep, seed fixed, scored on the
contract relations, the barrier sequence, the view flags and the achieved rates; the scratch sweep is not committed):

| Step | Event | Was | Now | Why |
|---|---|---|---|---|
| 3 | second ignition on RIDGE | head + 45°/140 m, r 20 | head + 40°/100 m, r 25 | the 140 m spot grew in the esker's new spruce patches: 13.3 m/min, over the table's 12 m/min crown limit an hour before the crown run |
| 4 | EK14 wets R1's north verge | 57°/880 m, r 90 | 63°/880 m, r 90 | R1's new line; keeps the 15:00 fire 592 m from the R1/R2 junction (was 671 m, contract 450–650) |
| 7 | crown-run spot PP1 | head + 40°/250 m | head + 35°/200 m | Koivuoja bends south-east past the head; at 250 m the spot fell beyond the Koivuoja forest road and no ember crossing of the brook was seen |
| 8 | the head joins the far spot | 42.7°/2840 m, r 45 | 42.4°/2789 m, r 60 | PP2 now lies east of the Koivuoja forest road; the old disk left it a separate 3 ha fire all evening (a detached front on V9's map) |
| 12 | the omission rekindle | edge 135° + 30 m, r 40 | edge 130° + 35 m, r 45 | the Honkaharju forest road now runs ~330 m south of the origin; the old disk reached it at 18:20–18:40 and crossed it a step early with no stop |
| 18 | holdover on the north edge | 27°/1155 m, r 25 | 26.3°/1170 m, r 25 | the old disk caught nothing (the north edge lies ~15 m further out); now 2 cells on the held line, 8-adjacent to the old fire |

The step-19 west-edge rekindle, the control events, the crown-run spots of step 6 and every rate are unchanged.

## Per-step calibration (head rate m/min; area at step end)

| Step | Clock | Authored | Achieved, rebuilt | Achieved, old map | CA steps | Area authored / old / rebuilt (ha) |
|---|---|---|---|---|---|---|
| W3 | 12:20 | 6 | 9.8 | 8.8 | 4 | 5 / 2.8 / 3.2 |
| W5 | 13:00 | 8 | 8.0 | 8.8 | 5 | 11 / 7.8 / 10.1 |
| 1–2 | 13:20–13:40 | 6 | 7.1 | 7.1 | 4 | 18 / 12.9 / 18.3 (step 2) |
| 3 | 14:00 | 7 + spot | 10.8 | 10.6 | 4 | 24 / 17.8 / 24.3 |
| 4 | 14:20 | 7 | 7.1 | 7.1 | 4 | 30 / 23.0 / 29.7 |
| 5 | 14:40 | 14 | 14.1 | 14.1 | 8 | 38 / 32.8 / 40.6 |
| 6 | 15:00 | 30 (crown) | 38.1 | 38.0 | 17 | 58 / 56.3 / 76.1 |
| 7 | 15:20 | 8 | 8.8 | 5.3 | 5 | 70 / 68.0 / 88.5 |
| 8 | 15:40 | 4 | 5.6 | 9.8 | 4 | 82 / 94.4 / 118.5 |
| 9 | 16:00 | 4 | 5.3 | 5.3 | 3 | 96 / 119.9 / 148.3 |
| 10 | 16:20 | 2 | 3.5 | 3.5 | 2 | 100 / 125.1 / 152.6 |
| 11 | 16:40 | 3 | 0 | 0 | 2 | 101 / 125.1 / 152.6 |
| 12 | 17:00 | 4 | 6.3 | 4.5 | 3 | 104 / 126.0 / 153.6 |
| 13 | 17:20 | 7 | 7.6 | 7.9 | 6 | 110 / 127.9 / 154.8 |
| 14 | 17:40 | 4 | 4.0 | 4.5 | 3 | 118 / 129.1 / 156.3 |
| 15 | 18:00 | 4 | 4.5 | 5.3 | 3 | — / 131.0 / 158.9 |
| 16 | 18:20 | 7 | 7.1 | 7.1 | 4 | 128 / 134.8 / 163.8 |
| 17 | 18:40 | 12 | 11.5 | 10.1 | 7 | 142 / 140.5 / 171.4 |
| 18 | 19:00 | 11 | 9.8 | 9.8 | 6 | 152 / 145.2 / 175.8 |
| 19 | 19:20 | 10 | 9.8 | 10.6 | 6 | 164 / 149.6 / 180.1 |
| 20 | 19:40 | 7 | 8.8 | 8.0 | 5 | 172 / 156.0 / 187.6 |

"Achieved" is the live head's advance from the reported fire over 20 min (it includes merged spots and, at step 12, the
rekindle's ignition disk, hence 6.3 at an authored 4). View flags **14 / 14** (7 H / 3 Q / 4 C, unchanged); step flags 23 / 25
(steps 14 and 20 differ at step level, their views V11 and V14 breach as authored; before: steps 14 and 17).

**Area.** Through step 5 the rebuilt fire tracks the authored areas (18.3 / 24.3 / 29.7 / 40.6 ha against 18 / 24 / 30 / 38),
closer than the old map did. The crown run burns a larger unthinned spruce stand (Kuusimäki now fills the head's whole path
north of the esker), so from step 6 the fire is ~20 ha larger than the old run and ~10 % above the authored 172 ha at 19:40. A lower
p_h (0.40–0.44, tried) does not shrink it consistently at these step counts, so the parameters were left as adopted.

## The fire on the new ground

- Spruce carries it faster and wider (p_den +0.3); the birch–aspen strip along Koivuoja, open bog and fields slow it (p_veg −0.3);
  drained pine mire burns at 0.6× pine heath, open bog at 0.3×; Rahkasuo's peat is not reached before 20:00.
- Barriers (the CA's crossing and stop rules, `crossings.ts`): embers cross Korpioja in the crown run (15:00–15:20) and Koivuoja at
  15:20–15:40 (EK11 withdraws); the Koivuoja forest road stops the flank at 15:20–15:40 and is crept over at 15:40–16:00; R1 is
  crept over near the origin at 16:20–16:40 (VPK); **the Honkaharju forest road stops the south-east front at 18:40–19:00 over
  ~700 m and the head crosses it in the gusts (12 m/s) at 19:00–19:20 (EK16 withdraws)**, as V12–V14 are designed.

## Contract fire relations (`npm run map:check`, polygons of the frozen bundle)

| Relation | Rebuilt | Contract |
|---|---|---|
| V2 junction (truth, 15:00) | 592 m | 450–650 |
| V7 cabins / command post, steps 10–12 | 1672 / 797 m | ≥ 300 |
| V10 cabins, step 13 | 1672 m | 1500–2500 |
| V12 village, step 19 | 1763 m | 1700–2000 |
| Cabins / village / CP unburned, steps 1–20 | ≥ 1672 / 1596 / 797 m | ≥ 50 |
| R2 at step 20 | 400 m | ≥ 150 |
| Honkaharju road at step 15 / reached by step 18 | 135 m / 0 m | ≥ 30 / 0 |

0 violations. The curated `kuusimaki_400m_ahead` stays a known violation (0 m: the new spruce patches touch the 13:40 fire).

## Behaviour envelope (`fire_check.py`, `fire_check.json` here)

0 LIKELY_ERROR, 5 REVIEW, 1 INFO (before: 0 / 2 / 1). Input: the package's `cycles.json` built by `tools/skills/cycles.ts`
from this bundle (the full `skills:export` stops on the content keys listed in the report; `cycles.json` does not depend on them).

| Cycle | Flag | Judgement |
|---|---|---|
| 5 | REVIEW crown at 14.1 m/min (< 15) | unchanged: the crown run's onset (FMI, panel) |
| 5 | INFO no spotting distance | unchanged: the spots are dated to step 6 |
| 6 | REVIEW crown at 38.1 m/min (> 30) | unchanged reading (38.0 before): includes the merged spots; FBP C-2 22–31 m/min for the continuous edge, which the record states (~30) |
| 3 | REVIEW head flame 4.44 m (> 4.4) | new: Byram's table at 10.8 m/min, the RIDGE spot included (10.6 before, 4.40 m); 1 % over the Kalajoki pair |
| 17 | REVIEW surface 11.5 m/min (> 11), flame 4.57 m (> 4.4) | new: the authored 12 m/min in the 18:40 wind event (9 m/s, gusts 14) on dry pine heath; 10.1 before. Kalajoki's 9–11 m/min is one fire's envelope, not a limit |

## Methods paragraph (draft; Prometheus not yet run)

"The scripted fire (25 cycles of 20 min) was generated offline with a cellular automaton after Alexandridis et al. (2008) on 25 m
fuel and elevation grids of the fictional site, with a provisional boreal refit of the published parameters (p_h 0.45, c2 0.6)
and Finnish fuel classes mapped onto the model's vegetation and density factors. The model's head speed was not left free: in
each cycle the number of automaton steps was calibrated on uniform pine heath to the authored head rate, so the automaton supplied
direction, shape and the effect of fuel, slope and linear barriers, and the timeline stayed as authored. Spotting, the crown run,
the rekindles and crews holding sectors were authored events placed on the ground; after the site was rebuilt they were re-placed
so that every authored barrier stop and crossing and every distance the study's texts and items rely on held (all 11 fire
relations of the geometry contract met; 14 of 14 envelope flags as designed). Achieved head rates were within 0.9–1.4× of the
authored rates in every cycle except those where an authored spot or rekindle merges with the head (12:20, 14:00, the 15:00 crown
run at 38 against 30 m/min, 17:00) and the 16:20–16:40 lull. Cycle by
cycle, the fire was checked against an envelope drawn from the 2021 Kalajoki forest fire (Pelastusopisto 2022): no cycle was
flagged as a likely error and five were flagged for review (crown-run rate at its onset and peak, and the head at 14:00 and 18:40
up to 5 % above the Kalajoki surface-fire rates and flame lengths), each retained with its fuel and weather reason. A comparison
with a Prometheus ensemble run on Finnish fuel grids is pending; until then the fire is reported as provisional."

## Images (before = old map with the old run, after = rebuilt map with this run; same extent and symbology per pair)

`fire-before-after-step05.webp`, `-step06.webp` (crown run), `-step12.webp` (the 17:00 rekindle), `-step13.webp`,
`-step18.webp` (the road stop), `-step19-20.webp` (the crossing and the V14 flare-ups).
