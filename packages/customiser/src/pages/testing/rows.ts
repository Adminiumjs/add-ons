/**
 * A SHOP, SET UP PART-WAY: the rows the set-up page and the panels are
 * tested over. Birch Row's coasters (a piece with its outline in, two
 * areas, published), a slate sign not offered yet (no outline), Marlow
 * Press's business cards (a page), and a book nook (a kit). Names and
 * figures are the comps' and the samples'; no customer's name is here.
 */
import { seed, world } from './host.tsx';

export const IDS = { coasters: 11, sign: 12, cards: 13, nook: 14, finishes: 31, logo: 41 } as const;

export function seedShop(): void {
  seed('settings', [{ id: 1, length_unit: 'mm', default_bleed_mm: 3, default_safe_mm: 4, one_colour_threshold: 50, smallest_line_mm: 0.2, min_dpi: 150 }]);
  seed('bases', [
    { id: IDS.coasters, app: 'maker', name: 'Engraved walnut coasters', kind: 'piece', width_mm: 95, height_mm: 95, corner_mm: 9, material: 'Walnut', thickness_mm: 6, outline_file: 'file-coaster', offered: JSON.stringify({ fonts: ['Manrope', 'Caveat'], finishes: ['engraved', 'paint-white'] }), state: 'published', position: 1 },
    { id: IDS.sign, app: 'maker', name: 'Slate house sign', kind: 'piece', width_mm: 300, height_mm: 200, corner_mm: null, material: 'Slate', thickness_mm: 5, outline_file: null, offered: JSON.stringify({ fonts: ['Manrope'], finishes: [] }), state: 'draft', position: 2 },
    { id: IDS.cards, app: 'printing', name: 'Business cards', kind: 'page', width_mm: 85, height_mm: 55, corner_mm: 0, bleed_mm: 3, safe_mm: 4, sides: 2, material: null, thickness_mm: null, outline_file: null, offered: JSON.stringify({ fonts: ['Manrope'], finishes: [] }), state: 'draft', position: 3 },
    { id: IDS.nook, app: 'maker', name: 'The Little Bookshop', kind: 'kit', width_mm: 110, height_mm: 180, depth_mm: 150, material: 'Birch ply', thickness_mm: 3, outline_file: null, offered: null, state: 'draft', position: 4 },
  ]);
  seed('base_areas', [
    { id: 21, app: 'maker', base_id: IDS.coasters, code: 'logo', name: 'Your logo', side: null, shape: 'rect', x_mm: 28.5, y_mm: 13.5, w_mm: 38, h_mm: 36, takes: 'logo', required: false, rules: JSON.stringify({ picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' }), feature_id: IDS.logo, position: 1 },
    { id: 22, app: 'maker', base_id: IDS.coasters, code: 'words', name: 'Your words', side: null, shape: 'rect', x_mm: 11.5, y_mm: 57, w_mm: 72, h_mm: 13.5, takes: 'words', required: true, rules: JSON.stringify({ chars: 24, grows: true, unit: 'mm', size: 6, min: 4, max: 8, fonts: ['Manrope', 'Caveat'], font: 'Manrope', finishes: ['engraved'], finish: 'engraved' }), feature_id: null, position: 2 },
  ]);
  seed('ready_designs', [
    { id: 51, app: 'maker', base_id: IDS.coasters, name: 'Ring', state: 'published', position: 1 },
    { id: 52, app: 'maker', base_id: IDS.coasters, name: 'Monogram', state: 'draft', position: 2 },
  ]);
  seed('ready_parts', [{ id: 61, app: 'maker', ready_design_id: 51, code: 'words', name: 'Your words', kind: 'text', locked: false, rules: JSON.stringify({ fonts: ['Manrope'], font: 'Manrope' }), position: 1 }]);
  seed('fonts', [
    { id: 71, app: null, family: 'Manrope', name: 'Manrope', style: 'Sans', weights: '200–800', licence: 'SIL Open Font License 1.1', starter: true, smallest_mm: 4, file: null, active: true },
    { id: 72, app: null, family: 'Caveat', name: 'Caveat', style: 'Handwriting', weights: '400–700', licence: 'SIL Open Font License 1.1', starter: true, smallest_mm: 7, file: null, active: true },
    { id: 73, app: null, family: 'Oswald', name: 'Oswald', style: 'Condensed capitals', weights: '200–700', licence: 'SIL Open Font License 1.1', starter: true, smallest_mm: 5, file: null, active: true },
  ]);
  seed('palettes', [{ id: IDS.finishes, app: 'maker', ready_design_id: null, kind: 'finishes', code: 'finishes', name: 'Finishes', position: 1 }]);
  seed('palette_colours', [
    { id: 81, app: 'maker', palette_id: IDS.finishes, code: 'engraved', role: null, name: 'Engraved', hex: '#3a2414', position: 1 },
    { id: 82, app: 'maker', palette_id: IDS.finishes, code: 'paint-white', role: null, name: 'Painted white', hex: '#f2f1ec', position: 2 },
    { id: 83, app: 'maker', palette_id: IDS.finishes, code: 'paint-black', role: null, name: 'Painted black', hex: '#17140f', position: 3 },
  ]);
  seed('features', [{ id: IDS.logo, app: 'maker', code: 'logo', name: 'Your own logo', active: true }]);
}

/** Marlow Press's Harbour card: a paper, a logo and a name on the front in two layouts, the paper on the back; one palette. */
export function seedCard(): void {
  seed('ready_designs', [...world.tables['ready_designs']!, { id: 53, app: 'printing', base_id: IDS.cards, name: 'Harbour', tags: '["simple"]', layouts: JSON.stringify([{ key: 'left', name: 'Logo left' }, { key: 'top', name: 'Logo top' }]), state: 'published', position: 1 }]);
  seed('ready_parts', [
    ...world.tables['ready_parts']!,
    { id: 101, app: 'printing', ready_design_id: 53, code: 'paper', name: 'Paper', kind: 'shape', locked: true, required: false, side: 'front', layout: 'left', x_mm: -3, y_mm: -3, w_mm: 91, h_mm: 61, rules: JSON.stringify({ shape: 'rect', fill: 'paper', background: true }), value: null, position: 1 },
    { id: 102, app: 'printing', ready_design_id: 53, code: 'logo', name: 'Logo', kind: 'picture', locked: false, required: false, side: 'front', layout: 'left', x_mm: 6, y_mm: 6, w_mm: 20, h_mm: 20, rules: JSON.stringify({ picture: 'logo', fit: 'inside', file: 'logo_file' }), value: null, position: 2 },
    { id: 103, app: 'printing', ready_design_id: 53, code: 'name', name: 'Name', kind: 'text', locked: false, required: true, side: 'front', layout: 'left', x_mm: 6, y_mm: 30.5, w_mm: 75, h_mm: 5.73, rules: JSON.stringify({ chars: 26, grows: false, unit: 'pt', size: 13, sizes: [11, 13, 15], fonts: ['Manrope'], font: 'Manrope', weight: 400, colours: ['ink', 'accent'], colour: 'ink', align: 'start', lines: 1, placeholder: 'Your name' }), value: null, position: 3 },
    { id: 104, app: 'printing', ready_design_id: 53, code: 'name', name: 'Name', kind: 'text', locked: false, required: true, side: 'front', layout: 'top', x_mm: 6, y_mm: 28.5, w_mm: 73, h_mm: 5.73, rules: JSON.stringify({ chars: 26, grows: false, unit: 'pt', size: 13, sizes: [13], fonts: ['Manrope'], font: 'Manrope', colours: ['ink'], colour: 'ink', align: 'center', lines: 1, placeholder: 'Your name' }), value: null, position: 4 },
    { id: 105, app: 'printing', ready_design_id: 53, code: 'paper', name: 'Colour', kind: 'shape', locked: true, required: false, side: 'back', layout: 'left', x_mm: -3, y_mm: -3, w_mm: 91, h_mm: 61, rules: JSON.stringify({ shape: 'rect', fill: 'accent', background: true }), value: null, position: 5 },
  ]);
  seed('palettes', [...world.tables['palettes']!, { id: 91, app: 'printing', ready_design_id: 53, kind: 'colours', code: 'harbour', name: 'Harbour', position: 1 }]);
  seed('palette_colours', [
    ...world.tables['palette_colours']!,
    { id: 92, app: 'printing', palette_id: 91, code: 'paper', role: 'paper', name: 'Paper', hex: '#f4efe6', position: 1 },
    { id: 93, app: 'printing', palette_id: 91, code: 'ink', role: 'ink', name: 'Ink', hex: '#1f2a36', position: 2 },
    { id: 94, app: 'printing', palette_id: 91, code: 'accent', role: 'accent', name: 'Accent', hex: '#c0562f', position: 3 },
  ]);
}
