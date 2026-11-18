/**
 * DRAFT WITH MILO (comp 628-647 and 265-271; C31, D63).
 *
 * The person says what the page is for; Milo writes the sections, with the
 * business's own address and the live forms, and never a quote from a
 * customer. Every section it writes carries its mark ("Milo · check") until a
 * person looks at it: changing a section or checking it takes the mark off,
 * and "Looks right" takes every mark off at once. "Undo all" puts the page
 * back as it was before the draft. A page with a mark left is never
 * published: the editor says so, and Adminium refuses it besides.
 *
 * Milo only drafts: what it writes goes into the page's working copy, never
 * into its published one.
 */
import { useState, type ReactNode } from 'react';

import { asDataError, Button, Dialog, DialogBody, DialogFooter, DialogHeader, Field, Textarea, type AddOnTranslate, type DataError } from '../shared/host.ts';
import { Icon } from './Canvas.tsx';
import { draftOf, type Page } from './doc.ts';
import { askDraft, type LeftOut } from './engine.ts';
import { refusalWords } from './words.ts';

/** The longest description Milo is given. */
export const DESCRIPTION_MAX = 2000;

/** A draft refusal in words: the allowance, Milo not allowed, a draft it could not write. */
export function draftRefusal(t: AddOnTranslate, error: DataError): string {
  const reason = error.details?.['reason'];
  if (reason === 'allowance') return t('editor.milo.allowance', 'Your Milo allowance for today is used. Try again tomorrow.');
  if (reason === 'assistant-use') return t('editor.milo.notAllowed', 'You may not use Milo here. Ask whoever runs Adminium.');
  if (reason === 'draft-failed') return t('editor.milo.failed', 'Milo could not write a page from that. Try again, or describe the page in other words.');
  if (error.code === 'LANDING_DRAFT_FAILED') return t('editor.milo.failedAgain', 'Milo could not write a draft. Try again.');
  if (error.code === 'CONFLICT') return t('editor.milo.noService', 'No AI service can be used here yet.');
  return refusalWords(t, error);
}

export interface MiloDialogProps {
  t: AddOnTranslate;
  open: boolean;
  pageKey: string;
  language: string;
  title: string;
  onOpenChange: (open: boolean) => void;
  /** The draft, read as a page, and what Milo left out. */
  onDrafted: (page: Page, left: readonly LeftOut[]) => void;
}

export function MiloDialog({ t, open, pageKey, language, title, onOpenChange, onDrafted }: MiloDialogProps): ReactNode {
  const [description, setDescription] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const draft = async (): Promise<void> => {
    if (drafting || description.trim() === '') return;
    setDrafting(true);
    setRefused(null);
    try {
      const drafted = await askDraft({ description: description.trim(), language, pageKey });
      onDrafted(draftOf(drafted.page, title, language), drafted.left);
      setDescription('');
    } catch (caught) {
      setRefused(draftRefusal(t, asDataError(caught)));
    } finally {
      setDrafting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (drafting ? undefined : onOpenChange(next))} size="md">
      <DialogHeader title={t('editor.milo.title', 'Describe the page')} subtitle={t('editor.milo.subtitle', 'Milo drafts the sections. You check each one before you publish.')} closeLabel={t('editor.close', 'Close')} tone="accent" />
      <DialogBody>
        <div data-lpe-fields="">
          <Field label={t('editor.milo.label', 'What is the page for?')} hint={t('editor.milo.hint', 'Milo uses your business’s address and your live forms. It leaves out quotes from customers.')}>
            <Textarea value={description} rows={4} maxLength={DESCRIPTION_MAX} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          {refused === null ? null : (
            <p data-lpe-alert="" role="alert">
              <Icon name="circle-alert" />
              <span>{refused}</span>
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={drafting} onClick={() => onOpenChange(false)}>
          {t('editor.cancel', 'Cancel')}
        </Button>
        <span {...(drafting ? { 'data-lpe-busy': '' } : {})}>
          <Button variant="primary" iconLeft={<Icon name="sparkles" />} loading={drafting} disabled={description.trim() === ''} onClick={() => void draft()}>
            {drafting ? t('editor.milo.drafting', 'Drafting…') : t('editor.milo.draft', 'Draft it')}
          </Button>
        </span>
      </DialogFooter>
    </Dialog>
  );
}

/** The band over a page Milo wrote, while a mark is left on it. */
export function MiloBand({ t, left, mayEdit, onLooksRight, onUndoAll }: { t: AddOnTranslate; left: readonly LeftOut[]; mayEdit: boolean; onLooksRight: () => void; onUndoAll: () => void }): ReactNode {
  return (
    <div role="region" aria-label={t('editor.milo.band', 'Milo’s draft')} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-accent-soft p-3">
      <span data-lpe-tile="accent">
        <Icon name="sparkles" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-bold text-fg">{t('editor.milo.check', 'Milo wrote this page — check every block before you publish')}</span>
        {left.length > 0 ? <span className="text-[12px] text-fg-muted">{t('editor.milo.left', 'Milo left out quotes, links to other sites and anything it could not name for sure. Add them by hand if you want them.')}</span> : null}
      </span>
      {mayEdit ? (
        <span className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" iconLeft={<Icon name="undo-2" />} onClick={onUndoAll}>
            {t('editor.milo.undoAll', 'Undo all')}
          </Button>
          <Button variant="primary" size="sm" iconLeft={<Icon name="check" />} onClick={onLooksRight}>
            {t('editor.milo.looksRight', 'Looks right')}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
