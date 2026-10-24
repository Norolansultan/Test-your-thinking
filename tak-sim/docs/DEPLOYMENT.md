# Deployment

How to run the instrument for participants: one Node process serves the built app, the Thinker
proxy (`/api/thinker`) and the post-run session-log upload (`/api/session-log`), behind a reverse
proxy that terminates HTTPS. SPEC/05 §2 (AD-01: a hosted web application) and §9 (storage, upload,
resume) are the requirements; this file is the procedure. Written 5 Oct 2026.

## 1. What runs where

| Piece | Where | Notes |
|---|---|---|
| The app (`dist/ui`) | the participant's browser | Runs the whole session locally. Every record is written to IndexedDB and committed before the screen moves on (I5). No request during the run except Thinker's (I3). |
| `/api/thinker` | the server | The model key lives here only. Logs `logs/thinker/<sessionId>.jsonl` under the app directory. |
| `/api/session-log` | the server | After the session reaches COMPLETE, the browser uploads the log in chunks; the server writes `<SESSION_LOG_DIR>/<sessionId>.jsonl`. Before that, checkpoints at each freeze, the training, the hinge and the closing screens append to `<sessionId>.partial.jsonl` (§3.1). |
| `/api/assign` | the server | The shared study link's next participant code (§7.1), only when `AUTO_ASSIGN=1`; otherwise 404. Never in `npm run dev`. |
| `/admin`, `/api/admin/*` | the server | The researcher's data download (§6), only when `ADMIN_TOKEN` is set; otherwise 404. |
| `/api/results-contact` | the server | A participant's address for the personal results after the study (SPEC/36, §3.2), stored in `RESULTS_CONTACT_DIR`, apart from the session logs; `RESULTS_CONTACT_DIR=off` = 404. |
| HTTPS, rate limits, access logs | the reverse proxy (nginx, Caddy, the host's load balancer) | The Node server listens on 127.0.0.1 by default. |

## 2. Steps

1. **Machine.** Node 22 LTS, git, ~2 GB disk (the embedding model cache and the logs). EU hosting
   (SPEC/05 §2; see §5 below).
2. **Code.** `git clone` the repository at the release commit; `npm ci` (development dependencies
   are needed: the server runs TypeScript through `tsx`).
3. **Thinker's index and model** (AI cells only). The Finnish index `content/thinker/index.json` is
   committed. The English index is not, and the study runs in English: on a machine with Hugging Face
   access run `npm run thinker:index -- --lang en` (builds `content/thinker/index.en.json` and
   `authored-queries.en.json`, updates `manifest.json`, keeps the Finnish files, fills the model cache
   in `.cache/`), then `npm run thinker:eval -- --lang en --write` (the English neutral evaluation;
   freezes the English configuration in the manifest). Commit the three files (or copy them and
   `.cache/` to the server). With `THINKER_MODE=study` (the default of `npm run serve`) the server
   refuses to start until this is done, and says so. Without the model, `THINKER=lexical` (not the
   declared treatment; refused in study mode) or `THINKER=off` (a Haku-only deployment; the preflight
   of a Thinker cell then refuses the participant, since `/api/thinker` answers 404).
4. **Build.** `npm run build:prod` — runs the full CI (typecheck, determinism lint, tests), then
   builds `dist/ui` with the commit stamped into the log header's `appVersion`
   (`0.1.0+<commit>`; `-dirty` if the working tree has changes — do not run a study on such a build),
   and prints the scenario `bundleHash` every session log will carry. Record both. The build is the
   same while recruitment runs: the gate is the server's (§2.1).
5. **Environment.** Copy `.env.production.example`, fill it in, keep it outside the repository and
   load it into the process environment (systemd `EnvironmentFile=`, `docker --env-file`, …):
   `PORT`, `HOST`, `ALLOWED_ORIGINS`, `SESSION_LOG_DIR`, `STATIC_DIR`, `THINKER`, `THINKER_MODE`
   (`study`, the default; `demo` only for a demonstration server, where English questions fall back to
   the Finnish index while the English one is absent), `GEMINI_API_KEY` (the Google Gemini key; the model is set in `server/thinker/config.ts`, now `gemini-3.5-flash`),
   `ADMIN_TOKEN` (turns on the data download of §6; at least 24 characters, e.g. the output of
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`; unset = off),
   `AUTO_ASSIGN=1` (the shared study link, §7.1; unset = every link needs `?koodi=`), and for a pilot
   only `ASSIGN_CELLS`; optionally `ASSIGN_MAX` and `ASSIGN_RATE_PER_HOUR`; `RECRUITMENT_GATE=1` for
   as long as recruitment runs (§2.1); `RESULTS_CONTACT_DIR` (the personal-results addresses, §3.2;
   default `logs/results-contacts` under the app; never inside `SESSION_LOG_DIR`; `off` turns it off).
6. **Run.** `npm run serve` under a supervisor that restarts it (systemd `Restart=always`). It prints
   the app directory, the log directory, the allowed origins, the Thinker mode, its English retrieval
   and whether the model is configured.
7. **Reverse proxy.** HTTPS only (redirect HTTP), HSTS, proxy everything to `127.0.0.1:$PORT`, keep
   the `Host` header (`proxy_set_header Host $host;` in nginx) or list the public origin in
   `ALLOWED_ORIGINS`. Allow request bodies up to 2 MB (`client_max_body_size 3m;`) for the upload
   chunks. Add a modest rate limit on `/api/`.
8. **Check.** Open `https://<host>/` (demonstration) and `https://<host>/?tuotanto&osite=other.nolead` (a shared link of one stratum, §7.1; pressing start issues a code of that stratum, so do it once and note it, or use `?tuotanto&koodi=<code>`; `?tuotanto` alone must say the link has no stratum);
   run one demonstration session to the end and confirm `<SESSION_LOG_DIR>/<sessionId>.jsonl`
   appears with its manifest line; `npm run thinker:live-check` for the model. With the gate on
   (§2.1) `https://<host>/` must instead answer 404 with the "not available" page, and the session
   check runs on a study link with a code (`?tuotanto&koodi=<code>`).

Development is unchanged: `npm run dev` plus `npm run thinker:server` and, to test the upload,
`npm run session-log:server` (Vite proxies both).

### 2.1 The recruitment gate (`31` P-12, first SPEC/29 (ay); 19 Oct 2026, revised 21 Oct 2026)

The web demonstration runs the study's own scenario. A professional who has used it before a session
knows the ground and the story, and recruitment runs for months in a small community. While it runs,
switch the gate on in the server:

- **The server:** `RECRUITMENT_GATE=1` in the environment of `npm run serve`
  (`server/production/recruitment-gate.ts`). Only a study link reaches the app: a page request whose
  query has no `tuotanto` (`/`, `/?solu=…`, `/?pilotti`, `/?yleiso`, `/index.html`, any other path or
  HTML page, `/about.html` included) gets a neutral bilingual 404 page ("not available; open your study
  link as you received it"), uncached — never the demonstration's start page with its condition buttons
  and its professional/public version switch (SPEC/35 §2). Study links (`?tuotanto`, with or without
  `koodi`, `osite`, `pilotti`, `solu`, `yleiso`), their assets, the map and every `/api` route are unchanged.
- **The build** is the ordinary `npm run build:prod`: a gated deployment is a normal build served with
  the gate. (Until 21 Oct 2026 the build also had to leave game mode out; game mode has been removed,
  SPEC/29 status line.)

`RECRUITMENT_GATE` accepts `1` (on) or `0`/unset (off); anything else stops the server. The server
prints `recruitment gate ON` (or OFF) at start. Docker: `docker run -e RECRUITMENT_GATE=1 …` (§8).
Check: `curl -i https://<host>/` answers 404 and `curl -s https://<host>/?tuotanto` returns the app.

When recruitment has closed, unset it and restart the server: the demonstration returns, with the
public-audience version on its start page. The post-session questionnaire asks every participant
whether they had used the web demonstration before (`prior.demo`, `31` P-12; an exclusion rule in
`POST_SESSION_RULES`).

## 3. The session data

- **In the browser.** IndexedDB database `fire-sim-log-<sessionId>` (the records) and
  `fire-sim-sessions` (the list of sessions and their status: running, complete, uploaded,
  abandoned). Nothing is deleted by the app.
- **On the server.** `<SESSION_LOG_DIR>/<sessionId>.jsonl`: line 1 `{"header":…}`, then one record
  per line, then `{"manifest":{format, sessionId, lines, records, sha256, writtenBy:"server",
  chunks, completedAtIso}}`. `sha256` covers every line before the manifest (each followed by
  `\n`): `head -n -1 file.jsonl | sha256sum` must equal it. Chunks in progress live in
  `<sessionId>.parts/` until completion.
- **The export.** If the upload fails, the end screen offers a retry and **Download the session
  file** (`session-<sessionId>.jsonl`, same format, `writtenBy:"browser_export"`); the participant is
  asked to send it to the researcher. A demonstration always offers the download.
- **A session id** is 128 random bits generated on the start page (outside the run loop); it is
  pseudonymous and links the session file, the Thinker log and the participant code in the header.
- **`bundleHash`** is `sha256:` + the SHA-256 of the scenario bundle's canonical JSON (sorted keys;
  `app/telemetry/bundle-hash.ts`); `npm run bundle:hash` prints it. Same hash = same stimulus.

### 3.1 Checkpoints of unfinished sessions (9 Oct 2026)

A participant who closes the tab at V9 and never comes back would otherwise leave nothing on the
server. So a study session (`?tuotanto`; not a demonstration) also sends what it has logged so far
at each **boundary where the scenario stands still**: every freeze (`freeze_v1` … `freeze_v14`,
`freeze_vp`), the training after the practice view, the hinge after V7, the post-session
questionnaire, the results step (SPEC/36) and the debrief (`app/telemetry/session-checkpoint.ts`).

- **On the server**: `<SESSION_LOG_DIR>/<sessionId>.partial.jsonl` holds the session file's lines so
  far (header, then records, **no manifest line**: it is not a finished file), and
  `<sessionId>.partial.json` its manifest (`format: "fire-sim-session-partial/1"`, `lines`, `records`,
  `sha256` of the partial file, the last `checkpoint` label, `checkpoints`, `updatedAtIso`). Each
  checkpoint appends only what is new; the server accepts a line only as the next one (line 0 the
  header naming the session, line k the record with `seq` k−1), so the partial file is always a
  gapless prefix of the final file.
- **Superseded at completion**: the upload after COMPLETE writes `<sessionId>.jsonl` as before and
  deletes both partial files; a late checkpoint is answered `already_complete` and writes nothing.
  The admin listing (§6) shows `complete` or `partial`.
- **Invariant I3** ("zero outbound requests while RUNNING"): a checkpoint starts only on a screen
  where nothing in the scenario moves — the freeze (SPEC/05 §4's FREEZING: the view clock halted,
  scenario input and the channel disabled; the orchestrator implements it by pausing the view clock,
  so the engine's state variable still reads RUNNING there), the training (TUTORIAL), the hinge
  (HINGE_PAUSE) and the closing screens (DEBRIEF_HANDOFF). The boundary is re-checked before every
  request, so none starts once the participant is back in a view; a request already on the wire
  may finish in the background. Nothing waits for a checkpoint and nothing about it is logged, so
  the screen flow and the log are identical with or without a network (I1, I5; a test drives a
  session both ways and compares the logs). Each checkpoint is one small same-origin request
  (only the new lines). The only request during a view's live time is still Thinker's.
- A failed checkpoint is silent and harmless: the next boundary sends the missing lines, and the
  browser's own log remains complete for the upload at the end or the export.

### 3.2 Personal results contacts (SPEC/36, 23 Oct 2026)

Every session ends with an optional step "Personal results after the study" (after the questionnaire,
before the debrief). A participant who ticks the consent and gives an address sends it to
`POST /api/results-contact` `{sessionId, email, lang}`; the session log records only
`results_optin {optedIn}`, never the address.

- **Where:** `<RESULTS_CONTACT_DIR>/contacts.jsonl`, one JSON line per contact
  (`{sessionId, email, lang, receivedAtIso}`; a second send appends a second line, the last one wins).
  Default `logs/results-contacts` under the app. The server refuses to start when the directory is,
  or lies inside, `SESSION_LOG_DIR` (or contains it): the research data, the admin download (§6) and
  `sessions:export` never hold an address. The server creates the directory 0700 and the file 0600,
  validates every request (session id, address shape and length ≤ 254, language), limits it to 10
  contacts per client address per hour (429) and a 1 KB body, applies the same CORS rule as the
  other routes, and never prints the address or the body. `RESULTS_CONTACT_DIR=off`: the route
  answers 404 and the participant's step says the address could not be saved (they continue with
  `optedIn: false`). The Vite dev server has no such route: in a demonstration without the
  production server the step shows and fails the same graceful way.
- **Access:** restrict the directory to the service user (and the researcher); keep it on the
  encrypted volume, out of the backups of the research data if they are shared; do not copy it with
  the session data.
- **After data collection has closed** (never before: the reports would reach people who have not yet
  taken part), on the server or a copy of both directories:

      npm run results:reports -- --logs <SESSION_LOG_DIR> --contacts <RESULTS_CONTACT_DIR> --out <dir> [--expert-reference expert.json]

  writes `<dir>/results-<sessionId>.html` (one self-contained, print-friendly page per contact, in
  the contact's language) and `<dir>/mailing-list.csv` (`email,report_file,lang`). It sends nothing:
  send each report from your own email, as an attachment, to the address on its row. A contact
  without a finished session file gets no report (the summary names the session id, never the
  address). `expert.json` holds the expert sample's medians once it exists:
  `{"calibrationGapPoints": …, "checkingShare": …, "hakuSearches": …, "guideQuestions": …, "reviewChangeShare": …}`
  (null = unknown; without the file the reports say the expert comparison is not available yet).
  `<dir>` holds addresses: treat it like the contact directory.
- **Deletion after sending:**

      npm run results:reports -- --purge --contacts <RESULTS_CONTACT_DIR> --out <dir> --confirm-sent

  deletes the contact files and the mailing list (the reports in `<dir>` hold no address; delete them
  too once sent). It refuses while the contact files hold an address not in the mailing list (one that
  came later, or got no report); `--include-unsent` deletes those as well. The session logs are never
  touched. Employers and schools get group results only, never a report.

## 4. Resume

If the tab is closed, the browser crashes or the machine sleeps, opening the link again on the same
browser offers **Continue the session**: the interrupted view (or the practice view, the training,
the hinge screen) starts again from its beginning; answers already given stay in the log; the
interruption is logged as `fault`/`fault_resolved` (`faultClass: "session_interrupted"`, the wall-clock
gap) and `session_resumed` (resume count, interval, view replayed, where it re-entered). The analysis
may exclude a replayed view (SPEC/09 §6). **Not supported:** resuming mid-view or mid-judgement (by
design, SPEC/05 §9), resuming on another browser or computer (the data is in that browser's
IndexedDB), restoring Thinker's chat history from earlier views (the answers are in the log) or
half-entered inputs. A session interrupted after V14 re-enters the end screen and uploads.
**Start a new session** marks the old one abandoned (kept in the browser, not uploaded).

## 5. Security notes

- **The API key** is read by the Google GenAI SDK from the server's environment only. It is never in the
  repository, never logged, never sent to the browser; the browser only calls its own origin.
- **CORS.** `/api/*` accepts requests with no `Origin`, from the server's own origin (by `Host`), and
  from `ALLOWED_ORIGINS`; anything else gets 403. The dev Thinker server (`npm run thinker:server`)
  still accepts localhost only.
- **HTTPS** is mandatory and is terminated by the reverse proxy; the Node server never faces the
  internet directly. Set HSTS there.
- **Upload validation.** Session ids `[A-Za-z0-9_-]{8,64}` (no paths); chunk ≤ 2 MB, ≤ 1000 chunks,
  ≤ 64 MB per session; each chunk carries its SHA-256; a stored chunk or finished file is never
  overwritten (a different body at the same index is a 409); completion checks the line count, the
  SHA-256 and that the header names the session. The endpoint has no authentication: anyone who can
  reach it can create a new session file. Rate-limit it at the proxy and treat files whose header
  does not match the allocation table as suspect.
- **Static files** are served only from `STATIC_DIR`; `..`, encoded separators and NUL are refused.
  Responses carry `nosniff`, `no-referrer`, `X-Frame-Options: DENY`. No Content-Security-Policy is
  set yet (MapLibre's worker needs `blob:`; add one at the proxy after testing).
- **At rest.** Put `SESSION_LOG_DIR` and `logs/thinker/` on an encrypted volume with backups; restrict
  the directory to the service user. `RESULTS_CONTACT_DIR` (§3.2) holds personal data (addresses):
  the same volume, the service user only, apart from the research data, deleted after sending.
- **The data download** (§6) is off unless `ADMIN_TOKEN` is set. The token is compared in constant
  time; it is checked before any route is matched; session ids are matched raw against the upload's
  pattern, so no path leaves the two log directories; the page runs no script and escapes everything
  (the headers inside the files come from an unauthenticated upload). A `?token=` link can end up in
  the browser history and in a proxy's access log: use it on your own machine, rotate the token when
  the study ends (the quick-tunnel script makes a new one every run), or use the `Authorization`
  header with curl.

## 6. Downloading the data (researcher)

With `ADMIN_TOKEN` set, the server offers (all GET, all `cache-control: no-store`):

| Address | What |
|---|---|
| `/admin?token=<T>` | A page listing every session: participant code, cell, status (`complete`, `partial`, `uploading`, `thinker_only`), records, last checkpoint, last write, with download links. |
| `/api/admin/sessions` | The same listing as JSON. |
| `/api/admin/assignments` | With `AUTO_ASSIGN=1`: the issued codes (code, cell, language, block, issue time, session id, status `complete` / `partial` / … / `not_started`), the cell filter in force, the cap and the codes left. The page shows the same under "Shared study link: issued codes". |
| `/api/admin/sessions/<id>/log` | The session file: the finished upload, else the latest checkpoint (`session-<id>.partial.jsonl`; header `x-session-file: complete \| partial`). |
| `/api/admin/sessions/<id>/thinker` | That session's Thinker log. |
| `/api/admin/sessions/<id>/archive.tar` | That session's files as one tar. |
| `/api/admin/export.tar` | Everything: `index.json` (the listing), `issued-codes.json` (when the server issued codes), `sessions/<id>.jsonl`, `sessions/<id>.partial.jsonl` + `.partial.json`, `thinker/<id>.jsonl`. |

The token goes in `?token=<T>` (the page's links carry it) or as `Authorization: Bearer <T>`:

    curl -H "Authorization: Bearer $ADMIN_TOKEN" -o study.tar https://<host>/api/admin/export.tar

The archive is a plain uncompressed tar: Windows 10+ (`tar -xf study.tar`), macOS and Linux open it
as is. On the hosting machine itself, without the server or a token:

    npm run sessions:export -- --out D:\study-data       # copies into sessions\, thinker\, index.json
    npm run sessions:export -- --tar D:\study-data.tar   # the same as one archive

A **partial** file ends at its last checkpoint: the views after it (and their freeze answers) are
missing, and its last view may be cut off mid-way. Check `sha256` in its `.partial.json` against the
file; for a finished file the manifest line works as described in §3.

## 7. Hosting route A: from this PC, behind an ngrok tunnel

For a pilot with a few people (e.g. professors) on the researcher's Windows PC. The tunnel is
**ngrok** by default (9 Oct 2026): this PC's Elisa connection does not resolve `trycloudflare.com`,
and a participant on an Elisa home connection might not either. Once: `winget install --id
Ngrok.Ngrok`, sign up free at dashboard.ngrok.com, `ngrok config add-authtoken <token>` (the token
stays in ngrok's own config, never in the repository), and claim the free static domain (Domains) so
the link stays the same between runs: `-Domain <name>.ngrok-free.app`. The free plan allows 1 GB out
a month (the app is ~27 MB per participant) and shows a one-time "You are about to visit" page that
the participant clicks through. `-Tunnel cloudflare` uses the Cloudflare quick tunnel instead.

    powershell -ExecutionPolicy Bypass -File scripts\host-study.ps1                 # the pilot: reasoning_intent only
    powershell -ExecutionPolicy Bypass -File scripts\host-study.ps1 -Cells all      # the blocked sequence, every cell

It asks for the Gemini key in the window (or takes `$env:GEMINI_API_KEY`; never written to disk),
runs `build:prod`, makes a new `ADMIN_TOKEN` for this run (shown in the window only), starts the
server with `AUTO_ASSIGN=1`, opens the tunnel and prints **the participant links, one per stratum** (§7.1),
`https://<name>.ngrok-free.app/?tuotanto&osite=<stratum>`, each the same for everyone in its stratum (also written to
`logs/study-links-<time>.txt`, without the token), and the data page `…/admin?token=…`. Advanced:
`-Codes A,B,C` additionally prints one manual `?koodi=` link per code (a code given out by hand is
skipped by the shared link once its session has uploaded a checkpoint; to be safe, do not mix the
two in one run).

### 7.1 The shared study links and automatic assignment (revision (af), 9 Oct 2026; stratified 24 Oct 2026)

**The links (SPEC/30 §2 revision (bf), 24 Oct 2026).** The allocation is stratified by the session
language and by two screener answers — the participant's profession and whether they lead others —
so there is **one shared link per stratum**, the same for everyone in it:

    https://<host>/?tuotanto&osite=<profession>.<lead|nolead>

| `osite` | Screener answers |
|---|---|
| `fire_rescue.lead` | S1 fire and rescue service; S2 leads others |
| `fire_rescue.nolead` | S1 fire and rescue service; S2 does not |
| `military.lead` | S1 armed forces or defence; S2 leads others |
| `military.nolead` | S1 armed forces or defence; S2 does not |
| `other.lead` | S1 other; S2 leads others |
| `other.nolead` | S1 other; S2 does not |

The two screener questions (DRAFT, native check; SPEC/30 bf.2 has the full wording): **S1** "Which
best describes your main current work?" / "Mikä kuvaa parhaiten nykyistä päätyötäsi?" — fire and
rescue service (career, part-time or volunteer firefighter, rescue officer) / armed forces or defence
(including reservists in service) / other; **S2** "In your work, do you lead others — for example
command a crew, a unit or a team?" / "Johdatko työssäsi muita, esimerkiksi miehistöä, yksikköä tai
ryhmää?" — yes / no. They are asked by the recruitment platform, never in the session: on Prolific
either one study per stratum with its own custom screener and its own link, or one screener survey
that redirects each respondent to their stratum's link; for a course sample, the sign-up form's two
questions decide which link the participant receives. The language is chosen on the start page
(or fixed by a code). `scripts/host-study.ps1` prints the six links.

**What happens.** On the start page the participant chooses the language and presses start; only then
does the browser call `POST /api/assign` once (`{sessionId, language, stratum}`), and the server
answers with the **next unused code of the allocation table** (`content/assignment/allocation.json`,
version 2) in table order within that language × stratum, so codes go out exactly as the stratum's
permuted blocks of 4 lay them down and each stratum stays balanced. The code fixes the cell; the
session header logs it as usual (`participantCode`, `assignment.source: "table"`, its block) plus
`assignment.assignmentSource: "server"` (`"link"` for a `?koodi=` link) and `assignment.stratum`
(`{profession, leads}`, from the code's row).

- **No stratum, no session.** A shared link without `?osite=` (or with an unknown value) is refused
  on the start page ("the study link has no stratum"), and the server answers a request without one
  with 400: a participant is never assigned outside their stratum. A manual link
  `?tuotanto&koodi=<code>` needs no stratum (the code's row has it); if it also names one, it must be
  the code's. Pilots: `?tuotanto&pilotti&solu=t2&osite=fire_rescue.lead` logs the stratum given.
- **Codes per stratum** (DRAFT, researcher to confirm): English 40 / 24 / 32 / 20 / 12 / 12 and
  Finnish 16 / 16 / 12 / 16 / 4 / 4 in the table's order above (208 codes). The admin page shows the
  codes left in each stratum; a stratum that runs out answers 410 for that stratum only. Adding blocks
  to one stratum (`ASSIGNMENT_PLAN` in `app/session/assignment.ts`, then `npm run assignment:generate`)
  leaves every other stratum's codes and cells unchanged (one seeded stream per stratum), but it is a
  new table: move `issued-codes.json` aside and record the new `rowsSha256`.

- **Persistence.** The server records each issue (code, cell, language, block, session id, time) in
  `<SESSION_LOG_DIR>/issued-codes.json`, written atomically before it answers; a restart reads it
  back and never issues a code twice. A file written for another allocation table stops the server.
  Codes already in an uploaded session's header (manual links) are skipped.
- **Same browser, same session.** The browser keeps the code and the session id in its local
  storage: reopening the link resumes the unfinished session (the usual resume offer) or reuses the
  code; it never draws a second one. A finished session is not run again from that browser.
- **Guard.** At most `ASSIGN_RATE_PER_HOUR` (default 20) new codes per client address per hour (the
  tunnel's `cf-connecting-ip`), and at most `ASSIGN_MAX` codes in all
  (default: the table's length, 208). A retry with the same session id gets the same code.
- **When it is off.** Without `AUTO_ASSIGN=1` (a plain `npm run serve`) and always in `npm run dev`,
  `/api/assign` answers 404 and the start page of a shared link (`?tuotanto&osite=…`) says, in Finnish and English, that the
  link is not active and to contact the researcher. It never falls back to a random or demonstration
  cell, and a researcher running the app locally never consumes or creates a code. `?tuotanto&koodi=X`
  works as before everywhere.
- **Pilot cell filter: `ASSIGN_CELLS`.** E.g. `ASSIGN_CELLS=reasoning_intent` (the professors' pilot:
  everyone runs Search + guided Thinker, which has both tools). The server walks the same sequence and
  issues only codes of the listed cells, in sequence order; the others stay unissued. This
  **deliberately breaks the blocked balance between cells** — fine for a pilot, and it **must be off
  (unset) for the study**. The server's start lines and the admin page show the filter in force. The
  English strata hold 70 `reasoning_intent` codes (2 per block of 4) and the Finnish ones 34,
  plenty for a pilot. Pilot sessions use codes of the real table: before the study, move
  `issued-codes.json` aside only if those codes should be issued again, and analyse pilot sessions
  apart.

**Limits of a tunnel.** Without `-Domain` the address is **new on every run**: links from an earlier run are dead, so send links only once the run that will serve the
sessions is up, and keep it up until everyone has finished. **The PC must stay on, awake and
online** for as long as anyone is in a session (about an hour each); the script asks Windows not to
sleep while it runs, but closing the lid, a restart or a dropped connection ends the tunnel. A
participant cut off keeps everything in the browser and can resume with the same link on the same
browser — but only while that run's address lives, and Thinker cannot answer while the PC is
unreachable. Quick tunnels have no uptime guarantee and are meant for testing. For anything beyond
a handful of supervised pilot sessions, use route B.

## 8. Hosting route B: the Docker image

The repository's `Dockerfile` builds the whole server (Node 22, `npm ci`, `build:prod` with its CI,
the embedding model baked into the image) and keeps every participant file under `/app/logs`, which
must be a persistent volume. Any container host with a persistent disk and an EU region works; the
host's proxy terminates HTTPS. (The Fly.io recipe was removed on 9 Oct 2026: the pilot is hosted from
the researcher's PC, route A.)

    docker build --build-arg APP_COMMIT=$(git rev-parse --short=12 HEAD) -t fire-sim .
    docker run -p 8080:8080 -v fire_sim_logs:/app/logs -e GEMINI_API_KEY=… -e ADMIN_TOKEN=… fire-sim

`HOST=0.0.0.0`, `PORT=8080`, `THINKER_MODE=study`, `SESSION_LOG_DIR=/app/logs/sessions` and
`AUTO_ASSIGN=1` are set in the image (`ASSIGN_CELLS` never is: a pilot adds
`-e ASSIGN_CELLS=reasoning_intent`; `-e AUTO_ASSIGN=0` turns the shared link off). Run exactly one
container on the volume: two would split the data. If the image build cannot reach Hugging Face for
the model, build the index on your machine first (`npm run thinker:index …`, §2 step 3): the resulting
`.cache/` is copied into the image instead. `--build-arg BUILD_FLAGS=--skip-ci` skips the CI inside
the build, only for a commit whose `npm run ci` has passed. While recruitment runs (§2.1) run with
`-e RECRUITMENT_GATE=1` (the image is the same).

**Pilot overview page.** `app/render/ui/public/about.html` is served at `https://<host>/about.html`: the supervisors' overview of the design, build, real-fire grounding and open questions (9 Oct 2026). Nothing in the participant flow links to it, and it carries `noindex`. It states the hypotheses, so **delete it before the real study**: participants must not be able to read them.

## 9. What the researcher still has to do

- **Hosting** in the EU, a domain and a TLS certificate; the reverse proxy configuration above.
- **The data-processing agreement** with the host (and with Google for the Gemini model, used by Haku and the Thinker in every cell: the
  questions participants type are sent to the model), the DPIA, the retention and deletion plan,
  and backups of the session directory.
- **Ethics approval and the consent wording**, including what the participant is told about the
  local storage in the browser, the upload, and sending the exported file if the upload fails
  (and where to send it — an address the end screen can name).
- **The real API key** in the server environment, and `npm run thinker:index` on a machine with
  Hugging Face access (it is blocked in this development environment).
- **A pilot** on the participants' typical browsers, including one interrupted and resumed session
  and one failed upload with the export.
- **The recruitment gate** (§2.1) on the server from the first invitation until
  recruitment closes, and no other copy of the demonstration online meanwhile (a
  `npm run build:web` copy or a development tunnel has no gate).
