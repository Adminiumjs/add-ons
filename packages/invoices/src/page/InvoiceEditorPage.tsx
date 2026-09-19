// SPDX-License-Identifier: AGPL-3.0-only
/**
 * `/invoices/$id` — the editor's route. Reads the document once and hands it
 * to the editor, keyed by id so a language switch mounts a fresh draft (O22
 * →: the draft is the editor's own from then on; a refetch never overwrites
 * it).
 */
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Spinner } from '@adminium/ui';

import { PageActions, PageSurface } from '@adminium/add-on-contracts/runtime/app';

import { t } from './messages.js';
import { Editor } from './editor/Editor.js';
import { invoiceQuery } from './queries.js';

export function InvoiceEditorPage({ id }: { id: string }) {
  const detail = useQuery(invoiceQuery(id));

  if (detail.isSuccess) return <Editor key={detail.data.id} detail={detail.data} />;

  return (
    <>
      <PageActions title={t('manager.title', 'Invoices')} backTo="/invoices" />
      <PageSurface width="content" testId="invoices-editor-loading">
        {detail.isError ? (
          <Alert
            role="alert"
            tone="danger"
            title={t('editor.loadFailed', 'Couldn’t load this document')}
            body={detail.error instanceof Error ? detail.error.message : undefined}
            action={
              <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          />
        ) : (
          <div className="flex justify-center py-20">
            <Spinner label={t('common.loading', 'Loading')} />
          </div>
        )}
      </PageSurface>
    </>
  );
}
