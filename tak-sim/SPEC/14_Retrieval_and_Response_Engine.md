# 14 — Retrieval and response engine (query AI and reasoning AI)

**Version 0.2 · 17 September 2026 · Status: governing for the AI group's engine.** Answers forks F2 and F3 in `11` §7 as far as Kalle has decided them. Where this document conflicts with `02` or `05`, those remain governing until they are amended to match.

> **Changelog**
> - **24 Oct 2026 (D10)** — query-aware recency and clock-aware matching (researcher decision D10, after the play-test of 23 Oct 2026). A question asking for the latest state ("viimeisin", "uutta", "nyt", "latest", "now" …) adds up to +0.3 by recency among its relevant records. A clock it names ("klo 17.24", "at 17:24") is matched against each record's clock (±2 min +0.5, +0.5 more when it names the record's source as shown, ±10 min +0.15), leaves the lexical query, and exempts that minute's records from the routine collapse. The embedded passage and the vectors are unchanged. Play-test questions (lexical): MRR@8 0.388 → 0.567. Neutral evaluation (lexical only; the model is not available here): Finnish 0.5049 / 0.4653 → 0.5196 / 0.4996, English MRR 0.3552 → 0.3699. The authored questions (hybrid) are unchanged. See the revision at the end.
> - **24 Oct 2026 (bf)** — the guardrails audited (`30` (bf)): the guardrail fidelity report (`npm run review:fidelity`) as the manipulation check, the uncertainty audit extended to Haku's `varmuus`; the Haku group's chip is an ordinary Haku question. No prompt, retrieval or hash changes. See the revision at the end.
> - **19 Oct 2026 (ay)** — `31` §3.6: the digest (ab.4) and the recent matches (ah.2) are now returned to the client as atom ids and logged in the browser (`07` 0.11.0), so ah.2's "the browser's exposure measures … do not count these records" no longer holds; the premise table's V14 P2 and P1's wording change (`30` (ay)); prompts and retrieval unchanged. See the revision at the end.
> - **10 Oct 2026 (an)** — am→an (researcher approved).
>
>   **(1) Rule 5 of `prompt-open.once.{fi,en}.md`.** The rule now holds in every view. P2's orders are "not given to you: any orders from P2 are in the message log (and, once a directive is issued, in the directive banner on the screen)". VP has no banner and no order yet, and a live VP answer had wrongly named the banner. The rule now gives the model a first-person sentence to say:
>   - EN: "P2's orders are not given to me: any orders from P2 are in the message log (and, once a directive is issued, in the directive banner), so I cannot confirm them."
>   - FI: "P2:n käskyjä ei ole annettu minulle: mahdolliset käskyt ovat viestilokissa (ja kun linjaus on annettu, myös linjausbannerissa), joten en voi vahvistaa niitä."
>
>   The FI sentence fixes the slip where the model copied the instruction's "et voi vahvistaa" ("you cannot confirm"). Every other rule is unchanged. `prompt-open.{fi,en}.md` (`reasoning_intent`) was checked and is unchanged: it names neither the banner nor the message log, and its rule 5 has no second-person sentence for the model to copy. The manifest hashes of the two `once` prompts were recomputed (LF-normalised sha256): fi `043a0298…`, en `f532c735…`. Haku's `prompt.{fi,en}.md` rule 4 still names the banner and says "et voi vahvistaa". It is not in this revision's scope; for the researcher.
>
>   **(2) Record ages.** The server now computes every record's age and prints it on the record line ("klo 12.18, 2 min vanha" / "at 12.18, 2 min old"). A line before the question says what the ages are counted to: "Tietueiden iät on laskettu kuluvan jakson loppuun, klo 12.20." / "Record ages are counted to 12.20, the end of the current period." The reference point is the **end of the question's step** (`ageReferenceOf(step)` = step × 1200 s: 12:20 in VP, 13:40 in V1, and in a merged view the end of the step shown at the question). Every gated record is stamped at or before that time. Ages are counted between the minutes shown, so the result is deterministic and independent of the browser's clock. This applies to both tools (Haku and the Open Thinker), because they share `buildUserContent`. The server line carries `ageRefVirtualS`. A VP answer had called the 12:18 report "0 minutes old": it counted from the newest record ("records received up to 12:18").
>
>   **Live check:** 6 calls through the server code path with the live key, not the 8080 server:
>   - **VP**, once/intent × fi/en. All four answered in 1.9–2.5 s. The answers were identical across the two cells in each language. Each opened with the new sentence verbatim, in the first person and naming no banner as present, and gave the ages correctly (12.18 → 2 min, 12.17 → 3 min, 12.01 → 19 min).
>   - **V9** `reasoning_once`, fi and en. Both opened with the sentence and gave two options with trade-offs. They also added "the records contain no P2 entry / what is missing is any message or directive from P2". That is true of its records, but at V9 it can read as if no directive exists.
> - **10 Oct 2026 (am)** — al→am: `/api/thinker-open` accepts the practice view (view 0) in the Thinker cells, for the Thinker practice (`15` revision (am)). In VP both cells are answered with the `reasoning_once` prompt and **no order block** (no directive, no phase-A intent: `intentBlockOf` is null for view 0; the `reasoning_intent` prompt would announce a block that is not there), so the practice stimulus is identical across the Thinker cells; no verdict is coded (as before the hinge). The server line carries `practice` (both tools). The browser clears the practice turns from the history when V1 starts. No prompt file changed; manifest hashes unchanged. Live check: 3 VP calls (once/fi, intent/en, intent/fi), all answered in 2.3–3.5 s, cited the practice records with their times, no order block, no verdict; the third answered an "what has P2 ordered?" question with rule 5's "not given to me" sentence (it named the banner, which VP does not show) and gave two options with trade-offs.
> - **11 Oct 2026 (aq)** — the Open Thinker answers in structured output (kind lookup/options/safety, facts, premises, options with verdict fields, inference, questions): the proxy enforces the 150 words, renders the text and reads verdicts from fields; a lookup ends in exactly one question tying the fact to the commander's plan (the Thinker is not a second Search); invalid JSON is retried once, then unavailable. Prompts re-hashed. Live probes. See the revision at the end.
> - **10 Oct 2026 (al)** — the review panel's recommendations (researcher approved): **clean manipulation** — one Open Thinker prompt per Thinker cell; `reasoning_intent` keeps the order block, `reasoning_once` gets its own prompt with no block and no directive clause (rule 5 points to the banner and the message log, like Search's rule 4); rule 5 rewritten (the directive's purpose, method and premises; evidence first, a conditional verdict last; a generic premise trigger replaces "small, new or unattended fire"; the reporting sentence removed); the order block framed as data; P2's opening intent labelled as such; the "experienced fire chief" persona dropped; history tags rewritten and hashed; per-option verdicts, citation post-check and the client's query id logged; a place-name line; one identical retry on 429/503 and a fixed seed. Four Open Thinker hashes (two new). Live probes. See the revision at the end.
> - **9 Oct 2026 (aj)** — the directive is the Open Thinker's system instruction's last block (the researcher: "is the commander's command actually set as a system prompt?"): the command directive verbatim from V8, the phase-A intent before, appended by the server to the frozen prompt and hashed as `systemPromptHash`; the plan context no longer carries it; rule 5 asks the model to weigh each plan option against the directive and name the deciding part. Both Thinker cells, never Haku. Two Open Thinker hashes re-frozen. See the revision at the end.
> - **9 Oct 2026 (ah)** — review fixes: the Open Thinker answers up to 150 words (researcher) with an output cap of 1024 tokens (320 cut every Finnish answer); both chats carry the current step's best matches besides the frozen retrieval; an absence is never "certain"; the practice view's clock; no directive (and no verdict) before the hinge; prompt wording (Search's name, the duty fire chief, disagreeing sources, safety labels, withdrawal). Four prompt hashes re-frozen. See the revision at the end.
> - **8 Oct 2026 (ab)** — the Open Thinker prompt is the frozen treatment "assess, never enforce" (rules 1–8 quoted); both tools get recency rules and the records clock; the Open Thinker gets a digest of the step's eight newest records; a recency boost in retrieval; the AI's verdict and `modelVersion` logged; **the frozen neutral evaluation: the rule now narrowly selects `collapse3+cap3`; the declared `collapse3` is kept (researcher decision), a documented post-freeze mismatch.** See the revision at the end.
> - **8 Oct 2026 (aa)** — the Open Thinker prompt is directive-aware and gets a server-built plan context; its failure shows an explicit "unavailable" state, not a template; English source names in Haku's basis. See the revision at the end.
> - **8 Oct 2026 (z)** — Haku / Open Thinker redesign (`02` revision (z)): the structured pipeline answers Haku's chat for every cell and view (practice included) with the standard prompt; the strategy-guided variant (revision (u)) is withdrawn; a second endpoint, the Open Thinker, shares retrieval and model. See the revision at the end.
> - **8 Oct 2026, live test** — the model is now `gemini-3.5-flash` with thinking off (`thinkingBudget: 0`). `gemini-3.8-flash` answered 2 of 12 live calls (Google 503 "high demand", 20 s timeouts, output-cap cut-offs because it thinks even with a zero budget); `gemini-2.5-flash`/`-pro` return 404 to new keys; a probe of the callable Flash models chose 3.5-flash (3/3 calls, ~1.4 s). Live check after the switch: 6/6 answers, 1.4–3.5 s, no fallbacks; grounding citations, the directive relation and the life-safety stop behaved as specified. The Open Thinker prompt asks for ≈150-word answers (prompt hashes re-frozen).
> - **6–7 Oct 2026 (y)** — the model was `gemini-3.8-flash` (temperature 0); Haku's Finnish lexical search gets the prefix stem, a gradation table, a longer stem for long words and whole-token-first ranking; the English neutral eval frozen at collapse3 with the post-freeze check recorded; the V7 objection's ranks documented, not tuned. See the revision at the end.
> - **5 Oct 2026 (v)** — English retrieval mode: an English session retrieves over the records' English text (English passages, English tokeniser, a separate English vector index); Haku's free text searches English; the English configuration is chosen by an English translation of the neutral evaluation with the same candidates and rule, and frozen separately when the researcher runs it. Finnish unchanged. See the revision at the end.
> - **5 Oct 2026 (u, reconciled)** — the strategy-guided prompt reconciled with the build (`27` 1.1): rule 5 confines the directive to `linjaus`; symmetric statuses; `systemPromptHash`; how the server gets the cell.
> - **4 Oct 2026 (u)** — the strategy-guided prompt variant for `reasoning_intent` (V8–V14): principles P1–P10 of `27` §3.2, the fifth field `linjaus`, the fallback status, the prompt audit. Supersedes revision (d)'s "Intent-framed variant" where it conflicts. See the revision at the end.
> - **25 Sep 2026 (q)** — Thinker becomes a live LLM (`claude-opus-5-5`) over hybrid, time-gated retrieval of the raw records; revision (o)'s closed responder and authoring-time drafting are withdrawn. See the revision at the end.
> - **25 Sep 2026 (p)** — packages remapped to 14 views; the rekindle objection is dropped by broad questions; `rekindle.spec` added (`26`).
> - **25 Sep 2026 (o)** — ClosedResponder for all Paper 1 data collection; an LLM only at authoring time; the planted record and `planted.spec`. See the revision at the end.
> - **23 Sep 2026 (j)** — radio removed (`02` revision (j)): the no-AI group reaches raw atoms through Haku; latency matching to `directed` replies is withdrawn. See the revision at the end.
> - **17 Sep 2026 (f)** — LLM (facts) group removed. Two groups: Radio (70) and LLM reasoning (130, pull-only); LLM reasoning split 65 / 65 at the hinge (guidance once vs. intent line in AI answers).
> - **17 Sep 2026 (e)** — three Paper 1 groups restored — Radio, LLM, LLM reasoning; both LLM groups pull-only; only the LLM-reasoning group is split at the hinge by how it receives the guidance. Group sizes open (default 70 / 65 / 65).
> - **17 Sep 2026 (d)** — two groups (no AI 70, AI 130); AI group pull-only with group-specific training; AI group split 65/65 at the hinge, the via-AI half receiving query answers framed against the commanded strategy; branch choice adopted with four authored options plus *Ei mikään näistä*, no free text; per-choice alignment feedback removed.
> - 0.1 · 17 Sep 2026 — created. Decisions: a reasoning-AI group is required in Paper 1; for now it is built on the same retrieval mechanism as the query group; retrieval of information packages by key word and meaning is required; a live language model is deferred.

---

## 1. Decisions this document implements

1. **Three groups in Paper 1:** no AI · query AI · reasoning AI.
   Working mapping to v3.0 condition ids: `directed` · `assistive` · `substitutive`. *(F3 — confirm the ids are kept or renamed.)*
2. **Reasoning AI is built the same way as query AI for now.** Both are request-driven: the participant asks, the engine returns content. They differ only in **what kind of content** is returned.
3. **No live language model at runtime in this version.** Invariants I1 (determinism) and I6 (retrieval closure) remain in force. An LLM is used **at authoring time** to compile the content the engine serves.
4. The engine must be replaceable later by a live, grounded LLM without changing the UI or the logging (§8).

---

## 2. The idea in one paragraph

Compile first, retrieve later.

- **Compile (offline).** An LLM, used offline by the author, reads the immutable authored corpus and compiles it into a structured, interlinked set of **information packages**. This follows Karpathy's LLM-wiki pattern: raw sources stay immutable, the compiled layer is the wiki, and a schema file governs it, with *ingest*, *query* and *lint* as the operations.
- **Freeze.** Every package is reviewed by a human, frozen, content-hashed and shipped in the asset bundle.
- **Retrieve (runtime).** The browser retrieves packages with a **hybrid search**: exact key words, precomputed vector similarity, and graph links between packages, filtered hard by time and condition. The style is the local-first, WASM-in-the-browser approach of Reuven Cohen's RuVector work (hybrid sparse + dense retrieval, filtered HNSW search, ONNX embeddings running in the browser).

Nothing is generated during a session; everything the participant can receive was written, checked and fixed in advance.

---

## 3. Content layers

| Layer | Directory | Written by | Mutable? | Served to |
|---|---|---|---|---|
| **Raw** — information atoms (`04` §3) | `content/raw/` | Author + domain reviewer | Immutable per scenario version | Query AI (verbatim), no-AI group via radio/browse |
| **Wiki** — information packages | `content/wiki/` | LLM draft → human review | Frozen per scenario version | Query AI (fact packages) and reasoning AI (reasoning packages) |
| **Schema** | `content/SCHEMA.md` | Author | Versioned | The compiling LLM and the linter |
| **Index** | `bundle/index/` | Build script | Generated | Runtime engine |

### 3.1 Package types

| Type | What it contains | Served in |
|---|---|---|
| `fact` | One entity at one time window (a unit, a sector, a water point, a road, the weather): the relevant atoms grouped, **verbatim**, with source and time for each | Query AI |
| `situation` (SA L1) | What is where, now — integrated across sources, with named sources | Reasoning AI |
| `meaning` (SA L2) | What the current state implies — which sector is exposed, which unit cannot reposition, why | Reasoning AI |
| `projection` (SA L3) | What is likely next within the validity horizon, with stated assumptions and certainty | Reasoning AI |

**Query AI returns facts; reasoning AI returns integrated interpretations.** This difference is the integration boundary the study is about, and it is the only difference between the two engines. Both use the same index, the same ranking, the same latency distribution and the same UI.

### 3.2 Package record

```ts
interface InfoPackage {
  readonly id: string;                        // "pkg.sector.north.c12.projection"
  readonly type: "fact" | "situation" | "meaning" | "projection";
  readonly entityIds: readonly string[];      // units, sectors, places it concerns
  readonly validFromCycle: CycleIndex;        // not retrievable before this cycle
  readonly validUntilCycle: CycleIndex | null;
  readonly availableIn: readonly ConditionId[];
  readonly bodyFi: string;                    // Finnish, reviewed
  readonly certainty: Certainty;              // incl. "unknown"
  readonly citedAtomIds: readonly string[];   // every claim traces to raw atoms
  readonly links: readonly string[];          // other package ids (graph edges)
  readonly retrievalKeys: readonly string[];  // Finnish, incl. inflected forms
  readonly embedding: Int8Array;              // precomputed, quantised
  readonly authoredOmissions: readonly string[]; // atom ids deliberately left out (e.g. load-bearing T4 items)
  readonly reviewedBy: string;                // human reviewer id
  readonly contentHash: string;
}
```

`TruthAnnotation` never appears in a package (invariant I4).

---

## 4. Authoring pipeline (offline, LLM allowed)

1. **Ingest.** The LLM reads `raw/` and `SCHEMA.md` and drafts packages per entity × cycle window and per question type × cycle.
2. **Cite.** Every sentence in a package cites at least one atom. A sentence without a citation fails lint.
3. **Lint.** Automated checks: orphan packages; broken links; claims with no citation; packages retrievable before their source atoms exist (**time leakage**); packages mentioning any atom from a later cycle; contradiction detection.
4. **Protect the designed failures.** Lint must *not* repair what the study depends on:
   - reasoning packages at cycle 18 integrate the two conflicting reports **without flagging the conflict** (`03` §5);
   - the three load-bearing T4 items are listed in `authoredOmissions` and are absent from reasoning packages at their cycles (`02` §3.2);
   - no package describes the cycle-12 omission before it surfaces.
   These are whitelisted lint exceptions, each with a reason.
5. **Review.** The author reviews every package; the domain reviewer reviews Finnish register and plausibility (`11` §2.3).
6. **Freeze.** Packages are content-hashed into the scenario version. Any change after freezing is a scenario version bump (`00` §6).

**Volume estimate:** roughly 150–250 fact packages and 300–500 reasoning packages (20 cycles × 5–8 topics × 3 SA levels). With LLM drafting, review is the dominant cost; budget it alongside the corpus (`03` §10).

---

## 5. Runtime retrieval (browser, no network, deterministic)

```
query text
  → normalise (case-fold, keep Finnish diacritics)
  → HARD FILTER  cycle window ≤ current cycle · condition · tier rules
  → SPARSE       BM25 over retrievalKeys (authored inflected forms; no stemmer — I7)
  → DENSE        cosine over precomputed package embeddings; query embedded locally
  → FUSE         reciprocal-rank fusion of sparse + dense
  → GRAPH        optional one-hop expansion along package links, scored down
  → RANK         fixed-point scores, ties broken by package id
  → return top k package ids  (or an authored "no information" reply)
```

**Query embedding.** A small multilingual sentence-embedding model (e.g. an E5- or MiniLM-class model with Finnish coverage) run in the browser through ONNX in WASM, weights shipped in the asset bundle (I3). Candidate libraries include ONNX Runtime Web, Transformers.js, or a RuVector WASM package. **Every candidate's licence and every model's weight licence must pass I7 before adoption.** This is a check, not an assumption.

**Determinism (I1).** Floating-point inference can differ across CPUs. Three safeguards:
- run inference single-threaded on the WASM CPU backend only;
- quantise similarity scores to fixed precision before ranking, and break ties by id;
- **log the returned package ids for every query** (`07` §2.5), and make replay read results from the log rather than recomputing them. A replay mismatch is reported, not silently corrected.

**Fallback.** If the embedding model fails to load in pre-flight, the session is refused rather than run on sparse retrieval only, because a partial engine would be a different condition.

**Latency.** Retrieval latency is drawn from the same seeded distribution in both AI groups and matched to `directed` reply latency (`02` §1.1).

**No match.** A retrieval miss returns an authored reply ("Tästä ei ole tietoa järjestelmässä — voit kysyä yksiköltä.") and is logged as `retrieval_miss`.

---

## 6. What each group sees

| | No AI (`directed`) | Query AI (`assistive`) | Reasoning AI (`substitutive`) |
|---|---|---|---|
| Radio / browse | yes | yes | yes |
| Free-text query box | no | yes | yes |
| Engine returns | — | `fact` packages (verbatim atoms) | `situation` / `meaning` / `projection` packages |
| Cited sources visible | — | yes | yes, expandable to raw atoms |
| Same index and ranking | — | yes | yes |

The type of question matters for Paper 3:

- a reasoning-AI query that retrieves a `projection` package is a candidate "delegated projection" event;
- a query that retrieves `fact` packages or opens cited atoms is a candidate "verification" event.

Both event types are logged with package type.

---

## 7. Conflict to resolve with `02` §1.2

v3.0 requires the integrating condition to be **pushed, not offered**, because an unused capability produces a null that means nothing. Building reasoning AI as request-driven reverses that requirement for now.

Consequences to handle:
- **Engagement floor:** log reasoning-package retrievals per cycle and pre-register a minimum-use threshold (`11` §3.5).
- **Option kept open:** a per-cycle pushed reasoning package can be added later without changing the engine — it is the same package type delivered on a schedule.

---

## 8. Path to a live LLM later

The UI calls one interface:

```ts
interface Responder {
  respond(query: string, ctx: { cycle: CycleIndex; condition: ConditionId }):
    Promise<{ packageIds: readonly string[]; bodyFi: readonly string[]; source: "closed" | "live" }>;
}
```

- `ClosedResponder` — this document.
- `LiveResponder` — later: a grounded LLM restricted to the same frozen wiki, with the full generated text logged.

Adopting `LiveResponder` **breaks I1 and I6** and needs an invariant amendment covering replay from logged outputs, generated text treated as data, and a validity argument for why uncontrolled wording is acceptable. Adopting the live responder also endangers the designed omission at cycle 18, because a live model may flag the conflict. Do not adopt it for Paper 1 data collection without that review.

---

## 9. Tests

| Test | Asserts |
|---|---|
| `test/engine/closure.spec` | Runtime returns only frozen package or atom text; no string construction |
| `test/engine/time-leak.spec` | No package is retrievable before `validFromCycle`; no package cites a later-cycle atom |
| `test/engine/condition.spec` | Query AI never receives reasoning packages, and vice versa |
| `test/engine/omission.spec` | Load-bearing T4 items absent from reasoning packages at their cycles; cycle-18 packages carry no conflict flag |
| `test/engine/determinism.spec` | Same query, same cycle, same bundle ⇒ same ranked ids across the browser support matrix |
| `test/engine/recall.spec` | Pilot-1 Finnish query corpus meets the declared recall floor for both package types |
| `test/engine/latency.spec` | Query-AI and reasoning-AI latency distributions match each other and `directed` |
| `test/licence/models.spec` | Embedding model weights and runtime libraries pass I7 |

---

## 10. Open items created by this document

- Final condition ids (F3).
- Choice of embedding model and runtime library, after licence check.
- Recall floor and fusion weights (from pilot 1).
- Whether reasoning packages are also pushed per cycle (§7).
- Topic list per cycle for reasoning packages (with the domain reviewer; overlaps the channel vocabulary, `11` §1.3).

---

## Revision 17 Sep 2026 (d) — supersedes earlier amendments where they conflict

### One AI group, pull-only

§1 items 1–2 and §6 are replaced: there is **one AI group**. It receives integrated answers (`situation`, `meaning`, `projection` packages, with cited facts expandable) **only on request**. `fact` packages remain the expandable source layer inside each answer. Nothing is pushed (§7 is closed: no push).

### Intent-framed variant (Paper 2, cell 3)

Every package retrievable in phase B carries an authored `intentLineFi`, served **only** to cell 3:

```ts
interface InfoPackageAdditions {
  readonly intentLineFi?: string;     // phase B only; relevance to the commanded strategy
  readonly intentRelation?: "supports" | "conflicts" | "not_relevant";
}
```

Rules for the intent line:

- it states relevance to the current priority;
- it never names a unit, sector or action to take;
- it never refers to the participant's own choices;
- it is identical in wording across participants.

### Rule from review P3 — adopted

Every `situation`, `meaning` and `projection` package is written from **the same model state as that cycle's envelope, including its error**, never from truth. Lint rejects any package that describes a breach mechanism before it surfaces, or whose projection text is inconsistent with the envelope polygon. The load-bearing T4 items and the cycle-18 conflict flag stay absent as specified in §4.

### Package wording (review P2)

**Decided: fixed template.** Every integrated answer has the same four parts, in this order: **Tilanne** (state, one sentence) · **Varmuus** (certainty: varma / todennäköinen / epävarma / ei tiedossa) · **Lähteet** (named sources with report times) · **Merkitys** (implication, one sentence). Cell 3 adds the intent line as a fifth, final line. Lint enforces the parts, their order and a maximum length per part.

### Tests added

- `test/engine/intent-line.spec` — `intentLineFi` is returned only for cell-3 participants and only in phase B.
- `test/engine/no-push.spec` — the engine emits nothing without a query.
- `test/engine/envelope-consistency.spec` — projection packages agree with the cycle's envelope.

---

## Revision 17 Sep 2026 (e) — supersedes revision (d) where they conflict

- **Two engines on one index again.** LLM (`assistive`) returns `fact` packages; LLM reasoning (`substitutive`) returns template answers built on `situation` / `meaning` / `projection` packages, with cited facts expandable. Same ranking, same latency distribution. Both pull-only.
- `intentLineFi` is served only to LLM-reasoning participants in the intent-line cell, in phase B.
- `test/engine/condition.spec` is reinstated: LLM never receives integrated answers, LLM reasoning never receives bare fact lists as its top-level answer.

---

## Revision 17 Sep 2026 (f) — supersedes revisions (d) and (e) where they conflict

- **One engine in use:** LLM reasoning returns template answers (Tilanne · Varmuus · Lähteet · Merkitys), with the cited facts expandable underneath. `fact` packages remain as that expandable layer and are never a top-level answer.
- `intentLineFi` is served only to cell 3, phase B.
- `test/engine/condition.spec` asserts only that `directed` has no engine access.

---

## Revision 23 Sep 2026 (g) — supersedes the template in revision (f)

**Template changes to four parts, in this order: ANSWER (Vastaus) · BASIS (Perusteet — named sources with report times) · CERTAINTY (Varmuus) · WOULD CHANGE IF (Mikä muuttaisi tätä).** This drops the standalone implication line (**Merkitys**) and adds an explicit falsification/update-condition field. Cell 3's intent line remains a fifth, final line when shown. Lint's part-count, order and length-per-part checks move to the new four parts.

Rationale, stated so a later reviewer does not silently revert it: "would change if" gives the participant a concrete, checkable condition to hold the answer against — closer to the Type F falsification probe's own wording (`08` §3.4) — rather than a one-line implication they cannot verify against anything.

---

## Revision 23 Sep 2026 (j) — no radio

Follows `02` revision (j).

- **Raw layer consumers (§ layers table).** "No-AI group via radio/browse" becomes **"both groups via Haku (`25`)"**.
- **Capability table.** The row "Radio / browse" becomes **"Haku query builder: yes in every condition"**. No condition has a radio.
- **Latency.** "Matched to `directed` reply latency (`02` §1.1)" is withdrawn. AI answers use the same fixed 2.5 s as every query surface (`25` §4). `test/engine/latency.spec` asserts only that.
- **What the AI cannot see.** Unchanged: unrecorded knowledge is not indexed (`test/scenario/unrecorded.spec`). It is no longer reachable by asking either, so it separates neither group from the other.
- **Broad-question drop (§4).** `t4.water_state` is now a recorded T4 transcript (`19` revision (b)), so it enters the drop rule like the other T4 lines.
- `test/engine/condition.spec` is unchanged: `directed` (the Haku group) has no engine access.

---

## Revision 25 Sep 2026 (o) — closed responder for data collection; authoring-time LLM; the planted record

Follows `02` revision (o).

- **The responder for Paper 1 is `ClosedResponder`.** `LiveResponder` (§8) is not adopted for data collection. §8's reasons stand, and one more is added: a live model gives different wording to different participants, which breaks identical stimulus.
- **LLM at authoring time.** The four-part answers (revision (g)) may be drafted by a language model from the packages. The drafts are then frozen into the bundle, linted (parts, order, length) and reviewed by the domain reviewer. The drafting model is **Claude Opus 5.5** (`claude-opus-5-5`; researcher's decision, 25 Sep 2026). The bundle manifest records the model id, the prompt and the date. No network exception is needed at runtime.
- **The analysis agent is named Thinker** (`02` revision (o) §3). The name and framing change only the tool label, the answer header, the training text and the tool's introduction. It does not change the template, the retrieval or the logging.
- **The planted record** (`02` revision (o) §5, fault F7). It is an ordinary atom with no special case at runtime. Every answer whose packages include it is built with it, for the rest of the session, and its BASIS part cites its source and report time. There is no correcting record. Where an answer about the power line draws on both the grid operator's cycle-6 record and the cycle-8 log entry, it settles on the later entry (*de-energised*). This is the designed failure.
- **Test added:** `test/engine/planted.spec`. It asserts that:
  - the planted atom is retrieved by the authored target questions from step 8 (view V6) onward, and the BASIS part of each answer cites it;
  - no AI answer marks the record as doubtful or says that the line is live;
  - the grid operator's cycle-6 record is reachable through Haku in both groups;
  - no atom anywhere confirms the de-energisation.

---

## Revision 25 Sep 2026 (p) — views and the rekindle objection

Follows `26`.

- **Knowledge states are per view.** `validFromCycle` is remapped from steps to views (`26` §6), which gives 14 states for Opus 5.5 to draft and the reviewer to check.
- **The rekindle objection** (`26` §5) is an ordinary atom. Under the broad-question rule (§4), a broad question about the bog in V7–V8 settles on *in hand*, and a narrow question returns the objection and the overruling reply.
- **Test added:** `test/engine/rekindle.spec`, as `26` §7.

---

## Revision 25 Sep 2026 (q) — Thinker is a live LLM over hybrid, time-gated retrieval

Decided by the researcher on 25 Sep 2026. **Supersedes** §1 items 3–4, the runtime part of §5, §8's "do not adopt it for Paper 1", revision (o)'s "`ClosedResponder` for Paper 1" and "LLM at authoring time", and revision (p)'s "settles on *in hand*" wording, wherever they conflict.

### Why

- **Participants ask open, varied questions.** A closed answer set fails on unforeseen ones and invites disuse, which would give a null result about a straw-man LLM.
- **The claim is about an LLM facilitator.** A frozen template is not one.
- **H2 needs an identical world, not identical wording.** The world (fire, records, timing) stays identical. Thinker's wording varies and is logged in full, so each participant's exposure is measured.
- **Vector retrieval over the raw records keeps the Haku contrast pure:** the same records and the same time gate, with the machine integrating only on request (`02` revision (j)). It also represents the systems actually deployed.
- **Rejected alternatives.**
  - **A compiled LLM wiki:** it adds a pre-digested layer the Haku group lacks, so an effect could be the digest's rather than the LLM's. It is kept as a later study arm.
  - **Full context:** it removes the realistic failure mode (retrieval misses), and the model would likely catch F7.

### Pipeline, per question

1. **Time gate.** Candidates are the records released by the current virtual time: the same set Haku can reach.
2. **Hybrid retrieval.** Lexical scoring (tokens, including codes such as `EK11`, `L3`, `TOIMINTA-2`) plus vector similarity from a fixed embedding model. The index is built at build time and frozen. The two scores are fused with declared weights. Top-k is fixed (default 8), with a declared **recency tie-break** (newer first). There is no other re-ranking.
3. **Generation.** A pinned model `claude-opus-5-5`, a fixed and versioned system prompt (its hash is in the bundle manifest), temperature 0 and a fixed maximum length. The model's input is the question plus the retrieved records (text, source, report time) and nothing else. The output is the four-part template of revision (g): *Vastaus · Perusteet · Varmuus · Mikä muuttaisi tätä*. BASIS cites source and time. The prompt says: answer only from the given records, prefer the latest record per source, and say when the records are insufficient. It says **nothing** about hiding or surfacing conflicts.
4. **Logging** (`07` revision (q)): the question, the retrieved record ids with scores, the prompt hash, the model id, the full answer, the latency and a fallback flag.
5. **Latency floor.** An answer is shown no earlier than 2.5 s after submission (`25` §4). Slower answers are shown when ready.
6. **Fallback.** If the API fails or times out (default 20 s), the deterministic template over the same retrieved records is shown and logged with `fallback: true`.

### Determinism, stated honestly

Deterministic: the time gate, the index, retrieval, top-k and the prompt. **Not guaranteed:** the wording, because temperature 0 is not bit-reproducible. A replay uses the logged answer. Identical stimulus holds for the world. Thinker exposure is measured per participant.

### The designed events under retrieval (none is special-cased)

- **F7** (`02` revision (o) §5): the newest record on the power line, so it ranks first on line questions. The grid operator's step-6 record may fall outside top-k.
- **The rekindle objection** (`26` §5): broad bog questions fill top-k with *in hand* status lines, and narrow questions retrieve the objection.
- **The contradiction (V13):** whether both reports are retrieved depends on the question (H3).

The model may still flag a conflict on its own. That is measured behaviour, coded from the log (`09` revision (q)).

### Architecture

A small **server proxy** holds the API key (never in the browser), enforces the model id and the prompt, calls the model and writes the log line. Retrieval runs **server-side**, over the index shipped with the bundle, so there is one implementation. The browser sends the question, the view and the virtual time. The Haku group never calls the proxy. The invariant amendments are in `00` revision (q).

### Data protection

Questions reach Anthropic through the proxy. The consent text says so, participants are told not to type personal data, and the data-processing agreement and the university's data-protection review are completed before pilot 1 (`09` revision (q)).

### Tests (replace those of revisions (o) and (p))

| Test | Asserts |
|---|---|
| `test/engine/retrieval.spec` | Time gate (no record after the current virtual time); the same question and time give the same ids on two runs; hybrid retrieval finds code tokens (`EK11`, `L3`) |
| `test/engine/planted.spec` | The F7 atom is retrievable from step 8 and ranks in top-k for the authored power-line questions; the grid operator's record is reachable through Haku; no atom confirms de-energisation |
| `test/engine/rekindle.spec` | For the authored broad bog question at V7, top-k excludes the objection; for the authored narrow questions it includes it. Retrieval is asserted, never generated text |
| `test/engine/fallback.spec` | A proxy failure gives the template answer, and the fallback is logged |
| `test/engine/prompt.spec` | The system prompt's hash equals the manifest |

### Pilot 1 check (`10` revision (q))

From the logs, for the AI group:
- the share of participants who receive F7 in an answer;
- the share who receive the objection;
- the share who receive both V13 reports;
- the share of answers in which the model flags F7 on its own.

If a designed event reaches fewer than 10% of AI participants (a proposal), it is revisited before the main study.

### Open (`11` §7.9)

The embedding model (Finnish, licence I7), the fusion weights, top-k, the system prompt text, proxy hosting and a cost ceiling.

### Amendment 1 Oct 2026 — routine-line collapse and per-source cap (retrieval frozen)

Decided by the researcher on 1 Oct 2026. Amends step 2 of the pipeline above ("There is no other re-ranking"); nothing else changes.

**Problem.** About 140 of the 787 records are near-identical position lines (`AVL …`), as many are asked-for status lines (`… (kysyttäessä): Vettä säiliössä …`), and about 100 are drone sensor-log lines. On narrow questions they crowd top-k and push single records out. This is an artefact of the generated log, not a property of the LLM, and it would contaminate the study.

**Rule (`app/retrieval/routine-collapse.ts`; Haku, the time gate and the log are unchanged).** Before scoring, a gated record belongs to a *routine family* when it is logged or asked-for (tier T2 or T3, not lateral traffic) and its text opens with a header (the part before the first `: `, at most 48 characters) that carries a label word (no digit, not the record's own source id). The family is (source id, tier, header with digit runs masked to `#`). A family whose members span at least **3 distinct gated steps** keeps only its **newest** member (observation time, then step, then id). BM25 statistics and min-max normalisation are computed over the records that remain. After ranking, top-k holds at most **3 records per source**, taken in rank order. Families are found by structure alone: no rule names a record id, a source or designed-event text, and a test (`test/retrieval/routine-collapse.spec.ts`) checks that no file in `app/retrieval/` mentions a designed-event id, source or phrase.

**Neutral evaluation (`content/thinker/neutral-eval.json`, `npm run thinker:eval`).** 30 Finnish commander questions over unit status, water, wind, spread direction, spot fires, evacuation, road access, drone findings, sector status and lateral coordination, each with a view (time gate at the view's start) and the records a correct answer needs (48 needs), named by stable features (actor, event type, content substring, newest or any), so the set survives a regenerated corpus. The questions were written **without targeting the designed events**: none asks about the rekindle objection, the bog smoulder, the 110 kV line / F7 or the step-18 contradiction, and no designed-event record is a relevance target. Six candidate configurations and the selection rule (highest mean recall@8, then MRR@8, then the simpler candidate) were declared before the run. Results with the frozen e5 vectors (hybrid mode):

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| baseline (revision (q)) | 0.767 | 0.658 |
| collapse | 0.833 | 0.708 |
| cap 2 per source | 0.700 | 0.658 |
| cap 3 per source | 0.733 | 0.654 |
| collapse + cap 2 | 0.733 | 0.700 |
| collapse + cap 3 (frozen first, superseded below) | 0.850 | 0.718 |

**Frozen.** The selected configuration is declared in `THINKER_RETRIEVAL_CONFIG` and mirrored, with the evaluation, in `content/thinker/manifest.json` (`retrieval.routineCollapse`, `retrieval.maxPerSource`, `retrieval.neutralEval`). The designed items took **no part** in the choice. Only after the freeze, a report-only probe (`tools/thinker/probe-planted.ts`) recorded where the objection and F7 rank for a few natural questions; nothing was changed because of it. What Thinker then does with the designed events is a result. The documented ranks in `planted.spec` and `rekindle.spec` were updated to the frozen configuration's actual behaviour.

**Re-selection on the final corpus (1 Oct 2026, same day).** The first freeze was run on the corpus before the communication and drone revision (926 records after it, against 784). Because the frozen stimulus is the final corpus, the same six candidates and the same declared rule were re-run on it, with the needs re-resolved by their stable features (`npm run thinker:eval -- --write`):

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| baseline | 0.744 | 0.637 |
| **collapse (frozen)** | **0.811** | **0.658** |
| cap 2 per source | 0.678 | 0.646 |
| cap 3 per source | 0.694 | 0.637 |
| collapse + cap 2 | 0.711 | 0.658 |
| collapse + cap 3 | 0.739 | 0.653 |

The rule selects the collapse **without** a per-source cap, and that is the frozen configuration (`maxPerSource: null`). The planted-item probe was again run only afterwards and played no part; it is reported, not acted on.

**Review fix (1 Oct 2026, same day).** Code review found that a family keyed on source, tier and header alone merged records that share a header but say different things (a crew's request with its fire report; one unit's refill with another's in the shared water-supply log), so Thinker lost distinct reports that Haku still showed. The rule now also requires the body to be the same routine line: the same named entities (all-caps or letter-digit codes) and a word overlap (Jaccard, digits masked) of at least 0.5 with the family's first member, families formed oldest first. The neutral set gained n31–n34, whose needs only older, distinct records meet (requests, one unit's refill), so dropping such records now costs recall. Re-run with the same candidates and rule (34 questions, 52 needs):

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| baseline | 0.745 | 0.627 |
| **collapse (frozen)** | **0.775** | **0.642** |
| cap 2 per source | 0.686 | 0.637 |
| cap 3 per source | 0.701 | 0.628 |
| collapse + cap 2 | 0.701 | 0.645 |
| collapse + cap 3 | 0.716 | 0.638 |

The rule again selects the collapse without a cap; that is the frozen configuration.

**Re-run after the content-consistency fixes (1 Oct 2026, same day).** The corpus was regenerated after the content review (refill timelines, one drone battery model, no "not imaged" statements, exact distances, area reports to 20:00, SPOT as the 17:01 reporter, wording caps; 926 records). Same candidates, rule and questions:

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| baseline | 0.765 | 0.613 |
| **collapse (frozen)** | **0.794** | **0.629** |
| cap 2 per source | 0.706 | 0.622 |
| cap 3 per source | 0.706 | 0.615 |
| collapse + cap 2 | 0.721 | 0.627 |
| collapse + cap 3 | 0.721 | 0.621 |

The rule again selects the collapse without a cap; the configuration is unchanged. The planted probe, run afterwards and not acted on: the broad bog question still leaves the objection outside top-k (10th); the narrow ones still miss it (27th, 18th); for "voimajohto" F7 is 6th at V6, 7th at V7 and now also 7th, inside top-k, at V12 (before: outside).

**Re-run after the practice view moved to W2 (1 Oct 2026, same day).** The practice view now carries its own starting-picture traffic at 12:00–12:20 (21 records, searchable later as history; 947 records in all). Same candidates, rule and questions:

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| baseline | 0.706 | 0.609 |
| **collapse (frozen)** | **0.750** | **0.598** |
| cap 2 per source | 0.696 | 0.617 |
| cap 3 per source | 0.691 | 0.611 |
| collapse + cap 2 | 0.696 | 0.597 |
| collapse + cap 3 | 0.721 | 0.593 |

The rule again selects the collapse without a cap; the configuration is unchanged. Recall is lower because the 12:00 records now compete with the 13:20 ones on early-view questions; not tuned. Planted probe afterwards, not acted on: broad bog 10th (outside top-k); narrow 29th and 18th; "voimajohto" F7 6th at V6, 7th at V7, 7th at V12.

**When the corpus is regenerated,** the index is rebuilt (`npm run thinker:index`, which keeps the evaluation block) and `npm run thinker:eval` is rerun; `-- --write` refreshes the resolved-id snapshot in the evaluation file and the results in the manifest. A change of configuration after that would be a new, dated amendment.

### Note 2 Oct 2026: neutral eval after the weather forecasts

The corpus now has 953 records: six forecasts were added (`18` amendment of 2 Oct). The neutral eval was re-run.

**The selected configuration is unchanged.** `collapse3` is still chosen by the declared rule. Its scores changed:

| Measure | Before | After |
|---|---|---|
| recall@8 | 0.750 | 0.706 |
| MRR@8 | 0.598 | 0.617 |

**Likely cause, not confirmed.** The neutral wind questions (n05 "Mistä suunnasta tuulee…", n06 "Onko tuuli kääntynyt?") need the station's `SAA` readings, and those now compete with the forecasts. The test fixture has no query vectors for these questions, so I could not check the ranks directly. To pilot: whether wind questions should count a forecast as a valid answer.

**Effect on F7.** One forecast wording was changed to avoid "voimassa", which matches "voima" in "voimajohto" after stemming. With that change, F7's ranks for the power-line questions are exactly as before (`test/engine/planted.spec.ts` unchanged).

### Note 2 Oct 2026: after the rekindle redesign

The corpus has 963 records and was regenerated: the rekindle is at the origin, there is no shower, and the forecasts say no rain. Collapse3 recall@8 is 0.706, the same as before. Three neutral needs were re-declared because their records changed by design:

| Need | Was | Now |
|---|---|---|
| n17 | "huoltotietä R2" | "Huoltotie R2" (EK14, step 13) |
| n11 | DR2's PP1 confirmation (the bog front) | DR2's "reuna etenee" |
| n31 | EK16's request at V12 | V13: EK16's only request is now at step 18 |

**F7 ranks unchanged.** A second "voimassa" in a forecast was reworded so that F7's ranks are exactly as before.

---

## Revision 4 Oct 2026 (u) — the strategy-guided prompt variant (`27` §3)

**This supersedes** revision (d)'s "Intent-framed variant (Paper 2, cell 3)" wherever it conflicts, and `02` revision (t)'s statement that cells 2 and 3 get the same Thinker answers.

**Scope.** Cell `reasoning_intent`, views V8–V14. In VP–V7, and in `reasoning_once` throughout, the pipeline of revision (q) and its amendments is unchanged.

**What is unchanged in this cell:** the time gate, the index, retrieval, the routine-line collapse, top-k, ranking, the records given to the model, the four fields and their instructions, the model, effort, maximum length, timeout, latency floor and fallback rule.

**What differs (generation only):**
- The **server** builds the system prompt: the cell-2 prompt plus a strategy block that gives the directive verbatim under "Voimassa oleva linjaus (P2 klo 16.40)" / "Strategy in force (P2 at 16.40)". The server reads the cell from the session's allocation, never from the request body.
- The output schema gains **`linjaus: { tila: "sopii" | "ei_sovi" | "ei_liity", perustelu: string }`**, for this cell only.
- **Fallback:** `tila` = `ei_arvioitu`, "Linjausta ei arvioitu" / "Not assessed", deterministic.
- The variant (fi and en) is versioned and hashed in `content/thinker/manifest.json` like the others.

**Prompt principles** (binding on the text; `27` §3.2 gives the reasons): P1 the directive verbatim and nothing else about it; P2 the four fields under unchanged instructions, the directive used only in `linjaus`; P3 three symmetric status definitions, equal length, no examples; P4 one sentence citing the deciding record's source and time; P5 **no recommendation** — no action, posture, unit, sector or tasking named as something to do, no imperative or deontic wording; P6 nothing about views, keys, designed events or whether deviation is expected; P7 newest record per source first; P8 uncertainty in the sentence, no fourth status; P9 deterministic fallback; P10 the status logged as its own field.

**The prompt audit** (before pilot 2, `27` §3.3): a fixed question bank per phase-B view, five runs each, in both Thinker cells; status distribution and its concordance with the view's fit, grounding of the cited record, P5 violations, leakage into the four fields, length and latency. One revision is allowed, for generic failures only. **The prompt is never revised because its status disagrees with the keys**; a wrong status is a measured property of the treatment (`27` §3.5).

**Tests to add** (Thinker work package): the cell-2 prompt's hash is unchanged; the variant's hash equals the manifest; the request body cannot select the variant; the fallback gives `ei_arvioitu`; `linjaus` is absent in `reasoning_once` and before V8.

### Reconciled with the build (5 Oct 2026)

What exists (`server/thinker/`, `27` §3.2):
- **`prompt.intent.fi.md` / `.en.md`** (DRAFT): the standard prompt's intro plus one sentence saying the directive in force is at the end; rules 1–4 **word for word** the standard prompt's (tested); **rule 5** (new 5 Oct 2026) — *"Täytä nämä neljä osaa täsmälleen niin kuin täyttäisit ne ilman linjausta. Älä mainitse niissä linjausta äläkä arvioi niissä tilannetta linjausta vasten. Voimassa olevaa linjausta saat käyttää vain viidennessä osassa."*; **rule 6**, the fifth field, with **symmetric definitions and no example** ("sopii" / "ei_sovi": the situation described by the records fits / does not fit the directive as it is written; "ei_liity": what the records describe does not bear on the directive's way of working or aims), assessed from each source's latest record, uncertainty stated in the sentence; `perustelu` one sentence naming the deciding record's source and time, or what the records are about for `ei_liity`; **rule 7**, no recommendation of actions, units, sectors or postures in the `linjaus` field and no deontic wording ("pitäisi", "kannattaa", "suositellaan" / "should", "ought to", "is advisable"). Hashes in `content/thinker/manifest.json` (`promptIntent` `9c271cf3…592d`, `promptIntentEn` `25065a65…914`); the standard prompts' hashes are unchanged.
- **P5 is applied to the fifth field only:** the four fields stay under the standard instructions (P2), which have no no-recommendation rule; recommendations in the four fields are coded in the audit in both cells. Researcher decision (`27` §11 M3).
- **The directive block** is appended by the server from `hinge.intentStatement` (English from the labels), never from the client. The server logs `systemPromptHash`, the hash of the full system text sent, beside `promptHash` (the file's).
- **The cell:** the request names it (required, one of the two Thinker cells); the server picks the variant from cell × view. For a table-assigned session the request also carries the participant code and the server refuses a cell that is not the code's row in the allocation table. "The server reads the cell from the session's allocation, never from the request body" (above) therefore holds for table sessions only (`27` §11 M2); the planned test "the request body cannot select the variant" is replaced by that check.
- **The audit** is not run yet (before pilot 2).

---

## Revision 5 Oct 2026 (v) — English retrieval mode

Follows the researcher's decision R1 of 5 Oct 2026 (the study will most probably run in English). **Amends** revision (q)'s pipeline step 2 and its 1 Oct amendment for English sessions only, and replaces the default of `11` §7.10(d) ("Thinker searches a Finnish index in both languages").

### Problem

Until now Thinker retrieved over the **Finnish** record texts in both languages, and the frozen e5 index holds Finnish passages. An English question matched mainly through the multilingual vector half; the lexical half (BM25 over Finnish prefix-stemmed tokens) matched almost only codes such as `EK11`. Haku's free text (token overlap with the Finnish `retrievalKeys`) had the same problem. Measured on the English translation of the neutral set below, lexical half alone, frozen configuration: English questions over the Finnish treatment reach recall@8 **0.265** (MRR 0.140); over the English treatment **0.588** (MRR 0.443). The hybrid figures need the English index and are the researcher's run.

### The declared English treatment

**Retrieval language = the session language** (the request's `language`). Finnish sessions are unchanged in every respect.

| Part | English | Unchanged from Finnish |
|---|---|---|
| Candidates | the time-gated atoms | yes |
| Passage | source id + `: ` + the record's English text (`app/i18n/text.ts` `recordIn`; the Finnish where a record has none — all 964 have English) | structure |
| Routine-line collapse | computed on the **Finnish source text** (the record's structure), so exactly the same records compete as in Finnish; scoring then uses the English passages | rule, 3 steps |
| Lexical half | BM25 (k1 1.2, b 0.75) with the English tokeniser `en-sstem-prefix5-v1`: lowercase; an English possessive (`'s`, `’s`, a bare apostrophe after *s*) dropped; a code's case ending after a colon dropped (as in Finnish); tokens are runs of letters and digits joined by inner hyphens; a token with a digit (`EK11`, `L3`, `TOIMINTA-2`, `110`) kept whole; every other word reduced by **Harman's S-stemmer** (*-ies*→*-y* unless *-eies*/*-aies*; *-es*→*-e* unless *-aes*/*-ees*/*-oes*; *-s*→ removed unless *-us*/*-ss*) and then cut to its first **5 characters** (the Finnish prefix rule). The plural step is added because a 5-character cut alone does not join *fire/fires*, *unit/units*, *line/lines* | BM25 parameters, prefix length, codes |
| Vector half | the same pinned embedder (multilingual-e5-small, `passage: ` / `query: ` prefixes) over the English passages, in `content/thinker/index.en.json` (`"language":"en"`; one vector per atom, rounded, sorted by id) | method, precision |
| Fusion, top-k, tie-break | min-max, 0.5/0.5, top-k 8, newer first then id | yes |
| Configuration | `THINKER_RETRIEVAL_CONFIG_EN` — **provisional, equal to the Finnish one** (collapse3, no per-source cap) until the English evaluation selects | — |

**No mixing.** Each index file names its language; every lookup checks the passage hash in that language, and `hybridRetrieve` refuses an index of the other language. The proxy (`server/thinker/handler.ts` `retrievalRoute`) serves an English request with the English index; without it:
- **study mode** (`npm run thinker:server -- --study` or `THINKER_MODE=study`): the proxy **refuses to start** unless `index.en.json` is present, from the loaded embedder, equal to the manifest's `indexEn.sha256`, and `retrievalEn.neutralEval.status` is `frozen`; `--lexical-only` is refused too. A request that still reaches a proxy without the English index gets HTTP 503, never another treatment;
- **demonstration mode** (the default): the startup log says the English index is absent, and English questions are retrieved with the **whole Finnish treatment** (Finnish passages, tokeniser and index); the response and the log carry `retrievalMode: "hybrid_fi_fallback"`, `retrievalLanguage: "fi"`.
Every response and log line now carries `retrievalLanguage`, and the log line `retrievalIndex` (the index file, or null for lexical only). The browser's local fallback retrieves lexically over the session language's passages. Telemetry: `ai_chat_answer_received.retrievalLanguage` (`07`/`record-kinds.ts` note).

**Haku free text in English** (`app/retrieval/closure.ts` `retrieveClosedEn`): the same closed token-overlap ranking (ties by id, I6) over English keys — the source id, every word of the English text of four letters or more (the Finnish key rule) plus every code (a token with a digit) of any length, possessives dropped, a declared list of 48 English function words removed — plus the codes among the authored Finnish keys. The Finnish search is unchanged.

### The English evaluation (declared before any English hybrid run)

- **Questions:** `content/thinker/neutral-eval.en.json` — the 34 questions of `neutral-eval.json` translated faithfully (DRAFT, for native and domain review), item for item. Each takes the Finnish question's id, topic, view and **needs** (the same records by the same stable features, read from the Finnish file at every run; the runner refuses a set that is not the Finnish one item for item). Same exclusions: nothing about the designed events.
- **Candidates and rule:** the same six candidates (`CANDIDATE_CONFIGS`) and the same rule (highest recall@8, then MRR@8, then the earlier candidate).
- **Authored questions** (`tools/thinker/authored-questions.ts` `AUTHORED_QUESTIONS_EN`, `PLANTED_PROBES`): English translations of the rekindle, F7 and code questions, item for item; their vectors go to `content/thinker/authored-queries.en.json`. The planted/rekindle probe stays **report-only** (`tools/thinker/probe-planted.ts --lang en`) and takes no part in the choice.
- **Freeze:** `npm run thinker:eval -- --lang en --write` records `retrievalEn.neutralEval` in the manifest; only a hybrid run may write, and the status is `frozen` only when the rule selects the declared `THINKER_RETRIEVAL_CONFIG_EN`. If it selects another candidate, the constant is changed to it in a further dated amendment and the run repeated.

### Procedure for the researcher (needs the model; cannot run in the build environment)

```
npm run thinker:index -- --lang en                 # writes index.en.json, authored-queries.en.json, manifest indexEn + retrievalEn; Finnish files untouched
npm run thinker:eval -- --lang en                  # hybrid; check "mode hybrid" and the selected candidate
npm run thinker:eval -- --lang en --write          # records retrievalEn.neutralEval (status frozen if selected = declared)
npx tsx tools/thinker/probe-planted.ts --lang en   # report-only, after the freeze
npm run ci                                         # green
npm run thinker:server -- --study                  # starts only if the English treatment is built, declared and frozen
```
Then commit the three new/changed files under `content/thinker/` and record the results table here as a dated note. (`npm run thinker:index` without `--lang` rebuilds both languages; on an unchanged corpus and model the Finnish files are byte-identical.)

### What stays unchanged

Finnish sessions: passages, tokeniser, index (`index.json`, its manifest hash), authored queries, configuration, evaluation and its frozen results; the time gate; the model, prompts and their hashes; the latency floor and fallback rule; the designed events (none is special-cased in either language). The Finnish tests (`planted.spec`, `rekindle.spec`) keep their documented ranks.

### Tests added (run without the English index)

`test/retrieval/english-retrieval.spec.ts` (tokeniser, passage by language, no mixing, lexical-only English, the collapse in both languages, an English index built by the build's code path from a stub embedder), `test/server/thinker-english.spec.ts` (language routing, 503 refusal, demonstration fallback logged, study-mode startup refusal), `test/retrieval/haku-english.spec.ts` (English Haku, the session's Haku and local fallback by language), `test/retrieval/neutral-eval-en.spec.ts` (the English set, the runner on a stub embedder).

### Open

Native and domain review of the translated questions; whether English hybrid results differ enough from Finnish to matter for pooling (`11` §7.10(d)).

---

## Revision 6–7 Oct 2026 (y) — model, Finnish Haku matching, the frozen evaluations

### y.1 The model

Revision (q)'s `claude-opus-5-5` was replaced on 6 Oct 2026 by Google Gemini (`64aedce`, `gemini-2.5-pro`), and is now **`gemini-3.8-flash`** (`server/thinker/config.ts` `THINKER_MODEL_ID`, `content/thinker/manifest.json` `model.id`). Unchanged from revision (q): one pinned model, no server-side model fallbacks (a different model would silently change the treatment), `temperature: 0`, at most 2000 output tokens, a 20 s model timeout and no retries; the wording can still vary between calls and is logged in full. Model errors are classified (`fallbackReason`) and a timeout aborts the request (`test/server/thinker-model-errors.spec.ts`).

### y.2 Haku's Finnish lexical search (`app/retrieval/closure.ts`)

Researcher decision, 7 Oct 2026 (Finnish Haku gets prefix stemming), refined in fix passes 2 and 3. Applies to Haku's lexical search over `retrievalKeys` (`retrieveClosed`), not to Thinker's BM25 (which already cut words to five letters, `prefixStem: 5`). English search (`retrieveClosedEn`) is unchanged. **Dormant since 8 Oct 2026:** the panel that called it is withdrawn from the UI (`25` revision (z)); the Haku chat retrieves through the hybrid pipeline, not `closure.ts`.

1. **Prefix stem.** Every word token of the query and of the keys is cut to Thinker's prefix (`PREFIX_STEM_LENGTH` = 5); a code (a token with a digit: EK11, L3, 110) stays whole.
2. **Long words.** A word of **10 letters or more** (`FINNISH_LONG_WORD`) is taken as a compound and keeps **8** (`FINNISH_LONG_STEM`), so "pohjoisreuna" no longer meets every "pohjoi-" word.
3. **Consonant gradation.** A fixed alias table (`HAKU_FI_GRADATION_STEMS`) maps the stems of inflected forms whose stem changes to their base form: vesi (veden, vedet, vedes, vedel, vettä), kärki (kärje, kärke), tie (tien, tiell, tiele, tiest, tietä), suo (suon, suoll, suole, suota). A stem that also begins another word is left out.
4. **Short stems.** A four-letter stem (palo, savu, vesi) also matches a stem that begins with it, either way round; longer stems and codes match only whole.
5. **Ranking.** Records are ranked first by the number of the query's words found **whole** in their keys, then by stem and gradation matches, then by atom id (deterministic, I1).

Measured (systems-analyst run 3, 7 Oct 2026): "pohjoisreuna" at step 1 returns 2 hits, both containing the word (run 2: 21 hits, 2 relevant); recall parity holds ("vesi" 300 vs "water" 255). Tests: `test/retrieval/closure.spec.ts`, `haku-english.spec.ts`.

### y.3 The frozen evaluations (no re-selection)

> **Superseded by revision (ab) §ab.6:** with the recency boost the Finnish rule selects `collapse3+cap3` over the declared `collapse3`; the researcher kept the declared `collapse3` (a documented post-freeze mismatch, §ab.6). The rank "224th" below reads 230th (§ab.5).

- **Finnish:** `collapse3` (no per-source cap), selected 1 Oct 2026 by the declared rule; the run on the fix-pass-3 corpus (974 records) again selects `collapse3`.
- **English** (revision (v)): `neutral-eval.en.json` is **frozen** at the declared `collapse3` (recall@8 .716, MRR@8 .504; 7 Oct 2026). A **post-freeze check** on the fix-pass-3 corpus is recorded in the manifest (`retrievalEn.neutralEval.postFreezeCheck`): collapse3 recall .574 / MRR .472; the rule would now select `collapse3+cap3` (.623 / .485). **Researcher decision (7 Oct 2026): not re-selected, not tuned;** the result is reported as a post-freeze finding.
- **The V7 rekindle objection** (`test/engine/rekindle.spec.ts`, actual ranks, not tuned): the broad question "onko lohko 3 hallinnassa?" leaves it far outside top-k (224th), as designed; the narrow "kyteekö syttymäkohta" ranks it **9th** (10th after fix pass 2; 7th before the 6 Oct generator fixes), **just outside top-8**, because KY21's own-stretch lines ("hehkuvaa kariketta", FF1) rank above it; "VPK syttymäkohta" ranks it 17th. `26` §5 intends the narrow questions to reach it; this is documented as a finding for the pilot check (`10` revision (q)), not corrected (`11` §7.18). (Verified 8 Oct 2026 against 6b48622: broad 222nd → 224th; narrow 9th and 17th unchanged. The planted F7 record for "voimajohto" ranks 5th at V6, 6th at V7 and 6th at V12, below the grid operator's record, and first for "110 kV linja" and "onko 110 kV linja jännitteetön?" at V6, V7 and V12 (`test/engine/planted.spec.ts`).)

---

## Revision 8 Oct 2026 (z) — the pipeline serves Haku's chat for everyone; the Open Thinker

Researcher decision, 8 Oct 2026 (`02` revision (z)). **Supersedes revision (u)** (the strategy-guided variant) for every new session, and revision (q)'s "Thinker, the AI group's tool" as the pipeline's scope.

- **`/api/thinker` is Haku's structured chat**, for every cell (`radio` included) and every view, the practice view (0) included. Always the standard prompt and the four-field template of revision (g); never `linjaus`. The pipeline of revision (q) with its amendments (time gate, routine-line collapse, top-k 8, fusion, latency floor 2.5 s, local lexical-only fallback) is unchanged. The proxy checks the cell against the allocation table when a participant code is sent; `cell` must agree with `condition` (`radio` ⇔ `directed`).
- **`/api/thinker-open` is the Open Thinker** (AI condition, main views): the same time-gated retrieval and the same model at temperature 0, its own frozen prompt (`prompt-open.{fi,en}.md`, hashed in the manifest as `promptOpen` / `promptOpenEn`; the server refuses to start on a mismatch). Plain text, no JSON schema. It receives the conversation's history (at most 10 alternating turns, the participant's first; a model turn cut to 4000 characters; body ≤ 64 KiB). The prompt **invites options and recommendations**. Its fallback is the local template rendered as plain text.
- **Withdrawn:** revision (u)'s strategy-guided prompt is not used. `prompt.intent.{fi,en}.md` stay in the manifest with their hashes, to read old logs; `thinkerPromptVariant` is kept for the same reason. The manifest's `model.output` note still mentions `linjaus` (stale text; reported). **Revision (aa): the Open Thinker prompt, its plan context and its failure state are described there.**

> **Superseded by revision (ab):** the Open Thinker's prompt no longer "invites options and recommendations"; it gives options without a recommendation (§ab.2).
- **Designed events.** Retrieval is still not special-cased. The Open Thinker sees the same records, so the planted record (F7), the rekindle objection and the step-18 contradiction reach it exactly as they reach Haku; **but its answers may now recommend, which revision (q)'s "says nothing about hiding or surfacing conflicts" did not anticipate**. How the planted record and the contradiction are scored for Open Thinker answers is open (`11` §7.18).
- **Logging:** both endpoints log one server line per request (`tool`, `historyTurns` for the Open Thinker) and the client logs `ai_chat_*` with `tool` (`07` revision (y)).

---

## Revision 8 Oct 2026 (aa) — the Open Thinker is directive-aware; its unavailable state; English source names in Haku's basis

> **Superseded in part by revision (ab):** the prompt description in the first bullet (§ab.2), the plan context (§ab.4), the "Untested against the live model" bullet (§ab.7) and the "ranks were not re-measured" bullet (§ab.5: the broad rank is now 230th).

Follows `02` revision (aa) (researcher, 8 Oct 2026). Tests: `test/server/thinker-open.spec.ts`, `test/server/thinker-server.spec.ts`, `test/session/thinker-client.spec.ts`.

- **The Open Thinker prompt** (`prompt-open.{fi,en}.md`, frozen, hashed as `promptOpen` / `promptOpenEn`; `thinker:index` rewrites the hashes into `content/thinker/manifest.json`) is rewritten: it addresses an experienced fire chief as a strategic thinking partner; cites records as [T#, time]; marks inference and unknowns; gives options with trade-offs; says whether the commander's reasoning is in line with the higher strategy and what would justify departing; stops short of advising withdrawal or evacuation as an order (it raises them as questions); and answers in plain text. This supersedes revision (z)'s description of a prompt that "invites options and recommendations" without any anchor.
- **Plan context.** `openPlanContext(scenario, view, virtualTimeS, lang)` (`server/thinker/model.ts`) is prepended to the question for every Open Thinker request: the clock and view; the sectors with labels; the crews, drone teams and autonomous assets on scene; the posture and secondary-task options; and the intent in force: the phase-A intent (P2's first message) before V8, the directive verbatim (`scenario.hinge.intentStatement`) from V8. The context is built server-side from the view and clock the client reports. It is not in the retrieved records, so it does not change retrieval, the ranks or the evaluations.
- **Haku is unchanged:** standard prompt, no plan context, no directive, no history.
- **Fallback.** The Open Thinker no longer falls back to the local template as an answer. A failed request shows the explicit "unavailable" state with no excerpt (`02` revision (aa) §aa.4) and is logged as a fallback with its reason. Haku's fallback template (step 6) stands.
- **English sessions.** The English template answer (Haku's fallback, `template-answer.ts`) names the sources in its basis in English (`sourceName("en", …)`), not by their ids; the Finnish template is unchanged.
- **Untested against the live model.** No API key has been available, so the new prompt is exercised only against stubbed models (prompt text, context assembly, history and fallback). Its behaviour on the live model (whether it relates its reasoning to the directive as instructed, hallucinates a [T#], or advises withdrawal) is the first thing pilot 1 checks (`11` §7.18.2).
- **Retrieval ranks (revision (y) §y.3)** were not re-measured in this pass. (Verified 8 Oct 2026 against 6b48622 by `test/engine/rekindle.spec.ts` and `planted.spec.ts`: objection 224th / 9th / 17th; F7 5th / 6th / 6th for "voimajohto" at V6 / V7 / V12; §y.3 corrected.)

---

## Revision 8 Oct 2026 (ab) — the Open Thinker assesses and never enforces; recency; the clocks; the frozen evaluation

Persona round 5 (8 Oct 2026; 45 live questions through the production path, `gemini-3.5-flash`) and the researcher's decisions D1, D2 and D7 (`FIXPASS6.md`, `11` §7.18.4). Built in fix pass 6: `server/thinker/{model,handler,config}.ts`, `prompt-open.{fi,en}.md`, `prompt.{fi,en}.md`, `app/retrieval/hybrid.ts`, `app/session/{queries,thinker-protocol}.ts`. Tests: `test/server/thinker-open.spec.ts`, `test/retrieval/recency-boost.spec.ts`, `test/engine/{prompt,rekindle,planted}.spec.ts`, `test/session/thinker-client.spec.ts`. **This revision supersedes revision (aa)'s description of the Open Thinker prompt (the bullet "The Open Thinker prompt" and "says whether the commander's reasoning is in line with the higher strategy"), its "Untested against the live model" bullet, and revision (z)'s "The prompt invites options and recommendations".** Haku's pipeline is unchanged except for the recency boost, the clock line and rule 4 below.

### ab.1 What round 5 found

All 12 decision questions of V8–V14 were assessed against the directive, which was the intent; but the four no-fit probes (V9, V10, V14) each answered "departs from the directive, nothing in the records justifies departing", the retrieval for those questions contained none of the flare-up facts, and several answers used imperatives ("you must halt burnout", "you must immediately contact the police") or one recommended option. Also found: stale records used as current (a 74-minute-old "350 m" at 16:00; a 13:54 record as evidence at 19:40), a stale "[Intent, 16:20]" tag, a Haku "Certain, 7–8.8 m/min" over disagreeing reports, and Haku answering "what has the higher command ordered?" with an unrelated record at "Certain" (P2's messages are not corpus records). Open Thinker answers had a median of 157 words against a prompt that asked for about 150. Evidence: `scratchpad\sim\transcript5.en.md`, `run-summary5.md`.

### ab.2 The Open Thinker prompt: assess, never enforce (D1) — the frozen treatment

`prompt-open.en.md` (and its Finnish counterpart `prompt-open.fi.md`, the same rules) is rewritten. Its rules, quoted from the file as of 8 Oct 2026 (**the file and its hash `promptOpenEn` / `promptOpen` in the manifest govern; if the file changes this quotation must be refreshed**):

> Hard limit: 100 words in total. Count them.
> 1. Ground your answer in the records. When you rely on a record, cite its tag and time, for example [T2, 15:40], and name the source of each figure. Do not state as fact anything the records do not support.
> 2. Records stamped after the clock are already received. Per source use the latest record. If a record is older than about 30 minutes, state its age and do not use it as current evidence. Never say "certain" when sources disagree; say they disagree and which is newer.
> 3. Mark inference ("my inference:") separately from what the records state. Say what is unknown or missing and what would resolve it. The absence of a record is not evidence that something is not happening or that departing is unjustified; say what is missing.
> 4. On a decision question give at least two options with trade-offs (what each gains, risks, needs). Do not recommend one and do not voice a "safer option" stance.
> 5. The directive is a duty officer's order, not a safety finding. Never call departing from it unsafe by itself. Judge a tactic against the directive only when it is one of the plan options (postures, secondary tasks): say in line or departs. For any other tactic (for example a crew's burnout) say the directive does not cover it and leave the call to the commander. If the newest records show a small, new or unattended fire, or a concrete risk the directive did not foresee, say a departure can be justified, name those records, and add the sentence "Departures are reported up the chain." (a statement about reporting, not an order). Never say a plan "violates" the directive.
> 6. No imperatives: do not use the words "must", "should", "immediately" or "cease", and give no instruction to shift tasks. Life safety: if the records suggest crews or residents may be in danger, raise it only as a question for the commander.
> 7. Refer to sectors and units by the identifiers in the plan context. Keep each option to one line. Plain text only: no markdown, no bold, no asterisks, no headings; use at most two short paragraphs or three plain list lines. The commander reads it during an operation.
> 8. Withdrawal or evacuation: for a question about withdrawing crews or evacuating residents, give no verdict against the directive and do not compare anything with it. Give only the newest safety-relevant records (distance, rate of spread, escape routes, who is on scene) and the questions the commander has to answer.

What this changes against revision (aa): the Open Thinker is an **assessor**, not an enforcer. The directive is an order, not a safety finding (a departure is never "unsafe" by itself); the absence of a record is not evidence for either side; it gives at least two options and no recommendation or "safer option" stance; it judges a tactic against the directive **only when the tactic is a plan option** (postures and secondary tasks, `16`) and says "the directive does not cover it" for anything else (a crew's burnout from a held road is in line and not a plan option: `16` revision (ab)); a small, new or unattended fire, or a risk the directive did not foresee, can justify a departure, which "is reported up the chain"; and withdrawal or evacuation questions get records and questions only, **no verdict** (rule 8; `aiVerdictOf` also returns null for them, see ab.5). The standing instruction to relate the reasoning to the directive and the plan context (revision (aa)) stand; the plan context now carries the records clock (ab.4).

**Limits stated honestly.** The prompt is a **frozen treatment**, not a guarantee: rules 4–6 are checked by wording patterns in the tests and by the pilot, and the live model can still drift. **Length:** the output cap is `THINKER_OPEN_MAX_TOKENS` = 320 (about 110 words; Finnish runs near 2 tokens a word), the prompt asks for 100 words, and the live word-count overshoot (104–140 words in the 8 Oct live check) is **open** (`11` §7.18.4). The model remains `gemini-3.5-flash`, thinking off, temperature 0; the previous 2000-token cap stays for Haku.

### ab.3 Haku's prompt: recency, the directive's place (D2(b), D7)

`prompt.{fi,en}.md` gain: rule 2 (records stamped after the clock are already received; per source the latest record first; a record older than about 30 minutes is stated as old and not used as current evidence), rule 3's sentence that the absence of a record is not evidence, **rule 4 (D7): the higher command's orders and intent are in the banner and not in its records; asked what the higher command has ordered, Haku says so and that it cannot confirm it, and does not answer with an unrelated record**, and rule 5 (name each figure's source; never "certain" when sources differ). Haku stays neutral: no plan context, no directive text, no history. The withdrawn strategy-guided variant keeps the standard prompt's rules **as they were when it was frozen** (`prompt.intent.*`, `test/engine/prompt.spec.ts` `frozenStandardRules`): its hash is unchanged by this pass.

### ab.4 The clocks and the digest (D2(c), D2(d))

- **Records received up to.** `receivedUpToOf(gated, fallbackS)` is the latest `observedAt` among the step's gated records, which can be later than the view-start clock the client reports (the gate is per 20-minute step). The Open Thinker's plan context now reads "clock (window start) HH:MM, records received up to HH:MM" (`openPlanContext(…, receivedUpToS)`); Haku's user content gets a first line "Now: HH:MM / records received up to HH:MM" (`clockLineOf`; Finnish "Nyt: klo … / tietueet vastaanotettu klo … asti").
- **The digest.** Every Open Thinker request carries, after the retrieved records and with the next tags, a fixed digest of the current step's latest records (`latestDigest`): the newest record of each source, newest first; **5 from the sources that are not units on scene (observers, sensors, services) then 3 from the units** (`OPEN_DIGEST_FEEDS` = 5, `OPEN_DIGEST_UNITS` = 3, 8 in all), skipping records retrieval already returned; ties by atom id (deterministic). Its purpose is that the deciding fact (for instance SPOT 17:10, "new fire 0.5–1 ha, L3") is always visible, whatever the question retrieved. Haku has no digest. The digest is **not** retrieval: it does not change ranks or the evaluations; it is added to the server log line (`digest`: atom ids).
- **Consequence for Paper 2.** C (sound departure) in the no-fit views no longer depends on the participant's question happening to retrieve the deciding record for the Open Thinker; it can still depend on it for Haku. `27` revision (ab).

### ab.5 Recency boost (D2(a)) and the verdict (D6)

- **Recency boost** (`HybridConfig.recencyBoost`, `THINKER_RETRIEVAL_CONFIG`: `source` 0.05, `sector` 0.03; `recencyBoosts()` in `app/retrieval/hybrid.ts`). After lexical/dense fusion (a 0–1 scale), the newest candidate of each source gets +0.05 and the newest candidate that names each sector code (`L1`–`L4` in its text) +0.03 (a candidate once per boost kind). It is applied **only to candidates the question already matched** (base score above 0), so it reorders but does not add records; the tie-break is unchanged. It applies to both tools. `THINKER_RETRIEVAL_CONFIG_EN` is the same object, so English sessions get the boost too; the English evaluation's figures in the manifest were not re-run in this pass (the manifest's English block is unchanged) and describe the retrieval without the boost.
- **Effect on the measured ranks** (`test/engine/rekindle.spec.ts`, `planted.spec.ts` in the working tree): the V7 objection under the broad question "onko lohko 3 hallinnassa?" falls from 224th to **230th**; the narrow questions stay at 9th and 17th; the planted F7 record for "voimajohto" stays 5th / 6th / 6th at V6 / V7 / V12 and first for "110 kV linja". (Not re-run for this document: the suite reads a stale index until the regeneration of fix pass 6 finishes; confirm after `REGEN DONE`.) Revision (y) §y.3's 222nd/224th is superseded.
- **The AI's verdict** (`aiVerdictOf(answerText, lang, question?)` in `app/session/thinker-protocol.ts`, `AiVerdict` = `in_line` / `departs` / `not_covered`): extracted deterministically from the answer text, no model call. The **earliest** verdict phrase decides (patterns in `VERDICT_PATTERNS`: "in line", "consistent with" / "departs", "departure", "deviat…", "not in line" / "does not cover", "not a plan option", "outside the plan"; Finnish "linjassa" / "poikkea…" / "linjaus ei koske…"); no phrase, or a question about withdrawing/evacuating (`SAFETY_QUESTION`), gives `null`. The proxy returns it as `OpenThinkerResponse.verdict`; the client logs it as `ai_chat_answer_received.aiVerdict` (`07` revision (ab)); it is a **covariate** in the analysis (`09` revision (ab); `27` revision (ab)). It is a screen, not a judgement of the answer's correctness.
- **`modelVersion`.** The model build that answered (`response.modelVersion`) is logged with `usage` on both calls (`ModelUsage.modelVersion`), so a silent upgrade of "gemini-3.5-flash" is visible in the logs.

### ab.6 The frozen neutral evaluation: a documented post-freeze mismatch (decided)

With the recency boost in the retrieval, the manifest's Finnish evaluation (`content/thinker/manifest.json` `retrieval.neutralEval`, re-run on the 979-record corpus) is:

| Configuration | recall@8 | MRR@8 |
|---|---|---|
| **`collapse3` (declared 1 Oct 2026)** | **0.6912** | **0.5498** |
| `collapse3+cap3` | 0.6912 | 0.5571 |

The declared rule's selection is now narrowly `collapse3+cap3` (the same recall, a higher MRR). **Researcher decision, 8 Oct 2026: keep the declared `collapse3`; the 1 Oct 2026 freeze stands and is never re-selected.** The mismatch is documented, not tuned: the manifest records `declared: collapse3`, `selected: collapse3+cap3`, and `test/engine/prompt.spec.ts` asserts declared = `collapse3` and selected in {`collapse3`, `collapse3+cap3`}. The live configuration is `THINKER_RETRIEVAL_CONFIG` as in `hybrid.ts` (no per-source cap). The recency boost (source 0.05, sector 0.03) is itself the cause of the shift in the rule's selection.

**Known residual.** Haku can still return a roughly 30-minute-old EK13 water status: the older record scores higher on wording, and the boost is small. A stronger boost would move the rule's selection further from the frozen configuration. Documented, not tuned.

The **English block stays frozen** at the declared `collapse3` (`retrievalEn.neutralEval`, revision (y) §y.3); its post-freeze check (selected by the rule: `collapse3+cap3`) is unchanged. The manifest's note that "the Finnish run on the same corpus selects the declared collapse3" is stale after this pass (it now selects `collapse3+cap3`).

### ab.7 Not changed

The time gate, the routine-line collapse, top-k 8, fusion weights, the latency floor, Haku's local lexical fallback and the Open Thinker's explicit "unavailable" state (revision (aa)). The Open Thinker's conversation is cleared once, at the first view from V8 on, so phase-A advice does not carry into phase B (`QueryService.startView`, `orchestrator.ts`; `02` revision (ab)). The live model has now been run (45 + 7 calls, fallback rate 0 of 45, median 2.2 s; round 5) but the prompt of ab.2 has not been re-run through the full live set: pilot 1 does that (`11` §7.18.4).

## Revision 9 Oct 2026 (ah) — review fixes 9 Oct 2026 (Haku and the Open Thinker)

A live review (9 Oct 2026; English and Finnish sessions) found the Finnish Open Thinker always unavailable, Haku denying records it had, and the Open Thinker treating the phase-A intent as a directive. Fixed as follows; everything not named here is unchanged (the time gate, the declared retrieval configurations and their frozen neutral evaluations, top-k 8, the digest, the latency floor, the model and temperature).

### ah.1 Answer length and the output cap (C1; researcher decision 9 Oct 2026)

- The Open Thinker may answer in **up to 150 words** (was 100): both `prompt-open.*.md` say "Hard limit: 150 words" / "Ehdoton raja: 150 sanaa", and add "do not repeat the plan context or the question" (the first live run spent a third of its words restating it). Haku has no word limit (its answer field is "at most three sentences"); unchanged.
- `THINKER_OPEN_MAX_TOKENS` 320 → **1024** (`server/thinker/config.ts`). With 320, every Finnish call of the review ended `finishReason: MAX_TOKENS` (4/4, even short factual questions): Finnish runs about 2.5–3 tokens a word and the `[T#, hh.mm]` citations add more. Haku's cap (2000) is unchanged.
- **A cut-off Open Thinker answer** (`MAX_TOKENS`) is now shown up to its last complete sentence (`completeSentences`: a decimal, a clock or a list number never ends a sentence) and logged `truncated: true`; with no complete sentence it is the fallback `truncated`, as before. Decided because a cut at 1024 tokens is now rare and its complete sentences are still a grounded answer, whereas "unavailable" withholds it. Haku's JSON cannot be cut usefully: unchanged.
- **Live check** (`gemini-3.5-flash`, the review's four Finnish questions, final prompts): 4/4 answered, 147 / 131 / 126 / 99 words, 2.3–3.1 s, no fallback.

### ah.2 The current step's best matches (C2)

At V5 (English) Haku answered "no information about spot fires … Certain" while DR1's 15:31 SF2 record (`evt.c07.021`), 15:33 SF3 and EK12's 15:21/15:22 ember reports were in the log: SF2 ranked 13th behind step-2/3 records. Neither the declared retrieval nor its weights were changed (each language's configuration is frozen with its neutral evaluation, `11` §7.21). Instead, at the prompt layer — as the Open Thinker's digest (ab.4) — **every request of both chats carries up to `RECENT_MATCH_SIZE` = 4 of the question's best matches among the current step's records** (`recentMatches` in `server/thinker/model.ts`: the same `hybridRetrieve` with its language's declared configuration, over the gated atoms of the current step, skipping records the main retrieval returned). They follow the retrieved records with the next tags under "Newest records on the question (received in the current period):" / "Uusimmat kysymystä koskevat tietueet (vastaanotettu kuluvalla jaksolla):"; the Open Thinker's digest follows them and skips any record already there. The server log line carries `recent` (atom ids) and `clockVirtualS`; the response's `retrieved` (the frozen retrieval, what `ai_chat_answer_received.retrieved` logs in the browser) is unchanged, as for the digest. With it the V5 question reaches all three DR1 spot-fire records (live: "three confirmed spot fires … SF2 about 250 m north-east", DR1 15.29/15.31/15.33, rated uncertain because no work on them is reported).

**Consequence:** the measured ranks of the rekindle objection and the planted record (`rekindle.spec.ts`, `planted.spec.ts`) are ranks of the main retrieval and do not change; a designed record of the *current* step can now reach the model through this block (the objection, step 10, is current only at V7). The browser's exposure measures read `retrieved` and so do not count these records, as they do not count the digest.

### ah.3 Prompt wording (C2(b), H3, H4, H5, M1, M4, M5)

- **Haku / Search** (`prompt.fi.md`, `prompt.en.md`): calls itself "Haku" / "Search", not Thinker (M1). Rule 3: read every record before saying something is absent; **an answer that the records contain no X is never "certain" (at most "uncertain")**; a question whether someone warned, objected or raised a concern counts every record in which a source voices a risk or doubt or asks for a check (C2(b), H4: Finnish Haku at V9 had the objection and said nobody warned, "Varma"; live after the fix: "Kyllä, VPK varoitti klo 16.21 …", epävarma). Rule 4 names the role: the higher command is **the duty fire chief / päivystävä palopäällikkö (P2)**; their orders, directive and intent (määräykset, linjaus) are in the message log and the directive banner, not in the records, and the answer says so instead of "there are no orders" (H3; live: both languages now answer so). Rule 5: sources giving different figures for the same thing are never said to agree and never "certain" (M4; live: "7 to 9 m/min, but the sources do not fully agree … uncertain"). The certainty field: "certain" only when the newest records state the answer directly and no source disagrees.
- **Open Thinker** (`prompt-open.*.md`): the plan context's last block is either the commander's own intent (before the directive) or the directive in force (from 16:40). Rule 4 adds: never label an option, or what it gives, as safer, less safe, a safer distance, keeping crews safe or risking crew safety — name the concrete exposure instead (M5). Rule 5 applies **only when a directive is in force**; before it, the intent is never called "the directive" or an order, no option is said to be in line with or to depart from it, and the reporting sentence is not added (H2). Rule 8 (withdrawal, evacuation) now overrides rules 4 and 5 and forbids any comparison with the directive or intent, any citation of it and the reporting sentence (H5); its questions are listed under "Questions for you:".
- **Hashes re-frozen** in `content/thinker/manifest.json`: `prompt` 3628a277…36df, `promptEn` 8161cf75…2e82, `promptOpen` 7e263fd4…d15b, `promptOpenEn` 8790cedc…91a3. The withdrawn strategy-guided prompts are unchanged.

### ah.4 The phase-A intent and the verdict (H2)

`INTENT_BLOCK_LABEL` (the plan context before `STRATEGY_FROM_VIEW`) now reads "The commander's own intent so far (V1; no higher-command directive is in force)" / "Johtajan oma toiminta-ajatus tähän asti (V1; ylemmän johdon linjausta ei ole voimassa)" (was "Intent in force (P2, V1)"). `handleOpenThinkerRequest` returns **`verdict: null` for every view before `STRATEGY_FROM_VIEW`**: the review's phase-A answers were coded `departs` against an intent that is not a directive, which pollutes the verdict covariate (`09` revision (ab)). Logs from before this revision can carry phase-A verdicts; whether the analysis drops them (view < 8) is for `09`.

### ah.5 The practice view's clock (H1)

The browser sends `virtualTimeS` 0 in the practice view, whose step starts earlier; `prepare()` already gated it by the view's own start, but Haku's clock line ("Now: 13:20" while the screen showed 12:00) and the plan context used the request's 0. Both now use the view's start (`Prepared.clockS`); the log keeps the request's `virtualTimeS` and adds `clockVirtualS`.

### ah.6 In the browser (M2, M3, M6, L3)

- The Search answer card is headed with the tool's name in the session language ("Search" in English, `t.haku`); the English consent says "(Search and, if your session includes it, Thinker)", and the trust item and the unavailable note say Search (M2).
- Record tags are shown without their T-number (`displayAnswerText`, `app/session/chat-display.ts`): a bracket holding tags keeps what else it says ("[T7, 15:31]" → "(15:31)"; "(T4)" dropped). Display only; the log keeps the raw text (M3).
- A question over 500 characters, or one sent while the tool is busy, is refused at the input with a message and its text kept; the send is awaited in `try`/`catch`/`finally`, so nothing is thrown from the click path and the busy state always clears; the input no longer silently cuts a paste at 500 (M6). The session's own `RangeError` guard in `queries.ts` stays as a second line.
- On a resume both chats come back from the log (`SessionQueries.restoreChats`): Haku's answers and the Open Thinker's turns, an unanswered turn as unavailable; resuming at or after the hinge view keeps only the Open Thinker turns from the hinge on (the D6 clearing) (L3).
- Session flow (same pass): the resume offer's "Start a new session" is a secondary button with a confirmation step ("This ends the unfinished session. Start a new one?"), "Continue the session" the primary one; while a session runs, leaving the page (Back, reload, closing the tab) shows the browser's standard prompt (`warnBeforeUnload`: not at the end, not after a declined consent or a refused preflight, never under `navigator.webdriver`).

### ah.7 Not done

The neutral evaluation (`content/thinker/neutral-eval*.json`) is not extended with the H4 case: its declared exclusions forbid any question about VPK's rekindle objection, and its frozen blocks are not touched. H4 is covered by the prompt rule (ah.3) and the live check.

---

## Revision 9 Oct 2026 (aj) — the directive as the Open Thinker's system instruction

The researcher asked whether the commander's command is "actually set as a system prompt", so that it is reflected when the participant asks certain questions. Traced on 9 Oct 2026 against 0187dd1:

- **Before.** The directive reached the model, but as the last line of the **user turn**: `openPlanContext` (`server/thinker/model.ts`) put `Directive in force (P2, 16:40): "…"` (from V8; the phase-A intent before) into the plan context that opens every Open Thinker question, and `systemInstruction` was the frozen `prompt-open.*.md` alone. Both Thinker cells got it (`02` revision (aa): identical by design); Haku never (`27` U5; `prompt.*.md` rule 4). The text was one fixed directive (`hinge.intentStatement`, English from `labels.en.json`), never updated over the views; a history of earlier turns carried only the raw questions and answers, so trimming could not drop it. Live calls through the server code path (lexical retrieval, no model index) at V11 (English) and V9 (Finnish) already related the options to the directive ("Option 1 departs … Option 2 is in line …"). Nothing was dropped; what the researcher expected — an instruction, not a context line — was not how it was built.
- **Now.** `openSystemInstruction` (`model.ts`) appends the view's intent block to the frozen prompt as the **system instruction's last block**, after a separator, under the same labels (`DIRECTIVE_BLOCK_LABEL` from `STRATEGY_FROM_VIEW`, `INTENT_BLOCK_LABEL` before), read from the scenario and never from the request; `openPlanContext` no longer carries it. The log line gets `intentBlock: "directive" | "phase_a_intent"`; `systemPromptHash` is the hash of the text actually sent (prompt plus block) and differs from `promptHash` (the frozen file's). Haku's chat is unchanged (the standard prompt alone, every cell).
- **Prompt (both languages).** The second paragraph says the intent or directive is at the end of the instructions; rule 5 reads "only when the end of these instructions carries the higher command's directive in force … When a directive is in force, weigh the options against it: for each option that is one of the plan options (postures, secondary tasks) say whether it is in line with the directive or departs from it, and name the part of the directive that decides it (its way of working or a place it names)". Everything else in rules 1–8 (assess, never enforce; no recommendation; the justified departure and the reporting sentence; rule 8's withdrawal override; the 150-word limit) is unchanged. Hashes re-frozen in `content/thinker/manifest.json`: `promptOpen` d5bf1bc9…, `promptOpenEn` 29e817ef….
- **Verdict extraction** (`aiVerdictOf`): "aligns with" counts as `in_line` (the live wording); the earliest phrase still decides, so an answer that gives one option as departing and the other as in line is coded by whichever it names first — a known limit of the covariate, unchanged.
- **Tests.** `test/server/thinker-directive.spec.ts` builds the exact Gemini request for both Thinker cells at V8, V11 and V14 in both languages (the system instruction is the frozen prompt plus the directive verbatim; the user turn carries the question and plan context, not the directive), at V1, V5 and V7 (the phase-A intent, no verdict), with a 10-turn history (the same block), twice (the same body), and for Haku in every cell (no directive anywhere). `thinker-open.spec.ts` and `thinker-review-ah.spec.ts` follow.

---

## Revision 10 Oct 2026 (al) — one Open Thinker prompt per cell; rule 5 rewritten; logging and robustness

Review panel of 10 Oct 2026 (two professors, two fire commanders, an AI engineer); the researcher approved its recommendations. **Supersedes revision (aj)'s "Both Thinker cells, never Haku" (the block is now `reasoning_intent`'s alone), its rule-5 wording, and revision (ah) §ah.4's phase-A label.** Haku (`/api/thinker`, `prompt.*.md`) is unchanged and directive-blind in every cell. Retrieval (the time gate, the declared configurations and their frozen evaluations, top-k, the recent matches, the digest) is unchanged; the indexes were not rebuilt by this pass. Code: `server/thinker/{model,handler,config,deps,answer-checks,main}.ts`, `prompt-open.{fi,en}.md`, the new `prompt-open.once.{fi,en}.md`, `app/session/{thinker-protocol,queries}.ts`, `app/scenario/briefing.ts`, `app/i18n/ui.ts`, `app/render/ui/tour.ts`. Tests: `test/server/thinker-directive.spec.ts` (both cells), the new `test/server/thinker-al.spec.ts`, `thinker-open.spec.ts`, `thinker-review-ah.spec.ts`, `test/session/thinker-client.spec.ts`, `test/scenario/briefing.spec.ts`, `test/render/tour.spec.ts`, `test/engine/prompt.spec.ts`.

### al.1 Cell separation (the clean manipulation)

| | `reasoning_intent` | `reasoning_once` |
|---|---|---|
| Frozen prompt | `prompt-open.{fi,en}.md` (`promptOpen`, `promptOpenEn`) | `prompt-open.once.{fi,en}.md` (`promptOpenOnce`, `promptOpenOnceEn`) |
| System instruction | the prompt, then the order block: the framing sentence and P2's opening intent (V1–V7) or the directive verbatim (V8–V14) | the prompt alone, in every view |
| Rule 5 | relates each plan option to the directive (al.2) | "Orders": P2's orders and directive are in the message log and the banner, not given to it; it cannot confirm them and does not guess them; if the participant quotes an order's text it may relate the options to the quoted text as quoted, evidence first; an order is never a safety finding |
| Everything else | rules 1–4 and 6–8, the 150-word limit, the plan context, the records, the digest, the history, the model and its settings: identical | |

`openPromptFor(deps, lang, cell)` picks the prompt; `openSystemInstruction(prompt, scenario, view, lang, cell)` adds the block only for `reasoning_intent`. A missing prompt for a cell is an error (never the other cell's). The server refuses to start unless all eight prompt hashes match the manifest (`loadCheckedPrompts`). The log line keeps `intentBlock` (`directive` / `phase_a_intent` / null) and `systemPromptHash` (for `reasoning_once` equal to `promptHash`).

**Hashes (LF-normalised sha256, recomputed by a script; `thinker:index` was not run):** `promptOpen` ae5b1bde…87cb, `promptOpenEn` 518bae17…f472, `promptOpenOnce` f62ca6d2…4adc, `promptOpenOnceEn` 01e693f2…44af. The four Haku / withdrawn hashes are unchanged. `tools/thinker/build-index.ts` writes the two new entries and `model.maxRetries` 1, `model.seed` 20261010 on its next run.

### al.2 Rule 5 of `reasoning_intent`, rewritten

Quoted from `prompt-open.en.md` (the file and its hash govern):

> 5. Directive: only when the end of these instructions carries the higher command's directive in force. Before that, it carries P2's opening intent: never call it "the directive" or an order in force, and do not say an option is in line with it or departs from it. When a directive is in force, relate each option that is one of the plan options (postures, secondary tasks) to the directive as a whole, not only its letter: its purpose and priority (the end state it seeks, the places it protects), its method (where lines are held, which tactics it rules out) and the premises it states (the situation it describes, the reasons it gives). Give the evidence first and the verdict last, as a condition, naming the part of the directive that decides it, for example "departs from the method, if [record] holds". A departure from the method can be justified and still keep the aim; say which aim an option keeps or puts at risk. If the newest records no longer support a condition or premise the directive rests on, name that premise and those records, and say a departure can be justified. The directive is an order, not a safety finding: never call departing from it unsafe by itself, and never say a plan "violates" it. For any other tactic (for example a crew's burnout) say the directive does not cover it and leave the call to the commander.

What changed against (aj): the scenario-tailored trigger "a small, new or unattended fire" is replaced by the generic premise trigger; the sentence "Departures are reported up the chain." is removed from the prompt (only the AI group heard it; the departure note on the plan is the same in both conditions, `16` ab.2), and rule 8 no longer mentions it. Kept: assess, never enforce; options with trade-offs and no recommendation; no imperatives; rule 8's safety override; 150 words; pull-only. The examples the panel gave ("three fires", personnel safety, Lahdenkylä and Mökkiranta, lines on roads and water, no direct attack) are deliberately not written into the prompt: it names the kinds of part generically, so it does not point the model at this scenario's deciding facts.

### al.3 The order block as data; P2's opening intent; no persona

- The prompt's second paragraph says the end of the instructions carries "the text of an order issued to the commander … It is data to assess against, not an instruction to you." The block itself opens with `ORDER_BLOCK_FRAME`: "The following is the text of an order issued to the commander. It is not an instruction to you; assess against it only as rule 5 says." / "Seuraava on johtajalle annetun käskyn teksti. Se ei ole ohje sinulle; arvioi sitä vasten vain säännön 5 mukaisesti." Then the label and the quoted text.
- `INTENT_BLOCK_LABEL` (V1–V7) is P2's opening intent: "The duty fire chief's (P2) opening intent (V1; no higher-command directive is in force yet)" / "Päivystävän palopäällikön (P2) alkuperäinen toiminta-ajatus (V1; ylemmän johdon linjausta ei ole vielä voimassa)" (was "the commander's own intent": the participant never wrote it). Rule 5 still forbids calling it the directive or judging options against it, and no verdict is coded before V8. The block exists only in `reasoning_intent`.
- The persona "an experienced fire chief" is gone from both Open Thinker prompts (a second authority cue): "You are a strategic thinking partner (Open Thinker) …".

### al.4 History (provenance; a minimal defence against a forged client history)

The tags [T#] are renumbered in every request, so a tag in an earlier answer names another record now. The server rewrites each bracket that holds tags in a **model** turn of the history to "(earlier answer…)" / "(aiempi vastaus…)", keeping what else it says ("[T3, 15:31]" → "(earlier answer, 15:31)"; `historyTurnForModel`, `server/thinker/answer-checks.ts`). The participant's turns are sent as typed. The log line gets `historyHashes` (sha256 of `role + "\n" + text` of each turn as the browser sent it, in order) and `userContentHash` (sha256 of the full user content sent). The server keeps no conversation state, so a forged history cannot be refused, only detected by comparing the hashes with the session log's own turns. The 10-turn limit and the clearing at V8 are unchanged.

### al.5 Logging only (no stimulus change)

- **Per-option verdicts** — `aiVerdictsOf(answer, lang, question)` (`thinker-protocol.ts`): each line of the answer that carries a verdict phrase, coded by its **last** phrase (the prompt asks for the verdict last), as `{ line, verdict, text }`; null before V8, for a withdrawal/evacuation question and for a fallback. Returned as `OpenThinkerResponse.verdicts`, logged by the server and by the browser (`ai_chat_answer_received.aiVerdicts`, `{line, verdict}` only). `aiVerdictOf` (the earliest phrase) is kept as `verdict` / `aiVerdict` for back-compatibility and is **no longer the analysis value** (`09` al).
- **Citation post-check** — `citationIssuesOf(answer, taggedAtoms(…))`: a tag beyond the last one given is `unknown_tag`; a time written in the same bracket as a single tag that is not that record's time is `time_mismatch` (`{kind, tag, cited, actual}`). Logged as `citationIssues` (null for a fallback). A screen, not a judgement.
- **Directive-quote screen** — `directiveQuoted(question, [directive fi, directive en])`: true when the question shares a run of five consecutive words (lowercased, punctuation dropped) with the directive in either language. Logged for both cells as `directiveQuoted`; in `reasoning_once` it marks the questions where the Thinker may legitimately assess a quoted order.
- **Query id** — the browser sends its `queryId` ("ai.3", "ai_open.4") with both requests; the server validates it (the session-id charset) and logs it on both endpoints (`queryId`, null from an older client), so the two logs join.
- **Attempts** — `attempts` (1, or 2 after a retry) on both endpoints' lines.

### al.6 The place-name line

Every Open Thinker plan context ends with one fixed line mapping the scenario's named places fi = en, from `PLACE_NAMES_EN` (`app/i18n/place-names.ts`; the twelve names of the records, questions and directive, not the map-only ones): "Place names (Finnish = English; the records and your answer use the English names): Lahdenkylä = Bay Village; Mökkiranta = Lakeside Cottages; …" / "Paikannimet (suomi = englanti; tietueet ja vastauksesi käyttävät suomenkielisiä nimiä): …". Identical for both cells and every view. The clause on which names to use was added after the live probe (al.8): with a bare "fi = en" line, English answers took the Finnish names.

### al.7 Robustness

- **One identical retry** on HTTP 429 / 503 (or `RESOURCE_EXHAUSTED` / `UNAVAILABLE`) for both chats, inside the same 20 s timeout (`THINKER_MODEL_TIMEOUT_MS`, not extended), and only when at least 3 s of it is left (`THINKER_RETRY_MIN_REMAINING_MS`). Other errors are not retried. `THINKER_MAX_RETRIES` = 1.
- **Fixed seed** `THINKER_SEED` = 20261010 in every generation config (Gemini's "best effort" reproducibility). The API accepted it in the live probe. `modelVersion` is logged with `usage` as before.

### al.8 Live probes (10 Oct 2026; 16 calls through `handleOpenThinkerRequest`, lexical retrieval, English, no history)

`modelVersion` returned: **`gemini-3.6-flash`** for the pinned id `gemini-3.5-flash` (a silent upgrade, visible through the logging). No fallback, no retry needed, 2.4–3.0 s, no citation issue flagged.

- **Phase A, `reasoning_intent`, V1–V7** ("What are my options for the main effort and its posture now? Weigh them for me."): 7/7 verdict-free — options with trade-offs, no "in line" / "departs", no directive mentioned; `verdicts` null as coded.
- **No-fit views, `reasoning_intent`, V9, V10, V14** (the same question, then "Does the directive still fit what the newest reports show? What are my options for the main effort?"): every answer gives evidence first and a conditional verdict last ("Departs from the directive's method prohibiting direct attack, if [T7, 16:53] holds"), names the aim an option keeps ("aligns with the directive's primary aim to protect Bay Village"), and with the second question opens with the directive's premises ("The directive rests on regional risk, crew safety, and protecting Bay Village and Lakeside Cottages … My inference: premise holds"). **The justified-departure behaviour did not appear**: in none of the six answers does the model say a premise is no longer supported or that a departure can be justified. At V9 it read SPOT's new 0.5–1 ha fire in L3 as *supporting* the directive ("supporting regional multi-fire pressure"); at V10 and V14 it judged the premise to hold. The condition in "if [record] holds" is sometimes mechanical (the record cited is not the one a departure turns on). Lengths of the thirteen `reasoning_intent` answers 127–185 words, six over 150.
- **`reasoning_once`, V9** (both questions, and once more after the place-name fix): no verdict, no directive content; to the directive question it answered "P2's orders and directive are in the message log and the directive banner, not given to me, so I cannot confirm if the directive fits", then options with trade-offs. After the fix it used the English place names.

### al.9 Open

- Whether the justified departure should be reachable: the generic trigger, as written, did not fire on this scenario's no-fit facts in the probe. For the researcher: accept (the Thinker relates the options to the directive and leaves the judgement of its premises to the participant), or strengthen the trigger generically (e.g. ask the model to check each stated premise against the newest records one by one). Not changed here.
- Word-limit overshoot (up to 185 words) persists (`11` §7.18.4).
- The silent model upgrade (`gemini-3.6-flash` answering `gemini-3.5-flash`): decide before the pilot whether to pin a versioned model id if the API offers one.
- `thinker:index` (run by the index owner) will reproduce the prompt hashes above and add `seed` and `maxRetries` 1 to the manifest's model block, which this pass wrote by hand.

---

## Revision 10 Oct 2026 (ao) — rule 5's premise check (the justified departure made reachable, generically)

Researcher decision, 10 Oct 2026, on al.9's first open item: strengthen the trigger generically. `reasoning_intent` only; `reasoning_once`, Haku and the order block are unchanged.

- **Prompt (both languages), rule 5.** The sentence "If the newest records no longer support a condition or premise the directive rests on, name that premise and those records, and say a departure can be justified" is replaced by a premise check: before the options, one line beginning "Premises:" / "Lähtöoletukset:" that checks each premise the directive states against the newest records (supported, contradicted, not addressed), citing records by their tags. The order is called "the directive" and is never cited as if it were a record tag. A premise is undermined **only** by a fire situation the directive does not foresee that changes where or how lines can be held (examples, generic: a new or unattended fire, a change in wind or spread, a barrier lost); crew condition and resource levels alone do not undermine it. A development the directive does not foresee is not evidence for it. If a premise is undermined, the Premises line names it, the records, and that a departure from the method can be justified for that reason. Verdicts (in line, departs) go only on the option lines. Everything else in rules 1–8 is unchanged. Hashes re-frozen by script (LF-normalised sha256): `promptOpen` 3da1a9f4…, `promptOpenEn` 7f2e9844….
- **Verdict coding.** `aiVerdictsOf` skips the premise line (`PREMISE_LINE`: "Premises:", "Premise check:", "Lähtöoletukset:", with or without a list marker), so its "a departure … can be justified" is not coded as a verdict on an option. `aiVerdictOf` (back-compatibility only) is unchanged.
- **Tests.** `test/server/thinker-directive.spec.ts`: the new rule-5 sentences in both languages; the premise line is not coded.
- **Live probes (10 Oct 2026; 10 calls through `handleOpenThinkerRequest`, hybrid retrieval, English, no history, `reasoning_intent`).** The same two questions as al.8 at V9, V10, V14; the second at V11 (fit); the first at V5 (phase A); and at V9 and V11 a commander proposing to pull crews off the village line to attack the newest fire directly. An intermediate wording (a premise check without the "fire situation only" condition and without its own line) was probed first and rejected: it justified departures for the wrong reason (crew fatigue read as contradicting the crew-safety premise), its premise line was coded as a "departs" verdict, it cited the directive as "[P2, 16:40]" and once said "violates". With the final wording:
  - every answer from V8 opens with a "Premises:" line; none is coded as a verdict; no directive tag, no "violates";
  - the justified departure appears in 2 of the 6 no-fit answers, each for the right reason: V9 ("a new unattended 0.5–1 ha fire in L3 … undermines the premise of holding only existing lines, so departing from the method can be justified") and V14 ("SPOT reports a new fire west of the origin, which the directive does not foresee; a departure from the method can be justified"). The other four judged the premises supported (al.8: 0 of 6);
  - the fit view V11: premises hold, no departure; phase A V5: verdict-free;
  - the commander's proposal against the directive: "departs from the method (rules out direct attack) and aim (priority is Bay Village)", the trade-offs, a defensive alternative, and what is unknown; never an instruction;
  - lengths 117–155 words in V8–V14 (2 over 150); the phase-A answer 219 words (rule 5 does not apply there; the overshoot is `11` §7.18.4's).
- **Not fixed.** The recognition is partial and varies between two questions in the same view (V9: yes to one, no to the other); one option verdict was wrong (V14, protecting settlements coded "departs"). Strengthening further would need scenario-specific wording, which the treatment forbids. Pilot 1 checks the behaviour on participants' own questions (`11` §7.18.2).

## Revision 11 Oct 2026 (aq) — the Open Thinker answers in structured output

Haku (`/api/thinker`, the four fields) is unchanged. The Open Thinker (`/api/thinker-open`) now fills a JSON schema (Gemini `responseMimeType application/json` + `responseSchema`); the proxy limits it, renders the display text and returns both. Why: (1) the 150-word limit was only a sentence in the prompt (answers ran 117–219 words); (2) the verdict was coded by regex over the text and was miscoded once (V14 "protecting settlements" coded departs); (3) a factual question ("where is the nearest water?") was forced into options with trade-offs; (4) the free-text answer could not be checked field by field.

- **Schema** (`server/thinker/open-answer.ts`, `OPEN_ANSWER_SCHEMA`; types and renderer in `app/session/open-answer.ts`): `kind` (`lookup` | `options` | `safety`), `facts[{text, tags}]`, `premises[{premise, status supported|contradicted|not_addressed, tags}]`, `options[{option, tradeoffs, verdict fits|departs|departure_justifiable|not_covered|null, tags}]`, `inference|null`, `questionsForYou[]`. Rule mapping: `lookup` = a factual where/what/who/when question (identical in both Thinker cells and the practice view); `safety` = rule 8 (withdrawal/evacuation: newest safety facts and questions, no comparison with any order); `options` = everything else (rules 4 and 5 as before: at least two options, no recommendation, premises and verdicts only with the directive in force). Prompt rule 5's content (premise check, "undermined only by a fire situation that changes where or how lines can be held", never "violates", never cite the directive as a tag, not a plan option = `not_covered`) is kept, expressed as fields. The format rules moved from the prompt into the schema; all four Open Thinker prompts rewritten (rule numbers unchanged, so the order block's "rule 5" frame still holds) and re-hashed with `npm run`-equivalent `tsx tools/thinker/build-index.ts --manifest-only` (new flag: re-hashes the prompts and the model block, keeps the indexes). `model.output`'s stale `linjaus` text fixed. `postFreezeCheck.note` (English block) is generated from the neutral evaluation and left as it is.
- **Lookup is not Search (researcher, 11 Oct 2026).** A lookup answer is at most two short facts with tags and always exactly one `questionsForYou` item that ties the fact to the commander's situation or plan ("Water point W1 is 1.4 km from EK11: does that distance require a relay?"); no options, no verdicts; the question is no imperative and no recommendation. Reason: Search answers, the Thinker thinks with the commander. Enforced on the server: a lookup with no question (or an imperative one) is a schema failure, retried once, then "unavailable". `kind` is logged on every line so lookup questions can be separated in analysis.
- **Limits enforced by the proxy** (`limitOpenAnswer`): routing by kind; no directive in force (phase A, `reasoning_once`, the practice view) means no premises and no verdicts, whatever the model wrote; item caps (3 facts or 2 for a lookup, 3 premises, 3 options, 3 questions or 1 for a lookup); per-field character caps; then the 150-word total (optional facts, surplus questions and the inference are dropped first, then the longest field is shortened). Tags naming no record are dropped from the answer. `truncated: true` and `trimmed: [reasons]` are logged when anything was changed (`truncated` formerly meant the output cap; a cap cut is now a parse failure).
- **Rendering** (`renderOpenAnswer`, one deterministic function; headings Premises / Lähtöoletukset, Options / Vaihtoehdot, My inference / Oma päätelmäni, Questions for you / Kysymyksiä sinulle). Each citation is written by the proxy as `[T3, 15.40]` from the tagged record's own time, so a time the model writes cannot be wrong; the browser still strips the tags. The text is what the history, the browser's log (`answer.vastaus`) and the tab keep; `structured` (with `tagTimes`) is also returned, and the tab draws light structure from it (`OpenAnswerView.tsx`); old turns and resumed sessions are drawn as text.
- **Verdicts and checks.** `verdicts` / `verdict` in the response come from the option `verdict` fields (`verdictsOfOptions`; `line` is the option's index; the browser's log keeps its three values, so `departure_justifiable` is `departs` there). The server log carries the exact `verdictFields`, `kind`, the model's `rawJson`, `words`, `uncitedItems`, `imperativeWords`, `parseRetries`. `citationIssues` checks every `tags` array against the request's records (`unknown_tag`; `time_mismatch` can no longer arise). `aiVerdictOf` / `aiVerdictsOf` stay for logs written before (aq).
- **Failure.** Invalid JSON, a cut-off (MAX_TOKENS), an unknown kind or verdict, fewer than two options, or a lookup without its question: one identical retry (if under 12 s have passed), then the explicit "unavailable" state; never a free-text fallback. Output cap 1024 → 1536 tokens (JSON keys cost tokens; the word limit is the proxy's, not the cap's). Manifest `model` gains `openMaxTokens` and `openParseRetries`.
- **Model pinning.** `ListModels` (key checked 11 Oct 2026) offers `gemini-3.5-flash` (version string `3.5-flash-05-2026`) beside separate ids `gemini-3.6-flash`, `-3.7-`, `-3.8-`; no dated or numbered id of 3.5-flash exists. The alias is kept; every answer still logs `usage.modelVersion`, and the live probes below were again served by **`gemini-3.6-flash`** while asking for `gemini-3.5-flash`. Open: the pilot's model is whatever the alias serves; pinning to `gemini-3.6-flash` itself (a real id) is the only way to freeze it, and is the researcher's call (it changes the declared model).
- **Live probes (11 Oct 2026; 20 calls through `handleOpenThinkerRequest`, hybrid retrieval, `server/thinker/live-check-open.ts`; full log lines in `logs/thinker/`).** JSON valid 20/20, no retry, no fallback, 2.0–4.7 s. Words (rendered, incl. citations): lookups 60–93, options 125–150 (all ≤ 150; most options answers of the first run were trimmed by the proxy, some words cut mid-sentence; after the length caps in the prompt and the drop-before-truncate order, 2 of the 5 options answers of the second run needed no trimming). Lookups (VP, V6, V11): fact + one question, no options, no verdicts (the first run's V6 and V11 lookups carried an unwanted inference; the second prompt asks for none). Options at V3 (phase A, intent): 3 options, no verdicts. V9, V10, V14, V11 (intent, both questions): premises listed, verdicts from fields (defensive line and settlements `fits`, direct attack `departs`; no wrong verdict as in 10 Oct). `reasoning_once` V14: no premises, no verdicts; its first-run answer put the fixed sentence about P2's orders into a question (prompt rule 5 reworded to make it the first fact). Withdrawal V12: kind `safety`, facts and two questions, no comparison. Finnish V9: complete structure in Finnish, headings and phrases correct. Imperative-word screen: hits were "immediately ahead" and quotations of the directive ("lines must be held"), not instructions.
- **Justified departure did not reproduce.** In the 10 no-fit answers of the two runs (V9, V10, V14, each with both questions in the first run; V9 and V14 in the second) 0 gave `departure_justifiable` (baseline before (aq): 2 of 6): the model listed the directive's premises as "supported" or "not addressed" and did not mark the new fire as contradicting "defensive lines suffice". The premise statuses are also sometimes odd ("not addressed" for a premise the records plainly support). Not tuned further (the probe budget was spent).
- **Open.** (a) Justified departure and premise-status quality: decide whether to tune the rule 5 wording again or accept; Pilot 1 will show. (b) Model pinning as above. (c) The browser's log does not carry `structured` or the exact verdict (the telemetry record kinds are outside this change); the proxy's log does. (d) `lookup` routing depends on the model's reading of the question; the log's `kind` allows checking it.
- **Tests.** `test/server/thinker-aq.spec.ts` (validation, limits, rendering fi/en, verdicts from fields, citation tags, retry then unavailable, lookup/safety/options routing including the lookup question), `test/server/open-json.ts` (fake model JSON), the older Open Thinker specs updated, `test/session/thinker-client.spec.ts` (the structured turn).

### (aq) tuning, 11 Oct 2026 (researcher: tune before merge, keep the model alias)

- **Why the premise check failed (0 of 10).** In the 20 probe answers the model listed the directive's *method* ("no direct attack", "lines on roads and water") and its *aim* ("protect Bay Village") as "premises", and rated a premise "supported" because the directive says it (or "not_addressed" with no record at all). It never had to look for the unforeseen situation first, so the new fire in the records was not connected to any premise. The status needed no evidence, and a justified departure was reachable without a contradicted premise.
- **Fix, generic (no scenario wording).** (1) Schema order: a new `unforeseen` field (the newest record that shows a fire situation the directive does not foresee and that changes where or how lines can be held, or null; logged, not rendered), then `premises`, then `options`, so the verdicts follow the premise check. (2) Status definitions in the schema descriptions and the prompt: a premise is a condition the directive's *reasons* assume (not its method, not its aim); `supported` only if a newest record, cited in `tags`, shows it still holds; `contradicted` if a newest record shows the unforeseen situation; `not_addressed` if no newest record bears on it (tags empty); the directive stating a premise is not support. (3) `departure_justifiable` only if some premise is contradicted (prompt and schema). (4) Server (`limitOpenAnswer`), logged in `trimmed` and nothing forced the other way: a `supported`/`contradicted` premise with no known record tag becomes `not_addressed` (`premise_no_record`); `departure_justifiable` with no contradicted premise becomes `departs` (`justified_without_contradicted_premise`). A contradicted premise does not make a verdict. Prompts re-hashed with `npm run thinker:index`.
- **Length before trimming.** Per-field `maxLength` and `maxItems` in the schema (fact 150, premise 55, option name 32, trade-offs 90, inference 100, question 100 characters; 2 facts, 3 premises, 3 options) and short-sentence word limits in the prompt (Gemini obeyed `maxLength` in nearly all fields). The server tolerates a quarter more per field, cuts a long field at a sentence end if there is one past its middle (else at a word, with an ellipsis, the last resort), and over the 150 words drops whole items: facts, extra questions, the inference, then supported/not-addressed premises (a contradicted one last), then a third option; only then shortens words.
- **Browser log.** `ai_chat_answer_received` gains optional `aiKind`, `aiVerdictsExact` (with `departure_justifiable` apart from `departs`) and `aiPremiseStatuses` (`record-kinds-interaction.ts`, `queries.ts`; the three-valued `aiVerdicts` stays).
- **Probe 2 (14 calls, 0 retries, JSON valid 14/14; `logs/thinker/live-check-open.aq2.txt`, `.jsonl`; a first tuned run of the same 14 calls is kept as `...aq2-first.*`).** No-fit questions in `reasoning_intent`, 3 questions at each of V9, V10, V14 (9 answers per run), final verdict after the server check. Justified departure in the answer: second run 5 of 9 (V9 1, V10 1, V14 3), first run 4 of 9 (V9 3, V10 0, V14 1; one more was downgraded by the consistency check); before the tuning 0 of 10 (before (aq): 2 of 6). The same prompt gives different answers across runs at temperature 0 (V9 and V10 differ), so the rate is an estimate. Premise statuses: mostly sensible now (the new fire in L3 or the front near R2 cited as the contradicting record). Still wrong in some answers: one V14 answer rated "no direct attack is needed" (a method, not a condition) as contradicted and justified the departure on it; V10 found no unforeseen situation in 4 of 6 answers and rated its premises `not_addressed`; V14 answers sometimes rate "lines can be held" `supported` beside a described new fire. Words 72–147 for the nine options answers plus 140 for `reasoning_once` (no premises, no verdicts), 55–59 lookups, 76 safety, 118 Finnish; none above 150. Trimming: the word budget dropped optional items (facts, questions, inference) in 5 of 12 options answers, a field was cut by length in 1, and one sentence ended in an ellipsis (a trade-off the model wrote far over its `maxLength`); no answer needed a word cut after the item drops; first run: 6 of 12 trimmed, ellipses in 4 answers, before the tolerance and item-first order.
- **Tests.** `test/server/thinker-aq.spec.ts` (consistency, premise without a record, unforeseen kept/dropped, whole-item trimming, sentence-end cut, schema order and lengths), the prompt assertions in `thinker-directive.spec.ts`.
- **Still open.** Premises written as methods, V10's missed unforeseen situation, and the occasional far-over-length field; the verdict is the model's call, no wording will make it reproducible without scenario hints. The alias is unpinned (served as `gemini-3.6-flash`).

## Revision 11 Oct 2026 (ar) — authored directive premises

The premise check of rule 5 (revisions (ao), (aq) tuning) is now run against **authored, frozen premises**, not premises the model invents each time. Why (Fact-First): what is fixed is fixed, and the LLM reasons over it. In the (aq) tuning probes the model wrote premises that were methods ("no direct attack is needed"), missed the unforeseen situation in V10 (4 of 6) and rated "lines can be held" supported beside a described new fire; every run also gave a different premise list, so statuses could not be compared across answers, views or participants.

- **The premises** (`content/thinker/directive-premises.json`, `server/thinker/directive-premises.ts`). One directive exists (`hinge.intentStatement`, in force from V8 to V14, never in the practice view), so one list (first version P1-P3; P3 dropped and P2 reworded in the review fix below): P1 the region's fire situation is as the directive describes; P2 lines on roads and water can contain every fire threatening Bay Village and Lakeside Cottages (fi and en; derived from the directive's stated reasons "three wildfires", "the region's overall situation", "lines on roads and water"; method and aim are not premises). The file carries the sha256 of the directive text it was written for. P2's opening intent (V1-V7) has no premises.
- **Frozen.** `content/thinker/manifest.json` gains `directivePremises` (file, sha256, directiveSha256), written by `thinker:index` (also `--manifest-only`). `createThinkerDeps` refuses to start if the file's hash differs from the manifest or if `directiveSha256` differs from the scenario's directive.
- **Context.** `openSystemInstruction` appends, after the quoted directive and only in `reasoning_intent` with the directive in force, the block "Directive premises (authored; rate each by id, do not add or reword): P1: ..." in the session language, so `systemPromptHash` covers it. `reasoning_once`, phase A and VP get nothing. Rule 5(b) of `prompt-open.{fi,en}.md` now says: return one entry per listed premise with its id, add, drop, merge or reword none; the statuses, the record-tag requirement and the unforeseen scan 5(a) are unchanged. Prompts re-hashed (`thinker:index --manifest-only`).
- **Schema and server.** `premises[]` items are `{id enum P1|P2|P3, status, tags}` (no premise text). `limitOpenAnswer`: unknown ids are dropped (`premise_unknown_id`), a repeated id keeps the first (`premise_duplicate_id`), a missing id becomes `not_addressed` with no tags (`premise_missing_id`), the list is sorted P1-P3 and the displayed text is the authored text in the session language (the model's words are never shown). Kept: `premise_no_record` (supported/contradicted needs a known record tag) and a justified departure only with a contradicted premise (downgraded and logged otherwise). Authored premises are never dropped or cut by the 150-word budget; options and optional items go first. Lookup, safety and no-directive answers carry no premises.
- **Logging.** Server: `premisesSha256`, `aiPremises [{id,status,tags}]`, and the notes above in `trimmed`. Browser: `aiPremiseIds` beside `aiPremiseStatuses`. (aq) logs carry free-text premises and are not comparable with (ar) logs.
- **Live probe (11 Oct 2026, 15 calls: `logs/thinker/live-check-open.ar.txt`, `.ar-repeat.txt`, `.jsonl`; same mix as the (aq) tuning probe, served by `gemini-3.6-flash`).** Justified departure in the final verdicts of the nine no-fit answers: **6 of 9** (V9 3/3, V10 1/3, V14 2/3); (aq) tuning: 5 of 9 and 4 of 9; before the tuning 0 of 10. A repeat of V10 no-fit 1 gave the identical answer (seed and temperature 0), so no run-to-run difference was seen in that one pair; the rate is still one sample. Unforeseen situation found: V9 3/3, V14 3/3, V10 1/3 (baseline V10: 2 of 6; not improved: V10 no-fit 1 and 3 found none). Premise errors: a method written as a premise cannot occur any more; P2 ("lines can hold") rated `supported` beside a described new fire in 3 of 9 answers (V9 1, V14 2), the same error as before now on a fixed premise; P1 `contradicted` by the new fire in 5 of 9 (intended). Statuses per answer are in the log file. Words: options answers 135-150 (all within 150), `reasoning_once` 69, lookup 56, safety 85, Finnish 150; the word budget removed optional items in 5 of 9 no-fit answers, no ellipsis. One lookup (V11) failed twice with `invalid_output` because its question contained "should" (the existing imperative rule for a lookup's question, not the premises). The three premises take about 45 of the 150 words.
- **Not changed.** Haku, `reasoning_once`, phase A, the retrieval, the verdict set. A contradicted premise still forces no verdict; the Thinker assesses and never enforces.
- **Effect on the design.** The `reasoning_intent` treatment (H13-H15, `27`) is now the order block plus the authored premises plus rule 5, against `reasoning_once`. The frame is the same every run, which makes the manipulation cleaner, but the researcher's reading of the directive is part of the treatment; demand and hinting through the premises' wording is a threat to note (`11` §7.27). The verdict covariate (`27` ab) can be read by premise id (for example P2 contradicted at a no-fit view).
- **Open.** The premises are authored study material, DRAFT, to be checked by instructors and a native Finnish speaker before the pilot (`11` §7.27).
- **Tests.** `test/server/thinker-aq.spec.ts` ("authored directive premises": file and hash freeze, injection only in `reasoning_intent` from V8, unknown/duplicate/missing ids, authored text fi/en, none outside the directive, log fields), `thinker-directive.spec.ts` (system instruction ends with the premises block; rule 5(b) wording).

### (ar) review fix, 11 Oct 2026 (treatment revision for `reasoning_intent`)

Review of the first (ar) commit (64fceb7) asked for changes, made in the next commit. **This is a treatment revision of `reasoning_intent`: sessions run before it (the (aq) premises, or the first (ar) three-premise list) are not pooled with sessions after it for H13-H15 (`09` al); `systemPromptHash`, `promptHash` and `premisesSha256` identify the treatment.**

- **P3 (crew safety) is dropped.** It made the AI rule on crew safety (against rules 4 and 5 and `27`) and could never be contradicted by a record, so it biased toward compliance. Two premises remain: P1 the region's fire situation is as the directive describes; P2 lines on roads and water can contain every fire threatening Bay Village and Lakeside Cottages (fi: "...voivat rajata jokaisen palon, joka uhkaa kohteita Lahdenkylä ja Mökkiranta."; the place names as in `DIRECTIVE_FI`, "can contain" and "voivat rajata" matching in modality; the earlier "the fire" was ambiguous, the directive names three). Schema enum, file (version 2), manifest hash, prompts rule 5(b) (fi and en) and tests updated; the file hash and prompts re-hashed with `thinker:index --manifest-only`; `directiveSha256` unchanged.
- **Consistency log.** `unforeseen_p1_supported` in `trimmed` when the unforeseen scan is non-null while P1 is rated supported. Logged only; nothing is forced (same pattern as `justified_without_contradicted_premise`).
- **`filled`.** `aiPremises` entries carry `filled: true` when the server filled a missing id as `not_addressed`.
- **Re-probe (14 calls, `logs/thinker/live-check-open.ar2.txt`, `.ar1.jsonl` for the first probe; `gemini-3.6-flash`).** The first probe's 6 of 9 had no fit-view control, so against (aq) tuning (5 of 9, 4 of 9) it was no regression, not a gain. Now: **no-fit views, justified departure 7 of 9** (V9 3/3, V10 1/3, V14 3/3). **Fit views, three questions in `reasoning_intent`: V11 0, V12 0, V13 1 (a false positive of 1 in 3):** at V13 the model found sparks crossing road R2 as the unforeseen situation, rated P2 contradicted and P1 supported (`unforeseen_p1_supported` logged), and called one option a justified departure. Finnish V9 no-fit: justified departure, P1 contradicted, P2 supported. Lookup: fact and question, no premises. Statuses over the nine answers with an unforeseen situation (eight no-fit, V13): P1 contradicted 7, supported 1 (V13), not addressed 1; P2 contradicted 2 (V10, V13), supported 3 (V14 x2, Finnish V9), not addressed 4. V10 found the unforeseen situation in 1 of 3 (unchanged). Words 52-149, none above 150; no imperative-word failure; the one lookup answered. Sample sizes are small (3 per cell): the rates are estimates, not tests.

### (as) 11 Oct 2026: imperative rule (researcher: allow questions, drop imperatives)

The imperative screen of (aq) was too blunt: one (ar) lookup failed twice with `invalid_output` because its question contained "should", and in options answers an imperative in a trade-off was only logged. Now (`server/thinker/answer-checks.ts`, `open-answer.ts`; sentence by sentence):

- **Lookup.** The single question may be a genuine question to the commander even if it contains "should" ("Should the relay move given W2 is 1.2 km away?"; fi "Pitäisikö …?", "Kannattaako …?"). A statement with a forbidden word ("You should move the relay.") or a recommendation ("I recommend…", "suosittelen…", also inside a question) is still a schema failure: one retry, then unavailable.
- **Options and safety answers.** An imperative sentence in a free-text field (an option's trade-off, a fact, the inference, the unforeseen situation, a question) is cut out of the field; the remaining sentences stay word for word (nothing is rewritten). A trade-off left empty drops its option only while at least two options remain, otherwise only the trade-off text goes; a fact, the inference or a question left empty is dropped, except the only fact of a safety answer, which is kept (`imperative_kept`). Logged in `trimmed` as `imperative_removed`. A lookup's fact is not touched.
- **Words.** en must, should, immediately, cease; fi täytyy, pitäisi, kannattaa, kannattaisi, heti, lopeta. Descriptive uses are not flagged: "immediately" before a place or order word (east, adjacent, after, before…), "must have" (epistemic), "if … should" and a sentence-initial "Should the wind shift, …"; fi "heti kun", "heti … jälkeen/ennen/…puolella", "jos … pitäisi". "pitää" is not listed: it is mostly the descriptive "holds" ("Pitää linjat teiden varassa") and never matched before (the old word boundary was ASCII-only and could not match a word ending in ä; the new one is Unicode-aware). Limits: a bare imperative verb without a listed word ("Move the relay now.") is not detected, and a forecast "should" ("wind should ease") is flagged; both as before. The log's `imperativeWords` now counts statements only.
- **Calibration** on the 28 structured answers in the (aq)/(ar) probe logs: 1 would change (an English trade-off "Departs from defensive directive method to stop spread immediately at the fire line.", cut to nothing); the three "Should …?" questions of the (ar1) options answers are questions and stay. The Finnish trade-offs "Pitää linjat…" would have been cut had "pitää" been listed, which is why it is not.
- The system prompt is unchanged (rule 6 still tells the model not to use "should"), so prompt hashes are unchanged.

## Revision 11 Oct 2026 (at) — P2 reworded (the fit-view false positive; `11` §7.28 decided as option 1)

Another treatment revision of `reasoning_intent` (not pooled with earlier sessions, `09` al; `premisesSha256` and `systemPromptHash` identify it). Decision (researcher/lead): V13 stays a fit view (a defensive road line is expected to fall back to the next road). The (ar) review-fix P2 ("can contain every fire threatening Bay Village and Lakeside Cottages") was absolute and carried the aim's place names. P2 now states the condition the method assumes: en "Roads or water ahead of each fire still give a line that can be held."; fi "Jokaisen palon edessä on yhä tie tai vesistö, jonka varaan linja voidaan pitää." (file version 3; DRAFT, the Finnish is flagged for the native check, `11` §7.27). P1 unchanged; schema, server and prompts unchanged; manifest `directivePremises` re-hashed.

- **Re-probe (12 calls, `logs/thinker/live-check-open.at.txt`, `.ar2.jsonl` is the previous probe's raw log; `gemini-3.6-flash`; two questions per view: the options question and "does the directive still fit").** Compared with (ar) review fix (14 calls, one question per fit view).
- **Fit views, justified departure (false positive): V11 0/2, V12 0/2, V13 1/2** (before: V11 0/1, V12 0/1, V13 1/1). The V13 false positive remained for the options question: the model again found "sparks are crossing road R2 east of Moss Bog and the line is moving" as the unforeseen situation, rated P2 contradicted and P1 supported (`unforeseen_p1_supported` logged), and called one option a justified departure; the second V13 question gave none. So the rewording did not remove the V13 reading; with two questions per view the rate is 1 of 6 fit-view answers (before 1 of 3).
- **No-fit views, justified departure: V9 2/2, V14 1/2** (3 of 4; the Finnish V9 no-fit answer also, 4 of 5; before 7 of 9 over V9, V10, V14 with three questions each; V10 was not probed this time). The V14 miss found no unforeseen situation.
- **Statuses** over the five answers with an unforeseen situation (V9 x2, V14, V13, Finnish V9): P1 contradicted 4, supported 1 (V13); P2 contradicted 1 (V13), supported 3 (V9 x2, V14), not addressed 1. P2 "supported" beside a described new fire is thus still common (3 of 5), now with the weaker wording it is arguably consistent (roads ahead of the new fire still exist); the V9 justified departures rest on P1 alone. In the five fit-view answers without an unforeseen situation P1/P2 were not addressed (V11 x2, V12) or supported (V12, V13 second question).
- **Lookup** answered (fact and question). Words 51-146, none above 150; one `chars_options` trim, no imperative words.
- **Sample size.** 12 calls, 2 per cell; the rates are estimates only.

## Revision 19 Oct 2026 (ay) — the digest counted as exposure (`31` §3.6)

The parity audit computed the guide's guaranteed digest per step with `latestDigest` (retrieval passed as empty): 137 recorded facts reach the model on any guide question without a search — among them `evt.wx.03` (the key of V5 `wind_shift` and `ek14_shelter` and of SPAM V6.b), both F7 records and `rekindle.in_hand.log` — while the Haku group reaches them only by searching. Between-group availability parity is 0 problems by construction (one time gate, `reachableAtoms`); the asymmetry is what arrives without a search, and it is part of the guide package (`27` ab.3) — but it was unlogged in the browser. **Change:** the server's response carries the digest's and the recent matches' atom ids (both already in the server log line) and the client logs them (`07` 0.11.0); ah.2's sentence "do not count these records, as they do not count the digest" is superseded — exposure now counts them (`09` (ay)). Retrieval, its declared configurations, the prompts and their hashes are unchanged; the methods text describes the digest as part of the guide. The premise table changes of `30` (ay) (V14 P2 not contradicted; P1 re-worded) alter `content/thinker/*.json` and the manifest's hashes only; `premise-check.ts` is unchanged.

## Revision 24 Oct 2026 (D10) — query-aware recency and clock-aware matching

Researcher decision D10 (24 Oct 2026), after the play-test of 23 Oct 2026 (`docs/audits/2026-10-23-playtest/analysis.md` §4, `haku.csv`). Two failure classes: (1) a question asking for the latest state ("Onko uutta sääennustetta?", "latest road report road R1", "Latest DR3 perimeter mapping") got the oldest matching record, the right one at ranks 2–8; (2) a clock in the question matched clock-like numbers in a record's TEXT, not the record's time ("Mitä VPK ilmoitti klo 17.24?" returned VD1's battery log "vaihto klo 17.24"; "VPK 17.58" returned the 12:00 alarm, whose text names VPK). **Amends pipeline step 2 of revision (q) and the recency boost of ab.5; nothing else.** Built in `app/retrieval/query-cues.ts` (new) and `app/retrieval/hybrid.ts`; declared in `THINKER_RETRIEVAL_CONFIG` (`recencyBoost.latest`, `clockMatch`; `THINKER_RETRIEVAL_CONFIG_EN` is the same object) and in the manifest's `retrieval` / `retrievalEn` blocks (`recencyBoost`, `clockMatch`, with the rules and cue lists). Evaluation: `tools/thinker/eval-playtest.ts` (report-only, no model) over `tools/thinker/playtest-cases.ts`. Tests: `test/retrieval/query-cues.spec.ts`, `test/retrieval/d10-retrieval.spec.ts`, `test/retrieval/recency-boost.spec.ts`.

### D10.1 What a question says about time (`query-cues.ts`)

- **Recency cues** (whole words or fixed phrases, lowercased). Finnish: *viimeisin, viimeinen, viime, viimeksi* (all inflections: *viimeisimmän, viimeisintä, viimeisessä …*), *uusin* (*uusimman, uusinta, uusimpia …*), *tuore / tuorein* (all inflections), *uutta*, *nyt* (*nytkin, nythän …*), *nykyinen, nykytilanne* (*nyky-*), *tämänhetkinen*, *tällä hetkellä*. English: *latest, newest, recent / most recent / recently / lately, current / currently / presently, last, now* (not *now that*), *at the moment, at present, any new / anything new / what's new / what is new*.
- **Not cues** (tested): *viimeistään* ("at the latest", a deadline), *viimeistely*, *uusi / uusia* ("uusi palo" is a new fire, not the newest record), *nytkähtää*; English *now that*, *new* alone ("the new reports"), *lastly*, *known*, *snow*. *uusi, uusia, uuden, uudet* were tried as cues: no gain on the play-test questions (MRR@8 0.5656 against 0.5669; K29 7th → 3rd but K20 2nd → 4th), the neutral evaluation unchanged. **Decided: *nykyinen* is a cue**, as the Finnish of "current" (the English list has "current"); the two lists are parallel.
- **Previous cues cancel** the recency cue: *edellinen* (all inflections), *aiempi / aiemmin / aikaisempi*; *previous, previously, earlier, prior*. The question then asks for an older record ("Paljonko uutta palanutta alaa oli edellisessä DR3:n kehäkartoituksessa?"): no latest-state preference is applied, and its cue word stays in the lexical query.
- **Clocks:** hh.mm or hh:mm (hours 00–23, two-digit minutes), optionally after *klo*, *kello* or *at*. A number before a unit (*ha, m, km, %, m/s, m/min, kV, °, metriä, hehtaaria …*) is a quantity, not a clock; "7.6", "24,3", "EK11.20", "25.30" and hour-only "klo 17" are not clocks. A clock after *before, after, since, until, till, by* or *ennen*, or before *jälkeen, lähtien, alkaen, asti, saakka, mennessä*, is **relative**: it names no record time.
- **The lexical query** is the question with its cue words removed (only when it asks for the latest state) and every clock expression removed (relative ones too, with their *klo* / *at*). A clock in the question therefore no longer meets "17.24" inside an unrelated record's text. If nothing is left and the question names no clock, the question is kept as it was. **The query vector is unchanged:** the vector half embeds the whole question, as before.

### D10.2 The latest-state preference (`recencyBoost.latest`: relevance 0.5, graded 0.3)

When the question asks for the latest state, every **relevant** candidate gets up to **+0.3** by its observation time, linearly from 0 (the oldest relevant candidate) to 0.3 (the newest). A candidate is relevant when its base score (the fused lexical/vector score, before any boost) is at least 0.5 × the best base score. The preference is added to the ordinary boost of ab.5 (+0.05 for the newest of each source, +0.03 for the newest naming each sector), which still applies to every question. Like that boost, it reorders the candidates the question matched and adds none. The time gate is applied before it, so it can never reach a later step. It is deterministic, and the tie-break (newer first, then atom id) is unchanged.

### D10.3 The clock match (`clockMatch`: ±2 min +0.5, +0.5 for a named source, ±10 min +0.15)

- **The record's clock** is its observation time as Haku and the model show it (`clockAt(observedAt)`, floored to the minute). In the current corpus the delivery minute equals it for every pushed record (246 of 246).
- A candidate within **±2 min** of a clock the question names gets **+0.5**. It gets **+0.5 more** when the question also **names its source** as Haku shows it in the session language (`sourceName`): every word of the shown name, or a code in it. Examples: "VPK", "Sääasema", "Water supply", and "VOL1" or "volunteer fire brigade" for VPK in English. The rule uses the shown name, not the id, so the Finnish verb *saa* does not name the weather station SAA (whose Finnish shown name is "Sääasema"). Within **±10 min** a candidate gets **+0.15**. The nearest of the question's clocks decides.
- A clock-matched candidate counts as **matched**, so the records at the named minute come back even when the question shares no word with them ("klo 17.24" alone returns the 17.24 records).
- **Routine collapse:** gated records within ±2 min of a named clock are **exempt** from the routine-line collapse (1 Oct 2026 amendment). "Näytä tilannekuva klo 18.35" asked for a picture that the collapse had reduced to the 18:55 one. A question without a clock is collapsed exactly as before.

### D10.4 Source and clock in the lexical half only; the embedded passage unchanged

The source's shown name and the record's clock are **fields of the lexical half**, matched by the clock rule. **`passageText` (the embedded passage) is unchanged.** Every `passageHash` in `content/thinker/index.json` and `index.en.json` therefore still matches (998 of 998 atoms in each; `eval-playtest.ts` part 4), and no vector was touched.

The source's shown name is **not** added to the BM25 text. That was tried, and it cost the English neutral evaluation (lexical) recall@8 0.5147 → 0.4853 and MRR@8 0.3552 → 0.3331: the shown names' words ("fire" in "Volunteer fire brigade VOL1", "water" and "supply" in "Water supply") crowd ordinary questions. So the name is matched as a field, not as words.

### D10.5 How the parameters were chosen

The **development set** is the 45 play-test questions with an identifiable right record (`playtest-cases.ts`):
- the right record is the top record of a hit, else `should_have_returned` (either of "a / b"); gaps without a record are not cases;
- each question is gated at the step its screen clock falls in, in the run's language;
- retrieval is lexical, as the play harness and the demo bridge run Haku.

A small grid was run on it: graded 0.2 / 0.3 / 0.4; relevance 0.4 / 0.5 / 0.6; an extra latest-state boost for the newest relevant record of each source, 0 / 0.1 / 0.15 / 0.2; clock near 0.5 / 1.0. **Chosen:** graded 0.3, relevance 0.5, near 0.5 plus named source 0.5, far 0.15, and **no** per-source latest boost: it helped no play-test question beyond the graded term and cost the neutral evaluation's MRR in both languages. The neutral evaluation and the authored questions were **checks**; nothing was tuned on them, and the designed events took no part.

### D10.6 Evaluation (24 Oct 2026, the corpus of `d142b58`, 998 records)

**Play-test questions, lexical** (`npx tsx tools/thinker/eval-playtest.ts`; rank of the right record, – = not ranked). The changed cases:

| Case | Question | Before | After |
|---|---|---|---|
| K9 | Missä EK12 on **nyt** kärkeen nähden … | 12 | 8 |
| K16 | Mitä johtopaikka kirjasi **klo 16.20**? | 22 | 1 |
| K18 | Mitä Ilmatieteen laitoksen **klo 16.01** ennuste sanoo … | 3 | 1 |
| K19 | Mikä on **viimeisin** sääennuste? | 8 | 6 |
| K23 | Mitä VPK ilmoitti **klo 17.24**? | 63 | 1 |
| K24 | Kuinka nopeasti uusi palo etenee **nyt** … | 176 | 166 |
| K25 | Mitä VPK ilmoitti **klo 17.58**? | 4 | 2 |
| K27 | Mitä VPK ilmoitti **klo 18.38** metsäautotieltä? | 8 | 2 |
| K28 | Näytä tilannekuva **klo 18.35**. | – | 1 |
| L6 | What do the **latest** drone reports say? | 7 | 5 |
| L8 | What did the previous perimeter mapping **before 14.35** say … | 2 | 3 |
| L10 | … how much water do EK11 and EK12 have **now**? | 3 | 4 |
| L15 | **latest** road report road R1 south of Dry Heath | 4 | 1 |
| L17 | What is the **latest** weather forecast for this evening? | 3 | 1 |
| L18 | Weather forecast **at 16.01** | 6 | 1 |
| L20 | **Latest** DR3 perimeter mapping: how many hectares burned now? | 3 | 1 |
| L24 | Distribution company **at 19.18** | 8 | 1 |
| L25 | How far is the south-east front from road R2 **now**? | 36 | 14 |

| All 45 | top-1 | top-3 | top-8 | MRR@8 |
|---|---|---|---|---|
| before | 11 | 23 | 33 | 0.3878 |
| after | **20** | **30** | **37** | **0.5669** |

- **16 better, 2 worse, 27 unchanged.** The two worse are L8 and L10, one place each, both still in top-8.
- **Unchanged cue or clock questions:** K8, K21, L9, L11 and L21 (already 1st), K14 (10th) and K17 (3rd).
- **K25 and K27:** a VPK record at the named minute is first (its vehicle-location line, restored from the collapse), and the asked-for status is second.
- **Residuals:** K14 and K19 lose to question words: "mikä on" and "kohdalla" match short radio lines better than the topic word matches the long forecast and road records. That is a lexical (stop-word) limit, not a recency one. K17 also asks when the wind turns, which the 12:00 forecast and the 16:21 objection ("Jos tuuli kääntyy …") match word for word. L8 asks for the survey *before* 14.35, which no rule here expresses.

**Neutral evaluation** (`npm run thinker:eval`, both languages). **It needs the model:** the neutral questions have no stored query vectors (only the authored questions do), and the e5 model cannot be loaded in this build environment (no Hugging Face access). The run is therefore **lexical-only** and says so. Recall@8 / MRR@8 at the declared `collapse3`:

| | before (lexical) | after (lexical) |
|---|---|---|
| Finnish | 0.5049 / 0.4653 | **0.5196 / 0.4996** |
| English | 0.5147 / 0.3552 | 0.5147 / **0.3699** |

- **Per question:** Finnish n03 "Missä EK16 on nyt …" recall 0.5 → 1.0; n04 "… tällä hetkellä" RR 0.5 → 1.0; n09 "Missä latvapalo on nyt?" RR 0.33 → 1.0. English n09 RR 0.5 → 1.0. No question got worse in either language.
- **The other candidates** move alike. Finnish after: baseline 0.5049 / 0.4849, cap2 0.4853 / 0.4789, cap3 0.5000 / 0.4792, collapse3+cap2 0.5000 / 0.4985, collapse3+cap3 0.5147 / 0.5013. English after: baseline, cap2 and cap3 unchanged; collapse3+cap2 0.5000 / 0.3706; collapse3+cap3 0.5000 / 0.3699.
- **Selection:** in this lexical run the declared rule now selects the declared `collapse3` in Finnish (before D10 it selected `collapse3+cap3`), and still `collapse3` in English.
- **The manifest's `neutralEval` blocks are not rewritten:** they record the frozen hybrid runs, and a lexical run is not the declared treatment.

**Authored questions, hybrid,** with their stored query vectors (`content/thinker/authored-queries*.json`), every view V1–V14 at its start gate: **0 of 112 top-8 lists change in Finnish, and 0 of 112 in English.** None of the 16 authored questions has a recency cue or a clock, so D10 does not act on them. Every documented rank in `rekindle.spec` and `planted.spec` is unchanged: the objection 229th / 15th / 8th at V7; F7 first for "20 kV linja" and the natural question, and 2nd / 3rd / 4th for "sähkölinja". The authored results are not worse.

**Report-only, hybrid with a cue.** Each authored question was run with "nyt" / "now" appended, using the plain question's stored vector. The cue leaves the lexical query, so the lexical half is exact; only the vector is approximate.
- 107 of 112 Finnish and 100 of 112 English top-8 lists differ from the plain question's. In hybrid nearly every candidate has a base score above 0, and the relevant set (≥ 0.5 × the best) is wider than in a lexical run, so the preference reorders more.
- Designed records: at V7 the objection rises from 15th to 9th for "VPK syttymäkohta nyt" and from 8th to 4th for "kyteekö syttymäkohta nyt" (the objection, 16:21, is among the newest relevant records then); the broad question is unchanged (229th). F7 is unchanged in Finnish; for English "power line now" at V12, F7 moves from 3rd to 4th.
- Lexical probes: "Mitä VPK sanoi klo 16.21?" at V7 ranks the objection 3rd (was 65th; VPK's 16:20–16:22 records come first); "What did VOL1 say at 16.21?" 3rd (was 146th). "Mikä on sähkölinjan viimeisin tilanne?" ranks the step-18 grid record (`f7.grid_at_line`, 19:18) 1st at V13 (was 5th) and the step-6 grid record 2nd at V12 (was 4th).
- These are results, not tuned.

### D10.7 Unchanged

- The time gate (`reachableAtoms`). Tested: no record from a later step, whatever clock the question names.
- The routine-line collapse for questions without a clock; top-k 8; the fusion weights; the ordinary recency boost; the tie-break.
- The per-source cap (none; a declared cap still holds, tested).
- The vector half and the embedded passage.
- **What the model sees:** the question and the retrieved records with source and time (revision (q) step 3). Only which records rank where changes.
- The prompts and their hashes, the proxy's log line and the telemetry format. The cue analysis is a deterministic function of the logged question and can be reproduced offline.
- Haku's `closure.ts` (dormant, y.2).
- A question with neither a recency cue nor a clock ranks exactly as before (tested on ids and scores).

### D10.8 Declared, and before sessions

- **Declared:** `npm run thinker:index -- --manifest-only` now also rewrites the manifest's `retrieval` and `retrievalEn` blocks from the declared configuration, keeping their `neutralEval` (no embedder needed). It was run for this revision. The index files and the authored query vectors are untouched.
- **Before sessions:** the real index must still be rebuilt with the model (`npm run thinker:index`, both languages). This was already required, because both indexes are carried (PROVISIONAL, SPEC/31 §7 WP-1). Then re-run `npm run thinker:eval -- --write` and `-- --lang en --write` in **hybrid** mode. That run measures D10 in hybrid on the neutral questions with a cue (n03, n04, n09, n21 and n33 in both languages), which this build could not. If the rule's selection moves, the researcher decides as in ab.6.
- **Open:** "the previous one" (the second newest) and relative clocks as filters ("since 17.00", "before 14.35"); "what is new in the last ten minutes" (D10's third point: check it with the model); hour-only clocks ("klo 17"); stop words for the lexical half (K14, K19). Pilot 2 reruns the `haku.csv` questions through the real Haku (analysis §4).

- **Addendum (24 Oct 2026, integration): a latest-state question that names no topic.** "Mitä uutta tällä jaksolla on kirjattu?", "Onko uutta?", "Any new reports?" — a recency cue, no clock, and every other word in the topic-free lists (`TOPIC_FREE_FI` / `TOPIC_FREE_EN`, `app/retrieval/query-cues.ts`: question words, the period, records, reports and news in general) — return the gated, collapsed candidates newest first (then by id), capped as usual. Their words would otherwise match records at random: the Haku chip's question (`30` bf.1) returned 0–2 of 8 records from the current period at V8, V11 and V14 even with the latest-state preference; with the addendum 8 of 8, in both languages. The English chip text was aligned with the Finnish ("What is new in this period's records?") so that it carries a cue. Declared in the manifest (`topicFreeWords`); the play-test evaluation is unchanged (none of its 45 questions is topic-free).

## Revision 24 Oct 2026 (bf) — the guardrails audited: the fidelity report, Haku's certainty, the Haku chip

`30` (bf); analysis `09` (bf) §5–§6. **No prompt, retrieval configuration, limit or hash changes**; the server's answer checks gain one export (`isRecommendationSentence`, the recommendation half of `isImperativeSentence`, which now calls it: the same behaviour).

- **The Haku chip** (`30` bf.1) is an ordinary Haku question: the standard prompt, the same retrieval (lexical and dense over the time-gated records, the recency boost), the four-part answer, the template fallback. The proxy cannot tell it from a typed question; only the browser's `ai_chat_query_submitted.viaChip` does.
- **The guardrail fidelity report** (`npm run review:fidelity`, `tools/review/fidelity.ts`, `fidelity-lib.ts`): over the session logs (and the Thinker server's logs, joined on session and question id), for every Haku and Thinker answer — the server's own imperative screen in both languages (a statement with a forbidden word or any sentence that recommends; a question to the commander is none: ab.2 rules 4 and 6, (as)); the clock times the answer cites (Haku's `perusteet`, the Thinker's bracketed citations) against the records the model was given (retrieved ∪ recent ∪ digest; a time no given record has is a citation of a missing record) and against the records reachable when the question was asked (a later time is a record the participant could not have had); the time gate itself (a given record not yet reachable); the words shown; Haku's "certain" where its rules 3 and 5 forbid it (cited records that contradict each other; a "the records hold nothing on it" answer); the Thinker's verdicts, the server's downgrades (`trimmed: justified_without_contradicted_premise`) and cut imperatives (`imperative_removed`); fallbacks with their reason and the server's refusal category. Per answer (`--out`), per group and tool and per session (`--report`). Deterministic. A screen of wording and time, never a judgement of correctness; Haku is screened by the Thinker's imperative rules too, because its role (find and summarise) leaves no room for an instruction.
- **The uncertainty audit covers Haku** (`npm run review:uncertainty -- --report`, `app/telemetry/haku-certainty-audit.ts`): Haku's `varmuus` read by its first level word (certain / probable / uncertain / not known; varma / todennäköinen / epävarma / ei tiedossa), against the weakest certainty of the records it cites, and both tools' certainty by what the answer touched (the planted record, the projection, a scripted AI error); the blind coding sheet and the AUROC are unchanged.
