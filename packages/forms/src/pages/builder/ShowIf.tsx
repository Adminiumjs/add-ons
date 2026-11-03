/**
 * "SHOW ONLY IF" (comp 282-291, E4.4): a question shown only after a given
 * answer to an earlier one.
 *
 * The band says the condition in words, with "Change". The editor offers only
 * the earlier questions whose answer is a pick or a number (one choice,
 * several choices, a score, stars, a number) and never a hidden field, and
 * one test of each: a pick "is" a choice, picks "include" one, a number "is",
 * "is at least" or "is at most" a value.
 */
import { SCALE_OF } from '@adminium/add-on-contracts/forms';
import { useState, type ReactNode } from 'react';

import { Button, Select, type AddOnTranslate } from '../shared/host.ts';
import { numberOf, questionAt, setShowIf, showIfTargets, testsFor, wordIn, type Question } from './draft.ts';
import { NumberField } from './fields.tsx';
import { Icon } from './parts.tsx';
import type { Builder } from './store.ts';

type Test = 'is' | 'includes' | 'atLeast' | 'atMost';

function testWords(t: AddOnTranslate, test: Test): string {
  if (test === 'includes') return t('builder.showIf.includes', 'includes');
  if (test === 'atLeast') return t('builder.showIf.atLeast', 'is at least');
  if (test === 'atMost') return t('builder.showIf.atMost', 'is at most');
  return t('builder.showIf.is', 'is');
}

const testOf = (showIf: NonNullable<Question['showIf']>): Test => (showIf.includes !== undefined ? 'includes' : showIf.atLeast !== undefined ? 'atLeast' : showIf.atMost !== undefined ? 'atMost' : 'is');

export function ShowIfBand({ t, builder, question, mayEdit, onChange }: { t: AddOnTranslate; builder: Builder; question: Question; mayEdit: boolean; onChange: () => void }): ReactNode {
  const d = builder.draft.definition;
  const showIf = question.showIf;
  if (showIf === undefined) return null;
  const named = questionAt(d, showIf.question);
  const test = testOf(showIf);
  const value = showIf[test];
  const valueWords = named !== undefined && (named.kind === 'one' || named.kind === 'several') ? wordIn(named.choices.find((choice) => choice.id === value)?.label, builder.editing, d.defaultLanguage) || String(value ?? '') : String(value ?? '');
  return (
    <span className="flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2 text-[12.5px] font-semibold text-info">
      <Icon name="git-branch" />
      <span className="min-w-0 flex-1">
        {t('builder.showIf.lead', 'Show only if')} <bdi>‘{wordIn(named?.label, builder.editing, d.defaultLanguage)}’</bdi> {testWords(t, test)} <bdi>‘{valueWords}’</bdi>
      </span>
      {mayEdit ? (
        <Button variant="link" size="sm" onClick={onChange}>
          {t('builder.showIf.change', 'Change')}
        </Button>
      ) : null}
    </span>
  );
}

export function ShowIfEditor({ t, builder, question, onDone }: { t: AddOnTranslate; builder: Builder; question: Question; onDone: () => void }): ReactNode {
  const d = builder.draft.definition;
  const targets = showIfTargets(d, question.id);
  const had = question.showIf;
  const [target, setTarget] = useState(had?.question ?? targets[0]?.id ?? '');
  const named = questionAt(d, target);
  const tests = named === undefined ? [] : testsFor(named.kind);
  const [test, setTest] = useState<Test>(had === undefined ? (tests[0] ?? 'is') : testOf(had));
  const [value, setValue] = useState<string | number | undefined>(had === undefined ? undefined : had[testOf(had)]);
  const choices = named !== undefined && (named.kind === 'one' || named.kind === 'several') ? named.choices : null;
  const scale = named?.kind === 'score' || named?.kind === 'stars' ? SCALE_OF[named.kind] : null;
  const shownTest = tests.includes(test) ? test : (tests[0] ?? 'is');
  const shownValue = choices === null ? (typeof value === 'number' ? value : undefined) : typeof value === 'string' && choices.some((choice) => choice.id === value) ? value : choices[0]?.id;

  const save = (): void => {
    if (named === undefined || shownValue === undefined) return;
    builder.change((draft) => ({ ...draft, definition: setShowIf(draft.definition, question.id, { question: named.id, [shownTest]: shownValue }) }));
    onDone();
  };

  return (
    <span className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3">
      <span className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
        <Select
          label={t('builder.showIf.question', 'Show only if the answer to')}
          value={target}
          options={targets.map((one) => ({ value: one.id, label: t('builder.where.question', 'Q{n} · {label}', { n: numberOf(d, one.id), label: wordIn(one.label, builder.editing, d.defaultLanguage) }) }))}
          onChange={(event) => {
            setTarget(event.target.value);
            setValue(undefined);
          }}
        />
        <Select label={t('builder.showIf.test', 'Test')} value={shownTest} options={tests.map((one) => ({ value: one, label: testWords(t, one) }))} onChange={(event) => setTest(event.target.value as Test)} />
        {choices !== null ? (
          <Select label={t('builder.showIf.value', 'Answer')} value={shownValue === undefined ? '' : String(shownValue)} options={choices.map((choice) => ({ value: choice.id, label: wordIn(choice.label, builder.editing, d.defaultLanguage) }))} onChange={(event) => setValue(event.target.value)} />
        ) : (
          <NumberField
            t={t}
            label={t('builder.showIf.value', 'Answer')}
            value={typeof shownValue === 'number' ? shownValue : undefined}
            optional
            whole={scale !== null}
            min={scale?.min ?? (named?.kind === 'number' ? (named.min ?? -1e12) : -1e12)}
            max={scale?.max ?? (named?.kind === 'number' ? (named.max ?? 1e12) : 1e12)}
            onChange={(next) => setValue(next)}
          />
        )}
      </span>
      <span className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={named === undefined || shownValue === undefined} onClick={save}>
          {t('builder.showIf.done', 'Done')}
        </Button>
        {had !== undefined ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              builder.change((draft) => ({ ...draft, definition: setShowIf(draft.definition, question.id, null) }));
              onDone();
            }}
          >
            {t('builder.showIf.remove', 'Always show it')}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('shared.cancel', 'Cancel')}
        </Button>
      </span>
    </span>
  );
}
