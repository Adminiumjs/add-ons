/**
 * The sample business, as facts: forty items in six places, three suppliers,
 * and one month of what happened to them. Nothing here is random: every row
 * is written down or follows from a fixed rule, so the figures the screens
 * show on a fresh install are the same on every machine and every engine.
 *
 * The month is "last month": a day of it is a day of the month (1–30), and
 * the bundle writes it relative to the day the sample is added.
 */

/** A place and whether what is in it can be sold or used. */
export const PLACES: readonly (readonly [name: string, forSale: boolean])[] = [
  ['Shop floor', true],
  ['Back room', true],
  ['Treatment room', true],
  ['Linen store', true],
  ['At the laundry', false],
  ['Damaged', false],
];

export const SUPPLIERS: readonly { name: string; email: string; leadDays: number; initials: string }[] = [
  { name: 'Northgate Wholesale', email: 'orders@northgate.example', leadDays: 3, initials: 'NW' },
  { name: 'Medisupply Direct', email: 'desk@medisupply.example', leadDays: 2, initials: 'MS' },
  { name: 'Harbour Linen Co.', email: 'hello@harbourlinen.example', leadDays: 5, initials: 'HL' },
];

export const SETTINGS = { businessName: 'Alder Street Clinic', deliverTo: '214 Alder Street, Portland, OR 97204', defaultPlace: 'Shop floor' } as const;

export interface Item {
  sku: string;
  name: string;
  category: string;
  unit: string;
  /** The place it is kept in. */
  place: string;
  opening: number;
  reorderLevel: number;
  reorderQty: number;
  /** What one costs, in cents. */
  cost: number;
  supplier: string;
  /** How many come in a pack. */
  pack: number;
  /** How many go on a day the business is open. */
  dailyUse: number;
  tracksBatches: boolean;
}

const item = (
  sku: string,
  name: string,
  category: string,
  unit: string,
  place: string,
  opening: number,
  reorderLevel: number,
  reorderQty: number,
  cost: number,
  supplier: string,
  pack: number,
  dailyUse: number,
  tracksBatches = false,
): Item => ({ sku, name, category, unit, place, opening, reorderLevel, reorderQty, cost, supplier, pack, dailyUse, tracksBatches });

const NW = 'Northgate Wholesale';
const MS = 'Medisupply Direct';
const HL = 'Harbour Linen Co.';

export const ITEMS: readonly Item[] = [
  item('TS-BLU-S', 'T-shirt, blue, S', 'Clothing', 'each', 'Shop floor', 14, 6, 12, 740, NW, 6, 0),
  item('TS-BLU-M', 'T-shirt, blue, M', 'Clothing', 'each', 'Shop floor', 22, 8, 12, 740, NW, 6, 1),
  item('TS-BLU-L', 'T-shirt, blue, L', 'Clothing', 'each', 'Shop floor', 18, 8, 12, 740, NW, 6, 0),
  item('TS-WHT-M', 'T-shirt, white, M', 'Clothing', 'each', 'Shop floor', 20, 8, 12, 690, NW, 6, 0),
  item('TS-WHT-L', 'T-shirt, white, L', 'Clothing', 'each', 'Shop floor', 16, 8, 12, 690, NW, 6, 0),
  item('TOTE-NAT', 'Canvas tote, natural', 'Bags', 'each', 'Shop floor', 30, 10, 20, 310, NW, 10, 1),
  item('TOTE-BLK', 'Canvas tote, black', 'Bags', 'each', 'Shop floor', 24, 10, 20, 330, NW, 10, 0),
  item('MUG-SPK', 'Mug, speckled', 'Homeware', 'each', 'Shop floor', 18, 6, 12, 480, NW, 6, 0),
  item('MUG-WHT', 'Mug, white', 'Homeware', 'each', 'Shop floor', 12, 6, 12, 420, NW, 6, 0),
  item('CNDL-FIG', 'Candle, fig', 'Homeware', 'each', 'Shop floor', 15, 5, 10, 560, NW, 5, 0),
  item('CNDL-CED', 'Candle, cedar', 'Homeware', 'each', 'Shop floor', 15, 5, 10, 560, NW, 5, 0),
  item('NB-A5', 'Notebook, A5', 'Stationery', 'each', 'Shop floor', 40, 12, 24, 220, NW, 12, 1),
  item('PEN-BLK', 'Pen, black', 'Stationery', 'each', 'Shop floor', 120, 20, 50, 45, NW, 50, 2),
  item('CARD-GRT', 'Greeting card', 'Stationery', 'each', 'Shop floor', 80, 25, 50, 90, NW, 25, 2),
  item('BAG-PPR', 'Paper bag, medium', 'Packaging', 'each', 'Back room', 400, 150, 250, 12, NW, 250, 9),
  item('TISSUE', 'Tissue paper', 'Packaging', 'sheet', 'Back room', 900, 300, 480, 3, NW, 480, 20),
  item('TAPE', 'Parcel tape', 'Packaging', 'roll', 'Back room', 12, 4, 6, 170, NW, 6, 0),
  item('BOX-S', 'Shipping box, small', 'Packaging', 'each', 'Back room', 90, 30, 50, 55, NW, 25, 2),
  item('BOX-M', 'Shipping box, medium', 'Packaging', 'each', 'Back room', 60, 30, 50, 80, NW, 25, 1),
  item('LBL-SHIP', 'Shipping label', 'Packaging', 'each', 'Back room', 500, 200, 500, 2, NW, 500, 3),
  item('SYR-5', 'Syringe 5 ml', 'Clinical', 'each', 'Treatment room', 180, 100, 200, 18, MS, 100, 6, true),
  item('SYR-10', 'Syringe 10 ml', 'Clinical', 'each', 'Treatment room', 140, 50, 100, 24, MS, 100, 2, true),
  item('NDL-23G', 'Needle 23G', 'Clinical', 'each', 'Treatment room', 360, 100, 200, 6, MS, 100, 8, true),
  item('AMP-SAL', 'Saline ampoule 10 ml', 'Clinical', 'each', 'Treatment room', 200, 60, 100, 35, MS, 50, 4, true),
  item('AMP-LID', 'Lidocaine 1% ampoule', 'Clinical', 'each', 'Treatment room', 40, 20, 50, 110, MS, 10, 1, true),
  item('VAC-FLU', 'Flu vaccine, single dose', 'Clinical', 'each', 'Treatment room', 60, 20, 40, 980, MS, 10, 2, true),
  item('SWAB-ALC', 'Alcohol swab', 'Clinical', 'each', 'Treatment room', 600, 200, 400, 2, MS, 200, 14, true),
  item('GLV-M', 'Gloves, nitrile, M', 'Clinical', 'pair', 'Treatment room', 300, 100, 200, 9, MS, 100, 10),
  item('GLV-L', 'Gloves, nitrile, L', 'Clinical', 'pair', 'Treatment room', 200, 100, 200, 9, MS, 100, 4),
  item('PLST', 'Plaster strip', 'Clinical', 'each', 'Treatment room', 300, 100, 200, 4, MS, 100, 6),
  item('GAUZE', 'Gauze pad, sterile', 'Clinical', 'each', 'Treatment room', 150, 50, 100, 11, MS, 50, 3, true),
  item('SHARPS', 'Sharps bin 1 l', 'Clinical', 'each', 'Treatment room', 6, 3, 6, 290, MS, 6, 0),
  item('TWL-BATH', 'Bath towel', 'Linen', 'each', 'Linen store', 260, 40, 40, 650, HL, 10, 0),
  item('TWL-HAND', 'Hand towel', 'Linen', 'each', 'Linen store', 260, 40, 40, 280, HL, 10, 0),
  item('SHEET-D', 'Sheet set, double', 'Linen', 'set', 'Linen store', 140, 24, 20, 2100, HL, 5, 0),
  item('ROBE', 'Bathrobe', 'Linen', 'each', 'Linen store', 36, 12, 12, 1400, HL, 6, 0),
  item('AMN-KIT', 'Amenity kit', 'Guest supplies', 'each', 'Linen store', 260, 60, 120, 135, HL, 60, 5),
  item('SOAP', 'Soap bar 30 g', 'Guest supplies', 'each', 'Linen store', 400, 100, 200, 22, HL, 100, 9),
  item('SLIPR', 'Slippers', 'Guest supplies', 'pair', 'Linen store', 150, 40, 60, 95, HL, 30, 3),
  item('TEA-SEL', 'Tea selection box', 'Guest supplies', 'each', 'Linen store', 48, 20, 24, 160, HL, 12, 1),
];

export const ITEM = new Map(ITEMS.map((it) => [it.sku, it]));

/** The categories, in the order the items first name them. */
export const CATEGORIES: readonly string[] = [...new Set(ITEMS.map((it) => it.category))];

/**
 * When a batch runs out: a fixed date, or so many days after the day the
 * sample is added (two batches are close to their date on purpose, whatever
 * day that is).
 */
export type Expiry = { date: string } | { inDays: number };

/** The batch each batch-tracked item opens the month in. */
export const OPENING_BATCH: Readonly<Record<string, { code: string; expires: Expiry }>> = {
  'SYR-5': { code: 'L2406', expires: { date: '2029-06-30' } },
  'SYR-10': { code: 'L2411', expires: { date: '2029-04-30' } },
  'NDL-23G': { code: 'N7731', expires: { date: '2030-01-31' } },
  'AMP-SAL': { code: 'S5520', expires: { date: '2027-03-31' } },
  'AMP-LID': { code: 'LD118', expires: { inDays: 19 } },
  'VAC-FLU': { code: 'FV26A', expires: { inDays: 26 } },
  'SWAB-ALC': { code: 'A9001', expires: { date: '2028-08-31' } },
  GAUZE: { code: 'G4410', expires: { date: '2028-02-29' } },
};

/** The days of the month the business was closed (its Sundays). */
export const CLOSED: readonly number[] = [6, 13, 20, 27];
export const DAYS = 30;

/** One room turnover sends this much linen to the laundry. */
export const LINEN_SET: readonly (readonly [sku: string, each: number])[] = [
  ['TWL-BATH', 2],
  ['TWL-HAND', 2],
  ['SHEET-D', 1],
];
export const TURNOVERS = 96;
export const SETS_BACK = 84;
export const LINEN_DAY = 30;

/** Purchase order 1001: sent on the 11th, received in full on the 14th. */
export const PO_1001 = {
  number: 1001,
  supplier: MS,
  place: 'Treatment room',
  sentOn: 11,
  receivedOn: 14,
  lines: [
    { sku: 'SWAB-ALC', packs: 2, batch: { code: 'A9117', expires: { date: '2028-11-30' } as Expiry } },
    { sku: 'GLV-M', packs: 2, batch: null },
    { sku: 'SYR-5', packs: 1, batch: { code: 'L2502', expires: { date: '2029-09-30' } as Expiry } },
  ],
} as const;

/** Purchase order 1002: sent two days before the sample is added, expected that day, nothing received. */
export const PO_1002 = {
  number: 1002,
  supplier: MS,
  place: 'Treatment room',
  lines: [
    { sku: 'GLV-L', packs: 2 },
    { sku: 'AMP-LID', packs: 5 },
    { sku: 'VAC-FLU', packs: 4 },
  ],
} as const;

/** What was thrown away, and the one sale that came back. */
export const WRITE_OFFS: readonly { day: number; sku: string; qty: number; reason: 'broken' | 'stained' }[] = [
  { day: 9, sku: 'MUG-SPK', qty: 2, reason: 'broken' },
  { day: 22, sku: 'ROBE', qty: 1, reason: 'stained' },
];
export const PUT_BACK = { day: 18, sku: 'TS-WHT-M', qty: 1, note: 'Order cancelled' } as const;

/** The count of the Shop floor on the 26th, and the three items it found a difference on. */
export const COUNT = { day: 26, place: 'Shop floor', differences: [['PEN-BLK', -3], ['CARD-GRT', -2], ['NB-A5', 1]] as readonly (readonly [string, number])[] } as const;

export interface KitLine {
  sku: string;
  qty: number;
  per: 'unit' | 'night';
  action: 'use' | 'move';
}
const line = (sku: string, qty: number, action: KitLine['action'] = 'use', per: KitLine['per'] = 'unit'): KitLine => ({ sku, qty, per, action });

export const KITS: readonly { name: string; lines: readonly KitLine[] }[] = [
  { name: 'Flu vaccination', lines: [line('VAC-FLU', 1), line('SYR-5', 1), line('NDL-23G', 1), line('SWAB-ALC', 2), line('PLST', 1), line('GLV-M', 1)] },
  { name: 'Dressing change', lines: [line('GAUZE', 2), line('AMP-SAL', 1), line('PLST', 2), line('GLV-M', 1)] },
  { name: 'Room turnover', lines: [line('TWL-BATH', 2, 'move'), line('TWL-HAND', 2, 'move'), line('SHEET-D', 1, 'move'), line('AMN-KIT', 1), line('SOAP', 2), line('TEA-SEL', 1, 'use', 'night')] },
];
/** Where a kit's "move" lines send their linen. */
export const KIT_MOVES_TO = 'At the laundry';

export type Kind = 'opening' | 'received' | 'sold' | 'used' | 'returned' | 'adjusted' | 'moved_out' | 'moved_in' | 'written_off';

/** Something that happened to one item in one place: what the ledger holds a row for. */
export interface Move {
  day: number;
  /** The wall time, `HH:MM`: a fixed base for its kind plus a minute for each one before it that day. */
  time: string;
  sku: string;
  place: string;
  /** The batch's code; null for stock in no named batch. */
  batch: string | null;
  kind: Kind;
  /** Signed: what went out is below zero. */
  qty: number;
  /** What it belongs to, for the document rows built from it. */
  of: { doc: 'opening' } | { doc: 'use' } | { doc: 'po-1001'; line: number } | { doc: 'transfer'; n: 1 | 2; line: number } | { doc: 'write-off'; n: number } | { doc: 'put-back' } | { doc: 'count'; sku: string };
}

const BASE: Readonly<Record<Kind, number>> = {
  opening: 8 * 60,
  received: 11 * 60 + 30,
  returned: 12 * 60 + 10,
  written_off: 16 * 60,
  moved_out: 14 * 60,
  moved_in: 14 * 60,
  sold: 17 * 60,
  used: 17 * 60,
  adjusted: 18 * 60 + 30,
};
export const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const levelKey = (sku: string, place: string, batch: string | null): string => `${sku}|${place}|${batch ?? ''}`;

/**
 * The month, replayed: every movement in the order it is written down, and
 * the quantity each level ends on. Throws if a level would go below zero.
 */
export function replay(): { moves: Move[]; levels: Map<string, number> } {
  const moves: Move[] = [];
  const levels = new Map<string, number>();
  const seen = new Map<string, number>();
  const post = (day: number, sku: string, place: string, batch: string | null, kind: Kind, qty: number, of: Move['of']): void => {
    const key = levelKey(sku, place, batch);
    const now = (levels.get(key) ?? 0) + qty;
    if (now < 0) throw new Error(`${sku} in ${place} would go below zero on day ${String(day)}`);
    levels.set(key, now);
    const slot = `${String(day)}|${String(BASE[kind])}`;
    const before = seen.get(slot) ?? 0;
    seen.set(slot, before + 1);
    moves.push({ day, time: clock(BASE[kind] + before), sku, place, batch, kind, qty, of });
  };
  const openBatch = (sku: string): string | null => OPENING_BATCH[sku]?.code ?? null;

  for (const it of ITEMS) post(1, it.sku, it.place, openBatch(it.sku), 'opening', it.opening, { doc: 'opening' });

  // What goes on a day the business is open, while there is any: sold from the shop floor, used anywhere else.
  for (let day = 1; day <= DAYS; day += 1) {
    if (CLOSED.includes(day)) continue;
    for (const it of ITEMS) {
      if (it.dailyUse === 0) continue;
      const take = Math.min(it.dailyUse, levels.get(levelKey(it.sku, it.place, openBatch(it.sku))) ?? 0);
      if (take > 0) post(day, it.sku, it.place, openBatch(it.sku), it.place === 'Shop floor' ? 'sold' : 'used', -take, { doc: 'use' });
    }
  }

  // Linen: every turnover sends a set to the laundry, and the laundry has brought most of them back.
  const sent = LINEN_SET.map(([sku, each]) => Math.min(TURNOVERS * each, levels.get(levelKey(sku, 'Linen store', null)) ?? 0));
  LINEN_SET.forEach(([sku], k) => post(LINEN_DAY, sku, 'Linen store', null, 'moved_out', -sent[k]!, { doc: 'transfer', n: 1, line: k }));
  LINEN_SET.forEach(([sku, each], k) => {
    post(LINEN_DAY, sku, KIT_MOVES_TO, null, 'moved_in', sent[k]!, { doc: 'transfer', n: 1, line: k });
    const back = Math.min(sent[k]!, SETS_BACK * each);
    post(LINEN_DAY, sku, KIT_MOVES_TO, null, 'moved_out', -back, { doc: 'transfer', n: 2, line: k });
    post(LINEN_DAY, sku, 'Linen store', null, 'moved_in', back, { doc: 'transfer', n: 2, line: k });
  });

  PO_1001.lines.forEach((ordered, k) => {
    const it = ITEM.get(ordered.sku)!;
    post(PO_1001.receivedOn, it.sku, it.place, ordered.batch?.code ?? null, 'received', ordered.packs * it.pack, { doc: 'po-1001', line: k });
  });

  const [broken, stained] = WRITE_OFFS as [(typeof WRITE_OFFS)[number], (typeof WRITE_OFFS)[number]];
  post(broken.day, broken.sku, ITEM.get(broken.sku)!.place, null, 'written_off', -broken.qty, { doc: 'write-off', n: 0 });
  post(PUT_BACK.day, PUT_BACK.sku, ITEM.get(PUT_BACK.sku)!.place, null, 'returned', PUT_BACK.qty, { doc: 'put-back' });
  post(stained.day, stained.sku, ITEM.get(stained.sku)!.place, null, 'written_off', -stained.qty, { doc: 'write-off', n: 1 });

  for (const [sku, difference] of COUNT.differences) post(COUNT.day, sku, COUNT.place, null, 'adjusted', difference, { doc: 'count', sku });

  return { moves, levels };
}

/** The items the reorder rule drafts an order for: at or under their level in their own place, and on no open order. */
export function toReorder(levels: ReadonlyMap<string, number>): Item[] {
  const onOrder = new Set<string>(PO_1002.lines.map((ordered) => ordered.sku));
  return ITEMS.filter((it) => {
    const have = [...levels].filter(([key]) => key.startsWith(`${it.sku}|${it.place}|`)).reduce((sum, [, qty]) => sum + qty, 0);
    return have <= it.reorderLevel && !onOrder.has(it.sku);
  });
}

/** A code a till can scan, made up for the sample: 200, nine digits and the check digit. */
export function barcode(n: number): string {
  const body = `200${String(n).padStart(9, '0')}`;
  const sum = [...body].reduce((total, digit, k) => total + Number(digit) * (k % 2 === 1 ? 3 : 1), 0);
  return body + String((10 - (sum % 10)) % 10);
}
