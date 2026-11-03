/**
 * THE QUESTIONS TAB: the builder's body (comp 216-456, M4 §7).
 *
 * Above it, what keeps the form from working. Then three parts: the kinds a
 * question may be ("Add a question"), the form's title and its questions in
 * their sections, and the form settings. Each change is saved within a
 * second (`store.ts`).
 *
 * Laid out with the dashboard's own parts: the settings are the kit grid's
 * side column (beside the questions from 1024 px, under them below), and the
 * kinds sit beside the questions from 768 px, in a row that scrolls sideways
 * below it.
 */
import { FORM_QUESTIONS_MAX, FORM_SECTIONS_MAX } from '@adminium/add-on-contracts/forms';
import { useState, type ReactNode } from 'react';

import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, EmptyState, Grid, IconButton, Input, Stack, Textarea, useFormTables, type AddOnTranslate } from '../shared/host.ts';
import { isRightToLeft, languageName } from '../shared/languages.ts';
import type { TabProps } from '../shared/slot.ts';
import { useToast } from '../shared/toast.ts';
import { BlockedCards } from './BlockedCards.tsx';
import { publishProblems, problemsAt } from './checks.ts';
import { addQuestion, addSection, canMove, dayOf, dependentsOf, frozenChoices, freePurposes, itemsOf, kindsFor, move, newQuestion, numberOf, remove, removeSection, setSectionTitle, setWords, wordIn, type Definition, type Section } from './draft.ts';
import { useFormBuilder } from './HeaderActions.tsx';
import { kitTables } from './mapping.ts';
import { Icon, KIND_ICON, kindName, MicroTitle } from './parts.tsx';
import { QuestionCard } from './QuestionCard.tsx';
import { SettingsColumn } from './SettingsColumn.tsx';
import { startingWords } from './starting.ts';
import { useFormsStatus } from './status.ts';
import type { Builder } from './store.ts';

const dirOf = (lang: string): 'rtl' | 'ltr' => (isRightToLeft(lang) ? 'rtl' : 'ltr');

/** "Add a question" (comp 230-237): the kinds this form may ask, each adding one at the end. */
function KindsRail({ t, builder, onAdded }: { t: AddOnTranslate; builder: Builder; onAdded: (words: string) => void }): ReactNode {
  const d = builder.draft.definition;
  const full = d.questions.length >= FORM_QUESTIONS_MAX;
  return (
    <nav aria-label={t('builder.addQuestion', 'Add a question')} className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm">
      <MicroTitle>{t('builder.addQuestion', 'Add a question')}</MicroTitle>
      <span className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
        {kindsFor(d.kind).map((kind) => (
          <button
            key={kind}
            type="button"
            // A form asks for each purpose's agreement once at most: with both asked for, no tick is offered.
            disabled={full || (kind === 'tick' && freePurposes(d).length === 0)}
            onClick={() => {
              const lang = builder.editing;
              const question = newQuestion(d, kind, lang, startingWords(lang), dayOf(new Date()));
              builder.change((draft) => ({ ...draft, definition: addQuestion(draft.definition, question) }));
              builder.select(question.id);
              onAdded(t('builder.added', 'Q{n} added: {kind}.', { n: d.questions.length + 1, kind: kindName(t, kind) }));
            }}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2 py-[7px] text-start text-[12.5px] font-semibold text-fg-muted hover:bg-accent-soft hover:text-accent"
          >
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-surface-3">
              <Icon name={KIND_ICON[kind]} />
            </span>
            {kindName(t, kind)}
          </button>
        ))}
      </span>
    </nav>
  );
}

/** The form's title and introduction, in the language being edited. */
function FormHead({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const d = builder.draft.definition;
  const lang = builder.editing;
  const set = (change: (d: Definition) => Definition): void => builder.change((draft) => ({ ...draft, definition: change(draft.definition) }));
  return (
    <section aria-label={t('builder.head', 'Title and introduction')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-4 shadow-sm">
      <Input label={t('builder.head.title', 'Title')} value={wordIn(d.title, lang)} placeholder={wordIn(d.title, d.defaultLanguage)} dir={dirOf(lang)} maxLength={200} disabled={!mayEdit} onChange={(event) => set((one) => ({ ...one, title: { ...one.title, [lang]: event.target.value } }))} />
      <span dir={dirOf(lang)} className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-bold">{t('builder.head.intro', 'Introduction (optional)')}</span>
        <Textarea
          aria-label={t('builder.head.intro', 'Introduction (optional)')}
          rows={2}
          maxLength={2000}
          disabled={!mayEdit}
          value={wordIn(d.intro, lang)}
          onChange={(event) => {
            const text = event.target.value;
            set((one) => {
              const intro = setWords(one.intro, lang, text);
              const { intro: _was, ...rest } = one;
              void _was;
              return Object.keys(intro).length === 0 ? rest : { ...rest, intro };
            });
          }}
        />
      </span>
    </section>
  );
}

/** A section's head, in the card pattern of the questions: its title; the questions under it are its own. */
function SectionCard({ t, builder, section, n, mayEdit }: { t: AddOnTranslate; builder: Builder; section: Section; n: number; mayEdit: boolean }): ReactNode {
  const d = builder.draft.definition;
  const lang = builder.editing;
  const def = (change: (d: Definition) => Definition): void => builder.change((draft) => ({ ...draft, definition: change(draft.definition) }));
  return (
    <section data-section-head={section.id} aria-label={t('builder.section.n', 'Section {n}', { n })} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-4 shadow-sm">
      <span className="flex items-center gap-2">
        <span className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md bg-surface-3 px-1.5 text-[11.5px] font-bold text-fg-muted">
          <Icon name="list" />
          {t('builder.section.n', 'Section {n}', { n })}
        </span>
        {mayEdit ? (
          <span className="ms-auto flex gap-0.5">
            <IconButton label={t('builder.card.up', 'Move up')} variant="ghost" disabled={!canMove(d, section.id, -1)} onClick={() => def((one) => move(one, section.id, -1))}>
              <Icon name="arrow-up" />
            </IconButton>
            <IconButton label={t('builder.card.down', 'Move down')} variant="ghost" disabled={!canMove(d, section.id, 1)} onClick={() => def((one) => move(one, section.id, 1))}>
              <Icon name="arrow-down" />
            </IconButton>
            <IconButton label={t('builder.section.remove', 'Remove this section (its questions stay)')} variant="ghost" onClick={() => def((one) => removeSection(one, section.id))}>
              <Icon name="trash-2" />
            </IconButton>
          </span>
        ) : null}
      </span>
      <Input label={t('builder.section.title', 'Section title')} value={wordIn(section.title, lang)} placeholder={wordIn(section.title, d.defaultLanguage)} dir={dirOf(lang)} maxLength={200} disabled={!mayEdit} onChange={(event) => def((one) => setSectionTitle(one, section.id, lang, event.target.value))} />
    </section>
  );
}

export function Questions({ t, form, settings }: TabProps): ReactNode {
  const { builder, mayEdit } = useFormBuilder(form, settings);
  const { status } = useFormsStatus();
  const { tables } = useFormTables();
  const toast = useToast();
  const [said, setSaid] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const d = builder.draft.definition;
  const frozen = frozenChoices(form.published);
  // What the vocabulary would refuse, shown at each question before anyone presses Publish.
  const problems = publishProblems(builder.draft, { notice: null, tables: kitTables(tables), slug: form.slug });
  const lang = builder.editing;

  const deleteNow = (id: string): void => {
    builder.change((draft) => remove(draft, id));
    if (builder.selected === id) builder.select(null);
    setAsked(null);
    const words = t('builder.deleted', 'Question deleted.');
    toast(words);
    setSaid(words);
  };
  const askDelete = (id: string): void => (dependentsOf(d, id).length > 0 ? setAsked(id) : deleteNow(id));
  const dependents = asked === null ? [] : dependentsOf(d, asked);

  let sectionN = 0;
  const items = itemsOf(d);
  const list = (
    <span className="flex min-w-0 flex-col gap-3">
      <FormHead t={t} builder={builder} mayEdit={mayEdit} />
      {d.questions.length === 0 ? <EmptyState compact title={t('builder.empty', 'No questions yet')} body={mayEdit ? t('builder.emptyBody', 'Pick a kind under “Add a question” to add the first one.') : undefined} /> : null}
      {items.map((item) =>
        item.type === 'section' ? (
          <SectionCard key={item.section.id} t={t} builder={builder} section={item.section} n={(sectionN += 1)} mayEdit={mayEdit} />
        ) : (
          <QuestionCard key={item.question.id} t={t} builder={builder} question={item.question} mayEdit={mayEdit} problems={problemsAt(problems, item.question.id)} frozen={frozen} onDelete={askDelete} />
        ),
      )}
      {mayEdit ? (
        <span>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Icon name="plus" />}
            disabled={(d.sections ?? []).length >= FORM_SECTIONS_MAX}
            onClick={() => {
              let made = '';
              builder.change((draft) => {
                const next = addSection(draft.definition, lang, startingWords(lang).section);
                made = next.id;
                return { ...draft, definition: next.definition };
              });
              builder.select(made);
            }}
          >
            {t('builder.section.add', 'Add a section')}
          </Button>
        </span>
      ) : null}
    </span>
  );

  return (
    <Stack gap="md">
      <BlockedCards t={t} status={status} kind={form.kind} />
      {lang === d.defaultLanguage ? null : (
        <span className="flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2 text-[12.5px] font-semibold text-info">
          <Icon name="languages" />
          {t('builder.editingIn', 'You are editing the {language} words. Everything else is the same in every language.', { language: languageName(lang) })}
        </span>
      )}
      <Grid columns={1} gap="md" aside={<SettingsColumn t={t} form={form} builder={builder} mayEdit={mayEdit} status={status} />}>
        {mayEdit ? (
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-[14rem_1fr]">
            <KindsRail t={t} builder={builder} onAdded={setSaid} />
            {list}
          </div>
        ) : (
          list
        )}
      </Grid>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
      <Dialog open={asked !== null} onOpenChange={(open) => (open ? undefined : setAsked(null))} size="sm">
        <DialogHeader title={t('builder.delete.title', 'Delete this question?')} closeLabel={t('shared.close', 'Close')} tone="danger" />
        <DialogBody>
          <span className="text-body text-fg-muted">
            {t('builder.delete.body', '{questions} only show after an answer to this question. Once it is deleted, they always show.', { questions: dependents.map((one) => t('builder.card.number', 'Q{n}', { n: numberOf(d, one.id) })).join(', ') })}
          </span>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAsked(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={() => (asked === null ? undefined : deleteNow(asked))}>
            {t('builder.delete.confirm', 'Delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </Stack>
  );
}
