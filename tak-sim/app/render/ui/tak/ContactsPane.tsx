/**
 * Contacts (SPEC/28 §5): the participant ("self") and every unit and aircraft on the map now — 2525 symbol, call sign,
 * roster type, task, water in the tank, the last battery level and message the participant has been told. Choosing one
 * centres the map on it (the participant's own move; logged as `tak_contact_selected`). Renderable data only.
 */

import { useLang } from "../i18n.js";
import { symbolSvg } from "./tak-symbols.js";
import type { TakContact } from "./shell.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

export function ContactsPane({ contacts, onSelect, selected }: {
  readonly contacts: readonly TakContact[];
  readonly onSelect: (c: TakContact) => void;
  readonly selected: string | null;
}) {
  const { t } = useLang();
  const C = t.tak.contacts;
  const groups: [string, readonly TakContact[]][] = [
    [C.self, contacts.filter((c) => c.kind === "self")],
    [C.ground, contacts.filter((c) => c.kind === "ground")],
    [C.air, contacts.filter((c) => c.kind === "air")],
  ];
  return (
    <div data-testid="tak-contacts" style={paneScroll}>
      <div style={{ fontSize: 12, color: TAK.textDim }}>{C.centreHint}</div>
      {groups.map(([title, list]) => list.length > 0 && (
        <section key={title} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ margin: "6px 0 2px", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: TAK.accent }}>{title} <span style={{ color: TAK.textDim }}>{list.length}</span></h3>
          {list.map((c) => <ContactRow key={c.uid} c={c} active={selected === c.uid} onSelect={() => onSelect(c)} />)}
        </section>
      ))}
      {contacts.length <= 1 && <div style={{ fontSize: 12.5, opacity: 0.6 }}>{C.none}</div>}
    </div>
  );
}

function ContactRow({ c, active, onSelect }: { readonly c: TakContact; readonly active: boolean; readonly onSelect: () => void }) {
  const { t } = useLang();
  const C = t.tak.contacts;
  const facts: string[] = [];
  if (c.waterPct !== null) facts.push(`${C.water} ${c.waterPct} %`);
  if (c.battery) facts.push(`${C.battery} ${c.battery.pct} % (${c.battery.clock})`);
  else if (c.kind === "air") facts.push(`${C.battery} ${C.unknown}`);
  if (c.lastReport) facts.push(`${C.lastReport} ${c.lastReport}`);
  return (
    <button type="button" data-testid={`tak-contact-${c.id}`} onClick={onSelect} aria-pressed={active}
      style={{
        display: "grid", gridTemplateColumns: "40px 1fr", gap: "2px 10px", alignItems: "center", width: "100%", minHeight: 52, padding: "6px 8px",
        border: `1px solid ${active ? TAK.accent : TAK.panelBorder}`, borderRadius: TAK.radius, background: active ? TAK.rowHover : TAK.row,
        color: TAK.text, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13,
      }}>
      {/* milsymbol's SVG for the contact's SIDC: static markup, no user input. */}
      <span style={{ gridRow: "1 / span 3", width: 34, height: 30, display: "block", justifySelf: "center" }} dangerouslySetInnerHTML={{ __html: symbolSvg(c.sidc, 24) }} />
      <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <strong style={{ fontFamily: TAK.mono, fontSize: 13.5 }}>{c.callsign}</strong>
        {c.type && <span style={{ fontSize: 11.5, color: TAK.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.type}</span>}
      </span>
      {c.task && <span style={{ fontSize: 12 }}>{c.task}</span>}
      {facts.length > 0 && <span style={{ fontSize: 11.5, color: TAK.textDim, fontFamily: TAK.mono }}>{facts.join(" · ")}</span>}
    </button>
  );
}
