/**
 * The Share tab: its own folder's screen, handed the form's row by the
 * frame (`TabProps`). A placeholder until that screen is built.
 */
import type { ReactNode } from 'react';

import { EmptyState } from '../shared/host.ts';
import type { TabProps } from '../shared/slot.ts';

export function Share({ t }: TabProps): ReactNode {
  return <EmptyState compact title={t('share.placeholder.share', "The link, the QR code and the lines for your website are shown here.")} />;
}
