/**
 * Three apps' documents, as each app ships its profile and as Adminium hands
 * the add-on the subject for one of its rows.
 *
 * WHY BOTH HALVES LIVE HERE. A profile is the app's (its `manifest.json`
 * `documents` block, in the shape Adminium validates); a subject is what
 * Adminium builds from that profile and the app's rows and hands to
 * `render`. This repository cannot run Adminium, so the rendering suites draw
 * the subjects directly, and `app-profiles.test.ts` holds each subject to its
 * profile: every value a subject carries is one its profile maps, and every
 * key a profile maps is a slot (or a slot's column) this add-on draws. A key
 * that is not is dropped by Adminium without a word, so that check is the only
 * place such a slip shows.
 *
 * The figures are the apps' own sample figures: a guest house's loft at 215 a
 * night, 25 more on a Friday or Saturday night and 20 more in August, with
 * breakfast at 16 a guest a night, parking at 14 a night and 9 % tax; a lunch
 * counter's grain bowl at 18.00 with three choices and a cookie, 8.25 % tax; a
 * ticket office's weekend pass at 85.00.
 */

import type { DocumentSubject } from '@adminium/add-on-host/contracts';

type Fields = Record<string, unknown>;

/** A slot's mapping, in the shape an app's profile writes it. */
export type ProfileMapping =
  | { readonly column: string }
  | { readonly via: string; readonly column: string }
  | { readonly collection: Source }
  | { readonly collections: readonly Source[] };

type Source =
  | {
      readonly table: string;
      readonly via: string;
      readonly orderBy?: string;
      readonly where?: { readonly column: string; readonly in: readonly (string | number | boolean)[] };
      readonly unless?: string;
      readonly columns: Readonly<Record<string, string | { readonly list: { readonly table: string; readonly via: string; readonly column: string; readonly orderBy?: string } }>>;
    }
  | { readonly nightly: string; readonly columns: Readonly<Record<string, string>> };

export interface AppProfile {
  readonly app: string;
  readonly kind: string;
  readonly addOn: 'invoices';
  readonly table: string;
  readonly mapping: Readonly<Record<string, ProfileMapping>>;
}

/* ── A guest house's folio: an invoice on a booking ─────────────────────── */

export const FOLIO_PROFILE: AppProfile = {
  app: 'hotel',
  kind: 'invoice',
  addOn: 'invoices',
  table: 'stays',
  mapping: {
    number: { column: 'ref' },
    customerName: { column: 'guest_name' },
    customerEmail: { column: 'email' },
    serviceFrom: { column: 'arrive' },
    serviceTo: { column: 'depart' },
    reference: { via: 'room_id', column: 'number' },
    items: {
      collections: [
        { nightly: 'room_total', columns: { desc: 'room_type_id.name', date: 'date', qty: 'qty', rate: 'rate' } },
        {
          table: 'stay_extras',
          via: 'stay_id',
          orderBy: 'id',
          where: { column: 'state', in: ['on'] },
          columns: { desc: 'label', rate: 'amount', amount: 'amount' },
        },
        {
          table: 'charges',
          via: 'stay_id',
          orderBy: 'id',
          unless: 'voided',
          columns: { desc: 'label', date: 'charged_on', rate: 'amount', amount: 'amount' },
        },
      ],
    },
    taxName: { column: 'tax_label' },
    taxRate: { column: 'tax_rate' },
    subtotal: { column: 'subtotal' },
    tax: { column: 'tax' },
    total: { column: 'total' },
    paid: { column: 'paid' },
    balance: { column: 'balance' },
    payments: {
      collection: {
        table: 'payments',
        via: 'stay_id',
        orderBy: 'recorded_at',
        unless: 'voided',
        columns: { number: 'reference', paidOn: 'paid_on', method: 'method', amount: 'amount' },
      },
    },
  },
};

/** The price of each night from `from` up to (not including) `to`, as the house prices a loft, in cents. */
export function loftNights(from: string, to: string): { date: string; rate: number }[] {
  const out: { date: string; rate: number }[] = [];
  for (let day = new Date(`${from}T00:00:00Z`); day < new Date(`${to}T00:00:00Z`); day = new Date(day.getTime() + 86_400_000)) {
    const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
    const august = day.getUTCMonth() === 7;
    out.push({ date: day.toISOString().slice(0, 10), rate: (215 + (weekend ? 25 : 0) + (august ? 20 : 0)) * 100 });
  }
  return out;
}

export const STAY = loftNights('2026-07-23', '2026-07-28');
export const ROOM = STAY.reduce((sum, night) => sum + night.rate, 0);
/** 16 a guest a night, three guests. */
export const BREAKFAST = 16_00 * 3 * STAY.length;
/** 14 a night. */
export const PARKING = 14_00 * STAY.length;

/** Booking WH-3283: Teodor Blank, the loft in room 301, 23 to 28 July, three guests, $500 paid at the desk. */
export function folioSubject(fields: Fields = {}, charges: Fields[] = []): DocumentSubject {
  const subtotal = ROOM + BREAKFAST + PARKING + charges.reduce((sum, charge) => sum + (charge.amount as number), 0);
  // 9 %, half away from zero, in cents.
  const tax = Math.round((subtotal * 9) / 100);
  return {
    now: { iso: '2026-07-28T10:30:00.000Z', timezone: 'Europe/London' },
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Wren House', lines: ['2 Harbour Row', 'Porthleven TR13 9JA'] },
    entity: null,
    number: 'WH-3283',
    fields: {
      customerName: 'Teodor Blank',
      customerEmail: 't.blank@example.com',
      serviceFrom: '2026-07-23',
      serviceTo: '2026-07-28',
      reference: '301',
      taxName: 'Taxes and city levy',
      taxRate: 900,
      subtotal,
      tax,
      total: subtotal + tax,
      paid: 500_00,
      balance: subtotal + tax - 500_00,
      ...fields,
    },
    collections: {
      items: [
        ...STAY.map((night) => ({ desc: 'Loft suite', date: night.date, qty: 1, rate: night.rate })),
        { desc: 'Breakfast in the morning', rate: BREAKFAST, amount: BREAKFAST },
        { desc: 'A space in the yard', rate: PARKING, amount: PARKING },
        ...charges,
      ],
      payments: [{ number: 'Card 4417', paidOn: '2026-07-23', method: 'card', amount: 500_00 }],
    },
  };
}

/* ── A lunch counter's receipt: a sale, the choices under each line ─────── */

export const KITCHEN_RECEIPT_PROFILE: AppProfile = {
  app: 'ordering',
  kind: 'receipt',
  addOn: 'invoices',
  table: 'orders',
  mapping: {
    items: {
      collection: {
        table: 'order_items',
        via: 'order_id',
        orderBy: 'position',
        columns: {
          desc: 'name',
          qty: 'qty',
          rate: 'unit_total',
          options: { list: { table: 'order_item_modifiers', via: 'order_item_id', column: 'name', orderBy: 'id' } },
        },
      },
    },
    subtotal: { column: 'subtotal' },
    tax: { column: 'tax' },
    total: { column: 'total' },
    reference: { column: 'number' },
    issuedAt: { column: 'picked_up_at' },
    paidWith: { column: 'paid_method' },
    attendedBy: { column: 'picked_up_by' },
  },
};

/**
 * Order #2109: a grain bowl built from three choices, and a cookie. The
 * receipt's own number is the register's (`2118`, printed `REC-2118`); the
 * order's number is the reference.
 */
export function orderSubject(lines: Fields[] = [], fields: Fields = {}): DocumentSubject {
  return {
    now: { iso: '2026-07-28T15:16:00.000Z', timezone: 'America/New_York' },
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Juniper Kitchen', lines: ['41 Alder Street'] },
    entity: null,
    number: '2118',
    fields: {
      issuedAt: '2026-07-28',
      reference: '#2109',
      paidWith: 'card',
      attendedBy: 'Sam',
      subtotal: 21_50,
      tax: 1_77,
      total: 23_27,
      ...fields,
    },
    collections: {
      items:
        lines.length > 0
          ? lines
          : [
              { desc: 'Signature grain bowl', qty: 1, rate: 18_00, options: ['Farro', 'Grilled chicken', 'Avocado'] },
              { desc: 'Cookie', qty: 1, rate: 3_50, options: [] },
            ],
    },
  };
}

/* ── A ticket office's receipt: the payment for an order ────────────────── */

export const TICKET_RECEIPT_PROFILE: AppProfile = {
  app: 'events',
  kind: 'receipt',
  addOn: 'invoices',
  table: 'orders',
  mapping: {
    issuedAt: { column: 'paid_at' },
    amount: { column: 'total' },
    paidWith: { column: 'paid_method' },
    reference: { column: 'number' },
    customerName: { column: 'buyer_name' },
  },
};

/** Order WV-8790, a weekend pass, paid by card; the receipt's own number is the register's. */
export function ticketSubject(fields: Fields = {}, items?: Fields[]): DocumentSubject {
  return {
    now: { iso: '2026-07-28T18:00:00.000Z', timezone: 'Europe/London' },
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Waveform', lines: [] },
    entity: null,
    number: '57',
    fields: { issuedAt: '2026-07-20', amount: 85_00, paidWith: 'card', customerName: 'Ada Quill', reference: 'WV-8790', ...fields },
    collections: items === undefined ? {} : { items },
  };
}
