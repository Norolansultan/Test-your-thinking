/**
 * Course module 4 (SPEC/34 §3): the orders, and anchor-and-flank. Finnish texts DRAFT (native-speaker check),
 * doctrine DRAFT (domain reviewer).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { ORDERS_EXERCISE } from "../exercises/orders.js";

export const ORDERS_MODULE: CourseModule = {
  id: "orders",
  topic: "orders",
  // DRAFT fi
  titleFi: "Käskyt",
  titleEn: "The orders",
  pages: [
    {
      // DRAFT fi
      headingFi: "Mitä yksiköille voi käskeä",
      headingEn: "What you can order",
      // DRAFT fi
      bodyFi: "- Hyökkää: suora hyökkäys palon reunaan vedellä. Miehistö ei mene liian kuumaan reunaan.\n- Letkulinja: letku vedetään ajoneuvolta tai luonnonvedestä, ja linja pidetään märkänä.\n- Palokatko: maastopaloyksikkö tai robotti raivaa polttoaineen pois kaistalta.\n- Täytä ja vesisukkula: vettä vesipisteestä; säiliöauto ajaa vettä toiselle yksikölle.\n- Tiedustele, pudota vesi, suojaa rakennukset, siirry, pysy.\n\nValitse yksikkö, sitten käsky ja lopuksi kohde kartalta.",
      bodyEn: "- Attack: a direct attack on the fire's edge with water. Crews will not go to an edge that is too hot.\n- Hose line: hose laid from the vehicle or from natural water, and the line kept wet.\n- Fire break: the forest-fire unit or the robot clears the fuel from a strip.\n- Refill and shuttle: water from a water point; a tanker carries water to another unit.\n- Recon, drop water, protect buildings, move, hold.\n\nSelect a unit, then the order, then the target on the map.",
    },
    {
      // DRAFT fi
      headingFi: "Ankkuri ja sivustat",
      headingEn: "Anchor and flanks",
      // DRAFT fi
      bodyFi: "Jokainen sammutuslinja alkaa ankkurista: tiestä, ojasta, vedestä tai jo palaneesta alueesta, jonka taakse palo ei pääse kiertämään.\n\nAnkkurista edetään sivustoja pitkin kohti kärkeä (pihtiliike). Kärkeen hyökätään suoraan vain, kun liekit ovat matalia; muuten kärki pysäytetään sen edessä olevaan esteeseen tai ilmasta.\n- Työskentele tuulen yläpuolelta aina kun voit.",
      bodyEn: "Every control line starts from an anchor: a road, a ditch, water or ground that has already burned, so the fire cannot get round behind the crew.\n\nFrom the anchor, work along the flanks toward the head (a pincer). Attack the head directly only when the flames are low; otherwise stop it at a barrier ahead of it, or from the air.\n- Work from upwind whenever you can.",
      view: { centre: { x: 3000, y: 3150 }, widthM: 1400 },
    },
    {
      // DRAFT fi
      headingFi: "Käskyn antaminen ja palaute",
      headingEn: "Giving an order and the feedback",
      // DRAFT fi
      bodyFi: "Yksiköt kuittaavat käskyt radiossa ja kertovat, kun säiliö tyhjenee, reuna on liian kuuma tai palo tulee päälle. Jos käsky hylätään, syy näkyy ilmoituksessa.\n\nAnna jokaiselle yksikölle oma tehtävä ja paikka. Samaan pisteeseen lähetetyt yksiköt tekevät samaa työtä, ja muu reuna jää hoitamatta.",
      bodyEn: "Units acknowledge orders on the radio and report when the tank runs dry, the edge is too hot or the fire comes at them. If an order is refused, the reason shows in the notice.\n\nGive each unit its own task and place. Units sent to the same point do the same work while the rest of the edge goes untended.",
    },
  ],
  exercise: ORDERS_EXERCISE,
  checks: [
    {
      id: "orders-anchor",
      // DRAFT fi
      promptFi: "Mikä on ankkuri?",
      promptEn: "What is an anchor?",
      options: [
        { textFi: "Este, jonka taakse palo ei pääse kiertämään, ja josta linja aloitetaan", textEn: "A barrier the fire cannot get round, where the line starts" },
        { textFi: "Paikka, johon ajoneuvot pysäköidään", textEn: "Where the vehicles park" },
        { textFi: "Palon kärki", textEn: "The fire's head" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Ankkuri on tie, oja, vesi tai palanut alue. Siitä aloitettu linja ei jää palon kiertämäksi, ja miehistöllä on turvallinen paikka selän takana.",
      explanationEn: "An anchor is a road, a ditch, water or burned ground. A line started there cannot be outflanked, and the crew has a safe place behind it.",
    },
    {
      id: "orders-break",
      // DRAFT fi
      promptFi: "Mikä yksikkö voi raivata palokatkon?",
      promptEn: "Which unit can cut a fire break?",
      options: [
        { textFi: "Säiliöauto", textEn: "The water tanker" },
        { textFi: "Maastopaloyksikkö (ja letkunvetorobotti)", textEn: "The forest-fire unit (and the hose-laying robot)" },
        { textFi: "Lämpökamerakopteri", textEn: "The thermal drone" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Maastopaloyksiköllä on sahat ja robotilla terä. Palokatko etenee hitaasti (noin 150–250 m tunnissa), joten se tehdään hyvissä ajoin palon edelle.",
      explanationEn: "The forest-fire unit has saws and the robot a blade. A fire break goes slowly (about 150–250 m an hour), so cut it well ahead of the fire.",
    },
    {
      id: "orders-start",
      // DRAFT fi
      promptFi: "Palo kasvaa, ja kärjessä liekit ovat 2 m. Mistä aloitat?",
      promptEn: "The fire is growing and the flames at the head are 2 m. Where do you start?",
      options: [
        { textFi: "Ankkurista perän luota ja sivustoja pitkin", textEn: "From an anchor at the heel, along the flanks" },
        { textFi: "Kärjen edestä, kaikki miehistöt", textEn: "In front of the head, every crew" },
        { textFi: "Keskeltä palanutta aluetta", textEn: "In the middle of the burned area" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Ankkurista sivustoja pitkin edeten palo kapenee, eikä miehistö joudu kärjen eteen. Kärjen eteen ei mennä, kun liekit kasvavat.",
      explanationEn: "Working from an anchor along the flanks narrows the fire without putting crews in front of the head. Nobody goes in front of a growing head.",
    },
  ],
};
