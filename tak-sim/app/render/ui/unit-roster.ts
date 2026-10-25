/**
 * What a hover over a unit or aircraft marker shows: SPEC/18 §8.1's order of battle, in the
 * participant's language. Deliberately only the public facts a commander would have on the
 * resource board — type, crew, where it came from. The §8.1 "Notes" column (fault injections
 * such as AVL drift, the radio dead zone) is experiment design and never reaches the screen.
 * Types match `tools/fire-ca/deployment.ts` UNIT_PLAN.
 *
 * SPEC/31 §2.3 (19 Oct 2026, radio CS-01, CA-01, CA-03; DRAFT, native check): the roster names no real region ("oma
 * pelastuslaitos" / "naapuripelastuslaitos", was Etelä-Karjala and Kymenlaakso: EK and KY may be real codes, VERIFY 1–2 with
 * Pelastusopisto; a corpus-wide rename follows only a confirmed collision); the near-future assets VD1, UGV1 and DR3 are marked
 * trials ("kokeilu"); OUT1 and OUT2 are heavy tanker units, as their radio says ("raskas säiliö").
 *
 * Revision (bn), 25 Oct 2026 (review S8; SPEC/18 (bn)): the help card's roster no longer tells that reinforcements will come. Its rows
 * appear only once the unit is on the map or has been heard in the message log (`HelpCard.tsx` `rosterRows(lang, seen)`, `rosterSeen`),
 * and no origin says "Saapui … mukana" (UGV1 "Saapui OUT1:n mukana", VD1 "Saapui vahvennusten mukana"; now where they come from). The
 * hover card and the TAK contacts show only units on the map, as before. The command centre JOKE, which acknowledges reports (the
 * pointers, `pointers.ts`), has a source row (`SOURCE_ROSTER`), not a platform: no marker, no TAK symbol.
 */

export interface RosterEntry {
  readonly typeFi: string;
  readonly crew?: string;
  readonly fromFi?: string;
  /** One extra line: endurance or working mode (aircraft). */
  readonly detailFi?: string;
}

export const UNIT_ROSTER: Readonly<Record<string, RosterEntry>> = {
  EK11: { typeFi: "Pelastusyksikkö + säiliö", crew: "1+5", fromFi: "Oma pelastuslaitos, lähin vakinainen asema" },
  VPK: { typeFi: "VPK, säiliöauto", crew: "1+3", fromFi: "Paikallinen sopimuspalokunta" },
  EK12: { typeFi: "Pelastusyksikkö", crew: "1+4", fromFi: "Oma pelastuslaitos" },
  EK13: { typeFi: "Säiliöauto – vedensiirto (vesiajo linjojen altaisiin)", crew: "1+1", fromFi: "Oma pelastuslaitos, pääasema", detailFi: "Noin 14 m³, täyttää W1/W2/W3:lla" },
  EK14: { typeFi: "Maastopaloyksikkö (maastoajoneuvo + perävaunu)", crew: "1+3", fromFi: "Oma pelastuslaitos" },
  KY21: { typeFi: "Pelastusyksikkö + maastopalokontti", crew: "1+4", fromFi: "Naapuripelastuslaitos" },
  EK15: { typeFi: "Pelastusyksikkö (vahvennus)", crew: "1+4", fromFi: "Naapuriasema" },
  EK16: { typeFi: "Pelastusyksikkö (vahvennus)", crew: "1+4", fromFi: "Naapuriasema" },
  KY23: { typeFi: "Pelastusyksikkö (vahvennus)", crew: "1+4", fromFi: "Naapuripelastuslaitos" },
  OUT1: { typeFi: "Raskas säiliöyksikkö (toinen alue)", crew: "1+4", fromFi: "Alueen ulkopuolelta" },
  OUT2: { typeFi: "Raskas säiliöyksikkö (toinen alue)", crew: "1+4", fromFi: "Alueen ulkopuolelta" },
  UGV1: { typeFi: "Letkunvetorobotti (itsenäinen, kokeilu)", crew: "1 (käyttäjä)", fromFi: "Alueen ulkopuolelta", detailFi: "Vetää letkua miehistönsä kanssa; ei suunnitelman tehtävissä" },

  DR1: { typeFi: "Lämpökamerakopteri", crew: "3 (drooniryhmä, johtopaikalla)", fromFi: "Alueellinen drooniyksikkö", detailFi: "Akku n. 35 min" },
  DR2: { typeFi: "Lämpökamerakopteri", crew: "3 (drooniryhmä, johtopaikalla)", fromFi: "Alueellinen drooniyksikkö", detailFi: "Akku n. 35 min" },
  DR3: { typeFi: "VTOL-drooni, kehän kartoitus (kokeilu)", crew: "3 (drooniryhmä, johtopaikalla)", fromFi: "Alueellinen drooniyksikkö", detailFi: "Toiminta-aika n. 2,5 h" },
  HELI1: { typeFi: "Sammutushelikopteri (kauha)", fromFi: "Valtion ilmailu", detailFi: "Pudottaa vettä lentäjän harkinnan mukaan; ei suunnitelman tehtävissä" },
  VD1: { typeFi: "Vesidrooni (autonominen, kokeilu)", crew: "0 — valvoja johtopaikalla", fromFi: "Alueellinen drooniyksikkö", detailFi: "Visio: kauhoo vettä lähimmästä vesipisteestä, n. 80 l / kierros; pudottaa palon reunalle oman käyttäjänsä harkinnan mukaan, ei suunnitelman tehtävissä" },
  SPOT: { typeFi: "Palovartiolentokone", crew: "2", fromFi: "Vapaaehtoinen palovartiolento", detailFi: "Ilmoitukset hätäkeskuksen kautta" },
};

/**
 * Revision (bn): call signs heard on the radio that are not platforms — the rescue department's command centre, JOKE, which
 * acknowledges the units' reports (`pointers.ts` POINTER_SENDER). The help card lists it after the units once it has been heard.
 * DRAFT (native and domain check: the call sign's form, `wildfire-radio-realism` "<area> PEL-JOKE").
 */
export const SOURCE_ROSTER: Readonly<Record<string, RosterEntry>> = {
  JOKE: { typeFi: "Pelastuslaitoksen johtokeskus: kuittaa yksiköiden ilmoitukset ja kirjaa ne", fromFi: "Oma pelastuslaitos" },
};
export const SOURCE_ROSTER_EN: Readonly<Record<string, { readonly type: string; readonly crew?: string; readonly from?: string; readonly detail?: string }>> = {
  JOKE: { type: "The rescue department's command centre: acknowledges the units' reports and logs them", from: "Own rescue department" },
};

/** The roster in English (session language "en"; DRAFT translation), same keys. */
export const UNIT_ROSTER_EN: Readonly<Record<string, { readonly type: string; readonly crew?: string; readonly from?: string; readonly detail?: string }>> = {
  EK11: { type: "Rescue unit + tanker", crew: "1+5", from: "Own rescue department, nearest full-time station" },
  VPK: { type: "Volunteer fire brigade, tanker", crew: "1+3", from: "Local contract fire brigade" },
  EK12: { type: "Rescue unit", crew: "1+4", from: "Own rescue department" },
  EK13: { type: "Water tanker – shuttle (water runs to the basins at the lines)", crew: "1+1", from: "Own rescue department, main station", detail: "About 14 m³, fills at W1/W2/W3" },
  EK14: { type: "Forest-fire unit (off-road vehicle + trailer)", crew: "1+3", from: "Own rescue department" },
  KY21: { type: "Rescue unit + forest-fire container", crew: "1+4", from: "Neighbouring rescue department" },
  EK15: { type: "Rescue unit (reinforcement)", crew: "1+4", from: "Neighbouring station" },
  EK16: { type: "Rescue unit (reinforcement)", crew: "1+4", from: "Neighbouring station" },
  KY23: { type: "Rescue unit (reinforcement)", crew: "1+4", from: "Neighbouring rescue department" },
  // Play-test, 24 Oct 2026: was "From outside the region", shown under the help card's "From:" label as "From: From …".
  OUT1: { type: "Heavy tanker unit (other region)", crew: "1+4", from: "Outside the region" },
  OUT2: { type: "Heavy tanker unit (other region)", crew: "1+4", from: "Outside the region" },
  UGV1: { type: "Hose-laying robot (autonomous, trial)", crew: "1 (operator)", from: "Outside the region", detail: "Lays hose with its crew; not tasked by the plan" },
  DR1: { type: "Thermal-camera multicopter", crew: "3 (drone team, at the command post)", from: "Regional drone unit", detail: "Battery approx. 35 min" },
  DR2: { type: "Thermal-camera multicopter", crew: "3 (drone team, at the command post)", from: "Regional drone unit", detail: "Battery approx. 35 min" },
  DR3: { type: "VTOL drone, perimeter mapping (trial)", crew: "3 (drone team, at the command post)", from: "Regional drone unit", detail: "Endurance approx. 2.5 h" },
  HELI1: { type: "Firefighting helicopter (bucket)", from: "State aviation", detail: "Drops water at the pilot's judgement; not tasked by the plan" },
  VD1: { type: "Water drone (autonomous, trial)", crew: "0 — supervisor at the command post", from: "Regional drone unit", detail: "Scoops water from the nearest water point, approx. 80 l per round; drops on the burning edge at its own operator's judgement, not tasked by the plan" },
  SPOT: { type: "Fire-spotting aircraft", crew: "2", from: "Volunteer fire-spotting flight", detail: "Reports through the emergency centre" },
};

/** A unit's own wording for a task (fix pass 3): the shuttle fills its tank, it does not top up a line's water. */
// Fix pass 7 (9 Oct 2026, idle units): between runs the shuttle is on stand-by for the next water order, not waiting to be tasked.
const UNIT_TASK_FI: Readonly<Record<string, Readonly<Record<string, string>>>> = { EK13: { refill: "Täyttää säiliötä", staging: "Valmiudessa seuraavaa vesiajoa varten" } };
const UNIT_TASK_EN: Readonly<Record<string, Readonly<Record<string, string>>>> = { EK13: { refill: "Filling its tank", staging: "On stand-by for the next water run" } };

/** The task line of a unit's card, in the language: the unit's own wording, else the task's. */
export function taskLabel(unitId: string, task: string, lang: "fi" | "en"): string {
  const own = (lang === "en" ? UNIT_TASK_EN : UNIT_TASK_FI)[unitId]?.[task];
  return own ?? (lang === "en" ? TASK_EN : TASK_FI)[task] ?? task;
}

/** What a unit is doing, in English. */
export const TASK_EN: Readonly<Record<string, string>> = {
  hose_attack: "Attack with a hose line", pump_attack: "Attack with a portable pump from natural water", peat_soak: "Soaking and digging burning peat",
  firebreak: "Cutting a firebreak with chainsaws", road_line: "Holding the road line: sprinkler line and hose ready along the road", mop_up: "Mop-up with hand tools and water", hose_laying: "Laying a hose line", refill: "Refilling water",
  water_shuttle: "Water shuttle (water run to the basins)",
  rest: "Rest and maintenance at the command post", withdrawn: "Withdrawn to safety on the road", evacuation: "Helping the evacuation", staging: "Waiting for a task",
  transit: "Moving", blocked: "Stopped: the route will not carry the vehicle",
};

/** What a unit is doing (SPEC/18 revision (m)), as the hover card says it. */
export const TASK_FI: Readonly<Record<string, string>> = {
  hose_attack: "Sammutus letkulinjalla",
  pump_attack: "Sammutus moottoriruiskulla luonnonvedestä",
  peat_soak: "Turvepalon kastelu ja kaivaminen",
  firebreak: "Palokatkon raivaus moottorisahoilla",
  road_line: "Pitää linjaa tiellä: sadetinlinja ja letku valmiina tien varressa",
  mop_up: "Jälkisammutus käsityökaluin ja vedellä",
  hose_laying: "Letkulinjan veto",
  refill: "Veden täydennys",
  water_shuttle: "Vedensiirto (vesiajo altaille)",
  rest: "Lepo ja huolto johtopaikalla",
  withdrawn: "Vetäytynyt tielle turvaan",
  evacuation: "Avustaa evakuoinnissa",
  staging: "Odottaa tehtävää",
  transit: "Siirtymässä",
  blocked: "Pysähtynyt: reitti ei kanna ajoneuvoa",
};
