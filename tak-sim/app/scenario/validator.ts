/**
 * The CI scenario validator — SPEC/03_Scenario_Master.md §11: "Run in CI
 * over the authored bundle. Each is a build-blocking assertion." Fourteen
 * checks, numbered here as they are listed there, plus a fifteenth from
 * SPEC/12_Map_Symbology_and_Projection.md §10 ("CI assertion:
 * `scenario.allocationRecommendations.length === 0`"). #16 is SPEC/25 §6's navigation coverage; #17 (revision (bm), 25 Oct 2026)
 * the "report filed" pointers' integrity.
 *
 * Unlike {@link createScenarioContract} (which throws on the first
 * structural violation, because a partially-valid scenario must never
 * exist), this collects every failure and returns them together — it is a
 * content-quality report for the scenario author, not a hard construction
 * gate, and an author fixing content wants the whole list at once.
 *
 * Two checks are deliberately scoped narrower than their one-line spec
 * description, with the gap documented rather than papered over:
 *
 * - **#11** ("directed reply latency matches assistive retrieval latency")
 *   compares against the M5 retrieval engine's latency distribution, which
 *   does not exist yet (SPEC/14, not built). What IS checkable now — that
 *   every authored `SourceClass.replyLatency` is internally well-formed —
 *   is checked here; the actual cross-system match is `test/retrieval/latency.spec`
 *   per SPEC/10 M5, once there is a second distribution to compare against.
 * - **#14** ("no TruthAnnotation field is reachable from any render-layer
 *   type") is primarily a *type-level* guarantee already proven by the
 *   static guard in `app/boundary/render-boundary.ts` (SPEC/04 §9). This
 *   check adds the runtime half: every atom in the scenario is actually
 *   passed through `toRenderable()` and the presence-assertion walk, which
 *   would catch e.g. a truth-shaped value accidentally nested inside an
 *   open `ReferenceDatum.fields` record.
 */

import { assertNoTruthKeysPresent, TruthLeakError, toRenderable } from "../boundary/render-boundary.js";
import { checkNavigationCoverage } from "../retrieval/navigation.js";
import {
  CANONICAL_FLAG_SEQUENCE,
  DESIGNED_EVENT_IDS,
  CONTAINMENT_HOLDS_MAX,
  CONTAINMENT_HOLDS_MIN,
  LOAD_BEARING_T4_IDS,
  REQUIRED_DIVERGENCE_TAGS,
  TIER_COUNT_BANDS,
  type ScenarioContract,
  type Tier,
} from "./types.js";
import { STEP_SECONDS } from "./views.js";

export type ValidatorCheckId =
  | "markers-well-formed" // #1
  | "load-bearing-routes" // #2
  | "flag-sequence" // #3
  | "containment-base-rate" // #4
  | "probe-invariant-links" // #5
  | "atom-completeness" // #6
  | "tier-shares" // #7
  | "load-bearing-t4-presence" // #8
  | "channel-traceability" // #9
  | "channel-no-contradiction-flag" // #10
  | "latency-distribution-well-formed" // #11 (scoped, see module doc)
  | "envelope-horizon" // #12
  | "validity-claim-divergence-tags" // #13
  | "no-truth-leak" // #14
  | "no-allocation-recommendations" // #15, SPEC/12 §10
  | "navigation-coverage" // #16, SPEC/25 §6
  | "pointers"; // #17, revision (bm)

export interface ValidationFailure {
  readonly check: ValidatorCheckId;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly failures: readonly ValidationFailure[];
}

function f(check: ValidatorCheckId, message: string): ValidationFailure {
  return { check, message };
}

// #1 — markers present (constructor's job) and well-formed: every referenced atom id actually exists.
function checkMarkersWellFormed(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const atomIds = new Set(s.atoms.map((a) => a.id));
  const c = s.contradiction;
  for (const [field, id] of [
    ["premiseAtomId", c.premiseAtomId],
    ["counterAtomId", c.counterAtomId],
    ["reconcilingAtomId", c.reconcilingAtomId],
  ] as const) {
    if (!atomIds.has(id)) {
      failures.push(f("markers-well-formed", `contradiction.${field} "${id}" does not reference an existing atom`));
    }
  }
  for (const id of s.omission.developmentAtomIds) {
    if (!atomIds.has(id)) {
      failures.push(f("markers-well-formed", `omission.developmentAtomIds contains "${id}", which does not reference an existing atom`));
    }
  }
  return failures;
}

// #2 — every load-bearing fact has three resolvable routes.
function checkLoadBearingRoutes(s: ScenarioContract): ValidationFailure[] {
  return s.atoms
    .filter((a) => a.loadBearing)
    .filter((a) => !(a.routes.directed && a.routes.assistive && a.routes.substitutive))
    .map((a) => f("load-bearing-routes", `Load-bearing atom "${a.id}" does not have all three routes resolvable`));
}

// #3 — flag sequence matches SPEC/26 §3 exactly (the 14 main views; the practice view is never checked);
// no run of more than two consecutive breaches.
function checkFlagSequence(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const byCycle = [...s.envelopes].sort((a, b) => a.cycle - b.cycle);
  const actual = byCycle.map((e) => e.flag);
  if (actual.length !== CANONICAL_FLAG_SEQUENCE.length || actual.some((flag, i) => flag !== CANONICAL_FLAG_SEQUENCE[i])) {
    failures.push(f("flag-sequence", `Envelope flag sequence does not match SPEC/26 §3 exactly. Got: [${actual.join(", ")}]`));
  }
  let run = 0;
  for (const envelope of byCycle) {
    run = envelope.flag === "holds" ? 0 : run + 1;
    if (run > 2) {
      failures.push(f("flag-sequence", `More than two consecutive breaches ending at view ${envelope.cycle}`));
    }
  }
  return failures;
}

// #4 — containment base rate is 45-55% holds.
function checkContainmentBaseRate(s: ScenarioContract): ValidationFailure[] {
  if (s.envelopes.length === 0) return [];
  const holds = s.envelopes.filter((e) => e.flag === "holds").length;
  const share = holds / s.envelopes.length;
  if (share < CONTAINMENT_HOLDS_MIN || share > CONTAINMENT_HOLDS_MAX) {
    return [f("containment-base-rate", `Containment base rate is ${(share * 100).toFixed(1)}%, outside the ${CONTAINMENT_HOLDS_MIN * 100}-${CONTAINMENT_HOLDS_MAX * 100}% band`)];
  }
  return [];
}

// #5 — every probe resolves against an entry in invariants.
function checkProbeInvariantLinks(s: ScenarioContract): ValidationFailure[] {
  const invariantNames = new Set(s.invariants.map((i) => i.name));
  return s.probeSchedule.probes
    .filter((p) => !invariantNames.has(p.invariantName))
    .map((p) => f("probe-invariant-links", `Probe "${p.id}" references invariant "${p.invariantName}", which does not exist`));
}

// #6 — every atom has a tier, a source class, a provenance record and a truth annotation.
function checkAtomCompleteness(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const sourceClassIds = new Set(s.sourceClasses.map((sc) => sc.id));
  const validTiers: readonly Tier[] = ["T1_pushed", "T2_system", "T3_person", "T4_lateral"];
  for (const atom of s.atoms) {
    if (!validTiers.includes(atom.tier)) {
      failures.push(f("atom-completeness", `Atom "${atom.id}" has an invalid tier "${atom.tier}"`));
    }
    if (!atom.provenance) {
      failures.push(f("atom-completeness", `Atom "${atom.id}" has no provenance record`));
    } else if (!sourceClassIds.has(atom.provenance.sourceClassId)) {
      failures.push(f("atom-completeness", `Atom "${atom.id}" references source class "${atom.provenance.sourceClassId}", which is not declared in sourceClasses`));
    }
    if (!atom.truth) {
      failures.push(f("atom-completeness", `Atom "${atom.id}" has no truth annotation`));
    }
  }
  return failures;
}

// SPEC/02 §3's own table order — an explicit, fixed sequence rather than Object.entries() (I1: iteration order must never depend on object-key enumeration).
const TIER_ORDER: readonly Tier[] = ["T1_pushed", "T2_system", "T3_person", "T4_lateral"];

// #7 — tier shares fall within the SPEC/02 §3 bands.
function checkTierShares(s: ScenarioContract): ValidationFailure[] {
  const counts: Record<Tier, number> = { T1_pushed: 0, T2_system: 0, T3_person: 0, T4_lateral: 0 };
  for (const atom of s.atoms) counts[atom.tier] += 1;
  const failures: ValidationFailure[] = [];
  for (const tier of TIER_ORDER) {
    const band = TIER_COUNT_BANDS[tier];
    const count = counts[tier];
    if (count < band.min || count > band.max) {
      failures.push(f("tier-shares", `Tier ${tier} has ${count} atoms, outside the band [${band.min}, ${band.max}]`));
    }
  }
  return failures;
}

// #8 — all three load-bearing T4 items are present, reachable (see #2), and have a named downstream consequence.
function checkLoadBearingT4Presence(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const byId = new Map(s.atoms.map((a) => [a.id, a]));
  for (const id of LOAD_BEARING_T4_IDS) {
    const atom = byId.get(id);
    if (!atom) {
      failures.push(f("load-bearing-t4-presence", `Load-bearing T4 item "${id}" is not present among the scenario's atoms`));
      continue;
    }
    if (atom.tier !== "T4_lateral") {
      failures.push(f("load-bearing-t4-presence", `"${id}" exists but is tier ${atom.tier}, not T4_lateral`));
    }
    if (!atom.loadBearing) {
      failures.push(f("load-bearing-t4-presence", `"${id}" exists but is not marked loadBearing`));
    }
    if (!atom.consequence) {
      failures.push(f("load-bearing-t4-presence", `"${id}" has no named downstream consequence`));
    }
  }
  return failures;
}

// #9 — every channel signal's content is traceable to authored corpus atoms; none is generative.
function checkChannelTraceability(s: ScenarioContract): ValidationFailure[] {
  const atomIds = new Set(s.atoms.map((a) => a.id));
  const failures: ValidationFailure[] = [];
  for (const set of s.channelSets) {
    for (const signal of set.signals) {
      for (const id of signal.derivedFromAtomIds) {
        if (!atomIds.has(id)) {
          failures.push(f("channel-traceability", `Channel signal at cycle ${set.cycle} cites atom "${id}", which does not exist in the corpus`));
        }
      }
    }
    for (const id of set.trafficSummaryOmitsAtomIds) {
      if (!atomIds.has(id)) {
        failures.push(f("channel-traceability", `Channel traffic summary at cycle ${set.cycle} claims to omit atom "${id}", which does not exist`));
      }
    }
  }
  return failures;
}

// #10 — the channel never emits a signal flagging the contradiction (SPEC/04 §6 CI assertion).
function checkChannelNoContradictionFlag(s: ScenarioContract): ValidationFailure[] {
  const { premiseAtomId, counterAtomId, cycle } = s.contradiction;
  const set = s.channelSets.find((cs) => cs.cycle === cycle);
  if (!set) return [];
  return set.signals
    .filter((signal) => signal.derivedFromAtomIds.includes(premiseAtomId) && signal.derivedFromAtomIds.includes(counterAtomId))
    .map(() => f("channel-no-contradiction-flag", `A channel signal at cycle ${cycle} cites both the contradiction's premise and counter atoms — it flags the conflict`));
}

// #11 — scoped, see module doc: every authored latency distribution is internally well-formed.
function checkLatencyDistributionWellFormed(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  for (const sc of s.sourceClasses) {
    const l = sc.replyLatency;
    const finite = [l.minSeconds, l.medianSeconds, l.maxSeconds, l.sigma].every(Number.isFinite);
    if (!finite || l.sigma <= 0 || !(l.minSeconds <= l.medianSeconds && l.medianSeconds <= l.maxSeconds)) {
      failures.push(
        f(
          "latency-distribution-well-formed",
          `SourceClass "${sc.id}" has an ill-formed reply latency distribution (min=${l.minSeconds}, median=${l.medianSeconds}, max=${l.maxSeconds}, sigma=${l.sigma})`,
        ),
      );
    }
  }
  return failures;
}

// #12 — every envelope carries a validity horizon equal to the end of its view's last step
// (SPEC/26 §2: 20 minutes, or 40 in a merged view).
function checkEnvelopeHorizon(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  for (const e of s.envelopes) {
    const view = s.cycles.find((c) => c.index === e.cycle);
    if (!view) {
      failures.push(f("envelope-horizon", `Envelope at view ${e.cycle} has no view`));
      continue;
    }
    const expected = view.startsAtVirtual + view.steps * STEP_SECONDS;
    if (e.horizonVirtual !== expected) {
      failures.push(f("envelope-horizon", `Envelope at view ${e.cycle} has horizonVirtual=${e.horizonVirtual}, expected ${expected} (the end of the view's last step)`));
    }
  }
  return failures;
}

// #13 — ValidityClaim.knownDivergences contains all three required declarations, by tag.
function checkValidityClaimDivergenceTags(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  for (const tag of REQUIRED_DIVERGENCE_TAGS) {
    const present = s.validity.knownDivergences.some((d) => d.trim().toLowerCase().startsWith(`${tag}:`));
    if (!present) {
      failures.push(f("validity-claim-divergence-tags", `validity.knownDivergences is missing the required "${tag}:" declaration`));
    }
  }
  return failures;
}

// #14 — runtime half of invariant I4 (the static half is app/boundary/render-boundary.ts's _Check).
function checkNoTruthLeak(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  for (const atom of s.atoms) {
    try {
      const renderable = toRenderable(atom);
      assertNoTruthKeysPresent(renderable);
    } catch (e) {
      const detail = e instanceof TruthLeakError ? `${e.path}.${e.key}` : String(e);
      failures.push(f("no-truth-leak", `Atom "${atom.id}" leaks a truth-annotation key into its renderable form: ${detail}`));
    }
  }
  return failures;
}

// #15 — SPEC/12 §10: never populated in this study.
function checkNoAllocationRecommendations(s: ScenarioContract): ValidationFailure[] {
  if (s.allocationRecommendations.length > 0) {
    return [f("no-allocation-recommendations", `allocationRecommendations has ${s.allocationRecommendations.length} entries; must be empty in this study (SPEC/12 §10)`)];
  }
  return [];
}

// #16 — SPEC/25 §6: every category is a known one, and no load-bearing item sits in a category
// that would otherwise be empty (at least three non-load-bearing items beside it by its cycle).
function checkNavigationCoverageRule(s: ScenarioContract): ValidationFailure[] {
  return checkNavigationCoverage(s.atoms).map((x) => f("navigation-coverage", `"${x.atomId}": ${x.message}`));
}

/** Revision (bm): H9's and H10's records (`09` (bh) §3), which no pointer may point to. */
export const H9_H10_RECORD_IDS: readonly string[] = [
  DESIGNED_EVENT_IDS.planted, DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.gridAtLine, DESIGNED_EVENT_IDS.heliLineClearance,
  DESIGNED_EVENT_IDS.objection, "t4.private_doubt",
];

// #17 — revision (bm), 25 Oct 2026: a "report filed" pointer (`InfoAtom.pointer`, `pointers.ts`) is pushed in exactly one view, in its
// record's step, at or after the record's clock; the record exists and is recorded (pushed nowhere); it is no H9/H10 record; no pointer
// comes from an H9/H10 record's source within a step of it (an obvious pointer), nor from a source whose only records are those; and no
// freeze item's key or basis is a pointer (a pointer holds no content).
function checkPointers(s: ScenarioContract): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const pushedIn = new Map<string, number>();
  for (const c of [s.practice.cycle, ...s.cycles]) for (const id of c.pushedAtomIds) pushedIn.set(id, (pushedIn.get(id) ?? 0) + 1);
  const byId = new Map(s.atoms.map((a) => [a.id, a] as const));
  const banned = H9_H10_RECORD_IDS.map((id) => byId.get(id)).filter((a): a is NonNullable<typeof a> => a !== undefined);
  const freezeAtoms = new Set(s.freezes.flatMap((fz) => fz.items.flatMap((it) => [...(it.keyAtomIds ?? []), ...(it.basisAtomIds ?? [])])));
  for (const p of s.atoms) {
    if (!p.pointer) continue;
    const to = byId.get(p.pointer.to);
    if (p.tier !== "T1_pushed" || pushedIn.get(p.id) !== 1) failures.push(f("pointers", `"${p.id}" is not pushed in exactly one view`));
    if (!to) { failures.push(f("pointers", `"${p.id}" points to "${p.pointer.to}", which does not exist`)); continue; }
    if (to.pointer || pushedIn.has(to.id)) failures.push(f("pointers", `"${p.id}" points to "${to.id}", which is pushed (a pointer points to a recorded report)`));
    if (to.cycle !== p.cycle) failures.push(f("pointers", `"${p.id}" (step ${p.cycle}) points to "${to.id}" of step ${to.cycle}: not reachable when the pointer arrives`));
    if (p.provenance.observedAt < to.provenance.observedAt) failures.push(f("pointers", `"${p.id}" is said before "${to.id}" was observed`));
    if (H9_H10_RECORD_IDS.includes(to.id)) failures.push(f("pointers", `"${p.id}" points to "${to.id}", an H9/H10 record`));
    for (const b of banned) {
      if (b.provenance.sourceId === p.provenance.sourceId && Math.abs(b.cycle - p.cycle) <= 1) failures.push(f("pointers", `"${p.id}" comes from ${p.provenance.sourceId}, the source of H9/H10's "${b.id}" in step ${b.cycle}`));
    }
    const own = s.atoms.filter((a) => a.provenance.sourceId === p.provenance.sourceId && !a.pointer);
    if (own.length === 0 || own.every((a) => H9_H10_RECORD_IDS.includes(a.id))) failures.push(f("pointers", `"${p.id}" comes from ${p.provenance.sourceId}, a source with no records but H9/H10's`));
    if (freezeAtoms.has(p.id)) failures.push(f("pointers", `"${p.id}" is a freeze item's key or basis record`));
  }
  return failures;
}

export function validateScenario(scenario: ScenarioContract): ValidationResult {
  const failures: ValidationFailure[] = [
    ...checkMarkersWellFormed(scenario),
    ...checkLoadBearingRoutes(scenario),
    ...checkFlagSequence(scenario),
    ...checkContainmentBaseRate(scenario),
    ...checkProbeInvariantLinks(scenario),
    ...checkAtomCompleteness(scenario),
    ...checkTierShares(scenario),
    ...checkLoadBearingT4Presence(scenario),
    ...checkChannelTraceability(scenario),
    ...checkChannelNoContradictionFlag(scenario),
    ...checkLatencyDistributionWellFormed(scenario),
    ...checkEnvelopeHorizon(scenario),
    ...checkValidityClaimDivergenceTags(scenario),
    ...checkNoTruthLeak(scenario),
    ...checkNoAllocationRecommendations(scenario),
    ...checkNavigationCoverageRule(scenario),
    ...checkPointers(scenario),
  ];
  return { ok: failures.length === 0, failures };
}
