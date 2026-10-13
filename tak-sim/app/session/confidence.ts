/**
 * The one confidence scale (researcher decision 1 Oct 2026): every question that asks how sure the
 * participant is — since revision (x), 6 Oct 2026 (Type J and the course-of-action confidence withdrawn),
 * the SA freeze items and the SPAM and visible probes — offers the same four steps, all of them every
 * time, and nothing is preselected.
 */

export const CONFIDENCE_SCALE = [25, 50, 75, 100] as const;
export type ConfidenceStep = (typeof CONFIDENCE_SCALE)[number];

export function isConfidenceStep(value: number): value is ConfidenceStep {
  return (CONFIDENCE_SCALE as readonly number[]).includes(value);
}

/** Refuses a confidence that is not on the scale (a UI defect, never a participant's choice). */
export function assertConfidenceStep(value: number): asserts value is ConfidenceStep {
  if (!isConfidenceStep(value)) throw new RangeError(`confidence ${value} is not on the scale ${CONFIDENCE_SCALE.join("/")}`);
}
