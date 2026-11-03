/**
 * The Invitations tab: its own folder's screen, handed the form's row by the
 * frame (`TabProps`). A placeholder until that screen is built.
 */
import type { ReactNode } from 'react';

import { EmptyState } from '../shared/host.ts';
import type { TabProps } from '../shared/slot.ts';

export function Invitations({ t }: TabProps): ReactNode {
  return <EmptyState compact title={t('surveys.placeholder.invitations', "Everyone the survey was sent to is listed here.")} />;
}
