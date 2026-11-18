/**
 * ADD A SECTION (comp 584-626, `States` 764-773; D-M6-3, build note 10).
 *
 * Two groups: "Content" (Hero first) and "Action" (Form). No Pay link, no
 * Footer, never code. A page may hold any number of sections of a kind. The
 * line under the title says where the new section goes, from where the picker
 * was opened: after the selected section, or at the end of the page.
 */
import type { LandingBlockKind } from '@adminium/add-on-contracts/landing';
import type { ReactNode } from 'react';

import { Dialog, DialogBody, DialogHeader, type AddOnTranslate } from '../shared/host.ts';
import { Icon } from './Canvas.tsx';
import { ACTION_KINDS, CONTENT_KINDS, KIND_ICON, kindHint, kindName } from './kinds.ts';

export interface PickerProps {
  t: AddOnTranslate;
  open: boolean;
  /** The kind of the section the new one goes after; null at the end of an empty page. */
  afterKind: LandingBlockKind | null;
  /** The new one goes at the end of the page. */
  atEnd: boolean;
  full: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (kind: LandingBlockKind) => void;
}

export function Picker({ t, open, afterKind, atEnd, full, onOpenChange, onPick }: PickerProps): ReactNode {
  const where = atEnd || afterKind === null ? t('editor.picker.end', 'Goes at the end of the page') : t('editor.picker.after', 'Goes after {kind}', { kind: kindName(t, afterKind) });
  const group = (title: string, kinds: readonly LandingBlockKind[]): ReactNode => (
    <div role="group" aria-label={title} className="flex flex-col gap-1.5">
      <span data-lpe-micro="" aria-hidden="true">
        {title}
      </span>
      <div data-lpe-cards="">
        {kinds.map((kind) => (
          <button key={kind} type="button" data-lpe-card="" disabled={full} onClick={() => onPick(kind)}>
            <span>
              <Icon name={KIND_ICON[kind]} />
            </span>
            <span>
              <b>{kindName(t, kind)}</b>
              <small>{kindHint(t, kind)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg">
      <DialogHeader title={t('editor.picker.title', 'Add a section')} subtitle={where} closeLabel={t('editor.close', 'Close')} tone="accent" />
      <DialogBody>
        <div className="flex flex-col gap-4">
          {full ? <p data-lpe-alert="">{t('editor.picker.full', 'A page holds at most 60 sections.')}</p> : null}
          {group(t('editor.picker.content', 'Content'), CONTENT_KINDS)}
          {group(t('editor.picker.action', 'Action'), ACTION_KINDS)}
        </div>
      </DialogBody>
    </Dialog>
  );
}
