/**
 * THE STRING BUNDLE: COMPLETE, ACTUALLY TRANSLATED, AND CLEAN IN ALL EIGHT.
 *
 * ── WHY THIS FILE DID NOT EXIST ─────────────────────────────────────────────
 *
 * It is the only add-on in the wave that shipped no `i18n/strings.test.ts` at
 * all. Its bundle was in fact clean — a verifier read all four and found no
 * missing key and no accidental English — so nothing was broken. That is not
 * the same as being guarded, and the difference is the whole point of this
 * round: what was true of these strings on the day somebody looked is not a
 * property anybody can rely on tomorrow.
 *
 * The parity half was partly covered by `sources.test.ts` ("all eight locales
 * carry all the keys"). The half that catches real work was not covered
 * anywhere, and it is the one Design Studio needed three rounds to acquire:
 *
 *   EIGHT COPIES OF THE ENGLISH BUNDLE PASSES A KEY CHECK PERFECTLY.
 *
 * So the case below asserts that every locale's value DIFFERS from English,
 * with a short list of the strings that genuinely are the same, each with the
 * reason it is. Anything identical and undeclared is an untranslated string.
 *
 * The vocabulary tables come from `testing/lexicon.ts`, which `dist.test.ts`
 * also uses over built output, so the source check and the artefact check
 * cannot drift apart.
 */

import { describe, expect, it } from "vitest";

import { bannedSubstringsIn, TIERING_WORDS } from "../testing/lexicon.ts";
import { LOCALE_TAGS, NOT_A_QUANTITY, strings, type StringKey } from "./strings.ts";

const EN = strings["en-US"];
const EN_KEYS = Object.keys(EN).sort();
const valueOf = (tag: (typeof LOCALE_TAGS)[number], key: string): string =>
  (strings[tag] as Record<string, string>)[key] ?? "";

/**
 * The keys a locale is allowed to spell exactly as English spells them.
 *
 * Each entry names the key, the locales it covers, and why the words are the
 * same. THIS IS THE COMPLETE LIST — anything else identical to English is an
 * untranslated string, and the case below says so.
 *
 * Every entry here is one of two shapes, and neither is a word:
 *
 *   A TEMPLATE WITH NO WORDS IN IT. `{quantity} × {what}` is two placeholders
 *   and a multiplication sign; there is nothing to translate, and the values
 *   substituted into it are formatted per locale where that belongs.
 *
 *   AN SI SYMBOL. `kg` is the same three characters in every language that
 *   uses the metric system — SI is explicit that unit symbols do not translate,
 *   and Chinese and Arabic, which spell the unit out, are not on this list.
 */
const SHARED_WITH_ENGLISH: readonly {
  key: StringKey;
  locales: readonly (typeof LOCALE_TAGS)[number][];
  why: string;
}[] = [
  {
    key: "addon.shipping-dhl.parcel.contentsValue",
    locales: ["de-DE", "fr-FR", "cs-CZ", "da-DK", "zh-CN", "zh-TW", "ar-EG"],
    why: "Two placeholders and a multiplication sign. There is no word in it to translate, and the count substituted into it is formatted in the reader's own numerals at render time, which is where that belongs.",
  },
  {
    key: "addon.shipping-dhl.set.weightKg",
    locales: ["de-DE", "fr-FR", "cs-CZ", "da-DK"],
    why: "`kg` is the SI symbol for the kilogram, identical in every language that uses the metric system; translating a unit symbol makes it wrong rather than local. Chinese and Arabic spell the unit out and are not on this list.",
  },
  {
    key: "addon.shipping-dhl.parcel.dims",
    locales: ["fr-FR"],
    why: "French `Dimensions` is the ordinary plural noun, spelt exactly as English spells it — English borrowed the word from French. German writes `Maße` and Danish `Mål`, so neither is on this list.",
  },
  {
    key: "addon.shipping-dhl.booked.service",
    locales: ["fr-FR", "da-DK"],
    why: "French and Danish both write `Service` for the level of carriage bought, spelt as English spells it. German writes `Leistung` and Czech `Služba`, so neither is on this list.",
  },
];

describe("all eight locales, complete", () => {
  it("carries exactly the same keys in every locale", () => {
    // A guard that read no keys would pass everything below it.
    expect(EN_KEYS.length).toBeGreaterThan(50);
    for (const tag of LOCALE_TAGS) {
      expect(Object.keys(strings[tag]).sort(), tag).toEqual(EN_KEYS);
    }
  });

  it("has no empty string anywhere", () => {
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(valueOf(tag, key).trim().length, `${tag} · ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every placeholder English uses, in every locale", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(placeholders(valueOf(tag, key)), `${tag} · ${key}`).toEqual(
          placeholders(valueOf("en-US", key)),
        );
      }
    }
  });

  it("namespaces every key under this add-on, so nothing shadows the host", () => {
    expect(EN_KEYS.filter((key) => !key.startsWith("addon.shipping-dhl."))).toEqual([]);
  });

  /**
   * THE ONE THAT CATCHES A SHORTCUT, and the reason this file exists.
   */
  it("is actually translated — nothing but the declared shared words matches English", () => {
    const excused = new Map(
      SHARED_WITH_ENGLISH.map((entry) => [entry.key as string, new Set(entry.locales)]),
    );
    const untranslated: string[] = [];
    for (const tag of LOCALE_TAGS) {
      if (tag === "en-US") continue;
      for (const key of EN_KEYS) {
        if (valueOf(tag, key) !== valueOf("en-US", key)) continue;
        if (excused.get(key)?.has(tag) === true) continue;
        untranslated.push(`${tag} · ${key} = “${valueOf(tag, key)}”`);
      }
    }
    expect(untranslated, `\n${untranslated.join("\n")}\n`).toEqual([]);
  });

  /**
   * AND THE LIST ITSELF IS CHECKED, IN BOTH DIRECTIONS.
   *
   * An entry excusing a pair that is NOT identical is a stale entry — written
   * for a string somebody has since translated, and quietly ready to excuse
   * that key again if the translation were ever reverted. An exemption nobody
   * can see expiring is how a list of four becomes a list of forty.
   */
  it("keeps the shared-word list short, reasoned, and free of stale entries", () => {
    expect(SHARED_WITH_ENGLISH.length).toBeLessThanOrEqual(8);
    for (const entry of SHARED_WITH_ENGLISH) {
      expect(EN_KEYS, `${entry.key} is not a key`).toContain(entry.key as string);
      expect(entry.why.length, `${entry.key} has no reason`).toBeGreaterThan(40);
      for (const tag of entry.locales) {
        expect(
          valueOf(tag, entry.key),
          `${tag} · ${entry.key} is excused but is no longer identical to English`,
        ).toBe(valueOf("en-US", entry.key));
      }
    }
  });
});

describe("the vocabulary ban, over the source bundle (17 §2, 24 D10)", () => {
  it("finds no banned substring in any locale", () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        for (const hit of bannedSubstringsIn(valueOf(tag, key))) {
          offences.push(`${tag} · ${key} · “${hit}”`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * The per-locale half. None of these carries an English banned run, so
   * nothing but a table per language could ever catch a paid-grade word in
   * German, Czech, Chinese or Arabic.
   */
  it("advertises no grade of itself, in the letters each language would use", () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        for (const pattern of TIERING_WORDS[tag]) {
          if (pattern.test(valueOf(tag, key))) offences.push(`${tag} · ${key} · ${pattern}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

/**
 * THE ALLOWANCES THAT TRAVEL WITH THESE STRINGS (24 AC20/D21).
 *
 * Every add-on exports `NOT_A_QUANTITY` and every host reads it off whatever it
 * has vendored — see the block above the export. This bundle declares none,
 * which is a claim worth asserting rather than a gap: it says every Latin digit
 * these strings can put on an Arabic page is a figure this add-on worked out
 * and must therefore be formatted.
 */
describe("the allowances travel with the strings", () => {
  it("declares no Latin figure of its own, and says so explicitly", () => {
    expect(NOT_A_QUANTITY).toEqual([]);
  });

  it("carries every reason if one is ever added", () => {
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });
});
