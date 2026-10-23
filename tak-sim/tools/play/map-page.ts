/**
 * The play harness's map page (`tools/play/`, browser side): the app's own live map — `MapView` in the TAK shell's mode with its
 * chrome (`TakInfoCard`: call sign, scenario clock, wind; `TakCoordReadout`: the coordinate readout and the scale bar), the shell's
 * overlay defaults (`DEFAULT_OVERLAYS`) and stylesheet — drawn from one snapshot's renderable data, so the PNG `map-render.ts`
 * takes of it is what the participant's map showed at that moment: the basemap tiles, the reference overlay (sectors, roads,
 * places), the fire as reported, the projection, the units with their call signs, the legend. Nothing is drawn here that the
 * app does not draw; nothing is read but what `MapView` reads (`renderTree.cycleInfo`, the envelope, the recorded plan, the
 * view, the clock). The camera is the app's opening frame (`openingCamera`, the same for every participant at a map size).
 *
 * The legend is opened as the guided tour opens it (`announceTourStep("legend")`), so the image carries the symbols' key, unless the
 * player has collapsed it (`map legend`).
 * Built by `map-render.ts` with esbuild; never part of the app's build.
 */

import { h, render } from "preact";
import { useState } from "preact/hooks";
import { MapView, type TakMapHandle } from "../../app/render/ui/components/MapView.js";
import { TakCoordReadout, TakInfoCard } from "../../app/render/ui/tak/TakMapChrome.js";
import { LangContext } from "../../app/render/ui/i18n.js";
import { AudienceContext, EXPERT_AUDIENCE, type AudienceInfo } from "../../app/render/ui/audience-context.js";
import { DEFAULT_OVERLAYS } from "../../app/render/ui/tak/shell.js";
import { setRangeBearing, TAK_MAP_CSS } from "../../app/render/ui/tak/tak-map.js";
import { symbolSvg } from "../../app/render/ui/tak/tak-symbols.js";
import { sidcOf } from "../../app/tak/symbols.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { announceTourStep } from "../../app/render/ui/tour.js";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import type { MapPageData } from "./map-data.js";

interface PlayWindow { __PLAY_MAP__?: MapPageData; __playMapDone?: boolean }

const data = (window as unknown as PlayWindow).__PLAY_MAP__!;
const audience: AudienceInfo = data.audience === "public" ? { ...EXPERT_AUDIENCE, audience: "public" } : EXPERT_AUDIENCE;
// What MapView and the chrome read of the snapshot; nothing else is given.
const snapshot = {
  currentCycle: data.currentCycle, language: data.lang, clockLabel: data.clockLabel,
  renderTree: { cycleInfo: data.cycleInfo }, currentEnvelope: data.envelope, recordedPlan: data.recordedPlan,
} as unknown as SessionSnapshot;

/** The map once MapView hands it over (the participant's camera is set on it). */
let mapHandle: TakMapHandle | null = null;

function Page() {
  const [handle, setHandle] = useState<TakMapHandle | null>(null);
  const t = UI_TEXT[data.lang];
  const tak = { overlays: DEFAULT_OVERLAYS, onMap: (m: TakMapHandle | null) => { mapHandle = m; setHandle(m); }, planLabels: t.tak.plan, legendSymbols: { unit: symbolSvg(sidcOf("EK11"), 24), air: symbolSvg(sidcOf("DR1"), 24) } };
  return h(LangContext.Provider, { value: data.lang },
    h(AudienceContext.Provider, { value: audience },
      h("div", { id: "play-map-root", style: { width: `${data.widthPx}px`, height: `${data.heightPx}px`, display: "flex", flexDirection: "column", position: "relative", background: "#12151a" } },
        h("style", null, TAK_MAP_CSS),
        h(MapView, { snapshot, extent: data.extent, tak },
          h(TakInfoCard, { clockLabel: data.clockLabel, wind: data.cycleInfo?.wind }),
          h(TakCoordReadout, { map: handle?.map ?? null })))));
}

render(h(Page, null), document.getElementById("app")!);

// Done once the map has drawn (MapView's own "ready": the first idle after the tiles and layers) and the labels have settled.
const frames = (n: number) => new Promise<void>((resolve) => { const step = (k: number) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1))); step(n); });
const finish = () => { if (data.legend) announceTourStep("legend"); void frames(6).then(() => { (window as unknown as PlayWindow).__playMapDone = true; }); };
const poll = () => {
  const el = document.querySelector('[data-testid="main-map"]');
  if (!el || el.getAttribute("data-ready") !== "1" || !mapHandle) { setTimeout(poll, 50); return; }
  const { camera, rb } = data;
  if (!camera && !rb) { finish(); return; }
  // The participant's own move (a preset, the wheel, a drag) and Range & Bearing line: the map is drawn again before the picture.
  const map = mapHandle.map;
  map.once("idle", finish);
  if (rb) setRangeBearing(map, rb.from, rb.to, data.lang);
  if (camera) map.jumpTo({ center: [camera.center[0], camera.center[1]], zoom: camera.zoom });
  map.triggerRepaint();
};
poll();
