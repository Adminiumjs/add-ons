/**
 * THE ANSWERS (comp 3a–3c "Answers" card and its dialog).
 *
 * Each answer is a question, other ways people ask it, and the answer sent
 * exactly as written, in one version per language: the dialog edits one
 * language at a time through the language menu, Forms' own pattern. A row
 * shows which of the chat's languages it is written in, and which still
 * need a version.
 *
 * Every answer is public text: anyone chatting may be shown it, and
 * the dialog says so. Delete happens at once, with Undo on the toast.
 */
import { useState, type ReactNode } from 'react';

import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, Popover, PopoverContent, PopoverTrigger, asDataError, useAppToasts, useWrite, type AddOnTranslate, type DataValue } from '../shared/host.ts';
import { isRightToLeft, languageName } from '../shared/languages.ts';
import { Icon, MicroTitle } from '../shared/parts.tsx';
import { refusal } from '../shared/refusal.ts';
import { written, type Answer, type Version } from '../shared/rows.ts';
import { Segs } from '../shared/Segs.tsx';
import { useToast } from '../shared/toast.ts';
import { Section, SectionTitle } from './parts.tsx';

/** How long the toast with Undo stays: the comp's 5.2 seconds. */
export const UNDO_MS = 5200;

/** A language's short code, as the rows show it: "EN", "DE"; Chinese by its region, "ZH-CN". */
export const codeOf = (tag: string): string => (tag.startsWith('zh-') ? tag : (tag.split('-')[0] ?? tag)).toUpperCase();

/** A fresh, unique reference for a new answer: Adminium's answerer picks answers by it. */
export function newRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `answer-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

interface Editing {
  /** The answer changed, or null for a new one. */
  answer: Answer | null;
  versions: Record<string, Version>;
  language: string;
  error: string;
}

const blank = (): Version => ({ title: '', text: '', examples: [] });

function LanguageMenu({ t, editing, languages, onPick }: { t: AddOnTranslate; editing: Editing; languages: readonly string[]; onPick: (language: string) => void }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="languages" />} aria-label={t('answers.languages', 'Language variations')}>
          <span lang={editing.language}>{languageName(editing.language)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={t('answers.languages', 'Language variations')}>
        <div className="flex w-[290px] max-w-full flex-col gap-0.5">
          <MicroTitle>{t('answers.languages', 'Language variations')}</MicroTitle>
          {languages.map((language) => (
            <button
              key={language}
              type="button"
              aria-current={language === editing.language ? 'true' : undefined}
              onClick={() => {
                onPick(language);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start hover:bg-surface-3"
            >
              <span className="inline-flex h-[22px] min-w-8 shrink-0 items-center justify-center rounded-md border border-border-strong px-1.5 font-mono text-[10.5px] font-bold text-fg-muted">{codeOf(language)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={language} dir={isRightToLeft(language) ? 'rtl' : 'ltr'} className="text-start text-[13px] font-bold">
                  {languageName(language)}
                </span>
                {written(editing.versions[language]) ? <span className="text-[11.5px] text-pos">{t('answers.done', 'Done')}</span> : <span className="text-[11.5px] text-warn">{t('answers.needs', 'Needs translation')}</span>}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Answers({ t, answers, defaultLanguage, languages, mayEdit, onChanged }: { t: AddOnTranslate; answers: readonly Answer[]; defaultLanguage: string; languages: readonly string[]; mayEdit: boolean; onChanged: () => void }): ReactNode {
  const write = useWrite('answers');
  const toast = useToast();
  const toasts = useAppToasts();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);

  const offered = [...new Set([defaultLanguage, ...languages, ...answers.flatMap((answer) => Object.keys(answer.versions))])];
  const sorted = [...answers].sort((a, b) => a.position - b.position || Number(a.id) - Number(b.id));
  const titleOf = (answer: Answer): string => (answer.versions[defaultLanguage] ?? Object.values(answer.versions)[0])?.title ?? answer.ref;

  const open = (answer: Answer | null): void => setEditing({ answer, versions: answer === null ? { [defaultLanguage]: blank() } : structuredClone(answer.versions), language: defaultLanguage, error: '' });
  const version = editing === null ? blank() : (editing.versions[editing.language] ?? blank());
  const change = (next: Partial<Version>): void => setEditing((was) => (was === null ? was : { ...was, error: '', versions: { ...was.versions, [was.language]: { ...(was.versions[was.language] ?? blank()), ...next } } }));

  const save = async (): Promise<void> => {
    if (editing === null) return;
    const kept = Object.fromEntries(
      Object.entries(editing.versions)
        .map(([language, one]) => [language, { title: one.title.trim(), text: one.text.trim(), examples: one.examples.map((example) => example.trim()).filter((example) => example !== '') }] as const)
        .filter(([, one]) => one.title !== '' || one.text !== ''),
    );
    // The default language's version is the one the answerer reads: it must be whole.
    const own = kept[defaultLanguage];
    if (own === undefined || own.title === '' || own.text === '' || Object.values(kept).some((one) => one.title === '' || one.text === '')) {
      setEditing({ ...editing, error: t('answers.dialog.error', 'Write the question and the answer.') });
      return;
    }
    setSaving(true);
    try {
      if (editing.answer === null) {
        const position = sorted.reduce((most, answer) => Math.max(most, answer.position), 0) + 1;
        await write.create({ ref: newRef(), versions: kept as unknown as DataValue, active: true, position });
        toast(t('answers.added', 'Answer added'));
      } else {
        await write.update(editing.answer.id, { versions: kept as unknown as DataValue });
        toast(t('answers.saved', 'Answer saved'));
      }
      setEditing(null);
      onChanged();
    } catch (caught) {
      setEditing({ ...editing, error: refusal(t, asDataError(caught)).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (answer: Answer): Promise<void> => {
    try {
      await write.remove(answer.id);
      onChanged();
      toasts.push({
        variant: 'info',
        title: t('answers.deleted', 'Answer deleted: {question}', { question: titleOf(answer) }),
        duration: UNDO_MS,
        action: {
          label: t('answers.undo', 'Undo'),
          onAction: () =>
            void write.create({ ref: answer.ref, versions: answer.versions as unknown as DataValue, active: answer.active, position: answer.position }).then(onChanged, (caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error')),
        },
      } as never);
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    }
  };

  return (
    <Section labelledBy="chat-answers-title">
      <div className="flex flex-wrap items-center gap-2.5">
        <SectionTitle id="chat-answers-title">{t('answers.title', 'Answers')}</SectionTitle>
        <span className="flex-1 font-mono text-[11.5px] text-fg-subtle">{answers.length === 0 ? '' : String(answers.length)}</span>
        {mayEdit ? (
          <Button variant="secondary" iconLeft={<Icon name="plus" />} onClick={() => open(null)}>
            {t('answers.add', 'Add an answer')}
          </Button>
        ) : null}
      </div>
      {answers.length === 0 ? <p className="m-0 rounded-[10px] border border-dashed border-border-strong p-[22px] text-center text-[12.5px] text-fg-muted">{t('answers.empty', 'No answers yet. Write the questions people ask and the answer you want them to get.')}</p> : null}
      <div role="list" className="flex flex-col">
        {sorted.map((answer) => {
          const own = answer.versions[defaultLanguage] ?? Object.values(answer.versions)[0];
          const done = offered.filter((language) => written(answer.versions[language]));
          const needs = offered.filter((language) => !written(answer.versions[language]));
          const qid = `chat-answer-${answer.id}`;
          return (
            <div key={answer.id} role="listitem" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border py-[13px]">
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
                <span id={qid} className="text-[14px] font-bold">
                  {own?.title ?? answer.ref}
                </span>
                {own === undefined || own.examples.length === 0 ? null : (
                  <div className="flex flex-wrap gap-1.5">
                    {own.examples.map((example) => (
                      <span key={example} className="rounded-md bg-surface-3 px-2 py-0.5 text-[11.5px] text-fg-muted">
                        {t('answers.example', '“{example}”', { example })}
                      </span>
                    ))}
                  </div>
                )}
                <p className="m-0 text-[12.5px] leading-normal text-fg-muted [overflow-wrap:anywhere]">
                  <Segs text={own?.text ?? ''} />
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-pos-soft px-[7px] py-0.5 font-mono text-[11.5px] font-bold text-pos">{done.map(codeOf).join(' ')}</span>
                  {needs.length === 0 ? null : <span className="rounded-md bg-warn-soft px-[7px] py-0.5 text-[11.5px] font-bold text-warn">{t('answers.needTranslation', '{codes} {count, plural, one {needs translation} other {need translation}}', { codes: needs.map(codeOf).join(' '), count: needs.length })}</span>}
                </div>
              </div>
              {mayEdit ? (
                <div className="flex items-start gap-1.5">
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="pencil" />} onClick={() => open(answer)}>
                    <span aria-describedby={qid}>{t('answers.edit', 'Edit')}</span>
                  </Button>
                  <Button variant="secondary" size="sm" iconLeft={<Icon name="trash-2" />} onClick={() => void remove(answer)}>
                    <span aria-describedby={qid} className="text-danger">
                      {t('answers.delete', 'Delete')}
                    </span>
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Dialog open={editing !== null} onOpenChange={(next) => (next ? undefined : setEditing(null))} size="md">
        <DialogHeader title={editing?.answer === null ? t('answers.dialog.add', 'Add an answer') : t('answers.dialog.edit', 'Edit answer')} closeLabel={t('shared.close', 'Close')} />
        <DialogBody>
          {editing === null ? null : (
            <div className="flex flex-col gap-3.5 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12.5px] text-fg-muted">{t('answers.dialog.public', 'Anyone may be shown this answer.')}</span>
                <LanguageMenu t={t} editing={editing} languages={offered} onPick={(language) => setEditing({ ...editing, language })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="chat-answer-question" className="font-bold">
                  {t('answers.dialog.question', 'Question')}
                </label>
                <input id="chat-answer-question" lang={editing.language} dir="auto" value={version.title} onChange={(event) => change({ title: event.target.value })} className="h-10 rounded-[10px] border border-border-strong bg-surface px-3 text-[13px] text-fg" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="chat-answer-examples" className="font-bold">
                  {t('answers.dialog.examples', 'Other ways people ask it')}
                </label>
                <textarea id="chat-answer-examples" lang={editing.language} dir="auto" rows={3} value={version.examples.join('\n')} onChange={(event) => change({ examples: event.target.value.split('\n') })} className="resize-y rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[13px] leading-normal text-fg" />
                <span className="text-[11.5px] text-fg-subtle">{t('answers.dialog.examplesHint', 'One per line.')}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="chat-answer-text" className="font-bold">
                  {t('answers.dialog.answer', 'Answer')}
                </label>
                <textarea id="chat-answer-text" lang={editing.language} dir="auto" rows={3} value={version.text} onChange={(event) => change({ text: event.target.value })} className="resize-y rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[13px] leading-normal text-fg" />
                <span className="text-[11.5px] text-fg-subtle">{t('answers.dialog.answerHint', 'Sent exactly as written. Don’t put prices or stock levels here.')}</span>
              </div>
              {editing.error === '' ? null : (
                <p role="alert" className="m-0 text-[12.5px] text-danger">
                  {editing.error}
                </p>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditing(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {t('answers.dialog.save', 'Save answer')}
          </Button>
        </DialogFooter>
      </Dialog>
    </Section>
  );
}
