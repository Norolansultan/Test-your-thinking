/**
 * SPEC/35 §3 item 3: the help card ("Sanasto ja ohjeet"), public sessions only — a button that opens a card with three
 * sections: the glossary A–Ö (filtered by initial letter: the study takes no free text, so no search field), the call-sign roster with the unit types (`unit-roster.ts`, the briefing's
 * order of battle), and the map legend (`Legend`, every row). No checklist, no tactics, nothing about the situation.
 * Opening a section is reported (`onHelpCardOpened(section)`; the shell writes `help_card_opened`), the first one when
 * the card opens. Expert sessions render nothing. The card lies inside the session's layout, so a freeze's blanking
 * hides it with everything else.
 *
 * Mounted by `RightPanel` (a slim row under the message log's header, classic shell) and `TakToolbar` (the foot of the TAK
 * shell's toolbar).
 */

import { useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import { useAudience, type HelpCardSection } from "../audience-context.js";
import { LangContext } from "../i18n.js";
import type { Lang } from "../../../i18n/lang.js";
import { unitCallSign } from "../../../i18n/place-names.js";
import { UNIT_ROSTER, UNIT_ROSTER_EN } from "../unit-roster.js";
import { Legend, LEGEND_ROWS } from "../components/Legend.js";
import { GLOSSARY_FILES, type GlossaryTerm } from "./glossary.js";

/** The card's texts (DRAFT, native check). */
export const HELP_CARD_TEXT = {
  fi: {
    button: "Sanasto ja ohjeet", title: "Sanasto ja ohjeet", close: "Sulje",
    sections: { glossary: "Sanasto A–Ö", roster: "Yksiköt", legend: "Karttamerkit" } as Record<HelpCardSection, string>,
    letters: "Alkukirjain", all: "Kaikki",
    rosterNote: "Kutsutunnuksen kirjaimet kertovat, mistä yksikkö on: EK oma pelastuslaitos, KY naapuripelastuslaitos, OUT alueen ulkopuolelta, DR drooniryhmä.",
    crew: "Miehistö", from: "Mistä",
    legendNote: "Kartalla näkyvät kulloinkin vain ne merkit, joita siinä on.",
  },
  en: {
    button: "Glossary & help", title: "Glossary & help", close: "Close",
    sections: { glossary: "Glossary A–Z", roster: "Units", legend: "Map symbols" } as Record<HelpCardSection, string>,
    letters: "Initial letter", all: "All",
    rosterNote: "A call sign's letters tell where the unit is from: EK own rescue department, KY neighbouring rescue department, OUT from outside the region, DR drone team.",
    crew: "Crew", from: "From",
    legendNote: "The map shows only the symbols in use at the time.",
  },
} as const;

export const HELP_CARD_SECTIONS: readonly HelpCardSection[] = ["glossary", "roster", "legend"];

/** A–Ö order without a locale (I1): å, ä, ö after z, as in Finnish; case ignored. */
export function alphaKey(s: string): string {
  return s.toLowerCase().replace(/å/g, "{").replace(/ä/g, "|").replace(/ö/g, "}");
}

/** A headword's initial, upper case, as the letter index shows it. */
export function initialOf(term: GlossaryTerm): string {
  return term.term.charAt(0).toUpperCase();
}

/** The initials the glossary has, in A–Ö order. */
export function glossaryLetters(terms: readonly GlossaryTerm[]): string[] {
  return [...new Set(terms.map(initialOf))].sort((a, b) => (alphaKey(a) < alphaKey(b) ? -1 : alphaKey(a) > alphaKey(b) ? 1 : 0));
}

/** The glossary's terms in A–Ö order; with `letter`, only those whose headword starts with it. */
export function glossaryList(terms: readonly GlossaryTerm[], letter: string | null): GlossaryTerm[] {
  const hit = (t: GlossaryTerm) => letter === null || initialOf(t) === letter;
  return terms.filter(hit).sort((a, b) => (alphaKey(a.term) < alphaKey(b.term) ? -1 : alphaKey(a.term) > alphaKey(b.term) ? 1 : 0));
}

export interface RosterRow { readonly callSign: string; readonly type: string; readonly crew?: string | undefined; readonly from?: string | undefined; readonly detail?: string | undefined }

/** The roster in the session language, in its own order (the briefing's). */
export function rosterRows(lang: Lang): RosterRow[] {
  // determinism-lint-allow: a constant table's insertion order, display only; never fed to the session.
  return Object.keys(UNIT_ROSTER).map((id) => {
    const fi = UNIT_ROSTER[id]!;
    const en = UNIT_ROSTER_EN[id];
    return lang === "en" && en
      ? { callSign: unitCallSign(lang, id), type: en.type, crew: en.crew, from: en.from, detail: en.detail }
      : { callSign: unitCallSign(lang, id), type: fi.typeFi, crew: fi.crew, from: fi.fromFi, detail: fi.detailFi };
  });
}

/**
 * The card's section state: opening the card opens its first section; choosing a section reports it unless it is already
 * open. Pure, for the tests; `report` is `onHelpCardOpened`.
 */
export function chooseSection(current: HelpCardSection | null, next: HelpCardSection, report: (s: HelpCardSection) => void): HelpCardSection {
  if (current !== next) report(next);
  return next;
}

const ALL_LEGEND_ROWS = new Set(LEGEND_ROWS);

const buttonStyle = (variant: "panel" | "toolbar"): JSX.CSSProperties => variant === "toolbar"
  ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minHeight: 60, padding: "6px 2px", border: "none", borderRadius: 4, background: "transparent", color: "#f2f5f7", cursor: "pointer", fontSize: 11, fontWeight: 600, lineHeight: 1.1, textAlign: "center", marginTop: "auto" }
  : { padding: "3px 10px", borderRadius: 12, border: "1px solid #8ab4f8", background: "#1f2a38", color: "#dbe7fb", cursor: "pointer", fontSize: 11.5, fontWeight: 600, textTransform: "none", letterSpacing: "normal" };

const tab = (active: boolean): JSX.CSSProperties => ({
  padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: `1px solid ${active ? "#8ab4f8" : "#3a3f44"}`, background: active ? "#2b3a50" : "#20242a", color: "#e8eaed",
});

export function HelpCard({ variant = "panel" }: { readonly variant?: "panel" | "toolbar" }) {
  const { audience, onHelpCardOpened } = useAudience();
  const lang = useContext(LangContext);
  const [section, setSection] = useState<HelpCardSection | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const isOpen = section !== null;
  const close = () => { setSection(null); button.current?.focus(); };
  useEffect(() => {
    if (!isOpen) return undefined;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);
  if (audience !== "public") return null;

  const T = HELP_CARD_TEXT[lang];
  const choose = (next: HelpCardSection) => setSection(chooseSection(section, next, onHelpCardOpened));
  // "panel": its own slim row (the message log's header is dimmed, and a dimmed parent would dim the open card too).
  const Wrap = variant === "panel" ? PanelRow : Bare;
  return (
    <Wrap>
      <button ref={button} type="button" data-testid="help-card-button" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => (isOpen ? close() : choose("glossary"))} style={buttonStyle(variant)}>
        {variant === "toolbar" && <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>?</span>}
        <span>{T.button}</span>
      </button>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(15,17,20,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialog} role="dialog" aria-modal="true" aria-label={T.title} tabIndex={-1} data-testid="help-card"
            style={{ width: "min(620px, 100%)", maxHeight: "min(84vh, 760px)", display: "flex", flexDirection: "column", background: "#1b1e22", color: "#e8eaed", border: "1px solid #3a3f44", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", outline: "none", textAlign: "left", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #33383e" }}>
              <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>{T.title}</h2>
              <button type="button" onClick={close} aria-label={T.close} style={{ ...tab(false), padding: "4px 10px" }}>×</button>
            </div>
            <div role="tablist" aria-label={T.title} style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 14px" }}>
              {HELP_CARD_SECTIONS.map((s) => (
                <button key={s} type="button" role="tab" aria-selected={section === s} data-testid={`help-card-tab-${s}`} onClick={() => choose(s)} style={tab(section === s)}>{T.sections[s]}</button>
              ))}
            </div>
            <div role="tabpanel" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 14px 14px", fontSize: 13, lineHeight: 1.45 }}>
              {section === "glossary" && <GlossarySection lang={lang} letter={letter} onLetter={setLetter} />}
              {section === "roster" && <RosterSection lang={lang} />}
              {section === "legend" && (
                <div>
                  <p style={{ margin: "0 0 8px", opacity: 0.8 }}>{T.legendNote}</p>
                  <div style={{ display: "inline-block" }}><Legend isoMinutes={[]} drawn={ALL_LEGEND_ROWS} embedded surface="help_card" /></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Wrap>
  );
}

function PanelRow({ children }: { readonly children: ComponentChildren }) {
  return <div data-testid="help-card-row" style={{ padding: "6px 12px", borderBottom: "1px solid #33383e", display: "flex", justifyContent: "flex-end" }}>{children}</div>;
}

function Bare({ children }: { readonly children: ComponentChildren }) {
  return <>{children}</>;
}

function GlossarySection({ lang, letter, onLetter }: { readonly lang: Lang; readonly letter: string | null; readonly onLetter: (l: string | null) => void }) {
  const T = HELP_CARD_TEXT[lang];
  const terms = GLOSSARY_FILES[lang].terms;
  const list = glossaryList(terms, letter);
  const chip = (active: boolean): JSX.CSSProperties => ({ ...tab(active), padding: "3px 8px", fontSize: 12.5, minWidth: 30 });
  return (
    <div>
      <div role="group" aria-label={T.letters} style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        <button type="button" aria-pressed={letter === null} onClick={() => onLetter(null)} style={chip(letter === null)}>{T.all}</button>
        {glossaryLetters(terms).map((l) => (
          <button key={l} type="button" aria-pressed={letter === l} data-testid={`help-card-letter-${l}`} onClick={() => onLetter(letter === l ? null : l)} style={chip(letter === l)}>{l}</button>
        ))}
      </div>
      <dl style={{ margin: 0 }}>
        {list.map((t) => (
          <div key={t.id} data-term={t.id} style={{ padding: "6px 0", borderBottom: "1px solid #262b31" }}>
            <dt style={{ fontWeight: 700 }}>{t.term}</dt>
            <dd style={{ margin: "2px 0 0" }}>{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RosterSection({ lang }: { readonly lang: Lang }) {
  const T = HELP_CARD_TEXT[lang];
  return (
    <div>
      <p style={{ margin: "0 0 8px", opacity: 0.8 }}>{T.rosterNote}</p>
      {rosterRows(lang).map((r) => (
        <div key={r.callSign} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "2px 10px", padding: "6px 0", borderBottom: "1px solid #262b31" }}>
          <strong style={{ fontFamily: "monospace", fontSize: 13.5 }}>{r.callSign}</strong>
          <span>{r.type}</span>
          {(r.crew || r.from) && <span style={{ gridColumn: 2, fontSize: 12, opacity: 0.75 }}>{[r.crew && `${T.crew} ${r.crew}`, r.from && `${T.from}: ${r.from}`].filter(Boolean).join(" · ")}</span>}
          {r.detail && <span style={{ gridColumn: 2, fontSize: 12, opacity: 0.75 }}>{r.detail}</span>}
        </div>
      ))}
    </div>
  );
}
