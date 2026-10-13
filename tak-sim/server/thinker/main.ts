/**
 * `npm run thinker:server` — the Thinker proxy (SPEC/14 revision (q), SPEC/05 revision (q)).
 *
 *   GEMINI_API_KEY=… npm run thinker:server           # live answers
 *   npm run thinker:server                            # no key: every answer is the template, fallback no_api_key
 *   npm run thinker:server -- --lexical-only          # development only: no embedding model
 *   npm run thinker:server -- --study                 # the study (or THINKER_MODE=study): refuses to start
 *                                                     # unless the English index is built and frozen
 *
 * Without `--study` (demonstration), an English question is retrieved over the Finnish index while
 * `content/thinker/index.en.json` is absent, and the response and log say so (`hybrid_fi_fallback`).
 *
 * Listens on 127.0.0.1:${THINKER_PORT:-8787}. The Vite dev server proxies `/api/thinker` here.
 */

import { serverModeOf } from "./config.js";
import { createThinkerDeps } from "./deps.js";
import { createThinkerServer } from "./http.js";

const port = Number(process.env.THINKER_PORT ?? 8787);
const lexicalOnly = process.argv.includes("--lexical-only");
const mode = serverModeOf(process.argv, process.env);

const deps = await createThinkerDeps({ lexicalOnly, mode });
createThinkerServer(deps).listen(port, "127.0.0.1", () => {
  console.log(`thinker: listening on http://127.0.0.1:${port}/api/thinker`);
  console.log(`thinker: mode ${mode}`);
  console.log(`thinker: retrieval ${deps.vector ? `hybrid (${deps.vector.embedder.id})` : "LEXICAL ONLY — not the declared treatment"}`);
  console.log(`thinker: ${deps.englishNotice}`);
  console.log(`thinker: model ${deps.client ? "configured" : "NOT configured (GEMINI_API_KEY unset): template fallback for every answer"}`);
  console.log(`thinker: prompt ${deps.prompt.sha256}`);
  console.log(`thinker: strategy-guided prompt ${deps.promptIntent?.sha256 ?? "NOT loaded"} (withdrawn 8 Oct 2026; old logs only)`);
  // Revision (al): one Open Thinker prompt per Thinker cell.
  console.log(`thinker: Open Thinker prompts ${deps.promptOpen?.sha256 ?? "NOT loaded"} (reasoning_intent), ${deps.promptOpenOnce?.sha256 ?? "NOT loaded"} (reasoning_once)`);
});
