/**
 * "PREVIEW AS A CUSTOMER": the customer's own editor, opened on the design
 * the shop is making, under a bar that says it is a preview.
 *
 * The customer's editor is the add-on's browser part, built beside this
 * screen. Until it is mounted here (`showCustomerEditor`), there is nothing
 * to open: the buttons that would open it are switched off, and say why.
 * Once it is, a preview puts nothing in a basket and saves nothing: its
 * "Add to basket" and "Save" only say so (Birch Row D7, Marlow D2).
 */
import type { ComponentType, ReactNode } from 'react';

import { Button, lucideByName, Stack, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { useToast } from '../shared/toast.ts';
import type { DesignDraft } from './draft.ts';

/** What the customer's editor is handed for a preview. */
export interface PreviewEditorProps {
  base: DataRow;
  design: DesignDraft;
  /** "Add to basket", in a preview: nothing is added. */
  onAddToBasket: () => void;
  /** "Save and come back", in a preview: nothing is saved. */
  onSave: () => void;
}

let mounted: ComponentType<PreviewEditorProps> | null = null;
/** The customer's editor the preview opens, once it is mounted; none until then. */
export const previewEditor = (): ComponentType<PreviewEditorProps> | null => mounted;
/** Mounts the customer's editor for the preview (none takes it away). */
export function showCustomerEditor(editor: ComponentType<PreviewEditorProps> | null): void {
  mounted = editor;
}

const EyeIcon = lucideByName('eye');
const Back = lucideByName('arrow-left');

export function CustomerPreview({ t, base, draft, name, who, onBack }: { t: AddOnTranslate; base: DataRow; draft: DesignDraft; name: string; who: 'customer' | 'shopper'; onBack: () => void }): ReactNode {
  const Editor = mounted;
  const toast = useToast();
  return (
    <Stack gap="md">
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-bg">
        <EyeIcon />
        <span className="text-[13px] font-extrabold">{who === 'customer' ? t('designs.previewing.customer', 'Previewing as a customer') : t('designs.previewing.shopper', 'Previewing as a shopper')}</span>
        <span className="text-[12.5px]">{who === 'customer' ? t('designs.previewing.whatPage', '{name} · nothing here reaches a basket', { name }) : name}</span>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" iconLeft={<Back />} onClick={onBack}>
          {who === 'customer' ? t('designs.previewing.backEditor', 'Back to the design editor') : t('designs.previewing.backSetup', 'Back to set-up')}
        </Button>
      </div>
      {Editor === null ? null : (
        <Editor
          base={base}
          design={draft}
          onAddToBasket={() => toast(who === 'customer' ? t('designs.previewing.noBasket', 'You’re previewing as a customer — nothing goes in a basket.') : t('designs.previewing.noBasketShop', 'Previewing — nothing goes in a real basket.'), 'info')}
          onSave={() => toast(who === 'customer' ? t('designs.previewing.noSave', 'You’re previewing as a customer — nothing is saved.') : t('designs.previewing.noSaveShop', 'Previewing — saving is switched off here.'), 'info')}
        />
      )}
    </Stack>
  );
}
