/**
 * THE WORDS A NEW QUESTION STARTS WITH, in the language being edited — not
 * the reader's: a person writing the German version of a form gets
 * "Unbenannte Frage", whatever language their own screens are in.
 */
import { BUILDER } from '../strings/index.ts';
import type { Lang, Starting } from './draft.ts';

/** A sentence of this section in a given language, its English where it has none. */
function inLanguage(lang: Lang): (key: string, english: string, args?: Record<string, string>) => string {
  const words = BUILDER[lang] ?? {};
  return (key, english, args = {}) => Object.entries(args).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), words[key] ?? english);
}

export function startingWords(lang: Lang): Starting & { section: string } {
  const t = inLanguage(lang);
  return {
    question: t('builder.start.question', 'Untitled question'),
    choice: (n) => t('builder.start.choice', 'Choice {n}', { n: String(n) }),
    tick: t('builder.start.tick', 'Yes, send me the newsletter by e-mail. I can stop it at any time with the link in each mail.'),
    section: t('builder.start.section', 'Untitled section'),
  };
}
