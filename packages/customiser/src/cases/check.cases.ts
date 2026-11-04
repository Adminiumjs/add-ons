/**
 * THE DESIGN QUESTION'S CASES: every sample design, and the comps' refusals.
 *
 * Each case is one question as Adminium puts it (`checkLine`, from the
 * samples' rows read the way the checker declares), with the answer it must
 * get. The same lines are kept in the form the browser holds them, so a
 * suite can ask the customer's editor's rules the same question and hold the
 * two answers equal.
 */
import type { DesignCheckCase } from '@adminium/add-on-contracts/testing';

import type { FileFact } from '../rules/index.ts';
import type { Row } from '../sample/bundle.ts';
import { checkInput, checkLine, sampleDesign, sampleTables, type Tables } from '../testing/samples.ts';

export const TABLES: Tables = sampleTables();

/*
 * The book nook as a shop that uploaded its model sets it up: the sign's area
 * on the face it marked on the model (the sign board, which is piece 09), the
 * window's on its own piece. The design question reads the areas as before:
 * where an area is shown changes nothing a customer may put in it.
 */
const NOOK = TABLES['bases']!.find((row) => row['app'] === 'maker' && row['kind'] === 'kit')!;
const NOOK_SIGN = TABLES['base_pieces']!.find((row) => row['base_id'] === NOOK['id'] && row['code'] === '09')!;
NOOK['faces'] = JSON.stringify([{ code: 'sign-board', name: 'Sign board', piece: String(NOOK_SIGN['id']), mesh: '0', normal: [0, 0, 1], point: [-0.046, 0.011, 0.075], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 0.092, v0: 0, v1: 0.022 }, size: { w: 92, h: 22 } }]);
for (const area of TABLES['base_areas']!) if (area['base_id'] === NOOK['id'] && area['code'] === 'sign') area['face'] = 'sign-board';

/*
 * The keyring's front taking a logo as well as words (a shop may offer one):
 * raised from the face, so only a drawing will do.
 */
const KEYRING = TABLES['bases']!.find((row) => row['app'] === 'maker' && row['kind'] === 'printed')!;
for (const area of TABLES['base_areas']!) {
  if (area['base_id'] !== KEYRING['id'] || area['code'] !== 'front') continue;
  area['takes'] = 'both';
  area['rules'] = { ...(area['rules'] as Row), alsoLogo: { picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' } };
}
const plainKeyring = (values: unknown): Row => ({ id: 9001, app: 'maker', code: 'ZZ00000000000002', format: 1, ready_design_id: null, base_id: KEYRING['id'], values, state: 'draft' });

export interface CaseLine {
  key: string;
  design: Row;
  files: FileFact[];
  paid?: string[];
}

export interface CheckCase extends DesignCheckCase {
  lines: CaseLine[];
}

const LOGO: FileFact = { column: 'logo_file', kind: 'image/png', size: 48 * 1024, px: [960, 640] };
const ready = (app: string, name: string): Row => TABLES['ready_designs']!.find((row) => row['app'] === app && row['name'] === name)!;
const on = (app: 'maker' | 'printing', name: string, values: unknown, over: Row = {}): Row => {
  const row = ready(app, name);
  return { id: 9000, app, code: 'ZZ00000000000001', format: 1, ready_design_id: row['id'], base_id: row['base_id'], values, state: 'draft', ...over };
};
const sample = (code: string): Row => sampleDesign(TABLES, code);

function make(name: string, lines: CaseLine[], expect: DesignCheckCase['expect']): CheckCase {
  return { name, lines, input: checkInput(lines.map((line) => checkLine(line.key, line.design, TABLES, line.files, line.paid))), expect };
}

/** Each sample design, as the comps' orders were made. */
const SAMPLES: CaseLine[] = [
  { key: 'mp-4112', design: sample('MP4112C8G2S6E4WB'), files: [LOGO] },
  { key: 'br-2288', design: sample('BR2288K7Q4X3M9ZD'), files: [] },
  { key: 'br-2289', design: sample('BR2289R4W8N2T6JC'), files: [] },
  { key: 'br-2290', design: sample('BR2290H5F3P9V8YA'), files: [{ ...LOGO, kind: 'image/svg+xml' }] },
];

export const CHECK_CASES: CheckCase[] = [
  make('Harbour Bakery’s cards, both sides, take “Print the back”', [SAMPLES[0]!], { 'mp-4112': { ok: true, used: ['print-back'], reasons: [] } }),
  make('Iris’s book nook stands and takes nothing extra', [SAMPLES[1]!], { 'br-2288': { ok: true, used: [], reasons: [] } }),
  make('Sam’s keyring stands', [SAMPLES[2]!], { 'br-2289': { ok: true, used: [], reasons: [] } }),
  make('Tom’s coasters take “Your own logo”', [SAMPLES[3]!], { 'br-2290': { ok: true, used: ['logo'], reasons: [] } }),
  make('every sample design in one question', SAMPLES, {
    'mp-4112': { ok: true, used: ['print-back'] },
    'br-2288': { ok: true, used: [] },
    'br-2289': { ok: true, used: [] },
    'br-2290': { ok: true, used: ['logo'] },
  }),
  make('a plain book nook: words on the marked sign board, a logo in the window on its piece', [{ key: 'nook-faces', design: { id: 9001, app: 'maker', code: 'ZZ00000000000002', format: 1, ready_design_id: null, base_id: NOOK['id'], values: { parts: { sign: { text: 'Iris’s Books', size: 9 }, lwin: { mode: 'logo', file: 'logo_file' } } }, state: 'draft' }, files: [LOGO] }], {
    'nook-faces': { ok: true, used: ['logo'], reasons: [] },
  }),
  make('a plain book nook: the marked sign board holds 14 characters, not 30', [{ key: 'nook-long', design: { id: 9002, app: 'maker', code: 'ZZ00000000000003', format: 1, ready_design_id: null, base_id: NOOK['id'], values: { parts: { sign: { text: 'The Corner Shop of Many Books!', size: 9 } } }, state: 'draft' }, files: [] }], {
    'nook-long': { ok: false, used: [], reasons: ['too-long'] },
  }),
  make('Tom’s coasters without their logo file', [{ key: 'no-file', design: sample('BR2290H5F3P9V8YA'), files: [] }], { 'no-file': { ok: false, reasons: ['file-missing'] } }),
  make('a 40-character line in a 20-character part', [{ key: 'forty', design: on('maker', 'Sprig', { parts: { words: { text: 'x'.repeat(40), size: 6 } } }), files: [] }], { forty: { ok: false, used: [], reasons: ['too-long'] } }),
  make('Birch Row’s “Too long”: the top line over, the date empty', [{ key: 'bc-long', design: on('maker', 'Two lines', { parts: { top: { text: 'The Bellamy-Hart Kitchen', size: 10 } } }), files: [] }], {
    'bc-long': { ok: false, reasons: ['too-long', 'required-empty'] },
  }),
  make('Marlow Press’s “Too long”: the job title 15 over', [{ key: 'mc-long', design: on('printing', 'Harbour', { layout: 'left', palette: 'harbour', parts: { name: { text: 'Nell Fairweather' }, title: { text: 'Head baker and pastry chef, Quay Street' } } }), files: [] }], {
    'mc-long': { ok: false, reasons: ['too-long'] },
  }),
  make('a blurry logo is advice: the design stands', [{ key: 'blurry', design: on('printing', 'Harbour', { layout: 'left', palette: 'harbour', parts: { name: { text: 'Nell' }, logo: { file: 'logo_file' } } }), files: [{ ...LOGO, px: [96, 64] }] }], {
    blurry: { ok: true, used: [], reasons: [] },
  }),
  make('a design on another app’s ready-made design', [{ key: 'other-app', design: { ...on('maker', 'Ring', { parts: { words: { text: 'x' } } }), ready_design_id: ready('printing', 'Harbour')['id'] }, files: [] }], {
    'other-app': { ok: false, used: [], reasons: ['design-unknown'] },
  }),
  make('a design saved in a format this version cannot read', [{ key: 'format', design: { ...sample('BR2288K7Q4X3M9ZD'), format: 2 }, files: [] }], { format: { ok: false, used: [], reasons: ['format-unknown'] } }),
  make(
    'one design of each refusal, side by side',
    [
      { key: 'font', design: on('printing', 'Harbour', { parts: { name: { text: 'Nell', font: 'Comic Neue' } } }), files: [] },
      { key: 'size', design: on('printing', 'Harbour', { parts: { name: { text: 'Nell', size: 14 } } }), files: [] },
      { key: 'colour', design: on('maker', 'Name', { parts: { name: { text: 'SAM' }, colour: { choice: 'red' } } }), files: [] },
      { key: 'choice', design: on('maker', 'Sprig', { parts: { motif: { choice: 'cactus' } } }), files: [] },
      { key: 'locked', design: on('maker', 'Ring', { parts: { words: { text: 'x' }, ring: { text: 'Mine' } } }), files: [] },
      { key: 'kind', design: on('printing', 'Harbour', { parts: { name: { text: 'Nell' }, logo: { file: 'logo_file' } } }), files: [{ ...LOGO, kind: 'image/heic' }] },
      { key: 'fine', design: on('printing', 'Harbour', { parts: { name: { text: 'Nell' } } }), files: [] },
    ],
    {
      font: { ok: false, reasons: ['font-not-allowed'] },
      size: { ok: false, reasons: ['size-out-of-range'] },
      colour: { ok: false, reasons: ['colour-not-allowed'] },
      choice: { ok: false, reasons: ['choice-not-allowed'] },
      locked: { ok: false, reasons: ['part-locked'] },
      kind: { ok: false, reasons: ['file-kind'] },
      fine: { ok: true, used: [], reasons: [] },
    },
  ),
  make(
    'a logo raised on the keyring must be a drawing: a picture is refused, an SVG stands',
    [
      { key: 'keyring-png', design: plainKeyring({ parts: { front: { mode: 'logo', file: 'logo_file' } } }), files: [LOGO] },
      { key: 'keyring-svg', design: plainKeyring({ parts: { front: { mode: 'logo', file: 'logo_file' } } }), files: [{ ...LOGO, kind: 'image/svg+xml' }] },
    ],
    {
      'keyring-png': { ok: false, reasons: ['file-kind'] },
      'keyring-svg': { ok: true, used: [], reasons: [] },
    },
  ),
];
