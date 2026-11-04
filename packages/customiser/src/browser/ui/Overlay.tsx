/**
 * A DIALOG OVER THE PAGE, AND THE SHORT NOTES THAT COME AND GO.
 *
 * The dialog is the comps' own: a scrim, a card, Tab kept inside it, Escape
 * closing it, focus put into it on opening and given back to what opened it
 * on closing. Toasts are announced politely and leave on their own; one with
 * an Undo stays a little longer.
 */
import { Check, Info, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { useShared } from './context.tsx';

interface DialogProps {
  labelledBy: string;
  describedBy?: string;
  alert?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** The scrim's own class: a sheet sits at the side or the foot, not in the middle. */
  scrimClass?: string;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, select, a[href], [tabindex="0"]';

export function Dialog({ labelledBy, describedBy, alert = false, onClose, children, className, scrimClass }: DialogProps) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = box.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button');
    first?.focus();
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || box.current === null) return;
      const all = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (all.length === 0) return;
      const [head, tail] = [all[0]!, all[all.length - 1]!];
      if (!box.current.contains(document.activeElement)) {
        event.preventDefault();
        head.focus();
      } else if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      if (opener !== null && document.body.contains(opener)) opener.focus();
    };
  }, []);
  return (
    <div className={scrimClass ?? 'cz-scrim'} onClick={onClose}>
      <div ref={box} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={labelledBy} {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })} className={className ?? 'cz-dialog'} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'info' | 'warn';
  undo?: () => void;
}

export function Toasts({ toasts, onUndo, raised = false }: { toasts: readonly Toast[]; onUndo: (toast: Toast) => void; raised?: boolean }) {
  const { t } = useShared();
  return (
    <div aria-live="polite" className={raised ? 'cz-toasts cz-toasts-raised' : 'cz-toasts'}>
      {toasts.map((toast) => (
        <div key={toast.id} role="status" className={`cz-toast cz-toast-${toast.kind}`}>
          {toast.kind === 'warn' ? <TriangleAlert aria-hidden="true" /> : toast.kind === 'info' ? <Info aria-hidden="true" /> : <Check aria-hidden="true" />}
          <span>{toast.text}</span>
          {toast.undo === undefined ? null : (
            <button type="button" className="cz-toast-undo" onClick={() => onUndo(toast)}>
              {t('editor.undo', 'Undo')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
