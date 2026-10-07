/**
 * Every language the screens ship, by section. A screen registers the
 * sections it shows and no other, so its one file holds no words of a screen
 * it is not (`shared/messages.ts`).
 */
import * as enUS from './en-US.ts';

export type Section = 'shared' | 'refusal' | 'receive' | 'transfer' | 'opening' | 'counts' | 'rules';
export type Words = Readonly<Record<string, string>>;

/** en-US is the fallback: a key a language has not translated still reads as a sentence. */
export const LOCALES: Readonly<Record<string, Readonly<Partial<Record<Section, Words>>>>> = {
  'en-US': enUS,
};
