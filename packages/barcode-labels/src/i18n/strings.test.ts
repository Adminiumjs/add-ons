/**
 * THE STRING BUNDLE: COMPLETE, ACTUALLY TRANSLATED, AND CLEAN IN ALL EIGHT.
 *
 * ── THE CASE THAT EARNS THIS FILE ──────────────────────────────────────────
 *
 * Parity is the easy half and is already a compile error at the foot of
 * `strings.ts`. The half that catches real work is the one Design Studio needed
 * three rounds to acquire:
 *
 *   EIGHT COPIES OF THE ENGLISH BUNDLE PASSES A KEY CHECK PERFECTLY.
 *
 * So every locale's value has to DIFFER from English, with a short declared
 * list of the strings that genuinely are the same and a sentence each saying
 * why.
 *
 * ── AND TWO CHECKS THAT ARE THIS ADD-ON'S OWN ──────────────────────────────
 *
 * FIRST, THE REFUSALS. Seven of these keys are the sentence a shop reads when a
 * number is not taken, and 25 D10 is a rule about whether a refusal can be
 * ACTED ON. A refusal that lost its second half in translation — "that number
 * is wrong", with the digit it expected trimmed off because the sentence read
 * long — would satisfy every other gate in this repository and would be
 * useless. Every refusal carries its placeholders in every language, and every
 * one is measured against how compactly its locale writes the rest of the
 * bundle.
 *
 * SECOND, THE THINGS THIS ADD-ON DOES NOT DO. Four keys say that no number is
 * handed out here, that nothing is looked up anywhere, that a sheet covers one
 * row and not a catalogue, and that the label font is Latin only. Those are the
 * add-on's honest limits, and they are exactly the sentences a translator
 * trims because they read like apologies. They are held to the same length rule
 * as the refusals.
 */

import { describe, expect, it } from 'vitest';

import { bannedSubstringsIn, TIERING_WORDS } from '../testing/lexicon.ts';
import { LOCALE_TAGS, NOT_A_QUANTITY, strings, type StringKey } from './strings.ts';

const EN = strings['en-US'];
const EN_KEYS = Object.keys(EN).sort();
const valueOf = (tag: (typeof LOCALE_TAGS)[number], key: string): string =>
  (strings[tag] as Record<string, string>)[key] ?? '';

/**
 * The keys a locale is allowed to spell exactly as English spells them.
 *
 * Each entry names the key, the locales it covers, and why the words are the
 * same. THIS IS THE COMPLETE LIST — anything else identical to English is an
 * untranslated string, and the case below says so.
 *
 * Both entries are the DESIGNATION OF A PUBLISHED STANDARD, which is the one
 * category of value where sameness is correct rather than lazy: `EAN-13` is
 * `EAN-13` in every language for the same reason `A4` is, and a locale that
 * invented a local spelling would be naming a different thing. The case below
 * enforces the rule as a word count, so it stays the rule when the next entry
 * is not a symbology.
 */
const SHARED_WITH_ENGLISH: readonly {
  key: StringKey;
  locales: readonly (typeof LOCALE_TAGS)[number][];
  why: string;
}[] = [
  {
    key: 'addon.barcode-labels.sym.ean13',
    locales: ['de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'],
    why: 'The designation of a published symbology, which is the same eight characters in every language. Translating it would name a different thing, and a shop looking for the code its counter expects would not find it.',
  },
  {
    key: 'addon.barcode-labels.sym.code128',
    locales: ['de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'],
    why: 'The designation of a published symbology, exactly as above. It is also the one phrase in this bundle that needs an entry in NOT_A_QUANTITY, because the space in it lets the Arabic numeral rule read the figure as a bare number.',
  },
];

describe('all eight locales, complete', () => {
  it('carries exactly the same keys in every locale', () => {
    // A guard that read no keys would pass everything below it.
    expect(EN_KEYS.length).toBeGreaterThan(40);
    for (const tag of LOCALE_TAGS) {
      expect(Object.keys(strings[tag]).sort(), tag).toEqual(EN_KEYS);
    }
  });

  it('has no empty string anywhere', () => {
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(valueOf(tag, key).trim().length, `${tag} · ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every placeholder English uses, in every locale', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(placeholders(valueOf(tag, key)), `${tag} · ${key}`).toEqual(
          placeholders(valueOf('en-US', key)),
        );
      }
    }
  });

  it('namespaces every key under this add-on, so nothing shadows the host', () => {
    expect(EN_KEYS.filter((key) => !key.startsWith('addon.barcode-labels.'))).toEqual([]);
  });

  /** THE ONE THAT CATCHES A SHORTCUT, and the reason this file exists. */
  it('is actually translated — nothing but the declared shared words matches English', () => {
    const excused = new Map(
      SHARED_WITH_ENGLISH.map((entry) => [entry.key as string, new Set(entry.locales)]),
    );
    const untranslated: string[] = [];
    for (const tag of LOCALE_TAGS) {
      if (tag === 'en-US') continue;
      for (const key of EN_KEYS) {
        if (valueOf(tag, key) !== valueOf('en-US', key)) continue;
        if (excused.get(key)?.has(tag) === true) continue;
        untranslated.push(`${tag} · ${key} = “${valueOf(tag, key)}”`);
      }
    }
    expect(untranslated, `\n${untranslated.join('\n')}\n`).toEqual([]);
  });

  /**
   * AND THE LIST ITSELF IS CHECKED, IN BOTH DIRECTIONS.
   *
   * An entry excusing a pair that is NOT identical is a stale entry — written
   * for a string somebody has since translated, and quietly ready to excuse
   * that key again if the translation were reverted.
   */
  it('keeps the shared-word list short, reasoned, and free of stale entries', () => {
    expect(SHARED_WITH_ENGLISH.length).toBeLessThanOrEqual(4);
    for (const entry of SHARED_WITH_ENGLISH) {
      expect(EN_KEYS, `${entry.key} is not a key`).toContain(entry.key as string);
      expect(entry.why.length, `${entry.key} has no reason`).toBeGreaterThan(40);
      for (const tag of entry.locales) {
        expect(
          valueOf(tag, entry.key),
          `${tag} · ${entry.key} is excused but is no longer identical to English`,
        ).toBe(valueOf('en-US', entry.key));
      }
    }
  });

  /**
   * THE RULE THE LIST IS WRITTEN UNDER, MADE MECHANICAL.
   *
   * A NAME can honestly be the same in two languages and a SENTENCE cannot. An
   * excused sentence is an untranslated sentence with a paragraph in front of
   * it, which is what this whole file exists to catch — so the ceiling is three
   * words, which fits `Code 128` and fits nothing that could be mistaken for
   * copy.
   */
  it('excuses only names, never a sentence', () => {
    for (const entry of SHARED_WITH_ENGLISH) {
      const words = valueOf('en-US', entry.key).split(/\s+/).filter(Boolean);
      expect(
        words.length,
        `${entry.key} is ${words.length} words, which is copy`,
      ).toBeLessThanOrEqual(3);
    }
  });
});

/**
 * ── THE SENTENCES THAT CANNOT LOSE THEIR SECOND HALF ───────────────────────
 *
 * See this file's header. A refusal that names no digit and a limit that names
 * no reason both read fine and are both worthless.
 *
 * ── A CHARACTER COUNT IS NOT A LENGTH ──────────────────────────────────────
 *
 * A flat floor asks "is this string long", and what it is meant to ask is "did
 * somebody drop half of it". Both Chinese bundles write this add-on in about a
 * third of the characters English needs, so a flat floor would fail them for
 * writing Chinese. The floor is SCALED by how compactly each locale writes THIS
 * bundle — computed from the very text it is judging rather than from a table
 * somebody would have to keep — and a sentence has to reach half of what that
 * ratio predicts.
 *
 * Half, and not more, because it guards against a CLAUSE going missing rather
 * than measuring style: a translator writing tightly should never have to argue
 * with a suite.
 */
describe('the refusals and the limits survive translation whole', () => {
  const REFUSAL_KEYS = EN_KEYS.filter((key) => key.startsWith('addon.barcode-labels.refuse.'));
  const LIMIT_KEYS = [
    'addon.barcode-labels.sheet.latin',
    'addon.barcode-labels.sheet.noOutline',
    'addon.barcode-labels.scope.oneRow',
    'addon.barcode-labels.scope.families',
    'addon.barcode-labels.note.noAllocation',
    'addon.barcode-labels.sym.ean13.note',
    'addon.barcode-labels.sym.code128.note',
    'addon.barcode-labels.record.readOnly',
  ];

  const scaleOf = (tag: (typeof LOCALE_TAGS)[number]): number => {
    const total = (locale: (typeof LOCALE_TAGS)[number]) =>
      EN_KEYS.reduce((sum, key) => sum + valueOf(locale, key).length, 0);
    return total(tag) / total('en-US');
  };

  const atLeastHalfOfEnglish = (tag: (typeof LOCALE_TAGS)[number], keys: readonly string[]) => {
    const scale = scaleOf(tag);
    for (const key of keys) {
      const floor = valueOf('en-US', key).length * scale * 0.5;
      expect(
        valueOf(tag, key).length,
        `${tag} · ${key} is about half the length this locale writes the rest of the bundle at — ` +
          'has a clause gone?',
      ).toBeGreaterThan(floor);
    }
  };

  it('found the keys to check', () => {
    expect(REFUSAL_KEYS.length).toBe(8);
    for (const key of LIMIT_KEYS) expect(EN_KEYS, key).toContain(key);
  });

  it('measures each locale against how compactly it writes the whole bundle', () => {
    // The scale has to be real, or the two cases below are floors of zero.
    for (const tag of LOCALE_TAGS) {
      expect(scaleOf(tag), tag).toBeGreaterThan(0.25);
      expect(scaleOf(tag), tag).toBeLessThan(2);
    }
    expect(scaleOf('en-US')).toBe(1);
    // …and the two Chinese bundles really are the compact ones, which is the
    // fact that breaks a flat floor.
    expect(scaleOf('zh-CN')).toBeLessThan(0.7);
    expect(scaleOf('zh-TW')).toBeLessThan(0.7);
  });

  it.each(LOCALE_TAGS)('%s keeps every refusal actionable', (tag) => {
    atLeastHalfOfEnglish(tag, REFUSAL_KEYS);
  });

  it.each(LOCALE_TAGS)('%s keeps every stated limit whole', (tag) => {
    atLeastHalfOfEnglish(tag, LIMIT_KEYS);
  });

  it('names the digit it expected, in every language', () => {
    // The single most important sentence in the bundle: it is what makes the
    // check-digit rule a refusal somebody can clear rather than an obstacle.
    for (const tag of LOCALE_TAGS) {
      const sentence = valueOf(tag, 'addon.barcode-labels.refuse.ean13Check');
      expect(sentence, `${tag} does not name the expected digit`).toContain('{expected}');
      expect(sentence, `${tag} does not name what was typed`).toContain('{typed}');
    }
  });

  it('names the row that already holds a number, in every language', () => {
    for (const tag of LOCALE_TAGS) {
      expect(valueOf(tag, 'addon.barcode-labels.refuse.duplicate'), tag).toContain('{heldBy}');
    }
  });
});

describe('the vocabulary ban, over the source bundle (17 §2, 24 D12)', () => {
  it('finds no banned substring in any locale', () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        for (const hit of bannedSubstringsIn(valueOf(tag, key))) {
          offences.push(`${tag} · ${key} · “${hit}” · ${valueOf(tag, key)}`);
        }
      }
    }
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });

  /**
   * The per-locale half. None of these carries an English banned run, so
   * nothing but a table per language could ever catch a paid-grade word in
   * German, Czech, Chinese or Arabic — and that table says in its own header
   * that it is a REGRESSION SET rather than coverage.
   */
  it('advertises no grade of itself, in the letters each language would use', () => {
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

  it('has no string containing the banned path fragment', () => {
    const offenders: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        if (valueOf(tag, key).toLowerCase().includes('/mo')) offenders.push(`${tag} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never states or implies a partnership', () => {
    const CLAIMS = /partner|official|endorse|authoris?ed reseller|certified by/i;
    const offenders: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        if (CLAIMS.test(valueOf(tag, key))) offenders.push(`${tag} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * THE CLAIM THIS ADD-ON MUST NEVER MAKE, in the language that would make it.
   *
   * It draws a number the shop already owns. It does not issue one, does not
   * register one, and cannot make one unique beyond the shop it is installed
   * in — that is a numbering authority's job. English copy that said "we
   * generate your article numbers" would be a false claim of the same class as
   * a day-set that implied it was complete, and it is the one this bundle is
   * most likely to drift into as it grows.
   */
  it('never claims to issue, register or generate a number', () => {
    const CLAIMS = /\b(issues?|registers?|generates?|allocates?|assigns? you)\b .{0,24}\bnumber/i;
    const offenders = EN_KEYS.filter((key) => CLAIMS.test(valueOf('en-US', key)));
    expect(offenders, `\n${offenders.join('\n')}\n`).toEqual([]);
  });
});

/**
 * THE ALLOWANCES THAT TRAVEL WITH THESE STRINGS (24 AC20/D21).
 *
 * Every add-on exports `NOT_A_QUANTITY` and every host reads it off whatever it
 * has vendored. This bundle declares exactly one, and the entry is checked
 * against the thing it is about rather than merely being present.
 */
describe('the allowances travel with the strings', () => {
  it('declares the one phrase whose digits are part of a name', () => {
    expect(NOT_A_QUANTITY.map((entry) => entry.phrase)).toEqual(['Code 128']);
  });

  it('carries a reason for every one of them', () => {
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });

  it('allows only a phrase that is really in the Arabic bundle', () => {
    // An allowance for a phrase nobody writes is an allowance that will one day
    // excuse a figure it was never meant to.
    for (const entry of NOT_A_QUANTITY) {
      const used = EN_KEYS.some((key) => valueOf('ar-EG', key).includes(entry.phrase));
      expect(used, `${entry.phrase} appears in no ar-EG string`).toBe(true);
    }
  });
});
