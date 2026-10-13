/**
 * `npm run session-log:server` — the session-log upload endpoint alone, for development beside
 * `npm run dev` (Vite proxies `/api/session-log` here). Listens on 127.0.0.1:${SESSION_LOG_PORT:-8788}
 * and writes `logs/sessions/<sessionId>.jsonl` (gitignored). Production runs it inside `npm run serve`.
 */

import { repoPath } from "../thinker/config.js";
import { createAppServer } from "../production/server.js";
import { SessionLogStore } from "./store.js";

const port = Number(process.env.SESSION_LOG_PORT ?? 8788);
const dir = process.env.SESSION_LOG_DIR ?? repoPath("logs/sessions");
createAppServer({ sessionLog: new SessionLogStore({ dir }) }).listen(port, "127.0.0.1", () => {
  console.log(`session-log: listening on http://127.0.0.1:${port}/api/session-log -> ${dir}`);
});
