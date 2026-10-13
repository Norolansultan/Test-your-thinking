---
name: project-session-flow-redesign
description: Researcher decisions 1 Oct 2026 (night) on view flow, random freezes and probe content; swarm of 3 agents (flow, probes, spec) launched to build them
metadata:
  type: project
---

Decided by the user 1 Oct 2026: no locked exploration phase — decisions open 20 s into a view; SAGAT freezes come at random moments (implemented as build-time seeded offsets, identical for all participants); "do the others as planned":
- minimum view length 120 s / 150 s merged; view ends at max(minimum, confirm); allocation revisable until then;
- the freeze can interrupt mid-decision, with the covariate "decided before the freeze";
- allocation first, then the course-of-action item reworded as a description of the participant's own allocation;
- one infrastructure item per freeze in rotation, F7 asked once (V12);
- a "source of the answer" question after each SA item ("Thinker" option only in the AI group);
- no countdown; unprobed views kept for a reactivity check.

**Why:** realism (commit when ready) plus measuring metacognitive control (commit time, revisions) beside monitoring (confidence).

**How to apply:** three worktree agents were launched: flow (session code), probes (question content, FreezeScreen, labels.en.json), spec (SPEC/15, 08, 16, 07, 09, 11). On resume:
- check for their completion;
- merge flow, then probes, then spec;
- wire FreezeScreen's condition hook;
- regenerate, run CI, review, loop until clean;
- merge into ../_merge-main.

The constants 20 s and 120/150 s are pilot defaults. Related: [[project-core-research-question]].

**2 Oct 2026:** flow (d81b151), probes (3a80d5c) and spec (5268033) merged into master, plus the FreezeScreen hook (a0807ad). CI 743/743, build ok, corpus unchanged. A read-only reviewer agent was launched on 7f3ebd6..HEAD. Next: fix its confirmed findings, rerun CI, merge into ../_merge-main and have the user push.

**2 Oct 2026, done:**
- The review fixes (543f2fb) and the hardening commit are merged into ../_merge-main; the reviewer's recheck found no defects; CI is 748/748.
- Merged-view freezes now fall in [85, 130] s, after the second step + 10 s.
- Open researcher items: SPEC/11 §7.11, and the probes agent's 5 questions (practice infrastructure item, F7 wording, W1 asked twice, R2 key at V4, option D wording).
- The user still has to push main.

**2 Oct 2026 (f356016):** the researcher items are resolved.
- The SA level tag stays visible for the professor demo and is hidden with `?tuotanto` (logged as probeLevelsShown). **Before the pilot, run with `?tuotanto` or flip the default.**
- The infrastructure keys now rest only on direct reports: R1 at V2/V5, W1 at V4 and in the practice freeze.
- A revision hint was added; Thinker answers are tagged with the phase in which the question was asked.

**2 Oct 2026:** demo default = 30 s minimum (scaled times); ?tuotanto = real times + level tags hidden; final 20 s countdown added (SPEC/15 r.9). Pilot must use ?tuotanto.

2 Oct 2026 (77e84e1): "fundamentally wrong" follow-up changed to direction (8 sectors + all round) + reach (<200 / 200–500 / >500 m), researcher chose option A over a drawing tool. Reason: tool geometry, not participant, decided the old area; drawing = H2 rehearsal confound (rejecters only, before freezes). Open: pilot check of freezes during judging…branch and group rejection rates (SPEC/11 §7.12).

2 Oct 2026 (49731b1, 85d7cbe): researcher "continue as you see best" → built: KUKA list grows per view; 180 s hard cap per view (real time, freeze incl.; merged min 130 s); outlook step every view (next 30 min development + more resources yes/no, each confidence); per-unit order sheet replaced by sector plan (main effort / secondary+purpose / drone task); COA item withdrawn. Open (SPEC/11 §7.13): outlook keys are a draft, resources key ~always yes, plan alignment keys unauthored, cap timeout rate to pilot.

2 Oct 2026 SAGAT rebuild (swarm, merged b42e09e+): 6-item freezes 2×L1/2×L2/2×L3 from a draft goal bank (app/scenario/freeze-bank*.ts), map_point items on a blank map, freeze outside the 180 s cap, source asked on L2/L3 only, forecasts evt.wx.01–06 (SÄÄENNUSTE), freeze-measures.ts + tools/power/h2-power.ts. Open for researcher: H2 interaction blind to overconfidence (add bias term?), V7 rekindle_sector item may cue V9 omission detection, GDTA still to do, neutral recall 0.750→0.706.
