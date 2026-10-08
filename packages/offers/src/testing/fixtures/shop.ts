/**
 * A SHOP THAT ADOPTS ALL FOUR PARTS, under its own column names.
 *
 * A fixture for the fit check: tickets with lines, typed codes and payments,
 * the way a till keeps them. Every difference the fit check allows is here
 * once — a reduction that may be empty, a staff value kept as money, a third
 * kind of staff reduction, a wider column for what was typed, a card link also
 * filled from a scanned code, a net worked out the shop's own way, a payment
 * amount that is never empty, a line amount the shop works out itself, a
 * column of its own that carries a part column's name — so a check that
 * stopped allowing one goes red.
 */

const pk = { ref: 'id', type: 'int', role: 'pk' };
const money = (ref: string, more: Record<string, unknown> = {}) => ({ ref, type: 'money', scale: 'currency', ...more });
const link = (ref: string, table: string, more: Record<string, unknown> = {}) => ({ ref, type: 'int', nullable: true, rules: { addOnLink: { addOn: 'offers', table }, ...more } });
const into = (action: string) => ({ addOn: 'offers', ledger: 'value', action });

export function shop(): { requiredSchema: { tables: Record<string, unknown>[] }; roles: Record<string, unknown>[]; publicAccess: Record<string, unknown>[] } {
  return {
    requiredSchema: {
      tables: [
        {
          ref: 'tickets',
          adjust: {
            by: { addOn: 'offers' },
            needs: 'offers',
            lines: [{ table: 'ticket_lines', via: 'ticket_id', price: 'unit_price', quantity: 'qty', discount: 'line_discount', what: [{ column: 'item_id', as: 'item' }], unlessSet: 'voided_at', excludes: { column: 'load_ref', set: true }, paidBy: { column: 'sold_voucher' } }],
            order: { discount: 'discount_total', staff: { kind: 'discount_kind', value: 'discount_value', reason: 'discount_reason_id', by: 'discount_by' }, customer: { link: 'customer_id', address: 'customer_email', proved: 'customer_proved' } },
            codes: { table: 'ticket_codes', via: 'ticket_id', typed: 'typed', code: 'code_id', voucher: 'voucher_id', removed: 'removed_at' },
            uses: 'offers-used',
            frozen: { to: ['paid', 'void'] },
            expect: 'total',
          },
          postings: [{ id: 'offers-used', into: into('redeem'), post: { on: { to: ['paid'] } }, reverse: { on: { to: ['void'] } }, map: { reason: 'discount_reason_id' } }],
          columns: [
            pk,
            { ref: 'status', type: 'enum', enum: ['open', 'paid', 'void'], default: 'open' },
            { ref: 'customer_id', type: 'int', nullable: true },
            { ref: 'customer_email', type: 'text', maxLength: 254, nullable: true },
            { ref: 'customer_proved', type: 'bool', default: false },
            money('subtotal', { nullable: true, rules: { rollup: { from: 'ticket_lines', via: 'ticket_id', sum: 'gross', unlessSet: 'voided_at' } } }),
            // May be empty: the column was there before the shop adopted the part.
            money('discount_total', { nullable: true }),
            // Worked out the shop's own way: over what is taxed.
            money('net', { nullable: true, rules: { formula: { sub: ['taxable', { coalesce: ['discount_total', 0] }] } } }),
            money('taxable', { nullable: true }),
            money('total', { nullable: true }),
            money('due', { nullable: true }),
            { ref: 'discount_kind', type: 'enum', enum: ['percent', 'amount', 'comp'], nullable: true },
            money('discount_value', { nullable: true }),
            link('discount_reason_id', 'reasons'),
            { ref: 'discount_by', type: 'text', maxLength: 200, nullable: true },
          ],
        },
        {
          ref: 'ticket_lines',
          postings: [
            { id: 'card-load', into: into('issue'), via: 'ticket_id', post: { on: { to: ['paid'] } }, reverse: { on: { to: ['void'] } }, map: { card: 'load_ref', amount: 'unit_price' } },
            { id: 'voucher-sold', into: into('sell'), via: 'ticket_id', post: { on: { to: ['paid'] } }, reverse: { on: { to: ['void'] } }, map: { voucher: 'sold_voucher', amount: 'gross', tax_later: 'tax_later' } },
          ],
          columns: [
            pk,
            { ref: 'ticket_id', type: 'fk', references: 'tickets' },
            { ref: 'item_id', type: 'int', nullable: true },
            money('unit_price', { nullable: true }),
            { ref: 'qty', type: 'decimal', scale: 3, default: 1 },
            // Worked out the shop's own way: the part only says a line has an amount.
            money('gross', { nullable: true, rules: { formula: { mul: ['unit_price', 'qty'] } } }),
            money('line_discount', { default: 0 }),
            { ref: 'load_code', type: 'text', maxLength: 64, nullable: true },
            // Also filled from a card somebody scans at the till: the shop's own way in, to the same table.
            link('load_ref', 'gift_cards', { lookup: { from: 'load_code', table: { addOn: 'offers', table: 'gift_cards' }, column: 'code' } }),
            link('sold_voucher', 'vouchers'),
            { ref: 'tax_later', type: 'bool', default: false, nullable: true },
            { ref: 'voided_at', type: 'timestamptz', nullable: true },
          ],
        },
        {
          ref: 'ticket_codes',
          columns: [
            pk,
            { ref: 'ticket_id', type: 'fk', references: 'tickets' },
            // Wider than the part's: it also takes a scanned card.
            { ref: 'typed', type: 'text', maxLength: 120, nullable: true, rules: { normalize: 'trim' } },
            link('code_id', 'codes'),
            link('voucher_id', 'vouchers'),
            { ref: 'removed_at', type: 'timestamptz', nullable: true },
          ],
        },
        {
          ref: 'ticket_payments',
          postings: [
            {
              id: 'card',
              into: into('spend'),
              via: 'ticket_id',
              only: { column: 'method', eq: 'gift_card' },
              post: { on: { create: true } },
              reverse: { on: { to: ['void'] } },
              heldUntil: { column: 'held_until' },
              map: { card: 'card_id', due: { parent: 'due' }, amount: 'card_amount', balance_after: 'card_balance_after' },
              refuses: [{ table: 'ticket_lines', via: 'ticket_id', column: 'load_ref', set: true }],
            },
          ],
          columns: [
            pk,
            { ref: 'ticket_id', type: 'fk', references: 'tickets' },
            { ref: 'method', type: 'enum', enum: ['cash', 'gift_card'] },
            // What every way of paying takes; a card payment's own figure is beside it, decided.
            money('amount', { nullable: true }),
            // The typed card is kept in a column the shop calls `code`, as Offers calls the column it is looked for in.
            { ref: 'code', type: 'text', maxLength: 64, nullable: true },
            link('card_id', 'gift_cards', { lookup: { from: 'code', table: { addOn: 'offers', table: 'gift_cards' }, column: 'code', where: [{ column: 'status', eq: 'active' }] } }),
            { ref: 'card_last4', type: 'text', maxLength: 4, nullable: true },
            // Never empty: cash fills it, and a card payment's is decided.
            money('card_amount'),
            money('card_balance_after', { nullable: true }),
            { ref: 'held_until', type: 'timestamptz', nullable: true },
          ],
        },
      ],
    },
    roles: [
      {
        key: 'cashier',
        permissions: ['table:@tickets:read', 'table:@tickets:update', 'table:@ticket_payments:read', 'table:@ticket_payments:create'],
        // A cashier types a cash amount into the same column a card payment's is decided in.
        limits: { tickets: { writable: ['discount_kind', 'discount_value', 'discount_reason_id'] }, ticket_payments: { creatable: ['ticket_id', 'method', 'code', 'amount', 'card_amount'] } },
      },
    ],
    // A guest's checkout: an order with its lines and the codes typed on it, in one write.
    publicAccess: [
      {
        table: 'tickets',
        methods: ['POST'],
        writable: ['customer_email'],
        children: { ticket_lines: { writable: ['item_id', 'qty'] }, ticket_codes: { writable: ['typed'] } },
      },
    ],
  };
}

/** Which table plays which part, and which of its columns plays each of the part's. */
export const SHOP_PAIRINGS = [
  { table: 'tickets', shape: 'discountable@1', part: 'order', tables: { lines: 'ticket_lines', codes: 'ticket_codes' }, columns: { discount: 'discount_total', discount_reason: 'discount_reason_id', paid_at: null, cancelled_at: null } },
  { table: 'ticket_lines', shape: 'discountable@1', part: 'lines', tables: { order: 'tickets', codes: 'ticket_codes' }, columns: { order_id: 'ticket_id', item: null, amount: 'gross', discount: 'line_discount' } },
  { table: 'ticket_codes', shape: 'discountable@1', part: 'codes', tables: { order: 'tickets', lines: 'ticket_lines' }, columns: { order_id: 'ticket_id' } },
  { table: 'ticket_payments', shape: 'card-payment@1', part: 'payments', tables: { order: 'tickets' }, columns: { order_id: 'ticket_id', card_code: 'code', amount: 'card_amount', voided_at: null } },
  { table: 'ticket_lines', shape: 'card-sale@1', part: 'lines', tables: { order: 'tickets' }, columns: { order_id: 'ticket_id', gift_card_id: 'load_ref', load_amount: 'unit_price' } },
  { table: 'ticket_lines', shape: 'voucher-sale@1', part: 'lines', tables: { order: 'tickets' }, columns: { order_id: 'ticket_id', voucher_id: 'sold_voucher', amount: 'gross' } },
] as const;
