import { describe, expect, it } from 'vitest';

import { Refused } from '../testing/host.tsx';
import { MAIL_PATH, mailStatusOf, readShareStatus, STATUS_PATH, statusOf } from './status.ts';

const notThere = (): Refused => Object.assign(new Refused('NOT_FOUND'), { status: 404 }) as Refused;

describe('what the Share tab reads of Adminium', () => {
  it('reads the status reply: the public address without a trailing slash, the websites, the reach', () => {
    expect(statusOf({ data: { mail: { sends: true, blocked: null }, reach: { state: 'proxy-hidden' }, notice: true, publicOrigin: 'https://crm.meridian.example/', websites: ['https://www.meridian.example', 7, ''], roles: [] } })).toEqual({
      publicOrigin: 'https://crm.meridian.example',
      websites: ['https://www.meridian.example'],
      reach: 'proxy-hidden',
    });
    expect(statusOf({ data: { reach: { state: 'somewhere' }, publicOrigin: '', websites: null } })).toEqual({ publicOrigin: null, websites: [], reach: null });
    expect(statusOf({})).toBeNull();
    expect(statusOf(null)).toBeNull();
  });

  it('reads the older mail reply for the one thing it says: whether a public address is missing', () => {
    expect(mailStatusOf({ data: { sends: false, blocked: 'no-public-origin' } })).toEqual({ publicOrigin: null, websites: [], reach: 'not-set' });
    expect(mailStatusOf({ data: { sends: false, blocked: 'no-mail-server' } })).toEqual({ publicOrigin: null, websites: [], reach: null });
    expect(mailStatusOf('no')).toBeNull();
  });

  it('asks the status read, and the mail read only when the status read is not there', async () => {
    const asked: string[] = [];
    const answer = (replies: Record<string, () => unknown>) => async <T,>(path: string): Promise<T> => {
      asked.push(path);
      return (replies[path] as () => T)();
    };
    await expect(readShareStatus(answer({ [STATUS_PATH]: () => ({ data: { reach: { state: 'reachable' }, publicOrigin: 'https://a.example', websites: [] } }) }))).resolves.toEqual({ publicOrigin: 'https://a.example', websites: [], reach: 'reachable' });
    expect(asked).toEqual([STATUS_PATH]);
    asked.length = 0;
    await expect(
      readShareStatus(
        answer({
          [STATUS_PATH]: () => {
            throw notThere();
          },
          [MAIL_PATH]: () => ({ data: { sends: false, blocked: 'no-public-origin' } }),
        }),
      ),
    ).resolves.toEqual({ publicOrigin: null, websites: [], reach: 'not-set' });
    expect(asked).toEqual([STATUS_PATH, MAIL_PATH]);
  });

  it('never falls back on a refusal or a reply it cannot read', async () => {
    // The mail read would answer: a refusal of the status read must still never reach it.
    const refused = async <T,>(path: string): Promise<T> => {
      if (path === MAIL_PATH) return { data: { sends: true, blocked: null } } as T;
      throw new Refused('FORBIDDEN');
    };
    await expect(readShareStatus(refused)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const odd = async <T,>(): Promise<T> => ({ data: 'odd' }) as T;
    await expect(readShareStatus(odd)).rejects.toThrow('answered something else');
  });
});
