/**
 * The append-only session log — SPEC/04_Data_Model.md §10, invariant I5
 * (SPEC/00_README.md §3):
 *
 * "Every record is durably persisted before the UI acknowledges the action
 * that produced it. `seq` is gapless; a gap is a detected data-loss event
 * and is reported, never silently tolerated."
 *
 * `kind` stays typed as `string` at this layer rather than narrowed to
 * the real `RecordKind` union (`record-kinds.ts`, M4). Two independent
 * callers need this primitive: the real telemetry system (typed kinds,
 * see `emit.ts`'s `appendTelemetryEvent`, which is the actual type-safe
 * entry point production code should use) and `test/golden/`'s M1
 * determinism harness, which deliberately logs synthetic engine-internal
 * events (`rng_draw_u64`, `clock_advanced`) that are not, and were never
 * meant to be, real telemetry — those golden fixtures predate this file
 * and narrowing `kind` here would break them for no correctness gain.
 */

import { asSeq, type Seq, type VirtualTime } from "../engine/primitives.js";
import type { Cell, ConditionId, Echelon } from "../scenario/types.js";
import type { Stratum } from "./record-kinds-pilot2.js";

export interface LogHeader {
  readonly formatVersion: string;
  readonly sessionId: string;
  readonly participantCode: string;
  readonly condition: ConditionId;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly seed: string; // bigint as decimal string
  readonly bundleHash: string;
  readonly appVersion: string;
  readonly startedAtIso: string; // wall clock, annotation only
  readonly userAgent: string;
  readonly viewport: { readonly w: number; readonly h: number; readonly dpr: number };
  /** The Type E order; no longer written since Type E was withdrawn (6 Oct 2026), kept so older logs still type. */
  readonly counterbalance?: { readonly expectationOrder: "A" | "B" };
  /**
   * SPEC/04 §11 amendment + revision (d): the amendment first added
   * `guidanceMode` and `echelon`; revision (d) replaced `guidanceMode`
   * with `cell` ("`SessionConfig.cell`; replaces `guidanceMode`"), and
   * SPEC/07 §2 revision (d) says the log header follows suit ("Log header
   * records `cell` instead of `guidanceMode`"). `guidanceMode` itself is
   * therefore never recorded — only its final reconciled replacement.
   */
  readonly cell: Cell;
  readonly echelon: Echelon;
  /**
   * Present only when a development preview override is active (`app/session/preview.ts`): the
   * session then does NOT run the real SPEC/26 §4 timings and its data are not measurements.
   */
  readonly previewOverride?: { readonly minViewSeconds: number };
  /** The session language chosen on the first page (`app/i18n/lang.ts`); absent in logs before 1 Oct 2026. */
  readonly language?: "fi" | "en";
  /** Whether the session ran the guided tour at VP and the tool reminder at V1 (0.9.1). */
  readonly guidedTour?: boolean;
  /** Demonstration only (6 Oct 2026): the presenter could skip views and freezes (`SessionOptions.allowViewSkip`). */
  readonly viewSkipAllowed?: boolean;
  /** Appended 5 Oct 2026: Type E, F and U were delivered in this session (`SessionOptions.visibleProbes`); a study log must have true. */
  readonly visibleProbes?: boolean;
  /** Appended 9 Oct 2026 (revision (ac)): the AI literacy test ran after consent (`SessionOptions.aiLiteracyTest`); the app always sets it. */
  readonly aiLiteracyTest?: boolean;
  /** Appended 10 Oct 2026: the intro video's URL, played before the practice view (`SessionOptions.introVideo`). */
  readonly introVideo?: string;
  /**
   * Whether freeze items showed their SA level (L1/L2) to the participant: true in demonstration
   * sessions, false in the study (`?tuotanto`). A study log must have false (2 Oct 2026).
   */
  readonly probeLevelsShown?: boolean;
  /**
   * The participant's screen layout (SPEC/28 §5, 13 Oct 2026): `tak` — the TAK shell (map-centred, right-edge toolbar, side
   * panes, 2525 symbols), the default of this build; `classic` — the layout of SPEC/06 (`?klassinen` / `?classic`). Data from
   * the two shells are never pooled silently (SPEC/00 §6). Absent in logs before 13 Oct 2026 (the classic layout).
   */
  readonly uiShell?: "tak" | "classic";
  /**
   * SPEC/35 §2 (21 Oct 2026, 0.13.0): who the session is for — `expert` (fire-rescue professionals, the study as designed) or
   * `public` (participants from the general population: the explanation layer, the public questionnaire, the commander profile;
   * `?yleiso`). Absent in logs before 0.13.0: `expert`.
   */
  readonly audience?: "expert" | "public";
  /**
   * SPEC/35 §2: how much of the scenario the session runs — `full` (VP, V1–V14) or `phaseA` (VP, V1–V7: the session ends at the
   * hinge and goes on to the questionnaire; `?laajuus=a`). Absent in logs before 0.13.0: `full`.
   */
  readonly scope?: "full" | "phaseA";
  /**
   * SPEC/36 (23 Oct 2026, 0.14.0): the commander profile was shown on screen after the questionnaire (`?profiili=heti`: demonstrations
   * and teaching). Absent (the default since 0.14.0): the profile is not shown; personal results are sent after the study closes.
   * In 0.13.0 logs a public session showed the profile without this field.
   */
  readonly immediateProfile?: boolean;
  /**
   * Difficulty audit (23 Oct 2026, 0.15.0): the map-reading pretest ran before the practice view (`SessionOptions.mapPretest`), and the
   * practice feedback screen after it (`SessionOptions.practiceFeedback`). The app sets both in every session; absent: neither ran.
   * RETIRED in 0.18.0 (SPEC/07 (bp)): no longer written; logs of 0.17.0 and earlier keep them.
   */
  readonly mapPretest?: boolean;
  readonly practiceFeedback?: boolean;
  /**
   * 0.18.0 (26 Oct 2026, SPEC/07 (bp), SPEC/15 (bp)): the training incident ran after the pre-session item (and a public session's
   * primer), before the intro video and VP (`SessionOptions.trainingIncident`). The app sets it in every session; absent: it did not run.
   */
  readonly trainingIncident?: boolean;
  /**
   * Where `cell` came from (SPEC/27 §2.2, 5 Oct 2026; `app/session/preview.ts` `SessionAssignment`):
   * `table` — the allocation table by participant code (`participantCode` is the table's code;
   * `tableSha256` is the table's `rowsSha256`; `block` its block in the language stratum), the only
   * source a confirmatory analysis accepts; `url` — `?solu=` in a demonstration; `url_pilot` —
   * `?solu=` with `?pilotti` in the study configuration; `start_page` — the demonstration's buttons.
   * Absent in logs before 5 Oct 2026. `assignmentSource` (revision (af), 9 Oct 2026): `link` — the
   * code came in the link (`?koodi=`); `server` — the hosted study server issued it when the
   * participant pressed start on the shared link (`/api/assign`); absent before 9 Oct 2026. `stratum` (0.16.0, SPEC/30 §2 revision
   * (bf), 24 Oct 2026): the allocation stratum besides the language — the recruitment screener's profession and whether the
   * participant leads others — from the code's table row (`table`; `block` is then the block within that stratum), or from the
   * link's `?osite=` (`url`, `url_pilot`); absent when none reached the session.
   */
  readonly assignment?:
    | { readonly source: "table"; readonly tableSha256: string; readonly block: number; readonly assignmentSource?: "server" | "link"; readonly stratum?: Stratum }
    | { readonly source: "url" | "url_pilot" | "start_page"; readonly stratum?: Stratum };
}

export interface LogRecord {
  readonly seq: Seq; // gapless from 0
  readonly tVirtual: VirtualTime;
  readonly tWallOffsetMs: number; // annotation only; never read by logic
  readonly kind: string;
  readonly detail: unknown;
}

/** Durable persistence backend. Implementations must not resolve before the write is durable (I5). */
export interface LogSink {
  append(record: LogRecord): Promise<void>;
  readAll(): Promise<readonly LogRecord[]>;
}

/** Not durable — for pure-logic tests only. A real session must use a durable sink (IndexedDB in the browser, file/db in Node tooling). */
export class InMemoryLogSink implements LogSink {
  private readonly records: LogRecord[] = [];

  async append(record: LogRecord): Promise<void> {
    this.records.push(record);
  }

  async readAll(): Promise<readonly LogRecord[]> {
    return this.records.slice();
  }
}

export class GapDetectedError extends Error {
  constructor(
    readonly expectedSeq: number,
    readonly actualSeq: number,
  ) {
    super(`Gap detected in session log: expected seq ${expectedSeq}, found ${actualSeq}`);
    this.name = "GapDetectedError";
  }
}

/**
 * Verifies `records` form a gapless sequence 0..n-1 with no duplicates and
 * no reordering. Never tolerates a gap silently (I5) — throws
 * {@link GapDetectedError} instead of returning a boolean, so a caller
 * cannot accidentally ignore the result.
 */
export function assertGapless(records: readonly LogRecord[]): void {
  for (let i = 0; i < records.length; i++) {
    const actual = records[i]!.seq;
    if (actual !== i) {
      throw new GapDetectedError(i, actual);
    }
  }
}

export class SessionLog {
  private nextSeq = 0;
  private tail: Promise<unknown> = Promise.resolve();

  /**
   * `priorRecords`: the records already in `sink` when a resumed session continues it (SPEC/05 §9).
   * The next record takes the next `seq`, so the persisted log stays gapless across the
   * interruption; throws {@link GapDetectedError} if they are not gapless — a resume never papers
   * over a loss.
   */
  constructor(
    readonly header: LogHeader,
    private readonly sink: LogSink,
    priorRecords: readonly LogRecord[] = [],
  ) {
    assertGapless(priorRecords);
    this.nextSeq = priorRecords.length;
  }

  /** A log continuing whatever `sink` already holds (reads it first). */
  static async reopen(header: LogHeader, sink: LogSink): Promise<{ readonly log: SessionLog; readonly records: readonly LogRecord[] }> {
    const records = await sink.readAll();
    return { log: new SessionLog(header, sink, records), records };
  }

  /**
   * Appends one record. The `seq` counter is only advanced after the sink
   * confirms durable persistence — if `sink.append` rejects, `seq` is left
   * unconsumed so a retry of the same logical event reuses it, and the
   * persisted log therefore never contains a gap even under a failing
   * storage backend. The caller (the run loop) is expected to react to a
   * rejection by pausing (`FAULT_PAUSED`, SPEC/05 §4) and retrying rather
   * than swallowing the error.
   */
  async append(tVirtual: VirtualTime, tWallOffsetMs: number, kind: string, detail: unknown): Promise<LogRecord> {
    // Appends are serialised: one that starts while another is being written (a timer firing during
    // a submission) waits for it, so two records never take the same `seq` with an async sink.
    const run = this.tail.then(async () => {
      const record: LogRecord = { seq: asSeq(this.nextSeq), tVirtual, tWallOffsetMs, kind, detail };
      await this.sink.append(record); // durable before acknowledgement (I5)
      this.nextSeq += 1;
      return record;
    });
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  currentSeq(): number {
    return this.nextSeq;
  }

  async readAll(): Promise<readonly LogRecord[]> {
    return this.sink.readAll();
  }
}
