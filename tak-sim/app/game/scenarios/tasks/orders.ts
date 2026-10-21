/**
 * Decision task `orders` (SPEC/34 §4): first arriving units — anchor at the road and flank toward the head.
 *
 * A surface fire on pine heath just west of the north-eastern forest road (east of Korpilaakso, 3 km from anything the
 * study keys), pushed west by an east-south-easterly toward the spruce. EK11, VPK and the tanker EK13 drive in from the
 * command post in the first ten minutes (`setup`) and wait on the road south of the fire. On seed 3401
 * (`test/game/tasks-reference.spec.ts`): the reference keeps it to 3.9 ha; doing nothing 6.7 ha; all three crews at
 * the head 6.4 ha with a crew in the heat; all three into the middle 4.8 ha.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { maxBurnedHa, noCasualties, noCrewHarm } from "../../tasks/criteria.js";
import { at, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 8 * 60 + 40; // 08:40
const T = (hhmm: string): number => at(START, hhmm);
const FIRE = pt(7400, 8900);
const PLAN = T("08:50");
const HORIZON = 40 * 60;

// DRAFT fi
const PROMPT_FI = [
  "Klo 08.50. Metsäautotien länsipuolella palaa kangasmaastossa noin hehtaarin pintapalo. Itäkaakkoistuuli (7 m/s) työntää sitä länteen kohti kuusikkoa.",
  "Pelastusyksikkö EK11, VPK:n säiliöauto ja säiliöauto EK13 ovat juuri saapuneet ja odottavat tiellä palon eteläpuolella.",
  "Anna käskyt: pidä paloala alle 4,5 hehtaarissa seuraavat 40 minuuttia äläkä vie miehistöjä kärjen kuumuuteen.",
].join("\n\n");
const PROMPT_EN = [
  "08:50. West of the forest road a surface fire of about a hectare is burning on pine heath. An east-south-easterly (7 m/s) pushes it west toward the spruce.",
  "Rescue engine EK11, the volunteer brigade's tank truck VPK and the water tanker EK13 have just arrived and wait on the road south of the fire.",
  "Give your orders: keep the burned area under 4.5 ha for the next 40 minutes, and keep the crews out of the head's heat.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-orders",
  titleFi: "Tehtävä: ensimmäiset yksiköt", // DRAFT fi
  titleEn: "Task: first arriving units",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [FIRE],
  preBurnS: 8 * 60,
  weather: [wx(START, "08:40", 100, 7, 11, 22, 28), wx(START, "10:00", 105, 7, 11, 23, 26)],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
  ],
  events: [],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_ORDERS: DecisionTask = {
  id: "task-orders",
  topic: "orders",
  titleFi: "Ensimmäiset yksiköt: ankkuroi ja sivusta", // DRAFT fi
  titleEn: "First arriving units: anchor and flank",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3401,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "move", to: pt(7445, 8760) }),
    cmd(0, "VPK", { type: "move", to: pt(7430, 8700) }),
    cmd(0, "EK13", { type: "move", to: pt(7420, 8650) }),
  ],
  horizonS: HORIZON,
  criteria: [maxBurnedHa(4.5), noCrewHarm(0.03, START), noCasualties()],
  reference: {
    commands: [
      cmd(PLAN, "EK11", { type: "attack", target: pt(7250, 9000) }),
      cmd(PLAN, "VPK", { type: "attack", target: pt(7250, 8860) }),
      cmd(PLAN, "EK13", { type: "shuttle", waterPointId: "kotkanjoki-4", toUnitId: "EK11" }),
    ],
    // DRAFT fi
    explanationFi: "Ankkuroi tiehen ja hyökkää kyljistä kohti kärkeä: EK11 pohjoiskyljelle ja VPK eteläkyljelle, kumpikin tieltä palon perästä alkaen, missä reuna on matala ja palanut alue on turvapaikka. Säiliöauto EK13 ajaa vettä EK11:lle, jonka 3 m³:n säiliö riittäisi muuten vain kymmeneksi minuutiksi. Kärkeen ei hyökätä suoraan: siellä teho on suurin, ja miehistöt joutuisivat vetäytymään.",
    explanationEn: "Anchor at the road and attack the flanks toward the head: EK11 on the north flank and VPK on the south flank, each starting from the road at the heel, where the edge is low and the burned ground is a safety zone. The tanker EK13 shuttles water to EK11, whose 3 m³ tank would otherwise last only ten minutes. Nobody attacks the head directly: the intensity is highest there and the crews would have to pull back.",
  },
  // DRAFT fi
  debriefFi: [
    "Ankkuripiste (tie, pelto, vesistö) estää paloa kiertämästä hyökkääjien taakse: aloita siitä.",
    "Kun kyljet pidetään, kärki kapenee ja hidastuu; kyljet palavat matalampina ja turvallisempina kuin kärki.",
    "Suora hyökkäys kärkeen tuulessa vie miehistöt suurimpaan tehoon ja hukkaa aikaa vetäytymiseen.",
    "Ensimmäisten yksiköiden vesi loppuu nopeasti: järjestä vedensiirto heti alussa.",
  ],
  debriefEn: [
    "An anchor point (a road, a field, water) keeps the fire from getting round behind the crews: start from one.",
    "Hold the flanks and the head narrows and slows; the flanks burn lower and safer than the head.",
    "A direct attack on the head in wind puts crews in the highest intensity and wastes time pulling back.",
    "The first units' water runs out fast: set up the water shuttle from the start.",
  ],
};
