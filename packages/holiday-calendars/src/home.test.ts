import { describe, expect, it } from "vitest";

import type { StoredDay } from "./calendar.ts";
import { DAY_SETS, daySetFor } from "./daysets.ts";
import { startingSet } from "./home.ts";

const key = (set: { country: string; region?: string }): string => `${set.country}|${set.region ?? ""}`;
const taken = (country: string, year: number, region?: string): StoredDay => ({ date: `${String(year)}-01-01`, name: "New Year", from: { country, year, ...(region === undefined ? {} : { region }) } });

describe("the set the picker starts on (Holiday Calendars G3)", () => {
  it("is the shop's own country by the browser's time zone: a shop in London starts on England and Wales", () => {
    expect(key(startingSet([], { zone: "Europe/London", language: "en-US" }))).toBe("GB|england-and-wales");
    expect(key(startingSet([], { zone: "Europe/Copenhagen" }))).toBe("DK|");
    expect(key(startingSet([], { zone: "America/Indiana/Indianapolis" }))).toBe("US|");
    expect(key(startingSet([], { zone: "America/Louisville", language: "en-GB" }))).toBe("US|");
  });

  it("starts a country of more than one set on its national one", () => {
    expect(key(startingSet([], { zone: "Europe/Paris" }))).toBe("FR|");
  });

  it("is the set the shop already took, the newest year first, over anything the browser says", () => {
    expect(key(startingSet([taken("DE", 2026), taken("FR", 2027, "alsace-moselle")], { zone: "Europe/London" }))).toBe("FR|alsace-moselle");
    // A day somebody wrote in says nothing of a country.
    expect(key(startingSet([{ date: "2026-03-02", name: "Stocktake" }], { zone: "Europe/Prague" }))).toBe("CZ|");
  });

  it("falls back to the region of the browser's language, then to the first set", () => {
    expect(key(startingSet([], { zone: "UTC", language: "da-DK" }))).toBe("DK|");
    expect(key(startingSet([], { zone: "Asia/Tokyo", language: "ja-JP" }))).toBe(key(DAY_SETS[0]!));
    expect(key(startingSet([], {}))).toBe(key(DAY_SETS[0]!));
  });

  it("ignores a set this version no longer carries", () => {
    expect(daySetFor("XX")).toBeUndefined();
    expect(key(startingSet([taken("XX", 2030)], { zone: "Europe/Berlin" }))).toBe("DE|");
  });
});
