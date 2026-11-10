// @vitest-environment happy-dom
/**
 * A LIST READ ONCE: held only once its own question was seen loading and
 * then answered; an answer shown at once (the last question's rows, while a
 * new one loads) is never held, and a refusal is passed on.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loaded, resetWorld, seed, world } from '../testing/host.tsx';

const { useSteadyRecords } = await import('./steady.ts');

const ROWS = [
  { id: 1, app: 'maker', family: 'Manrope' },
  { id: 2, app: 'printing', family: 'Caveat' },
];
const of = (app: string) => ({ filter: [{ column: 'app', op: 'eq' as const, value: app }], pageSize: 50 });
/** How many times the fonts were read since the last look. */
const readsOfFonts = (): number => {
  const count = world.reads.filter((table) => table === 'fonts').length;
  world.reads.length = 0;
  return count;
};
const touch = (): void => act(() => seed('palettes', []));

beforeEach(() => {
  resetWorld();
  seed('fonts', ROWS);
});
afterEach(cleanup);

describe('useSteadyRecords', () => {
  it('holds a question seen loading and then answered: a later write elsewhere reads it no more', () => {
    world.pending.add('fonts');
    const { result } = renderHook(() => useSteadyRecords('fonts', of('maker')));
    expect(result.current.loading).toBe(true);
    act(() => loaded('fonts'));
    expect(result.current.rows.map((row) => row['family'])).toEqual(['Manrope']);
    readsOfFonts();
    touch();
    touch();
    expect(readsOfFonts()).toBe(0);
    expect(result.current.rows.map((row) => row['family'])).toEqual(['Manrope']);
  });

  it('never holds a new question answered without a load: it may be the last question’s rows', () => {
    world.pending.add('fonts');
    const { result, rerender } = renderHook(({ app }) => useSteadyRecords('fonts', of(app)), { initialProps: { app: 'maker' } });
    act(() => loaded('fonts'));
    rerender({ app: 'printing' });
    readsOfFonts();
    touch();
    // Read again on the write: not held.
    expect(readsOfFonts()).toBe(1);
    expect(result.current.rows.map((row) => row['family'])).toEqual(['Caveat']);
  });

  it('passes a refusal on and holds nothing until a read is answered', () => {
    world.closed.add('fonts');
    const { result } = renderHook(() => useSteadyRecords('fonts', of('maker')));
    expect(result.current.error?.code).toBe('TABLE_FORBIDDEN');
    act(() => {
      world.closed.delete('fonts');
      seed('fonts', ROWS);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows.map((row) => row['family'])).toEqual(['Manrope']);
  });
});
