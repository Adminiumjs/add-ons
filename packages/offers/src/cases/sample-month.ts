/**
 * SEPTEMBER, ORDER BY ORDER.
 *
 * The sample a fresh install can add is not made up row by row: it is what
 * the adjuster answers for a month of orders. Twenty-six open days, twelve
 * orders a day, the same twelve baskets in turn; codes typed by the people
 * who would type them, a leaflet's vouchers from the day it went out, a dozen
 * reductions given by hand. Every figure the sample shows — 126 uses, $610.18
 * given by rules, $57.48 by staff — is a sum over these answers.
 */

import type { AdjustCode, AdjustInput, AdjustLine } from '@adminium/add-on-contracts';

import { ask, code, CODES, ITEMS, LEAFLET, line, OFFERS, PRICES, typedVoucher, voucher } from './adjust.cases.ts';

/** The twelve baskets, in turn; each day starts one later. */
export const PATTERNS: readonly (readonly [string, number][])[] = [
  [['NB-A5', 1], ['PEN-BLK', 2]],
  [['TOTE-NAT', 2], ['CARD-GRT', 1]],
  [['MUG-SPK', 1], ['CNDL-FIG', 1]],
  [['TS-BLU-M', 1], ['TOTE-BLK', 1]],
  [['CARD-GRT', 3]],
  [['TS-WHT-M', 1], ['NB-A5', 2]],
  [['TS-WHT-L', 1]],
  [['CNDL-CED', 2], ['MUG-WHT', 1]],
  [['PEN-BLK', 5], ['NB-A5', 2]],
  [['TS-BLU-L', 2]],
  [['MUG-WHT', 2]],
  [['TOTE-BLK', 1], ['CARD-GRT', 2]],
];

/** Reductions given by hand, written down: the day of September and the order of that day → the reason, and how much. */
const BY_HAND: Readonly<Record<string, { reason: string; kind: 'percent' | 'amount'; value: string }>> = {
  '3:11': { reason: '1', kind: 'percent', value: '20' },
  '10:2': { reason: '1', kind: 'percent', value: '20' },
  '17:8': { reason: '1', kind: 'amount', value: '3.00' },
  '24:11': { reason: '1', kind: 'percent', value: '20' },
  '5:11': { reason: '2', kind: 'percent', value: '10' },
  '16:2': { reason: '2', kind: 'amount', value: '5.00' },
  '29:10': { reason: '2', kind: 'percent', value: '10' },
  '2:8': { reason: '3', kind: 'percent', value: '15' },
  '9:11': { reason: '3', kind: 'percent', value: '15' },
  '15:11': { reason: '3', kind: 'percent', value: '15' },
  '22:11': { reason: '3', kind: 'percent', value: '15' },
  '30:0': { reason: '3', kind: 'percent', value: '15' },
};

/** 1 September 2026 is a Tuesday; the shop is closed on Sundays. */
const weekdayOf = (day: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 => ((2 + day - 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const OPEN_DAYS: readonly number[] = Array.from({ length: 30 }, (_, at) => at + 1).filter((day) => weekdayOf(day) !== 0);

const two = (value: number): string => String(value).padStart(2, '0');
const cents = (text: string): number => Math.round(Number(text) * 100);

export interface SampleOrder {
  /** 1 … 312. */
  number: number;
  /** The day of September. */
  day: number;
  slot: number;
  /** `HH:MM`, on the shop's clock. */
  time: string;
  lines: AdjustLine[];
  codes: AdjustCode[];
  signedIn: boolean;
  staff: AdjustInput['staff'];
}

/** The 312 orders, with what was typed and given on each. What a code has been used so far is the runner's to keep. */
export function sampleOrders(): SampleOrder[] {
  const out: SampleOrder[] = [];
  let candleUsed = false;
  let leaflet = 0;
  OPEN_DAYS.forEach((day, k) => {
    for (let slot = 0; slot < 12; slot += 1) {
      const basket = PATTERNS[(slot + k) % 12]!;
      const subtotal = basket.reduce((total, [sku, quantity]) => total + cents(PRICES[sku]!) * quantity, 0);
      const codes: AdjustCode[] = [];
      let signedIn = false;
      // A voucher for a candle, used once, on the first basket of the twelfth that holds one.
      const candle = day === 12 && !candleUsed ? basket.find(([sku]) => sku.startsWith('CNDL'))?.[0] : undefined;
      if (candle !== undefined) {
        candleUsed = true;
        codes.push(typedVoucher('VC-ONECANDLE01', voucher(1, 'One candle', { worth: 'thing', what: 'item', source_table: ITEMS, source_row: candle })));
      }
      // A new customer, signed in; the launch code while it ran; the autumn code by those who read "$30 or more".
      if (slot === 3 || (slot === 9 && k < 15)) {
        codes.push(code('WELCOME10'));
        signedIn = true;
      } else if ([0, 4, 6, 10].includes(slot) && k < 13) codes.push(code('LAUNCH20'));
      else if ([1, 5, 7].includes(slot) && day >= 14 && subtotal >= 3000) codes.push(code('AUTUMN5'));
      if (([2, 8].includes(slot) && day >= 21) || (slot === 11 && day >= 25)) {
        leaflet += 1;
        codes.push(typedVoucher(`VC-LEAFLET${String(leaflet).padStart(4, '0')}`, LEAFLET(100 + leaflet)));
      }
      const hand = BY_HAND[`${String(day)}:${String(slot)}`];
      const minutes = 9 * 60 + 30 + 40 * slot;
      out.push({
        number: out.length + 1,
        day,
        slot,
        time: `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`,
        lines: basket.map(([sku, quantity], at) => line(String(at + 1), sku, quantity)),
        codes,
        signedIn,
        staff: hand === undefined ? null : { kind: hand.kind, value: hand.value, reason: hand.reason, ceiling: null, judge: false },
      });
    }
  });
  return out;
}

/** The question one of the month's orders puts, with the offers as they stood when it was placed. `launchUses`: how often LAUNCH20 was used before it. */
export function questionOf(order: SampleOrder, launchUses: number): AdjustInput {
  const date = `2026-09-${two(order.day)}`;
  const offers = OFFERS.map((row) => (row['id'] === 5 ? { ...row, uses: launchUses, used_up: launchUses >= 50 } : { ...row, uses: 0 }));
  const codes = order.codes.map((one) => (one.typed === 'LAUNCH20' ? { ...one, row: { ...CODES['LAUNCH20']!, uses: launchUses } } : one));
  return ask({
    lines: order.lines,
    codes,
    customer: order.signedIn ? { key: `sample:c${String(order.number).padStart(3, '0')}`, groups: [], orders: 0, uses: {} } : null,
    staff: order.staff,
    offers,
    when: { today: date, weekday: weekdayOf(order.day), time: order.time, now: `${date}T${order.time}:00.000Z` } as never,
    more: { point: 'post', origin: 'staff' },
  });
}
