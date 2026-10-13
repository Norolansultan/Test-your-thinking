/**
 * The practice SPAM item (work package I, 5 Oct 2026): one SPAM probe in the practice view VP, so
 * every participant meets the ready prompt, the locked search tools and the item once before V3.
 * Identical in every cell; not scored (analysis drops it by its id `probe.s.practice`, view 0).
 *
 * The item asks what one of VP's PUSHED messages says (VPK's water report), so it is answerable
 * from the message log with the tools locked, as the main items are (SPEC/27 §4.3, brief D4). It
 * names nothing from a later view and cues no designed event.
 *
 * Timing: VP carries a freeze (at 69 s after the tour since 11 Oct 2026; was 29 s, then 39 s), so the prompt comes after it, at 85 s (was 45 s).
 * It behaves as the main items do (revision (ag), 9 Oct 2026), so the tour teaches the rule: the ready
 * prompt waits (no expiry), can be collapsed, and is forced before VP ends if "ready" never comes; the
 * answer window is 60 s, so an item said "ready" to at once closes by 145 s, before VP's minimum
 * (180 s since 11 Oct 2026); the search tools stay usable while answering. Tested in `test/scenario/practice-spam.spec.ts`.
 *
 * The key is TRUTH: it is exported for tests and the review packet only (`PRACTICE_SPAM_KEY_OPTION`)
 * and found by content (`practiceSpamKeyRecordId`), never put into the probe. Finnish DRAFT; English
 * in `content/i18n/labels.en.json`.
 */

import { FREEZE_BANK_SEED } from "./freeze-bank-core.js";
import { arrangeSpamOptions, SPAM_ANSWER_TIMEOUT_MS } from "./demo-probes.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import type { PracticeViewIndex, ProbeSpec } from "./types.js";

export const PRACTICE_SPAM_ID = "probe.s.practice";
export const PRACTICE_SPAM_INVARIANT = "spam.practice";
/** View seconds (study timing; scaled by the preview override like every view moment). */
export const PRACTICE_SPAM_OFFSET_MS = 85_000;

/** DRAFT (native and domain review). Authored with the key first. */
export const PRACTICE_SPAM_AUTHORED = {
  prompt: "Mistä vettä saa VPK:n ilmoituksen mukaan?",
  key: "Haukilammelta (W1), noin 1,4 km luoteeseen",
  distractors: ["Haukilammelta (W1), noin 3 km kaakkoon", "Palopostista tien R1 varrelta", "Ei vielä tiedossa"] as const,
  saLevel: 1 as const,
  contentKind: "situation" as const,
};

const ARRANGED = arrangeSpamOptions({ 0: PRACTICE_SPAM_AUTHORED }, [0], FREEZE_BANK_SEED, "practice-spam")[0]!;

/** TRUTH: the key's option id (tests and the review packet only). */
export const PRACTICE_SPAM_KEY_OPTION: string = ARRANGED.correct;

/** The practice view's SPAM probe as the scenario carries it: no key. */
export function buildPracticeSpam(): Omit<ProbeSpec, "cycle"> & { readonly cycle: PracticeViewIndex } {
  return {
    id: PRACTICE_SPAM_ID, type: "S", mode: "ONLINE", cycle: 0, orderWithinCycle: 1, invariantName: PRACTICE_SPAM_INVARIANT,
    prompt: ARRANGED.prompt, response: { kind: "categorical", options: ARRANGED.options.map((fi, i) => ({ id: "abcd"[i]!, fi })) },
    offsetInWorkingPeriodMs: PRACTICE_SPAM_OFFSET_MS, answerTimeoutMs: SPAM_ANSWER_TIMEOUT_MS,
    collectsConfidence: true, contentKind: ARRANGED.contentKind, saLevel: ARRANGED.saLevel,
  };
}

/**
 * TRUTH: the id of the one pushed VP record the key rests on, found by content (no match, or more
 * than one, throws — so a rebuilt corpus cannot silently move the key). Called by tests and the
 * review packet, not at scenario build, so a corpus change breaks a test rather than the app.
 */
export function practiceSpamKeyRecordId(): string {
  const ids = SITE_SCENARIO.traffic
    .filter((t) => t.session_view === 0 && t.tier === "T1_pushed" && /^VPK: vettä saa Haukilammelta \(W1\), noin 1,4 km luoteeseen/.test(t.content))
    .map((t) => t.id);
  if (ids.length !== 1) throw new Error(`practice SPAM key: ${ids.length} VP records match`);
  return ids[0]!;
}
