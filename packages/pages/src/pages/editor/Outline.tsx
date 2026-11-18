/**
 * THE SECTIONS (comp `States` 641-665, 742-761): the page's fixed parts and
 * its sections in order, in the inspector at desktop width and in a sheet on
 * a phone.
 *
 * - "Page settings" opens the page's own settings; the page's header and
 *   footer are the shell's, drawn on every page and locked here.
 * - Each section has "Move up" and "Move down" (no dragging: a keyboard and a
 *   screen reader move a section the same way a mouse does). After a move the
 *   new place is said ("Features moved to 3 of 6.") and the focus stays on the
 *   moved section's button, wherever it went.
 * - A section Milo wrote and nobody looked at yet has a sparkle.
 * - "Add a section" opens the picker for the end of the page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { AddOnTranslate } from '../shared/host.ts';
import { move, type Page } from './doc.ts';
import { Icon } from './Canvas.tsx';
import { KIND_ICON, kindName } from './kinds.ts';

export interface OutlineProps {
  t: AddOnTranslate;
  page: Page;
  selected: string | null;
  mayEdit: boolean;
  /** In a sheet on a phone: 44 px buttons. */
  inSheet?: boolean;
  /** The form names, for a Form section's row ("Form · Book a showroom visit"). */
  formName: (block: string) => string | null;
  onSelect: (id: string) => void;
  onPageSettings: () => void;
  onAdd: () => void;
  onMove: (next: Page, words: string) => void;
}

export function Outline({ t, page, selected, mayEdit, inSheet = false, formName, onSelect, onPageSettings, onAdd, onMove }: OutlineProps): ReactNode {
  const [said, setSaid] = useState('');
  const focus = useRef<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // After a move, the focus stays on the moved section's button: the one it was on, or the other at an end.
  useEffect(() => {
    const wanted = focus.current;
    if (wanted === null) return;
    focus.current = null;
    list.current?.querySelector<HTMLButtonElement>(`[data-lpe-move="${wanted}"]`)?.focus();
  });

  const shift = (id: string, by: -1 | 1, name: string): void => {
    const next = move(page, id, by);
    const at = next.blocks.findIndex((block) => block.id === id);
    const edge = at === 0 || at === next.blocks.length - 1;
    focus.current = `${id}-${(by < 0) !== edge ? 'up' : 'down'}`;
    const words = t('editor.outline.moved', '{name} moved to {place} of {count}.', { name, place: at + 1, count: next.blocks.length });
    setSaid(words);
    onMove(next, words);
  };

  return (
    <div data-lpe-fields="" {...(inSheet ? { 'data-lpe-sheet': '' } : {})}>
      <div className="flex flex-col gap-1.5">
        <span data-lpe-micro="">{t('editor.outline.fixed', 'Fixed')}</span>
        <div data-lpe-row="">
          <button type="button" data-lpe-pick="" onClick={onPageSettings}>
            <Icon name="globe" />
            <span>{t('editor.outline.settings', 'Page settings')}</span>
          </button>
          <span className="rtl:-scale-x-100">
            <Icon name="chevron-right" />
          </span>
        </div>
        <div data-lpe-row="" data-lpe-locked="" title={t('editor.outline.locked', 'Locked')}>
          <Icon name="panel-top" />
          <span className="flex-1">{t('editor.outline.header', 'Page header')}</span>
          <Icon name="lock" />
        </div>
        <div data-lpe-row="" data-lpe-locked="" title={t('editor.outline.locked', 'Locked')}>
          <Icon name="panel-bottom" />
          <span className="flex-1">{t('editor.outline.footer', 'Page footer')}</span>
          <Icon name="lock" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span data-lpe-micro="">{t('editor.outline.sections', 'Sections')}</span>
        {page.blocks.length === 0 ? <span className="text-[12.5px] text-fg-subtle">{t('editor.outline.none', 'No sections yet.')}</span> : null}
        <ol ref={list} data-lpe-rows="">
          {page.blocks.map((block, index) => {
            const kind = kindName(t, block.kind);
            const form = block.kind === 'form' ? formName(block.id) : null;
            const label = form === null ? kind : `${kind} · ${form}`;
            const first = index === 0;
            const last = index === page.blocks.length - 1;
            return (
              <li key={block.id} data-lpe-row="" {...(block.id === selected ? { 'data-lpe-on': '' } : {})}>
                <button type="button" data-lpe-pick="" aria-pressed={block.id === selected} onClick={() => onSelect(block.id)}>
                  <Icon name={KIND_ICON[block.kind]} />
                  <span>{label}</span>
                </button>
                {block.milo === true ? (
                  <span title={t('editor.outline.milo', 'Written by Milo')} className="text-accent">
                    <Icon name="sparkles" />
                    <span className="sr-only">{t('editor.outline.milo', 'Written by Milo')}</span>
                  </span>
                ) : null}
                {mayEdit ? (
                  <>
                    <button type="button" data-lpe-move={`${block.id}-up`} aria-label={t('editor.outline.up', 'Move {name} up', { name: kind })} title={t('editor.outline.upTitle', 'Move up')} aria-disabled={first} onClick={() => (first ? undefined : shift(block.id, -1, kind))}>
                      <Icon name="arrow-up" />
                    </button>
                    <button type="button" data-lpe-move={`${block.id}-down`} aria-label={t('editor.outline.down', 'Move {name} down', { name: kind })} title={t('editor.outline.downTitle', 'Move down')} aria-disabled={last} onClick={() => (last ? undefined : shift(block.id, 1, kind))}>
                      <Icon name="arrow-down" />
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p role="status" aria-live="polite" className="sr-only">
          {said}
        </p>
        {mayEdit ? (
          <button type="button" data-lpe-add="" onClick={onAdd}>
            <Icon name="plus" />
            {t('editor.outline.add', 'Add a section')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
