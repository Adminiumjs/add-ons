/**
 * WHICH SET THE PICKER STARTS ON: THE SHOP'S OWN COUNTRY.
 *
 * A shop in Leeds that opens the picker on the United States has to find its
 * own country before it can check a single day, and an operator in a hurry
 * imports what is on the screen. So the picker starts where the shop is, as
 * far as the panel can tell. The host hands the panel nothing about where the
 * shop is (`SettingsPanelPayload` is the settings, `patch` and samples), so it
 * reads, in order:
 *
 *   1. the set the shop already took: the newest year it imported, which is
 *      the best word there is, the shop's own;
 *   2. the browser's time zone, which is where the person setting up is
 *      (`Europe/London` is Great Britain; a zone with no set here says
 *      nothing);
 *   3. the region of the browser's language (`da-DK`), which is weaker:
 *      plenty of browsers say `en-US` wherever they are;
 *   4. the first set, as before.
 *
 * A country with more than one set starts on its national one; Great Britain
 * has only England and Wales, so that is where it starts.
 */
import type { StoredDay } from "./calendar.ts";
import { DAY_SETS, daySetFor, type DaySet } from "./daysets.ts";

/** What the browser says of where it is. */
export interface Home {
  readonly zone?: string;
  readonly language?: string;
}

/** The time zones of the countries a set here covers. */
const ZONES: Readonly<Record<string, string>> = {
  "Europe/London": "GB",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
  "Europe/Paris": "FR",
  "Europe/Prague": "CZ",
  "Europe/Copenhagen": "DK",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Juneau": "US",
  "America/Sitka": "US",
  "America/Nome": "US",
  "America/Yakutat": "US",
  "America/Metlakatla": "US",
  "America/Adak": "US",
  "America/Boise": "US",
  "America/Detroit": "US",
  "America/Menominee": "US",
  "Pacific/Honolulu": "US",
  // Older names some browsers still report.
  "America/Indianapolis": "US",
  "America/Fort_Wayne": "US",
  "America/Louisville": "US",
  "Europe/Belfast": "GB",
};
/** The United States' zones named by state as well as city. */
const US_ZONE_PREFIXES = ["America/Indiana/", "America/Kentucky/", "America/North_Dakota/"];

const countryOfZone = (zone: string): string | undefined => ZONES[zone] ?? (US_ZONE_PREFIXES.some((prefix) => zone.startsWith(prefix)) ? "US" : undefined);

/** A country's set: its national one, or its only one. */
function setOf(country: string): DaySet | undefined {
  return daySetFor(country) ?? DAY_SETS.find((set) => set.country === country);
}

/** The set the picker starts on: the one the shop took, else its country's, else the first. */
export function startingSet(held: readonly StoredDay[], home: Home): DaySet {
  const taken = held
    .map((day) => day.from)
    .filter((from) => from !== undefined)
    .sort((a, b) => b.year - a.year)
    .map((from) => daySetFor(from.country, from.region))
    .find((set) => set !== undefined);
  if (taken !== undefined) return taken;
  const zoned = home.zone === undefined ? undefined : countryOfZone(home.zone);
  const byZone = zoned === undefined ? undefined : setOf(zoned);
  if (byZone !== undefined) return byZone;
  const region = home.language?.split("-").slice(1).find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  const byLanguage = region === undefined ? undefined : setOf(region);
  return byLanguage ?? DAY_SETS[0]!;
}

/** Where this browser is, as far as it says. */
export function homeOf(): Home {
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  const language = typeof navigator === "undefined" ? undefined : navigator.language;
  return { ...(zone === undefined ? {} : { zone }), ...(language === undefined ? {} : { language }) };
}
