/**
 * "PREVIEW AS A CUSTOMER": the customer's own editor, opened on the design
 * the shop is making, or on every design it shows (the set-up's step 6),
 * under a bar that says it is a preview.
 *
 * The customer's editor is the add-on's browser part, mounted here by the
 * page (`showCustomerEditor`, `../customiser/index.tsx`); a screen built
 * without it has nothing to open, and its buttons say so. A preview puts
 * nothing in a basket and saves nothing: its "Add to basket" and "Save" only
 * say so (Birch Row D7, Marlow D2).
 */
import type { ComponentType, ReactNode } from 'react';

import { Button, lucideByName, Stack, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from '../setup/data.ts';
import type { DesignRows } from './data.ts';
import type { DesignDraft, Role } from './draft.ts';

/** What the customer's editor is handed for a preview. */
export interface PreviewEditorProps {
  base: DataRow;
  /** The set-up's rows: the base's areas, the fonts, the finishes, the priced features. */
  data: SetupData;
  /** The designs' parts and palettes, where the preview shows every design the shop shows. */
  rows: DesignRows | null;
  /** The design in the shop's editor as it is drawn now; none to show every design the shop shows. */
  design: DesignDraft | null;
  /** How the shop is named to its customer. */
  shop: string;
  roleNames: Readonly<Record<Role, string>>;
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

export function CustomerPreview({ t, base, data, rows, draft, name, who, onBack }: { t: AddOnTranslate; base: DataRow; data: SetupData; rows: DesignRows | null; draft: DesignDraft | null; name: string; who: 'customer' | 'shopper'; onBack: () => void }): ReactNode {
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
          data={data}
          rows={rows}
          design={draft}
          shop={t('designs.previewing.theShop', 'the shop')}
          roleNames={{ paper: t('designs.role.paper', 'Paper'), ink: t('designs.role.ink', 'Ink'), accent: t('designs.role.accent', 'Accent') }}
          onAddToBasket={() => toast(who === 'customer' ? t('designs.previewing.noBasket', 'You’re previewing as a customer — nothing goes in a basket.') : t('designs.previewing.noBasketShop', 'Previewing — nothing goes in a real basket.'), 'info')}
          onSave={() => toast(who === 'customer' ? t('designs.previewing.noSave', 'You’re previewing as a customer — nothing is saved.') : t('designs.previewing.noSaveShop', 'Previewing — saving is switched off here.'), 'info')}
        />
      )}
    </Stack>
  );
}
