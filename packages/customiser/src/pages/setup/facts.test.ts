import { describe, expect, it } from 'vitest';

import { baseReady, canPublish, codeFor, dragged, drawnEnough, familyFromFile, fontUse, guidesOf, isWoff2, materialsIn, nudged, offeredOf, rulesFor, standardBox, startRules, svgSize, toggled, wordsRulesOf } from './facts.ts';

const COASTER = { width: 95, height: 95 };

describe("a base's set-up, as data", () => {
  it('draws the comp’s standard area for Enter: 25 % in, 38 % down, half across, 18 % high', () => {
    const box = standardBox(COASTER);
    for (const [key, want] of Object.entries({ x: 23.75, y: 36.1, w: 47.5, h: 17.1 })) expect(box[key as keyof typeof box]).toBeCloseTo(want, 6);
  });

  it('keeps a drag on the face, and draws nothing smaller than the comp’s 4 % by 3 %', () => {
    expect(dragged({ x: 80, y: 90 }, { x: 120, y: 10 }, COASTER)).toEqual({ x: 80, y: 10, w: 15, h: 80 });
    expect(drawnEnough({ x: 0, y: 0, w: 3.7, h: 20 }, COASTER)).toBe(false);
    expect(drawnEnough({ x: 0, y: 0, w: 3.81, h: 2.86 }, COASTER)).toBe(true);
  });

  it('moves the selected area a hundredth of the face per arrow, five with Shift, resizes with Alt, and keeps it on the face', () => {
    const box = { x: 10, y: 10, w: 20, h: 10 };
    expect(nudged(box, 'ArrowRight', { shift: false, alt: false }, COASTER)).toEqual({ ...box, x: 10.95 });
    expect(nudged(box, 'ArrowDown', { shift: true, alt: false }, COASTER)).toEqual({ ...box, y: 14.75 });
    expect(nudged(box, 'ArrowLeft', { shift: false, alt: true }, COASTER)).toEqual({ ...box, w: 19.05 });
    expect(nudged({ ...box, x: 74.5 }, 'ArrowRight', { shift: true, alt: false }, COASTER)?.x).toBe(75);
    expect(nudged(box, 'Enter', { shift: false, alt: false }, COASTER)).toBeNull();
  });

  it('starts an area as the comp does: 20 characters that grow with smaller letters on a piece, fixed points on a page', () => {
    const offered = { fonts: ['Manrope', 'Caveat', 'Oswald'], finishes: ['engraved', 'paint-white', 'paint-black'] };
    expect(startRules('piece', COASTER, offered)).toEqual({ chars: 20, grows: true, unit: 'mm', size: 6, min: 4, max: 10, fonts: ['Manrope', 'Caveat'], font: 'Manrope', finishes: ['engraved', 'paint-white'], finish: 'engraved' });
    expect(startRules('page', { width: 85, height: 55 }, offered)).toEqual({ chars: 20, grows: false, unit: 'pt', size: 9, min: 7, max: 14, fonts: ['Manrope', 'Caveat'], font: 'Manrope', finishes: [] });
  });

  it('keeps an area’s rules in the rule module’s shape as its form changes', () => {
    const offered = { fonts: ['Manrope', 'Caveat'], finishes: [] };
    const area = { takes: 'words', rules: JSON.stringify({ chars: 24, grows: true, unit: 'mm', size: 6, min: 4, max: 8, fonts: ['Manrope'], font: 'Manrope' }) };
    // The last font stays: an area that takes words offers one at least.
    expect(rulesFor(area, 'piece', COASTER, offered, { toggle: { field: 'fonts', value: 'Manrope' } })['fonts']).toEqual(['Manrope']);
    expect(rulesFor(area, 'piece', COASTER, offered, { toggle: { field: 'fonts', value: 'Caveat' } })['fonts']).toEqual(['Manrope', 'Caveat']);
    // A smallest above the largest takes the largest with it, and the design size stays between them.
    expect(rulesFor(area, 'piece', COASTER, offered, { set: { min: 9 } })).toMatchObject({ min: 9, max: 9, size: 9 });
    expect(rulesFor(area, 'piece', COASTER, offered, { takes: 'logo' })).toEqual({ picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' });
    expect(rulesFor(area, 'piece', COASTER, offered, { takes: 'both' })).toMatchObject({ chars: 24, alsoLogo: { picture: 'logo', file: 'logo_file' } });
    expect(rulesFor({ takes: 'logo', rules: JSON.stringify({ picture: 'logo' }) }, 'page', COASTER, offered, { takes: 'words' })).toMatchObject({ chars: 20, unit: 'pt', grows: false });
    expect(wordsRulesOf(area)).toEqual({ chars: 24, min: 4, max: 8, fonts: ['Manrope'], finishes: [] });
  });

  it('reads a JSON column handed back parsed or as text', () => {
    expect(offeredOf({ offered: JSON.stringify({ fonts: ['Manrope'], finishes: ['engraved'] }) })).toEqual({ fonts: ['Manrope'], finishes: ['engraved'] });
    expect(offeredOf({ offered: { fonts: ['Caveat'] } as never })).toEqual({ fonts: ['Caveat'], finishes: [] });
    expect(toggled({ fonts: ['a'], finishes: [] }, 'fonts', 'a')).toEqual({ fonts: [], finishes: [] });
  });

  it('calls a page done with its size, a piece only once its outline is in, and kits and printed items not yet', () => {
    expect(baseReady({ kind: 'page', width_mm: 85, height_mm: 55 })).toBe(true);
    expect(baseReady({ kind: 'piece', width_mm: 95, height_mm: 95, outline_file: null })).toBe(false);
    expect(baseReady({ kind: 'piece', width_mm: 95, height_mm: 95, outline_file: 'f1' })).toBe(true);
    expect(baseReady({ kind: 'kit', width_mm: 110, height_mm: 180 })).toBe(false);
  });

  it('publishes only a finished base with an area or a shown design, and a font (the comp’s checklist)', () => {
    const base = { kind: 'page', width_mm: 85, height_mm: 55 };
    expect(canPublish({ base, areas: 1, shown: 0, hidden: 0, fonts: 1, features: 0 })).toBe(true);
    expect(canPublish({ base, areas: 0, shown: 1, hidden: 0, fonts: 1, features: 0 })).toBe(true);
    expect(canPublish({ base, areas: 0, shown: 0, hidden: 2, fonts: 1, features: 0 })).toBe(false);
    expect(canPublish({ base, areas: 1, shown: 0, hidden: 0, fonts: 0, features: 0 })).toBe(false);
    expect(canPublish({ base: { kind: 'piece', width_mm: 95, height_mm: 95 }, areas: 1, shown: 1, hidden: 0, fonts: 3, features: 0 })).toBe(false);
  });

  it('takes a page’s bleed and safe line from the settings when the page names none', () => {
    expect(guidesOf({ width_mm: 85, height_mm: 55, sides: 2 }, { bleed: 3, safe: 4 })).toEqual({ width: 85, height: 55, bleed: 3, safe: 4, sides: 2, corner: 0 });
  });

  it('measures an outline by its width and height with their units, else by its viewBox in millimetres', () => {
    expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="95mm" height="95mm" viewBox="0 0 950 950">')).toEqual({ width: 95, height: 95 });
    expect(svgSize('<svg width="9.5cm" height="2in">')).toEqual({ width: 95, height: 50.8 });
    expect(svgSize('<svg viewBox="0 0 300 200">')).toEqual({ width: 300, height: 200 });
    expect(svgSize('<svg>')).toBeNull();
  });

  it('knows a WOFF2 by its first bytes and names it from its file as the comp does', () => {
    expect(isWoff2(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0]))).toBe(true);
    expect(isWoff2(new TextEncoder().encode('wOFF'))).toBe(false);
    expect(familyFromFile('harbour-script_Regular-webfont.woff2')).toBe('Harbour Script');
  });

  it('makes a code from a name, unique among those taken', () => {
    expect(codeFor('Your own logo', ['your-own-logo'], 'feature')).toBe('your-own-logo-2');
    expect(codeFor('النقش', [], 'feature')).toBe('feature');
  });

  it('lists the materials the app’s pieces are cut from once each, and counts the designs a font is used in', () => {
    expect(materialsIn([{ kind: 'piece', material: 'Walnut', thickness_mm: 6 }, { kind: 'piece', material: 'walnut', thickness_mm: '6' }, { kind: 'page', material: 'Card', thickness_mm: 1 }, { kind: 'piece', material: 'Slate', thickness_mm: 5 }])).toEqual([{ material: 'Slate', thickness: 5 }, { material: 'walnut', thickness: 6 }]);
    const used = fontUse([{ ready_design_id: 1, rules: JSON.stringify({ fonts: ['Manrope', 'Caveat'] }) }, { ready_design_id: 1, rules: JSON.stringify({ font: 'Manrope' }) }, { ready_design_id: 2, rules: JSON.stringify({ fonts: ['Manrope'] }) }]);
    expect(used.get('Manrope')?.size).toBe(2);
    expect(used.get('Caveat')?.size).toBe(1);
  });
});
