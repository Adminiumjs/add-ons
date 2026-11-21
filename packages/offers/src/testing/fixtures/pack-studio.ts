/**
 * A STUDIO THAT SELLS PACKS, under its own column names.
 *
 * A fixture for the fit check of `voucher-sale-online@1`: a purchase a
 * signed-in customer makes, and the lines under it, each a pack copied from
 * the studio's own price list. The buyer's address is copied from the customer
 * row, and only a verified, claimed create sets `proved`.
 */

const pk = { ref: 'id', type: 'int', role: 'pk' };
const into = (action: string) => ({ addOn: 'offers', ledger: 'value', action });
const copied = (from: string) => ({ copy: { via: 'pack_product_id', from, mode: 'always' } });

export function packStudio(): { requiredSchema: { tables: Record<string, unknown>[] }; roles: Record<string, unknown>[]; publicAccess: Record<string, unknown>[] } {
  return {
    requiredSchema: {
      tables: [
        { ref: 'customers', columns: [pk, { ref: 'email', type: 'text', maxLength: 254 }] },
        { ref: 'categories', columns: [pk, { ref: 'name', type: 'text', maxLength: 80 }] },
        {
          ref: 'pack_products',
          columns: [
            pk,
            { ref: 'name', type: 'text', maxLength: 120 },
            { ref: 'price', type: 'money', scale: 'currency' },
            { ref: 'uses', type: 'int' },
            { ref: 'what', type: 'enum', enum: ['item', 'category', 'type', 'tag'] },
            { ref: 'category_id', type: 'fk', references: 'categories' },
          ],
        },
        {
          ref: 'purchases',
          columns: [
            pk,
            { ref: 'customer_id', type: 'fk', references: 'customers' },
            { ref: 'paid_at', type: 'timestamptz', nullable: true },
            { ref: 'cancelled_at', type: 'timestamptz', nullable: true },
            { ref: 'proved', type: 'bool', default: false },
          ],
        },
        {
          ref: 'purchase_lines',
          postings: [
            {
              id: 'pack-make',
              into: into('sell-pack'),
              via: 'purchase_id',
              reserve: { on: { create: true } },
              post: { on: { column: 'paid_at', set: true } },
              reverse: { on: { column: 'cancelled_at', set: true } },
              map: { amount: 'amount', name: 'pack_name', uses: 'uses', what: 'what', target: 'category_id', holder_email: 'buyer_email', holder_name: 'buyer_name', language: 'language', proved: { parent: 'proved' }, tax_later: 'tax_later' },
            },
            { id: 'pack-recall', into: into('recall-pack'), via: 'purchase_id', post: { on: { column: 'cancelled_at', set: true } }, reverse: { on: { column: 'paid_at', set: true } }, map: { sale: { row: true } } },
          ],
          columns: [
            pk,
            { ref: 'purchase_id', type: 'fk', references: 'purchases' },
            { ref: 'pack_product_id', type: 'fk', references: 'pack_products' },
            { ref: 'amount', type: 'money', scale: 'currency', rules: copied('price') },
            { ref: 'pack_name', type: 'text', maxLength: 120, rules: copied('name') },
            { ref: 'uses', type: 'int', rules: { ...copied('uses'), validation: { min: 1, max: 50 } } },
            { ref: 'what', type: 'enum', enum: ['item', 'category', 'type', 'tag'], rules: copied('what') },
            { ref: 'category_id', type: 'fk', references: 'categories', rules: copied('category_id') },
            { ref: 'buyer_email', type: 'text', maxLength: 254, rules: { validation: { format: 'email' } } },
            { ref: 'buyer_name', type: 'text', maxLength: 80, nullable: true, rules: { plainText: true } },
            { ref: 'language', type: 'text', maxLength: 12, nullable: true },
            { ref: 'tax_later', type: 'bool', default: false, nullable: true },
          ],
        },
      ],
    },
    roles: [],
    publicAccess: [
      {
        table: 'purchases',
        methods: ['POST'],
        writable: [],
        level: 'verified',
        claimedBy: { table: 'customers', column: 'customer_id' },
        defaults: { proved: true },
        children: { purchase_lines: { writable: ['pack_product_id', 'language'] } },
      },
    ],
  };
}

export const PACK_PAIRINGS = [
  {
    table: 'purchase_lines',
    shape: 'voucher-sale-online@1',
    part: 'lines',
    tables: { order: 'purchases' },
    columns: { order_id: 'purchase_id', sale_amount: 'amount', pack_uses: 'uses', pack_what: 'what', target_id: 'category_id', holder_email: 'buyer_email', holder_name: 'buyer_name' },
  },
] as const;
