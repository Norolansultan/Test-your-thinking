/**
 * Course module 1 (SPEC/34 §3): reading the maastokartta. Every Finnish text is DRAFT for the native-speaker check and
 * every doctrine statement DRAFT for the domain reviewer.
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { MAP_EXERCISE } from "../exercises/map.js";

export const MAP_MODULE: CourseModule = {
  id: "map",
  topic: "map",
  // DRAFT fi
  titleFi: "Kartan lukeminen",
  titleEn: "Reading the map",
  pages: [
    {
      // DRAFT fi
      headingFi: "Maastokartta",
      headingEn: "The topographic map",
      // DRAFT fi
      bodyFi: "Pelin kartta on maastokartta: pohjoinen on ylhäällä, ja kartan nimet kertovat järvet, purot, suot ja kylät. Ilmoittaja kertoo paikan usein nimellä (\"Karhujärven pohjoisranta\"), joten opettele löytämään nimet nopeasti.\n\nKorkeuskäyrät näyttävät rinteet: mitä tiheämmässä käyrät ovat, sitä jyrkempi rinne.\n- Palo etenee ylämäkeen nopeammin kuin tasamaalla.\n- Harjun tai mäen laella tuuli on usein voimakkaampi.",
      bodyEn: "The game's map is a topographic map: north is up, and its names give the lakes, brooks, mires and villages. A caller often names a place (\"the north shore of Karhujärvi\"), so learn to find the names quickly.\n\nContour lines show the slopes: the closer the lines, the steeper the slope.\n- Fire runs faster uphill than on level ground.\n- On a ridge or hilltop the wind is often stronger.",
      view: { centre: { x: 3500, y: 6800 }, widthM: 3200 },
    },
    {
      // DRAFT fi
      headingFi: "Suot, ojat ja pellot",
      headingEn: "Mires, ditches and fields",
      // DRAFT fi
      bodyFi: "Märkä avosuo hidastaa paloa, mutta ojitettu turvemaa palaa ja kytee pitkään: turve voi syttyä uudelleen tunteja tai päiviä myöhemmin.\n\nOjat, pellot, tiet ja vesistöt ovat esteitä, joihin palo usein pysähtyy. Ne ovat hyviä ankkurikohtia, joista sammutuslinja aloitetaan.\n- Karttatasoista (Tasot) saat näkyviin polttoaineen: metsätyypit, joissa palo etenee nopeasti tai hitaasti.",
      bodyEn: "A wet open bog slows a fire, but drained peat burns and smoulders for a long time: peat can rekindle hours or days later.\n\nDitches, fields, roads and water are barriers where a fire often stops. They make good anchor points to start a control line from.\n- The map layers (Layers) can show the fuel: the forest types where fire runs fast or slow.",
      view: { centre: { x: 2900, y: 5600 }, widthM: 2400 },
    },
    {
      // DRAFT fi
      headingFi: "Tiet, vesi ja voimajohto",
      headingEn: "Roads, water and the power line",
      // DRAFT fi
      bodyFi: "Tieluokka ratkaisee, mihin ajoneuvo pääsee:\n- Pelastusyksikkö (noin 18 t) kulkee maantiellä ja soratiellä nopeasti, metsäautotiellä hitaasti ja ajourallakin vain vaivoin; polulle miehistö kävelee.\n- Maastopaloyksikkö ajaa myös maastossa.\n\nVesipisteet (järvet, lammet, joet ja purot, joiden luo pääsee tieltä) on merkitty kartalle. 20 kV voimajohto puupylväineen kulkee kartan halki lounaasta koilliseen; johtoaukea näkyy kartalla.",
      bodyEn: "The road class decides where a vehicle can go:\n- A rescue engine (about 18 t) runs fast on main and gravel roads, slowly on forest roads and only with difficulty on a track; to a path the crew walks.\n- The forest-fire unit also drives across country.\n\nWater points (lakes, ponds, rivers and brooks a vehicle can reach from a road) are marked on the map. The 20 kV power line on wooden poles crosses the map from south-west to north-east; its cleared corridor shows on the map.",
      view: { centre: { x: 3600, y: 2400 }, widthM: 3000 },
    },
  ],
  exercise: MAP_EXERCISE,
  checks: [
    {
      id: "map-road",
      // DRAFT fi
      promptFi: "Millä tiellä raskas pelastusyksikkö pääsee nopeimmin palolle?",
      promptEn: "On which road does a heavy rescue engine reach the fire fastest?",
      options: [
        { textFi: "Soratiellä", textEn: "A gravel road" },
        { textFi: "Metsäautotiellä", textEn: "A forest road" },
        { textFi: "Ajouralla", textEn: "A track" },
        { textFi: "Polulla", textEn: "A path" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Soratie on tehty raskaille ajoneuvoille. Metsäautotiellä ajetaan hitaasti, ajouralla vain vaivoin, ja polulle miehistö kävelee.",
      explanationEn: "A gravel road is built for heavy vehicles. On a forest road they drive slowly, on a track only with difficulty, and to a path the crew walks.",
    },
    {
      id: "map-peat",
      // DRAFT fi
      promptFi: "Mikä pitää paikkansa ojitetusta turvemaasta?",
      promptEn: "What is true of drained peat?",
      options: [
        { textFi: "Se ei pala, koska se on suota", textEn: "It does not burn, because it is mire" },
        { textFi: "Se voi kyteä pitkään ja syttyä uudelleen", textEn: "It can smoulder for a long time and rekindle" },
        { textFi: "Se pysäyttää palon kuten pelto", textEn: "It stops a fire like a field does" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Ojitettu turve kuivuu ja palaa. Kytevä turve voi syttyä uudelleen tuulen ja auringon kuivattaessa sitä — toisin kuin märkä avosuo.",
      explanationEn: "Drained peat dries out and burns. Smouldering peat can rekindle as wind and sun dry it — unlike a wet open bog.",
    },
    {
      id: "map-slope",
      // DRAFT fi
      promptFi: "Missä palo todennäköisesti etenee nopeimmin?",
      promptEn: "Where is a fire likely to run fastest?",
      options: [
        { textFi: "Alamäkeen tuulta vastaan", textEn: "Downhill against the wind" },
        { textFi: "Pellolla", textEn: "Across a field" },
        { textFi: "Ylämäkeen myötätuuleen", textEn: "Uphill with the wind behind it" },
      ],
      correct: 2,
      // DRAFT fi
      explanationFi: "Rinne ja tuuli kallistavat liekit kohti palamatonta polttoainetta, joka kuivuu ja syttyy nopeammin. Kun ne vaikuttavat samaan suuntaan, palo etenee nopeimmin.",
      explanationEn: "Slope and wind tilt the flames toward the unburned fuel, which dries and ignites sooner. When both act the same way, the fire runs fastest.",
    },
  ],
};
