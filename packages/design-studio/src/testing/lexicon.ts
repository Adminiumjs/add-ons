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
 * The homograph table. Per-locale, because each language advertises a paid
 * grade in its own letters, and none of those letters is an English banned run.
 */
export const TIERING_WORDS: Record<LexiconLocale, RegExp[]> = {
  "en-US": [/\bpro\b/i, /premium/i],
  "de-DE": [/\bprofi/i, /premium/i],
  "fr-FR": [/\bpro\b/i, /premium/i],
  "cs-CZ": [/prémiov/i, /profesionál/i],
  "da-DK": [/\bpro\b/i, /premium/i],
  "zh-CN": [/高级版/, /专业版/],
  "zh-TW": [/高級版/, /專業版/],
  "ar-EG": [/احترافي/, /مميز/],
};

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
 * There is exactly one today. It is the narrower of the two lists and should
 * stay that way: a phrase carve-out forgives more than a token carve-out does.
 */
export interface CarveOut {
  /** Matched against a ±40-character window around the hit. */
  readonly where: RegExp;
  readonly why: string;
}

export const CARVE_OUTS: readonly CarveOut[] = [
  {
    // cs-CZ · "Číst zakázku, pro kterou se návrh dělá" — the permission line.
    where: /pro kterou/i,
    why: "Czech: `pro` is the preposition “for”, not a name for a paid grade. Banning it in Czech would ban a function word.",
  },
];

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
    token: /^proofs?(_required|On|Off|Hint|sArtwork)?$/i,
    why: "English `proof`: the sheet a print works checks before a press run, and the settings key that switches it on. The works' own vocabulary, not a grade of product.",
  },
  {
    token: /^products?(Label|Key)?$/i,
    why: "English `product`: a card, a flyer, a sticker — the thing being printed. It names an item in the works' catalogue, never a version of this add-on.",
  },
  {
    token: /^propert(y|ies)$/i,
    why: "English `properties`: the inspector heading over an object's width, height and colour, and the DOM word underneath it. A panel title, not a feature list.",
  },
  {
    token: /^Propriétés$/,
    why: "French `Propriétés`: the same inspector heading in French — literally “properties”. Same word, same panel, different letters after the p-r-o.",
  },
  {
    token: /^Prospectus$/,
    why: "French `Prospectus`: a leaflet or flyer, the printed item itself. It is the French name of the `flyer` layout and appears nowhere near a grade.",
  },
  {
    token: /^(Rozprostřít|rozprostření)$/,
    why: "Czech `rozprostřít`: to spread evenly — the inspector's distribute-across action. The banned run falls inside the prefix roz-pro-, mid-verb.",
  },
  {
    token: /^(Promise|promise)$/,
    why: "JavaScript's `Promise`, and the English noun in a source comment about the shop's promise to check every job. Neither is a claim about this add-on.",
  },
  {
    token: /^(props|stopPropagation)$/,
    why: "React's `props` (also the `ds-props` class name for the inspector button) and the DOM's `stopPropagation`. Toolchain identifiers that survive minification.",
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
