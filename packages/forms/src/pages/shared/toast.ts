/**
 * A TOAST: what just happened, said once and gone after 3.8 seconds.
 *
 * The dashboard's own toasts, never a copy of them: the host's queue draws the
 * toast where every screen's toasts appear and reads it out through its own
 * polite region, so a screen of this add-on adds no second one for it.
 */
import { useAppToasts } from './host.ts';

/** How long a toast stays: the comp's 3.8 seconds. */
export const TOAST_MS = 3800;

export function useToast(): (words: string, tone?: 'success' | 'error' | 'info') => void {
  const toasts = useAppToasts();
  return (words, tone = 'success') => void toasts.push({ variant: tone, title: words, duration: TOAST_MS });
}
