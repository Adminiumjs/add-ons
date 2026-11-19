import { describe, expect, it } from 'vitest';

import { latestMails, tellingOf } from './telling.ts';

const NOW = Date.parse('2026-11-19T10:00:00Z');

describe('where telling a found person stands', () => {
  it('reads told, objected and failed from the row, and a queued mail as sending', () => {
    expect(tellingOf({ state: 'told', told_at: '2026-11-02T09:00:00Z' }, null, NOW)).toEqual({ kind: 'told', at: Date.parse('2026-11-02T09:00:00Z') });
    expect(tellingOf({ state: 'objected' }, null, NOW)).toEqual({ kind: 'objected' });
    expect(tellingOf({ state: 'waiting', tell_by: '2026-12-01' }, { id: '5', status: 'queued', error: null }, NOW)).toEqual({ kind: 'sending' });
    // Sent again: queued, though the row still says it failed.
    expect(tellingOf({ state: 'failed', tell_by: '2026-12-01' }, { id: '5', status: 'queued', error: null }, NOW)).toEqual({ kind: 'sending' });
    expect(tellingOf({ state: 'failed', tell_by: '2026-12-01' }, { id: '5', status: 'failed', error: 'bounced' }, NOW)).toMatchObject({ kind: 'failed', error: 'bounced', mail: '5' });
  });

  it('is near within five days of "tell by", and overdue after it', () => {
    expect(tellingOf({ state: 'waiting', tell_by: '2026-11-24' }, null, NOW)).toMatchObject({ kind: 'tell-by', near: true, overdue: false });
    expect(tellingOf({ state: 'waiting', tell_by: '2026-11-25' }, null, NOW)).toMatchObject({ kind: 'tell-by', near: false, overdue: false });
    expect(tellingOf({ state: 'waiting', tell_by: '2026-11-18' }, null, NOW)).toMatchObject({ kind: 'tell-by', near: false, overdue: true });
  });

  it('keeps the latest mail of each person', () => {
    const latest = latestMails([
      { id: 3, found_person_id: 1, status: 'failed', error: 'bounced' },
      { id: 9, found_person_id: 1, status: 'queued', error: null },
      { id: 4, found_person_id: 2, status: 'sent', error: null },
    ]);
    expect(latest.get('1')).toEqual({ id: '9', status: 'queued', error: null });
    expect(latest.get('2')?.status).toBe('sent');
  });
});
