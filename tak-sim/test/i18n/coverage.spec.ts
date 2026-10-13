/**
 * The English session (researcher decision 1 Oct 2026): every record, label and interface string
 * has English, the English generated records come from the same events as the Finnish ones, and
 * the Finnish source is what retrieval reads. A failure lists exactly what is missing, so a new
 * Finnish text cannot reach the English session untranslated.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { NAV_CATEGORIES, NAV_TIME_WINDOWS } from "../../app/retrieval/navigation.js";
import { buildTemplateAnswer } from "../../app/session/template-answer.js";
import { hasLabelEn, recordEn, recordIn, sourceName, tr } from "../../app/i18n/text.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { introTextsIn } from "../../app/scenario/briefing.js";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };

const scenario = buildDemoScenario();
/** Finnish words that never belong in English text (proper names such as Mökkiranta are fine). */
const FINNISH = /\b(ja|ei|noin|klo|tie|tiellä|palo|palon|reuna|kärki|kärjen|vettä|säiliö|tehtävä|olemme|meillä|lohko|tuuli|savua|liekit|etenee|siirtyy|saapunut|kysyttäessä|Vesihuoltoloki|akkuloki|anturiloki|lämpökuva|tiehavainto|kehäkartoitus|johtopaikka|pohjoisreuna|syttymäkohta)\b/;

describe("records in English", () => {
  it("every record of the scenario has an English text", () => {
    const missing = scenario.atoms.filter((a) => recordEn(a.id) === undefined).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it("no English record contains Finnish words", () => {
    const bad = scenario.atoms.map((a) => [a.id, recordEn(a.id) ?? ""] as const).filter(([, t]) => FINNISH.test(t));
    expect(bad).toEqual([]);
  });

  it("every generated record's English was written from the same event (the bundle's map covers the traffic, one for one)", () => {
    const english = SITE_SCENARIO.english ?? {};
    for (const e of SITE_SCENARIO.traffic) expect(english[e.id], e.id).toBeTruthy();
  });

  it("keeps the numbers of the Finnish record (same event, other words)", () => {
    const nums = (s: string) => (s.match(/\d+/g) ?? []).filter((n) => n.length >= 2).sort();
    for (const e of SITE_SCENARIO.traffic.filter((x) => /\d{2,}/.test(x.content)).slice(0, 400)) {
      const fiN = nums(e.content.replace(/(\d),(\d)/g, "$1.$2"));
      const enN = nums((SITE_SCENARIO.english ?? {})[e.id]!);
      expect(enN, `${e.id}: ${e.content} | ${(SITE_SCENARIO.english ?? {})[e.id]}`).toEqual(fiN);
    }
  });

  it("shows Finnish in a Finnish session and English in an English one", () => {
    const a = scenario.atoms[0]!;
    expect(recordIn("fi", a.id, "FI")).toBe("FI");
    expect(recordIn("en", a.id, "FI")).toBe(recordEn(a.id));
  });
});

describe("labels and questions in English", () => {
  const shown = new Set<string>();
  for (const f of [...scenario.freezes, scenario.practice.freeze]) for (const it of f.items) { shown.add(it.promptFi); for (const o of it.options) shown.add(o.labelFi); }
  for (const d of [...scenario.decisionItems, scenario.practice.decisionItem]) { shown.add(d.promptFi); for (const o of d.options) shown.add(o.labelFi); }
  for (const b of [...scenario.branchStatements, ...scenario.practice.branchStatements]) shown.add(b.statementFi);
  for (const t of scenario.allocationSpace.tasks) shown.add(t.label);
  for (const s of scenario.allocationSpace.sectors) shown.add(s.label);
  for (const c of NAV_CATEGORIES) shown.add(c.labelFi);
  for (const w of NAV_TIME_WINDOWS) shown.add(w.labelFi);
  for (const m of scenario.dutyOfficerMessages) shown.add(m.text);
  shown.add(scenario.hinge.intentStatement); // the directive on the hinge pause screen (4 Oct 2026)
  // Every SPAM item (rendered from round 2, 4 Oct 2026) and the hinge manipulation check.
  // The visible probes F, U (delivered from 5 Oct 2026, `visible-probes.ts`; E withdrawn 6 Oct 2026): prompts and options.
  for (const p of scenario.probeSchedule.probes.filter((x) => x.type === "S" || x.type === "F" || x.type === "U")) {
    shown.add(p.prompt);
    if (p.response.kind === "categorical") for (const o of p.response.options) shown.add(o.fi);
  }
  const check = scenario.hinge.manipulationCheck!;
  shown.add(check.promptFi);
  for (const o of check.options) shown.add(o.labelFi);
  for (const c of scenario.cycles) shown.add(c.wind.sourceFi);
  for (const k of ["title", "past", "burnt", "uncontained", "contained", "spotConfirmed", "spotUnconfirmed", "detections", "projection"] as const) shown.add((theme as unknown as { legend: Record<string, string> }).legend[k]!);

  it("every label, question and option the participant sees has English", () => {
    expect([...shown].filter((fi) => !hasLabelEn(fi))).toEqual([]);
  });

  it("the English labels are not the Finnish ones", () => {
    for (const fi of shown) expect(tr("en", fi), fi).not.toBe(fi);
  });
});

describe("source names in English (6 Oct 2026)", () => {
  const sources = [...new Set(scenario.atoms.map((a) => a.provenance.sourceId)), "P2"];

  it("names every Finnish word-named source in English, VPK and P2 included", () => {
    const callSign = /^(EK|KY|DR|VD|HELI|UGV|OUT)\d+$/;
    const untranslated = sources.filter((id) => !callSign.test(id) && !["SPOT", "register"].includes(id) && sourceName("en", id) === id);
    expect(untranslated).toEqual([]);
    expect(sourceName("en", "VPK")).toBe("Volunteer fire brigade VOL1"); // its English call sign since revision (ae)
    // The English template's basis line names sources in English (8 Oct 2026), never SÄÄENNUSTE.
    const forecast = { id: "x", provenance: { sourceId: "SÄÄENNUSTE", observedAt: 0, certainty: { kind: "confirmed" } }, record: { kind: "text", text: "t" } };
    expect(buildTemplateAnswer([forecast as never], "en").basisFi).toBe("Weather forecast at 13.20");
    expect(sourceName("en", "P2")).toBe("Duty fire chief");
  });

  it("keeps unit call signs, and every name in a Finnish session", () => {
    expect(sourceName("en", "EK11")).toBe("EK11");
    for (const id of sources) expect(sourceName("fi", id)).toBe(id);
  });
});

describe("interface and briefing in English", () => {
  it("has the same interface keys in both languages", () => {
    expect(Object.keys(UI_TEXT.en).sort()).toEqual(Object.keys(UI_TEXT.fi).sort());
  });

  it("has the briefing and both training texts, with the same cross-checking sentence, and no Finnish", () => {
    for (const c of ["directed", "substitutive"] as const) {
      const t = introTextsIn(c, "en");
      expect(t.training).toContain("You can compare the records of different sources with each other.");
      expect(t.setting + t.training).not.toMatch(FINNISH);
    }
    expect(introTextsIn("directed", "en").setting).toBe(introTextsIn("substitutive", "en").setting);
    expect(introTextsIn("directed", "en").training).not.toMatch(/thinker|agent|\bAI\b/i);
  });
});
