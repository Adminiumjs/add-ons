/**
 * THE SAMPLE: A MONTH A FRESH INSTALL CAN ADD.
 *
 * Nothing here is made up row by row. The discounts' uses and what each took
 * off are what the adjuster answers for September's 312 orders
 * (`cases/sample-month.ts`); the cards and their rows are the ones the docs
 * quote. Adding sample data posts nothing and asks no price: each row is
 * written as it stands, and Adminium adds the totals up afterwards — so the
 * rows carry what the add-on's own code would have decided (an amount, a
 * balance after, a state) as plain values.
 *
 * The 312 orders are in no table: a use points at "Order 125" by its words.
 * Every moment is "last month" (or the one before), so what the Overview
 * calls last month is this month whatever day the sample is added.
 *
 * `scripts/sample.mjs` writes this to `seeds/offers.sample.json`;
 * `sample.test.ts` fails when the file is behind, and adds every figure up
 * again from the file.
 */
import type { AdjustOutput } from '@adminium/add-on-contracts';

import { adjust } from '../adjust/index.ts';
import { CODES, OFFERS, REASONS, TARGETS } from '../cases/adjust.cases.ts';
import { questionOf, sampleOrders, type SampleOrder } from '../cases/sample-month.ts';

export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'offers';
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
const ref = (label: string) => ({ '@ref': label });
const table = (name: string) => ({ '@table': name });
/** A day of a month counted from this one (−1: last month), and a wall time on it. */
const on = (month: number, day: number) => ({ '@month': month, '@dom': day });
const at = (month: number, day: number, time: string) => ({ '@month': month, '@dom': day, '@time': time });
const cents = (text: unknown): number => Math.round(Number(text) * 100);
const money = (value: number): string => (value / 100).toFixed(2);
/** A date of the cases, as a day counted from the sample's month (September is −1). */
const day = (date: unknown) => {
  if (typeof date !== 'string') return null;
  const [, month = '9', dom = '1'] = /^\d{4}-(\d{2})-(\d{2})/.exec(date) ?? [];
  return on(Number(month) - 10, Number(dom));
};

/* ── codes: fixed, so the file is the same every time it is written ─────── */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Twelve characters for the n-th voucher: no two alike, and none a word. */
export function sampleCode(n: number): string {
  let state = (n * 2654435761 + 97) >>> 0;
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += ALPHABET[(state >>> 8) % ALPHABET.length];
  }
  return out;
}

/* ── the cards and credits the docs quote ───────────────────────────────── */

type Moved = [month: number, day: number, time: string, kind: 'issue' | 'top_up' | 'spend' | 'refund' | 'void', amount: string];
interface Card {
  /** The code as it is said, or the credit's address. */
  name: string;
  credit?: true;
  status: 'active' | 'inactive' | 'void';
  rows: Moved[];
}
export const CARDS: readonly Card[] = [
  { name: 'GC-7K2M-W3HN-Q4XP', status: 'active', rows: [[-2, 3, '11:20', 'issue', '50.00'], [-1, 5, '13:05', 'spend', '-18.60'], [-1, 21, '16:40', 'spend', '-12.40']] },
  { name: 'GC-M9RD-5PTC-2HVT', status: 'active', rows: [[-2, 19, '10:10', 'issue', '100.00'], [-1, 12, '15:25', 'spend', '-64.25']] },
  { name: 'GC-4TQ8-B7YD-WN6C', status: 'active', rows: [[-1, 1, '09:45', 'issue', '25.00'], [-1, 2, '12:30', 'spend', '-25.00']] },
  { name: 'GC-P3XF-6ZKE-8KJD', status: 'active', rows: [[-1, 8, '14:00', 'issue', '50.00']] },
  { name: 'GC-H6VN-9CAG-R2MC', status: 'active', rows: [[-1, 8, '14:05', 'issue', '50.00'], [-1, 27, '11:50', 'spend', '-9.80'], [-1, 28, '10:05', 'refund', '9.80']] },
  { name: 'GC-2WDK-F8SJ-T7QF', status: 'active', rows: [[-1, 15, '17:15', 'issue', '150.00'], [-1, 29, '12:15', 'spend', '-88.00']] },
  { name: 'GC-X8C4-T2BV-NP3H', status: 'active', rows: [[-1, 20, '13:40', 'issue', '75.00'], [-1, 24, '09:55', 'top_up', '25.00']] },
  { name: 'GC-J5RM-E4WY-6VXQ', status: 'void', rows: [[-1, 23, '16:20', 'issue', '30.00'], [-1, 30, '16:40', 'void', '-30.00']] },
  { name: 'GC-Q7HT-N6ZA-K4WD', status: 'active', rows: [[-1, 26, '10:30', 'issue', '100.00']] },
  { name: 'GC-D2NF-H5GS-9MXR', status: 'inactive', rows: [] },
  // Money given back, kept as credit for an address: its rows are refunds, as credit given by hand is written.
  { name: 'ada@daybreak.example', credit: true, status: 'active', rows: [[-1, 11, '15:00', 'refund', '42.00'], [-1, 25, '14:35', 'spend', '-20.00']] },
  { name: 'tomas@daybreak.example', credit: true, status: 'active', rows: [[-1, 17, '11:10', 'refund', '16.50']] },
];
const cardLabel = (card: Card): string => `card:${card.credit === true ? card.name : card.name.slice(-4)}`;

/* ── vouchers ───────────────────────────────────────────────────────────── */

export const LEAFLET_NAME = 'Leaflet drop, October';
/** A pack: its name, its uses, what it was sold for, the day it was sold and the moments it was used (all last month but the sale). */
const PACKS: readonly { name: string; total: number; price: string; sold: [number, number]; used: [number, string][] }[] = [
  { name: '10 classes', total: 10, price: '120.00', sold: [-2, 28], used: [[3, '18:00'], [10, '18:00'], [17, '18:00'], [24, '18:00']] },
  { name: '5 car washes', total: 5, price: '45.00', sold: [-1, 1], used: [[4, '10:15'], [11, '10:15'], [18, '10:15'], [25, '10:15'], [29, '10:15']] },
];

/* ── the month ──────────────────────────────────────────────────────────── */

export interface Ran {
  order: SampleOrder;
  answer: AdjustOutput;
}
/** September, order by order, with the launch code's uses counted as it goes. */
export function runMonth(): Ran[] {
  const out: Ran[] = [];
  let launch = 0;
  for (const order of sampleOrders()) {
    const answer = adjust(questionOf(order, launch));
    launch += answer.uses.filter((use) => use.offer === '5').length;
    out.push({ order, answer });
  }
  return out;
}

const NAMES: Readonly<Record<string, Record<string, string>>> = {
  'Welcome 10': { 'en-US': '10 % off your first order', 'de-DE': '10 % auf Ihre erste Bestellung', 'fr-FR': '10 % sur votre première commande', 'da-DK': '10 % på din første ordre', 'cs-CZ': '10 % na první objednávku', 'ar-EG': 'خصم 10% على طلبك الأول', 'zh-CN': '首单九折', 'zh-TW': '首單九折' },
  'Monday mugs': { 'en-US': '15 % off mugs on Mondays', 'de-DE': '15 % auf Tassen am Montag', 'fr-FR': '15 % sur les mugs le lundi', 'da-DK': '15 % på krus om mandagen', 'cs-CZ': '15 % na hrnky v pondělí', 'ar-EG': 'خصم 15% على الأكواب يوم الاثنين', 'zh-CN': '周一马克杯八五折', 'zh-TW': '週一馬克杯八五折' },
  'Tote pair': { 'en-US': 'Two totes, the cheaper one on us', 'de-DE': 'Zwei Taschen, die günstigere geht auf uns', 'fr-FR': 'Deux sacs, le moins cher est offert', 'da-DK': 'To muleposer, den billigste er på os', 'cs-CZ': 'Dvě tašky, tu levnější platíme my', 'ar-EG': 'حقيبتان، والأرخص علينا', 'zh-CN': '托特包两件，低价的一件我们送', 'zh-TW': '托特包兩件，低價的一件我們送' },
  'Autumn 5': { 'en-US': '$5.00 off', 'de-DE': '5,00 $ Rabatt', 'fr-FR': '5,00 $ de remise', 'da-DK': '5,00 $ i rabat', 'cs-CZ': 'Sleva 5,00 $', 'ar-EG': 'خصم 5.00 $', 'zh-CN': '立减 5.00 美元', 'zh-TW': '現折 5.00 美元' },
  'Launch week': { 'en-US': '20 % off', 'de-DE': '20 % Rabatt', 'fr-FR': '20 % de remise', 'da-DK': '20 % rabat', 'cs-CZ': 'Sleva 20 %', 'ar-EG': 'خصم 20%', 'zh-CN': '八折', 'zh-TW': '八折' },
  'Summer close-out': { 'en-US': '25 % off', 'de-DE': '25 % Rabatt', 'fr-FR': '25 % de remise', 'da-DK': '25 % rabat', 'cs-CZ': 'Sleva 25 %', 'ar-EG': 'خصم 25%', 'zh-CN': '七五折', 'zh-TW': '七五折' },
};

export function buildSample(): Bundle {
  const month = runMonth();
  const offerLabel = (id: unknown): string => `offer:${String(id)}`;
  const codeOf = (id: unknown): string | undefined => Object.values(CODES).find((row) => String(row['id']) === String(id))?.['code'] as string | undefined;

  const settings = [{ card_min: '10.00', card_max: '500.00' }];
  const groups = [
    ['Newsletter', 3],
    ['Regulars', 2],
    ['Wholesale', 1],
  ] as const;
  let member = 0;
  const reasons = REASONS.map((row) => ({ '@label': `reason:${String(row['id'])}`, label: row['label'], active: true, position: row['position'] }));
  const ceilings = [
    { role: 'offers-desk', max_percent: 10, may_comp: false },
    { role: 'offers-manager', max_percent: 50, may_comp: false },
  ];

  // What a list shows of a discount is its own row; its uses and what it gave are added up from the uses below.
  const offers = OFFERS.map((row) => {
    const name = String(row['name']);
    const names = NAMES[name];
    if (names === undefined || LOCALES.some((tag) => names[tag] === undefined)) throw new Error(`the sample has no name in every language for ${name}`);
    return {
      '@label': offerLabel(row['id']),
      name,
      public_name: names,
      gives: row['gives'],
      ...(row['value'] === null || row['value'] === undefined ? {} : { value: row['value'] }),
      ...(row['buy_qty'] === null || row['buy_qty'] === undefined ? {} : { buy_qty: row['buy_qty'], bonus_qty: row['bonus_qty'] }),
      trigger: row['trigger'],
      applies_to: row['applies_to'],
      starts_on: day(row['starts_on']),
      ...(row['ends_on'] === null || row['ends_on'] === undefined ? {} : { ends_on: day(row['ends_on']) }),
      ...(row['weekdays'] === null || row['weekdays'] === undefined ? {} : { weekdays: row['weekdays'] }),
      ...(row['min_spend'] === null || row['min_spend'] === undefined ? {} : { min_spend: row['min_spend'] }),
      first_order_only: row['first_order_only'] === true,
      ...(row['max_uses'] === null || row['max_uses'] === undefined ? {} : { max_uses: row['max_uses'] }),
      ...(row['max_per_customer'] === null || row['max_per_customer'] === undefined ? {} : { max_per_customer: row['max_per_customer'] }),
      budget_open: true,
      combinable: row['combinable'] === true,
      status: row['status'],
      // "Used up" is the stored yes or no: an active discount whose every use is taken.
      used_up: row['used_up'] === true,
    };
  });
  const targets = TARGETS.map((row) => ({ offer_id: ref(offerLabel(row['offer_id'])), kind: row['kind'], source_table: '', source_row: row['source_row'], label: row['label'] }));
  const codes = Object.values(CODES).map((row) => ({ '@label': `code:${String(row['code'])}`, offer_id: ref(offerLabel(row['offer_id'])), code: row['code'], ...(row['max_uses'] === null ? {} : { max_uses: row['max_uses'] }), active: true }));

  /* The leaflet's vouchers the month used, by the id the cases gave each; and the one voucher for a thing. */
  const usedLeaflets = new Set(month.flatMap((ran) => ran.answer.uses.flatMap((use) => (use.voucher !== null && Number(use.voucher) > 100 ? [Number(use.voucher) - 100] : []))));
  const candleUsed = month.some((ran) => ran.answer.uses.some((use) => use.voucher === '1'));
  const voucherLabel = (id: string): string => (id === '1' ? 'voucher:one-candle-1' : `voucher:leaflet:${String(Number(id) - 100)}`);
  const batches = [{ '@label': 'batch:leaflet', name: LEAFLET_NAME, count: 200, worth: 'amount', value: '5.000', public_name: LEAFLET_NAME, uses_total: 1, expires_on: on(1, 30) }];
  const single = (label: string, n: number, more: Row): Row => ({ '@label': label, code: sampleCode(n), code_last4: sampleCode(n).slice(-4), uses_total: 1, status: 'issued', issued_at: at(-1, 1, '09:00'), ...more });
  const thing = (tag: string): Row => ({ worth: 'thing', what: 'tag', source_table: '', source_row: tag, units: 1 });
  const vouchers: Row[] = [
    ...Array.from({ length: 200 }, (_, index) => single(`voucher:leaflet:${String(index + 1)}`, index + 1, { worth: 'amount', value: '5.000', public_name: LEAFLET_NAME, batch_id: ref('batch:leaflet'), expires_on: on(1, 30), status: usedLeaflets.has(index + 1) ? 'used' : 'issued', issued_at: at(-1, 19, '09:00') })),
    single('voucher:one-candle-1', 201, { ...thing('candles'), public_name: 'One candle', status: candleUsed ? 'used' : 'issued' }),
    single('voucher:one-candle-2', 202, { ...thing('candles'), public_name: 'One candle' }),
    single('voucher:15-off', 203, { worth: 'amount', value: '15.000', public_name: '$15.00 off' }),
    single('voucher:massage', 204, { ...thing('massage-60'), public_name: 'Massage 60 min' }),
    ...PACKS.map((pack, index) =>
      single(`voucher:pack:${String(index + 1)}`, 205 + index, {
        worth: 'pack',
        what: 'tag',
        source_table: '',
        source_row: index === 0 ? 'classes' : 'car-wash',
        units: 1,
        public_name: pack.name,
        uses_total: pack.total,
        sold: true,
        sale_price: pack.price,
        status: pack.used.length >= pack.total ? 'used' : 'issued',
        issued_at: at(pack.sold[0], pack.sold[1], '12:00'),
      }),
    ),
  ];
  // A pack's uses were recorded by hand at a desk: real rows, which its uses below point at.
  const packUses = PACKS.flatMap((pack, index) => pack.used.map(([dom, time], n) => ({ pack, index, n, dom, time, label: `pack-use:${String(index + 1)}:${String(n + 1)}` })));
  const voucherActions = packUses.map((use) => ({ '@label': use.label, voucher_id: ref(`voucher:pack:${String(use.index + 1)}`), action: 'use', by: 'Sample', at: at(-1, use.dom, use.time) }));

  /* The cards, and every row written to one — each with what was on the card after it. */
  const giftCards = CARDS.map((card) => {
    const first = card.rows[0];
    return {
      '@label': cardLabel(card),
      kind: card.credit === true ? 'credit' : 'card',
      ...(card.credit === true ? { owner_email: card.name } : { code: card.name.replace(/-(?=....)/g, (hyphen, offset: number) => (offset === 2 ? hyphen : '')), label: card.name.slice(-4) }),
      status: card.status,
      opening: '0.00',
      ...(first === undefined ? {} : { issued_at: at(first[0], first[1], first[2]) }),
      ...(card.status === 'void' ? { void_reason: 'Reported lost' } : {}),
    };
  });
  const ledger: Row[] = [];
  for (const card of CARDS) {
    let balance = 0;
    let spent: string | null = null;
    card.rows.forEach(([month_, dom, time, kind, amount], n) => {
      const signed = cents(amount);
      balance += signed;
      const label = `ledger:${cardLabel(card).slice(5)}:${String(n + 1)}`;
      ledger.push({
        '@label': label,
        card_id: ref(cardLabel(card)),
        kind,
        // What was taken from the card (a row that gives to it takes less than nothing), what moved, and what the holder saw.
        taken: money(-signed),
        value: money(Math.abs(signed)),
        amount: money(signed),
        balance_after: money(balance),
        // Money given back to a card names the payment it came from.
        ...(kind === 'refund' && spent !== null ? { against_id: ref(spent) } : {}),
        source_table: '',
        source_row: '',
        at: at(month_, dom, time),
        by: 'Sample',
      });
      if (kind === 'spend') spent = label;
    });
  }

  /* What the month's orders used, and what each use took off; then the packs' uses, which took nothing off anything. */
  const redemptions: Row[] = [];
  const applied: Row[] = [];
  for (const { order, answer } of month) {
    const when = at(-1, order.day, order.time);
    const source = { source_table: '', source_row: String(order.number), source_label: `Order ${String(order.number)}` };
    for (const use of answer.uses) {
      const code = use.code === null ? undefined : codeOf(use.code);
      redemptions.push({
        kind: use.voucher !== null ? 'voucher' : use.code !== null ? 'code' : use.offer !== null ? 'offer' : 'staff',
        ...(use.offer === null ? {} : { offer_id: ref(offerLabel(use.offer)) }),
        ...(code === undefined ? {} : { code_id: ref(`code:${code}`) }),
        ...(use.voucher === null ? {} : { voucher_id: ref(voucherLabel(use.voucher)) }),
        ...(use.offer === null && use.voucher === null && order.staff !== null && order.staff !== undefined ? { reason_id: ref(`reason:${String(order.staff.reason)}`) } : {}),
        ...source,
        ...(use.customer === undefined ? {} : { customer: use.customer }),
        amount: use.amount,
        uses: use.units ?? 1,
        state: 'counted',
        at: when,
      });
    }
    for (const one of answer.applied) {
      const code = one.code === null ? undefined : codeOf(one.code);
      applied.push({
        source_table: source.source_table,
        source_row: source.source_row,
        source_line: one.line,
        ...(one.offer === null ? {} : { offer_id: ref(offerLabel(one.offer)) }),
        ...(code === undefined ? {} : { code_id: ref(`code:${code}`) }),
        ...(one.voucher === null ? {} : { voucher_id: ref(voucherLabel(one.voucher)) }),
        // A discount is named as its own row names it, in every language; a voucher and a reduction by hand as the adjuster worded them.
        name: one.offer !== null ? (NAMES[String(OFFERS.find((row) => String(row['id']) === one.offer)?.['name'])] ?? one.name) : one.name,
        kind: one.kind,
        amount: one.amount,
        ...(one.reason === undefined ? {} : { reason_id: ref(`reason:${one.reason}`) }),
        typed: one.typed,
        at: when,
      });
    }
  }
  for (const use of packUses) {
    const total = cents(use.pack.price);
    // Its share of what the pack was sold for: by uses, rounded down, the last use taking the rest.
    const share = (count: number): number => Math.floor((total * Math.min(count, use.pack.total)) / use.pack.total);
    redemptions.push({ kind: 'pack', voucher_id: ref(`voucher:pack:${String(use.index + 1)}`), source_table: table('voucher_actions'), source_row: ref(use.label), source_label: use.pack.name, amount: '0.00', uses: 1, prepaid: money(share(use.n + 1) - share(use.n)), state: 'counted', at: at(-1, use.dom, use.time) });
  }

  return {
    format: 'adminium.sample/1',
    app: 'offers',
    tables: [
      { ref: 'settings', onlyIfEmpty: true, rows: settings },
      { ref: 'groups', rows: groups.map(([name]) => ({ '@label': `group:${name.toLowerCase()}`, name })) },
      { ref: 'group_members', rows: groups.flatMap(([name, count]) => Array.from({ length: count }, () => ((member += 1), { group_id: ref(`group:${name.toLowerCase()}`), email: `member${String(member)}@daybreak.example`, member_key: `sample:m${String(member)}` }))) },
      { ref: 'reasons', rows: reasons },
      { ref: 'ceilings', rows: ceilings },
      { ref: 'offers', rows: offers },
      { ref: 'offer_targets', rows: targets },
      { ref: 'codes', rows: codes },
      { ref: 'voucher_batches', rows: batches },
      { ref: 'vouchers', rows: vouchers },
      { ref: 'voucher_actions', rows: voucherActions },
      { ref: 'gift_cards', rows: giftCards },
      { ref: 'card_ledger', rows: ledger },
      { ref: 'redemptions', rows: redemptions },
      { ref: 'applied', rows: applied },
    ],
  };
}
