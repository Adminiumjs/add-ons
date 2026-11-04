/**
 * THE SAMPLES: one shop's set-up and its customers' designs, for each app.
 *
 * The Customiser serves two shop apps, and its sample rows belong to one of
 * them: Birch Row's coasters are no use to Marlow Press. So the samples are
 * the apps' rows for this add-on (a file with `"addOn": "customiser"`), one
 * per app, which each app's package ships under its own
 * `sampleData.addOns.customiser`: loaded while the Customiser is there, and
 * removed with that app's sample data.
 *
 * - `maker` (Birch Row): the walnut coasters, the book nook (a kit, its 14
 *   pieces, no model files yet), the name keyring (a 3D-printed item, no
 *   files yet), the cutting board, and the slate house sign not offered yet;
 *   their areas, ready-made designs and parts; the finishes and PLA colours;
 *   the priced features; and the three designs the comps' orders BR-2288 to
 *   BR-2290 were made from.
 * - `printing` (Marlow Press): business cards (85 × 55 mm, 3 mm bleed, both
 *   sides) with their eight ready-made designs, each with its own palettes;
 *   A5 flyers with none yet; and the design of order MP-4112.
 *
 * Sizes are millimetres from the top-left of the face (a page's trim); the
 * comps placed the maker's parts in per cent of their face, and are turned
 * into millimetres here. No placeholder is another customer's words: where a
 * comp showed a customer's own name as the hint, a neutral one stands in.
 *
 * The starter fonts are not here: every install writes them (the manifest's
 * `seeds`). Parts name fonts by their family.
 *
 * `scripts/sample.mjs` writes these to `seeds/maker.sample.json` and
 * `seeds/printing.sample.json`; `sample.test.ts` fails when a file is behind,
 * and checks each against the manifest's tables.
 */
export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'maker' | 'printing';
  addOn: 'customiser';
  tables: { ref: string; rows: Row[] }[];
}

const ref = (label: string) => ({ '@ref': label });
/** A per cent of a face's side, in millimetres to a tenth. */
const pct = (value: number, of: number): number => Math.round(value * of * 10) / 1000;
/** A part's box in millimetres, from the comp's per cent of its face. */
const boxOf = (face: { w: number; h: number }, x: number, y: number, w: number, h: number) => ({ x_mm: pct(x, face.w), y_mm: pct(y, face.h), w_mm: pct(w, face.w), h_mm: pct(h, face.h) });

/* ── Birch Row ───────────────────────────────────────────────────────────── */

const MAKER = 'maker';
const SERIF = 'Cormorant Garamond';
const SANS = 'Manrope';
const SCRIPT = 'Caveat';
const SLAB = 'Zilla Slab';
const CAPS = 'Oswald';
const COASTER_FONTS = [SERIF, SANS, SCRIPT];
const FINISHES = ['engraved', 'paint-white', 'paint-black'];
/** What a Birch Row base offers in its set-up's "Fonts & finishes": the five laser fonts and the three finishes. */
const MAKER_OFFER = { fonts: [SERIF, SANS, SCRIPT, SLAB, CAPS], finishes: FINISHES };
const COASTER = { w: 95, h: 95 };
const NOOK_FRONT = { w: 110, h: 180 };
const KEYRING = { w: 56, h: 24 };

/** Words on a laser-cut piece: sizes in millimetres, and the limit grows with smaller letters. */
const words = (o: { chars: number; size: number; min: number; max: number; fonts: string[]; font: string; placeholder: string; finishes?: string[]; upper?: boolean; raised?: number }) => ({
  chars: o.chars,
  grows: true,
  unit: 'mm',
  size: o.size,
  min: o.min,
  max: o.max,
  fonts: o.fonts,
  font: o.font,
  ...(o.finishes === undefined ? {} : { finishes: o.finishes }),
  ...(o.upper === true ? { upper: true } : {}),
  ...(o.raised === undefined ? {} : { raisedMm: o.raised }),
  placeholder: o.placeholder,
});
const LOGO = { picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' };

let order = 0;
/** One part of a ready-made design, in the order the comp lists them. */
function part(design: string, code: string, name: string, kind: string, extra: Row): Row {
  order += 1;
  return { app: MAKER, ready_design_id: ref(`ready:${design}`), code, name, kind, locked: false, required: false, ...extra, position: order };
}

function makerTables(): Bundle['tables'] {
  order = 0;
  const bases: Row[] = [
    { '@label': 'base:coasters', app: MAKER, offered: MAKER_OFFER, name: 'Engraved walnut coasters', kind: 'piece', width_mm: 95, height_mm: 95, corner_mm: 9, material: 'Walnut', thickness_mm: 6, state: 'published', position: 1 },
    { '@label': 'base:nook', app: MAKER, offered: MAKER_OFFER, name: 'The Little Bookshop', kind: 'kit', width_mm: 110, height_mm: 180, depth_mm: 150, material: 'Birch ply', thickness_mm: 3, state: 'published', position: 2 },
    { '@label': 'base:keyring', app: MAKER, offered: { fonts: [SANS, CAPS], finishes: [] }, name: 'Name keyring', kind: 'printed', width_mm: 56, height_mm: 24, corner_mm: 11, material: 'PLA', thickness_mm: 4, state: 'published', position: 3 },
    { '@label': 'base:board', app: MAKER, offered: MAKER_OFFER, name: 'Walnut cutting board', kind: 'piece', width_mm: 380, height_mm: 260, corner_mm: 16, material: 'Walnut', thickness_mm: 18, state: 'published', position: 4 },
    { '@label': 'base:sign', app: MAKER, offered: MAKER_OFFER, name: 'Slate house sign', kind: 'piece', width_mm: 300, height_mm: 200, corner_mm: 10, material: 'Slate', thickness_mm: 5, state: 'draft', position: 5 },
  ];
  const PIECES: [string, number, number, string[]][] = [
    ['Base', 110, 150, ['CUT']],
    ['Back wall', 110, 180, ['CUT', 'SCORE']],
    ['Left wall', 150, 180, ['CUT', 'SCORE']],
    ['Right wall', 150, 180, ['CUT', 'SCORE']],
    ['Roof', 110, 150, ['CUT', 'SCORE']],
    ['Shop front', 110, 180, ['CUT', 'ENGRAVE']],
    ['Floor', 104, 140, ['CUT', 'SCORE']],
    ['Bookcase', 104, 120, ['CUT']],
    ['Shop sign', 92, 22, ['CUT', 'ENGRAVE']],
    ['Left window', 42, 54, ['CUT']],
    ['Right window', 42, 54, ['CUT', 'ENGRAVE']],
    ['Door', 36, 68, ['CUT', 'SCORE']],
    ['Lamp bracket', 20, 30, ['CUT']],
    ['Counter', 60, 24, ['CUT']],
  ];
  const pieces: Row[] = PIECES.map(([name, w, h, layers], i) => {
    const code = String(i + 1).padStart(2, '0');
    return { '@label': `piece:nook-${code}`, app: MAKER, base_id: ref('base:nook'), code, name, width_mm: w, height_mm: h, layers, position: i + 1 };
  });
  const signWords = words({ chars: 14, size: 9, min: 6, max: 11, fonts: [SERIF, SLAB, SCRIPT], font: SERIF, finishes: FINISHES, placeholder: 'The Corner Shop' });
  const windowWords = words({ chars: 10, size: 5, min: 4, max: 7, fonts: [SERIF, SANS], font: SANS, finishes: FINISHES, placeholder: 'Open late' });
  const areas: Row[] = [
    { '@label': 'area:coasters-logo', app: MAKER, base_id: ref('base:coasters'), code: 'logo', name: 'Your logo', shape: 'rect', ...boxOf(COASTER, 30, 14, 40, 38), takes: 'logo', required: false, rules: LOGO, feature_id: ref('feature:maker-logo'), position: 1 },
    { '@label': 'area:coasters-words', app: MAKER, base_id: ref('base:coasters'), code: 'words', name: 'Your words', shape: 'rect', ...boxOf(COASTER, 12, 60, 76, 14), takes: 'words', required: false, rules: words({ chars: 24, size: 6, min: 4, max: 8, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: 'The Hartleys' }), position: 2 },
    { '@label': 'area:nook-sign', app: MAKER, base_id: ref('base:nook'), code: 'sign', name: 'The shop sign', piece_id: ref('piece:nook-09'), face: 'front', shape: 'rect', ...boxOf(NOOK_FRONT, 8, 5, 84, 11), takes: 'words', required: true, rules: signWords, position: 3 },
    { '@label': 'area:nook-lwin', app: MAKER, base_id: ref('base:nook'), code: 'lwin', name: 'The left window', piece_id: ref('piece:nook-10'), face: 'front', shape: 'rect', ...boxOf(NOOK_FRONT, 8, 25, 38, 30), takes: 'both', required: false, rules: windowWords, feature_id: ref('feature:maker-logo'), position: 4 },
    // A 3D-printed item's area is a flat face the shop marks; the words are raised from it.
    { '@label': 'area:keyring-front', app: MAKER, base_id: ref('base:keyring'), code: 'front', name: 'The front', face: 'front', shape: 'rect', x_mm: 0, y_mm: 0, w_mm: 56, h_mm: 24, takes: 'words', required: true, rules: { mode: 'raised', depthMm: 1, smallestLetterMm: 4 }, position: 5 },
    { '@label': 'area:board-corner', app: MAKER, base_id: ref('base:board'), code: 'corner', name: 'In the corner', shape: 'rect', x_mm: pct(54, 380), y_mm: pct(80, 260), w_mm: pct(40, 380), h_mm: pct(10, 260), takes: 'words', required: false, rules: words({ chars: 32, size: 8, min: 6, max: 10, fonts: [SERIF, SANS], font: SERIF, finishes: ['engraved'], placeholder: 'The Sharmas · 2019' }), position: 6 },
  ];
  const ready: Row[] = [
    ['coasters-ring', 'coasters', 'Ring', ['words', 'logo']],
    ['coasters-two-lines', 'coasters', 'Two lines', ['words']],
    ['coasters-monogram', 'coasters', 'Monogram', ['words']],
    ['coasters-sprig', 'coasters', 'Sprig', ['words', 'motif']],
    ['coasters-badge', 'coasters', 'Badge', ['words', 'logo']],
    ['coasters-stamp', 'coasters', 'Stamp', ['words']],
    ['nook-corner', 'nook', 'Corner shop', ['words', 'logo']],
    ['nook-night', 'nook', 'Night shop', ['words', 'logo', 'motif']],
    ['nook-reading', 'nook', 'Reading room', ['words']],
    ['keyring-name', 'keyring', 'Name', ['words']],
    ['keyring-heart', 'keyring', 'Name and a heart', ['words']],
  ].map(([label, base, name, tags], i) => ({ '@label': `ready:${String(label)}`, app: MAKER, base_id: ref(`base:${String(base)}`), name, tags, state: 'published', position: i + 1 }));

  const nookPart = (design: string, code: string, name: string, kind: string, piece: string, at: [number, number, number, number], extra: Row) => part(design, code, name, kind, { piece_id: ref(`piece:nook-${piece}`), ...boxOf(NOOK_FRONT, ...at), ...extra });
  const door = (design: string) => nookPart(design, 'door', 'The door', 'shape', '12', [34, 62, 32, 38], { locked: true, rules: { shape: 'door' }, value: { text: 'Panelled door' } });
  const sign = (design: string, font: string, fonts: string[], placeholder: string, finish?: string) =>
    nookPart(design, 'sign', 'The shop sign', 'text', '09', [8, 5, 84, 11], { area_id: ref('area:nook-sign'), required: true, rules: { ...signWords, fonts, font, placeholder, ...(finish === undefined ? {} : { finish }) } });
  const leftWindow = (design: string) => nookPart(design, 'lwin', 'The left window', 'text', '10', [8, 25, 38, 30], { area_id: ref('area:nook-lwin'), rules: { ...windowWords, alsoLogo: LOGO }, feature_id: ref('feature:maker-logo') });
  const nameWords = (chars: number, size: number, min: number, max: number, fonts: string[]) => words({ chars, size, min, max, fonts, font: SANS, upper: true, raised: 1, placeholder: 'ALEX' });
  const plaColour = (design: string, choice: string) => part(design, 'colour', 'Colour', 'colour', { rules: { palette: 'pla', choices: ['chalk', 'grey', 'ink', 'amber'] }, value: { choice } });

  const parts: Row[] = [
    part('coasters-ring', 'ring', 'The ring', 'shape', { locked: true, ...boxOf(COASTER, 7, 7, 86, 86), rules: { shape: 'ring' }, value: { text: 'Engraved ring, 1 mm' } }),
    part('coasters-ring', 'logo', 'Your logo', 'picture', { ...boxOf(COASTER, 31, 17, 38, 38), rules: LOGO, feature_id: ref('feature:maker-logo') }),
    part('coasters-ring', 'words', 'Your words', 'text', { required: true, ...boxOf(COASTER, 14, 60, 72, 13), rules: words({ chars: 22, size: 6, min: 4, max: 8, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: 'The Hartleys · 2019' }) }),
    part('coasters-two-lines', 'top', 'Top line', 'text', { required: true, ...boxOf(COASTER, 8, 33, 84, 18), rules: words({ chars: 16, size: 10, min: 6, max: 12, fonts: COASTER_FONTS, font: SERIF, finishes: FINISHES, placeholder: 'Anna & Ben' }) }),
    part('coasters-two-lines', 'date', 'Date', 'text', { required: true, ...boxOf(COASTER, 18, 56, 64, 10), rules: words({ chars: 14, size: 5, min: 4, max: 7, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: '5.9.2026' }) }),
    part('coasters-monogram', 'initial', 'Initial', 'text', { required: true, ...boxOf(COASTER, 25, 12, 50, 52), rules: words({ chars: 1, size: 40, min: 30, max: 46, fonts: [SERIF, SCRIPT], font: SERIF, finishes: FINISHES, placeholder: 'H' }) }),
    part('coasters-monogram', 'name', 'Name', 'text', { ...boxOf(COASTER, 14, 70, 72, 10), rules: words({ chars: 18, size: 5, min: 4, max: 6, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: 'The Hartleys' }) }),
    part('coasters-sprig', 'motif', 'Motif', 'choice', { ...boxOf(COASTER, 32, 16, 36, 36), rules: { choices: ['sprout', 'leaf', 'wheat'] }, value: { choice: 'sprout' } }),
    part('coasters-sprig', 'words', 'Your words', 'text', { ...boxOf(COASTER, 12, 62, 76, 12), rules: words({ chars: 20, size: 6, min: 4, max: 8, fonts: COASTER_FONTS, font: SCRIPT, finishes: FINISHES, placeholder: 'Allotment 14' }) }),
    part('coasters-badge', 'frame', 'The frame', 'shape', { locked: true, ...boxOf(COASTER, 10, 10, 80, 80), rules: { shape: 'rect' }, value: { text: 'Engraved frame, 1 mm' } }),
    part('coasters-badge', 'logo', 'Your logo', 'picture', { ...boxOf(COASTER, 28, 19, 44, 40), rules: LOGO, feature_id: ref('feature:maker-logo') }),
    part('coasters-badge', 'words', 'Your words', 'text', { ...boxOf(COASTER, 16, 65, 68, 12), rules: words({ chars: 18, size: 5.5, min: 4, max: 7, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: 'Since 2019' }) }),
    part('coasters-stamp', 'home', 'Heading', 'text', { locked: true, ...boxOf(COASTER, 10, 28, 80, 24), rules: { unit: 'mm', size: 17, fonts: [CAPS], font: CAPS, finishes: FINISHES }, value: { text: 'HOME' } }),
    part('coasters-stamp', 'date', 'Your words', 'text', { required: true, ...boxOf(COASTER, 18, 58, 64, 11), rules: words({ chars: 14, size: 5, min: 4, max: 7, fonts: COASTER_FONTS, font: SANS, finishes: FINISHES, placeholder: 'est. 2019' }) }),
    sign('nook-corner', SERIF, [SERIF, SLAB, SCRIPT], 'The Corner Shop'),
    leftWindow('nook-corner'),
    nookPart('nook-corner', 'rwin', 'The right window', 'choice', '11', [54, 25, 38, 30], { locked: true, value: { choice: 'library', text: 'Books on the shelf' } }),
    door('nook-corner'),
    sign('nook-night', SCRIPT, [SERIF, SLAB, SCRIPT], 'The Corner Shop', 'paint-black'),
    leftWindow('nook-night'),
    nookPart('nook-night', 'rwin', 'The right window', 'choice', '11', [54, 25, 38, 30], { rules: { choices: ['moon', 'star', 'lamp'] }, value: { choice: 'moon' } }),
    door('nook-night'),
    sign('nook-reading', SLAB, [SERIF, SLAB], 'Reading Room'),
    nookPart('nook-reading', 'rwin', 'The windows', 'choice', '11', [8, 25, 84, 30], { locked: true, value: { choice: 'book-open', text: 'An open book across both' } }),
    door('nook-reading'),
    part('keyring-name', 'name', 'Your name', 'text', { required: true, area_id: ref('area:keyring-front'), ...boxOf(KEYRING, 25, 16, 68, 68), rules: nameWords(8, 11, 6, 14, [SANS, CAPS, SLAB]) }),
    plaColour('keyring-name', 'amber'),
    part('keyring-heart', 'name', 'Your name', 'text', { required: true, area_id: ref('area:keyring-front'), ...boxOf(KEYRING, 22, 16, 56, 68), rules: nameWords(6, 10, 6, 12, [SANS, CAPS]) }),
    part('keyring-heart', 'heart', 'The heart', 'choice', { locked: true, ...boxOf(KEYRING, 80, 30, 14, 40), rules: { raisedMm: 1 }, value: { choice: 'heart', text: 'Raised heart' } }),
    plaColour('keyring-heart', 'chalk'),
  ];

  const palettes: Row[] = [
    { '@label': 'palette:maker-finishes', app: MAKER, kind: 'finishes', code: 'finishes', name: 'Finishes', position: 1 },
    { '@label': 'palette:maker-pla', app: MAKER, kind: 'colours', code: 'pla', name: 'PLA colours', position: 2 },
  ];
  const colours: Row[] = [
    ['palette:maker-finishes', 'engraved', 'Engraved', '#3a2414'],
    ['palette:maker-finishes', 'paint-white', 'Painted white', '#f2f1ec'],
    ['palette:maker-finishes', 'paint-black', 'Painted black', '#17140f'],
    ['palette:maker-pla', 'chalk', 'Chalk', '#e6e1d7'],
    ['palette:maker-pla', 'grey', 'Warm grey', '#8a8378'],
    ['palette:maker-pla', 'ink', 'Ink', '#2b3340'],
    ['palette:maker-pla', 'amber', 'Amber', '#c98a2e'],
  ].map(([palette, code, name, hex], i) => ({ app: MAKER, palette_id: ref(String(palette)), code, name, hex, position: i + 1 }));

  const features: Row[] = [
    { '@label': 'feature:maker-logo', app: MAKER, code: 'logo', name: 'Your own logo', active: true },
    { '@label': 'feature:maker-both-sides', app: MAKER, code: 'engrave-both-sides', name: 'Engrave both sides', active: true },
  ];

  // The designs the comps' three orders were made from: each customer's own words on their own design.
  const designs: Row[] = [
    { '@label': 'design:br-2288', app: MAKER, code: 'BR2288K7Q4X3M9ZD', format: 1, ready_design_id: ref('ready:nook-corner'), base_id: ref('base:nook'), values: { finish: 'engraved', parts: { sign: { text: "Iris's Books", font: SERIF, size: 10 } } }, state: 'ordered' },
    { '@label': 'design:br-2289', app: MAKER, code: 'BR2289R4W8N2T6JC', format: 1, ready_design_id: ref('ready:keyring-name'), base_id: ref('base:keyring'), values: { parts: { name: { text: 'SAM' }, colour: { choice: 'amber' } } }, state: 'ordered' },
    // Tom's logo is his own file: it is added with the files of a later release, and the design names where it goes.
    { '@label': 'design:br-2290', app: MAKER, code: 'BR2290H5F3P9V8YA', format: 1, ready_design_id: ref('ready:coasters-ring'), base_id: ref('base:coasters'), values: { finish: 'engraved', parts: { words: { text: 'The Pinfold · 2019' }, logo: { file: 'logo_file' } } }, state: 'ordered' },
  ];
  const versions: Row[] = [
    { app: MAKER, design_id: ref('design:br-2288'), version: 1, values: { finish: 'engraved', parts: { sign: { text: "Iris's Books", font: SERIF, size: 9 } } } },
    { app: MAKER, design_id: ref('design:br-2288'), version: 2, values: { finish: 'engraved', parts: { sign: { text: "Iris's Books", font: SERIF, size: 10 } } }, note: 'Sign set at 10 mm.' },
    { app: MAKER, design_id: ref('design:br-2289'), version: 1, values: { parts: { name: { text: 'SAM' }, colour: { choice: 'amber' } } }, note: 'Raised 1 mm, amber.' },
  ];

  return [
    { ref: 'features', rows: features },
    { ref: 'palettes', rows: palettes },
    { ref: 'palette_colours', rows: colours },
    { ref: 'bases', rows: bases },
    { ref: 'base_pieces', rows: pieces },
    { ref: 'base_areas', rows: areas },
    { ref: 'ready_designs', rows: ready },
    { ref: 'ready_parts', rows: parts },
    { ref: 'designs', rows: designs },
    { ref: 'design_versions', rows: versions },
  ];
}

/* ── Marlow Press ────────────────────────────────────────────────────────── */

const PRINTING = 'printing';
const BLEED = 3;
/** A point in millimetres, and the line height the comp sets type at. */
const PT = 0.3528;
const LEADING = 1.25;
const CARD = { w: 85, h: 55 };
const P_SANS = ['Manrope', 'Archivo'];
const P_SERIF = ['Libre Baskerville', 'DM Serif Display'];
/** What a Marlow Press page offers: its four print fonts; a page's colours are its designs'. */
const PRINT_OFFER = { fonts: [...P_SANS, ...P_SERIF], finishes: [] };
const HINT = { name: 'Your name', title: 'Job title', phone: '01234 567 890', email: 'you@example.co.uk', web: 'yourwebsite.co.uk', addr: 'Street\nTown and postcode', initials: 'AB' };

type Side = 'front' | 'back';
interface PrintPart {
  code: string;
  name: string;
  kind: 'text' | 'picture' | 'shape';
  at: [number, number, number, number];
  locked?: boolean;
  required?: boolean;
  rules: Row;
}

/** Words on a printed page: sizes in points from a list, and a fixed limit (the safe line decides what fits). */
function T(code: string, name: string, x: number, y: number, w: number, o: { font?: string; size?: number; weight?: number; colour?: string; align?: string; max?: number; lines?: number; required?: boolean; fonts?: string[]; sizes?: number[]; colours?: string[]; hint?: string } = {}): PrintPart {
  const size = o.size ?? 7.5;
  const lines = o.lines ?? 1;
  return {
    code,
    name,
    kind: 'text',
    at: [x, y, w, Math.round(size * PT * LEADING * lines * 100) / 100],
    required: o.required ?? false,
    rules: {
      chars: o.max ?? 30,
      grows: false,
      unit: 'pt',
      size,
      sizes: o.sizes ?? [size],
      fonts: o.fonts ?? P_SANS,
      font: o.font ?? 'Manrope',
      weight: o.weight ?? 500,
      colours: o.colours ?? ['ink', 'accent'],
      colour: o.colour ?? 'ink',
      align: o.align ?? 'start',
      lines,
      placeholder: o.hint ?? name,
    },
  };
}
function I(code: 'logo' | 'photo', name: string, x: number, y: number, w: number, h: number, required = false): PrintPart {
  return { code, name, kind: 'picture', at: [x, y, w, h], required, rules: { picture: code, fit: code === 'photo' ? 'fill' : 'inside', file: code === 'photo' ? 'photo_file' : 'logo_file' } };
}
function R(code: string, name: string, x: number, y: number, w: number, h: number, fill: string): PrintPart {
  return { code, name, kind: 'shape', at: [x, y, w, h], locked: true, rules: { shape: 'rect', fill } };
}
function E(code: string, name: string, x: number, y: number, w: number, h: number, fill: string): PrintPart {
  return { code, name, kind: 'shape', at: [x, y, w, h], locked: true, rules: { shape: 'ellipse', fill } };
}
/** The paper, to the bleed's edge. */
const PAPER = (fill: string): PrintPart => ({ code: 'paper', name: fill === 'bg' ? 'Paper' : 'Colour', kind: 'shape', at: [-BLEED, -BLEED, CARD.w + 2 * BLEED, CARD.h + 2 * BLEED], locked: true, rules: { shape: 'rect', fill, background: true } });

interface PrintDesign {
  id: string;
  name: string;
  tags: string[];
  palettes: [string, string, string, string, string][];
  layouts: { key: string; name: string; front: PrintPart[]; back: PrintPart[] }[];
}

const HARBOUR_BACK = (): PrintPart[] => [
  PAPER('accent'),
  T('phone', 'Phone', 6, 7, 75, { size: 9, weight: 700, colour: 'bg', max: 20, colours: ['bg', 'ink'], hint: HINT.phone }),
  T('email', 'E-mail', 6, 12.6, 75, { colour: 'bg', max: 34, colours: ['bg', 'ink'], hint: HINT.email }),
  T('web', 'Website', 6, 17, 75, { colour: 'bg', max: 34, colours: ['bg', 'ink'], hint: HINT.web }),
  T('addr', 'Address lines', 6, 40, 75, { size: 7, lines: 2, max: 60, colour: 'bg', colours: ['bg', 'ink'], hint: HINT.addr }),
];
const PHOTO_FRONT = (): PrintPart[] => [
  PAPER('bg'),
  T('name', 'Name', 6, 7, 73, { size: 11, weight: 800, max: 26, required: true, sizes: [10, 11, 12], hint: HINT.name }),
  T('title', 'Job title', 6, 12.6, 73, { weight: 600, colour: 'accent', max: 30, hint: HINT.title }),
  T('phone', 'Phone', 6, 38, 73, { size: 7, max: 20, hint: HINT.phone }),
  T('email', 'E-mail', 6, 42.2, 73, { size: 7, max: 36, hint: HINT.email }),
  T('web', 'Website', 6, 46.4, 73, { size: 7, max: 36, hint: HINT.web }),
];

/** The eight ready-made business cards of the Marlow Press comp, in its order. */
const CARDS: PrintDesign[] = [
  {
    id: 'harbour',
    name: 'Harbour',
    tags: ['simple'],
    palettes: [['harbour', 'Harbour', '#f4efe6', '#1f2a36', '#c0562f'], ['quay', 'Quay', '#ffffff', '#1c2b44', '#2f7d7a'], ['sand', 'Sand', '#f3ead8', '#3b2f25', '#d9bf8c']],
    layouts: [
      {
        key: 'left',
        name: 'Logo left',
        front: [PAPER('bg'), I('logo', 'Logo', 6, 6, 20, 20), T('name', 'Name', 6, 30.5, 75, { font: 'DM Serif Display', size: 13, weight: 400, max: 26, required: true, sizes: [11, 13, 15], fonts: ['DM Serif Display', 'Libre Baskerville', 'Manrope'], hint: HINT.name }), R('rule', 'Rule', 6, 38.4, 8, 0.7, 'accent'), T('title', 'Job title', 6, 40.4, 75, { size: 7.5, weight: 600, colour: 'accent', max: 24, sizes: [7, 7.5, 8.5], colours: ['accent', 'ink'], hint: HINT.title })],
        back: HARBOUR_BACK(),
      },
      {
        key: 'top',
        name: 'Logo top',
        front: [PAPER('bg'), I('logo', 'Logo', 32.5, 6, 20, 18), T('name', 'Name', 6, 28.5, 73, { font: 'DM Serif Display', size: 13, weight: 400, align: 'center', max: 26, required: true, sizes: [11, 13, 15], fonts: ['DM Serif Display', 'Libre Baskerville', 'Manrope'], hint: HINT.name }), R('rule', 'Rule', 38.5, 36.4, 8, 0.7, 'accent'), T('title', 'Job title', 6, 38.4, 73, { size: 7.5, weight: 600, colour: 'accent', align: 'center', max: 24, sizes: [7, 7.5, 8.5], colours: ['accent', 'ink'], hint: HINT.title })],
        back: HARBOUR_BACK(),
      },
    ],
  },
  {
    id: 'classic',
    name: 'Classic',
    tags: ['simple', 'one'],
    palettes: [['ink', 'Ink', '#ffffff', '#191920', '#191920'], ['navy', 'Navy', '#fbfaf7', '#1d2a4a', '#1d2a4a'], ['forest', 'Forest', '#ffffff', '#1f3b2d', '#1f3b2d']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), T('name', 'Name', 6, 6, 73, { font: 'Libre Baskerville', size: 11, weight: 400, max: 28, required: true, sizes: [10, 11, 12], fonts: P_SERIF, hint: HINT.name }), T('title', 'Job title', 6, 11.6, 73, { size: 7, max: 30, hint: HINT.title }), T('phone', 'Phone', 6, 38, 73, { size: 7, max: 20, hint: HINT.phone }), T('email', 'E-mail', 6, 42, 73, { size: 7, max: 36, hint: HINT.email }), T('web', 'Website', 6, 46, 73, { size: 7, max: 36, hint: HINT.web })],
        back: [PAPER('bg'), I('logo', 'Logo', 27.5, 12.5, 30, 30)],
      },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    tags: ['bold'],
    palettes: [['signal', 'Signal', '#ffffff', '#16161d', '#e4572e'], ['cobalt', 'Cobalt', '#ffffff', '#14182b', '#2d5bd6'], ['moss', 'Moss', '#fbfbf7', '#1e2a1e', '#5f7f3a']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), R('stripe', 'Stripe', -3, -3, 23, 61, 'accent'), I('logo', 'Logo', 5, 5, 12, 12), T('name', 'Name', 25, 16, 56, { font: 'Archivo', size: 12, weight: 800, max: 22, required: true, sizes: [10, 12], hint: HINT.name }), T('title', 'Job title', 25, 22, 56, { weight: 600, colour: 'accent', max: 28, hint: HINT.title }), T('phone', 'Phone', 25, 38, 56, { size: 7, max: 20, hint: HINT.phone }), T('email', 'E-mail', 25, 42.2, 56, { size: 7, max: 30, hint: HINT.email }), T('web', 'Website', 25, 46.4, 56, { size: 7, max: 30, hint: HINT.web })],
        back: [PAPER('accent'), I('logo', 'Logo', 30, 15, 25, 25)],
      },
    ],
  },
  {
    id: 'corner',
    name: 'Corner',
    tags: ['bold'],
    palettes: [['coral', 'Coral', '#ffffff', '#1a2233', '#ff6f59'], ['citrus', 'Citrus', '#fffdf6', '#1b1b1b', '#f2b632'], ['sky', 'Sky', '#f7fbff', '#10243e', '#5aa9e6']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), E('circle', 'Corner circle', 52, -28, 62, 62, 'accent'), I('logo', 'Logo', 64, 6, 15, 15), T('name', 'Name', 6, 29.5, 60, { size: 11, weight: 800, max: 24, required: true, sizes: [10, 11, 12], hint: HINT.name }), T('title', 'Job title', 6, 35, 60, { max: 28, hint: HINT.title }), T('phone', 'Phone', 6, 42, 60, { size: 7, max: 20, hint: HINT.phone }), T('email', 'E-mail', 6, 46, 60, { size: 7, max: 30, hint: HINT.email })],
        back: [PAPER('ink'), E('circle2', 'Corner circle', -32, 28, 62, 62, 'accent'), T('web', 'Website', 6, 24, 73, { size: 9, weight: 700, colour: 'bg', align: 'center', max: 30, colours: ['bg', 'accent'], hint: HINT.web })],
      },
    ],
  },
  {
    id: 'monogram',
    name: 'Monogram',
    tags: ['bold', 'one'],
    palettes: [['charcoal', 'Charcoal', '#ffffff', '#222226', '#222226'], ['claret', 'Claret', '#fbf7f4', '#6b1d2a', '#6b1d2a'], ['slate', 'Slate', '#f5f6f8', '#2c3e50', '#2c3e50']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), T('initials', 'Initials', 6, 5, 40, { font: 'DM Serif Display', size: 40, weight: 400, max: 3, required: true, sizes: [32, 40], fonts: ['DM Serif Display', 'Libre Baskerville'], hint: HINT.initials }), R('rule', 'Rule', 6, 35.6, 73, 0.4, 'ink'), T('name', 'Name', 6, 38, 73, { font: 'Libre Baskerville', size: 10, weight: 400, max: 30, required: true, fonts: P_SERIF, hint: HINT.name }), T('title', 'Job title', 6, 43.2, 73, { size: 7, max: 34, hint: HINT.title })],
        back: [PAPER('bg'), T('phone', 'Phone', 6, 17, 73, { size: 8, align: 'center', max: 20, hint: HINT.phone }), T('email', 'E-mail', 6, 21.4, 73, { size: 7.5, align: 'center', max: 36, hint: HINT.email }), T('web', 'Website', 6, 25.6, 73, { size: 7.5, align: 'center', max: 36, hint: HINT.web }), T('addr', 'Address lines', 6, 38, 73, { size: 7, lines: 2, align: 'center', max: 60, hint: HINT.addr })],
      },
    ],
  },
  {
    id: 'photo',
    name: 'Photo back',
    tags: ['photo'],
    palettes: [['day', 'Day', '#ffffff', '#1a1a1f', '#c0562f'], ['night', 'Night', '#15161b', '#f2f2f4', '#e8b04a']],
    layouts: [
      { key: 'full', name: 'Photo to the edge', front: PHOTO_FRONT(), back: [PAPER('bg'), I('photo', 'Photo', -3, -3, 91, 61, true)] },
      { key: 'border', name: 'Photo with a border', front: PHOTO_FRONT(), back: [PAPER('bg'), I('photo', 'Photo', 5, 5, 75, 45, true)] },
    ],
  },
  {
    id: 'twotone',
    name: 'Two-tone',
    tags: ['bold'],
    palettes: [['teal', 'Teal', '#ffffff', '#132a2a', '#1f7a72'], ['plum', 'Plum', '#ffffff', '#1d1b22', '#5b3a7a'], ['brick', 'Brick', '#fffaf5', '#2a1a14', '#a8432a']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), R('band', 'Top colour', -3, -3, 91, 33, 'accent'), T('name', 'Name', 6, 13.5, 73, { font: 'Archivo', size: 12, weight: 800, colour: 'bg', max: 24, required: true, colours: ['bg', 'ink'], hint: HINT.name }), T('title', 'Job title', 6, 20.2, 73, { weight: 600, colour: 'bg', max: 30, colours: ['bg', 'ink'], hint: HINT.title }), T('phone', 'Phone', 6, 36, 73, { size: 7, max: 20, hint: HINT.phone }), T('email', 'E-mail', 6, 40.4, 73, { size: 7, max: 36, hint: HINT.email }), T('web', 'Website', 6, 44.8, 73, { size: 7, max: 36, hint: HINT.web })],
        back: [PAPER('accent'), I('logo', 'Logo', 30, 15, 25, 25)],
      },
    ],
  },
  {
    id: 'plain',
    name: 'Plain',
    tags: ['simple', 'one'],
    palettes: [['black', 'Black', '#ffffff', '#111111', '#111111'], ['ivory', 'Ivory', '#fbf8f1', '#2b2a27', '#2b2a27']],
    layouts: [
      {
        key: 'std',
        name: 'Standard',
        front: [PAPER('bg'), T('name', 'Name', 6, 21, 73, { size: 10, weight: 700, align: 'center', max: 30, required: true, hint: HINT.name }), T('title', 'Job title', 6, 26.4, 73, { size: 7, align: 'center', max: 34, hint: HINT.title })],
        back: [PAPER('bg'), T('phone', 'Phone', 6, 22, 73, { size: 7.5, align: 'center', max: 20, hint: HINT.phone }), T('email', 'E-mail', 6, 26.4, 73, { size: 7.5, align: 'center', max: 36, hint: HINT.email })],
      },
    ],
  },
];

/** The comp's palette roles, as the colours of a design's own palettes are named. */
const ROLES: [string, string][] = [
  ['paper', 'Paper'],
  ['ink', 'Ink'],
  ['accent', 'Accent'],
];

function printingTables(): Bundle['tables'] {
  const bases: Row[] = [
    { '@label': 'base:cards', app: PRINTING, offered: PRINT_OFFER, name: 'Business cards', kind: 'page', width_mm: CARD.w, height_mm: CARD.h, bleed_mm: BLEED, safe_mm: 4, sides: 2, state: 'published', position: 1 },
    // Flyers have no ready-made designs yet: customers start from blank or send their own file.
    { '@label': 'base:flyer-a5', app: PRINTING, offered: PRINT_OFFER, name: 'A5 flyers', kind: 'page', width_mm: 148, height_mm: 210, bleed_mm: BLEED, safe_mm: 4, sides: 2, state: 'published', position: 2 },
  ];
  const ready: Row[] = CARDS.map((card, i) => ({ '@label': `ready:${card.id}`, app: PRINTING, base_id: ref('base:cards'), name: card.name, tags: card.tags, layouts: card.layouts.map((layout) => ({ key: layout.key, name: layout.name })), state: 'published', position: i + 1 }));
  const parts: Row[] = [];
  for (const card of CARDS) {
    for (const layout of card.layouts) {
      for (const side of ['front', 'back'] as Side[]) {
        for (const one of layout[side]) {
          const [x, y, w, h] = one.at;
          parts.push({
            app: PRINTING,
            ready_design_id: ref(`ready:${card.id}`),
            code: one.code,
            name: one.name,
            kind: one.kind,
            locked: one.locked ?? false,
            required: one.required ?? false,
            side,
            layout: layout.key,
            x_mm: x,
            y_mm: y,
            w_mm: w,
            h_mm: h,
            rules: one.rules,
            position: parts.length + 1,
          });
        }
      }
    }
  }
  const palettes: Row[] = [];
  const colours: Row[] = [];
  for (const card of CARDS) {
    card.palettes.forEach(([code, name, ...hexes], i) => {
      const label = `palette:${card.id}-${code}`;
      palettes.push({ '@label': label, app: PRINTING, ready_design_id: ref(`ready:${card.id}`), kind: 'colours', code, name, position: i + 1 });
      ROLES.forEach(([role, roleName], r) => colours.push({ app: PRINTING, palette_id: ref(label), code: role, role, name: roleName, hex: hexes[r], position: r + 1 }));
    });
  }
  const features: Row[] = [{ '@label': 'feature:printing-back', app: PRINTING, code: 'print-back', name: 'Print the back', active: true }];
  // Harbour Bakery's cards (order MP-4112): their own details on the Harbour design, logo left.
  const harbour = { layout: 'left', palette: 'harbour', parts: { name: { text: 'Nell Fairweather' }, title: { text: 'Head baker' }, phone: { text: '01628 471 302' }, email: { text: 'hello@harbourbakery.co.uk' }, web: { text: 'harbourbakery.co.uk' }, addr: { text: '12 Quay Street\nMarlow SL7 1BT' }, logo: { file: 'logo_file' } } };
  const designs: Row[] = [{ '@label': 'design:mp-4112', app: PRINTING, code: 'MP4112C8G2S6E4WB', format: 1, ready_design_id: ref('ready:harbour'), base_id: ref('base:cards'), values: harbour, state: 'ordered' }];
  const versions: Row[] = [{ app: PRINTING, design_id: ref('design:mp-4112'), version: 1, values: harbour, note: 'Both sides, as printed.' }];
  return [
    { ref: 'features', rows: features },
    { ref: 'bases', rows: bases },
    { ref: 'ready_designs', rows: ready },
    { ref: 'palettes', rows: palettes },
    { ref: 'palette_colours', rows: colours },
    { ref: 'ready_parts', rows: parts },
    { ref: 'designs', rows: designs },
    { ref: 'design_versions', rows: versions },
  ];
}

export function buildSample(app: Bundle['app']): Bundle {
  return { format: 'adminium.sample/1', app, addOn: 'customiser', tables: app === 'maker' ? makerTables() : printingTables() };
}

export const SAMPLE_APPS: readonly Bundle['app'][] = ['maker', 'printing'];
