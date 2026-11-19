/**
 * WHAT A COMPANY DOES, IN EACH REGISTER'S OWN WORDS: the three activity code
 * lists, kept as data beside this file and read through it.
 *
 *  - `uk-sic-2007.json`: UK SIC 2007, the codes Companies House files a
 *    company under, with its English labels (Companies House's condensed
 *    list, resources.companieshouse.gov.uk/sic; Open Government Licence).
 *  - `fr-naf-rev2.json`: France's NAF rév. 2 sub-classes, the code the
 *    register gives each unit (`activite_principale`, "71.11Z"), with INSEE's
 *    French labels (Licence Ouverte, Etalab). INSEE's NAF 2025 replaces it in
 *    the register from 2027: the list is data, so it is swapped, not rewritten.
 *  - `no-sn2025.json`: Norway's SN2025 codes at their finest level ("71.110"),
 *    the scheme the Brønnøysund register files units under now, with Statistics
 *    Norway's Norwegian and English labels (NLOD).
 *
 * A search sends the code (or the start of one: every register here finds by
 * a code's prefix); a found company's activity is the first code its register
 * gives, with this list's label where the register sends a code alone.
 */
import france from './fr-naf-rev2.json' with { type: 'json' };
import norway from './no-sn2025.json' with { type: 'json' };
import uk from './uk-sic-2007.json' with { type: 'json' };

/** One activity: its code in the register's scheme, and its label in each language the register gives one in. */
export interface Activity {
  readonly code: string;
  readonly label: Readonly<Record<string, string>>;
}

export interface ActivityList {
  readonly scheme: string;
  readonly codes: readonly Activity[];
}

/** The list each register searches by, by source id. */
export const ACTIVITY_LISTS = {
  'companies-house': uk as ActivityList,
  france: france as ActivityList,
  norway: norway as ActivityList,
} as const satisfies Readonly<Record<string, ActivityList>>;

export type ActivitySource = keyof typeof ACTIVITY_LISTS;

const byCode = new Map(Object.entries(ACTIVITY_LISTS).map(([source, activities]) => [source, new Map(activities.codes.map((activity) => [activity.code, activity]))]));

/** One activity of a register's list by its exact code, or undefined. */
export function activityOf(source: ActivitySource, code: string): Activity | undefined {
  return byCode.get(source)?.get(code.trim().toUpperCase());
}

/**
 * An activity's label for a reader of `locale`: that language's, else the
 * same language's in another country, else the register's first.
 */
export function activityLabel(activity: Activity, locale: string): string | undefined {
  const exact = activity.label[locale];
  if (exact !== undefined) return exact;
  const language = locale.split('-')[0];
  const near = Object.entries(activity.label).find(([tag]) => tag.split('-')[0] === language)?.[1];
  return near ?? Object.values(activity.label)[0];
}

/** Every code of a register's list that starts with `prefix` (dots and case ignored), in the list's order. */
export function codesStartingWith(source: ActivitySource, prefix: string): string[] {
  const wanted = prefix.replace(/\./g, '').trim().toUpperCase();
  if (wanted === '') return [];
  return ACTIVITY_LISTS[source].codes.map((activity) => activity.code).filter((code) => code.replace(/\./g, '').toUpperCase().startsWith(wanted));
}
