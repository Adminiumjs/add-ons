import { describe, expect, it } from 'vitest';

import { oneColourPixels } from '../browser/files.ts';
import type { FlatItem, FlatSheet } from '../draw/flat.ts';
import { laserSheet } from './make.ts';

const box = { x: 0, y: 0, w: 20, h: 20 };
const picture = (key: string, oneColour: boolean, threshold?: number): FlatItem => ({ key, code: key, box, live: true, locked: false, kind: 'picture', column: 'logo_file', drawn: box, fill: false, oneColour, colour: '#2a2018', picture: 'logo', ...(threshold === undefined ? {} : { threshold }) });
const sheet = (items: FlatItem[]): FlatSheet => ({ side: 'front', face: { kind: 'piece', width: 90, height: 90, corner: 4, colour: '#c8a27a', edge: '#8a6a4a' }, items } as unknown as FlatSheet);

describe('a one-colour logo on a piece’s proof (Maker F2)', () => {
  it('is painted from a picture of its own, at the line the customer set or the shop’s starting line', () => {
    const made = laserSheet(sheet([picture('logo-front', true, 62), picture('mark-front', true), picture('photo-front', false)]), 45);
    expect(made.sheet.items.map((item) => (item.kind === 'picture' ? item.column : null))).toEqual(['one-colour:logo-front', 'one-colour:mark-front', 'logo_file']);
    expect(made.laser).toEqual([
      { key: 'one-colour:logo-front', column: 'logo_file', threshold: 62, ink: '#2a2018' },
      { key: 'one-colour:mark-front', column: 'logo_file', threshold: 45, ink: '#2a2018' },
    ]);
  });

  it('leaves a sheet with no one-colour picture as it was', () => {
    const plain = sheet([picture('photo-front', false)]);
    expect(laserSheet(plain, 50)).toEqual({ sheet: plain, laser: [] });
  });

  it('engraves what is darker than the line in the ink and leaves the rest clear: a white square behind a logo is the material', () => {
    // Black, white, a mid grey: at 60 % the grey is engraved, at 40 % it is not.
    const light = { data: new Uint8Array([0, 255, 128]), width: 3, height: 1 };
    expect([...oneColourPixels(light, 60, '#2a2018')]).toEqual([0x2a, 0x20, 0x18, 255, 0, 0, 0, 0, 0x2a, 0x20, 0x18, 255]);
    expect([...oneColourPixels(light, 40, '#2a2018')]).toEqual([0x2a, 0x20, 0x18, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
