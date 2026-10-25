/**
 * `npx tsx tools/review/difficulty-audit.ts [outDir]` — the difficulty audit of 23 Oct 2026 (`docs/audits/2026-10-23-difficulty/`).
 * For every scored freeze item (V2, V4, V5, V7, V10, V12, V14), the practice freeze and every SPAM item (V3, V6, V8, V11 and the
 * second items V3.b, V6.b), it computes from the built scenario WHERE the key's records reach a participant before the item's moment:
 *
 * - pushed (the message log, without any action) or recorded only (reachable with Haku or the Thinker), and in which view;
 * - the item's moment in the view's own seconds (the freeze's pre-planned moment, or the view's minimum length for a view-end freeze;
 *   25 s for SPAM) and the record's arrival in the same seconds (a view's first-step records at 0 s, a merged view's second-step records
 *   at the step boundary, half the minimum length: `orchestrator.ts` `deliverPushed`, `time-gate.ts`), so the lead time is known;
 * - the lead of the LAST key record to arrive (an item that integrates records needs all of them), and whether it is under 60 s.
 *
 * The classification that needs judgement — channels (a)–(e), passive accessibility, map dependence, whether a map fact is stated in
 * no record — is the hand table `difficulty-audit-hand.ts` (one row per item, with its reason); this tool joins the two, checks that
 * every item has a hand row and that a hand "yes" never sits on an item whose key records are all recorded-only, and writes
 * `items.csv` and `summary.md`. The output contains TRUTH (the keys): for the researcher and the panel, never for participants.
 * Deterministic: no clock, no randomness; the same build writes the same bytes.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sortedKeys } from "../../app/engine/deterministic-object.js";
import { tr } from "../../app/i18n/text.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SPAM_AUTHORED, SPAM_KEY_ATOMS, SPAM_OFFSET_MS, SPAM_SECOND_AUTHORED, SPAM_SECOND_KEY_ATOMS } from "../../app/scenario/demo-probes.js";
import type { FreezeItem, InfoAtom, ScenarioContract, ViewSpec } from "../../app/scenario/types.js";
import { MAIN_VIEWS, PRACTICE_FREEZE_AT_S, STEP_SECONDS, viewOfStep } from "../../app/scenario/views.js";
import { POINTERS } from "../../app/scenario/pointers.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { clockAt } from "../../app/session/template-answer.js";
import { FREEZE_BANK } from "../../app/scenario/freeze-bank.js";
import { hybridRetrieve } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { HAND, type HandRow } from "./difficulty-audit-hand.js";
import { SEEK_QUESTIONS } from "./seek-questions.js";

/** A record's arrival is "late" when it reaches the participant less than this many view seconds before the item's moment. */
export const LATE_LEAD_S = 60;

export type AtomStatus = "pushed_before" | "recorded_before" | "after_moment" | "missing";

export interface AtomLead {
  readonly id: string;
  readonly tier: string;
  readonly status: AtomStatus;
  /** The view whose stream pushed it, or whose step made it reachable. */
  readonly view: number | null;
  /** View seconds between its arrival and the item's moment; null when it arrived in an earlier view (or not before the moment). */
  readonly leadS: number | null;
}

export interface AuditItem {
  readonly id: string;
  readonly kind: "freeze" | "spam";
  readonly view: number;
  readonly level: string;
  readonly goal: string;
  readonly format: string;
  readonly basisKind: string;
  readonly retrievalDependent: boolean;
  /** `FreezeItem.scoredFor` (`h9_only`, `exploratory`: play-test D6, R2): scored outside H2 and the SA composites; "" otherwise. */
  readonly scoredFor: string;
  readonly promptEn: string;
  readonly keyEn: string;
  readonly momentS: number;
  /**
   * Play-test R1 (25 Oct 2026): an L3 item's horizon in minutes from the header's "now", the end of the span of the view's latest reports
   * (the end of its last step), to the clock the key is read at (the end of `keySteps[1]`). The stems state that clock only; phase A's
   * horizons are a step shorter than the old "N minuutin kuluttua" counted from the span's start. Null for other items and the practice.
   */
  readonly horizonMin: number | null;
  readonly momentNote: string;
  readonly atoms: readonly AtomLead[];
  /** All key records pushed before the moment (the stream told everyone). */
  readonly allPushed: boolean;
  /** At least one key record reachable only by a search. */
  readonly needsSearch: boolean;
  /** The smallest lead among the key records that arrived in the item's own view; null when every one came earlier. */
  readonly latestLeadS: number | null;
  readonly late: boolean;
  readonly hand: HandRow;
  /** Pushed records the hand judgement rests on beyond the item's own key records (`HandRow.extra`). */
  readonly handAtoms: readonly AtomLead[];
}

const viewOfSpec = (s: ScenarioContract, index: number): ViewSpec => (index === 0 ? s.practice.cycle : s.cycles.find((c) => c.index === index)!);

/** View seconds at which a step's records arrive in `spec` (0 for its first step, the boundary for a merged view's second). */
function arrivalS(spec: ViewSpec, step: number): number {
  const first = spec.startsAtVirtual / STEP_SECONDS + 1;
  return step <= first ? 0 : spec.minViewSeconds / 2;
}

/** Where atom `id` stands at view `view`'s moment `momentS`. */
function atomLead(s: ScenarioContract, id: string, view: number, momentS: number): AtomLead {
  const atom: InfoAtom | undefined = s.atoms.find((a) => a.id === id);
  if (!atom) return { id, tier: "?", status: "missing", view: null, leadS: null };
  const order = [s.practice.cycle, ...s.cycles];
  for (const spec of order) {
    const k = spec.pushedAtomIds.indexOf(id);
    if (k < 0) continue;
    const t = spec.deliveryOffsetsSeconds[k]!;
    const at = spec.stepBoundary && t >= STEP_SECONDS ? spec.minViewSeconds / 2 : 0;
    if (spec.index < view) return { id, tier: atom.tier, status: "pushed_before", view: spec.index, leadS: null };
    if (spec.index === view && at <= momentS) return { id, tier: atom.tier, status: "pushed_before", view: spec.index, leadS: momentS - at };
    return { id, tier: atom.tier, status: "after_moment", view: spec.index, leadS: null };
  }
  // Recorded only: reachable once its step is reached (`time-gate.ts`).
  const reachView = order.find((spec) => {
    const first = spec.startsAtVirtual / STEP_SECONDS + 1;
    return atom.cycle >= first && atom.cycle < first + spec.steps;
  });
  const rv = reachView?.index ?? (atom.cycle < 1 ? 0 : null);
  if (rv === null || rv > view) return { id, tier: atom.tier, status: "after_moment", view: rv, leadS: null };
  if (rv < view) return { id, tier: atom.tier, status: "recorded_before", view: rv, leadS: null };
  const at = arrivalS(viewOfSpec(s, view), atom.cycle);
  return at <= momentS ? { id, tier: atom.tier, status: "recorded_before", view: rv, leadS: momentS - at } : { id, tier: atom.tier, status: "after_moment", view: rv, leadS: null };
}

function finish(s: ScenarioContract, base: Omit<AuditItem, "allPushed" | "needsSearch" | "latestLeadS" | "late" | "hand" | "handAtoms">): AuditItem {
  const hand = HAND[base.id];
  if (!hand) throw new Error(`difficulty audit: no hand row for ${base.id}`);
  const before = base.atoms.filter((a) => a.status === "pushed_before" || a.status === "recorded_before");
  const handAtoms = (hand.extra ?? []).map((id) => atomLead(s, id, base.view, base.momentS));
  for (const a of handAtoms) if (a.status !== "pushed_before") throw new Error(`difficulty audit: ${base.id}'s hand basis ${a.id} is not pushed before the moment (${a.status})`);
  // An item that integrates records needs the last of them; duplicate reports (`anyOf`) need only the first.
  const leadOf = (list: readonly AtomLead[]) => list.map((a) => (a.leadS === null ? Number.POSITIVE_INFINITY : a.leadS));
  const leads = leadOf(before);
  const keyLead = leads.length === 0 ? null : hand.anyOf ? Math.max(...leads) : Math.min(...leads);
  const handLead = handAtoms.length ? Math.max(...leadOf(handAtoms)) : null;
  const best = [keyLead, handLead].filter((x): x is number => x !== null);
  const lead = best.length ? Math.max(...best) : null;
  const latestLeadS = lead === null || lead === Number.POSITIVE_INFINITY ? null : lead;
  const allPushed = before.length > 0 && before.every((a) => a.status === "pushed_before");
  const needsSearch = before.some((a) => a.status === "recorded_before");
  if (hand.passive === "yes" && before.length > 0 && !before.some((a) => a.status === "pushed_before") && handAtoms.length === 0 && !hand.stemSuffices) {
    throw new Error(`difficulty audit: ${base.id} is hand-classed passive "yes" but every key record before its moment is recorded-only`);
  }
  if (hand.passive === "no" && allPushed) throw new Error(`difficulty audit: ${base.id} is hand-classed passive "no" but every key record is pushed`);
  // A SPAM item is answered with the log and the tools open and its prompt waits for "ready", so only a freeze (answered from memory,
  // the screen blanked) can come too soon after its record.
  const late = base.kind === "freeze" && latestLeadS !== null && latestLeadS < LATE_LEAD_S;
  return { ...base, allPushed, needsSearch, latestLeadS, late, hand, handAtoms };
}

const keyLabel = (it: FreezeItem) => (it.kind === "map_point" ? `map point (${it.mapKey!.toleranceM} m)` : tr("en", it.options.find((o) => o.correct)!.labelFi));

export function auditItems(): AuditItem[] {
  const s = buildDemoScenario();
  const out: AuditItem[] = [];
  const freezeItem = (view: number, it: FreezeItem, momentS: number, momentNote: string) => {
    const ids = [...new Set([...(it.keyAtomIds ?? []), ...(it.basisAtomIds ?? [])])];
    const def = view === 0 ? undefined : (FREEZE_BANK[view] ?? []).find((d) => it.id === `freeze.${view}.${d.slug}`);
    const lastStep = MAIN_VIEWS.find((v) => v.index === view)?.steps.at(-1);
    const horizonMin = def?.keySteps && lastStep !== undefined && it.level === "L3" ? (def.keySteps[1] - lastStep) * 20 : null;
    out.push(finish(s, {
      id: it.id, kind: "freeze", view, level: it.level, goal: it.goal ?? "", format: it.kind ?? "choice", basisKind: it.basisKind ?? "",
      retrievalDependent: it.retrievalDependent === true, scoredFor: it.scoredFor ?? "", promptEn: tr("en", it.promptFi), keyEn: keyLabel(it), momentS, momentNote,
      horizonMin, atoms: ids.map((id) => atomLead(s, id, view, momentS)),
    }));
  };
  for (const it of s.practice.freeze.items) freezeItem(0, it, PRACTICE_FREEZE_AT_S, "fixed, after the tour");
  for (const f of s.freezes) {
    const spec = viewOfSpec(s, f.cycle);
    const atEnd = spec.freezeAtSeconds === null;
    for (const it of f.items) freezeItem(f.cycle, it, atEnd ? spec.minViewSeconds : spec.freezeAtSeconds!, atEnd ? "view end (at least the minimum length)" : "pre-planned moment");
  }
  const spamMoment = SPAM_OFFSET_MS / 1000;
  const spam = (view: number, suffix: string, prompt: string, key: string, level: number, ids: readonly string[]) => out.push(finish(s, {
    id: `probe.s.cycle_${view}${suffix}`, kind: "spam", view, level: `L${level}`, goal: "", format: "choice", basisKind: "", retrievalDependent: false, scoredFor: "",
    promptEn: tr("en", prompt), keyEn: tr("en", key), momentS: spamMoment, momentNote: "ready prompt at 25 s; answered with the tools at hand", horizonMin: null,
    atoms: ids.map((id) => atomLead(s, id, view, spamMoment)),
  }));
  for (const v of [3, 6, 8, 11]) {
    const a = SPAM_AUTHORED[v]!;
    spam(v, "", a.prompt, a.key, a.saLevel, SPAM_KEY_ATOMS[v]!);
    const b = SPAM_SECOND_AUTHORED[v];
    if (b) spam(v, ".b", b.prompt, b.key, b.saLevel, SPAM_SECOND_KEY_ATOMS[v]!);
  }
  return out;
}

/** Per view: the records its stream pushes, and the records of its steps that are never pushed (reachable only with the tools). */
export function recordsPerView(): { readonly view: number; readonly pushed: number; readonly recorded: number }[] {
  const s = buildDemoScenario();
  const pushed = new Set<string>();
  const specs = [s.practice.cycle, ...s.cycles];
  for (const spec of specs) for (const id of spec.pushedAtomIds) pushed.add(id);
  return specs.map((spec) => {
    const first = spec.startsAtVirtual / STEP_SECONDS + 1;
    const own = s.atoms.filter((a) => a.cycle >= first && a.cycle < first + spec.steps && !pushed.has(a.id));
    return { view: spec.index, pushed: spec.pushedAtomIds.length, recorded: own.length };
  });
}

/**
 * Findability (lexical half only): for the items whose key needs a recorded-only record, one plain question a participant might ask
 * (authored here, neutral: it names the topic, never the key's wording), run through the Haku chat's retrieval (`hybridRetrieve`, the
 * frozen configuration, top 8) over the records reachable at the item's moment. The vector half needs the embedding model, which this
 * environment does not have, so the ranks are the lexical half's at full weight: an approximation of what the model is given.
 */
export const FINDABILITY_QUERIES: Readonly<Record<string, { readonly fi: readonly string[]; readonly en: readonly string[]; readonly records?: readonly string[] }>> = {
  "freeze.2.infra": { fi: ["Mikä on tien R1 tilanne?", "tiehavainto tie R1"], en: ["What is the state of road R1?", "road report road R1"] },
  "freeze.2.area_40": { fi: ["Kuinka suuri palanut ala on?"], en: ["How large is the burnt area?"], records: ["evt.c02.028", "evt.c03.035"] },
  "freeze.4.infra": { fi: ["Voiko Haukilammelta täyttää säiliöitä?"], en: ["Can tankers fill up at Pike Pond?"] },
  "freeze.5.infra": { fi: ["Mikä on tien R1 tilanne?", "tiehavainto tie R1"], en: ["What is the state of road R1?", "road report road R1"] },
  "freeze.5.ek14_shelter": { fi: ["Mikä on sääennuste?", "Miten tuuli muuttuu?"], en: ["What is the weather forecast?", "How will the wind change?"] },
  "freeze.7.infra": { fi: ["Voiko Kotkanjoelta täyttää säiliöitä?"], en: ["Can tankers fill up at Eagle River?"] },
  "freeze.10.ek12_water": { fi: ["Saako EK12 lisää vettä?"], en: ["Is EK12 getting more water?"] },
  "freeze.10.area_growth_hour": { fi: ["Kuinka nopeasti uusi palo kasvaa?"], en: ["How fast is the new fire growing?"], records: ["atom.demo.12.1", "evt.c13.010", "evt.c13.034"] }, // play-test D5: the growth (was area_total_hour)
  "freeze.10.cabins_distance": { fi: ["Kuinka kaukana palo on Mökkirannasta?"], en: ["How far is the fire from the Lakeside Cottages?"] },
  "freeze.12.longest_shift": { fi: ["Kuinka kauan miehistöt ovat olleet kentällä?"], en: ["How long have the crews been in the field?"] },
  "freeze.12.f7": { fi: ["Onko sähkölinja jännitteinen?"], en: ["Is the power line live?"] },
  "freeze.12.front_toward": { fi: ["Mihin suuntaan palon kärki etenee?"], en: ["Which way is the head of the fire spreading?"] },
  "probe.s.cycle_3.b": { fi: ["Kuinka suuri palanut ala on?"], en: ["How large is the burnt area?"] },
  "probe.s.cycle_6.b": { fi: ["Mikä on tien R1 tilanne?", "tiehavainto tie R1"], en: ["What is the state of road R1?", "road report road R1"] },
  // Revision (bk), 25 Oct 2026: the converted seek-dependent items' questions (`seek-questions.ts`); V5 wind_shift's row went with it.
  ...Object.fromEntries(SEEK_QUESTIONS.map((q) => [q.itemId, { fi: q.fi, en: q.en, records: q.records }])),
};

/**
 * Revision (bm), 25 Oct 2026: every record a scored item rests on — its key and basis records, the hand table's pushed basis
 * (`extra`), the findability records — and the pushed records an item relies on by content (`CITED_BY_CONTENT`). The push cap's pointer
 * displacement (`tools/fire-ca/view-traffic.ts` `displaceForPointers`) never moves one; `test/scenario/pointers.spec.ts` checks it.
 */
export function itemRecordIds(items: readonly AuditItem[] = auditItems()): ReadonlySet<string> {
  const ids = new Set<string>(CITED_BY_CONTENT.map((c) => c.id));
  for (const i of items) for (const a of [...i.atoms, ...i.handAtoms]) ids.add(a.id);
  for (const k of sortedKeys(FINDABILITY_QUERIES)) for (const r of FINDABILITY_QUERIES[k]!.records ?? []) ids.add(r);
  return ids;
}

/**
 * Revision (bm): pushed records an item relies on by their content although no key, basis or hand list names them (the hand notes
 * describe them), and the H10 arc's place: kept in the stream when the pointers need slots.
 */
export const CITED_BY_CONTENT: readonly { readonly id: string; readonly why: string }[] = [
  { id: "evt.c03.015", why: "V2 junction_hour, head_later: 'the pushed rate (DR1 7.1 m/min)', DR1's 14.05 thermal image" },
  { id: "evt.c03.032", why: "H10: VPK's 14.14 report on the origin's south edge, the rekindle arc's place and actor" },
  { id: "evt.c10.029", why: "SPAM V8: EK14's first question whether the Lakeside cottages are checked (the key record repeats it)" },
  { id: "evt.c10.032", why: "V7 north_help: EK15 waiting at the command post for a task, the unit one would send" },
  { id: "evt.c17.012", why: "V12 village_distance: 'the rate (map or pushed DR2)', DR2's 18.45 thermal image" },
];

export interface Findability { readonly id: string; readonly lang: "fi" | "en"; readonly query: string; readonly step: number; readonly ranks: readonly { readonly id: string; readonly rank: number | null }[] }

export function findability(items: readonly AuditItem[]): Findability[] {
  const s = buildDemoScenario();
  const out: Findability[] = [];
  for (const i of items) {
    const q = FINDABILITY_QUERIES[i.id];
    if (!q) continue;
    const spec = viewOfSpec(s, i.view);
    const first = spec.startsAtVirtual / STEP_SECONDS + 1;
    const step = first + (spec.steps === 2 && i.momentS >= spec.minViewSeconds / 2 ? 1 : 0);
    const recorded = q.records ?? i.atoms.filter((a) => a.status === "recorded_before").map((a) => a.id);
    for (const lang of ["fi", "en"] as const) {
      for (const query of q[lang]) {
        const ranked = hybridRetrieve(query, reachableAtoms(s.atoms, step), null, undefined, lang).map((r) => r.atom.id);
        out.push({ id: i.id, lang, query, step, ranks: recorded.map((id) => ({ id, rank: ranked.includes(id) ? ranked.indexOf(id) + 1 : null })) });
      }
    }
  }
  return out;
}

const csvCell = (v: string | number | boolean | null): string => {
  const t = v === null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const atomCell = (a: AtomLead) => `${a.id}:${a.tier}:${a.status}${a.view !== null ? `:V${a.view}` : ""}${a.leadS !== null ? `:${a.leadS}s` : ""}`;

export function itemsCsv(items: readonly AuditItem[]): string {
  // Play-test R1, R2 (25 Oct 2026): `horizon_min` (from the header's "now") and `scored_for` (outside H2 and the composites) added.
  const head = ["id", "kind", "view", "level", "goal", "format", "basis_kind", "retrieval_dependent", "scored_for", "prompt_en", "key_en", "moment_s", "horizon_min", "key_records",
    "hand_basis_records", "all_key_pushed", "key_needs_search", "latest_lead_s", "late_lt60s", "channels", "passive", "map_dependence", "map_fact_unstated", "seek_channel", "note"];
  const rows = items.map((i) => [i.id, i.kind, i.view === 0 ? "VP" : `V${i.view}`, i.level, i.goal, i.format, i.basisKind, i.retrievalDependent, i.scoredFor, i.promptEn, i.keyEn, i.momentS, i.horizonMin,
    i.atoms.map(atomCell).join(" "), i.handAtoms.map(atomCell).join(" "), i.allPushed, i.needsSearch, i.latestLeadS, i.late, i.hand.channels, i.hand.passive, i.hand.map, i.hand.mapUnstated, i.hand.seek, i.hand.note].map(csvCell).join(","));
  return `${[head.join(","), ...rows].join("\n")}\n`;
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${n}/${d} (${Math.round((100 * n) / d)} %)`);

export function summaryMd(items: readonly AuditItem[]): string {
  const scored = items.filter((i) => i.view !== 0);
  const lines: string[] = ["# Difficulty audit — computed summary (`tools/review/difficulty-audit.ts`)", "",
    "Generated; do not edit by hand. Passive = a participant who never searches can answer (yes); partly = part of the basis is pushed or drawn.", ""];
  const table = (title: string, groups: readonly [string, readonly AuditItem[]][]) => {
    lines.push(`## ${title}`, "", "| Group | Items | Passive yes | Passive partly | Passive no | A key record recorded-only | Map required | Freeze record late (< 60 s) |", "|---|---|---|---|---|---|---|---|");
    for (const [g, list] of groups) {
      const n = list.length;
      const c = (f: (i: AuditItem) => boolean) => pct(list.filter(f).length, n);
      lines.push(`| ${g} | ${n} | ${c((i) => i.hand.passive === "yes")} | ${c((i) => i.hand.passive === "partly")} | ${c((i) => i.hand.passive === "no")} | ${c((i) => i.needsSearch)} | ${c((i) => i.hand.map === "required")} | ${c((i) => i.late)} |`);
    }
    lines.push("");
  };
  const views = [...new Set(items.map((i) => i.view))];
  table("Per view (the practice view VP included, not scored)", views.map((v) => [`${v === 0 ? "VP" : `V${v}`} ${items.find((i) => i.view === v)!.kind}`, items.filter((i) => i.view === v)] as const));
  table("Per SA level (scored items only)", ["L1", "L2", "L3"].map((l) => [l, scored.filter((i) => i.level === l)] as const));
  // Play-test R2 (25 Oct 2026): an item scored outside the composites (`scored_for`, V4's exploratory head_later) is out of H2's window.
  const h2 = scored.filter((i) => i.kind === "freeze" && i.view <= 7 && i.level !== "L1" && i.scoredFor === "");
  table("Per probe kind (scored items only)", [["freeze", scored.filter((i) => i.kind === "freeze")], ["SPAM", scored.filter((i) => i.kind === "spam")], ["all", scored], ["H2 window (V2–V7 freeze L2/L3, composite items)", h2]]);
  lines.push("## Items scored outside H2 and the SA composites (`scored_for`)", "");
  for (const i of items.filter((x) => x.scoredFor !== "")) lines.push(`- \`${i.id}\` (${i.level}): ${i.scoredFor}`);
  lines.push("", "## L3 horizons from the header's \"now\" (play-test R1: the stems state the clock only)", "",
    "| View | Items: minutes from the end of the latest reports' span to the key's clock |", "|---|---|");
  for (const v of views.filter((x) => x !== 0)) {
    const l3 = items.filter((i) => i.view === v && i.horizonMin !== null);
    if (l3.length) lines.push(`| V${v} | ${l3.map((i) => `\`${i.id.split(".").at(-1)}\` ${i.horizonMin}`).join(", ")} |`);
  }
  lines.push("");
  lines.push("## Records per view: what the stream shows and what waits in the records", "",
    "| View | Pushed to the log | Recorded only (Haku / Thinker), of the view's steps | Share pushed |", "|---|---|---|---|");
  for (const r of recordsPerView()) lines.push(`| ${r.view === 0 ? "VP" : `V${r.view}`} | ${r.pushed} | ${r.recorded} | ${pct(r.pushed, r.pushed + r.recorded)} |`);
  // Revision (bm), 25 Oct 2026: the pointers are among the pushed above; they carry no content, so no item's class rests on them.
  lines.push("", "## \"Report filed\" pointers (revision (bm)): pushed, content-free, counted among the pushed above", "",
    "| Pointer | View | Clock | Line | Record it points to | Kind | Items whose record it is |", "|---|---|---|---|---|---|---|");
  const s = buildDemoScenario();
  for (const p of POINTERS) {
    const a = s.atoms.find((x) => x.id === p.id)!;
    lines.push(`| \`${p.id}\` | V${viewOfStep(p.step)!.index} | ${clockAt(a.provenance.observedAt)} | ${p.fi} | \`${p.to}\` | ${p.kind} | ${p.serves.map((x) => `\`${x}\``).join(", ") || "—"} |`);
  }
  lines.push("", `Displaced from the stream to the records by the pointers (\`site-scenario.json\` \`pointerDisplaced\`, none an item's record): ${(SITE_SCENARIO.pointerDisplaced ?? []).map((x) => `\`${x}\``).join(", ")}.`);
  lines.push("", "## Items whose key rests on a map fact (or a fact on no surface) that no record states before the moment", "");
  for (const i of items.filter((x) => x.hand.mapUnstated)) lines.push(`- \`${i.id}\` (${i.level}): ${i.hand.note}`);
  lines.push("", `## Freeze items whose last key record arrives less than ${LATE_LEAD_S} s before the freeze`, "");
  for (const i of items.filter((x) => x.late)) lines.push(`- \`${i.id}\` (${i.level}): lead ${i.latestLeadS} s; ${[...i.atoms, ...i.handAtoms].filter((a) => a.leadS !== null && a.leadS < LATE_LEAD_S).map(atomCell).join(", ")}`);
  lines.push("", "## Findability of the recorded-only key records (Haku's retrieval, lexical half, top 8)", "",
    "| Item | Lang | Question | Step reached | Rank of each recorded key record (— = not in the top 8) |", "|---|---|---|---|---|");
  for (const f of findability(items)) lines.push(`| \`${f.id}\` | ${f.lang} | ${f.query} | ${f.step} | ${f.ranks.map((r) => `${r.id}: ${r.rank ?? "—"}`).join("; ")} |`);
  lines.push("");
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const out = resolve(process.argv[2] ?? join(here, "../../docs/audits/2026-10-23-difficulty"));
  mkdirSync(out, { recursive: true });
  const items = auditItems();
  writeFileSync(join(out, "items.csv"), itemsCsv(items));
  writeFileSync(join(out, "summary.md"), summaryMd(items));
  process.stdout.write(`difficulty audit: ${items.length} items → ${out}\n`);
}
