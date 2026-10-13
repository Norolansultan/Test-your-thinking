# 05 — System architecture

**Version 3.1 · 17 September 2026** (v3.0 · 13 September 2026). Supersedes `02_Architecture_v2.md` including amendments A1 and A2. Architecture decisions are renumbered; the mapping from the old numbering is in §12.

> **Changelog**
> - **25 Sep 2026 (q)** — a Thinker proxy (server-side retrieval and the model call) is added (`14` revision (q)).
> - **25 Sep 2026 (p)** — variable-length cycles (`26` §7).
> - **23 Sep 2026 (j)** — the `radio/` module (directed request panel, authored responder, latency model) is removed (`02` revision (j)). See the revision at the end.
> - **17 Sep 2026 (c)** — only the reasoning-AI group is split by guidance mode; prologue warm-up; 10 freezes × 5 items, 6 SPAM, 9 unprobed (see `15` v1.1).
> - **3.1 · 17 Sep 2026** — Warm-up and tutorial states; online probe state for SPAM; retrieval engine re-specified in `14`.

---

## 1. Scope and non-goals

**In scope:** a single-page web application; a deterministic scenario engine; a retrieval subsystem over an authored corpus; a telemetry subsystem; an asset bundle builder; a replay viewer.

**Not in scope:** fire modelling, language models, multi-user operation, mobile support, runtime scoring, adaptive difficulty. See `00` §5.

**Platform:** TypeScript, strict. No framework mandate; a small reactive layer is sufficient and a large one is a licence and determinism liability. MapLibre GL JS for the map, PMTiles for the basemap, both permissively licensed.

---

## 2. Deployment — AD-01

**The instrument is a hosted web application, run unsupervised on the participant's own computer.**

This replaces the earlier assumption of an institution-managed offline laptop. The change has significant consequences. Each one is handled explicitly, as listed below, rather than absorbed.

| Consequence | Handling |
|---|---|
| Heterogeneous hardware and browsers | Declared support matrix, §2.1. A pre-flight check runs before consent and refuses unsupported environments rather than degrading |
| Variable network | The whole bundle is fetched and verified **before** the session starts. Invariant I3 then holds: zero outbound requests while `RUNNING` |
| No invigilator | Attention checks, idle detection, window-blur logging, and the exclusion rules in `09` §6 |
| Data leaves the participant's machine | Local-first: IndexedDB during the run, resumable upload afterwards. EU hosting, processing agreement, TLS, encryption at rest |
| Timing fidelity | `tWallOffsetMs` from a monotonic source; frame-rate and long-task instrumentation logged so degraded machines are identifiable in analysis |

### 2.1 Support matrix

- Browser: evergreen Chromium, Firefox or Safari, current or one version back.
- Minimum viewport 1280 × 800.
- WebGL2 required (MapLibre).
- Pointer events required.

The pre-flight check runs a short render benchmark and refuses the session if the result falls below a declared threshold. The check records the refusal as a screening outcome rather than silently admitting an unusable machine.

---

## 3. Determinism — AD-02

This section describes how invariant I1 is achieved in practice.

- **Random numbers.** RNG state is derived from `seed` mixed with a stable hash of `scenarioId`, so two scenarios sharing a seed diverge. The generator is a small self-implemented PRNG (xorshift64 or PCG) with no dependency and no platform variance.
- **Time.** A virtual clock advances in fixed ticks.

**Banned anywhere reachable from the run loop:**

- `Date.now()`
- `performance.now()` (except in the telemetry annotation path, which is lint-exempted by explicit allowlist)
- `Math.random()`
- `crypto.getRandomValues()`
- `crypto.randomUUID()`
- `Object.keys` iteration where order matters
- `Array.prototype.sort` without a comparator
- `Intl` formatting inside logic
- any network read

Ids are derived deterministically: `hash(scenarioId, kind, index)`.

Lint rules enforce the bans. A **golden-run test** replays three reference input sequences over the scenario and diffs the full log against a committed fixture. A failing golden-run test is a release blocker, not a warning.

---

## 4. The run loop and the freeze machine — AD-03

```
            ┌──────────────────────────────────────────┐
            │                                          │
BOOT ─▶ PREFLIGHT ─▶ BRIEFING ─▶ RUNNING ─freeze(t)─▶ FREEZING
                                    ▲                    │
                                    │        ┌───────────┴───────────┐
                                    │        ▼                       ▼
                                    │  PROBING_VISIBLE        PROBING_BLANKED
                                    │        │                       │
                                    │        └───────────┬───────────┘
                                    │                    ▼
                                    └──────────────  RESUMING
                                                         │
 any ─▶ FAULT_PAUSED ─▶ RUNNING | ABORTED                ▼
                                                    (next cycle)
 after cycle 10 ─▶ HINGE_PAUSE ─▶ RUNNING
 after cycle 20 ─▶ DEBRIEF_HANDOFF ─▶ COMPLETE
```

**On `FREEZING`:** halt the virtual clock; **buffer, never drop**, in-flight events; disable the channel; disable all scenario input.

**`PROBING_VISIBLE`** keeps the map and envelope rendered. This mode is required for the containment judgement, confidence, failure-location marking and expectation marking — all judgements *about a displayed artifact*.

**`PROBING_BLANKED`** blanks the situational picture completely: map, rail, drawers and status strip are all removed. This mode is required for memory-based recall.

**Blanking is a property of the probe set declared in the scenario, not of the freeze.** Both modes halt the clock and disable the channel; they differ only in what is rendered. Building only one of the two modes makes half the measures impossible.

**On `RESUMING`:** restore the picture, flush buffered events with their **original** virtual timestamps, resume the clock.

**`FAULT_PAUSED`** is entered on any detected fault — storage failure, render error, tab restore. On entry it records `fault` with the elapsed wall-clock gap, so an interruption is visible in analysis instead of silently inflating a latency.

**`HINGE_PAUSE`** is entered exactly once, after cycle 10. It lasts five real minutes, and the participant can dismiss it early. The strategic-guidance message is delivered on exit from the pause, before cycle 11's working period.

Probe order is deterministic per scenario; where counterbalancing is required, the order derives from seed and participant code and is recorded in the log header.

---

## 5. Geospatial — AD-04

```ts
const WGS84 = 4326 as EpsgCode;
const ETRS_TM35FIN = 3067 as EpsgCode;
const WEB_MERCATOR = 3857 as EpsgCode;
```

Finland has a genuine two-CRS problem: national data is published in ETRS-TM35FIN, while web mapping defaults to Web Mercator. Silently mixing the two produces maps that look plausible and are wrong by hundreds of metres — a failure mode that UI testing does not catch.

**Work internally in WGS84 lat/lon.** Consume the national tile service's `WGS84_Pseudo-Mercator` variant where offered, so that no reprojection layer exists in the runtime at all. There is one conversion boundary, in the bundle builder, and it is type-enforced by the `EpsgCode` brand.

---

## 6. Modules

```
app/
  preflight/        environment check, benchmark, refusal
  engine/           virtual clock, cycle sequencer, freeze machine, PRNG
  scenario/         contract loader, validator, corpus index
  routing/          tier -> route resolution per condition; the capability matrix
  retrieval/        query parsing, key matching, ranking. NO generation (I6)
  channel/          substitutive signal emission and cadence
  radio/            directed request panel, authored responder, latency model
  render/           map, status strip, report rail, drawers, probe surface
  probes/           probe presentation, response capture, freeze coordination
  telemetry/        record emission, IndexedDB persistence, upload queue
  boundary/         toRenderable() and the I4 guards
  i18n/             the Finnish string table. No literal strings in components
tools/
  bundle/           the ONLY module permitted outbound network access
  replay/           session replay viewer
  validate/         the CI checks in 03 §11
```

**Lint-enforced boundaries.**

- `render/` may not import `scenario/` types other than `RenderableAtom` and friends.
- Only `tools/bundle/` may import a network client.
- `engine/` may not import `render/`.

---

## 7. Retrieval subsystem — AD-05

> **[SUPERSEDED 2026-09-17]** Extended by `14` §5: hybrid sparse + dense retrieval over frozen information packages, with I6 unchanged.

**Invariant I6: structurally incapable of generating text.** The retrieval function's return type is `readonly InfoAtom[]`, drawn from the loaded corpus. There is no code path that constructs a novel string from atom content.

Query text is tokenised, normalised (case-folded, Finnish diacritics preserved), and matched against `retrievalKeys`. Ranking is a deterministic scoring function over key overlap, recency and source reliability, with ties broken by atom id. Results are capped and paginated.

**`retrieval_miss` is a first-class outcome and is logged.** A query that returns nothing is a strong signal about what the participant was looking for. Instrumented systems routinely discard that signal.

Retrieval latency is drawn from a seeded distribution matched to `SourceClass.replyLatency` (`02` §1.1). The match is asserted in CI over the whole corpus.

**No stemming library.** Finnish morphology is hard, and the obvious tool, Voikko, is GPL and would contaminate the MIT grant (I7). Instead, retrieval keys are authored and reviewed to include inflected forms. This is more work for the author and is the correct trade.

---

## 8. Asset bundle — AD-06

Tiles, terrain, place names, forest data, weather series, fonts and the whole scenario corpus resolve into a versioned, content-hashed bundle **before** the session.

Rationale, in order:

- determinism;
- no mid-session availability risk;
- no rate limits with a hundred-plus participants;
- a trivial network-isolation story for ethics and IT;
- one-time rather than continuous licence compliance.

The bundle build script is the **only** code permitted outbound access. This is enforced by a lint boundary rather than by convention. The script's output includes `THIRD_PARTY_NOTICES.md` generated from the manifest, and a `LICENCES.json` that CI checks against the allowlist.

**Fonts are self-hosted.** The fonts are IBM Plex Sans, Mono and Serif (SIL OFL 1.1), subset to Latin plus Finnish diacritics, and shipped as woff2 in the bundle with `@font-face` and `font-display: block`. Loading from `fonts.googleapis.com` or `fonts.gstatic.com` is a third-party outbound request in the session path and is disallowed under I3.

---

## 9. Storage, upload and resume

**Local-first.** Records are written to IndexedDB in an append-only object store, flushed before the UI acknowledges the action that produced them (I5). `seq` is assigned by the writer and is gapless.

**Upload is resumable and post-hoc.** After `COMPLETE`, the session file is uploaded in chunks with retry. If the upload cannot complete, the participant is shown a one-click export that writes the file to disk, and is asked to send the file. Nothing is lost because the network failed.

**Resume.** A session that is interrupted — tab closed, machine slept, browser crashed — can be resumed from the last completed cycle boundary. Resuming mid-cycle is not supported. Instead:

- the interrupted cycle is replayed from its start;
- the interruption is logged as a `fault` span;
- the analysis may exclude that cycle. A session resumed more than once, or after more than a declared interval, is flagged for the exclusion rules in `09` §6.

---

## 10. Licensing and repository — AD-07

**Licence target: MIT, originated by the author, no inherited copyright.**

**Clean-room policy.** The reference console (`nicholas-ruest/wildfire-robotics`) informed the layout pattern only, by description. **No source file is copied, adapted, or translated from that repository.** Any file that *does* originate elsewhere goes in `vendor/` with its licence header intact and an entry in `THIRD_PARTY_NOTICES.md`.

**Allowed:** MIT, BSD-2, BSD-3, ISC, Apache-2.0, CC0 for code; SIL OFL 1.1 for fonts; CC BY 4.0 for data.
**Forbidden:** AGPL, SSPL, any source-available licence, GPL of any version in the shipped tree. **Voikko is named and excluded.**

CI runs a licence scan and fails the build on anything outside the allowlist. The scan covers transitive dependencies.

---

## 11. Replay — AD-08

The replay viewer reconstructs a session from its log alone, using the same bundle hash, the same seed and the same input sequence. It renders what the participant saw at any point, plus an analysis overlay showing truth annotations, probe answers and timing.

The replay viewer is a **research instrument with a research-instrument quality bar**, not a debugging convenience. It is the stimulus for the retrospective walkthrough (`09` §5.2) and is screen-shared in a remote call. It needs:

- a shareable remote mode;
- scrubbing;
- a truth overlay that can be toggled off before the participant sees it.

**Reconstruction fidelity is a golden test.** Replaying a golden log must reproduce the identical render tree at every logged `seq`.

---

## 12. Decision-record mapping

For anyone reading the archived documents.

| New | Old | Subject |
|---|---|---|
| AD-01 | AD-14 | Hosted web app, unsupervised |
| AD-02 | AD-03 | Determinism |
| AD-03 | AD-08 | Freeze state machine |
| AD-04 | AD-09 | Geospatial typing |
| AD-05 | — | Retrieval closure (was invariant I6 only) |
| AD-06 | AD-07 | Asset bundle, no network |
| AD-07 | — | Licensing (was §10) |
| AD-08 | AD-16 | Replay and decoupled reasoning-mode collection |
| — | AD-01, AD-02, AD-04, AD-05, AD-06, AD-10, AD-11 | Moved to `04_Data_Model.md` |
| — | AD-12 | Superseded: the `human` condition is now `directed` and is automated (`02` §1.1) |
| — | AD-13 | Moved to `07_Telemetry_and_Logging.md` |
| — | AD-15 | Split: typography and information design to `06`; the **four-region layout is superseded** by `06` §2 |
| — | AD-17 | Moved to `06` §4 |

---

## 13. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Truth leaks to the render layer | **Fatal, silent** | Three independent guards, `04` §9. Integration test walks the live tree |
| Non-determinism from a dependency | High | Golden-run test; lint bans; minimal dependency surface |
| Channel vocabulary undefined | **Blocking** | `substitutive` cannot be built. `11` §1.3 |
| Participant pool too small at command level | **Blocking the design** | Verify before build completion. `11` §1.1 |
| Authoring underestimated | High | 110–150 h scheduled explicitly, not absorbed |
| Fatigue causes dropout in a 110-minute session | Medium | Hinge pause; resume support; dropout is an analysed outcome, not only a loss |
| Heterogeneous machines degrade timing | Medium | Pre-flight benchmark and refusal; frame instrumentation logged |
| Query text is personal data | Medium | Named in the DPIA; EU hosting; pseudonymised; retention stated |
| Upload failure loses a session | Medium | Local-first plus one-click export |

---

## Amendment 2026-09-17

**Run-loop additions (§4).**

```
BRIEFING ─▶ WARMUP (W1–W5, capabilities forced to `directed`) ─▶ TUTORIAL ─▶ RUNNING
RUNNING ─online_probe(t)─▶ PROBING_ONLINE ─▶ RUNNING      (clock NOT halted)
```

`PROBING_ONLINE` does not halt the clock and does not disable tools or the engine. It overlays the ready prompt and, after *Valmis*, the question. In-flight events are delivered normally. A blanked freeze can never be scheduled in the same cycle as an online probe (validated in CI).

`WARMUP` runs the prologue (cycles W1–W5 of the same incident) with the `directed` capability set for every group; the condition's capabilities are enabled only on entering `TUTORIAL`.

**Retrieval (§7).** The engine, its determinism safeguards and its tests are specified in `14`. Returned package ids are logged for every query so replay does not depend on recomputing embeddings.

---

## Revision 23 Sep 2026 (j) — no radio module

Follows `02` revision (j).

- **Module tree.** `radio/` (directed request panel, authored responder, latency model) is **removed**. No other module takes over its job. Recorded radio traffic is corpus data served by the query builder like every other record family.
- **Run loop.** Unchanged. `WARMUP` still forces the `directed` capability set, which now means Haku only, with no radio. `TUTORIAL` enables the AI drawer for the AI group.
- **I3 (no network during a run)** is unaffected.

---

## Revision 25 Sep 2026 (p) — variable-length cycles

The run loop drives 14 main views plus one practice view (`26`). A view spans one or two 20-minute steps. The virtual clock advances by the view's span, and the freeze machine and `HINGE_PAUSE` (after V7) are otherwise unchanged.

---

## Revision 25 Sep 2026 (q) — the Thinker proxy

A small server component is added (`14` revision (q)). It holds the API key, runs the time-gated hybrid retrieval over the index shipped with the bundle, calls `claude-opus-5-5` with the versioned prompt, and returns the answer with its log line. The browser calls it only from the Tekoäly/Thinker tool, in the AI condition. On timeout or error the browser shows the deterministic fallback template. Invariant exceptions: `00` revision (q).
