/**
 * The freeze items' content: the goal-based bank's structure (SPEC/08 amendment 2 Oct 2026: 2×L1,
 * 2×L2, 2×L3 per main freeze, every format practised in VP, map_point items), the infrastructure
 * slot from its fixed schedule (researcher decisions 1–2 Oct 2026), F7 asked once (V12, tested in
 * `designed-events.spec.ts`), the source question, the course-of-action item, and the reactivity
 * and balance rules (same wording in both groups, no tool words, nothing named before it is
 * knowable, no verbatim repeat in consecutive freezes, a topic recurs only with a changed answer,
 * correct positions balanced). The keys' derivations are checked in `freeze-bank.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { DECISION_PROMPT_FI } from "../../app/scenario/demo-decisions.js";
import { FREEZE_VIEWS, INFRA_SCHEDULE, SPAM_VIEWS, infrastructureItem } from "../../app/scenario/demo-probes.js";
import { FREEZE_BANK, PRACTICE_BANK } from "../../app/scenario/freeze-bank.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { hasLabelEn, tr } from "../../app/i18n/text.js";

const scenario = buildDemoScenario();
const corpus: { cycle: number; content: string }[] = readFileSync(new URL("../../content/corpus/interaction-log.jsonl", import.meta.url), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));
const lastStep = (view: number) => MAIN_VIEWS.find((v) => v.index === view)!.steps.at(-1)!;
const firstStepWith = (re: RegExp) => Math.min(...corpus.filter((e) => re.test(e.content)).map((e) => e.cycle));
const infraOf = (view: number) => scenario.freezes.find((f) => f.cycle === view)!.items.find((it) => /\.(infra|f7)$/.test(it.id))!;
const mains = scenario.freezes;
const phaseA = mains.filter((f) => f.cycle <= 7);
const isChoice = (it: FreezeItem) => (it.kind ?? "choice") === "choice";
const keyOf = (it: FreezeItem) => (isChoice(it) ? it.options.find((o) => o.correct)!.id : `${it.mapKey!.point.lat.toFixed(4)},${it.mapKey!.point.lon.toFixed(4)}`);
const texts = (it: FreezeItem) => [it.promptFi, ...it.options.map((o) => o.labelFi)];

/** Tool words: no SA or decision item may name a tool (SPEC/08 §4, reactivity). */
const TOOL_WORDS = /\bhaku|haulla|hakua|thinker|tekoäly|\bAI\b|search|chat/i;

describe("the goal-based bank's structure", () => {
  it("every main freeze has six items, 2×L1, 2×L2, 2×L3, each with a goal", () => {
    // 8 Oct 2026 (researcher): V2 fuel_ahead and V10 cabins_distance became L2 (their keys are on record); V2 nearest_settlement and
    // V10 r2_meaning gave way to true L3 projections (area_40, area_total_hour), so every freeze keeps the mix.
    for (const f of mains) {
      expect(f.items, `V${f.cycle}`).toHaveLength(6);
      for (const it of f.items) expect(["safety", "values", "containment", "resources"], it.id).toContain(it.goal);
      expect(f.items.map((it) => it.level).sort(), `V${f.cycle}`).toEqual(["L1", "L1", "L2", "L2", "L3", "L3"]); // choice items in level order, map items last (2 Oct 2026)
    }
  });

  it("covers every goal of the draft goal set, and each level, across the bank", () => {
    const all = mains.flatMap((f) => f.items);
    for (const g of ["safety", "values", "containment", "resources"]) expect(all.filter((it) => it.goal === g).length, g).toBeGreaterThanOrEqual(4);
  });

  it("has at least one map_point item in every main freeze but V7, with a key point and the tolerance rule (L1 200 m, L3 300 m)", () => {
    // Fix pass 3 (7 Oct 2026): V7's KY21 item became a choice item (its radioed move against the stale map symbol), V7's only map item.
    for (const f of mains.filter((x) => x.cycle !== 7)) expect(f.items.some((it) => it.kind === "map_point"), `V${f.cycle}`).toBe(true);
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items.filter((x) => x.kind === "map_point")) {
      expect(it.options, it.id).toEqual([]);
      expect(it.mapKey!.toleranceM, it.id).toBe(it.id === "freeze.10.south_front_point" ? 100 : it.level === "L3" ? 300 : 200); // V10's small front: 100 m (fix pass 6)
      expect(it.level, it.id).not.toBe("L2");
    }
  });

  it("the practice freeze (ids with practice) practises every format and level: 4 items, one L3 and one map_point", () => {
    const items = scenario.practice.freeze.items;
    expect(items).toHaveLength(4);
    for (const it of items) expect(it.id).toMatch(/^freeze\.practice\./);
    expect(new Set(items.map((it) => it.level))).toEqual(new Set(["L1", "L2", "L3"]));
    expect(items.filter((it) => it.kind === "map_point")).toHaveLength(1);
    expect(items.some((it) => it.kind === "choice")).toBe(true);
  });

  it("every choice item has four options and exactly one key; ids are unique", () => {
    const ids = [...mains, scenario.practice.freeze].flatMap((f) => f.items.map((it) => it.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items.filter(isChoice)) {
      expect(it.options, it.id).toHaveLength(4);
      expect(it.options.filter((o) => o.correct), it.id).toHaveLength(1);
    }
  });

  it("every L3 item has a computed or cited key; its key atoms, if any, are evidence already on record (a forecast), never the reported future", () => {
    const defs = [...Object.entries(FREEZE_BANK).flatMap(([v, ds]) => ds.map((d) => ({ v: Number(v), d }))), ...PRACTICE_BANK.map((d) => ({ v: 0, d }))];
    for (const { d } of defs) {
      expect(["computed", "cited"], d.slug).toContain(d.rule);
      expect(d.basis.length, d.slug).toBeGreaterThan(20);
    }
    // 2 Oct 2026: an L3 key may rest on a record available at the freeze (the wind forecast, evt.wx.*), checked by the next test for every level.
    for (const { d } of defs.filter((x) => x.d.level === "L3")) for (const id of d.keyAtomIds) expect(id, d.slug).toMatch(/^evt\.wx\./);
  });

  it("key atoms exist and, for L1 and L2, had been delivered or recorded by the view's last step", () => {
    const atomCycle = new Map(scenario.atoms.map((a) => [a.id, Number(a.cycle)]));
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items) for (const id of it.keyAtomIds ?? []) {
      expect(atomCycle.has(id), `${it.id}: ${id}`).toBe(true);
      const last = f.cycle === 0 ? -3 : lastStep(f.cycle);
      expect(atomCycle.get(id)!, `${it.id}: ${id}`).toBeLessThanOrEqual(last); // for L3 too: only evidence on record, never the outcome
    }
  });

  it("is the same bank, built twice (deterministic, identical for every participant)", () => {
    expect(buildDemoScenario().freezes).toEqual(scenario.freezes);
    expect(buildDemoScenario().practice.freeze).toEqual(scenario.practice.freeze);
  });
});

describe("repetition and balance (the critique of the two repeated items)", () => {
  it("no prompt is repeated verbatim in two consecutive freezes, and the two old repeated items are gone", () => {
    for (let i = 1; i < mains.length; i++) {
      const prev = new Set(mains[i - 1]!.items.map((it) => it.promptFi));
      for (const it of mains[i]!.items) expect(prev.has(it.promptFi), `V${mains[i]!.cycle}: ${it.promptFi}`).toBe(false);
    }
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items) expect(it.promptFi).not.toMatch(/viimeksi raportoitiin|eniten uhattuna/);
  });

  it("a prompt that recurs has a different key each time (a topic recurs only when its answer changes)", () => {
    const seen = new Map<string, string[]>();
    for (const f of mains) for (const it of f.items) seen.set(it.promptFi, [...(seen.get(it.promptFi) ?? []), keyOf(it)]);
    for (const [prompt, keys] of seen) expect(new Set(keys).size, prompt).toBe(keys.length);
  });

  it("phase A: no correct position, and no correct answer, holds in more than half of the choice items of a level", () => {
    for (const level of ["L1", "L2", "L3"] as const) {
      const items = phaseA.flatMap((f) => f.items).filter((it) => it.level === level && isChoice(it));
      const half = items.length / 2;
      const byPos = new Map<number, number>(), byAnswer = new Map<string, number>();
      for (const it of items) {
        const pos = it.options.findIndex((o) => o.correct);
        byPos.set(pos, (byPos.get(pos) ?? 0) + 1);
        const label = it.options[pos]!.labelFi;
        byAnswer.set(label, (byAnswer.get(label) ?? 0) + 1);
      }
      for (const [pos, n] of byPos) expect(n, `${level} position ${pos}`).toBeLessThanOrEqual(half);
      for (const [label, n] of byAnswer) expect(n, `${level} answer ${label}`).toBeLessThanOrEqual(half);
    }
  });

  it("across the main freezes, the correct positions of each level differ by at most one", () => {
    for (const level of ["L1", "L2", "L3"] as const) {
      const counts = [0, 0, 0, 0];
      for (const it of mains.flatMap((f) => f.items).filter((x) => x.level === level && isChoice(x))) counts[it.options.findIndex((o) => o.correct)]!++;
      expect(Math.max(...counts) - Math.min(...counts), `${level}: ${counts}`).toBeLessThanOrEqual(1);
    }
  });

  it("no correct option is more than 1.3× longer than the longest wrong option, in Finnish or English (fix pass 2, P1-1: length cue)", () => {
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items.filter(isChoice)) {
      for (const lang of ["fi", "en"] as const) {
        const len = (fi: string) => (lang === "fi" ? fi : tr("en", fi)).length;
        const keyLen = len(it.options.find((o) => o.correct)!.labelFi);
        const longestWrong = Math.max(...it.options.filter((o) => !o.correct).map((o) => len(o.labelFi)));
        expect(keyLen, `${it.id} (${lang}): ${keyLen} against ${longestWrong}`).toBeLessThanOrEqual(1.3 * longestWrong);
      }
    }
  });

  it("V7's lull item does not state the smoulder-and-flare-up mechanism, which would cue the H10 rekindle item (fix pass 2, P1-2)", () => {
    const lull = mains.find((f) => f.cycle === 7)!.items.find((it) => it.id.endsWith(".lull_meaning"))!;
    for (const t of texts(lull)) expect(t).not.toMatch(/kyte|kytee|uudelleen|syttyä/i);
  });

  it("items sharing one option set never share their key across more than half of them", () => {
    const groups = new Map<string, string[]>();
    for (const f of mains) for (const it of f.items.filter(isChoice)) {
      const set = it.options.map((o) => o.labelFi).sort().join("|");
      groups.set(set, [...(groups.get(set) ?? []), keyOf(it)]);
    }
    for (const [set, keys] of groups) if (keys.length >= 3) for (const k of new Set(keys)) expect(keys.filter((x) => x === k).length, set).toBeLessThanOrEqual(keys.length / 2);
  });
});

describe("the infrastructure slot", () => {
  it("every main freeze carries exactly one, with four options and one correct, per the fixed schedule", () => {
    expect(Object.keys(INFRA_SCHEDULE).map(Number).sort((a, b) => a - b)).toEqual([0, ...FREEZE_VIEWS].sort((a, b) => a - b)); // 0 = the practice view
    expect(scenario.practice.freeze.items.map((it) => it.id)).toContain("freeze.practice.infra");
    for (const f of scenario.freezes) {
      const infra = f.items.filter((it) => /\.(infra|f7)$/.test(it.id));
      expect(infra, `V${f.cycle}`).toHaveLength(1);
      expect(infra[0]!.options).toHaveLength(4);
      expect(infra[0]!.options.filter((o) => o.correct).map((o) => o.id)).toEqual([INFRA_SCHEDULE[f.cycle]!.correct]);
      expect(infra[0]!.level).toBe(f.cycle === 12 ? "L2" : "L1");
    }
    expect(infrastructureItem(1)).toBeNull();
  });

  it("each topic keeps one option set across views: only the key (and the arranged order) moves", () => {
    const optionIds = (v: number) => infraOf(v).options.map((o) => `${o.id}:${o.labelFi}`).sort();
    expect(optionIds(2)).toEqual(optionIds(5)); // R1
    expect(optionIds(4)).toEqual(optionIds(7)); // water
    expect(infraOf(2).promptFi).toBe(infraOf(5).promptFi);
    // No fact is asked twice with the same answer: a topic that repeats has a different key.
    const asked = [2, 4, 5, 7, 10, 14].map((v) => `${infraOf(v).promptFi}|${INFRA_SCHEDULE[v]!.correct}`);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it("answer keys hold against the corpus at the view's last step", () => {
    // R1: a direct drone road report at V2's last step (unsafe) and at V5's (2 Oct 2026: the verge burned, no flames, passable — "open"); fix pass 2: reports name the stretch (FF2).
    expect(corpus.some((e) => e.cycle === lastStep(2) && /tiehavainto: tie R1[^,]*, .*ajo ei turvallista/.test(e.content))).toBe(true);
    expect(corpus.some((e) => e.cycle === lastStep(5) && /tiehavainto: tie R1[^,]*, .*ei liekkejä, ajettavissa/.test(e.content))).toBe(true);
    expect(corpus.some((e) => e.cycle === lastStep(5) && /tiehavainto: tie R1[^,]*, .*(matalaa paloa|ajo ei turvallista)/.test(e.content))).toBe(false);
    // W1 at V4 (and the practice view), W3 by V7.
    expect(corpus.some((e) => e.cycle >= 5 && e.cycle <= 6 && /täytti säiliön, Haukilampi/.test(e.content))).toBe(true);
    expect(corpus.some((e) => e.cycle === -3 && /vettä saa Haukilammelta \(W1\)/.test(e.content))).toBe(true);
    expect(firstStepWith(/täytti säiliön, R3:n silta \(Kotkanjoki\)/)).toBeLessThanOrEqual(lastStep(7));
    // R2 (2 Oct 2026, the rekindle at the origin): still passable at V10, reported at step 13; the front nears it at step 19; never cut.
    expect(firstStepWith(/Huoltotie R2 vielä ajettavissa/)).toBe(13);
    expect(firstStepWith(/Huoltotie R2 vielä ajettavissa/)).toBeLessThanOrEqual(lastStep(10));
    expect(firstStepWith(/etenee kohti huoltotietä R2/)).toBe(19); // EK12 (phase-B rebuild, 4 Oct 2026; was EK14 "lähestyy … noin 200 m")
    expect(corpus.some((e) => /(tie|tien|tietä|huoltotie\w*) R2\b/.test(e.content) && /katkais|poikki/.test(e.content))).toBe(false);
    // The bridge: first reported at step 16, so it is asked only after (V14).
    expect(firstStepWith(/ei pääse sillan yli/)).toBe(16);
    for (const v of FREEZE_VIEWS) if (lastStep(v) < 16) for (const t of scenario.freezes.find((f) => f.cycle === v)!.items.flatMap(texts)) expect(t, `V${v}`).not.toMatch(/sillan/);
  });
});

describe("nothing is named before it is knowable", () => {
  /** A term may appear in an item only from the first step its evidence is on record (corpus, story or radio atoms). */
  const atomText = (a: (typeof scenario.atoms)[number]) => ("text" in a.record ? String(a.record.text) : "content" in a.record ? String(a.record.content) : "");
  const onRecordFrom = (re: RegExp) =>
    Math.min(firstStepWith(re), ...scenario.atoms.filter((a) => re.test(atomText(a))).map((a) => Number(a.cycle)));
  const TERMS: readonly { readonly term: RegExp; readonly evidence: RegExp }[] = [
    { term: /HELI|helikopter/i, evidence: /HELI1|helikopteri/i },
    { term: /kyte|uudelleen/i, evidence: /kyteä|kytee/i }, // the bog may still be smouldering: VPK's objection, step 10
    { term: /evaku/i, evidence: /evaku/i },
    { term: /lietevaun/i, evidence: /lietevaun/i },
    { term: /Honkaharju/i, evidence: /Honkaharju/i },
    { term: /UGV|robot/i, evidence: /UGV1/ },
    { term: /palorintama|kaakkoisrintama/i, evidence: /Vanha reuna on syttynyt uudelleen/ }, // the rekindled front, reported at step 12 (V9)
    { term: /sillan/i, evidence: /ei pääse sillan yli/ },
  ];

  it("the evidence for each term is on record", () => {
    for (const { evidence } of TERMS) expect(Number.isFinite(onRecordFrom(evidence)), String(evidence)).toBe(true);
  });

  it("no item names a term before the view whose last step has it on record", () => {
    for (const f of [...mains, scenario.practice.freeze]) {
      const last = f.cycle === 0 ? -3 : lastStep(f.cycle);
      for (const it of f.items) for (const t of texts(it)) for (const { term, evidence } of TERMS) {
        if (term.test(t)) expect(onRecordFrom(evidence), `${it.id}: "${t}" names ${term}`).toBeLessThanOrEqual(last);
      }
    }
  });

  it("no item names drones or the 110 kV line outside F7", () => {
    for (const f of [...mains, scenario.practice.freeze]) for (const it of f.items) {
      for (const t of texts(it)) expect(t).not.toMatch(/drooni/i);
      if (!it.id.endsWith(".f7")) expect(texts(it).join(" "), it.id).not.toMatch(/110 kV|voimajoh/);
    }
  });
});

describe("no source question (withdrawn 2 Oct 2026)", () => {
  it("the freeze screen, the item content and the UI texts ask nothing about where an answer came from", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["app/render/ui/components/FreezeScreen.tsx", "app/scenario/demo-probes.ts", "app/i18n/ui.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Mistä tieto oli peräisin\?"|Päättelin itse|sourceOptions\(/);
    }
  });
});

describe("the course-of-action item describes the logged allocation", () => {
  it("asks the same question in every view, after the allocation, with the four codes kept", () => {
    for (const d of scenario.decisionItems) {
      expect(d.promptFi).toBe(DECISION_PROMPT_FI);
      expect(d.options.map((o) => `${o.alignment}/${o.soundness}`)).toEqual(["aligned/sound", "aligned/unsound", "against/sound", "against/unsound"]);
    }
    expect(DECISION_PROMPT_FI).toMatch(/kirjaamaasi kohdennusta/);
  });
});

describe("reactivity safeguards", () => {
  it("no SA or decision item names a tool", () => {
    const all = [
      ...[...scenario.freezes, scenario.practice.freeze].flatMap((f) => f.items.flatMap(texts)),
      ...[...scenario.decisionItems, scenario.practice.decisionItem].flatMap((d) => [d.promptFi, ...d.options.map((o) => o.labelFi)]),
    ];
    for (const t of all) expect(t).not.toMatch(TOOL_WORDS);
  });

  it("every freeze prompt and option has English", () => {
    for (const f of [...mains, scenario.practice.freeze]) for (const t of f.items.flatMap(texts)) expect(hasLabelEn(t), t).toBe(true);
  });

  it("V1, V9 and V13 stay without an SA probe", () => {
    for (const v of [1, 9, 13]) {
      expect(FREEZE_VIEWS.has(v), `V${v}`).toBe(false);
      expect(SPAM_VIEWS.has(v), `V${v}`).toBe(false);
      expect(scenario.freezes.some((f) => f.cycle === v)).toBe(false);
    }
  });
});

describe("map items come last, and the freeze screen shows one item at a time (2 Oct 2026)", () => {
  it("in every freeze, no choice item follows a map item", async () => {
    const { buildDemoScenario } = await import("../../app/scenario/demo-scenario.js");
    const s = buildDemoScenario();
    for (const f of [s.practice.freeze, ...s.freezes]) {
      const kinds = f.items.map((i) => (i.kind === "map_point" ? "map" : "choice"));
      if (kinds.includes("map")) expect(kinds.slice(kinds.indexOf("map")).every((k) => k === "map"), `V${f.cycle}: ${kinds.join(" ")}`).toBe(true);
    }
  });

  it("the screen renders only the current item and has no way back", async () => {
    const { readFileSync } = await import("node:fs");
    const code = readFileSync("app/render/ui/components/FreezeScreen.tsx", "utf8");
    expect(code).toMatch(/freeze\.items\[Math\.min\(current/);
    expect(code).not.toMatch(/freeze\.items\.map\(\(item/);
    expect(code).not.toMatch(/setCurrent\(\(c\) => c - 1\)/);
  });
});

describe("the final fix pass's items (8 Oct 2026)", () => {
  const item = (view: number, slug: string) => mains.find((f) => f.cycle === view)!.items.find((it) => it.id.endsWith(`.${slug}`))!;

  it("the measures' F7 constants name the V12 F7 item and its planted option", async () => {
    const { F7_ITEM_ID, F7_PLANTED_OPTION_ID } = await import("../../app/telemetry/freeze-measures.js");
    const { F7_FALSE_OPTION_ID } = await import("../../app/scenario/demo-probes.js");
    expect(F7_PLANTED_OPTION_ID).toBe(F7_FALSE_OPTION_ID);
    const f7 = infraOf(12);
    expect(f7.id).toBe(F7_ITEM_ID);
    expect(f7.options.find((o) => o.id === F7_PLANTED_OPTION_ID)).toMatchObject({ correct: false });
  });

  it("V14 asks the south-east front's distance to R2 (not on record) instead of the growth trend; V14 keeps 2×L1, 2×L2, 2×L3", () => {
    const f = mains.find((x) => x.cycle === 14)!;
    expect(f.items.some((it) => it.id.endsWith(".growth_trend"))).toBe(false);
    expect(item(14, "se_front_r2")).toMatchObject({ level: "L3", goal: "containment" });
    expect(f.items.map((it) => it.level).sort()).toEqual(["L1", "L1", "L2", "L2", "L3", "L3"]);
  });

  it("V12's front_toward has no absurd option: every option is a place a front could be heading, within the key's length", () => {
    const it = item(12, "front_toward");
    expect(it.options.map((o) => o.labelFi).join("|")).not.toMatch(/asumattomaan/);
    for (const o of it.options) expect(o.labelFi.length, o.labelFi).toBeLessThanOrEqual(50);
  });

  it("V7's lull distractors are moderate: no extreme wording, and the hedged key is not the only hedged option", () => {
    const it = item(7, "lull_meaning");
    for (const o of it.options.filter((x) => !x.correct)) expect(o.labelFi, o.labelFi).not.toMatch(/heti|koko|sammumassa|kokonaan|aina|ei koskaan/i);
    expect(it.options.length).toBe(4);
  });

  it("V5's wind-shift item says the wind blows FROM the south", () => {
    const it = item(5, "wind_shift");
    expect(it.promptFi).toMatch(/etelästä/);
    expect(it.promptFi).not.toMatch(/etelään/);
    expect(tr("en", it.promptFi)).toMatch(/from the south/);
  });
});
