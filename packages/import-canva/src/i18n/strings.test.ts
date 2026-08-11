import { describe, expect, it } from "vitest";

import { TIERING_WORDS } from "@adminium/add-on-host/testing";
import { importCanvaStrings, NOT_A_QUANTITY } from "./strings.ts";
import { LOCALE_TAGS, makeT, resolveLocale } from "./t.ts";

const EN = importCanvaStrings["en-US"];
const KEYS = Object.keys(EN) as (keyof typeof EN)[];

describe("parity", () => {
  it("carries every key in all eight locales", () => {
    for (const locale of LOCALE_TAGS) {
      const bundle = importCanvaStrings[locale] as Record<string, string>;
      expect(Object.keys(bundle).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) expect(bundle[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps every placeholder the English carries", () => {
    const placeholders = (s: string): string[] =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

    for (const locale of LOCALE_TAGS) {
      const bundle = importCanvaStrings[locale] as Record<string, string>;
      for (const key of KEYS) {
        // A translation that drops `{needW}` renders a sentence with a hole
        // where the number a customer has to act on should have been.
        expect(placeholders(bundle[key]), `${locale} ${key}`).toEqual(
          placeholders(EN[key]),
        );
      }
    }
  });

  it("namespaces every key under this add-on, so nothing shadows the host", () => {
    for (const key of KEYS) expect(key).toMatch(/^addon\.import-canva\./);
  });

  /**
   * THE CASE THIS FILE WAS MISSING, and the one that catches real work.
   *
   * EIGHT COPIES OF THE ENGLISH BUNDLE PASSES A KEY CHECK PERFECTLY. Parity is
   * easy to satisfy and easy to satisfy dishonestly, and a locale left in
   * English is invisible to every other assertion above: the keys are all
   * there, the placeholders all match, nothing is blank.
   *
   * Design Studio needed three rounds to grow this case and found a real
   * untranslated string when it did (`layout.roll-up`, verbatim English in
   * Czech). The personalizer has it. This bundle did not, and for a while it
   * had NOTHING to declare: not one value in any of the seven other locales was
   * spelt as English spells it.
   *
   * The list is therefore an assertion rather than an oversight, and it is the
   * strictest state this rule has: a value that matches English has to be
   * argued for HERE, in a list a reader can disagree with, rather than passing
   * quietly. `dims` is the first entry it has ever needed.
   */
  const SHARED_WITH_ENGLISH: readonly {
    key: keyof typeof EN;
    locales: readonly (typeof LOCALE_TAGS)[number][];
    why: string;
  }[] = [
    {
      key: "addon.import-canva.dims",
      locales: ["de-DE", "fr-FR", "cs-CZ", "da-DK"],
      why:
        "`mm` is the SI symbol for the millimetre, and German, French, Czech and Danish all " +
        "write it exactly as English does — this bundle's own bleed and redo strings already " +
        "spell it `mm` in those four. Chinese (毫米/公釐) and Arabic (مم) do not, and their " +
        "values differ accordingly, which is the whole reason the chip goes through the bundle.",
    },
  ];

  it("is actually translated — nothing but the declared shared words matches English", () => {
    const excused = new Map(
      SHARED_WITH_ENGLISH.map((entry) => [entry.key as string, new Set(entry.locales)]),
    );
    const untranslated: string[] = [];
    for (const locale of LOCALE_TAGS) {
      if (locale === "en-US") continue;
      const bundle = importCanvaStrings[locale] as Record<string, string>;
      for (const key of KEYS) {
        if (bundle[key] !== EN[key]) continue;
        if (excused.get(key as string)?.has(locale) === true) continue;
        untranslated.push(`${locale} · ${String(key)} = “${bundle[key]}”`);
      }
    }
    expect(untranslated, `\n${untranslated.join("\n")}\n`).toEqual([]);
  });

  it("keeps the shared-word list short, reasoned, and free of stale entries", () => {
    // Empty today. Each of the three checks below is what a future entry must
    // survive, so the list cannot grow into a place to hide an untranslated
    // string: it has to name a real key, carry a real reason, and still be
    // identical to English on the day it is read.
    expect(SHARED_WITH_ENGLISH.length).toBeLessThanOrEqual(8);
    for (const entry of SHARED_WITH_ENGLISH) {
      expect([...KEYS] as string[], `${String(entry.key)} is not a key`).toContain(
        entry.key as string,
      );
      expect(entry.why.length, `${String(entry.key)} has no reason`).toBeGreaterThan(40);
      for (const locale of entry.locales) {
        expect(
          (importCanvaStrings[locale] as Record<string, string>)[entry.key as string],
          `${locale} · ${String(entry.key)} is excused but is no longer identical to English`,
        ).toBe(EN[entry.key]);
      }
    }
  });
});

/**
 * THE ALLOWANCES THAT TRAVEL WITH THESE STRINGS (24 AC20/D21).
 *
 * Every add-on exports `NOT_A_QUANTITY` and every host reads it off whatever it
 * has vendored — see the block above the export in `strings.ts`. This bundle
 * declares none, which is a claim rather than a gap: every Latin digit these
 * strings can put on an Arabic page is a figure this add-on worked out, and
 * must therefore be formatted.
 */
describe("the allowances travel with the strings", () => {
  it("declares no Latin figure of its own, and says so explicitly", () => {
    expect(NOT_A_QUANTITY).toEqual([]);
  });

  it("carries every reason if one is ever added", () => {
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });
});

/**
 * THE TRANSLATOR NOTE LIVES HERE, not in `strings.ts`.
 *
 * `strings.ts` ships: Vite's library build keeps its comments, so a note in
 * that file explaining which runs are banned would put every banned run into
 * `dist/client.js`, where the release sweep greps. This file is never bundled,
 * so it is the only place the runs may be written out. `built-output.test.ts`
 * is the check that keeps it that way.
 *
 * The list, for whoever translates next:
 *
 *   pricing · plan · tier · billing · upgrade · free · premium · pro · "/mo"
 *
 * banned as CASE-INSENSITIVE SUBSTRINGS, not as words, because that is how the
 * release grep reads built output. The traps that catch people out are the
 * ordinary words that contain one in the middle:
 *
 *   de-DE  every borrowed verb's "-ieren" ending ("importieren"), and
 *          "Kursplan"/"Zeitplan" for a schedule
 *   da-DK  "plan" is the ordinary Danish noun for a schedule
 *   fr-FR  "entier" (whole), "métier" (trade), "quartier" (district)
 *   en-US  "explanation", "frontier", "proof" is fine but "pro" alone is not
 *
 * Where a language's natural term carries one, use the plainer phrase a print
 * works would actually say to a customer.
 */
describe("the vocabulary ban (17 §2, 24 D10), in all eight locales", () => {
  const BANNED = ["pricing", "plan", "tier", "billing", "upgrade", "free", "premium"];

  it("says none of the seven banned runs anywhere, as substrings", () => {
    const offences: string[] = [];
    for (const locale of LOCALE_TAGS) {
      const bundle = importCanvaStrings[locale] as Record<string, string>;
      for (const key of KEYS) {
        const lower = bundle[key].toLowerCase();
        for (const run of BANNED) {
          if (lower.includes(run)) offences.push(`${locale} ${key}: "${bundle[key]}" has "${run}"`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /*
   * THE TIERING TABLE IS NOT WRITTEN OUT HERE, and used to be — inline, in a
   * test, as one of six divergent copies of a one-word-per-language list that a
   * verifier proved blind. See `@adminium/add-on-host/testing`'s `tiering.ts`:
   * the ban is on a set of IDEAS, each spelt in each of the eight languages,
   * and the table is total over both so a cell cannot be forgotten.
   */

  it.each(LOCALE_TAGS)("%s never presents this add-on as the paid-up one", (locale) => {
    const patterns = TIERING_WORDS[locale]!;
    const bundle = importCanvaStrings[locale] as Record<string, string>;
    const offences = KEYS.filter((key) => patterns.some((re) => re.test(bundle[key])));
    expect(offences).toEqual([]);
  });

  it("has no link path containing the two characters after a slash that read as a month", () => {
    for (const locale of LOCALE_TAGS) {
      const bundle = importCanvaStrings[locale] as Record<string, string>;
      for (const key of KEYS) expect(bundle[key].includes("/mo"), `${locale} ${key}`).toBe(false);
    }
  });

  it("carries the not-affiliated line in every locale (24 D12)", () => {
    for (const locale of LOCALE_TAGS) {
      const line = importCanvaStrings[locale]["addon.import-canva.notAffiliated"];
      expect(line).toContain("Adminium");
    }
  });
});

describe("locale resolution", () => {
  it("matches exact tags, then language, then falls back to English", () => {
    expect(resolveLocale("de-DE")).toBe("de-DE");
    expect(resolveLocale("de-AT")).toBe("de-DE");
    expect(resolveLocale("pt-BR")).toBe("en-US");
    expect(resolveLocale(null)).toBe("en-US");
  });

  it("never lets the two Chinese scripts fall through to each other", () => {
    expect(resolveLocale("zh")).toBe("zh-CN");
    expect(resolveLocale("zh-Hans")).toBe("zh-CN");
    expect(resolveLocale("zh-Hant")).toBe("zh-TW");
    expect(resolveLocale("zh-HK")).toBe("zh-TW");
  });
});

describe("t", () => {
  it("substitutes every number a remedy renders", () => {
    const t = makeT("en-US");
    expect(t("fix.scale.title", { pct: 10.9 })).toBe("Scale it up 10.9% so it bleeds");
    expect(t("fix.scale.body", { w: 94.3, mm: 1.6, safe: 4 })).toContain("94.3mm wide");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(makeT("en-US")("pick.edited", {})).toBe("edited {date}");
  });

  it("translates rather than falling back", () => {
    expect(makeT("ar-EG")("import.use")).toBe("استخدم هذا التصميم");
    expect(makeT("cs-CZ")("import.use")).toBe("Použít tento návrh");
  });
});
