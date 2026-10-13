# 25 — Finding information by category: the structured query builder

**Version 0.1 · 23 September 2026 · Status: adopted, including the eight categories (23 Sep 2026).** Implemented in `app/retrieval/navigation.ts` and the `Haku` drawer. Amends `02` §2 (capability matrix), `04` §3 (`InfoAtom`), `06` §2.3 (drawers) and `07` §2.5 (records), each carrying a revision (h) marker.

> **Changelog**
> - **8 Oct 2026 (aa)** — no change to the withdrawal; the chats' details and `tab_selected`. See the revision at the end.
> - **8 Oct 2026 (z)** — the Haku tab becomes a structured AI chat for everyone (`02` revision (z)); the KUKA × MITÄ × MILLOIN builder and the lexical free-text field are **withdrawn from the participant UI** (researcher, 8 Oct 2026). See the revision at the end.
> - **6–7 Oct 2026 (y)** — free text in both groups (search parity); Finnish free-text matching: prefix stem, gradation aliases, 8-letter stem for long words, whole-token-first ranking (`14` revision (y) §y.2).
> - **0.2 · 23 Sep 2026** — no Radio drawer (`02` revision (j)): the builder is now the only search surface in the no-AI group, which is renamed Haku; the KUKA decoy rule is promoted from open item to requirement. See §9.
> - 0.1 · 23 Sep 2026 — created.

---

## 1. What the Radio group does

The Radio group has no AI. It finds information by **navigating categories**: choosing a topic, optionally a source, and a time window, then reading what comes back. Before this document, the Radio group's tools were three separate surfaces — scroll and filter the logs, browse reference data by map object, request traffic by named unit — with no common structure.

The design is adapted from the Harjula instrument's query engine (repository `Norolansultan/PHD_test_Metacognition_papers2and3`, branch `claude/pelastuslaitos-simulaatio-docs-pz1wiy`, `harjulan-instrumentti.md`, "Kyselymoottori"):

- a query is built from slots, **KUKA × MITÄ × MILLOIN** (who × what × when);
- the corpus is time-indexed: nothing from the future exists;
- every result set contains decoys;
- every answer arrives after a fixed delay, always with its observation time.

The `main` branch of that repository has no category navigation; its non-AI condition received a pushed summary that could not be queried (its reconciliation §X-04).

---

## 2. Both groups get the builder

The builder is offered **identically in every condition**. The AI group has the same builder plus the AI drawer, so **the AI is the only difference between the groups**. The capability matrix (`02` §2) stays a strict ladder: `directed` ⊂ `substitutive`.

What stays as before:

- the **Radio** drawer — ask a named unit (T3) — identical in both groups;
- the AI group's **free-text field** in the `Haku` drawer (`06` §2.3), placed below the builder;
- the **AI drawer** in the AI group only.

---

## 3. The slots

| Slot | Choices | Notes |
|---|---|---|
| **MITÄ** (topic) | Palo ja leviäminen · Sää · Yksiköt ja miehistö · Vesi, tiet ja reitit · Maasto ja metsävarat · Kohteet ja väestö · Ilma-alukset ja dronet · Johto ja ohjeet | Required. Eight fixed, generic topics, in the same order in every cycle |
| **KUKA** (source) | Kaikki, or one source | The list is every source in the **whole incident**, so it never reveals that a new source has spoken |
| **MILLOIN** (when) | Viimeisin · Viimeiset 20 min · Koko tehtävä | *Viimeisin* = the most recent item from each source |

**Topics, not record types.** Categories describe what an item is *about*. Who said it is the KUKA slot's job, so there is no "radio traffic" category. A lateral message about water is under *Vesi, tiet ja reitit*, and can be narrowed to its speaker with KUKA.

Every `InfoAtom` carries an authored `navCategory`, reviewed together with the corpus (`11` §2.3). **The eight categories are adopted** (decision 23 Sep 2026).

---

## 4. What a query returns

- Only items observed up to the current scenario time. Register data (reference records) is static and passes every time window.
- Newest observation first; ties by id (I1).
- References into the closed corpus only (I6), checked at runtime with `assertClosedOverCorpus`.
- Each result shows its source, its observation time as a clock time, and its content.

---

## 5. Response delay

Every query surface — the builder, the free-text field and the AI drawer — shows results after the same fixed delay, **2.5 s** (`NAV_RESPONSE_DELAY_MS`), following the Harjula engine. Response time is then not a difference between the groups. The T3 reply latencies of the Radio drawer are unchanged (`04` §2, `SourceClass`).

---

## 6. Rule: no category may give an item away

A category that exists, or is otherwise empty, only because a load-bearing item is in it would announce that item: *"Suon jälkisammutus"* would give away the omission. The rule:

- every category is generic and present from the first cycle;
- **every load-bearing item has at least three non-load-bearing items in the same category, already visible by its cycle** (a decoy ratio of at least 3:1, as in the Harjula engine).

Enforced by scenario-validator check **#16** (`navigation-coverage`). The demo scenario satisfies it.

---

## 7. What is logged

Two record kinds are added (`07` revision (h)); the log format moves to **0.2.0**:

| Kind | Detail |
|---|---|
| `nav_slot_changed` | Which slot changed and to what. The sequence is the participant's **search path** |
| `nav_query_submitted` | The three slots, a query id, and the ids of exactly the items shown (exposure, not a measure) |

**A new process measure, derived in analysis:** the search path — which categories a participant opens, in what order, how narrowly — is their search strategy. It is comparable across the groups because both have the same builder. Derivations belong to `07` §4 and the analysis plan, not the runtime (`07` §1).

---

## 8. Open items

Registered in `11` §7.5: authoring `navCategory` for every record in the real corpus; whether a second decoy rule is needed per source (KUKA) as well as per category; and pilot-checking that a 2.5 s delay on every query is tolerable over a whole session.

---

## 9. Revision 23 Sep 2026 — no Radio drawer

Follows `02` revision (j). **Supersedes §2's "the Radio drawer — ask a named unit (T3) — identical in both groups" and §5's last sentence.**

- **§1.** Read "the Radio group" as **the Haku group**. The builder is its only search surface. It also keeps the message log of pushed bubbles, which has no input (`06` revision (j)).
- **§2.** What stays: the AI group's free-text field and the AI drawer. There is no Radio drawer in either group, so the builder plus pushed content is everything the Haku group has, and the AI is the only addition in the other group.
- **§5.** There are no T3 reply latencies. The uniform 2.5 s is the only response delay in the instrument.
- **§6, extended: a KUKA decoy rule is now required** (it was open in §8). Source choice is now the source-selection measure (`07` revision (j)), so a source must not give an item away either. Every load-bearing item must have **at least three non-load-bearing items from the same source (KUKA), visible by its cycle**. Example: `t4.water_state` now lives in the database as a VPK/KY21 transcript (`19` revision (b)). Selecting KUKA = VPK at cycle 4 must not return it alone or near-alone. Scenario-validator check **#16** is extended to test this. It also covers the category rule for `t4.water_state` under *Vesi, tiet ja reitit*.

## Revision 2 Oct 2026 — the KUKA list grows (researcher decision)

**Supersedes §2's "the list is every source in the whole incident".** That list named the helicopter, the power company and the late reinforcements (OUT1, OUT2, UGV1) from the practice view on. It gave away the scenario's course, which is L3 information, before it happened. That cost outweighs the cue it avoided.

- **Rule.** KUKA offers the sources known by the end of the current view: any item observed by then, plus register data. The list changes only when a view opens, never mid-view, and is not highlighted. It stays sorted, so a newcomer is not marked.
- **Identical for everyone**, in both groups.
- **Logged.** `cycle_start.navSources` records the list (`07`, format 0.9.0). The source-selection measure is computed against the list on offer at the time of the query.
- **The §6 KUKA decoy rule is unchanged.** It is per load-bearing item and visible by its cycle.

---

## Revision 6–7 Oct 2026 (y) — free text in both groups; Finnish matching

- **Search parity (researcher, 6 Oct 2026).** The free-text field beside the builder is in both groups (`02` revision (y)); revision (j)'s "what stays: the AI group's free-text field" is superseded. Logged as before (`query_submitted`, with `resultAtomIds`).
- **Finnish matching (researcher, 7 Oct 2026; fix passes 2–3).** The Finnish free-text search (`closure.ts` `retrieveClosed`) uses a 5-letter prefix stem, a 10-letter threshold above which an 8-letter stem is kept, a consonant-gradation alias table, a four-letter short-stem rule and whole-token-first ranking. Specified in `14` revision (y) §y.2. The builder's KUKA × MITÄ × MILLOIN selection (§3) is unaffected.

---

## Revision 8 Oct 2026 (z) — the Haku tab is a structured AI chat

Follows `02` revision (z) (researcher, 8 Oct 2026). The **Haku** tab in the right column is now the structured chat over `/api/thinker` (four fields, standard prompt, no history), identical in every cell and view, the practice view included. Free text reaches the corpus through it in both groups. The uniform 2.5 s delay (§5) is its latency floor.

**The builder is withdrawn from the participant UI (researcher decision, 8 Oct 2026: "Haku tab = the structured AI chat").** `RightPanel.tsx` no longer mounts `HakuPanel` (`Drawers.tsx`: the KUKA × MITÄ × MILLOIN builder and the lexical free-text field). This supersedes §1–§2, §9's "the builder is its only search surface" and revision (y)'s surface. What stays in code, unused by participants:
- the navigation engine (`app/retrieval/navigation.ts`) and `cycle_start.navSources`;
- `closure.ts` with revision (y)'s Finnish matching, reachable only by `orchestrator.searchAtoms`, which no UI calls; the 7 Oct matching work is dormant unless the panel returns;
- the records `nav_slot_changed`, `nav_query_submitted` and `query_submitted`, which no new session emits.

The Haku chat retrieves through `/api/thinker`'s hybrid retrieval (`hybrid.ts`, BM25 with its own 5-letter prefix stem, plus vectors; `14` revision (q)), **not** through `closure.ts`.

**Consequences (`11` §7.18):** the KUKA decoy rule (§6, revision (j)) loses its surface; the source-selection measure (`07` revision (j), the KUKA slot) has no data in new sessions and must be re-operationalised or withdrawn; the freeze-measures exposure route `haku` (`searchAtoms` / `query_submitted`) no longer occurs, so record exposure comes from `ai_chat_answer_received.retrieved` alone.

---

## Revision 8 Oct 2026 (aa) — final fix pass: what reaches the chats

No change to §1–§8 or to revision (z): the query builder and the lexical field stay withdrawn from the UI. Three details from the final fix pass (`02` and `14` revision (aa)):
- **Haku's chat** is still the only route to free text for the Haku group. In an English session the template answer's basis names sources in English (`14` revision (aa)).
- **The Open Thinker** (AI group, main views) is directive-aware; the Haku chat is neutral. Free-text search is still identical in both groups (`capability-matrix.ts` `crossSourceFreeTextQuery` and `hakuChat`, shared rows).
- **Telemetry:** a tab selection is logged (`tab_selected`: `haku` | `open_thinker` | `none`) and counts as an information-seeking act when it opens a tool (`07` and `09` revision (aa)). `nav_query_submitted` and `query_submitted` remain absent from new logs.

## Revision 11 Oct 2026 (aq) — Indexed search, demonstration only

The original index-based search (no LLM: the KUKA × MITÄ × MILLOIN builder and the lexical free-text field, `HakuPanel`, `navigate`, `searchAtoms`) is brought back as a **third right-panel tab, "Indeksihaku" / "Indexed search"**, after Haku and Thinker, **only to show the possibility to the professors**. **It is not part of the study:** it is rendered only when the URL has no `?tuotanto` (App.tsx `indexedSearch={!study}`, also on the resume path), never in the study configuration or an assigned study link, and it appears in every cell of the demonstration. Cells, allocation, the capability matrix, the prompts and the behaviour of Haku and Thinker are unchanged. Its use is logged with the existing `nav_slot_changed`, `nav_query_submitted` and `query_submitted` records and `tab_selected` `tool: "indexed_search"`; the derived, freeze and spam measures tolerate them (exposure route `haku`), but they never occur in study data. Test: `test/render/indexed-search.spec.ts`.
