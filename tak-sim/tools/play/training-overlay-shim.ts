/**
 * The play harness's handle on the training incident's map overlay (revision (bp), 26 Oct 2026): work package B's
 * `drawTrainingOverlay(map, view, item, lang): () => void` in `app/render/ui/training-overlay.ts` draws the item's marks, the memory
 * item's unit and the feedback's drawing on the live map, as the app's `TrainingScreen` does. The harness's map bundle
 * (`map-render.ts` `mapBundle`) resolves this module to B's file when it is in the tree; this stand-in only says that it is not, so the
 * PNG is never drawn without the overlay the participant sees. Types match B's declared signature.
 */

import type { TakMapHandle } from "../../app/render/ui/components/MapView.js";
import type { Lang } from "../../app/i18n/lang.js";
import type { TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem } from "../../app/session/training/spec.js";

/** B's module, as the map bundle resolves it (repository-relative). */
export const TRAINING_OVERLAY_MODULE = "app/render/ui/training-overlay.ts";

export function drawTrainingOverlay(_map: TakMapHandle["map"], _view: TrainingView, _item: TrainingItem | null, _lang: Lang): () => void {
  throw new Error(`the training's map overlay (${TRAINING_OVERLAY_MODULE}, work package B) is not in this tree`);
}
