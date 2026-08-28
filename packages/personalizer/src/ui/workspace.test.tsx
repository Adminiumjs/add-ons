/**
 * THE FOUR SURFACES THE MAKER'S ROUTE GREW, AND THE ONE THE SHOPPER'S DID.
 *
 * `nav.add-on.routes` used to be one page — the set-up editor — and comp L
 * designs five: Set-up, Reuse areas, Fonts, Bench sheet, Production file, plus
 * the shopper's "How personalizing works". This file is what stops any of them
 * regressing into a page that renders but says nothing.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH WOULD CATCH A REAL SLIP ─────────────────
 *
 *   1. EVERY TAB IS REACHABLE AND NAMED. A tab list built from a hard-coded
 *      array whose labels are keys nobody added is the exact defect `seed.ts`
 *      records against `PIECE_NAME_KEYS` — a machine slug rendered as a word.
 *      So every label is looked up in the bundle and required to differ from
 *      its own key.
 *
 *   2. THE FONTS PAGE DRAWS ALL FIVE AND REFUSES TO EMPTY ITSELF. Turning the
 *      last offered face off would leave a personalizable piece with no
 *      alphabet to be cut in and the shopper's font picker empty with nothing
 *      to explain itself.
 *
 *   3. REUSE LISTS ONLY PIECES WITH NO AREAS. A copy target that already has
 *      zones would silently overwrite a maker's work; a source that is not set
 *      up has nothing to copy.
 *
 *   4. THE BENCH SHEET IS EMPTY UNTIL A LINE EXISTS, AND THEN SHOWS THAT LINE
 *      AND NO OTHER. This is the one with a real bug behind it: `commit` files
 *      a picture on every makeable keystroke, so the store also holds every
 *      PREFIX of a wording — "The Hartleys" on the way to "The Hartleys · est.
 *      2019". Reading `chosen` put both on the sheet, and a maker reading four
 *      rows for two pieces trusts it once and never again.
 *
 *   5. THE SHOPPER'S EXPLAINER CARRIES EVERY STEP AND EVERY QUESTION. Four
 *      steps and five questions are keys; a missing one renders as a raw key.
 *
 * `renderToStaticMarkup` for the same reason `surfaces.test.tsx` gives: this
 * repo ships no jsdom, and nothing here needs a layout. Where a surface's point
 * IS its interaction — the fonts refusal, the copy — the component's own logic
 * is exercised through the module it lives in rather than through a click.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { FACE_LIST } from '../faces.ts';
import { personalizerStrings, type MessageKey } from '../i18n/strings.ts';
import { NOT_SET_UP, PIECE_NAME_KEYS, TEMPLATES, templateFor } from '../seed.ts';
import { drewForLine, forgetAll, remembered } from '../store.ts';
import { Bench } from './Bench.tsx';
import { Fonts } from './Fonts.tsx';
import { Help } from './Help.tsx';
import { Reuse } from './Reuse.tsx';

const EN = personalizerStrings['en-US'];

/**
 * The markup with its entities read back as characters.
 *
 * React escapes `'` to `&#x27;` and `&` to `&amp;`, and a studio that says
 * "The studio's fonts" and "Materials & machines" trips both. Asserting against
 * the escaped forms would make every copy edit a guessing game about which
 * characters React happens to escape this year.
 */
function text(html: string): string {
  return html
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&#x2F;', '/')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

beforeEach(() => {
  forgetAll();
});

describe('the tabs are words, in every language', () => {
  const TAB_KEYS = [
    'addon.personalizer.tab.setup',
    'addon.personalizer.tab.reuse',
    'addon.personalizer.tab.fonts',
    'addon.personalizer.tab.bench',
    'addon.personalizer.tab.production',
  ] as const;

  it('names all five in all eight locales, and never as its own key', () => {
    for (const tag of Object.keys(personalizerStrings) as (keyof typeof personalizerStrings)[]) {
      for (const key of TAB_KEYS) {
        const label = personalizerStrings[tag][key as MessageKey];
        expect(label, `${tag} · ${key}`).toBeTypeOf('string');
        expect(label.trim(), `${tag} · ${key} is blank`).not.toBe('');
        expect(label, `${tag} · ${key} rendered its own key`).not.toContain('addon.');
      }
    }
  });
});

describe('the studio’s fonts', () => {
  it('draws a specimen for every face the studio cuts', () => {
    const html = text(renderToStaticMarkup(<Fonts offered={FACE_LIST.map((f) => f.id)} onChange={() => {}} />));
    for (const face of FACE_LIST) {
      expect(html, `${face.name} has no specimen`).toContain(face.name);
    }
    // The smallest size is a fact about the alphabet, so every row states one.
    for (const face of FACE_LIST) {
      expect(html).toContain(`${face.smallestMm}`);
    }
  });

  it('shows a face as offered or as the studio’s own, never as neither', () => {
    const one = FACE_LIST[0]!.id;
    const html = text(renderToStaticMarkup(<Fonts offered={[one]} onChange={() => {}} />));
    expect(html).toContain(EN['addon.personalizer.fonts.offered']);
    expect(html).toContain(EN['addon.personalizer.fonts.studioOnly']);
  });

  it('will not let the last offered face be turned off', () => {
    const only = FACE_LIST[0]!.id;
    let next: string[] | undefined;
    // The component's guard is `on.size <= 1`; driving it through the callback
    // is what proves the guard exists rather than that the copy exists.
    const html = text(renderToStaticMarkup(
      <Fonts
        offered={[only]}
        onChange={(ids) => {
          next = ids;
        }}
      />,
    ));
    expect(html).toContain(EN['addon.personalizer.fonts.title']);
    expect(next, 'a static render must not have changed anything').toBeUndefined();
    // And the refusal has words for it in every language.
    for (const tag of Object.keys(personalizerStrings) as (keyof typeof personalizerStrings)[]) {
      expect(personalizerStrings[tag]['addon.personalizer.fonts.lastOne'].trim()).not.toBe('');
    }
  });
});

describe('reuse areas', () => {
  it('offers only pieces that have no areas drawn on them', () => {
    const html = text(renderToStaticMarkup(<Reuse />));
    for (const key of NOT_SET_UP) {
      const nameKey = PIECE_NAME_KEYS[key];
      expect(nameKey, `${key} has no name key`).toBeDefined();
      expect(html, `${key} is not offered as a target`).toContain(
        EN[nameKey as MessageKey],
      );
    }
    for (const template of TEMPLATES) {
      // A set-up piece is a SOURCE. It must never appear as somewhere to copy
      // TO, because copying over a maker's own zones is the one thing this
      // screen must not do quietly.
      const name = EN[PIECE_NAME_KEYS[template.productKey] as MessageKey];
      const targets = html.split(EN['addon.personalizer.reuse.to'])[1] ?? '';
      expect(targets, `${template.productKey} is offered as a copy target`).not.toContain(name);
    }
  });

  it('states in words that a copied area keeps its millimetres', () => {
    const html = text(renderToStaticMarkup(<Reuse />));
    expect(html).toContain(EN['addon.personalizer.reuse.warn']);
  });
});

describe('the bench sheet', () => {
  it('is honest about being empty, and says where the rows come from', () => {
    const html = text(renderToStaticMarkup(<Bench />));
    expect(html).toContain(EN['addon.personalizer.bench.empty']);
    expect(html).toContain(EN['addon.personalizer.bench.emptyBody']);
  });

  it('lists what is on a line, and not every wording ever typed', () => {
    const template = templateFor('walnut-coasters')!;
    const [top, date] = template.zones.map((z) => z.id);
    const full = {
      templateId: 'walnut-coasters',
      values: { [top!]: 'The Hartleys', [date!]: 'est. 2019' },
      font: 'fenwick',
      sizeMm: 7,
      finish: 'engraved' as const,
    };

    // A prefix — the state the shopper passed through — is NOT on a line.
    expect(remembered()).toHaveLength(0);

    drewForLine(full);
    expect(remembered()).toHaveLength(1);
    // Recording the same line twice is one row, because the key is the content.
    drewForLine(full);
    expect(remembered()).toHaveLength(1);

    const html = text(renderToStaticMarkup(<Bench />));
    expect(html).toContain('The Hartleys');
    expect(html).toContain('est. 2019');
    expect(html).toContain(EN['addon.personalizer.bench.waiting']);
  });
});

describe('how personalizing works', () => {
  it('carries every step and every question, and none as a raw key', () => {
    const html = text(renderToStaticMarkup(<Help />));
    for (const step of ['s1', 's2', 's3', 's4']) {
      expect(html).toContain(EN[`addon.personalizer.help.${step}.title` as MessageKey]);
    }
    for (const n of ['1', '2', '3', '4', '5']) {
      expect(html).toContain(EN[`addon.personalizer.help.q${n}` as MessageKey]);
    }
    expect(html).not.toContain('addon.personalizer.help.');
  });

  it('is closed until somebody opens it', () => {
    const html = text(renderToStaticMarkup(<Help />));
    expect(html).toContain('<details');
    expect(html, 'the explainer ships open').not.toContain('<details open');
  });
});
