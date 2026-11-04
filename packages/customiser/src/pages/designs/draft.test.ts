import { describe, expect, it } from 'vitest';

import { checkDesign } from '../../rules/index.ts';
import { textRules } from '../../rules/shapes.ts';
import type { DataRow } from '../shared/host.ts';
import { addLayout, addPart, changesOf, commit, draftOf, endGesture, historyOf, movedBox, nudgedBox, partsOn, redo, setLocked, startParts, textHeightMm, toggleRule, undo, zMoved, type AddFacts, type DesignDraft, type FaceFacts } from './draft.ts';

const PIECE: FaceFacts = { kind: 'piece', width: 95, height: 95, bleed: 0, safe: 0, sides: 1 };
const CARD: FaceFacts = { kind: 'page', width: 85, height: 55, bleed: 3, safe: 4, sides: 2 };
const facts = (face: FaceFacts, over: Partial<AddFacts> = {}): AddFacts => ({ face, side: 'front', layout: null, fonts: ['Manrope', 'Caveat'], finishes: ['engraved', 'paint-white'], logoFeature: 41, name: 'New text', sample: 'Your words', shapeSays: 'Engraved frame, 1 mm', ...over });
const empty = (): DesignDraft => ({ id: 51, name: 'Ring', state: 'published', tags: [], layouts: [], palettes: [], parts: [] });

describe('a new part, as each comp starts one', () => {
  it('on a piece: a band of text in millimetres whose limit grows with smaller letters, in the base’s first font and finish', () => {
    const { draft, key } = addPart(empty(), 'text', facts(PIECE));
    const part = draft.parts.find((one) => one.key === key)!;
    expect(part).toMatchObject({ kind: 'text', code: 'new-text', name: 'New text', locked: false, side: null, box: { x: 28.5, y: 38, w: 38, h: 19 } });
    expect(part.rules).toEqual({ chars: 16, grows: true, unit: 'mm', size: 7, min: 4, max: 11, fonts: ['Manrope'], font: 'Manrope', finishes: ['engraved'], finish: 'engraved', placeholder: 'Your words' });
    // The rule module reads exactly what was written.
    expect(textRules(JSON.stringify(part.rules))).toMatchObject({ chars: 16, grows: true, unit: 'mm', size: 7, min: 4, max: 11, sizes: null, fonts: ['Manrope'] });
  });

  it('on a piece: a logo box that takes the logo feature, a motif with three to choose from, a frame the studio keeps', () => {
    const logo = addPart(empty(), 'logo', facts(PIECE, { name: 'Logo box' }));
    expect(logo.draft.parts[0]).toMatchObject({ kind: 'picture', featureId: 41, rules: { picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' } });
    const motif = addPart(empty(), 'motif', facts(PIECE, { name: 'Motif' }));
    expect(motif.draft.parts[0]).toMatchObject({ kind: 'choice', value: { choice: 'sprout' }, rules: { choices: ['sprout', 'leaf', 'wheat'] } });
    const shape = addPart(empty(), 'shape', facts(PIECE, { name: 'Frame' }));
    expect(shape.draft.parts[0]).toMatchObject({ kind: 'shape', locked: true, value: { text: 'Engraved frame, 1 mm' }, rules: { shape: 'rect' }, box: { x: 7.6, y: 7.6, w: 79.8, h: 79.8 } });
  });

  it('on a page: a 9 pt text centred on the card, its limit fixed, in points, on the side and layout shown', () => {
    const { draft } = addPart(empty(), 'text', facts(CARD, { side: 'back', layout: 'left', name: 'Text', sample: 'Your words here' }));
    const part = draft.parts[0]!;
    expect(part).toMatchObject({ side: 'back', layout: 'left', box: { x: 20, y: 25.5, w: 45, h: 3.97 } });
    expect(part.rules).toEqual({ chars: 30, grows: false, unit: 'pt', size: 9, sizes: [9], fonts: ['Manrope'], font: 'Manrope', weight: 700, colours: ['ink'], colour: 'ink', align: 'start', lines: 1, placeholder: 'Your words here' });
    expect(textRules(JSON.stringify(part.rules))).toMatchObject({ grows: false, unit: 'pt', sizes: [9], colours: ['ink'] });
  });

  it('on a page: a rectangle, an ellipse and a line in the palette’s colours, each the shop’s', () => {
    for (const [tool, w, h, fill] of [['rect', 30, 20, 'accent'], ['ellipse', 22, 22, 'accent'], ['line', 40, 0.6, 'ink']] as const) {
      const part = addPart(empty(), tool, facts(CARD, { name: tool })).draft.parts[0]!;
      expect(part, tool).toMatchObject({ kind: 'shape', locked: true, box: { w, h }, rules: { fill } });
    }
  });

  it('gives each new part a code of its own in the design', () => {
    let draft = empty();
    for (let n = 0; n < 3; n += 1) draft = addPart(draft, 'text', facts(PIECE)).draft;
    expect(draft.parts.map((part) => part.code)).toEqual(['new-text', 'new-text-2', 'new-text-3']);
  });
});

describe('moving a part', () => {
  it('keeps it on the piece, and lets a page’s part run into the bleed and no further', () => {
    expect(movedBox({ x: 80, y: 10, w: 20, h: 10 }, 50, -50, PIECE)).toEqual({ x: 75, y: 0, w: 20, h: 10 });
    expect(movedBox({ x: 1, y: 1, w: 10, h: 5 }, -10, -10, CARD)).toEqual({ x: -3, y: -3, w: 10, h: 5 });
  });

  it('moves by the arrow keys: a page half a millimetre (five with Shift), a piece a hundredth of the face; Alt resizes', () => {
    expect(nudgedBox({ x: 10, y: 10, w: 20, h: 5 }, 'ArrowRight', { shift: false, alt: false }, CARD)).toEqual({ x: 10.5, y: 10, w: 20, h: 5 });
    expect(nudgedBox({ x: 10, y: 10, w: 20, h: 5 }, 'ArrowDown', { shift: true, alt: false }, CARD)).toEqual({ x: 10, y: 12.5, w: 20, h: 5 });
    expect(nudgedBox({ x: 10, y: 10, w: 20, h: 10 }, 'ArrowLeft', { shift: false, alt: false }, PIECE)).toEqual({ x: 9.1, y: 10, w: 20, h: 10 });
    expect(nudgedBox({ x: 10, y: 10, w: 20, h: 10 }, 'ArrowRight', { shift: false, alt: true }, PIECE)).toEqual({ x: 10, y: 10, w: 21, h: 10 });
    expect(nudgedBox({ x: 10, y: 10, w: 20, h: 10 }, 'a', { shift: false, alt: false }, PIECE)).toBeNull();
  });

  it('sizes a page’s text by its points and lines (Marlow’s 1.25 line height)', () => {
    expect(textHeightMm(9, 1)).toBe(3.97);
    expect(textHeightMm(7, 2)).toBe(6.17);
  });
});

describe('the history', () => {
  it('makes a drag one step, undoes and redoes it, and starts a new step after the gesture ends', () => {
    let history = historyOf(empty());
    const at = (x: number): DesignDraft => ({ ...history.present, name: `at ${String(x)}` });
    history = commit(history, at(1), 'drag:a');
    history = commit(history, at(2), 'drag:a');
    history = commit(history, at(3), 'drag:a');
    expect(history.past).toHaveLength(1);
    history = endGesture(history);
    history = commit(history, at(4), 'drag:a');
    expect(history.past).toHaveLength(2);
    history = undo(history);
    expect(history.present.name).toBe('at 3');
    history = undo(history);
    expect(history.present.name).toBe('Ring');
    history = redo(history);
    expect(history.present.name).toBe('at 3');
    // A new change drops what could be redone.
    history = commit(history, at(9));
    expect(history.future).toEqual([]);
  });
});

describe('locking, the lists of a rule, the layers', () => {
  it('gives a locked text words of its own from its sample, and leaves its words alone once it has some', () => {
    const { draft, key } = addPart(empty(), 'text', facts(PIECE));
    const locked = setLocked(draft, key, true);
    expect(locked.parts[0]).toMatchObject({ locked: true, value: { text: 'Your words' } });
    expect(setLocked(setLocked(locked, key, false), key, true).parts[0]?.value).toEqual({ text: 'Your words' });
  });

  it('switches a font, a size or a colour on and off, keeps the last one, and keeps the start value among them', () => {
    expect(toggleRule({ fonts: ['Manrope', 'Caveat'], font: 'Manrope' }, 'fonts', 'Manrope')).toEqual({ fonts: ['Caveat'], font: 'Caveat' });
    expect(toggleRule({ fonts: ['Caveat'], font: 'Caveat' }, 'fonts', 'Caveat')).toEqual({ fonts: ['Caveat'], font: 'Caveat' });
    expect(toggleRule({ sizes: [13, 9], size: 13 }, 'sizes', 11)).toEqual({ sizes: [9, 11, 13], size: 13 });
    expect(toggleRule({ colours: ['ink', 'accent'], colour: 'ink' }, 'colours', 'ink')).toEqual({ colours: ['accent'], colour: 'accent' });
  });

  it('brings a layer forward among the parts of its own side, never past them', () => {
    let draft = empty();
    for (const side of ['front', 'back', 'front'] as const) draft = addPart(draft, 'rect', facts(CARD, { side, name: side })).draft;
    const [first, , third] = draft.parts;
    const moved = zMoved(draft, first!.key, 1);
    expect(partsOn(moved, 'front', null).map((part) => part.key)).toEqual([third!.key, first!.key]);
    expect(zMoved(moved, first!.key, 1)).toBe(moved);
  });
});

describe('layouts', () => {
  it('copies the layout shown, with the same codes, so a customer’s words carry across', () => {
    let draft: DesignDraft = { ...empty(), layouts: [{ key: 'std', name: 'Standard' }] };
    draft = addPart(draft, 'text', facts(CARD, { layout: 'std', name: 'Name' })).draft;
    const { draft: two, key } = addLayout(draft, 'std', 'Layout 2');
    expect(two.layouts).toEqual([{ key: 'std', name: 'Standard' }, { key, name: 'Layout 2' }]);
    expect(partsOn(two, 'front', key).map((part) => [part.code, part.id])).toEqual([['name', null]]);
    expect(partsOn(two, 'front', 'std')).toHaveLength(1);
  });
});

describe('a new design', () => {
  it('on a page: the paper edge to edge on both sides and a required name, as Marlow’s', () => {
    const parts = startParts(CARD, [], { paper: 'Paper', name: 'Name', sample: 'Your name' }, 'Manrope');
    expect(parts.map((part) => [part.code, part.side, part.kind, part.locked])).toEqual([['paper', 'front', 'shape', true], ['name', 'front', 'text', false], ['paper', 'back', 'shape', true]]);
    expect(parts[0]?.box).toEqual({ x: -3, y: -3, w: 91, h: 61 });
    expect(parts[1]).toMatchObject({ required: true, box: { x: 6, y: 6, w: 73, h: 4.85 }, rules: { size: 11, unit: 'pt', grows: false } });
  });

  it('on a piece: a part for each of the base’s areas, with the area’s own rules', () => {
    const areas = [
      { id: 21, code: 'logo', name: 'Your logo', takes: 'logo', required: false, x_mm: 28.5, y_mm: 13.5, w_mm: 38, h_mm: 36, rules: '{"picture":"logo","fit":"inside","colour":"one","file":"logo_file"}', feature_id: 41 },
      { id: 22, code: 'words', name: 'Your words', takes: 'words', required: true, x_mm: 11.5, y_mm: 57, w_mm: 72, h_mm: 13.5, rules: { chars: 24, grows: true, unit: 'mm', size: 6 }, feature_id: null },
    ];
    // A database that hands a JSON column back parsed and one that hands it as text are read alike.
    const parts = startParts(PIECE, areas as unknown as DataRow[], { paper: 'Paper', name: 'Name', sample: 'Your name' }, 'Manrope');
    expect(parts.map((part) => [part.code, part.kind, part.areaId, part.featureId, part.required])).toEqual([['logo', 'picture', 21, 41, false], ['words', 'text', 22, null, true]]);
    expect(parts[1]?.rules).toEqual({ chars: 24, grows: true, unit: 'mm', size: 6 });
  });
});

describe('what Save writes', () => {
  const rows = {
    design: { id: 51, name: 'Ring', state: 'published', tags: '["words"]', layouts: null },
    parts: ([
      { id: 61, ready_design_id: 51, code: 'words', name: 'Your words', kind: 'text', locked: false, required: true, x_mm: 13.3, y_mm: 57, w_mm: 68.4, h_mm: 12.35, rules: '{"chars":22,"grows":true,"unit":"mm","size":6,"min":4,"max":8}', value: null, position: 1 },
      { id: 62, ready_design_id: 51, code: 'ring', name: 'The ring', kind: 'shape', locked: true, required: false, x_mm: 6.65, y_mm: 6.65, w_mm: 81.7, h_mm: 81.7, rules: { shape: 'ring' }, value: { text: 'Engraved ring, 1 mm' }, position: 2 },
    ] as unknown as DataRow[]),
  };

  it('writes nothing for a draft that was not changed', () => {
    const before = draftOf(rows.design, rows.parts, [], []);
    expect(changesOf(before, before, 'maker')).toEqual({ design: null, parts: { create: [], update: [], remove: [] }, palettes: { create: [], update: [], remove: [] }, colours: { update: [], create: [] } });
  });

  it('writes only what changed: the design’s own columns, each changed part, the new and the gone', () => {
    const before = draftOf(rows.design, rows.parts, [], []);
    let now = { ...before, name: 'Ring of words' };
    now = { ...now, parts: [{ ...now.parts[0]!, rules: { ...now.parts[0]!.rules, chars: 20 } }] };
    now = addPart(now, 'logo', facts(PIECE, { name: 'Logo box' })).draft;
    const changes = changesOf(before, now, 'maker');
    expect(changes.design).toEqual({ name: 'Ring of words' });
    expect(changes.parts.remove).toEqual([62]);
    expect(changes.parts.update).toEqual([[61, expect.objectContaining({ rules: '{"chars":20,"grows":true,"unit":"mm","size":6,"min":4,"max":8}', position: 1 })]]);
    expect(changes.parts.create).toEqual([expect.objectContaining({ app: 'maker', ready_design_id: 51, kind: 'picture', code: 'logo-box', feature_id: 41, position: 2, value: null })]);
  });

  it('saves a design the rule module checks as it reads its parts: a 40-character line in a 22-character part is refused', () => {
    const before = draftOf(rows.design, rows.parts, [], []);
    const written = changesOf(before, { ...before, parts: [...before.parts].reverse() }, 'maker').parts.update.map(([id, values]): Record<string, unknown> => ({ ...values, id }));
    expect(written.map((row) => [row.id, row['position']])).toEqual([[62, 1], [61, 2]]);
    const ask = (words: string) =>
      checkDesign({
        design: { id: 90, app: 'maker', format: 1, base_id: 11, ready_design_id: 51, values: JSON.stringify({ parts: { words: { text: words } } }) },
        ready: { id: 51, base_id: 11, app: 'maker' },
        base: { id: 11, kind: 'piece', app: 'maker' },
        parts: written.map((row) => ({ ...row, ready_design_id: 51 })),
        areas: [],
        palettes: [],
        features: [],
        files: [],
        settings: {},
      });
    expect(ask('x'.repeat(40)).refusals).toContainEqual({ part: 'words', reason: 'too-long' });
    expect(ask('The Hartleys').ok).toBe(true);
  });
});
