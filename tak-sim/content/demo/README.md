# Demo scenario content — synthetic, not governing

Everything under `content/demo/` (and the generator in `app/scenario/demo-scenario.ts`)
is **placeholder content written to make the UI visible and clickable**. It is not the
real authored scenario, has not been through domain review, and must never be confused
with `SPEC/18_Scenario_World_State.md`, `SPEC/19_Query_Database_Content.md`, or the
real `20`/`21` documents (geometry/item-bank authoring and its second-pass revision)
that the user and the named domain reviewer are producing separately.

It exists because `20` and `21` were not available when this was built, and the
request was explicit: build the workflow so it can be seen and driven end to end,
without waiting on real content. Geography, unit positions, weather, and fire behaviour
here are *inspired by* `SPEC/18` (same region, same units, same rough shape of the
incident) but the actual numbers — rates of spread, perimeter geometry, distances —
are invented for visual plausibility, not derived from FWI calculations or checked by
anyone who fights fires for a living.

> **Update 24 Sep 2026.** The fire is no longer invented. Perimeters, envelopes, truth,
> wind, and unit and aircraft positions come from the cellular automaton run on the
> generated site (`npm run fire:ca` → `app/scenario/site-scenario.json`; `SPEC/24` §11,
> `SPEC/18` revision (k)). The rates are still `SPEC/18` §7's authored rates, which the
> domain reviewer has not yet checked. The story text, filler corpus, decision, freeze
> and branch items below remain placeholder. The bullets on perimeters and wind below
> describe the earlier generator.

**What real content does that this does not:**
- Rates of spread are not authored by a domain reviewer (`SPEC/11` §1.2, §2.1 — still
  the actual blocking item).
- Perimeters are irregular (per `22` §2.5's "cut the ellipse against barriers" finding,
  which this generator approximates procedurally) but not GIS-drawn.
- The wind-reduction "fifth error" rule from `22` §2.3 is approximated (closed-canopy
  cycles hold with margin, open/gusty cycles breach) but the actual wind field and
  canopy classification are not modelled.
- Branch statements exist for every judgement cycle but are not reviewed for length/
  specificity parity (`SPEC/03` revision (d)'s requirement).
- Finnish text is written to be plausible register, not reviewed by a native
  professional (`SPEC/11` §2.3).

**When real `20`/`21` content arrives**, this directory and generator should be
replaced wholesale, not merged with it — they are not a draft of the real scenario,
they are scaffolding for the app that the real scenario will eventually replace.
