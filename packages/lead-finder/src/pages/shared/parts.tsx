/**
 * THE SMALL PARTS EVERY SCREEN DRAWS: an icon by its name, a pill in a tone,
 * a micro title, a state card, a source's tile.
 *
 * Every class here is one the dashboard already draws (an add-on ships no
 * stylesheet), and each is written out whole, never put together while the
 * screen runs, so the check in `strings.test.ts` can read it.
 */
import type { ReactNode } from 'react';

import { lucideByName } from './host.ts';

export function Icon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-4 shrink-0" aria-hidden="true" />;
}

/** A smaller icon, for chips and lines of 11–12.5 px. */
export function SmallIcon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-3 shrink-0" aria-hidden="true" />;
}

/** An icon that points along the reading direction: turned over in a right-to-left language. */
export function DirectionIcon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-3.5 shrink-0 rtl:-scale-x-100" aria-hidden="true" />;
}

export type Tone = 'pos' | 'info' | 'warn' | 'danger' | 'neutral' | 'accent';

/** A pill: "Added", "Already here", "Told on 28 Jul". */
export function Pill({ tone, icon, children }: { tone: Tone; icon?: string; children: ReactNode }): ReactNode {
  const mark = icon === undefined ? null : <SmallIcon name={icon} />;
  switch (tone) {
    case 'pos':
      return <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-pos-soft px-2 text-[11.5px] font-bold text-pos">{mark}{children}</span>;
    case 'info':
      return <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-info-soft px-2 text-[11.5px] font-bold text-info">{mark}{children}</span>;
    case 'warn':
      return <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-warn-soft px-2 text-[11.5px] font-bold text-warn">{mark}{children}</span>;
    case 'danger':
      return <span className="inline-flex items-center gap-[5px] rounded-[10px] bg-danger-soft px-2 py-0.5 text-[11.5px] font-bold text-danger">{mark}{children}</span>;
    case 'accent':
      return <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-accent-soft px-2 text-[11.5px] font-bold text-accent">{mark}{children}</span>;
    case 'neutral':
      return <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-surface-3 px-2 text-[11.5px] font-bold text-fg-muted">{mark}{children}</span>;
  }
}

/** A label in small capitals: "Now", "Found", a table's heads. */
export function MicroTitle({ children }: { children: ReactNode }): ReactNode {
  return <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">{children}</span>;
}

/** A spinning loader, stopped by the reader's "reduce motion". */
export function Spinning(): ReactNode {
  const Found = lucideByName('loader-circle');
  return <Found className="size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />;
}

/** A tile of 44 holding an icon, for a card that stands for a state. */
export function StateTile({ tone, icon }: { tone: 'neutral' | 'danger' | 'warn'; icon: string }): ReactNode {
  if (tone === 'danger')
    return (
      <span className="flex size-11 items-center justify-center rounded-[14px] bg-danger-soft text-danger">
        <Icon name={icon} />
      </span>
    );
  if (tone === 'warn')
    return (
      <span className="flex size-11 items-center justify-center rounded-[14px] bg-warn-soft text-warn">
        <Icon name={icon} />
      </span>
    );
  return (
    <span className="flex size-11 items-center justify-center rounded-[14px] bg-surface-3 text-fg-muted">
      <Icon name={icon} />
    </span>
  );
}

/** A card standing for a state: an icon, one sentence, maybe a button. */
export function StateCard({ tone, icon, live, children, action }: { tone: 'neutral' | 'danger' | 'warn'; icon: string; live?: boolean; children: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <section aria-live={live === true ? 'polite' : undefined} className="flex flex-col items-center gap-2.5 rounded-[14px] border border-border bg-surface px-6 py-8 text-center shadow-sm">
      <StateTile tone={tone} icon={icon} />
      <h2 className="m-0 text-[14px] font-bold">{children}</h2>
      {action}
    </section>
  );
}

/** A note on a tinted block: the quiet lines of the sheet. */
export function Note({ tone, icon, children }: { tone: 'quiet' | 'info' | 'warn' | 'danger'; icon: string; children: ReactNode }): ReactNode {
  switch (tone) {
    case 'info':
      return (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-info-soft px-3.5 py-3 text-[12.5px] font-semibold leading-normal text-info">
          <Icon name={icon} />
          <span className="min-w-0 flex-1">{children}</span>
        </div>
      );
    case 'warn':
      return (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-warn-soft px-3.5 py-3 text-[13px] font-semibold text-warn">
          <Icon name={icon} />
          <span className="min-w-0 flex-1">{children}</span>
        </div>
      );
    case 'danger':
      return (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger">
          <Icon name={icon} />
          <span className="min-w-0 flex-1">{children}</span>
        </div>
      );
    case 'quiet':
      return (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-surface-3 px-3.5 py-3 text-[13px] text-fg-muted">
          <Icon name={icon} />
          <span className="min-w-0 flex-1">{children}</span>
        </div>
      );
  }
}

/** Text that is a value from elsewhere (a name, an address): its own direction, never the page's. */
export function Value({ children }: { children: ReactNode }): ReactNode {
  return <bdi>{children}</bdi>;
}

/** An address, a host, a key's last four: always left to right, in the mono face. */
export function Fixed({ children }: { children: ReactNode }): ReactNode {
  return (
    <span dir="ltr" className="font-mono text-[12px]">
      {children}
    </span>
  );
}
