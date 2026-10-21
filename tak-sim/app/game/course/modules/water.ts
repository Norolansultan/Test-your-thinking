/**
 * Course module 5 (SPEC/34 §3): water logistics. Finnish texts DRAFT (native-speaker check), doctrine DRAFT (domain
 * reviewer). The tank sizes and rates are the game's (`sim/unit-specs.ts`, PROVISIONAL).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { WATER_EXERCISE } from "../exercises/water.js";

export const WATER_MODULE: CourseModule = {
  id: "water",
  topic: "water",
  // DRAFT fi
  titleFi: "Vesihuolto",
  titleEn: "Water supply",
  pages: [
    {
      // DRAFT fi
      headingFi: "Kuinka kauan vesi riittää",
      headingEn: "How long the water lasts",
      // DRAFT fi
      bodyFi: "Maastopalot sammutetaan Suomessa pääosin vedellä, ja vesi loppuu nopeasti:\n- Pelastusyksikkö 3 000 l, kaksi letkua noin 300 l/min → noin 10 minuuttia.\n- VPK:n säiliöauto 5 000 l.\n- Säiliöauto 14 000 l: ei hyökkää itse, vaan ajaa vettä muille.\n- Maastopaloyksikkö 600 l, mutta pumppu ottaa vettä luonnonvedestä.\n\nLaske ennen hyökkäystä, kuinka kauan vesi riittää ja mistä lisää saadaan.",
      bodyEn: "Forest fires in Finland are fought mainly with water, and water runs out fast:\n- Rescue engine 3,000 l, two lines at about 300 l/min → about 10 minutes.\n- A volunteer brigade's tank truck 5,000 l.\n- Water tanker 14,000 l: it does not attack itself but carries water to others.\n- Forest-fire unit 600 l, but its pump draws natural water.\n\nBefore the attack, work out how long the water lasts and where more will come from.",
    },
    {
      // DRAFT fi
      headingFi: "Vesipisteet",
      headingEn: "Water points",
      // DRAFT fi
      bodyFi: "Vesipisteet ovat järviä, lampia, jokia ja puroja, joiden rantaan pääsee ajoneuvolla. Täyttö kestää pelastusyksiköltä noin 3 minuuttia (1 000 l/min).\n\nMittaa matka tietä pitkin, älä linnuntietä: järvi 500 metrin päässä voi olla tietä pitkin kolmen kilometrin päässä.",
      bodyEn: "Water points are lakes, ponds, rivers and brooks whose shore a vehicle can reach. A rescue engine fills in about 3 minutes (1,000 l/min).\n\nMeasure the way along the road, not as the crow flies: a lake 500 m away can be three kilometres away by road.",
      view: { centre: { x: 3700, y: 6000 }, widthM: 1800 },
    },
    {
      // DRAFT fi
      headingFi: "Säiliöauton vesisukkula",
      headingEn: "The tanker's shuttle",
      // DRAFT fi
      bodyFi: "Vesisukkula-käskyllä säiliöauto täyttää itsensä valitussa vesipisteessä ja ajaa vettä valitulle yksikölle, niin että se pysyy linjalla. Ilman huoltoa tyhjä yksikkö lähtee itse täyttämään ja on poissa linjalta 10–15 minuuttia.\n\nSuurissa maastopaloissa veden saanti palolle on pettänyt kriittisellä hetkellä. Varmista vesihuolto ennen kuin tarvitset sitä.",
      bodyEn: "With the shuttle order the tanker fills itself at the chosen water point and carries water to the chosen unit, so that unit stays on the line. Without supply an empty unit leaves to refill itself and is off the line for 10–15 minutes.\n\nIn large forest fires the water supply has failed at the critical moment. Secure it before you need it.",
    },
  ],
  exercise: WATER_EXERCISE,
  checks: [
    {
      id: "water-minutes",
      // DRAFT fi
      promptFi: "Pelastusyksikön säiliössä on 3 000 l ja se käyttää noin 300 l/min. Kuinka kauan vesi riittää?",
      promptEn: "A rescue engine carries 3,000 l and uses about 300 l/min. How long does the water last?",
      options: [
        { textFi: "Noin 3 minuuttia", textEn: "About 3 minutes" },
        { textFi: "Noin 10 minuuttia", textEn: "About 10 minutes" },
        { textFi: "Noin tunnin", textEn: "About an hour" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "3 000 l ÷ 300 l/min = 10 min. Siksi huolto suunnitellaan heti hyökkäyksen alussa.",
      explanationEn: "3,000 l ÷ 300 l/min = 10 min. That is why the supply is planned right at the start of the attack.",
    },
    {
      id: "water-shuttle",
      // DRAFT fi
      promptFi: "Mitä vesisukkula tekee?",
      promptEn: "What does the shuttle do?",
      options: [
        { textFi: "Säiliöauto sammuttaa paloa itse", textEn: "The tanker fights the fire itself" },
        { textFi: "Säiliöauto ajaa vettä vesipisteestä toiselle yksikölle", textEn: "The tanker carries water from a water point to another unit" },
        { textFi: "Helikopteri hakee vettä järvestä", textEn: "A helicopter fetches water from a lake" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Säiliöauto on vesihuollon yksikkö: se pitää hyökkäävän yksikön säiliön täynnä, jotta tämä ei joudu lähtemään linjalta.",
      explanationEn: "The tanker is a supply unit: it keeps the attacking unit's tank full so that it does not have to leave the line.",
    },
    {
      id: "water-distance",
      // DRAFT fi
      promptFi: "Mistä vesipisteestä säiliöauto kannattaa täyttää?",
      promptEn: "Which water point should the tanker fill at?",
      options: [
        { textFi: "Linnuntietä lähimmästä", textEn: "The nearest as the crow flies" },
        { textFi: "Tietä pitkin nopeimmin saavutettavasta", textEn: "The quickest to reach by road" },
        { textFi: "Suurimmasta järvestä", textEn: "The largest lake" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Säiliöauto kulkee vain teitä pitkin. Tietä pitkin lähin vesipiste lyhentää jokaista kierrosta.",
      explanationEn: "The tanker travels only on roads. The nearest water point by road shortens every round trip.",
    },
  ],
};
