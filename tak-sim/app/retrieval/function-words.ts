/**
 * The content-match rule (SPEC/14 revision (bo), 25 Oct 2026; the H9/H10 guard's finding): a record that matches the question only
 * by its FUNCTION words — the verb "olla" / "be" and the auxiliaries, question words, pronouns, conjunctions and prepositions — is
 * no lexical match. Before it, "Mikä on viimeisin sääennuste?" ranked the grid operator's record (an H9 record) 4th because it says
 * "on" twice in a short text, and the radio lines asking "Mikä on teidän reittinne?" first; "Have reinforcements been dispatched?"
 * ranked the same record 8th by "been". The lexical half alone changes: such a record's BM25 score is 0, every other record's is
 * exactly as before (the function words still count in a record that also matches a content word). When no candidate matches any
 * other word of the question, nothing changes (the rule removes function-word matches only where the question's content found
 * something). The vector half and the passage are unchanged. Not a stopword list: the lexical query keeps every word.
 *
 * The lists are closed-class words, declared here and in the manifest; a word is judged as written (lowercased, a case ending after a
 * colon and an English possessive dropped, `sourceWords`), and its tokens are function tokens only when no content word of the
 * question has the same token (English "has" and the unit "ha" share the token "ha").
 */

import { tokenise, type RetrievalLang } from "./hybrid.js";
import { sourceWords } from "./named-source.js";

/** Finnish function words: "olla" and the negation verb, question words, pronouns, conjunctions, a few particles. */
export const FUNCTION_WORDS_FI: ReadonlySet<string> = new Set([
  "on", "ovat", "oli", "olivat", "olla", "ole", "olen", "olet", "olemme", "olette", "ollut", "olleet", "olisi", "olisivat", "onko", "ovatko", "oliko", "olivatko", "onhan",
  "ei", "eivät", "en", "et", "emme", "ette", "eikö", "eivätkö",
  "ja", "tai", "sekä", "mutta", "että", "jos", "kun", "kuin", "vai", "eli", "joten", "koska", "jotta", "vaikka",
  "mikä", "mitä", "mitkä", "minkä", "missä", "mistä", "mihin", "millä", "miltä", "mille", "millainen", "millaista", "millaisia", "milloin", "miten", "kuinka",
  "kuka", "ketkä", "kenen", "kenelle", "keneltä", "kumpi", "paljonko", "montako",
  "se", "sen", "sitä", "siitä", "siinä", "siihen", "sille", "siltä", "sillä", "ne", "niiden", "niitä", "niistä", "niissä", "niihin", "niillä",
  "tämä", "tämän", "tätä", "tässä", "tästä", "tähän", "tällä", "nämä", "näiden", "tuo", "joka", "jota", "jonka", "jossa", "josta", "johon", "jolla", "jotka",
  "mitään", "jotain", "jotakin", "jokin", "joku", "kukaan", "mikään", "minä", "minun", "me", "meidän", "meille", "sinä", "sinun", "te", "teidän", "teille", "hän", "he", "heidän", "itse",
  "myös", "vielä", "jo", "sitten", "vain", "siis", "kyllä", "ihan", "aivan",
]);

/** English function words: "be", "have", "do" and the modals, articles, question words, pronouns, conjunctions, prepositions. */
export const FUNCTION_WORDS_EN: ReadonlySet<string> = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am", "has", "have", "had", "do", "does", "did",
  "will", "would", "can", "could", "should", "shall", "may", "might", "must",
  "of", "to", "in", "on", "at", "for", "by", "with", "from", "into", "about", "as", "and", "or", "but", "if", "than", "then", "so", "not", "no",
  "that", "this", "these", "those", "there", "here", "it", "its", "they", "them", "their", "we", "our", "us", "you", "your", "i", "my", "me", "he", "she", "his", "her",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how", "any", "some", "also", "too", "just",
]);

/** The question's function tokens (in the retrieval language's tokeniser): tokens only its function words have. */
export function functionTokens(query: string, lang: RetrievalLang): ReadonlySet<string> {
  const words = lang === "en" ? FUNCTION_WORDS_EN : FUNCTION_WORDS_FI;
  const fn = new Set<string>();
  const content = new Set<string>();
  for (const m of query.matchAll(/\S+/gu)) {
    const ws = sourceWords(m[0], lang);
    const isFunction = ws.length > 0 && ws.every((w) => words.has(w));
    for (const t of tokenise(m[0], lang)) (isFunction ? fn : content).add(t);
  }
  for (const t of content) fn.delete(t);
  return fn;
}
