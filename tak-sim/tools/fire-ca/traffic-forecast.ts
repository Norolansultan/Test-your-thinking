/**
 * Weather forecasts in the corpus (review 2 Oct 2026). The station at the command post (`SAA`)
 * reports only what it measures, and crews report a wind shift after it has happened; the briefing
 * says the spread projection uses a wind FORECAST, so without a forecast a participant could
 * project the weather only through the machine. These records give the human-readable route:
 * the FMI local forecast for the fire area, issued hourly at the points where the weather story
 * turns (SPEC/18 §6) and received a few minutes later.
 *
 * Source `SÄÄENNUSTE`, not `SAA`: SPEC/18 §3 lists the FMI forecast as its own source (T2, hourly,
 * "high for means, weaker for gusts", not pushed — the Kalajoki lesson), and KUKA source choice is
 * a measure (SPEC/25 §9), so a forecast must not hide among the station's readings.
 *
 * The texts agree with the forcing (`scenario-18.ts`, SPEC/18 §6; winds re-authored in review fixes (ah),
 * 9 Oct 2026): south-westerly 5–7 m/s until about 15.30, backing through the south to south-south-east
 * (15.40) and south-east (16.00–16.20) and easing ahead of a weak, dry front, south at 16.40, then
 * veering sharply west-north-west as the front passes at about 17 and north-west, strengthening to 9 m/s at 18.40. No rain
 * (researcher decision 2 Oct 2026: a shower was unrealistic here; the lull is the wind easing).
 * Like real forecasts they are a little imprecise, and the gusts are under-forecast locally
 * (mechanism M2, §3): the forecast never says more than the truth, never the opposite.
 *
 * Authored, not drawn: no randomness, identical for every participant, Finnish and English written
 * side by side. Own id sequence (`evt.wx.NN`), appended after the generated traffic, so no other
 * record's id, time or text moves.
 */

import type { InteractionEvent } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import { clockAt, stepStartS } from "./traffic-text.js";

/** The forecast source's id in the corpus (the KUKA list shows it). */
export const FORECAST_SOURCE = "SÄÄENNUSTE";

interface Forecast {
  /** The world-state step it arrives in, and seconds into that step. */
  readonly step: number;
  readonly offsetS: number;
  readonly fi: string;
  readonly en: string;
}

const FORECASTS: readonly Forecast[] = [
  {
    // VP (12:07): the afternoon outlook.
    step: -3, offsetS: 420,
    fi: "Ennuste: Ilmatieteen laitos, paikallisennuste palon alueelle klo 12–20 (annettu klo 12.00): iltapäivällä poutaa ja lounaistuulta 4–6 m/s, puuskissa 8–10 m/s. Lämpötila 27–29 °C, ilmankosteus 25–30 %. Alueelle on annettu metsäpalovaroitus. Myöhään iltapäivällä heikko, kuiva sääalue: tuuli kääntyy etelän puolelle ja heikkenee, sadetta ei ole odotettavissa. Illalla tuuli kääntyy länteen ja luoteeseen ja voimistuu.",
    en: "Forecast: Finnish Meteorological Institute, local forecast for the fire area 12–20 (issued at 12.00): dry in the afternoon, wind from the south-west 4–6 m/s, gusts 8–10 m/s. Temperature 27–29 °C, humidity 25–30 %. A forest fire warning has been issued for the area. Late in the afternoon a weak, dry front: the wind turns to the south and eases; no rain is expected. In the evening the wind turns to the west and north-west and strengthens.",
  },
  {
    // V1 (13:21): the front's timing, still broad.
    step: 1, offsetS: 60,
    fi: "Ennuste: Ilmatieteen laitos, ennusteen päivitys (annettu klo 13.00): lounaistuuli 5–6 m/s, puuskissa 9–10 m/s, poutaa, ilmankosteus 25–30 %. Heikko kylmä rintama lähestyy lännestä ja saapuu alueelle arviolta klo 16–17. Sitä ennen tuuli kääntyy etelään ja heikkenee. Rintama on kuiva, sadetta ei odoteta. Rintaman takana tuuli kääntyy länteen ja illalla luoteeseen.",
    en: "Forecast: Finnish Meteorological Institute, forecast update (issued at 13.00): wind from the south-west 5–6 m/s, gusts 9–10 m/s, dry, humidity 25–30 %. A weak cold front is approaching from the west and is expected over the area at about 16–17. Before it the wind turns to the south and eases. The front is dry; no rain is expected. Behind the front the wind turns to the west and in the evening to the north-west.",
  },
  {
    // V4, second step (15:03): the wind shift, before it happens ((ah): 15.40 SSE, 16.00 SE; was SSW, SSE).
    step: 6, offsetS: 180,
    fi: "Ennuste: Ilmatieteen laitos, ennusteen päivitys (annettu klo 15.00): lounaistuuli 6–7 m/s, puuskissa 10–12 m/s. Tuulen ennustetaan kääntyvän lounaasta etelän kautta kaakkoon klo 15.30–16.00 välillä; samalla tuuli heikkenee 4–5 m/s:iin. Poutaa, ilmankosteus 30–35 %.",
    en: "Forecast: Finnish Meteorological Institute, forecast update (issued at 15.00): wind from the south-west 6–7 m/s, gusts 10–12 m/s. The wind is forecast to turn from the south-west through the south to the south-east between 15.30 and 16.00; at the same time it eases to 4–5 m/s. Dry, humidity 30–35 %.",
  },
  {
    // V6, second step (16:01): the lull and the turn to the west — the cue for the rekindle at the origin (step 12).
    step: 9, offsetS: 60,
    fi: "Ennuste: Ilmatieteen laitos, lyhyen ajan ennuste (annettu klo 16.00): tuuli kaakosta 3–5 m/s ja heikkenee; kaakkoistuuli on paikallinen, rintaman edellä purkautuvaa ilmaa, jota Karhujärven ja harjun suuntainen virtaus vahvistaa. Rintama ohittaa alueen noin klo 17: tuuli kääntyy ensin etelään ja rintaman mukana nopeasti länsiluoteeseen, 3–5 m/s, ja voimistuu illalla 5–6 m/s:iin. Poutaa, ilmankosteus 35–40 %, lämpötila 24–26 °C. Metsäpalovaroitus jatkuu.",
    en: "Forecast: Finnish Meteorological Institute, short-range forecast (issued at 16.00): wind from the south-east 3–5 m/s, easing; the south-easterly is local, outflow ahead of the front, strengthened by channelling along Karhujärvi and the esker. The front passes at about 17: the wind turns first to the south and then, with the front, quickly to the west-north-west, 3–5 m/s, strengthening to 5–6 m/s in the evening. Dry, humidity 35–40 %, temperature 24–26 °C. The forest fire warning is still in force.",
  },
  {
    // V9 (17:01): the front has passed, the wind is west-north-west ((ah): was "turns west 17–18"); the evening's north-westerly announced.
    step: 12, offsetS: 60,
    fi: "Ennuste: Ilmatieteen laitos, ennusteen päivitys (annettu klo 17.00): poutaa. Rintama on ohittanut alueen, tuuli on kääntynyt länsiluoteeseen, 3–5 m/s, klo 17–18 länsiluoteesta 4–6 m/s. Kylmän rintaman takana tuuli kääntyy illalla luoteeseen ja voimistuu, puuskissa yli 10 m/s. Ilmankosteus 35–40 %.",
    en: "Forecast: Finnish Meteorological Institute, forecast update (issued at 17.00): dry. The front has passed and the wind has turned west-north-west, 3–5 m/s; 17–18 from the west-north-west 4–6 m/s. Behind the cold front the wind turns to the north-west in the evening and strengthens, gusts over 10 m/s. Humidity 35–40 %.",
  },
  {
    // V11, second step (18:01): the second wind event (18.40 NW 9 m/s, gusts 14), gusts under-forecast (M2).
    step: 15, offsetS: 60,
    fi: "Ennuste: Ilmatieteen laitos, ennusteen päivitys (annettu klo 18.00): tuuli kääntyy luoteeseen ja voimistuu klo 18.30–19.00 välillä 7–9 m/s:iin, puuskissa 12 m/s. Klo 19.30 jälkeen tuuli heikkenee 5–6 m/s:iin. Poutaa, luoteesta tulee kuivaa mannerilmaa ja kastepiste laskee; ilmankosteus laskee 25–30 %:iin, lämpötila 20–22 °C.",
    en: "Forecast: Finnish Meteorological Institute, forecast update (issued at 18.00): the wind turns to the north-west and strengthens between 18.30 and 19.00 to 7–9 m/s, gusts 12 m/s. After 19.30 the wind eases to 5–6 m/s. Dry; the north-westerly brings dry continental air and the dew point falls; humidity drops to 25–30 %, temperature 20–22 °C.",
  },
];

/** The forecasts as interaction-log records (T2, system log, Sää) and their English by record id. */
export function forecastTraffic(): { readonly events: InteractionEvent[]; readonly english: Record<string, string> } {
  const events = FORECASTS.map((f, k): InteractionEvent => {
    const sim = stepStartS(f.step) + f.offsetS;
    return {
      id: `evt.wx.${String(k + 1).padStart(2, "0")}`, cycle: f.step, session_view: viewOfStep(f.step)?.index ?? null, sim_time_s: sim, timestamp: clockAt(sim),
      actor: FORECAST_SOURCE, actor_type: "command", addressee: null, location: null, place: null, lat: null, lon: null,
      event_type: "weather", task: null, content: f.fi, tier: "T2_system", channel: "system_log", nav: "saa", lang: "fi",
    };
  });
  return { events, english: Object.fromEntries(events.map((e, k) => [e.id, FORECASTS[k]!.en])) };
}
