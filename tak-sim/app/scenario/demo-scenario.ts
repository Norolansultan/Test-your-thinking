/**
 * The demo scenario. The FIRE is modelled; the rest is SYNTHETIC PLACEHOLDER CONTENT — see
 * `content/demo/README.md` for what this is and is not.
 *
 * Geometry comes from the frozen build of the incident on the generated site
 * (`site-scenario.json`, written by `npm run fire:ca`): the reported perimeter, the envelope and
 * the truth at each horizon are the cellular automaton's (SPEC/24), run on the same terrain the
 * basemap shows (SPEC/23 §11) with SPEC/18 §6–§7's forcing, and its derived flags match the
 * canonical sequence. The session is SPEC/26's: a practice view (VP, step W2) and fourteen main
 * views built from one or two 20-minute world-state steps each (`views.ts`). Atoms keep their
 * STEP in `cycle` (world-state time, as the interaction log does); cycle specs, envelopes,
 * probes and channel sets are indexed by VIEW. Unit, drone and aircraft positions follow SPEC/18 §8.2's timeline
 * (`tools/fire-ca/deployment.ts`); wind is SPEC/18 §6's series. Envelope certainty and rate marks
 * follow SPEC/12 §9.
 *
 * This file assembles the parts: the map per view (`demo-map.ts`), the story beats
 * (`demo-story.ts`), the probe schedule and freezes (`demo-probes.ts`, SPEC/26 §4) and the
 * course-of-action items (`demo-decisions.ts`). Still synthetic and unreviewed: the story text,
 * the filler corpus, decision items, freeze and probe items and branch statements.
 */

import { asVirtualTime, WGS84, type CycleIndex, type LatLon } from "../engine/primitives.js";
import { deriveSeed, Xorshift64Star } from "../engine/prng.js";
import {
  CANONICAL_FLAG_SEQUENCE,
  type PracticeView,
  type Branch,
  type BranchStatement,
  type ChannelSignalSet,
  type CycleSpec,
  type DutyOfficerMessage,
  type Envelope,
  type ExpectedInvariant,
  type InfoAtom,
  type ProbeSpec,
  type ScenarioContract,
  type SourceClass,
} from "./types.js";
import { buildAllocationSpace } from "./allocation.js";
import { createScenarioContract } from "./contract.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { FREEZE_AT_VIEW_END, freezeOffsetSecondsFor, HINGE_AFTER_VIEW, PRACTICE_FREEZE_AT_S, PRACTICE_VIEW_MIN_SECONDS, MAIN_VIEWS, PRACTICE_STEP, PRACTICE_VIEW_INDEX, secondSpamProbeId, STEP_SECONDS, viewOfStep } from "./views.js";
import { trafficAtom } from "./traffic-atoms.js";
import { designedEventAtoms, F7_TRUTH_INVARIANT } from "./designed-events.js";
import { accuracyLabel, buildRateMarks, buildSensorFootprints, radioAtoms, siteView, viewMap } from "./demo-map.js";
import { CYCLE_STORY, storyAtoms, type UnitId } from "./demo-story.js";
import { buildBranchStatements } from "./branch-statements.js";
import { buildFreezes, buildHingeCheck, buildPracticeFreeze, buildProbeSchedule, FREEZE_VIEWS, SPAM_ANSWER_TIMEOUT_MS, SPAM_SECOND_ITEMS, type SpamItem } from "./demo-probes.js";
import { buildPracticeSpam } from "./practice-spam.js";
import { buildDecisionItems, buildPracticeBranchStatements, buildPracticeDecisionItem } from "./demo-decisions.js";

/**
 * The directive at the hinge (phase-B redesign, researcher decision 4 Oct 2026; replaces SPEC/18
 * §4.2's four rules). From the participant's superior, P2 (päivystävä palopäällikkö; DRAFT: the
 * domain reviewer confirms the title), delivered at 16:40 to both groups alike: on the hinge pause
 * screen and as V8's opening message. It reverses phase A's offensive intent and deliberately does
 * not fit every view (`demo-directive.ts`, truth only). Not a corpus atom, so neither Haku nor
 * Thinker can find it (open item: needs `npm run thinker:index` on a machine with the model).
 * Finnish DRAFT, for native and domain review; English in `content/i18n/labels.en.json`.
 * Reworded 4 Oct 2026 (review round 2, DEFAULT, SPEC/11 §7.16): the reason is the crews' safety and
 * the region's overall situation ("readiness is thin, so defensive" read backwards); it does not
 * mention the forecast.
 */
export const DIRECTIVE_FI =
  "Alueella on kolme maastopaloa. Henkilöstön turvallisuuden ja alueen kokonaistilanteen vuoksi siirrytään puolustavaan toimintaan: linjat teiden ja vesistöjen varaan, ei suoraa hyökkäystä palon reunaan. Ensisijainen tavoite on suojata Lahdenkylä ja Mökkiranta.";
/**
 * Phase A's intent from P2, opening V1 (SPEC/18 §4.1; 4 Oct 2026: it states the posture, direct
 * attack where intensity allows, so the phase-A posture baseline rests on something participants were
 * told; round 2: being conditional, it is reported descriptively, not coded as aligned). Not a corpus atom. Finnish DRAFT, for native and domain review; English in `labels.en.json`.
 * Review round 2 (4 Oct 2026, DEFAULT): the release sentence added in round 1 is removed — it changed
 * the phase-A stimulus inside H10's anticipation window and was never decided.
 */
export const PHASE_A_INTENT_FI =
  "Tavoite: palo rajataan metsäautotien ja suon väliin. Painopiste: kärjen pysäyttäminen koillisessa. Toimintatapa: suora hyökkäys siellä, missä palon voimakkuus sallii.";

/** Named features of the generated site (tools/fire-ca/deployment.ts FEATURES). */
export const LANDMARKS: Readonly<Record<string, LatLon>> = SITE_SCENARIO.features;

const SOURCE_CLASSES: readonly SourceClass[] = [
  { id: "sc.experienced", label: "Kokenut yksikkö", reliability: "known-good", replyLatency: { kind: "lognormal", medianSeconds: 24, sigma: 0.5, minSeconds: 5, maxSeconds: 120 } },
  { id: "sc.volunteer", label: "VPK", reliability: "unproven", replyLatency: { kind: "lognormal", medianSeconds: 38, sigma: 0.6, minSeconds: 10, maxSeconds: 180 } },
  { id: "sc.sensor", label: "Anturi", reliability: "known-good", replyLatency: { kind: "lognormal", medianSeconds: 6, sigma: 0.3, minSeconds: 2, maxSeconds: 30 } },
];

/**
 * SPEC/26 D3: VP — practice, at step W2 (researcher decision 1 Oct 2026). Identical for everyone, no
 * AI tool in either group (the session enforces that), a 2-item practice freeze, the normal
 * decision phase; not scored. It pushes its own starting-picture traffic (`traffic-practice.ts`),
 * which stays searchable later as incident history.
 */
function buildPracticeView(seed: bigint): PracticeView {
  const view = { index: PRACTICE_VIEW_INDEX, steps: [PRACTICE_STEP] };
  const sv = siteView(PRACTICE_VIEW_INDEX);
  const { spec, envelope, start } = viewMap(view, sv);
  const pushed = SITE_SCENARIO.traffic.filter((t) => t.session_view === PRACTICE_VIEW_INDEX && t.tier === "T1_pushed").sort((a, b) => a.sim_time_s - b.sim_time_s);
  return {
    cycle: {
      ...spec, index: PRACTICE_VIEW_INDEX, phase: "A", title: "Harjoitus",
      pushedAtomIds: pushed.map((t) => t.id), deliveryOffsetsSeconds: pushed.map((t) => t.sim_time_s - start), probeIds: [],
      rateMarks: [], sensorFootprints: [], hasFreeze: true, freezeAtSeconds: PRACTICE_FREEZE_AT_S, minViewSeconds: PRACTICE_VIEW_MIN_SECONDS,
    },
    envelope: { ...envelope, cycle: PRACTICE_VIEW_INDEX, flag: sv.derivedFlag, accuracy_label: accuracyLabel(sv.derivedFlag), isOmissionCycle: false },
    freeze: buildPracticeFreeze(),
    decisionItem: buildPracticeDecisionItem(),
    branchStatements: buildPracticeBranchStatements(),
    spam: buildPracticeSpam(),
  };
}

/**
 * SPEC/30 §5.2 (19 Oct 2026): the second SPAM items as probes. For each SPAM probe in `first` whose view has an item in
 * `items` (`SPAM_SECOND_ITEMS`, filled by the content package), one more probe of type S: id `<first id>.b`
 * (`secondSpamProbeId`), its key the invariant `<first invariant>.b` (TRUTH, like every key). It has no moment of its
 * own (`offsetInWorkingPeriodMs` absent): the session shows it after the first item and its confidence, under the same
 * "ready", with its own answer window.
 */
export function secondSpamProbes(items: Readonly<Record<number, SpamItem>>, first: readonly ProbeSpec[]): { readonly probes: ProbeSpec[]; readonly invariants: ExpectedInvariant[] } {
  const probes: ProbeSpec[] = [];
  const invariants: ExpectedInvariant[] = [];
  for (const p of first) {
    const item = p.type === "S" ? items[p.cycle as number] : undefined;
    if (!item) continue;
    const invariantName = `${p.invariantName}.b`;
    invariants.push({ name: invariantName, expected: item.correct, tolerance: 0 });
    probes.push({
      id: secondSpamProbeId(p.id), type: "S", mode: "ONLINE", cycle: p.cycle, orderWithinCycle: p.orderWithinCycle + 1, invariantName,
      prompt: item.prompt, response: { kind: "categorical", options: item.options.map((fi, i) => ({ id: "abcd"[i]!, fi })) },
      answerTimeoutMs: p.answerTimeoutMs ?? SPAM_ANSWER_TIMEOUT_MS, collectsConfidence: true, contentKind: item.contentKind, saLevel: item.saLevel,
    });
  }
  return { probes, invariants };
}

export function buildDemoScenario(): ScenarioContract {
  const seed = 20260917n;
  const rng = new Xorshift64Star(deriveSeed(seed, "demo-scenario"));

  const cycles: CycleSpec[] = [];
  const envelopes: Envelope[] = [];
  const atoms: InfoAtom[] = [];
  const invariants: ExpectedInvariant[] = [];
  const branchStatements: BranchStatement[] = [];
  const dutyOfficerMessages: DutyOfficerMessage[] = [];
  const authoredBranches = buildBranchStatements();

  for (const view of MAIN_VIEWS) {
    const index = view.index as CycleIndex;
    const sv = siteView(index);
    const flag = CANONICAL_FLAG_SEQUENCE[index - 1]!;
    if (sv.expectedFlag !== flag || sv.derivedFlag !== flag) console.warn(`[Physics Override] site-scenario.json view ${sv.id} was built for flag ${sv.expectedFlag} (derived ${sv.derivedFlag}), canonical is ${flag}`);
    const { sc, start, spec, envelope } = viewMap(view, sv);

    // Pushed: every step's story bubbles and pushed radio, and the traffic corpus's pushed items of
    // this view (the traffic atoms themselves are appended after every authored one, below, so
    // authored lookups keep finding the authored items first). Delivered in time order.
    const delivered: { id: string; t: number }[] = [];
    for (const step of view.steps) {
      const story = storyAtoms(step, (step - 1) * STEP_SECONDS - start, sc.reported);
      atoms.push(...story.atoms);
      delivered.push(...story.pushed);
      const radio = radioAtoms(step, start);
      atoms.push(...radio.atoms);
      delivered.push(...radio.pushed);
    }
    for (const ev of SITE_SCENARIO.traffic.filter((t) => t.session_view === index && t.tier === "T1_pushed")) {
      delivered.push({ id: ev.id, t: ev.sim_time_s - start });
    }
    delivered.sort((a, b) => a.t - b.t);

    cycles.push({
      ...spec,
      index,
      phase: view.phase!,
      title: view.steps.map((st) => CYCLE_STORY[st as CycleIndex].title).join(" / "),
      pushedAtomIds: delivered.map((d) => d.id),
      deliveryOffsetsSeconds: delivered.map((d) => d.t),
      probeIds: [], // filled from the probe schedule below
      rateMarks: buildRateMarks(index, view.steps[0]!, sc, flag),
      sensorFootprints: buildSensorFootprints(index, sc),
      hasFreeze: FREEZE_VIEWS.has(index),
      // SPEC/30 §5.1: V10 and V14's freeze comes after the plan is final (`FREEZE_AT_VIEW_END`), so no moment is drawn
      // for them; every view's moment is drawn on its own stream, so no other view's moment moves.
      freezeAtSeconds: FREEZE_VIEWS.has(index) && !FREEZE_AT_VIEW_END.has(index) ? freezeOffsetSecondsFor(seed, index, spec.minViewSeconds, spec.steps === 2) : null,
      ...(FREEZE_VIEWS.has(index) && FREEZE_AT_VIEW_END.has(index) ? { freezeAtViewEnd: true } : {}),
    });

    envelopes.push({ ...envelope, cycle: index, flag, accuracy_label: accuracyLabel(flag), isOmissionCycle: view.steps.includes(12) });

    invariants.push({ name: `containment.cycle_${index}`, expected: flag === "holds", tolerance: 0 });

    // The candidate developments after "fundamentally wrong" (5 Oct 2026): authored per view, their truth
    // DERIVED from the CA (`branch-statements.ts`; V9, the omission, has none true), never from a shuffle.
    // The seeded shuffle now sets only the order shown, identical for every participant.
    branchStatements.push(...rng.shuffle(authoredBranches.filter((b) => b.cycle === index)));
  }

  // SPEC/26 §4: the probe schedule, and each view's probe ids in presentation order.
  const schedule = buildProbeSchedule();
  invariants.push(...schedule.invariants);
  // SPEC/30 §5.2: V3 and V6's second SPAM items (none until the content is authored), after every scheduled probe.
  const secondSpam = secondSpamProbes(SPAM_SECOND_ITEMS, schedule.probes);
  invariants.push(...secondSpam.invariants);
  // The manipulation check on the hinge screen (brief D3, 4 Oct 2026): the item without its key, the key as an invariant (TRUTH).
  const hingeCheck = buildHingeCheck();
  invariants.push(hingeCheck.invariant);

  // Filler content across T2/T3/T4 so the drawers have real content to browse and the
  // corpus satisfies SPEC/02 §3's tier bands (checked by the M2 validator below).
  const REFERENCE_FEATURES = [
    { id: "ref.stand.spruce", surface: "reference_stand" as const, nav: "maasto" as const, fields: { laji: "kuusi", ikä: 65, harvennettu: "kyllä (rekisterissä, ei todellisuudessa)" } },
    { id: "ref.road.r1", surface: "reference_road" as const, nav: "vesi_reitit" as const, fields: { luokka: "metsäautotie", kantavuus_t: 32 } }, // fix pass 3 (N2): carries EK13's loaded tanker (~25 t) all day
    { id: "ref.water.w1", surface: "reference_water" as const, nav: "vesi_reitit" as const, fields: { tyyppi: "lampi", kapasiteetti: "keskisuuri" } },
    { id: "ref.ditch.bog", surface: "reference_maintenance" as const, nav: "maasto" as const, fields: { toimenpide: "ojitus", vuosi: 2024 } },
  ];
  // SPEC/25 §6: routine items spread across every category, so each category holds decoys.
  const NAV_ROTATION = ["palo", "saa", "yksikot", "vesi_reitit", "maasto", "kohteet", "ilma", "johto"] as const;
  REFERENCE_FEATURES.forEach((f, i) => {
    atoms.push({
      id: f.id, tier: "T2_system", origin: "below", cycle: ((i % 20) + 1) as CycleIndex, loadBearing: false, navCategory: f.nav,
      routes: { directed: { kind: "browse", surface: f.surface }, assistive: { kind: "browse", surface: f.surface }, substitutive: { kind: "free_text", exampleQueries: [f.surface] } },
      record: { kind: "reference", surface: f.surface, featureId: f.id, fields: f.fields, registerUpdatedAt: "2024-09-01" },
      provenance: { sourceId: "register", sourceClassId: "sc.sensor", sourceReliability: "known-good", observedAt: asVirtualTime(0), recordedAt: asVirtualTime(0), deliveredAt: null, certainty: { kind: "confirmed" }, supports: [], contradicts: [] },
      degradation: [], retrievalKeys: [f.surface], truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
    });
  });
  const LOAD_BEARING_SEEDS: readonly { readonly id: "t4.ember_warning" | "t4.private_doubt" | "t4.water_state"; readonly cycle: CycleIndex; readonly speaker: UnitId; readonly addressee: UnitId; readonly text: string; readonly consequenceCycle: CycleIndex; readonly nav: "palo" | "vesi_reitit" }[] = [
    { id: "t4.ember_warning", cycle: 6, speaker: "EK12", addressee: "EK11", text: "Kipinöitä tulee meidän puolelle harjun yli, pitäkää silmällä.", consequenceCycle: 8, nav: "palo" },
    // SPEC/26 §5, the echo (DRAFT, for review): on L1B, VPK tells its neighbour it was ordered off the origin's south edge.
    { id: "t4.private_doubt", cycle: 11, speaker: "VPK", addressee: "EK14", text: "Meidät käskettiin pois syttymäkohdan eteläreunalta. En ole ollenkaan varma, että vanha reuna pitää, jos tuuli kääntyy.", consequenceCycle: 12, nav: "palo" },
    { id: "t4.water_state", cycle: 4, speaker: "VPK", addressee: "KY21", text: "Vesi kestää täällä enää noin kaksikymmentä minuuttia.", consequenceCycle: 13, nav: "vesi_reitit" },
  ];
  for (const seed_ of LOAD_BEARING_SEEDS) {
    atoms.push({
      id: seed_.id, tier: "T4_lateral", origin: "lateral", cycle: seed_.cycle, loadBearing: true, navCategory: seed_.nav,
      routes: {
        directed: { kind: "request_traffic", selector: { byUnit: seed_.speaker } },
        assistive: { kind: "free_text", exampleQueries: [`mitä ${seed_.speaker} sanoi?`] },
        substitutive: { kind: "free_text", exampleQueries: [`mitä ${seed_.speaker} sanoi?`] },
      },
      record: { kind: "lateral_traffic", speakerUnitId: seed_.speaker, addresseeUnitId: seed_.addressee, at: asVirtualTime((seed_.cycle - 1) * STEP_SECONDS + 300), content: seed_.text, droppedFromChannelSummary: true },
      provenance: { sourceId: seed_.speaker, sourceClassId: "sc.experienced", sourceReliability: "known-good", observedAt: asVirtualTime((seed_.cycle - 1) * STEP_SECONDS + 300), recordedAt: asVirtualTime((seed_.cycle - 1) * STEP_SECONDS + 310), deliveredAt: null, certainty: { kind: "probable", basis: "single source" }, supports: [], contradicts: [] },
      degradation: [], retrievalKeys: [seed_.id, seed_.speaker.toLowerCase()],
      truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [], saidOn: "dmo" },
      consequence: { description: `placeholder consequence for ${seed_.id}`, manifestsAtCycle: seed_.consequenceCycle, measureId: `t4_discovery.${seed_.id}` },
    });
  }
  // SPEC/02 revision (o) §5 (fault F7) and SPEC/26 §5 (the rekindle): recorded, authored atoms; the
  // line's truth ("live") is an invariant like every other answer-key entry.
  atoms.push(...designedEventAtoms());
  invariants.push(F7_TRUTH_INVARIANT);
  // Traffic-corpus atoms after every authored atom (so `atoms.find` keeps meeting authored items first).
  const trafficAtoms = SITE_SCENARIO.traffic.map(trafficAtom);

  // The contradiction's reconciling detail (cycle 18, SPEC/18 §7.1): EK14 tells its neighbouring
  // relief unit on the north flank (EK15, firebreak beside it since step 11) that something is smoking
  // behind the track to the east, not theirs — which is what explains the premise/counter conflict.
  const reconcilingAtomId = "atom.demo.contradiction.reconciling";
  atoms.push({
    id: reconcilingAtomId, tier: "T4_lateral", origin: "lateral", cycle: 18, loadBearing: true, navCategory: "palo",
    routes: {
      directed: { kind: "ask_unit", unitId: "EK14" },
      assistive: { kind: "free_text", exampleQueries: ["EK14 näkee?"] },
      substitutive: { kind: "free_text", exampleQueries: ["EK14 näkee?"] },
    },
    record: { kind: "lateral_traffic", speakerUnitId: "EK14", addresseeUnitId: "EK15", at: asVirtualTime(17 * STEP_SECONDS + 200), content: "Uran itäpuolella savuaa jotain, ei meidän lohkoa.", droppedFromChannelSummary: true },
    provenance: { sourceId: "EK14", sourceClassId: "sc.experienced", sourceReliability: "known-good", observedAt: asVirtualTime(17 * STEP_SECONDS + 200), recordedAt: asVirtualTime(17 * STEP_SECONDS + 210), deliveredAt: null, certainty: { kind: "confirmed" }, supports: [], contradicts: [] },
    degradation: [], retrievalKeys: ["ek14", "pohjoisreuna"],
    truth: { isGroundTruth: true, isDecoy: false, contradictionRole: "reconciling", relevantInvariants: [], saidOn: "dmo" },
    consequence: { description: "explains the cycle-18 contradiction", manifestsAtCycle: 18, measureId: "t4_discovery.contradiction_reconciling" },
  });

  dutyOfficerMessages.push(
    // 4 Oct 2026: V1 carries SPEC/18 §4.1's intent with its posture (direct attack), the phase-A baseline's context (`demo-directive.ts`). Finnish DRAFT.
    { cycle: 1, at: asVirtualTime(0), text: PHASE_A_INTENT_FI, isStrategicGuidance: false, expectsReply: false },
    { cycle: (HINGE_AFTER_VIEW + 1) as CycleIndex, at: asVirtualTime(10 * STEP_SECONDS), text: DIRECTIVE_FI, isStrategicGuidance: true, expectsReply: false }, // no reply: the participant cannot transmit (SPEC/02 revision (o))
  );

  const branches: Branch[] = [1, 2, 3, 4, 5].map((n) => ({
    id: `branch.top.${n}`,
    label: `Vaihtoehtoinen kehitys ${n}`,
    divergesAtCycle: ((n - 1) * 3 + 1) as CycleIndex,
    variedFactor: n % 2 === 0 ? "weather" : "discrete_event",
    description: "placeholder counterfactual (demo)",
    perimeterByCycle: {},
  }));

  const channelSets: ChannelSignalSet[] = MAIN_VIEWS.map((v) => ({
    cycle: v.index as CycleIndex,
    emitAtOffsetSeconds: 60,
    signals: [],
    trafficSummary: "",
    trafficSummaryOmitsAtomIds: [],
    restatesIntent: v.index > HINGE_AFTER_VIEW,
  }));

  const raw: ScenarioContract = {
    id: "demo-scenario",
    version: "0.1.0-demo",
    seed,
    constructs: ["containment-judgement-accuracy", "calibration", "demo-visualisation"],
    validity: {
      represents: ["a scripted incident used to demonstrate the instrument's UI and workflow"],
      doesNotRepresent: ["a real or domain-reviewed scenario", "fire behaviour validated against a real fire (the CA is calibrated to authored rates, SPEC/24)"],
      authoredBy: "demo generator (synthetic)",
      reviewedBy: ["none — synthetic demo content, not reviewed by a domain expert"],
      sourceBasis: [
        "SPEC/18_Scenario_World_State.md (weather, fire behaviour, units and timeline)",
        `SPEC/24 cellular automaton on the generated site (SPEC/23 §11), seed ${SITE_SCENARIO.seed}, ${SITE_SCENARIO.flagMatches}/${SITE_SCENARIO.viewCount} view flags matching (SPEC/26 §3)`,
      ],
      knownDivergences: [
        "breach-rate: the projection breach rate is deliberately higher than an operational system's, to create error variance to calibrate against.",
        "fire-magnitude: the fire's magnitude is at the severe end of Finnish experience, chosen so the task requires multi-unit command.",
        "simulated-responder: the directed responder is an automated, authored system rather than a live person.",
        "demo-content: this entire scenario is synthetic placeholder content, not reviewed by a domain expert — see content/demo/README.md.",
      ],
    },
    extent: { crs: WGS84, ...SITE_SCENARIO.extent },
    cycleCount: 14,
    virtualSecondsPerStep: 1200,
    startVirtualClock: "13:20",
    invariants,
    contradiction: {
      id: "contradiction.demo",
      cycle: viewOfStep(18)!.index as CycleIndex, // V13
      premiseAtomId: atoms.find((a) => a.cycle === 18 && a.provenance.sourceId === "SPOT")!.id,
      counterAtomId: atoms.find((a) => a.cycle === 18 && a.provenance.sourceId === "EK14")!.id,
      reconcilingAtomId,
      subtlety: "medium",
      detectionProbeId: schedule.contradictionDetectionProbeId, // Type U, open, V13 (SPEC/26 §4)
      backupProbeId: schedule.contradictionBackupProbeId, // Type U, forced choice, V14
    },
    omission: {
      id: "omission.demo",
      cycle: viewOfStep(12)!.index as CycleIndex, // V9
      mechanism: "M1_holdover", // smouldering at the origin flares up on the wind shift (2 Oct 2026; was the shower)
      outsideEveryEnvelope: true,
      developmentAtomIds: [atoms.find((a) => a.cycle === 12)!.id],
    },
    probeSchedule: { probes: [...schedule.probes, ...secondSpam.probes] },
    cycles: cycles.map((c) => ({ ...c, probeIds: [...(schedule.probeIdsByView.get(c.index) ?? []), ...secondSpam.probes.filter((p) => p.cycle === c.index).map((p) => p.id)] })),
    practice: buildPracticeView(seed),
    atoms: [...atoms, ...trafficAtoms],
    envelopes,
    channelSets,
    dutyOfficerMessages,
    branches,
    branchStatements,
    allocationSpace: buildAllocationSpace(), // crews and drone teams, on scene per view (`allocation.ts`)
    allocationRecommendations: [],
    hinge: {
      afterCycle: HINGE_AFTER_VIEW,
      guidanceMessageId: "duty.hinge",
      pauseSeconds: 300,
      intentStatement: DIRECTIVE_FI, // shown on the hinge pause screen (4 Oct 2026) and opening V8's message log
      alignmentRules: [],
      manipulationCheck: hingeCheck.item,
    },
    sourceClasses: SOURCE_CLASSES,
    decisionItems: buildDecisionItems(),
    freezes: buildFreezes(),
  };

  return createScenarioContract(raw);
}
