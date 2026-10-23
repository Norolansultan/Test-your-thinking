/**
 * The play harness's explanation layer (`tools/play/`; SPEC/35 §3, public sessions only): a glossary term's definition, as the
 * app's tooltip shows it when a marked word is clicked, and the help card's three sections ("Sanasto ja ohjeet": the glossary A–Ö
 * by initial letter, the call-sign roster, the map legend's rows), as `HelpCard` shows them. Each is logged as the app logs it
 * (`recordAudienceEvent`: `glossary_opened` with the surface it was opened on, `help_card_opened` with the section) and costs
 * reading time. Nothing here is about the situation (the glossary and the roster are generic, SPEC/35 §1).
 */

import { tr } from "../../app/i18n/text.js";
import { GLOSSARY_FILES, type GlossaryTerm } from "../../app/render/ui/explain/glossary.js";
import { glossaryLetters, glossaryList, HELP_CARD_SECTIONS, HELP_CARD_TEXT, rosterRows } from "../../app/render/ui/explain/HelpCard.js";
import { LEGEND_MAP_TEXT } from "../../app/render/ui/components/Legend.js";
import { FIRE_THEME } from "../../app/render/ui/fire-layers.js";
import type { GlossarySurface, HelpCardSection } from "../../app/telemetry/record-kinds.js";
import { COST_S } from "./costs.js";
import { PlayError, VIEW_STEPS, type PlaySession } from "./session.js";

const fold = (s: string) => s.toLowerCase().replace(/[‹›"']/g, "").trim();

/** The surface a marked word is clicked on: the freeze screen, the SPAM card, the plan review, else the message log. */
function surfaceOf(session: PlaySession): GlossarySurface {
  const s = session.snap();
  if (s.step === "freeze") return "freeze";
  if (s.spam && s.spam.phase !== "ready") return "spam";
  if (s.step === "plan_review") return "review";
  if (s.step === "allocation") return "plan";
  return "message_log";
}

function findTerm(session: PlaySession, query: string): GlossaryTerm | undefined {
  const terms = GLOSSARY_FILES[session.config.lang].terms;
  const q = fold(query);
  return terms.find((t) => fold(t.id) === q || fold(t.term) === q) ?? terms.find((t) => t.forms.some((f) => fold(f.replace(/^=/, "").replace(/[*#]/g, "")) === q));
}

export async function glossaryText(session: PlaySession, query: string): Promise<string> {
  if (session.config.audience !== "public") throw new PlayError("the glossary is in public sessions only");
  if (!query) throw new PlayError("glossary <term> (a ‹marked› word, or a headword from `help glossary`)");
  const step = session.snap().step;
  if (!VIEW_STEPS.has(step) && step !== "freeze" && step !== "hinge_pause") throw new PlayError("no marked words on this screen");
  const term = findTerm(session, query);
  if (!term) throw new PlayError(`no glossary entry for "${query}" (\`help glossary\` lists the headwords)`);
  await session.act(() => session.o.recordAudienceEvent({ kind: "glossary_opened", termId: term.id, surface: surfaceOf(session) }));
  await session.spend(COST_S.glossary);
  return `${term.term}: ${term.definition}`;
}

export async function helpText(session: PlaySession, sectionArg: string | undefined, letter: string | undefined): Promise<string> {
  if (session.config.audience !== "public") throw new PlayError("the help card is in public sessions only");
  const step = session.snap().step;
  if ((!VIEW_STEPS.has(step) && step !== "hinge_pause") || session.snap().tour !== null) throw new PlayError("the help card's button is in the TAK toolbar, inside a period (not during a freeze)");
  const section = (sectionArg ?? "glossary") as HelpCardSection;
  if (!HELP_CARD_SECTIONS.includes(section)) throw new PlayError(`help [${HELP_CARD_SECTIONS.join("|")}] [letter]`);
  const lang = session.config.lang;
  const T = HELP_CARD_TEXT[lang];
  // The card opens on its first section (reported), then the section chosen (reported when it is another one), as `chooseSection`.
  await session.act(() => session.o.recordAudienceEvent({ kind: "help_card_opened", section: "glossary" }));
  if (section !== "glossary") await session.act(() => session.o.recordAudienceEvent({ kind: "help_card_opened", section }));
  await session.spend(COST_S.help);
  const out = [`== ${T.title} · ${T.sections[section]} ==`];
  if (section === "glossary") {
    const terms = GLOSSARY_FILES[lang].terms;
    const pick = letter ? letter.toUpperCase() : null;
    out.push(`${T.letters}: ${T.all} ${glossaryLetters(terms).join(" ")}`);
    for (const t of glossaryList(terms, pick)) out.push(`${t.term}: ${t.definition}`);
  } else if (section === "roster") {
    out.push(T.rosterNote);
    for (const r of rosterRows(lang)) out.push(`${r.callSign} — ${r.type}${r.crew ? ` · ${T.crew} ${r.crew}` : ""}${r.from ? ` · ${T.from} ${r.from}` : ""}${r.detail ? ` · ${r.detail}` : ""}`);
  } else {
    const L = FIRE_THEME.legend, M = LEGEND_MAP_TEXT[lang];
    out.push(T.legendNote, `${tr(lang, L.title)}:`);
    for (const k of ["past", "burnt", "burningZone", "uncontained", "head", "contained", "inactive", "spotConfirmed", "spotUnconfirmed"] as const) out.push(`  ${tr(lang, L[k])}`);
    out.push(`  ${tr(lang, L.detections)} ${L.detectionAges.join(" · ")}`, `  ${tr(lang, L.projection)} ${L.projectionBands.join(" · ")}`);
    for (const k of ["unit", "crew", "hose", "stack", "air", "sector", "road", "power", "region"] as const) out.push(`  ${M[k]}`);
    out.push("» The symbols themselves are in the map image's legend (`look`).");
  }
  return out.join("\n");
}
