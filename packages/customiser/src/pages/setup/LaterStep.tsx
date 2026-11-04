/**
 * THE STEP DRAWN ELSEWHERE, AND THE PAGE WITH NO BASE YET.
 *
 * Preview opens the customer's editor, which comes with that editor. Until
 * then the step's body says what will be there, in the comp's own words.
 */
import type { ReactNode } from 'react';

import { Button, Card, EmptyState, Stack, type AddOnTranslate } from '../shared/host.ts';

export function LaterStep({ t, kind, onAdd }: { t: AddOnTranslate; kind: 'preview' | 'none'; onAdd?: () => void }): ReactNode {
  if (kind === 'none') {
    return (
      <EmptyState
        title={t('setup.none.title', 'Nothing is set up for customising yet')}
        body={t('setup.none.body', 'Start with a base: the page or the piece a customer makes their own. Then link the product to it in the shop app.')}
        actions={onAdd === undefined ? undefined : <Button onClick={onAdd}>{t('setup.newBase', 'New base')}</Button>}
      />
    );
  }
  return (
    <Card title={t('setup.preview.title', 'See it as a shopper')}>
      <Stack gap="md" align="start">
        <p className="m-0 text-[13px] leading-relaxed text-fg-muted">{t('setup.preview.body', 'Opens the customising screen exactly as shoppers get it, with your ready-made designs, areas, fonts and prices. Nothing you do there is ordered.')}</p>
        <Button disabled>{t('setup.preview.open', "Open the shopper's screen")}</Button>
        <p className="m-0 text-[12px] text-fg-subtle">{t('setup.preview.later', "The shopper's screen opens from here once it comes with the customer's editor.")}</p>
      </Stack>
    </Card>
  );
}
