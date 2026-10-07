import { describe, expect, it } from 'vitest';

import { PART_MAX, ROWS_MAX, SAMPLE, cells, parse, parts, problemsOf } from './csv.ts';

describe('an opening-stock file', () => {
  it('reads cells as a spreadsheet writes them: quotes, doubled quotes, commas and line ends inside a cell', () => {
    expect(cells('sku,name\r\nA1,"Gloves, nitrile ""L"""\nB2,"two\nlines"\n')).toEqual([
      ['sku', 'name'],
      ['A1', 'Gloves, nitrile "L"'],
      ['B2', 'two\nlines'],
    ]);
    // A byte-order mark and blank lines are not rows.
    expect(cells('﻿sku\n\n A \n,\n')).toEqual([['sku'], [' A ']]);
  });

  it('finds its columns by name, in any order and any case, and numbers rows as the file does', () => {
    const parsed = parse('Quantity,SKU,Expires\n12,LID-1,2027-04-30\n3,GLV,\n');
    expect(parsed).toEqual({
      ok: true,
      rows: [
        { at: 2, sku: 'LID-1', barcode: '', name: '', quantity: '12', unit_cost: '', batch: '', expires: '2027-04-30' },
        { at: 3, sku: 'GLV', barcode: '', name: '', quantity: '3', unit_cost: '', batch: '', expires: '' },
      ],
    });
  });

  it('is refused whole when it names no quantity, names no item, is empty or is too long', () => {
    expect(parse('sku,name\nA,B\n')).toMatchObject({ ok: false, why: 'header', missing: ['quantity'] });
    expect(parse('quantity,batch\n1,X\n')).toMatchObject({ ok: false, why: 'header', missing: ['sku'] });
    expect(parse('')).toMatchObject({ ok: false, why: 'empty' });
    expect(parse(SAMPLE)).toMatchObject({ ok: false, why: 'empty' });
    expect(parse(`sku,quantity\n${'A,1\n'.repeat(ROWS_MAX + 1)}`)).toMatchObject({ ok: false, why: 'too-many', count: ROWS_MAX + 1 });
    expect(parse(`sku,quantity\n${'A,1\n'.repeat(ROWS_MAX)}`)).toMatchObject({ ok: true });
  });

  it('takes a point as the decimal mark and a date as year-month-day, and nothing else', () => {
    const row = { at: 2, sku: 'A', barcode: '', name: '', quantity: '1.5', unit_cost: '1.1025', batch: '', expires: '2027-04-30' };
    expect(problemsOf(row)).toEqual([]);
    expect(problemsOf({ ...row, quantity: '1,5' })).toEqual(['quantity']);
    expect(problemsOf({ ...row, quantity: '0' })).toEqual(['quantity']);
    expect(problemsOf({ ...row, quantity: '1.2345' })).toEqual(['quantity']);
    expect(problemsOf({ ...row, unit_cost: '1.10255' })).toEqual(['unit_cost']);
    expect(problemsOf({ ...row, expires: '30 Apr 2027' })).toEqual(['expires']);
    expect(problemsOf({ ...row, expires: '2027-02-30' })).toEqual(['expires']);
    expect(problemsOf({ ...row, unit_cost: '', expires: '' })).toEqual([]);
  });

  it('is saved a thousand lines to a receipt, in the order of the file', () => {
    const list = Array.from({ length: 2 * PART_MAX + 1 }, (_unused, index) => index);
    expect(parts(list).map((part) => [part.length, part[0]])).toEqual([
      [PART_MAX, 0],
      [PART_MAX, PART_MAX],
      [1, 2 * PART_MAX],
    ]);
    expect(parts([])).toEqual([]);
  });
});
