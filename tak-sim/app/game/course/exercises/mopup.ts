/**
 * Course exercise, module 7 (mop-up): a small fire in drained peat west of the command post. The flames are low, but
 * the peat smoulders: the fire is out only when no cell burns or smoulders. Two forest-fire units (which drive off-road
 * and draw natural water) and a thermal drone to find the hot spots. 08:00–09:15.
 */

import { burnedAtMost, fireOut } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRE = { x: 2900, y: 5750 };

export const MOPUP_EXERCISE = exercise({
  id: "course-mopup",
  topic: "mopup",
  // DRAFT fi
  titleFi: "Kytevä turve",
  titleEn: "Smouldering peat",
  // DRAFT fi
  promptFi: "Ojitetulla turvemaalla johtopaikan länsipuolella on palanut tunnin pieni palo. Liekit ovat matalia, mutta turve kytee. Sammuta palo kokonaan: 75 minuutin kuluttua mikään ei saa palaa eikä kytea, ja paloala on enintään 1 ha. Käytössäsi on kaksi maastopaloyksikköä ja lämpökamerakopteri DR5.",
  promptEn: "A small fire has been burning for an hour in drained peat west of the command post. The flames are low, but the peat smoulders. Put the fire out completely: after 75 minutes nothing may burn or smoulder, and at most 1 ha has burned. You have two forest-fire units and the thermal drone DR5.",
  startClockMin: 8 * 60,
  horizonS: 75 * 60,
  ignitions: [FIRE],
  preBurnS: 60 * 60,
  weather: morningWeather(225, 3, 75 * 60, 18, 45),
  units: [
    { id: "EK54", kind: "forest_unit", arriveAtS: 0 },
    { id: "EK55", kind: "forest_unit", arriveAtS: 0 },
    { id: "DR5", kind: "drone_thermal", arriveAtS: 0 },
  ],
  criteria: [fireOut(), burnedAtMost(1)],
  reference: [
    ["EK54", { type: "attack", target: FIRE }],
    ["EK55", { type: "attack", target: FIRE }],
    ["DR5", { type: "recon", centre: FIRE }],
  ],
  // DRAFT fi
  explanationFi: "Molemmat maastopaloyksiköt hyökkäävät paloon: ensin liekit, sitten ne jälkisammuttavat kytevän turpeen solu solulta ja hakevat vettä purosta. DR5 pitää lämpökamerakuvan ajan tasalla, joten kuumat kohdat näkyvät savun läpi.",
  explanationEn: "Both forest-fire units attack the fire: the flames first, then they mop up the smouldering peat cell by cell, fetching water from the brook. DR5 keeps the thermal picture current, so the hot spots show through the smoke.",
  // DRAFT fi
  debriefFi: [
    "Palo ei ole sammunut, kun liekit ovat poissa: turve ja karike kytevät ja voivat syttyä uudelleen tuulen ja auringon kuivattaessa.",
    "Jälkisammutus vie vettä: kytevä turve sammuu vasta läpimärkänä.",
    "Tarkasta reunat lämpökameralla ennen kuin luovutat alueen vartioinnille.",
  ],
  debriefEn: [
    "The fire is not out when the flames are gone: peat and duff smoulder and can rekindle as sun and wind dry them.",
    "Mop-up takes water: smouldering peat goes out only when soaked.",
    "Check the edges with the thermal camera before you hand the area over to patrol.",
  ],
});
