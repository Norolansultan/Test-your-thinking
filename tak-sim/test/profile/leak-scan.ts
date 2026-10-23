/**
 * The answer-leak scan (SPEC/35 §4, SPEC/36 §3): a text must contain no freeze item id, no key (an identifier-like option id, an
 * option label, a map key's coordinates) and no item prompt, in either language. Shared by the on-screen profile's tests
 * (`profile-screen.spec.ts`) and the personal results reports' (`test/results/`).
 */

import { tr } from "../../app/i18n/text.js";
import { buildFreezes, buildPracticeFreeze } from "../../app/scenario/demo-probes.js";
import type { FreezeItem } from "../../app/scenario/types.js";

export const FREEZES = buildFreezes();
export const ALL_ITEMS: readonly FreezeItem[] = [...FREEZES.flatMap((f) => f.items), ...(buildPracticeFreeze()?.items ?? [])];

/** The forbidden strings: item ids, prompts and option labels (fi, en), map-key coordinates; six characters or more. */
export const FORBIDDEN_SUBSTRINGS: readonly string[] = [...new Set(ALL_ITEMS.flatMap((item) => [
  item.id, item.promptFi, tr("en", item.promptFi),
  ...item.options.flatMap((o) => [o.labelFi, tr("en", o.labelFi)]),
  ...(item.mapKey ? [item.mapKey.point.lat.toFixed(4), item.mapKey.point.lon.toFixed(4)] : []),
]).filter((s) => s.length >= 6).map((s) => s.toLowerCase()))];
/** Identifier-like option ids (with `_` or a digit), matched as whole tokens. */
export const FORBIDDEN_TOKENS: readonly string[] = [...new Set(ALL_ITEMS.flatMap((item) => item.options.map((o) => o.id)).filter((id) => /[_\d]/.test(id)))];

/** What of the banks `text` contains (empty: nothing leaks). */
export function leaks(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(/[^a-z0-9_äöå.]+/));
  return [...FORBIDDEN_SUBSTRINGS.filter((s) => lower.includes(s)), ...FORBIDDEN_TOKENS.filter((t) => tokens.has(t.toLowerCase()))];
}
