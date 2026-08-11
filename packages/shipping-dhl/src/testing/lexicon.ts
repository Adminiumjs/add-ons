/**
 * The release sweep's word list, in one executable place.
 *
 * THE GUARD HAS TO BE THE RELEASE GREP, NOT A POLITER VERSION OF IT. The sweep
 * (17 §2) reads BUILT OUTPUT case-insensitively for
 * `pricing|plan|tier|billing|upgrade|/mo|free` as SUBSTRINGS, and 24 D12 adds
 * `premium` and `pro` for add-ons. This list was once anchored with `\b` around
 * two of those words, which made it strictly weaker than the thing it claimed
 * to enforce: "freephone", "freight-plan", "explanation" and "frontier" all
 * pass a word boundary and all fail the release. Substrings here, no anchors.
 *
 * `pro` used to be missing from this array and handled only by `TIERING_WORDS`,
 * which `sources.test.ts` runs over the eight LOCALE BUNDLES. Built bytes are
 * not locale bundles: a comment reading "Pro grade, Profi service" sits in
 * neither, shipped in `dist/client.js`, and was proven to ship. It is a
 * substring here now, like every other word on the release list.
 *
 * It lives in `testing/` because it is a test fixture and must never reach a
 * bundle — a module that spells every banned word would fail the very grep it
 * defines if it shipped. `src/testing/` is excluded from the vendored client
 * half and from the shipped-sources checks for exactly that reason.
 *
 * Two suites read it: `sources.test.ts` over the eight locale bundles and the
 * generated label, and `dist.test.ts` over every byte of `dist/`.
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
 * Every entry below is a token that is in the built output today. A new one
 * turns the gate red until somebody either rewords the source or adds it here
 * on purpose, which is the intended cost.
 */
export const ALLOWED_TOKENS: readonly string[] = [
  // ── German ────────────────────────────────────────────────────────────────
  /** "ausprobieren" — German, "to try out". In the connect copy. */
  "ausprobieren",

  // ── Czech ─────────────────────────────────────────────────────────────────
  /** "proto" — Czech, "therefore" / "that is why". In the unknown-address copy. */
  "proto",
  /** "oproti" — Czech, "against" / "compared with". In the postcode remedy. */
  "oproti",

  // ── English words and identifiers that happen to start with the fragment ──
  /** The printed thing itself — a poster, a leaflet. Never a grade of service. */
  "product",
  "products",
  /** `job.config.product`, carried through the parcel estimate. */
  "productkey",
  /** The carrier's own JSON field names, in the wire mapping. */
  "productcode",
  "productname",
  /** "produce" / "produced" — the ordinary verb, in the label error and a note. */
  "produce",
  "produced",
  /** "Processed at the sorting depot" — a seeded scan line from the demo. */
  "processed",
  /** `Promise` — the JavaScript built-in, in the booked-and-tracked await. */
  "promise",

  // ── French ────────────────────────────────────────────────────────────────
  /**
   * "tarifs" — French, "rates": what a carrier charges to carry a parcel, and
   * the plural of tarif. The GERMAN `Tarif` is a plan and is banned; this exact
   * plural is not a German word, so the singular, `Tarife` and `Tarifwechsel`
   * all still fail.
   */
  "tarifs",
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
 * [Rewritten 2026-08-11, wave 4b round 4.] This was a table of one word per
 * language ("premium", and its spellings), and it was a FINGERPRINT: planting
 * "الترقية إلى الباقة المدفوعة" and "Jetzt auf den bezahlten Tarif wechseln"
 * in two locale bundles left every gate in this repo green. The rule D12 and
 * 17 §2 state is about a set of IDEAS — pricing, plan, tier, billing, upgrade,
 * free, premium — and each of them is spelt differently in each of the eight
 * languages.
 *
 * The whole `idea × language` table now lives in
 * `@adminium/add-on-host/testing`, once, because there were SIX divergent
 * copies of the one-word version and a shelf where the host forbids a word and
 * an add-on advertises it is not a shelf with a rule. Read it there.
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
 * over a 120 KB bundle can print the neighbourhood instead of the word alone.
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
 * MASKED FIRST, like `bannedHitsIn`, and it was not — which only started
 * mattering when the tiering table stopped being one word per language. The
 * union of eight languages is where German's `Tarif` (a PLAN, and the word one
 * of the plants used) meets French's `tarifs` (what a carrier charges to carry
 * a parcel, which is this add-on's whole subject). One is banned; the other is
 * on the screen in front of a customer. `ALLOWED_TOKENS` is the mechanism this
 * file already has for exactly that, and the mask leaves offsets untouched so
 * the reported neighbourhood is still the real one.
 */
export function tieringHitsIn(value: string): { pattern: string; at: number }[] {
  const masked = maskAllowed(value);
  return TIERING_PATTERNS.filter((re) => re.test(masked)).map((re) => ({
    pattern: re.source,
    at: masked.search(re),
  }));
}
