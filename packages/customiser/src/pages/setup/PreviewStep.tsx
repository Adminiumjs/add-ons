/**
 * STEP 6, PREVIEW: the customising screen exactly as shoppers get it, with
 * the shop's ready-made designs, areas, fonts and prices, under a bar that
 * says nothing there is ordered (Birch Row D7; Marlow's "Preview as a
 * customer" from the design editor is the same screen).
 */
import { useState, type ReactNode } from 'react';

import { Button, Card, Stack, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { useDesignRows } from '../designs/data.ts';
import { CustomerPreview, previewEditor } from '../designs/preview.tsx';
import type { SetupData } from './data.ts';
import { kindOf, text } from './facts.ts';

export function PreviewStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const [open, setOpen] = useState(false);
  const rows = useDesignRows(base, data.designs);
  if (open) return <CustomerPreview t={t} base={base} data={data} rows={rows} draft={null} name={text(base['name'])} who={kindOf(base) === 'page' ? 'customer' : 'shopper'} onBack={() => setOpen(false)} />;
  return (
    <div data-part="customiser-preview-step">
    <Card title={t('setup.preview.title', 'See it as a shopper')}>
      <Stack gap="md" align="start">
        <p className="m-0 text-[13px] leading-relaxed text-fg-muted">{t('setup.preview.body', 'Opens the customising screen exactly as shoppers get it, with your ready-made designs, areas, fonts and prices. Nothing you do there is ordered.')}</p>
        <Button disabled={previewEditor() === null} onClick={() => setOpen(true)}>
          {t('setup.preview.open', "Open the shopper's screen")}
        </Button>
        {previewEditor() === null ? <p className="m-0 text-[12px] text-fg-subtle">{t('setup.preview.later', "The shopper's screen opens from here once it comes with the customer's editor.")}</p> : null}
      </Stack>
    </Card>
    </div>
  );
}
