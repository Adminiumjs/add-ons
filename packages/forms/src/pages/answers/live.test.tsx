// @vitest-environment happy-dom
/**
 * THE ANSWERS LIST, LIVE WHERE THE HOST CAN FOLLOW A TABLE.
 *
 * From Adminium 0.3.64 the host follows one of an add-on's tables live: each
 * answer Adminium writes makes the list read again. An older host has no
 * such hook, and the list reads as it always did.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { requireAddOnData } from '@adminium/add-on-contracts/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formRowOf } from '../shared/row.ts';
import { ANSWERS, ENQUIRIES, FILES, NOW, showroom } from '../testing/answers.ts';
import { resetWorld, seed, world } from '../testing/host.tsx';
import { summary } from '../testing/rows.ts';

async function draw(): Promise<void> {
  const { Answers } = await import('./Answers.tsx');
  const { wordsFor } = await import('../shared/messages.ts');
  const { ANSWERS: WORDS, SHARED } = await import('../strings/index.ts');
  render(<Answers t={wordsFor(SHARED, WORDS)} form={formRowOf(showroom())} refetch={() => undefined} summary={null} answer={null} settings={null} />);
  await act(async () => undefined);
}

beforeEach(() => {
  const start = performance.now();
  vi.spyOn(Date, 'now').mockImplementation(() => NOW + (performance.now() - start));
  resetWorld();
  seed('forms', [showroom()]);
  seed('answers', ANSWERS);
  seed('answer_files', FILES);
  world.formTables = [ENQUIRIES];
  world.summaries = { '7': summary(214) };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the answers list', () => {
  it('follows the answers table live on a host that can (0.3.64)', async () => {
    await draw();
    expect(world.live).toEqual([{ table: 'answers', enabled: true }]);
    expect(screen.getByText('Marta Kovac')).toBeTruthy();
  });

  it('on an older host, with no such hook, reads the list as it always did', async () => {
    const kit = requireAddOnData() as Record<string, unknown>;
    const held = kit['useLiveTable'];
    delete kit['useLiveTable'];
    try {
      vi.resetModules();
      await draw();
      expect(world.live).toEqual([]);
      expect(screen.getByText('Marta Kovac')).toBeTruthy();
    } finally {
      kit['useLiveTable'] = held;
      vi.resetModules();
    }
  });
});
