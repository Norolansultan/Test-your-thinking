/**
 * Decision task `safety` (SPEC/34 §4): a fire under the live 20 kV line.
 *
 * The 20 kV distribution line crosses the gravel road north of Pirttilampi (south-west, 4 km from anything the study
 * keys); a fire in the cleared line corridor runs north-east along it in a south-westerly. P3 has already asked the
 * distribution company's control centre to switch the line off (the game has no order for the request); the switch-off
 * is confirmed at 08:35, so the whole task lies before the study's F7 window (from 11:20). On seed 3403: the reference
 * keeps it to 6.6 ha with no water near the live line; doing nothing 9.1 ha; the helicopter on the head under the line
 * 7.1 ha but its bucket within 15 m of the live line.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { maxBurnedHa, noCasualties, noWaterNearLiveLine } from "../../tasks/criteria.js";
import { at, radio, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 8 * 60; // 08:00
const T = (hhmm: string): number => at(START, hhmm);
const FIRE = pt(3400, 1900);
const PLAN = T("08:10");
const HORIZON = 45 * 60;

// DRAFT fi
const PROMPT_FI = [
  "Klo 08.10. Pirttilammen pohjoispuolella palaa 20 kV voimajohdon johtoaukealla ja sen reunametsässä. Lounaistuuli (7 m/s) työntää paloa koilliseen johtoaukeaa pitkin.",
  "Johto on jännitteinen: vettä ei saa käyttää 15 m sisällä johdosta. P3 on pyytänyt verkkoyhtiön käyttökeskusta kytkemään johdon jännitteettömäksi; arvio on noin 25 minuuttia.",
  "Käytössäsi ovat EK11, EK12 ja säiliöauto EK13 soratiellä palon lounaispuolella sekä klo 08.15 saapuva sammutushelikopteri HELI1. Pidä paloala alle 8 hehtaarissa 45 minuutin ajan – ilman vettä johdon lähellä ennen kuin johto on jännitteetön.",
].join("\n\n");
const PROMPT_EN = [
  "08:10. North of Pirttilampi a fire burns in the cleared corridor of the 20 kV power line and the forest beside it. A south-westerly (7 m/s) pushes it north-east along the corridor.",
  "The line is live: no water within 15 m of it. P3 has asked the distribution company's control centre to switch the line off; their estimate is about 25 minutes.",
  "You have EK11, EK12 and the tanker EK13 on the gravel road south-west of the fire, and the firefighting helicopter HELI1 arriving at 08:15. Keep the burned area under 8 ha for 45 minutes — with no water near the line until it is dead.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-safety",
  titleFi: "Tehtävä: palo voimajohdon alla", // DRAFT fi
  titleEn: "Task: fire under the power line",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [FIRE],
  preBurnS: 15 * 60,
  weather: [wx(START, "08:00", 225, 7, 11, 20, 30), wx(START, "09:30", 230, 7, 11, 22, 27)],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "EK12", kind: "engine", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
    { id: "HELI1", kind: "helicopter", arriveAtS: T("08:15"), entryNode: 3 },
  ],
  events: [
    {
      atS: T("08:35"), kind: "power_line_dead",
      // DRAFT fi
      message: radio(T("08:35"), "P3", "command", "important",
        "P3: Verkkoyhtiön käyttökeskus: pyytämämme poiskytkentä on tehty, 20 kV johto on jännitteetön ja maadoitettu. Vettä saa käyttää johdon lähellä.",
        "P3: The distribution company's control centre: the switch-off we asked for is done, the 20 kV line is de-energised and earthed. Water may be used near the line."),
    },
  ],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_SAFETY: DecisionTask = {
  id: "task-safety",
  topic: "safety",
  titleFi: "Palo jännitteisen 20 kV johdon alla", // DRAFT fi
  titleEn: "A fire under the live 20 kV line",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3403,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "move", to: pt(3200, 1700) }),
    cmd(0, "EK12", { type: "move", to: pt(3180, 1780) }),
    cmd(0, "EK13", { type: "move", to: pt(3260, 1560) }),
  ],
  horizonS: HORIZON,
  criteria: [noWaterNearLiveLine(START), maxBurnedHa(8), noCasualties()],
  reference: {
    commands: [
      cmd(PLAN, "EK11", { type: "attack", target: pt(3650, 2000) }),
      cmd(PLAN, "EK12", { type: "attack", target: pt(3450, 2100) }),
      cmd(PLAN, "EK13", { type: "shuttle", waterPointId: "pirttilampi", toUnitId: "EK11" }),
      cmd(PLAN, "HELI1", { type: "drop", target: pt(3650, 1850) }),
    ],
    // DRAFT fi
    explanationFi: "Johdon alla ei käytetä vettä ennen kuin käyttökeskus vahvistaa johdon jännitteettömäksi ja maadoitetuksi. EK11 ja EK12 hyökkäävät kyljiltä kohti kärkeä, jättäen johdon alustan väliin, ja EK13 ajaa vettä EK11:lle Pirttilammelta. HELI1 pudottaa vain kaakkoiskyljelle, kauas johdosta: kauha osuu lähimpään liekkiin noin 150 m:n säteellä kohteesta, joten kohde valitaan niin, ettei sillä säteellä ole liekkejä johdon lähellä. Kun johto on jännitteetön, miehistöt sammuttavat myös johdon alla olevan kärjen.",
    explanationEn: "No water goes under the line until the control centre confirms it de-energised and earthed. EK11 and EK12 attack the flanks toward the head, leaving the strip under the line, and EK13 shuttles water to EK11 from Pirttilampi. HELI1 drops only on the south-east flank, far from the line: the bucket goes on the nearest flames within about 150 m of the target, so the target is chosen with no flames near the line inside that radius. Once the line is dead, the crews put out the head under it too.",
  },
  // DRAFT fi
  debriefFi: [
    "Jännitteiseen johtoon osuva vesisuihku voi johtaa virran sammuttajaan: turvaetäisyys pidetään, kunnes jännitteettömyys ja maadoitus on vahvistettu.",
    "Pyydä kytkentää heti, kun palo on johdon lähellä – se vie aikaa, ja sillä välin työskennellään johdosta poispäin.",
    "Savu ja liekit johdon alla voivat aiheuttaa ylilyönnin: miehistöt eivät seiso johdon alla.",
    "Sammutushelikopterin kauhan vesi leviää laajalle: ei pudotuksia jännitteisen johdon lähelle.",
  ],
  debriefEn: [
    "A water jet that reaches a live line can carry the current to the crew: keep the distance until de-energising and earthing are confirmed.",
    "Ask for the switch-off as soon as the fire is near the line — it takes time; meanwhile work away from the line.",
    "Smoke and flames under a line can cause a flashover: crews do not stand under the line.",
    "A helicopter bucket spreads its water widely: no drops near a live line.",
  ],
};
