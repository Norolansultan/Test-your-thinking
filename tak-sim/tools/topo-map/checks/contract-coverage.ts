/**
 * Coverage of the geometry contract (SPEC/33 §3): every keyed item and text that names a contract feature or states a
 * distance must map to a contract entry, or the map could be rebuilt under it unseen.
 *
 * Texts read: the bundle's traffic corpus, crew radio and their English (`app/scenario/site-scenario.json`); the story bubbles
 * (`demo-story.ts`); every freeze item and the practice freeze (`demo-probes.ts`); the SPAM items; the source-memory facts; the
 * panel keys V8–V14 (`demo-directive.ts` DIRECTIVE_KEYS bases) and the premise-evidence table (`content/thinker/premise-evidence.json`).
 *
 * A NAME mention is matched when the name is a contract feature's (its `match` expression). A DISTANCE mention ("noin 150 m",
 * "2,1 km", "~720 m") is matched when a relation's `usedBy` names the record (by id, or a `pattern` that finds the text), or when a
 * curated text rule says the distance is derived (recomputed at build from the fire run or the unit placement, its key guarded
 * by the build's own band and record checks). Rates, wind, flames, altitudes and pipe sizes are not distances and are skipped.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allFeatures, allRelations, type Contract } from "./contract.js";
import { sortedEntries } from "../../../app/engine/deterministic-object.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface TextRecord { readonly source: string; readonly id: string; readonly text: string }
export interface Unmatched { readonly source: string; readonly id: string; readonly what: string; readonly excerpt: string }
export interface Coverage { readonly texts: number; readonly mentions: number; readonly unmatched: readonly Unmatched[]; readonly byRule: Readonly<Record<string, number>> }

/** A distance stated in a text: a number (range, decimal comma) followed by m, km, metriä/metrin/metrissä or kilometriä. */
const DISTANCE = /(?:~|noin |about |n\. )?\d+(?:[,.]\d+)?(?:\s?[–-]\s?\d+(?:[,.]\d+)?)?\s?(?:km|kilometri\p{L}*|metri\p{L}*|m)(?![\p{L}\d/²³])/giu;
/** What follows or precedes a number that makes it not a ground distance: a rate, wind, a flame, an altitude, a hose size, a depth. */
const NOT_A_DISTANCE: readonly RegExp[] = [
  /\d\s?m\s?\/\s?(?:s|min)/iu, /metriä minuutissa|\d\s?m minuutissa|metres a minute|m a minute/iu,
  /liek\w*[^.;]{0,40}$/iu, /flames?[^.;]{0,40}$/iu, /liekinpituus|flame length/iu,
  /korkeu\w*\s*$|altitude\s*$|height\s*$|\bat\s*$/iu, /\d\s?mm/iu, /syvyy\w*|depth|syvä|deep/iu, /pudotuskorkeu/iu,
];

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(ROOT + rel, "utf8")) as T;

/** Every text the coverage reads, with a stable id (the record id the keys and items cite). */
export async function collectTexts(): Promise<TextRecord[]> {
  const out: TextRecord[] = [];
  const bundle = readJson<{ traffic: { id: string; content: string }[]; radio: { cycle: number; text: string }[]; english?: Record<string, string> }>("app/scenario/site-scenario.json");
  for (const t of bundle.traffic) out.push({ source: "app/scenario/site-scenario.json#traffic", id: t.id, text: t.content });
  const k = new Map<number, number>();
  for (const r of bundle.radio) {
    const n = k.get(r.cycle) ?? 0;
    k.set(r.cycle, n + 1);
    out.push({ source: "app/scenario/site-scenario.json#radio", id: `atom.radio.${r.cycle}.${n}`, text: r.text });
  }
  for (const [id, text] of sortedEntries(bundle.english ?? {})) out.push({ source: "app/scenario/site-scenario.json#english", id: `${id}@en`, text });

  const { CYCLE_STORY } = await import("../../../app/scenario/demo-story.js");
  for (const [cycle, s] of sortedEntries(CYCLE_STORY)) s.bubbles.forEach((b, i) => out.push({ source: "app/scenario/demo-story.ts", id: `atom.demo.${cycle}.${i}`, text: b.text }));

  const probes = await import("../../../app/scenario/demo-probes.js");
  const items = [...probes.buildFreezes().flatMap((f) => f.items), ...probes.buildPracticeFreeze().items];
  for (const it of items) out.push({ source: "app/scenario/freeze-bank*.ts", id: it.id, text: [it.promptFi, ...it.options.map((o) => o.labelFi)].join(" | ") });
  for (const [v, s] of sortedEntries(probes.SPAM_ITEMS)) out.push({ source: "app/scenario/demo-probes.ts", id: `spam.${v}`, text: [s.prompt, ...s.options].join(" | ") });
  for (const [v, s] of sortedEntries(probes.SPAM_SECOND_ITEMS)) out.push({ source: "app/scenario/demo-probes.ts", id: `spam2.${v}`, text: [s.prompt, ...s.options].join(" | ") });

  const { SOURCE_MEMORY_FACTS } = await import("../../../app/scenario/source-memory.js");
  for (const f of SOURCE_MEMORY_FACTS) out.push({ source: "app/scenario/source-memory.ts", id: `source.${f.id}`, text: `${f.statementFi} | ${f.statementEn}` });

  const { DIRECTIVE_KEYS } = await import("../../../app/scenario/demo-directive.js");
  for (const [v, key] of sortedEntries(DIRECTIVE_KEYS)) if (key) out.push({ source: "app/scenario/demo-directive.ts", id: `panel.V${v}`, text: key.basis });

  const pe = readJson<{ views: Record<string, Record<string, { note: string }>> }>("content/thinker/premise-evidence.json");
  for (const [v, ps] of sortedEntries(pe.views)) for (const [p, e] of sortedEntries(ps)) out.push({ source: "content/thinker/premise-evidence.json", id: `premise.${v}.${p}`, text: e.note });
  return out;
}

/** The distance mentions of a text, each with its phrase (70 characters before it to 40 after), which the text rules match. */
export function distanceMentions(text: string): { readonly d: string; readonly phrase: string }[] {
  const found: { d: string; phrase: string }[] = [];
  for (const m of text.matchAll(DISTANCE)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 40), at);
    const after = text.slice(at, at + m[0].length + 20);
    if (NOT_A_DISTANCE.some((re) => re.test(after) || re.test(before))) continue;
    found.push({ d: m[0].trim(), phrase: text.slice(Math.max(0, at - 70), at + m[0].length + 40) });
  }
  return found;
}

/** Matches every text against the contract; returns the mentions no entry covers. */
export async function contractCoverage(contract: Contract, texts?: readonly TextRecord[]): Promise<Coverage> {
  const records = texts ?? (await collectTexts());
  const features = allFeatures(contract).filter((f) => f.match);
  const nameRes = features.map((f) => ({ id: f.id, re: new RegExp(f.match!, "iu") }));
  /** Known place names that are not contract features: named on the map only, or not at all (reported when a text uses one). */
  // A Finnish name is found by its stem (inflection and consonant gradation change the end: Kuivakangas → Kuivakankaan).
  const stemOf = (fi: string) => fi.slice(0, Math.min(fi.length, Math.max(6, fi.length - 3)));
  const placeNames = sortedEntries((await import("../../../app/i18n/place-names.js")).PLACE_NAMES_EN).flatMap(([fi, en]) => [
    { name: fi, re: new RegExp(`(?<![\\p{L}-])${stemOf(fi)}`, "u") }, { name: en, re: new RegExp(`(?<![\\p{L}-])${en}`, "u") },
  ]);
  const used = allRelations(contract).flatMap((r) => r.usedBy.map((u) => ({ rel: r.id, id: u.id, re: u.pattern ? new RegExp(u.pattern, "u") : null })));
  const rules = contract.curated.textRules.map((r) => ({ id: r.id, re: new RegExp(r.pattern, "iu") }));
  // An English record (`<id>@en`) is the translation of the Finnish one: a relation that names the Finnish covers it.
  const finnish = new Map(records.filter((r) => !r.id.endsWith("@en")).map((r) => [r.id, r.text]));
  const unmatched: Unmatched[] = [];
  const byRule: Record<string, number> = {};
  let mentions = 0;
  for (const rec of records) {
    const bare = rec.id.replace(/@en$/, "");
    const fiText = finnish.get(bare) ?? rec.text;
    for (const { name, re } of placeNames) {
      const m = re.exec(rec.text);
      if (!m) continue;
      mentions++;
      if (!nameRes.some((n) => n.re.test(name))) unmatched.push({ source: rec.source, id: rec.id, what: `name "${name}" (no contract feature)`, excerpt: excerpt(rec.text, m[0]) });
    }
    for (const { d, phrase } of distanceMentions(rec.text)) {
      mentions++;
      const rel = used.find((u) => u.id === bare || u.id === rec.id || (u.re !== null && (u.re.test(rec.text) || u.re.test(fiText))));
      if (rel) { byRule[`relation`] = (byRule[`relation`] ?? 0) + 1; continue; }
      const rule = rules.find((r) => r.re.test(phrase));
      if (rule) { byRule[rule.id] = (byRule[rule.id] ?? 0) + 1; continue; }
      unmatched.push({ source: rec.source, id: rec.id, what: `distance "${d}"`, excerpt: excerpt(rec.text, d) });
    }
  }
  return { texts: records.length, mentions, unmatched, byRule };
}

function excerpt(text: string, at: string): string {
  const i = Math.max(0, text.indexOf(at));
  return text.slice(Math.max(0, i - 50), i + at.length + 30).replace(/\s+/g, " ");
}
