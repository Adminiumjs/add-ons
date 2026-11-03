/**
 * "FORM SETTINGS" (comp 296-426, M4 §7): one section open at a time. Each
 * head is a button that says whether its section is open and which part it
 * opens, with the section's one-line summary while it is closed. A staff
 * link's `?settings=<section>` opens that section.
 *
 * A survey's column is the surveys' own panel (`surveys/SurveySettings.tsx`),
 * with "Each answer becomes", "After sending" and "Tell" from here inside it.
 */
import type { ReactNode } from 'react';

import { useFormTables, type AddOnTranslate } from '../shared/host.ts';
import type { FormRow } from '../shared/row.ts';
import { BecomesSection, becomesSummary } from './Becomes.tsx';
import { kitTables } from './mapping.ts';
import { Icon } from './parts.tsx';
import { AfterSection, afterSummary, FilesSection, filesSummary, LimitsSection, limitsSummary, nameOf, TellSection, tellSummary, TickSection, tickSummary } from './Sections.tsx';
import { usePeople, type FormsStatus } from './status.ts';
import type { Builder } from './store.ts';
import { SurveySettings } from '../surveys/SurveySettings.tsx';
import type { Settings } from './draft.ts';
import { sectionName } from './words.ts';

interface Part {
  id: string;
  icon: string;
  title: string;
  summary: string;
  body: () => ReactNode;
}

function Head({ part, open, onToggle }: { part: Part; open: boolean; onToggle: () => void }): ReactNode {
  const panel = `forms-settings-${part.id}`;
  return (
    <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className="flex w-full items-center gap-2.5 px-4 py-3 text-start hover:bg-surface-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3 text-fg-muted">
        <Icon name={part.icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-bold">{part.title}</span>
        {open ? null : <span className="truncate text-[11.5px] text-fg-subtle">{part.summary}</span>}
      </span>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} />
    </button>
  );
}

export function SettingsColumn({ t, builder, mayEdit, status }: { t: AddOnTranslate; form: FormRow; builder: Builder; mayEdit: boolean; status: FormsStatus | null }): ReactNode {
  const tables = kitTables(useFormTables().tables);
  const draft = builder.draft;
  const survey = draft.definition.kind === 'survey';
  // People are asked for once Tell is open, or someone is told already.
  const people = usePeople(builder.open === 'tell' || (draft.settings.tell ?? []).some((one) => one.kind === 'person'));
  // A survey's column is its own panel; this folder's three sections are drawn inside it.
  if (survey)
    return (
      <SurveySettings
        t={t}
        definition={draft.definition}
        settings={draft.settings}
        onChange={(settings) => builder.change((one) => ({ ...one, settings: settings as Settings }))}
        becomes={<BecomesSection t={t} builder={builder} mayEdit={mayEdit} />}
        after={<AfterSection t={t} builder={builder} mayEdit={mayEdit} />}
        tell={<TellSection t={t} builder={builder} mayEdit={mayEdit} status={status} people={people} caption={false} />}
        disabled={!mayEdit}
      />
    );
  const parts: Part[] = [
    { id: 'becomes', icon: 'table-2', title: sectionName(t, 'becomes'), summary: becomesSummary(t, draft, tables), body: () => <BecomesSection t={t} builder={builder} mayEdit={mayEdit} /> },
    { id: 'tick', icon: 'badge-check', title: sectionName(t, 'tick'), summary: tickSummary(t, draft), body: () => <TickSection t={t} builder={builder} mayEdit={mayEdit} /> },
    { id: 'after', icon: 'corner-down-right', title: sectionName(t, 'after'), summary: afterSummary(t, draft), body: () => <AfterSection t={t} builder={builder} mayEdit={mayEdit} /> },
    { id: 'tell', icon: 'bell-ring', title: sectionName(t, 'tell'), summary: tellSummary(t, draft, nameOf(t, status, people)), body: () => <TellSection t={t} builder={builder} mayEdit={mayEdit} status={status} people={people} /> },
    { id: 'limits', icon: 'gauge', title: sectionName(t, 'limits'), summary: limitsSummary(t, draft), body: () => <LimitsSection t={t} builder={builder} mayEdit={mayEdit} /> },
    { id: 'files', icon: 'paperclip', title: sectionName(t, 'files'), summary: filesSummary(t, draft), body: () => <FilesSection t={t} builder={builder} mayEdit={mayEdit} /> },
  ];

  return (
    <aside aria-label={t('builder.settings', 'Form settings')} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <span className="flex border-b border-border px-4 py-3.5 text-[14px] font-bold">{t('builder.settings', 'Form settings')}</span>
      {parts.map((part) => {
        const open = builder.open === part.id;
        return (
          <span key={part.id} data-section={part.id} className="flex flex-col border-b border-border">
            <Head
              part={part}
              open={open}
              onToggle={() => builder.setOpen(open ? null : part.id)}
            />
            {open ? (
              <span id={`forms-settings-${part.id}`} className="flex flex-col px-4 pb-4 pt-0.5">
                {part.body()}
              </span>
            ) : null}
          </span>
        );
      })}
    </aside>
  );
}
