/**
 * `npm run review:export` — the review packet (work package I, 5 Oct 2026). Writes, to the
 * gitignored folder `review-packet/` (or the folder given as the first argument), as CSV (UTF-8 with
 * a BOM, for spreadsheets) and Markdown:
 *
 *   strings.{csv,md}  every participant-facing string, Finnish and English, with its id and location:
 *                     the interface (`app/i18n/ui.ts`, templates with {1}, {2}… for their arguments),
 *                     the briefing and training (`briefing.ts`), the study shell (`study-texts.ts`:
 *                     consent, the AI literacy screen, preflight, questionnaires, debrief per cell;
 *                     no glossary since revision (ae)), the AI literacy items (SNAIL, `ai-literacy-items.ts`), and
 *                     every scenario label, question and option (`labels.en.json`) where it is used;
 *   corpus.{csv,md}   every corpus record of the scenario: id, step, view, source, tier, pushed or
 *                     recorded, Finnish and English text;
 *   keys.{csv,md}     every DRAFT answer key with its basis: freeze items, the directive keys per
 *                     view, SPAM (and the practice item), the hinge check, and the scenario's
 *                     remaining invariants (the outlook and the branch list are not asked since
 *                     6 Oct 2026, revision (x)); with the records each key rests on; and the AI
 *                     literacy questionnaire's item -> factor table (SNAIL, revision (ac); no keys).
 *   README.md         what is where, counts, and who reviews what.
 *
 * For native, domain and expert-panel reviewers working in a spreadsheet: each row has an empty
 * `review` column. The packet contains TRUTH (the keys): it is for reviewers, never for participants.
 * Deterministic: the same build writes the same files.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };
import { UI_TEXT } from "../../app/i18n/ui.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { AI_LITERACY_ITEMS } from "../../app/session/ai-literacy-items.js";
import { recordEn, tr } from "../../app/i18n/text.js";
import { introTextsIn, PROJECTION_CAVEAT_EN, PROJECTION_CAVEAT_FI } from "../../app/scenario/briefing.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { NAV_CATEGORIES, NAV_TIME_WINDOWS } from "../../app/retrieval/navigation.js";
import { FREEZE_BANK, PRACTICE_BANK } from "../../app/scenario/freeze-bank.js";
import type { ItemDef } from "../../app/scenario/freeze-bank-core.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { SPAM_AUTHORED, SPAM_ITEMS, SPAM_KEY_ATOMS } from "../../app/scenario/demo-probes.js";
import { PRACTICE_SPAM_AUTHORED, PRACTICE_SPAM_ID, practiceSpamKeyRecordId } from "../../app/scenario/practice-spam.js";
import { PRACTICE_MEASURE } from "../../app/scenario/practice-measure.js";
import { viewOfStep } from "../../app/scenario/views.js";
import type { Cell, InfoAtom } from "../../app/scenario/types.js";
import { soundRoutes } from "../../app/telemetry/directive-act-coding.js";

export const DEFAULT_OUT_DIR = "review-packet";
const LABELS: Readonly<Record<string, string>> = labelsEn;
const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];

export interface StringRow { readonly id: string; readonly location: string; readonly fi: string; readonly en: string; readonly note: string }
export interface CorpusRow { readonly id: string; readonly step: number; readonly view: string; readonly source: string; readonly tier: string; readonly delivery: string; readonly fi: string; readonly en: string }
export interface KeyRow {
  readonly kind: string; readonly id: string; readonly view: string;
  readonly itemFi: string; readonly itemEn: string; readonly keyFi: string; readonly keyEn: string;
  readonly basis: string; readonly basisRecords: string;
}

/** An object's keys, sorted (I1: never insertion order). */
// determinism-lint-allow: the keys are sorted with an explicit comparator before use
function keysOf(o: object): string[] { return Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); }
/** An object's numeric keys, in numeric order. */
function viewsOf(o: object): number[] { return keysOf(o).map(Number).sort((a, b) => a - b); }

const scenario = buildDemoScenario();
const atomById = new Map<string, InfoAtom>(scenario.atoms.map((a) => [a.id, a]));

function atomFi(a: InfoAtom): string {
  const r = a.record as { text?: string; content?: string; kind: string };
  return r.text ?? r.content ?? `(${r.kind}) ${JSON.stringify(a.record)}`;
}
/** "id: Finnish text" for each record a key rests on. */
function recordsOf(ids: readonly string[]): string {
  return ids.map((id) => { const a = atomById.get(id); return `${id}: ${a ? atomFi(a) : "(not in the scenario)"}`; }).join(" || ");
}

// ---------------------------------------------------------------------------------------------------
// (a) Participant-facing strings
// ---------------------------------------------------------------------------------------------------

const placeholders = (n: number) => Array.from({ length: n }, (_, i) => `{${i + 1}}`);

/** Flattens two parallel dictionaries (fi, en) into rows; functions become templates. */
function flatten(fi: unknown, en: unknown, id: string, location: string, rows: StringRow[]): void {
  if (typeof fi === "string" || typeof en === "string") {
    rows.push({ id, location, fi: typeof fi === "string" ? fi : "", en: typeof en === "string" ? en : "", note: "" });
    return;
  }
  if (typeof fi === "function" && typeof en === "function") {
    const call = (f: (...a: unknown[]) => unknown, args: unknown[]) => { try { const v = f(...args); return typeof v === "string" ? v : JSON.stringify(v); } catch { return null; } };
    const args = placeholders(Math.max(fi.length, en.length));
    rows.push({ id, location, fi: call(fi as never, args) ?? "", en: call(en as never, args) ?? "", note: args.length ? `template: ${args.join(", ")} = arguments` : "" });
    if (args.length === 1) { // a flag argument: the other branch too
      const f2 = call(fi as never, [false]), e2 = call(en as never, [false]);
      if (f2 !== null && e2 !== null && f2 !== call(fi as never, args)) rows.push({ id: `${id}(false)`, location, fi: f2, en: e2, note: "template with the argument false" });
    }
    return;
  }
  if (Array.isArray(fi) || Array.isArray(en)) {
    const a = (fi ?? []) as unknown[], b = (en ?? []) as unknown[];
    for (let i = 0; i < Math.max(a.length, b.length); i++) flatten(a[i], b[i], `${id}[${i}]`, location, rows);
    return;
  }
  if (fi && typeof fi === "object") {
    const keys = keysOf({ ...(fi as object), ...((en ?? {}) as object) });
    for (const k of keys) flatten((fi as Record<string, unknown>)[k], ((en ?? {}) as Record<string, unknown>)[k], id ? `${id}.${k}` : k, location, rows);
  }
}

/** Scenario labels (Finnish → English via `labels.en.json`) where the session shows them. */
function scenarioLabels(): StringRow[] {
  const rows: StringRow[] = [];
  const add = (id: string, location: string, fi: string, note = "") => rows.push({ id, location, fi, en: tr("en", fi) === fi ? "" : tr("en", fi), note });
  const freezes = [...scenario.freezes.map((f) => ({ view: String(f.cycle), items: f.items })), { view: "practice", items: scenario.practice.freeze.items }];
  for (const f of freezes) for (const it of f.items) {
    add(`${it.id}.prompt`, `freeze V${f.view}`, it.promptFi);
    for (const o of it.options) add(`${it.id}.option.${o.id}`, `freeze V${f.view}`, o.labelFi);
  }
  for (const d of [...scenario.decisionItems, scenario.practice.decisionItem]) {
    add(`${d.id}.prompt`, `decision item V${d.cycle} (not asked since 2 Oct 2026)`, d.promptFi);
    for (const o of d.options) add(`${d.id}.option.${o.id}`, `decision item V${d.cycle} (not asked since 2 Oct 2026)`, o.labelFi);
  }
  for (const b of [...scenario.branchStatements, ...scenario.practice.branchStatements]) add(b.branchId, `branch list V${String(b.cycle)} (not asked since 6 Oct 2026)`, b.statementFi);
  for (const t of scenario.allocationSpace.tasks) add(`task.${t.id}`, "allocation", t.label);
  for (const s of scenario.allocationSpace.sectors) add(`sector.${s.id}`, "allocation", s.label);
  for (const c of NAV_CATEGORIES) add(`nav.category.${c.id}`, "Haku (WHAT)", c.labelFi);
  for (const w of NAV_TIME_WINDOWS) add(`nav.window.${w.id}`, "Haku (WHEN)", w.labelFi);
  for (const m of scenario.dutyOfficerMessages) add(`duty.V${m.cycle}${m.isStrategicGuidance ? ".directive" : ""}`, `message log V${m.cycle}, from P2`, m.text);
  add("hinge.directive", "hinge screen", scenario.hinge.intentStatement);
  const check = scenario.hinge.manipulationCheck!;
  add(`${check.id}.prompt`, "hinge screen; post-session questionnaire (retention.hinge)", check.promptFi);
  for (const o of check.options) add(`${check.id}.option.${o.id}`, "hinge screen; post-session questionnaire (retention.hinge)", o.labelFi);
  const spam = [...scenario.probeSchedule.probes.filter((p) => p.type === "S"), ...(scenario.practice.spam ? [scenario.practice.spam] : [])];
  for (const p of spam) {
    add(`${p.id}.prompt`, `SPAM V${p.cycle}`, p.prompt);
    if (p.response.kind === "categorical") for (const o of p.response.options) add(`${p.id}.option.${o.id}`, `SPAM V${p.cycle}`, o.fi);
  }
  // The visible probes (Type U): V13's closed area item (revision (ai)) and V14's backup and coverage.
  for (const p of scenario.probeSchedule.probes.filter((x) => x.type === "U")) {
    add(`${p.id}.prompt`, `visible probe V${p.cycle}`, p.prompt);
    if (p.response.kind === "area_check") add(`${p.id}.followUp`, `visible probe V${p.cycle}`, p.response.followUpPrompt);
    if (p.response.kind === "categorical" || p.response.kind === "area_check") for (const o of p.response.options) add(`${p.id}.option.${o.id}`, `visible probe V${p.cycle}`, o.fi);
  }
  for (const c of scenario.cycles) add(`wind.V${c.index}`, `status strip V${c.index}`, c.wind.sourceFi);
  const legend = (theme as unknown as { legend: Record<string, string> }).legend;
  for (const k of keysOf(legend)) if (typeof legend[k] === "string") add(`legend.${k}`, "map legend (fire-theme.json)", legend[k]!);
  // Deduplicate by (id, fi): a label shared by several views keeps one row per use.
  const seen = new Set<string>();
  const out = rows.filter((r) => { const k = `${r.id}\u0000${r.fi}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const used = new Set(out.map((r) => r.fi));
  for (const fi of keysOf(LABELS)) if (!used.has(fi)) out.push({ id: `label:${fi.slice(0, 40)}`, location: "content/i18n/labels.en.json (not found in the current scenario build)", fi, en: LABELS[fi]!, note: "possibly unused" });
  return out;
}

export function collectStrings(): StringRow[] {
  const rows: StringRow[] = [];
  flatten(UI_TEXT.fi, UI_TEXT.en, "ui", "app/i18n/ui.ts", rows);
  for (const c of ["directed", "substitutive"] as const) {
    const fi = introTextsIn(c, "fi"), en = introTextsIn(c, "en");
    if (c === "directed") rows.push({ id: "briefing.setting", location: "app/scenario/briefing.ts (briefing, both groups)", fi: fi.setting, en: en.setting, note: "" });
    rows.push({ id: `training.${c}.title`, location: `app/scenario/briefing.ts (training, ${c})`, fi: fi.trainingTitle, en: en.trainingTitle, note: "" });
    rows.push({ id: `training.${c}`, location: `app/scenario/briefing.ts (training, ${c})`, fi: fi.training, en: en.training, note: "" });
  }
  rows.push({ id: "briefing.projectionCaveat", location: "app/scenario/briefing.ts (in the setting and the tour)", fi: PROJECTION_CAVEAT_FI, en: PROJECTION_CAVEAT_EN, note: "" });
  const { debrief: dFi, ...shellFi } = STUDY_TEXT.fi;
  const { debrief: dEn, ...shellEn } = STUDY_TEXT.en;
  flatten(shellFi, shellEn, "study", "app/i18n/study-texts.ts", rows);
  for (const cell of CELLS) {
    const fi = dFi.paragraphs(cell), en = dEn.paragraphs(cell);
    for (let i = 0; i < Math.max(fi.length, en.length); i++) rows.push({ id: `study.debrief.${cell}.p${i + 1}`, location: `app/i18n/study-texts.ts (debrief, ${cell})`, fi: fi[i] ?? "", en: en[i] ?? "", note: "" });
  }
  rows.push({ id: "study.debrief.title", location: "app/i18n/study-texts.ts (debrief)", fi: dFi.title, en: dEn.title, note: "" });
  rows.push({ id: "study.debrief.finish", location: "app/i18n/study-texts.ts (debrief)", fi: dFi.finish, en: dEn.finish, note: "" });
  // The AI literacy questionnaire's items (SNAIL, revision (ac)): each completes the stem "I can…" / "Osaan…";
  // the English is the published wording, the Finnish a DRAFT.
  const ailit = "app/session/ai-literacy-items.ts (AI literacy questionnaire after consent)";
  for (const it of AI_LITERACY_ITEMS) {
    rows.push({ id: it.id, location: ailit, fi: it.fi, en: it.en, note: `SNAIL ${it.variable} (${it.factor}); English verbatim (do not edit); Finnish DRAFT, unvalidated` });
  }
  rows.push(...scenarioLabels());
  return rows;
}

// ---------------------------------------------------------------------------------------------------
// (b) The corpus
// ---------------------------------------------------------------------------------------------------

export function collectCorpus(): CorpusRow[] {
  const pushed = new Set([...scenario.cycles.flatMap((c) => c.pushedAtomIds), ...scenario.practice.cycle.pushedAtomIds]);
  return scenario.atoms.map((a) => ({
    id: a.id, step: a.cycle, view: viewOfStep(a.cycle)?.id ?? "", source: a.provenance.sourceId, tier: a.tier,
    delivery: pushed.has(a.id) ? "pushed" : "recorded", fi: atomFi(a), en: recordEn(a.id) ?? "",
  }));
}

// ---------------------------------------------------------------------------------------------------
// (c) The draft answer keys
// ---------------------------------------------------------------------------------------------------

const en = (fi: string) => (tr("en", fi) === fi ? "" : tr("en", fi));

/** Every freeze item as the scenario builds it (the bank's items and the infrastructure slot), with the bank's basis where it has one. */
function freezeRows(): KeyRow[] {
  const defs = new Map<string, ItemDef>();
  for (const d of PRACTICE_BANK) defs.set(`freeze.practice.${d.slug}`, d);
  for (const v of viewsOf(FREEZE_BANK)) for (const d of FREEZE_BANK[v]!) defs.set(`freeze.${v}.${d.slug}`, d);
  const freezes = [{ view: "VP", items: scenario.practice.freeze.items }, ...scenario.freezes.map((f) => ({ view: `V${f.cycle}`, items: f.items }))];
  return freezes.flatMap(({ view, items }) => items.map((it): KeyRow => {
    const d = defs.get(it.id);
    const correct = it.options.find((o) => o.correct);
    const key = it.kind === "map_point" ? `map point ${it.mapKey!.point.lat.toFixed(5)}, ${it.mapKey!.point.lon.toFixed(5)} within ${it.mapKey!.toleranceM} m` : correct ? `${correct.id}: ${correct.labelFi}` : "(no key)";
    return {
      kind: `freeze ${it.level}${d ? ` (${d.rule})` : " (infrastructure slot)"}`, id: it.id, view,
      itemFi: it.promptFi + (it.options.length ? ` [${it.options.map((o) => o.labelFi).join(" / ")}]` : ""),
      itemEn: en(it.promptFi) + (it.options.length ? ` [${it.options.map((o) => en(o.labelFi)).join(" / ")}]` : ""),
      keyFi: key, keyEn: correct ? en(correct.labelFi) : "",
      basis: d?.basis ?? "infrastructure slot (`demo-probes.ts` INFRA_SCHEDULE): the key rests on the direct reports listed", basisRecords: recordsOf(it.keyAtomIds ?? []),
    };
  }));
}

export function collectKeys(): KeyRow[] {
  const rows: KeyRow[] = [...freezeRows()];

  for (const v of viewsOf(DIRECTIVE_KEYS)) {
    const k = DIRECTIVE_KEYS[v];
    // SPEC/31 §3.2: the routes through which the view's key accepts a plan as sound (`soundVia`), and §3.1's act coding on its keyed front.
    const routes = soundRoutes(k ?? null);
    const sound = !k || k.sound === null ? "—" : k.sound.length > 0 ? k.sound.join("|") : "— (no main-effort posture)";
    rows.push({ kind: "directive (posture)", id: `directive.${v}`, view: v === 0 ? "VP" : `V${v}`, itemFi: "Painopisteen toimintatapa", itemEn: "How the main effort works",
      keyFi: k ? `fit=${k.fit}; aligned=${k.aligned?.join("|") ?? "—"}; sound=${sound}${k.soundSectors ? `; soundSectors=${JSON.stringify(k.soundSectors)}` : ""}${k.soundSecondary ? `; soundSecondary=${JSON.stringify(k.soundSecondary)}` : ""}; soundVia=${routes.routes.join("|") || "—"}` : "(not scored)",
      keyEn: k ? `soundVia: ${routes.text}` : "", basis: k?.basis ?? "practice, not scored", basisRecords: recordsOf(k?.basisAtomIds ?? []) });
  }

  for (const v of viewsOf(SPAM_ITEMS)) {
    const item = SPAM_ITEMS[v]!, authored = SPAM_AUTHORED[v]!;
    rows.push({ kind: "SPAM", id: `probe.s.cycle_${v}`, view: `V${v}`, itemFi: `${item.prompt} [${item.options.join(" / ")}]`, itemEn: `${en(item.prompt)} [${item.options.map(en).join(" / ")}]`,
      keyFi: `${item.correct}: ${authored.key}`, keyEn: en(authored.key), basis: "pushed record(s) in the message log by the item's moment (SPAM_KEY_ATOMS)", basisRecords: recordsOf(SPAM_KEY_ATOMS[v] ?? []) });
  }
  const ps = scenario.practice.spam!;
  const psOptions = ps.response.kind === "categorical" ? ps.response.options : [];
  const psKey = psOptions.find((o) => o.fi === PRACTICE_SPAM_AUTHORED.key)!;
  let psRecord = "";
  try { psRecord = recordsOf([practiceSpamKeyRecordId()]); } catch (e) { psRecord = `KEY RECORD NOT FOUND: ${(e as Error).message}`; }
  rows.push({ kind: "SPAM (practice, not scored)", id: PRACTICE_SPAM_ID, view: "VP", itemFi: `${ps.prompt} [${psOptions.map((o) => o.fi).join(" / ")}]`, itemEn: `${en(ps.prompt)} [${psOptions.map((o) => en(o.fi)).join(" / ")}]`,
    keyFi: `${psKey.id}: ${psKey.fi}`, keyEn: en(psKey.fi), basis: "VPK's pushed VP water report", basisRecords: psRecord });
  // Difficulty audit (23 Oct 2026): the practice measuring task under the same "ready" (`practice-measure.ts`; key computed).
  const pm = scenario.practice.spamSecond;
  if (pm && pm.response.kind === "categorical") {
    const pmKey = pm.response.options.find((o) => o.id === PRACTICE_MEASURE.keyOptionId)!;
    rows.push({ kind: "SPAM (practice, not scored)", id: pm.id, view: "VP", itemFi: `${pm.prompt} [${pm.response.options.map((o) => o.fi).join(" / ")}]`, itemEn: `${en(pm.prompt)} [${pm.response.options.map((o) => en(o.fi)).join(" / ")}]`,
      keyFi: `${pmKey.id}: ${pmKey.fi}`, keyEn: en(pmKey.fi), basis: `measured on the map: the R3 bridge ${PRACTICE_MEASURE.fromOriginM} m from the point of origin, ${PRACTICE_MEASURE.fromHeadM} m from the drawn head`, basisRecords: "" });
  }

  const check = scenario.hinge.manipulationCheck!;
  const checkKey = scenario.invariants.find((i) => i.name === check.invariantName)!.expected as string;
  const checkLabel = check.options.find((o) => o.id === checkKey)!.labelFi;
  rows.push({ kind: "hinge check (and its post-session repeat)", id: check.id, view: "hinge", itemFi: `${check.promptFi} [${check.options.map((o) => o.labelFi).join(" / ")}]`, itemEn: `${en(check.promptFi)} [${check.options.map((o) => en(o.labelFi)).join(" / ")}]`,
    keyFi: `${checkKey}: ${checkLabel}`, keyEn: en(checkLabel), basis: "the directive delivered on the hinge screen", basisRecords: scenario.hinge.intentStatement });

  const covered = new Set([check.invariantName, ...viewsOf(SPAM_ITEMS).map((v) => `spam.cycle_${v}`)]);
  for (const inv of scenario.invariants.filter((i) => !covered.has(i.name))) {
    rows.push({ kind: "invariant", id: inv.name, view: "", itemFi: "", itemEn: "", keyFi: JSON.stringify(inv.expected), keyEn: "", basis: `tolerance ${inv.tolerance}`, basisRecords: "" });
  }
  // The AI literacy questionnaire (SNAIL, revision (ac)): self-report, no key; the item -> factor table instead.
  for (const it of AI_LITERACY_ITEMS) {
    rows.push({ kind: "AI literacy (SNAIL factor, published)", id: it.id, view: "after consent", itemFi: `Osaan… ${it.fi}`, itemEn: `I can… ${it.en}`,
      keyFi: it.factor, keyEn: it.factor, basis: `Laupichler et al. (2023), SNAIL, Table 1, ${it.variable}; scored as the factor's mean rating`, basisRecords: "" });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv<T extends object>(rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  const lines = [[...columns, "review"].join(","), ...rows.map((r) => [...columns.map((c) => csvCell(r[c])), ""].join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
function mdCell(v: unknown): string { return String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>"); }
export function toMarkdown<T extends object>(title: string, intro: string, rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  return [`# ${title}`, "", intro, "", `| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${columns.map((c) => mdCell(r[c])).join(" | ")} |`), ""].join("\n");
}

const STRING_COLS = ["id", "location", "fi", "en", "note"] as const;
const CORPUS_COLS = ["id", "step", "view", "source", "tier", "delivery", "fi", "en"] as const;
const KEY_COLS = ["kind", "id", "view", "itemFi", "itemEn", "keyFi", "keyEn", "basis", "basisRecords"] as const;

export interface PacketSummary { readonly dir: string; readonly files: readonly string[]; readonly strings: number; readonly corpus: number; readonly keys: number }

export function writeReviewPacket(outDir = DEFAULT_OUT_DIR): PacketSummary {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const strings = collectStrings(), corpus = collectCorpus(), keys = collectKeys();
  const files: [string, string][] = [
    ["strings.csv", toCsv(strings, STRING_COLS)],
    ["strings.md", toMarkdown("Participant-facing strings (DRAFT)", "Every string a participant can see, Finnish and English, with its id and where it is used. Templates show their arguments as {1}, {2}… For the native and domain reviewers.", strings, STRING_COLS)],
    ["corpus.csv", toCsv(corpus, CORPUS_COLS)],
    ["corpus.md", toMarkdown("Corpus records (DRAFT)", "Every record of the scenario: pushed (in the message log) or recorded (found by Haku and Thinker). Finnish is the source; English is what English sessions show. For the native and domain reviewers.", corpus, CORPUS_COLS)],
    ["keys.csv", toCsv(keys, KEY_COLS)],
    ["keys.md", toMarkdown("Draft answer keys (TRUTH — reviewers only)", "Every draft key with its basis and the records it rests on. For the domain reviewer and the expert panel; confirmatory analyses use panel-confirmed keys only (SPEC/27 §3.5, SPEC/09 revision (t)).", keys, KEY_COLS)],
  ];
  const readme = [
    "# Review packet", "",
    "Generated by `npm run review:export` (tools/review/export.ts). Contains answer keys: do not give it to participants.", "",
    `- strings.csv / strings.md — ${strings.length} participant-facing strings (fi, en). Native reviewer (English and Finnish wording); domain reviewer (terms, ranks, units).`,
    `- corpus.csv / corpus.md — ${corpus.length} corpus records (fi, en). Native and domain reviewers.`,
    `- keys.csv / keys.md — ${keys.length} draft keys with their basis. Domain reviewer and expert panel.`, "",
    "Each CSV has an empty `review` column for comments. CSV files are UTF-8 with a BOM, comma-separated.", "",
  ].join("\n");
  files.push(["README.md", readme]);
  for (const [name, text] of files) writeFileSync(join(dir, name), text);
  return { dir, files: files.map(([n]) => n), strings: strings.length, corpus: corpus.length, keys: keys.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const s = writeReviewPacket(process.argv[2] ?? DEFAULT_OUT_DIR);
  console.log(`review packet: ${s.strings} strings, ${s.corpus} corpus records, ${s.keys} keys -> ${s.dir}`);
}
