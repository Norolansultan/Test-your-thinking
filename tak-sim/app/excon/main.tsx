/**
 * EXCON (SPEC/28 §8) — entry of the researcher-only page `excon.html` (`npm run excon`, dev server only).
 * Only `app/excon/excon.html` loads this module; nothing in the participant bundle imports `app/excon/`
 * (test/excon/isolation.spec.ts), and the production build refuses it (vite.config.ts, tools/deploy).
 */

import { render } from "preact";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExconApp, initialPlayback } from "./ExconApp.js";
import { buildExconWorld } from "./world.js";

const world = buildExconWorld();
const root = document.getElementById("excon")!;
render(<ExconApp world={world} initial={initialPlayback(world, window.location.search)} />, root);
