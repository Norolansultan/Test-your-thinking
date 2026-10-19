/**
 * The SPAM items and the hinge manipulation check as content (round 2, 4 Oct 2026, agent C; the rule
 * is in `demo-probes.ts`): answerable from the screen — every key rests on a PUSHED record in the
 * message log by the item's moment, found by content; parallel options in a seeded order; L1
 * situation items; silent on the designed events, the freeze keys and the directive keys; English;
 * the hinge check's key states the directive's line and aim and lives only in an invariant.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario, DIRECTIVE_FI } from "../../app/scenario/demo-scenario.js";
import {
  arrangeSpamOptions, buildHingeCheck, FREEZE_VIEWS, HINGE_CHECK_INVARIANT, SPAM_ANSWER_TIMEOUT_MS, SPAM_AUTHORED, SPAM_ITEMS,
  SPAM_KEY_ATOMS, SPAM_OFFSET_MS, SPAM_VIEW_ORDER, SPAM_VIEWS, spamRecordId,
} from "../../app/scenario/demo-probes.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { FREEZE_BANK_SEED } from "../../app/scenario/freeze-bank-core.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { viewTimingOf } from "../../app/session/view-clock.js";
import { hasLabelEn, tr } from "../../app/i18n/text.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id)!;
const text = (id: string) => recordText(toRenderable(atom(id)).record);
const probe = (view: number) => scenario.probeSchedule.probes.find((p) => p.type === "S" && p.cycle === view)!;
const keyText = (view: number) => SPAM_ITEMS[view]!.options["abcd".indexOf(SPAM_ITEMS[view]!.correct)]!;

/**
 * Whether record `id` is in the message log when the view-`view` item is shown: pushed in an earlier
 * view, or in this view's first step (all first-step messages arrive when the view opens; the
 * probe closes before a merged view's second step).
 */
function inLogAt(view: number, id: string): boolean {
  return scenario.cycles.some((c) => {
    const k = c.pushedAtomIds.indexOf(id);
    if (k < 0) return false;
    return c.index < view || (c.index === view && c.deliveryOffsetsSeconds[k]! < STEP_SECONDS);
  });
}

describe("the SPAM items (round 2: answerable from the screen, tools locked)", () => {
  it("are at V3, V6, V8, V11, L1 situation items, with English for the prompt and every option", () => {
    expect(SPAM_VIEW_ORDER).toEqual([3, 6, 8, 11]);
    for (const v of SPAM_VIEW_ORDER) {
      expect(probe(v), `V${v}`).toMatchObject({ mode: "ONLINE", saLevel: 1, contentKind: "situation", collectsConfidence: true });
      for (const s of [SPAM_ITEMS[v]!.prompt, ...SPAM_ITEMS[v]!.options]) {
        expect(hasLabelEn(s), s).toBe(true);
        expect(tr("en", s)).not.toBe(s);
      }
    }
  });

  it("each key rests on PUSHED records, found by content, in the message log by the item's moment", () => {
    for (const v of SPAM_VIEW_ORDER) {
      const ids = SPAM_KEY_ATOMS[v]!;
      expect(ids.length, `V${v}`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(atom(id), id).toBeDefined();
        expect(atom(id).tier, id).toBe("T1_pushed");
        expect(inLogAt(v, id), `V${v} ${id}`).toBe(true);
      }
    }
    expect(text(SPAM_KEY_ATOMS[3]![0]!)).toMatch(/palanut ala noin 17,8 ha/);
    expect(keyText(3)).toBe("Noin 18 ha");
    expect(text(SPAM_KEY_ATOMS[6]![0]!)).toMatch(/Koivuojan yli.*EK11 joutui vetäytymään/); // safety re-check (ah): EK11's crew in the black at 15:40
    expect(keyText(6)).toBe("Palo on ylittänyt ojan, linja on murtunut");
    expect(text(SPAM_KEY_ATOMS[8]![0]!)).toMatch(/käyttöaste ei tiedossa, poliisi pyydetty tarkistamaan/);
    expect(text(SPAM_KEY_ATOMS[8]![1]!)).toMatch(/onko poliisi saanut mökit tarkistettua/);
    expect(keyText(8)).toBe("Ei tiedossa: poliisi on pyydetty tarkistamaan");
    expect(text(SPAM_KEY_ATOMS[11]![0]!)).toMatch(/^Alue pyytää KY21:tä toiselle palolle/);
    expect(keyText(11)).toBe("Siirtymistä toiselle palolle alueella");
  });

  it("V3's key is the LATEST survey: the stale figure is a lure, and no newer area figure is in the log by V3", () => {
    // `31` F25: the stale lure is DR3's 13.55 survey (~10 ha); the 14.15 one (12.9 ha) is V3.b's basis and is no longer an option.
    expect(text(spamRecordId(2, /^DR3 kehäkartoitus valmis klo 13\.55: palanut ala noin 10,3 ha/))).toBeTruthy();
    expect(SPAM_ITEMS[3]!.options).toContain("Noin 10 ha");
    expect(SPAM_ITEMS[3]!.options).not.toContain("Noin 13 ha");
    const areas = scenario.cycles.filter((c) => c.index <= 3).flatMap((c) => c.pushedAtomIds.filter((id, k) => c.index < 3 || c.deliveryOffsetsSeconds[k]! < STEP_SECONDS))
      .map(text).filter((t) => /palanut ala noin/.test(t));
    expect(areas.at(-1)).toMatch(/17,8 ha/);
    expect(SPAM_ITEMS[3]!.options).toEqual(["Noin 10 ha", "Noin 18 ha", "Noin 25 ha", "Noin 35 ha"]); // a quantity, ascending
  });

  it("V8: nothing in the log by V8 reports the Mökkiranta cabins checked", () => {
    const log = scenario.cycles.filter((c) => c.index <= 8).flatMap((c) => c.pushedAtomIds).map(text).filter((t) => /Mökkiran/.test(t));
    expect(log.some((t) => /tarkistettu|tyhj|evakuoi/.test(t) && !/\?/.test(t))).toBe(false);
  });

  it("cue nothing designed: no key record is a designed event, a freeze key or a directive key, and no item names the line, the helicopter, the origin, a thermal check, the forecast, water or a tool", () => {
    const designed = new Set<string>([...Object.values(DESIGNED_EVENT_IDS).flat(), "t4.ember_warning", "t4.private_doubt", "t4.water_state", scenario.contradiction.premiseAtomId, scenario.contradiction.counterAtomId, scenario.contradiction.reconcilingAtomId, ...scenario.omission.developmentAtomIds]);
    const freezeKeys = new Set(scenario.freezes.flatMap((f) => f.items.flatMap((i) => i.keyAtomIds ?? [])));
    const directiveKeys = new Set(Object.values(DIRECTIVE_KEYS).flatMap((k) => k?.basisAtomIds ?? []));
    for (const v of SPAM_VIEW_ORDER) {
      for (const id of SPAM_KEY_ATOMS[v]!) {
        expect(designed.has(id), id).toBe(false);
        expect(freezeKeys.has(id), id).toBe(false);
        expect(directiveKeys.has(id), id).toBe(false);
        expect(atom(id).loadBearing, id).toBe(false);
      }
      const words = [SPAM_ITEMS[v]!.prompt, ...SPAM_ITEMS[v]!.options].join(" ");
      expect(words, `V${v}`).not.toMatch(/voimajoh|110 kV|sähkö|helikop|HELI|drooni|DR\d|syttymäkoh|lämpökamer|ennuste|tuul|vesipiste|Haukilamp|W\d|Haku|Thinker|tekoäly|haku/i);
    }
  });

  it("parallel options: similar length, and where the key is a pair of facts, crossed (V8: known/unknown × checked/requested)", () => {
    for (const v of SPAM_VIEW_ORDER) {
      const lengths = SPAM_ITEMS[v]!.options.map((o) => o.length);
      expect(Math.max(...lengths) - Math.min(...lengths), `V${v}`).toBeLessThanOrEqual(10);
      expect(new Set(SPAM_ITEMS[v]!.options).size).toBe(4);
    }
    const v8 = SPAM_ITEMS[8]!.options;
    expect(v8.filter((o) => o.startsWith("Ei tiedossa: "))).toHaveLength(2);
    expect(v8.filter((o) => o.startsWith("Tarkistettu: "))).toHaveLength(2);
    const v6 = SPAM_ITEMS[6]!.options;
    for (const o of v6) expect(o).toMatch(/, linja (on |)\S+/);
    // `31` F20: the fourth state is clearly different from the key's record (a hand-over, not a withdrawal from the broken line)
    expect(v6.filter((o) => /vetäyty|hylät/.test(o))).toEqual([]);
  });

  it("the option order is the seeded build-time arrangement (unchanged mechanism): the key is not always 'a' and follows its option", () => {
    const letters = SPAM_VIEW_ORDER.map((v) => SPAM_ITEMS[v]!.correct);
    expect(letters).toEqual(["b", "d", "a", "c"]); // one each
    for (const v of SPAM_VIEW_ORDER) {
      const a = SPAM_AUTHORED[v]!, s = SPAM_ITEMS[v]!;
      expect(keyText(v)).toBe(a.key);
      expect([...s.options].sort()).toEqual([a.key, ...a.distractors].sort());
      expect(scenario.invariants.find((i) => i.name === `spam.cycle_${v}`)!.expected).toBe(s.correct);
      const shown = probe(v).response;
      expect(shown.kind === "categorical" && shown.options.map((o) => o.fi)).toEqual([...s.options]);
    }
    expect(arrangeSpamOptions(SPAM_AUTHORED, SPAM_VIEW_ORDER, FREEZE_BANK_SEED)).toEqual(SPAM_ITEMS);
  });

  it("timing (revision (ag)): prompt 25 s in, no ready expiry, 60 s to answer — an item said ready to at once closes by 85 s, before the minimum; never a freeze view", () => {
    expect(SPAM_ANSWER_TIMEOUT_MS).toBe(60_000);
    for (const v of SPAM_VIEW_ORDER) {
      expect(probe(v)).toMatchObject({ offsetInWorkingPeriodMs: SPAM_OFFSET_MS, answerTimeoutMs: SPAM_ANSWER_TIMEOUT_MS });
      expect(probe(v)).not.toHaveProperty("readyTimeoutMs");
      const c = scenario.cycles.find((x) => x.index === v)!;
      const t = viewTimingOf(c, null);
      const end = (SPAM_OFFSET_MS + SPAM_ANSWER_TIMEOUT_MS) / 1000;
      expect(end).toBeLessThan(t.minViewSeconds); // (a merged view's boundary at 65 s waits for an open item: test/session/spam.spec.ts)
      expect(SPAM_OFFSET_MS / 1000).toBeGreaterThanOrEqual(t.decisionOpensAtSeconds); // after the panel opens
      expect(SPAM_OFFSET_MS / 1000).toBeGreaterThanOrEqual(15); // SPEC/15 §5: ≥ 15 s from the opening burst
      expect(c.hasFreeze).toBe(false);
      expect(FREEZE_VIEWS.has(v)).toBe(false);
    }
    expect([...SPAM_VIEWS].some((v) => v === 0)).toBe(false);
  });
});

describe("the manipulation check (brief D3)", () => {
  const check = scenario.hinge.manipulationCheck!;
  const key = scenario.invariants.find((i) => i.name === HINGE_CHECK_INVARIANT)!.expected as string;
  const keyLabel = check.options.find((o) => o.id === key)!.labelFi;

  it("asks the line in force, with four parallel options, one of which is the directive's line and aim", () => {
    expect(check.promptFi).toBe("Mikä on nyt voimassa oleva toimintalinja?");
    expect(check.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
    expect(keyLabel).toBe("Linjat teiden ja vesistöjen varaan; suojataan Lahdenkylä ja Mökkiranta");
    expect(DIRECTIVE_FI).toContain("linjat teiden ja vesistöjen varaan");
    expect(DIRECTIVE_FI).toContain("suojata Lahdenkylä ja Mökkiranta");
    for (const o of check.options) expect(o.labelFi).toMatch(/^(Linjat teiden ja vesistöjen varaan|Suora hyökkäys palon reunaan); /);
    const lengths = check.options.map((o) => o.labelFi.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(10);
    for (const s of [check.promptFi, ...check.options.map((o) => o.labelFi)]) expect(hasLabelEn(s), s).toBe(true);
  });

  it("carries no key: the key is the invariant only, and the order is seeded on its own stream", () => {
    expect(JSON.stringify(check)).not.toMatch(/correct|expected/);
    expect(check.invariantName).toBe(HINGE_CHECK_INVARIANT);
    expect(key).not.toBe("a");
    expect(buildHingeCheck()).toEqual(buildHingeCheck()); // deterministic
  });
});
