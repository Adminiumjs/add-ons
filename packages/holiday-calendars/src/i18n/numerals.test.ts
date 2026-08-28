/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts`. An add-on cannot use the
 * host's `t` — D7 does not allow the runtime dependency — so every add-on has a
 * seam of its own and therefore had its own copy of the same defect sitting in
 * it. Three of the four in this repository shipped it.
 *
 * The key this suite substitutes into is `pick.preview`, which is the count of
 * days in a set: the one number this add-on renders that is genuinely a
 * quantity. The other number on the panel is a YEAR, and it deliberately does
 * NOT go through this path — `yearLabel` formats it with grouping off and hands
 * `translate` a string, because `Intl.NumberFormat` would otherwise render 2026
 * as "2,026". That is checked below, in this package's own case, because the
 * shared suite is about the seam and this is about the one value that must go
 * round it.
 */

import { describeNumerals } from "@adminium/add-on-host/testing";
import { describe, expect, it } from "vitest";

import { strings } from "./strings.ts";
import { translate, yearLabel } from "./t.ts";

describeNumerals({
  name: "holiday-calendars",
  arabic: strings["ar-EG"],
  substitute: (value) =>
    translate("ar-EG", "addon.holiday-calendars.pick.preview", { count: value }),
});

describe("a year is an ordinal label, not a quantity", () => {
  it("carries no thousands separator, in any locale", () => {
    // "2,026" and "2 026" and "2.026" are all what a NUMBER formatter does to a
    // year, and all three read as a count of something.
    for (const locale of ["en-US", "de-DE", "fr-FR", "cs-CZ", "da-DK"] as const) {
      const rendered = yearLabel(locale, 2026);
      expect(rendered, locale).toBe(
        new Intl.NumberFormat(locale, { useGrouping: false }).format(2026),
      );
      expect(rendered.replace(/\d/g, "").trim(), `${locale} grouped the year`).toBe("");
    }
  });

  it("still reaches an Arabic reader in Arabic-Indic digits", () => {
    const rendered = yearLabel("ar-EG", 2026);
    expect(/[٠-٩]/.test(rendered)).toBe(true);
    expect(/[0-9]/.test(rendered)).toBe(false);
  });

  it("passes through the message seam untouched, because it arrives as a string", () => {
    // `translate` formats NUMBERS and leaves STRINGS alone. That is what lets a
    // caller with its own formatter — this one — win.
    const inline = translate("ar-EG", "addon.holiday-calendars.pick.preview", {
      count: yearLabel("ar-EG", 2026),
    });
    expect(inline).toContain(yearLabel("ar-EG", 2026));
  });
});
