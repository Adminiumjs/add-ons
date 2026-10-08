/**
 * DAYS AND MONTHS, ON TEXT.
 *
 * The file that decides has no clock and no calendar object: today is handed
 * in as `YYYY-MM-DD`. A card's last day is so many months from today, its
 * reminder so many days before that — worked out here by plain calendar
 * arithmetic on the three numbers.
 */

const two = (value: number): string => String(value).padStart(2, '0');
const leap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysIn = (year: number, month: number): number => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;

/** A date's three numbers, or null for text that is no date. */
function parts(date: unknown): [number, number, number] | null {
  const match = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(date) : null;
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month) ? [year, month, day] : null;
}

/** The days from 1 January 1970 to a date, and back. */
function toNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const ofEra = y - era * 400;
  const ofYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  return era * 146097 + ofEra * 365 + Math.floor(ofEra / 4) - Math.floor(ofEra / 100) + ofYear - 719468;
}
function fromNumber(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const ofEra = z - era * 146097;
  const yearOfEra = Math.floor((ofEra - Math.floor(ofEra / 1460) + Math.floor(ofEra / 36524) - Math.floor(ofEra / 146096)) / 365);
  const ofYear = ofEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * ofYear + 2) / 153);
  const day = ofYear - Math.floor((153 * shifted + 2) / 5) + 1;
  const month = shifted < 10 ? shifted + 3 : shifted - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${two(month)}-${two(day)}`;
}

/** A date so many days later (or earlier). Text that is no date is answered as null. */
export function addDays(date: unknown, days: number): string | null {
  const read = parts(date);
  return read === null ? null : fromNumber(toNumber(...read) + days);
}

/** The same day so many months later; the last day of that month where it has no such day (31 January + 1 month is the last of February). */
export function addMonths(date: unknown, months: number): string | null {
  const read = parts(date);
  if (read === null) return null;
  const [year, month, day] = read;
  const count = year * 12 + (month - 1) + months;
  const [toYear, toMonth] = [Math.floor(count / 12), (count % 12) + 1];
  return `${String(toYear).padStart(4, '0')}-${two(toMonth)}-${two(Math.min(day, daysIn(toYear, toMonth)))}`;
}
