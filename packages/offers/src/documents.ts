/**
 * WHAT OFFERS PRINTS — the `document-render@1` half of the add-on.
 *
 * A module of its own, apart from the file that decides prices and rows:
 * that one runs in a bare context with no clock; this one is loaded like any
 * provider and formats a date and an amount for the reader.
 *
 * Adminium hands it the subject — the card's or the voucher's own columns,
 * already read under the asker's grants, with the code's QR code drawn — and
 * gets one page of HTML back. Nothing is stored here or anywhere: a document
 * that prints a code is handed to the browser once and kept nowhere.
 */
import type { DocumentError, DocumentKind, DocumentOutline, DocumentRenderer, RenderInput, RenderedDocument } from '@adminium/add-on-contracts';

import { KINDS, kindOf, outlineOf } from './documents/kinds.ts';
import { draw } from './documents/render.ts';
import { localeOf } from './documents/words.ts';

const present = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';

const provider: DocumentRenderer = {
  key: 'offers',
  kinds(): readonly DocumentKind[] {
    return KINDS;
  },
  describe(kind: string): DocumentOutline {
    if (kindOf(kind) === undefined) throw new Error(`Offers prints no "${kind}"`);
    return outlineOf(kind);
  },
  async render(input: RenderInput): Promise<readonly RenderedDocument[] | DocumentError> {
    const kind = kindOf(input.kind);
    if (kind === undefined) return { code: 'UNSUPPORTED_KIND', detail: input.kind };
    if (!kind.paper.includes(input.paper)) return { code: 'INVALID_SUBJECT', detail: `a ${kind.id} is printed on ${kind.paper.join(' or ')}, not on ${input.paper}` };
    for (const slot of outlineOf(kind.id).slots) if (slot.required && !present(input.subject.fields[slot.id])) return { code: 'MISSING_SLOT', detail: slot.id };
    if (!input.formats.includes('html')) return [];
    const { html } = draw(kind.id, input.subject);
    return [{ format: 'html', filename: `${kind.id}.html`, mediaType: 'text/html; charset=utf-8', bytes: new TextEncoder().encode(html), locale: localeOf(input.subject.locale), warnings: [] }];
  },
};

export default provider;
