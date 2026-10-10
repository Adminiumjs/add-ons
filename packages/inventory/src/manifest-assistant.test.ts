/**
 * What Inventory tells the assistant: a line on what each of its main tables
 * is (so "how much do we have" is read from the right one), and questions a
 * person might ask on its pages.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string }[] }[];
const table = (ref: string) => tables.find((one) => one.ref === ref);
const assistant = (manifest.addOn as unknown as { assistant: { tables: Record<string, { is: string; columns?: Record<string, string> }>; questions: { key: string; text: Record<string, string>; page?: string }[] } }).assistant;

describe('what Inventory tells the assistant', () => {
  it('says what its main tables are, each in one line, and only of tables and columns it has', () => {
    for (const [ref, note] of Object.entries(assistant.tables)) {
      expect(table(ref), ref).toBeDefined();
      expect(note.is.length, ref).toBeLessThanOrEqual(200);
      for (const [column, text] of Object.entries(note.columns ?? {})) {
        expect(table(ref)!.columns.some((one) => one.ref === column), `${ref}.${column}`).toBe(true);
        expect(text.length).toBeLessThanOrEqual(160);
      }
    }
    // Where a quantity is read from is the thing most often got wrong.
    expect(assistant.tables['stock_points']!.is).toContain('how much do we have');
    expect(assistant.tables['items']!.is).toContain('stock_points');
  });

  it('offers questions in eight languages, each for all its pages or for one it has', () => {
    const pages = [...(manifest.pages as unknown as { ref: string }[]), ...(manifest.addOn.pages as unknown as { ref: string }[])].map((page) => page.ref);
    expect(assistant.questions.length).toBeGreaterThan(0);
    expect(assistant.questions.length).toBeLessThanOrEqual(8);
    for (const question of assistant.questions) {
      expect(Object.keys(question.text).sort()).toEqual(LOCALES);
      for (const text of Object.values(question.text)) expect(text.length).toBeLessThanOrEqual(120);
      if (question.page !== undefined) expect(pages).toContain(question.page);
    }
  });

  it('gives no step: nothing a rule does with stock is one row of one table', () => {
    expect((manifest.addOn as Record<string, unknown>)['steps']).toBeUndefined();
  });
});
