import { describe, expect, it } from 'vitest';

import { exportReady } from './exportReady.ts';

const replies = (statuses: (string | null)[]) => {
  const asked: string[] = [];
  const get = async <T,>(path: string): Promise<T> => {
    asked.push(path);
    const status = statuses.shift();
    return (status === null ? {} : { data: { id: 'exp_1', status } }) as T;
  };
  return { asked, get };
};

describe('waiting for an export', () => {
  it('asks until Adminium says it is ready, then lets the download open', async () => {
    const world = replies(['processing', 'processing', 'ready']);
    await exportReady('exp_1', { every: 1, get: world.get });
    expect(world.asked).toEqual(['/api/v1/exports/exp_1', '/api/v1/exports/exp_1', '/api/v1/exports/exp_1']);
  });

  it('refuses an export that failed, and one still not written after its tries', async () => {
    await expect(exportReady('exp_1', { every: 1, get: replies(['processing', 'failed']).get })).rejects.toMatchObject({ code: 'EXPORT_FAILED', status: 'failed' });
    await expect(exportReady('exp_1', { every: 1, tries: 2, get: replies(['processing', 'processing', 'processing']).get })).rejects.toMatchObject({ status: 'processing' });
  });

  it('takes a reply that says nothing of its state as ready', async () => {
    await expect(exportReady('exp_1', { every: 1, get: replies([null]).get })).resolves.toBeUndefined();
  });
});
