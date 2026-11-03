/** A form's status, worded and toned the one way everywhere: Live positive, Draft and Closed neutral. */
import type { ReactNode } from 'react';

import { StatusPill, type AddOnTranslate } from './host.ts';
import type { FormState } from './row.ts';

export function stateWord(t: AddOnTranslate, state: FormState): string {
  if (state === 'live') return t('shared.state.live', 'Live');
  if (state === 'closed') return t('shared.state.closed', 'Closed');
  return t('shared.state.draft', 'Draft');
}

export function StatePill({ t, state }: { t: AddOnTranslate; state: FormState }): ReactNode {
  return (
    <StatusPill status={state} tone={state === 'live' ? 'pos' : 'neutral'}>
      {stateWord(t, state)}
    </StatusPill>
  );
}
