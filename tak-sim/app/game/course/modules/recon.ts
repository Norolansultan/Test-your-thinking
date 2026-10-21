/**
 * Course module 3 (SPEC/34 §3): the picture — what the units have seen, the drones, the age of the information.
 * Finnish texts DRAFT (native-speaker check), doctrine DRAFT (domain reviewer).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { RECON_EXERCISE } from "../exercises/recon.js";

export const RECON_MODULE: CourseModule = {
  id: "recon",
  topic: "recon",
  // DRAFT fi
  titleFi: "Tilannekuva ja tiedustelu",
  titleEn: "The picture and reconnaissance",
  pages: [
    {
      // DRAFT fi
      headingFi: "Kartalla on vain nähty",
      headingEn: "The map shows only what was seen",
      // DRAFT fi
      bodyFi: "Kartallasi näkyy palo vain siellä, missä joku yksikkö on sen nähnyt. Alussa sinulla on vain ensimmäinen ilmoitus: noin 150 metriä ilmoitetun paikan ympäriltä.\n- Himmennetty maasto: kukaan ei ole vielä katsonut sinne.\n- Haalistuva palon merkki: tieto on vanhaa, palo on voinut edetä.\n\nTyhjä kohta kartalla ei tarkoita, ettei siellä pala.",
      bodyEn: "Fire shows on your map only where some unit has seen it. At the start you have only the first report: about 150 metres around the reported place.\n- Dimmed ground: nobody has looked there yet.\n- A fading fire mark: the information is old, the fire may have moved on.\n\nA blank spot on the map does not mean nothing burns there.",
    },
    {
      // DRAFT fi
      headingFi: "Droonit ja miehistöt tiedustelijoina",
      headingEn: "Drones and crews as scouts",
      // DRAFT fi
      bodyFi: "- Lämpökamerakopteri näkee noin 600 metrin päähän myös savun läpi. Akku kestää noin 35 minuuttia, vaihto johtopaikalla vie 5 minuuttia.\n- VTOL-drooni kartoittaa laajasti (noin 800 m) ja lentää noin 2,5 tuntia.\n- Miehistöt näkevät metsässä vain noin 250 metriä, eivätkä savun läpi.\n\nKäske drooni tiedustelemaan alueen keskipistettä; se kiertää sen ja päivittää kuvaa koko ajan.",
      bodyEn: "- The thermal drone sees about 600 m, through smoke too. Its battery lasts about 35 minutes; a swap at the command post takes 5.\n- The VTOL drone maps widely (about 800 m) and flies for about 2.5 hours.\n- Crews in the forest see only about 250 m, and not through smoke.\n\nOrder a drone to recon an area's centre; it circles it and keeps the picture current.",
      view: { centre: { x: 7500, y: 7900 }, widthM: 2400 },
    },
    {
      // DRAFT fi
      headingFi: "Kuinka vanha tieto on?",
      headingEn: "How old is the information?",
      // DRAFT fi
      bodyFi: "Kysy jokaisesta tiedosta: kuka sen näki ja milloin? Päivitä kuva ennen tärkeitä päätöksiä, esimerkiksi ennen kuin siirrät yksiköitä tai tuuli kääntyy.\n\nSuurissa maastopaloissa havaintoja on jäänyt matkalle: valvontalentäjä näki palon leviävän, mutta tieto ei tavoittanut johtopaikkaa. Varmista, että tiedustelun tulokset tulevat sinulle asti.",
      bodyEn: "Ask of every piece of information: who saw it, and when? Renew the picture before important decisions, for example before you move units or the wind turns.\n\nIn large forest fires, observations have got lost on the way: a surveillance pilot saw the fire spreading, but the word never reached the command post. Make sure your reconnaissance reaches you.",
    },
  ],
  exercise: RECON_EXERCISE,
  checks: [
    {
      id: "recon-blank",
      // DRAFT fi
      promptFi: "Kartalla on palon vieressä himmennetty alue. Mitä se tarkoittaa?",
      promptEn: "Next to the fire the map shows a dimmed area. What does it mean?",
      options: [
        { textFi: "Siellä ei pala", textEn: "Nothing burns there" },
        { textFi: "Kukaan ei ole vielä nähnyt sinne", textEn: "Nobody has seen into it yet" },
        { textFi: "Se on vettä", textEn: "It is water" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Himmennys on tuntematonta aluetta. Palo voi edetä siellä huomaamatta, kunnes drooni tai yksikkö käy katsomassa.",
      explanationEn: "The dimming is unknown ground. Fire can spread there unnoticed until a drone or a unit goes to look.",
    },
    {
      id: "recon-battery",
      // DRAFT fi
      promptFi: "Kuinka kauan lämpökamerakopterin akku suunnilleen kestää?",
      promptEn: "About how long does the thermal drone's battery last?",
      options: [
        { textFi: "Noin 10 minuuttia", textEn: "About 10 minutes" },
        { textFi: "Noin 35 minuuttia", textEn: "About 35 minutes" },
        { textFi: "Noin 3 tuntia", textEn: "About 3 hours" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Noin 35 minuuttia, ja vaihto johtopaikalla vie 5 minuuttia. Pitkään kartoitukseen sopii VTOL-drooni (noin 2,5 h).",
      explanationEn: "About 35 minutes, and a swap at the command post takes 5. For long mapping use the VTOL drone (about 2.5 h).",
    },
    {
      id: "recon-age",
      // DRAFT fi
      promptFi: "Palon merkki on haalistunut. Mitä teet ennen kuin siirrät yksiköt sen eteen?",
      promptEn: "A fire mark has faded. What do you do before moving units ahead of it?",
      options: [
        { textFi: "Luotan vanhaan tietoon", textEn: "Trust the old information" },
        { textFi: "Lähetän droonin tai yksikön katsomaan uudelleen", textEn: "Send a drone or a unit to look again" },
        { textFi: "Siirrän yksiköt kauemmas varmuuden vuoksi", textEn: "Move the units further away to be safe" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Haalistunut merkki on vanhaa tietoa: palo on voinut edetä. Uusi havainto ennen siirtoa estää lähettämästä miehistöä palon eteen.",
      explanationEn: "A faded mark is old information: the fire may have moved. A fresh look before the move keeps you from sending a crew in front of the fire.",
    },
  ],
};
