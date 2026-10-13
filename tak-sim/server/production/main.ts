/**
 * `npm run serve` — the production server (docs/DEPLOYMENT.md): the built app, the Thinker proxy and
 * the session-log upload in one process. Configuration from the environment only (`config.ts`).
 *
 *   npm run build:prod && PORT=8080 ALLOWED_ORIGINS=https://study.example.org GEMINI_API_KEY=… npm run serve
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "../thinker/config.js";
import { createThinkerDeps, LOG_DIR } from "../thinker/deps.js";
import { handleOpenThinkerRequest, handleThinkerRequest } from "../thinker/handler.js";
import { SessionLogStore } from "../session-log/store.js";
import { ALLOCATION_TABLE } from "../../app/session/preview.js";
import { listSessions } from "./admin-data.js";
import { AutoAssigner } from "./auto-assign.js";
import { loadConfig } from "./config.js";
import { createAppServer } from "./server.js";

const config = loadConfig(process.env);
if (!existsSync(join(config.staticDir, "index.html"))) {
  console.error(`serve: ${config.staticDir}/index.html not found — run \`npm run build:prod\` first`);
  process.exit(1);
}

let deps: Awaited<ReturnType<typeof createThinkerDeps>> | null = null;
if (config.thinker !== "off") {
  try {
    deps = await createThinkerDeps({ lexicalOnly: config.thinker === "lexical", mode: config.thinkerMode });
  } catch (e) {
    // Study mode refuses a treatment that is not the declared one (e.g. no English index): say what to do and stop.
    console.error(`serve: the Thinker proxy cannot start (THINKER_MODE=${config.thinkerMode}): ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
const adminDirs = { sessionLogDir: config.sessionLogDir, thinkerLogDir: repoPath(LOG_DIR) };
let assign: AutoAssigner | null = null;
if (config.autoAssign) {
  try {
    assign = await AutoAssigner.open({
      ...config.autoAssign, table: ALLOCATION_TABLE, dir: config.sessionLogDir,
      // Codes already in uploaded session headers (manual ?koodi= links) are never issued again.
      usedCodes: async () => (await listSessions(adminDirs)).flatMap((r) => (r.participantCode ? [r.participantCode] : [])),
    });
  } catch (e) {
    console.error(`serve: automatic assignment cannot start: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
const server = createAppServer({
  staticDir: config.staticDir,
  sessionLog: new SessionLogStore({ dir: config.sessionLogDir }),
  allowedOrigins: config.allowedOrigins,
  ...(assign ? { assign } : {}),
  ...(config.adminToken ? { admin: { token: config.adminToken, dirs: adminDirs, ...(assign ? { assignments: assign.overview.bind(assign) } : {}) } } : {}),
  ...(deps ? { thinker: (body: unknown) => handleThinkerRequest(deps, body), thinkerOpen: (body: unknown) => handleOpenThinkerRequest(deps, body) } : {}),
});

server.listen(config.port, config.host, () => {
  console.log(`serve: http://${config.host}:${config.port}/ (app ${config.staticDir})`);
  console.log(`serve: session logs -> ${config.sessionLogDir}`);
  // The token itself is never printed here (the start script prints it once, to its own console).
  console.log(`serve: data download ${config.adminToken ? "ON at /admin?token=<ADMIN_TOKEN>" : "OFF (ADMIN_TOKEN unset)"}`);
  if (!assign) console.log("serve: automatic assignment OFF (AUTO_ASSIGN unset): /api/assign answers 404; study links need ?koodi=");
  else {
    const o = assign.overview();
    console.log(`serve: automatic assignment ON: ${o.issued.length} code(s) issued so far, cap ${o.maxIssued}, ${o.ratePerHour}/hour per address; left: en ${o.remaining.en}, fi ${o.remaining.fi}`);
    if (o.cells) console.log(`serve: PILOT cell filter ASSIGN_CELLS=${o.cells.join(",")}: only these cells are issued (the blocked balance between cells does not hold; unset it for the study)`);
  }
  console.log(`serve: allowed cross-origin callers: ${config.allowedOrigins.length > 0 ? config.allowedOrigins.join(", ") : "none (same origin only)"}`);
  if (!deps) console.log("serve: Thinker OFF (THINKER=off): /api/thinker answers 404");
  else {
    console.log(`serve: Thinker mode ${config.thinkerMode}; retrieval ${deps.vector ? `hybrid (${deps.vector.embedder.id})` : "LEXICAL ONLY — not the declared treatment"}`);
    console.log(`serve: ${deps.englishNotice}`);
    console.log(`serve: Thinker model ${deps.client ? "configured" : "NOT configured (GEMINI_API_KEY unset): template fallback for every answer"}`);
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit(0)));
