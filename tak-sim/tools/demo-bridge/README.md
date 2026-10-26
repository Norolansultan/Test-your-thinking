# Demo bridge — DEMONSTRATION ONLY

A page-side "Claude bridge" for the **published web demonstration** (a private claude.ai artifact: a static page with no
server). It lets the demonstration show how the AI tools work: **Haku's structured chat** (`POST /api/thinker`, every cell)
and the **Open Thinker** (`POST /api/thinker-open`, Thinker cells) are answered in the page by Claude, through the proxy's own
handler (`server/thinker/handler.ts`).

**Read this before using it:**

- **Answers come from Claude on the viewer's own Claude account**, through the artifact runtime's `sample` capability. The
  viewer is asked to allow it on the first question; every question spends the viewer's own Claude usage.
- **Never for data collection.** It is not the study's treatment: another model answers, with retrieval in lexical-only mode
  (no vector half), and without temperature 0, the fixed seed or the output cap. Every answer is marked
  `modelId: "claude-demo-bridge"`. Under `?tuotanto` (the study) the bridge serves nothing, and the app itself refuses an answer
  with that id (`assertNotDemoBridgeInStudy`, `app/session/thinker-transport.ts`). The study build and the production server are
  unchanged; the study proxy's model pin is unchanged.
- **No premise lines in the demo.** The guide group's premise data (the premise-evidence table, the directive premises) is not
  in the bridge's files. The plan review's premise lookup (`/api/thinker/premise-review`) is not served: the guide group sees
  the neutral review (the record carries `premiseError`). The Open Thinker, with the directive in force, answers as the proxy
  does for a view its table does not cover: the directive is in its instructions, but there is no premise line and no verdicts.

## What it sends to `sample`

One request of the handler is **one** call; the bridge never retries (the handler's own rules still apply: Haku has none for
these errors; the Open Thinker asks once more for a reply that is not valid JSON).

| Endpoint | Call | Tier | Cache | Input |
|---|---|---|---|---|
| `/api/thinker` (Haku) | `sample.json` | `quick` (the proxy asks for no thinking) | the runtime's default (5 min) | one string: the frozen prompt, the question with the clock line and the retrieved records, then the answer schema as a "reply with only JSON matching this schema" instruction (about 6 KB) |
| `/api/thinker-open` (Open Thinker) | `sample.json` | `quick` | `false` | the cell's frozen prompt with the order block, the plan context, the records and the digest, then the schema (one string); with history, a leading instructions turn, the history as user/assistant turns, then the question (about 14 KB; about 37 KB with a full 10-turn history) |

Failures map to the proxy's existing fallbacks: `refused` → refusal; `invalid_json`, `empty_completion` → invalid output;
`rate_limited` → rate limited; consent and account codes → auth error; `cancelled` (the handler's 20 s model timeout) →
timeout; anything else → API error. Haku then shows its template answer, the Open Thinker "unavailable".

The handler's 20 s model timeout also runs while the viewer reads the consent dialog: allow it promptly, or the first
question shows the fallback (later questions are not asked again).

## Build

From `tak-sim/`:

```sh
npm run build:web      # the page: dist/web/
npm run demo:bridge    # the bridge: dist/demo-bridge/bridge.js and dist/demo-bridge/data.json
```

`demo:bridge` checks the prompts against the Thinker manifest, and fails if the bundle contains a forbidden module (the
premise tables, the freeze banks and keys, the training incident's spec, keys and texts, EXCON, the server's wiring or SDK) or
either file contains premise, freeze-key or training-key content (`leaks.ts`; `test/demo-bridge/leaks.spec.ts` checks the same).

Revision (bp), 26 Oct 2026: `data.json` (version 2) also carries the training incident's twelve records (no truth) in a list of
their own, beside the session's, checked as the proxy checks them at startup (`trn.` ids, none the session's). A training Search
question (`corpus: "training"`, view 0) is answered over those records only, lexically, with the same prompts; a session question
never reaches them. The build needs the training's corpus (`npm run training:build`).

## Publish beside the page

1. In `dist/web/index.html`, add this line in `<head>`, **before** the app's `<script type="module" …>`:

   ```html
   <script src="./demo-bridge/data.js"></script>
   <script src="./demo-bridge/bridge.js"></script>
   ```

   `data.js` puts the same data as `data.json` in the page, for viewers whose sandbox blocks the page's fetch of its own
   files; without it the bridge reads `data.json`.

   A classic script runs before the module script, so the app's first request already goes through the bridge.
2. Publish `dist/web/index.html` as the page with its assets, and add the two bridge files at these published paths:
   `demo-bridge/bridge.js` ← `dist/demo-bridge/bridge.js`, `demo-bridge/data.js` ← `dist/demo-bridge/data.js`
   (and, optionally, `demo-bridge/data.json` ← `dist/demo-bridge/data.json`)
   (`data.json` is read from beside `bridge.js`).
3. Declare the `sample` capability on the artifact (`capabilities: {sample: {}}`).

Without the runtime (any other host), with the capability unavailable, or without `data.json`, the bridge does nothing and
the page behaves as the static demonstration does: the chats show their local fallback.
