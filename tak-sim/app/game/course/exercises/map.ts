/**
 * Course exercise, module 1 (map): find a place by its name on the maastokartta. A caller reports smoke on the north
 * shore of Karhujärvi; nothing is on the player's map yet. 07:30–07:40, north-west of the command post, far from the
 * study's point of origin.
 */

import { fireSeenNear } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

/** The unreported fire, beside Karhujärvi's northern water point. */
const SMOKE = { x: 3000, y: 7950 };

export const MAP_EXERCISE = exercise({
  id: "course-map",
  topic: "map",
  // DRAFT fi
  titleFi: "Paikka kartalta",
  titleEn: "Find the place on the map",
  // DRAFT fi
  promptFi: "Metsänomistaja soittaa hätäkeskukseen: savua Karhujärven pohjoisrannalla, metsäautotien varressa. Kartallasi ei näy vielä mitään. Etsi Karhujärvi kartalta ja lähetä lämpökamerakopteri DR1 katsomaan. Palon pitää näkyä kartallasi 10 minuutin kuluessa.",
  promptEn: "A forest owner calls the emergency centre: smoke on the north shore of Karhujärvi, beside the forest road. Nothing shows on your map yet. Find Karhujärvi on the map and send the thermal drone DR1 to look. The fire must be on your map within 10 minutes.",
  startClockMin: 7 * 60 + 30,
  horizonS: 10 * 60,
  ignitions: [],
  weather: morningWeather(225, 3, 600, 14, 55),
  units: [
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "EK41", kind: "engine", arriveAtS: 0 },
  ],
  events: [{ atS: 0, kind: "ignite", at: SMOKE }],
  criteria: [
    // DRAFT fi
    fireSeenNear("found", SMOKE, 200, "Palo löytyi Karhujärven pohjoisrannalta", "The fire on Karhujärvi's north shore was found"),
  ],
  reference: [["DR1", { type: "recon", centre: { x: 3000, y: 7900 } }]],
  // DRAFT fi
  explanationFi: "Karhujärvi on johtopaikan luoteispuolella, noin 2,7 km päässä. Pohjoisranta on järven yläreuna kartalla; siellä on myös vesipiste. DR1 lentää sinne 3–4 minuutissa ja näkee lämpökameralla savun läpi.",
  explanationEn: "Karhujärvi lies north-west of the command post, about 2.7 km away. The north shore is the lake's upper edge on the map; there is a water point there too. DR1 flies there in 3–4 minutes and sees through the smoke with its thermal camera.",
  // DRAFT fi
  debriefFi: [
    "Kartan pohjoinen on ylhäällä; järvien ja purojen nimet auttavat paikantamaan ilmoituksen.",
    "Ilmoittajan kuvaama paikka on usein epätarkka: tiedustele laajemmin kuin yhden pisteen.",
    "Ennen kuin yksikkö on nähnyt palon, se ei ole kartallasi.",
  ],
  debriefEn: [
    "North is up on the map; the names of lakes and brooks help you place a report.",
    "A caller's place is often vague: scout wider than a single point.",
    "Until a unit has seen the fire, it is not on your map.",
  ],
});
