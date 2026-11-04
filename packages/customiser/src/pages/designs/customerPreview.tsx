/**
 * THE CUSTOMER'S OWN EDITOR, OPENED ON THE SHOP'S SET-UP AS IT STANDS.
 *
 * "Preview as a customer" (a ready-made design in the shop's editor) and the
 * set-up's step 6, "See it as a shopper", open the very editor a shop app
 * mounts for its customers (`src/browser/`), in its preview mode: nothing
 * goes in a basket and nothing is saved, and it says so in the customer's
 * words.
 *
 * It is handed the shop's rows as the set-up holds them, read with the
 * staff's own rights: the base, its areas, the fonts, the finishes and the
 * priced features, and the ready-made designs — the one in the editor as it
 * is drawn now, unsaved changes and all, or every design the shop shows. A
 * file a customer would upload is read and measured in this browser and sent
 * nowhere. The editor's stylesheet is put into the page once.
 */
import { useEffect, useMemo, type ReactNode } from 'react';

import editorCss from '../../browser/editor.css?inline';
import type { CatalogueRows, CustomiserApi, Row } from '../../browser/api.ts';
import { CustomiserEditor } from '../../browser/ui/Editor.tsx';
import { useLocaleTag, type DataRow } from '../shared/host.ts';
import { fileAddress } from '../shared/stored.ts';
import type { SetupData } from '../setup/data.ts';
import { text } from '../setup/facts.ts';
import type { DesignRows } from './data.ts';
import { partValues, ROLES, type DesignDraft, type Role } from './draft.ts';
import type { PreviewEditorProps } from './preview.tsx';

/** The shop's rows as the customer's editor reads them: the design in the editor as it stands, or the designs the shop shows. */
export function previewRows(base: DataRow, data: SetupData, rows: DesignRows | null, design: DesignDraft | null, roleNames: Readonly<Record<Role, string>>): CatalogueRows {
  const app = text(base['app']) === '' ? null : text(base['app']);
  const shared = [...(data.finishPalette === null ? [] : [data.finishPalette]), ...(rows?.appPalettes ?? [])];
  const sharedColours = [...data.finishes, ...(rows?.colours ?? []).filter((one) => (rows?.appPalettes ?? []).some((palette) => String(palette['id']) === String(one['palette_id'])))];
  const common = { bases: [base as Row], pieces: [], areas: [...data.areas], fonts: [...data.fonts], features: [...data.features], settings: data.settings === null ? [] : [data.settings] };
  if (design === null) {
    const ready = data.designs.filter((one) => one['state'] === 'published');
    const shown = (one: DataRow): boolean => ready.some((row) => String(row['id']) === String(one['ready_design_id']));
    const palettes = (rows?.palettes ?? []).filter(shown);
    return { ...common, ready: [...ready], parts: (rows?.parts ?? []).filter(shown), palettes: [...palettes, ...shared], colours: [...(rows?.colours ?? []).filter((one) => palettes.some((palette) => String(palette['id']) === String(one['palette_id']))), ...sharedColours] };
  }
  const ready = { id: design.id, app, base_id: base['id'], name: design.name, tags: design.tags, layouts: design.layouts.map((one) => ({ key: one.key, name: one.name })), state: 'published', position: 0 };
  const parts = design.parts.map((part, index) => ({ id: part.id ?? `preview-part-${String(index)}`, ...partValues(part, { id: design.id, app }, index) }));
  const palettes = design.palettes.map((one, index) => ({ id: `preview-palette-${one.key}`, app, ready_design_id: design.id, kind: 'colours', code: one.code, name: one.name, position: index }));
  const colours = design.palettes.flatMap((one) => ROLES.map((role, index) => ({ id: `preview-colour-${one.key}-${role}`, app, palette_id: `preview-palette-${one.key}`, code: role, role, name: roleNames[role], hex: one.colours[role], position: index })));
  return { ...common, ready: [ready], parts, palettes: [...palettes, ...shared], colours: [...colours, ...sharedColours] };
}

let held = 0;

/** What the editor asks of Adminium, answered from the rows in hand: it saves nothing, and keeps a customer's file in this browser. */
export function previewApi(rows: CatalogueRows): CustomiserApi {
  const never = (): Promise<never> => Promise.reject(Object.assign(new Error('A preview saves nothing.'), { code: 'PREVIEW' }));
  return {
    catalogue: async () => rows,
    fontUrl: async () => null,
    // The piece's outline as the shop stored it, so the preview's 3D piece is the one shoppers turn.
    outlineUrl: async (base: Row) => fileAddress(base['outline_file']),
    create: never,
    change: never,
    openLink: async () => 'unknown',
    reopen: async () => null,
    byCodes: async () => [],
    upload: async (_column, file, name) => ({ id: `preview-file-${String((held += 1))}`, name, size: file.size, kind: '' }),
    file: async () => null,
  };
}

/** The editor's look in the page, once: the dashboard's own colours and type run through its variables. */
function useEditorStyles(): void {
  useEffect(() => {
    if (typeof document === 'undefined' || document.querySelector('style[data-customiser-editor]') !== null) return;
    const style = document.createElement('style');
    style.setAttribute('data-customiser-editor', '');
    style.textContent = typeof editorCss === 'string' ? editorCss : '';
    document.head.appendChild(style);
  }, []);
}

/**
 * The editor the preview mounts (`showCustomerEditor`). Its own "Add to
 * basket" and "Save and come back" say, in the customer's words, that a
 * preview does neither; the page's handlers are for an editor that does not.
 */
export function CustomerEditorPreview({ base, data, rows, design, shop, roleNames }: PreviewEditorProps): ReactNode {
  useEditorStyles();
  const locale = useLocaleTag();
  const catalogue = useMemo(() => previewRows(base, data, rows, design, roleNames), [base, data, rows, design, roleNames]);
  // A new design drawn in the editor is a new preview: the editor reads its catalogue once.
  const api = useMemo(() => previewApi(catalogue), [catalogue]);
  const sides = Number(base['sides'] ?? 1) >= 2 ? 2 : 1;
  return (
    <CustomiserEditor
      api={api}
      base={base['id'] as string | number}
      product={{ name: text(base['name']) }}
      shop={shop}
      locale={locale}
      sides={sides}
      preview
      {...(design === null ? {} : { readyDesigns: [design.id], design: { base_id: base['id'] as string | number, ready_design_id: design.id, values: { parts: {}, ...(sides === 2 ? { sides: 2 } : {}) } } })}
      onAddToBasket={() => {}}
    />
  );
}
