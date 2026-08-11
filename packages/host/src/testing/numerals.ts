/**
 * `describeNumerals` — ONE suite about digits, run by every add-on in the repo.
 *
 * ── THE DEFECT, AND WHY IT WAS FOUR DEFECTS ─────────────────────────────────
 *
 * Every host fixes "a number substituted into copy is FORMATTED, never
 * `String()`d" at its own `t` seam. An add-on cannot use the host's `t` — D7
 * does not allow the runtime dependency — so every add-on has a seam of its
 * own, and therefore had its own copy of the same bug sitting in it. Three of
 * the four in this repo shipped it. The personalizer's showed: the basket line
 * and the maker's order line drew "8.5 مم" beside the host's own "٣ مم", two
 * renderings of one measurement on one row.
 *
 * A per-package test would have been four tests, written four times, and the
 * three packages nobody had looked at yet would have had none. So the suite is
 * here, in the shared mirror, beside `describeArtworkSource` and for the same
 * stated reason: two copies of a suite can be tuned apart one assertion at a
 * time, and nothing would report it.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 *
 *   1. THE SEAM. Hand the bundle's own placeholders a NUMBER in ar-EG and the
 *      result carries Arabic-Indic digits and no Latin ones. A caller that has
 *      already formatted its value passes a STRING and must still be passed
 *      through untouched, so that is checked too — it is what keeps money and
 *      percentages working.
 *   2. THE BUNDLE. No ar-EG string carries a Latin digit a translator typed,
 *      because there is no number there for any formatter to reach. This is how
 *      "سريع، قبل 12:00" shipped.
 *
 * ── WHAT IT DOES NOT ASSERT, AND WHO DOES ───────────────────────────────────
 *
 * Not what a rendered page looks like. A figure built in JSX — `{i + 1}`, a
 * template literal — is in neither the bundle nor the seam, so this suite is
 * blind to it by construction, and this repo has no DOM harness to see it with:
 * every suite here renders with `renderToStaticMarkup` and none of them can
 * click.
 *
 * THE HOSTS' TOURS ARE WHERE THAT IS CAUGHT, and round 5 had to widen them
 * before they could catch it. Canva's step rail (`<Mono>{i + 1}</Mono>`, a
 * Latin 1 2 3 against Arabic labels) and its design picker (`85 × 55 mm`,
 * hard-coded English beside a bundle that says مم wherever it should) sat unseen
 * through four rounds of this hunt, because both live three presses inside a
 * wizard and no tour had ever gone that far in. See `testing/tour.tsx` in either
 * shop: reaching an add-on's own screens is now a budget the crawl must spend,
 * and `tour.test.tsx` fails if it stops early.
 */

import { describe, expect, it } from 'vitest';

/** Arabic-Indic digits: what `ar-EG` renders a number as. */
const ARABIC_INDIC = /[٠-٩]/;
const LATIN_DIGIT = /[0-9]/;
const LATIN_LETTER = /[A-Za-z]/;
const WORD = /[\p{L}\p{N}_-]/u;

export interface NumeralFixtures {
  /** The package's own name, for the suite's title. */
  name: string;
  /** Its ar-EG bundle: key → the Arabic string. */
  arabic: Readonly<Record<string, string>>;
  /**
   * The seam under test, bound to ar-EG and to one of the package's own keys
   * that carries a numeric placeholder. The seam takes KEYS rather than raw
   * strings, so the fixture chooses the key and this suite supplies the value.
   */
  substitute: (value: string | number) => string;
  /**
   * The phrase every allowed Latin number sits inside, with the reason. Never a
   * bare token: allowing `"3"` allows a Latin 3 everywhere, which is a hole the
   * size of the rule. See the hosts' `numerals.arabic.test.tsx` for the same
   * argument at greater length.
   */
  allowed?: readonly { phrase: string; why: string }[];
}

/**
 * Is a token carrying Latin letters a QUANTITY WITH ITS UNIT rather than an
 * IDENTIFIER?
 *
 * [Ported from both hosts' `numerals.arabic.test.tsx`, 2026-08-11.] This suite
 * used to skip any token with a Latin letter in it, on the reasoning that
 * `BR-2287` and `A4` are codes whose digits must not be transliterated. True,
 * and far too wide: `350gsm`, `5h`, `18mm` and `2x3` all carry a Latin letter
 * and all are quantities. Both hosts replaced the exemption with the two
 * structural facts below and the shared suite kept the old one, so the same
 * rule read two ways on two sides of one seam.
 *
 *   IT OPENS WITH ITS FIGURE. A code opens with its letters — `BR-2287`, `A4`,
 *   `SRA3`, `YO21`, `MP-4127` — because that is what makes it recognisable as
 *   the kind of thing it is. A quantity opens with the number.
 *
 *   ITS LETTERS ARE LOWER CASE. A unit symbol is lower case (`mm`, `gsm`, `kg`,
 *   `h`, `dpi`); a code fragment that opens with a digit is capitalised (`2NH`).
 *
 * No unit vocabulary anywhere: a list of units is a list that would be missing
 * whichever unit the next add-on invents.
 */
function isQuantityWithUnit(token: string): boolean {
  if (!LATIN_DIGIT.test(token[0] ?? '')) return false;
  return !/[A-Z]/.test(token);
}

/** Every bare Latin number in `text` that no allowed phrase covers. */
export function latinNumbersIn(
  text: string,
  allowed: readonly { phrase: string; why: string }[] = [],
): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (!LATIN_DIGIT.test(text[i]!)) continue;
    let from = i;
    while (from > 0 && WORD.test(text[from - 1]!)) from -= 1;
    let to = i + 1;
    while (to < text.length && WORD.test(text[to]!)) to += 1;
    const token = text.slice(from, to);
    i = to;
    if (LATIN_LETTER.test(token) && !isQuantityWithUnit(token)) continue;
    const covered = allowed.some(({ phrase }) => {
      for (let at = text.indexOf(phrase); at >= 0; at = text.indexOf(phrase, at + 1)) {
        if (at <= from && to <= at + phrase.length) return true;
      }
      return false;
    });
    if (covered) continue;
    out.push(token);
  }
  return out;
}

export function describeNumerals(fixtures: NumeralFixtures): void {
  const allowed = fixtures.allowed ?? [];

  describe(`${fixtures.name}: a number reaches an Arabic reader in Arabic digits`, () => {
    it('formats a number substituted into copy, rather than stringifying it', () => {
      const rendered = fixtures.substitute(1234);
      expect({
        rendered,
        arabicIndic: ARABIC_INDIC.test(rendered),
        latin: LATIN_DIGIT.test(rendered),
      }).toEqual({ rendered, arabicIndic: true, latin: false });
    });

    it('passes an already-formatted string straight through', () => {
      // Money, percentages and clock faces arrive as strings from their own
      // formatters, and a second pass through a number formatter wrecks them.
      const rendered = fixtures.substitute('‏١٢٫٥٠ US$');
      expect(rendered).toContain('١٢٫٥٠');
    });

    it('carries no Latin digit a translator typed into the ar-EG bundle', () => {
      const bad: { key: string; token: string }[] = [];
      for (const [key, value] of Object.entries(fixtures.arabic)) {
        for (const token of latinNumbersIn(value, allowed)) bad.push({ key, token });
      }
      expect(bad).toEqual([]);
    });

    it('names every allowance, so it is read rather than discovered', () => {
      for (const entry of allowed) {
        expect({ phrase: entry.phrase, explained: entry.why.length > 20 }).toEqual({
          phrase: entry.phrase,
          explained: true,
        });
      }
    });
  });
}
