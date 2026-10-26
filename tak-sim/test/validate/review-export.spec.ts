/**
 * The review packet (`npm run review:export`, `tools/review/export.ts`, 5 Oct 2026): it runs, writes
 * CSV and Markdown, and covers every participant-facing string, every corpus record and every draft key.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import { UI_TEXT } from "../../app/i18n/ui.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { ALL_QUESTIONNAIRE_ITEMS } from "../../app/session/questionnaire.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { SPAM_ITEMS } from "../../app/scenario/demo-probes.js";
import { collectCorpus, collectKeys, collectStrings, toCsv, writeReviewPacket } from "../../tools/review/export.js";

const scenario = buildDemoScenario();
const strings = collectStrings();
const keys = collectKeys();
const corpus = collectCorpus();
const dir = mkdtempSync(join(tmpdir(), "review-packet-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("the review packet", () => {
  it("runs and writes CSV and Markdown for strings, corpus and keys, with a README", () => {
    const s = writeReviewPacket(dir);
    expect(s.files).toEqual(["strings.csv", "strings.md", "corpus.csv", "corpus.md", "keys.csv", "keys.md", "README.md"]);
    for (const f of s.files) expect(existsSync(join(dir, f)), f).toBe(true);
    const csv = readFileSync(join(dir, "keys.csv"), "utf8");
    expect(csv.startsWith("﻿kind,id,view,itemFi,itemEn,keyFi,keyEn,basis,basisRecords,review")).toBe(true);
    expect(readFileSync(join(dir, "README.md"), "utf8")).toContain(`${s.keys} draft keys`);
    expect(s).toMatchObject({ strings: strings.length, corpus: corpus.length, keys: keys.length });
  });

  it("is deterministic", () => {
    expect(collectStrings()).toEqual(strings);
    expect(collectKeys()).toEqual(keys);
  });

  it("escapes CSV cells (commas, quotes, newlines)", () => {
    expect(toCsv([{ a: 'x, "y"\nz' }], ["a"])).toBe('﻿a,review\r\n"x, ""y""\nz",\r\n');
  });
});

describe("(a) every participant-facing string, Finnish and English", () => {
  const ids = new Set(strings.map((r) => r.id));
  const fis = new Set(strings.map((r) => r.fi));

  it("covers every interface string (ui.ts), each with both languages", () => {
    for (const k of Object.keys(UI_TEXT.en)) expect([...ids].some((id) => id === `ui.${k}` || id.startsWith(`ui.${k}.`) || id.startsWith(`ui.${k}[`)), k).toBe(true);
    for (const r of strings.filter((x) => x.id.startsWith("ui."))) { expect(r.fi, r.id).not.toBe(""); expect(r.en, r.id).not.toBe(""); }
    for (const id of ["ui.tour.steps.spam.body", "ui.directiveBanner", "ui.done"]) expect(ids).toContain(id);
  });

  it("covers the briefing, the training texts and the study shell (consent, preflight, every questionnaire item and option, the debrief per cell)", () => {
    for (const id of ["briefing.setting", "training.directed", "training.substitutive", "study.consent.placeholderBanner", "study.preflight.failures.not_desktop.fix", "study.debrief.reasoning_intent.p6"]) expect(ids, id).toContain(id);
    for (const item of ALL_QUESTIONNAIRE_ITEMS) expect(ids, item.id).toContain(`study.questionnaire.items.${item.id}.prompt`);
    for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
      const en = strings.filter((r) => r.id.startsWith(`study.debrief.${cell}.p`)).map((r) => r.en);
      expect(en).toEqual([...STUDY_TEXT.en.debrief.paragraphs(cell)]);
    }
    expect(strings.some((r) => r.id.startsWith("study.glossary."))).toBe(false); // no glossary since revision (ae)
  });

  it("covers every scenario label in labels.en.json, with its English", () => {
    for (const [fi, en] of Object.entries(labelsEn as Record<string, string>)) {
      expect(fis.has(fi), fi).toBe(true);
      expect(strings.some((r) => r.fi === fi && r.en === en), fi).toBe(true);
    }
    for (const f of scenario.freezes) for (const it of f.items) expect(ids, it.id).toContain(`${it.id}.prompt`);
    expect(ids).toContain("probe.s.practice.prompt");
    expect(ids).toContain("hinge.directive");
  });
});

describe("(b) every corpus record", () => {
  it("has a row with its Finnish and English text", () => {
    expect(corpus.map((r) => r.id)).toEqual(scenario.atoms.map((a) => a.id));
    for (const r of corpus) { expect(r.fi, r.id).not.toBe(""); expect(r.en, r.id).not.toBe(""); }
    expect(corpus.some((r) => r.delivery === "pushed")).toBe(true);
    expect(corpus.some((r) => r.delivery === "recorded")).toBe(true);
  });
});

describe("(c) every draft answer key, with its basis", () => {
  const keyIds = new Set(keys.map((r) => r.id));

  it("covers every freeze item of the scenario (the main views; VP has none since revision (bp)), each with a key and a basis", () => {
    const items = [...scenario.freezes.flatMap((f) => f.items), ...scenario.practice.freeze.items];
    for (const it of items) expect(keyIds, it.id).toContain(it.id);
    expect([...keyIds].filter((id) => id.startsWith("freeze.practice."))).toEqual([]); // revision (bp): VP's practice freeze is retired
    for (const r of keys.filter((k) => k.kind.startsWith("freeze"))) { expect(r.keyFi, r.id).not.toBe(""); expect(r.basis, r.id).not.toBe(""); }
  });

  it("covers the directive keys per view, SPAM (and the practice item) and the hinge check; no outlook or branch truth (revision (x))", () => {
    for (const v of Object.keys(DIRECTIVE_KEYS)) expect(keyIds).toContain(`directive.${v}`);
    for (const v of Object.keys(SPAM_ITEMS)) expect(keyIds).toContain(`probe.s.cycle_${v}`);
    expect(keyIds).toContain("probe.s.practice");
    expect(keys.find((k) => k.id === "probe.s.practice")!.basisRecords).toMatch(/Haukilammelta/);
    expect(keyIds).toContain(scenario.hinge.manipulationCheck!.id);
    expect(keys.some((k) => k.kind === "outlook" || k.kind === "branch truth")).toBe(false);
    for (const r of keys.filter((k) => k.kind === "SPAM")) expect(r.basisRecords, r.id).not.toBe("");
  });

  it("lists every scenario invariant somewhere", () => {
    const covered = new Set([...keyIds, scenario.hinge.manipulationCheck!.invariantName, ...Object.keys(SPAM_ITEMS).map((v) => `spam.cycle_${v}`)]);
    for (const inv of scenario.invariants) expect(covered.has(inv.name), inv.name).toBe(true);
  });
});
