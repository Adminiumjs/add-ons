import { qrSvg } from '@adminium/public-client/qr';
import { describe, expect, it } from 'vitest';

import { pictureOf, QR_PAGE_MAX_BYTES, qrFileName, qrOf } from './qr.ts';
import { decodeSvg } from './testing/decode.ts';

const at = (bytes: number): string => {
  const head = 'https://crm.meridian.example/x/forms/';
  return head + 'a'.repeat(bytes - head.length);
};

describe('a form’s QR code', () => {
  it('is Adminium’s own code of a page address, and decodes back to the link', () => {
    const link = 'https://crm.meridian.example/x/forms/showroom-visit';
    const qr = qrOf(link);
    expect(qr?.svg).toBe(qrSvg(link, { page: true }));
    expect(decodeSvg(qr!.svg)).toBe(link);
    expect(qr!.svg).not.toContain('showroom');
    // As a picture's address, the same document.
    expect(decodeURIComponent(pictureOf(qr!.svg).split(',').slice(1).join(','))).toBe(qr!.svg);
  });

  it('carries a link of up to 256 bytes, and refuses one byte more without throwing', () => {
    expect(QR_PAGE_MAX_BYTES).toBe(256);
    expect(decodeSvg(qrOf(at(256))!.svg)).toBe(at(256));
    expect(qrOf(at(257))).toBeNull();
    // Bytes, not characters: a name in another script counts what it weighs.
    expect(qrOf(`${at(250)}éééé`)).toBeNull();
  });

  it('names its files after the form', () => {
    expect(qrFileName('showroom-visit', 'png')).toBe('showroom-visit-qr.png');
    expect(qrFileName('showroom-visit', 'svg')).toBe('showroom-visit-qr.svg');
  });
});
