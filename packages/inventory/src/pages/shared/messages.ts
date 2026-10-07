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
import type { InEveryLanguage } from '../strings/index.ts';

/** The translator for a screen that shows these sections, in every language shipped. */
export function wordsFor(...sections: readonly InEveryLanguage[]): AddOnTranslate {
  const bundles: Record<string, Record<string, string>> = {};
  for (const section of sections) for (const [tag, words] of Object.entries(section)) bundles[tag] = { ...(bundles[tag] ?? {}), ...words };
  return registerMessages('inventory', bundles);
}
