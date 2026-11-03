/**
 * WAITING FOR AN EXPORT TO BE WRITTEN.
 *
 * The data kit starts an export and answers its id at once; Adminium writes
 * the file in a job. Opened before the job is done, the download answers
 * "Export is processing." in place of the file. So the CSV is opened once
 * Adminium says it is ready: asked every second, for two minutes at most. An
 * export that failed, was stopped or is gone is refused with Adminium's own
 * words; a reply that says nothing of its state is taken as ready.
 */
import { api } from '../shared/host.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export class ExportNotReady extends Error {
  readonly code = 'EXPORT_FAILED';
  readonly status: string;
  constructor(status: string) {
    super(`The export is ${status}.`);
    this.status = status;
  }
}

export async function exportReady(id: string, options: { every?: number; tries?: number; get?: <T>(path: string) => Promise<T> } = {}): Promise<void> {
  const every = options.every ?? 1000;
  const tries = options.tries ?? 120;
  const get = options.get ?? api.get;
  for (let n = 0; n < tries; n += 1) {
    const reply = await get<unknown>(`/api/v1/exports/${encodeURIComponent(id)}`);
    const data = isRecord(reply) ? reply['data'] : undefined;
    const status = isRecord(data) && typeof data['status'] === 'string' ? data['status'] : null;
    if (status !== 'processing') {
      if (status === 'failed' || status === 'cancelled' || status === 'expired') throw new ExportNotReady(status);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, every));
  }
  throw new ExportNotReady('processing');
}
