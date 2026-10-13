---
name: project-i18n-english
description: Finnish/English session language built 1 Oct 2026 — where each kind of text lives and the generator's L(fi,en)+Tape rule
metadata:
  type: project
---

On 1 Oct 2026 a language dropdown (fi/en) was added to the first page; the choice is logged in the session header (commits 1876676, 3f5a3c6, 7f3ebd6). Retrieval (Haku, Thinker) always runs over the Finnish records; only display changes.

Where text lives: UI `app/i18n/ui.ts`; labels/questions `content/i18n/labels.en.json` (fi→en); generated records via `L(fi, en)` in `tools/fire-ca/traffic*.ts` (bundle `english` map); authored records `content/i18n/authored.en.json`; per-record edits `content/i18n/records.en.overrides.json` (wins). Thinker English prompt `server/thinker/prompt.en.md`.

**Rule:** never put a draw (`pick`, `rnd`, `chance`, `crewSees`, `tempFi`) inside both `L()` arguments — it draws twice and changes the Finnish corpus; wrap it in an IIFE. The generator runs twice per step with Finnish choices replayed (`Tape`); `bilingual()` throws if the runs differ. Check `git diff content/corpus/interaction-log.jsonl` stays empty after generator edits.

Open: an English question searches a Finnish index (lexical half weak; dense e5 is multilingual) — flagged to the user, not resolved. English is a DRAFT translation, not reviewed. Related: [[feedback-identical-stimulus]].
