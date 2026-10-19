/**
 * Session logs → the inputs of `score_freezes.py` (wildfire-sagat-probes):
 *   responses.csv                participant,item_id,answer,confidence,rt_s
 *   exposure.csv                 participant,fact_id,first_seen_cycle,route   (pre-registered: retrieved ∪ digest ∪ recent)
 *   exposure_retrieved_only.csv  the same without the model-context routes (the retrieved-only sensitivity, SPEC/31 §3.6)
 *
 * Read with the analysis' own folds, never re-implemented: the first answer per freeze item with a replayed view dropped
 * (`firstFreezeAnswers`), each SPAM probe's answer, confidence and answer latency (`spamMeasures`), the hinge check
 * (`hingeCheckMeasure`), and exposure from the freeze measures' fold (`atomExposure`: pushed bubbles, Haku results,
 * Haku-chat and Thinker retrievals, and since format 0.11.0 what reached the model without a search — the Open Thinker's
 * digest and both chats' recent matches, routes `digest` and `recent`; `includeModelContext: false` drops those two).
 * `score_freezes.py` reads the first three exposure columns; `route` is how the fact first reached the participant.
 * Unanswered items (a SPAM item that timed out, a freeze item left missing) get no row: missing is not wrong. Confidence
 * 25/50/75/100 → 0.25–1.00; a map answer is "E;N" in EPSG:3067.
 */

import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import { assertGapless } from "../../app/telemetry/log.js";
import { atomExposure, firstFreezeAnswers, replayedViews, type ExposureOptions, type ExposureRoute } from "../../app/telemetry/freeze-measures.js";
import { hingeCheckMeasure, spamMeasures } from "../../app/telemetry/spam-measures.js";
import type { CycleStartDetail, RecallConfidenceSubmittedDetail, SpamAnsweredDetail } from "../../app/telemetry/record-kinds.js";
import { stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { SECOND_SPAM_SUFFIX } from "../../app/scenario/views.js";
import { cycleOfStep, toEN } from "./geo.js";

export interface SessionLogFile {
  readonly header: LogHeader;
  readonly records: readonly LogRecord[];
}

/** A `fire-sim-session-jsonl/1` file: the header line, the records in seq order (gapless, I5), an optional manifest. */
export function parseSessionFile(text: string): SessionLogFile {
  let header: LogHeader | null = null;
  const records: LogRecord[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const o = JSON.parse(line) as { header?: LogHeader; manifest?: unknown; seq?: number };
    if (o.header) header = o.header;
    else if (typeof o.seq === "number") records.push(o as unknown as LogRecord);
  }
  if (!header) throw new Error("not a session file: no header line");
  assertGapless(records);
  return { header, records };
}

export interface ResponseRow {
  readonly participant: string;
  readonly item_id: string;
  readonly answer: string;
  readonly confidence: number | null;
  readonly rt_s: number | null;
}

export interface ExposureRow {
  readonly participant: string;
  readonly fact_id: string;
  readonly first_seen_cycle: number;
  /** The route of the fact's first arrival (`bubble`, `haku`, `haku_chat`, `thinker`, `digest`, `recent` …). */
  readonly route: ExposureRoute;
}

const participantOf = (h: LogHeader): string => h.participantCode || h.sessionId;
const conf = (v: number | null | undefined): number | null => (v === null || v === undefined ? null : Math.round(v) / 100);
const secs = (ms: number | null | undefined): number | null => (ms === null || ms === undefined ? null : Math.round(ms / 100) / 10);

export function responseRows(session: SessionLogFile): ResponseRow[] {
  const participant = participantOf(session.header);
  const rows: ResponseRow[] = [];
  // Freezes: the time on an item is the gap to the previous item's answer in the same submission.
  const answers = firstFreezeAnswers(session.records);
  const bySubmission = new Map<number, typeof answers>();
  for (const a of answers) bySubmission.set(a.record.seq as number, [...(bySubmission.get(a.record.seq as number) ?? []), a]);
  for (const a of answers) {
    const ms = a.answer.msSinceFreezeOpened;
    const earlier = (bySubmission.get(a.record.seq as number) ?? [])
      .map((x) => x.answer.msSinceFreezeOpened)
      .filter((m): m is number => m !== undefined && ms !== undefined && m < ms);
    const rt = ms === undefined ? null : ms - (earlier.length ? Math.max(...earlier) : 0);
    const answer = a.answer.point ? toEN(a.answer.point).join(";") : a.answer.optionId;
    rows.push({ participant, item_id: a.answer.itemId, answer, confidence: conf(a.answer.confidence), rt_s: secs(rt) });
  }
  // SPAM: the first prompt of each probe (a replayed view prompts again; its second showing is not a fresh measure).
  const seen = new Set<string>();
  for (const m of spamMeasures(session.records, new Map())) {
    if (seen.has(m.probeId)) continue;
    seen.add(m.probeId);
    if (m.response === null) continue;
    rows.push({ participant, item_id: m.probeId, answer: m.response, confidence: conf(m.confidence), rt_s: secs(m.answerLatencyMs) });
  }
  rows.push(...secondSpamRows(session.records, participant, seen));
  const hinge = hingeCheckMeasure(session.records, "");
  if (hinge && hinge.optionId !== null) rows.push({ participant, item_id: hinge.itemId, answer: hinge.optionId, confidence: null, rt_s: secs(hinge.answerLatencyMs) });
  return rows;
}

/**
 * SPEC/30 §5.2's second SPAM items (`<first id>.b`): no prompt or "ready" of their own, so `spamMeasures` (one measure per
 * prompt) does not list them. Read as `teaming-measures.ts` reads them: the first `spam_answered` per probe outside a
 * replayed view, its `recall_confidence_submitted`, and the answer latency from the item's display — the first item's last
 * record (its confidence or its timed-out answer; `spam-delivery.ts`).
 */
function secondSpamRows(records: readonly LogRecord[], participant: string, firstItems: ReadonlySet<string>): ResponseRow[] {
  const replayed = replayedViews(records);
  const rows: ResponseRow[] = [];
  const done = new Set<string>();
  let view = -1;
  records.forEach((r, i) => {
    if (r.kind === "cycle_start") { view = (r.detail as CycleStartDetail).cycle as number; return; }
    if (r.kind !== "spam_answered" || replayed.has(view)) return;
    const d = r.detail as SpamAnsweredDetail;
    if (firstItems.has(d.probeId) || done.has(d.probeId) || !d.probeId.endsWith(SECOND_SPAM_SUFFIX)) return;
    done.add(d.probeId);
    if (d.timedOut || d.response === null) return;
    const first = d.probeId.slice(0, -SECOND_SPAM_SUFFIX.length);
    const shown = records.slice(0, i).reverse().find((x) => (x.kind === "recall_confidence_submitted" || x.kind === "spam_answered") && (x.detail as { probeId?: string }).probeId === first);
    const confidence = records.slice(i + 1).find((x) => x.kind === "recall_confidence_submitted" && (x.detail as RecallConfidenceSubmittedDetail).probeId === d.probeId);
    rows.push({
      participant, item_id: d.probeId, answer: d.response, confidence: conf((confidence?.detail as RecallConfidenceSubmittedDetail | undefined)?.value),
      rt_s: secs(shown ? r.tWallOffsetMs - shown.tWallOffsetMs : null),
    });
  });
  return rows;
}

/** Each record's skills' cycle: the step its virtual time falls in within the view on screen (`cycle_start`); 0 before the first view. */
export function recordCycles(records: readonly LogRecord[], scenario: ScenarioContract): number[] {
  const views = new Map<number, { startsAtVirtual: number; steps: number }>([
    [0, { startsAtVirtual: scenario.practice.cycle.startsAtVirtual as number, steps: scenario.practice.cycle.steps }],
    ...scenario.cycles.map((c) => [c.index as number, { startsAtVirtual: c.startsAtVirtual as number, steps: c.steps }] as const),
  ]);
  let view: { startsAtVirtual: number; steps: number } | null = null;
  return records.map((r) => {
    if (r.kind === "cycle_start") view = views.get((r.detail as CycleStartDetail).cycle as number) ?? view;
    if (!view) return 0;
    const step = stepAtVirtualTime(view, r.tVirtual as number) ?? view.startsAtVirtual / 1200 + 1;
    return cycleOfStep(step);
  });
}

/**
 * For every atom that reached the participant: the first cycle by whose end it had, and by which route (the fold
 * `atomExposure`, cut at each cycle's end). `opts.includeModelContext: false` is the retrieved-only sensitivity.
 */
export function exposureRows(session: SessionLogFile, scenario: ScenarioContract, opts: ExposureOptions = {}): ExposureRow[] {
  const participant = participantOf(session.header);
  const ids = scenario.atoms.map((a) => a.id);
  const cycles = recordCycles(session.records, scenario);
  const maxCycle = Math.max(0, ...cycles);
  const first = new Map<string, { readonly cycle: number; readonly route: ExposureRoute }>();
  for (let c = 0; c <= maxCycle; c++) {
    const cut = cycles.findIndex((x) => x > c);
    const beforeSeq = cut === -1 ? session.records.length : (session.records[cut]!.seq as number);
    for (const e of atomExposure(session.records, ids, beforeSeq, opts)) if (e.reached && !first.has(e.atomId)) first.set(e.atomId, { cycle: c, route: e.route! });
  }
  return ids.filter((id) => first.has(id)).map((id) => ({ participant, fact_id: id, first_seen_cycle: first.get(id)!.cycle, route: first.get(id)!.route }))
    .sort((a, b) => a.first_seen_cycle - b.first_seen_cycle || (a.fact_id < b.fact_id ? -1 : a.fact_id > b.fact_id ? 1 : 0));
}

function csvField(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends object>(rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvField(r[c] as string | number | null)).join(","))].join("\n") + "\n";
}

export interface ConvertedResponses {
  readonly responsesCsv: string;
  /** The pre-registered exposure: retrieved ∪ digest ∪ recent (SPEC/31 §3.6). */
  readonly exposureCsv: string;
  /** The retrieved-only sensitivity: without the routes `digest` and `recent`. */
  readonly exposureRetrievedOnlyCsv: string;
  readonly responses: readonly ResponseRow[];
  readonly exposure: readonly ExposureRow[];
  readonly exposureRetrievedOnly: readonly ExposureRow[];
}

const EXPOSURE_COLUMNS: readonly (keyof ExposureRow & string)[] = ["participant", "fact_id", "first_seen_cycle", "route"];

export function convertSessions(texts: readonly string[], scenario: ScenarioContract): ConvertedResponses {
  const sessions = texts.map(parseSessionFile);
  const responses = sessions.flatMap(responseRows);
  const exposure = sessions.flatMap((s) => exposureRows(s, scenario));
  const exposureRetrievedOnly = sessions.flatMap((s) => exposureRows(s, scenario, { includeModelContext: false }));
  return {
    responses, exposure, exposureRetrievedOnly,
    responsesCsv: toCsv(responses, ["participant", "item_id", "answer", "confidence", "rt_s"]),
    exposureCsv: toCsv(exposure, EXPOSURE_COLUMNS),
    exposureRetrievedOnlyCsv: toCsv(exposureRetrievedOnly, EXPOSURE_COLUMNS),
  };
}
