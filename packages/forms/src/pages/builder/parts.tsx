/**
 * The small things the builder's screens share: an icon by its name, the
 * kinds' names and icons, the micro title over a column.
 */
import type { FormQuestionKind } from '@adminium/add-on-contracts/forms';
import type { ReactNode } from 'react';

import { lucideByName, type AddOnTranslate } from '../shared/host.ts';

export const Icon = ({ name }: { name: string }): ReactNode => {
  const Found = lucideByName(name);
  return <Found className="size-4" />;
};

/** Each kind's icon (comp 862). */
export const KIND_ICON: Readonly<Record<FormQuestionKind, string>> = {
  short: 'type',
  long: 'align-left',
  one: 'circle-dot',
  several: 'square-check',
  date: 'calendar',
  number: 'hash',
  score: 'gauge',
  stars: 'star',
  file: 'paperclip',
  tick: 'badge-check',
  hidden: 'eye-off',
};

/** Each kind's name, as the rail and the card's chip say it (comp 874). */
export function kindName(t: AddOnTranslate, kind: FormQuestionKind): string {
  switch (kind) {
    case 'short':
      return t('builder.kind.short', 'Short text');
    case 'long':
      return t('builder.kind.long', 'Long text');
    case 'one':
      return t('builder.kind.one', 'One choice');
    case 'several':
      return t('builder.kind.several', 'Several choices');
    case 'date':
      return t('builder.kind.date', 'Date');
    case 'number':
      return t('builder.kind.number', 'Number');
    case 'score':
      return t('builder.kind.score', 'Score 0–10');
    case 'stars':
      return t('builder.kind.stars', 'Stars');
    case 'file':
      return t('builder.kind.file', 'File');
    case 'tick':
      return t('builder.kind.tick', 'Agreement tick');
    default:
      return t('builder.kind.hidden', 'Hidden field');
  }
}

/** The micro capitals over a column or a list. */
export function MicroTitle({ children }: { children: ReactNode }): ReactNode {
  return <span className="px-1.5 pb-2.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">{children}</span>;
}

/** A purpose's name (the two a tick may ask for). */
export function purposeName(t: AddOnTranslate, purpose: string): string {
  return purpose === 'surveys' ? t('builder.purpose.surveys', 'Surveys') : t('builder.purpose.newsletter', 'Newsletter');
}
