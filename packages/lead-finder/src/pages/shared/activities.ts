/**
 * "WHAT THEY DO": each register's own activity list, as the search's choice.
 *
 * The same lists the server half labels its answers with (`activities/`),
 * so a code the person picks is one the register files companies under. Each
 * option reads "words · code" in the reader's language where the list has
 * it, else in the register's own.
 */
import { ACTIVITY_LISTS, activityLabel, type ActivitySource } from '../../activities/index.ts';

export interface ActivityOption {
  value: string;
  label: string;
}

const isListed = (source: string): source is ActivitySource => Object.prototype.hasOwnProperty.call(ACTIVITY_LISTS, source);

/** The activities a source searches by; none for a source with no list here. */
export function activityOptions(source: string, locale: string): ActivityOption[] {
  if (!isListed(source)) return [];
  return ACTIVITY_LISTS[source].codes.map((activity) => ({ value: activity.code, label: `${activityLabel(activity, locale) ?? activity.code} · ${activity.code}` }));
}

/** One activity's words, as the results head names the search. */
export function activityWords(source: string, code: string, locale: string): string {
  if (!isListed(source)) return code;
  const found = ACTIVITY_LISTS[source].codes.find((activity) => activity.code === code);
  return found === undefined ? code : (activityLabel(found, locale) ?? code);
}
