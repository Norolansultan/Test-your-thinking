/**
 * The session language (researcher decision 1 Oct 2026): the participant chooses Finnish or English
 * on the first page, and the whole session — interface, briefing, questions and every record — is
 * shown in that language. Finnish is the source: retrieval (Haku and Thinker) always runs over the
 * Finnish records, so the evidence found is the same in both languages; only what is shown differs.
 *
 * Where the texts live (each editable without touching code):
 *   - interface strings: `app/i18n/ui.ts` (one dictionary per language, same keys);
 *   - scenario labels, questions and options: `content/i18n/labels.en.json` (Finnish text → English);
 *   - generated records (crew radio, drones, logs): written by the generator next to the Finnish
 *     (`tools/fire-ca/traffic*.ts`, every literal is `L(fi, en)`), into the bundle's `english` map;
 *   - authored records (story beats, designed events, registers): `content/i18n/authored.en.json`;
 *   - any record, to reword it without touching code: `content/i18n/records.en.overrides.json`
 *     (record id → English), which wins over both.
 */

export type Lang = "fi" | "en";

export const LANGUAGES: readonly { readonly id: Lang; readonly label: string }[] = [
  { id: "fi", label: "Suomi" },
  { id: "en", label: "English" },
];

export const DEFAULT_LANG: Lang = "fi";

export function isLang(value: unknown): value is Lang {
  return value === "fi" || value === "en";
}
