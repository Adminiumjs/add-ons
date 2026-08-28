/**
 * THE DATA'S OWN INTEGRITY — the suite this package is really for.
 *
 * ── WHAT A DATA PACK CAN GET WRONG, AND WHICH HALF A TEST CAN SEE ───────────
 *
 * There are two ways a day-set is wrong and they need different defences.
 *
 * IT CAN BE MALFORMED — two days on one date, a date that is not in the year it
 * was asked for, a set with no name for a day, a set nobody has said where it
 * came from. All of those are decidable, and every one of them is asserted
 * below over every set and every shipped year.
 *
 * IT CAN BE UNTRUE — the right shape, the wrong date. No suite can decide that
 * in general, because the fact lives in a statute rather than in this
 * repository. What a suite CAN do is pin the dates that are known independently
 * and would move if an algorithm or a rule were transcribed wrong, which is
 * what the anchor block does. It is a regression set and not a proof, and the
 * only real defence is the review cadence in `MAINTENANCE` — which is itself
 * asserted here, because a cadence nobody checks is a comment.
 *
 * ── THE ANCHORS ARE LITERAL DATES, WRITTEN OUT ─────────────────────────────
 *
 * Not computed, not derived from `civil.ts`, not read back out of the set. A
 * date here is a claim a reader can check against a calendar in ten seconds,
 * and that is the only kind of claim worth pinning: an anchor generated from
 * the code it is anchoring agrees with every bug the code has.
 */

import { describe, expect, it } from "vitest";

import { epochDayOf, weekdayOf } from "./civil.ts";
import {
  ANNOUNCED_ANNUALLY,
  DAY_SETS,
  MAINTENANCE,
  YEARS,
  daySetFor,
  expandSet,
} from "./daysets.ts";
import { strings } from "./i18n/strings.ts";

const EN = strings["en-US"];

describe("the pack is a pack at all", () => {
  it("ships sets, and years for them to be asked about", () => {
    // A guard on the guard: an empty pack would agree with every case below.
    expect(DAY_SETS.length).toBeGreaterThanOrEqual(5);
    expect(YEARS.length).toBeGreaterThanOrEqual(1);
  });

  it("gives every set a distinct identity", () => {
    const ids = DAY_SETS.map((set) => `${set.country}|${set.region ?? ""}`);
    expect(new Set(ids).size, `duplicate country/region: ${ids.join(", ")}`).toBe(ids.length);
  });

  it("uses an alpha-2 country code, upper case, everywhere", () => {
    for (const set of DAY_SETS) expect(set.country).toMatch(/^[A-Z]{2}$/);
    for (const entry of ANNOUNCED_ANNUALLY) expect(entry.country).toMatch(/^[A-Z]{2}$/);
  });

  it("keeps a region key lower-case and hyphenated, or absent", () => {
    for (const set of DAY_SETS) {
      if (set.region === undefined) continue;
      expect(set.region, `${set.country}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("looks a set up by country AND region, never by country alone", () => {
    // France has two sets. A lookup that treated an absent region as a wildcard
    // would hand back whichever was declared first, which is the national one
    // half the time by luck rather than by rule.
    expect(daySetFor("FR")?.days.length).toBe(11);
    expect(daySetFor("FR", "alsace-moselle")?.days.length).toBe(13);
    expect(daySetFor("FR", "no-such-area")).toBeUndefined();
    expect(daySetFor("XX")).toBeUndefined();
  });
});

describe("every set says where it came from and when it was read", () => {
  it.each(DAY_SETS.map((set) => ({ id: `${set.country}${set.region ? `/${set.region}` : ""}`, set })))(
    "$id carries a derivation and a review date",
    ({ set }) => {
      expect(set.derivation.statedIn).toBeTruthy();
      expect(epochDayOf(set.derivation.reviewedOn), "reviewedOn is not a real date").not.toBeNull();
    },
  );

  it("names a maintainer, a last review and a next one, in that order", () => {
    expect(EN[MAINTENANCE.ownerKey]).toBeTruthy();
    const last = epochDayOf(MAINTENANCE.lastReviewed);
    const next = epochDayOf(MAINTENANCE.nextReview);
    expect(last).not.toBeNull();
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(last!);
    // Annual, give or take a month either way. A cadence stated as "next year,
    // some time" is not a cadence, and one stated as "in three years" is not
    // annual — a statute changed under this pack in 2024 with no warning.
    expect(next! - last!).toBeGreaterThan(300);
    expect(next! - last!).toBeLessThan(400);
  });

  it("has read every set no earlier than the pack's own last review", () => {
    // A set carrying an older date than the pack claims is a pack whose review
    // did not reach it, which is precisely the rot this field exists to expose.
    const pack = epochDayOf(MAINTENANCE.lastReviewed)!;
    for (const set of DAY_SETS) {
      expect(epochDayOf(set.derivation.reviewedOn)!, `${set.country}`).toBeGreaterThanOrEqual(pack);
    }
  });
});

describe("every string a set names is a string that exists", () => {
  it.each(DAY_SETS.map((set) => ({ id: `${set.country}${set.region ? `/${set.region}` : ""}`, set })))(
    "$id has a label, a note and a derivation in the bundle",
    ({ set }) => {
      for (const key of [set.labelKey, set.noteKey, set.derivation.statedIn]) {
        expect(Object.keys(EN), `${key} is not in the bundle`).toContain(key);
      }
    },
  );

  it("has a label and a reason for every country it refuses to guess", () => {
    for (const entry of ANNOUNCED_ANNUALLY) {
      expect(Object.keys(EN)).toContain(entry.labelKey);
      expect(Object.keys(EN)).toContain(entry.whyKey);
      // A reason that is a phrase rather than a sentence is not a reason. The
      // whole value of this list is that it says WHY.
      expect(EN[entry.whyKey].length, entry.country).toBeGreaterThan(60);
    }
  });

  it("refuses at least the three that cannot be computed, and no country twice", () => {
    const countries = ANNOUNCED_ANNUALLY.map((entry) => entry.country);
    expect(countries).toEqual(["CN", "TW", "EG"]);
    expect(new Set(countries).size).toBe(countries.length);
  });

  it("never both ships a set for a country and refuses to guess it", () => {
    const shipped = new Set(DAY_SETS.map((set) => set.country));
    const refused = ANNOUNCED_ANNUALLY.filter((entry) => shipped.has(entry.country));
    expect(refused.map((entry) => entry.country)).toEqual([]);
  });
});

describe("every set expands cleanly, for every year the pack offers", () => {
  const CASES = DAY_SETS.flatMap((set) =>
    YEARS.map((year) => ({
      id: `${set.country}${set.region ? `/${set.region}` : ""} ${year}`,
      set,
      year,
    })),
  );

  it.each(CASES)("$id lands every day on a real date inside the year", ({ set, year }) => {
    const days = expandSet(set, year);
    expect(days.length).toBe(set.days.length);
    for (const day of days) {
      expect(epochDayOf(day.date), `${day.name} → ${day.date}`).not.toBeNull();
      expect(day.date.slice(0, 4), `${day.name} left ${year}`).toBe(String(year));
      expect(day.name.trim().length, `${day.date} has no name`).toBeGreaterThan(0);
    }
  });

  it.each(CASES)("$id puts no two days on one date", ({ set, year }) => {
    const days = expandSet(set, year);
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const day of days) {
      const already = seen.get(day.date);
      if (already !== undefined) clashes.push(`${day.date}: ${already} and ${day.name}`);
      else seen.set(day.date, day.name);
    }
    expect(clashes, `\n${clashes.join("\n")}\n`).toEqual([]);
  });

  it.each(CASES)("$id comes back sorted", ({ set, year }) => {
    const dates = expandSet(set, year).map((day) => day.date);
    expect(dates).toEqual([...dates].sort());
  });

  it.each(CASES)("$id names no day twice", ({ set, year }) => {
    const names = expandSet(set, year).map((day) => day.name);
    expect(new Set(names).size, names.join(", ")).toBe(names.length);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE ANCHORS — literal dates, from outside this repository
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * One block per set, covering the two kinds of day it carries: a fixed date
 * (which would only move if somebody edited the data) and a computed one (which
 * would move if an algorithm broke). Where a set is mostly Easter-derived, the
 * Easter-derived days are the ones pinned, because those are the ones nobody
 * can check by reading the source.
 */
describe("the anchors: dates a reader can check against a calendar", () => {
  const dayNamed = (country: string, region: string | undefined, year: number, name: string) =>
    expandSet(daySetFor(country, region)!, year).find((day) => day.name === name)?.date;

  it("United States 2026", () => {
    expect(dayNamed("US", undefined, 2026, "New Year's Day")).toBe("2026-01-01");
    expect(dayNamed("US", undefined, 2026, "Birthday of Martin Luther King, Jr.")).toBe("2026-01-19");
    expect(dayNamed("US", undefined, 2026, "Washington's Birthday")).toBe("2026-02-16");
    expect(dayNamed("US", undefined, 2026, "Memorial Day")).toBe("2026-05-25");
    expect(dayNamed("US", undefined, 2026, "Juneteenth National Independence Day")).toBe("2026-06-19");
    expect(dayNamed("US", undefined, 2026, "Independence Day")).toBe("2026-07-04");
    expect(dayNamed("US", undefined, 2026, "Labor Day")).toBe("2026-09-07");
    expect(dayNamed("US", undefined, 2026, "Columbus Day")).toBe("2026-10-12");
    expect(dayNamed("US", undefined, 2026, "Veterans Day")).toBe("2026-11-11");
    expect(dayNamed("US", undefined, 2026, "Thanksgiving Day")).toBe("2026-11-26");
    expect(dayNamed("US", undefined, 2026, "Christmas Day")).toBe("2026-12-25");
  });

  it("United States 2027 — the weekday holidays all move", () => {
    expect(dayNamed("US", undefined, 2027, "Birthday of Martin Luther King, Jr.")).toBe("2027-01-18");
    expect(dayNamed("US", undefined, 2027, "Memorial Day")).toBe("2027-05-31");
    expect(dayNamed("US", undefined, 2027, "Labor Day")).toBe("2027-09-06");
    expect(dayNamed("US", undefined, 2027, "Thanksgiving Day")).toBe("2027-11-25");
  });

  it("Germany 2026 and 2027", () => {
    expect(dayNamed("DE", undefined, 2026, "Karfreitag")).toBe("2026-04-03");
    expect(dayNamed("DE", undefined, 2026, "Ostermontag")).toBe("2026-04-06");
    expect(dayNamed("DE", undefined, 2026, "Christi Himmelfahrt")).toBe("2026-05-14");
    expect(dayNamed("DE", undefined, 2026, "Pfingstmontag")).toBe("2026-05-25");
    expect(dayNamed("DE", undefined, 2026, "Tag der Deutschen Einheit")).toBe("2026-10-03");
    expect(dayNamed("DE", undefined, 2027, "Karfreitag")).toBe("2027-03-26");
    expect(dayNamed("DE", undefined, 2027, "Christi Himmelfahrt")).toBe("2027-05-06");
    expect(dayNamed("DE", undefined, 2027, "Pfingstmontag")).toBe("2027-05-17");
  });

  it("France 2026 and 2027", () => {
    expect(dayNamed("FR", undefined, 2026, "Lundi de Pâques")).toBe("2026-04-06");
    expect(dayNamed("FR", undefined, 2026, "Ascension")).toBe("2026-05-14");
    expect(dayNamed("FR", undefined, 2026, "Lundi de Pentecôte")).toBe("2026-05-25");
    expect(dayNamed("FR", undefined, 2026, "Fête nationale")).toBe("2026-07-14");
    expect(dayNamed("FR", undefined, 2027, "Lundi de Pâques")).toBe("2027-03-29");
    expect(dayNamed("FR", undefined, 2027, "Ascension")).toBe("2027-05-06");
  });

  it("Alsace-Moselle is the national set plus exactly two days", () => {
    const national = expandSet(daySetFor("FR")!, 2026).map((day) => day.date);
    const local = expandSet(daySetFor("FR", "alsace-moselle")!, 2026).map((day) => day.date);
    expect(local.length - national.length).toBe(2);
    for (const date of national) expect(local).toContain(date);
    expect(dayNamed("FR", "alsace-moselle", 2026, "Vendredi saint")).toBe("2026-04-03");
    expect(dayNamed("FR", "alsace-moselle", 2026, "Saint Étienne")).toBe("2026-12-26");
  });

  it("Czechia 2026", () => {
    expect(dayNamed("CZ", undefined, 2026, "Velký pátek")).toBe("2026-04-03");
    expect(dayNamed("CZ", undefined, 2026, "Velikonoční pondělí")).toBe("2026-04-06");
    expect(dayNamed("CZ", undefined, 2026, "Den slovanských věrozvěstů Cyrila a Metoděje")).toBe("2026-07-05");
    expect(dayNamed("CZ", undefined, 2026, "Den upálení mistra Jana Husa")).toBe("2026-07-06");
    expect(dayNamed("CZ", undefined, 2026, "Den boje za svobodu a demokracii")).toBe("2026-11-17");
    expect(dayNamed("CZ", undefined, 2026, "Štědrý den")).toBe("2026-12-24");
  });

  it("Denmark 2026, and Great Prayer Day is absent", () => {
    expect(dayNamed("DK", undefined, 2026, "Skærtorsdag")).toBe("2026-04-02");
    expect(dayNamed("DK", undefined, 2026, "Langfredag")).toBe("2026-04-03");
    expect(dayNamed("DK", undefined, 2026, "Påskedag")).toBe("2026-04-05");
    expect(dayNamed("DK", undefined, 2026, "Anden påskedag")).toBe("2026-04-06");
    expect(dayNamed("DK", undefined, 2026, "Kristi himmelfartsdag")).toBe("2026-05-14");
    expect(dayNamed("DK", undefined, 2026, "Pinsedag")).toBe("2026-05-24");
    expect(dayNamed("DK", undefined, 2026, "Anden pinsedag")).toBe("2026-05-25");
    /*
     * STORE BEDEDAG WAS THE FOURTH FRIDAY AFTER EASTER — 2026-05-01 — and it is
     * not in this set because it stopped being a public holiday in 2024. This
     * is the one absence in the whole pack worth a test of its own: a set built
     * from a source published before 2023 carries it, and nothing about the
     * resulting calendar would look wrong.
     */
    const danish = expandSet(daySetFor("DK")!, 2026);
    expect(danish.map((day) => day.date)).not.toContain("2026-05-01");
    expect(danish.map((day) => day.name).join(" ")).not.toContain("bededag");
  });

  it("puts every Easter-derived day on the weekday its name says", () => {
    /*
     * A NAME THAT CONTRADICTS ITS DATE, in four languages. Good Friday is a
     * Friday and Easter Monday is a Monday in every country that has them, so
     * an offset transcribed wrong shows up here even when the date itself looks
     * plausible — which is the failure mode a list of dates cannot show.
     */
    const MUST_BE: readonly [string, number][] = [
      ["Karfreitag", 5],
      ["Langfredag", 5],
      ["Velký pátek", 5],
      ["Vendredi saint", 5],
      ["Skærtorsdag", 4],
      ["Christi Himmelfahrt", 4],
      ["Kristi himmelfartsdag", 4],
      ["Ascension", 4],
      ["Ostermontag", 1],
      ["Velikonoční pondělí", 1],
      ["Lundi de Pâques", 1],
      ["Anden påskedag", 1],
      ["Pfingstmontag", 1],
      ["Lundi de Pentecôte", 1],
      ["Anden pinsedag", 1],
      ["Påskedag", 0],
      ["Pinsedag", 0],
    ];
    const wrong: string[] = [];
    for (const set of DAY_SETS) {
      for (const year of YEARS) {
        for (const day of expandSet(set, year)) {
          const rule = MUST_BE.find(([name]) => name === day.name);
          if (rule === undefined) continue;
          const weekday = weekdayOf(epochDayOf(day.date)!);
          if (weekday !== rule[1]) wrong.push(`${day.name} ${day.date} is weekday ${weekday}`);
        }
      }
    }
    // …and the table has to have MATCHED something, or a renamed day would make
    // this case pass by covering nothing.
    expect(wrong).toEqual([]);
    const covered = DAY_SETS.flatMap((set) => expandSet(set, YEARS[0]!)).filter((day) =>
      MUST_BE.some(([name]) => name === day.name),
    );
    expect(covered.length).toBeGreaterThan(15);
  });
});
