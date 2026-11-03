/**
 * THE LANGUAGE BUTTON AND ITS POPOVER (comp 185-200, 1117-1128).
 *
 * One row per language a form may be written in: the ones the form has
 * first, in its order, then the others. A row of the form's says where its
 * words stand and switches the builder to editing it; a row of another
 * language adds it, its words starting as the form's own language's. Under
 * the rows, for the language being edited when it is not the form's own:
 * make it the form's own (the one listed first, the one a visitor gets by
 * default), or take it away.
 *
 * The popover takes the focus when it opens and gives it back to the button
 * when it closes; Escape closes it; the arrow keys move between its rows.
 */
import { FORM_LANGUAGES } from '@adminium/add-on-contracts/forms';
import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { Badge, Button, Dialog, DialogBody, DialogFooter, DialogHeader, Popover, PopoverContent, PopoverTrigger, type AddOnTranslate } from '../shared/host.ts';
import { isRightToLeft, languageName } from '../shared/languages.ts';
import { codeOf } from '../shared/row.ts';
import { useToast } from '../shared/toast.ts';
import { addLanguage, makeDefault, removeLanguage, translationOf, type Lang } from './draft.ts';
import { Icon, MicroTitle } from './parts.tsx';
import type { Builder } from './store.ts';

/** Move the focus between the popover's buttons with the arrow keys. */
function arrows(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
  if (buttons.length === 0) return;
  event.preventDefault();
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

function Chip({ lang, created }: { lang: Lang; created: boolean }): ReactNode {
  return created ? (
    <span className="inline-flex h-[22px] min-w-8 shrink-0 items-center justify-center rounded-md border border-border-strong px-1.5 font-mono text-[10.5px] font-bold text-fg-muted">{codeOf(lang)}</span>
  ) : (
    <span className="inline-flex h-[22px] min-w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong px-1.5 font-mono text-[10.5px] font-bold text-fg-muted">{codeOf(lang)}</span>
  );
}

export function LanguageMenu({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Lang | null>(null);
  const d = builder.draft.definition;
  const editing = builder.editing;
  const order = [...d.languages, ...FORM_LANGUAGES.filter((lang) => !d.languages.includes(lang))];

  const row = (lang: Lang): ReactNode => {
    const created = d.languages.includes(lang);
    const stands = created ? translationOf(d, lang) : null;
    const [status, tag, tone] =
      lang === editing
        ? [t('builder.lang.editing', 'Editing now'), t('builder.lang.current', 'Current'), 'info' as const]
        : !created
          ? [t('builder.lang.notYet', 'Not created yet'), t('builder.lang.add', 'Add'), 'pos' as const]
          : stands === 'done'
            ? [t('builder.lang.translated', 'Translated'), t('builder.lang.edit', 'Edit'), 'neutral' as const]
            : [t('builder.lang.needs', 'Needs translation'), t('builder.lang.edit', 'Edit'), 'warn' as const];
    const pick = (): void => {
      if (created) {
        builder.setEditing(lang);
        setOpen(false);
        return;
      }
      builder.change((draft) => ({ ...draft, definition: addLanguage(draft.definition, lang) }));
      toast(t('builder.lang.added', '{language} added. It needs translating.', { language: languageName(lang) }));
    };
    return (
      <button key={lang} type="button" onClick={pick} disabled={!created && !mayEdit} aria-current={lang === editing ? 'true' : undefined} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start hover:bg-surface-3">
        <Chip lang={lang} created={created} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span lang={lang} dir={isRightToLeft(lang) ? 'rtl' : 'ltr'} className="text-start text-[13px] font-bold">
            {languageName(lang)}
          </span>
          <span className="text-[11.5px] text-fg-subtle">{status}</span>
        </span>
        <Badge tone={tone}>{tag}</Badge>
      </button>
    );
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" iconLeft={<Icon name="languages" />} aria-label={t('builder.languages', 'Language variations')}>
            <span className="inline-flex items-center gap-2">
              <span lang={editing}>{languageName(editing)}</span>
              <span className="font-mono text-caption text-fg-muted">{String(d.languages.length)}</span>
              <Icon name="chevron-down" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-label={t('builder.languages', 'Language variations')}>
          <div className="flex w-[290px] max-w-full flex-col gap-0.5" onKeyDown={arrows}>
            <MicroTitle>{t('builder.languages', 'Language variations')}</MicroTitle>
            {order.map(row)}
            {mayEdit && editing !== d.defaultLanguage ? (
              <span className="flex flex-col gap-0.5 border-t border-border pt-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-body-sm font-semibold hover:bg-surface-3"
                  onClick={() => {
                    builder.change((draft) => ({ ...draft, definition: makeDefault(draft.definition, editing) }));
                    toast(t('builder.lang.madeDefault', '{language} is now the form’s own language.', { language: languageName(editing) }));
                    setOpen(false);
                  }}
                >
                  <Icon name="star" />
                  {t('builder.lang.makeDefault', 'Make {language} the form’s own language', { language: languageName(editing) })}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-body-sm font-semibold text-danger hover:bg-surface-3"
                  onClick={() => {
                    setRemoving(editing);
                    setOpen(false);
                  }}
                >
                  <Icon name="trash-2" />
                  {t('builder.lang.remove', 'Remove {language}', { language: languageName(editing) })}
                </button>
              </span>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={removing !== null} onOpenChange={(next) => (next ? undefined : setRemoving(null))} size="sm">
        <DialogHeader title={t('builder.lang.removeTitle', 'Remove {language}?', { language: removing === null ? '' : languageName(removing) })} closeLabel={t('shared.close', 'Close')} tone="danger" />
        <DialogBody>
          <span className="text-body text-fg-muted">{t('builder.lang.removeBody', 'Every word written in it is removed from this form. Answers already sent in it stay.')}</span>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (removing === null) return;
              const gone = removing;
              builder.change((draft) => ({ ...draft, definition: removeLanguage(draft.definition, gone) }));
              builder.setEditing(d.defaultLanguage);
              setRemoving(null);
              toast(t('builder.lang.removed', '{language} removed.', { language: languageName(gone) }));
            }}
          >
            {t('builder.lang.removeConfirm', 'Remove')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
