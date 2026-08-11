/**
 * The studio's own set-up: which pieces have areas drawn on them, and what the
 * maker has already sold.
 *
 * THIS IS THE ADD-ON'S DATA, NOT THE SHOP'S. A real install reads
 * `personalization_templates` and `personalizations` out of the host's
 * database — the two tables `manifest.json` declares. In the demo they are
 * here, keyed by the same product keys Birch Row uses, which is exactly the
 * `DataSource` seam the example apps use one directory further out: the shape
 * the surfaces read does not change, only where it comes from.
 *
 * NOT ONE ORDER REFERENCE IS IN THIS FILE ANY MORE, and their absence is the
 * point. It used to carry `BR-2281`/`l_5510` — a particular shop's order and
 * line ids — and look personalizations up by them. A reference is a host's own
 * vocabulary; a piece and the customer's own words are not, and that is what
 * every surface here resolves by now (`store.ts`). Nothing below is dated,
 * either: no clock is read anywhere in this package.
 *
 * The four sample personalizations are chosen to be visibly different lengths,
 * because that is what the suites need to prove: one comfortably short, one
 * that overruns and shows the remedies, one in a painted finish rather than
 * engraved, and one on the house sign.
 */

import type { Personalization, Template, Zone } from '@adminium/add-on-host/contracts';

import { defaultSizeMm, REQUIRED_SUFFIX } from './template.ts';

/** The four angles every set-up piece carries, in the order the strip shows them. */
export const ANGLE_LABELS: readonly { id: string; labelKey: string }[] = [
  { id: 'front', labelKey: 'addon.personalizer.angle.front' },
  { id: 'three', labelKey: 'addon.personalizer.angle.three' },
  { id: 'top', labelKey: 'addon.personalizer.angle.top' },
  { id: 'detail', labelKey: 'addon.personalizer.angle.detail' },
];

function angles(productKey: string): Template['angles'] {
  return ANGLE_LABELS.map((angle) => ({
    id: angle.id,
    // The LABEL is an i18n key here and the surface resolves it. The contract
    // types it as a string and says nothing about what kind, which is the
    // honest reading: a label a host renders has to be translatable, and a
    // second field for that would be a contract change for one add-on.
    label: angle.labelKey,
    fileId: `art_${productKey}_${angle.id}`,
  }));
}

/**
 * A text zone, with the four percentages that place it on each angle.
 *
 * `name` IS AN i18n KEY HERE, and `zoneLabel` in `i18n/t.ts` explains why: the
 * areas this package ships already drawn are named by this package, so their
 * names translate; an area a maker renames becomes their own words and is
 * rendered exactly as typed. One field, two kinds of string, told apart by the
 * key prefix rather than by a second field nobody would keep in step.
 */
function textZone(
  id: string,
  name: string,
  shapeMm: { xMm: number; yMm: number; wMm: number; hMm: number },
  piece: { widthMm: number; heightMm: number },
  constraints: Zone['constraints'],
  finish: Zone['finish'] = 'engraved',
): Zone {
  const pct = {
    xPct: (shapeMm.xMm / piece.widthMm) * 100,
    yPct: (shapeMm.yMm / piece.heightMm) * 100,
    wPct: (shapeMm.wMm / piece.widthMm) * 100,
    hPct: (shapeMm.hMm / piece.heightMm) * 100,
  };
  return {
    id,
    name,
    kind: 'text-line',
    shape: { type: 'rect', ...shapeMm },
    constraints,
    finish,
    perAngle: {
      front: pct,
      // A skew on the angled views is what makes the words sit ON the surface
      // rather than float over it. It is a rotation of a couple of degrees plus
      // the group's own shear — 24 D18, in one number, and nothing three-
      // dimensional anywhere near it.
      three: { ...pct, skewDeg: -3 },
      top: { ...pct, skewDeg: 0 },
      detail: pct,
    },
  };
}

const COASTER = { widthMm: 95, heightMm: 95 };
const SIGN = { widthMm: 250, heightMm: 120 };

/**
 * The walnut coasters — two areas, which is what comp L designs the shopper's
 * surface around: a top line of up to twenty-four characters and a date of up
 * to twelve.
 */
export const COASTER_TEMPLATE: Template = {
  productKey: 'walnut-coasters',
  angles: angles('walnut-coasters'),
  zones: [
    textZone(
      `top${REQUIRED_SUFFIX}`,
      'addon.personalizer.zone.top',
      { xMm: 10, yMm: 28, wMm: 75, hMm: 18 },
      COASTER,
      { maxChars: 24, fonts: ['fenwick', 'row', 'alder'], minSizeMm: 4, maxSizeMm: 9 },
    ),
    textZone(
      'date',
      'addon.personalizer.zone.date',
      { xMm: 22, yMm: 54, wMm: 51, hMm: 11 },
      COASTER,
      { maxChars: 12, fonts: ['fenwick', 'row', 'alder'], minSizeMm: 4, maxSizeMm: 5.5 },
    ),
  ],
};

/** The slate house sign — one long area, and nothing else. */
export const SIGN_TEMPLATE: Template = {
  productKey: 'house-sign',
  angles: angles('house-sign'),
  zones: [
    textZone(
      `name${REQUIRED_SUFFIX}`,
      'addon.personalizer.zone.house',
      { xMm: 28, yMm: 38, wMm: 194, hMm: 44 },
      SIGN,
      { maxChars: 22, fonts: ['fenwick', 'bramley', 'quarry'], minSizeMm: 12, maxSizeMm: 24 },
    ),
  ],
};

export const TEMPLATES: readonly Template[] = [COASTER_TEMPLATE, SIGN_TEMPLATE];

export function templateFor(productKey: string): Template | undefined {
  return TEMPLATES.find((template) => template.productKey === productKey);
}

/**
 * WHAT EACH SEEDED PIECE IS CALLED — as a key, exactly like `ANGLE_LABELS`.
 *
 * ── THE SLUG THAT SHIPPED ON A MAKER-FACING SCREEN ──────────────────────────
 *
 * The set-up route drew its two chips from a hard-coded array and rendered the
 * PRODUCT KEY as their body: the live DOM read `walnut-coasters` and
 * `house-sign`, in every one of the eight locales, on a page a maker uses. A
 * machine key is not a name in any language, and rendering one is the same
 * defect as leaving a string untranslated — worse, because it looks like a bug
 * rather than an omission.
 *
 * A `Template` cannot carry the name: its shape is `product-personalizer@1`'s,
 * the contract is frozen, and a display label is not a field it has. So the
 * name lives beside the seed that needs it, as a message key, which is the
 * pattern this file already uses for the angles a piece is photographed from
 * (`ANGLE_LABELS`) and the zones drawn on it.
 *
 * THESE TWO PIECES ARE THIS ADD-ON'S OWN DEMO SEED, not a host's catalogue —
 * the same status as the templates above, and the reason it is allowed to name
 * them at all. A real installation draws its list from the shop's products; a
 * key here with no name is caught by `template.test.ts` rather than falling
 * back to the slug, because falling back to the slug is what this replaced.
 */
export const PIECE_NAME_KEYS: Readonly<Record<string, string>> = {
  'walnut-coasters': 'addon.personalizer.piece.walnut-coasters',
  'house-sign': 'addon.personalizer.piece.house-sign',
};

/** Pieces the shop sells that have no areas drawn on them yet. */
export const NOT_SET_UP = ['ply-coasters', 'keyring', 'stoneware-mug'] as const;

/** What the maker types into the sample panel while setting a piece up. */
export const SAMPLE_VALUES: Readonly<Record<string, Record<string, string>>> = {
  'walnut-coasters': { [`top${REQUIRED_SUFFIX}`]: 'The Hartleys', date: 'est. 2019' },
  'house-sign': { [`name${REQUIRED_SUFFIX}`]: 'Ivy Cottage' },
};

export function sampleFor(template: Template): Personalization {
  return {
    templateId: template.productKey,
    values: { ...(SAMPLE_VALUES[template.productKey] ?? {}) },
    font: template.zones[0]?.constraints.fonts?.[0] ?? 'fenwick',
    sizeMm: defaultSizeMm(template),
    finish: 'engraved',
  };
}

export interface SampleLine {
  /**
   * What this one is here to show. A word for a reader of this file, never an
   * id anything is looked up by.
   */
  shows: 'comfortable' | 'painted' | 'overruns' | 'the-house-sign';
  personalization: Personalization;
}

/**
 * FOUR SAMPLE PERSONALIZATIONS, chosen for their lengths.
 *
 * ── THEY USED TO CARRY A HOST'S ORDER REFERENCES, AND THAT WAS THE DEFECT ───
 *
 * Each row began `ref: 'BR-2281', lineId: 'l_5510'` — Birch Row's own order
 * reference and its own line id, written down in an add-on's repo — and
 * `lineFor(lineId)` looked a personalization up by one of them. Three things
 * were wrong with it and only the third was visible:
 *
 *   1. IT IS ONE SHOP'S VOCABULARY, exactly like the delivery add-on seeding
 *      the print works' `MP-4126`. A second host has different references, so
 *      the table is dead weight there by construction.
 *   2. IT WAS NEVER TRUE HERE EITHER. Birch Row's `BR-2281` is a bookmark for
 *      Priya; this file claimed it was four walnut coasters for the Hartleys.
 *      Nothing compared them, because nothing could.
 *   3. AND THE CALL SITE PASSED THE WRONG ONE: `lineFor(payload.order.ref)`
 *      handed an ORDER reference to a function matching LINE ids, so the branch
 *      could not match under any data at all. Dead code guarding dead data.
 *
 * WHAT REPLACED IT is the key the basket already used, one module over: a line
 * is found by the PIECE and the CUSTOMER'S OWN WORDS (`store.ts`). Those are
 * fields every host of these surfaces carries — `SlotItem.key` and
 * `SlotItem.note` — so the same lookup works in a shop this add-on has never
 * seen, and a line placed before the add-on was ever connected still resolves,
 * because its words are on it.
 *
 * These four stay because the ENGINE's suite and the CONTRACT's conformance
 * suite need values with known lengths — one comfortable, one in a painted
 * finish rather than engraved, one that overruns and shows both remedies with
 * their numbers, and one on the other piece entirely. A demo in which nothing
 * ever fails cannot show what the failure looks like. They are fixtures now,
 * and nothing at runtime looks anything up in them.
 */
export const SAMPLE_LINES: readonly SampleLine[] = [
  {
    shows: 'comfortable',
    personalization: {
      templateId: 'walnut-coasters',
      values: { [`top${REQUIRED_SUFFIX}`]: 'The Hartleys', date: 'est. 2019' },
      font: 'fenwick',
      sizeMm: 7,
      finish: 'engraved',
    },
  },
  {
    shows: 'painted',
    personalization: {
      templateId: 'walnut-coasters',
      values: { [`top${REQUIRED_SUFFIX}`]: 'Morrow & Vale', date: 'Midsummer' },
      font: 'row',
      sizeMm: 7,
      finish: 'painted',
    },
  },
  {
    shows: 'overruns',
    personalization: {
      templateId: 'walnut-coasters',
      values: { [`top${REQUIRED_SUFFIX}`]: 'The Ellingham-Brookes', date: '2026' },
      font: 'fenwick',
      sizeMm: 7,
      finish: 'engraved',
    },
  },
  {
    shows: 'the-house-sign',
    personalization: {
      templateId: 'house-sign',
      values: { [`name${REQUIRED_SUFFIX}`]: 'Ivy Cottage' },
      font: 'bramley',
      sizeMm: 22,
      finish: 'engraved',
    },
  },
];

/** One sample by what it demonstrates — for a suite, never for a surface. */
export function sampleThat(shows: SampleLine['shows']): Personalization {
  return SAMPLE_LINES.find((line) => line.shows === shows)!.personalization;
}
