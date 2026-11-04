/**
 * THE ROWS THE `holidays` TABLE STARTS WITH.
 *
 * An app's own closures table links to a holiday row (`rules.addOnLink` into
 * this add-on's `holidays`), so "Add as a closure" is the app's action on a
 * row it can read. That needs the days as rows, not only as a setting: this is
 * every reviewed set over every reviewed year, written once at install (or by
 * the update that makes the table). The names stay in the country's own
 * language, as everywhere in this add-on (see `NamedDay`).
 */
import { DAY_SETS, YEARS, expandSet } from "./daysets.ts";

/** One starting row: which set, which day, what the state calls it. */
export interface HolidayRow {
  readonly country: string;
  /** The set's own area key, or null for a national set. */
  readonly region: string | null;
  /** ISO `YYYY-MM-DD`. */
  readonly day: string;
  readonly name: string;
}

/** Every set over every year, in the picker's order and then by date. */
export function holidayRows(): HolidayRow[] {
  return DAY_SETS.flatMap((set) =>
    YEARS.flatMap((year) =>
      expandSet(set, year).map((day) => ({
        country: set.country,
        region: set.region ?? null,
        day: day.date,
        name: day.name,
      })),
    ),
  );
}
