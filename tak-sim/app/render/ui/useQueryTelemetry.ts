/**
 * Query composition records (SPEC/07 §2.5; first emitter SPEC/30 §5.4, 19 Oct 2026) for one text field — Haku's chat
 * (`haku_chat`), the Thinker's chat (`thinker_chat`), the index search's free text (`haku_search`, demonstration only).
 * (`nav`, the query builder, has no text field: its slot choices are `nav_slot_changed`.)
 *
 * - `query_focus`: the field receives focus.
 * - `query_first_keystroke`: the first input of a composition — the first after a focus, or after the screen emptied the
 *   field (a question sent). Its gap from `query_focus` (or from the previous answer) is the composition onset.
 * - `query_edit`: a deletion run — consecutive inputs that shorten the text (Backspace, Delete, cutting, clearing) —
 *   ends (the next input that does not shorten it, the field emptied, a blur, a send); `count` is the characters it
 *   removed. A count, never text (SPEC/07 §3): no keystroke content leaves the field before `ai_chat_query_submitted`.
 * Each record carries the field and the view (`cycle`). Volume: a few records per question (~100–300 per session).
 *
 * `QueryInputTracker` is the rule, free of the DOM; `useQueryTelemetry` binds it to an input.
 */

import { useEffect, useRef } from "preact/hooks";
import type { SessionOrchestrator } from "../../session/orchestrator.js";
import type { QueryField } from "../../telemetry/record-kinds-interaction.js";
import { interactionLog, quietly, type InteractionEvent } from "./interaction-log.js";

export type QueryEvent = Extract<InteractionEvent, { readonly kind: "query_focus" | "query_first_keystroke" | "query_edit" }>;

export class QueryInputTracker {
  private armed = false; // the next input is a composition's first keystroke
  private lastValue = ""; // the field's text after the last input the tracker saw
  private deleted = 0; // characters removed by the current deletion run

  constructor(
    private readonly emit: (event: QueryEvent) => void,
    private readonly field: QueryField,
    private cycle: () => number | undefined = () => undefined,
  ) {}

  focus(value: string): void {
    this.endRun();
    this.armed = true;
    this.lastValue = value;
    this.emit({ kind: "query_focus", detail: this.where() });
  }

  input(value: string): void {
    if (this.armed) {
      this.armed = false;
      this.emit({ kind: "query_first_keystroke", detail: this.where() });
    }
    const removed = this.lastValue.length - value.length;
    this.lastValue = value;
    if (removed > 0) {
      this.deleted += removed;
      if (value.length === 0) this.endRun(); // cleared
    } else {
      this.endRun();
    }
  }

  blur(): void { this.endRun(); }

  /**
   * The text as the screen holds it, after each render: a change not typed (the field emptied when a question is
   * sent, or the question put back after a refused send) ends the run, and an emptied field starts a new composition.
   */
  valueSet(value: string): void {
    if (value === this.lastValue) return;
    this.endRun();
    this.lastValue = value;
    if (value === "") this.armed = true;
  }

  private endRun(): void {
    if (this.deleted > 0) this.emit({ kind: "query_edit", detail: { count: this.deleted, ...this.where() } });
    this.deleted = 0;
  }

  private where(): { readonly field: QueryField; readonly cycle?: number } {
    const cycle = this.cycle();
    return cycle === undefined ? { field: this.field } : { field: this.field, cycle };
  }
}

const valueOf = (e: Event): string => (e.currentTarget as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";

/**
 * Binds a `QueryInputTracker` to one text field: spread `props(onValue)` on the input (it calls `onValue` with the new
 * text after logging), and pass the field's current `value` so a send that empties it starts a new composition.
 * `cycle`: the view on screen (`snapshot.currentCycle`), absent where the component has no snapshot.
 */
export function useQueryTelemetry(field: QueryField, orchestrator: Pick<SessionOrchestrator, "logMapUse">, cycle: number | undefined, value: string) {
  const latest = useRef({ orchestrator, cycle });
  latest.current = { orchestrator, cycle };
  const tracker = useRef<QueryInputTracker | null>(null);
  if (tracker.current === null) {
    tracker.current = new QueryInputTracker(
      (event) => quietly(interactionLog(latest.current.orchestrator))(event),
      field,
      () => latest.current.cycle,
    );
  }
  const t = tracker.current;
  useEffect(() => { t.valueSet(value); }, [value]);
  return {
    props: (onValue: (value: string) => void) => ({
      onFocus: (e: Event) => t.focus(valueOf(e)),
      onBlur: () => t.blur(),
      onInput: (e: Event) => { const v = valueOf(e); t.input(v); onValue(v); },
    }),
  };
}
