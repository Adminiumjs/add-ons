/**
 * THE FOUR THINGS A MANAGER DOES TO A CARD BY HAND: top it up, adjust it,
 * cancel it, give a customer credit. Each is one save; each asks why; each
 * says "the card ending Q4XP" and never the code. A refused save keeps what
 * was typed and the dialog stays open.
 */
import { useState, type ReactNode } from 'react';

import { addMonths } from '../../rows/dates.ts';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Field,
  NumberInput,
  SegmentedControl,
  Stack,
  Textarea,
  asDataError,
  money,
  useLocaleTag,
  useRecords,
  useStateMove,
  useTreeWrite,
  useWrite,
  type AddOnTranslate,
} from '../shared/host.ts';
import { refusal, type Said } from '../shared/refusal.ts';
import { formatDay } from './LookUp.tsx';
import { todayOf, type ShownCard } from './read.ts';

const WHY_MAX = 200;
const keyOf = (key: string): string | number => (/^\d+$/.test(key) ? Number(key) : key);
const positive = (amount: string): boolean => /^\d+(\.\d+)?$/.test(amount) && /[1-9]/.test(amount);

interface DialogProps {
  t: AddOnTranslate;
  onClose: () => void;
  onSaved: (title: string) => Promise<void>;
}

function Why({ t, value, onChange, error }: { t: AddOnTranslate; value: string; onChange: (value: string) => void; error: string | undefined }): ReactNode {
  return (
    <Field label={t('lookup.dialog.why', 'Why')} required hint={t('lookup.dialog.whyHint', 'Kept with the card’s history.')} {...(error === undefined ? {} : { error })}>
      <Textarea value={value} maxLength={WHY_MAX} rows={2} error={error !== undefined} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function Shell({ t, title, subtitle, said, saving, saveLabel, danger, onClose, onSave, children }: { t: AddOnTranslate; title: string; subtitle?: string; said: Said | null; saving: boolean; saveLabel: string; danger?: boolean; onClose: () => void; onSave: () => void; children: ReactNode }): ReactNode {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())} size="md">
      <DialogHeader title={title} {...(subtitle === undefined ? {} : { subtitle })} closeLabel={t('shared.close', 'Close')} {...(danger === true ? { tone: 'danger' as const } : {})} />
      <DialogBody>
        <Stack gap="md">
          {/* Said at the top whatever it is about: a refusal may name a field this dialog does not draw. */}
          {said === null ? null : <Alert tone="danger" role="alert" title={said.message} />}
          {children}
        </Stack>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant={danger === true ? 'destructive' : 'primary'} loading={saving} onClick={() => onSave()}>
          {saveLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Top up, or adjust: one row of the card's hand actions. */
export function MoneyDialog({ t, kind, card, onClose, onSaved }: DialogProps & { kind: 'top-up' | 'adjust'; card: ShownCard }): ReactNode {
  const locale = useLocaleTag();
  const actions = useWrite('card_actions');
  const settings = useRecords('settings', { pageSize: 1, columns: ['card_min', 'card_max', 'card_expiry_months'] });
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('cash');
  const [direction, setDirection] = useState('add');
  const [why, setWhy] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [saving, setSaving] = useState(false);
  const ending = card.last4 ?? '';
  const limits = settings.rows[0];
  const months = Number(limits?.['card_expiry_months'] ?? 0);
  const movesTo = kind === 'top-up' && Number.isFinite(months) && months > 0 ? addMonths(todayOf(new Date()), months) : null;

  const save = async (): Promise<void> => {
    if (saving) return;
    if (!positive(amount)) return setSaid({ message: t('lookup.dialog.amountNeeded', 'Enter an amount above zero.'), field: 'amount' });
    if (why.trim() === '') return setSaid({ message: t('lookup.dialog.whyNeeded', 'Say why.'), field: 'reason' });
    setSaving(true);
    setSaid(null);
    try {
      const signed = kind === 'adjust' && direction === 'remove' ? `-${amount}` : amount;
      await actions.create({ card_id: keyOf(card.key), action: kind === 'top-up' ? 'top_up' : 'adjust', amount: signed, reason: why.trim(), ...(kind === 'top-up' ? { paid_by: paidBy } : {}) });
      const shown = money(amount, locale);
      await onSaved(kind === 'top-up' ? t('lookup.toppedUp', 'Topped up {amount}', { amount: shown }) : direction === 'remove' ? t('lookup.removed', 'Removed {amount}', { amount: shown }) : t('lookup.added', 'Added {amount}', { amount: shown }));
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)));
    } finally {
      setSaving(false);
    }
  };

  const on = (field: string): string | undefined => (said?.field === field ? said.message : undefined);
  return (
    <Shell
      t={t}
      title={kind === 'top-up' ? t('lookup.dialog.topUp', 'Top up the card ending {last4}', { last4: ending }) : t('lookup.dialog.adjust', 'Adjust the card ending {last4}', { last4: ending })}
      said={said}
      saving={saving}
      saveLabel={kind === 'top-up' ? t('lookup.topUp', 'Top up') : t('lookup.adjust', 'Adjust')}
      onClose={onClose}
      onSave={() => void save()}
    >
      {kind === 'adjust' ? (
        <SegmentedControl
          aria-label={t('lookup.dialog.direction', 'Add or remove')}
          value={direction}
          onValueChange={setDirection}
          options={[
            { value: 'add', label: t('lookup.dialog.add', 'Add') },
            { value: 'remove', label: t('lookup.dialog.remove', 'Remove') },
          ]}
        />
      ) : null}
      <NumberInput
        label={t('lookup.dialog.amount', 'Amount')}
        value={amount}
        onChange={setAmount}
        decimals={2}
        required
        {...(on('amount') === undefined ? {} : { error: on('amount') })}
        {...(kind === 'top-up' && limits !== undefined && limits['card_max'] !== null && limits['card_max'] !== undefined ? { hint: t('lookup.dialog.upTo', 'The card may hold up to {max}.', { max: money(limits['card_max'], locale) }) } : {})}
      />
      {kind === 'top-up' ? (
        <Field label={t('lookup.dialog.paidBy', 'Paid by')} hint={t('lookup.dialog.paidHint', 'Recorded as taken at the counter. Nothing is charged here.')}>
          <SegmentedControl
            value={paidBy}
            onValueChange={setPaidBy}
            options={[
              { value: 'cash', label: t('lookup.dialog.cash', 'Cash') },
              { value: 'card', label: t('lookup.dialog.byCard', 'Card') },
              { value: 'other', label: t('lookup.dialog.other', 'Other') },
            ]}
          />
        </Field>
      ) : null}
      <Why t={t} value={why} onChange={setWhy} error={on('reason')} />
      {movesTo === null ? null : <Alert tone="info" title={t('lookup.dialog.movesTo', 'Use it by moves to {date}', { date: formatDay(movesTo, locale) })} />}
    </Shell>
  );
}

/** Cancel the card: its own move, with the reason it asks for. */
export function CancelDialog({ t, card, onClose, onSaved }: DialogProps & { card: ShownCard }): ReactNode {
  const move = useStateMove('gift_cards');
  const [why, setWhy] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [saving, setSaving] = useState(false);
  const ending = card.last4 ?? '';
  const save = async (): Promise<void> => {
    if (saving) return;
    if (why.trim() === '') return setSaid({ message: t('lookup.dialog.whyNeeded', 'Say why.'), field: 'void_reason' });
    setSaving(true);
    setSaid(null);
    try {
      await move(card.key, 'cancel-card', { void_reason: why.trim() });
      await onSaved(t('lookup.cancelled', 'The card ending {last4} is cancelled', { last4: ending }));
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Shell t={t} danger title={t('lookup.dialog.cancel', 'Cancel the card ending {last4}?', { last4: ending })} subtitle={t('lookup.dialog.cancelBody', 'What is left on it can no longer be spent. This cannot be undone.')} said={said} saving={saving} saveLabel={t('lookup.cancelCard', 'Cancel the card')} onClose={onClose} onSave={() => void save()}>
      <Why t={t} value={why} onChange={setWhy} error={said?.field === 'void_reason' || said?.field === 'reason' ? said.message : undefined} />
    </Shell>
  );
}

/**
 * Give credit to an address. One credit per address: with none found the
 * credit is made with its first row in one save, and with one found the
 * amount is added to it.
 */
export function CreditDialog({ t, address, card, onClose, onSaved }: DialogProps & { address: string; card: ShownCard | null }): ReactNode {
  const locale = useLocaleTag();
  const cards = useTreeWrite('gift_cards');
  const actions = useWrite('card_actions');
  const [amount, setAmount] = useState('');
  const [why, setWhy] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (): Promise<void> => {
    if (saving) return;
    if (!positive(amount)) return setSaid({ message: t('lookup.dialog.amountNeeded', 'Enter an amount above zero.'), field: 'amount' });
    if (why.trim() === '') return setSaid({ message: t('lookup.dialog.whyNeeded', 'Say why.'), field: 'reason' });
    setSaving(true);
    setSaid(null);
    try {
      if (card === null) await cards.create({ values: { kind: 'credit', owner_email: address.trim() }, children: { card_actions: [{ values: { action: 'issue', amount, reason: why.trim() } }] } });
      else await actions.create({ card_id: keyOf(card.key), action: 'top_up', amount, reason: why.trim() });
      await onSaved(t('lookup.creditGiven', '{amount} credit given to {address}', { amount: money(amount, locale), address: address.trim() }));
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)));
    } finally {
      setSaving(false);
    }
  };
  const on = (field: string): string | undefined => (said?.field === field ? said.message : undefined);
  return (
    <Shell t={t} title={card === null ? t('lookup.dialog.credit', 'Give credit to {address}', { address: address.trim() }) : t('lookup.dialog.creditMore', 'Add credit for {address}', { address: address.trim() })} said={said} saving={saving} saveLabel={card === null ? t('lookup.giveCredit', 'Give credit') : t('lookup.addCredit', 'Add credit')} onClose={onClose} onSave={() => void save()}>
      <NumberInput label={t('lookup.dialog.amount', 'Amount')} value={amount} onChange={setAmount} decimals={2} required {...(on('amount') === undefined ? {} : { error: on('amount') })} />
      <Why t={t} value={why} onChange={setWhy} error={on('reason')} />
      {card === null ? <Alert tone="info" title={t('lookup.dialog.creditMail', 'The customer is told by email.')} /> : null}
    </Shell>
  );
}
