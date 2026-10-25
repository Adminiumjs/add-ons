/**
 * The signed copy: what a customer signed on site, drawn from an app's row.
 *
 * It is the one kind that is not about money. It names the work, where and
 * when it was done, the checks the customer saw (each "Yes" or "No"), what was
 * still to put right at the moment of signing, the signature itself as a
 * picture, who signed and when — and a footer on every page that says what the
 * copy is, with the page's number.
 *
 * The picture is the reason the kind needed the host's `picture` slot: the app
 * maps a column holding the signature file, and the host hands the file over as
 * a data URL. The copy is drawn with it and without it, from a PNG with
 * transparency (what a signing pad writes) and from a JPEG.
 */

import { crc32, deflateSync } from 'node:zlib';

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { SAMPLE_DOCUMENT_PICTURE } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { strings } from '../i18n/strings.ts';
import { describe as outlineOf, kinds } from '../kinds.ts';
import provider from '../server.ts';
import { wordsFor } from './words.ts';

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

/** 15:00 UTC on a summer Saturday is 16:00 in London. */
const NOW = { iso: '2026-07-27T08:00:00.000Z', timezone: 'Europe/London' };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;
const KIND = 'signed-copy';

/** A PNG made here, so the test owns every byte of it: 8-bit RGBA, one filter type per row. */
function rgbaPng(width: number, height: number, pixel: (x: number, y: number) => readonly [number, number, number, number]): string {
  const raw: number[] = [];
  for (let y = 0; y < height; y += 1) {
    raw.push(0);
    for (let x = 0; x < width; x += 1) raw.push(...pixel(x, y));
  }
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]);
  return `data:image/png;base64,${file.toString('base64')}`;
}

/** A drawn line on a clear ground, as a signing pad saves it. */
const SIGNATURE = {
  mediaType: 'image/png' as const,
  dataUrl: rgbaPng(40, 16, (x, y) => (Math.abs(y - 8 - Math.round(4 * Math.sin(x / 4))) <= 1 ? [25, 25, 32, 255] : [255, 255, 255, 0])),
  width: 40,
  height: 16,
};

/**
 * A real 8 × 8 colour JPEG, baseline, 645 bytes: written by Pillow 12
 * (`Image.new('RGB', (8, 8), grey)` with one dark row, quality 90), not by hand.
 */
const JPEG = {
  mediaType: 'image/jpeg' as const,
  dataUrl:
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDnft3iz/oCaL/4OJv/AJFooopgf//Z',
  width: 8,
  height: 8,
};

type Fields = Record<string, unknown>;

/** A sign-off as an app hands it over: the job by its title, never by its code. */
function signOff(fields: Fields = {}, locale = 'en-US'): DocumentSubject {
  return {
    now: NOW,
    locale,
    currency: 'GBP',
    business: { name: 'Meridian', lines: ['Unit 2, Aire Works', 'Leeds, United Kingdom'] },
    entity: null,
    number: null,
    fields: {
      customerName: 'Veldt Studios',
      customerLines: ['27 Kelvin Lane', 'Glasgow'],
      work: 'Studio meeting tables',
      site: '27 Kelvin Lane, Glasgow',
      doneOn: '2026-07-24',
      signedAt: '2026-07-25T15:00:00.000Z',
      signerName: 'Marta Kovac',
      signerRole: 'Studio Manager',
      checks: [
        'Everything on the list is on site',
        'Nothing damaged, nothing marked',
        'Keys and spares handed over',
        'Floor left as we found it',
        'Shown them how it works',
      ].join('\n'),
      // The two spellings a database gives a yes: `true`, and `1`.
      check1: true,
      check2: 1,
      check3: true,
      check4: 1,
      check5: true,
      snags: JSON.stringify([
        { what: 'Edge trim lifting on the small table', by: '2026-08-03' },
        { what: 'Wrong castors on two of the chairs', by: '2026-07-30', note: 'Right castors go out on Thursday.' },
      ]),
      signature: SIGNATURE,
      ...fields,
    },
    collections: {},
  };
}

async function draw(subject: DocumentSubject, formats: readonly ('html' | 'pdf')[] = ['html', 'pdf'], paper: 'a4' | 'letter' = 'a4'): Promise<readonly RenderedDocument[]> {
  const outcome = await provider.render({ kind: KIND, subject, formats, paper, settings: {} });
  if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
  return outcome;
}

const htmlOf = (documents: readonly RenderedDocument[]) => UTF8.decode(documents.find((d) => d.format === 'html')!.bytes);
const pdfOf = (documents: readonly RenderedDocument[]) => LATIN1.decode(documents.find((d) => d.format === 'pdf')!.bytes);
const seen = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/ class="[^"]*"/g, '');

/** The text a PDF page draws, in order: every `(…) Tj` literal, unescaped. */
function drawnOn(pdf: string): string[] {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((match) => match[1]!.replace(/\\(.)/g, '$1'));
}

/** The content streams of a PDF, one per page, in page order. */
function pagesOf(pdf: string): string[] {
  return [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => match[1]!).filter((stream) => stream.includes(' Tj'));
}

const outlineKind = () => kinds().find((entry) => entry.id === KIND)!;

describe('the signed copy is a kind of its own', () => {
  it('is listed with its name in every language, as a sheet in both formats', () => {
    const kind = kinds().find((entry) => entry.id === KIND);
    expect(kind).toBeDefined();
    expect([...kind!.formats].sort()).toEqual(['html', 'pdf']);
    expect(kind!.paper).toEqual(['a4', 'letter']);
    expect(kind!.label['en-US']).toBe('Signed copy');
    for (const locale of LOCALES) expect(kind!.label[locale], locale).not.toBe('');
  });

  it('takes the signature as a picture the host hands over, never from a list, never required', () => {
    const slots = outlineOf(KIND).slots;
    const signature = slots.find((slot) => slot.id === 'signature');
    expect(signature).toMatchObject({ type: 'picture', required: false });
    expect(slots.filter((slot) => slot.type === 'collection')).toEqual([]);
    expect(slots.filter((slot) => slot.required).map((slot) => slot.id).sort()).toEqual(['signedAt', 'signerName', 'work']);
    expect(slots.map((slot) => slot.id)).toEqual(expect.arrayContaining(['check1', 'check2', 'check3', 'check4', 'check5', 'checks', 'snags']));
  });

  it('refuses a copy with nobody named as having signed it', async () => {
    const outcome = await provider.render({ kind: KIND, subject: signOff({ signerName: '' }), formats: ['pdf'], paper: 'a4', settings: {} });
    expect(outcome).toMatchObject({ code: 'MISSING_SLOT' });
    expect((outcome as { detail: string }).detail).toContain('signerName');
  });

  it('has a button on the record in every language', () => {
    for (const locale of LOCALES) expect(strings[locale]['addon.invoices.record.kind.signedCopy'], locale).toBe(outlineKind().label[locale]);
  });
});

describe('the copy on paper', () => {
  it('names the work, the checks, what was still open, who signed and when — and draws the signature', async () => {
    const pdf = pdfOf(await draw(signOff()));
    const text = drawnOn(pdf);
    for (const expected of [
      'Signed copy',
      'FOR',
      'Veldt Studios',
      'Work',
      'Studio meeting tables',
      'Site',
      '27 Kelvin Lane, Glasgow',
      'Done',
      'Jul 24, 2026',
      'Signed',
      'Jul 25, 2026, 4:00 PM',
      'WHAT WAS CHECKED',
      'Everything on the list is on site',
      'Shown them how it works',
      'STILL TO PUT RIGHT WHEN IT WAS SIGNED',
      'Edge trim lifting on the small table',
      'By Aug 3, 2026',
      'Right castors go out on Thursday.',
      'SIGNED BY',
      'Marta Kovac, Studio Manager',
      'Page 1 of 1',
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(text.filter((line) => line === 'Yes')).toHaveLength(5);
    expect(text).not.toContain('No');
    expect(text.join(' ')).toContain('This copy records what was checked and signed on site. Meridian keeps the original.');
    // The picture: an image object with its transparency kept as a soft mask, drawn on the page.
    expect(pdf).toContain('/XObject<</Im1 ');
    expect(pdf).toContain('/Im1 Do');
    expect(pdf).toContain('/SMask ');
  });

  it('draws a JPEG signature as it came', async () => {
    const pdf = pdfOf(await draw(signOff({ signature: JPEG }), ['pdf']));
    expect(pdf).toContain('/DCTDecode');
    expect(pdf).toContain('/Im1 Do');
  });

  it('is drawn without a signature when the host hands none over', async () => {
    const pdf = pdfOf(await draw(signOff({ signature: undefined }), ['pdf']));
    expect(pdf).not.toContain('/XObject');
    expect(pdf).not.toContain(' Do\n');
    expect(drawnOn(pdf)).toContain('Marta Kovac, Studio Manager');
  });

  it('reads a check left unticked as "No", in ink and bold, where a ticked one is "Yes"', async () => {
    const pdf = pdfOf(await draw(signOff({ check3: false, check5: 0 }), ['pdf']));
    expect(drawnOn(pdf).filter((line) => line === 'No')).toHaveLength(2);
    expect(drawnOn(pdf).filter((line) => line === 'Yes')).toHaveLength(3);
    // Bold is /F2; a "Yes" is regular, /F1.
    expect(pdf).toMatch(/\/F2 [\d.]+ Tf\n[^\n]+Tm\n\(No\) Tj/);
    expect(pdf).toMatch(/\/F1 [\d.]+ Tf\n[^\n]+Tm\n\(Yes\) Tj/);
  });

  it('says nothing was left to put right when the list the app wrote is empty, and leaves the heading off when it wrote none', async () => {
    const empty = drawnOn(pdfOf(await draw(signOff({ snags: '[]' }), ['pdf'])));
    expect(empty).toContain('Nothing was left to put right.');
    const none = drawnOn(pdfOf(await draw(signOff({ snags: undefined }), ['pdf'])));
    expect(none).not.toContain('STILL TO PUT RIGHT WHEN IT WAS SIGNED');
    expect(none).not.toContain('Nothing was left to put right.');
  });

  it('reads a list written one line a snag, with no days', async () => {
    const text = drawnOn(pdfOf(await draw(signOff({ snags: 'Scuff on the end panel\nOne chair arm loose' }), ['pdf'])));
    expect(text).toContain('Scuff on the end panel');
    expect(text).toContain('One chair arm loose');
  });

  it('numbers every page of a long copy and keeps the signature whole on one page', async () => {
    const many = Array.from({ length: 40 }, (_, at) => ({ what: `Snag number ${String(at + 1)} on the long table`, by: '2026-08-03', note: 'A part is on order.' }));
    const pdf = pdfOf(await draw(signOff({ snags: JSON.stringify(many) }), ['pdf']));
    const pages = pagesOf(pdf);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((stream, at) => {
      expect(drawnOn(stream), `page ${String(at + 1)}`).toContain(`Page ${String(at + 1)} of ${String(pages.length)}`);
      expect(drawnOn(stream).join(' '), `page ${String(at + 1)}`).toContain('Meridian keeps the original.');
    });
    const signedOn = pages.findIndex((stream) => drawnOn(stream).includes('SIGNED BY'));
    expect(signedOn).toBeGreaterThan(-1);
    expect(drawnOn(pages[signedOn]!)).toContain('Marta Kovac, Studio Manager');
    expect(pages[signedOn]).toContain('/Im1 Do');
  });

  it('wraps a long name for the work beside its label rather than over it', async () => {
    const work = 'Studio meeting tables, the reception desk and the long boardroom bench';
    const text = drawnOn(pdfOf(await draw(signOff({ work }), ['pdf'])));
    expect(text).not.toContain(work);
    expect(text.join(' ')).toContain('Studio meeting tables,');
    expect(text.join(' ')).toContain('bench');
  });

  it('fits on US Letter as on A4', async () => {
    const text = drawnOn(pdfOf(await draw(signOff(), ['pdf'], 'letter')));
    expect(text).toContain('Page 1 of 1');
    expect(text).toContain('SIGNED BY');
  });

  it('is named by the work, never by a number', async () => {
    const [document] = await draw(signOff(), ['pdf']);
    expect(document!.filename).toBe('signed-copy-Studio-meeting-tables.pdf');
  });
});

describe('the copy on screen and for printing', () => {
  it('shows the same copy, the signature as the picture itself', async () => {
    const html = htmlOf(await draw(signOff(), ['html']));
    expect(html).toContain(`<img class="sig" alt="Signature of Marta Kovac" src="${SIGNATURE.dataUrl}">`);
    const words = seen(html);
    for (const expected of ['Signed copy', 'What was checked', 'Still to put right when it was signed', 'By Aug 3, 2026', 'Signed by', 'Marta Kovac, Studio Manager', 'Meridian keeps the original.']) {
      expect(words, expected).toContain(expected);
    }
  });

  it('draws no picture it was not handed', async () => {
    const html = htmlOf(await draw(signOff({ signature: undefined }), ['html']));
    expect(html).not.toContain('<img');
  });

  it('never takes a picture that is not one the host would hand over', async () => {
    const html = htmlOf(await draw(signOff({ signature: { ...SAMPLE_DOCUMENT_PICTURE, dataUrl: 'javascript:alert(1)' } }), ['html']));
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });

  it('is an Arabic copy for printing, and no PDF, in Arabic', async () => {
    const pdfOnly = await provider.render({ kind: KIND, subject: signOff({}, 'ar-EG'), formats: ['pdf'], paper: 'a4', settings: {} });
    expect(pdfOnly).toMatchObject({ code: 'LATIN_ONLY' });
    const html = htmlOf(await draw(signOff({}, 'ar-EG'), ['html', 'pdf']));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(wordsFor('ar-EG').kindSignedCopy);
  });

  it('has every word in every language', () => {
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      for (const key of ['kindSignedCopy', 'signedFor', 'work', 'site', 'doneOn', 'signedOn', 'whatWasChecked', 'yes', 'no', 'stillToPutRight', 'nothingLeft', 'byDay', 'signedBy', 'signedCopyFooter', 'pageOf', 'checkNumber', 'signatureOf'] as const) {
        expect(words[key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });
});
