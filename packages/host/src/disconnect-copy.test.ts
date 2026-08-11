/**
 * D16 HAS TWO HEADINGS, AND EVERY SENTENCE HAS TO BE UNDER THE RIGHT ONE.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * Both hosts render the disconnect confirm the same way: an eyebrow reading
 * "What goes", the add-on's `disconnect.goes` under it, an eyebrow reading
 * "What stays", the add-on's `disconnect.stays` under that. The rule the two
 * headings exist to teach is D16 — a disconnect DELETES THE CREDENTIALS and
 * KEEPS THE DATA — and it is the only thing a shop needs from that card.
 *
 * The carrier's `stays` read:
 *
 *   "Collections already booked keep their labels and tracking numbers.
 *    The account details are deleted."
 *
 * A deletion, printed under the heading that promises survival, in all eight
 * locales. Canva Import had the identical shape: "Designs already brought onto
 * orders are kept. The authorization is revoked and the token deleted." Each
 * card stated both halves of D16 and assigned them to the wrong sides, which
 * teaches a reader precisely nothing — and worse than nothing, since the one
 * fear the card exists to answer is "will disconnecting take my work with it".
 *
 * Nothing caught it because every gate in this repo reads a locale bundle as
 * text: the words were present, translated, at parity, and free of every banned
 * term. WHICH KEY a sentence sits under is not something a string check asks.
 *
 * ── SO THIS ONE ASKS IT, IN EVERY LANGUAGE ──────────────────────────────────
 *
 * The host's render tests can only reach the locale they mount in, and only the
 * add-ons that host has vendored. This reads the SOURCE bundles — all four
 * add-ons, all eight locales, 64 sentences — and asks two questions of each
 * pair:
 *
 *   NOTHING IS DESTROYED UNDER "WHAT STAYS". A word meaning deleted, revoked or
 *   erased on that side is the defect, whatever else the sentence says.
 *
 *   A CREDENTIALLED ADD-ON SAYS THE CREDENTIAL GOES, under "What goes". Half of
 *   D16 is a promise the shop is owed: an add-on it handed an account to has to
 *   state, before it presses the button, that the account details do not
 *   survive. `connect.kind` in `manifest.json` is what decides whether the add-on
 *   holds one, so the manifest is what this reads — not a list kept here, which
 *   would be one more mirror to drift.
 *
 * ── THE WORD LISTS ARE PER LANGUAGE AND DELIBERATELY NARROW ─────────────────
 *
 * Only verbs of DESTRUCTION, not of loss. "The order loses Book a collection"
 * and "customers will no longer see it" are surfaces going away, which is what
 * `goes` is for and what `stays` may legitimately contrast against; a sentence
 * is only an offence here if it says something was DELETED. That keeps the
 * check to the one distinction D16 draws, and keeps it from turning into a
 * general ban on gloomy words that a translator would have to fight.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));

/** The eight locales every bundle carries, in the order they are written. */
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;

/**
 * "Deleted", "revoked", "erased" — in each shipped language, and nothing
 * weaker. See the header on why loss is not destruction.
 */
const DESTROYED: readonly { pattern: RegExp; language: string }[] = [
  { pattern: /\bdelete[sd]?\b|\brevoked\b|\berased\b/i, language: 'English' },
  { pattern: /gelöscht|entzogen|widerrufen/i, language: 'German' },
  { pattern: /supprimé|révoqué|effacé/i, language: 'French' },
  { pattern: /smaž|smaza|odvolá|zruší/i, language: 'Czech' },
  { pattern: /slette|slettes|slettet|tilbagekald/i, language: 'Danish' },
  { pattern: /删除|撤销/, language: 'Chinese (simplified)' },
  { pattern: /刪除|撤銷/, language: 'Chinese (traditional)' },
  { pattern: /حذف|تُحذف|يُحذف|يُسحب|سحب/, language: 'Arabic' },
];

interface AddOnCopy {
  pkg: string;
  /** `none` | `api-key` | `oauth2`, straight out of the shipped manifest. */
  connect: string;
  /** locale → the sentence, for each half. */
  goes: Record<string, string>;
  stays: Record<string, string>;
}

/**
 * The two disconnect sentences per locale, read out of the bundle as text.
 *
 * The bundles are `{ locale: { key: value } }` written as one object literal,
 * so the locale a key belongs to is the last locale header seen above it. Both
 * quote styles and both layouts (value on the key's line, or wrapped onto the
 * next) are in use across the four packages, which is why the value pattern
 * allows a newline between the colon and the opening quote.
 */
function copyOf(pkg: string): AddOnCopy | undefined {
  const bundle = join(PACKAGES, pkg, 'src/i18n/strings.ts');
  const manifestFile = join(PACKAGES, pkg, 'manifest.json');
  if (!existsSync(bundle) || !existsSync(manifestFile)) return undefined;

  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
    addOn?: { connect?: { kind?: string } };
  };
  const text = readFileSync(bundle, 'utf8');

  const goes: Record<string, string> = {};
  const stays: Record<string, string> = {};
  let locale = '';
  const line = /(?:^\s*['"]([\w-]+)['"]:\s*\{)|(?:['"][\w.-]*\.disconnect\.(goes|stays)['"]:\s*(['"])((?:\\.|(?!\3)[^\\])*)\3)/gm;
  for (const match of text.matchAll(line)) {
    if (match[1] !== undefined) {
      locale = match[1];
      continue;
    }
    const half = match[2] === 'goes' ? goes : stays;
    half[locale] = match[4]!;
  }

  return {
    pkg,
    connect: manifest.addOn?.connect?.kind ?? 'none',
    goes,
    stays,
  };
}

const ADD_ONS = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => copyOf(entry.name))
  .filter((entry): entry is AddOnCopy => entry !== undefined);

/** Which language's destruction words apply to a locale's sentence. */
function destroyers(locale: string): readonly RegExp[] {
  // Every sentence is also checked against English, because a bundle that left
  // a locale in English is a defect this file would otherwise wave through.
  const own = DESTROYED.find((entry) => {
    switch (locale) {
      case 'de-DE':
        return entry.language === 'German';
      case 'fr-FR':
        return entry.language === 'French';
      case 'cs-CZ':
        return entry.language === 'Czech';
      case 'da-DK':
        return entry.language === 'Danish';
      case 'zh-CN':
        return entry.language === 'Chinese (simplified)';
      case 'zh-TW':
        return entry.language === 'Chinese (traditional)';
      case 'ar-EG':
        return entry.language === 'Arabic';
      default:
        return false;
    }
  });
  const english = DESTROYED[0]!.pattern;
  return own === undefined ? [english] : [english, own.pattern];
}

describe('a disconnect card puts each half of D16 on its own side', () => {
  it('found every add-on’s two sentences to check', () => {
    expect(ADD_ONS.length, 'no add-on bundles were read at all').toBeGreaterThan(3);
    for (const addOn of ADD_ONS) {
      expect(Object.keys(addOn.goes).sort(), `${addOn.pkg} “what goes”`).toEqual(
        [...LOCALES].sort(),
      );
      expect(Object.keys(addOn.stays).sort(), `${addOn.pkg} “what stays”`).toEqual(
        [...LOCALES].sort(),
      );
    }
  });

  it.each(ADD_ONS)('$pkg destroys nothing under “what stays”', ({ stays }) => {
    const offences: string[] = [];
    for (const locale of LOCALES) {
      const sentence = stays[locale]!;
      for (const pattern of destroyers(locale)) {
        if (pattern.test(sentence)) {
          offences.push(
            `${locale} names a deletion under the heading that promises survival — ` +
              `move that clause to disconnect.goes:\n    ${sentence}`,
          );
        }
      }
    }
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });

  it.each(ADD_ONS)('$pkg tells a shop what happens to the account it gave', ({ connect, goes }) => {
    // An add-on that asks for nothing has nothing to promise about — and must
    // not invent a credential it never held.
    if (connect === 'none') return;

    const missing: string[] = [];
    for (const locale of LOCALES) {
      const sentence = goes[locale]!;
      if (!destroyers(locale).some((pattern) => pattern.test(sentence))) {
        missing.push(
          `${locale} never says the credential is deleted, and this add-on holds one ` +
            `(connect: ${connect}):\n    ${sentence}`,
        );
      }
    }
    expect(missing, `\n${missing.join('\n')}\n`).toEqual([]);
  });
});
