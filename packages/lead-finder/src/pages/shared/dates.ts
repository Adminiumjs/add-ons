/**
 * DAYS AS A READER OF THE PAGE WRITES THEM: "28 Jul", "28 Jul 2026".
 *
 * A day with no time (`tell_by`, `YYYY-MM-DD`) is that day wherever the
 * reader is; a moment is shown on the reader's own clock.
 */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A moment or a day as epoch milliseconds; a day is its noon UTC, so no clock moves it a day. */
export function instantOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const day = DAY.exec(value.trim());
  if (day !== null) return Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

export function shortDay(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(at));
}

export function longDay(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(at));
}

export function clockTime(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}

/** Whole days from `now` to a day (negative: it is past). */
export function daysUntil(day: number, now: number): number {
  const startOf = (at: number) => {
    const date = new Date(at);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };
  return Math.round((startOf(day) - startOf(now)) / 86_400_000);
}
