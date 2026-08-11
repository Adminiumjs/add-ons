/**
 * THE THREE SURFACES, COMPARED BYTE FOR BYTE (AC17) — and every failing verdict
 * checked for the button that carries its number (AC18).
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * Criterion 17 says the cart thumbnail, the proof and the order line are the
 * same picture. Three things asserted it and none of them looked:
 * `template.ts`'s header said so in prose, `personalizer.ts`'s header said the
 * stronger thing ("every surface goes through `drawPreview`") and was simply
 * wrong, and the conformance suite compared `render()` with `render()` — the
 * contract method, which no surface in this package called. Meanwhile the cart
 * drew the preview at 184px, the order line opened the PRODUCTION file — a
 * structurally different SVG in the studio's cut alphabet — and the proof drew
 * the host's own material tile. Two of the three pictures were wrong and every
 * suite was green.
 *
 * So this one renders the FILLS THE HOST MOUNTS, through the payloads the host
 * hands them, and compares the bytes that come out. Prose cannot pass it.
 *
 * ── WHY `renderToStaticMarkup` ──────────────────────────────────────────────
 *
 * This repo ships no jsdom (see `import-canva/src/client/settings-panel.test.tsx`,
 * which made the same call). Nothing under test here needs a layout or an
 * event: `useT` hands `useSyncExternalStore` a server snapshot, the fills' only
 * state is which panel is open, and the picture is a pure function of its
 * values. The static render IS the component tree rather than a stand-in for
 * it.
 */

import type {
  CartLinePayload,
  OrderLinePayload,
  PersonalizePayload,
  SlotItem,
} from '@adminium/add-on-host';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { drawPreview, LINE_PICTURE, previewBytes, resetFiles } from '../personalizer.ts';
import { COASTER_TEMPLATE, sampleThat } from '../seed.ts';
import { commit, forgetAll, isReady, recall, remember, summarize } from '../store.ts';
import {
  check,
  digestOf,
  nameSvg,
  productionSvg,
  remediesFor,
  type Personalization,
  type Remedy,
} from '../template.ts';
import { translate, type TFunction } from '../i18n/t.ts';
import { pictureName } from './bits.tsx';
import { Personalize } from './Personalize.tsx';
import { blockReason, LinePreviewFill, OrderLineFill, PersonalizeFill } from './fills.tsx';

/**
 * The `t` a static render sees: no `document`, so `useT` serves `en-US`.
 * Naming this rather than reaching for the hook keeps the expectation and the
 * component reading the same bundle for the same stated reason.
 */
const inEnglish: TFunction = (key, params) => translate('en-US', key, params);

const svgIn = (markup: string): string => {
  const found = markup.match(/<svg[\s\S]*?<\/svg>/);
  expect(found, 'the surface drew no picture at all').not.toBeNull();
  return found![0];
};

/**
 * The same personalization seen from three different records.
 *
 * The three `SlotItem`s deliberately DISAGREE about everything except the two
 * fields that identify what was asked for: the basket's line has a basket id
 * and a price, the order's has an order-line id and a different quantity. If
 * any of that reached the picture, these would not be one image — and one of
 * them reaching it is exactly how the old `lineFor(payload.order.ref)` lookup
 * would have produced a different answer on the bench than in the basket.
 */
const basketLine = (note: string): SlotItem => ({
  id: 'b_1',
  key: 'walnut-coasters',
  label: 'Walnut coasters',
  quantity: 4,
  note,
  unitPrice: { amount: 3200, currency: 'USD' },
});

const orderLine = (note: string): SlotItem => ({
  id: 'ol_88',
  key: 'walnut-coasters',
  label: 'Walnut coasters',
  quantity: 6,
  note,
  unitWeightGrams: 214,
});

const cart = (line: SlotItem): CartLinePayload => ({ line });
const order = (line: SlotItem): OrderLinePayload => ({
  order: { ref: 'ANY-1', recipient: { name: 'A customer' }, placedOn: '2026-08-06' },
  line,
});

describe('one picture, three surfaces (AC17)', () => {
  beforeEach(() => {
    forgetAll();
    resetFiles();
  });

  /**
   * THE CRITERION, AS BYTES.
   *
   * The proof is the third surface and it is the one that had none: the host
   * drew a material tile with a lucide icon beside the customer's words. It
   * mounts `cart.line.preview` now — the id names a SURFACE, "the picture of
   * one line", and a proof is one line of an order with its picture beside it —
   * so the fill under test here is the fill the proof renders, handed the
   * order's record rather than the basket's.
   */
  it('draws the identical SVG in the basket, on the proof and on the order line', () => {
    const p = sampleThat('comfortable');
    const note = summarize(p);
    remember(p);

    const inBasket = svgIn(renderToStaticMarkup(<LinePreviewFill payload={cart(basketLine(note))} />));
    const onProof = svgIn(renderToStaticMarkup(<LinePreviewFill payload={cart(orderLine(note))} />));
    const onOrderLine = svgIn(renderToStaticMarkup(<OrderLineFill payload={order(orderLine(note))} />));

    expect(onProof).toBe(inBasket);
    expect(onOrderLine).toBe(inBasket);
    /*
     * …and it is the engine's own bytes, at the one set of options the three
     * surfaces share, rather than three strings that happen to match.
     *
     * PLUS THE NAME, which is the one thing on the picture that belongs to the
     * READER rather than to the piece. `nameSvg` is applied at the surface and
     * not inside `previewSvg` precisely so the digest below stays a fact about
     * the picture; the three surfaces still agree byte for byte because all
     * three compute the same name from the same values.
     */
    const picture = drawPreview(p, COASTER_TEMPLATE, LINE_PICTURE).svg;
    expect(inBasket).toBe(nameSvg(picture, pictureName(inEnglish, p, COASTER_TEMPLATE)));
    expect(inBasket).toContain('aria-label="');
  });

  /**
   * THE HEADER'S CLAIM, CHECKED. `personalizer.ts` says every surface goes
   * through `drawPreview`, "so the picture a shopper sees is by construction
   * the one whose id travels on the order". It said that while the surfaces
   * called `previewSvg` and filed nothing. The store is empty at the start of
   * this case; if a surface drew without filing, the id is not there.
   */
  it('files what it draws, so the picture on screen has the id that travels', () => {
    const p = sampleThat('comfortable');
    remember(p);
    expect(previewBytes(`prv_${digestOf(drawPreview(p, COASTER_TEMPLATE, LINE_PICTURE).svg)}`))
      .toBeDefined();

    resetFiles();
    const drawn = svgIn(renderToStaticMarkup(<LinePreviewFill payload={cart(basketLine(summarize(p)))} />));
    /*
     * THE ID IS THE DIGEST OF THE PICTURE, AND THE PICTURE IS WHAT IS ON THE
     * SCREEN WITH ITS NAME TAKEN OFF. Stripping is how this case stays a check
     * on the seam rather than on itself: it starts from the markup the surface
     * really produced and gets back to a file id, which is exactly the trip an
     * order makes.
     */
    const picture = drawn.replace(/ aria-label="[^"]*"/, '').replace(/<title>[^<]*<\/title>/, '');
    expect(picture, 'the name was not the only difference').not.toBe(drawn);
    expect(
      previewBytes(`prv_${digestOf(picture)}`),
      'the surface drew a picture that was never filed',
    ).toBe(picture);
  });

  /**
   * AND THE COMPARISON IS NOT TRIVIAL. The order line used to open straight
   * onto the production file, and that file is a real picture of the same
   * values — so "the order line draws the preview" only means something if the
   * two are demonstrably different pictures.
   */
  it('is a real comparison — the machine file is a different picture entirely', () => {
    const p = sampleThat('comfortable');
    expect(productionSvg(p, COASTER_TEMPLATE)).not.toBe(
      drawPreview(p, COASTER_TEMPLATE, LINE_PICTURE).svg,
    );
  });

  /**
   * A LINE THE ADD-ON NEVER SAW STILL RESOLVES, THE SAME WAY EVERYWHERE.
   *
   * Every order on the bench was placed before this add-on was connected, so
   * `recall` misses on all of them and the words on the line are the only
   * thing there is. The basket fill used to give up at that point and render
   * nothing — which is why the proof stayed blank on a seeded order even after
   * the slot was mounted there.
   */
  it('resolves a line from the customer’s own words alone, identically on all three', () => {
    const note = 'Bex & Sam · 2026';
    const inBasket = svgIn(renderToStaticMarkup(<LinePreviewFill payload={cart(basketLine(note))} />));
    const onOrderLine = svgIn(renderToStaticMarkup(<OrderLineFill payload={order(orderLine(note))} />));
    expect(onOrderLine).toBe(inBasket);
    // The words are in the picture, which is the whole reason to draw one.
    expect(inBasket).toContain('Bex &amp; Sam');
  });

  it('renders nothing at all for a line with no words on it', () => {
    expect(renderToStaticMarkup(<LinePreviewFill payload={cart(basketLine(''))} />)).toBe('');
    expect(renderToStaticMarkup(<OrderLineFill payload={order(orderLine(''))} />)).toBe('');
  });

  /**
   * A line that does not fit is DRAWN AND MARKED rather than drawn as though it
   * were finished. Orders arrive from the host carrying words nobody checked
   * against an area, and the picture of one of those is a picture of words
   * falling off the piece.
   */
  /**
   * The fixture is a CHARACTER THE STUDIO HAS NO LETTER FOR rather than a long
   * name, and the reason is worth writing down: a long name is not a problem
   * any more. A wording read out of a note is now sized to the largest that
   * fits, because that is what a maker does with words and no stated size, so
   * "The Ellingham-Brookes" comes back at 4 mm and fits. `é` cannot be cut at
   * any size, which is what this marker is actually for.
   */
  it('says on the line itself when the wording still does not fit', () => {
    const bad = 'Café Row · 2026';
    const markup = renderToStaticMarkup(<LinePreviewFill payload={cart(basketLine(bad))} />);
    expect(markup).toContain('needs a change before it can be cut');
    const fine = renderToStaticMarkup(
      <LinePreviewFill payload={cart(basketLine('The Hartleys · est. 2019'))} />,
    );
    expect(fine).not.toContain('needs a change before it can be cut');
  });
});

// ── what the shopper's surface writes back ──────────────────────────────────

/**
 * NOTHING SOMEBODY TYPED IS EVER THROWN AWAY.
 *
 * The fill wrote `setNote(isReady(next) ? remember(next) : '')`. Read it slowly:
 * on every keystroke that left ANY area failing it wrote an EMPTY STRING into
 * the host's own note field, and nothing gated "add to basket", so a shopper
 * could type a name too long for the coaster, add it, and find a blank line in
 * their basket. Verified live before the fix with zones `[bad, warn]`: the
 * button reported `disabled: false` and the typed words were gone.
 *
 * The rule is one named function now precisely so this suite can hold it.
 */
describe('the customer’s words survive a failing personalization', () => {
  beforeEach(() => {
    forgetAll();
    resetFiles();
  });

  const failing: Personalization = {
    templateId: 'walnut-coasters',
    values: { [COASTER_TEMPLATE.zones[0]!.id]: 'The Ellingham-Brookes', date: '2026' },
    font: 'fenwick',
    sizeMm: 7,
    finish: 'engraved',
  };

  it('writes the words to the host even when a zone does not fit', () => {
    expect(isReady(failing), 'the fixture stopped failing').toBe(false);
    let written: string | undefined;
    commit(failing, (note) => {
      written = note;
    });
    expect(written).toBe('The Ellingham-Brookes · 2026');
  });

  it('does not file the picture of something the studio cannot make', () => {
    commit(failing, () => {});
    // Nothing to recall: the words are on the line, but no approved picture is
    // filed against them. The surfaces fall back to reading the words.
    expect(recall('walnut-coasters', 'The Ellingham-Brookes · 2026')).toBeUndefined();
  });

  it('writes the words AND files the picture when it fits', () => {
    const good = sampleThat('comfortable');
    let written: string | undefined;
    commit(good, (note) => {
      written = note;
    });
    expect(written).toBe('The Hartleys · est. 2019');
    expect(recall('walnut-coasters', written!)).toEqual(good);
  });
});

// ── AC18, on the surface rather than in the engine ──────────────────────────

/**
 * EVERY FAILING VERDICT RENDERS ITS NUMBER, AS A BUTTON.
 *
 * `template.test.ts` proves the ENGINE never returns a failure without a
 * numbered remedy. That is half the criterion and it was the half that was
 * true: `no-letter` carried `shortenToChars: 3` for "Café Row", the suite
 * asserted it, and the surface rendered a bare sentence with nothing under it,
 * because the surface reads the machine-readable half of `check` and the number
 * had never been mirrored onto it. A remedy a suite can see and a shopper
 * cannot is not a remedy — so this walks the failing classes and looks at what
 * is on the screen.
 */
describe('every failing verdict carries its number to the screen (AC18)', () => {
  const at = (values: Record<string, string>, over: Partial<Personalization> = {}) => ({
    templateId: 'walnut-coasters',
    values,
    font: 'fenwick',
    sizeMm: 7,
    finish: 'engraved' as const,
    ...over,
  });

  const TOP = COASTER_TEMPLATE.zones[0]!.id;

  /**
   * The text of every `.lp-remedy` button on the rendered panel, in order, AS A
   * READER SEES IT.
   *
   * The entities are undone because the swap remedies trade exactly the marks a
   * static render escapes — `'` comes back `&#x27;`, `&` comes back `&amp;` —
   * and a guard comparing raw markup would report "no button carries this
   * remedy's value" about a button that plainly does.
   */
  const remedyButtons = (markup: string): string[] =>
    [...markup.matchAll(/class="lp-remedy"[^>]*>([^<]*)</g)].map((m) =>
      m[1]!
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    );

  /**
   * What one remedy MUST be readable as, on the button that applies it.
   *
   * Not "a digit somewhere" — which is the whole of what the old guard asked.
   * A size button carrying the shortening's number would satisfy `/\d/` and
   * would be a button that does the wrong thing.
   */
  const valueOf = (remedy: Remedy): string =>
    remedy.kind === 'size'
      ? String(remedy.sizeMm)
      : remedy.kind === 'shorten'
        ? String(remedy.chars)
        : remedy.to;

  /** Each entry is a failing class and what a shopper is owed for it. */
  const CASES: readonly { code: string; value: Personalization; kinds: Remedy['kind'][] }[] = [
    // A letter with no plain form — the cut before it, at 3, and nothing else.
    { code: 'no-letter-stuck', value: at({ [TOP]: 'Café Row' }), kinds: ['shorten'] },
    // A mark with an exact plain form — the substitution, per mark, never the
    // deletion. Two of them here, so a surface offering "the first one" fails.
    { code: 'no-letter', value: at({ [TOP]: 'O’Brien — 19' }), kinds: ['swap', 'swap'] },
    // More characters than the area takes — cut to the limit, 24.
    { code: 'too-many', value: at({ [TOP]: 'ABCDEFGHIJKLMNOPQRSTUVWXYZABC' }), kinds: ['shorten'] },
    // Wider than the area at this size — BOTH ways out, each with its number.
    // This is the row the old guard could not hold.
    { code: 'overrun', value: at({ [TOP]: 'The Ellingham-Brookes' }), kinds: ['size', 'shorten'] },
  ];

  for (const kase of CASES) {
    it(`draws every remedy the engine offers a ${kase.code} verdict`, () => {
      const failing = check(kase.value, COASTER_TEMPLATE).detail.filter((d) => !d.ok);
      expect(failing.map((d) => d.code), 'the fixture stopped failing this way').toContain(
        kase.code,
      );

      /*
       * ── THE ENGINE'S LIST, NOT A NUMBER OF BUTTONS ────────────────────────
       *
       * What this replaces read `expect(buttons.length).toBeGreaterThan(0)` —
       * one button per FAILING CLASS. An `overrun` carries BOTH remedies (D5c),
       * so a verifier who wrapped the size button in `false &&` deleted a
       * working way out for every shopper whose wording will not fit at any
       * length, and this suite stayed green because the shortening button still
       * satisfied "more than zero".
       *
       * The expectation is the engine's own list, member for member: every
       * remedy `remediesFor` supplies must be on the screen CARRYING ITS OWN
       * VALUE, and there must be no more buttons than remedies either — a
       * surface inventing a way out the engine did not compute is the same
       * defect pointing the other way.
       */
      const expected = failing.flatMap((entry) => remediesFor(entry));
      expect(expected.map((r) => r.kind), 'the engine stopped offering these').toEqual(kase.kinds);

      const markup = renderToStaticMarkup(
        <Personalize template={COASTER_TEMPLATE} value={kase.value} onChange={() => {}} />,
      );
      const buttons = remedyButtons(markup);
      expect(
        buttons.length,
        `the engine offers ${expected.length} way(s) out of ${kase.code} and the screen draws ${buttons.length}: ${buttons.join(' | ')}`,
      ).toBe(expected.length);

      for (const remedy of expected) {
        expect(
          buttons.some((button) => button.includes(valueOf(remedy))),
          `no button carries the ${remedy.kind} remedy's own value (${valueOf(remedy)}): ${buttons.join(' | ')}`,
        ).toBe(true);
      }
    });
  }

  /**
   * THE MUTANT, REAPPLIED — because a guard nobody has watched fail is a guard
   * nobody has tested.
   *
   * The verifier's mutant was `false &&` in front of the SIZE button, one JSX
   * branch among four. There is no such branch any more: `Personalize` maps over
   * `remediesFor(entry)` and does not know the kinds, which makes that defect
   * unwritable rather than merely caught. So this reproduces it at the only
   * place it can still be expressed — the list on its way to the screen — and
   * shows the assertion above separates the two. It is the same defect in every
   * way that matters: the engine offers a size and a shortening, the shopper is
   * shown only the shortening.
   */
  it('separates the real surface from one that drops a remedy on the way', () => {
    const value = at({ [TOP]: 'The Ellingham-Brookes' });
    const failing = check(value, COASTER_TEMPLATE).detail.filter((d) => !d.ok);
    const expected = failing.flatMap((entry) => remediesFor(entry));
    expect(expected.map((r) => r.kind)).toEqual(['size', 'shorten']);

    const mutant = expected.filter((remedy) => remedy.kind !== 'size');
    const drawn = remedyButtons(
      renderToStaticMarkup(
        <Personalize template={COASTER_TEMPLATE} value={value} onChange={() => {}} />,
      ),
    );

    // What the guard asserts of the real surface, and what it would have said
    // about the mutant. Both, so neither half can be trusted on its own.
    expect(drawn.length).toBe(expected.length);
    expect(mutant.length, 'the mutant is indistinguishable from the real thing').not.toBe(
      expected.length,
    );
    // The size remedy is on the screen and is absent from the mutant — the
    // latter so firmly that `tsc` narrows `mutant` to the other two kinds and
    // refuses an assertion about it, which is a stronger statement than the
    // assertion would have been.
    const size = expected.find((remedy) => remedy.kind === 'size')!;
    expect(drawn.some((button) => button.includes(String(size.sizeMm)))).toBe(true);
    expect(mutant.map((remedy) => remedy.kind)).toEqual(['shorten']);
  });

  /**
   * THE ONE THING THAT IS NOT A VERDICT, and the reason the criterion can be
   * absolute about the ones that are. An empty required area has no number to
   * offer — "shorten it to N" is not advice about an empty box — so it is a
   * BLOCK, it is refused in plain words, and the host's own button now carries
   * that refusal (`setBlocked`).
   *
   * IT TAKES A HALF-FINISHED PANEL NOW, NOT AN UNTOUCHED ONE. This case used to
   * pass `at({})` and that is exactly the D19 defect `check` was repaired for:
   * an untouched panel is a shopper who wants a PLAIN coaster, which the shop
   * sells and sold a second earlier with the add-on switched off. The date typed
   * below is what makes this a personalization with a hole in it — the case the
   * maker's `:required` flag was written for — and the refusal belongs to that.
   */
  it('refuses an empty required area in words, with no button pretending to fix it', () => {
    const markup = renderToStaticMarkup(
      <Personalize
        template={COASTER_TEMPLATE}
        value={at({ date: 'est. 2019' })}
        onChange={() => {}}
      />,
    );
    expect(markup).toContain('can’t be left empty');
    expect(markup).not.toContain('lp-remedy');
  });

  /**
   * AND AN UNTOUCHED PANEL REFUSES NOTHING (24 D19).
   *
   * Switching this add-on ON used to disable "Add to basket" from the moment
   * the page opened, with a `--danger` note reading "Fill in Top line first."
   * on a product a shopper could have bought plain a second earlier. An add-on
   * arriving is a GAIN; a purchasable thing becoming unpurchasable is the
   * opposite, whichever way the sentence is worded.
   */
  it('offers a plain piece rather than a refusal when nothing has been typed', () => {
    const markup = renderToStaticMarkup(
      <Personalize template={COASTER_TEMPLATE} value={at({})} onChange={() => {}} />,
    );
    expect(markup).not.toContain('can’t be left empty');
    expect(markup).toContain('is made plain unless you type something');
    // …and the host is told there is nothing to refuse.
    // `blockReason` IS what the host's button is told (`PersonalizeGate`).
    expect(blockReason(inEnglish, at({}), COASTER_TEMPLATE)).toBeUndefined();
    expect(blockReason(inEnglish, at({ date: 'est. 2019' }), COASTER_TEMPLATE)).toBeDefined();
  });

  /**
   * THE DEAD-END REMEDY, ON THE SCREEN RATHER THAN IN THE ENGINE.
   *
   * `template.test.ts` proves the engine withholds `shortenToChars: 0`. This is
   * the half a shopper meets: a line opening on a letter the studio cannot cut
   * draws NO button at all, and says what the studio does cut instead of
   * "everything before it is fine" — which was false, there being nothing
   * before it. In ar-EG this was the outcome of a shopper's first keystroke.
   */
  it('offers nothing to press when the first character is one it cannot cut', () => {
    const markup = renderToStaticMarkup(
      <Personalize template={COASTER_TEMPLATE} value={at({ [TOP]: 'مرحبا' })} onChange={() => {}} />,
    );
    expect(markup).not.toContain('lp-remedy');
    expect(markup).not.toContain('Shorten it to 0');
    expect(markup).toContain('nothing stands before it to keep');
  });
});

// ── the note field, on a piece with no areas drawn on it ────────────────────

/**
 * SWITCHING THE ADD-ON ON MUST NOT TAKE A FIELD AWAY (D19).
 *
 * `product.options.personalize` is a `single` slot, so the host's own note
 * field disappears the moment a fill mounts. Two of Birch Row's twelve pieces
 * have a template; on the other ten this fill rendered a sentence and no input
 * at all, so a shopper who could type onto a keyring with the add-on off could
 * type nothing with it on. Driven and confirmed in the DOM on all twelve.
 *
 * The third case is what keeps this true for the thirteenth piece: a product
 * key this add-on has never heard of and never will.
 */
describe('a shopper can always say what they want (D19)', () => {
  const payloadFor = (key: string, noteLimit?: number): PersonalizePayload => ({
    product: { key, label: 'A piece', ...(noteLimit === undefined ? {} : { noteLimit }) },
    note: '',
    setNote: () => {},
  });

  it.each([
    ['a piece with areas drawn on it', 'walnut-coasters'],
    ['a piece the maker has not set up', 'keyring'],
    ['a piece this add-on has never heard of', 'brand-new-thing-2027'],
  ])('gives %s a writable field with a name on it', (_what, key) => {
    const markup = renderToStaticMarkup(<PersonalizeFill payload={payloadFor(key, 40)} />);

    const inputs = [...markup.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
    expect(inputs.length, `${key} rendered no input at all`).toBeGreaterThan(0);

    /*
     * AND EVERY ONE OF THEM IS NAMED. The inputs had no id, no wrapping
     * `<label>`, no `aria-label` and no `aria-labelledby`: a heading that looked
     * like a label sat above a control it did not point at, so a screen reader
     * announced "edit text, blank" on the one field this surface exists for.
     */
    const labelled = [...markup.matchAll(/<label\b[^>]*for="([^"]+)"/g)].map((m) => m[1]!);
    for (const input of inputs) {
      const id = /\bid="([^"]+)"/.exec(input)?.[1];
      const named =
        (id !== undefined && labelled.includes(id)) || /\baria-label(ledby)?="/.test(input);
      expect(named, `an input on ${key} has no accessible name: ${input}`).toBe(true);
    }
  });

  /**
   * AND IT KEEPS WHAT THE SHOP WAS ALREADY SAYING THERE.
   *
   * The first repair gave the FIELD back. The rest of the host's block went on
   * disappearing: its empty state on this slot is three parts — the field, the
   * maker's own instructions for the piece, and the promise that a picture
   * comes back before anything is made — and this fill replaced all three with
   * a field and one sentence of its own. Driven live on "Photo block", both
   * states on the same page, two of the three were simply gone.
   *
   * The host hands them over now (`hostSays`), and this asserts they come out
   * the other side verbatim. The template branch is exempt and says why in
   * `NoteFill`: there the shopper is shown the actual piece, which is a gain
   * rather than a loss.
   */
  it('keeps the shop’s own sentences on a piece it has not set up', () => {
    const says = [
      'Tell us the name and the date.',
      'We send a picture before anything is made.',
    ];
    const markup = renderToStaticMarkup(
      <PersonalizeFill payload={{ ...payloadFor('keyring', 40), hostSays: says }} />,
    );
    for (const line of says) {
      expect(markup, `the add-on dropped one of the host’s own sentences: ${line}`).toContain(
        line,
      );
    }
  });

  it('writes what is typed straight back to the host’s own note field (D16)', () => {
    // The words live in the HOST's field on every piece, set up or not, so a
    // disconnect leaves the customer's request in plain language rather than
    // locked inside a picture nobody can open.
    let written: string | undefined;
    const payload: PersonalizePayload = {
      ...payloadFor('keyring', 40),
      setNote: (note) => {
        written = note;
      },
    };
    const markup = renderToStaticMarkup(<PersonalizeFill payload={payload} />);
    // The host's own cap is honoured, because the words go back into the host's
    // own column and an add-on must not let a shopper type past it.
    expect(markup).toContain('maxLength="40"');
    payload.setNote('Sam & Jo · 2019');
    expect(written).toBe('Sam & Jo · 2019');
  });
});
