/**
 * `aiStatedKey` (SPEC/30 §5.3): the matching rules (authored `keyStatements`, else the generic band, sector and token
 * fallback on the key option's label) and the fold over the log — answers shown before the view's actual
 * `freeze_started` only, the Open Thinker's "unavailable" fallback skipped, L2/L3 only, replayed views left out.
 * Hand-built items in the bank's style; the real bank is not used (its keys are being rewritten).
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { aiStatedKey } from "../../app/telemetry/freeze-measures.js";
import { recordReleaseTimes } from "../../app/telemetry/ai-stated-key.js";
import { keyMatcher, lureMatchers, quantitiesIn, sentencesOf } from "../../app/telemetry/key-statement-match.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const HEADER: LogHeader = {
  formatVersion: "0.10.0", sessionId: "ai-stated", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command", language: "fi",
};

const item = (id: string, level: FreezeItem["level"], options: readonly (readonly [string, string])[], key: string, extra: Partial<FreezeItem> = {}): FreezeItem => ({
  id, level, promptFi: id, options: options.map(([oid, labelFi]) => ({ id: oid, labelFi, correct: oid === key })), ...extra,
});
const AREA = item("freeze.2.area_40", "L3", [["lt15", "Alle 15 hehtaaria"], ["m15_22", "15–22 hehtaaria"], ["m22_30", "22–30 hehtaaria"], ["gt30", "Yli 30 hehtaaria"]], "m15_22");
const SPREAD = item("freeze.4.fastest_spread", "L2", [["L1", "Pohjoisreunalla (lohko L1)"], ["L2", "Koillisessa (lohko L2)"], ["L3", "Eteläreunalla (lohko L3)"], ["L4", "Syttymäkohdan takana (lohko L4)"]], "L2");
const FUEL = item("freeze.2.fuel_ahead", "L2", [["spruce", "Kuusivaltaiseen havumetsään"], ["birch", "Lehtipuuvaltaiseen rantametsään"], ["bog", "Avoimelle, märälle suolle"], ["clearing", "Hakkuuaukealle ja taimikkoon"]], "spruce");
const ARRIVAL = item("freeze.0.r1_arrival", "L3", [["lt15", "Alle 15 minuutissa"], ["m15_30", "15–30 minuutissa"], ["m30_60", "30–60 minuutissa"], ["gt60", "Yli tunnin kuluttua"]], "lt15");

describe("the matching rules", () => {
  const fi = (fiLabel: string) => fiLabel;
  const en = (fiLabel: string) => ({ "15–22 hehtaaria": "15–22 hectares", "Alle 15 minuutissa": "In less than 15 minutes" } as Record<string, string>)[fiLabel] ?? fiLabel;

  it("reads quantities with their units as intervals in the base unit: ranges, bounds, single values, decimal commas, km and h", () => {
    expect(quantitiesIn("noin 18,8 ha; 0,4 km; alle 15 min; yli 2 h; 10–12 m/min; klo 14.40").map((q) => [q.dim, q.lo, q.hi])).toEqual([
      ["rate", 10, 12], ["time", -Infinity, 15], ["time", 120, Infinity], ["area", 18.8, 18.8], ["length", 400, 400],
    ]);
    expect(quantitiesIn("EK11 ja 22 ha")).toEqual([{ dim: "area", lo: 22, hi: 22, text: "22 ha" }]); // a call sign's digits are not a number
  });

  it("reads thousands as each language writes them: '1,500' in English, '1 500' in both; a Finnish comma is a decimal", () => {
    expect(quantitiesIn("1,500–2,500 metres away", "en").map((q) => [q.lo, q.hi])).toEqual([[1500, 2500]]);
    expect(quantitiesIn("noin 1 800 metrin päässä").map((q) => [q.lo, q.hi])).toEqual([[1800, 1800]]);
    expect(quantitiesIn("1,500 km").map((q) => q.lo)).toEqual([1500]); // Finnish: 1.5 km
    expect(quantitiesIn("lohko L3 500 m").map((q) => q.lo)).toEqual([500]);
    const village = item("freeze.10.cabins_distance", "L2", [["m800_1500", "800–1500 metrin päässä"], ["m1500_2500", "1500–2500 metrin päässä"]], "m1500_2500");
    const enLabel = (fiLabel: string) => fiLabel.replace("1500–2500 metrin päässä", "1,500–2,500 metres away").replace("800–1500 metrin päässä", "800–1,500 metres");
    expect(keyMatcher(village, "en", enLabel).match("The cottages are about 1,800 m from the front.")?.text).toBe("1800 m");
    expect(keyMatcher(village, "fi", fi).match("Mökit ovat noin 1,2 km päässä.")).toBeNull();
  });

  it("band: a quantity wholly inside the key's band, in the session language", () => {
    const m = keyMatcher(AREA, "fi", fi);
    expect(m.rules).toEqual(["band"]);
    expect(m.match("Palanut ala on klo 14.40 noin 18,8 ha.")).toEqual({ rule: "band", text: "18.8 ha" });
    expect(m.match("16–20 hehtaaria")?.rule).toBe("band");
    expect(m.match("Ala on nyt noin 13 ha, ja se kasvaa 20–25 ha:iin.")).toBeNull(); // 13 outside; 20–25 not wholly inside
    expect(keyMatcher(AREA, "en", en).match("About 19 hectares by 14:40.")?.text).toBe("19 hectares");
    const arrival = keyMatcher(ARRIVAL, "en", en);
    expect(arrival.match("At 3 m/min it reaches R1 within 12 minutes.")?.text).toBe("12 minutes");
    expect(arrival.match("It reaches the road in about 1 h.")).toBeNull();
  });

  it("sector: the key's sector named and no other option's", () => {
    const m = keyMatcher(SPREAD, "fi", fi);
    expect(m.rules).toEqual(["sector", "tokens"]);
    expect(m.match("Nopeinta leviäminen on lohkossa L2 Kuusimäen kohdalla.")).toEqual({ rule: "sector", text: "L2" });
    expect(m.match("Leviäminen on nopeaa lohkoissa L2 ja L3.")).toBeNull();
  });

  it("tokens: at least two of the key's distinctive stems (or its only one); none shared with another option", () => {
    const m = keyMatcher(FUEL, "fi", fi);
    expect(m.rules).toEqual(["tokens"]);
    expect(m.match("Kärjen edessä on kuusivaltainen havumetsä.")).toEqual({ rule: "tokens", text: "kuusi havum" });
    expect(m.match("Kärjen edessä on tiheä kuusikko.")).toBeNull(); // one stem of two: the coders' audit and keyStatements catch paraphrase
  });

  it("an item's keyStatements win, per language, case-insensitive; a bad pattern fails loudly; a map item without them is unscreened", () => {
    const authored = { ...FUEL, keyStatements: { fi: ["kuusi(kko|valtai)"], en: ["spruce"] } };
    expect(keyMatcher(authored, "fi", fi).match("Tiheä KUUSIKKO edessä")).toEqual({ rule: "key_statements", text: "KUUSIKKO" });
    expect(keyMatcher(authored, "en", fi).match("dense spruce ahead")?.rule).toBe("key_statements");
    expect(keyMatcher(authored, "en", fi).match("tiheä kuusikko")).toBeNull();
    expect(() => keyMatcher({ ...FUEL, keyStatements: { fi: ["(unclosed"], en: [] } }, "fi", fi)).toThrow(/freeze\.2\.fuel_ahead/);
    const map: FreezeItem = { id: "freeze.2.head_later", level: "L3", promptFi: "x", options: [], kind: "map_point" };
    expect(keyMatcher(map, "fi", fi).rules).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The fold over the log
// ---------------------------------------------------------------------------

async function buildLog(events: readonly TelemetryEvent[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  let t = 0;
  for (const e of events) await appendTelemetryEvent(log, asVirtualTime(0), (t += 1000), e);
  return log.readAll();
}
const start = (cycle: number, phase: "A" | "B" = "A"): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: cycle as never, phase, clockLabel: "x" } });
const answer = (view: number, tool: "haku" | "open_thinker", text: string, fallback = false): TelemetryEvent => {
  const detail: AiChatAnswerReceivedDetail = {
    queryId: `q.${view}.${text.length}`, text: "q", view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: tool === "haku" ? { vastaus: "Vastaus.", perusteet: text, varmuus: "", muuttaisi: "" } : { vastaus: text, perusteet: "", varmuus: "", muuttaisi: "" },
    latencyMs: 2500, fallback, fallbackReason: fallback ? "timeout" : null, phase: "exploration", promptVariant: "standard", tool,
  };
  return { kind: "ai_chat_answer_received", detail };
};
const freezeStarted = (cycle: number): TelemetryEvent => ({ kind: "freeze_started", detail: { cycle: cycle as never, atViewSeconds: 90, decisionCommittedBeforeFreeze: true, decisionStep: "awaiting_view_end" } });
const submitted = (cycle: number, itemIds: readonly string[]): TelemetryEvent => ({ kind: "freeze_submitted", detail: { cycle: cycle as never, responses: itemIds.map((itemId) => ({ itemId, optionId: "x", confidence: 50 })) } });

const L1 = item("freeze.2.l1", "L1", [["a", "Tiellä R1"], ["b", "Haukilammella"]], "a");
const V2 = { cycle: 2, items: [L1, AREA, FUEL] };
const V10 = { cycle: 10, items: [{ ...SPREAD, id: "freeze.10.spread" }] };

describe("aiStatedKey", () => {
  it("reads the answers shown before the freeze: the first stating one, its tool and view; L2/L3 only", async () => {
    const records = await buildLog([
      { kind: "session_started", detail: HEADER },
      start(1), answer(1, "open_thinker", "Edessä on kuusivaltainen havumetsä."),
      start(2), answer(2, "haku", "Ala kasvaa noin 19 ha:iin klo 14.40 mennessä."),
      answer(2, "open_thinker", "Ala on 20 ha.", true), // the fallback shows "unavailable"
      freezeStarted(2),
      answer(2, "haku", "Lohkon L2 leviäminen on nopeinta."), // during the freeze: hidden, not counted
      submitted(2, ["freeze.2.l1", "freeze.2.area_40", "freeze.2.fuel_ahead"]),
    ]);
    const rows = aiStatedKey(records, [V2]);
    expect(rows.map((r) => [r.itemId, r.stated, r.tool, r.statedInView, r.matchedBy, r.matchedText])).toEqual([
      ["freeze.2.area_40", true, "haku", 2, "band", "19 ha"],
      ["freeze.2.fuel_ahead", true, "thinker", 1, "tokens", "kuusi havum"],
    ]);
    expect(rows[0]!.firstStatedSeq).toBe(4);
    expect(rows[0]!.freezeStartedSeq).toBe(6);
  });

  it("anchors on the actual freeze_started: a freeze at the view's end counts the whole view's answers (V10, SPEC/30 §5.1)", async () => {
    const view10 = (late: boolean) => buildLog([
      start(10, "B"),
      ...(late ? [] : [freezeStarted(10), submitted(10, ["freeze.10.spread"])]),
      { kind: "allocation_submitted", detail: { plan: { mainEffort: "L3", posture: "direct_attack", secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null } },
      answer(10, "open_thinker", "Nopein leviäminen on nyt lohkossa L2."),
      { kind: "plan_confidence_submitted", detail: { cycle: 10, value: 75 } },
      ...(late ? [freezeStarted(10), submitted(10, ["freeze.10.spread"])] : []),
    ]);
    expect(aiStatedKey(await view10(true), [V10])[0]).toMatchObject({ stated: true, tool: "thinker", matchedBy: "sector" });
    expect(aiStatedKey(await view10(false), [V10])[0]).toMatchObject({ stated: false, tool: null, rules: ["sector", "tokens"] });
  });

  it("uses the header's language, skips a freeze never shown and a view replayed after a resume", async () => {
    const en = { ...AREA, keyStatements: { fi: [], en: ["\\b1[5-9] hectares"] } };
    const records = await buildLog([
      { kind: "session_started", detail: { ...HEADER, language: "en" } },
      start(2), answer(2, "haku", "About 17 hectares by 14:40."), freezeStarted(2), submitted(2, [en.id]),
      start(4), freezeStarted(4),
      { kind: "session_resumed", detail: { resumeCount: 1, intervalSinceInterruptionMs: 5000, cycleReplayed: 4 as never, resumedAt: "view" } },
      start(4), freezeStarted(4), submitted(4, ["freeze.4.fastest_spread"]),
    ]);
    const rows = aiStatedKey(records, [{ cycle: 2, items: [en] }, { cycle: 4, items: [SPREAD] }, { cycle: 5, items: [FUEL] }]);
    expect(rows.map((r) => [r.itemId, r.stated, r.matchedBy])).toEqual([["freeze.2.area_40", true, "key_statements"]]);
    expect(aiStatedKey(records, [{ cycle: 4, items: [SPREAD] }], { includeReplayed: true })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// SPEC/31 §3.6, sagat F16 and parity P-3 (19 Oct 2026)
// ---------------------------------------------------------------------------

const answerAt = (view: number, text: string, virtualTimeS: number): TelemetryEvent => {
  const detail: AiChatAnswerReceivedDetail = {
    queryId: `q.${view}.${virtualTimeS}`, text: "q", view, virtualTimeS, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: { vastaus: text, perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 2500, fallback: false, fallbackReason: null, phase: "exploration",
    promptVariant: "standard", tool: "open_thinker",
  };
  return { kind: "ai_chat_answer_received", detail };
};
const pushed = (atomId: string): TelemetryEvent => ({ kind: "bubble_available", detail: { atomId, mapPosition: null, tier: "T1_pushed", sourceId: "u" } });

describe("aiStatedKey after SPEC/31 (F16 window, element-tied patterns, statedLure, the three-way told class)", () => {
  const AREA4 = { ...AREA, id: "freeze.4.area" };

  it("counts only answers in the freeze's view or the one before; `allEarlierAnswers` restores the earlier rule", async () => {
    const records = await buildLog([
      start(2), answerAt(2, "Ala on noin 19 ha.", 1500), start(3), start(4), freezeStarted(4), submitted(4, [AREA4.id]),
    ]);
    expect(aiStatedKey(records, [{ cycle: 4, items: [AREA4] }])[0]).toMatchObject({ stated: false, window: "f16" });
    expect(aiStatedKey(records, [{ cycle: 4, items: [AREA4] }], { allEarlierAnswers: true })[0]).toMatchObject({ stated: true, statedInView: 2, window: "all_before" });
  });

  it("counts only answers asked once the item's basis records were reachable (`releaseS`, from each record's step)", async () => {
    expect(recordReleaseTimes([{ id: "evt.a", cycle: 3 }, { id: "evt.b", cycle: 1 }])).toEqual(new Map([["evt.a", 2400], ["evt.b", 0]]));
    const item = { ...AREA, keyAtomIds: ["evt.b"], basisAtomIds: ["evt.a"] };
    const records = await buildLog([
      start(1), answerAt(1, "Ala on noin 19 ha.", 1000), start(2), answerAt(2, "Ala kasvaa noin 20 ha:iin.", 2500), freezeStarted(2), submitted(2, [item.id]),
    ]);
    const releaseS = recordReleaseTimes([{ id: "evt.a", cycle: 3 }, { id: "evt.b", cycle: 1 }]);
    expect(aiStatedKey(records, [{ cycle: 2, items: [item] }], { releaseS })[0]).toMatchObject({ stated: true, matchedText: "20 ha", basisReleasedAtS: 2400 });
    expect(aiStatedKey(records, [{ cycle: 2, items: [item] }])[0]).toMatchObject({ stated: true, matchedText: "19 ha", basisReleasedAtS: null });
    expect(aiStatedKey(records, [{ cycle: 2, items: [{ ...item, basisAtomIds: ["evt.later"] }] }], { releaseS: new Map([["evt.later", 9000]]) })[0]!.stated).toBe(false);
  });

  it("ties a statement to its element where the item has `elementPatterns`: the same sentence must name it", () => {
    const tied = { ...FUEL, elementPatterns: { fi: ["kärjen edessä"], en: ["ahead of the head"] } };
    const m = keyMatcher(tied, "fi", (x) => x);
    expect(m.match("Kuusimäen kuusivaltainen havumetsä on pohjoisessa. Kärjen edessä on suota.")).toBeNull();
    expect(m.match("Pohjoisessa on suota.\nKärjen edessä on kuusivaltainen havumetsä.")).toEqual({ rule: "tokens", text: "kuusi havum" });
    expect(sentencesOf("Klo 14.40 ala on 18,8 ha. Seuraavaksi?\nRivi")).toEqual(["Klo 14.40 ala on 18,8 ha.", "Seuraavaksi?", "Rivi"]);
    expect(() => keyMatcher({ ...FUEL, elementPatterns: { fi: ["(bad"], en: [] } }, "fi", (x) => x)).toThrow(/elementPatterns/);
  });

  it("reports a stated distractor (`statedLure`): every distractor stated, by its label's band, or its authored `lureStatements`", async () => {
    const bog = { ...FUEL, id: "freeze.2.fuel", lureStatements: [{ optionId: "bog", fi: ["\\bsuo\\w*"], en: [] }] };
    const records = await buildLog([
      start(2), answerAt(2, "Ala on nyt noin 13 ha; illalla yli 30 ha.", 1300), answerAt(2, "Edessä on avointa suota.", 1400),
      freezeStarted(2), submitted(2, [AREA.id, bog.id]),
    ]);
    const [area, fuel] = aiStatedKey(records, [{ cycle: 2, items: [AREA, bog] }]);
    expect(area).toMatchObject({ stated: false, statedLure: true, lureOptionIds: ["lt15", "gt30"], lureMatchedText: "13 ha" });
    expect(fuel).toMatchObject({ stated: false, statedLure: true, lureOptionIds: ["bog"], lureMatchedText: "suota" });
    expect(lureMatchers(AREA, "fi", (x) => x).map((l) => [l.optionId, l.matcher.rules])).toEqual([["lt15", ["band"]], ["m22_30", ["band"]], ["gt30", ["band"]]]);
    expect(lureMatchers({ ...AREA, kind: "map_point" }, "fi", (x) => x)).toEqual([]);
  });

  it("classes each item stream-told (every key record pushed before the freeze), AI-told (stated, key not pushed) or neither", async () => {
    const pushedKey = { ...SPREAD, id: "freeze.2.pushed", keyAtomIds: ["atom.p"] };
    const recordedKey = { ...SPREAD, id: "freeze.2.recorded", keyAtomIds: ["atom.r"] };
    const computed = { ...AREA, id: "freeze.2.computed" };
    const records = await buildLog([
      start(2), pushed("atom.p"), answerAt(2, "Nopeinta leviäminen on lohkossa L2.", 1300),
      freezeStarted(2), pushed("atom.r"), submitted(2, [pushedKey.id, recordedKey.id, computed.id]),
    ]);
    const rows = aiStatedKey(records, [{ cycle: 2, items: [pushedKey, recordedKey, computed] }]);
    expect(rows.map((r) => [r.itemId, r.stated, r.keyPushed, r.toldClass])).toEqual([
      ["freeze.2.pushed", true, true, "stream_told"], // the stream told everyone: an AI restating it borrows nothing
      ["freeze.2.recorded", true, false, "ai_told"], // pushed only after the freeze started
      ["freeze.2.computed", false, false, "neither"],
    ]);
  });
});
