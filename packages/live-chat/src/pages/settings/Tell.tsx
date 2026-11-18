/**
 * WHO IS TOLD (the comp's "Tell me when the limit runs out" row, in the
 * automatic answers card): the roles and people Adminium tells when a chat waits for a
 * person, and when the day's automatic answers run out early. Nobody named:
 * everyone who may read the chats (and, for the limit, whoever may change
 * these settings), which is what the line under it says.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Combobox, type AddOnTranslate } from '../shared/host.ts';
import { readPeople } from '../shared/chat.ts';
import { Icon, SmallIcon } from '../shared/parts.tsx';
import type { Draft, Told } from './draft.ts';

interface Named {
  value: string;
  label: string;
}

/** `roles`: every role, by its name in the reader's language, as the chat's status read names them. */
export function Tell({ t, draft, change, roles: listed }: { t: AddOnTranslate; draft: Draft; change: (next: (was: Draft) => Draft) => void; roles: readonly { id: string; name: string }[] }): ReactNode {
  const roles = useMemo<Named[]>(() => listed.map((role) => ({ value: role.id, label: role.name })), [listed]);
  const [people, setPeople] = useState<Named[]>([]);

  useEffect(() => {
    let live = true;
    readPeople().then(
      (found) => live && setPeople([...found].map(([value, label]) => ({ value, label }))),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const nameOf = (one: Told): string => (one.kind === 'role' ? roles : people).find((named) => named.value === one.id)?.label ?? one.id;
  const options = [
    ...roles.filter((role) => !draft.tell.some((one) => one.kind === 'role' && one.id === role.value)).map((role) => ({ value: `role:${role.value}`, label: role.label, description: t('settings.tell.role', 'Role') })),
    ...people.filter((person) => !draft.tell.some((one) => one.kind === 'person' && one.id === person.value)).map((person) => ({ value: `person:${person.value}`, label: person.label, description: t('settings.tell.person', 'Person') })),
  ];

  return (
    <div role="group" aria-labelledby="chat-tell-title" className="flex flex-col gap-2 border-t border-border pt-3.5">
      <span id="chat-tell-title" className="text-[13px]">
        {t('settings.tell.title', 'Who is told')}
      </span>
      <p className="m-0 text-[12.5px] leading-normal text-fg-muted">{t('settings.tell.text', 'Told when a chat waits for a person, and when the daily limit runs out early in the day.')}</p>
      <div className="flex flex-wrap gap-1.5">
        {draft.tell.length === 0 ? <span className="text-[12.5px] text-fg-subtle">{t('settings.tell.everyone', 'Nobody chosen: everyone who may read the chats is told.')}</span> : null}
        {draft.tell.map((one) => (
          <span key={`${one.kind}:${one.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 py-1 pe-1 ps-2.5 text-[12.5px] font-semibold">
            <SmallIcon name={one.kind === 'role' ? 'users-round' : 'user-round'} />
            {nameOf(one)}
            <button type="button" aria-label={t('settings.tell.remove', 'Stop telling {name}', { name: nameOf(one) })} onClick={() => change((was) => ({ ...was, tell: was.tell.filter((other) => !(other.kind === one.kind && other.id === one.id)) }))} className="inline-flex size-6 items-center justify-center rounded-full text-fg-muted hover:bg-surface-3">
              <Icon name="x" />
            </button>
          </span>
        ))}
      </div>
      <div className="max-w-[360px]">
        <Combobox
          aria-label={t('settings.tell.add', 'Tell someone else')}
          placeholder={t('settings.tell.add', 'Tell someone else')}
          emptyText={t('settings.tell.none', 'Nobody else to tell')}
          options={options}
          value={null}
          onValueChange={(value) => {
            if (value === null) return;
            const [kind, ...rest] = value.split(':');
            const id = rest.join(':');
            if ((kind === 'role' || kind === 'person') && id !== '') change((was) => ({ ...was, tell: [...was.tell, { kind, id }] }));
          }}
        />
      </div>
    </div>
  );
}
