/**
 * WHAT ADMINIUM SAYS OF THE FORMS ON THIS SERVER, for the builder's blocked
 * cards, its Publish and its Tell: whether mail a stranger causes goes out,
 * whether strangers can reach the pages, whether the privacy notice is set,
 * the public address, and the roles a form may tell.
 *
 * Read once for every screen of the page (`shared/status.ts`, which the
 * Share tab reads too); this is what the builder makes of the reply.
 *
 * TODO(0.3.41): `GET /api/v1/forms/status` is Adminium 0.3.41's; on 0.3.40
 * the read fails and the builder shows no card and blocks nothing (Adminium
 * still refuses to publish a form while the notice is unset).
 */
import { useEffect, useMemo, useState } from 'react';

import { api } from '../shared/host.ts';
import { useStatusRead } from '../shared/status.ts';

export { STATUS_PATH as STATUS } from '../shared/status.ts';
export const PEOPLE = '/api/v1/people?limit=200';

export interface FormsStatus {
  mail: { sends: boolean; blocked: 'no-public-origin' | 'no-mail-server' | null };
  /** `reachable`, or the reason strangers cannot open the pages (`network-off`, `not-set`, `proxy-hidden`, …). */
  reach: { state: string };
  notice: boolean;
  publicOrigin: string | null;
  websites: readonly string[];
  roles: readonly { id: string; name: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The reply, read leniently: what is not there is not claimed. */
export function statusOf(reply: unknown): FormsStatus | null {
  const data = isRecord(reply) ? reply['data'] : undefined;
  if (!isRecord(data) || !isRecord(data['reach']) || typeof data['reach']['state'] !== 'string' || typeof data['notice'] !== 'boolean') return null;
  const mail = isRecord(data['mail']) ? data['mail'] : {};
  const blocked = mail['blocked'] === 'no-public-origin' || mail['blocked'] === 'no-mail-server' ? mail['blocked'] : null;
  return {
    mail: { sends: blocked === null, blocked },
    reach: { state: data['reach']['state'] },
    notice: data['notice'],
    publicOrigin: typeof data['publicOrigin'] === 'string' ? data['publicOrigin'] : null,
    websites: Array.isArray(data['websites']) ? data['websites'].filter((one): one is string => typeof one === 'string') : [],
    roles: Array.isArray(data['roles']) ? data['roles'].filter((one): one is { id: string; name: string } => isRecord(one) && typeof one['id'] === 'string' && typeof one['name'] === 'string') : [],
  };
}

/** For the screens' own tests: forget the last answer. */
export { resetStatus } from '../shared/status.ts';

/** The status as the builder reads it: null while it is asked, when it failed, and from an Adminium without the read. */
export function useFormsStatus(): { status: FormsStatus | null; loaded: boolean; refetch: () => Promise<void> } {
  const { read, loaded, refetch } = useStatusRead();
  const status = useMemo(() => (read?.from === 'status' ? statusOf(read.reply) : null), [read]);
  return { status, loaded, refetch };
}

/** The people a form may tell, by name: asked once the Tell section needs them. */
export function usePeople(wanted: boolean): readonly { id: string; name: string }[] {
  const [people, setPeople] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    api.get<unknown>(PEOPLE).then(
      (reply) => {
        const list = isRecord(reply) && Array.isArray(reply['people']) ? reply['people'] : [];
        if (live) setPeople(list.filter((one): one is { id: string; name: string } => isRecord(one) && typeof one['id'] === 'string' && typeof one['name'] === 'string'));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [wanted]);
  return people;
}
