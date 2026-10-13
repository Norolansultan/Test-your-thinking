---
name: project-scenario-open-decisions
description: Open reviewer decisions left after binding the fire scenario to the generated site (24 Sep 2026)
metadata:
  node_type: memory
  type: project
  originSessionId: c36fb3b0-ff02-4d46-9487-bdbcedc4e58c
  modified: 2026-10-03T05:18:08.788Z
---

On 24 Sep 2026 the scenario was bound to the generated site (SPEC/18 revision (k), SPEC/24 §11); CA seed 20080101 frozen, 25/25 flags. Two decisions were left open for the user and the domain reviewer:

1. Cycle 13 "fire crosses R2": this doesn't happen on the ground (the Rahkasuo front stays about 1 km west of R2). Either re-bind the water-shuttle route or reword the beat.
2. Wind indicator shows the backed wind at 16:00, which may make cycle 9 too easy; option: lag the station reading 10 min. (Largely resolved 25 Sep by SPEC/26: steps 8+9 merge into V6, so the backing happens inside the view.)

3. After roads and brooks became fire barriers (24 Sep 2026), the burned area at 20:00 is 133 ha against 172 authored: keep it, or raise the phase-B spread rates.

**Why:** these change scenario difficulty, so they need the researcher's call, not an implementer's.
**How to apply:** raise them before editing SPEC/18 §7 or the demo's story text. Related: [[project_participant_role]].

**1 Oct 2026:** item 3 decided — "spread it wider": raise phase-B spread rates toward the authored ~172 ha; then recompute flags and re-check whether the front now reaches R2 (item 1).
**Also 1 Oct:** the user wants the setting text to say the fire-behaviour model (drones, wind, learned from earlier fires) can be wrong and participants must react themselves. Keep examples generic so they don't cue the rekindle or F7; say nothing about Thinker's reliability.

**Decided 1 Oct 2026 (content review):**
- Drone traffic reports only what was observed: no "not filmed / ei kuva-alalla" statements (the V7–V9 bog gap stays silent).
- Rekindle at 17:01 is reported by spotter aircraft SPOT (KY21 was ~2 km away); rekindle distances follow the CA (~1.2 km), SPEC/18 §7.2's 600 m updated; VPK objection wording and L3 crew positions unchanged.
- Both training texts carry the same "Voit verrata eri lähteiden kirjauksia keskenään."; "Haku ei tulkitse…" removed (it differed by group and bears on F7/H9).
- Setting text rewritten so the participant "records allocations; units don't receive them" (fits commander role).

**Built 1 Oct 2026 (commit 80a5734 on master):** all content-review fixes and the three decisions above are implemented; CI 700/700, flags 25/25 and 14/14. Correction: the CA puts the rekindle ~1.64 km from the reported perimeter (not ~1.2 km as first told to the user); SPOT's report says "noin 1,6 km", DR2 says 1700 m. Open for the user: (a) "voimajohto" now retrieves F7 into Thinker's top-8 at V12 too (7th; was outside) — documented, not tuned; (b) DR2 is grounded with all packs empty 15:54–16:18 inside V6, but a pack is charged by the V6 decision (16:20), so no drone is ever removed from a roster; (c) no final re-review by the code/content reviewers was run after the fixes.

2 Oct 2026 (192c9ba), researcher decisions: rekindle moved from the bog (BOG-S, 1.6 km) to the ORIGIN — the old south edge flares up ~200 m ESE of ignition when the wind turns west at 17:00 (Kalajoki-type); NO rain anywhere (lull = wind easing/backing); projection isochrones end at the next situation (T+20/T+40, two bands). Consequence: Lahdenkylä only ~1.5 km at 19:40 (was 0.57), R2 approached ~step 19. Broad rekindle query now "onko lohko 3 hallinnassa?".

3 Oct 2026 (8dd5461 on master, merged to ../_merge-main as d36f705, NOT pushed): the fire/positions/projection audits from 2 Oct are applied (SPEC/18, 24, 26, 12 amendments "2 Oct later"); flags 14/14, CI 821/821, F7 6/7/7, recall 0.735. Open for the researcher (SPEC/26 "RESEARCHER CHECK"):
- V4 head_later moved 15:40 → 15:20, because the 15:40 key fell outside the freeze-map frame; the alternative is a 1.6 km margin for all maps.
- V5 R1 key "with_care" → "open", with the option reworded to "Ajettavissa, ei paloa tien reunassa".
- Evening rates lowered (steps 12/13/14 → 4/7/8), an area trade-off the auditor called the researcher's call.
- Cold-edge crews relabelled mop-up, not moved: the scripted inertia is kept.
- Tour text on the 50 m projection tolerance: not done, since holds-view gaps are now ≤0 m.

3 Oct, researcher agreed with my recommendations:
- Keep V4 at 15:20, the V5 "open" key, slower 17:00–17:40 and mop-up.
- Raise the wind event: 18:20 to 9 (machine 7) and 19:00 to 11. Done in 7a76d7d on master; 8dd5461 was pushed to origin/main before it.
- Freeze and probe key atoms are now found by content (`trafficId` in freeze-keys.ts). The id-drift problem is fixed in code; don't reintroduce hard-coded evt ids.
