/** The screens' words, in the eight languages they ship with. */
import { EN, type WordKey, type Words } from './en.ts';
import translations from './translations.json' with { type: 'json' };

export type { WordKey, Words };
export { EN };

export const WORDS: Readonly<Record<string, Words>> = { 'en-US': EN, ...(translations as unknown as Record<string, Words>) };

export function wordsFor(tag: string): Words {
  const base = tag.split('-')[0];
  return WORDS[tag] ?? Object.entries(WORDS).find(([one]) => one.split('-')[0] === base)?.[1] ?? EN;
}

/** Fills `{slots}`. A slot with no value stays as written, so a slip shows rather than vanishing. */
export function fill(text: string, values: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
