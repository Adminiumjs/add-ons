/**
 * "PREVIEW" (comp 2j, 700-746): the form as a visitor gets it, drawn by
 * Adminium itself from the saved draft, in the language being edited, in a
 * 600-wide window. Nothing is sent from it.
 *
 * What is waiting to be saved is written first, so the preview shows what is
 * on screen. The window takes the focus, gives it back to the button when it
 * closes, and closes on Escape.
 */
import { useState, type ReactNode } from 'react';

import { Button, Dialog, DialogBody, DialogHeader, type AddOnTranslate } from '../shared/host.ts';
import type { FormRow } from '../shared/row.ts';
import { Icon } from './parts.tsx';
import { previewAddress } from './preview.ts';
import type { Builder } from './store.ts';

export function PreviewButton({ t, form, builder }: { t: AddOnTranslate; form: FormRow; builder: Builder }): ReactNode {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const show = async (): Promise<void> => {
    setOpening(true);
    try {
      await builder.flush();
    } finally {
      setOpening(false);
      setOpen(true);
    }
  };
  return (
    <>
      <Button variant="secondary" iconLeft={<Icon name="eye" />} loading={opening} onClick={() => void show()}>
        {t('builder.preview', 'Preview')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} size="md">
        <DialogHeader title={t('builder.preview', 'Preview')} subtitle={t('builder.preview.sub', 'How visitors see it. Nothing is sent from here.')} closeLabel={t('builder.preview.close', 'Close preview')} />
        <DialogBody>
          {open ? <iframe title={t('builder.preview.frame', 'The form as visitors see it')} src={previewAddress(window.location.origin, form.slug, builder.editing)} className="block h-[600px] w-full border-0" /> : null}
        </DialogBody>
      </Dialog>
    </>
  );
}
