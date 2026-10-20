/**
 * `npm run review:panel` — the expert-panel packet (SPEC/31 §6 item 2; coa F1, F2, F5, F6; §3.1–§3.4, §3.11, revision (az)).
 * Writes, to the gitignored folder `review-packet/panel/` (or the folder given as the first argument):
 *
 *   README.md            who it is for, the rating task and its instructions (English, with the Finnish block), the 1–7 scale and
 *                        the 4-of-5 rule, the directive, the plan form (postures, secondary tasks with the tour's one-line
 *                        definitions, sectors), the views' windows, the map source, and the open questions;
 *   V9.md … V14.md,      every record available by the view's end, from the start of the incident: the review export's corpus rows
 *   V9.csv … V14.csv     (`collectCorpus`, `export.ts`) with the clock each was observed at; grouped by step, newest step first,
 *                        each step in clock order, then by id; the records of the view's own steps are marked NEW;
 *   rating_sheet.csv     the blind sheet: the DRAFT `docs/audits/2026-10-19-skills/coa_rating_sheet.csv`, one row per (view, plan),
 *                        an empty block of rating columns per panellist (rater1 … rater5);
 *   questions.csv        the open questions of the README, one row each, an answer column per panellist.
 *
 * BLIND. The keys are derived from the panel's ratings, so nothing here may carry one: no directive key or its basis, no premise
 * status, nothing of `coa_option_key.csv`, no cell letter. The draft sheet's columns are checked; any column that is neither the
 * plan nor an empty rating column is dropped (and logged). `test/tools/panel-packet.spec.ts` checks the leakage, the bytes, and that
 * every view's record set holds the records its keys rest on — which the packet does not mark. Deterministic: no clock, no
 * randomness; the same build writes the same bytes.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import premiseFile from "../../content/thinker/directive-premises.json" with { type: "json" };
import { UI_TEXT } from "../../app/i18n/ui.js";
import { tr } from "../../app/i18n/text.js";
import { SECONDARY_TASK_DEFINITIONS_EN, SECONDARY_TASK_DEFINITIONS_FI, SECTORS_EN, SECTORS_FI } from "../../app/scenario/briefing.js";
import { buildDemoScenario, DIRECTIVE_FI, PHASE_A_INTENT_FI } from "../../app/scenario/demo-scenario.js";
import { MAIN_EFFORT_POSTURES, PLAN_DRONE_TASK_IDS } from "../../app/scenario/plan-types.js";
import { MAIN_VIEWS, PRACTICE_STEP, STEP_SECONDS, stepId, stepNumber, stepStartVirtual, viewEndVirtual, viewStartVirtual, type SessionView } from "../../app/scenario/views.js";
import { clockAt } from "../../app/session/template-answer.js";
import { collectCorpus, toCsv, type CorpusRow } from "./export.js";

export const PANEL_DIR = join("review-packet", "panel");
export const PANEL_VIEWS: readonly number[] = [9, 10, 11, 12, 13, 14];
/** The views whose premise statuses the panel sets: V8 too (the directive is in force from V8; it has no plans to rate). */
export const PREMISE_VIEWS: readonly number[] = [8, ...PANEL_VIEWS];
export const RATERS = 5;
const DRAFT_SHEET = fileURLToPath(new URL("../../docs/audits/2026-10-19-skills/coa_rating_sheet.csv", import.meta.url));
/** The draft sheet's columns that identify a plan, and one panellist's rating block (the draft's `rater_id` becomes the block's prefix). */
const PLAN_COLS = ["decision_point_id", "cycle", "option_code", "option_text"] as const;
export const RATING_COLS = ["wisdom_rating_1to7", "feasible_yes_no", "main_reason", "confidence_1to5", "comment"] as const;
const raters = Array.from({ length: RATERS }, (_, i) => `rater${i + 1}`);
export const SHEET_COLS: readonly string[] = ["view", "option_code", "option_text", ...raters.flatMap((r) => RATING_COLS.map((c) => `${r}_${c}`))];
export const QUESTION_COLS: readonly string[] = ["id", "view", "question_fi", "question_en", "answer_format", ...raters.map((r) => `${r}_answer`)];
export const RECORD_COLS = ["step", "clock", "view", "new_in_view", "delivery", "source", "id", "fi", "en"] as const;

/**
 * DRAFT edits to the drafted plans (19 Oct 2026, for the researcher and the native speaker to confirm). The drafts predate the
 * provisional flame-length table (`31` §3.11), so two reason clauses state flames the records now contradict (V11's flanks read 2–3 m,
 * V14's flare-up 1–2 m); and a burnout is not a plan option and is not rated (coa F14), so no plan may carry one. Each edit must
 * match its plan exactly once, so a revised draft fails loudly instead of passing unedited.
 */
const PLAN_EDITS: readonly { readonly view: string; readonly code: string; readonly from: string; readonly to: string }[] = [
  { view: "V11", code: "S", from: "palaneelta reunalta nyt, kun liekit ovat alle metrin.", to: "palaneelta reunalta nyt." },
  { view: "V11", code: "Z", from: "Taustapoltto hylätään, perääntymistie", to: "Perääntymistie" },
  { view: "V14", code: "X", from: "koska se on vielä pieni ja liekit matalia.", to: "koska se on vielä pieni." },
];

const scenario = buildDemoScenario();
const OBSERVED = new Map<string, number>(scenario.atoms.map((a) => [a.id, a.provenance.observedAt]));
const CORPUS: readonly CorpusRow[] = collectCorpus();
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const enOf = (fi: string) => (tr("en", fi) === fi ? "" : tr("en", fi));

function viewOf(index: number): SessionView {
  const v = MAIN_VIEWS.find((x) => x.index === index);
  if (!v) throw new Error(`panel packet: there is no view ${index}`);
  return v;
}
const stepWindow = (step: number) => `${clockAt(stepStartVirtual(step))}–${clockAt(stepStartVirtual(step) + STEP_SECONDS)}`;
export const windowOf = (index: number) => `${clockAt(viewStartVirtual(viewOf(index)))}–${clockAt(viewEndVirtual(viewOf(index)))}`;

// ---------------------------------------------------------------------------------------------------
// The record sets
// ---------------------------------------------------------------------------------------------------

export type PanelRecord = { readonly [K in (typeof RECORD_COLS)[number]]: string };

/** Every corpus record available by the end of view `index` (its last step and every step before), in the packet's order. */
export function recordSet(index: number, corpus: readonly CorpusRow[] = CORPUS): PanelRecord[] {
  const v = viewOf(index), last = v.steps[v.steps.length - 1]!;
  const at = (id: string) => {
    const t = OBSERVED.get(id);
    if (t === undefined) throw new Error(`panel packet: record ${id} is not in the scenario`);
    return t;
  };
  return corpus.filter((r) => r.step <= last)
    .sort((a, b) => b.step - a.step || at(a.id) - at(b.id) || byId(a.id, b.id))
    .map((r) => ({ step: stepId(r.step), clock: clockAt(at(r.id)), view: r.view, new_in_view: v.steps.includes(r.step) ? "NEW" : "",
      delivery: r.delivery.toUpperCase(), source: r.source, id: r.id, fi: r.fi, en: r.en }));
}

const ORDER_NOTE = "Order: grouped by step, newest step first; within a step in clock order (the time the record was observed), then by record id. PUSHED: delivered to the message log as it came in. RECORDED: in the records, found by search (Haku) or the AI tool.";
const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

function viewMarkdown(index: number, rows: readonly PanelRecord[]): string {
  const v = viewOf(index);
  const pushed = rows.filter((r) => r.delivery === "PUSHED").length, fresh = rows.filter((r) => r.new_in_view !== "").length;
  const out = [`# ${v.id} — ${windowOf(index)} (step${v.steps.length > 1 ? "s" : ""} ${v.steps.join(" and ")})`, "",
    `Every record available by ${clockAt(viewEndVirtual(v))}, from the start of the incident: ${rows.length} records (${pushed} PUSHED, ${rows.length - pushed} RECORDED), ${fresh} of them new in ${v.id} (marked NEW). The same rows are in ${v.id}.csv.`, "", ORDER_NOTE];
  let step = "";
  for (const r of rows) {
    if (r.step !== step) {
      step = r.step;
      out.push("", `## Step ${r.step} · ${stepWindow(stepNumber(r.step))} · ${r.view === "VP" ? "VP (practice view; incident history afterwards)" : r.view}${r.new_in_view ? ` — NEW in ${v.id}` : ""}`, "",
        "| clock | source | delivery | new | id | Finnish | English |", "|---|---|---|---|---|---|---|");
    }
    out.push(`| ${r.clock} | ${mdCell(r.source)} | ${r.delivery} | ${r.new_in_view} | ${r.id} | ${mdCell(r.fi)} | ${mdCell(r.en)} |`);
  }
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------------------------------
// The rating sheet
// ---------------------------------------------------------------------------------------------------

/** RFC 4180 rows of a CSV text (a leading BOM dropped; quoted fields may hold commas, quotes and line breaks). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, ""), rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

const csvCell = (v: string) => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** UTF-8 with a BOM, CRLF, as the review export writes its CSV (without its `review` column). */
const csvText = (header: readonly string[], rows: readonly (readonly string[])[]) => "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export interface RatingSheet { readonly rows: readonly (readonly string[])[]; readonly dropped: readonly string[]; readonly edited: number }

/** The blind sheet from the draft: plan columns kept, every other column dropped, the rating block repeated per panellist (empty). */
export function ratingSheet(text = readFileSync(DRAFT_SHEET, "utf8")): RatingSheet {
  const [header = [], ...body] = parseCsv(text);
  for (const c of PLAN_COLS) if (!header.includes(c)) throw new Error(`panel packet: the draft rating sheet has no ${c} column`);
  const known = new Set<string>(["rater_id", ...PLAN_COLS, ...RATING_COLS]);
  const dropped = header.filter((c) => !known.has(c));
  const at = (r: readonly string[], c: string) => (header.includes(c) ? r[header.indexOf(c)] ?? "" : "");
  const used = new Set<number>(), seen = new Set<string>();
  const rows = body.map((r) => {
    const view = `V${Number(at(r, "cycle"))}`, code = at(r, "option_code");
    if (!PANEL_VIEWS.some((v) => `V${v}` === view) || at(r, "decision_point_id").replace(/^V0*/, "V") !== view) throw new Error(`panel packet: draft row ${at(r, "decision_point_id")}/${at(r, "cycle")} is not a view V9–V14`);
    if (/^[A-D]\??$/.test(code)) throw new Error(`panel packet: option code ${view} ${code} could be read as a cell letter`);
    if (seen.has(`${view} ${code}`)) throw new Error(`panel packet: ${view} ${code} appears twice in the draft`);
    seen.add(`${view} ${code}`);
    for (const c of ["rater_id", ...RATING_COLS]) if (at(r, c) !== "") throw new Error(`panel packet: the draft's ${c} is filled in for ${view} ${code}; the sheet must start empty`);
    let plan = at(r, "option_text");
    PLAN_EDITS.forEach((e, k) => {
      if (e.view !== view || e.code !== code) return;
      if (plan.split(e.from).length !== 2) throw new Error(`panel packet: edit ${k} does not match ${view} ${code} exactly once`);
      plan = plan.replace(e.from, e.to);
      used.add(k);
    });
    return [view, code, plan, ...Array.from({ length: RATERS * RATING_COLS.length }, () => "")];
  });
  if (used.size !== PLAN_EDITS.length) throw new Error("panel packet: a plan edit matched no draft plan");
  return { rows, dropped, edited: used.size };
}

// ---------------------------------------------------------------------------------------------------
// The open questions (SPEC/31 §6 item 2, revision (az)); neutral: no researcher reading, no status, no key
// ---------------------------------------------------------------------------------------------------

export interface Question { readonly id: string; readonly view: string; readonly fi: string; readonly en: string; readonly answer: string }

const BY_RATING_FI = "Vastaat arvioimalla jakson suunnitelmat; tähän voit perustella.";
const BY_RATING_EN = "You answer by rating the view's plans; give your reasons here if you wish.";
const YND = "yes / no / depends (on what)";

export function questions(): Question[] {
  const premises = premiseFile.premises;
  const p1 = premises.find((p) => p.id === "P1");
  if (!p1) throw new Error("panel packet: no premise P1");
  return [
    { id: "coa.F1a", view: "V9–V14", answer: YND,
      fi: "Kun suunnitelma lähettää miehistön linjauksen jälkeen uudelleen syttyneelle tai leimahtaneelle reunalle tehtävänä \"Jälkisammutus ja varmistus\" tai \"Linjan pito tiellä tai vesistöllä\" (ei \"Suora hyökkäys palon reunaan\") ja miehistö työskentelee reunalla palaneelta alueelta käsin: onko työ suomalaisessa käytössä suoraa hyökkäystä palon reunaan?",
      en: "When a plan sends a crew to an edge that has rekindled or flared up since the directive, with the task \"Mop-up and securing\" or \"Holding the line on a road or water\" (not \"Direct attack on the fire's edge\"), and the crew works the edge from the burned area: is that work, in Finnish usage, a direct attack on the fire's edge?" },
    { id: "coa.F1b", view: "V9–V14", answer: YND,
      fi: "Pysyykö sama työ linjauksen \"ei suoraa hyökkäystä palon reunaan\" sisällä? (Sen järkevyyden arvioit arviointilomakkeella.)",
      en: "Does the same work stay within the directive's \"no direct attack on the fire's edge\"? (Its soundness you give on the rating sheet.)" },
    { id: "coa.F2", view: "V14", answer: "remarks (optional)",
      fi: `Jakso V14 (${windowOf(14)}): onko järkevää, että painopiste on seuraavat 20–40 minuuttia syttymäkohdan länsipuolen uudessa palossa? Entä että painopiste on kaakkoisrintamalla ja Lahdenkylässä ja toissijainen lohko on länsipuolen uusi palo? ${BY_RATING_FI}`,
      en: `View V14 (${windowOf(14)}): is it sound to put the main effort for the next 20–40 minutes on the new fire west of the point of origin? And to keep the main effort on the south-east front and Lahdenkylä, with the new fire in the west as the secondary sector? ${BY_RATING_EN}` },
    { id: "coa.F5", view: "V11", answer: "remarks (optional)",
      fi: `Jakso V11 (${windowOf(11)}): onko seuraavien 20–40 minuutin aikana järkevää sammuttaa kaakkoisrintaman sivustoja suoraan palaneelta alueelta käsin? Entä pitää linjaa tiellä rintaman edessä? ${BY_RATING_FI}`,
      en: `View V11 (${windowOf(11)}): over the next 20–40 minutes, is a direct attack on the south-east front's flanks from the burned area sound? And a line on a road ahead of the front? ${BY_RATING_EN}` },
    { id: "coa.F6", view: "V13–V14", answer: "remarks (optional)",
      fi: "Vanhan reunan leimahduksia on kirjauksissa useammassa jaksossa (esim. V13 pohjoisreuna, V14 syttymäkohdan länsipuoli). Onko suora sammutus toissijaisena tehtävänä yhtä järkevää kussakin? Arvioi kunkin kohdalla kirjauksista reunan tila (leviääkö se) ja onko miehistö paikalla tai lähellä. " + BY_RATING_FI,
      en: "Flare-ups of old edges are on record in more than one view (e.g. V13 the north edge, V14 west of the point of origin). Is a direct attack on one, as the secondary task, equally sound in each? Judge each from the records: the edge's state (spreading or not) and whether a crew is on or near it. " + BY_RATING_EN },
    ...premises.flatMap((p) => PREMISE_VIEWS.map((v): Question => ({ id: `premise.${p.id}.V${v}`, view: `V${v}`, answer: "contradicted / not contradicted / cannot tell",
      fi: `${p.id}: "${p.fi}" — Jakso V${v} (${windowOf(v)}): ovatko jakson loppuun mennessä saatavilla olevat kirjaukset ristiriidassa premissin kanssa?`,
      en: `${p.id}: "${p.en}" — View V${v} (${windowOf(v)}): do the records available by the view's end contradict the premise?` }))),
    { id: "premise.P1.wording", view: "—", answer: "right as it is / your wording (Finnish)",
      fi: `Premissin P1 sanamuoto: "${p1.fi}" Onko se oikea? Jos ei, ehdota parempaa.`, en: `P1's wording: "${p1.en}" Is it right? If not, propose a better one (in Finnish).` },
    { id: "FT-T3.head", view: "V2 (phase A)", answer: "yes / no / cannot tell, and why",
      fi: `Vaihe A, klo ${stepWindow(3)} (askel 3): onko kärki kirjausten perusteella jo liian voimakas kärjen sivuilla letkulinjoilla työskenteleville miehistöille?`,
      en: `Phase A, ${stepWindow(3)} (step 3): from the records, is the head already too intense for hose crews working its flanks?` },
    { id: "FT-T3.water", view: "V1–V7 (phase A)", answer: "yes / no / cannot tell, and why",
      fi: `Vaihe A (klo ${clockAt(viewStartVirtual(viewOf(1)))}–${clockAt(viewEndVirtual(viewOf(7)))}): riittääkö vesihuolto työlinjoille kirjattujen letkulinjojen pituuksien, paineiden ja säiliöiden täyttöasteiden perusteella (MPV25:n hydrauliikka)?`,
      en: `Phase A (${clockAt(viewStartVirtual(viewOf(1)))}–${clockAt(viewEndVirtual(viewOf(7)))}): given the hose-line lengths, pressures and tank levels on record, does the water supply reach the work lines (MPV25 hydraulics)?` },
    { id: "FT-T7", view: "V5 (phase A)", answer: "free answer",
      fi: `Vaihe A, klo ${stepWindow(7)} (askel 7): mihin olisit kirjattu leviäminen ja pistepalot huomioiden sijoittanut miehistöt kärkeen ja pistepaloihin nähden?`,
      en: `Phase A, ${stepWindow(7)} (step 7): given the spread and the spot fires on record, where would you have placed the crews relative to the head and the spot fires?` },
    { id: "FT-T16.KY21", view: "V12", answer: "no / yes: when, on which record",
      fi: `KY21 metsäautotiellä (Honkaharju) klo ${stepWindow(17)}: olisitko kirjausten perusteella vetänyt miehistön pois aiemmin? Jos olisit, milloin ja minkä kirjauksen perusteella?`,
      en: `KY21 on the forest road (Honkaharju) at ${stepWindow(17)}: from the records, would you have pulled the crew back earlier? If so, when, and on which record?` },
    { id: "FT-T18.EK16", view: "V13", answer: "no / yes: when, on which record",
      fi: `EK16 metsäautotiellä (Honkaharju) klo ${stepWindow(18)}: olisitko kirjausten perusteella vetänyt miehistön pois aiemmin? Jos olisit, milloin ja minkä kirjauksen perusteella?`,
      en: `EK16 on the forest road (Honkaharju) at ${stepWindow(18)}: from the records, would you have pulled the crew back earlier? If so, when, and on which record?` },
    { id: "fire.phaseA.flames", view: "V1–V7 (phase A)", answer: "credible / not credible: which records",
      fi: "Vaiheen A liekinpituudet: ovatko kirjatut liekinpituudet uskottavia kirjattuihin leviämisnopeuksiin nähden?",
      en: "Phase A flame lengths: are the flame lengths on record credible for the spread rates on record?" },
    { id: "fire.phaseA.runs", view: "V4 (phase A)", answer: "credible / not credible, and why",
      fi: `Kirjausten kuvaama latvapalo klo ${stepWindow(5)} ja nopea leviäminen kaukolentoineen klo ${stepWindow(6)}: ovatko ne uskottavia suomalaisissa oloissa (vrt. Kalajoki 2021)?`,
      en: `The crown run on record at ${stepWindow(5)} and the fast spread with long-range spotting at ${stepWindow(6)}: are they credible in Finnish conditions (cf. Kalajoki 2021)?` },
  ];
}

// ---------------------------------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------------------------------

function readme(counts: ReadonlyMap<number, { total: number; pushed: number; fresh: number }>, sheetRows: number, qs: readonly Question[]): string {
  const ui = UI_TEXT;
  const views = PREMISE_VIEWS.map((v) => { const c = counts.get(v)!; return `| V${v}${PANEL_VIEWS.includes(v) ? "" : " (premises only, no plans)"} | ${windowOf(v)} | ${viewOf(v).steps.join(", ")} | ${c.total} (${c.pushed} PUSHED) | ${c.fresh} | V${v}.md, V${v}.csv |`; });
  const premises = premiseFile.premises.map((p) => `- **${p.id}** — ${p.fi}<br>*${p.en}*`);
  return [
    "# Expert panel packet: the decisions of views V9–V14 (DRAFT)", "",
    "Generated by `npm run review:panel` (`tools/review/panel-packet.ts`). The same build writes the same files.", "",
    "## Who it is for", "",
    "The five Finnish wildfire experts (experienced incident commanders) of the study's expert panel. The study is a recorded wildfire incident-command simulation: the participant commands the crews and drone teams from 13.20 to 20.00 in views of 20–40 minutes and, in each view, records a plan. You rate, each on your own and blind, the plans drafted for six decision moments of the evening, views V9–V14. **The study's answer keys are derived from your ratings**, so this packet holds no answers of the researchers. Please do not discuss your ratings with the other panellists before you have returned your sheet.", "",
    "## Files", "",
    `- \`README.md\` — this file: the task, the instructions (Finnish first, English below), the directive, the plan form and the open questions.`,
    `- \`V9.md\` … \`V14.md\` (and the same rows in \`V9.csv\` … \`V14.csv\`) — every record available by the view's end, from the start of the incident. ${ORDER_NOTE} The CSVs have an empty \`review\` column for remarks on a record.`,
    `- \`rating_sheet.csv\` — ${sheetRows} plans, one row per (view, plan), with an empty block of rating columns for each panellist (\`rater1_…\` to \`rater${RATERS}_…\`). Fill in your own block only.`,
    `- \`questions.csv\` — the ${qs.length} open questions below, one row each, with an answer column per panellist.`,
    "", "| View | Window | Steps | Records by the view's end | New in the view | File |", "|---|---|---|---|---|---|", ...views, "",
    `The records of phase A (${clockAt(viewStartVirtual(viewOf(1)))}–${clockAt(viewEndVirtual(viewOf(7)))}, and the ${stepWindow(PRACTICE_STEP)} practice step before it) are in every view's file, as the incident's history.`, "",
    "## Ohjeet paneelille (suomeksi; DRAFT, kielentarkistus kesken)", "",
    "**Tehtävä.** Lue kunkin jakson aineisto (V9.md … V14.md): kaikki kirjaukset, jotka johtajan oli mahdollista lukea jakson loppuun mennessä tilanteen alusta lähtien. PUSHED = tuli viestilokiin itsestään; RECORDED = oli kirjauksissa ja löytyi haulla. Jakson uudet kirjaukset on merkitty NEW. Lue myös alla oleva johdon linjaus. Arvioi sitten jakson suunnitelmat tiedostossa rating_sheet.csv omissa sarakkeissasi.", "",
    "1. **Aikajänne:** arvioi jokainen suunnitelma seuraavan 20–40 minuutin suunnitelmana jakson lopusta lukien.",
    "2. **Leimahdukset ja uudelleensyttymät:** arvioi kirjauksista reunan tila (leviääkö se vai onko leviäminen pysähtynyt) ja onko miehistö paikalla tai lähellä.",
    "3. **Häkä:** skenaariossa ei ole häkämittauksia. Häkäaltistus on tuntematon; älä anna sen ratkaista arviotasi.",
    "4. **Taustapoltto** ei ole suunnitelmavaihtoehto, eikä sitä arvioida. Kirjausten taustapolttoesitykset ovat taustatietoa.",
    "5. **Arvioi jokainen suunnitelma erikseen** kirjauksia vasten, ei jakson muihin suunnitelmiin verraten. Jakson suunnitelmista useampi voi olla järkevä, tai ei yksikään.",
    "6. **Liekinpituudet:** vaiheen B (klo 16.40 alkaen) kirjausten liekinpituudet noudattavat alustavaa liekinpituustaulukkoa (Byramin yhtälö, Kalajoen 2021 havainnot), kunnes Ilmatieteen laitoksen arvot saadaan. Arvioi kirjausten mukaan; kerro kommentissa, jos jokin arvo ei ole uskottava.",
    "7. **Arvioi itsenäisesti** jakson kirjausten ja oman ammattitaitosi perusteella.", "",
    "**Asteikko (wisdom_rating_1to7).** Suunnitelma on järkevä, kun osaava suomalainen pelastustoiminnan johtaja pitäisi sitä jakson lopussa kirjausten perusteella hyvänä tapana käyttää miehistöjä seuraavat 20–40 minuuttia: vaarassa olevien ihmisten, miehistöjen turvallisuuden ja palon käyttäytymisen kannalta. Arvioi järkevyyttä tilanteeseen nähden, älä linjauksen noudattamista: linjausta noudattava suunnitelma voi olla epäjärkevä ja siitä poikkeava järkevä. 1 = selvästi epäjärkevä, 4 = en osaa sanoa, 7 = selvästi järkevä; 1–3 luetaan epäjärkeväksi, 5–7 järkeväksi, 4 ei kumpaankaan.",
    "Muut sarakkeet: **feasible_yes_no** (toteutettavissa kirjatuilla miehistöillä, vedellä, letkulla ja ajassa: kyllä/ei), **main_reason** (pääperuste yhdellä rivillä), **confidence_1to5** (1 = hyvin epävarma … 5 = hyvin varma), **comment** (muuta).", "",
    "**Avain.** Suunnitelma saa avaimen (järkevä tai epäjärkevä), kun vähintään neljä viidestä panelistista arvioi sen samalle puolelle (5–7 tai 1–3). Tutkimuksen avaimet johdetaan näistä arvioista.", "",
    "## Instructions (English)", "",
    "**The task.** Read each view's records (V9.md … V14.md): everything the commander could read by the view's end, from the start of the incident. PUSHED records came into the message log as they arrived; RECORDED ones were in the records and could be found by search. Records new in the view are marked NEW. Read the directive below too. Then rate the view's plans in `rating_sheet.csv`, in your own columns.", "",
    "1. **Horizon:** judge every plan as the plan for the next 20–40 minutes from the view's end.",
    "2. **Flare-ups and rekindles:** judge from the records the state of the edge (spreading, or stopped) and whether a crew is on or near it.",
    "3. **CO:** the scenario has no carbon-monoxide readings. CO exposure is unknown; do not let it decide your rating.",
    "4. **Burnouts** (taustapoltto) are not a plan option and are not rated. Burnout requests in the records are context only.",
    "5. **Rate each plan on its own**, against the records, not against the view's other plans. Several plans of a view may be sound, or none.",
    "6. **Flame lengths:** in the records of phase B (from 16.40 on), flame lengths follow a provisional flame-length table (Byram's relation, anchored on the Kalajoki 2021 observations) until the Finnish Meteorological Institute's values are in. Rate on the records as given; say in a comment if a value is not credible.",
    "7. **Rate independently**, on the view's records and your own professional judgement.", "",
    "**The scale (wisdom_rating_1to7): what \"sound\" means.** A plan is sound when a competent Finnish incident commander, knowing what is on record by the view's end, would judge it a good way to use the crews for the next 20–40 minutes: for the people at risk, for the crews' safety and for the fire as it behaves. Rate soundness for the situation, not compliance with the directive: a plan may comply and be unsound, or depart from it and be sound. 1 = clearly unsound, 4 = cannot say, 7 = clearly sound; 1–3 count as unsound, 5–7 as sound, 4 as neither.",
    "Other columns: **feasible_yes_no** (can it be done with the crews, water, hose and time on record), **main_reason** (one line), **confidence_1to5** (1 = very unsure … 5 = very sure), **comment**.", "",
    "**How the key is made.** A plan is keyed sound, or unsound, where at least 4 of the 5 panellists rate it on the same side (5–7, or 1–3); otherwise it is not keyed. The study's keys for each view (which way of working, in which sector, with which secondary task) are derived from these ratings; a view whose plans do not reach that agreement is reported descriptively and left out of the confirmatory analysis.", "",
    "## The directive", "",
    "From the participant's superior, P2 (duty chief fire officer), the same for every participant. The directive is not a record: it is shown on the pause screen at 16.40 and opens V8's message log; it is in force in V8–V14.", "",
    `- **Phase A's intent (13.20, opening V1):** ${PHASE_A_INTENT_FI}<br>*${enOf(PHASE_A_INTENT_FI)}*`,
    `- **The directive (16.40, at the pause between V7 and V8):** ${DIRECTIVE_FI}<br>*${enOf(DIRECTIVE_FI)}*`, "",
    "## The plan form (what a participant records in each view)", "",
    "The plans on the rating sheet are written out in prose; in the session a participant records a plan in this form, identical for everyone, with nothing preselected:", "",
    `- **${ui.fi.mainEffortLabel}** (*${ui.en.mainEffortLabel}*): one sector, L1–L4.`,
    `- **${ui.fi.postureLabel}** (*${ui.en.postureLabel}*), required, offered in this fixed order: ${MAIN_EFFORT_POSTURES.map((p) => `${ui.fi.postures[p]} (*${ui.en.postures[p]}*)`).join("; ")}.`,
    `- **${ui.fi.secondaryLabel}** (*${ui.en.secondaryLabel}*), optional, never the main effort's sector, with one task. The practice tour gives every participant these one-line definitions:`,
    ...SECONDARY_TASK_DEFINITIONS_FI.map((d, i) => `  - ${d}<br>*${SECONDARY_TASK_DEFINITIONS_EN[i] ?? ""}*`),
    `- **${ui.fi.dronesLabel}** (*${ui.en.dronesLabel}*), optional, in one sector: ${PLAN_DRONE_TASK_IDS.map((t) => `${ui.fi.droneTasks[t]} (*${ui.en.droneTasks[t]}*)`).join("; ")}.`,
    "- **The sectors** (wedges from the point of origin; not drawn on the map):",
    ...SECTORS_FI.map((s, i) => `  - ${s}<br>*${SECTORS_EN[i] ?? ""}*`), "",
    "## Maps", "",
    "No tool in the repository renders a per-view map headlessly, so the packet has none. For the researcher preparing the maps: `npm run skills:export` writes `dist/skills/scenario/spatial/perimeters_scripted.geojson` (EPSG:3067) and `dist/skills/scenario/spatial/barriers.geojson` (roads, waters, bridges). From the perimeters use only the features with `kind: \"reported\"` (the perimeter the participant's map draws at each step's start) whose `step` is one of the view's steps in the table above; the `kind: \"truth\"` features are the fire model's own state at a step's end, which participants never see, and stay out of the panel's maps.", "",
    "## Open questions (answer in questions.csv)", "",
    "Your ratings answer most of what the study needs. These questions ask for what the ratings cannot give. The questions marked \"remarks (optional)\" are answered by your ratings; add reasons if you wish.", "",
    "**The directive's premises (DRAFT wording).** For each view, say whether the records available by the view's end contradict the premise; your statuses set the study's table, which is fixed before data collection. Also say whether P1's Finnish wording is right.", "",
    ...premises, "",
    ...qs.filter((q) => !/^premise\.P\d\.V/.test(q.id)).map((q) => `- **${q.id}** (${q.view}; ${q.answer}): ${q.fi}<br>*${q.en}*`),
    `- **premise.P1.V8 … premise.P2.V14** (${PREMISE_VIEWS.length * premiseFile.premises.length} rows; contradicted / not contradicted / cannot tell): one row per premise and view; V8 has no plans to rate, only its premises.`, "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------------

export interface PanelSummary {
  readonly dir: string; readonly files: readonly string[]; readonly recordsPerView: ReadonlyMap<number, number>;
  readonly sheetRows: number; readonly questions: number; readonly dropped: readonly string[]; readonly edited: number;
}

export function writePanelPacket(outDir = PANEL_DIR): PanelSummary {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const files: [string, string][] = [];
  const counts = new Map<number, { total: number; pushed: number; fresh: number }>();
  for (const v of PREMISE_VIEWS) {
    const rows = recordSet(v);
    counts.set(v, { total: rows.length, pushed: rows.filter((r) => r.delivery === "PUSHED").length, fresh: rows.filter((r) => r.new_in_view !== "").length });
    files.push([`V${v}.md`, viewMarkdown(v, rows)], [`V${v}.csv`, toCsv(rows, RECORD_COLS)]);
  }
  const sheet = ratingSheet(), qs = questions();
  files.push(["rating_sheet.csv", csvText(SHEET_COLS, sheet.rows)]);
  files.push(["questions.csv", csvText(QUESTION_COLS, qs.map((q) => [q.id, q.view, q.fi, q.en, q.answer, ...raters.map(() => "")]))]);
  files.unshift(["README.md", readme(counts, sheet.rows.length, qs)]);
  for (const [name, text] of files) writeFileSync(join(dir, name), text);
  return { dir, files: files.map(([n]) => n), recordsPerView: new Map(PREMISE_VIEWS.map((v) => [v, counts.get(v)!.total])), sheetRows: sheet.rows.length, questions: qs.length, dropped: sheet.dropped, edited: sheet.edited };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const s = writePanelPacket(process.argv[2] ?? PANEL_DIR);
  console.log(`panel packet: ${PREMISE_VIEWS.map((v) => `V${v} ${s.recordsPerView.get(v)}`).join(", ")} records; ${s.sheetRows} plans; ${s.questions} questions; ${s.edited} plan edits${s.dropped.length ? `; dropped draft columns: ${s.dropped.join(", ")}` : ""} -> ${s.dir}`);
}
