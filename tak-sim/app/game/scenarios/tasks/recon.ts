/**
 * Decision task `recon` (SPEC/34 §4): two smoke reports, one picture.
 *
 * Two fires start unseen at 07:30 in the northern forests (north of Karhujärvi and north-east of Korpilaakso, 2.5–4 km
 * from anything the study keys); the emergency centre passes on two smoke reports at 07:50 and 07:53, the second about
 * 850 m off the fire. The drones wait at the command post. On seed 3404: the reference maps both fires; doing nothing
 * neither; the thermal drone on the vague report misses the Korpilaakso fire, as does sending both drones to one report.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { fireMapped } from "../../tasks/criteria.js";
import { at, radio, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 7 * 60 + 30; // 07:30
const T = (hhmm: string): number => at(START, hhmm);
const FIRE_A = pt(2250, 8550);
const FIRE_B = pt(6000, 8800);
const REPORT_A = pt(2450, 8700);
const REPORT_B = pt(5300, 9350);
const PLAN = T("07:55");
const HORIZON = 15 * 60;

// DRAFT fi
const PROMPT_FI = [
  "Klo 07.55. Hätäkeskus on välittänyt kaksi savuhavaintoa: metsäkoneen kuljettaja näkee savua Karhujärven pohjoispuolella metsäautotien länsipuolella (paikka melko tarkka), ja ohi ajanut autoilija näki savupatsaan koillisessa Korpilaakson suunnalla (paikka epätarkka – palo voi olla satojen metrien päässä ilmoitetusta).",
  "Kartallasi ei ole vielä kumpaakaan paloa. Johtopaikalla odottavat lämpökamerakopteri DR1 (näkee 600 m, 50 km/h) ja VTOL-drooni DR3 (näkee 800 m, 80 km/h).",
  "Löydä ja kartoita molemmat palot 15 minuutissa.",
].join("\n\n");
const PROMPT_EN = [
  "07:55. The emergency centre has passed on two smoke reports: a forest-machine operator sees smoke north of Karhujärvi, west of the forest road (a fairly exact place), and a passing driver saw a column of smoke to the north-east, toward Korpilaakso (a vague place — the fire may be hundreds of metres from it).",
  "Neither fire is on your map yet. At the command post you have the thermal drone DR1 (sees 600 m, 50 km/h) and the VTOL drone DR3 (sees 800 m, 80 km/h).",
  "Find and map both fires within 15 minutes.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-recon",
  titleFi: "Tehtävä: kaksi savuilmoitusta", // DRAFT fi
  titleEn: "Task: two smoke reports",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [],
  weather: [wx(START, "07:30", 200, 4, 7, 16, 45), wx(START, "08:30", 205, 5, 8, 18, 40)],
  units: [
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "DR3", kind: "drone_vtol", arriveAtS: 0 },
  ],
  events: [
    { atS: 0, kind: "ignite", at: FIRE_A },
    { atS: 0, kind: "ignite", at: FIRE_B },
    // DRAFT fi
    { atS: T("07:50"), kind: "radio", message: radio(T("07:50"), "HÄTÄKESKUS", "command", "important",
      "HÄTÄKESKUS: Metsäkoneen kuljettaja ilmoittaa savua Karhujärven pohjoispuolella, metsäautotien länsipuolella.",
      "EMERGENCY CENTRE: A forest-machine operator reports smoke north of Karhujärvi, west of the forest road.", REPORT_A) },
    { atS: T("07:53"), kind: "radio", message: radio(T("07:53"), "HÄTÄKESKUS", "command", "important",
      "HÄTÄKESKUS: Ohi ajanut autoilija näki savupatsaan koillisessa, arviolta Korpilaakson pohjoispuolella. Paikka epävarma.",
      "EMERGENCY CENTRE: A passing driver saw a column of smoke to the north-east, roughly north of Korpilaakso. The place is uncertain.", REPORT_B) },
  ],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_RECON: DecisionTask = {
  id: "task-recon",
  topic: "recon",
  titleFi: "Kaksi savuilmoitusta, yksi tilannekuva", // DRAFT fi
  titleEn: "Two smoke reports, one picture",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3404,
  planAtS: PLAN,
  horizonS: HORIZON,
  criteria: [
    fireMapped("fire_a", "Karhujärven pohjoispuolen palo", "The fire north of Karhujärvi", FIRE_A, 700), // DRAFT fi
    fireMapped("fire_b", "Korpilaakson palo", "The Korpilaakso fire", FIRE_B, 700), // DRAFT fi
  ],
  reference: {
    commands: [
      cmd(PLAN, "DR1", { type: "recon", centre: REPORT_A }),
      cmd(PLAN, "DR3", { type: "recon", centre: REPORT_B }),
    ],
    // DRAFT fi
    explanationFi: "Molemmat ilmoitukset tiedustellaan heti ja yhtä aikaa. Nopeampi ja laajemmin näkevä DR3 lähetetään epätarkkaan ilmoitukseen Korpilaaksoon: sen kiertorata ja 800 m:n näkyvyys kattavat yli kilometrin säteen, joten palo löytyy, vaikka se on satoja metrejä ilmoitetusta paikasta. DR1 riittää tarkkaan ilmoitukseen Karhujärvellä.",
    explanationEn: "Both reports are scouted at once. The faster, wider-seeing DR3 goes to the vague report at Korpilaakso: its orbit and 800 m view cover more than a kilometre's radius, so it finds the fire even hundreds of metres from the reported place. DR1 is enough for the exact report at Karhujärvi.",
  },
  // DRAFT fi
  debriefFi: [
    "Kartalla on vain se, minkä yksiköt ovat nähneet: kaksi ilmoitusta voi tarkoittaa kahta paloa.",
    "Sovita anturin kattavuus ilmoituksen epätarkkuuteen: epätarkka paikka tarvitsee laajemman näkyvyyden.",
    "Tiedustele kaikki ilmoitukset ennen kuin sidot yksiköt yhteen paloon; vanha tilannekuva johtaa harhaan.",
  ],
  debriefEn: [
    "The map shows only what your units have seen: two reports may mean two fires.",
    "Match the sensor's reach to the report's uncertainty: a vague place needs a wider view.",
    "Scout every report before you tie units to one fire; an old picture misleads.",
  ],
};
