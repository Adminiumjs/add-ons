/**
 * USING, HOLDING AND GIVING BACK — the worked examples.
 *
 * Each case is a call as Adminium would make it and the answer it must get.
 * They are data, so the same list is run against the source, against the
 * built file, and through the contract's own checks.
 */

import { batch, call, type Case, ITEMS, kitLine, level, lineFor, link, movement, PLACE, point, SETTINGS, what } from './world.ts';

const I = ITEMS;
const LID = 'Lidocaine 1% ampoule';

// ── a treatment room: one tracked item, two batches ─────────────────────────
const lidPoint = point(100, I.lidocaine, PLACE.treatment, '64.000');
const LD118 = batch(500, I.lidocaine, 'LD118', '2026-10-20');
const LD201 = batch(501, I.lidocaine, 'LD201', '2027-04-30');
const lidReads = (first: string, second: string | null) => ({
  items: [I.lidocaine],
  points: [lidPoint],
  levels: [level(1000, lidPoint, LD118, first), ...(second === null ? [] : [level(1001, lidPoint, LD201, second)])],
  batches: [],
});
const lidLine = (inputs: Record<string, string | number | boolean | null>) => [lineFor('L1', { item: 10, place: PLACE.treatment, ...inputs })];

// ── a shop: a shirt that is out, a tote with four left ──────────────────────
const shirtPoint = point(200, I.tshirt, PLACE.shop, '0.000');
const totePoint = point(201, I.tote, PLACE.shop, '4.000', { low: 1 });
const toteBatch = batch(520, I.tote, '-', null, true);
const toteLevel = level(2010, totePoint, toteBatch, '4.000');
const shopLinks = [link(1, 'shirt', { item_id: 20, place_id: PLACE.shop }), link(2, 'tote', { item_id: 21, place_id: PLACE.shop })];
const shopReads = { links: shopLinks, kit_lines: [], items: [I.tshirt, I.tote], points: [shirtPoint, totePoint], levels: [toteLevel], batches: [toteBatch] };

// ── a hotel: the kit a room turnover uses ───────────────────────────────────
const TURNOVER = 900;
const linen = [I.bathTowel, I.handTowel, I.sheetSet] as const;
const used = [I.amenityKit, I.soap, I.tea] as const;
const store = [...linen, ...used].map((one, n) => point(300 + n, one, PLACE.linen, n === 3 ? '5.000' : '100.000'));
const away = linen.map((one, n) => point(310 + n, one, PLACE.laundry, '0.000'));
const plain = [...linen, ...used].map((one, n) => batch(530 + n, one, '-', null, true));
const storeLevels = store.map((at, n) => level(3000 + n, at, plain[n]!, at['on_hand'] as string));
const awayLevels = away.map((at, n) => level(3100 + n, at, plain[n]!, '0.000'));
const turnoverReads = {
  links: [link(3, 'room-12', { kind: 'kit', kit_id: TURNOVER, place_id: PLACE.linen })],
  kit_lines: [
    kitLine(1, TURNOVER, I.bathTowel, '2.000', { action: 'move', to_place_id: PLACE.laundry }),
    kitLine(2, TURNOVER, I.handTowel, '2.000', { action: 'move', to_place_id: PLACE.laundry }),
    kitLine(3, TURNOVER, I.sheetSet, '1.000', { action: 'move', to_place_id: PLACE.laundry }),
    kitLine(4, TURNOVER, I.amenityKit, '1.000'),
    kitLine(5, TURNOVER, I.soap, '2.000'),
    kitLine(6, TURNOVER, I.tea, '1.000', { per: 'night' }),
  ],
  items: [...linen, ...used],
  points: [...store, ...away],
  levels: [...storeLevels, ...awayLevels],
  batches: plain,
};

// ── a clinic: the kit a flu vaccination uses ────────────────────────────────
const FLU = 901;
const fluItems = [I.vaccine, I.syringe, I.needle, I.swab, I.plaster, I.gloves] as const;
const fluPoints = fluItems.map((one, n) => point(400 + n, one, PLACE.treatment, n === 0 ? '8.000' : '200.000'));
const FV26A = batch(540, I.vaccine, 'FV26A', '2027-01-31');
const fluBatches = fluItems.map((one, n) => (n === 0 ? FV26A : batch(540 + n, one, '-', null, true)));
const fluLevels = fluPoints.map((at, n) => level(4000 + n, at, fluBatches[n]!, at['on_hand'] as string));
const fluReads = {
  links: [link(4, 'flu', { kind: 'kit', kit_id: FLU, place_id: PLACE.treatment })],
  kit_lines: [1, 1, 1, 2, 1, 1].map((qty, n) => kitLine(10 + n, FLU, fluItems[n]!, `${String(qty)}.000`)),
  items: [...fluItems],
  points: fluPoints,
  levels: fluLevels,
  // The unassigned-batch read hands back only the batches nobody has named.
  batches: fluBatches.slice(1),
};

// ── a kitchen: a dish that uses two things ──────────────────────────────────
const DISH = 902;
const dishPoints = [point(600, I.soap, PLACE.shop, '8.000'), point(601, I.tea, PLACE.shop, '20.000')];
const dishReads = {
  links: [...shopLinks, link(5, 'dish', { kind: 'kit', kit_id: DISH, place_id: PLACE.shop })],
  kit_lines: [kitLine(20, DISH, I.soap, '1.000'), kitLine(21, DISH, I.tea, '1.000')],
  items: [I.tshirt, I.tote, I.soap, I.tea],
  points: [shirtPoint, totePoint, ...dishPoints],
  levels: [toteLevel],
  batches: [toteBatch],
};

const ONE = { quantity: 1 };
const unnamed = (itemId: number, at: number) => ({ batch: `b:${String(itemId)}:-`, level: `l:p${String(at)}:b:${String(itemId)}:-` });

export const CORE_CASES: Case[] = [
  {
    name: 'C6 · twenty ampoules: the batch that expires first goes first',
    input: call({ action: 'use-item', lines: lidLine({ quantity: 20 }), reads: lidReads('14.000', '50.000') }),
    expect: { rows: [movement('L1', 1000, 'used', '-14.000', '1.1000'), movement('L1', 1001, 'used', '-6.000', '1.1000')] },
  },
  {
    name: 'C7 · after its date a batch is never picked',
    input: call({ action: 'use-item', today: '2026-10-21', lines: lidLine(ONE), reads: lidReads('14.000', '44.000') }),
    expect: { rows: [movement('L1', 1001, 'used', '-1.000', '1.1000')] },
  },
  {
    name: 'C8 · an expired batch named by hand is refused on the add-on\'s own screens',
    input: call({ action: 'use-item', today: '2026-10-21', lines: lidLine({ ...ONE, batch: 500, strict: true, kind: 'used' }), reads: lidReads('14.000', '44.000') }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'expired', item: LID }] },
  },
  {
    name: 'C8 · and written off when that is what is asked',
    input: call({ action: 'use-item', today: '2026-10-21', lines: lidLine({ ...ONE, batch: 500, strict: true, kind: 'written_off' }), reads: lidReads('14.000', '44.000') }),
    expect: { rows: [movement('L1', 1000, 'written_off', '-1.000', '1.1000')] },
  },
  {
    name: 'C9 · only expired stock, a host\'s staff post: taken from the batch nobody has named, and the place to be counted',
    input: call({ action: 'use', today: '2026-10-21', lines: [lineFor('L1', { what: what('visit-7'), ...ONE })], reads: { ...lidReads('14.000', null), links: [link(6, 'visit-7', { item_id: 10, place_id: PLACE.treatment })], kit_lines: [] } }),
    expect: {
      rows: [
        { op: 'insert', table: 'batches', label: unnamed(10, 100).batch, line: 'L1', values: { item_id: 10, code: '-', unassigned: true, expires_on: null, received_on: null } },
        { op: 'insert', table: 'levels', label: unnamed(10, 100).level, line: 'L1', values: { stock_point_id: 100, batch_id: { '@row': unnamed(10, 100).batch } } },
        movement('L1', { '@row': unnamed(10, 100).level }, 'used', '-1.000', '1.1000'),
        { op: 'update', table: 'stock_points', line: 'L1', key: { id: 100 }, set: { needs_count: true } },
      ],
      notes: [
        { line: 'L1', note: 'short', item: LID },
        { line: 'L1', note: 'batch-unknown', item: LID },
      ],
    },
  },
  {
    name: 'C13 · a room turnover of two nights: linen goes to the laundry, the rest is used',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('room-12'), ...ONE }, { night: 2 })], reads: turnoverReads }),
    expect: {
      rows: [
        movement('L1', 3000, 'moved_out', '-2.000', '6.0000', {}, 'o1:L1'),
        movement('L1', 3100, 'moved_in', '2.000', '6.0000', { pair_id: { '@row': 'o1:L1' } }),
        movement('L1', 3001, 'moved_out', '-2.000', '3.0000', {}, 'o3:L1'),
        movement('L1', 3101, 'moved_in', '2.000', '3.0000', { pair_id: { '@row': 'o3:L1' } }),
        movement('L1', 3002, 'moved_out', '-1.000', '18.0000', {}, 'o5:L1'),
        movement('L1', 3102, 'moved_in', '1.000', '18.0000', { pair_id: { '@row': 'o5:L1' } }),
        movement('L1', 3003, 'used', '-1.000', '1.2000'),
        movement('L1', 3004, 'used', '-2.000', '0.3000'),
        movement('L1', 3005, 'used', '-2.000', '0.1000'),
      ],
    },
  },
  {
    name: 'C14 · a flu vaccination: six things used, the vaccine from its batch',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('flu'), ...ONE })], reads: fluReads }),
    expect: { rows: [1, 1, 1, 2, 1, 1].map((qty, n) => movement('L1', 4000 + n, 'used', `-${String(qty)}.000`, fluItems[n]!['cost_avg'] as string)) },
  },
  {
    name: 'C14 · and before it: enough for eight more, the vaccine runs out first',
    input: call({ action: 'use', mode: 'words', lines: [lineFor('L1', { what: what('flu'), ...ONE })], reads: fluReads }),
    expect: { rows: [], words: [{ line: 'L1', state: 'in', left: '8', exact: '8', after: '7', cause: 'stock', batch: 'FV26A', expires: '2027-01-31', first: { item: 'Flu vaccine, single dose', unit: 'each' } }] },
  },
  {
    name: 'C17 · the last four, held for a public buyer',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 4 })], reads: shopReads }),
    expect: { rows: [{ op: 'insert', table: 'reservations', line: 'L1', values: { stock_point_id: 201, qty: '4.000', state: 'held' } }] },
  },
  {
    name: 'C17 · and bought outright by one',
    input: call({ action: 'use', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 4, kind: 'sold' })], reads: shopReads }),
    expect: { rows: [movement('L1', 2010, 'sold', '-4.000', '3.1000')] },
  },
  {
    name: 'C17 · a fifth is refused, and told how many are left',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 5 })], reads: shopReads }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'out-of-stock', left: '4', item: 'Canvas tote natural' }] },
  },
  {
    name: 'C17 · two lines of one order see each other: three, then two',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 3 }), lineFor('L2', { what: what('tote'), quantity: 2 })], reads: shopReads }),
    expect: {
      rows: [{ op: 'insert', table: 'reservations', line: 'L1', values: { stock_point_id: 201, qty: '3.000', state: 'held' } }],
      refusals: [{ line: 'L2', reason: 'out-of-stock', left: '1', item: 'Canvas tote natural' }],
    },
  },
  {
    name: 'C18 · nothing on the books, and staff sold one: never refused',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('shirt'), ...ONE, kind: 'sold' })], reads: shopReads }),
    expect: {
      rows: [
        { op: 'insert', table: 'batches', label: unnamed(20, 200).batch, line: 'L1', values: { item_id: 20, code: '-', unassigned: true, expires_on: null, received_on: null } },
        { op: 'insert', table: 'levels', label: unnamed(20, 200).level, line: 'L1', values: { stock_point_id: 200, batch_id: { '@row': unnamed(20, 200).batch } } },
        movement('L1', { '@row': unnamed(20, 200).level }, 'sold', '-1.000', '7.4000'),
        { op: 'update', table: 'stock_points', line: 'L1', key: { id: 200 }, set: { needs_count: true } },
      ],
      notes: [{ line: 'L1', note: 'short', item: 'T-shirt blue M' }],
    },
  },
  {
    name: 'C19 · cancelled after placing: the hold is let go',
    input: call({ action: 'hold', phase: 'reverse', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 4 })], reads: shopReads, written: { reservations: [{ id: 70, stock_point_id: 201, qty: '4.000', state: 'held' }] } }),
    expect: { rows: [{ op: 'update', table: 'reservations', line: 'L1', key: { id: 70 }, set: { state: 'released' } }] },
  },
  {
    name: 'C19 · a use undone: each movement given back, naming the one it undoes',
    input: call({
      action: 'use-item',
      phase: 'reverse',
      lines: lidLine({ quantity: 20 }),
      reads: lidReads('0.000', '44.000'),
      written: { movements: [{ id: 80, level_id: 1000, kind: 'used', qty: '-14.000', unit_cost: '1.1000' }, { id: 81, level_id: 1001, kind: 'used', qty: '-6.000', unit_cost: '1.1000' }] },
    }),
    expect: { rows: [movement('L1', 1000, 'used', '14.000', '1.1000', { reverses_id: 80 }), movement('L1', 1001, 'used', '6.000', '1.1000', { reverses_id: 81 })] },
  },
  {
    name: 'C21 · a row linked to nothing: nothing written, and said so',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('unknown'), ...ONE })], reads: shopReads }),
    expect: { rows: [], notes: [{ line: 'L1', note: 'not-linked' }] },
  },
  {
    name: 'C22 · words: out, low, in, and the tightest of two',
    input: call({
      action: 'use',
      mode: 'words',
      origin: 'public',
      lines: [lineFor('shirt', { what: what('shirt'), ...ONE }), lineFor('tote', { what: what('tote'), ...ONE }), lineFor('other', { what: what('unknown'), ...ONE }), lineFor('dish', { what: what('dish'), ...ONE })],
      reads: dishReads,
    }),
    expect: {
      rows: [],
      words: [
        { line: 'shirt', state: 'out', left: '0', exact: '0', after: '0', cause: 'stock' },
        { line: 'tote', state: 'low', left: '4', exact: '4', after: '3', cause: 'stock' },
        { line: 'other', state: 'in' },
        { line: 'dish', state: 'in', left: '8', exact: '8', after: '7', cause: 'stock', first: { item: 'Soap', unit: 'each' } },
      ],
    },
  },
  {
    name: 'C24 · a refund line\'s goods, back on the shelf',
    input: call({ action: 'return', lines: [lineFor('L1', { what: what('tote'), ...ONE, to: 'shelf' })], reads: shopReads }),
    expect: { rows: [movement('L1', 2010, 'returned', '1.000', '3.1000')] },
  },
  {
    name: 'C24 · damaged: put back and written off, so what is on hand does not move',
    input: call({ action: 'return', lines: [lineFor('L1', { what: what('tote'), ...ONE, to: 'damaged' })], reads: shopReads }),
    expect: { rows: [movement('L1', 2010, 'returned', '1.000', '3.1000'), movement('L1', 2010, 'written_off', '-1.000', '3.1000')] },
  },
  {
    name: 'C24 · nothing came back',
    input: call({ action: 'return', lines: [lineFor('L1', { what: what('tote'), ...ONE, to: 'none' })], reads: shopReads }),
    expect: { rows: [] },
  },
  {
    name: 'C25 · a line that used nothing',
    input: call({ action: 'use-item', lines: lidLine({ quantity: 0 }), reads: lidReads('14.000', '50.000') }),
    expect: { rows: [] },
  },
  {
    name: 'also · a named batch goes before the one nobody has named',
    input: call({
      action: 'use-item',
      lines: lidLine({ quantity: 12 }),
      reads: { items: [I.lidocaine], points: [lidPoint], levels: [level(1002, lidPoint, batch(502, I.lidocaine, '-', null, true), '5.000'), level(1001, lidPoint, LD201, '10.000')], batches: [batch(502, I.lidocaine, '-', null, true)] },
    }),
    expect: { rows: [movement('L1', 1001, 'used', '-10.000', '1.1000'), movement('L1', 1002, 'used', '-2.000', '1.1000')] },
  },
  {
    name: 'also · two lines of one save: the second takes what the first left',
    input: call({ action: 'use-item', lines: [lineFor('L1', { item: 10, place: PLACE.treatment, quantity: 14 }), lineFor('L2', { item: 10, place: PLACE.treatment, quantity: 1 })], reads: lidReads('14.000', '50.000') }),
    expect: { rows: [movement('L1', 1000, 'used', '-14.000', '1.1000'), movement('L2', 1001, 'used', '-1.000', '1.1000')] },
  },
  {
    name: 'also · a customer cannot be promised stock that is past its date',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', today: '2026-10-21', lines: [lineFor('L1', { what: what('visit-7'), ...ONE })], reads: { ...lidReads('14.000', null), points: [point(100, I.lidocaine, PLACE.treatment, '14.000')], links: [link(6, 'visit-7', { item_id: 10, place_id: PLACE.treatment })], kit_lines: [] } }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'expired', left: '0', item: LID }] },
  },
  {
    name: 'also · a fifth bought outright by a customer is refused as a held one is',
    input: call({ action: 'use', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 5, kind: 'sold' })], reads: shopReads }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'out-of-stock', left: '4', item: 'Canvas tote natural' }] },
  },
  {
    name: 'also · an item that says stop is stopped though the settings allow',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', settings: { ...SETTINGS, when_out_public: 'allow' }, lines: [lineFor('L1', { what: what('shirt'), ...ONE })], reads: shopReads }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'out-of-stock', left: '0', item: 'T-shirt blue M' }] },
  },
  {
    name: 'also · and an item that says allow is promised though the settings stop',
    input: call({ action: 'hold', phase: 'reserve', origin: 'public', lines: [lineFor('L1', { what: what('tote'), quantity: 9 })], reads: { ...shopReads, items: [I.tshirt, { ...I.tote, when_out: 'allow' }] } }),
    expect: { rows: [{ op: 'insert', table: 'reservations', line: 'L1', values: { stock_point_id: 201, qty: '9.000', state: 'held' } }] },
  },
  {
    name: 'also · a row linked to two of a kit uses twice of everything',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('flu'), ...ONE })], reads: { ...fluReads, links: [link(4, 'flu', { kind: 'kit', kit_id: FLU, place_id: PLACE.treatment, qty: '2.000' })] } }),
    expect: { rows: [2, 2, 2, 4, 2, 2].map((qty, n) => movement('L1', 4000 + n, 'used', `-${String(qty)}.000`, fluItems[n]!['cost_avg'] as string)) },
  },
  {
    name: 'also · words promise nothing: two questions about one row get one answer',
    input: call({ action: 'use', mode: 'words', origin: 'public', lines: [lineFor('a', { what: what('tote'), ...ONE }), lineFor('b', { what: what('tote'), ...ONE })], reads: shopReads }),
    expect: {
      rows: [],
      words: [
        { line: 'a', state: 'low', left: '4', exact: '4', after: '3', cause: 'stock' },
        { line: 'b', state: 'low', left: '4', exact: '4', after: '3', cause: 'stock' },
      ],
    },
  },
  {
    name: 'also · a place the item was never kept in: the stock point is added, naming the place by the key the call handed over',
    input: call({ action: 'use-item', lines: [lineFor('L1', { item: 22, place: PLACE.back, quantity: 2, kind: 'sold' })], reads: { items: [I.pen], points: [], levels: [], batches: [], places: [{ id: PLACE.back, name: 'Back room' }] } }),
    expect: {
      rows: [
        // The key is the number it came as: Adminium lets an answer name only a row the call was shown, and "3" is not 3.
        { op: 'insert', table: 'stock_points', label: 'p:22:3', line: 'L1', values: { item_id: 22, place_id: 3, cost_avg: '0.4500' } },
        { op: 'insert', table: 'batches', label: 'b:22:-', line: 'L1', values: { item_id: 22, code: '-', unassigned: true, expires_on: null, received_on: null } },
        { op: 'insert', table: 'levels', label: 'l:p:22:3:b:22:-', line: 'L1', values: { stock_point_id: { '@row': 'p:22:3' }, batch_id: { '@row': 'b:22:-' } } },
        movement('L1', { '@row': 'l:p:22:3:b:22:-' }, 'sold', '-2.000', '0.4500'),
      ],
      notes: [{ line: 'L1', note: 'short', item: 'Pen, black' }],
    },
  },
  {
    name: 'also · a place the call was never shown: no stock point can be added there, so staff are told to look',
    input: call({ action: 'use', lines: [lineFor('L1', { what: what('tote'), ...ONE, place: 99 })], reads: { ...shopReads, links: [link(2, 'tote', { item_id: 21 })], points: [shirtPoint] } }),
    expect: { rows: [], notes: [{ line: 'L1', note: 'to-check', item: 'Canvas tote natural' }] },
  },
  {
    name: 'also · a batch named by hand is taken by the key it was named with',
    input: call({ action: 'use-item', lines: lidLine({ quantity: 3, batch: 501, kind: 'used' }), reads: lidReads('14.000', '50.000') }),
    expect: { rows: [movement('L1', 1001, 'used', '-3.000', '1.1000')] },
  },
  {
    name: 'C29 · words for a stock item: how many, which batch, and that it expires soon',
    input: call({ action: 'use-item', mode: 'words', lines: lidLine(ONE), reads: { ...lidReads('14.000', null), points: [point(100, I.lidocaine, PLACE.treatment, '14.000')] } }),
    expect: { rows: [], words: [{ line: 'L1', state: 'in', left: '14', exact: '14', after: '13', cause: 'stock', batch: 'LD118', expires: '2026-10-20', soon: true }] },
  },
  {
    name: 'C29 · words for a room: what runs out first',
    input: call({ action: 'use', mode: 'words', lines: [lineFor('L1', { what: what('room-12'), ...ONE })], reads: turnoverReads }),
    expect: { rows: [], words: [{ line: 'L1', state: 'in', left: '5', exact: '5', after: '4', cause: 'stock', first: { item: 'Amenity kit', unit: 'each' } }] },
  },
];
