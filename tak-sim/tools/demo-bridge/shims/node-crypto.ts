/**
 * DEMONSTRATION ONLY: `node:crypto` in the demo bridge's browser build (`build.ts` aliases it). The proxy's code uses one
 * thing, `createHash("sha256").update(text, "utf8").digest("hex")` (`server/thinker/config.ts` `sha256Hex`), answered by the
 * app's own synchronous SHA-256 (`app/telemetry/sha256.ts`, checked against node:crypto in its tests).
 */

import { sha256Hex } from "../../../app/telemetry/sha256.js";

export function createHash(algorithm: string) {
  if (algorithm !== "sha256") throw new Error(`demo bridge: createHash("${algorithm}") is not available`);
  let text = "";
  const hash = {
    update(data: string, _encoding?: string) { text += data; return hash; },
    digest(encoding: string) {
      if (encoding !== "hex") throw new Error(`demo bridge: digest("${encoding}") is not available`);
      return sha256Hex(text);
    },
  };
  return hash;
}
