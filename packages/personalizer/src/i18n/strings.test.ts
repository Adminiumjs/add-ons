/**
 * The string bundle: complete, actually translated, and clean of the banned
 * vocabulary in every one of the eight (24 D10, D10b).
 *
 * THREE THINGS, AND THE MIDDLE ONE IS THE ONE THAT CATCHES REAL WORK. Parity is
 * easy to satisfy and easy to satisfy dishonestly — eight copies of the English
 * bundle passes a key check perfectly. So the second suite asserts that each
 * locale's value DIFFERS from English, with a short, reasoned allowlist for the
 * handful of strings that genuinely are the same word.
 *
 * The third runs `testing/lexicon.ts` over every string in every locale. The
 * same tables run over `dist/` in `built-output.test.ts`, so the source check
 * and the artefact check cannot drift apart.
 */

import { describe, expect, it } from 'vitest';

import { FACE_LIST } from '../faces.ts';
import { TIERING_WORDS, scanForBannedLexicon } from '../testing/lexicon.ts';
import { LOCALE_TAGS, NOT_A_QUANTITY, personalizerStrings } from './strings.ts';
import { localeFromLang, translate } from './t.ts';

const EN = personalizerStrings['en-US'];
const EN_KEYS = Object.keys(EN).sort();

/**
 * The keys a locale is allowed to spell exactly as English spells them.
 *
 * Each entry names the key, the locales it covers, and why the word is the
 * same. This is the complete list; anything else identical to English is an
 * untranslated string, and the suite below says so.
 */
const SHARED_WITH_ENGLISH: readonly {
  key: keyof typeof EN;
  locales: readonly (typeof LOCALE_TAGS)[number][];
  why: string;
}[] = [
  {
    key: 'addon.personalizer.counter',
    locales: ['de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'],
    why: 'Two placeholders and a slash. There is no word in it to translate — the DIGITS are localised at render time by `useNumber`, which is where that belongs.',
  },
  {
    key: 'addon.personalizer.sizeUnit',
    locales: ['de-DE', 'fr-FR', 'cs-CZ', 'da-DK'],
    why: '`mm` is the SI symbol for a millimetre. It is not a word in any language and does not decline, so translating it would be inventing a unit. Chinese and Arabic spell the unit out and are not on this list.',
  },
  {
    key: 'addon.personalizer.font',
    locales: ['de-DE', 'fr-FR'],
    why: 'German `Alphabet` and French `Alphabet` are the ordinary nouns, spelt exactly as English spells them — all three borrowed the same two Greek letters by way of Latin.',
  },
  {
    key: 'addon.personalizer.line.font',
    locales: ['de-DE', 'fr-FR'],
    why: 'The same noun again as a mono column heading in capitals. The headings beside it — `GRÖSSE`, `TAILLE` — are not the same word, which is what makes this one believable.',
  },
  {
    key: 'addon.personalizer.zone.date',
    locales: ['fr-FR'],
    why: 'French `Date` is the ordinary noun and is spelt as English spells it — English took the word from French. German writes `Datum` and Danish `Dato`, so neither is on this list.',
  },
  {
    key: 'addon.personalizer.angle.detail',
    locales: ['cs-CZ'],
    why: 'Czech `Detail` is the ordinary noun, borrowed from French through German and spelt unchanged. French writes `Détail` and Danish `Detalje`, so neither is on this list.',
  },
  {
    key: 'addon.personalizer.prod.material',
    locales: ['de-DE'],
    why: 'German `Material` is the ordinary noun for the stuff a thing is made of, spelt as English spells it. French says `Matière` and Danish `Materiale`.',
  },
];

describe('all eight locales, complete', () => {
  it('carries exactly the same keys in every locale', () => {
    for (const tag of LOCALE_TAGS) {
      expect(Object.keys(personalizerStrings[tag]).sort(), tag).toEqual(EN_KEYS);
    }
  });

  it('has no empty string anywhere', () => {
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(personalizerStrings[tag])) {
        expect(value.trim().length, `${tag} · ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every placeholder English uses, in every locale', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS) {
        expect(
          placeholders(personalizerStrings[tag][key as keyof typeof EN]),
          `${tag} · ${key}`,
        ).toEqual(placeholders(EN[key as keyof typeof EN]));
      }
    }
  });

  /**
   * THE ONE THAT CATCHES A SHORTCUT. Eight copies of English passes a key
   * check; it does not pass this.
   */
  it('is actually translated — nothing but the declared shared words matches English', () => {
    const excused = new Map(
      SHARED_WITH_ENGLISH.map((entry) => [entry.key as string, new Set(entry.locales)]),
    );
    const untranslated: string[] = [];
    for (const tag of LOCALE_TAGS) {
      if (tag === 'en-US') continue;
      for (const key of EN_KEYS) {
        const typed = key as keyof typeof EN;
        if (personalizerStrings[tag][typed] !== EN[typed]) continue;
        if (excused.get(key)?.has(tag) === true) continue;
        untranslated.push(`${tag} · ${key}`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  /**
   * AND THE LIST ITSELF IS CHECKED, in both directions.
   *
   * A shared-word entry that excuses a pair which is NOT identical is a stale
   * entry — it was written for a string somebody has since translated, and it
   * would go on quietly excusing that key if the translation were ever reverted.
   * An exemption nobody can see expiring is how a list of six becomes a list of
   * forty.
   */
  it('keeps the shared-word list short, reasoned, and free of stale entries', () => {
    expect(SHARED_WITH_ENGLISH.length).toBeLessThanOrEqual(10);
    for (const entry of SHARED_WITH_ENGLISH) {
      expect(EN_KEYS, `${entry.key} is not a key`).toContain(entry.key as string);
      expect(entry.why.length, `${entry.key} has no reason`).toBeGreaterThan(40);
      for (const tag of entry.locales) {
        expect(
          personalizerStrings[tag][entry.key],
          `${tag} · ${entry.key} is excused but is no longer identical to English`,
        ).toBe(EN[entry.key]);
      }
    }
  });
});

describe('the vocabulary ban, over the source bundle (17 §2, 24 D10b)', () => {
  it('finds no banned run in any locale', () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(personalizerStrings[tag])) {
        for (const hit of scanForBannedLexicon(`${tag} · ${key}`, value)) {
          offences.push(`${hit.file} · “${hit.hit}” · ${hit.context}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * The per-locale half. None of these contains an English banned run, so
   * nothing but a table per language could ever catch a paid-grade word in
   * German, Czech, Chinese or Arabic.
   */
  it('advertises no grade of itself, in the letters each language would use', () => {
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(personalizerStrings[tag])) {
        for (const pattern of TIERING_WORDS[tag]) {
          if (pattern.test(value)) offences.push(`${tag} · ${key} · ${pattern}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * D10b's craft traps, which are this wave's own and are not in the release
   * sweep's seven. Two of them are words a maker's shop says every day.
   */
  it('avoids the craft traps that a maker’s vocabulary walks straight into', () => {
    const CRAFT = [/plant/i, /planter/i, /tiered/i, /free postage/i, /free engraving/i];
    const offences: string[] = [];
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(personalizerStrings[tag])) {
        for (const pattern of CRAFT) {
          if (pattern.test(value)) offences.push(`${tag} · ${key} · ${pattern}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * D10c, checked rather than remembered. The audience for this add-on sells
   * somewhere else today and naming that somewhere would be the easiest
   * sentence in the world to write.
   */
  it('names no other online marketplace, in any locale', () => {
    const MARKETPLACES = [/etsy/i, /shopify/i, /amazon/i, /ebay/i, /notonthehighstreet/i, /folksy/i];
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(personalizerStrings[tag])) {
        for (const pattern of MARKETPLACES) {
          expect(pattern.test(value), `${tag} · ${key}`).toBe(false);
        }
      }
    }
  });
});

describe('the lookup', () => {
  it('substitutes the numbers a remedy carries', () => {
    expect(translate('en-US', 'addon.personalizer.remedy.size', { size: 4.5 })).toBe(
      'Set it at 4.5 mm',
    );
    expect(translate('de-DE', 'addon.personalizer.remedy.shorten', { chars: 12 })).toBe(
      'Auf 12 kürzen',
    );
  });

  it('resolves a host’s `lang` to a locale, splitting Chinese by script', () => {
    expect(localeFromLang('de-DE')).toBe('de-DE');
    expect(localeFromLang('de-AT')).toBe('de-DE');
    expect(localeFromLang('zh-Hant-TW')).toBe('zh-TW');
    expect(localeFromLang('zh')).toBe('zh-CN');
    expect(localeFromLang(null)).toBe('en-US');
    expect(localeFromLang('xx')).toBe('en-US');
  });

  it('leaves face names out of the bundle, because a name is not a phrase', () => {
    for (const face of FACE_LIST) {
      for (const tag of LOCALE_TAGS) {
        for (const value of Object.values(personalizerStrings[tag])) {
          expect(value, `${tag} names the face ${face.name}`).not.toContain(face.name);
        }
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
describe('the allowances travel with the strings', () => {
  it('declares no Latin figure of its own, and says so explicitly', () => {
    expect(NOT_A_QUANTITY).toEqual([]);
  });

  it('carries every reason if one is ever added', () => {
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });
});
