/**
 * What the changes adopted before pilot 2 add to the log (24 Oct 2026, format 0.16.0; SPEC/07 revision (bf)), split out of
 * `record-kinds.ts` as the difficulty audit's records are. Raw (SPEC/07 §1): nothing here is scored or derived.
 *
 * - **The hinge's fatigue item** (`app/session/hinge-check.ts`, SPEC/15 (bf)): one record per click on the optional 1–7 rating on the
 *   hinge screen; the last before `hinge_pause_end` counts. A covariate (SPEC/09 (bf)).
 * - **The stratum** (SPEC/30 §2 revision (bf)): the header's `assignment.stratum` (`log.ts`): the profession and leadership the
 *   recruitment screener gave — the code's row of the stratified allocation table when `assignment.source` is `table`, else the link's
 *   `?osite=` (a pilot or a demonstration). Absent: no stratum reached the session (logs before 0.16.0, links without one).
 * - **The Haku chip** (SPEC/30 §4 revision (bf)) writes no new kind: `ai_chat_query_submitted` with `tool: "haku"` may now carry
 *   `viaChip: true`, as the guide's chip does with `tool: "open_thinker"`.
 * - **The questionnaire items** (SPEC/09 (bf)) write no new kind: new item ids in `questionnaire_presented` / `_submitted`.
 */

/** The hinge's fatigue rating (1–7), as clicked. */
export interface HingeFatigueRatedDetail {
  readonly itemId: "fatigue.hinge";
  readonly value: number;
}

/** The recruitment screener's professions (SPEC/30 §2 revision (bf)); `other` is every answer that is neither. */
export const PROFESSIONS = ["fire_rescue", "military", "other"] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** A participant's allocation stratum besides the session language: profession × leads others (yes / no). */
export interface Stratum {
  readonly profession: Profession;
  readonly leads: boolean;
}

/** A stratum's id, as the link's `?osite=` and the server's request carry it: `fire_rescue.lead`, `military.nolead`, … */
export function stratumId(s: Stratum): string {
  return `${s.profession}.${s.leads ? "lead" : "nolead"}`;
}

/** Every stratum, in the table's order (profession, then leads before not). */
export const STRATA: readonly Stratum[] = PROFESSIONS.flatMap((profession) => [{ profession, leads: true }, { profession, leads: false }]);

/** A stratum id read back (trimmed, lower case), or null when it names none. */
export function parseStratumId(raw: string): Stratum | null {
  const id = raw.trim().toLowerCase();
  return STRATA.find((s) => stratumId(s) === id) ?? null;
}
