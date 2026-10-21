/**
 * Decision task `water` (SPEC/34 §4): keep two attacking engines supplied for 45 min with one tanker and the nearest
 * water by road.
 *
 * A peat fire west of the Hiekkala ditch, by the main road in the south-west (4 km from anything the study keys). In
 * the situation (`setup`) EK11 is attacking on its own tank, the tanker EK13 has been told to shuttle to it from
 * Kivijärvi (1.6 km on the map, 6.6 km by road) and EK12 has stopped on the ditch bridge — a water point. On seed
 * 3402: the reference meets every criterion; doing nothing leaves EK12 idle and the shuttle on Kivijärvi; the tanker
 * on EK12 instead leaves EK11 dry for 14 min; EK12 attacking on its own tank runs dry.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { keptSupplied, shuttleDrawsFrom } from "../../tasks/criteria.js";
import { at, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 9 * 60 + 30; // 09:30
const T = (hhmm: string): number => at(START, hhmm);
const FIRE = pt(1800, 1750);
const PLAN = T("09:55");
const HORIZON = 45 * 60;

// DRAFT fi
const PROMPT_FI = [
  "Klo 09.55. Kivijärven ja Hiekkalan ojan välisellä turvemaalla palaa. EK11 sammuttaa palon reunaa oman 3 m³:n säiliönsä varassa; säiliö riittää noin kymmeneksi minuutiksi.",
  "EK12 on juuri pysähtynyt päätielle Hiekkalan ojan sillalle. Säiliöauto EK13 (14 m³) on käsketty ajamaan vettä EK11:lle Kivijärveltä: järvi näyttää kartalla läheiseltä (1,6 km), mutta tietä pitkin sinne on 6,6 km. Ojan silta on tietä pitkin 0,7 km:n päässä.",
  "Pidä molemmat pelastusyksiköt työssä ja vedessä seuraavat 45 minuuttia.",
].join("\n\n");
const PROMPT_EN = [
  "09:55. A fire burns on the drained peat between Kivijärvi and the Hiekkala ditch. EK11 is attacking the edge on its own 3 m³ tank, which lasts about ten minutes.",
  "EK12 has just stopped on the main road at the Hiekkala ditch bridge. The tanker EK13 (14 m³) has been told to shuttle water to EK11 from Kivijärvi: the lake looks close on the map (1.6 km), but it is 6.6 km by road. The ditch bridge is 0.7 km by road.",
  "Keep both engines working and in water for the next 45 minutes.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-water",
  titleFi: "Tehtävä: vesihuolto", // DRAFT fi
  titleEn: "Task: water supply",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [FIRE],
  preBurnS: 30 * 60,
  weather: [wx(START, "09:30", 225, 7, 11, 22, 27), wx(START, "11:00", 230, 7, 11, 24, 25)],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "EK12", kind: "engine", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
  ],
  events: [],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_WATER: DecisionTask = {
  id: "task-water",
  topic: "water",
  titleFi: "Vesihuolto: kaksi yksikköä, yksi säiliöauto", // DRAFT fi
  titleEn: "Water supply: two engines, one tanker",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3402,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "attack", target: pt(1850, 1800) }),
    cmd(0, "EK12", { type: "move", to: pt(2290, 1500) }),
    cmd(0, "EK13", { type: "shuttle", waterPointId: "kivijarvi-2", toUnitId: "EK11" }),
  ],
  horizonS: HORIZON,
  criteria: [
    keptSupplied("EK11", PLAN, PLAN + HORIZON, START, 0, 0.5),
    keptSupplied("EK12", PLAN + 10 * 60, PLAN + HORIZON, START, 0, 0.5),
    // DRAFT fi
    shuttleDrawsFrom("EK13", "hiekkalan-oja", "Hiekkalan ojan silta", "the Hiekkala ditch bridge",
      "Silta on tietä pitkin 0,7 km, Kivijärvi 6,6 km.", "The bridge is 0.7 km by road, Kivijärvi 6.6 km."),
  ],
  reference: {
    commands: [
      cmd(PLAN, "EK11", { type: "attack", target: pt(1950, 1950) }),
      cmd(PLAN, "EK12", { type: "hose_line", to: pt(2000, 1850) }),
      cmd(PLAN, "EK13", { type: "shuttle", waterPointId: "hiekkalan-oja", toUnitId: "EK11" }),
    ],
    // DRAFT fi
    explanationFi: "EK12 on jo vesipisteellä: se vetää letkulinjan sillalta ojan vedellä palon itäreunalle, eikä sen vesi lopu. Säiliöauto ajaa vettä EK11:lle ojan sillalta, joka on tietä pitkin lähin vesipiste – Kivijärvi näyttää kartalla läheiseltä, mutta sinne ajetaan tietä pitkin lähes kymmenkertainen matka. EK11 seuraa palon reunaa pohjoiseen.",
    explanationEn: "EK12 is already at a water point: it lays a hose line from the bridge on the ditch's water to the fire's eastern edge, and its water never runs out. The tanker shuttles to EK11 from the ditch bridge, the nearest water by road — Kivijärvi looks close on the map, but by road it is nearly ten times the distance. EK11 follows the edge north.",
  },
  // DRAFT fi
  debriefFi: [
    "Pelastusyksikön 3 m³ riittää yhdellä suihkulla noin kymmeneksi minuutiksi: veden riittävyys on mitoitettava heti.",
    "Luonnonvesi (oja, lampi) letkulinjalla ei lopu; säiliöauto kannattaa kohdistaa yksikölle, jolla luonnonvettä ei ole.",
    "Vesipiste valitaan ajomatkan, ei linnuntien mukaan: tarkista reitti tiestöä pitkin.",
  ],
  debriefEn: [
    "An engine's 3 m³ lasts about ten minutes on one line: size the water supply at once.",
    "Natural water (a ditch, a pond) on a hose line does not run out; give the tanker to the unit that has none.",
    "Choose the water point by driving distance, not as the crow flies: check the route along the roads.",
  ],
};
