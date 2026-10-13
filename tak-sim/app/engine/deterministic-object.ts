/**
 * Deterministic object-key iteration helpers — invariant I1 (SPEC/05 §3):
 * "Object.keys iteration where order matters" is banned. JavaScript does
 * in fact guarantee a fixed enumeration order for plain-object string keys,
 * but the spec's ban is a deliberate bright line rather than something to
 * lean on engine guarantees for, so every place in this codebase that
 * needs to iterate an object's keys goes through here instead of calling
 * `Object.keys`/`values`/`entries` directly. This is the one place that
 * carries the determinism-lint allowlist comment for that API, so no
 * other file needs to.
 */

/** Plain ordinal string comparator — not `localeCompare`, which is locale-sensitive and therefore itself a determinism risk. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `Object.keys(obj)`, sorted with {@link compareStrings} so iteration order never depends on insertion order or engine behaviour. */
export function sortedKeys<T extends object>(obj: T): (Extract<keyof T, string>)[] {
  // determinism-lint-allow: sorted immediately below with an explicit comparator (I1).
  return (Object.keys(obj) as Extract<keyof T, string>[]).sort(compareStrings);
}

/** `Object.entries(obj)`, sorted by key with {@link compareStrings}. */
export function sortedEntries<T extends object>(obj: T): [Extract<keyof T, string>, T[keyof T]][] {
  return sortedKeys(obj).map((key) => [key, obj[key]]);
}
