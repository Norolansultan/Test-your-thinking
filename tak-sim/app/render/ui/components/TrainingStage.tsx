/**
 * The training incident's live stage (SPEC/08 (bp) §bp.1): the session's own live map (`MapView`, the TAK shell's 2525 symbols, info
 * card, coordinates and scale bar) LOCKED to the training's square (`training-lock.ts`), the TAK toolbar with only the tools the item
 * opens — Range & Bearing (S1–S3), the message log as GeoChat (S2–S3), Haku over the log (S3) — and under the map, where the session's
 * decision strip sits, the item: a live question (`TrainingQuestionPanel`; a point answer is a tap on the map, a second tap moves the
 * mark), S3's question card (the session's `SpamCard`, opened at once, routed to the training by the orchestrator), the memory exposure
 * (`TrainingStudyPanel`), or the feedback (`TrainingFeedbackPanel`, with the right answer drawn on the map).
 *
 * Nothing here logs: the orchestrator routes the components' records to nothing while the step is `training_incident`; R&B
 * measurements go to the item's answer (`noteTrainingMeasure`). The message log opens with S2 and S3 (as GeoChat opens with every
 * view); Haku is never opened for the participant (S3's first question is the natural-seeking covariate, `09` (bp)).
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import type { LatLon } from "../../../engine/primitives.js";
import type { TakPaneId } from "../../../telemetry/record-kinds.js";
import type { TrainingView } from "../../../session/training/host.js";
import type { TrainingItem } from "../../../session/training/spec.js";
import { TRAINING } from "../../../session/training/spec-data.js";
import { trainingClockLabel } from "../../../session/training/view.js";
import { insideBox } from "../../../session/training/area.js";
import { sidcOf } from "../../../tak/symbols.js";
import { MapView, type TakMapHandle, type TakMapOptions } from "./MapView.js";
import { SpamCard } from "./SpamCard.js";
import { TrainingFeedbackPanel, TrainingQuestionPanel, TrainingStudyPanel, useBusy } from "./TrainingPanels.js";
import { drawTrainingOverlay, setTrainingMark } from "../training-overlay.js";
import type { MapLock } from "../training-lock.js";
import { DEFAULT_OVERLAYS, type GeoChatRoomId } from "../tak/shell.js";
import { clearRangeBearing, setRangeBearing, TAK_MAP_CSS } from "../tak/tak-map.js";
import { roundedMeasurement } from "../tak/RangeBearing.js";
import { symbolSvg } from "../tak/tak-symbols.js";
import { TakToolbar } from "../tak/TakToolbar.js";
import { TakSidePane } from "../tak/TakSidePane.js";
import { GeoChatPane } from "../tak/GeoChatPane.js";
import { RangeBearingPane, type RbState } from "../tak/RangeBearingPane.js";
import { HakuPane } from "../tak/SearchPanes.js";
import { TakCoordReadout, TakInfoCard } from "../tak/TakMapChrome.js";
import { TAK } from "../tak/theme.js";
import { useLang } from "../i18n.js";

/** The toolbar's panes for the item's open tools, in the session toolbar's order. */
export function trainingPanes(tools: TrainingView["tools"]): TakPaneId[] {
  return [...(tools.log ? ["geochat" as const] : []), ...(tools.rb ? ["range_bearing" as const] : []), ...(tools.haku ? ["haku" as const] : [])];
}

export function TrainingStage({ snapshot, orchestrator, view, item, lock, studySecondsLeft }: {
  readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator; readonly view: TrainingView; readonly item: TrainingItem;
  readonly lock: MapLock; readonly studySecondsLeft: number;
}) {
  const { t, lang } = useLang();
  const panes = trainingPanes(view.tools);
  const [pane, setPane] = useState<TakPaneId | null>(view.tools.log ? "geochat" : null);
  useEffect(() => { setPane(view.tools.log ? "geochat" : null); }, [view.sectionId]); // each section opens with its log, if it has one
  const shown = pane !== null && panes.includes(pane) ? pane : null;
  const [room, setRoom] = useState<GeoChatRoomId>("all");

  const [handle, setHandle] = useState<TakMapHandle | null>(null);
  const tak: TakMapOptions = useMemo(() => ({
    overlays: DEFAULT_OVERLAYS, onMap: setHandle, planLabels: t.tak.plan,
    legendSymbols: { unit: symbolSvg(sidcOf("EK11"), 24), air: symbolSvg(sidcOf("DR1"), 24) },
  }), [lang]);

  // The item's marks, the road codes and (its feedback) the right answer, redrawn with every phase and item.
  useEffect(() => (handle ? drawTrainingOverlay(handle.map, view, item, lang) : undefined), [handle, view.phase, view.itemId, lang]);

  const [mark, setMark] = useState<LatLon | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [rb, setRb] = useState<RbState>({ from: null, to: null });
  useEffect(() => { setMark(null); setChoice(null); setRb({ from: null, to: null }); }, [view.itemId, view.phase]);
  const asking = view.phase === "question" && item.mode === "live";
  useEffect(() => { if (handle) setTrainingMark(handle.map, asking ? mark : null); }, [handle, mark, asking]);

  // The map's taps: R&B's two points while its pane is open, else a live point item's mark (inside the lock).
  const rbArmed = shown === "range_bearing";
  const pointAsked = asking && item.answer === "point";
  useEffect(() => {
    if (!handle) return undefined;
    const map = handle.map;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      const p = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      if (rbArmed) setRb((cur) => (!cur.from || cur.to ? { from: p, to: null } : { from: cur.from, to: p }));
      else if (pointAsked && insideBox(p, lock.bounds)) setMark(p);
    };
    map.on("click", onClick);
    map.getCanvas().style.cursor = rbArmed || pointAsked ? "crosshair" : "";
    return () => { map.off("click", onClick); map.getCanvas().style.cursor = ""; };
  }, [handle, rbArmed, pointAsked]);
  const noted = useRef<RbState | null>(null);
  useEffect(() => {
    if (!handle) return;
    if (rb.from) setRangeBearing(handle.map, rb.from, rb.to, lang); else clearRangeBearing(handle.map);
    if (rb.from && rb.to && noted.current !== rb) { noted.current = rb; orchestrator.noteTrainingMeasure(roundedMeasurement(rb.from, rb.to).metres); }
  }, [handle, rb, lang]);

  const [busy, act] = useBusy(`${view.itemId}|${view.phase}`);
  const answer = () => act(() => orchestrator.answerTraining(item.id, item.answer === "point" ? { point: mark! } : { choiceId: choice! }));
  const last = view.position === view.itemCount;

  const body = (p: TakPaneId) => {
    switch (p) {
      case "geochat": return <GeoChatPane log={snapshot.radioLog} room={room} onRoom={setRoom} />;
      case "range_bearing": return <RangeBearingPane rb={rb} onClear={() => setRb({ from: null, to: null })} />;
      case "haku": return <HakuPane snapshot={snapshot} orchestrator={orchestrator} />;
      default: return null;
    }
  };

  return (
    <div data-testid="training-stage" style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, position: "relative", background: TAK.panel }}>
      <style>{TAK_MAP_CSS}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* Each new item opens on the opening frame, as each new view does (round 4, B26); its feedback keeps the item's camera. */}
          <MapView snapshot={snapshot} extent={orchestrator.mapExtent} tak={tak} lock={lock} frameKey={view.itemId}>
            {/* Compact (the clock and the wind only), inside the locked map's top band: it covers nothing of the square (finding 3). */}
            <TakInfoCard compact clockLabel={trainingClockLabel(TRAINING)} wind={snapshot.renderTree.cycleInfo?.wind} />
            <TakCoordReadout map={handle?.map ?? null} />
          </MapView>
          {view.phase === "study" && <TrainingStudyPanel secondsLeft={studySecondsLeft} />}
          {asking && <TrainingQuestionPanel item={item} choice={choice} onChoose={setChoice} marked={mark !== null} onAnswer={answer} busy={busy} />}
          {view.phase === "question" && item.mode === "card" && snapshot.spam && <SpamCard spam={snapshot.spam} orchestrator={orchestrator} />}
          {view.phase === "feedback" && <TrainingFeedbackPanel view={view} item={item} last={last} page={false} onLeave={() => orchestrator.leaveTrainingFeedback(item.id)} />}
        </div>
      </div>
      {shown !== null && (
        <TakSidePane key={shown} testId={`tak-pane-${shown}`} title={t.tak.paneTitle[shown]} onClose={() => setPane(null)}>
          {body(shown)}
        </TakSidePane>
      )}
      {panes.length > 0 && <TakToolbar panes={panes} open={shown} onSelect={(p) => setPane(shown === p ? null : p)} searchLocked={false} unread={0} logTarget={false} />}
    </div>
  );
}
