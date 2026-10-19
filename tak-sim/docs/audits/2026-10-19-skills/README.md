# Skills review, 19 October 2026 — phase 1 reports

The wildfire skills (`wildfire-scenario-pipeline`, `-fire-behaviour-check`, `-tactical-check`, `-coa-authoring`,
`-sagat-probes`, `-radio-realism`) run against the scenario at commit 3631cd4, through the exporter
`npm run skills:export` (`tools/skills/`, package in `dist/skills/scenario/`). Read-only audits; nothing here
changed the instrument. The decisions taken on these findings are in `SPEC/31`.

| Report | Skill | Scope |
|---|---|---|
| `sagat.md` | wildfire-sagat-probes | every freeze, SPAM, hinge and source-memory item; goal × freeze coverage; Agent-SA, QASA, scoring proposals |
| `radio.md` | wildfire-radio-realism | all radio items and story bubbles, pushed/lateral/V9–V14 traffic, a 1-in-10 sample of the rest; call-sign table; VERIFY list |
| `coa.md` (+ `coa_option_key.csv`, `coa_rating_sheet.csv`) | wildfire-coa-authoring | the decision task and keys V9–V14; DRAFT panel sheets (34 plans) |
| `fire_tactical.md` | wildfire-fire-behaviour-check, wildfire-tactical-check | the fire envelope per cycle; the Prometheus request; tactical checks of the keyed steps |
| `parity_measures.md` | wildfire-scenario-pipeline, wildfire-sagat-probes | parity between groups; scoring and calibration; standardisation; the pipeline status (gates A–D) |

The panel sheets and the answer keys in these files are study content (the repository is public: SPEC/11 §7.30 item 1).
