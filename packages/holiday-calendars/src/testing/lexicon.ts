/**
 * The release sweep's word list, in one executable place.
 *
 * THE GUARD HAS TO BE THE RELEASE GREP, NOT A POLITER VERSION OF IT. The sweep
 * (17 §2) reads BUILT OUTPUT case-insensitively for
 * `pricing|plan|tier|billing|upgrade|/mo|free` as SUBSTRINGS, and 24 D12 adds
 * `premium` and `pro` for add-ons. A `\b` anchor around any of them would make
 * this strictly weaker than the thing it claims to enforce: "freephone",
 * "explanation" and "frontier" all pass a word boundary and all fail the
 * release. Substrings here, no anchors.
 *
 * It lives in `testing/` because it is a test fixture and must never reach a
 * bundle — a module that spells every banned word would fail the very grep it
 * defines if it shipped. `src/testing/` is excluded from the shipped-source
 * checks for exactly that reason.
 *
 * Two suites read it: `sources.test.ts` over the eight locale bundles, and
 * `dist.test.ts` over every byte of `dist/`.
 */

export const SUBSTRING_BANNED = [
  "pricing",
  "plan",
  "tier",
  "billing",
  "upgrade",
  "free",
  "premium",
  "pro",
  "/mo",
] as const;

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
 * ── WHY THIS LIST IS SHORTER THAN ITS SIBLINGS ─────────────────────────────
 *
 * The delivery add-on carries a dozen entries because its subject is a trade
 * whose ordinary vocabulary collides with the ban — a print works says
 * `product`, `produce`, `processed` on every screen. This add-on's subject is
 * dates, and the collision it DID have was in the copy rather than in the code:
 * the German and French words for a duty rota (`Dienstplan`, `planning`) and
 * the Czech preposition `pro` are all banned runs, and the answer was to write
 * the copy differently — `Schichtliste`, `tableau de service`, `na` — rather
 * than to widen this list. A carve-out is a cost paid once and audited forever;
 * a reworded sentence is a cost paid once.
 *
 * Every entry below is a token that is in the built output today. A new one
 * turns the gate red until somebody either rewords the source or adds it here
 * on purpose, which is the intended cost.
 */
export const ALLOWED_TOKENS: readonly string[] = [
  /**
   * `Promise` — the JavaScript built-in. React's `createElement` seam and the
   * bundler's own helpers name it; no copy in this package does.
   */
  "promise",
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
  return value.replace(/\p{L}+/gu, (token) =>
    ALLOWED.has(token.toLowerCase()) ? " ".repeat(token.length) : token,
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
import { TIERING_WORDS } from "@adminium/add-on-host/testing";

export { TIERING_WORDS };

/** Every tiering pattern from every locale, for a grep over one built file. */
export const TIERING_PATTERNS: readonly RegExp[] = Object.values(TIERING_WORDS).flat();

/**
 * Every banned substring present in `value`, case-insensitively, ignoring the
 * whole words `ALLOWED_TOKENS` names.
 */
export function bannedSubstringsIn(value: string): string[] {
  const lower = maskAllowed(value).toLowerCase();
  return SUBSTRING_BANNED.filter((word) => lower.includes(word));
}

/**
 * The same grep, but reporting WHERE — the offset of the first hit, so a caller
 * over a 60 KB bundle can print the neighbourhood instead of the word alone.
 */
export function bannedHitsIn(value: string): { word: string; at: number }[] {
  const lower = maskAllowed(value).toLowerCase();
  return SUBSTRING_BANNED.filter((word) => lower.includes(word)).map((word) => ({
    word,
    at: lower.indexOf(word),
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
