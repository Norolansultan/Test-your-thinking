/**
 * Decision task `fire` (SPEC/34 §4): a wind shift forecast at +30 min.
 *
 * A pine-heath fire east of the forest road beyond the Kotkanjoki river (east of the map, 3 km from anything the study
 * keys) runs east in a westerly; a cold front turns the wind north and up to 10 m/s at 09:40, and the long south flank
 * becomes a broad head running south. `HEAD_PATH` is that ground, south of the flank. On seed 3405: the reference (north
 * flank and heel) keeps every crew out of it and unhurt, 31 ha burned; doing nothing 42 ha; crews on the south flank or
 * at the eastern head are caught by the turned head (harm 5–30 %).
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { crewsClearOf, maxBurnedHa, noCrewHarm, type Zone } from "../../tasks/criteria.js";
import { at, radio, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 9 * 60; // 09:00
const T = (hhmm: string): number => at(START, hhmm);
const FIRE = pt(9150, 3700);
const PLAN = T("09:10");
const TURN = T("09:40");
const HORIZON = 50 * 60;
/** The ground south of the fire that the head crosses once the wind turns north. */
const HEAD_PATH: Zone = { minX: 8950, minY: 3150, maxX: 9700, maxY: 3560 };
const UNITS = [
  { id: "EK11", kind: "engine", arriveAtS: 0 },
  { id: "VPK", kind: "volunteer", arriveAtS: 0 },
  { id: "EK13", kind: "tanker", arriveAtS: 0 },
] as const;

// DRAFT fi
const PROMPT_FI = [
  "Klo 09.10. Kotkanjoen itäpuolisen metsäautotien itäpuolella palaa noin 4 ha kangasmetsää. Länsituuli (5–6 m/s) ajaa paloa itään.",
  "SÄÄ varoittaa kylmästä rintamasta: noin klo 09.40 tuuli kääntyy pohjoiseen ja voimistuu 10 m/s:iin. Silloin palon pitkä eteläkylki muuttuu leveäksi kärjeksi, joka juoksee etelään.",
  "Käytössäsi ovat EK11, VPK:n säiliöauto ja säiliöauto EK13 metsäautotiellä palon länsipuolella. Sijoita miehistöt niin, ettei kukaan ole uuden kärjen tiellä tuulen kääntyessä, ja pidä paloala alle 36 hehtaarissa.",
].join("\n\n");
const PROMPT_EN = [
  "09:10. East of the forest road beyond the Kotkanjoki river about 4 ha of pine heath is burning. A westerly (5–6 m/s) drives the fire east.",
  "The weather service warns of a cold front: around 09:40 the wind turns north and rises to 10 m/s. The fire's long south flank then becomes a broad head running south.",
  "You have EK11, the volunteer brigade's tank truck VPK and the tanker EK13 on the forest road west of the fire. Place the crews so that nobody stands in the new head's path when the wind turns, and keep the burned area under 36 ha.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-fire",
  titleFi: "Tehtävä: tuulenkääntö", // DRAFT fi
  titleEn: "Task: wind shift",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [FIRE],
  preBurnS: 30 * 60,
  weather: [
    wx(START, "09:00", 270, 6, 9, 20, 32),
    wx(START, "09:30", 280, 5, 8, 21, 31),
    wx(START, "09:40", 350, 8, 12, 22, 27),
    wx(START, "09:50", 0, 10, 15, 23, 24),
    wx(START, "10:10", 0, 10, 15, 24, 23),
  ],
  units: UNITS,
  events: [
    // DRAFT fi
    { atS: T("09:08"), kind: "weather_warning", message: radio(T("09:08"), "SÄÄ", "support", "important",
      "SÄÄ: Kylmä rintama saapuu: tuuli kääntyy klo 09.40 aikaan pohjoiseen ja voimistuu 8–10 m/s:iin, puuskat 15 m/s. Ilma kuivuu.",
      "WEATHER: A cold front is arriving: around 09:40 the wind turns north and rises to 8–10 m/s, gusts 15 m/s. The air is drying.") },
  ],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_FIRE: DecisionTask = {
  id: "task-fire",
  topic: "fire",
  titleFi: "Tuulenkääntö 30 minuutin päästä", // DRAFT fi
  titleEn: "A wind shift in 30 minutes",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3405,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "move", to: pt(8860, 3760) }),
    cmd(0, "VPK", { type: "move", to: pt(8880, 3800) }),
    cmd(0, "EK13", { type: "move", to: pt(8840, 3720) }),
  ],
  horizonS: HORIZON,
  criteria: [
    crewsClearOf("crews_clear", HEAD_PATH, TURN - 300, TURN + 15 * 60, "kärjen tiellä", "in the head's path", START, UNITS), // DRAFT fi
    noCrewHarm(0, START),
    maxBurnedHa(36),
  ],
  reference: {
    commands: [
      cmd(PLAN, "EK11", { type: "attack", target: pt(9250, 3800) }),
      cmd(PLAN, "VPK", { type: "attack", target: pt(9050, 3720) }),
      cmd(PLAN, "EK13", { type: "shuttle", waterPointId: "kuivakankaan-oja", toUnitId: "EK11" }),
    ],
    // DRAFT fi
    explanationFi: "Työskentele palon pohjoiskyljellä ja perässä: EK11 pohjoiskyljelle, VPK perään tien puolelle, ja EK13 ajaa vettä EK11:lle pohjoisen ojan vesipisteeltä. Tuulen kääntyessä pohjoiskylki muuttuu peräksi, ja miehistöt ovat palaneen alueen reunalla. Eteläkylki ja itäinen kärki jätetään: eteläkyljen edessä oleva maasto on uuden kärjen tie, eikä sinne ehditä tehdä valmista ennen käännettä.",
    explanationEn: "Work the north flank and the heel: EK11 on the north flank, VPK at the heel by the road, and EK13 shuttling water to EK11 from the ditch to the north. When the wind turns, the north flank becomes the heel and the crews stand at the edge of the burned ground. The south flank and the eastern head are left alone: the ground in front of the south flank is the new head's path, and no work there can be finished before the turn.",
  },
  // DRAFT fi
  debriefFi: [
    "Ennustettu tuulenkääntö tekee kyljestä kärjen: katso, mikä kylki on tuulen alapuolella käännön jälkeen.",
    "Turvallisin työpaikka on palaneen alueen reunalla sillä kyljellä, josta tulee perä.",
    "Älä aloita uuden kärjen tiellä työtä, jota et ehdi lopettaa ennen käännettä.",
    "Ennen käännettä tarkista LACES: tähystäjä, yhteydet, pakotiet ja turvapaikat.",
  ],
  debriefEn: [
    "A forecast wind shift turns a flank into the head: work out which flank lies downwind after the turn.",
    "The safest place to work is at the edge of the burned ground on the flank that becomes the heel.",
    "Do not start work in the new head's path that you cannot finish before the turn.",
    "Before the turn, check LACES: lookouts, communications, escape routes and safety zones.",
  ],
};
