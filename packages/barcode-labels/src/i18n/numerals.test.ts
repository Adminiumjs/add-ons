/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts`. An add-on cannot use the
 * host's `t` — D7 does not allow the runtime dependency — so every add-on has a
 * seam of its own and therefore had its own copy of the same defect sitting in
 * it. Three of the four that existed before this one shipped it.
 *
 * The key this suite substitutes into is `held.count`, the number of rows that
 * have been given a number: the plainest quantity in the bundle. Every other
 * figure this add-on can put on a screen — how many labels, how many sheets,
 * how many characters a font cannot draw, how long a code is — goes through the
 * same seam and is formatted the same way.
 *
 * ── AND THE ONE FIGURE THAT MUST GO ROUND IT ───────────────────────────────
 *
 * A CHECK DIGIT. When the refusal says which digit the last place should hold,
 * that digit has to be readable against the number in the box above it, which
 * is in Latin digits because a barcode is Latin digits. So it is passed as a
 * STRING — which `translate` leaves alone — and rendered inside the `Typed`
 * atom, whose `dir="auto"` is the marker a host's Arabic-page guard reads as
 * somebody else's text.
 *
 * That is the same arrangement `holiday-calendars` uses for a year and
 * `shipping-dhl` for a clock face, and the case below is what stops it being
 * confused with simply not formatting: the seam is asked to leave a string
 * alone and to format a number, in the same breath.
 */

import { describeNumerals } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { NOT_A_QUANTITY, strings } from './strings.ts';
import { translate } from './t.ts';

describeNumerals({
  name: 'barcode-labels',
  arabic: strings['ar-EG'],
  substitute: (value) =>
    translate('ar-EG', 'addon.barcode-labels.held.count', { count: value }),
  /*
   * READ OFF THE BUNDLE'S OWN DECLARATION rather than written out here. The
   * same list a HOST reads to decide whether an Arabic page carries an
   * unformatted number, so the two can never say different things — which is
   * the defect AC20/D21 exists to prevent.
   */
  allowed: NOT_A_QUANTITY,
});

describe('a check digit is an identifier, not a quantity', () => {
  it('reaches an Arabic reader in the digits the code itself is written in', () => {
    // Transliterating it would give somebody ٧ to match against a 7 they typed.
    const rendered = translate('ar-EG', 'addon.barcode-labels.refuse.ean13Check', {
      expected: '7',
      typed: '0',
    });
    expect(rendered).toContain('7');
    expect(rendered).toContain('0');
    expect(/[٠-٩]/.test(rendered), 'a digit was transliterated').toBe(false);
  });

  it('formats a real count in the same breath, so the seam is not simply off', () => {
    /*
     * THE SAME SENTENCE CARRIES BOTH KINDS OF FIGURE, which is what makes this
     * the case worth having. `given` is a character count and comes out in
     * Arabic-Indic digits; `EAN-13` is the designation of a standard and keeps
     * its Latin ones, in Arabic copy, correctly. So the assertion is not "no
     * Latin digit" — it is "no Latin digit that is not part of that name",
     * which is exactly the distinction the shared numeral rule draws and the
     * reason `EAN-13` needs no entry in `NOT_A_QUANTITY`.
     */
    const rendered = translate('ar-EG', 'addon.barcode-labels.refuse.ean13Shape', { given: 14 });
    expect(/[٠-٩]/.test(rendered), 'the count was not formatted').toBe(true);
    expect(rendered).toContain('EAN-13');
    expect(/[0-9]/.test(rendered.split('EAN-13').join('')), 'a bare Latin figure').toBe(false);
  });

  it('formats the two counts in the run summary and leaves no placeholder behind', () => {
    const rendered = translate('ar-EG', 'addon.barcode-labels.record.run', {
      labels: 48,
      sheets: 2,
    });
    expect(rendered).not.toContain('{');
    expect(/[0-9]/.test(rendered)).toBe(false);
  });

  it('leaves an unknown placeholder alone rather than writing "undefined"', () => {
    const rendered = translate('en-US', 'addon.barcode-labels.record.run', { labels: 3 });
    expect(rendered).toContain('{sheets}');
    expect(rendered).not.toContain('undefined');
  });
});
