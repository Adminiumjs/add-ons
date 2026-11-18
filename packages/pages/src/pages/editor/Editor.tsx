/**
 * THE EDITOR: one landing page, or a new one.
 *
 * A stand-in until the editor is built: it says which page was asked for and
 * leads back to the list.
 */
import type { ReactNode } from 'react';

import { EmptyState, Link, PageActions, PageSurface, type AddOnTranslate } from '../shared/host.ts';
import { listAt } from '../shared/paths.ts';

export function Editor({ t }: { t: AddOnTranslate; pageKey: string | null; milo: boolean }): ReactNode {
  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={t('editor.title', 'Page')} documentTitle={t('editor.title', 'Page')} backTo={listAt()} />
      <EmptyState title={t('editor.soon', 'The editor is not here yet')} actions={<Link to={listAt()}>{t('shared.backToList', 'Back to the landing pages')}</Link>} />
    </PageSurface>
  );
}
