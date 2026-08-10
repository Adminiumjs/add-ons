import { describe, expect, it } from "vitest";

import { importCanvaStrings } from "./strings.ts";
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

  /**
   * D12's second half: never present this add-on as the paid-up version of a
   * lesser one. The ban is on the IDEA, so each language is checked against its
   * own marketing words rather than the English ones transliterated.
   *
   * Czech is why this is a per-locale table instead of one regex: `pro` is the
   * Czech preposition "for" and appears in ordinary sentences. Banning it there
   * would be banning a function word, so Czech is checked for `prémiový` and
   * `profesionální`, which are what a violation would actually look like.
   */
  const TIERING_WORDS: Record<string, RegExp[]> = {
    "en-US": [/\bpro\b/i, /premium/i],
    "de-DE": [/\bprofi/i, /premium/i],
    "fr-FR": [/\bpro\b/i, /premium/i],
    "cs-CZ": [/prémiov/i, /profesionál/i],
    "da-DK": [/\bpro\b/i, /premium/i],
    "zh-CN": [/高级版/, /专业版/],
    "zh-TW": [/高級版/, /專業版/],
    "ar-EG": [/احترافي/, /مميز/],
  };

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
