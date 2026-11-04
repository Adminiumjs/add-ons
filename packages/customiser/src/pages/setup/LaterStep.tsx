/**
 * THE PAGE WITH NO BASE YET: what to set up first, and the button that
 * starts it. (Step 6, the preview, is `PreviewStep.tsx`.)
 */
import type { ReactNode } from 'react';

import { Button, EmptyState, type AddOnTranslate } from '../shared/host.ts';

export function LaterStep({ t, onAdd }: { t: AddOnTranslate; onAdd?: () => void }): ReactNode {
  return (
    <EmptyState
      title={t('setup.none.title', 'Nothing is set up for customising yet')}
      body={t('setup.none.body', 'Start with a base: the page or the piece a customer makes their own. Then link the product to it in the shop app.')}
      actions={onAdd === undefined ? undefined : <Button onClick={onAdd}>{t('setup.newBase', 'New base')}</Button>}
    />
  );
}
