// @vitest-environment happy-dom
/**
 * A SHOWN DESIGN'S PREVIEW PICTURE: made from the rows as saved, kept in the
 * design's own file column, and never made where Adminium has no upload.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FlatSheet } from '../../draw/flat.ts';
import { resetWorld, world } from '../testing/host.tsx';
import { IDS, seedCard, seedShop } from '../testing/rows.ts';

const { usePreviewPicture } = await import('./picture.ts');

beforeEach(() => {
  resetWorld();
  seedShop();
  seedCard();
});
afterEach(cleanup);

describe('the preview picture', () => {
  it('paints the design’s front as its card draws it, the shop’s example words in, and keeps it in the design', async () => {
    const painted: FlatSheet[] = [];
    const { result } = renderHook(() =>
      usePreviewPicture(async (sheet) => {
        painted.push(sheet);
        return new Blob(['png'], { type: 'image/png' });
      }),
    );
    const base = world.tables['bases']!.find((one) => one['id'] === IDS.cards)!;
    let answer = '';
    await act(async () => {
      answer = await result.current(base, 53);
    });
    expect(answer).toBe('made');
    expect(painted[0]!.side).toBe('front');
    expect(painted[0]!.face).toMatchObject({ kind: 'page', width: 85, height: 55, colour: '#f4efe6' });
    const name = painted[0]!.items.find((one) => one.code === 'name');
    expect(name).toMatchObject({ kind: 'text', lines: [{ text: 'Your name' }], colour: '#1f2a36' });
    // In the shop's own file, loaded under the Customiser's name: never the dashboard's Manrope.
    expect(name).toMatchObject({ font: 'cz-Manrope' });
    // An empty logo box carries no words of the screen's language.
    expect(painted[0]!.items.find((one) => one.code === 'logo')).toMatchObject({ kind: 'slot', label: '' });
    const upload = world.calls.find((call) => call.kind === 'upload');
    expect(upload).toMatchObject({ table: 'ready_designs', key: '53', values: { column: 'preview_file', name: 'preview-53.png', type: 'image/png' } });
    expect(world.tables['ready_designs']!.find((one) => one['id'] === 53)!['preview_file']).toMatch(/^file-/);
  });

  it('makes none on an Adminium with no upload, or where the page cannot paint, and says the upload’s refusal', async () => {
    const base = world.tables['bases']!.find((one) => one['id'] === IDS.cards)!;
    world.uploads = false;
    const off = renderHook(() => usePreviewPicture(async () => new Blob(['png'])));
    await act(async () => expect(await off.result.current(base, 53)).toBe('skipped'));
    world.uploads = true;
    const cannot = renderHook(() => usePreviewPicture(async () => null));
    await act(async () => expect(await cannot.result.current(base, 53)).toBe('skipped'));
    world.upload = () => {
      throw Object.assign(new Error('too big'), { code: 'VALIDATION_FAILED' });
    };
    const refused = renderHook(() => usePreviewPicture(async () => new Blob(['png'])));
    await act(async () => expect(await refused.result.current(base, 53)).toBe('failed'));
    expect(world.calls.filter((call) => call.kind === 'upload')).toHaveLength(1);
  });
});
