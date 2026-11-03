/**
 * THE RULES OF A DESIGN, RULE BY RULE, ON THE SHOPS' OWN SAMPLES.
 *
 * Every design here is a sample design, or one made on a sample's ready-made
 * design, read the way Adminium reads it for the design question (the
 * manifest's own `addOn.checker`). The comps' cases are named by their board:
 * Birch Row's characters at size, its logo and the one-colour sheet; Marlow
 * Press's Harbour Bakery cards, the blurry logo, the photo on the back and the
 * hard-to-read palette.
 */
import { CHECK_REASONS } from '@adminium/add-on-contracts';
import { describe, expect, it } from 'vitest';

import { charCount, charLimit, checkDesign, contrast, lineCount, readValues, REASONS, sizeAllowed, sizeThatFits, type DesignAnswer, type FileFact } from './rules/index.ts';
import { textRules } from './rules/shapes.ts';
import { browserFacts, sampleDesign, sampleTables, type Tables } from './testing/samples.ts';
import type { Row } from './sample/bundle.ts';

const tables = sampleTables();
const MP_4112 = 'MP4112C8G2S6E4WB';
const BR_2288 = 'BR2288K7Q4X3M9ZD';
const BR_2289 = 'BR2289R4W8N2T6JC';
const BR_2290 = 'BR2290H5F3P9V8YA';

const logo = (over: Partial<FileFact> = {}): FileFact => ({ column: 'logo_file', kind: 'image/png', size: 48 * 1024, ...over });
const photo = (over: Partial<FileFact> = {}): FileFact => ({ column: 'photo_file', kind: 'image/jpeg', size: 900 * 1024, ...over });

const readyOf = (app: string, name: string, from: Tables = tables): Row => {
  const found = from['ready_designs']!.find((row) => row['app'] === app && row['name'] === name);
  if (found === undefined) throw new Error(`no ready-made design ${name}`);
  return found;
};
const baseOf = (app: string, name: string): Row => tables['bases']!.find((row) => row['app'] === app && row['name'] === name)!;

/** A customer's design on a sample's ready-made design. */
function designOn(app: 'maker' | 'printing', ready: string, values: unknown, over: Row = {}): Row {
  const row = readyOf(app, ready);
  return { id: 9000, app, code: 'ZZ00000000000001', format: 1, ready_design_id: row['id'], base_id: row['base_id'], values, state: 'draft', ...over };
}
/** A customer's design on a plain base: its areas are the parts. */
function plainOn(app: 'maker' | 'printing', base: string, values: unknown): Row {
  return { id: 9001, app, code: 'ZZ00000000000002', format: 1, ready_design_id: null, base_id: baseOf(app, base)['id'], values, state: 'draft' };
}
const ask = (design: Row, files: readonly FileFact[] = [], from: Tables = tables, extra = {}): DesignAnswer => checkDesign(browserFacts(design, from, files, extra));
const reasons = (answer: DesignAnswer) => answer.refusals.map((one) => `${one.part ?? '—'} ${one.reason}`);
const kinds = (answer: DesignAnswer) => answer.advice.map((one) => `${one.part} ${one.kind}`);
/** The tables with one table's rows changed. */
const changed = (ref: string, edit: (row: Row) => Row): Tables => ({ ...tables, [ref]: tables[ref]!.map(edit) });

describe('the closed list of reasons', () => {
  it('is Adminium’s, word for word', () => {
    expect([...REASONS]).toEqual([...CHECK_REASONS]);
  });
});

describe('characters at size: one rule with a switch per part', () => {
  const twoLinesTop = textRules(tables['ready_parts']!.find((row) => row['ready_design_id'] === readyOf('maker', 'Two lines')['id'] && row['code'] === 'top')!['rules']);
  const harbourTitle = textRules(tables['ready_parts']!.find((row) => row['ready_design_id'] === readyOf('printing', 'Harbour')['id'] && row['code'] === 'title' && row['layout'] === 'left')!['rules']);

  it('lets a laser part take more at smaller letters, in proportion: 16 at 10 mm is 26 at 6 mm and 13 at 12 mm', () => {
    expect(twoLinesTop).toMatchObject({ chars: 16, size: 10, grows: true, unit: 'mm' });
    expect(charLimit(twoLinesTop)).toBe(16);
    expect(charLimit(twoLinesTop, 6)).toBe(26);
    expect(charLimit(twoLinesTop, 12)).toBe(13);
    expect(charLimit(twoLinesTop, 6.5)).toBe(24);
  });

  it('holds a printed page’s part to the same limit at every size', () => {
    expect(harbourTitle).toMatchObject({ chars: 24, grows: false, unit: 'pt' });
    for (const size of [7, 7.5, 8.5]) expect(charLimit(harbourTitle, size)).toBe(24);
  });

  it('counts what prints: letters as code points, the ends trimmed, line breaks left out', () => {
    expect(charCount('  Anna & Ben  ')).toBe(10);
    expect(charCount('Street\nTown')).toBe(10);
    expect(charCount('Ünïcödé 👍')).toBe(9);
    expect(lineCount('Street\nTown\n')).toBe(2);
    expect(lineCount('   ')).toBe(0);
  });

  it('allows the sizes a part offers: a range on a piece, a list on a page', () => {
    const range = textRules({ size: 6, min: 4, max: 8 });
    expect([4, 6.5, 8, 3.9, 8.1].map((size) => sizeAllowed(range, size))).toEqual([true, true, true, false, false]);
    expect([6, 6.5].map((size) => sizeAllowed(textRules({ size: 6 }), size))).toEqual([true, false]);
    expect([7, 7.5, 8.5, 8].map((size) => sizeAllowed(harbourTitle, size))).toEqual([true, true, true, false]);
  });

  it('finds the largest size that fits, down to the smallest: the “Make it smaller” fix', () => {
    // BC "Too long": 24 characters in a part of 16 at 10 mm fit at 6.5 mm.
    expect(sizeThatFits(twoLinesTop, 'The Bellamy-Hart Kitchen', 10)).toBe(6.5);
    // Nothing smaller helps a fixed limit.
    expect(sizeThatFits(harbourTitle, 'Head baker and pastry chef, Quay Street', 7.5)).toBeNull();
    // 40 characters never fit 16 at 10 mm above the 6 mm floor.
    expect(sizeThatFits(twoLinesTop, 'x'.repeat(40), 10)).toBeNull();
  });
});

describe('Birch Row’s cases', () => {
  it('B7f “Too long”: the top line 8 characters over at 10 mm, the date needed — and smaller letters fit it', () => {
    const tooLong = ask(designOn('maker', 'Two lines', { parts: { top: { text: 'The Bellamy-Hart Kitchen', size: 10 } } }));
    expect(reasons(tooLong)).toEqual(['top too-long', 'date required-empty']);
    expect(tooLong.ok).toBe(false);
    const smaller = ask(designOn('maker', 'Two lines', { parts: { top: { text: 'The Bellamy-Hart Kitchen', size: 6.5 }, date: { text: '5.9.2026' } } }));
    expect(smaller).toMatchObject({ ok: true, refusals: [] });
  });

  it('B7a coasters with a logo: “The Pinfold · 2019” fits 22, the logo is 36.1 mm across and takes “Your own logo”', () => {
    const answer = ask(sampleDesign(tables, BR_2290), [logo({ kind: 'image/svg+xml', px: [200, 200] })]);
    expect(answer).toMatchObject({ ok: true, refusals: [], used: ['logo'] });
    expect(answer.advice).toEqual([]);
  });

  it('warns, never refuses, when a logo is too small to read: under 15 mm across at its size in the box', () => {
    const small = ask(designOn('maker', 'Ring', { finish: 'engraved', parts: { words: { text: 'The Pinfold' }, logo: { file: 'logo_file', scale: 40 } } }), [logo({ kind: 'image/svg+xml' })]);
    expect(small.ok).toBe(true);
    expect(small.advice).toEqual([{ part: 'logo', kind: 'logo-small', acrossMm: 14.4, smallestMm: 15 }]);
    // The box's slider stops at 30 %, and at 100 %.
    for (const scale of [25, 101]) expect(reasons(ask(designOn('maker', 'Ring', { parts: { words: { text: 'x' }, logo: { file: 'logo_file', scale } } }), [logo()]))).toEqual(['logo size-out-of-range']);
  });

  it('B7e the one-colour sheet: lines too fine to engrave are advice, gone when the logo is painted; the slider stays between 1 and 99', () => {
    const design = (finish: string, threshold = 82) => designOn('maker', 'Ring', { finish, parts: { words: { text: 'The Old Mill' }, logo: { file: 'logo_file', threshold } } });
    // 0.1 % of a 36.1 mm logo is a 0.04 mm line: the laser keeps 0.2 mm.
    const fine = logo({ px: [1200, 1200], thinnest: 0.001 });
    const engraved = ask(design('engraved'), [fine]);
    expect(engraved.ok).toBe(true);
    expect(engraved.advice).toEqual([{ part: 'logo', kind: 'fine-detail', lineMm: 0.04, smallestMm: 0.2 }]);
    expect(ask(design('paint-white'), [fine]).advice).toEqual([]);
    // A bolder line passes.
    expect(ask(design('engraved'), [logo({ px: [1200, 1200], thinnest: 0.01 })]).advice).toEqual([]);
    for (const threshold of [0, 100]) expect(reasons(ask(design('engraved', threshold), [fine]))).toEqual(['logo choice-not-allowed']);
    // The machine's thinnest line is the shop's setting.
    expect(ask(design('engraved'), [fine], tables, { settings: { smallest_line_mm: '0.03' } }).advice).toEqual([]);
  });

  it('B7b the book nook: “Iris’s Books” at 10 mm fits the sign’s 12, the left window left plain costs nothing', () => {
    expect(ask(sampleDesign(tables, BR_2288))).toEqual({ ok: true, refusals: [], advice: [], used: [] });
    // At 11 mm the sign takes 11: twelve letters do not fit.
    const at11 = sampleDesign(tables, BR_2288);
    expect(reasons(ask({ ...at11, values: { finish: 'engraved', parts: { sign: { text: "Iris's Books", font: 'Cormorant Garamond', size: 11 } } } }))).toEqual(['sign too-long']);
  });

  it('the left window takes words for nothing, and a logo for “Your own logo”', () => {
    const words = ask(designOn('maker', 'Corner shop', { parts: { sign: { text: 'Iris' }, lwin: { text: 'Open late' } } }));
    expect(words).toMatchObject({ ok: true, used: [] });
    const withLogo = ask(designOn('maker', 'Corner shop', { parts: { sign: { text: 'Iris' }, lwin: { mode: 'logo', file: 'logo_file' } } }), [logo()]);
    expect(withLogo).toMatchObject({ ok: true, used: ['logo'] });
  });

  it('the keyring: “SAM” raised in amber; letters under the printer’s 4 mm are refused, as are sizes the part does not offer', () => {
    expect(ask(sampleDesign(tables, BR_2289))).toMatchObject({ ok: true, used: [] });
    const at5 = designOn('maker', 'Name', { parts: { name: { text: 'SAM', size: 5 } } });
    expect(reasons(ask(at5))).toEqual(['name size-out-of-range']);
    // A part that allowed 3 mm letters is still held to its area's 4 mm floor.
    const looser = changed('ready_parts', (row) => (row['code'] === 'name' && row['ready_design_id'] === readyOf('maker', 'Name')['id'] ? { ...row, rules: { ...(row['rules'] as Row), min: 3 } } : row));
    expect(reasons(ask(designOn('maker', 'Name', { parts: { name: { text: 'SAM', size: 3.5 } } }), [], looser))).toEqual(['name size-out-of-range']);
    expect(ask(designOn('maker', 'Name', { parts: { name: { text: 'SAM', size: 4 } } }), [], looser).ok).toBe(true);
  });

  it('a plain coaster: its areas are the parts, the logo area takes “Your own logo”', () => {
    const plain = ask(plainOn('maker', 'Engraved walnut coasters', { finish: 'engraved', parts: { words: { text: 'The Hartleys' }, logo: { file: 'logo_file' } } }), [logo()]);
    expect(plain).toMatchObject({ ok: true, used: ['logo'] });
    expect(reasons(ask(plainOn('maker', 'Engraved walnut coasters', { parts: { words: { text: 'x'.repeat(25) } } })))).toEqual(['words too-long']);
    // The nook's shop sign is needed on a plain nook too.
    expect(reasons(ask(plainOn('maker', 'The Little Bookshop', { parts: { lwin: { mode: 'logo', file: 'logo_file' } } }), [logo()]))).toEqual(['sign required-empty']);
  });
});

describe('Marlow Press’s cases', () => {
  const harbour = (parts: Row, over: Row = {}) => designOn('printing', 'Harbour', { layout: 'left', palette: 'harbour', sides: 2, parts, ...over });
  const COLOURS = { colours: tables['palette_colours'] };

  it('B6a Harbour Bakery’s cards stand, both sides, and take “Print the back”', () => {
    expect(ask(sampleDesign(tables, MP_4112), [logo({ kind: 'image/svg+xml' })])).toEqual({ ok: true, refusals: [], advice: [], used: ['print-back'] });
  });

  it('on one side the back is neither checked nor paid for', () => {
    const front = harbour({ name: { text: 'Nell Fairweather' }, addr: { text: 'one\ntwo\nthree' } }, { sides: 1 });
    expect(ask(front)).toMatchObject({ ok: true, used: [] });
    expect(reasons(ask({ ...front, values: { ...(front['values'] as Row), sides: 2 } }))).toEqual(['addr too-long']);
  });

  it('B6c “Too long”: the job title 15 over its 24, at any size', () => {
    const tooLong = ask(harbour({ name: { text: 'Nell Fairweather' }, title: { text: 'Head baker and pastry chef, Quay Street' } }));
    expect(reasons(tooLong)).toEqual(['title too-long']);
    expect(charCount('Head baker and pastry chef, Quay Street') - 24).toBe(15);
    expect(reasons(ask(harbour({ name: { text: 'Nell' }, title: { text: 'Head baker and pastry chef, Quay Street', size: 7 } })))).toEqual(['title too-long']);
  });

  it('B6c the blurry logo: 96 × 64 px is 122 dpi at 20 × 20 mm, and the shop needs 150 — advice, never a refusal', () => {
    const blurry = ask(harbour({ name: { text: 'Nell Fairweather' }, logo: { file: 'logo_file' } }), [logo({ px: [96, 64] })]);
    expect(blurry.ok).toBe(true);
    expect(blurry.advice).toEqual([{ part: 'logo', kind: 'blurry', px: [96, 64], dpi: 122, boxMm: [20, 20], needs: 150 }]);
    // The shop's own setting decides; a vector logo is sharp at any size.
    expect(ask(harbour({ name: { text: 'N' }, logo: { file: 'logo_file' } }), [logo({ px: [96, 64] })], tables, { settings: { min_dpi: 100 } }).advice).toEqual([]);
    expect(ask(harbour({ name: { text: 'N' }, logo: { file: 'logo_file' } }), [logo({ kind: 'image/svg+xml', px: [96, 64] })]).advice).toEqual([]);
  });

  it('B6e a photo to the edge of the back: 1800 × 1240 is 502 dpi; the photo is needed only when the back is printed', () => {
    const photoBack = (parts: Row, sides = 2) => designOn('printing', 'Photo back', { layout: 'full', palette: 'day', sides, parts });
    expect(ask(photoBack({ name: { text: 'Harbour Bakery' }, photo: { file: 'photo_file' } }), [photo({ px: [1800, 1240] })])).toEqual({ ok: true, refusals: [], advice: [], used: ['print-back'] });
    expect(reasons(ask(photoBack({ name: { text: 'Harbour Bakery' } })))).toEqual(['photo required-empty']);
    expect(ask(photoBack({ name: { text: 'Harbour Bakery' } }, 1)).ok).toBe(true);
    // A small photo filling the back prints blurry.
    expect(kinds(ask(photoBack({ name: { text: 'H' }, photo: { file: 'photo_file' } }), [photo({ px: [400, 300] })]))).toEqual(['photo blurry']);
  });

  it('“Hard to read” on the Sand palette: the accent title on the paper is 1.49 : 1, and ink reads', () => {
    expect(contrast('#d9bf8c', '#f3ead8')).toBeCloseTo(1.49, 2);
    const sand = ask(harbour({ name: { text: 'Nell Fairweather' }, title: { text: 'Head baker' } }, { palette: 'sand', sides: 1 }), [], tables, COLOURS);
    expect(sand.ok).toBe(true);
    expect(sand.advice).toEqual([{ part: 'title', kind: 'hard-to-read', ratio: 1.49, better: 'ink' }]);
    // Harbour's own palette reads, and the server, with no colours, says nothing either way.
    expect(ask(harbour({ name: { text: 'Nell' }, title: { text: 'Head baker' } }, { sides: 1 }), [], tables, COLOURS).advice).toEqual([]);
    expect(ask(harbour({ name: { text: 'Nell' }, title: { text: 'Head baker' } }, { palette: 'sand', sides: 1 }), [], tables, { colours: undefined }).advice).toEqual([]);
  });

  it('“This runs past the safe line”, measured with the browser’s fonts, offers the largest size that fits', () => {
    // A stand-in for a font's widths: 0.7 of the letter size for each letter.
    const measure = (line: string, _font: string, sizeMm: number) => line.length * sizeMm * 0.7;
    const long = harbour({ name: { text: 'Bartholomew Fairweather-Ng' } }, { sides: 1 });
    const answer = ask(long, [], tables, { measure });
    expect(answer.ok).toBe(true);
    expect(answer.advice).toEqual([{ part: 'name', kind: 'past-safe-line', smaller: 11 }]);
    expect(ask(long).advice).toEqual([]);
  });
});

describe('every reason, each on its part', () => {
  const harbour = (parts: Row, over: Row = {}) => designOn('printing', 'Harbour', { layout: 'left', palette: 'harbour', parts: { name: { text: 'Nell' }, ...parts }, ...over });

  it('font-not-allowed: a font the part does not offer', () => {
    expect(reasons(ask(harbour({ name: { text: 'Nell', font: 'Comic Neue' } })))).toEqual(['name font-not-allowed']);
    expect(ask(harbour({ name: { text: 'Nell', font: 'Libre Baskerville' } })).ok).toBe(true);
  });

  it('size-out-of-range: a size off the part’s list', () => {
    expect(reasons(ask(harbour({ name: { text: 'Nell', size: 14 } })))).toEqual(['name size-out-of-range']);
    expect(ask(harbour({ name: { text: 'Nell', size: 15 } })).ok).toBe(true);
  });

  it('colour-not-allowed: a role, a palette, a finish or a colour choice the design does not offer', () => {
    expect(reasons(ask(harbour({ title: { text: 'Baker', colour: 'paper' } })))).toEqual(['title colour-not-allowed']);
    expect(reasons(ask(harbour({}, { palette: 'neon' })))).toEqual(['— colour-not-allowed']);
    expect(reasons(ask(designOn('maker', 'Ring', { finish: 'gold', parts: { words: { text: 'x' } } })))).toEqual(['words colour-not-allowed']);
    expect(reasons(ask(designOn('maker', 'Name', { parts: { name: { text: 'SAM' }, colour: { choice: 'red' } } })))).toEqual(['colour colour-not-allowed']);
  });

  it('choice-not-allowed: a layout, a motif, a side, a fit the design does not offer', () => {
    expect(reasons(ask(harbour({}, { layout: 'diagonal' })))).toEqual(['— choice-not-allowed']);
    expect(reasons(ask(designOn('maker', 'Sprig', { parts: { motif: { choice: 'cactus' } } })))).toEqual(['motif choice-not-allowed']);
    expect(reasons(ask(harbour({}, { sides: 3 })))).toEqual(['— choice-not-allowed']);
    // The keyring has one face.
    expect(reasons(ask(designOn('maker', 'Name', { sides: 2, parts: { name: { text: 'SAM' } } })))).toEqual(['— choice-not-allowed']);
    expect(reasons(ask(harbour({ logo: { file: 'logo_file', fit: 'stretch' } }), [logo()]))).toEqual(['logo choice-not-allowed']);
    // Words-only parts take no logo.
    expect(reasons(ask(harbour({ title: { mode: 'logo', file: 'logo_file' } }), [logo()]))).toEqual(['title choice-not-allowed']);
  });

  it('part-locked: a value for the shop’s own part, or for a part the design does not have', () => {
    expect(reasons(ask(designOn('maker', 'Ring', { parts: { words: { text: 'x' }, ring: { text: 'Mine' } } })))).toEqual(['ring part-locked']);
    expect(reasons(ask(harbour({ slogan: { text: 'Fresh daily' } })))).toEqual(['slogan part-locked']);
    // A name Adminium could not show is refused without one.
    expect(reasons(ask(harbour({ ['x'.repeat(80)]: { text: 'Hi' } })))).toEqual(['— part-locked']);
  });

  it('file-missing: a logo the design names but does not hold', () => {
    const withLogo = harbour({ logo: { file: 'logo_file' } });
    expect(reasons(ask(withLogo))).toEqual(['logo file-missing']);
    expect(reasons(ask(withLogo, [logo({ kind: '', size: 0 })]))).toEqual(['logo file-missing']);
    // Kept in the wrong column.
    expect(reasons(ask(harbour({ logo: { file: 'photo_file' } }), [photo()]))).toEqual(['logo file-missing']);
  });

  it('file-kind: a file of a kind the part does not take', () => {
    expect(reasons(ask(harbour({ logo: { file: 'logo_file' } }), [logo({ kind: 'image/heic' })]))).toEqual(['logo file-kind']);
    const pngOnly = changed('ready_parts', (row) => (row['code'] === 'logo' && row['app'] === 'printing' ? { ...row, rules: { ...(row['rules'] as Row), accept: ['png'] } } : row));
    expect(reasons(ask(harbour({ logo: { file: 'logo_file' } }), [logo({ kind: 'application/pdf' })], pngOnly))).toEqual(['logo file-kind']);
  });

  it('design-unknown: a ready-made design or base that is not there, not on the design’s base, or another app’s', () => {
    const own = designOn('maker', 'Ring', { parts: { words: { text: 'x' } } });
    const theirs = readyOf('printing', 'Harbour');
    // Another app's ready-made design, with this app's base or with its own.
    expect(reasons(ask({ ...own, ready_design_id: theirs['id'] }))).toEqual(['— design-unknown']);
    expect(reasons(ask({ ...own, ready_design_id: theirs['id'], base_id: theirs['base_id'] }))).toEqual(['— design-unknown']);
    // Another app's base, as a plain design.
    expect(reasons(ask({ ...plainOn('maker', 'Engraved walnut coasters', {}), base_id: baseOf('printing', 'Business cards')['id'] }))).toEqual(['— design-unknown']);
    // This app's ready-made design on another of its bases; one not there; a design on no base.
    expect(reasons(ask({ ...own, base_id: baseOf('maker', 'Walnut cutting board')['id'] }))).toEqual(['— design-unknown']);
    expect(reasons(ask({ ...own, ready_design_id: 999_999 }))).toEqual(['— design-unknown']);
    expect(reasons(ask({ ...own, base_id: null }))).toEqual(['— design-unknown']);
  });

  it('design-unknown: a part whose priced feature the shop no longer sells', () => {
    const design = designOn('maker', 'Ring', { parts: { words: { text: 'x' }, logo: { file: 'logo_file' } } });
    expect(reasons(ask(design, [logo()], changed('features', (row) => (row['code'] === 'logo' ? { ...row, active: false } : row))))).toEqual(['logo design-unknown']);
    expect(reasons(ask(design, [logo()], { ...tables, features: tables['features']!.filter((row) => row['code'] !== 'logo') }))).toEqual(['logo design-unknown']);
  });

  it('format-unknown: another format, values that are not JSON, or not in the shape', () => {
    const base = harbour({});
    expect(reasons(ask({ ...base, format: 2 }))).toEqual(['— format-unknown']);
    expect(reasons(ask({ ...base, values: '{not json' }))).toEqual(['— format-unknown']);
    expect(reasons(ask({ ...base, values: { parts: {}, colour: 'red' } }))).toEqual(['— format-unknown']);
    expect(reasons(ask({ ...base, values: { parts: { name: { text: 'Nell', bold: true } } } }))).toEqual(['name format-unknown']);
    expect(reasons(ask({ ...base, values: { parts: { name: { text: 42 } } } }))).toEqual(['name format-unknown']);
    expect(reasons(ask({ ...base, values: { parts: { name: { mode: 'both' } } } }))).toEqual(['name format-unknown']);
    expect(readValues(null)).toEqual({ ok: true, values: { parts: {} } });
  });

  it('says every reason it finds, each once, in the order of the parts', () => {
    const many = ask(designOn('maker', 'Two lines', { parts: { top: { text: 'x'.repeat(30), font: 'Nope', size: 20 }, date: { text: '' } } }));
    expect(reasons(many)).toEqual(['top size-out-of-range', 'top too-long', 'top font-not-allowed', 'date required-empty']);
  });
});

describe('the priced features a design takes', () => {
  it('a second side takes the base’s own feature: “Engrave both sides” beside “Your own logo”, sorted', () => {
    const both = ask(designOn('maker', 'Ring', { sides: 2, parts: { words: { text: 'x' }, logo: { file: 'logo_file' } } }), [logo()]);
    expect(both).toMatchObject({ ok: true, used: ['engrave-both-sides', 'logo'] });
  });

  it('a logo part left empty takes nothing', () => {
    expect(ask(designOn('maker', 'Ring', { parts: { words: { text: 'x' } } })).used).toEqual([]);
  });

  it('never depends on advice: a blurry logo is still a logo', () => {
    expect(ask(designOn('maker', 'Ring', { parts: { words: { text: 'x' }, logo: { file: 'logo_file' } } }), [logo({ px: [10, 10] })]).used).toEqual(['logo']);
  });
});

describe('one answer for one design', () => {
  it('is the same twice, and changes nothing it was handed', () => {
    const facts = browserFacts(sampleDesign(tables, MP_4112), tables, [logo({ px: [96, 64] })]);
    const before = structuredClone(facts);
    expect(checkDesign(facts)).toEqual(checkDesign(facts));
    expect(facts).toEqual(before);
  });

  it('reads rows as the server stores them as the browser holds them: decimals as text, JSON as text, yes as 1', () => {
    const asText = (table: string, edit: (row: Row) => Row): Tables => ({ ...tables, [table]: tables[table]!.map(edit) });
    let stored = asText('ready_parts', (row) => ({ ...row, rules: JSON.stringify(row['rules']), w_mm: String(row['w_mm']), locked: row['locked'] === true ? 1 : 0 }));
    stored = { ...stored, bases: stored['bases']!.map((row) => ({ ...row, sides: String(row['sides'] ?? '') === '' ? null : String(row['sides']) })) };
    const design = sampleDesign(tables, MP_4112);
    expect(ask({ ...design, values: JSON.stringify(design['values']), format: '1' }, [logo({ px: [96, 64] })], stored)).toEqual(ask(design, [logo({ px: [96, 64] })]));
  });
});
