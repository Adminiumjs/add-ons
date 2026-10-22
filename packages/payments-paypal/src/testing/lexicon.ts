/**
 * The release sweep's word list, in one executable place, for this add-on.
 *
 * The sweep reads BUILT OUTPUT (every byte of `dist/server.js`, comments
 * included, and `manifest.json`) case-insensitively for
 * `pricing|plan|tier|billing|upgrade|free|premium|pro|/mo` as SUBSTRINGS: no
 * add-on may imply a paid grade of itself. Substrings, no anchors — see the
 * same file in `shipping-dhl` for why a word boundary made the gate weaker
 * than the release grep it stands for.
 *
 * It lives in `testing/` because it spells every banned word and must never
 * reach the bundle.
 */
import { TIERING_WORDS } from '@adminium/add-on-host/testing';

export const SUBSTRING_BANNED = ['pricing', 'plan', 'tier', 'billing', 'upgrade', 'free', 'premium', 'pro', '/mo'] as const;

/** No wire name of this add-on holds a banned word. */
export const ALLOWED_IDENTIFIERS: readonly string[] = [];

/**
 * THE ONLY CARVE-OUT: exact whole words, each with its reason. A word here is
 * an entire token (bounded by non-letters) that no reader would take for a
 * grade of service. "Pro", "Premium" and the like are not here and never will be.
 */
export const ALLOWED_TOKENS: readonly string[] = [
  /** The contract's own name, `payment-provider`, and the factory it exports (`createPaymentProvider`). */
  'provider',
  'createpaymentprovider',
  'createpaypalprovider',
  'providererror',
  'providermessage',
  /** The manifest's `provides` list: the contract this add-on implements. */
  'provides',
  /** A payment whose money is on its way: the status the contract names. */
  'processing',
  /** The customer approves the order at PayPal (`APPROVED`, `payer-action`); "approves" in a comment. */
  'approve',
  'approved',
  'approves',
  /** `https:`, the only protocol a certificate address may use. */
  'protocol',
  /** "A token proves the client id and secret", in a comment that ships. */
  'proves',
];

const ALLOWED = new Set(ALLOWED_TOKENS.map((word) => word.toLowerCase()));

/**
 * Blank out the allowed identifiers, then the allowed whole words, leaving
 * everything else where it was (same length, same offsets).
 */
function maskAllowed(value: string): string {
  let out = value;
  for (const identifier of ALLOWED_IDENTIFIERS) out = out.split(identifier).join(' '.repeat(identifier.length));
  return out.replace(/\p{L}+/gu, (token) => (ALLOWED.has(token.toLowerCase()) ? ' '.repeat(token.length) : token));
}

/** Every banned substring in `value`, with where it first is, ignoring the allowed words. */
export function bannedHitsIn(value: string): { word: string; at: number }[] {
  const lower = maskAllowed(value).toLowerCase();
  return SUBSTRING_BANNED.filter((word) => lower.includes(word)).map((word) => ({ word, at: lower.indexOf(word) }));
}

/** Every locale's tiering pattern (the table in `@adminium/add-on-host/testing`) that `value` matches. */
export function tieringHitsIn(value: string): { pattern: string; at: number }[] {
  const masked = maskAllowed(value);
  return Object.values(TIERING_WORDS)
    .flat()
    .filter((re) => re.test(masked))
    .map((re) => ({ pattern: re.source, at: masked.search(re) }));
}
