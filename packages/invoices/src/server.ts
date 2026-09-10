/**
 * The `document-render@1` provider — the module Adminium loads when a document
 * profile names this add-on (`manifest.addOn.provides[].server`).
 *
 * It is the SERVER half for the reason `barcode-labels` grew one: not to keep
 * a secret out of a browser — this add-on has no secret, no egress and no
 * account — but because the engine's `document.render` job runs in Node and
 * has to import something. The same rendering functions are exported from
 * `index.ts` too, so the two slot fills can draw a document in the page
 * without a round trip; nothing here is unreachable from a browser by design,
 * only by where the engine happens to call it.
 *
 * ── THE ORDER OF REFUSALS, WHICH IS THE WHOLE DESIGN ───────────────────────
 *
 *   1. UNSUPPORTED_KIND — before anything is read.
 *   2. INVALID_SUBJECT  — the body is not an object at all.
 *   3. MISSING_SLOT     — a required, non-defaulted slot has no value. All of
 *                         them, not the first: an operator fixing a mapping
 *                         wants the list.
 *   4. LATIN_ONLY       — checked over the LAID-OUT document, after the layout
 *                         and before a single byte is written, and only when
 *                         PDF was actually asked for.
 *
 * Step 4's placement is the one worth defending. Checking earlier — over the
 * raw subject — would miss the words the layout itself contributes and would
 * check strings that never reach the page. Checking later, inside the writer,
 * could only refuse a page it had already half-drawn and would report the
 * first bad glyph rather than all of them. Checking only when `pdf` is in
 * `formats` is what makes the refusal the WRITER's rather than the subject's:
 * the same document renders in HTML, in every language, and the conformance
 * suite asserts that pairing.
 */

import type {
  DocumentError,
  DocumentKind,
  DocumentOutline,
  DocumentRenderer,
  RenderInput,
  RenderedDocument,
} from '@adminium/add-on-host/contracts';

import { describe, isKnownKind, kinds } from './kinds.ts';
import { undrawnCharacters } from './pdf/helvetica.ts';
import { layout, type Document } from './render/layout.ts';
import { renderHtml } from './render/html.ts';
import { renderPdf } from './render/pdf.ts';
import { isRtl, wordsFor } from './render/words.ts';
import { documentFrom, refuseSubject } from './subject.ts';

const KEY = 'invoices';

/** Every string the finished document will draw, for the coverage check. */
function drawnText(document: Document): string {
  const parts: string[] = [];
  for (const block of document.blocks) {
    switch (block.kind) {
      case 'heading':
        parts.push(block.title, block.number);
        break;
      case 'parties':
        parts.push(block.fromLabel, block.toLabel, block.toName, ...block.from, ...block.to);
        break;
      case 'facts':
        for (const row of block.rows) parts.push(row.label, row.value);
        break;
      case 'items':
        for (const column of block.columns) parts.push(column.label);
        for (const row of block.rows) parts.push(...row);
        break;
      case 'ladder':
        for (const row of block.rows) parts.push(row.label, row.value);
        break;
      case 'passage':
        parts.push(block.heading, ...block.lines);
        break;
    }
  }
  return parts.join('\n');
}

/** A filename that survives a shell, a download and somebody's file manager. */
function filenameFor(kind: string, number: string, extension: string): string {
  const safe = number
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${kind}${safe === '' ? '' : `-${safe}`}.${extension}`;
}

export class InvoiceDocumentRenderer implements DocumentRenderer {
  readonly key = KEY;

  kinds(): readonly DocumentKind[] {
    return kinds();
  }

  describe(kind: string): DocumentOutline {
    return describe(kind);
  }

  /**
   * The contract's async member — a thin wrapper, and the asynchrony is the
   * CONTRACT's rather than this renderer's. Nothing here awaits anything: no
   * network, no disk, no font to load. The work is `renderSync` below, which
   * is exported so a slot fill can call it from a click handler and get bytes
   * back in the same tick. Two entry points, one implementation, which is what
   * makes "the same mapping gives the same bytes in a page and on a server"
   * structural rather than aspirational.
   */
  render(input: RenderInput): Promise<readonly RenderedDocument[] | DocumentError> {
    return Promise.resolve(renderSync(input));
  }
}

export function renderSync(input: RenderInput): readonly RenderedDocument[] | DocumentError {
  if (!isKnownKind(input.kind)) {
    return {
      code: 'UNSUPPORTED_KIND',
      detail: `this add-on draws ${kinds()
        .map((kind) => `'${kind.id}'`)
        .join(', ')}`,
    };
  }

  if (input.body !== undefined && (typeof input.body !== 'object' || Array.isArray(input.body))) {
    // A body this provider cannot make sense of AT ALL. A body with a field
    // this release has not heard of is not this — `document.ts` decodes any
    // object leniently, because a renderer is handed documents stored months
    // ago by older versions of the surface and its job is to draw them.
    return { code: 'INVALID_SUBJECT', detail: 'the authored body is not an object' };
  }

  const refusal = refuseSubject(input.kind, input.subject);
  if (refusal !== null) return refusal;

  const { body, extras } = documentFrom(input.kind, input.subject, input.body);
  const document = layout({
    body,
    extras,
    words: wordsFor(input.subject.locale),
    locale: input.subject.locale,
    rtl: isRtl(input.subject.locale),
  });

  const kind = kinds().find((entry) => entry.id === input.kind)!;
  const formats = input.formats.filter((format) => kind.formats.includes(format));

  if (formats.includes('pdf')) {
    const dropped = undrawnCharacters(drawnText(document));
    if (dropped.length > 0) {
      return {
        code: 'LATIN_ONLY',
        detail:
          'this add-on draws PDF in the base-14 fonts, which cover Latin scripts only; ' +
          'the same document renders in HTML in every language',
        dropped,
      };
    }
  }

  const documents: RenderedDocument[] = [];
  for (const format of formats) {
    documents.push(
      format === 'html'
        ? {
            format: 'html',
            filename: filenameFor(input.kind, body.number, 'html'),
            mediaType: 'text/html; charset=utf-8',
            bytes: renderHtml(document, input.paper),
            locale: input.subject.locale,
            warnings: [],
          }
        : {
            format: 'pdf',
            filename: filenameFor(input.kind, body.number, 'pdf'),
            mediaType: 'application/pdf',
            bytes: renderPdf(document, input.paper),
            locale: input.subject.locale,
            // The comp's five image slots are `data:` URIs. HTML carries one
            // directly; a PDF would need an XObject, a decoder for whatever
            // the URI holds and a position on the image formats — all of
            // which is a runtime dependency this package refuses (25 D11).
            // So the letterhead is drawn as text, and the caller is TOLD,
            // rather than finding a missing mark on a printed invoice.
            warnings:
              body.logoImage === '' ? [] : ['the letterhead image is drawn in HTML only'],
          },
    );
  }
  return documents;
}

export default new InvoiceDocumentRenderer();
