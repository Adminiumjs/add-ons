/**
 * The vocabulary ban (17 §2, extended for add-ons by 24 D12), in one place.
 *
 * It used to live only in `i18n/strings.test.ts`, where it checked the SOURCE
 * bundle. That is half the job: the release sweep greps BUILT output, and a
 * built file carries things the bundle does not — minified identifiers, CSS
 * class names, whatever survives of the comments. `built-output.test.ts` runs
 * the same tables over `dist/`, so both halves are checked against one
 * definition and neither can drift from the other.
 *
 * THREE TABLES, BECAUSE THE WORDS ARE NOT ALIKE.
 *
 * `SUBSTRING_BANNED` is the sweep's own list, checked exactly the way the sweep
 * checks it: a plain case-insensitive SUBSTRING, no word boundary, no word
 * dropped. That is deliberately merciless — "explanation" (plan), "frontier"
 * (tier) and French "métier" are real failures even though no human would read
 * them as marketing. The English copy is written around them.
 *
 * `ALLOWED_TOKENS` is how the merciless list stays usable. `pro` is a run
 * inside `product`, `proof`, `properties` and `Promise`, and it is also an
 * ordinary Czech preposition — but the answer to that is NOT to word-anchor
 * `pro` or to drop it, because `\bpro\b` would wave "Pro" through the moment it
 * were glued to punctuation, and the sweep would not. The answer is to keep the
 * substring run and to forgive, ONE EXACT TOKEN AT A TIME, the whole words that
 * happen to contain it — each with a sentence naming the language and what the
 * word actually means (24 D10). A word not on that list is a failure, and a
 * reviewer can read the list in under a minute.
 *
 * `TIERING_WORDS` is per-locale, because the ban is on the tiering IDEA and the
 * idea is spelt differently in each language: German advertises `Profi`, Czech
 * `prémiový` / `profesionální`, Chinese 高级版 / 专业版, Arabic احترافي / مميز.
 * None of those contain an English banned run, so nothing but a per-language
 * table would ever catch them.
 */

/** The eight locales, in the order the host bundles them. */
export const LEXICON_LOCALES = [
  "en-US",
  "de-DE",
  "fr-FR",
  "cs-CZ",
  "da-DK",
  "zh-CN",
  "zh-TW",
  "ar-EG",
] as const;

export type LexiconLocale = (typeof LEXICON_LOCALES)[number];

/**
 * THE SWEEP'S OWN LIST, checked as substrings, case-insensitively, everywhere —
 * source strings and built bytes alike.
 *
 * 17 §2 greps `pricing|tier|billing|upgrade|/mo|free|plan`; 24 D12 adds
 * `premium` and `pro` for add-ons, because an add-on that calls itself the pro
 * version of something is selling a grade whether or not a number follows.
 * `/mo` is here because the sweep bans it as a link path, and a path is not a
 * word.
 *
 * NOTHING IS DROPPED AND NOTHING IS WORD-ANCHORED. `pro` is the run that makes
 * this expensive — see `ALLOWED_TOKENS`, which pays that cost in the one
 * currency a reviewer can audit: named whole words.
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

/**
 * Every pattern above, flattened.
 *
 * A built bundle carries all eight locales interleaved in one file and there is
 * no way to attribute a byte back to the language it came from, so the built
 * check runs the UNION. That is stricter than the per-locale check, which is
 * the right direction — and it is why the carve-outs below exist at all.
 */
export const TIERING_PATTERNS: RegExp[] = Object.values(TIERING_WORDS).flat();

/**
 * THE PHRASE CARVE-OUTS: a banned run standing alone as a whole word, in a
 * language where that word means something else.
 *
 * `ALLOWED_TOKENS` below cannot help here — the token IS `pro`, so forgiving
 * the token would forgive the English marketing use too. What distinguishes
 * them is the words on either side, so these entries match a ±40-character
 * window instead, and each one quotes the phrase it exists for.
 *
 * THERE ARE NONE TODAY, and that is the target state rather than an oversight.
 * The Czech copy in this package is written around the preposition entirely —
 * with a case ending or a different word — so nothing here needs a window-based
 * exemption at all. The mechanism stays because the next add-on's translator
 * will hit it, and because an empty list a reviewer can see is stronger evidence
 * than a mechanism that was never built.
 */
export interface CarveOut {
  /** Matched against a ±40-character window around the hit. */
  readonly where: RegExp;
  readonly why: string;
}

export const CARVE_OUTS: readonly CarveOut[] = [];

/**
 * THE TOKEN CARVE-OUTS: whole words that contain a banned run and are not the
 * banned word.
 *
 * A hit is forgiven only when the WHOLE word around it — letters, digits and
 * underscores, expanded in both directions — matches one of these anchored
 * patterns exactly. That is the narrowest exemption the gate can express and
 * still be usable: it cannot forgive "Pro" by forgiving "product", and it
 * cannot forgive a new word nobody has read. Every entry names the language and
 * says what the word means, which is what makes the list auditable rather than
 * a regex somebody once needed (24 D10).
 *
 * There are no file-level exemptions anywhere in this module, deliberately.
 * Every emitted script, stylesheet, map and page is greped; a file that is hard
 * to keep clean is a file to fix, not a file to skip.
 */
export interface AllowedToken {
  /** Matched against the WHOLE word around the hit. Anchored on both ends. */
  readonly token: RegExp;
  readonly why: string;
}

export const ALLOWED_TOKENS: readonly AllowedToken[] = [
  {
    token: /^approved?$/i,
    why: "English `approve`/`approved`: the customer looking at their own picture and saying yes before anything is cut. The shop's own word for a step in a job, never a grade of product.",
  },
  {
    token: /^proud$/i,
    why: "English `proud`, in the carpenter's sense — the raised finish leaves the letters standing proud of the surface. A description of geometry, not of a feeling or a version.",
  },
  {
    token: /^propres?$/i,
    why: "French `propre`/`propres`: the possessive adjective, as in the customer's own words and their own picture. It is the French for “own”, and it has no commercial sense at all.",
  },
  {
    token: /^prost[éýáí]$/i,
    why: "Czech `prostý` and its inflections: plain, simple — the plain note field the shop shows when this add-on is off. An ordinary adjective that happens to open with the banned run.",
  },
  {
    token: /^(provede|proveden[íi])$/i,
    why: "Czech `provedení` and `provede`: the execution of a piece — engraved, raised, printed, painted. It is the column heading over the finish, and the verb “will carry out”.",
  },
  {
    token: /^createProductPersonalizer$/,
    why: "The factory the contract registry names: `product-personalizer@1` is the contract's own id, and the function that returns an implementation of it is called after the contract. Renaming it would break the seam to hide a substring.",
  },
  {
    token: /^products?(Key)?$/i,
    why: "English `product`: it survives in `productKey`, the contract's own field naming which piece a template belongs to. The visible copy says “piece” everywhere; this is an identifier the contract fixed.",
  },
  {
    token: /^(Promise|promise)$/,
    why: "JavaScript's `Promise`, which the contract's `open`, `render` and `productionFile` all return, and which survives minification as a global name.",
  },
  {
    token: /^(props|stopPropagation|prototype|hasOwnProperty)$/,
    why: "Toolchain and language identifiers that appear in any bundle with a component in it: React's `props`, the DOM's `stopPropagation`, and `Object.prototype.hasOwnProperty`, which the glyph lookup calls and which survives minification.",
  },
  {
    token: /^prod$/i,
    why: "The `prod` in this add-on's own key namespace — `addon.personalizer.prod.*` groups the production-file screen's strings. A key prefix, never a word on the screen.",
  },
  {
    token: /^proofs?(On|Off|_required|Artwork)?$/i,
    why: "English `proof` and the settings key that switches it on: the picture a customer says yes to before anything is cut. The trade's own noun, shared with the print works one package over, and the string keys that name its two states.",
  },
  {
    token: /^(production|productionFile|productionSvg|productionBytes|toProductionPaths|drawProduction)$/i,
    why: "English `production`, and the contract method and engine functions named after it — the file that goes to the laser. It names an artefact in a workshop, never a grade of this add-on.",
  },

];

/** One offence, with enough context to judge it without opening the file. */
export interface LexiconOffence {
  readonly file: string;
  readonly hit: string;
  readonly context: string;
}

const WINDOW = 40;

function windowAround(text: string, index: number, length: number): string {
  return text
    .slice(Math.max(0, index - WINDOW), Math.min(text.length, index + length + WINDOW))
    .replace(/\s+/g, " ");
}

function excused(context: string): boolean {
  return CARVE_OUTS.some((carve) => carve.where.test(context));
}

/**
 * Letters, digits, `_` and `$` — the run a minifier would treat as one
 * identifier and a reader would treat as one word. Unicode-aware, because three
 * of the eight locales are not written in ASCII and `Rozprostřít` has to come
 * back as one token rather than as `Rozprost` plus a stray `t`.
 */
const WORDISH = /[\p{L}\p{N}_$]/u;

/** The whole word around a hit, expanded in both directions. */
function tokenAround(text: string, index: number, length: number): string {
  let start = index;
  while (start > 0 && WORDISH.test(text[start - 1]!)) start -= 1;
  let end = index + length;
  while (end < text.length && WORDISH.test(text[end]!)) end += 1;
  return text.slice(start, end);
}

/**
 * True when the whole word is one of the named exemptions.
 *
 * Anchored on both ends, so `Professional` is not forgiven by the entry for
 * `properties` and `proplan` is not forgiven by anything.
 */
function allowedToken(token: string): boolean {
  return ALLOWED_TOKENS.some((allow) => {
    const anchored = new RegExp(`^(?:${allow.token.source})$`, allow.token.flags.replace(/[gy]/g, ""));
    return anchored.test(token);
  });
}

/**
 * Runs all three tables over one file's bytes.
 *
 * Returns every hit that no carve-out explains. The `file` label is carried
 * through so a failure names the artefact rather than just the word.
 */
export function scanForBannedLexicon(file: string, text: string): LexiconOffence[] {
  const offences: LexiconOffence[] = [];

  for (const word of SUBSTRING_BANNED) {
    let from = 0;
    const haystack = text.toLowerCase();
    for (;;) {
      const at = haystack.indexOf(word, from);
      if (at === -1) break;
      const context = windowAround(text, at, word.length);
      const token = tokenAround(text, at, word.length);
      if (!excused(context) && !allowedToken(token)) offences.push({ file, hit: token, context });
      from = at + word.length;
    }
  }

  for (const pattern of TIERING_PATTERNS) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/g, "")}g`);
    for (const match of text.matchAll(global)) {
      const context = windowAround(text, match.index, match[0].length);
      const token = tokenAround(text, match.index, match[0].length);
      if (!excused(context) && !allowedToken(token)) offences.push({ file, hit: match[0], context });
    }
  }

  return offences;
}
