/**
 * THE ARITHMETIC, CHECKED AGAINST FACTS FROM OUTSIDE THIS REPOSITORY.
 *
 * ── WHY THAT PHRASE IS THE WHOLE POINT ──────────────────────────────────────
 *
 * Every date this add-on ships is computed by `civil.ts`, and a transcription
 * error in `easterSunday` or `nthWeekdayOf` is SELF-CONSISTENT: a wrong Easter
 * is still a Sunday in March or April, a wrong "third Monday" is still a
 * Monday, and every downstream test built from the same functions would agree
 * with it perfectly. A suite that checked the expansion against the expander
 * would be a suite that could not fail.
 *
 * So the cases below pin literal dates that are known independently — five
 * years of Easter, the American weekday holidays for both shipped years, the
 * weekday of two arbitrary days. If somebody changes an algorithm here, these
 * are the lines that go red.
 *
 * `daysets.test.ts` does the same one level up, over the sets themselves.
 */

import { describe, expect, it } from "vitest";

import {
  civilFromDays,
  daysFromCivil,
  easterSunday,
  epochDayOf,
  isoOf,
  nthWeekdayOf,
  weekdayOf,
} from "./civil.ts";

const iso = (year: number, month: number, day: number) => isoOf({ y: year, m: month, d: day });

describe("days from civil, and back", () => {
  it("puts the epoch where the epoch is", () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(isoOf(civilFromDays(0))).toBe("1970-01-01");
  });

  it("round-trips every day across two leap years and a century boundary", () => {
    // 1899-12-01 through 2101-01-01 — 73,000-odd days, which covers 1900 (not a
    // leap year), 2000 (one), and every ordinary February in between.
    const from = daysFromCivil(1899, 12, 1);
    const to = daysFromCivil(2101, 1, 1);
    let mismatches = 0;
    for (let day = from; day <= to; day += 1) {
      const { y, m, d } = civilFromDays(day);
      if (daysFromCivil(y, m, d) !== day) mismatches += 1;
    }
    expect(mismatches).toBe(0);
  });

  it("knows 1900 was not a leap year and 2000 was", () => {
    expect(daysFromCivil(1900, 3, 1) - daysFromCivil(1900, 2, 28)).toBe(1);
    expect(daysFromCivil(2000, 3, 1) - daysFromCivil(2000, 2, 28)).toBe(2);
  });

  it("reads a weekday off a day, against two dates anybody can check", () => {
    // 1970-01-01 was a Thursday; 2026-08-28, the day this pack was reviewed,
    // is a Friday.
    expect(weekdayOf(0)).toBe(4);
    expect(weekdayOf(daysFromCivil(2026, 8, 28))).toBe(5);
  });
});

describe("epochDayOf refuses what is not a day", () => {
  it("accepts a real calendar day", () => {
    expect(epochDayOf("1970-01-01")).toBe(0);
    expect(epochDayOf("2026-12-25")).toBe(daysFromCivil(2026, 12, 25));
  });

  it("refuses a day that does not exist, rather than sliding it", () => {
    // `new Date("2026-02-30")` answers 2 March. That silent slide is the whole
    // reason this function exists and returns a union.
    expect(epochDayOf("2026-02-30")).toBeNull();
    expect(epochDayOf("2026-02-29")).toBeNull();
    expect(epochDayOf("2024-02-29")).not.toBeNull();
    expect(epochDayOf("2026-13-01")).toBeNull();
    expect(epochDayOf("2026-00-10")).toBeNull();
    expect(epochDayOf("2026-04-00")).toBeNull();
  });

  it("refuses anything that is not the shape at all", () => {
    for (const bad of ["", "2026", "2026-4-5", "26-04-05", "last tuesday", "2026-04-05T00:00"]) {
      expect(epochDayOf(bad), bad).toBeNull();
    }
  });
});

/**
 * EASTER, AGAINST FIVE YEARS NOBODY HAS TO TRUST THIS FILE FOR.
 *
 * Western (Gregorian) Easter. Every one of these is a published date and every
 * one of them is a Sunday, which the second case checks separately — a
 * computation that produced the right day of the month on a Tuesday would be
 * wrong in a way the dates alone would not show.
 */
describe("Easter Sunday", () => {
  const KNOWN: readonly [number, string][] = [
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
  ];

  it.each(KNOWN)("%i falls on %s", (year, expected) => {
    expect(isoOf(easterSunday(year))).toBe(expected);
  });

  it("is a Sunday every time, over a century", () => {
    const wrong: string[] = [];
    for (let year = 1950; year <= 2050; year += 1) {
      const { y, m, d } = easterSunday(year);
      if (weekdayOf(daysFromCivil(y, m, d)) !== 0) wrong.push(isoOf({ y, m, d }));
    }
    expect(wrong).toEqual([]);
  });

  it("never leaves the window the definition allows", () => {
    // Easter is between 22 March and 25 April inclusive, by construction.
    for (let year = 1950; year <= 2050; year += 1) {
      const { m, d } = easterSunday(year);
      const inWindow = (m === 3 && d >= 22) || (m === 4 && d <= 25);
      expect(inWindow, `${year}: ${m}-${d}`).toBe(true);
    }
  });
});

/**
 * THE WEEKDAY RULES, INCLUDING THE ONE THAT CHANGES ORDINAL BETWEEN THE TWO
 * YEARS THIS PACK SHIPS.
 *
 * Memorial Day is the LAST Monday in May: 25 May in 2026, which is also the
 * fourth Monday, and 31 May in 2027, which is the fifth. A rule written as "the
 * fourth Monday" passes for 2026 and is wrong for 2027, and that is exactly the
 * kind of error a pack of dates hides. Both years are asserted.
 */
describe("the nth weekday of a month", () => {
  it("finds the American federal weekday holidays for both shipped years", () => {
    expect(isoOf(nthWeekdayOf(2026, 1, 1, 3))).toBe(iso(2026, 1, 19)); // MLK
    expect(isoOf(nthWeekdayOf(2027, 1, 1, 3))).toBe(iso(2027, 1, 18));
    expect(isoOf(nthWeekdayOf(2026, 2, 1, 3))).toBe(iso(2026, 2, 16)); // Washington
    expect(isoOf(nthWeekdayOf(2027, 2, 1, 3))).toBe(iso(2027, 2, 15));
    expect(isoOf(nthWeekdayOf(2026, 9, 1, 1))).toBe(iso(2026, 9, 7)); // Labor
    expect(isoOf(nthWeekdayOf(2027, 9, 1, 1))).toBe(iso(2027, 9, 6));
    expect(isoOf(nthWeekdayOf(2026, 10, 1, 2))).toBe(iso(2026, 10, 12)); // Columbus
    expect(isoOf(nthWeekdayOf(2027, 10, 1, 2))).toBe(iso(2027, 10, 11));
    expect(isoOf(nthWeekdayOf(2026, 11, 4, 4))).toBe(iso(2026, 11, 26)); // Thanksgiving
    expect(isoOf(nthWeekdayOf(2027, 11, 4, 4))).toBe(iso(2027, 11, 25));
  });

  it("reads `last` as last, in a year where that is the fifth and not the fourth", () => {
    expect(isoOf(nthWeekdayOf(2026, 5, 1, -1))).toBe(iso(2026, 5, 25));
    expect(isoOf(nthWeekdayOf(2027, 5, 1, -1))).toBe(iso(2027, 5, 31));
    // …and the two really are different ordinals, which is the reason the rule
    // is written as `-1`. Spelling it out here so a reader does not have to
    // count Mondays to see why the case above matters.
    expect(isoOf(nthWeekdayOf(2026, 5, 1, 4))).toBe(iso(2026, 5, 25));
    expect(isoOf(nthWeekdayOf(2027, 5, 1, 4))).toBe(iso(2027, 5, 24));
  });

  it("always lands on the weekday it was asked for, across a decade of months", () => {
    const wrong: string[] = [];
    for (let year = 2020; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let weekday = 0; weekday <= 6; weekday += 1) {
          for (const nth of [1, 2, 3, 4, -1]) {
            const found = nthWeekdayOf(year, month, weekday as 0, nth);
            const day = daysFromCivil(found.y, found.m, found.d);
            if (weekdayOf(day) !== weekday) wrong.push(`${isoOf(found)} is not weekday ${weekday}`);
            if (found.y !== year || found.m !== month) wrong.push(`${isoOf(found)} left ${year}-${month}`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
