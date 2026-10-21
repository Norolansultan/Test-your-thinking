/**
 * Decision task `mopup` (SPEC/34 §4): a contained fire in drained peat — put out the smouldering edge.
 *
 * A fire on the ditched peat along the Mökkiranta ditch (north-west of the map, 2.5 km from anything the study keys)
 * burns from 06:00, lies down in the dew at 07:15 and is contained by the planning moment: no flames, a smouldering
 * edge. The day dries: from about 08:20 the south-easterly is over 6 m/s and the humidity under 35 %, and the edge
 * flares up (`fire/spread.ts`, REKINDLE_*). The units drive in during the night part (`setup`). On seed 3407: the
 * reference has the edge out by 08:15; doing nothing, one engine alone, or the two crews without the tanker leave a
 * smouldering edge that flares up after 08:20.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { noFlamesFrom, nothingLeftBurning } from "../../tasks/criteria.js";
import { at, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 6 * 60; // 06:00
const T = (hhmm: string): number => at(START, hhmm);
const PLAN = T("07:30");
const HORIZON = 60 * 60;
const CENTRE = pt(1020, 6980);

// DRAFT fi
const PROMPT_FI = [
  "Klo 07.30. Mökkirannan ojan varren ojitetulla turvemaalla aamuyöllä palanut palo on rajattu: liekkejä ei enää ole, mutta turve kytee palon reunoilla.",
  "Sää kuivuu. Klo 08.20 alkaen kaakkoistuuli voimistuu yli 6 m/s:iin ja ilman kosteus laskee alle 35 %:n – silloin kytevä reuna voi leimahtaa uudelleen.",
  "Käytössäsi ovat lämpökamerakopteri DR1, EK11, maastopaloyksikkö EK14 ja säiliöauto EK13 tiellä palon länsipuolella. Sammuta kytevä reuna niin, ettei palo leimahda uudelleen seuraavan tunnin aikana.",
].join("\n\n");
const PROMPT_EN = [
  "07:30. A fire that burned in the small hours on the ditched peat along the Mökkiranta ditch is contained: there are no flames any more, but the peat smoulders along the edge.",
  "The day is drying. From 08:20 the south-easterly rises above 6 m/s and the humidity falls below 35 % — then the smouldering edge can flare up again.",
  "You have the thermal drone DR1, EK11, the forest-fire unit EK14 and the tanker EK13 on the road west of the fire. Put the smouldering edge out so that the fire does not flare up within the next hour.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-mopup",
  titleFi: "Tehtävä: jälkisammutus", // DRAFT fi
  titleEn: "Task: mop-up",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [pt(975, 7000), pt(1075, 7050), pt(1025, 6925)],
  weather: [
    wx(START, "06:00", 45, 5, 8, 18, 32),
    wx(START, "07:00", 45, 4, 7, 17, 35),
    wx(START, "07:15", 60, 1, 2, 12, 95),
    wx(START, "07:30", 90, 2, 3, 14, 75),
    wx(START, "08:00", 120, 4, 7, 17, 45),
    wx(START, "08:20", 130, 7, 11, 20, 31),
    wx(START, "08:40", 135, 7, 11, 21, 29),
  ],
  units: [
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "EK14", kind: "forest_unit", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
  ],
  events: [],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_MOPUP: DecisionTask = {
  id: "task-mopup",
  topic: "mopup",
  titleFi: "Jälkisammutus turvemaalla", // DRAFT fi
  titleEn: "Mop-up on drained peat",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3407,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "move", to: pt(640, 7040) }),
    cmd(0, "EK14", { type: "move", to: pt(650, 7000) }),
    cmd(0, "EK13", { type: "move", to: pt(630, 7100) }),
  ],
  horizonS: HORIZON,
  criteria: [noFlamesFrom(PLAN, START), nothingLeftBurning(5)],
  reference: {
    commands: [
      cmd(PLAN, "DR1", { type: "recon", centre: CENTRE }),
      cmd(PLAN, "EK11", { type: "attack", target: pt(1000, 7000) }),
      cmd(PLAN, "EK14", { type: "attack", target: pt(1050, 6950) }),
      cmd(PLAN, "EK13", { type: "shuttle", waterPointId: "mokkirannan-oja", toUnitId: "EK11" }),
    ],
    // DRAFT fi
    explanationFi: "DR1 kiertää paloalueen yllä ja näyttää kytevät kohdat (lämpökamera näkee savun läpi). EK11 ja EK14 sammuttavat kytevää reunaa, ja EK13 ajaa vettä EK11:lle Mökkirannan ojalta. Turve vaatii paljon vettä – noin 600 litraa 25 × 25 m:n ruutua kohti liekkien jälkeen – joten vedensiirto ratkaisee. Reuna on sammutettu ennen kuin tuuli nousee.",
    explanationEn: "DR1 orbits over the burned area and shows the smouldering spots (the thermal camera sees through smoke). EK11 and EK14 drown the smouldering edge, and EK13 shuttles water to EK11 from the Mökkiranta ditch. Peat takes a lot of water — about 600 litres per 25 × 25 m cell after the flames — so the water shuttle decides it. The edge is out before the wind rises.",
  },
  // DRAFT fi
  debriefFi: [
    "Palo ei ole sammunut, kun liekit ovat poissa: turve kytee tunteja ja leimahtaa kuivassa tuulessa.",
    "Sammuta ensin reuna, jonka takana on palamatonta maata – sieltä palo lähtee uudelleen.",
    "Lämpökamera löytää kytevät kohdat; tarkista reuna ennen kuin luovutat alueen jälkivartiointiin.",
    "Turpeen jälkisammutus vie moninkertaisesti vettä liekkien sammuttamiseen verrattuna: järjestä vesi ennen kuin aloitat.",
  ],
  debriefEn: [
    "A fire is not out when the flames are gone: peat smoulders for hours and flares up in a dry wind.",
    "Put out the edge with unburned ground behind it first — that is where the fire starts again.",
    "The thermal camera finds the smouldering spots; check the edge before you hand the area over to the fire watch.",
    "Mopping up peat takes many times the water of putting out the flames: arrange the water before you start.",
  ],
};
