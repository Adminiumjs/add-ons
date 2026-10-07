/**
 * THE BAR AT THE FOOT OF A SHEET: what the sheet comes to, at most two
 * buttons, and — across its whole width — why Adminium refused, said aloud.
 */
import type { ReactNode } from 'react';

import { Alert, StickyBar } from './host.ts';

export interface TotalsBarProps {
  label: string;
  /** The totals line. */
  totals: ReactNode;
  /** The buttons; the main one last. */
  children?: ReactNode;
  /** A refusal, or what must be put right first. */
  problem?: ReactNode;
  /** A run under way: its progress, in place of a refusal. */
  progress?: ReactNode;
}

export function TotalsBar({ label, totals, children, problem, progress }: TotalsBarProps): ReactNode {
  return (
    <StickyBar aria-label={label} start={totals} end={children}>
      {progress ?? null}
      {problem === undefined || problem === null || problem === '' ? null : <Alert tone="danger" role="alert" title={problem} />}
    </StickyBar>
  );
}
