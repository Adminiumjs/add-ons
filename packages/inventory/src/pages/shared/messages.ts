/**
 * A SCREEN'S WORDS, HANDED TO THE HOST.
 *
 * Each screen is one file the dashboard loads from an address of its own, and
 * nothing beside it can be fetched from there — so a screen carries its words
 * in every language inside that one file, cut to the sections it shows
 * (`strings/`). The host keeps them under this add-on's own namespace and
 * adds to what another screen of it registered before.
 */
import { registerMessages, type AddOnTranslate } from './host.ts';
import { LOCALES, type Section } from '../strings/index.ts';

/** The translator for a screen that shows these sections, in every language shipped. */
export function wordsFor(...sections: readonly Section[]): AddOnTranslate {
  const bundles: Record<string, Record<string, string>> = {};
  for (const [tag, all] of Object.entries(LOCALES)) {
    bundles[tag] = Object.assign({}, ...sections.map((section) => all[section] ?? {})) as Record<string, string>;
  }
  return registerMessages('inventory', bundles);
}
