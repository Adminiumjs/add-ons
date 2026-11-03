/**
 * THE FORM SETTINGS' OTHER SECTIONS (comp 332-426): the agreement tick, what
 * a visitor sees after sending, who is told, the limits and the files.
 */
import { FORM_FILE_KINDS, FORM_PER_HOUR_MAX, FORM_TELL_MAX, FORM_TICK_PURPOSES, type FormFileKind } from '@adminium/add-on-contracts/forms';
import { useState, type ReactNode } from 'react';

import { Button, Checkbox, Combobox, IconButton, Input, RadioCard, RadioGroup, Select, Switch, Textarea, useLocaleTag, type AddOnTranslate } from '../shared/host.ts';
import { isRightToLeft } from '../shared/languages.ts';
import { useToast } from '../shared/toast.ts';
import { dayOf, filesOf, freePurposes, numberOf, setTickWords, ticksOf, updateQuestion, wordIn, type Draft, type Question, type QuestionOf, type Tell } from './draft.ts';
import { NumberField } from './fields.tsx';
import { Icon, purposeName } from './parts.tsx';
import type { FormsStatus } from './status.ts';
import type { Builder } from './store.ts';

const Lock = ({ children }: { children: ReactNode }): ReactNode => (
  <span className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
    <Icon name="lock" />
    {children}
  </span>
);

/** The question a section edits: the one picked, when it is of that kind, else the first of them. */
function pickedOf<Q extends Question>(builder: Builder, all: readonly Q[]): Q | undefined {
  return all.find((one) => one.id === builder.selected) ?? all[0];
}

/* ── the agreement tick (comp 332-356) ───────────────────────────────────── */

export function tickSummary(t: AddOnTranslate, draft: Draft): string {
  const tick = ticksOf(draft.definition)[0];
  if (tick === undefined) return t('builder.tick.none', 'No agreement tick');
  const parts = [t('builder.tick.version', 'v{n}', { n: tick.wordingVersion }), purposeName(t, tick.purpose)];
  if (tick.confirm !== false) parts.push(t('builder.tick.confirmShort', 'confirm by e-mail'));
  return parts.join(' · ');
}

export function TickSection({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const d = builder.draft.definition;
  const tick = pickedOf(builder, ticksOf(d));
  const lang = builder.editing;
  const [writing, setWriting] = useState<string | null>(null);
  if (tick === undefined) return <span className="text-[12.5px] text-fg-subtle">{t('builder.tick.add', 'Add an Agreement tick from the list to ask visitors to agree to mail.')}</span>;
  const set = (change: (tick: QuestionOf<'tick'>) => QuestionOf<'tick'>): void => builder.change((draft) => ({ ...draft, definition: updateQuestion(draft.definition, tick.id, (one) => (one.kind === 'tick' ? change(one) : one)) }));
  const changed = new Date(`${tick.wordingChangedAt}T12:00:00`);
  const when = Number.isNaN(changed.getTime()) ? tick.wordingChangedAt : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(changed);
  const open = freePurposes(d, tick.id);
  const several = ticksOf(d).length > 1;
  return (
    <span className="flex flex-col gap-3">
      {several ? <span className="text-[12.5px] font-bold">{t('builder.where.question', 'Q{n} · {label}', { n: numberOf(d, tick.id), label: purposeName(t, tick.purpose) })}</span> : null}
      <span className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold">{t('builder.tick.words', 'Its words')}</span>
          <span dir="ltr" className="ms-auto inline-flex h-5 items-center rounded-md bg-surface-3 px-1.5 font-mono text-[10.5px] font-bold text-fg-muted">
            {t('builder.tick.versionChip', 'v{n}, changed {date}', { n: tick.wordingVersion, date: when })}
          </span>
        </span>
        {writing === null ? (
          <span className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] leading-normal">
            <bdi>{wordIn(tick.label, lang, d.defaultLanguage)}</bdi>
          </span>
        ) : (
          <span dir={isRightToLeft(lang) ? 'rtl' : 'ltr'} className="flex flex-col">
            <Textarea aria-label={t('builder.tick.words', 'Its words')} value={writing} rows={4} maxLength={2000} onChange={(event) => setWriting(event.target.value)} />
          </span>
        )}
        {mayEdit ? (
          writing === null ? (
            <span>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon name="pencil" />}
                onClick={() => {
                  setWriting(wordIn(tick.label, lang));
                  toast(t('builder.tick.willVersion', 'Saving new words will make version {n}.', { n: tick.wordingVersion + 1 }), 'info');
                }}
              >
                {t('builder.tick.edit', 'Edit words')}
              </Button>
            </span>
          ) : (
            <span className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={writing.trim() === '' || writing === wordIn(tick.label, lang)}
                onClick={() => {
                  const words = writing;
                  builder.change((draft) => ({ ...draft, definition: setTickWords(draft.definition, tick.id, lang, words, dayOf(new Date())) }));
                  setWriting(null);
                }}
              >
                {t('builder.tick.save', 'Save new words')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWriting(null)}>
                {t('shared.cancel', 'Cancel')}
              </Button>
            </span>
          )
        ) : null}
        <span className="text-[11.5px] leading-[1.45] text-fg-subtle">{t('builder.tick.versionNote', 'Changing the words makes a new version. Each answer keeps the version it agreed to.')}</span>
      </span>
      <Select
        label={t('builder.tick.why', 'Why you’re asking')}
        value={tick.purpose}
        disabled={!mayEdit}
        options={FORM_TICK_PURPOSES.map((purpose) => ({ value: purpose, label: purposeName(t, purpose), disabled: purpose !== tick.purpose && !open.includes(purpose) }))}
        onChange={(event) => {
          const purpose = FORM_TICK_PURPOSES.find((one) => one === event.target.value);
          // At most one tick asks for each purpose: one another tick has is never taken.
          if (purpose !== undefined && (purpose === tick.purpose || open.includes(purpose))) set((one) => ({ ...one, purpose }));
        }}
      />
      <span className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[12.5px] font-bold">{t('builder.tick.confirm', 'Ask them to confirm by e-mail')}</span>
          <span className="text-[11.5px] leading-[1.45] text-fg-subtle">{t('builder.tick.confirmSub', 'Recommended. Turn off only if you have another way to show they agreed.')}</span>
        </span>
        <Switch checked={tick.confirm !== false} disabled={!mayEdit} onCheckedChange={(checked) => set((one) => ({ ...one, confirm: checked }))} />
      </span>
      <Lock>{t('builder.card.unticked', 'Always starts unticked. Visitors tick it themselves.')}</Lock>
    </span>
  );
}

/* ── after sending (comp 364-368) ────────────────────────────────────────── */

export const afterSummary = (t: AddOnTranslate, draft: Draft): string => (draft.definition.ending.kind === 'page' ? t('builder.after.page', 'Go to a page') : t('builder.after.thanksShort', 'Thank-you words'));

export function AfterSection({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const d = builder.draft.definition;
  const lang = builder.editing;
  const ending = d.ending;
  // The other choice's words stay while the form is open, so switching back loses nothing.
  const [kept, setKept] = useState<{ words: Draft['definition']['ending'] | null; page: string }>({ words: ending.kind === 'words' ? ending : null, page: ending.kind === 'page' ? ending.url : '' });
  const setEnding = (next: Draft['definition']['ending']): void => builder.change((draft) => ({ ...draft, definition: { ...draft.definition, ending: next } }));
  return (
    <span className="flex flex-col gap-2.5">
      <RadioGroup
        value={ending.kind}
        aria-label={t('builder.s.after', 'After sending')}
        onValueChange={(value) => {
          if (value === ending.kind) return;
          if (value === 'page') {
            setKept((was) => ({ ...was, words: ending }));
            setEnding({ kind: 'page', url: kept.page });
          } else {
            setKept((was) => ({ ...was, page: ending.kind === 'page' ? ending.url : was.page }));
            setEnding(kept.words !== null && kept.words.kind === 'words' ? kept.words : { kind: 'words', words: {} });
          }
        }}
      >
        <RadioCard value="words" title={t('builder.after.thanks', 'Show thank-you words')} disabled={!mayEdit} />
        <RadioCard value="page" title={t('builder.after.page', 'Go to a page')} disabled={!mayEdit} />
      </RadioGroup>
      {/* The words' direction is the language's: the kit's text area takes it from around it. */}
      <span dir={isRightToLeft(lang) ? 'rtl' : 'ltr'} className="flex flex-col">
      <Textarea
        aria-label={t('builder.after.thanks', 'Show thank-you words')}
        rows={3}
        maxLength={2000}
        disabled={!mayEdit || ending.kind !== 'words'}
        value={ending.kind === 'words' ? wordIn(ending.words, lang) : ''}
        onChange={(event) => {
          if (ending.kind !== 'words') return;
          const text = event.target.value;
          builder.change((draft) => (draft.definition.ending.kind === 'words' ? { ...draft, definition: { ...draft.definition, ending: { kind: 'words', words: { ...draft.definition.ending.words, [lang]: text } } } } : draft));
        }}
      />
      </span>
      <Input
        aria-label={t('builder.after.page', 'Go to a page')}
        placeholder="https://"
        dir="ltr"
        maxLength={2048}
        disabled={!mayEdit || ending.kind !== 'page'}
        value={ending.kind === 'page' ? ending.url : kept.page}
        onChange={(event) => setEnding({ kind: 'page', url: event.target.value.trim() })}
      />
    </span>
  );
}

/* ── tell (comp 379-389) ─────────────────────────────────────────────────── */

export function tellSummary(t: AddOnTranslate, draft: Draft, names: (tell: Tell) => string): string {
  const tell = draft.settings.tell ?? [];
  return tell.length === 0 ? t('builder.tell.nobody', 'Nobody yet') : tell.map(names).join(', ');
}

/** A told person's or role's name, from what Adminium says; someone not found is said so. */
export const nameOf =
  (t: AddOnTranslate, status: FormsStatus | null, people: readonly { id: string; name: string }[]) =>
  (tell: Tell): string =>
    (tell.kind === 'role' ? status?.roles.find((role) => role.id === tell.id)?.name : people.find((person) => person.id === tell.id)?.name) ?? (tell.kind === 'role' ? t('builder.tell.someRole', 'A role') : t('builder.tell.someone', 'Someone'));

export function TellSection({ t, builder, mayEdit, status, people, extra }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean; status: FormsStatus | null; people: readonly { id: string; name: string }[]; extra?: ReactNode }): ReactNode {
  const [adding, setAdding] = useState(false);
  const tell = builder.draft.settings.tell ?? [];
  const name = nameOf(t, status, people);
  const setTell = (next: Tell[]): void => builder.change((draft) => ({ ...draft, settings: { ...draft.settings, tell: next } }));
  const options = [
    ...(status?.roles ?? []).filter((role) => !tell.some((one) => one.kind === 'role' && one.id === role.id)).map((role) => ({ value: `role:${role.id}`, label: role.name, description: t('builder.tell.role', 'Role') })),
    ...people.filter((person) => !tell.some((one) => one.kind === 'person' && one.id === person.id)).map((person) => ({ value: `person:${person.id}`, label: person.name, description: t('builder.tell.person', 'Person') })),
  ];
  return (
    <span className="flex flex-col gap-2">
      {tell.map((one) => (
        <span key={`${one.kind}:${one.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 py-1 pe-1 ps-2.5">
          <span className="flex text-fg-muted">
            <Icon name={one.kind === 'role' ? 'users-round' : 'user'} />
          </span>
          <bdi className="min-w-0 flex-1 text-[12.5px] font-bold">{name(one)}</bdi>
          <span className="text-[11px] text-fg-subtle">{one.kind === 'role' ? t('builder.tell.role', 'Role') : t('builder.tell.person', 'Person')}</span>
          {mayEdit ? (
            <IconButton label={t('builder.tell.remove', 'Remove {name}', { name: name(one) })} variant="ghost" onClick={() => setTell(tell.filter((other) => other !== one))}>
              <Icon name="x" />
            </IconButton>
          ) : null}
        </span>
      ))}
      {mayEdit && adding ? (
        <Combobox
          aria-label={t('builder.tell.add', 'Add a person or role')}
          options={options}
          value={null}
          emptyText={t('builder.tell.empty', 'Nobody else to add')}
          placeholder={t('builder.tell.add', 'Add a person or role')}
          onValueChange={(value) => {
            if (value === null) return;
            const [kind, ...id] = value.split(':');
            setTell([...tell, { kind: kind === 'role' ? 'role' : 'person', id: id.join(':') }]);
            setAdding(false);
          }}
        />
      ) : mayEdit ? (
        <button type="button" disabled={tell.length >= FORM_TELL_MAX} onClick={() => setAdding(true)} className="flex h-[34px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-border-strong text-[12.5px] font-bold text-fg-muted hover:border-accent hover:text-accent">
          <Icon name="plus" />
          {t('builder.tell.add', 'Add a person or role')}
        </button>
      ) : null}
      {extra}
      <span className="text-[11.5px] text-fg-subtle">{t('builder.tell.sub', 'They get a bell and an e-mail for each answer.')}</span>
    </span>
  );
}

/* ── limits (comp 394-408) ───────────────────────────────────────────────── */

export function limitsSummary(t: AddOnTranslate, draft: Draft): string {
  const limits = draft.settings.limits ?? {};
  const parts = [t('builder.limits.summary', 'At most {n} an hour', { n: limits.perHour ?? 200 })];
  if (limits.harder === true) parts.push(t('builder.limits.harderShort', 'harder check'));
  return parts.join(' · ');
}

export function LimitsSection({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const limits = builder.draft.settings.limits ?? {};
  const set = (next: { perHour?: number; harder?: boolean }): void => builder.change((draft) => ({ ...draft, settings: { ...draft.settings, limits: { perHour: draft.settings.limits?.perHour ?? 200, harder: draft.settings.limits?.harder ?? false, ...next } } }));
  return (
    <span className="flex flex-col gap-3">
      <NumberField
        t={t}
        label={t('builder.limits.atMost', 'At most this many sends an hour')}
        value={limits.perHour ?? 200}
        min={1}
        max={FORM_PER_HOUR_MAX}
        disabled={!mayEdit}
        unit={t('builder.limits.perHour', 'sends an hour')}
        onChange={(value) => (value === undefined ? undefined : set({ perHour: value }))}
      />
      <span className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[12.5px] font-bold">{t('builder.limits.harder', 'Use a harder check')}</span>
          <span className="text-[11.5px] leading-[1.45] text-fg-subtle">{t('builder.limits.harderSub', 'Visitors pass one more check before sending. Turn on if junk sends get through.')}</span>
        </span>
        <Switch checked={limits.harder === true} disabled={!mayEdit} onCheckedChange={(checked) => set({ harder: checked })} />
      </span>
    </span>
  );
}

/* ── files (comp 416-426) ────────────────────────────────────────────────── */

const fileKindName = (t: AddOnTranslate, kind: FormFileKind): string => (kind === 'text' ? t('builder.files.text', 'Text') : kind.toUpperCase());

export function filesSummary(t: AddOnTranslate, draft: Draft): string {
  const file = filesOf(draft.definition)[0];
  if (file === undefined) return t('builder.files.none', 'No file question');
  return t('builder.files.summary', 'Up to {n} MB · {kinds}', { n: file.maxMb, kinds: FORM_FILE_KINDS.filter((kind) => file.kinds.includes(kind)).map((kind) => fileKindName(t, kind)).join(', ') || '—' });
}

export function FilesSection({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const d = builder.draft.definition;
  const file = pickedOf(builder, filesOf(d));
  if (file === undefined) return <span className="text-[12.5px] text-fg-subtle">{t('builder.files.add', 'Add a File question from the list to take files.')}</span>;
  const set = (change: (file: QuestionOf<'file'>) => QuestionOf<'file'>): void => builder.change((draft) => ({ ...draft, definition: updateQuestion(draft.definition, file.id, (one) => (one.kind === 'file' ? change(one) : one)) }));
  return (
    <span className="flex flex-col gap-3">
      {filesOf(d).length > 1 ? <span className="text-[12.5px] font-bold">{t('builder.where.question', 'Q{n} · {label}', { n: numberOf(d, file.id), label: wordIn(file.label, builder.editing, d.defaultLanguage) })}</span> : null}
      <NumberField t={t} label={t('builder.files.upTo', 'Largest file')} unit={t('builder.files.mbEach', 'MB each')} value={file.maxMb} min={1} max={10} disabled={!mayEdit} onChange={(value) => (value === undefined ? undefined : set((one) => ({ ...one, maxMb: value })))} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-bold">{t('builder.files.kinds', 'Kinds allowed')}</legend>
        <span className="grid grid-cols-2 gap-1.5">
          {FORM_FILE_KINDS.map((kind) => (
            <label key={kind} className="flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-[12.5px] font-bold">
              <Checkbox
                checked={file.kinds.includes(kind)}
                disabled={!mayEdit}
                onCheckedChange={(checked) => set((one) => ({ ...one, kinds: FORM_FILE_KINDS.filter((other) => (other === kind ? checked : one.kinds.includes(other))) }))}
              />
              <span>{fileKindName(t, kind)}</span>
            </label>
          ))}
        </span>
      </fieldset>
      <Lock>{t('builder.files.staff', 'Only staff can open the files.')}</Lock>
    </span>
  );
}
