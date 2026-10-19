/**
 * The consult notification (SPEC/30 §4, 19 Oct 2026). Split out of `orchestrator.ts`, which owns the view's clock and
 * calls this at the notification's moment, when a freeze or a SPAM item closes, and at the view's end.
 *
 * At 60 s on the view's clock (`CONSULT_PROMPT_AT_S`, scaled like every view moment) in every main view V1–V14 — never
 * the practice view — a non-modal notice appears beside the tool button: "New reports since your last plan", with one
 * button that opens the group's tool (Haku in the Haku group, `radio`; the Thinker in the guide group and for the
 * demonstration's `reasoning_once`) and a close button. It carries no content, is the same in fit and no-fit views and is
 * never triggered by a record: only the clock places it. If a freeze or a SPAM item is open at that moment, it waits
 * until that closes and is shown then (`consult_prompt_shown.atViewSeconds` logs the actual moment). Still open when the
 * view ends: dismissed by the end (`cause: "view_end"`); still waiting then, it is dropped unlogged (it never showed).
 *
 * Once per run of a view: `reset` at each view's start. A resumed session replays the interrupted view from its start
 * (SPEC/05 §9), which is a new run and may show it again; within one run it shows at most once.
 *
 * Records (raw, `record-kinds.ts`): `consult_prompt_shown` — durable before the notice shows (I5) — then exactly one of
 * `consult_prompt_opened` or `consult_prompt_dismissed`. The notice leaves the screen once that record is durable.
 * Nothing here reads a clock or draws a number (I1); nothing here is truth (I4).
 */

import type { CycleIndex } from "../engine/primitives.js";
import type { Cell } from "../scenario/types.js";
import type { ConsultTool, TelemetryEvent } from "../telemetry/record-kinds.js";

export interface ConsultHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
  readonly notify: () => void;
}

/** The notice as the screen shows it: which tool its button opens. Carries no content. */
export interface ConsultPromptView {
  readonly tool: ConsultTool;
}

/** The tool the notice opens: Haku in the Haku group, the Thinker in either Thinker cell. */
export function consultToolOf(cell: Cell): ConsultTool {
  return cell === "radio" ? "haku" : "thinker";
}

/**
 * `idle`: not yet due in this run of the view; `pending`: due, waiting for a freeze or SPAM item to close; `logging`:
 * `consult_prompt_shown` being written; `open`: on screen; `closing`: its closing record being written; `done`: over
 * for this run (opened, dismissed or dropped).
 */
type State = "idle" | "pending" | "logging" | "open" | "closing" | "done";

export class ConsultNotice {
  private cycle: CycleIndex | null = null;
  private state: State = "idle";

  constructor(private readonly host: ConsultHost, private readonly tool: ConsultTool) {}

  /** A new run of a view: a main view (`cycle`), or null for the practice view and anything outside a view (never shown). */
  reset(cycle: CycleIndex | null): void {
    this.cycle = cycle;
    this.state = "idle";
  }

  /** On screen (its button may be pressed). */
  get open(): boolean { return this.state === "open"; }

  /** Due but held back by an open freeze or SPAM item. */
  get pending(): boolean { return this.state === "pending"; }

  /** On screen while open, and while its closing record is written (it leaves once that is durable, I5; a second press is refused). */
  view(): ConsultPromptView | null {
    return this.state === "open" || this.state === "closing" ? { tool: this.tool } : null;
  }

  /**
   * The notification's moment on the view's clock. `blocked`: a freeze or a SPAM item is open, so it waits for
   * {@link flush}. Once per run: a second call does nothing.
   */
  async due(atViewSeconds: number, blocked: boolean): Promise<void> {
    if (this.state !== "idle" || this.cycle === null) return;
    if (blocked) { this.state = "pending"; return; }
    await this.show(atViewSeconds);
  }

  /** What held it back has closed: shown now, at this view moment, if it was waiting. */
  async flush(atViewSeconds: number): Promise<void> {
    if (this.state === "pending") await this.show(atViewSeconds);
  }

  /** The notice's button: `consult_prompt_opened`; the notice goes once it is durable. Resolves to the tool to open. */
  async openTool(): Promise<ConsultTool> {
    const cycle = this.expectOpen("openConsultPrompt");
    this.state = "closing";
    await this.host.event({ kind: "consult_prompt_opened", detail: { cycle, tool: this.tool } });
    this.state = "done";
    this.host.notify();
    return this.tool;
  }

  /** The notice's close button: `consult_prompt_dismissed` (`participant`); the notice goes once it is durable. */
  async dismiss(): Promise<void> {
    const cycle = this.expectOpen("dismissConsultPrompt");
    this.state = "closing";
    await this.host.event({ kind: "consult_prompt_dismissed", detail: { cycle, tool: this.tool, cause: "participant" } });
    this.state = "done";
    this.host.notify();
  }

  /**
   * The view ends: a notice shown (or being shown) and not acted on is dismissed by the end (`view_end`); one still
   * waiting is dropped without a record, as it never showed. Nothing is notified: the view's end moves the screen on.
   */
  async viewEnded(): Promise<void> {
    const cycle = this.cycle;
    const shown = this.state === "open" || this.state === "logging";
    this.state = "done";
    if (shown && cycle !== null) await this.host.event({ kind: "consult_prompt_dismissed", detail: { cycle, tool: this.tool, cause: "view_end" } });
  }

  private async show(atViewSeconds: number): Promise<void> {
    const cycle = this.cycle!;
    this.state = "logging";
    await this.host.event({ kind: "consult_prompt_shown", detail: { cycle, atViewSeconds, tool: this.tool } });
    // Shown once its record is durable (I5) — unless the view ended (or another began) meanwhile.
    if (this.state === "logging" && this.cycle === cycle) {
      this.state = "open";
      this.host.notify();
    }
  }

  private expectOpen(name: string): CycleIndex {
    if (this.state !== "open" || this.cycle === null) throw new Error(`${name} with the consult notification ${this.state}`);
    return this.cycle;
  }
}

// ---- The suggested question (SPEC/30 §4) ------------------------------------------------------------

/**
 * The guide's suggested-question chip above the Thinker's input: submitted exactly as shown, through the Thinker's
 * normal path, its `ai_chat_query_submitted` carrying `viaChip: true`. Finnish DRAFT (native check, SPEC/30 §8).
 * The chip's label is this same text (`UI_TEXT[lang].consult.chip`).
 */
export const SUGGESTED_QUESTION: Readonly<Record<"fi" | "en", string>> = {
  en: "What has changed that matters for my plan?",
  fi: "Mikä on muuttunut niin, että sillä on merkitystä suunnitelmalleni?",
};

/**
 * The chip is offered in the guide group (`reasoning_intent`) only, in the views the directive is in force (from V8,
 * after the hinge view); never in the Haku group, in `reasoning_once`, before V8 or in the practice view (index 0).
 */
export function suggestedQuestionOffered(cell: Cell, view: number, hingeAfterView: number): boolean {
  return cell === "reasoning_intent" && view > hingeAfterView;
}
