/**
 * Course exercise, module 3 (recon): the picture holds only what units have seen. One fire is reported in the forest
 * east of Korpilaakso; a second smoke was glimpsed about a kilometre north-east of it and is on nobody's map. Find it
 * with DR1 within 15 minutes. 08:00–08:15, north-east of the study's area, far from its point of origin.
 */

import { fireSeenNear } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRST = { x: 7300, y: 7600 };
const SECOND = { x: 7900, y: 8300 };

export const RECON_EXERCISE = exercise({
  id: "course-recon",
  topic: "recon",
  // DRAFT fi
  titleFi: "Toinen savu",
  titleEn: "The second smoke",
  // DRAFT fi
  promptFi: "Kartallasi on yksi ilmoitettu palo. Ohi ajanut kertoi nähneensä toisenkin savun noin kilometri sen koillispuolella, mutta kukaan ei ole käynyt katsomassa. Löydä toinen palo lämpökamerakopteri DR1:llä 15 minuutin kuluessa.",
  promptEn: "One reported fire is on your map. A passing driver says he saw a second smoke about a kilometre north-east of it, but nobody has been to look. Find the second fire with the thermal drone DR1 within 15 minutes.",
  startClockMin: 8 * 60,
  horizonS: 15 * 60,
  ignitions: [FIRST],
  preBurnS: 10 * 60,
  weather: morningWeather(225, 3, 15 * 60, 15, 50),
  units: [
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "EK21", kind: "engine", arriveAtS: 0 },
  ],
  events: [{ atS: 0, kind: "ignite", at: SECOND }],
  criteria: [
    // DRAFT fi
    fireSeenNear("second_found", SECOND, 200, "Toinen palo löytyi", "The second fire was found"),
  ],
  reference: [["DR1", { type: "recon", centre: { x: 7900, y: 8300 } }]],
  // DRAFT fi
  explanationFi: "Ensimmäinen palo on jo kartalla, joten DR1 lähetetään suoraan ilmoitettuun suuntaan, noin kilometri koilliseen. Lämpökamera näkee savun läpi noin 600 metrin säteellä; kopteri on paikalla 6 minuutissa.",
  explanationEn: "The first fire is already on the map, so DR1 goes straight to the reported direction, about a kilometre north-east. The thermal camera sees through smoke for about 600 m around it; the drone is there in 6 minutes.",
  // DRAFT fi
  debriefFi: [
    "Kartta näyttää vain sen, minkä yksiköt ovat nähneet: tyhjä kohta ei tarkoita, ettei siellä pala.",
    "Lämpökamerakopterin akku kestää noin 35 minuuttia; suunnittele vaihto ennen kuin tarvitset kuvaa.",
    "Merkitse, kuinka vanha tieto on: haalistunut palon merkki on vanhaa tietoa.",
  ],
  debriefEn: [
    "The map shows only what your units have seen: a blank spot does not mean nothing burns there.",
    "The thermal drone's battery lasts about 35 minutes; plan the swap before you need the picture.",
    "Note how old the information is: a faded fire mark is an old report.",
  ],
});
