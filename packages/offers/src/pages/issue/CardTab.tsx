/**
 * A GIFT CARD BY HAND: one save makes the card and puts its first value on
 * it, so it is made, issued and active together or not at all. Nothing is
 * charged here: the sheet records that the money was taken at the counter.
 */
import { useState, type ReactNode } from 'react';

import { addDays } from '../../rows/dates.ts';
import { toUnits } from '../../units.ts';
import { todayOf } from '../look-up/read.ts';
import { formatDay } from '../look-up/LookUp.tsx';
import { Button, DateInput, Field, Input, NumberInput, RadioCard, RadioGroup, SegmentedControl, SheetFooter, Stack, Textarea, asDataError, money, useLocaleTag, useRecords, useTreeWrite, type AddOnTranslate } from '../shared/host.ts';
import { Fixes, blankToNull, isEmail, positive, wrongOf, type Wrong } from './form.tsx';
import { Result, onceOf, type Made } from './Result.tsx';
import { SheetPane } from '../shared/SheetPane.tsx';

const PICKS = ['25', '50', '100'];
const MESSAGE_MAX = 200;

export function CardTab({ t, onDone }: { t: AddOnTranslate; onDone: () => void }): ReactNode {
  const locale = useLocaleTag();
  const cards = useTreeWrite('gift_cards');
  const settings = useRecords('settings', { pageSize: 1, columns: ['card_min', 'card_max', 'cards_paused'] });
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [send, setSend] = useState('now');
  const [sendOn, setSendOn] = useState('');
  const [paidBy, setPaidBy] = useState('cash');
  const [why, setWhy] = useState('');
  const [wrong, setWrong] = useState<Wrong>({});
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);

  const limits = settings.rows[0];
  const [low, high] = [limits?.['card_min'] ?? null, limits?.['card_max'] ?? null];
  const today = todayOf(new Date());
  const tomorrow = addDays(today, 1) ?? today;

  const check = (): Wrong => {
    const found: Record<string, string> = {};
    const units = toUnits(amount, 4);
    if (!positive(amount) || units === null) found['amount'] = t('issue.card.amountNeeded', 'Enter an amount above zero.');
    else if ((low !== null && units < (toUnits(low, 4) ?? 0n)) || (high !== null && units > (toUnits(high, 4) ?? units))) found['amount'] = t('issue.card.amountRange', 'From {min} to {max}', { min: money(low, locale), max: money(high, locale) });
    if (send !== 'none' && email.trim() === '') found['recipient_email'] = t('issue.card.emailNeeded', 'Enter an email, or choose not to send it.');
    else if (send !== 'none' && !isEmail(email)) found['recipient_email'] = t('issue.emailWrong', 'This is not an email address.');
    if (send === 'date' && (sendOn === '' || sendOn < tomorrow)) found['send_on'] = t('issue.card.dateAhead', 'Choose a day from tomorrow on.');
    if (why.trim() === '') found['reason'] = t('issue.whyNeeded', 'Say why.');
    return found;
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    const found = check();
    setWrong(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const reply = await cards.create({
        values: {
          kind: 'card',
          recipient_name: blankToNull(name),
          // "Don't send" keeps no address: there is nothing to send to, and nothing to send by mistake later.
          recipient_email: send === 'none' ? null : email.trim(),
          sender_name: blankToNull(from),
          message: blankToNull(message),
          send_on: send === 'date' ? sendOn : null,
          language: locale,
        },
        children: { card_actions: [{ values: { action: 'issue', amount, paid_by: paidBy, reason: why.trim() } }] },
      });
      setMade({
        table: 'gift_cards',
        key: String(reply.row['id'] ?? ''),
        once: onceOf(reply.once, 'gift_cards'),
        word: 'GC',
        document: 'gift-card',
        facts: [
          { label: t('issue.card.amount', 'Amount'), value: <span dir="ltr">{money(amount, locale)}</span> },
          ...(name.trim() === '' ? [] : [{ label: t('issue.for', 'For'), value: name.trim() }]),
          ...(from.trim() === '' ? [] : [{ label: t('issue.from', 'From'), value: from.trim() }]),
          { label: t('issue.card.sending', 'Sending'), value: send === 'none' ? t('issue.card.notSent', 'Not sent') : send === 'date' ? t('issue.card.queuedFor', 'Queued for {date}', { date: formatDay(sendOn, locale) }) : t('issue.card.queuedNow', 'Queued now') },
        ],
      });
    } catch (caught) {
      const error = asDataError(caught);
      // While the till's cards are being brought in, no card is made by hand.
      setWrong(error.code === 'POSTING_REFUSED' && error.details?.['reason'] === 'not-allowed' && [true, 1, '1', 'true'].includes(limits?.['cards_paused'] as never) ? { '': t('issue.card.paused', 'Gift cards are being brought in from the till. Try again when that has finished.') } : wrongOf(t, error));
    } finally {
      setSaving(false);
    }
  };

  if (made !== null) return <Result t={t} title={t('issue.card.issued', 'Gift card issued')} made={made} onDone={onDone} />;
  const on = (field: string): { error?: string } => (wrong[field] === undefined ? {} : { error: wrong[field] });
  return (
    <>
      <SheetPane>
        <Stack gap="md">
          <Fixes t={t} wrong={wrong} />
          <Stack direction="row" gap="sm" wrap>
            {PICKS.map((pick) => (
              <Button key={pick} variant={amount === pick ? 'primary' : 'secondary'} size="sm" onClick={() => setAmount(pick)}>
                <span dir="ltr">{money(pick, locale)}</span>
              </Button>
            ))}
          </Stack>
          <NumberInput label={t('issue.card.amount', 'Amount')} value={amount} onChange={setAmount} decimals={2} required {...on('amount')} {...(low === null || high === null ? {} : { hint: t('issue.card.amountRange', 'From {min} to {max}', { min: money(low, locale), max: money(high, locale) }) })} />
          <Input label={t('issue.for', 'For')} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} {...on('recipient_name')} />
          <Input label={t('issue.email', 'Email')} value={email} maxLength={254} dir="ltr" onChange={(event) => setEmail(event.target.value)} {...on('recipient_email')} />
          <Field label={t('issue.card.message', 'A message')} hint={t('issue.card.messageLeft', '{n} of {max}', { n: message.length, max: MESSAGE_MAX })} {...on('message')}>
            <Textarea value={message} maxLength={MESSAGE_MAX} rows={3} onChange={(event) => setMessage(event.target.value)} />
          </Field>
          <Input label={t('issue.from', 'From')} value={from} maxLength={80} onChange={(event) => setFrom(event.target.value)} {...on('sender_name')} />
          <RadioGroup value={send} onValueChange={setSend} aria-label={t('issue.card.send', 'Send')}>
            <RadioCard value="now" title={t('issue.card.sendNow', 'Now')} />
            <RadioCard value="date" title={t('issue.card.sendOn', 'On a date')} />
            <RadioCard value="none" title={t('issue.card.sendNone', "Don't send, I'll print it")} />
          </RadioGroup>
          {send === 'date' ? (
            <Field label={t('issue.card.sendDay', 'Send it on')} required {...on('send_on')}>
              <DateInput value={sendOn} onChange={(event) => setSendOn(event.target.value)} />
            </Field>
          ) : null}
          <Field label={t('issue.card.paidBy', 'Paid by')} hint={t('issue.card.paidHint', 'Recorded as sold at the counter · Nothing is charged here')}>
            <SegmentedControl
              value={paidBy}
              onValueChange={setPaidBy}
              options={[
                { value: 'cash', label: t('issue.card.cash', 'Cash') },
                { value: 'card', label: t('issue.card.byCard', 'Card') },
                { value: 'other', label: t('issue.card.other', 'Other') },
              ]}
            />
          </Field>
          <Field label={t('issue.why', 'Why')} required {...on('reason')}>
            <Textarea value={why} maxLength={200} rows={2} onChange={(event) => setWhy(event.target.value)} />
          </Field>
        </Stack>
      </SheetPane>
      <SheetFooter>
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          {t('issue.card.save', 'Issue the card')}
        </Button>
      </SheetFooter>
    </>
  );
}
