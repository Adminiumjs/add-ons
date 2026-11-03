/**
 * The small things every card of the Share tab draws with: an icon by its
 * name, a card's title with its tile, a sentence with marked-up parts, and
 * copying to the clipboard with the comp's toasts.
 */
import { Fragment, type ReactNode } from 'react';

import { lucideByName, type AddOnTranslate } from '../shared/host.ts';
import { useToast } from '../shared/toast.ts';

export function Icon({ name, small }: { name: string; small?: boolean }): ReactNode {
  const Found = lucideByName(name);
  return small === true ? <Found className="size-3.5" aria-hidden="true" /> : <Found className="size-4" aria-hidden="true" />;
}

/** A card's title: the icon on its tile, then the words. */
export function CardTitle({ icon, children }: { icon: string; children: ReactNode }): ReactNode {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-accent-soft text-accent" aria-hidden="true">
        <Icon name={icon} />
      </span>
      {children}
    </span>
  );
}

/*
 * A translated sentence holds a marker where a part goes (a host in mono, a
 * link), so each language puts the part where its own word order needs it.
 * Escapes, never the characters themselves: a raw one would hide this file
 * from every text search.
 */
export const MARK = { a: '\uE000', b: '\uE001' } as const;

/** The sentence with each marker replaced by its part. */
export function sentence(words: string, parts: { a?: ReactNode; b?: ReactNode }): ReactNode {
  return (
    <>
      {words.split(/(\uE000|\uE001)/).map((piece, index) => (
        <Fragment key={String(index)}>{piece === MARK.a ? parts.a : piece === MARK.b ? parts.b : piece}</Fragment>
      ))}
    </>
  );
}

/** Copy a text; the toast says it went, or how to do it by hand. */
export function useCopy(t: AddOnTranslate): (text: string, done: string) => void {
  const toast = useToast();
  return (text, done) => {
    const failed = (): void => toast(t('share.toast.failed', "Couldn't copy. Select the text and copy it yourself."), 'error');
    try {
      navigator.clipboard.writeText(text).then(() => toast(done), failed);
    } catch {
      failed();
    }
  };
}
