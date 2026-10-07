/**
 * THE FRAME EVERY SCREEN SITS IN: the dashboard's own surface and title, and
 * the three things a screen can be before it is itself — loading, refused,
 * failed. A status said to a screen reader goes through the one polite region
 * here.
 */
import { useRef, useState, type ReactNode } from 'react';

import { Alert, Button, EmptyState, PageActions, PageSurface, Skeleton, Stack, type AddOnTranslate, type DataError } from './host.ts';
import { refusal } from './refusal.ts';

export interface PageFrameProps {
  t: AddOnTranslate;
  title: string;
  subtitle?: string;
  backTo?: string;
  /** Buttons for the dashboard's top bar. */
  actions?: ReactNode;
  loading?: boolean;
  /** The reader may not open this at all. */
  refused?: boolean;
  /** A read that failed. */
  error?: DataError | null;
  onRetry?: () => void;
  /** Said to a screen reader when it changes. */
  status?: string;
  width?: 'page' | 'wide' | 'content';
  testId?: string;
  children?: ReactNode;
}

export function PageFrame({ t, title, subtitle, backTo, actions, loading, refused, error, onRetry, status, width = 'page', testId, children }: PageFrameProps): ReactNode {
  let body: ReactNode = children;
  if (refused === true) {
    body = <EmptyState title={t('shared.refused.title', 'You do not have permission to open this')} body={t('shared.refused.body', 'Ask a stock manager if you need it.')} />;
  } else if (error !== undefined && error !== null) {
    body = (
      <Alert
        tone="danger"
        role="alert"
        title={t('shared.failed.title', 'This could not be loaded')}
        body={refusal(t, error).message}
        {...(onRetry === undefined ? {} : { action: <Button variant="secondary" size="sm" onClick={() => onRetry()}>{t('shared.retry', 'Retry')}</Button> })}
      />
    );
  } else if (loading === true) {
    body = (
      <Stack gap="sm">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </Stack>
    );
  }
  return (
    <PageSurface width={width} {...(testId === undefined ? {} : { testId })} className="leading-[normal]">
      <PageActions title={title} documentTitle={title} {...(subtitle === undefined ? {} : { subtitle })} {...(backTo === undefined ? {} : { backTo })}>
        {actions}
      </PageActions>
      <Stack gap="lg">{body}</Stack>
      <div role="status" aria-live="polite" className="sr-only" data-part="inventory-status">
        {status ?? ''}
      </div>
    </PageSurface>
  );
}

/**
 * A status line for the polite region: set it, and it is said once. Setting
 * the same words again says them again (a second scan of the same item).
 */
export function useSaid(): [string, (words: string) => void] {
  const [said, setSaid] = useState('');
  const turn = useRef(0);
  const say = (words: string): void => {
    turn.current += 1;
    // A zero-width mark makes equal words a new value, so they are announced again.
    setSaid(turn.current % 2 === 0 ? words : `${words}\u200B`);
  };
  return [said, say];
}
