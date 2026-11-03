/**
 * ONE QUESTION'S CARD (comp 241-292, M4 §7 "The builder body").
 *
 * At rest: "Q{n}", the kind, Move up / Move down / Duplicate / Delete, the
 * question, a picture of the answer a visitor gives, the help text or "Add
 * help text", the "show if" band and the footer with "Required" and "Show
 * only if…". Picked (by a click anywhere on it, or by its question, a real
 * button), it opens for writing: the question and its help in the language
 * being edited, the choices, and the kind's own settings. A file's and a
 * tick's own settings are in the form settings' column.
 *
 * What the vocabulary would refuse is said under the question, in words,
 * before anyone presses Publish.
 */
import { SCALE_OF, type FormQuestionKind } from '@adminium/add-on-contracts/forms';
import { useState, type MouseEvent, type ReactNode } from 'react';

import { Button, IconButton, Input, Select, Switch, type AddOnTranslate } from '../shared/host.ts';
import { isRightToLeft, languageName } from '../shared/languages.ts';
import type { Problem } from './checks.ts';
import {
  addChoice,
  canMove,
  duplicate,
  move,
  numberOf,
  setChoiceId,
  setChoiceLabel,
  setHelp,
  setLabel,
  setRequired,
  showIfTargets,
  removeChoice,
  updateQuestion,
  wordIn,
  type Definition,
  type Lang,
  type Question,
  type QuestionOf,
} from './draft.ts';
import { NumberField } from './fields.tsx';
import { Icon, KIND_ICON, kindName } from './parts.tsx';
import { ShowIfBand, ShowIfEditor } from './ShowIf.tsx';
import { startingWords } from './starting.ts';
import type { Builder } from './store.ts';
import { problemWords } from './words.ts';

export interface CardProps {
  t: AddOnTranslate;
  builder: Builder;
  question: Question;
  mayEdit: boolean;
  problems: readonly Problem[];
  /** The choices already live, as `question:choice`: their stored names stay. */
  frozen: ReadonlySet<string>;
  onDelete: (id: string) => void;
}

const dirOf = (lang: Lang): 'rtl' | 'ltr' => (isRightToLeft(lang) ? 'rtl' : 'ltr');
const stop = (event: MouseEvent): void => event.stopPropagation();

/** What a visitor's answer looks like, drawn small (comp 253-277). */
function AnswerPicture({ t, question, lang, d }: { t: AddOnTranslate; question: Question; lang: Lang; d: Definition }): ReactNode {
  switch (question.kind) {
    case 'short':
      return question.check === 'email' ? (
        <span className="flex flex-col gap-1.5">
          <span dir="ltr" className="flex h-[38px] max-w-[360px] items-center rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-[12.5px] text-fg-subtle">
            name@company.example
          </span>
          <span className="text-[11.5px] text-fg-subtle">{t('builder.card.mustEmail', 'Must be an e-mail address')}</span>
        </span>
      ) : (
        <span className="flex h-[38px] max-w-[360px] items-center rounded-lg border border-border-strong bg-surface-2 px-3 text-[12.5px] text-fg-subtle">{t('builder.card.short', 'Short answer')}</span>
      );
    case 'long':
      return <span className="flex h-16 items-start rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-subtle">{t('builder.card.long', 'Long answer')}</span>;
    case 'date':
      return (
        <span className="flex h-[38px] w-[200px] items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-[12.5px] text-fg-subtle">
          <Icon name="calendar" />
          {t('builder.card.date', 'dd / mm / yyyy')}
        </span>
      );
    case 'number':
      return (
        <span dir="ltr" className="flex h-[38px] w-[120px] items-center rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-[12.5px] text-fg-subtle">
          0
        </span>
      );
    case 'file':
      return (
        <span className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border-[1.5px] border-dashed border-border-strong px-3 text-[12.5px] font-bold text-fg-muted">
          <Icon name="paperclip" />
          {t('builder.card.chooseFiles', 'Choose files')}
        </span>
      );
    case 'score':
      return (
        <span className="flex flex-col gap-1.5">
          <span dir="ltr" className="flex flex-wrap gap-1">
            {Array.from({ length: SCALE_OF.score.max + 1 }, (_, n) => (
              <span key={String(n)} className="flex size-[34px] items-center justify-center rounded-md border border-border-strong font-mono text-[12px] font-bold text-fg-muted">
                {String(n)}
              </span>
            ))}
          </span>
          <span dir="ltr" className="flex max-w-[420px] justify-between text-[11.5px] text-fg-subtle">
            <span>{t('builder.card.scoreLow', '0 · Not likely')}</span>
            <span>{t('builder.card.scoreHigh', 'Very likely · 10')}</span>
          </span>
        </span>
      );
    case 'stars':
      return (
        <span className="flex gap-1 text-warn" aria-label={t('builder.card.stars', 'One to five stars')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon key={String(n)} name="star" />
          ))}
        </span>
      );
    case 'hidden':
      return <span className="text-[12.5px] text-fg-subtle">{t('builder.card.hidden', 'Filled from the link, not shown to visitors')}</span>;
    case 'tick':
      return (
        <span className="flex flex-col gap-2">
          <span className="flex items-start gap-2.5">
            <span className="mt-px size-[18px] shrink-0 rounded-sm border-[1.5px] border-border-strong bg-surface" aria-hidden="true" />
            <bdi className="text-[13px] leading-relaxed">{wordIn(question.label, lang, d.defaultLanguage)}</bdi>
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
            <Icon name="lock" />
            {t('builder.card.unticked', 'Always starts unticked. Visitors tick it themselves.')}
          </span>
        </span>
      );
    default:
      return null;
  }
}

/** A choice's mark: a circle for one choice, a box for several. */
const Mark = ({ kind }: { kind: FormQuestionKind }): ReactNode => (kind === 'one' ? <span className="size-4 shrink-0 rounded-full border-[1.5px] border-border-strong" aria-hidden="true" /> : <span className="size-4 shrink-0 rounded-sm border-[1.5px] border-border-strong" aria-hidden="true" />);

/** The choices, at rest or open for writing. */
function Choices({ t, builder, question, mayEdit, open, frozen }: { t: AddOnTranslate; builder: Builder; question: QuestionOf<'one'> | QuestionOf<'several'>; mayEdit: boolean; open: boolean; frozen: ReadonlySet<string> }): ReactNode {
  const lang = builder.editing;
  const d = builder.draft.definition;
  const def = (change: (d: Definition) => Definition): void => builder.change((draft) => ({ ...draft, definition: change(draft.definition) }));
  const add = (): void => {
    builder.select(question.id);
    def((one) => addChoice(one, question.id, lang, startingWords(lang).choice(question.choices.length + 1)));
  };
  return (
    <span className="flex flex-col gap-2">
      {question.choices.map((choice, index) =>
        open && mayEdit ? (
          <span key={choice.id} className="flex flex-wrap items-center gap-2.5">
            <Mark kind={question.kind} />
            <span className="min-w-0 flex-1">
              <Input
                aria-label={t('builder.card.choiceLabel', 'Choice {n}', { n: index + 1 })}
                value={wordIn(choice.label, lang)}
                placeholder={wordIn(choice.label, d.defaultLanguage)}
                dir={dirOf(lang)}
                maxLength={200}
                onChange={(event) => def((one) => setChoiceLabel(one, question.id, choice.id, lang, event.target.value, frozen))}
              />
            </span>
            <span className="w-[130px]">
              <Input
                aria-label={t('builder.card.storedAs', 'Choice {n} is stored as', { n: index + 1 })}
                value={choice.id}
                dir="ltr"
                maxLength={40}
                disabled={frozen.has(`${question.id}:${choice.id}`)}
                onChange={(event) => def((one) => setChoiceId(one, question.id, choice.id, event.target.value.toLowerCase()))}
              />
            </span>
            <IconButton label={t('builder.card.removeChoice', 'Remove choice {n}', { n: index + 1 })} variant="ghost" disabled={question.choices.length <= 1} onClick={() => def((one) => removeChoice(one, question.id, choice.id))}>
              <Icon name="x" />
            </IconButton>
          </span>
        ) : (
          <span key={choice.id} className="flex items-center gap-2.5">
            <Mark kind={question.kind} />
            <bdi className="text-[13px] text-fg-muted">{wordIn(choice.label, lang, d.defaultLanguage)}</bdi>
          </span>
        ),
      )}
      {mayEdit ? (
        <span>
          <Button variant="link" size="sm" iconLeft={<Icon name="plus" />} onClick={add}>
            {t('builder.card.addChoice', 'Add a choice')}
          </Button>
        </span>
      ) : null}
      {open && mayEdit && question.kind === 'several' ? <span className="text-[11.5px] text-fg-subtle">{t('builder.card.storedNote', 'A row this answer fills gets the picked choices’ stored names, joined by commas.')}</span> : null}
    </span>
  );
}

/** The kind's own settings, in the open card. */
function KindSettings({ t, builder, question }: { t: AddOnTranslate; builder: Builder; question: Question }): ReactNode {
  const d = builder.draft.definition;
  const set = (change: (question: Question) => Question): void => builder.change((draft) => ({ ...draft, definition: updateQuestion(draft.definition, question.id, change) }));
  const without = <Q extends Question>(one: Q, key: string): Q => {
    const out = { ...one } as Record<string, unknown>;
    delete out[key];
    return out as Q;
  };
  const numberKey = (key: 'min' | 'max' | 'maxLength', value: number | undefined) => set((one) => (value === undefined ? without(one, key) : ({ ...one, [key]: value } as Question)));
  switch (question.kind) {
    case 'short':
      return (
        <span className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label={t('builder.short.check', 'Allowed answers')}
            value={question.check ?? ''}
            options={[
              { value: '', label: t('builder.short.anything', 'Any text') },
              { value: 'email', label: t('builder.short.email', 'An e-mail address') },
              { value: 'phone', label: t('builder.short.phone', 'A phone number') },
            ]}
            onChange={(event) => set((one) => (event.target.value === '' ? without(without(one, 'check'), (one as QuestionOf<'short'>).role === 'email' ? 'role' : '') : ({ ...one, check: event.target.value } as Question)))}
          />
          <Select
            label={t('builder.short.role', 'It asks for')}
            value={question.role ?? ''}
            options={[
              { value: '', label: t('builder.short.roleNone', 'Something else') },
              { value: 'name', label: t('builder.short.roleName', 'Their name') },
              { value: 'email', label: t('builder.short.roleEmail', 'Their e-mail address') },
              { value: 'company', label: t('builder.short.roleCompany', 'Their company') },
            ]}
            onChange={(event) => set((one) => (event.target.value === '' ? without(one, 'role') : ({ ...one, role: event.target.value, ...(event.target.value === 'email' ? { check: 'email' } : {}) } as Question)))}
          />
          <NumberField t={t} label={t('builder.short.longest', 'Longest answer')} value={question.maxLength ?? 200} min={1} max={500} onChange={(value) => numberKey('maxLength', value)} />
        </span>
      );
    case 'long':
      return <NumberField t={t} label={t('builder.short.longest', 'Longest answer')} value={question.maxLength ?? 2000} min={1} max={5000} onChange={(value) => numberKey('maxLength', value)} />;
    case 'several':
      return (
        <span className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField t={t} label={t('builder.several.min', 'Fewest picks')} value={question.min} optional min={1} max={question.choices.length} onChange={(value) => numberKey('min', value)} />
          <NumberField t={t} label={t('builder.several.max', 'Most picks')} value={question.max} optional min={1} max={question.choices.length} onChange={(value) => numberKey('max', value)} />
        </span>
      );
    case 'date':
      return (
        <Select
          label={t('builder.date.from', 'Earliest day')}
          value={question.from ?? 'any'}
          options={[
            { value: 'any', label: t('builder.date.any', 'Any day') },
            { value: 'today', label: t('builder.date.today', 'Today') },
            { value: 'tomorrow', label: t('builder.date.tomorrow', 'Tomorrow') },
          ]}
          onChange={(event) => set((one) => ({ ...one, from: event.target.value }) as Question)}
        />
      );
    case 'number':
      return (
        <span className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
          <NumberField t={t} label={t('builder.number.min', 'Smallest')} value={question.min} optional whole={false} min={-1e12} max={1e12} onChange={(value) => numberKey('min', value)} />
          <NumberField t={t} label={t('builder.number.max', 'Largest')} value={question.max} optional whole={false} min={-1e12} max={1e12} onChange={(value) => numberKey('max', value)} />
          <Switch label={t('builder.number.whole', 'Whole numbers only')} checked={question.whole === true} onCheckedChange={(checked) => set((one) => (checked ? ({ ...one, whole: true } as Question) : without(one, 'whole')))} />
        </span>
      );
    case 'score':
      return d.kind === 'survey' ? (
        <Switch
          label={t('builder.score.recommend', 'This is the recommend score')}
          checked={question.recommend === true}
          disabled={question.recommend !== true && d.questions.some((one) => one.kind === 'score' && one.recommend === true)}
          onCheckedChange={(checked) => set((one) => (checked ? ({ ...one, recommend: true } as Question) : without(one, 'recommend')))}
        />
      ) : null;
    case 'hidden':
      return (
        <Input
          label={t('builder.hidden.param', 'Its name in the link')}
          hint={t('builder.hidden.paramHint', 'A link ending in ?{param}=flyer fills it with “flyer”.', { param: question.param })}
          value={question.param}
          dir="ltr"
          maxLength={32}
          onChange={(event) => set((one) => ({ ...one, param: event.target.value.toLowerCase() }) as Question)}
        />
      );
    case 'file':
    case 'tick':
      return (
        <span>
          <Button variant="link" size="sm" onClick={() => builder.setOpen(question.kind === 'file' ? 'files' : 'tick')}>
            {question.kind === 'file' ? t('builder.card.openFiles', 'Set its files in Form settings') : t('builder.card.openTick', 'Set its words and reason in Form settings')}
          </Button>
        </span>
      );
    default:
      return null;
  }
}

export function QuestionCard({ t, builder, question, mayEdit, problems, frozen, onDelete }: CardProps): ReactNode {
  const d = builder.draft.definition;
  const lang = builder.editing;
  const n = numberOf(d, question.id);
  const open = builder.selected === question.id;
  const [helpOpen, setHelpOpen] = useState(false);
  const [askingShowIf, setAskingShowIf] = useState(false);
  const def = (change: (d: Definition) => Definition): void => builder.change((draft) => ({ ...draft, definition: change(draft.definition) }));
  const pick = (): void => {
    if (!open) builder.select(question.id);
  };
  const label = wordIn(question.label, lang);
  const shown = label === '' ? wordIn(question.label, d.defaultLanguage) : label;
  const targets = showIfTargets(d, question.id);
  const editorId = `forms-q-${question.id}`;
  const fixed = question.kind === 'tick' || question.kind === 'hidden';

  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-fg-subtle">{t('builder.card.number', 'Q{n}', { n })}</span>
        <span className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md bg-surface-3 px-1.5 text-[11.5px] font-bold text-fg-muted">
          <Icon name={KIND_ICON[question.kind]} />
          {kindName(t, question.kind)}
        </span>
        {mayEdit ? (
          <span className="ms-auto flex gap-0.5" onClick={stop}>
            <IconButton label={t('builder.card.up', 'Move up')} variant="ghost" disabled={!canMove(d, question.id, -1)} onClick={() => def((one) => move(one, question.id, -1))}>
              <Icon name="arrow-up" />
            </IconButton>
            <IconButton label={t('builder.card.down', 'Move down')} variant="ghost" disabled={!canMove(d, question.id, 1)} onClick={() => def((one) => move(one, question.id, 1))}>
              <Icon name="arrow-down" />
            </IconButton>
            <IconButton
              label={t('builder.card.duplicate', 'Duplicate')}
              variant="ghost"
              disabled={question.kind === 'tick' && d.questions.filter((one) => one.kind === 'tick').length >= 2}
              onClick={() => {
                let made = question.id;
                def((one) => {
                  const copy = duplicate(one, question.id);
                  made = copy.id;
                  return copy.definition;
                });
                builder.select(made);
              }}
            >
              <Icon name="copy-plus" />
            </IconButton>
            <IconButton label={t('builder.card.delete', 'Delete')} variant="ghost" onClick={() => onDelete(question.id)}>
              <Icon name="trash-2" />
            </IconButton>
          </span>
        ) : null}
      </span>
      {open && mayEdit && question.kind !== 'tick' ? (
        <Input label={t('builder.card.question', 'Question')} value={label} placeholder={wordIn(question.label, d.defaultLanguage)} dir={dirOf(lang)} maxLength={500} onChange={(event) => def((one) => setLabel(one, question.id, lang, event.target.value))} />
      ) : question.kind === 'tick' ? null : (
        <button type="button" className="text-start text-[14px] font-bold text-fg" aria-expanded={open} aria-controls={editorId} onClick={pick}>
          <bdi>{shown === '' ? t('builder.card.noWords', 'No {language} words yet', { language: languageName(lang) }) : shown}</bdi>
        </button>
      )}
      {question.kind === 'tick' && !open ? (
        <button type="button" className="text-start" aria-expanded={open} aria-controls={editorId} onClick={pick}>
          <AnswerPicture t={t} question={question} lang={lang} d={d} />
        </button>
      ) : question.kind === 'one' || question.kind === 'several' ? (
        <Choices t={t} builder={builder} question={question} mayEdit={mayEdit} open={open} frozen={frozen} />
      ) : (
        <AnswerPicture t={t} question={question} lang={lang} d={d} />
      )}
      {open && mayEdit ? (
        <span id={editorId} className="flex flex-col gap-3" onClick={stop}>
          <KindSettings t={t} builder={builder} question={question} />
        </span>
      ) : null}
      {open && mayEdit && (question.help !== undefined || helpOpen) ? (
        <Input label={t('builder.card.help', 'Help text')} value={wordIn(question.help, lang)} placeholder={wordIn(question.help, d.defaultLanguage)} dir={dirOf(lang)} maxLength={1000} onChange={(event) => def((one) => setHelp(one, question.id, lang, event.target.value))} />
      ) : question.help !== undefined ? (
        <span className="flex items-center gap-2 text-[12.5px]">
          <span className="text-fg-subtle">{t('builder.card.helpLead', 'Help text:')}</span>
          <bdi className="text-fg-muted">{wordIn(question.help, lang, d.defaultLanguage)}</bdi>
        </span>
      ) : mayEdit && !fixed ? (
        <span onClick={stop}>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Icon name="plus" />}
            onClick={() => {
              builder.select(question.id);
              setHelpOpen(true);
            }}
          >
            {t('builder.card.addHelp', 'Add help text')}
          </Button>
        </span>
      ) : null}
      {askingShowIf ? (
        <span onClick={stop}>
          <ShowIfEditor t={t} builder={builder} question={question} onDone={() => setAskingShowIf(false)} />
        </span>
      ) : question.showIf !== undefined ? (
        <ShowIfBand t={t} builder={builder} question={question} mayEdit={mayEdit} onChange={() => setAskingShowIf(true)} />
      ) : null}
      {problems.length > 0 ? (
        <span className="flex flex-col gap-1">
          {problems.map((problem, index) => (
            <span key={String(index)} className="flex items-start gap-1.5 text-[12.5px] font-semibold text-warn">
              <Icon name="triangle-alert" />
              {problemWords(t, problem)}
            </span>
          ))}
        </span>
      ) : null}
      <span className="flex items-center gap-2.5 border-t border-border pt-3" onClick={stop}>
        {fixed ? (
          <span className="text-[12.5px] font-semibold text-fg-subtle">{question.kind === 'tick' ? t('builder.card.tickNever', 'Never required: each visitor decides.') : t('builder.card.hiddenNever', 'Never required, never asked.')}</span>
        ) : (
          <Switch label={t('builder.card.required', 'Required')} checked={question.required === true} disabled={!mayEdit} onCheckedChange={(checked) => def((one) => setRequired(one, question.id, checked))} />
        )}
        {mayEdit && question.showIf === undefined && !askingShowIf && question.kind !== 'hidden' && targets.length > 0 ? (
          <span className="ms-auto">
            <Button variant="ghost" size="sm" iconLeft={<Icon name="git-branch" />} onClick={() => setAskingShowIf(true)}>
              {t('builder.card.showIf', 'Show only if…')}
            </Button>
          </span>
        ) : null}
      </span>
    </>
  );

  return open ? (
    <div data-question={question.id} data-selected="true" className="flex min-w-0 flex-col gap-3 rounded-xl border border-accent bg-surface px-4 py-4 shadow-sm ring-[3px] ring-accent-soft">
      {body}
    </div>
  ) : (
    <div data-question={question.id} className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-4 shadow-sm" onClick={pick}>
      {body}
    </div>
  );
}
