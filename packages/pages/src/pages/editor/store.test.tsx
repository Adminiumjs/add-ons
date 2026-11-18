// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HISTORY_MAX, resetEditors, SAVE_DELAY_MS, useEditing, type PageRow } from './store.ts';

const row = (more: Partial<PageRow> = {}): PageRow => ({ key: '7', name: 'Open day', slug: 'open-day', state: 'draft', language: 'en-US', draft: { v: 1, title: 'Open day', description: '', blocks: [] }, published: null, publishedAt: null, ...more });

beforeEach(() => {
  resetEditors();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('one page’s working copy', () => {
  it('writes a burst of changes once, after it has been still a moment', async () => {
    const writer = vi.fn(async () => undefined);
    const { result } = renderHook(() => useEditing(row(), writer));
    act(() => result.current.change((copy) => ({ ...copy, name: 'Open' }), 'name'));
    act(() => result.current.change((copy) => ({ ...copy, name: 'Open day in Leeds' }), 'name'));
    expect(result.current.save).toBe('dirty');
    await act(async () => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10));
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith({ draft: { v: 1, title: 'Open day', description: '', blocks: [] }, language: 'en-US', name: 'Open day in Leeds' });
    expect(result.current.save).toBe('saved');
  });

  it('never writes and never changes for a reader, whatever is asked of it', async () => {
    const { result } = renderHook(() => useEditing(row(), null));
    act(() => result.current.change((copy) => ({ ...copy, name: 'Changed' })));
    await act(async () => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3));
    expect(result.current.copy.name).toBe('Open day');
    expect(result.current.canUndo).toBe(false);
  });

  it('takes typing into one field back as one step, and keeps at most 30 steps', () => {
    const { result } = renderHook(() => useEditing(row(), async () => undefined));
    act(() => result.current.change((copy) => ({ ...copy, name: 'O' }), 'name'));
    act(() => result.current.change((copy) => ({ ...copy, name: 'Op' }), 'name'));
    act(() => result.current.undo());
    expect(result.current.copy.name).toBe('Open day');
    for (let n = 0; n < HISTORY_MAX + 5; n += 1) act(() => result.current.change((copy) => ({ ...copy, name: `n${String(n)}` })));
    for (let n = 0; n < HISTORY_MAX + 5; n += 1) act(() => result.current.undo());
    expect(result.current.copy.name).toBe('n4');
  });

  it('says a write failed, and writes again when asked', async () => {
    let fail = true;
    const writer = vi.fn(async () => {
      if (fail) throw new Error('down');
    });
    const { result } = renderHook(() => useEditing(row(), writer));
    act(() => result.current.change((copy) => ({ ...copy, name: 'Again' })));
    await act(async () => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10));
    expect(result.current.save).toBe('error');
    fail = false;
    await act(async () => result.current.flush());
    expect(result.current.save).toBe('saved');
    expect(writer).toHaveBeenCalledTimes(2);
  });
});
