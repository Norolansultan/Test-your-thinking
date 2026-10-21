/**
 * Decision task `protect` (SPEC/34 §4): buildings in the fire's path, resources for two.
 *
 * A field fire south-west of the farm by the Peltola ditch (south-east of the map, 2 km east of Lahdenkylä but running
 * away from it, in the morning) spreads north-north-east over the fields to the farm: the farmhouse (house-029) and two
 * barns. The roadside house by the main road and the barn west of the river are near, but behind the ditch and the
 * river. Two engines wait at the road junction east of the farm; one engine protects one building. On seed 3406: the
 * reference (farmhouse and one barn) saves both and loses one barn; doing nothing loses all three; both barns instead
 * loses the farmhouse; a unit sent to the roadside house leaves the barns to burn.
 *
 * SPEC/34 §4 sketched "three cabins and a farm": the shared map has no cabin group on a fire path outside the study's
 * places (Mökkiranta is free play's village), so the task uses the farm's buildings and two decoys.
 */

import type { GameScenario } from "../../contracts.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { assetsIntact, noCasualties } from "../../tasks/criteria.js";
import { at, wx } from "../places.js";
import { cmd, pt } from "./common.js";

const START = 10 * 60; // 10:00
const T = (hhmm: string): number => at(START, hhmm);
const FIRE = pt(8900, 1420);
const PLAN = T("10:04");
const HORIZON = 45 * 60;
const FARM = ["house-029", "barn-009", "barn-010"];

// DRAFT fi
const PROMPT_FI = [
  "Klo 10.04. Peltolan tilan lounaispuolen pellolla syttynyt palo leviää etelälounaistuulessa (5 m/s) kohti tilaa: päärakennusta ja kahta latoa.",
  "Lähellä ovat myös tienvarren talo päätien varressa Peltolan ojan takana ja lato joen länsipuolella.",
  "Käytössäsi ovat pelastusyksiköt EK11 ja EK12 tienhaarassa tilan itäpuolella. Yksi yksikkö suojaa (vesitys ja sprinklerit) yhden rakennuksen. Päätä, mitkä rakennukset suojaat.",
].join("\n\n");
const PROMPT_EN = [
  "10:04. A fire that started in the field south-west of the Peltola farm spreads in a south-south-westerly (5 m/s) toward the farm: the farmhouse and two barns.",
  "Close by are also the roadside house on the main road, beyond the Peltola ditch, and a barn west of the river.",
  "You have the engines EK11 and EK12 at the road junction east of the farm. One engine protects one building (wetting and sprinklers). Decide which buildings you protect.",
].join("\n\n");

const scenario: GameScenario = {
  id: "task-protect",
  titleFi: "Tehtävä: kohdesuojaus", // DRAFT fi
  titleEn: "Task: structure protection",
  briefingFi: PROMPT_FI,
  briefingEn: PROMPT_EN,
  startClockMin: START,
  endAtS: PLAN + HORIZON,
  difficulty: "normal",
  ignitions: [FIRE],
  preBurnS: 8 * 60,
  weather: [wx(START, "10:00", 200, 5, 8, 24, 26), wx(START, "11:00", 205, 5, 8, 25, 25)],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0, entryNode: 1 },
    { id: "EK12", kind: "engine", arriveAtS: 0, entryNode: 1 },
  ],
  events: [],
  objectives: [{ kind: "no_casualties" }],
  powerLineLiveAtStart: true,
};

export const TASK_PROTECT: DecisionTask = {
  id: "task-protect",
  topic: "protect",
  titleFi: "Kohdesuojaus: mitä voidaan pelastaa", // DRAFT fi
  titleEn: "Structure protection: what can be saved",
  promptFi: PROMPT_FI,
  promptEn: PROMPT_EN,
  scenario,
  seed: 3406,
  planAtS: PLAN,
  setup: [
    cmd(0, "EK11", { type: "move", to: pt(9560, 1700) }),
    cmd(0, "EK12", { type: "move", to: pt(9560, 1760) }),
  ],
  horizonS: HORIZON,
  criteria: [
    assetsIntact("farmhouse", ["house-029"], "Peltolan päärakennus", "The Peltola farmhouse"), // DRAFT fi
    assetsIntact("farm", FARM, "Peltolan tila", "The Peltola farm", 2), // DRAFT fi
    noCasualties(),
  ],
  reference: {
    commands: [
      cmd(PLAN, "EK11", { type: "protect", assetOrSettlementId: "house-029" }),
      cmd(PLAN, "EK12", { type: "protect", assetOrSettlementId: "barn-009" }),
    ],
    // DRAFT fi
    explanationFi: "Palo ehtii ensin tilalle, joten molemmat yksiköt suojaavat tilan rakennuksia: EK11 päärakennuksen (asuinrakennus ensin) ja EK12 isomman ladon. Kolmatta rakennusta ei kahdella yksiköllä voi suojata. Tienvarren talo ja joenvarren lato ovat ojan ja joen takana: palo ei ehdi niihin tämän ajan kuluessa, joten niille lähetetty yksikkö olisi poissa sieltä, missä sitä tarvitaan.",
    explanationEn: "The fire reaches the farm first, so both engines protect the farm's buildings: EK11 the farmhouse (dwellings first) and EK12 the larger barn. Two engines cannot hold a third building. The roadside house and the riverside barn lie behind the ditch and the river: the fire does not reach them in this time, so an engine sent there would be missing where it is needed.",
  },
  // DRAFT fi
  debriefFi: [
    "Arvioi ensin, mihin palo ehtii ja milloin: suojaa sen tiellä olevat rakennukset, älä kaikkia näkyviä.",
    "Asuinrakennukset ensin, sitten muut – ihmishenget aina ennen omaisuutta.",
    "Yksi suojausyksikkö kattaa yhden kohteen: kaikkea ei voi pelastaa, ja se on päätettävä ajoissa.",
    "Ojat, joet ja tiet ovat esteitä: niiden takana olevat rakennukset eivät ole ensimmäisinä vaarassa.",
  ],
  debriefEn: [
    "First judge where the fire will get to and when: protect the buildings in its path, not every building in sight.",
    "Dwellings first, then the rest — lives always before property.",
    "One protection set-up covers one building: not everything can be saved, and that is decided early.",
    "Ditches, rivers and roads are barriers: the buildings behind them are not the first in danger.",
  ],
};
