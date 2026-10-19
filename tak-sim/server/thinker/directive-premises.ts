/**
 * The directive's authored premises (SPEC/14 revision (ar), 11 Oct 2026): two conditions the
 * directive's stated reasons assume, written by the researcher once, frozen (their hash is in the manifest)
 * and identical for every participant. DRAFT study material: instructors check the content and a native speaker the
 * Finnish before the pilot (`11` §7.27). SPEC/30 §3 (19 Oct 2026): the Open Thinker no longer rates them; the server's
 * premise check (`premise-check.ts`, the premise-evidence table) gives each one's status, and the block after the directive
 * tells the model that status (it may not rate, add or reword a premise).
 */

import { readFileSync } from "node:fs";
import type { PremiseCheckStatus } from "../../app/session/open-answer.js";
import { normaliseNewlines, repoPath, sha256Hex } from "./config.js";

export const DIRECTIVE_PREMISES_FILE = "content/thinker/directive-premises.json";

/** The ids the model may use (the response schema's enum). The file must carry exactly these. */
export const DIRECTIVE_PREMISE_IDS = ["P1", "P2"] as const;

export interface AuthoredPremise {
  readonly id: string;
  readonly fi: string;
  readonly en: string;
}

export interface DirectivePremises {
  readonly version: number;
  /** sha256 of the directive text (`hinge.intentStatement`, Finnish, LF) the premises were written for. */
  readonly directiveSha256: string;
  readonly premises: readonly AuthoredPremise[];
  /** sha256 of the file's text (LF-normalised): the manifest's `directivePremises.sha256`. */
  readonly sha256: string;
}

/** Parses and validates the file's text; throws on a malformed file. */
export function parseDirectivePremises(rawText: string): DirectivePremises {
  const text = normaliseNewlines(rawText);
  const json = JSON.parse(text) as { version?: unknown; directiveSha256?: unknown; premises?: unknown };
  if (typeof json.version !== "number" || typeof json.directiveSha256 !== "string" || !Array.isArray(json.premises)) throw new Error("directive-premises.json: malformed");
  const premises = json.premises.map((p: { id?: unknown; fi?: unknown; en?: unknown }) => {
    if (typeof p.id !== "string" || typeof p.fi !== "string" || typeof p.en !== "string" || !p.fi.trim() || !p.en.trim()) throw new Error("directive-premises.json: a premise lacks id, fi or en");
    return { id: p.id, fi: p.fi, en: p.en };
  });
  if (premises.map((p) => p.id).join(",") !== DIRECTIVE_PREMISE_IDS.slice(0, premises.length).join(",") || premises.length < 2 || premises.length > DIRECTIVE_PREMISE_IDS.length) {
    throw new Error("directive-premises.json: needs the premises P1, P2 in order");
  }
  return { version: json.version, directiveSha256: json.directiveSha256, premises, sha256: sha256Hex(text) };
}

let cached: DirectivePremises | undefined;

/** The frozen premises, read once. */
export function loadDirectivePremises(): DirectivePremises {
  cached ??= parseDirectivePremises(readFileSync(repoPath(DIRECTIVE_PREMISES_FILE), "utf8"));
  return cached;
}

/**
 * Startup check (like the prompts'): the file's hash is the manifest's, and the premises were written for the
 * directive text the scenario carries. Throws a message naming the problem.
 */
export function checkDirectivePremises(dp: DirectivePremises, manifestSha256: string | undefined, directiveText: string): void {
  if (dp.sha256 !== manifestSha256) throw new Error(`the directive premises' hash ${dp.sha256} differs from the manifest's ${manifestSha256 ?? "(none)"}; run \`npm run thinker:index\``);
  const directive = sha256Hex(normaliseNewlines(directiveText));
  if (dp.directiveSha256 !== directive) throw new Error(`the directive premises were written for a directive with hash ${dp.directiveSha256}, the scenario's is ${directive}`);
}

/**
 * The label of the premises block after the directive. SPEC/30 §3: the block carries the server's premise check (the table's
 * status of each authored premise at the request's records clock); the model writes options around it and does not rate premises.
 * The Finnish is DRAFT for the native speaker's check (SPEC/30 §8).
 */
export const PREMISES_BLOCK_LABEL = {
  fi: "Linjauksen lähtöoletukset (laadittu valmiiksi) ja järjestelmän lähtöoletustarkistus tällä hetkellä (järjestelmä näyttää tarkistuksen johtajalle itse; älä arvioi, toista, lisää tai muotoile lähtöoletuksia uudelleen)",
  en: "Directive premises (authored) with the system's premise check at this moment (the system shows the check to the commander itself; do not rate, restate, add or reword premises)",
} as const;

/** How the block states a premise's status to the model (`{records}`: the deciding records, "SPOT 17.01"). Finnish DRAFT. */
export const PREMISE_STATUS_FOR_MODEL = {
  fi: { contradicted: "uusimmat tiedot kumoavat: {records}", not_contradicted: "uusimmat tiedot eivät kumoa" },
  en: { contradicted: "contradicted by the newest records: {records}", not_contradicted: "not contradicted by the newest records" },
} as const;

/** The text of a premise in a language. */
export const premiseText = (p: AuthoredPremise, lang: "fi" | "en"): string => p[lang];

/** One premise's status as the block states it: the check's status and the deciding records as cited ("SPOT 17.01"). */
export interface PremiseBlockStatus {
  readonly id: string;
  readonly status: PremiseCheckStatus;
  readonly records: readonly string[];
}

/**
 * The block appended to the system instruction after the quoted directive (reasoning_intent, directive in force only): each
 * authored premise by id with the premise check's status (SPEC/30 §3). A premise the check does not list is stated as not contradicted.
 */
export function premisesBlock(dp: DirectivePremises, lang: "fi" | "en", check: readonly PremiseBlockStatus[]): string {
  const phrase = PREMISE_STATUS_FOR_MODEL[lang];
  const line = (p: AuthoredPremise) => {
    const c = check.find((x) => x.id === p.id);
    const status = c && c.status === "contradicted" ? phrase.contradicted.replace("{records}", c.records.join(", ")) : phrase.not_contradicted;
    return `${p.id}: ${premiseText(p, lang)} — ${status}`;
  };
  return `${PREMISES_BLOCK_LABEL[lang]}:\n${dp.premises.map(line).join("\n")}\n`;
}
