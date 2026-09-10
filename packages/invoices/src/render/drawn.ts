/**
 * WHICH OF THE AUTHORED BLOCK KINDS THIS RENDERER ACTUALLY DRAWS — and which
 * it does not.
 *
 * ── WHY THIS FILE EXISTS RATHER THAN A CLAIM IN A COMMENT ──────────────────
 *
 * The editor's canvas offers twenty-seven block kinds
 * (`block-vocabulary.json`, held byte-equal across the trees by
 * `scripts/check-invoice-block-vocab.mjs`). This renderer draws a FIXED
 * LAYOUT: a heading, the two parties, a strip of facts, the line table, the
 * totals ladder, and a passage for each of the prose sections. That is enough
 * for every one of the twelve starters at the point they are created, and it
 * is not the whole vocabulary.
 *
 * A renderer that quietly drew eighteen of twenty-seven and said nothing would
 * be the worst version of this: somebody switches on a sign-off block in the
 * editor, sees it on screen, downloads the PDF, and it is not there. So the
 * gap is a LIST, exported, asserted by `vocabulary.test.ts`, and the day a
 * block joins `DRAWN` it has to leave `NOT_YET_DRAWN` or the suite goes red.
 *
 * ── THE HONEST STATUS ──────────────────────────────────────────────────────
 *
 * Nine of the twenty-seven are drawn. The other eighteen are the comp's
 * optional sections and its four custom types, and drawing them is real work
 * per section — each has its own fields, its own table shape, and its own
 * behaviour on a till roll. It belongs to the fidelity walk against the comp,
 * not to the contract purchase this package was built for.
 */

/** The block kinds this renderer puts on a page today. */
export const DRAWN: readonly string[] = [
  'meta',
  'parties',
  'items',
  'totals',
  'taxbreak',
  'discount',
  'terms',
  'paynotes',
  'legal',
];

/**
 * The rest, with what a reader loses by their absence.
 *
 * Each entry is a section somebody can switch on in the editor and will not
 * find on a rendered document. The reason is the same for all of them and is
 * stated once rather than eighteen times: this package was built to buy and
 * prove the `document-render@1` contract, and the layout it ships is the one
 * every starter needs on the day it is made. Widening it is per-section work
 * against `Invoice Builder.dc.html`.
 */
export const NOT_YET_DRAWN: readonly string[] = [
  'approval',
  'attachments',
  'contact',
  'custom.gallery',
  'custom.image',
  'custom.kv',
  'custom.text',
  'delivery',
  'latefees',
  'loyalty',
  'multicurrency',
  'payhistory',
  'poterms',
  'qr',
  'recurring',
  'refund',
  'shipping',
  'signature',
];
