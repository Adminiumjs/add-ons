/**
 * The release sweep's word list, in one executable place.
 *
 * THE GUARD HAS TO BE THE RELEASE GREP, NOT A POLITER VERSION OF IT. The sweep
 * reads BUILT OUTPUT case-insensitively for
 * `pricing|plan|tier|billing|upgrade|/mo|free` as SUBSTRINGS, and add-ons also
 * ban `premium` and `pro` (the tiering IDEA is banned, not just the word). A
 * `\b` anchor around any of them would make this strictly weaker than the thing
 * it claims to enforce: "freephone", "explanation" and "frontier" all pass a
 * word boundary and all fail the release. Substrings here, no anchors.
 *
 * It lives in `testing/` because it is a test fixture and must never reach a
 * bundle — a module that spells every banned word would fail the very grep it
 * defines if it shipped. `src/testing/` is excluded from the shipped-source
 * checks for exactly that reason, and `sources.test.ts` asserts that nothing
 * under it is reachable from the entry point.
 *
 * Two suites read it: `sources.test.ts` over the sources and the manifest, and
 * `dist.test.ts` over every byte of `dist/`.
 */

export const SUBSTRING_BANNED = [
  'pricing',
  'plan',
  'tier',
  'billing',
  'upgrade',
  'free',
  'premium',
  'pro',
  '/mo',
] as const;

/**
 * FOUR OF THE NINE ARE MATCHED AS WHOLE WORDS, AND THIS IS WHY.
 *
 * `pro`, `plan`, `tier` and `free` are inside ordinary words in most of the
 * eight languages this package is written in (`progress`, Czech `Prodej`,
 * Danish `sprog`, French `propre`), and in ordinary code (`stopPropagation`).
 * Swept as substrings they would need an allow-list nobody could maintain. So
 * these four are matched with word boundaries: each standing alone is still
 * caught, in any language, which is what the ban is about. The other five
 * stay SUBSTRINGS, which keeps a compound like `Premiumtarif` caught.
 *
 * WHAT THIS GIVES UP, stated rather than glossed: a compound built on one of
 * the four would pass.
 */
export const WHOLE_WORD_BANNED: readonly string[] = ['pro', 'plan', 'tier', 'free'];

/**
 * THE ONLY CARVE-OUT, AND IT IS A LIST OF EXACT WHOLE WORDS.
 *
 * A word here is allowed to contain a banned substring, and nothing else is.
 * The rule for adding one is that it must be an entire token — bounded by
 * non-letters on both sides — that a reader would never mistake for the
 * marketing word, and it must carry a line saying which language it is in and
 * what it means. Widening a PATTERN instead of naming a WORD is how a gate
 * stops being a gate, so there are no patterns here.
 *
 * "Pro", "Profi" and "Professional" are not on this list and never will be:
 * each is its own token, so each still fails.
 *
 * This package ships one file that decides and no screen of its own yet, so
 * the list holds one word. A new one turns the gate red until somebody either
 * rewords the source or adds it here on purpose, which is the intended cost.
 */
export const ALLOWED_TOKENS: readonly string[] = [
  /** `Promise` — the JavaScript built-in, named by the check that an answer is not one. */
  'promise',
];

const ALLOWED = new Set(ALLOWED_TOKENS.map((word) => word.toLowerCase()));

/**
 * Blank out the allowed whole words, leaving everything else exactly where it
 * was — same length, same offsets, same punctuation.
 *
 * Blanking rather than deleting matters for `/mo`, which is not a word: an
 * `href="/models"` keeps its slash whatever happens to the letters beside it.
 */
function maskAllowed(value: string): string {
  /*
   * `_` COUNTS AS PART OF A WORD, so a JavaScript identifier is one token.
   * Without that, React's `__CLIENT_INTERNALS_…_CANNOT_UPGRADE` tokenises into
   * eleven words, one of which is `UPGRADE`, and the only way to pass would be
   * to allow that word everywhere.
   */
  return value.replace(/[\p{L}_]+/gu, (token) =>
    ALLOWED.has(token.toLowerCase()) ? ' '.repeat(token.length) : token,
  );
}

/**
 * THE TIERING IDEA, SPELT PER LANGUAGE — and it is NOT written out here.
 *
 * The whole `idea × language` table lives in `@adminium/add-on-host/testing`,
 * once, because there were six divergent copies of a one-word version of it and
 * a shelf where the host forbids a word and an add-on advertises it is not a
 * shelf with a rule. Read it there — including its own header, which says
 * plainly that it is a REGRESSION SET and not coverage.
 */
import { TIERING_WORDS } from '@adminium/add-on-host/testing';

export { TIERING_WORDS };

/** Every tiering pattern from every locale, for a grep over one built file. */
export const TIERING_PATTERNS: readonly RegExp[] = Object.values(TIERING_WORDS).flat();

/**
 * Every banned substring present in `value`, case-insensitively, ignoring the
 * whole words `ALLOWED_TOKENS` names.
 */
export function bannedSubstringsIn(value: string): string[] {
  const lower = maskAllowed(value).toLowerCase();
  return SUBSTRING_BANNED.filter((word) => matches(lower, word));
}

/** Whole-word for the four ambiguous ones, substring for the rest. */
function wordPattern(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'u');
}

function matches(haystack: string, word: string): boolean {
  return WHOLE_WORD_BANNED.includes(word)
    ? wordPattern(word).test(haystack)
    : haystack.includes(word);
}

function offsetOf(haystack: string, word: string): number {
  if (!WHOLE_WORD_BANNED.includes(word)) return haystack.indexOf(word);
  return haystack.search(wordPattern(word));
}

/**
 * The same grep, but reporting WHERE — the offset of the first hit, so a caller
 * over a 60 KB bundle can print the neighbourhood instead of the word alone.
 */
export function bannedHitsIn(value: string): { word: string; at: number }[] {
  const lower = maskAllowed(value).toLowerCase();
  return SUBSTRING_BANNED.filter((word) => matches(lower, word)).map((word) => ({
    word,
    at: offsetOf(lower, word),
  }));
}

/**
 * Every locale's tiering word that appears in `value`.
 *
 * MASKED FIRST, like `bannedHitsIn`. The union of eight languages is where one
 * language's marketing word meets another's ordinary one, and `ALLOWED_TOKENS`
 * is the mechanism this file already has for that; the mask leaves offsets
 * untouched so the reported neighbourhood is still the real one.
 */
export function tieringHitsIn(value: string): { pattern: string; at: number }[] {
  const masked = maskAllowed(value);
  return TIERING_PATTERNS.filter((re) => re.test(masked)).map((re) => ({
    pattern: re.source,
    at: masked.search(re),
  }));
}
