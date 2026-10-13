# The UI — visual preview, not the compliant instrument

This is the "render/" module from `SPEC/05_System_Architecture.md` §6
("map, status strip, report rail, drawers, probe surface"), built to make
the workflow visible and clickable per an explicit request — it is a
**preview build**, and differs from the real instrument in ways that
matter before any real session runs:

- **Basemap.** MapLibre needs vector or raster tiles for a real
  cartographic background. The real instrument resolves these from an
  offline, content-hashed asset bundle (`SPEC/05` §8, `tools/bundle/`),
  which is not built — it is the only module permitted outbound network
  access, and building it means fetching real, licensed MML data, a
  separate task. *(Superseded 23–24 Sep 2026: the basemap is now the generated site,
  `public/maps/topo.webp` placed by `app/scenario/site-meta.json`, and the scenario is placed on
  it — SPEC/23 §11–§14. The L521 description below is history.)* This preview instead used a real Maanmittauslaitos
  (Finland's National Land Survey) 1:50,000 basic map sheet, **L521**
  (Hamina/Virolahti/Miehikkälä area, Kymenlaakso), shipped as a static
  local file (`public/maps/L521.png`, downsampled for the browser) and
  drawn as a georeferenced `image` source in `components/MapView.tsx` — no
  network request at all, so I3 ("no network during a run") holds
  trivially. The scenario's `ORIGIN` in `app/scenario/demo-scenario.ts` was
  moved to sit inside this sheet's real coverage (see the comment there);
  the corner coordinates used to place the image were derived from a
  single-point calibration (one real landmark's known coordinates matched
  to its pixel position, plus the sheet's known physical scale), not looked
  up from MML's sheet-index service (which needs an API key this build
  doesn't have) — expect on the order of a few hundred metres to ~1km of
  placement error, not survey-grade. (An earlier version of this preview
  fetched live OpenStreetMap tiles through a dev-only Vite proxy, and
  before that pointed MapLibre at a public demo tile server directly from
  the browser — the latter made the map silently fail closed with no error
  shown in any offline or sandboxed environment. The current local-file
  approach has neither problem.)
- **Scenario content.** Drives off `app/scenario/demo-scenario.ts`,
  synthetic placeholder content — see `content/demo/README.md`.
- **Retrieval / AI drawer.** Haku and Thinker both resolve
  to `app/retrieval/closure.ts`'s closed, deterministic token-overlap
  baseline (via `SessionOrchestrator.searchAtoms`) — there is no radio: the
  participant cannot ask a unit (SPEC/02 revision (j)) — never
  hand-written canned text, never generated prose. The hybrid sparse+dense
  engine `SPEC/14` §5 specifies needs an embedding-model choice `SPEC/11`
  §7.1 still leaves open; this baseline satisfies I6 regardless of
  ranking quality and stands in until that choice is made.
- **Scope.** Covers the primary loop end to end (bubbles arrive, envelope
  reveal, three-way judgement, confidence, follow-up, verification,
  allocation, cycle advance) for one condition at a time, over SPEC/26's
  session: the briefing's setting text, the practice view ("Harjoitus", no
  AI in either group), the group-specific training text, and the fourteen
  main views ("Jakso n / 14"); both groups judge the same envelope
  (SPEC/02 revision (o)). Preflight, consent, the training's practice
  queries, the Type E/F/U probes (scheduled in the scenario), and the
  questionnaire are not built — this is a workflow preview, not a
  feature-complete build. SPAM is delivered (round 2, 4 Oct 2026: `SpamCard`,
  `app/session/spam-delivery.ts`), and the hinge screen carries the manipulation check.
- **Timing.** Exploration runs the real SPEC/26 §4 values (90 s, 120 s in
  a merged view). For quick click-through in development, open the app
  with `?esikatselu=<seconds>` (e.g. `http://localhost:5173/?esikatselu=12`,
  `app/session/preview.ts`): every exploration phase is shortened, the
  status strip shows it, and the log header records `previewOverride`.

None of this affects the modules under test (`app/engine/`,
`app/scenario/`, `app/telemetry/`, `app/routing/`, `app/retrieval/`,
`app/boundary/`, `app/render/render-tree.ts`,
`app/render/visual-encoding.ts`) — those are the same code, real and
tested, that this UI happens to be a window onto.
