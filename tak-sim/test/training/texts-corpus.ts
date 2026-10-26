/**
 * Test helpers for the training incident (SPEC/08 (bp) §bp.8, `15` (bp) §bp.7): every training text in both languages (intro,
 * section cards, stems, options, feedback for every item answered right, wrong and timed out, S5's recordings in every cell, the UI
 * words, the corpus's records and the pre-recorded questions), and every scenario text in both languages (the scenario's every string —
 * records, freeze items, SPAM prompts, decision items, radio lines, branch statements — and the English of records and labels).
 */

import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import authoredEn from "../../content/i18n/authored.en.json" with { type: "json" };
import overridesEn from "../../content/i18n/records.en.overrides.json" with { type: "json" };
import trainingEn from "../../content/training/records.en.json" with { type: "json" };
import { TRAINING_TEXT } from "../../app/i18n/training-texts.js";
import type { Lang } from "../../app/i18n/lang.js";
import { recordEn } from "../../app/i18n/text.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { TRAINING_ATOMS, TRAINING_QUESTIONS } from "../../app/session/training/corpus.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import type { Cell } from "../../app/scenario/types.js";
import { recordText } from "../../app/session/template-answer.js";

export const LANGS: readonly Lang[] = ["fi", "en"];
export const CELLS: readonly Cell[] = ["radio", "reasoning_intent", "reasoning_once"];

/** A training text with where it is shown, and whether the participant sees it before answering (the rules on directives). */
export interface TrainingString { readonly where: string; readonly lang: Lang; readonly text: string; readonly beforeAnswer: boolean }

export function trainingStrings(): TrainingString[] {
  const out: TrainingString[] = [];
  const add = (lang: Lang, where: string, text: string, beforeAnswer: boolean) => out.push({ lang, where, text, beforeAnswer });
  for (const lang of LANGS) {
    const t = TRAINING_TEXT[lang];
    add(lang, "intro.title", t.intro.title, true);
    t.intro.body.forEach((s, i) => add(lang, `intro.body.${i}`, s, true));
    add(lang, "intro.start", t.intro.start, true);
    for (const s of TRAINING.sections) {
      const c = t.section(s.id);
      add(lang, `section.${s.id}.title`, c.title, true);
      c.body.forEach((b, i) => add(lang, `section.${s.id}.body.${i}`, b, true));
      add(lang, `section.${s.id}.go`, c.go, true);
    }
    for (const it of TRAINING.items) {
      const x = t.item(it.id);
      add(lang, `${it.id}.stem`, x.stem, true);
      for (const [id, label] of Object.entries(x.options)) add(lang, `${it.id}.option.${id}`, label, true);
      const answers = it.answer === "point" ? [{ point: it.memory?.at ?? { lat: 0, lon: 0 } }, null] : [...it.options.map((o) => ({ choiceId: o.id })), null];
      for (const answer of answers) for (const timedOut of it.mode === "card" ? [false, true] : [false]) {
        const ctx = { answer: timedOut ? null : answer, key: it.key, errorM: answer && "point" in answer ? 42 : null, timedOut, source: it.source, numbers: it.feedback.numbers, ...(it.lesson ? { lesson: it.lesson } : {}) };
        t.feedback(it.id, ctx).forEach((s, i) => add(lang, `${it.id}.feedback.${i}`, s, false));
      }
    }
    for (const cell of CELLS) {
      const d = t.demo(cell);
      add(lang, `demo.${cell}.title`, d.title, false);
      add(lang, `demo.${cell}.intro`, d.intro, false);
      for (const e of d.examples) {
        add(lang, `demo.${cell}.${e.id}.question`, e.question, false);
        e.answer.forEach((a, i) => add(lang, `demo.${cell}.${e.id}.answer.${i}`, a, false));
        add(lang, `demo.${cell}.${e.id}.note`, e.note, false);
      }
    }
    add(lang, "demo.limitation", t.demoLines.limitation, false);
    add(lang, "demo.leave", t.demoLines.leave, false);
    for (const [k, v] of Object.entries(t.ui)) add(lang, `ui.${k}`, v, true);
    for (const [id, q] of Object.entries(TRAINING_QUESTIONS)) add(lang, `question.${id}`, q[lang], false);
  }
  for (const a of TRAINING_ATOMS) {
    add("fi", `record.${a.id}`, recordText(a.record), false);
    add("en", `record.${a.id}`, (trainingEn as Record<string, string>)[a.id]!, false);
  }
  return out;
}

function strings(v: unknown, out: string[]): void {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v !== null && typeof v === "object") for (const x of Object.values(v)) strings(x, out);
}

let cached: readonly string[] | null = null;
/** Every scenario text in both languages (cached: the scenario takes a while to build). */
export function scenarioStrings(): readonly string[] {
  if (cached) return cached;
  const out: string[] = [];
  const scenario = buildDemoScenario();
  strings({ ...scenario, seed: null }, out);
  for (const a of scenario.atoms) { out.push(recordText(a.record)); const en = recordEn(a.id); if (en) out.push(en); }
  strings([Object.keys(labelsEn), Object.values(labelsEn), Object.values(authoredEn), Object.values(overridesEn), Object.values(SITE_SCENARIO.english ?? {})], out);
  cached = out.filter((s) => /\s/.test(s));
  return cached;
}

/**
 * The plain phrases a training text may share with a scenario text (SPEC/08 (bp) §bp.8's allow-list; four-word runs, lower case,
 * punctuation dropped): the fire's head, sides and compass phrases, a rate in the session's unit, the measuring tool's name and
 * generic map words. None names a place, unit, source, road or subject of the scenario.
 */
export const OVERLAP_ALLOW: readonly string[] = [
  "head of the fire", "the head of the", "of the fire is", "the head is at", "the fire is not", "the fire s edge", "on the fire s",
  "north of the road", "south of the road", "both sides of the", "m north of the", "m north east of",
  "noin 10 m min", "about 10 m min", "noin 4 m min", "about 4 m min",
  "the r b tool", "the junction of roads", "the shortest distance from", "the road the water", "on the map the",
];

/** Words as the overlap rule reads them: lower case, letters and digits. */
export const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w !== "");
export function grams(s: string, n = 4): string[] {
  const w = words(s);
  return Array.from({ length: Math.max(0, w.length - n + 1) }, (_, i) => w.slice(i, i + n).join(" "));
}
