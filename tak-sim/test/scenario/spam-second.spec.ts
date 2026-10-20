/**
 * SPEC/30 §5.2 (19 Oct 2026): the second SPAM items of V3 and V6 (both L2 since `31` F04), team understanding with the tools at hand (in the style of
 * `spam.spec.ts`): every key rests on records reachable with Haku or the Thinker by the item's moment (the view's first step or earlier;
 * pushed or recorded); four parallel options under the 1.3× rule, in a seeded order on their own stream; English; silent on the designed
 * events, the directive keys, a later freeze's keys and every keyed phase-B view. DRAFT content for the domain review (SPEC/30 §8).
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import {
  arrangeSpamOptions, RETRIEVAL_DEPENDENT_PROBE_IDS, SPAM_ITEMS, SPAM_SECOND_AUTHORED, SPAM_SECOND_ITEMS, SPAM_SECOND_KEY_ATOMS, SPAM_SECOND_VIEWS,
} from "../../app/scenario/demo-probes.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { FREEZE_BANK_SEED } from "../../app/scenario/freeze-bank-core.js";
import { MAIN_VIEWS, STEP_SECONDS } from "../../app/scenario/views.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { hasLabelEn, tr } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id)!;
const text = (id: string) => recordText(toRenderable(atom(id)).record);
const firstStep = (view: number) => MAIN_VIEWS.find((v) => v.index === view)!.steps[0]!;
const keyText = (view: number) => SPAM_SECOND_ITEMS[view]!.options["abcd".indexOf(SPAM_SECOND_ITEMS[view]!.correct)]!;
/** Pushed in an earlier view, or in this view's first step (delivered when the view opens). */
const inLogAt = (view: number, id: string) => scenario.cycles.some((c) => {
  const k = c.pushedAtomIds.indexOf(id);
  return k >= 0 && (c.index < view || (c.index === view && c.deliveryOffsetsSeconds[k]! < STEP_SECONDS));
});

describe("the second SPAM items (SPEC/30 §5.2)", () => {
  it("are at V3 and V6, L2 situation items (`31` F04: V6.b re-authored as L2), with English for the prompt and every option", () => {
    expect(SPAM_SECOND_VIEWS).toEqual([3, 6]);
    expect(Object.keys(SPAM_SECOND_ITEMS).map(Number)).toEqual([3, 6]);
    expect(SPAM_SECOND_ITEMS[3]).toMatchObject({ saLevel: 2, contentKind: "situation" });
    expect(SPAM_SECOND_ITEMS[6]).toMatchObject({ saLevel: 2, contentKind: "situation" });
    for (const v of SPAM_SECOND_VIEWS) for (const s of [SPAM_SECOND_ITEMS[v]!.prompt, ...SPAM_SECOND_ITEMS[v]!.options]) {
      expect(hasLabelEn(s), s).toBe(true);
      expect(tr("en", s)).not.toBe(s);
    }
  });

  it("each key rests on records reachable with the tools by the item's moment (the view's first step or earlier)", () => {
    for (const v of SPAM_SECOND_VIEWS) {
      const ids = SPAM_SECOND_KEY_ATOMS[v]!;
      expect(ids.length, `V${v}`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(atom(id), id).toBeDefined();
        expect(Number(atom(id).cycle), id).toBeLessThanOrEqual(firstStep(v));
      }
    }
  });

  it("V3: DR3's 14.15 survey (recorded: reached only with the tools) against its pushed 14.35 survey — about a third more new area (SPEC/33 stage 9: 4,4 → 6,0 ha; was nearly twice)", () => {
    const [before, latest] = SPAM_SECOND_KEY_ATOMS[3]!;
    expect(atom(before!).tier).not.toBe("T1_pushed");
    expect(inLogAt(3, latest!)).toBe(true);
    const newHa = (id: string) => Number(/(\d+,\d) ha uutta/.exec(text(id))![1]!.replace(",", "."));
    expect(newHa(latest!) / newHa(before!)).toBeGreaterThan(1.2);
    expect(newHa(latest!) / newHa(before!)).toBeLessThan(1.5);
    expect(keyText(3)).toBe("Kiihtynyt, uutta alaa noin kolmanneksen enemmän");
  });

  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): both of DR2's latest reports (15.27, 15.47) now read "low fire at the verge, with
  // care", so the key is "no change"; the stale change (no flames at 15.07) and the V2-time "not safe" are the lures.
  it("`31` F04, F18: V6 — R1 south of Kuivakangas in DR2's two latest road reports on hand, 15.27 and 15.47, both 'low fire at the verge, with care': no change — the key; both recorded only (retrieval-dependent)", () => {
    const [before, latest] = SPAM_SECOND_KEY_ATOMS[6]!;
    expect(text(before!)).toMatch(/tie R1 Kuivakankaan eteläpuolella, palo noin 10 m tiestä — matalaa paloa tien reunassa.*ajettavissa varoen/);
    expect(text(latest!)).toMatch(/tie R1 Kuivakankaan eteläpuolella, .*matalaa paloa tien reunassa.*ajettavissa varoen/);
    for (const id of [before!, latest!]) {
      expect(atom(id).tier, id).not.toBe("T1_pushed");
      expect(inLogAt(6, id), id).toBe(false); // never in the message log: reached only with the tools
    }
    const r1 = (step: number) => SITE_SCENARIO.traffic.filter((t) => t.cycle === step && /tiehavainto: tie R1 Kuivakankaan/.test(t.content));
    expect(r1(7).map((t) => t.id)).toEqual([before]);
    expect(r1(8).map((t) => t.id)).toEqual([latest]); // the latest reachable at the item's moment (V6's first step)
    expect(SPAM_SECOND_ITEMS[6]!.prompt).toMatch(/tien R1 tila Kuivakankaan eteläpuolella/); // F18: the stretch is named
    expect(keyText(6)).toBe("Ei muutosta, matalaa paloa tien reunassa, ajettavissa varoen");
    expect(SPAM_SECOND_ITEMS[6]!.options).toContain("Liekit ovat sammuneet, tie on taas ajettavissa"); // the stale change (true at 15.07): the lure
    expect(RETRIEVAL_DEPENDENT_PROBE_IDS).toEqual(["probe.s.cycle_6.b"]);
  });

  it("cue nothing designed: no key record is a designed event, a directive key or a later freeze's key; no item names a designed topic, a keyed phase-B front or a tool", () => {
    const designed = new Set<string>([...Object.values(DESIGNED_EVENT_IDS).flat(), "t4.ember_warning", "t4.private_doubt", "t4.water_state", scenario.contradiction.premiseAtomId, scenario.contradiction.counterAtomId, scenario.contradiction.reconcilingAtomId, ...scenario.omission.developmentAtomIds]);
    const directiveKeys = new Set(Object.values(DIRECTIVE_KEYS).flatMap((k) => k?.basisAtomIds ?? []));
    for (const v of SPAM_SECOND_VIEWS) {
      const laterFreezeKeys = new Set(scenario.freezes.filter((f) => f.cycle > v).flatMap((f) => f.items.flatMap((i) => i.keyAtomIds ?? [])));
      for (const id of SPAM_SECOND_KEY_ATOMS[v]!) {
        expect(designed.has(id), id).toBe(false);
        expect(directiveKeys.has(id), id).toBe(false);
        expect(laterFreezeKeys.has(id), id).toBe(false);
        expect(atom(id).loadBearing, id).toBe(false);
      }
      const words = [SPAM_SECOND_ITEMS[v]!.prompt, ...SPAM_SECOND_ITEMS[v]!.options].join(" ");
      expect(words, `V${v}`).not.toMatch(/voimajoh|sähkölinj|(?:110|20) kV|sähkö|helikop|HELI|drooni|DR\d|syttymäkoh|lämpökamer|ennuste|tuul|vesipiste|Haukilamp|W\d|Haku|Thinker|tekoäly|haku/i);
      expect(words, `V${v}`).not.toMatch(/kaakko|Lahdenkyl|\bR2\b|Honkaharju|Rahkasuo|uudelleen|kyte|Mökkiran/i);
    }
  });

  it("four distinct options; no key more than 1.3× the longest wrong option, in Finnish or English", () => {
    for (const v of SPAM_SECOND_VIEWS) {
      const it = SPAM_SECOND_ITEMS[v]!;
      expect(new Set(it.options).size).toBe(4);
      for (const lang of ["fi", "en"] as const) {
        const len = (s: string) => (lang === "fi" ? s : tr("en", s)).length;
        const wrong = it.options.filter((o) => o !== keyText(v)).map(len);
        expect(len(keyText(v)), `V${v} ${lang}`).toBeLessThanOrEqual(1.3 * Math.max(...wrong));
      }
    }
  });

  it("the order is a seeded build-time arrangement on its own stream: the key follows its option; the first items do not move", () => {
    for (const v of SPAM_SECOND_VIEWS) {
      const a = SPAM_SECOND_AUTHORED[v]!, s = SPAM_SECOND_ITEMS[v]!;
      expect(keyText(v)).toBe(a.key);
      expect([...s.options].sort()).toEqual([a.key, ...a.distractors].sort());
    }
    expect(arrangeSpamOptions(SPAM_SECOND_AUTHORED, SPAM_SECOND_VIEWS, FREEZE_BANK_SEED, "spam-items-2")).toEqual(SPAM_SECOND_ITEMS);
    expect(SPAM_SECOND_ITEMS[3]!.correct).not.toBe(SPAM_SECOND_ITEMS[6]!.correct); // the least-used position rule spreads the keys
    expect([3, 6, 8, 11].map((v) => SPAM_ITEMS[v]!.correct)).toEqual(["b", "d", "a", "c"]);
  });
});
