/**
 * The Questions tab: its own folder's screen, handed the form's row by the
 * frame (`TabProps`). A placeholder until that screen is built.
 */
import type { ReactNode } from 'react';

import { EmptyState } from '../shared/host.ts';
import type { TabProps } from '../shared/slot.ts';

export function Questions({ t }: TabProps): ReactNode {
  return <EmptyState compact title={t('builder.placeholder.questions', "The questions of this form are built here.")} />;
}
