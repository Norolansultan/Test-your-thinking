/**
 * SPEC/35 §3 item 1: the primer's texts, as data (`content/glossary/primer.{fi,en}.json`, the same page and question ids
 * in both; DRAFT). Seven pages, each with its illustration (`PrimerIllustrations.tsx`) and one check question.
 */

import primerFi from "../../../../content/glossary/primer.fi.json" with { type: "json" };
import primerEn from "../../../../content/glossary/primer.en.json" with { type: "json" };
import type { Lang } from "../../../i18n/lang.js";
import type { PrimerPage } from "./primer-flow.js";

export interface PrimerUi {
  readonly title: string;
  /** "{n}" and "{total}" are replaced. */
  readonly pageOf: string;
  readonly back: string;
  readonly next: string;
  readonly done: string;
  readonly check: string;
  readonly right: string;
  readonly wrong: string;
  readonly tryAgain: string;
  readonly answerFirst: string;
}

export interface PrimerContent {
  readonly lang: string;
  readonly status: string;
  readonly ui: PrimerUi;
  readonly pages: readonly PrimerPage[];
}

export const PRIMER_CONTENT: Readonly<Record<Lang, PrimerContent>> = { fi: primerFi, en: primerEn };

export function pageOfLabel(ui: PrimerUi, n: number, total: number): string {
  return ui.pageOf.replace("{n}", String(n)).replace("{total}", String(total));
}
