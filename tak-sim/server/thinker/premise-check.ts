/**
 * SPEC/30 §3 (19 Oct 2026): the guide's rule-based premise check. A premise-evidence table
 * (`content/thinker/premise-evidence.json`, DRAFT study content for the panel, hashed in the Thinker manifest) gives,
 * for each phase-B view and each authored directive premise (P1, P2), `contradicted` or `not_contradicted`, and for a
 * contradiction the deciding records' atom ids and the virtual time from which it holds. The server looks the status
 * up here ({@link premiseCheck}, a pure function of the table, the view and the records clock) and shows it in a fixed
 * template ({@link premiseCheckShown}); the model's own rating of a premise is never used.
 */

import { readFileSync } from "node:fs";
import { sourceName } from "../../app/i18n/text.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import {
  PREMISE_CHECK_STATUSES, type OpenPremiseCheck, type OpenPremiseCheckItem, type PremiseCheckStatus,
} from "../../app/session/open-answer.js";
import { clockAt } from "../../app/session/template-answer.js";
import { normaliseNewlines, repoPath, sha256Hex } from "./config.js";
import { DIRECTIVE_PREMISE_IDS, premiseText, type DirectivePremises, type PremiseBlockStatus } from "./directive-premises.js";

export const PREMISE_EVIDENCE_FILE = "content/thinker/premise-evidence.json";

/** The views the table covers: phase B, from the hinge (V8) to the last view (V14). */
export const PREMISE_EVIDENCE_VIEWS = [8, 9, 10, 11, 12, 13, 14] as const;

export interface PremiseEvidenceEntry {
  readonly status: PremiseCheckStatus;
  /** The deciding records (contradicted only; empty otherwise). */
  readonly atomIds: readonly string[];
  /** Records-clock virtual seconds from which the contradiction holds (contradicted only; null otherwise). */
  readonly fromVirtualS: number | null;
  readonly note: string;
}

export interface PremiseEvidence {
  readonly version: number;
  readonly draft: boolean;
  /** sha256 of `content/thinker/directive-premises.json` (the manifest's `directivePremises.sha256`) the table was written for. */
  readonly directivePremisesSha256: string;
  /** Per view index (8–14), per premise id. */
  readonly views: Readonly<Record<number, Readonly<Record<string, PremiseEvidenceEntry>>>>;
  /** sha256 of the file's text (LF-normalised): the manifest's `premiseEvidence.sha256`. */
  readonly sha256: string;
}

const fail = (why: string): never => { throw new Error(`premise-evidence.json: ${why}`); };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseEntry(view: string, id: string, raw: unknown): PremiseEvidenceEntry {
  if (!isRecord(raw)) return fail(`${view} ${id} is not an object`);
  const { status, atomIds, fromVirtualS, note } = raw;
  if (!PREMISE_CHECK_STATUSES.includes(status as PremiseCheckStatus)) return fail(`${view} ${id}: status must be contradicted or not_contradicted`);
  if (typeof note !== "string" || !note.trim()) return fail(`${view} ${id} lacks a note`);
  if (status === "not_contradicted") {
    if (atomIds !== undefined || fromVirtualS !== undefined) return fail(`${view} ${id}: a premise not contradicted has no atomIds or fromVirtualS`);
    return { status, atomIds: [], fromVirtualS: null, note };
  }
  if (!Array.isArray(atomIds) || atomIds.length === 0 || !atomIds.every((a) => typeof a === "string" && a.length > 0)) return fail(`${view} ${id}: a contradiction needs its deciding atomIds`);
  if (new Set(atomIds).size !== atomIds.length) return fail(`${view} ${id}: a repeated atom id`);
  if (typeof fromVirtualS !== "number" || !Number.isFinite(fromVirtualS)) return fail(`${view} ${id}: a contradiction needs fromVirtualS`);
  return { status: "contradicted", atomIds: atomIds as string[], fromVirtualS, note };
}

/** Parses and validates the file's text: every view V8–V14, each with exactly the authored premise ids. Throws on a malformed file. */
export function parsePremiseEvidence(rawText: string): PremiseEvidence {
  const text = normaliseNewlines(rawText);
  const json: unknown = JSON.parse(text);
  if (!isRecord(json)) return fail("not an object");
  const { version, draft, directivePremisesSha256, views } = json;
  if (typeof version !== "number" || typeof draft !== "boolean" || typeof directivePremisesSha256 !== "string" || !/^[0-9a-f]{64}$/.test(directivePremisesSha256) || !isRecord(views)) {
    return fail("needs version, draft, directivePremisesSha256 and views");
  }
  const keys = Object.keys(views);
  const expected = PREMISE_EVIDENCE_VIEWS.map((v) => `V${v}`);
  if (keys.join(",") !== expected.join(",")) return fail(`views must be ${expected.join(", ")} in order (got ${keys.join(", ")})`);
  const out: Record<number, Record<string, PremiseEvidenceEntry>> = {};
  for (const view of PREMISE_EVIDENCE_VIEWS) {
    const raw = views[`V${view}`];
    if (!isRecord(raw) || Object.keys(raw).join(",") !== DIRECTIVE_PREMISE_IDS.join(",")) return fail(`V${view} needs exactly ${DIRECTIVE_PREMISE_IDS.join(", ")} in order`);
    out[view] = Object.fromEntries(DIRECTIVE_PREMISE_IDS.map((id) => [id, parseEntry(`V${view}`, id, raw[id])]));
  }
  return { version, draft, directivePremisesSha256, views: out, sha256: sha256Hex(text) };
}

let cached: PremiseEvidence | undefined;

/** The frozen table, read once. */
export function loadPremiseEvidence(): PremiseEvidence {
  cached ??= parsePremiseEvidence(readFileSync(repoPath(PREMISE_EVIDENCE_FILE), "utf8"));
  return cached;
}

/**
 * Startup check (like `checkDirectivePremises`): the file's hash is the manifest's, it was written for the authored premises in
 * force, and every deciding record exists in the scenario and is received by the time the contradiction holds (`fromVirtualS` is not
 * earlier than its observation). Throws a message naming the problem.
 */
export function checkPremiseEvidence(table: PremiseEvidence, manifestSha256: string | undefined, premises: DirectivePremises, atoms: readonly InfoAtom[]): void {
  if (table.sha256 !== manifestSha256) throw new Error(`the premise-evidence table's hash ${table.sha256} differs from the manifest's ${manifestSha256 ?? "(none)"}; run \`npm run thinker:index -- --manifest-only\``);
  if (table.directivePremisesSha256 !== premises.sha256) throw new Error(`the premise-evidence table was written for directive premises with hash ${table.directivePremisesSha256}, the file's is ${premises.sha256}`);
  const byId = new Map(atoms.map((a) => [a.id, a]));
  for (const [view, entries] of Object.entries(table.views)) {
    for (const [id, e] of Object.entries(entries)) {
      for (const atomId of e.atomIds) {
        const atom = byId.get(atomId);
        if (!atom) throw new Error(`premise-evidence V${view} ${id}: no record ${atomId} in the scenario`);
        if (e.fromVirtualS! < atom.provenance.observedAt) throw new Error(`premise-evidence V${view} ${id}: fromVirtualS ${e.fromVirtualS} is before ${atomId} is received (${atom.provenance.observedAt})`);
      }
    }
  }
}

/** One authored premise's status at a records clock, as the check returns it. */
export interface PremiseCheckResult extends OpenPremiseCheckItem {
  /** When the contradiction holds from (contradicted only; null otherwise). */
  readonly fromVirtualS: number | null;
}

/**
 * The premise check: per authored premise (in the table's order, P1 first) its status in `view` at the records clock
 * `recordsClockS` (virtual seconds; the latest observation among the time-gated records). A premise is contradicted only once the
 * clock has reached its `fromVirtualS`; before that it is not contradicted and cites nothing. Null for a view the table does not
 * cover (phase A, the practice view). Pure.
 */
export function premiseCheck(table: PremiseEvidence, view: number, recordsClockS: number): PremiseCheckResult[] | null {
  const entries = table.views[view];
  if (!entries) return null;
  return Object.entries(entries).map(([id, e]) => (e.status === "contradicted" && recordsClockS >= e.fromVirtualS!
    ? { id, status: "contradicted" as const, atomIds: [...e.atomIds], fromVirtualS: e.fromVirtualS }
    : { id, status: "not_contradicted" as const, atomIds: [], fromVirtualS: null }));
}

/** A deciding record's source and time, looked up by atom id (the scenario's atoms). */
export type RecordLookup = (atomId: string) => Pick<InfoAtom, "provenance"> | undefined;

export const recordLookupOf = (atoms: readonly InfoAtom[]): RecordLookup => {
  const byId = new Map(atoms.map((a) => [a.id, a]));
  return (atomId) => byId.get(atomId);
};

/**
 * The fixed template's wording. The Finnish is DRAFT for the native speaker's check (SPEC/30 §8). `{id}` and `{text}` are the
 * authored premise's id and text (session language, final full stop dropped); `{records}` the deciding records ("EK16 19.12").
 */
export const PREMISE_LINE_TEMPLATE = {
  en: { contradicted: "{id} {text} — no longer holds: {records}.", none: "Directive premises: no newest record contradicts {ids}.", or: "or" },
  fi: { contradicted: "{id} {text} — ei enää päde: {records}.", none: "Linjauksen lähtöoletukset: mikään uusin tieto ei kumoa oletuksia {ids}.", or: "ja" },
} as const;

/** A record as the template cites it: its source (the screen's name in English) and its clock time ("EK16 19.12", fi "EK16 klo 19.12"). */
export function recordCitation(atom: Pick<InfoAtom, "provenance">, lang: "fi" | "en"): string {
  const time = clockAt(atom.provenance.observedAt);
  return lang === "en" ? `${sourceName("en", atom.provenance.sourceId)} ${time}` : `${atom.provenance.sourceId} klo ${time}`;
}

/** The deciding records as cited, in the table's order; an id the scenario lacks is left out (the startup check refuses such a table). */
function citationsOf(atomIds: readonly string[], lookup: RecordLookup, lang: "fi" | "en"): string[] {
  return atomIds.flatMap((id) => { const atom = lookup(id); return atom ? [recordCitation(atom, lang)] : []; });
}

/** "P1 or P2" / "P1 ja P2" (and "P1, P2 or P3"). */
function idList(ids: readonly string[], lang: "fi" | "en"): string {
  return ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} ${PREMISE_LINE_TEMPLATE[lang].or} ${ids.at(-1)}`;
}

/** The fixed-template lines for a check: one per contradicted premise, or the one "no newest record contradicts" line. */
export function premiseLines(items: readonly OpenPremiseCheckItem[], premises: DirectivePremises, lookup: RecordLookup, lang: "fi" | "en"): string[] {
  const t = PREMISE_LINE_TEMPLATE[lang];
  const contradicted = items.filter((i) => i.status === "contradicted");
  if (contradicted.length === 0) return [t.none.replace("{ids}", idList(premises.premises.map((p) => p.id), lang))];
  return contradicted.map((item) => {
    const authored = premises.premises.find((p) => p.id === item.id);
    const text = authored ? premiseText(authored, lang).trim().replace(/[.。]+$/, "") : item.id;
    const records = citationsOf(item.atomIds, lookup, lang).join(", ");
    return t.contradicted.replace("{id}", item.id).replace("{text}", text).replace("{records}", records);
  });
}

/** The check as the system instruction's premises block states it to the model (`premisesBlock`): status and deciding records as cited. */
export function premiseBlockStatuses(items: readonly OpenPremiseCheckItem[], lookup: RecordLookup, lang: "fi" | "en"): PremiseBlockStatus[] {
  return items.map((i) => ({ id: i.id, status: i.status, records: citationsOf(i.atomIds, lookup, lang) }));
}

/** The check as the answer carries it (`OpenStructuredAnswer.premiseCheck`): the statuses, the template lines and whether a flag is shown. */
export function premiseCheckShown(table: PremiseEvidence, items: readonly OpenPremiseCheckItem[], premises: DirectivePremises, lookup: RecordLookup, lang: "fi" | "en"): OpenPremiseCheck {
  return {
    tableVersion: table.version,
    items: items.map((i) => ({ id: i.id, status: i.status, atomIds: [...i.atomIds] })),
    lines: premiseLines(items, premises, lookup, lang),
    flagShown: items.some((i) => i.status === "contradicted"),
  };
}
