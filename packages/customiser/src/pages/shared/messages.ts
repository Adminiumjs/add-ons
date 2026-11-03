/**
 * THE SCREENS' WORDS, HANDED TO THE HOST.
 *
 * The add-on's screens are one file the dashboard loads from one address, so
 * that file carries every language of the words it shows (`strings/`). The
 * host keeps them under this add-on's own namespace.
 */
import { registerMessages, type AddOnTranslate } from './host.ts';
import type { InEveryLanguage } from '../strings/index.ts';
import { ADD_ON } from './paths.ts';

/** The translator for the sections given, in every language shipped. */
export function wordsFor(...sections: readonly InEveryLanguage[]): AddOnTranslate {
  const bundles: Record<string, Record<string, string>> = {};
  for (const section of sections) for (const [tag, words] of Object.entries(section)) bundles[tag] = { ...(bundles[tag] ?? {}), ...words };
  return registerMessages(ADD_ON, bundles);
}
