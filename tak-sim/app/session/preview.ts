/**
 * The development preview override — the one way to run the session with shorter views than the
 * real ones (a 120 s minimum for a single-step view, 150 s for a merged one; the decision panel
 * opening at 20 s; `app/scenario/views.ts`).
 *
 * The scenario contract always carries the real values. The override is opt-in at run time only,
 * through the URL parameter {@link PREVIEW_EXPLORATION_PARAM}, e.g.
 *
 *     http://localhost:5173/?esikatselu=12
 *
 * gives every single-step view (the practice view included) a 12-second minimum length and scales
 * every other view time by the same factor (12 / 120): a merged view's minimum (15 s), the moment
 * the decision panel opens (2 s), the step boundary and the freeze offset — so the app can be
 * clicked through quickly in development. Without the parameter the real values are used.
 * When the override is active the orchestrator writes it into the log header
 * (`LogHeader.previewOverride`) and the status strip says so: a session run with it is not a
 * measurement.
 */

import allocationTable from "../../content/assignment/allocation.json" with { type: "json" };
import type { Cell } from "../scenario/types.js";
import { assignmentOf, stratumOfRow, type AssignmentLanguage, type AssignmentTable } from "./assignment.js";
import { parseStratumId, STRATA, stratumId, type Stratum } from "../telemetry/record-kinds-pilot2.js";
import { VIEW_MIN_SECONDS } from "../scenario/views.js";

/** The URL query parameter that sets a single-step view's minimum length to the given whole seconds. */
export const PREVIEW_EXPLORATION_PARAM = "esikatselu";

/** Accepted range for the override, in seconds: at least one, never longer than the real 120 s. */
export const PREVIEW_EXPLORATION_MIN_SECONDS = 1;
export const PREVIEW_EXPLORATION_MAX_SECONDS = VIEW_MIN_SECONDS;

export interface PreviewOverride {
  /** A single-step view's minimum length; every other view time scales with it. */
  readonly minViewSeconds: number;
}

/** A real view time under the override: × override / 120 (multiplied first, so whole inputs round once); unchanged without one. */
export function scaleViewSeconds(seconds: number, override: PreviewOverride | null): number {
  return override ? (seconds * override.minViewSeconds) / VIEW_MIN_SECONDS : seconds;
}

/**
 * Reads the override from a URL query string (`window.location.search`). Returns null when the
 * parameter is absent; throws on a malformed or out-of-range value rather than silently running
 * with an unintended timing.
 */
export function parsePreviewOverride(search: string): PreviewOverride | null {
  const raw = new URLSearchParams(search).get(PREVIEW_EXPLORATION_PARAM);
  if (raw === null) return null;
  const seconds = Number(raw);
  if (!/^\d+$/.test(raw) || seconds < PREVIEW_EXPLORATION_MIN_SECONDS || seconds > PREVIEW_EXPLORATION_MAX_SECONDS) {
    throw new RangeError(
      `?${PREVIEW_EXPLORATION_PARAM}= must be a whole number of seconds, ${PREVIEW_EXPLORATION_MIN_SECONDS}-${PREVIEW_EXPLORATION_MAX_SECONDS}; got "${raw}"`,
    );
  }
  return { minViewSeconds: seconds };
}

/** The URL query parameter of the study configuration: real view times, SA level tags hidden. */
export const STUDY_PARAM = "tuotanto";

/**
 * The view timing a session runs with, from the URL: an explicit `?esikatselu=<s>` wins; otherwise the
 * real times (null), in the study (`?tuotanto`) and in the demonstration alike (6 Oct 2026: the
 * demonstration runs as the study does, and the presenter skips what they need not wait for —
 * `SessionOptions.allowViewSkip`; was a 30 s minimum from 2 Oct 2026). A non-null result is logged in
 * the header (`previewOverride`).
 */
export function sessionOverrideFromUrl(search: string): PreviewOverride | null {
  return parsePreviewOverride(search);
}

/**
 * The cell assignment (phase B round 2, D1; SPEC/02 revisions (f)/(j)): `?solu=k4` — Haku only
 * (`directed`, cell `radio`); `?solu=m7` — Haku + Thinker (`substitutive`, `reasoning_once`);
 * `?solu=t2` — Haku + strategy-guided Thinker (`substitutive`, `reasoning_intent`). The codes are
 * opaque on purpose (review 4 Oct 2026: "ohjattu", guided, named the cell in the link): a participant
 * who sees the link learns nothing about the assignment, which stays concealed until the hinge.
 */
export const CELL_PARAM = "solu";
export const CELL_PARAM_VALUES: Readonly<Record<string, Cell>> = { k4: "radio", m7: "reasoning_once", t2: "reasoning_intent" };

/** The condition a cell runs in: `radio` is the Haku group, both Thinker cells the AI condition. */
export function conditionOfCell(cell: Cell): "directed" | "substitutive" {
  return cell === "radio" ? "directed" : "substitutive";
}

/** Reads `?solu=`: the cell, null when absent; throws on any other value rather than guessing a group. */
export function parseCellParam(search: string): Cell | null {
  const raw = new URLSearchParams(search).get(CELL_PARAM);
  if (raw === null) return null;
  const cell = Object.hasOwn(CELL_PARAM_VALUES, raw) ? CELL_PARAM_VALUES[raw] : undefined;
  if (!cell) throw new RangeError(`?${CELL_PARAM}= must be one of ${Object.keys(CELL_PARAM_VALUES).join(", ")}; got "${raw}"`);
  return cell;
}

/** The participant code parameter of the study link (SPEC/27 §2.2): `?tuotanto&koodi=F4H9H7`. */
export const CODE_PARAM = "koodi";
/** Marks a pilot session that takes its cell from `?solu=` in the study configuration (SPEC/27 §2.2). */
export const PILOT_PARAM = "pilotti";
/**
 * The allocation stratum from the recruitment screener (SPEC/30 §2 revision (bf), 24 Oct 2026): `?osite=<profession>.<lead|nolead>`,
 * e.g. `?tuotanto&osite=fire_rescue.lead` (`stratumId`). The shared study link must carry it (the server issues the next code of
 * that stratum); a `?koodi=` link may (it must then match the code's row); a pilot or demonstration link may (logged as given).
 */
export const STRATUM_PARAM = "osite";

/** Reads `?osite=`: the stratum, null when absent; throws on a value that names none, rather than guessing a stratum. */
export function parseStratumParam(search: string): Stratum | null {
  const raw = new URLSearchParams(search).get(STRATUM_PARAM);
  if (raw === null) return null;
  const s = parseStratumId(raw);
  if (!s) throw new RangeError(`?${STRATUM_PARAM}= must be one of ${STRATA.map(stratumId).join(", ")}; got "${raw}"`);
  return s;
}

/**
 * Where the session's cell came from (logged in the header, `LogHeader.assignment`): the allocation
 * table by participant code (`table`, the only source a confirmatory analysis accepts); `?solu=` in a
 * demonstration (`url`) or in a pilot run in the study configuration (`url_pilot`); the
 * demonstration start page's three buttons (`start_page`).
 */
export type SessionAssignment =
  | {
    readonly source: "table"; readonly tableSha256: string; readonly block: number;
    /**
     * How the table's code reached the browser (revision (af), 9 Oct 2026): `link` — the link carried
     * it (`?koodi=`); `server` — the hosted study server issued it on the start page (`/api/assign`,
     * `auto-assign.ts`). Absent in logs before 9 Oct 2026 (all `link`).
     */
    readonly assignmentSource?: "server" | "link";
    /** SPEC/30 §2 revision (bf): the code's row's stratum (profession × leads others); absent in logs before 0.16.0. */
    readonly stratum?: Stratum;
  }
  /** `stratum` (revision (bf)): the link's `?osite=`, when it carried one. */
  | { readonly source: "url"; readonly stratum?: Stratum }
  | { readonly source: "url_pilot"; readonly stratum?: Stratum }
  | { readonly source: "start_page" };

/**
 * What the start page offers (D1; SPEC/27 §2.2, reconciled 5 Oct 2026):
 * - `?koodi=<code>` (either mode): the allocation table's cell and language for that code, one
 *   neutral start button, the language fixed by the code's stratum; an unknown code is refused; with
 *   `?osite=` (revision (bf)) the stratum must be the code's;
 * - `?tuotanto` (the study) without a code: the shared study link (revision (af), 9 Oct 2026) — the
 *   start button asks the hosted study server for the next code (`server_assign`, `auto-assign.ts`)
 *   of the link's stratum, so the link must carry `?osite=` (revision (bf), 24 Oct 2026; refused without);
 *   `?solu=` in the study is refused unless the
 *   link also carries `?pilotti` (a pilot session, logged as `url_pilot`); a code and `?solu=`
 *   together are refused (two sources of the cell);
 * - `?solu=` in a demonstration: that cell, one neutral button (`url`);
 * - neither, in a demonstration: the three cells to choose from (`start_page`).
 * The participant never sees the cell.
 */
export type StartChoice =
  | {
    readonly kind: "assigned"; readonly cell: Cell; readonly assignment: SessionAssignment;
    /** The table's participant code (normalised), or null for a `?solu=` session. */
    readonly participantCode: string | null;
    /** The language the code's stratum fixes; null when the participant chooses. */
    readonly language: AssignmentLanguage | null;
  }
  | { readonly kind: "choose" }
  /** The shared study link: the code of the link's stratum comes from `/api/assign` when the participant starts. */
  | { readonly kind: "server_assign"; readonly stratum: Stratum }
  | { readonly kind: "invalid"; readonly message: string };

export const ALLOCATION_TABLE = allocationTable as unknown as AssignmentTable;

export function startChoiceFromUrl(search: string, table: AssignmentTable = ALLOCATION_TABLE): StartChoice {
  const params = new URLSearchParams(search);
  const study = params.has(STUDY_PARAM);
  let cell: Cell | null;
  let stratum: Stratum | null;
  try {
    cell = parseCellParam(search);
    stratum = parseStratumParam(search);
  } catch (e) {
    return { kind: "invalid", message: e instanceof Error ? e.message : String(e) };
  }
  const linked = stratum ? { stratum } : {};
  const rawCode = params.get(CODE_PARAM);
  if (rawCode !== null) {
    if (cell) return { kind: "invalid", message: `?${CODE_PARAM}= and ?${CELL_PARAM}= together: the cell has one source` };
    const byCode = assignedByCode(rawCode, "link", table);
    if (!byCode) return { kind: "invalid", message: `unknown participant code "${rawCode}"` };
    // Revision (bf): a link that names a stratum must name the code's (the screener and the code agree, or the link is wrong).
    const own = byCode.assignment.source === "table" ? byCode.assignment.stratum : undefined;
    if (stratum && own && stratumId(own) !== stratumId(stratum)) return { kind: "invalid", message: `participant code "${rawCode}" belongs to stratum ${stratumId(own)}, not ${stratumId(stratum)}` };
    return byCode;
  }
  if (study) {
    if (!cell) return stratum ? { kind: "server_assign", stratum } : { kind: "invalid", message: `the study link has no stratum (?${STRATUM_PARAM}=…); ask the researcher for the right link` };
    if (!params.has(PILOT_PARAM)) return { kind: "invalid", message: `?${CELL_PARAM}= is not accepted in a study session; use ?${CODE_PARAM}= (or ?${PILOT_PARAM} for a pilot)` };
    return { kind: "assigned", cell, assignment: { source: "url_pilot", ...linked }, participantCode: null, language: null };
  }
  if (cell) return { kind: "assigned", cell, assignment: { source: "url", ...linked }, participantCode: null, language: null };
  return { kind: "choose" };
}

/** A table code's start choice (its cell, language, block and stratum), or null for a code the table does not hold. */
export function assignedByCode(rawCode: string, assignmentSource: "server" | "link", table: AssignmentTable = ALLOCATION_TABLE): Extract<StartChoice, { kind: "assigned" }> | null {
  const row = assignmentOf(table, rawCode);
  if (!row) return null;
  // A version-1 table (before revision (bf)) has no strata: no stratum is logged.
  const stratum = row.profession !== undefined && row.leads !== undefined ? { stratum: stratumOfRow(row) } : {};
  return {
    kind: "assigned", cell: row.cell, participantCode: row.code, language: row.language,
    assignment: { source: "table", tableSha256: table.rowsSha256, block: row.block, assignmentSource, ...stratum },
  };
}
