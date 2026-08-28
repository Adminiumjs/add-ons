/**
 * THE STRING BUNDLE: COMPLETE, ACTUALLY TRANSLATED, AND CLEAN IN ALL EIGHT.
 *
 * ── THE CASE THAT EARNS THIS FILE ───────────────────────────────────────────
 *
 * Parity is the easy half and is already a compile error at the foot of
 * `strings.ts`. The half that catches real work is the one Design Studio needed
 * three rounds to acquire:
 *
 *   EIGHT COPIES OF THE ENGLISH BUNDLE PASSES A KEY CHECK PERFECTLY.
 *
 * So every locale's value has to DIFFER from English, with a short declared
 * list of the strings that genuinely are the same and a sentence each saying
 * why. Anything identical and undeclared is an untranslated string.
 *
 * ── AND ONE CHECK THAT IS THIS ADD-ON'S OWN ─────────────────────────────────
 *
 * Six of these keys are the sentence under a day-set preview saying WHAT THE
 * SET LEAVES OUT — that the American set is federal only, that ten German
 * states add days it does not carry, that Store Bededag was abolished. Those
 * clauses are the difference between a limit a reader can work around and a
 * false claim of completeness, and they are exactly the sort of thing a
 * translator trims because it reads like an apology. `strings.ts` says in its
 * header that they must survive; this is where that is checked, by insisting
 * every note is a real sentence in every language rather than a label.
 */

import { describe, expect, it } from "vitest";

import { ANNOUNCED_ANNUALLY, DAY_SETS } from "../daysets.ts";
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
 * Every entry here is a NAME rather than a sentence — five place names and one
 * one-word field label — and that is the one category of value where sameness
 * is correct rather than lazy. The case below enforces it as a word count, so
 * the rule stays the rule when the next entry is not a country.
 */
const SHARED_WITH_ENGLISH: readonly {
  key: StringKey;
  locales: readonly (typeof LOCALE_TAGS)[number][];
  why: string;
}[] = [
  {
    key: "addon.holiday-calendars.area.fr",
    locales: ["fr-FR"],
    why: "The French for France is France. A country's name in its own language is not a translation of the English word for it — it is the same word, and English borrowed it.",
  },
  {
    key: "addon.holiday-calendars.area.fr-alsace-moselle",
    locales: ["fr-FR"],
    why: "France, and a French region spelt as French spells it. Alsace-Moselle has no English form; inventing one so this line differed would make the label worse rather than more local.",
  },
  {
    key: "addon.holiday-calendars.area.cn",
    locales: ["de-DE"],
    why: "German writes China exactly as English does. French writes Chine, Czech Čína and Danish Kina, so none of those is on this list.",
  },
  {
    key: "addon.holiday-calendars.area.tw",
    locales: ["de-DE", "da-DK"],
    why: "German and Danish both write Taiwan as English does. French writes Taïwan with a diaeresis and Czech Tchaj-wan, so neither is on this list.",
  },
  {
    key: "addon.holiday-calendars.area.eg",
    locales: ["cs-CZ"],
    why: "Czech writes Egypt exactly as English does. German writes Ägypten, French Égypte and Danish Egypten, so none of those is on this list.",
  },
  {
    key: "addon.holiday-calendars.own.date",
    locales: ["fr-FR"],
    why: "The French for a calendar date is date, which is where English got the word. German writes Datum, Czech and Danish both Datum, so none of those is on this list — and this is a field label of one word, not a sentence.",
  },
];

describe("all eight locales, complete", () => {
  it("carries exactly the same keys in every locale", () => {
    // A guard that read no keys would pass everything below it.
    expect(EN_KEYS.length).toBeGreaterThan(40);
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
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(placeholders(valueOf(tag, key)), `${tag} · ${key}`).toEqual(
          placeholders(valueOf("en-US", key)),
        );
      }
    }
  });

  it("namespaces every key under this add-on, so nothing shadows the host", () => {
    expect(EN_KEYS.filter((key) => !key.startsWith("addon.holiday-calendars."))).toEqual([]);
  });

  /** THE ONE THAT CATCHES A SHORTCUT, and the reason this file exists. */
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
   * that key again if the translation were reverted. An exemption nobody can
   * see expiring is how a list of five becomes a list of forty.
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

  /**
   * ── THE RULE THE LIST IS WRITTEN UNDER, MADE MECHANICAL ───────────────────
   *
   * This case first read "every excused key is an area label", which is what
   * was true of the five entries its author had in front of them and is not the
   * rule. The sixth is `own.date`, a one-word field label that French spells as
   * English spells it, and there is nothing wrong with it — narrowing the rule
   * to the examples would have forced either a bad exemption or a worse French
   * word for a date.
   *
   * The rule is about the SHAPE OF THE VALUE, not about the key: a NAME can
   * honestly be the same in two languages, and a SENTENCE cannot. An excused
   * sentence is an untranslated sentence with a paragraph in front of it, which
   * is exactly what this whole file exists to catch — so the ceiling is three
   * words, which fits `France — Alsace-Moselle` and fits nothing that could be
   * mistaken for copy.
   */
  it("excuses only names, never a sentence", () => {
    for (const entry of SHARED_WITH_ENGLISH) {
      const words = valueOf("en-US", entry.key).split(/\s+/).filter(Boolean);
      expect(words.length, `${entry.key} is ${words.length} words, which is copy`).toBeLessThanOrEqual(3);
    }
  });
});

/**
 * ── WHAT EACH SET LEAVES OUT HAS TO SURVIVE TRANSLATION ────────────────────
 *
 * See this file's header. These are the sentences that keep a partial set from
 * reading as a complete one, and they are the ones most likely to be shortened.
 */
describe("every set's limits are stated in every language", () => {
  const NOTE_KEYS = DAY_SETS.map((set) => set.noteKey);
  const FROM_KEYS = DAY_SETS.map((set) => set.derivation.statedIn);
  const WHY_KEYS = ANNOUNCED_ANNUALLY.map((entry) => entry.whyKey);

  it("found the keys to check", () => {
    expect(NOTE_KEYS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(NOTE_KEYS).size).toBe(NOTE_KEYS.length);
    expect(new Set(FROM_KEYS).size).toBe(FROM_KEYS.length);
    expect(WHY_KEYS.length).toBe(3);
  });

  /**
   * ── A CHARACTER COUNT IS NOT A LENGTH, AND THIS CHECK LEARNED IT ──────────
   *
   * The first version of these three cases was a flat floor: a note had to be
   * over 45 characters, a derivation over 30. Both Chinese bundles failed
   * immediately, and the copy was not the problem — 十一个联邦假日 carries the same
   * six English words in seven characters. A flat floor asks "is this string
   * long", and what it is meant to ask is "did somebody drop half of it".
   *
   * So the floor is SCALED by how compactly each locale writes THIS bundle:
   * total characters in the locale over total characters in English, which is
   * about 0.4 for Chinese, near 1 for the European languages, and computed from
   * the very text it is judging rather than from a table somebody would have to
   * keep. A note has to be at least half of what that ratio predicts.
   *
   * Half, and not more, because it is guarding against a CLAUSE going missing
   * rather than measuring style — a translator writing tightly should never
   * have to argue with a suite. What it does catch is `note.de` shortened from
   * "the nine national days, and ten states add more" to "the nine national
   * days", which is the failure this file's header is about.
   */
  const scaleOf = (tag: (typeof LOCALE_TAGS)[number]): number => {
    const total = (locale: (typeof LOCALE_TAGS)[number]) =>
      EN_KEYS.reduce((sum, key) => sum + valueOf(locale, key).length, 0);
    return total(tag) / total("en-US");
  };

  const atLeastHalfOfEnglish = (tag: (typeof LOCALE_TAGS)[number], keys: readonly string[]) => {
    const scale = scaleOf(tag);
    for (const key of keys) {
      const floor = valueOf("en-US", key).length * scale * 0.5;
      expect(
        valueOf(tag, key).length,
        `${tag} · ${key} is about half the length this locale writes the rest of the bundle at — ` +
          "has a clause gone?",
      ).toBeGreaterThan(floor);
    }
  };

  it("measures each locale against how compactly it writes the whole bundle", () => {
    // The scale has to be real, or the three cases below are floors of zero.
    for (const tag of LOCALE_TAGS) {
      expect(scaleOf(tag), tag).toBeGreaterThan(0.25);
      expect(scaleOf(tag), tag).toBeLessThan(2);
    }
    expect(scaleOf("en-US")).toBe(1);
    // …and the two Chinese bundles really are the compact ones, which is the
    // fact that broke the flat floor this replaced.
    expect(scaleOf("zh-CN")).toBeLessThan(0.7);
    expect(scaleOf("zh-TW")).toBeLessThan(0.7);
  });

  it.each(LOCALE_TAGS)("%s writes every set's note as a sentence, not a label", (tag) => {
    atLeastHalfOfEnglish(tag, NOTE_KEYS);
  });

  it.each(LOCALE_TAGS)("%s says where every set came from, and why three have none", (tag) => {
    atLeastHalfOfEnglish(tag, [...FROM_KEYS, ...WHY_KEYS]);
  });

  it.each(LOCALE_TAGS)("%s keeps the maintenance line's three facts", (tag) => {
    // Who keeps it, when it was last read, when the next read is due. A
    // translation that dropped a placeholder would already fail the parity case
    // above; this is about the sentence still being a sentence.
    atLeastHalfOfEnglish(tag, [
      "addon.holiday-calendars.maint.line",
      "addon.holiday-calendars.maint.corrections",
    ]);
  });
});

describe("the vocabulary ban, over the source bundle (17 §2, 24 D12)", () => {
  it("finds no banned substring in any locale", () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        for (const hit of bannedSubstringsIn(valueOf(tag, key))) {
          offences.push(`${tag} · ${key} · “${hit}”`);
        }
      }
    }
    expect(offences, `\n${offences.join("\n")}\n`).toEqual([]);
  });

  /**
   * The per-locale half. None of these carries an English banned run, so
   * nothing but a table per language could ever catch a paid-grade word in
   * German, Czech, Chinese or Arabic — and that table says in its own header
   * that it is a REGRESSION SET rather than coverage.
   */
  it("advertises no grade of itself, in the letters each language would use", () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        for (const pattern of TIERING_WORDS[tag]!) {
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
 * has vendored. This bundle declares none, which is a claim worth asserting
 * rather than a gap: it says every Latin digit these strings can put on an
 * Arabic page is a figure this add-on worked out and must therefore be
 * formatted. The Arabic copy writes its two years in Arabic-Indic digits and
 * its counts in words, so there is nothing to allow.
 */
describe("the allowances travel with the strings", () => {
  it("declares no Latin figure of its own, and says so explicitly", () => {
    expect(NOT_A_QUANTITY).toEqual([]);
  });

  it("carries every reason if one is ever added", () => {
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });
});
