/**
 * What Offers gives to Automations and tells the assistant.
 *
 * One step, "Issue a voucher": a rule fills in who it is for and what it is
 * worth, and Adminium makes the voucher's row. The code is made by the
 * column's own rule and the voucher's own email carries it, so the step is
 * given neither. And a line on what each of the main tables is, so that a
 * voucher, a gift card and a discount code are not taken for one another.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

type Doc = Record<string, unknown>;
const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; nullable?: boolean; default?: unknown; role?: string; rules?: Doc }[] }[];
const table = (ref: string) => tables.find((one) => one.ref === ref)!;
const addOn = manifest.addOn as unknown as { steps: Doc[]; assistant: { tables: Record<string, { is: string; columns?: Record<string, string> }>; questions: { key: string; text: Record<string, string>; page?: string }[] } };
const everyLanguage = (text: unknown): void => expect(Object.keys(text as object).sort()).toEqual(LOCALES);

describe('the step Offers gives to a rule', () => {
  const step = addOn.steps[0] as { key: string; name: Doc; does: Doc; inputs: { key: string; kind: string; required?: boolean; label: Doc; options?: { value: string; label: Doc }[] }[]; writes: { table: string; values: Record<string, Doc> } };

  it('is one: issue a voucher, said in eight languages', () => {
    expect(addOn.steps).toHaveLength(1);
    expect(step.key).toBe('issue-voucher');
    everyLanguage(step.name);
    everyLanguage(step.does);
    for (const input of step.inputs) {
      everyLanguage(input.label);
      for (const option of input.options ?? []) everyLanguage(option.label);
    }
  });

  it('writes one voucher: who it is for, what it says and what it is worth, each from the rule', () => {
    expect(step.writes.table).toBe('vouchers');
    expect(step.writes.values).toEqual({
      holder_email: { input: 'to' },
      holder_name: { input: 'name' },
      public_name: { input: 'title' },
      worth: { input: 'worth' },
      value: { input: 'value' },
      // Which rule issued it, where a person at the desk reads it.
      note: { token: 'ruleName' },
    });
    expect(step.inputs.filter((input) => input.required === true).map((input) => input.key)).toEqual(['to', 'title', 'worth', 'value']);
    // An amount or a percent only: a thing or a pack names a row of somebody else's table, which a rule's text cannot.
    expect(step.inputs.find((input) => input.key === 'worth')!.options!.map((option) => option.value)).toEqual(['percent', 'amount']);
  });

  it('is given neither the code nor a state: Adminium makes the first, the table\'s own start is the second', () => {
    const written = Object.keys(step.writes.values);
    for (const decided of ['id', 'code', 'code_last4', 'status', 'issued_at', 'issued_by', 'uses_taken', 'uses_left', 'holder_key']) expect(written, decided).not.toContain(decided);
    // Every column a voucher cannot be saved without is filled by the step or by the column itself.
    const needed = table('vouchers').columns.filter((column) => column.role !== 'pk' && column.nullable !== true && column.default === undefined && !['code'].some((rule) => column.rules?.[rule] !== undefined));
    expect(needed.map((column) => column.ref).sort()).toEqual(['public_name', 'worth']);
    for (const column of needed) expect(written).toContain(column.ref);
  });

  it('the person it is for is told by the add-on\'s own email: a voucher with an address is one the outbox sends', () => {
    const producers = (manifest.outbox as unknown as { producers: { kind: string; onCreate?: { table: string; where?: Doc } }[] }).producers;
    expect(producers.find((producer) => producer.kind === 'voucher')!.onCreate).toEqual({ table: 'vouchers', where: { column: 'holder_email', isNull: false } });
    // And who it is for is kept personal by the table itself: the only place a rule may put a customer's address.
    for (const ref of ['holder_email', 'holder_name']) expect(table('vouchers').columns.find((column) => column.ref === ref)!.rules, ref).toMatchObject({ personal: true });
  });
});

describe('what Offers tells the assistant', () => {
  it('says what its main tables are, each in one line, and only of tables and columns it has', () => {
    for (const [ref, note] of Object.entries(addOn.assistant.tables)) {
      expect(table(ref), ref).toBeDefined();
      expect(note.is.length, ref).toBeLessThanOrEqual(200);
      for (const [column, text] of Object.entries(note.columns ?? {})) {
        expect(table(ref).columns.some((one) => one.ref === column), `${ref}.${column}`).toBe(true);
        expect(text.length).toBeLessThanOrEqual(160);
      }
    }
    // The three a person mixes up are told apart in so many words.
    expect(addOn.assistant.tables['vouchers']!.is).toContain('Not a gift card');
    expect(addOn.assistant.tables['gift_cards']!.is).toContain('Not a voucher');
    expect(addOn.assistant.tables['codes']!.is).toContain('Not a voucher');
  });

  it('offers questions in eight languages, each for all its pages or for one it has', () => {
    const pages = [...(manifest.pages as unknown as { ref: string }[]), ...(manifest.addOn.pages as unknown as { ref: string }[])].map((page) => page.ref);
    expect(addOn.assistant.questions.length).toBeGreaterThan(0);
    expect(addOn.assistant.questions.length).toBeLessThanOrEqual(8);
    for (const question of addOn.assistant.questions) {
      everyLanguage(question.text);
      for (const text of Object.values(question.text)) expect(text.length).toBeLessThanOrEqual(120);
      if (question.page !== undefined) expect(pages).toContain(question.page);
    }
  });
});
