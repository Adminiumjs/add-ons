/**
 * `product-personalizer@1`, run against this implementation.
 *
 * A conformance suite is part of the contract rather than a courtesy (24 §5.5,
 * D9). This one carries the three assertions the other two contracts do not
 * need — deterministic `render`, numbered remedies, no font in the production
 * file — and they are acceptance criteria 17, 18 and 19 in that order.
 *
 * THE FIXTURES ARE NAMED FOR WHAT THEY DEMONSTRATE. They used to be named for
 * two of a particular shop's order references — "`valid` is `BR-2281` and
 * `overrun` is `BR-2284`, which are the two orders a reviewer can open in the
 * running demo" — and that sentence was false in both directions: `BR-2281` in
 * that shop is a bookmark for somebody else entirely, and no other host has a
 * `BR-` anything. A fixture cannot be a claim about one host's screen without
 * being a lie in every other host, so it claims what it can: one wording that
 * fits comfortably and one that overruns.
 *
 * `readProduction` is the fixture that lets the mirror's suite do more than
 * check a filename: it hands over the file's actual bytes, and the suite greps
 * them for `font-family`, `@font-face`, a `<text>` element and a font-file
 * extension. An implementation that could not produce its bytes headlessly
 * would omit it and get the weaker check; this one can, because the whole
 * engine is a pure function of its inputs.
 */

import { describeProductPersonalizer } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { createProductPersonalizer, productionBytes } from './personalizer.ts';
import { COASTER_TEMPLATE, sampleThat } from './seed.ts';

const impl = createProductPersonalizer();

describeProductPersonalizer(impl, {
  product: { productKey: 'walnut-coasters', quantity: 4 },
  template: COASTER_TEMPLATE,
  valid: sampleThat('comfortable'),
  overrun: sampleThat('overruns'),
  angle: 'front',
  readProduction: (fileId) => productionBytes(fileId) ?? '',
});

describe('what the contract asks that the suite cannot see', () => {
  it('declines a piece with no areas drawn on it, with a reason and not a throw', () => {
    const verdict = impl.available({ productKey: 'keyring', quantity: 1 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason.trim().length).toBeGreaterThan(0);
  });

  it('hands a headless caller its own values back rather than a promise nobody settles', async () => {
    const initial = sampleThat('comfortable');
    await expect(
      impl.open({ productKey: 'walnut-coasters', quantity: 4 }, initial),
    ).resolves.toEqual(initial);
  });

  it('stores one picture per set of values, not one per call (AC17, as storage)', async () => {
    const a = await impl.render(sampleThat('comfortable'), {
      angle: 'front',
      widthPx: 320,
    });
    const b = await impl.render(sampleThat('comfortable'), {
      angle: 'front',
      widthPx: 320,
    });
    expect(b.fileId).toBe(a.fileId);
    // …and the size the picture was asked for is part of what makes it that
    // picture, so a thumbnail and a full-width canvas are two files.
    const wide = await impl.render(sampleThat('comfortable'), {
      angle: 'front',
      widthPx: 720,
    });
    expect(wide.fileId).not.toBe(a.fileId);
  });

  it('gives the production file an extension a laser opens and a font never has', async () => {
    const file = await impl.productionFile(sampleThat('comfortable'));
    expect(file.filename.endsWith('.svg')).toBe(true);
    expect(file.mediaType).toBe('image/svg+xml');
  });
});
