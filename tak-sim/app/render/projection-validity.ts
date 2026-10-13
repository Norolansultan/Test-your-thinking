/**
 * The projection's validity label (SPEC/12 §4, "ennuste voimassa klo … saakka"), drawn under the
 * projection's own label on the map. The envelope's authored `horizonLabel` is used when present;
 * otherwise the label is derived from `horizonVirtual`, the end of the view's last step — the time
 * the next view starts.
 */

import type { RenderableEnvelope } from "../boundary/render-boundary.js";

/** Virtual time 0 is 13:20, the start of step 1 (`app/scenario/views.ts`). */
const VIRTUAL_ZERO_MINUTES = 13 * 60 + 20;

export function clockAtVirtual(virtualSeconds: number): string {
  const total = (((VIRTUAL_ZERO_MINUTES + Math.floor(virtualSeconds / 60)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function projectionValidityLabelFi(envelope: Pick<RenderableEnvelope, "horizonLabel" | "horizonVirtual">): string {
  const authored = envelope.horizonLabel.trim();
  return authored !== "" ? authored : `ennuste voimassa klo ${clockAtVirtual(envelope.horizonVirtual)} saakka`;
}

/**
 * The label in the session language (8 Oct 2026): Finnish as authored; English "forecast valid until
 * HH:MM", derived from the horizon (the authored label is Finnish text, and agrees with the horizon).
 */
export function projectionValidityLabel(envelope: Pick<RenderableEnvelope, "horizonLabel" | "horizonVirtual">, lang: "fi" | "en" = "fi"): string {
  return lang === "en" ? `forecast valid until ${clockAtVirtual(envelope.horizonVirtual)}` : projectionValidityLabelFi(envelope);
}
