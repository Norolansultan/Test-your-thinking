/**
 * SPEC/14 revision (q), `rekindle.spec`: the rekindle objection (SPEC/26 §5) under retrieval at V7
 * (step 10). Retrieval is asserted, never generated text. Nothing is special-cased.
 *
 * Designed: the broad question fills top-k with *in hand* status lines and excludes the objection;
 * the narrow questions retrieve it. Revised 2 Oct 2026: the rekindle is at the origin's south edge
 * (was the bog); the questions are "onko lohko 3 hallinnassa?" and "VPK syttymäkohta" /
 * "kyteekö syttymäkohta". The paragraph below describes the bog version's history.
 *
 * Actual behaviour with the declared parameters (not tuned; a finding for the pilot check, SPEC/10
 * revision (q)): the broad question behaves as designed (the objection is 10th; 11th before the
 * content-consistency fixes of 1 Oct 2026, which re-ran the selection on the regenerated corpus). The narrow
 * questions do NOT retrieve it. Before the routine-line collapse (1 Oct 2026) "VPK suo" filled
 * top-k with VPK's repeated AVL status lines and "kyteekö suo" with short radio chatter. The frozen
 * configuration is the collapse alone (no per-source cap; chosen on the neutral evaluation only,
 * re-run on the final corpus); the exact ranks are asserted below. The prefix stem does not join
 * "suo"/"Suon" or "kyteekö"/"kyteä", and the objection's text does not name VPK — only its source
 * field does, like every VPK record.
 */

import { describe, expect, it } from "vitest";
import { THINKER_RETRIEVAL_CONFIG } from "../../app/retrieval/hybrid.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { AUTHORED_QUESTIONS } from "../../tools/thinker/authored-questions.js";
import { ids, retrieveAt } from "./thinker-fixtures.js";

const OBJECTION = DESIGNED_EVENT_IDS.objection;
const V7 = 7;
const [BROAD] = AUTHORED_QUESTIONS.broadBog;
const [VPK_SUO, KYTEEKO] = AUTHORED_QUESTIONS.narrowBog;
const all = { ...THINKER_RETRIEVAL_CONFIG, topK: Number.MAX_SAFE_INTEGER };
const uncapped = { ...all, maxPerSource: null };
const rankOf = (question: string, config = all) => ids(retrieveAt(V7, question, config)).indexOf(OBJECTION) + 1;

describe("the broad bog question at V7", () => {
  it("excludes the objection from top-k, which holds in-hand status lines (as designed)", () => {
    const top = ids(retrieveAt(V7, BROAD));
    expect(top).not.toContain(OBJECTION);
    expect(top).toContain(DESIGNED_EVENT_IDS.inHand[0]); // KY21's status
    expect(top).toContain(DESIGNED_EVENT_IDS.inHand[2]); // the situation-log entry
    expect(rankOf(BROAD)).toBe(232); // "onko lohko 3 hallinnassa?" (232 after the play-test decisions R3, R5, R7, 25 Oct 2026: four records reworded (DR2 17.21, the Myllyoja crossing, the two step-5 R1 reports), the corpus unchanged at 1004, index carried, the objection still out of top-k; 231 after the play-test records, 24 Oct 2026: six records added, the corpus 998 -> 1004, four reworded, index carried, the objection still out of top-k; 229 after SPEC/33 gate R, 20 Oct 2026: the road-graph water shuttle re-seeded the step draws from step 2 (223 records reworded), the corpus 1002 -> 998, the objection still out of top-k, index carried; 237 after SPEC/33 stage 7–9, 20 Oct 2026: the fire re-run on the rebuilt map regenerated the traffic, the corpus unchanged at 1002, the objection still out of top-k; 244 after the phase-A flame table and the eight key-cited moves said as speech, 20 Oct 2026: 54 records reworded, the corpus unchanged at 1002, the objection still out of top-k; 242 after SPEC/31 WP-1, 19 Oct 2026: radio TG-02 drops four lateral lines between talk groups at V1 and V4 and EK16 gains a line at V13, the corpus 1005 -> 1002; 245 after revision (al), 10 Oct 2026, the bridge renamed and EK16 moved: VPK's burnout request/close-out gone, the corpus 1007 -> 1005; 244 after revision (ak), 10 Oct 2026, one recorded line more at V2; 243 after revision (aj), 9 Oct 2026; 245 after the safety re-check (ah); 246 after review fixes (ah), 9 Oct 2026, the unit-position pass; 230 with the 8 Oct recency boost, fix pass 6: the newest record of each source and sector now outranks older ones, so the old objection sinks six places; 224 before it; 2 Oct 2026: the rekindle is at the origin; was 10 for "onko suo hallinnassa?"; 204 before the positions/fire audit regenerated the traffic; 206 before the 6 Oct generator fixes; 208 before the 6 Oct fuel_ahead / water follow-up; 209 before fix pass 2, 7 Oct 2026; 215 before fix pass 3; 216 before fix pass 4; 222 before the 8 Oct thermal-inertia baseline, 221 with it; 222 after the 8 Oct fire retune; 224 after fix pass 5, 8 Oct)
  });
});

describe("the narrow questions at V7 (actual behaviour, documented)", () => {
  // 2 Oct 2026, the rekindle at the origin: "kyteekö syttymäkohta" now retrieves the objection in
  // top-k, as SPEC/26 §5 intends for a narrow question; "VPK syttymäkohta" still does not (rank 16).
  // Before (the bog): "VPK suo" 29, "kyteekö suo" 18, neither in top-k.
  it("'VPK syttymäkohta' does not retrieve the objection in top-k (rank 15, also with the per-source cap lifted)", () => {
    expect(ids(retrieveAt(V7, VPK_SUO))).not.toContain(OBJECTION);
    expect(rankOf(VPK_SUO)).toBe(15); // SPEC/33 gate R (20 Oct 2026, the road-graph shuttle): 15; SPEC/33 stage 7–9: 16 on the rebuilt map; 17 from fix pass 4, 16 before it (7 Oct 2026)
    expect(rankOf(VPK_SUO, uncapped)).toBe(15);
  });

  // Fix pass 3 (7 Oct 2026): rank 9 (10 after fix pass 2), still just outside top-k (was 7; 8 before the 6 Oct 2026 generator fixes). The crews on the
  // origin's south edge now report only their own stretch (FF1), which there creeps as glowing litter ("hehkuvaa kariketta"),
  // and three of those KY21 lines rank above the objection. Reported to the researcher (SPEC/26 §5 intends top-k here).
  // SPEC/33 gate R (20 Oct 2026): the road-graph water shuttle re-seeded the step draws, and the objection is 8th, the last place in
  // top-k — what SPEC/26 §5 intends for a narrow question (PROVISIONAL: the index is carried until `npm run thinker:index` runs).
  it("'kyteekö syttymäkohta' ranks the objection 8th, inside top-k (actual behaviour, documented)", () => {
    expect(ids(retrieveAt(V7, KYTEEKO))).toContain(OBJECTION);
    expect(rankOf(KYTEEKO)).toBe(8); // gate R: 8th; review fixes (ah), 9 Oct 2026: 10th (was 9th), outside top-k
    expect(rankOf(KYTEEKO, uncapped)).toBe(8);
  });
});
