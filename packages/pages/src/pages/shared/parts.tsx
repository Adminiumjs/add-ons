/**
 * THE SMALL PARTS EVERY SCREEN DRAWS: an icon by its name, a page's status
 * pill, a label in small capitals, an address in its own direction.
 *
 * Every class here is one the dashboard already draws (an add-on ships no
 * stylesheet), and each is written out whole, never put together while the
 * screen runs, so the check in `strings.test.ts` can read it.
 */
import type { ReactNode } from 'react';

import { lucideByName, StatusPill, type AddOnTranslate } from './host.ts';
import type { PageState } from './rows.ts';

export function Icon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-4" aria-hidden="true" />;
}

/** A smaller icon, for chips and lines of 11–12.5 px. */
export function SmallIcon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-3.5" aria-hidden="true" />;
}

/** An icon that points a way: it turns around in a right-to-left language. */
export function WayIcon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-4 rtl:-scale-x-100" aria-hidden="true" />;
}

/** A label in small capitals: "Page", "Form · opened". */
export function MicroTitle({ children }: { children: ReactNode }): ReactNode {
  return <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">{children}</span>;
}

/** An address, read left to right whatever the language around it. */
export function Address({ children }: { children: ReactNode }): ReactNode {
  return (
    <bdi dir="ltr" className="font-mono text-[12px] text-fg-subtle [overflow-wrap:anywhere]">
      {children}
    </bdi>
  );
}

/** A page's status in its own words. */
export function stateWords(t: AddOnTranslate, state: PageState): string {
  if (state === 'live') return t('shared.state.live', 'Live');
  if (state === 'off') return t('shared.state.off', 'Off');
  return t('shared.state.draft', 'Draft');
}

/** A page's status pill: Live is positive, Draft is information, Off is quiet. */
export function PagePill({ t, state }: { t: AddOnTranslate; state: PageState }): ReactNode {
  return (
    <StatusPill status={state} tone={state === 'live' ? 'pos' : state === 'draft' ? 'info' : 'neutral'}>
      {stateWords(t, state)}
    </StatusPill>
  );
}
