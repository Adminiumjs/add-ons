/**
 * DAYS, AS COUNTS ARE KEPT.
 *
 * Adminium adds views up per day in the business's own time zone, so "this
 * month" is this month there, whatever the reader's clock says. A day is
 * written `YYYY-MM-DD`; a range is two days, both included.
 *
 * Pure: the moment and the zone are handed in.
 */

export interface DayRange {
  from: string;
  to: string;
}

/** The ranges the funnel's date button offers, in the comp's order. */
export const RANGES = ['this-month', 'last-month', 'last-7', 'last-30', 'last-12-months'] as const;
export type RangeChoice = (typeof RANGES)[number];

const pad = (n: number): string => String(n).padStart(2, '0');
const write = (y: number, m: number, d: number): string => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
const parts = (day: string): [number, number, number] => day.split('-').map(Number) as [number, number, number];
/** A day moved by some days, through the calendar (never through a clock, so no zone shift can move it). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = parts(day);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return write(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
}

/** The day a moment falls on in a zone; the reader's own zone when the zone is unknown or not one. */
export function dayIn(at: number, zone: string | null): string {
  const read = (timeZone: string | undefined): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  try {
    return read(zone ?? undefined);
  } catch {
    return read(undefined);
  }
}

/** The days a choice covers, up to today. */
export function rangeOf(choice: RangeChoice, today: string): DayRange {
  const [y, m] = parts(today);
  switch (choice) {
    case 'this-month':
      return { from: write(y, m, 1), to: today };
    case 'last-month': {
      const first = m === 1 ? write(y - 1, 12, 1) : write(y, m - 1, 1);
      return { from: first, to: addDays(write(y, m, 1), -1) };
    }
    case 'last-7':
      return { from: addDays(today, -6), to: today };
    case 'last-30':
      return { from: addDays(today, -29), to: today };
    case 'last-12-months': {
      const back = m - 11;
      return { from: back >= 1 ? write(y, back, 1) : write(y - 1, back + 12, 1), to: today };
    }
  }
}

/** A range in the reader's words: "1–28 Jul 2026". */
export function rangeWords(range: DayRange, locale: string): string {
  const at = (day: string): Date => {
    const [y, m, d] = parts(day);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return range.from === range.to ? format.format(at(range.from)) : format.formatRange(at(range.from), at(range.to));
}

/** One day in the reader's words: "14 Jul 2026". */
export const dayWords = (day: string, locale: string): string => rangeWords({ from: day, to: day }, locale);

/** Whether a day falls after the start of a range (and so the range began before it). */
export const startsInside = (day: string | null, range: DayRange): boolean => day !== null && day > range.from && day <= range.to;
