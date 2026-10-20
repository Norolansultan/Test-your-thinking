/**
 * The expert-panel packet (`tools/review/panel-packet.ts`, `npm run review:panel`; SPEC/31 §6 item 2). The panel rates the plans of
 * V9–V14 blind and the keys are derived from its ratings, so: every file is written; the bytes are the same on a second run; no file
 * carries a key (a directive key's basis or fields, a premise status, the keyed draft `coa_option_key.csv`, a cell letter); and each
 * view's record set holds the records the view's keys rest on, without marking them.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import premiseEvidence from "../../content/thinker/premise-evidence.json" with { type: "json" };
import directivePremises from "../../content/thinker/directive-premises.json" with { type: "json" };
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { buildDemoScenario, DIRECTIVE_FI } from "../../app/scenario/demo-scenario.js";
import { SECONDARY_TASK_DEFINITIONS_FI } from "../../app/scenario/briefing.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import { PANEL_VIEWS, parseCsv, PREMISE_VIEWS, QUESTION_COLS, RATERS, RATING_COLS, RECORD_COLS, SHEET_COLS, writePanelPacket } from "../../tools/review/panel-packet.js";

const dirA = mkdtempSync(join(tmpdir(), "panel-packet-a-"));
const dirB = mkdtempSync(join(tmpdir(), "panel-packet-b-"));
const first = writePanelPacket(dirA);
const second = writePanelPacket(dirB);
afterAll(() => {
  rmSync(dirA, { recursive: true, force: true });
  rmSync(dirB, { recursive: true, force: true });
});

const files = new Map(first.files.map((f) => [f, readFileSync(join(dirA, f), "utf8")]));
const containing = (s: string) => [...files].filter(([, text]) => text.includes(s)).map(([name]) => name);
const csvOf = (name: string) => {
  const [header = [], ...rows] = parseCsv(files.get(name)!);
  return { header, rows, col: (c: string) => rows.map((r) => r[header.indexOf(c)] ?? "") };
};
const scenario = buildDemoScenario();
const viewCsvs = PANEL_VIEWS.map((v) => `V${v}.csv`);

const KEY_DIR = "docs/audits/2026-10-19-skills";
const [keyHeader = [], ...keyRows] = parseCsv(readFileSync(`${KEY_DIR}/coa_option_key.csv`, "utf8"));
const [draftHeader = [], ...draftRows] = parseCsv(readFileSync(`${KEY_DIR}/coa_rating_sheet.csv`, "utf8"));
/** The keyed draft's columns that identify or state a plan (its text is on the blind sheet); every other column carries the key. */
const PLAN_ONLY = new Set(["decision_point_id", "cycle", "option_code", "display_order", "plan_fi", "plan_en"]);
const KEY_COLUMNS = keyHeader.filter((c) => !PLAN_ONLY.has(c));

describe("panel packet: the files", () => {
  it("writes README, a markdown and a CSV record set per view V8–V14 (V8 for its premises), the rating sheet and the questions, and nothing else", () => {
    const expected = ["README.md", ...PREMISE_VIEWS.flatMap((v) => [`V${v}.md`, `V${v}.csv`]), "rating_sheet.csv", "questions.csv"];
    expect([...first.files].sort()).toEqual([...expected].sort());
    expect(readdirSync(dirA).sort()).toEqual([...expected].sort());
    for (const name of expected) expect(files.get(name)!.length).toBeGreaterThan(500);
  });

  it("is deterministic: a second run writes the same bytes", () => {
    expect(second.files).toEqual(first.files);
    for (const name of first.files) expect(readFileSync(join(dirB, name)).equals(readFileSync(join(dirA, name))), name).toBe(true);
  });

  it("each view's records are every corpus record up to its last step, NEW exactly for its own steps, PUSHED or RECORDED", () => {
    for (const v of PANEL_VIEWS) {
      const view = MAIN_VIEWS.find((x) => x.index === v)!, last = view.steps[view.steps.length - 1]!;
      const { header, rows, col } = csvOf(`V${v}.csv`);
      expect(header).toEqual([...RECORD_COLS, "review"]);
      const expectedIds = scenario.atoms.filter((a) => a.cycle <= last).map((a) => a.id).sort();
      expect([...col("id")].sort()).toEqual(expectedIds);
      expect(rows.length).toBe(first.recordsPerView.get(v));
      const ownSteps = new Set(view.steps.map(String));
      rows.forEach((r) => expect(r[header.indexOf("new_in_view")]).toBe(ownSteps.has(r[0]!) ? "NEW" : ""));
      expect(new Set(col("delivery"))).toEqual(new Set(["PUSHED", "RECORDED"]));
      expect(col("clock").every((c) => /^\d{2}\.\d{2}$/.test(c))).toBe(true);
      expect(files.get(`V${v}.md`)!.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| clock")).length).toBe(rows.length);
    }
  });

  it("the rating sheet is the draft's 34 plans, one row per (view, plan), with an empty rating block per panellist", () => {
    const { header, rows, col } = csvOf("rating_sheet.csv");
    expect(header).toEqual(SHEET_COLS);
    expect(header.length).toBe(3 + RATERS * RATING_COLS.length);
    expect(rows.length).toBe(draftRows.length);
    expect(new Set(rows.map((r) => `${r[0]} ${r[1]}`)).size).toBe(rows.length);
    expect(rows.every((r) => r.slice(3).every((c) => c === ""))).toBe(true);
    expect(rows.every((r) => r.length === header.length)).toBe(true);
    expect([...new Set(col("view"))]).toEqual(PANEL_VIEWS.map((v) => `V${v}`));
    // The plan texts are the draft's, but for the documented edits (stale flames, a burnout clause).
    const draftText = new Map(draftRows.map((r) => [`V${Number(r[draftHeader.indexOf("cycle")])} ${r[draftHeader.indexOf("option_code")]}`, r[draftHeader.indexOf("option_text")]]));
    const changed = rows.filter((r) => draftText.get(`${r[0]} ${r[1]}`) !== r[2]).map((r) => `${r[0]} ${r[1]}`);
    expect(changed).toEqual(["V11 S", "V11 Z", "V14 X"]);
    expect(first.edited).toBe(3);
    expect(first.dropped).toEqual([]);
  });

  it("the README carries the instructions, the directive, the plan form and the premise texts; the questions sheet starts empty", () => {
    const readme = files.get("README.md")!;
    for (const s of ["20–40", "CO exposure is unknown", "Burnouts", "at least 4 of the 5", "Rate each plan on its own", "edge (spreading, or stopped)", "Ohjeet paneelille", DIRECTIVE_FI, ...SECONDARY_TASK_DEFINITIONS_FI, ...directivePremises.premises.map((p) => p.fi), "perimeters_scripted.geojson"]) {
      expect(readme, s).toContain(s);
    }
    const { header, rows } = csvOf("questions.csv");
    expect(header).toEqual(QUESTION_COLS);
    expect(rows.every((r) => r.slice(5).every((c) => c === ""))).toBe(true);
    for (const id of ["coa.F1a", "coa.F1b", "coa.F2", "coa.F5", "coa.F6", "premise.P1.wording", "FT-T3.head", "FT-T3.water", "FT-T7", "FT-T16.KY21", "FT-T18.EK16"]) expect(rows.some((r) => r[0] === id), id).toBe(true);
    for (const p of directivePremises.premises) for (const v of PREMISE_VIEWS) expect(rows.some((r) => r[0] === `premise.${p.id}.V${v}`)).toBe(true);
  });
});

describe("panel packet: no key leaks", () => {
  it("no file holds a directive key's basis text, its key fields or the burnout ruling", () => {
    for (const k of Object.values(DIRECTIVE_KEYS)) {
      if (!k) continue;
      expect(containing(k.basis)).toEqual([]);
      // Nor any clause of it (the bases are built from record figures, so a copied clause would be a paraphrased key).
      for (const clause of k.basis.split(/[;:—()]/).map((s) => s.trim()).filter((s) => s.length >= 30)) expect(containing(clause), clause).toEqual([]);
    }
    for (const s of ["soundSectors", "soundSecondary", "soundVia", "cellByAct", "boundarySectors", "againstSecondaryTaskId", "basisAtomIds", "keyAtomIds", "BURNOUT_IN_LINE", "in line with the directive (a barrier-line technique)"]) {
      expect(containing(s), s).toEqual([]);
    }
  });

  it("no file holds the cell codes or the coding's vocabulary", () => {
    for (const s of ["C/D", "A/B", "A/B/C/D", "codes C", "codes D", "justified deviation", "blind compliance", "no-fit", "sound only through", "fit=", "aligned="]) expect(containing(s), s).toEqual([]);
  });

  it("no file holds a key column of coa_option_key.csv, a value from one, or a draft id", () => {
    expect(KEY_COLUMNS).toEqual(expect.arrayContaining(["wisdom_label", "strategy_label", "build_cell", "build_sound_via", "draft_cell", "why_wise_or_unwise"]));
    for (const c of KEY_COLUMNS) expect(containing(c), c).toEqual([]);
    for (const r of keyRows) for (const c of KEY_COLUMNS) {
      const value = r[keyHeader.indexOf(c)] ?? "";
      if (value.length >= 12) expect(containing(value), `${c}: ${value.slice(0, 40)}`).toEqual([]);
    }
    for (const [name, text] of files) expect(text.match(/\bV\d{1,2}-[a-f]\b/g), name).toBeNull();
  });

  it("no CSV column holds cell letters, and no header names a cell, a label, soundness or a key", () => {
    for (const name of [...viewCsvs, "rating_sheet.csv", "questions.csv"]) {
      const { header, col } = csvOf(name);
      for (const c of header) {
        expect(c, `${name}: ${c}`).not.toMatch(/cell|label|sound|key|fit|strategy/i);
        const values = col(c).filter((x) => x !== "");
        if (values.length > 0) expect(values.every((x) => /^[A-D]\??$/.test(x)), `${name}: ${c}`).toBe(false);
      }
    }
    expect(csvOf("rating_sheet.csv").col("option_code").some((x) => /^[A-D]$/.test(x))).toBe(false);
  });

  it("no file states a premise status or the draft table's notes", () => {
    expect(containing("not_contradicted")).toEqual([]);
    const views = premiseEvidence.views as Record<string, Record<string, { note: string }>>;
    for (const view of Object.values(views)) for (const p of Object.values(view)) expect(containing(p.note), p.note.slice(0, 40)).toEqual([]);
  });
});

describe("panel packet: the panel sees what each key rests on", () => {
  it("every V9–V14 record set holds its directive key's basis records and its freeze items' key records, unmarked", () => {
    for (const v of PANEL_VIEWS) {
      const { header, rows, col } = csvOf(`V${v}.csv`);
      const ids = new Set(col("id"));
      const basis = DIRECTIVE_KEYS[v]!.basisAtomIds;
      expect(basis.length).toBeGreaterThan(0);
      for (const id of basis) expect(ids.has(id), `V${v} ${id}`).toBe(true);
      for (const f of scenario.freezes.filter((x) => x.cycle === v)) for (const it of f.items) for (const id of it.keyAtomIds ?? []) expect(ids.has(id), `V${v} ${it.id} ${id}`).toBe(true);
      // A basis record's row has the same shape as any other: no extra column, no mark beyond NEW.
      for (const r of rows.filter((x) => basis.includes(x[header.indexOf("id")]!))) {
        expect(r.length).toBe(header.length);
        expect(["NEW", ""]).toContain(r[header.indexOf("new_in_view")]);
        expect(r[header.indexOf("review")]).toBe("");
      }
    }
  });
});
