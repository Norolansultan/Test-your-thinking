/**
 * DEMONSTRATION ONLY. What must never be in the demo bridge's outputs (`bridge.js`, `data.json`): the guide group's premise
 * data — the premise-evidence table and the directive premises (their texts, notes and hashes) — and the freeze items' answer
 * keys. `build.ts` fails a build that contains any of it (by module and by content); `test/demo-bridge/leaks.spec.ts` checks
 * the built files. Node only (it reads the content files); never in the bridge itself.
 */

import { readFileSync } from "node:fs";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { normaliseNewlines, repoPath, sha256Hex } from "../../server/thinker/config.js";
import { DIRECTIVE_PREMISES_FILE } from "../../server/thinker/directive-premises.js";
import { PREMISE_EVIDENCE_FILE } from "../../server/thinker/premise-check.js";

/** Source modules no bridge build may contain: the premise tables, the freeze banks and keys, the probe keys, EXCON, the server's own wiring and SDK. */
export const FORBIDDEN_MODULES: readonly RegExp[] = [
  /\/content\/thinker\/premise-evidence\.json$/, /\/content\/thinker\/directive-premises\.json$/,
  /\/app\/scenario\/freeze-[^/]*$/, /\/app\/scenario\/probe-keys\.ts$/, /\/app\/scenario\/demo-probes\.ts$/, /\/app\/scenario\/demo-scenario\.ts$/,
  /\/app\/excon\//, /\/server\/thinker\/(?:deps|premise-review|http|main|e5-embedder)\.ts$/, /\/node_modules\/@google\/genai\//,
];

export interface LeakMarker {
  readonly what: string;
  readonly text: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every string value in a JSON tree (the table's notes, statuses, hashes and premise texts). */
function stringsIn(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(stringsIn);
  return isRecord(v) ? Object.values(v).flatMap(stringsIn) : []; // determinism-lint-allow: a set of strings, order irrelevant (build time only)
}

/** A file's strings long enough to be its own content (not an id such as "P1" or a status word shared with the code). */
function fileMarkers(relative: string, what: string): LeakMarker[] {
  const raw = readFileSync(repoPath(relative), "utf8");
  const own = stringsIn(JSON.parse(raw)).filter((s) => s.length >= 24 && !s.startsWith("content/"));
  return [{ what: `${what} sha256`, text: sha256Hex(normaliseNewlines(raw)) }, ...own.map((text) => ({ what, text }))];
}

/**
 * The freeze items' keys. A key is an item's `correct` option (and its `mapKey`, key statements, basis): what ties an answer to an
 * item is the item's id, so no output may carry a freeze item's id — with the freeze banks and keys
 * kept out by module ({@link FORBIDDEN_MODULES}). The option and prompt wording alone is not a key: the record and UI translations
 * the bridge needs (`app/i18n/text.ts`) carry it as the app's own bundle does.
 */
function freezeKeyMarkers(): LeakMarker[] {
  const scenario = buildDemoScenario();
  const items: FreezeItem[] = [...scenario.freezes.flatMap((f) => f.items), ...scenario.practice.freeze.items];
  return items.filter((i) => i.id.length >= 8).map((i) => ({ what: "freeze item (answer key)", text: i.id }));
}

/** Everything a bridge output must not contain. */
export function leakMarkers(): LeakMarker[] {
  return [
    ...fileMarkers(PREMISE_EVIDENCE_FILE, "premise-evidence table"),
    ...fileMarkers(DIRECTIVE_PREMISES_FILE, "directive premise table"),
    ...freezeKeyMarkers(),
  ];
}

/** The markers found in `files` (name → content), with where. JSON-escaped forms are searched too. */
export function findLeaks(files: Readonly<Record<string, string>>, markers: readonly LeakMarker[] = leakMarkers()): string[] {
  const found: string[] = [];
  for (const [file, content] of Object.entries(files)) { // determinism-lint-allow: a report, order irrelevant (build time only)
    for (const m of markers) {
      const escaped = JSON.stringify(m.text).slice(1, -1);
      if (content.includes(m.text) || content.includes(escaped)) found.push(`${file}: ${m.what}: ${m.text.slice(0, 60)}`);
    }
  }
  return found;
}
