/**
 * The TAK shell's two map tools in the play harness (`tools/play/`; SPEC/28 §5): Contacts — every unit and aircraft on the map
 * with its roster type, task, water and the time of its last message the participant has been told (`takContacts`, the
 * `ContactsPane`'s model; choosing one centres the map on it, as its button does) — and Range & Bearing — the distance and true
 * bearing between two points tapped on the map (`rangeBearing`, the pane's own formatting), here two pixels of the last map image,
 * the line then drawn on the map as the app draws it. Each opens its pane in place of GeoChat and goes back to GeoChat after, as
 * the toolbar does, and logs what the shell logs (`tak_pane_*`, `tak_contact_selected`, `tak_rb_measured`).
 */

import { UI_TEXT } from "../../app/i18n/ui.js";
import type { TakPaneId } from "../../app/telemetry/record-kinds.js";
import { takContacts } from "../../app/render/ui/tak/shell.js";
import { OVERLAY } from "../../app/render/ui/map-overlay.js";
import { formatBearing, formatRange, rangeBearing, roundedMeasurement } from "../../app/render/ui/tak/RangeBearing.js";
import { COST_S } from "./costs.js";
import { lngLatAt, moveCamera, openingOf } from "./map-camera.js";
import { PlayError, VIEW_STEPS, type PlaySession } from "./session.js";

const need = (ok: unknown, message: string): void => { if (!ok) throw new PlayError(message); };

/** Opens `pane` in place of GeoChat, runs `body`, and returns to GeoChat (the toolbar's records). */
async function inPane<T>(session: PlaySession, pane: TakPaneId, body: () => Promise<T>): Promise<T> {
  const view = session.snap().currentCycle;
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_closed", detail: { pane: "geochat", view, cause: "replaced" } }));
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_opened", detail: { pane, view, cause: "toolbar" } }));
  const out = await body();
  const now = session.snap();
  if (VIEW_STEPS.has(now.step)) {
    await session.act(() => session.o.logMapUse({ kind: "tak_pane_closed", detail: { pane, view: now.currentCycle, cause: "replaced" } }));
    await session.act(() => session.o.logMapUse({ kind: "tak_pane_opened", detail: { pane: "geochat", view: now.currentCycle, cause: "toolbar" } }));
  }
  return out;
}

/** `contacts` lists them; `contacts <call sign>` also centres the map on that one (then `look`). */
export async function contactsCommand(session: PlaySession, args: readonly string[]): Promise<string> {
  const s = session.snap();
  need(VIEW_STEPS.has(s.step) && s.tour === null, "the Contacts pane is not usable on this screen");
  const lang = session.config.lang;
  const t = UI_TEXT[lang];
  const C = t.tak.contacts;
  const contacts = takContacts(s.renderTree.cycleInfo, s.radioLog, lang, { at: OVERLAY.commandPost, callsign: t.tak.selfCallsign, role: t.tak.selfRole });
  const chosen = args[0] ? contacts.find((c) => c.callsign.toLowerCase() === args[0]!.toLowerCase() || c.id.toLowerCase() === args[0]!.toLowerCase()) : undefined;
  need(!args[0] || chosen, `no contact "${args[0]}" on the map now`);
  return inPane(session, "contacts", async () => {
    await session.spend(COST_S.contacts);
    if (chosen) {
      await session.act(() => session.o.logMapUse({ kind: "tak_contact_selected", detail: { uid: chosen.uid, view: s.currentCycle } }));
      const from = session.camera() ?? openingOf(session.scenario.extent);
      session.mapCamera = { view: s.currentCycle, camera: moveCamera(session.scenario.extent, { ...from, center: [chosen.at.lon, chosen.at.lat] }, null, null) };
    }
    const out = [`-- ${t.tak.paneTitle.contacts} --`, C.centreHint];
    for (const [title, kind] of [[C.self, "self"], [C.ground, "ground"], [C.air, "air"]] as const) {
      const list = contacts.filter((c) => c.kind === kind);
      if (list.length === 0) continue;
      out.push(`${title} (${list.length})`);
      for (const c of list) {
        const facts = [c.type, c.task ? `${C.task}: ${c.task}` : null, c.waterPct !== null ? `${C.water} ${c.waterPct} %` : null, c.lastReport ? `${C.lastReport} ${c.lastReport}` : null].filter((f) => f);
        out.push(`  ${c.callsign}${facts.length ? ` — ${facts.join(" · ")}` : ""}`);
      }
    }
    if (chosen) out.push(`» The map is centred on ${chosen.callsign} (\`look\` draws it).`);
    return out.join("\n");
  });
}

/** `measure <x1>,<y1> <x2>,<y2>`: Range & Bearing between two pixels of the last map image (the camera now). */
export async function measureCommand(session: PlaySession, args: readonly string[]): Promise<string> {
  const s = session.snap();
  need(VIEW_STEPS.has(s.step) && s.tour === null, "the Range & Bearing tool is not usable on this screen");
  const pts = args.slice(0, 2).map((a) => a.split(",").map(Number));
  need(pts.length === 2 && pts.every((p) => p.length === 2 && p.every((v) => Number.isFinite(v))), "measure <x1>,<y1> <x2>,<y2> (pixels of the last map image)");
  const camera = session.camera() ?? openingOf(session.scenario.extent);
  const [a, b] = pts.map((p) => { const [lon, lat] = lngLatAt(camera, p[0]!, p[1]!); return { lat, lon }; }) as [{ lat: number; lon: number }, { lat: number; lon: number }];
  const lang = session.config.lang;
  const rb = UI_TEXT[lang].tak.rb;
  return inPane(session, "range_bearing", async () => {
    await session.spend(COST_S.measure);
    await session.act(() => session.o.logMapUse({ kind: "tak_rb_measured", detail: { ...roundedMeasurement(a, b), view: s.currentCycle } }));
    session.rb = { view: s.currentCycle, from: a, to: b };
    const r = rangeBearing(a, b);
    return `-- ${UI_TEXT[lang].tak.paneTitle.range_bearing} --\n${rb.range}: ${formatRange(r.metres, lang)} · ${rb.bearing}: ${formatBearing(r.bearingDeg)} · ${rb.backBearing}: ${formatBearing(r.backBearingDeg)}\n${rb.keeps}`;
  });
}
