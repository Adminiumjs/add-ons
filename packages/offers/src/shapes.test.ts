/**
 * THE FOUR SHAPES, AND THE CHECK THAT HOLDS AN APP TO THEM.
 *
 * An app that wants its orders discounted, its payments taken by card, or its
 * lines to sell a card or a voucher spells a part's columns and rule out on
 * its own table. This suite holds the four shape files equal to what the
 * manifest carries, runs the fit check over a shop that adopts all four under
 * its own column names, and then breaks the shop one way at a time: each
 * difference the check allows passes, and each it must never allow fails.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import cardPayment from './shapes/card-payment.json' with { type: 'json' };
import cardSale from './shapes/card-sale.json' with { type: 'json' };
import discountable from './shapes/discountable.json' with { type: 'json' };
import voucherSale from './shapes/voucher-sale.json' with { type: 'json' };
import { MAY_LEAVE_OUT, ownedOf, shapeFit, type Pairing, type Shape } from './testing/fit.ts';
import { shop, SHOP_PAIRINGS } from './testing/fixtures/shop.ts';

const SHAPES = [discountable, cardPayment, cardSale, voucherSale] as unknown as Shape[];
const PAIRINGS = SHOP_PAIRINGS as unknown as Pairing[];

type Doc = Record<string, unknown>;
type Shop = ReturnType<typeof shop>;
const tableOf = (app: Shop, ref: string) => app.requiredSchema.tables.find((table) => table['ref'] === ref) as { columns: Doc[]; adjust?: Doc; postings?: Doc[] };
const columnOf = (app: Shop, table: string, ref: string) => tableOf(app, table).columns.find((column) => column['ref'] === ref)!;
/** The shop with one thing changed, and what the check then says. */
const broken = (change: (app: Shop) => void): string[] => {
  const app = shop();
  change(app);
  return shapeFit(app, PAIRINGS, SHAPES).map((issue) => `${issue.table} as ${issue.shape}/${issue.part}: ${issue.message}`);
};

describe('the shapes', () => {
  it('are the four the manifest carries, each in a file an app can copy', () => {
    expect(manifest.addOn.shapes).toEqual(SHAPES);
    expect(SHAPES.map((shape) => `${shape.name}@${String(shape.version)}: ${Object.keys(shape.parts).join(', ')}`)).toEqual([
      'discountable@1: order, lines, codes',
      'card-payment@1: order, payments',
      'card-sale@1: order, lines',
      'voucher-sale@1: order, lines',
    ]);
  });

  it('an order\'s subtotal adds up its lines before any reduction, its net is what is left, and its uses are a posting', () => {
    const order = discountable.parts.order;
    expect(order.columns.find((column) => column.ref === 'subtotal')?.rules).toEqual({ rollup: { from: 'lines', via: 'order_id', sum: 'amount' } });
    expect(order.adjust).toMatchObject({ by: { addOn: 'offers' }, order: { discount: 'discount' }, uses: 'uses', codes: { table: 'codes', typed: 'typed', code: 'code_id', voucher: 'voucher_id', removed: 'removed_at' } });
    expect(order.postings.map((posting) => `${posting.id} → ${posting.into.action}`)).toEqual(['uses → redeem']);
    expect(order.columns.find((column) => column.ref === 'net')?.rules).toEqual({ formula: { sub: ['subtotal', 'discount'] } });
    // A reduction starts at nothing, never empty: a total over it needs no guard.
    for (const part of [order, discountable.parts.lines]) expect(part.columns.find((column) => column.ref === 'discount')).toMatchObject({ type: 'money', scale: 'currency', default: 0 });
  });

  it('every link into Offers is a soft one: the app installs whether or not Offers is there', () => {
    const links = SHAPES.flatMap((shape) => Object.entries(shape.parts).flatMap(([part, own]) => own.columns.filter((column) => column.rules?.['addOnLink'] !== undefined).map((column) => `${shape.name}/${part}.${column.ref} → ${String((column.rules!['addOnLink'] as { table: string }).table)}`)));
    expect(links).toEqual([
      'discountable/order.discount_reason → reasons',
      'discountable/codes.code_id → codes',
      'discountable/codes.voucher_id → vouchers',
      'card-payment/payments.card_id → gift_cards',
      'card-sale/lines.gift_card_id → gift_cards',
      'voucher-sale/lines.voucher_id → vouchers',
    ]);
    for (const shape of SHAPES) {
      for (const own of Object.values(shape.parts)) {
        for (const column of own.columns.filter((one) => one.rules?.['addOnLink'] !== undefined)) expect(column).toMatchObject({ type: 'int', nullable: true, rules: { addOnLink: { addOn: 'offers' } } });
      }
    }
  });

  it('a card payment is found by the code typed, pays into the ledger and names the row it hangs under', () => {
    const payments = cardPayment.parts.payments;
    expect(payments.columns.find((column) => column.ref === 'card_id')?.rules).toMatchObject({ lookup: { from: 'card_code', table: { addOn: 'offers', table: 'gift_cards' }, column: 'code', where: [{ column: 'status', eq: 'active' }] } });
    expect(payments.postings[0]).toMatchObject({ into: { addOn: 'offers', ledger: 'value', action: 'spend' }, map: { card: 'card_id', due: { parent: 'due' }, amount: 'amount', balance_after: 'card_balance_after' } });
  });
});

/** The pairings with one of them changed. */
const paired = (table: string, shape: string, change: (pairing: Pairing) => Pairing): Pairing[] => PAIRINGS.map((pairing) => (pairing.table === table && pairing.shape === shape ? change(pairing) : pairing));
const said = (app: Shop, pairings: Pairing[]): string[] => shapeFit(app, pairings, SHAPES).map((issue) => `${issue.table} as ${issue.shape}/${issue.part}: ${issue.message}`);
const adjustOf = (app: Shop) => tableOf(app, 'tickets').adjust!;
const lineOf = (app: Shop) => (adjustOf(app)['lines'] as Doc[])[0]!;
const limitsOf = (app: Shop) => app.roles[0]!['limits'] as Record<string, { writable?: string[]; creatable?: string[] }>;
const entryOf = (app: Shop) => app.publicAccess[0] as { writable: string[]; defaults?: Doc; children: Record<string, { writable: string[] }> };

describe('what is Adminium\'s own in each part', () => {
  it('is what a rule works out, what the price rule writes, and what a card holds after paying', () => {
    const owned = (shape: Shape, part: string) => ownedOf(shape, part).sort();
    expect(owned(SHAPES[0]!, 'order')).toEqual(['discount', 'discount_by', 'net', 'subtotal']);
    expect(owned(SHAPES[0]!, 'lines')).toEqual(['discount']);
    expect(owned(SHAPES[0]!, 'codes')).toEqual(['code_id', 'voucher_id']);
    // What a card pays is typed for cash in the same column, and its link may be filled from a look-up: neither is here.
    expect(owned(SHAPES[1]!, 'payments')).toEqual(['card_balance_after']);
    expect(owned(SHAPES[2]!, 'lines')).toEqual([]);
    expect(owned(SHAPES[3]!, 'lines')).toEqual([]);
  });

  it('an adopter may leave out only what the list names, and never a column that is Adminium\'s own but a net and a subtotal', () => {
    for (const shape of SHAPES) {
      for (const part of Object.keys(shape.parts)) {
        const optional = MAY_LEAVE_OUT[`${shape.name}@${String(shape.version)}/${part}`];
        if (optional === undefined) continue;
        for (const ref of optional) expect(shape.parts[part]!.columns.map((column) => column.ref), `${shape.name}/${part}: ${ref}`).toContain(ref);
        expect(ownedOf(shape, part).filter((ref) => optional.includes(ref)).sort(), `${shape.name}/${part}`).toEqual(part === 'order' ? ['discount_by', 'net', 'subtotal'] : part === 'payments' ? ['card_balance_after'] : []);
      }
    }
  });
});

describe('the fit check', () => {
  it('each adopter\'s tables fit the parts they spell out', () => {
    expect(broken(() => undefined)).toEqual([]);
  });

  it('a paired column may differ only in the ways the list allows', () => {
    // Each of these is in the shop as it stands, and each put back as the part has it still fits.
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_total'), { nullable: false, default: 0 }))).toEqual([]);
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_value'), { type: 'decimal', scale: 3 }))).toEqual([]);
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_kind'), { enum: ['percent', 'amount'] }))).toEqual([]);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_codes', 'typed'), { maxLength: 64 }))).toEqual([]);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_payments', 'card_amount'), { nullable: true }))).toEqual([]);
    expect(broken((app) => delete columnOf(app, 'ticket_lines', 'gross')['rules'])).toEqual([]);
    expect(broken((app) => delete (columnOf(app, 'ticket_lines', 'load_ref')['rules'] as Doc)['lookup'])).toEqual([]);

    // A link with no soft link into Offers' table.
    expect(broken((app) => delete (columnOf(app, 'ticket_codes', 'voucher_id')['rules'] as Doc)['addOnLink'])[0]).toBe('ticket_codes as discountable@1/codes: "ticket_codes.voucher_id" is not a link into vouchers of Offers');
    expect(broken((app) => Object.assign((columnOf(app, 'ticket_lines', 'load_ref')['rules'] as Doc)['addOnLink'] as Doc, { table: 'vouchers' }))[0]).toBe(
      'ticket_lines as card-sale@1/lines: "ticket_lines.load_ref" is not a link into gift_cards of Offers',
    );

    // Money at a second scale.
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_lines', 'line_discount'), { scale: 4 }))[0]).toBe('ticket_lines as discountable@1/lines: "ticket_lines.line_discount" is money at another scale than the order\'s');
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_total'), { type: 'decimal', scale: 2 }))[0]).toBe('tickets as discountable@1/order: "tickets.discount_total" is money at another scale than the order\'s');
    // Money a released app keeps as a decimal at the currency's places is the same money: the database keeps the two alike.
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_total'), { type: 'decimal', scale: 'currency' }))).toEqual([]);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_lines', 'line_discount'), { type: 'decimal', scale: 'currency' }))).toEqual([]);
  });

  it('a column that is Adminium\'s own is in no role\'s list of what it may write', () => {
    const role = (table: string, list: 'writable' | 'creatable', column: string) => broken((app) => ((limitsOf(app)[table] ??= {})[list] ??= []).push(column));
    expect(role('tickets', 'writable', 'discount_total')).toEqual(['tickets as discountable@1/order: "tickets.discount_total" is decided by Adminium, and the role "cashier" may write it']);
    expect(role('tickets', 'writable', 'discount_by')).toEqual(['tickets as discountable@1/order: "tickets.discount_by" is decided by Adminium, and the role "cashier" may write it']);
    expect(role('tickets', 'writable', 'net')).toHaveLength(1);
    expect(role('tickets', 'creatable', 'subtotal')).toHaveLength(1);
    expect(role('ticket_lines', 'writable', 'line_discount')).toEqual(['ticket_lines as discountable@1/lines: "ticket_lines.line_discount" is decided by Adminium, and the role "cashier" may write it']);
    expect(role('ticket_codes', 'creatable', 'code_id')).toHaveLength(1);
    expect(role('ticket_codes', 'creatable', 'voucher_id')).toHaveLength(1);
    expect(role('ticket_payments', 'creatable', 'card_balance_after')).toEqual(['ticket_payments as card-payment@1/payments: "ticket_payments.card_balance_after" is decided by Adminium, and the role "cashier" may write it']);
    // What a card pays is typed for cash in the same column: the shop's cashier creates with it, as the shop stands.
    expect(limitsOf(shop())['ticket_payments']!.creatable).toContain('card_amount');
  });

  it('nor in what a guest\'s checkout may write, on the order or on a row under it', () => {
    expect(broken((app) => entryOf(app).children['ticket_codes']!.writable.push('code_id'))).toEqual(['ticket_codes as discountable@1/codes: "ticket_codes.code_id" is decided by Adminium, and a public entry may write it']);
    expect(broken((app) => entryOf(app).children['ticket_lines']!.writable.push('line_discount'))).toEqual(['ticket_lines as discountable@1/lines: "ticket_lines.line_discount" is decided by Adminium, and a public entry may write it']);
    expect(broken((app) => entryOf(app).writable.push('discount_total'))).toEqual(['tickets as discountable@1/order: "tickets.discount_total" is decided by Adminium, and a public entry may write it']);
    // A value an entry fills is a value it writes.
    expect(broken((app) => (entryOf(app).defaults = { discount_total: 0 }))).toHaveLength(1);
    expect(broken((app) => Object.assign(entryOf(app).children, { ticket_payments: { writable: ['code', 'card_balance_after'] } }))).toEqual([
      'ticket_payments as card-payment@1/payments: "ticket_payments.card_balance_after" is decided by Adminium, and a public entry may write it',
    ]);
  });

  it('a list with a member missing, a narrower text and a column of another type do not fit', () => {
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_kind'), { enum: ['percent', 'comp'] }))).toEqual(['tickets as discountable@1/order: "tickets.discount_kind" is not declared as the shape declares it']);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_codes', 'typed'), { maxLength: 32 }))).toEqual(['ticket_codes as discountable@1/codes: "ticket_codes.typed" is not declared as the shape declares it']);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_codes', 'removed_at'), { type: 'date' }))).toEqual(['ticket_codes as discountable@1/codes: "ticket_codes.removed_at" is not declared as the shape declares it']);
    // A reduction that may be empty is allowed only where it starts nowhere else.
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_total'), { nullable: false, default: 5 }))).toEqual(['tickets as discountable@1/order: "tickets.discount_total" is not declared as the shape declares it']);
    // A staff value is money or a decimal, never text; and only that column is let be either.
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'discount_value'), { type: 'int', scale: undefined }))).toEqual(['tickets as discountable@1/order: "tickets.discount_value" is not declared as the shape declares it']);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_lines', 'tax_later'), { type: 'int' }))).toEqual(['ticket_lines as voucher-sale@1/lines: "ticket_lines.tax_later" is not declared as the shape declares it']);
    // What a card then holds is Adminium's to fill after the row is made: it may be empty. So may every link into Offers.
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_payments', 'card_balance_after'), { nullable: false }))).toEqual(['ticket_payments as card-payment@1/payments: "ticket_payments.card_balance_after" is not declared as the shape declares it']);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_lines', 'load_ref'), { nullable: false }))).toEqual(['ticket_lines as card-sale@1/lines: "ticket_lines.load_ref" is not declared as the shape declares it']);
    // A column the host fills itself may be one it never leaves empty.
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_codes', 'typed'), { nullable: false }))).toEqual([]);
  });

  it('nothing is added to a column that is Adminium\'s own, and a net or a subtotal worked out another way still does its job', () => {
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_lines', 'line_discount'), { rules: { formula: { mul: ['gross', 0] } } }))).toEqual([
      'ticket_lines as discountable@1/lines: "ticket_lines.line_discount" adds a formula rule the shape does not keep',
    ]);
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_codes', 'code_id')['rules'] as Doc, { lookup: { from: 'typed', table: { addOn: 'offers', table: 'codes' }, column: 'code' } }))).toEqual([
      'ticket_codes as discountable@1/codes: "ticket_codes.code_id" adds a lookup rule the shape does not keep',
    ]);
    // A net that forgets the reduction charges the full price.
    expect(broken((app) => Object.assign(columnOf(app, 'tickets', 'net'), { rules: { formula: { sub: ['taxable', 0] } } }))).toEqual(['tickets as discountable@1/order: "tickets.net" is the order\'s net and does not take the reduction off']);
    // A subtotal over another table is not this order's.
    expect(broken((app) => Object.assign((columnOf(app, 'tickets', 'subtotal')['rules'] as Doc)['rollup'] as Doc, { from: 'ticket_payments' }))).toEqual([
      'tickets as discountable@1/order: "tickets.subtotal" is the order\'s subtotal and does not add up its lines',
    ]);
    // A net with no rule at all is no longer worked out.
    expect(broken((app) => delete columnOf(app, 'tickets', 'net')['rules'])).toEqual(['tickets as discountable@1/order: "tickets.net" changes the shape\'s formula rule']);
  });

  it('a part\'s column the app does not have is named, and only the listed ones may be left out', () => {
    expect(broken((app) => tableOf(app, 'ticket_codes').columns.pop())).toEqual(['ticket_codes as discountable@1/codes: "ticket_codes" has no column "removed_at" to play "removed_at"']);
    const without = shop();
    tableOf(without, 'ticket_codes').columns.pop();
    delete (adjustOf(without)['codes'] as Doc)['removed'];
    expect(said(without, paired('ticket_codes', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, removed_at: null } })))).toEqual([]);
    // …and a rule that still names what the pairing left out does not fit it.
    const named = shop();
    tableOf(named, 'ticket_codes').columns.pop();
    expect(said(named, paired('ticket_codes', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, removed_at: null } })))).toEqual([
      'ticket_codes as discountable@1/codes: the price rule\'s codes read "removed_at" as removed, and the pairing says "null" plays it',
    ]);

    // The link a sale line loads a card by is the whole of the part: it is not left out.
    expect(said(shop(), paired('ticket_lines', 'card-sale@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, gift_card_id: null } })))).toContain('ticket_lines as card-sale@1/lines: "gift_card_id" is not a column an adopter may leave out');
    expect(said(shop(), paired('ticket_lines', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, discount: null } })))).toContain('ticket_lines as discountable@1/lines: "discount" is not a column an adopter may leave out');
    expect(said(shop(), paired('ticket_codes', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, code_id: null } })))).toContain('ticket_codes as discountable@1/codes: "code_id" is not a column an adopter may leave out');
    // One column of the app plays one column of the part.
    expect(said(shop(), paired('ticket_codes', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, voucher_id: 'code_id' } })))).toContain('ticket_codes as discountable@1/codes: "code_id" plays two columns of the part');
  });

  it('a place whose staff give no reduction by hand keeps none of the four columns, and its rule names none', () => {
    const none = { discount_kind: null, discount_value: null, discount_reason: null, discount_by: null };
    const bare = shop();
    delete (adjustOf(bare)['order'] as Doc)['staff'];
    delete (tableOf(bare, 'tickets').postings![0]!['map'] as Doc)['reason'];
    const pairings = paired('tickets', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, ...none } }));
    expect(said(bare, pairings)).toEqual([]);
    // The rule still naming them, or the posting still mapping the reason: not the pairing it says it is.
    const still = shop();
    expect(said(still, pairings).map((line) => line.slice(0, 96))).toEqual([
      'tickets as discountable@1/order: the price rule\'s "order" is not the part\'s: it names {"discount',
      'tickets as discountable@1/order: the posting into "redeem" maps "reason" to "discount_reason_id"',
    ]);
    // Three of the four is neither.
    expect(said(bare, paired('tickets', 'discountable@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, ...none, discount_kind: 'discount_kind' } })))).toContain(
      'tickets as discountable@1/order: a reduction given by hand is four columns or none: the pairing leaves out some of them',
    );
  });

  it('a pairing names the tables beside it, and each of them is paired too', () => {
    const drop = (table: string, shape: string, part: string) => paired(table, shape, (pairing) => ({ ...pairing, tables: Object.fromEntries(Object.entries(pairing.tables ?? {}).filter(([name]) => name !== part)) }));
    expect(said(shop(), drop('tickets', 'discountable@1', 'lines'))).toContain('tickets as discountable@1/order: the pairing does not say which table plays "lines" ("tables")');
    expect(said(shop(), drop('tickets', 'discountable@1', 'codes'))).toContain('tickets as discountable@1/order: the pairing does not say which table plays "codes" ("tables")');
    expect(said(shop(), drop('ticket_lines', 'discountable@1', 'order'))).toContain('ticket_lines as discountable@1/lines: the pairing does not say which table plays "order" ("tables")');
    expect(said(shop(), drop('ticket_payments', 'card-payment@1', 'order'))).toContain('ticket_payments as card-payment@1/payments: the pairing does not say which table plays "order" ("tables")');
    // The lines need not say where the codes are: nothing of theirs points there.
    expect(said(shop(), drop('ticket_lines', 'discountable@1', 'codes'))).toEqual([]);
    // Lines that are named and never paired are never read.
    expect(said(shop(), PAIRINGS.filter((pairing) => !(pairing.table === 'ticket_lines' && pairing.shape === 'discountable@1')))).toEqual([
      'tickets as discountable@1/order: "ticket_lines" plays "lines" and is paired with nothing: pair it as discountable@1/lines too',
    ]);
    expect(said(shop(), paired('ticket_codes', 'discountable@1', (pairing) => ({ ...pairing, tables: { ...pairing.tables, order: 'nowhere' } })))).toContain('ticket_codes as discountable@1/codes: the app has no table "nowhere" to play "order"');
    // An order that takes no typed code keeps no table of them, and a stay is its own one line.
    const plain = shop();
    delete adjustOf(plain)['codes'];
    expect(said(plain, drop('tickets', 'discountable@1', 'codes').filter((pairing) => pairing.table !== 'ticket_codes'))).toEqual([]);
  });

  it('a table with no price rule, or one answered by somebody else, does not fit the order', () => {
    expect(broken((app) => delete tableOf(app, 'tickets').adjust)).toContain('tickets as discountable@1/order: "tickets" has no price rule ("adjust"), which the part keeps');
    expect(broken((app) => Object.assign(adjustOf(app), { by: { addOn: 'other' } }))).toEqual(['tickets as discountable@1/order: the price rule is answered by another add-on than Offers']);
    expect(broken((app) => Object.assign(adjustOf(app), { surprise: true }))).toEqual(['tickets as discountable@1/order: the price rule carries "surprise", which the part does not']);
  });

  it('the rule writes each reduction to the column the pairing says plays it', () => {
    const order = '{"discount":"total","staff":{"by":"discount_by","kind":"discount_kind","reason":"discount_reason_id","value":"discount_value"}}';
    expect(broken((app) => Object.assign(adjustOf(app)['order'] as Doc, { discount: 'total' }))).toEqual([
      `tickets as discountable@1/order: the price rule's "order" is not the part's: it names ${order}, the part ${order.replace('"total"', '"discount_total"')}`,
    ]);
    expect(broken((app) => Object.assign(adjustOf(app)['order'] as Doc, { staff: { kind: 'discount_kind', value: 'discount_value', reason: 'discount_reason_id', by: 'customer_email' } }))).toHaveLength(1);
    expect(broken((app) => Object.assign(adjustOf(app)['order'] as Doc, { surprise: 'total' }))).toHaveLength(1);
    expect(broken((app) => Object.assign(lineOf(app), { discount: 'gross' }))).toEqual(['ticket_lines as discountable@1/lines: the price rule writes a line\'s reduction to "gross", and the pairing says "line_discount" plays it']);
    expect(broken((app) => Object.assign(lineOf(app), { surprise: 1 }))).toEqual(['tickets as discountable@1/order: the price rule\'s lines of "ticket_lines" carry something the part does not']);
    expect(broken((app) => Object.assign(lineOf(app), { table: 'ticket_payments' }))).toContain('tickets as discountable@1/order: the price rule reads the lines of "ticket_lines" nowhere');
    for (const [role, column] of [['typed', 'removed_at'], ['code', 'voucher_id'], ['voucher', 'code_id'], ['removed', 'typed']] as const) {
      expect(broken((app) => Object.assign(adjustOf(app)['codes'] as Doc, { [role]: column })), role).toHaveLength(1);
    }
    expect(broken((app) => Object.assign(adjustOf(app)['codes'] as Doc, { table: 'ticket_lines' }))).toEqual(['tickets as discountable@1/order: the price rule keeps its typed codes somewhere else than "ticket_codes"']);
  });

  it('what was used is recorded by a posting the rule names', () => {
    expect(broken((app) => Object.assign(adjustOf(app), { uses: 'nothing' }))).toEqual(['tickets as discountable@1/order: the price rule names no posting that records what was used ("uses")']);
    expect(broken((app) => (tableOf(app, 'tickets').postings = []))).toEqual([
      'tickets as discountable@1/order: the price rule names no posting that records what was used ("uses")',
      'tickets as discountable@1/order: "tickets" has no posting into Offers\' "redeem", which the part keeps',
    ]);
  });

  it('a line that loads a card or sells a voucher takes no reduction, and a card never pays for a card', () => {
    expect(broken((app) => delete lineOf(app)['excludes'])).toEqual([
      'ticket_lines as card-sale@1/lines: a line that loads a card takes no reduction: the price rule\'s lines of "ticket_lines" say "excludes": {"column":"load_ref","set":true}',
    ]);
    expect(broken((app) => Object.assign(lineOf(app), { excludes: { column: 'sold_voucher', set: true } }))).toHaveLength(1);
    expect(broken((app) => delete lineOf(app)['paidBy'])).toEqual([
      'ticket_lines as voucher-sale@1/lines: a line that sells a voucher takes no reduction: the price rule\'s lines of "ticket_lines" say "paidBy": {"column":"sold_voucher"}',
    ]);
    expect(broken((app) => delete tableOf(app, 'ticket_payments').postings![0]!['refuses'])).toEqual([
      'ticket_payments as card-payment@1/payments: a card may not pay for a card: the posting into "spend" says "refuses": [{"table": "ticket_lines", …, "column": "load_ref", "set": true}]',
    ]);
    expect(broken((app) => Object.assign((tableOf(app, 'ticket_payments').postings![0]!['refuses'] as Doc[])[0]!, { column: 'sold_voucher' }))).toHaveLength(1);
    // A shop that sells no card has nothing a card could wrongly pay for.
    const noCards = shop();
    delete tableOf(noCards, 'ticket_payments').postings![0]!['refuses'];
    expect(said(noCards, PAIRINGS.filter((pairing) => pairing.shape !== 'card-sale@1'))).toEqual([]);
  });

  it('a posting maps each input to the column the pairing says plays it, once', () => {
    const map = (table: string, at: number) => (app: Shop) => tableOf(app, table).postings![at]!['map'] as Doc;
    expect(broken((app) => Object.assign(map('ticket_payments', 0)(app), { amount: 'card_balance_after' }))).toEqual([
      'ticket_payments as card-payment@1/payments: the posting into "spend" maps "amount" to "card_balance_after", and the part to "card_amount"',
    ]);
    expect(broken((app) => Object.assign(map('ticket_payments', 0)(app), { balance_after: 'amount' }))).toHaveLength(1);
    expect(broken((app) => Object.assign(map('ticket_lines', 0)(app), { card: 'sold_voucher' }))).toEqual(['ticket_lines as card-sale@1/lines: the posting into "issue" maps "card" to "sold_voucher", and the part to "load_ref"']);
    expect(broken((app) => Object.assign(map('ticket_lines', 1)(app), { tax_later: 'voided_at' }))).toHaveLength(1);
    expect(broken((app) => tableOf(app, 'ticket_lines').postings!.pop())).toEqual(['ticket_lines as voucher-sale@1/lines: "ticket_lines" has no posting into Offers\' "sell", which the part keeps']);
    expect(broken((app) => Object.assign(tableOf(app, 'ticket_lines').postings![0]!, { surprise: true }))).toEqual(['ticket_lines as card-sale@1/lines: the posting into "issue" carries "surprise", which the part does not']);
    expect(broken((app) => tableOf(app, 'ticket_payments').postings!.push({ ...tableOf(app, 'ticket_payments').postings![0]!, id: 'card-again' }))).toEqual([
      'ticket_payments as card-payment@1/payments: "ticket_payments" has 2 postings into Offers\' "spend": one row posts once',
    ]);
    // What is still due is the host's own balance, mapped its own way; so is when the rule fires and how long it holds.
    expect(broken((app) => Object.assign(map('ticket_payments', 0)(app), { due: { parent: 'total' } }))).toEqual([]);
    expect(broken((app) => Object.assign(tableOf(app, 'ticket_payments').postings![0]!, { post: { on: { to: ['paid'] } }, heldUntil: { column: 'x' }, only: { column: 'method', eq: 'card' } }))).toEqual([]);
    // A payment that keeps no figure of what the card then holds maps none.
    const short = shop();
    delete map('ticket_payments', 0)(short)['balance_after'];
    expect(said(short, paired('ticket_payments', 'card-payment@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, card_balance_after: null } })))).toEqual([]);
    expect(said(shop(), paired('ticket_payments', 'card-payment@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, card_balance_after: null } })))).toEqual([
      'ticket_payments as card-payment@1/payments: the posting into "spend" maps "balance_after" to "card_balance_after", and the part to null',
    ]);
  });

  it('a column of the app\'s own that carries a part column\'s name is left alone, and Offers\' own column names are not taken for the app\'s', () => {
    // `ticket_payments.amount` is the shop's (every tender's); `card_amount` plays the part's `amount`. The typed card is in `code`.
    expect(columnOf(shop(), 'ticket_payments', 'amount')).toBeDefined();
    expect(broken((app) => Object.assign(columnOf(app, 'ticket_payments', 'amount'), { type: 'text', maxLength: 10, scale: undefined }))).toEqual([]);
    // The card is looked for in Offers' `code` column whatever the shop calls its own.
    expect(broken((app) => Object.assign((columnOf(app, 'ticket_payments', 'card_id')['rules'] as Doc)['lookup'] as Doc, { column: 'label' }))).toEqual([
      'ticket_payments as card-payment@1/payments: "ticket_payments.card_id" changes the shape\'s lookup rule',
    ]);
    expect(broken((app) => Object.assign((columnOf(app, 'ticket_payments', 'card_id')['rules'] as Doc)['lookup'] as Doc, { from: 'method' }))).toHaveLength(1);
    // A typed card kept nowhere: the link is then filled from a look-up, by no rule.
    const scanned = shop();
    delete (columnOf(scanned, 'ticket_payments', 'card_id')['rules'] as Doc)['lookup'];
    expect(said(scanned, paired('ticket_payments', 'card-payment@1', (pairing) => ({ ...pairing, columns: { ...pairing.columns, card_code: null } })))).toEqual([]);
  });

  it('a pairing that names a table or a part that is not there says so', () => {
    expect(shapeFit(shop(), [{ table: 'nowhere', shape: 'discountable@1', part: 'order' }], SHAPES).map((issue) => issue.message)).toEqual(['the app has no table "nowhere"']);
    expect(shapeFit(shop(), [{ table: 'tickets', shape: 'discountable@2', part: 'order' }], SHAPES).map((issue) => issue.message)).toEqual(['"discountable@2" has no part "order"']);
  });
});
