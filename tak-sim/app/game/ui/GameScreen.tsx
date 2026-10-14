/**
 * Game mode: the game screen — the HUD, the map with the live fire, the order bar, the TAK toolbar and side pane. The
 * loop runs on `requestAnimationFrame`: its timestamp goes into `frameTicks` (`loop.ts`), which turns real time at the
 * chosen speed into `game.tick` calls (no clock is read: the determinism lint holds). The map is updated imperatively
 * when the game state changes; Preact re-renders the HUD and panes at most every `RENDER_EVERY_MS`.
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Game, GameScenario, GameState, Order, RadioMessage } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { issueToSelection, nextSelection, type IssueOutcome } from "./controls.js";
import type { GameResult } from "./Debrief.js";
import { computeForecast, forecastDue } from "./forecast-view.js";
import { GameMapController, type Layers } from "./game-map.js";
import { gameWorld, startGame } from "./game-source.js";
import { Hud } from "./Hud.js";
import { frameTicks, MAX_REAL_DT_S, speedByKey, togglePause, type Speed } from "./loop.js";
import { OrderBar } from "./OrderBar.js";
import { NO_TARGETING, nearestProtectable, nearestWaterPoint, orderByKey, ordersForSelection, targetStep, type OrderType, type TargetEvent, type TargetPick, type Targeting } from "./orders.js";
import { GameToolbar, HelpPane, LayersPane, ObjectivesPane, RadioPane, SidePane, UnitsPane } from "./Panes.js";
import { GM, TAK } from "./styles.js";
import { GAME_TEXT, inLang, type LayerId, type PaneId } from "./text.js";

const RENDER_EVERY_MS = 150;
const TOAST_MS = 4500;
/** Burned area is sampled for the debrief every this many game seconds. */
const HISTORY_EVERY_S = 60;
/** Panes lie over the map below this window width (as the study's TAK shell). */
const OVERLAY_BELOW_PX = 760;
/** Map clicks pick the nearest water point / building within these distances, m. */
const PICK_WATER_M = 400;
const PICK_PROTECT_M = 250;

interface Toast { readonly id: number; readonly text: string; readonly kind: "ok" | "bad" | "urgent" }

const DEFAULT_LAYERS: Readonly<Record<LayerId, boolean>> = { fuel: false, forecast: false, labels: true, sensors: true, truth: false };

export function GameScreen({ lang, scenario, seed, onFinish }: {
  readonly lang: Lang; readonly scenario: GameScenario; readonly seed: number;
  readonly onFinish: (r: GameResult) => void;
}) {
  const t = GAME_TEXT[lang];
  const world = gameWorld();
  const game: Game = useMemo(() => startGame(scenario, seed), [scenario, seed]);
  const [, setVersion] = useState(0);
  const [speed, setSpeedState] = useState<Speed>(0);
  const [selected, setSelectedState] = useState<readonly string[]>([]);
  const [targeting, setTargetingState] = useState<Targeting>(NO_TARGETING);
  const [pane, setPane] = useState<PaneId | null>(null);
  const [layers, setLayers] = useState<Readonly<Record<LayerId, boolean>>>(DEFAULT_LAYERS);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const [started, setStarted] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < OVERLAY_BELOW_PX);

  const mapEl = useRef<HTMLDivElement>(null);
  const ctl = useRef<GameMapController | null>(null);
  const speedRef = useRef<Speed>(0);
  const resumeRef = useRef<Speed>(5);
  const selRef = useRef<readonly string[]>([]);
  const tgtRef = useRef<Targeting>(NO_TARGETING);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const paneRef = useRef(pane);
  paneRef.current = pane;
  const dirty = useRef(true);
  const toastId = useRef(0);
  const historyRef = useRef<{ tS: number; ha: number }[]>([]);
  const finishedRef = useRef(false);

  const toast = (text: string, kind: Toast["kind"]) => {
    const id = ++toastId.current;
    setToasts((cur) => [...cur.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), TOAST_MS);
  };
  const setSpeed = (s: Speed) => {
    if (s !== 0) { resumeRef.current = s; setStarted(true); }
    speedRef.current = s;
    setSpeedState(s);
  };
  const setSelected = (ids: readonly string[]) => { selRef.current = ids; setSelectedState(ids); dirty.current = true; };
  const setTargeting = (tg: Targeting) => { tgtRef.current = tg; setTargetingState(tg); };

  /** Pushes the current state to the map now (after an order or a selection change). */
  const refreshMap = () => {
    ctl.current?.update(game.state, game.commands, new Set(selRef.current), layersRef.current);
    const tg = tgtRef.current;
    ctl.current?.setTargeting(tg.kind !== "none", tg.kind === "break_to" ? tg.from : null);
    setVersion((v) => v + 1);
  };

  const report = (out: readonly IssueOutcome[], type: OrderType) => {
    const bad = out.filter((o): o is Extract<IssueOutcome, { ok: false }> => !o.ok);
    for (const b of bad.slice(0, 2)) toast(`${t.orderRejected} — ${b.unitId}: ${inLang(lang, b.reasonFi, b.reasonEn)}`, "bad");
    const good = out.filter((o) => o.ok).map((o) => o.unitId);
    if (good.length > 0) toast(t.orderGiven(good.join(", "), t.order[type]), "ok");
  };
  const issue = (order: Order | ((u: GameState["units"][number]) => Order | null), type: OrderType) => {
    const st = game.state;
    const out = issueToSelection(game, st.units, selRef.current, order);
    report(out, type);
    refreshMap();
  };

  const pick: TargetPick = {
    nearestWater: (at) => nearestWaterPoint(world, at, PICK_WATER_M),
    nearestProtectable: (at) => nearestProtectable(world, at, PICK_PROTECT_M),
  };
  /** One targeting event; returns whether targeting used it. */
  const target = (ev: TargetEvent): boolean => {
    if (ev.type === "choose" && selRef.current.length === 0) return false;
    const r = targetStep(tgtRef.current, ev, pick);
    setTargeting(r.next);
    if (r.order) issue(r.order, r.order.type);
    else refreshMap();
    return r.consumed;
  };
  const nearestWaterForAll = () => {
    const tg = tgtRef.current;
    if (tg.kind === "shuttle_water") {
      const first = game.state.units.find((u) => u.id === selRef.current[0]);
      const id = first ? nearestWaterPoint(world, first.pos) : null;
      if (id) target({ type: "water", id });
      return;
    }
    setTargeting(NO_TARGETING);
    issue((u) => { const id = nearestWaterPoint(world, u.pos); return id ? { type: "refill", waterPointId: id } : null; }, "refill");
  };

  const handlersRef = useRef({
    unit: (_id: string, _add: boolean) => undefined as void,
    map: (_at: { x: number; y: number }) => undefined as void,
    rightClick: (_at: { x: number; y: number }) => undefined as void,
    water: (_id: string) => undefined as void,
    protectable: (_id: string) => undefined as void,
  });
  handlersRef.current = {
    unit: (id, add) => {
      const tg = tgtRef.current;
      const u = game.state.units.find((x) => x.id === id);
      if (tg.kind === "shuttle_unit") { target({ type: "unit", id }); return; }
      if ((tg.kind === "point" || tg.kind === "break_from" || tg.kind === "break_to") && u) { target({ type: "map", at: u.pos }); return; }
      if (tg.kind !== "none") return;
      setSelected(nextSelection(selRef.current, id, add));
      refreshMap();
    },
    map: (at) => {
      if (target({ type: "map", at })) return;
      if (tgtRef.current.kind === "none" && selRef.current.length > 0) { setSelected([]); refreshMap(); }
    },
    rightClick: (at) => {
      if (selRef.current.length === 0) return;
      setTargeting(NO_TARGETING);
      issue({ type: "move", to: at }, "move");
    },
    water: (id) => {
      const tg = tgtRef.current;
      const w = world.waterPoints.find((x) => x.id === id);
      if (tg.kind === "water" || tg.kind === "shuttle_water") target({ type: "water", id });
      else if (w && (tg.kind === "point" || tg.kind === "break_from" || tg.kind === "break_to")) target({ type: "map", at: w.at });
    },
    protectable: (id) => {
      const tg = tgtRef.current;
      if (tg.kind === "protect") { target({ type: "protectable", id }); return; }
      const at = world.settlements.find((s) => s.id === id)?.centre ?? world.assets.find((a) => a.id === id)?.at;
      if (at) handlersRef.current.map(at);
    },
  };

  // The map and the loop.
  useEffect(() => {
    if (!mapEl.current) return;
    const c = new GameMapController(mapEl.current, world, lang, game.scenario, {
      unit: (id, add) => handlersRef.current.unit(id, add),
      map: (at) => handlersRef.current.map(at),
      rightClick: (at) => handlersRef.current.rightClick(at),
      water: (id) => handlersRef.current.water(id),
      protectable: (id) => handlersRef.current.protectable(id),
    });
    ctl.current = c;
    c.update(game.state, game.commands, new Set(selRef.current), layersRef.current);
    let raf = 0;
    let prevMs: number | null = null;
    let lastFrameMs: number | null = null;
    let lastState: GameState | null = null;
    let lastRender = -1e9;
    let lastForecastS: number | null = null;
    let lastForecastMs = -1e9;
    let radioSeen = game.state.radio.length;
    let nextSampleS = 0;
    const history = historyRef.current;

    const loop = (ms: number) => {
      const sp = speedRef.current;
      const r = frameTicks(prevMs, ms, sp);
      prevMs = sp > 0 ? r.lastMs : null;
      for (const dt of r.calls) game.tick(dt);
      const st = game.state;
      if (st !== lastState) {
        lastState = st;
        dirty.current = true;
        c.update(st, game.commands, new Set(selRef.current), layersRef.current);
        if (st.tS >= nextSampleS) { history.push({ tS: st.tS, ha: st.score.burnedHa }); nextSampleS = st.tS + HISTORY_EVERY_S; }
        if (st.radio.length > radioSeen) {
          const fresh: readonly RadioMessage[] = st.radio.slice(radioSeen);
          radioSeen = st.radio.length;
          for (const m of fresh) if (m.priority === "urgent") toast(inLang(lang, m.textFi, m.textEn), "urgent");
          if (paneRef.current !== "radio") setUnread((n) => n + fresh.length);
        }
        if (st.phase === "won" || st.phase === "lost" || st.phase === "ended") {
          if (!finishedRef.current) {
            finishedRef.current = true;
            history.push({ tS: st.tS, ha: st.score.burnedHa });
            onFinish({ phase: st.phase, score: st.score, endedAtS: st.tS, history, assetStatus: st.assetStatus });
          }
          return;
        }
      }
      if (layersRef.current.forecast && forecastDue(lastForecastS, st.tS) && ms - lastForecastMs > 400) {
        lastForecastS = st.tS;
        lastForecastMs = ms;
        c.setForecast(computeForecast(st, game.scenario.weather, world.grid));
      }
      const realDt = lastFrameMs === null ? 0 : Math.min(MAX_REAL_DT_S, Math.max(0, (ms - lastFrameMs) / 1000));
      lastFrameMs = ms;
      c.frame(st, ms, sp > 0 ? realDt : 0, layersRef.current.truth);
      if (dirty.current && ms - lastRender >= RENDER_EVERY_MS) { dirty.current = false; lastRender = ms; setVersion((v) => v + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // The forecast toggle: clear when off, recompute on the next frame when on.
    const offForecast = () => { lastForecastS = null; lastForecastMs = -1e9; };
    forecastReset.current = offForecast;
    return () => { cancelAnimationFrame(raf); c.destroy(); ctl.current = null; };
    // eslint-disable-next-line
  }, [game]);
  const forecastReset = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!layers.forecast) ctl.current?.setForecast(null);
    forecastReset.current();
    refreshMap();
    // eslint-disable-next-line
  }, [layers]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < OVERLAY_BELOW_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keys: Space pause, 1–4 speed, Esc cancel / deselect, order letters.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " ") { e.preventDefault(); setSpeed(togglePause(speedRef.current, resumeRef.current)); return; }
      const sp = speedByKey(e.key);
      if (sp !== null) { setSpeed(sp); return; }
      if (e.key === "Escape") {
        if (tgtRef.current.kind !== "none") target({ type: "cancel" });
        else if (selRef.current.length > 0) { setSelected([]); refreshMap(); }
        return;
      }
      const o = orderByKey(e.key);
      if (o && selRef.current.length > 0) {
        const units = game.state.units.filter((u) => selRef.current.includes(u.id));
        if (ordersForSelection(units.map((u) => u.kind)).includes(o)) { e.preventDefault(); target({ type: "choose", order: o }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [game]);

  const st = game.state;
  const selSet = new Set(selected);
  const selUnits = st.units.filter((u) => selSet.has(u.id));
  const orders = ordersForSelection(selUnits.map((u) => u.kind));
  const openPane = (p: PaneId) => { setPane((cur) => (cur === p ? null : p)); if (p === "radio") setUnread(0); };
  const selectFromList = (id: string, add: boolean) => {
    setSelected(nextSelection(selRef.current, id, add));
    const u = st.units.find((x) => x.id === id);
    if (u && u.status !== "en_route" && !add) ctl.current?.flyTo(u.pos);
    if (narrow) setPane(null);
    refreshMap();
  };
  // Quitting ends the game where it stands and shows the debrief ("time is up" with the score so far).
  const quit = () => {
    if (!window.confirm(t.hud.quitConfirm)) return;
    const s = game.state;
    finishedRef.current = true;
    onFinish({ phase: "ended", score: s.score, endedAtS: s.tS, history: [...historyRef.current, { tS: s.tS, ha: s.score.burnedHa }], assetStatus: s.assetStatus });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} data-testid="game-screen">
      <Hud lang={lang} scenario={game.scenario} world={world} state={st} speed={speed} onSpeed={setSpeed} onQuit={quit} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <div ref={mapEl} class="gm-map" data-testid="game-map" style={{ position: "absolute", inset: 0 }} />
          {!started && speed === 0 && (
            <div data-testid="game-ready" style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 16, width: "min(440px, calc(100% - 24px))", padding: "12px 16px", borderRadius: TAK.radius, background: "#0d1114f0", border: `1px solid ${TAK.accent}`, boxShadow: "0 6px 22px #000c", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.ready}</div>
                <div style={{ fontSize: 12.5, color: TAK.textDim, lineHeight: 1.4 }}>{t.readyHint}</div>
              </div>
              <button type="button" class="gm-btn primary" onClick={() => setSpeed(resumeRef.current)} data-testid="game-go" style={{ fontSize: 18, padding: "6px 16px" }}>▶</button>
            </div>
          )}
          {selUnits.length > 0 && (
            <OrderBar lang={lang} units={selUnits} orders={orders} targeting={targeting} startClockMin={game.scenario.startClockMin}
              onChoose={(o) => target({ type: "choose", order: o })} onNearestWater={nearestWaterForAll} onCancel={() => target({ type: "cancel" })}
              onDeselect={() => { setTargeting(NO_TARGETING); setSelected([]); refreshMap(); }} />
          )}
          <div aria-live="polite" style={{ position: "absolute", top: narrow ? 8 : 12, left: 8, zIndex: 17, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }} data-testid="game-toasts">
            {toasts.map((x) => <div key={x.id} class={`gm-toast ${x.kind === "bad" ? "bad" : x.kind === "urgent" ? "urgent" : ""}`} role={x.kind === "ok" ? "status" : "alert"}>{x.kind === "urgent" && <b style={{ color: GM.fire }}>⚠ </b>}{x.text}</div>)}
          </div>
        </div>
        {pane && (
          <div style={narrow ? { position: "absolute", top: 0, bottom: 0, left: 0, right: 58, zIndex: 22, display: "flex" } : { display: "flex" }}>
            <SidePane lang={lang} pane={pane} overlay={narrow} onClose={() => setPane(null)}>
              {pane === "units" && <UnitsPane lang={lang} units={st.units} selected={selSet} startClockMin={game.scenario.startClockMin} onSelect={selectFromList} />}
              {pane === "radio" && <RadioPane lang={lang} radio={st.radio} startClockMin={game.scenario.startClockMin} onLocate={(m) => { if (m.at) ctl.current?.flyTo(m.at); }} />}
              {pane === "objectives" && <ObjectivesPane lang={lang} scenario={game.scenario} world={world} state={st} />}
              {pane === "layers" && <LayersPane lang={lang} layers={layers} onToggle={(id) => setLayers((cur) => ({ ...cur, [id]: !cur[id] }))} />}
              {pane === "help" && <HelpPane lang={lang} />}
            </SidePane>
          </div>
        )}
        <GameToolbar lang={lang} open={pane} onSelect={openPane} unread={unread} narrow={narrow} />
      </div>
    </div>
  );
}

export type { Layers };
