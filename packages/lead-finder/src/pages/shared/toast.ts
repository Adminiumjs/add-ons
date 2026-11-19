/**
 * A TOAST: what just happened, said once and gone after 3.6 seconds (the
 * comps' time).
 *
 * The dashboard's own toasts, never a copy of them: the host's queue draws the
 * toast where every screen's toasts appear and reads it out through its own
 * polite region.
 */
import { useAppToasts } from './host.ts';

export const TOAST_MS = 3600;

export function useToast(): (words: string, tone?: 'success' | 'error' | 'info') => void {
  const toasts = useAppToasts();
  return (words, tone = 'success') => void toasts.push({ variant: tone, title: words, duration: TOAST_MS });
}
