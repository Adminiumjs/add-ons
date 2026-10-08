/**
 * ONE VOUCHER, for a named person or for whoever holds it. Adminium makes
 * its code and hands it back once; the code is twelve characters and is said
 * with VC, or PK for a pack.
 */
import { useState, type ReactNode } from 'react';

import { todayOf } from '../look-up/read.ts';
import { formatDay } from '../look-up/LookUp.tsx';
import { Button, DateInput, Field, Input, RadioCard, RadioGroup, SheetBody, SheetFooter, Stack, Textarea, asDataError, useLocaleTag, useWrite, type AddOnTranslate } from '../shared/host.ts';
import { Fixes, blankToNull, isEmail, wrongOf, type Wrong } from './form.tsx';
import { Result, onceOf, type Made } from './Result.tsx';
import { NO_WORTH, WorthFields, checkWorth, useWhat, worthValues, type Worth } from './Worth.tsx';

export function VoucherTab({ t, onDone }: { t: AddOnTranslate; onDone: () => void }): ReactNode {
  const locale = useLocaleTag();
  const vouchers = useWrite('vouchers');
  const what = useWhat(t);
  const [worth, setWorth] = useState<Worth>(NO_WORTH);
  const [title, setTitle] = useState('');
  const [holder, setHolder] = useState('named');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [wrong, setWrong] = useState<Wrong>({});
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const tables = what.mapped?.what ?? [];

  const check = (): Wrong => {
    const found = checkWorth(t, worth, tables);
    if (title.trim() === '') found['public_name'] = t('issue.voucher.nameNeeded', 'Say what the voucher is called.');
    // A voucher for one person is checked against who is buying: without an address it could never be used.
    if (holder === 'named' && email.trim() === '') found['holder_email'] = t('issue.voucher.emailNeeded', 'A voucher for a named person needs their email.');
    else if (holder === 'named' && !isEmail(email)) found['holder_email'] = t('issue.emailWrong', 'This is not an email address.');
    if (expires !== '' && expires < todayOf(new Date())) found['expires_on'] = t('issue.expiresAhead', 'Choose today or a later day.');
    return found;
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    const found = check();
    setWrong(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const reply = await vouchers.create({
        ...worthValues(worth, tables),
        public_name: title.trim(),
        holder_name: holder === 'named' ? blankToNull(name) : null,
        holder_email: holder === 'named' ? email.trim() : null,
        expires_on: expires === '' ? null : expires,
        note: blankToNull(note),
        language: locale,
      });
      setMade({
        table: 'vouchers',
        key: String(reply.row['id'] ?? ''),
        once: onceOf(reply.once, 'vouchers'),
        word: worth.worth === 'pack' ? 'PK' : 'VC',
        document: 'voucher',
        facts: [
          { label: t('issue.voucher.name', 'Called'), value: title.trim() },
          ...(holder === 'named' ? [{ label: t('issue.for', 'For'), value: name.trim() === '' ? email.trim() : name.trim() }] : [{ label: t('issue.for', 'For'), value: t('issue.voucher.bearer', 'Whoever holds it') }]),
          { label: t('issue.expires', 'Use it by'), value: expires === '' ? t('issue.never', 'Never expires') : formatDay(expires, locale) },
        ],
      });
    } catch (caught) {
      setWrong(wrongOf(t, asDataError(caught)));
    } finally {
      setSaving(false);
    }
  };

  if (made !== null) return <Result t={t} title={worth.worth === 'pack' ? t('issue.voucher.packIssued', 'Pack issued') : t('issue.voucher.issued', 'Voucher issued')} made={made} onDone={onDone} />;
  const on = (field: string): { error?: string } => (wrong[field] === undefined ? {} : { error: wrong[field] });
  return (
    <>
      <SheetBody>
        <Stack gap="md">
          <Fixes t={t} wrong={what.failed === null ? wrong : { '': what.failed }} />
          <WorthFields t={t} worth={worth} onChange={setWorth} what={what.mapped} wrong={wrong} />
          <Input label={t('issue.voucher.name', 'Called')} hint={t('issue.voucher.nameHint', 'What the customer sees, on the voucher and on their order.')} value={title} maxLength={120} required onChange={(event) => setTitle(event.target.value)} {...on('public_name')} />
          <RadioGroup value={holder} onValueChange={setHolder} aria-label={t('issue.for', 'For')}>
            <RadioCard value="named" title={t('issue.voucher.named', 'A named person')} description={t('issue.voucher.namedHint', 'Only this customer, signed in or named by staff')} />
            <RadioCard value="bearer" title={t('issue.voucher.bearer', 'Whoever holds it')} />
          </RadioGroup>
          {holder === 'named' ? (
            <>
              <Input label={t('issue.voucher.holder', 'Name')} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} {...on('holder_name')} />
              <Input label={t('issue.email', 'Email')} value={email} maxLength={254} dir="ltr" required onChange={(event) => setEmail(event.target.value)} {...on('holder_email')} />
            </>
          ) : null}
          <Field label={t('issue.expires', 'Use it by')} hint={t('issue.expiresHint', 'Leave empty for a voucher that never expires.')} {...on('expires_on')}>
            <DateInput value={expires} onChange={(event) => setExpires(event.target.value)} />
          </Field>
          <Field label={t('issue.note', 'Note')} hint={t('issue.noteHint', 'For staff only.')} {...on('note')}>
            <Textarea value={note} maxLength={200} rows={2} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </Stack>
      </SheetBody>
      <SheetFooter>
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          {t('issue.voucher.save', 'Issue the voucher')}
        </Button>
      </SheetFooter>
    </>
  );
}
