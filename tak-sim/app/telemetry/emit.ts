/**
 * The type-safe telemetry emission entry point. Production code should
 * call {@link appendTelemetryEvent}, never `SessionLog.append` directly —
 * this is what ties a `RecordKind` to its correct `detail` shape (the
 * generic `SessionLog` primitive in `log.ts` does not, deliberately; see
 * that file's header).
 */

import type { VirtualTime } from "../engine/primitives.js";
import type { SessionLog, LogRecord } from "./log.js";
import type { TelemetryEvent } from "./record-kinds.js";

export async function appendTelemetryEvent(
  log: SessionLog,
  tVirtual: VirtualTime,
  tWallOffsetMs: number,
  event: TelemetryEvent,
): Promise<LogRecord> {
  return log.append(tVirtual, tWallOffsetMs, event.kind, event.detail);
}
