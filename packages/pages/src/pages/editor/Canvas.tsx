/**
 * THE CANVAS (comp 255-401, `States` 700-731): the page drawn by the same
 * renderer that draws it for a stranger, in its `canvas` mode, at desktop
 * width or at a phone's 390.
 *
 * - Each section is a group with one "Edit {kind}" button (the renderer's);
 *   a click anywhere on a section selects it too. The selected section gets
 *   the editor's ring (`styles.ts`) and its kind in a chip at its head.
 * - A section Milo wrote and nobody looked at yet shows "Milo · check".
 * - While the picker is open, a dashed line says where the new section goes.
 * - A picture shows the page's own copy, read through the engine; a form
 *   shows a stand-in with its name, since the real form is the stranger's.
 * - Words not written yet show what to do, on the canvas only: the draft
 *   keeps them empty, so an empty section is never published as a hint.
 * - Preview draws the page as visitors see it: no buttons, no chips, no ring.
 *
 * The chips and the line are put inside each section's own element through a
 * portal, after the renderer has drawn it, so they sit on the section they
 * belong to at any width.
 */
import { LandingPageView } from '@adminium/add-on-contracts/landing/render';
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { lucideByName, type AddOnTranslate } from '../shared/host.ts';
import type { Block, Page } from './doc.ts';
import { pictureSrc, type LiveForm } from './engine.ts';
import { kindName } from './kinds.ts';
import { isRightToLeft } from './row.ts';
import { selectionRule } from './styles.ts';

export const Icon = ({ name }: { name: string }): ReactNode => {
  const Found = lucideByName(name);
  return <Found className="size-4" aria-hidden="true" />;
};

/** The page as the canvas draws it: what is not written yet says what goes there. */
export function canvasCopy(page: Page, hint: (block: Block) => string): Page {
  const fill = (text: string, block: Block): string => (text.trim() === '' ? hint(block) : text);
  return {
    ...page,
    blocks: page.blocks.map((block): Block => {
      switch (block.kind) {
        case 'hero':
          return { ...block, heading: fill(block.heading, block), ...(block.button === undefined ? {} : { button: { ...block.button, label: fill(block.button.label, block) } }) };
        case 'heading':
        case 'text':
          return { ...block, text: fill(block.text, block) };
        case 'button':
          return { ...block, label: fill(block.label, block) };
        case 'quote':
          return { ...block, text: fill(block.text, block) };
        case 'columns':
          return { ...block, columns: block.columns.map((one, index) => (index === 0 ? { ...one, text: fill(one.text, block) } : one)) };
        case 'features':
          return { ...block, items: block.items.map((item, index) => (index === 0 ? { ...item, heading: fill(item.heading, block) } : item)) };
        case 'questions':
          return { ...block, items: block.items.map((item, index) => (index === 0 ? { ...item, question: fill(item.question, block) } : item)) };
        default:
          return block;
      }
    }),
  };
}

export interface CanvasProps {
  t: AddOnTranslate;
  pageKey: string;
  page: Page;
  language: string;
  width: 'desktop' | 'phone';
  preview: boolean;
  selected: string | null;
  /** The section a new one goes after while the picker is open; `end` at the end; null while it is shut. */
  gapAfter: string | 'end' | null;
  forms: readonly LiveForm[];
  onSelect: (id: string) => void;
}

export function Canvas({ t, pageKey, page, language, width, preview, selected, gapAfter, forms, onSelect }: CanvasProps): ReactNode {
  const frame = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<ReadonlyMap<string, HTMLElement>>(new Map());

  // After each draw, find each section's element, so the chips can be put inside it.
  useLayoutEffect(() => {
    const found = new Map<string, HTMLElement>();
    for (const element of frame.current?.querySelectorAll<HTMLElement>('[data-block-id]') ?? []) found.set(element.dataset['blockId'] ?? '', element);
    const same = found.size === anchors.size && [...found].every(([id, element]) => anchors.get(id) === element);
    if (!same) setAnchors(found);
  });

  const hint = (block: Block): string => t('editor.canvas.new', 'New {kind}: fill it in from the inspector.', { kind: kindName(t, block.kind).toLocaleLowerCase() });
  const drawn = preview ? page : canvasCopy(page, hint);
  const last = page.blocks.at(-1)?.id ?? null;
  const gapOn = gapAfter === 'end' ? last : gapAfter;

  const select = (event: MouseEvent<HTMLDivElement>): void => {
    if (preview) return;
    const target = event.target as HTMLElement;
    const section = target.closest<HTMLElement>('[data-block-id]');
    // A question opens and shuts on its own; a click on it still selects its section.
    if (section !== null) onSelect(section.dataset['blockId'] ?? '');
  };

  return (
    <div data-lpe-frame-wrap="" data-lpe-width={width}>
      <style>{preview ? '' : selectionRule(selected)}</style>
      <div ref={frame} data-lpe-frame="" data-lpe-width={width} {...(preview ? { 'data-lpe-preview': '' } : {})} onClickCapture={select}>
        <LandingPageView
          page={drawn}
          language={language}
          dir={isRightToLeft(language) ? 'rtl' : 'ltr'}
          mode="canvas"
          words={{ edit: (kind) => t('editor.canvas.edit', 'Edit {kind}', { kind: kindName(t, kind) }) }}
          onEdit={(id) => onSelect(id)}
          slots={{
            picture: (ref, { decorative, alt }) =>
              ref.file === '' ? (
                <span data-lpe-placeholder="">
                  <Icon name="image" />
                  {t('editor.canvas.noPicture', 'No picture yet')}
                </span>
              ) : (
                <img src={pictureSrc(pageKey, ref.file)} alt={decorative ? '' : alt} />
              ),
            icon: (name) => <Icon name={name} />,
            form: (block) => {
              const form = forms.find((one) => one.key === block.form && one.addOn === block.addOn);
              return (
                <span data-lpe-form="">
                  <Icon name="file-text" />
                  <strong>{form?.name ?? t('editor.canvas.noForm', 'Choose a form')}</strong>
                  <span>{form === undefined ? t('editor.canvas.noFormLine', 'Pick one of your live forms in the inspector.') : t('editor.canvas.formLine', 'Visitors fill in this form on the page.')}</span>
                </span>
              );
            },
            pageHref: () => null,
          }}
        />
      </div>
      {preview
        ? null
        : page.blocks.map((block) => {
            const anchor = anchors.get(block.id);
            if (anchor === undefined) return null;
            return createPortal(
              <>
                {block.id === selected ? <span data-lpe-chip="kind">{kindName(t, block.kind)}</span> : null}
                {block.milo === true ? (
                  <span data-lpe-chip="milo">
                    <Icon name="sparkles" />
                    {t('editor.canvas.milo', 'Milo · check')}
                  </span>
                ) : null}
                {block.id === gapOn ? <span data-lpe-gap="">{t('editor.canvas.gap', 'New section goes here')}</span> : null}
              </>,
              anchor,
              block.id,
            );
          })}
    </div>
  );
}
