/**
 * DEMONSTRATION ONLY — the browser entry of the published demonstration's Claude bridge (`npm run demo:bridge` builds it to
 * `dist/demo-bridge/bridge.js`). A classic script placed before the app's module script, so the app's first `fetch` is already
 * the wrapped one (`install.ts`). Never imported by `app/`, never in the study build. See README.md.
 */

import { DEMO_BRIDGE_DATA_FILE } from "./data.js";
import { installDemoBridge, type BridgeWindow } from "./install.js";

/** `data.json` beside this script; without a script address, `./demo-bridge/data.json` beside the page. */
function dataUrl(): string {
  const src = typeof document !== "undefined" ? (document.currentScript as HTMLScriptElement | null)?.src : undefined;
  try { return new URL(DEMO_BRIDGE_DATA_FILE, src || new URL("./demo-bridge/", location.href)).href; } catch { return `./demo-bridge/${DEMO_BRIDGE_DATA_FILE}`; }
}

if (typeof window !== "undefined" && typeof window.fetch === "function") installDemoBridge(window as unknown as BridgeWindow, { dataUrl: dataUrl() });
