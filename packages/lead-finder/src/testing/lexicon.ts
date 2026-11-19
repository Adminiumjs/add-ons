/**
 * The release sweep's word list, in one executable place, for this add-on.
 *
 * The sweep reads what ships (every byte of `dist/server.js`, comments
 * included, `manifest.json`, the sample) case-insensitively for
 * `pricing|plan|tier|billing|upgrade|free|premium|pro|/mo`: no add-on may
 * imply a paid grade of itself.
 *
 * FOUR OF THE NINE ARE MATCHED AS WHOLE WORDS, as in the other add-ons that
 * carry words in eight languages (`live-chat`, `forms`), and here for a
 * reason of their own: the server half carries the registers' activity lists
 * as the registers wrote them, and those say `produits`, `production`,
 * `plants`, `côtiers` and `Freezing` hundreds of times. Each of the four
 * standing alone is still caught, in any language; the other five stay
 * substrings. What this gives up, stated: a compound built on one of the four
 * would pass.
 *
 * THREE WORDS MORE, matched as substrings, that a translator reaches for and
 * this add-on must never say: `prospect` (French and English), `métier` and
 * `propriétaire`. The contract is `lead-source@1` for the same reason.
 *
 * It lives in `testing/` because it spells every banned word and must never
 * reach the bundle.
 */
import { TIERING_WORDS } from '@adminium/add-on-host/testing';

import { COMPANY_MARKS } from '../add-on-facts.ts';

/** A mark followed by an apostrophe-s, straight or curly: the marks are named, never possessed. */
export const POSSESSIVE = new RegExp(`\\b(${COMPANY_MARKS.map((mark) => mark.mark).join('|')})['’]s\\b`);

export const SUBSTRING_BANNED = ['pricing', 'plan', 'tier', 'billing', 'upgrade', 'free', 'premium', 'pro', '/mo'] as const;

/** The four matched as whole words (see the header). */
export const WHOLE_WORD_BANNED: readonly string[] = ['pro', 'plan', 'tier', 'free'];

/** The translators' words this add-on never says, as substrings. */
export const LEAD_FINDER_NEVER: readonly string[] = ['prospect', 'métier', 'propriétaire'];

/**
 * THE ONLY CARVE-OUT: exact whole words, each with its reason. "Pro",
 * "Premium" and the like are not here and never will be.
 */
export const ALLOWED_TOKENS: readonly string[] = [
  /**
   * Metal and plastic SECTIONS, in the registers' own activity labels: French
   * `profilés` and `profilage` (NAF 22.21Z, 24.20Z, 24.33Z), Norwegian
   * `profiler` and `profilerte` (SN2025), English `profiles` (SIC 24200). The
   * German tiering pattern `\bprofi` reads them as "Profi"; none is a grade of
   * anything.
   */
  'profilés',
  'profilage',
  'profiler',
  'profilerte',
  'profiles',
  /**
   * React's own export name (as live chat's list carries it). The screens'
   * files inline the host's React shim, which re-exports every name React
   * has, this one included: an identifier nobody reads and nobody can rename.
   */
  '__client_internals_do_not_use_or_warn_users_they_cannot_upgrade',
];

const ALLOWED = new Set(ALLOWED_TOKENS.map((word) => word.toLowerCase()));

/** The allowed whole words blanked out, every other character where it was. */
function maskAllowed(value: string): string {
  return value.replace(/[\p{L}_]+/gu, (token) => (ALLOWED.has(token.toLowerCase()) ? ' '.repeat(token.length) : token));
}

function wordPattern(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'u');
}

function offsetOf(haystack: string, word: string): number {
  return WHOLE_WORD_BANNED.includes(word) ? haystack.search(wordPattern(word)) : haystack.indexOf(word);
}

/** Every banned word in `value`, with where it first is. */
export function bannedHitsIn(value: string): { word: string; at: number }[] {
  const lower = maskAllowed(value).toLowerCase();
  return [...SUBSTRING_BANNED, ...LEAD_FINDER_NEVER]
    .filter((word) => offsetOf(lower, word) >= 0)
    .map((word) => ({ word, at: offsetOf(lower, word) }));
}

/** Every locale's tiering pattern (the table in `@adminium/add-on-host/testing`) that `value` matches. */
export function tieringHitsIn(value: string): { pattern: string; at: number }[] {
  const masked = maskAllowed(value);
  return Object.values(TIERING_WORDS)
    .flat()
    .filter((re) => re.test(masked))
    .map((re) => ({ pattern: re.source, at: masked.search(re) }));
}
