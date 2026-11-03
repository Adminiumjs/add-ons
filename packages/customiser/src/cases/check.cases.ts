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
];
