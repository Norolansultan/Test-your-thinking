/**
 * The log header's `bundleHash` (SPEC/04 §10: "content hash of the asset bundle").
 *
 * Definition (5 Oct 2026): `sha256:` followed by the lower-case hex SHA-256 of the canonical JSON of
 * the scenario bundle the session runs — the `ScenarioContract` as `buildDemoScenario()` builds it
 * (corpus atoms, views, envelopes, freezes, probes, allocation space, hinge, …; everything the
 * participant is shown or scored against). Canonical JSON: object keys sorted by code unit
 * (`compareStrings`), arrays in order, no whitespace, a `bigint` as its decimal string, `undefined`
 * members left out (as `JSON.stringify` does). Two sessions with the same `bundleHash` were run on the
 * same stimulus, whatever build served them; the code version is `appVersion`.
 *
 * Not covered: the basemap tiles and fonts under `app/render/ui/public/` (static files, versioned by
 * the build and the repository commit in `appVersion`), and the UI's own strings (`app/i18n/ui.ts`).
 *
 * Reproduce from the command line with `npm run bundle:hash`.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import { sha256Hex } from "./sha256.js";

/** Canonical JSON as defined above. Throws on a function or a symbol (not part of a bundle). */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "bigint": return JSON.stringify(value.toString());
    case "string": case "boolean": return JSON.stringify(value);
    case "number": return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "undefined": return "null"; // only reached inside an array, as JSON.stringify does
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
      const obj = value as Record<string, unknown>;
      // determinism-lint-allow: sorted immediately with an explicit comparator (I1); canonical key order is the point.
      const keys = Object.keys(obj).sort(compareStrings).filter((k) => obj[k] !== undefined);
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
    }
    default: throw new TypeError(`canonicalJson: a ${typeof value} is not part of a scenario bundle`);
  }
}

const cache = new WeakMap<object, string>();

/** `sha256:<hex>` of the scenario bundle's canonical JSON; computed once per contract object. */
export function scenarioBundleHash(scenario: object): string {
  const cached = cache.get(scenario);
  if (cached) return cached;
  const hash = `sha256:${sha256Hex(canonicalJson(scenario))}`;
  cache.set(scenario, hash);
  return hash;
}
