/**
 * WHAT THE CUSTOMER IS TOLD WHEN A FILE CAN'T BE USED: on a 3D-printed item,
 * that a raised logo has to be a drawing, and how to send one.
 */
import { describe, expect, it } from 'vitest';

import type { EditPart } from './catalogue.ts';
import { checksOf } from './say.ts';

const t = ((_key: string, english: string, values?: Record<string, unknown>) => english.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ''))) as Parameters<typeof checksOf>[1]['t'];
const front = { code: 'front', name: 'The front', kind: 'text', text: null, picture: null } as unknown as EditPart;
const refused = { ok: false, refusals: [{ reason: 'file-kind' as const, part: 'front' }], advice: [], used: [] };

describe('a file the design can’t use', () => {
  it('on a printed item, asks for the logo as an SVG drawing', () => {
    const [check] = checksOf(refused, { t, locale: 'en-US', look: 'maker', parts: [front], values: { parts: {} }, palette: null, printed: true });
    expect(check?.inline).toBe('A raised logo has to be a drawing: send it as an SVG. A picture has no edges to raise.');
    expect(check?.listed).toBe('The front: send your logo as an SVG drawing');
    expect(check?.block).toBe(true);
  });

  it('elsewhere, says the kind of file can’t be used', () => {
    const [check] = checksOf(refused, { t, locale: 'en-US', look: 'maker', parts: [front], values: { parts: {} }, palette: null });
    expect(check?.inline).toBe('That kind of file can’t be used here.');
  });
});
