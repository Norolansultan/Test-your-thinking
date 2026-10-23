/**
 * SPEC/36 §3: the development tips' rule table (`app/telemetry/profile-tips.ts`): each tip tied to its profile condition, 2–4 tips
 * in priority order with the general tips filling up to two, the open-question heuristic, the texts complete in fi and en and free of
 * anything from the freeze banks.
 */

import { describe, expect, it } from "vitest";
import { EXPERT_REFERENCE, type CommanderProfile } from "../../app/telemetry/profile.js";
import { aiQuestionFocus, chooseTips, GENERAL_TIPS, isOpenQuestion, MAX_TIPS, MIN_TIPS, TIP_RULES, TIP_TEXT, type AiQuestionFocus, type TipId } from "../../app/telemetry/profile-tips.js";
import { LogBuilder, sessionStarted, start } from "../profile/fixtures.js";
import { leaks } from "../profile/leak-scan.js";

type Overrides = {
  readonly calibration?: "well" | "over" | "under" | null;
  readonly resolution?: "higher_when_right" | "about_same" | "higher_when_wrong" | null;
  readonly checking?: "often" | "sometimes" | "rarely" | null;
  readonly haku?: number;
  readonly guide?: number | null;
};

/** A profile with the given bands (null: not enough data). */
function profile(o: Overrides = {}): CommanderProfile {
  const cal = o.calibration === undefined ? "well" : o.calibration, res = o.resolution === undefined ? "higher_when_right" : o.resolution;
  const chk = o.checking === undefined ? "often" : o.checking;
  return {
    calibration: cal === null
      ? { status: "not_enough", answers: 3, meanConfidence: null, percentCorrect: null, gapPoints: null, band: null, resolution: { status: "not_enough", diffPoints: null, band: null } }
      : { status: "ok", answers: 40, meanConfidence: 70, percentCorrect: 60, gapPoints: 10, band: cal, resolution: res === null ? { status: "not_enough", diffPoints: null, band: null } : { status: "ok", diffPoints: 8, band: res } },
    checking: chk === null
      ? { status: "not_enough", decisions: 2, checked: 1, share: null, band: null, medianSecondsToFirstLookup: null, decidingRecords: null }
      : { status: "ok", decisions: 14, checked: 7, share: 0.5, band: chk, medianSecondsToFirstLookup: 20, decidingRecords: null },
    toolUse: { status: "ok", hakuSearches: o.haku ?? 5, guideQuestions: o.guide === undefined ? null : o.guide, reviews: null },
    expert: EXPERT_REFERENCE,
    phaseBReached: true,
  };
}
const NO_AI: AiQuestionFocus = { asked: 0, open: 0 };
const tips = (o: Overrides, ai: AiQuestionFocus = NO_AI): TipId[] => chooseTips({ profile: profile(o), ai });

describe("the tip rules (SPEC/36 §3)", () => {
  it("overconfident → 'ask what would change your mind'; rarely checked → the two-source rule; both before any reinforcement", () => {
    expect(tips({ calibration: "over", checking: "rarely" })).toEqual(["calibration_over", "checking_rarely"]);
    expect(TIP_TEXT.en.calibration_over.title).toBe("Ask what would change your mind");
    expect(TIP_TEXT.en.checking_rarely.title).toBe("Use a two-source rule for key facts");
  });

  it("underconfident and checking sometimes", () => {
    expect(tips({ calibration: "under", checking: "sometimes" })).toEqual(["calibration_under", "checking_sometimes"]);
  });

  it("well calibrated and checking often → the two reinforcing tips", () => {
    expect(tips({ calibration: "well", checking: "often" })).toEqual(["calibration_well", "checking_often"]);
  });

  it("used the chat tools mainly for facts (≥ 3 questions, under a third open) → 'also ask what you might be missing'", () => {
    expect(tips({}, { asked: 6, open: 1 })).toContain("ai_facts_only");
    expect(tips({}, { asked: 6, open: 2 })).not.toContain("ai_facts_only"); // a third open is enough
    expect(tips({}, { asked: 2, open: 0 })).not.toContain("ai_facts_only"); // too few to say
    expect(TIP_TEXT.en.ai_facts_only.title).toBe("Also ask what you might be missing");
  });

  it("no search and no question at all → 'ask one focused question'; a Thinker question alone is a question", () => {
    expect(tips({ haku: 0, guide: null })).toContain("tools_unused");
    expect(tips({ haku: 0, guide: 2 })).not.toContain("tools_unused");
  });

  it("confidence that did not tell right from wrong → the resolution tip", () => {
    expect(tips({ resolution: "about_same" })).toContain("resolution_flat");
    expect(tips({ resolution: "higher_when_wrong" })).toContain("resolution_flat");
    expect(tips({ resolution: "higher_when_right" })).not.toContain("resolution_flat");
  });

  it("at most four, in the table's order; at least two (the general tips fill up)", () => {
    const many = tips({ calibration: "over", checking: "rarely", resolution: "about_same", haku: 0 }, { asked: 4, open: 0 });
    expect(many).toEqual(["calibration_over", "checking_rarely", "ai_facts_only", "tools_unused"]);
    expect(many).toHaveLength(MAX_TIPS);
    expect(tips({ calibration: null, checking: null })).toEqual([...GENERAL_TIPS]);
    expect(tips({ calibration: null, checking: "often", resolution: null })).toEqual(["checking_often", "general_scan"]);
    for (const o of [{}, { calibration: null }, { checking: null }, { calibration: null, checking: null, haku: 0 }] as Overrides[]) {
      const n = tips(o).length;
      expect(n).toBeGreaterThanOrEqual(MIN_TIPS);
      expect(n).toBeLessThanOrEqual(MAX_TIPS);
    }
  });

  it("every rule has a condition and a tip; the bands of a dimension never give two of its tips", () => {
    expect(new Set(TIP_RULES.map((r) => r.id)).size).toBe(TIP_RULES.length);
    for (const r of TIP_RULES) expect(r.condition.length).toBeGreaterThan(10);
    for (const cal of ["well", "over", "under"] as const) for (const chk of ["often", "sometimes", "rarely"] as const) {
      const t = tips({ calibration: cal, checking: chk });
      expect(t.filter((id) => id.startsWith("calibration_"))).toHaveLength(1);
      expect(t.filter((id) => id.startsWith("checking_"))).toHaveLength(1);
    }
  });
});

describe("the open-question heuristic and the chat questions' focus", () => {
  it("open questions (judgement, alternatives, what could be missed) in fi and en; fact look-ups are not", () => {
    for (const q of ["What could go wrong on the north flank?", "Should I move the crews?", "What am I missing?", "Mitä jos tuuli kääntyy?", "Pitäisikö siirtää yksiköt?", "Mikä tässä voi olla väärin?"]) expect(isOpenQuestion(q), q).toBe(true);
    for (const q of ["Where is EK12?", "How many crews are at the road?", "Missä EK12 on?", "Paljonko vettä on jäljellä?"]) expect(isOpenQuestion(q), q).toBe(false);
  });

  it("counts the chat questions of the main views only (the practice view's are practice)", () => {
    const b = new LogBuilder().add(sessionStarted("reasoning_once")).add(start(0));
    const ask = (view: number, text: string) => b.add({ kind: "ai_chat_query_submitted", detail: { queryId: `q${view}${text.length}`, text, view, virtualTimeS: 0, phase: "exploration", tool: "open_thinker" } as never });
    ask(0, "What if the wind turns?");
    b.add(start(1));
    ask(1, "Where is EK12?");
    ask(1, "What am I missing?");
    ask(2, "How much water is left?");
    expect(aiQuestionFocus(b.records)).toEqual({ asked: 3, open: 1 });
  });
});

describe("the tip texts", () => {
  it("complete in fi and en, generic: nothing from the freeze banks", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const id of [...TIP_RULES.map((r) => r.id), ...GENERAL_TIPS]) {
        const t = TIP_TEXT[lang][id];
        expect(t.title.length, `${lang} ${id}`).toBeGreaterThan(5);
        expect(t.text.length, `${lang} ${id}`).toBeGreaterThan(40);
        expect(leaks(`${t.title}\n${t.text}`), `${lang} ${id}`).toEqual([]);
      }
    }
  });
});
