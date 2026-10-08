import { describe, expect, it } from 'vitest';

import { BLANK, NOT_STORED, check, codeWord, fromRows, keptSteps, keptTargets, namesOf, needsTargets, neverApplies, offerValues, plain, same, type Form } from './form.ts';

const t = (_key: string, fallback: string, args: Record<string, unknown> = {}): string => fallback.replace(/\{(\w+)\}/g, (_all, name: string) => String(args[name] ?? ''));
const form = (patch: Partial<Form> = {}): Form => ({ ...BLANK, name: 'Autumn 5', publicName: { 'en-US': 'Autumn 5' }, gives: 'amount', value: '5.00', ...patch });
const wrong = (patch: Partial<Form>, uses = 0): Record<string, string> => check(t, form(patch), { ...NOT_STORED, uses }, 'en-US');

describe('a discount as the editor holds it', () => {
  it('reads an offer with its steps, targets and first code, whatever shape the database handed them in', () => {
    const offer = { id: 4, name: 'Monday mugs', public_name: '{"en-US":"Monday mugs","de-DE":"Montagstassen"}', gives: 'percent', value: '15.000', buy_qty: null, trigger: 'code', applies_to: 'lines', starts_on: '2026-09-15T00:00:00.000Z', ends_on: null, weekdays: '[1, 4]', from_time: '09:00', to_time: '12:00', min_spend: '30.0000', min_qty: 2, first_order_only: 1, group_id: 3, max_uses: 100, max_per_customer: null, budget_open: false, budget: '250.0000', combinable: true, status: 'active', uses: 9, given: '12.96', used_up: false };
    const read = fromRows(offer, [{ id: 2, from_qty: 8, value: '14.000' }, { id: 1, from_qty: 4, value: '8.000' }], [{ id: 7, kind: 'category', source_table: 'shop:categories', source_row: '2', label: 'Mugs' }], [{ id: 12, code: 'MUGS15' }, { id: 5, code: 'MONDAY' }]);
    expect(read.form).toMatchObject({ name: 'Monday mugs', publicName: { 'en-US': 'Monday mugs', 'de-DE': 'Montagstassen' }, gives: 'percent', value: '15', trigger: 'code', code: 'MONDAY', appliesTo: 'lines', startsOn: '2026-09-15', endsOn: '', allDay: false, fromTime: '09:00', toTime: '12:00', minSpend: '30.00', minQty: '2', firstOrderOnly: true, groupId: '3', maxUses: '100', maxPerCustomer: '', budget: '250.00', combinable: true });
    expect(read.form.weekdays).toEqual([false, true, false, false, true, false, false]);
    // Steps in rising order, each with its key.
    expect(read.form.steps).toEqual([{ id: '1', fromQty: '4', value: '8' }, { id: '2', fromQty: '8', value: '14' }]);
    expect(read.stored).toMatchObject({ id: '4', status: 'active', uses: 9, given: '12.96', usedUp: false, codeId: '5', code: 'MONDAY', codes: 2, steps: ['1', '2'], targets: ['7'] });
  });

  it('reads a name kept by language from a map, its text, a quoted text or one bare name', () => {
    expect(namesOf({ 'en-US': 'Autumn 5', 'de-DE': '' })).toEqual({ 'en-US': 'Autumn 5' });
    expect(namesOf('{"en-US":"Autumn 5"}')).toEqual({ 'en-US': 'Autumn 5' });
    expect(namesOf('"Autumn 5"')).toEqual({ 'en-US': 'Autumn 5' });
    expect(namesOf('Autumn 5')).toEqual({ 'en-US': 'Autumn 5' });
    expect(namesOf('{broken')).toEqual({ 'en-US': '{broken' });
    for (const none of [null, undefined, '', '  ', 5, []]) expect(namesOf(none)).toEqual({});
  });

  it('sends what a save keeps: an open budget, every day, all day and nobody in particular as nothing', () => {
    expect(offerValues(form())).toEqual({ name: 'Autumn 5', public_name: { 'en-US': 'Autumn 5' }, gives: 'amount', value: '5.00', buy_qty: null, bonus_qty: null, trigger: 'automatic', applies_to: 'order', starts_on: null, ends_on: null, weekdays: null, from_time: null, to_time: null, min_spend: null, min_qty: null, first_order_only: false, group_id: null, max_uses: null, max_per_customer: null, budget_open: true, budget: null, combinable: false });
    expect(offerValues(form({ weekdays: [false, true, false, false, true, false, false], allDay: false, fromTime: '09:00', toTime: '12:00', budget: '250', groupId: '3', maxUses: '100' }))).toMatchObject({ weekdays: '1,4', from_time: '09:00', to_time: '12:00', budget_open: false, budget: '250', group_id: 3, max_uses: 100 });
    // Hours typed and then switched back to all day are not kept.
    expect(offerValues(form({ allDay: true, fromTime: '09:00', toTime: '12:00' }))).toMatchObject({ from_time: null, to_time: null });
    // A 2 for 1: buy so many, one is on us, no figure of its own.
    expect(offerValues(form({ gives: 'bonus_item', buyQty: '3', value: '9' }))).toMatchObject({ value: null, buy_qty: 3, bonus_qty: 1, applies_to: 'lines' });
    expect(offerValues(form({ gives: 'quantity_price', value: '9' }))).toMatchObject({ value: null, applies_to: 'lines' });
  });

  it('keeps targets only for a discount on named things, and steps only for a price by quantity', () => {
    const target = { kind: 'item' as const, sourceTable: 'shop:products', sourceRow: '7', label: 'Mug' };
    const step = { fromQty: '4', value: '8' };
    expect(needsTargets(form())).toBe(false);
    expect(keptTargets(form({ targets: [target] }))).toEqual([]);
    expect(keptTargets(form({ appliesTo: 'lines', targets: [target] }))).toEqual([target]);
    for (const gives of ['bonus_item', 'fixed_price', 'quantity_price'] as const) expect(needsTargets(form({ gives })), gives).toBe(true);
    expect(keptSteps(form({ steps: [step] }))).toEqual([]);
    expect(keptSteps(form({ gives: 'quantity_price', steps: [step] }))).toEqual([step]);
  });

  it('finds what Adminium would refuse, on the field it would name', () => {
    expect(wrong({})).toEqual({});
    expect(wrong({ name: ' ' })).toHaveProperty('name');
    expect(wrong({ publicName: { 'de-DE': 'Herbst 5' } })).toHaveProperty('public_name');
    for (const value of ['', '0', '101', 'ten']) expect(wrong({ gives: 'percent', value }), value).toHaveProperty('value');
    expect(wrong({ gives: 'percent', value: '100' })).toEqual({});
    expect(wrong({ gives: 'amount', value: '0' })).toHaveProperty('value');
    // A fixed price of nothing is a price; a 2 for 1 of one is not.
    expect(wrong({ gives: 'fixed_price', value: '0', targets: [{ kind: 'item', sourceTable: 't', sourceRow: '1', label: 'x' }] })).toEqual({});
    for (const buyQty of ['1', '11', '']) expect(wrong({ gives: 'bonus_item', buyQty }), buyQty).toHaveProperty('buy_qty');
    expect(wrong({ appliesTo: 'lines' })).toHaveProperty('targets');
    expect(wrong({ trigger: 'code', code: ' - ' })).toHaveProperty('code');
    expect(wrong({ trigger: 'code', code: 'autumn-5' })).toEqual({});
    expect(wrong({ startsOn: '2026-09-15', endsOn: '2026-09-14' })).toHaveProperty('ends_on');
    expect(wrong({ startsOn: '2026-09-15', endsOn: '2026-09-15' })).toEqual({});
    expect(wrong({ allDay: false, fromTime: '17:00', toTime: '09:00' })).toHaveProperty('to_time');
    expect(wrong({ allDay: false, fromTime: '09:00', toTime: '' })).toHaveProperty('to_time');
    expect(wrong({ maxUses: '0' })).toHaveProperty('max_uses');
    expect(wrong({ maxUses: '49' }, 50)['max_uses']).toBe('50 are already used. Enter 50 or more.');
    expect(wrong({ maxUses: '50' }, 50)).toEqual({});
    expect(wrong({ minQty: '0' })).toHaveProperty('min_qty');
    expect(wrong({ budget: '0' })).toHaveProperty('budget');
  });

  it('holds the steps of a price by quantity to rising quantities and rising percents', () => {
    const targets = [{ kind: 'item' as const, sourceTable: 't', sourceRow: '1', label: 'x' }];
    const steps = (list: [string, string][]): Record<string, string> => wrong({ gives: 'quantity_price', targets, steps: list.map(([fromQty, value]) => ({ fromQty, value })) });
    expect(steps([['4', '8'], ['8', '14'], ['12', '18']])).toEqual({});
    expect(steps([])).toHaveProperty('steps');
    expect(steps([['1', '8']])).toHaveProperty(['steps.0.from_qty']);
    expect(steps([['4', '8'], ['4', '14']])['steps.1.from_qty']).toBe('Each step starts above the one before (4 each).');
    expect(steps([['4', '8'], ['8', '8']])['steps.1.value']).toBe('Give more off than the step before (8 %).');
    expect(steps([['4', '0']])).toHaveProperty(['steps.0.value']);
  });

  it('says when a discount can never apply, and when two forms are the same save', () => {
    expect(neverApplies(form({ startsOn: '2026-09-15', endsOn: '2026-09-14' }))).toBe(true);
    expect(neverApplies(form({ startsOn: '2026-09-15' }))).toBe(false);
    expect(same(form(), form({ name: 'Autumn 5 ' }))).toBe(true);
    expect(same(form(), form({ value: '6.00' }))).toBe(false);
    // A code typed for a discount that starts by itself is no change; for one that starts with a code it is.
    expect(same(form(), form({ code: 'X' }))).toBe(true);
    expect(same(form({ trigger: 'code', code: 'a-b' }), form({ trigger: 'code', code: 'AB' }))).toBe(true);
    expect(same(form({ trigger: 'code', code: 'AB' }), form({ trigger: 'code', code: 'AC' }))).toBe(false);
    expect(codeWord(' autumn-5 ')).toBe('AUTUMN5');
    expect(plain('15.000')).toBe('15');
    expect(plain('12.500')).toBe('12.5');
    expect(plain('100')).toBe('100');
  });
});
