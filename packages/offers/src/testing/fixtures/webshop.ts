/**
 * A WEB SHOP THAT SELLS GIFT CARDS, under its own column names.
 *
 * A fixture for the fit check of `card-sale-online@1`: orders a shopper
 * places, and the gift lines under them, each a card for somebody. The shop
 * keeps a status of its own and says when each rule fires by it — which is
 * the host's business, and not compared — and spells out the line's columns
 * and its two postings as the part has them.
 */

const pk = { ref: 'id', type: 'int', role: 'pk' };
const into = (action: string) => ({ addOn: 'offers', ledger: 'value', action });

export function webshop(): { requiredSchema: { tables: Record<string, unknown>[] }; roles: Record<string, unknown>[]; publicAccess: Record<string, unknown>[] } {
  return {
    requiredSchema: {
      tables: [
        {
          ref: 'orders',
          columns: [
            pk,
            { ref: 'status', type: 'enum', enum: ['paying', 'paid', 'sent', 'cancelled'], default: 'paying' },
            { ref: 'paid_on', type: 'timestamptz', nullable: true },
            { ref: 'cancelled_on', type: 'timestamptz', nullable: true },
            { ref: 'buyer_name', type: 'text', maxLength: 80 },
          ],
        },
        // What the shop sells a card for: the only place a card's worth comes from.
        { ref: 'card_amounts', columns: [pk, { ref: 'amount', type: 'money', scale: 'currency' }] },
        {
          ref: 'gift_lines',
          postings: [
            // Made with the order, loaded when it is paid, cancelled with it while unpaid.
            { id: 'card-make', into: into('issue'), via: 'order_id', reserve: { on: { create: true } }, post: { on: { to: ['paid'] } }, reverse: { on: { to: ['cancelled'] } }, map: { amount: 'amount', to_name: 'to_name', to_email: 'to_email', message: 'message', sender: 'from_name', language: 'language' } },
            // Recalled when a paid order is cancelled: the cancel is refused while the card is spent.
            { id: 'card-recall', into: into('recall'), via: 'order_id', post: { on: { to: ['cancelled'] } }, map: { sale: { row: true } } },
          ],
          columns: [
            pk,
            { ref: 'order_id', type: 'fk', references: 'orders' },
            // The shopper picks one of the shop's amounts; the line copies its worth, and no guest writes it.
            { ref: 'card_amount_id', type: 'fk', references: 'card_amounts' },
            { ref: 'amount', type: 'money', scale: 'currency', rules: { copy: { via: 'card_amount_id', from: 'amount', mode: 'always' } } },
            { ref: 'to_name', type: 'text', maxLength: 80, nullable: true, rules: { plainText: true, personal: true } },
            { ref: 'to_email', type: 'text', maxLength: 254, rules: { validation: { format: 'email' }, personal: true } },
            { ref: 'message', type: 'text', maxLength: 200, nullable: true, rules: { plainText: { digits: 20, max: 200 } } },
            { ref: 'from_name', type: 'text', maxLength: 80, nullable: true, rules: { plainText: true } },
            { ref: 'language', type: 'text', maxLength: 12, nullable: true },
          ],
        },
      ],
    },
    roles: [],
    publicAccess: [{ table: 'orders', writable: ['buyer_name'], children: { gift_lines: { writable: ['card_amount_id', 'to_name', 'to_email', 'message', 'from_name', 'language'] } } }],
  };
}

export const WEBSHOP_PAIRINGS = [{ table: 'gift_lines', shape: 'card-sale-online@1', part: 'lines', tables: { order: 'orders' }, columns: { order_id: 'order_id', load_amount: 'amount', sender: 'from_name' } }] as const;
