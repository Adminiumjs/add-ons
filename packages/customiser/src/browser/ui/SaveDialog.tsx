/**
 * "SAVE AND COME BACK": the address first, then the design is saved and its
 * private link is on its way (Birch Row's dialog, in both looks, each with
 * its own words: BC-0.SAVE and BC-C1; MC-0.SAVE asks the same way, and its
 * "saved" is drawn as Birch Row's dialog, as the comps' shared component).
 *
 * A guest has no address on file, so the dialog asks for one before it
 * saves; the field starts empty unless this browser already sent a link to
 * the customer's own address. Adminium mails the design's own link there,
 * the only way the link reaches the customer: it is never shown on screen.
 * Once saved the dialog says where the link went and offers "Keep going" or
 * "Back to the shop".
 */
import { BookmarkCheck, Bookmark, CircleAlert } from 'lucide-react';
import { useState } from 'react';

import { useShared } from './context.tsx';
import { Dialog } from './Overlay.tsx';

export interface SaveDialogProps {
  email: string;
  /** Saved, and the link sent to this address. */
  sentTo: string | null;
  busy: boolean;
  failed: string | null;
  onSubmit: (email: string) => void;
  onClose: () => void;
  onBackToShop?: (() => void) | undefined;
}

const LOOKS_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Where the address goes in the sentence: a character no language's words hold. */
const SLOT = '\uE000';

export function SaveDialog({ email: start, sentTo, busy, failed, onSubmit, onClose, onBackToShop }: SaveDialogProps) {
  const { t, look, shop } = useShared();
  const [email, setEmail] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const submit = (): void => {
    const typed = email.trim();
    if (!LOOKS_LIKE.test(typed)) {
      setError(typed === '' ? t('editor.save.emailNone', 'Enter your e-mail so we can send you the link') : t('editor.save.emailBad', 'That doesn’t look like an e-mail address. Try name@example.com'));
      document.getElementById('cz-save-email')?.focus();
      return;
    }
    setError(null);
    onSubmit(typed);
  };
  const shown = error ?? failed;
  return (
    <Dialog labelledBy="cz-save-title" onClose={onClose}>
      {sentTo === null ? (
        <form
          className="cz-dialog-body"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {look === 'print' ? (
            <span className="cz-tile cz-tile-accent">
              <Bookmark aria-hidden="true" />
            </span>
          ) : null}
          <h2 id="cz-save-title" className="cz-h2">
            {t('editor.save', 'Save and come back')}
          </h2>
          <p className="cz-sub">{look === 'print' ? t('editor.save.bodyPrint', 'We save the design and e-mail you a private link to it. Only you and {shop} can open it.', { shop }) : t('editor.save.body', 'We’ll keep the design and e-mail you a private link to it. Nobody else can open it.')}</p>
          <label htmlFor="cz-save-email" className="cz-label">
            {look === 'print' ? t('editor.save.emailPrint', 'E-mail') : t('editor.save.email', 'Your e-mail')}
          </label>
          <input id="cz-save-email" className={shown === null ? 'cz-input' : 'cz-input cz-input-bad'} type="email" autoComplete="email" placeholder="name@example.com" value={email} aria-invalid={shown !== null} aria-describedby={shown === null ? undefined : 'cz-save-err'} onChange={(event) => setEmail(event.target.value)} />
          {shown === null ? null : (
            <span id="cz-save-err" role="alert" className="cz-error">
              <CircleAlert aria-hidden="true" />
              {shown}
            </span>
          )}
          <div className="cz-dialog-actions">
            <button type="submit" className="cz-primary cz-grow" aria-busy={busy} aria-disabled={busy}>
              {look === 'print' ? t('editor.save.submitPrint', 'Save and send the link') : t('editor.save.submit', 'Save it')}
            </button>
            <button type="button" className="cz-button" onClick={onClose}>
              {t('editor.cancel', 'Cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="cz-dialog-body cz-centre">
          <span className="cz-tile cz-tile-good">
            <BookmarkCheck aria-hidden="true" />
          </span>
          <h2 id="cz-save-title" className="cz-h2">
            {t('editor.saved.title', 'Saved. We’ve e-mailed you a link to come back to it.')}
          </h2>
          {/* BC-C1: "Sent to <address>", the address in the mono face, wherever the language puts it. */}
          <p className="cz-sub">
            {t('editor.saved.sentTo', 'Sent to {email}. The link opens your designs and nobody else’s.', { email: SLOT })
              .split(SLOT)
              .flatMap((piece, at) => (at === 0 ? [piece] : [<span key={at} className="cz-mono">{sentTo}</span>, piece]))}
          </p>
          <div className="cz-dialog-actions">
            {/* The dialog opened before the design was saved: the focus moves to what it now offers. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <button type="button" className="cz-primary cz-grow" autoFocus onClick={onClose}>
              {t('editor.saved.keepGoing', 'Keep going')}
            </button>
            {onBackToShop === undefined ? null : (
              <button type="button" className="cz-button cz-grow" onClick={onBackToShop}>
                {t('editor.saved.backToShop', 'Back to the shop')}
              </button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
