/**
 * The scenario contract constructor — SPEC/04_Data_Model.md §2:
 *
 * "A scenario cannot be constructed unless it declares what it probes and
 * what counts as correct. Construction throws on every violation listed
 * below; there is no partially-valid scenario."
 *
 * This is the single choke point: every one of the checks below is
 * a semantic/cardinality invariant TypeScript's structural typing cannot
 * express on its own (exact array lengths, "exactly one", cross-field
 * requirements like "load-bearing implies three routes"). It accepts an
 * already TS-shaped candidate — narrower schema validation of untyped JSON
 * from the asset bundle is a separate, later concern (`tools/bundle/`) and
 * is not one of the named cases here.
 *
 * SPEC/26 (revision (p)) replaces the fixed twenty cycles with fourteen main VIEWS plus a practice
 * view: the length checks are 14, and two checks are added — the practice view is present, and
 * the views' step spans cover steps 1-20 exactly once, in order (`invalid-step-spans`).
 */

import type { ScenarioContract } from "./types.js";
import {
  FIRST_MAIN_STEP, freezeWindowFor, LAST_MAIN_STEP, MAIN_VIEW_COUNT, PRACTICE_STEP, PRACTICE_VIEW_INDEX, STEP_SECONDS,
  stepStartVirtual, viewMinSecondsFor, PRACTICE_VIEW_MIN_SECONDS,
} from "./views.js";

export type ContractViolationReason =
  | "empty-id"
  | "empty-constructs"
  | "zero-invariants"
  | "invalid-invariant"
  | "contradiction-count"
  | "omission-count"
  | "invalid-validity-claim"
  | "missing-probe-schedule"
  | "missing-extent"
  | "wrong-cycle-count"
  | "wrong-envelope-count"
  | "wrong-channel-set-count"
  | "missing-practice-view"
  | "invalid-step-spans"
  | "invalid-view-timing"
  | "insufficient-branches"
  | "t1-missing-delivery-time"
  | "load-bearing-insufficient-routes";

export class ScenarioConstructionError extends Error {
  constructor(
    readonly reason: ContractViolationReason,
    message: string,
  ) {
    super(message);
    this.name = "ScenarioConstructionError";
  }
}

function fail(reason: ContractViolationReason, message: string): never {
  throw new ScenarioConstructionError(reason, message);
}

function isValidityClaimComplete(validity: ScenarioContract["validity"] | null | undefined): boolean {
  if (!validity) return false;
  return (
    validity.authoredBy.trim().length > 0 &&
    validity.represents.length > 0 &&
    validity.doesNotRepresent.length > 0 &&
    validity.reviewedBy.length > 0 &&
    validity.sourceBasis.length > 0 &&
    validity.knownDivergences.length > 0
  );
}

/**
 * SPEC/26 §3, §7: the main views, in index order 1-14, each span one or two steps, and together
 * cover steps 1-20 exactly once, in order ("merge, don't skip"); the practice view is step W2.
 */
function checkStepSpans(input: ScenarioContract): void {
  let nextStart = (FIRST_MAIN_STEP - 1) * STEP_SECONDS;
  input.cycles.forEach((c, i) => {
    if (c.index !== i + 1) fail("invalid-step-spans", `cycles[${i}] has index ${c.index}; views must be in order 1-${MAIN_VIEW_COUNT}`);
    if (c.steps !== 1 && c.steps !== 2) fail("invalid-step-spans", `View ${c.index} spans ${String(c.steps)} steps; a view spans one or two (SPEC/26 D2)`);
    if (c.startsAtVirtual !== nextStart) fail("invalid-step-spans", `View ${c.index} starts at ${c.startsAtVirtual}, expected ${nextStart}: steps must be covered once, in order`);
    // SPEC/26 §2: a merged view carries its second step's positions, at that step's start; a single-step view none.
    const boundaryAt = c.steps === 2 ? c.startsAtVirtual + STEP_SECONDS : null;
    if ((c.stepBoundary?.atVirtual ?? null) !== boundaryAt) fail("invalid-step-spans", `View ${c.index} spans ${c.steps} step(s); its stepBoundary must be ${boundaryAt === null ? "null" : `at ${boundaryAt}`}`);
    nextStart += c.steps * STEP_SECONDS;
  });
  if (nextStart !== LAST_MAIN_STEP * STEP_SECONDS) fail("invalid-step-spans", `The views end at ${nextStart}, expected ${LAST_MAIN_STEP * STEP_SECONDS} (the end of step ${LAST_MAIN_STEP})`);
  const p = input.practice.cycle;
  if (p.steps !== 1 || p.startsAtVirtual !== stepStartVirtual(PRACTICE_STEP) || p.stepBoundary !== null) fail("invalid-step-spans", `The practice view must span the single step W2, starting at ${stepStartVirtual(PRACTICE_STEP)} (12:00)`);
}

/**
 * The view timing (researcher decision 1 Oct 2026): each view's minimum length is the real one for
 * its step count, and a view has a freeze offset exactly when it has a freeze — a whole second
 * within [25, minimum length − 20].
 */
function checkViewTiming(input: ScenarioContract): void {
  for (const c of [input.practice.cycle, ...input.cycles]) {
    const expectedMin = c.index === PRACTICE_VIEW_INDEX ? PRACTICE_VIEW_MIN_SECONDS : viewMinSecondsFor(c.steps);
    if (c.minViewSeconds !== expectedMin) fail("invalid-view-timing", `View ${c.index} has minViewSeconds ${c.minViewSeconds}, expected ${expectedMin} for ${c.steps} step(s)`);
    const at = c.freezeAtSeconds;
    if (!c.hasFreeze) {
      if (at !== null) fail("invalid-view-timing", `View ${c.index} has no freeze but freezeAtSeconds ${at}`);
      continue;
    }
    const [earliest, latest] = freezeWindowFor(c.minViewSeconds, c.steps === 2);
    if (at === null || !Number.isInteger(at) || at < earliest || at > latest) fail("invalid-view-timing", `View ${c.index}'s freezeAtSeconds ${String(at)} must be a whole second in [${earliest}, ${latest}]`);
  }
}

function isFiniteExtent(extent: ScenarioContract["extent"] | null | undefined): boolean {
  if (!extent) return false;
  return (
    Number.isFinite(extent.south) &&
    Number.isFinite(extent.north) &&
    Number.isFinite(extent.west) &&
    Number.isFinite(extent.east) &&
    typeof extent.crs === "number"
  );
}

/**
 * Validates and returns `input` as a {@link ScenarioContract}, or throws a
 * {@link ScenarioConstructionError} on the first violation found. Checks
 * run in the order SPEC/04 §2 lists them, so error messages are
 * predictable; nothing here mutates `input`.
 */
export function createScenarioContract(input: ScenarioContract): ScenarioContract {
  if (!input.id || input.id.trim().length === 0) {
    fail("empty-id", "ScenarioContract.id must not be empty");
  }

  if (!input.constructs || input.constructs.length === 0) {
    fail("empty-constructs", "ScenarioContract.constructs must not be empty — the scenario must declare what it probes");
  }

  if (!input.invariants || input.invariants.length === 0) {
    fail("zero-invariants", "ScenarioContract.invariants must not be empty — there is no answer key");
  }
  for (const invariant of input.invariants) {
    const expectedIsNonFiniteNumber = typeof invariant.expected === "number" && !Number.isFinite(invariant.expected);
    if (expectedIsNonFiniteNumber || invariant.tolerance < 0) {
      fail(
        "invalid-invariant",
        `Invariant "${invariant.name}" has a non-finite expected value or negative tolerance (tolerance=${invariant.tolerance})`,
      );
    }
  }

  if (!input.contradiction) {
    fail("contradiction-count", "ScenarioContract requires exactly one contradiction marker; found none");
  }

  if (!input.omission) {
    fail("omission-count", "ScenarioContract requires exactly one omission marker; found none");
  }

  if (!isValidityClaimComplete(input.validity)) {
    fail("invalid-validity-claim", "ScenarioContract.validity is missing or incomplete — every field must be populated");
  }

  if (!input.probeSchedule || !Array.isArray(input.probeSchedule.probes)) {
    fail("missing-probe-schedule", "ScenarioContract.probeSchedule is missing");
  }

  if (!isFiniteExtent(input.extent)) {
    fail("missing-extent", "ScenarioContract.extent is missing or incomplete");
  }

  if (!Array.isArray(input.cycles) || input.cycles.length !== MAIN_VIEW_COUNT) {
    fail("wrong-cycle-count", `ScenarioContract.cycles must have length ${MAIN_VIEW_COUNT} (SPEC/26 §3), got ${input.cycles?.length ?? 0}`);
  }

  if (!Array.isArray(input.envelopes) || input.envelopes.length !== MAIN_VIEW_COUNT) {
    fail("wrong-envelope-count", `ScenarioContract.envelopes must have length ${MAIN_VIEW_COUNT}, got ${input.envelopes?.length ?? 0}`);
  }

  if (!Array.isArray(input.channelSets) || input.channelSets.length !== MAIN_VIEW_COUNT) {
    fail("wrong-channel-set-count", `ScenarioContract.channelSets must have length ${MAIN_VIEW_COUNT}, got ${input.channelSets?.length ?? 0}`);
  }

  if (!input.practice || input.practice.cycle?.index !== PRACTICE_VIEW_INDEX || input.practice.envelope?.cycle !== PRACTICE_VIEW_INDEX) {
    fail("missing-practice-view", "ScenarioContract.practice must hold the practice view VP (index 0, SPEC/26 D3) and its envelope");
  }

  checkStepSpans(input);
  checkViewTiming(input);

  if (!Array.isArray(input.branches) || input.branches.length < 5) {
    fail("insufficient-branches", `ScenarioContract.branches must have at least 5 entries, got ${input.branches?.length ?? 0}`);
  }

  for (const atom of input.atoms ?? []) {
    if (atom.tier === "T1_pushed" && atom.provenance.deliveredAt === null) {
      fail("t1-missing-delivery-time", `Atom "${atom.id}" is tier T1_pushed but has no delivery time (provenance.deliveredAt is null)`);
    }
    if (atom.loadBearing) {
      const routeCount = [atom.routes.directed, atom.routes.assistive, atom.routes.substitutive].filter((r) => r !== null).length;
      if (routeCount < 3) {
        fail(
          "load-bearing-insufficient-routes",
          `Load-bearing atom "${atom.id}" has ${routeCount} route(s), needs all three (directed, assistive, substitutive)`,
        );
      }
    }
  }

  return input;
}
