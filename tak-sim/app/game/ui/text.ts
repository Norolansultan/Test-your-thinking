/**
 * Game mode screen: every interface string, Finnish and English (same keys; the `GameText` type makes a missing
 * English string a type error). Game mode keeps its own strings: nothing here is the study's (`app/i18n/ui.ts`).
 */

import type { GamePhase, GameScenario, GameWorld, Objective, RadioMessage, UnitKind, UnitStatus } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import type { OrderType } from "./orders.js";

export type PaneId = "units" | "radio" | "objectives" | "layers" | "help";
export type LayerId = "fog" | "fuel" | "forecast" | "labels" | "sensors" | "truth";
export type TargetHintId = "point_move" | "point_attack" | "point_hose_line" | "point_recon" | "point_drop" | "break_from" | "break_to" | "water" | "shuttle_water" | "shuttle_unit" | "protect";

export interface GameText {
  readonly modeTitle: string;
  readonly back: string;
  readonly selectTitle: string;
  readonly selectNote: string;
  readonly difficulty: Readonly<Record<GameScenario["difficulty"], string>>;
  readonly startsAt: string;
  readonly unitsCount: (n: number) => string;
  readonly choose: string;
  readonly briefing: string;
  readonly objectives: string;
  readonly weather: string;
  readonly units: string;
  readonly arrivesAt: (clock: string) => string;
  readonly onScene: string;
  readonly start: string;
  readonly ignition: string;
  readonly commandPost: string;
  readonly protect: string;
  readonly objective: (o: Objective, world: GameWorld, startClockMin: number) => string;
  readonly hud: {
    readonly pause: string; readonly play: string; readonly speed: string;
    readonly wind: string; readonly gust: string; readonly temp: string; readonly rh: string;
    readonly burned: string; readonly assetsLost: string; readonly points: string; readonly clock: string;
    readonly quit: string; readonly quitConfirm: string;
    /** Phone-width labels. */
    readonly tempShort: string; readonly rhShort: string; readonly burnedShort: string; readonly assetsLostShort: string; readonly pointsShort: string;
  };
  readonly ready: string;
  readonly readyHint: string;
  readonly toolbar: Readonly<Record<PaneId, string>>;
  readonly paneTitle: Readonly<Record<PaneId, string>>;
  readonly closePane: string;
  readonly kind: Readonly<Record<UnitKind, string>>;
  readonly status: Readonly<Record<UnitStatus, string>>;
  /** Out of action because the region took the unit (harm < 1), and because of a casualty (harm 1). */
  readonly released: string;
  readonly casualty: string;
  readonly order: Readonly<Record<OrderType, string>>;
  readonly hint: Readonly<Record<TargetHintId, string>>;
  readonly escCancels: string;
  readonly cancel: string;
  readonly nearestWater: string;
  readonly selected: (n: number) => string;
  readonly deselect: string;
  readonly water: string;
  readonly energy: string;
  readonly harm: string;
  readonly eta: (clock: string) => string;
  readonly orderRejected: string;
  readonly orderGiven: (unit: string, order: string) => string;
  readonly rooms: Readonly<Record<RadioMessage["room"] | "all", string>>;
  readonly noMessages: string;
  readonly layers: Readonly<Record<LayerId, string>>;
  readonly layerNote: Readonly<Record<LayerId, string>>;
  readonly windChange: string;
  readonly fireLegend: string;
  readonly fireStates: { readonly burning: string; readonly crown: string; readonly smouldering: string; readonly burnedOut: string; readonly extinguished: string; readonly stale: string };
  readonly fuelLegend: string;
  readonly fuel: readonly string[];
  readonly forecastLabel: (min: number) => string;
  readonly powerLine: (live: boolean) => string;
  readonly objectiveState: { readonly met: string; readonly failed: string; readonly open: string };
  readonly help: readonly (readonly [keys: string, what: string])[];
  readonly debrief: {
    readonly title: string; readonly outcome: Readonly<Record<Extract<GamePhase, "won" | "lost" | "ended">, string>>;
    readonly grade: string; readonly points: string; readonly burnedArea: string; readonly burnedOverTime: string;
    readonly assetsLost: string; readonly settlementsLost: string; readonly none: string; readonly casualties: string;
    readonly containedAt: string; readonly notContained: string; readonly playAgain: string; readonly back: string;
    readonly hectares: string; readonly time: string;
  };
}

const clockOf = (startClockMin: number, s: number): string => {
  const m = startClockMin + Math.floor(s / 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
};

/** A clock label for `s` seconds after the scenario's start. */
export function clockAt(startClockMin: number, s: number): string {
  return clockOf(startClockMin, s);
}

const settlementName = (world: GameWorld, id: string, lang: Lang): string => {
  const s = world.settlements.find((x) => x.id === id || x.nameFi === id || x.nameEn === id);
  return s ? (lang === "fi" ? s.nameFi : s.nameEn) : id;
};

const FI: GameText = {
  modeTitle: "Pelitila — komentajan peli",
  back: "Takaisin",
  selectTitle: "Valitse tilanne",
  selectNote: "Pelitila on erillinen peli tutkimuksen maastossa. Se ei ole osa tutkimusta, eikä siitä tallenneta mitään.",
  difficulty: { easy: "Helppo", normal: "Normaali", hard: "Vaikea" },
  startsAt: "Alkaa",
  unitsCount: (n) => `${n} yksikköä`,
  choose: "Valitse",
  briefing: "Tilannekatsaus",
  objectives: "Tavoitteet",
  weather: "Sää",
  units: "Yksiköt",
  arrivesAt: (c) => `saapuu ${c}`,
  onScene: "paikalla",
  start: "Aloita peli",
  ignition: "Syttymiskohta",
  commandPost: "Johtopaikka",
  protect: "Suojattava",
  objective: (o, w, start) => {
    switch (o.kind) {
      case "protect_settlement": return `Suojaa ${settlementName(w, o.settlementId, "fi")}`;
      case "contain": return `Rajaa palo klo ${clockOf(start, o.byS)} mennessä`;
      case "limit_area": return `Paloala alle ${o.maxHa} ha`;
      case "no_casualties": return "Ei henkilövahinkoja";
    }
  },
  hud: {
    pause: "Tauko", play: "Jatka", speed: "Nopeus", wind: "Tuuli", gust: "puuskissa", temp: "Lämpötila", rh: "Kosteus",
    burned: "Palanut", assetsLost: "Rakennuksia menetetty", points: "Pisteet", clock: "Kello", quit: "Lopeta", quitConfirm: "Lopetetaanko peli ja siirrytään yhteenvetoon?",
    tempShort: "Läm.", rhShort: "RH", burnedShort: "Palanut", assetsLostShort: "Menet.", pointsShort: "Pisteet",
  },
  ready: "Peli on pysäytetty",
  readyHint: "Valitse yksikkö ja anna käsky. Käynnistä aika ⏵-painikkeella tai välilyönnillä.",
  toolbar: { units: "Yksiköt", radio: "Radio", objectives: "Tavoite", layers: "Tasot", help: "Ohje" },
  paneTitle: { units: "Yksiköt", radio: "Radio / GeoChat", objectives: "Tavoitteet", layers: "Karttatasot", help: "Ohjaus" },
  closePane: "Sulje",
  kind: {
    engine: "Pelastusyksikkö", tanker: "Säiliöauto", forest_unit: "Maastopaloyksikkö", volunteer: "VPK", ugv: "Letkunvetorobotti",
    drone_thermal: "Lämpökamerakopteri", drone_vtol: "VTOL-drooni", drone_water: "Vesidrooni", helicopter: "Sammutushelikopteri", spotter: "Palovartiolentokone",
  },
  status: { en_route: "Tulossa", idle: "Valmiina", moving: "Siirtyy", working: "Työssä", refilling: "Täyttää", returning: "Palaa", out_of_action: "Poissa toiminnasta" },
  released: "Vapautettu", casualty: "Henkilövahinko",
  order: {
    move: "Siirry", attack: "Hyökkää", hose_line: "Letkulinja", fire_break: "Palokatko", refill: "Täytä", shuttle: "Vesisukkula",
    recon: "Tiedustele", drop: "Pudota vesi", protect: "Suojaa", hold: "Pysy",
  },
  hint: {
    point_move: "Napauta määränpää kartalta", point_attack: "Napauta palon reunaa, johon hyökätään", point_hose_line: "Napauta, mihin letkulinja vedetään",
    point_recon: "Napauta tiedustelualueen keskipiste", point_drop: "Napauta pudotuskohta", break_from: "Napauta palokatkon alkupää",
    break_to: "Napauta palokatkon loppupää", water: "Napauta vesipistettä — tai Lähin", shuttle_water: "Napauta vesipistettä, josta vettä ajetaan",
    shuttle_unit: "Napauta yksikköä, jota huolletaan", protect: "Napauta taloa tai kylää",
  },
  escCancels: "Esc peruu",
  cancel: "Peru",
  nearestWater: "Lähin vesipiste",
  selected: (n) => (n === 1 ? "1 valittu" : `${n} valittu`),
  deselect: "Poista valinta",
  water: "Vesi",
  energy: "Energia",
  harm: "Kuormitus",
  eta: (c) => `perillä ${c}`,
  orderRejected: "Käsky hylättiin",
  orderGiven: (u, o) => `${u}: ${o}`,
  rooms: { all: "Kaikki", ground: "Maa", air: "Ilma", command: "Johto", support: "Tuki" },
  noMessages: "Ei viestejä vielä.",
  layers: { fog: "Tuntematon alue (sumu)", fuel: "Polttoaine (metsätyypit)", forecast: "Ennuste +20 / +40 min", labels: "Nimet ja tunnukset", sensors: "Anturien kantamat", truth: "Totuus (debug)" },
  layerNote: {
    fog: "Maasto, jota kukaan ei ole vielä nähnyt, on himmennetty: palo voi edetä siellä huomaamatta. Lähetä drooni tai yksikkö katsomaan.",
    fuel: "13 polttoaineluokkaa: mistä palo kulkee nopeasti ja mistä ei.",
    forecast: "Mallin ennuste palon reunasta 20 ja 40 minuutin päähän; päivittyy enintään 30 pelisekunnin välein. Ei tunne lentokipinöitä.",
    labels: "Yksiköiden tunnukset, kylien ja vesipisteiden nimet.",
    sensors: "Mitä kukin yksikkö näkee: drooneilla laaja, miehistöillä pieni.",
    truth: "Näyttää todellisen palon sumun läpi. Vain kehitykseen.",
  },
  windChange: "Tuulen muutos",
  fireLegend: "Palo (oma tilannekuva)",
  fireStates: { burning: "Liekehtii", crown: "Latvapalo", smouldering: "Kytee", burnedOut: "Palanut", extinguished: "Sammutettu", stale: "Vanha tieto haalistuu" },
  fuelLegend: "Polttoaineluokat",
  fuel: ["Vesi", "Soratie", "Pelto", "Kangasmänniköt", "Varttunut kuusikko", "Harvennettu kuusikko", "Koivikko / haavikko", "Ojitettu turvemaa", "Johtoaukea", "Rakennettu", "Avosuo", "Metsätie", "Puro"],
  forecastLabel: (m) => `Ennuste +${m} min (malli)`,
  powerLine: (live) => (live ? "110 kV jännitteinen — ei vettä 30 m sisällä" : "110 kV maadoitettu"),
  objectiveState: { met: "saavutettu", failed: "epäonnistui", open: "kesken" },
  help: [
    ["Napautus / klikkaus", "Valitse yksikkö (kartalta tai Yksiköt-listasta)"],
    ["Vaihto + klikkaus", "Lisää yksikkö valintaan"],
    ["M A H B R S C D P X", "Käskyt: siirry, hyökkää, letkulinja, palokatko, täytä, vesisukkula, tiedustele, pudota, suojaa, pysy"],
    ["Oikea painike", "Siirrä valitut yksiköt (työpöytä)"],
    ["Esc", "Peru kohdistus, sitten valinta"],
    ["Välilyönti", "Tauko / jatka"],
    ["1 2 3 4", "Nopeus 1×, 5×, 15×, 60×"],
    ["Rulla / nipistys", "Lähennä ja loitonna"],
  ],
  debrief: {
    title: "Yhteenveto", outcome: { won: "Voitto — palo rajattu", lost: "Tappio", ended: "Aika päättyi" },
    grade: "Arvosana", points: "Pisteet", burnedArea: "Paloala", burnedOverTime: "Paloala ajan funktiona",
    assetsLost: "Rakennuksia menetetty", settlementsLost: "Kyliä menetetty", none: "ei yhtään", casualties: "Henkilövahingot",
    containedAt: "Rajattu klo", notContained: "ei rajattu", playAgain: "Pelaa uudelleen", back: "Takaisin", hectares: "ha", time: "kello",
  },
};

const EN: GameText = {
  modeTitle: "Game mode — commander's game",
  back: "Back",
  selectTitle: "Choose a scenario",
  selectNote: "Game mode is a separate game on the study's terrain. It is not part of the study and nothing from it is recorded.",
  difficulty: { easy: "Easy", normal: "Normal", hard: "Hard" },
  startsAt: "Starts",
  unitsCount: (n) => `${n} units`,
  choose: "Choose",
  briefing: "Briefing",
  objectives: "Objectives",
  weather: "Weather",
  units: "Units",
  arrivesAt: (c) => `arrives ${c}`,
  onScene: "on scene",
  start: "Start the game",
  ignition: "Ignition",
  commandPost: "Command post",
  protect: "Protect",
  objective: (o, w, start) => {
    switch (o.kind) {
      case "protect_settlement": return `Protect ${settlementName(w, o.settlementId, "en")}`;
      case "contain": return `Contain the fire by ${clockOf(start, o.byS)}`;
      case "limit_area": return `Keep the burned area under ${o.maxHa} ha`;
      case "no_casualties": return "No casualties";
    }
  },
  hud: {
    pause: "Pause", play: "Resume", speed: "Speed", wind: "Wind", gust: "gusting", temp: "Temperature", rh: "Humidity",
    burned: "Burned", assetsLost: "Buildings lost", points: "Points", clock: "Clock", quit: "Quit", quitConfirm: "End this game and go to the debrief?",
    tempShort: "Temp", rhShort: "RH", burnedShort: "Burned", assetsLostShort: "Lost", pointsShort: "Points",
  },
  ready: "The game is paused",
  readyHint: "Select a unit and give an order. Start the clock with ⏵ or Space.",
  toolbar: { units: "Units", radio: "Radio", objectives: "Goals", layers: "Layers", help: "Help" },
  paneTitle: { units: "Units", radio: "Radio / GeoChat", objectives: "Objectives", layers: "Map layers", help: "Controls" },
  closePane: "Close",
  kind: {
    engine: "Rescue engine", tanker: "Water tanker", forest_unit: "Forest-fire unit", volunteer: "Volunteer brigade", ugv: "Hose-laying robot",
    drone_thermal: "Thermal drone", drone_vtol: "VTOL mapping drone", drone_water: "Water drone", helicopter: "Firefighting helicopter", spotter: "Fire-spotting aircraft",
  },
  status: { en_route: "En route", idle: "Idle", moving: "Moving", working: "Working", refilling: "Refilling", returning: "Returning", out_of_action: "Out of action" },
  released: "Released", casualty: "Casualty",
  order: {
    move: "Move", attack: "Attack", hose_line: "Hose line", fire_break: "Fire break", refill: "Refill", shuttle: "Shuttle",
    recon: "Recon", drop: "Drop", protect: "Protect", hold: "Hold",
  },
  hint: {
    point_move: "Click the destination on the map", point_attack: "Click the fire edge to attack", point_hose_line: "Click where the hose line should run",
    point_recon: "Click the centre of the area to observe", point_drop: "Click where to drop the water", break_from: "Click the start of the fire break",
    break_to: "Click the end of the fire break", water: "Click a water point — or Nearest", shuttle_water: "Click the water point to draw from",
    shuttle_unit: "Click the unit to keep supplied", protect: "Click a house or a settlement",
  },
  escCancels: "Esc cancels",
  cancel: "Cancel",
  nearestWater: "Nearest water",
  selected: (n) => `${n} selected`,
  deselect: "Deselect",
  water: "Water",
  energy: "Energy",
  harm: "Strain",
  eta: (c) => `arrives ${c}`,
  orderRejected: "Order refused",
  orderGiven: (u, o) => `${u}: ${o}`,
  rooms: { all: "All", ground: "Ground", air: "Air", command: "Command", support: "Support" },
  noMessages: "No messages yet.",
  layers: { fog: "Unknown ground (fog)", fuel: "Fuel (forest types)", forecast: "Forecast +20 / +40 min", labels: "Names and call signs", sensors: "Sensor ranges", truth: "Truth (debug)" },
  layerNote: {
    fog: "Ground nobody has seen yet is dimmed: fire can spread there unnoticed. Send a drone or a unit to look.",
    fuel: "13 fuel classes: where the fire runs fast and where it does not.",
    forecast: "The model's forecast of the fire edge 20 and 40 minutes ahead; refreshed at most every 30 game seconds. It cannot know which embers will take.",
    labels: "Unit call signs, settlement and water point names.",
    sensors: "What each unit sees: drones far, crews near.",
    truth: "Shows the real fire through the fog of war. Development only.",
  },
  windChange: "Wind change",
  fireLegend: "Fire (your picture)",
  fireStates: { burning: "Flaming", crown: "Crown fire", smouldering: "Smouldering", burnedOut: "Burned out", extinguished: "Put out", stale: "Old reports fade" },
  fuelLegend: "Fuel classes",
  fuel: ["Water", "Gravel road", "Field", "Pine heath", "Mature spruce", "Thinned spruce", "Birch / aspen", "Drained peat", "Power-line corridor", "Built-up", "Open bog", "Forest road", "Brook"],
  forecastLabel: (m) => `Forecast +${m} min (model)`,
  powerLine: (live) => (live ? "110 kV live — no water within 30 m" : "110 kV earthed"),
  objectiveState: { met: "met", failed: "failed", open: "open" },
  help: [
    ["Tap / click", "Select a unit (on the map or in the Units list)"],
    ["Shift + click", "Add a unit to the selection"],
    ["M A H B R S C D P X", "Orders: move, attack, hose line, fire break, refill, shuttle, recon, drop, protect, hold"],
    ["Right-click", "Move the selected units (desktop)"],
    ["Esc", "Cancel targeting, then the selection"],
    ["Space", "Pause / resume"],
    ["1 2 3 4", "Speed 1×, 5×, 15×, 60×"],
    ["Wheel / pinch", "Zoom in and out"],
  ],
  debrief: {
    title: "Debrief", outcome: { won: "Victory — fire contained", lost: "Defeat", ended: "Time is up" },
    grade: "Grade", points: "Points", burnedArea: "Burned area", burnedOverTime: "Burned area over time",
    assetsLost: "Buildings lost", settlementsLost: "Settlements lost", none: "none", casualties: "Casualties",
    containedAt: "Contained at", notContained: "not contained", playAgain: "Play again", back: "Back", hectares: "ha", time: "clock",
  },
};

export const GAME_TEXT: Readonly<Record<Lang, GameText>> = { fi: FI, en: EN };

/** A radio message, a scenario's title and briefing, a place name: the language's own field. */
export const inLang = (lang: Lang, fi: string, en: string): string => (lang === "fi" ? fi : en);
