/**
 * A BATCH OF CODES: a leaflet drop, a mailing. The batch is one row; its
 * vouchers are made in parts of five hundred, each part a save of its own,
 * so a batch of five thousand never holds one long save open. A part that
 * was not run is sent once more; what is still missing after that is
 * finished from the batch's own record.
 *
 * THE FILE IS ADMINIUM'S. The codes are downloaded through Adminium's export,
 * which checks who asks and writes it down — never put together here.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { todayOf } from '../look-up/read.ts';
import { formatDay } from '../look-up/LookUp.tsx';
import { Alert, Button, DateInput, Field, Input, Link, NumberInput, ProgressBar, SheetFooter, Stack, asDataError, useExport, useLocaleTag, useRead, useRecord, useWrite, type AddOnTranslate, type DataValue, type EachResult } from '../shared/host.ts';
import { BATCHES, recordAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { Fixes, wrongOf, type Wrong } from './form.tsx';
import { NO_WORTH, WorthFields, checkWorth, useWhat, worthValues, type Worth } from './Worth.tsx';
import { SheetPane } from '../shared/SheetPane.tsx';

/** The most vouchers one part makes, and the most one batch holds. */
export const PART = 500;
export const BATCH_MAX = 5000;

/** A batch of so many as parts: full ones, then what is left. */
export function partsOf(count: number): number[] {
  const parts: number[] = [];
  for (let left = count; left > 0; left -= PART) parts.push(Math.min(PART, left));
  return parts;
}

type Stage = { at: 'form' } | { at: 'making'; batch: string; count: number } | { at: 'done'; batch: string; count: number; made: number };

export function BatchTab({ t, onDone }: { t: AddOnTranslate; onDone: () => void }): ReactNode {
  const locale = useLocaleTag();
  const batches = useWrite('voucher_batches');
  const chunks = useWrite('batch_chunks');
  const exports = useExport();
  const reads = useRead();
  const what = useWhat(t);
  const [worth, setWorth] = useState<Worth>(NO_WORTH);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [count, setCount] = useState('');
  const [expires, setExpires] = useState('');
  const [wrong, setWrong] = useState<Wrong>({});
  const [stage, setStage] = useState<Stage>({ at: 'form' });
  const [said, setSaid] = useState<string | null>(null);
  const tables = what.mapped?.what ?? [];
  const watched = useRecord('voucher_batches', stage.at === 'form' ? null : stage.batch);
  const { refetch } = watched;

  // While the parts are being made, the batch's own count is read each second: the figure shown is Adminium's.
  useEffect(() => {
    if (stage.at !== 'making') return undefined;
    const timer = setInterval(() => refetch(), 1000);
    return () => clearInterval(timer);
  }, [stage.at, refetch]);

  const check = (): Wrong => {
    const found = checkWorth(t, worth, tables);
    if (name.trim() === '') found['name'] = t('issue.batch.nameNeeded', 'Name the batch.');
    if (title.trim() === '') found['public_name'] = t('issue.voucher.nameNeeded', 'Say what the voucher is called.');
    const many = Number(count);
    if (!/^\d+$/.test(count) || many < 1 || many > BATCH_MAX) found['count'] = t('issue.batch.countRange', 'From 1 to {max}', { max: BATCH_MAX });
    if (expires === '') found['expires_on'] = t('issue.batch.expiresNeeded', 'Say when the codes stop working.');
    else if (expires < todayOf(new Date())) found['expires_on'] = t('issue.expiresAhead', 'Choose today or a later day.');
    return found;
  };

  const make = async (): Promise<void> => {
    if (batches.saving || stage.at !== 'form') return;
    const found = check();
    setWrong(found);
    if (Object.keys(found).length > 0) return;
    const many = Number(count);
    let batch: string;
    try {
      const reply = await batches.create({ name: name.trim(), count: many, ...worthValues(worth, tables), public_name: title.trim(), expires_on: expires });
      batch = String(reply.row['id'] ?? '');
    } catch (caught) {
      setWrong(wrongOf(t, asDataError(caught)));
      return;
    }
    setStage({ at: 'making', batch, count: many });
    const id: DataValue = /^\d+$/.test(batch) ? Number(batch) : batch;
    const sizes = partsOf(many);
    try {
      const sent = (list: readonly number[]): Promise<readonly EachResult[]> => chunks.createEach(list.map((size) => ({ batch_id: id, size })));
      const first = await sent(sizes);
      const again = sizes.filter((_, index) => first[index]?.ok !== true);
      // A part that was not run, or was refused, is sent once more and no more.
      const second = again.length === 0 ? [] : await sent(again);
      const refused = [...second].find((result): result is Extract<EachResult, { ok: false; error: unknown }> => !result.ok && 'error' in result);
      if (refused !== undefined) setSaid(refusal(t, refused.error).message);
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    }
    // How many were made is the batch's own count, read now: an answer lost on the way does not make them unmade.
    let made = 0;
    try {
      made = Number((await reads.get('voucher_batches', id as string | number))?.['made'] ?? 0) || 0;
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    }
    setStage({ at: 'done', batch, count: many, made });
  };

  const download = async (): Promise<void> => {
    if (stage.at !== 'done') return;
    setSaid(null);
    try {
      const id = await exports.start('vouchers', { filter: [{ column: 'batch_id', op: 'eq', value: /^\d+$/.test(stage.batch) ? Number(stage.batch) : stage.batch }], columns: ['code', 'public_name', 'worth', 'value', 'expires_on'], format: 'csv' });
      await exports.download(id);
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    }
  };

  if (stage.at !== 'form') {
    const shown = stage.at === 'done' ? stage.made : Number(watched.row?.['made'] ?? 0);
    const whole = stage.at === 'done' && stage.made >= stage.count;
    return (
      <>
        <SheetPane>
          <Stack gap="md">
            {stage.at === 'making' ? <Alert tone="info" role="status" title={t('issue.batch.making', 'Making the codes')} body={t('issue.batch.progress', '{made} of {count}', { made: shown, count: stage.count })} /> : null}
            {stage.at === 'done' && whole ? <Alert tone="pos" role="status" title={t('issue.batch.made', '{count} codes made', { count: stage.count })} body={t('issue.batch.again', 'You can download them again from Voucher batches.')} /> : null}
            {stage.at === 'done' && !whole ? (
              <Alert tone="warn" role="alert" title={t('issue.batch.part', '{made} of {count} made. Finish it under Voucher batches.', { made: stage.made, count: stage.count })} action={<Link to={recordAt(BATCHES, stage.batch)}>{t('issue.batch.open', 'Open the batch')}</Link>} />
            ) : null}
            <ProgressBar value={shown} max={stage.count} label={t('issue.batch.progress', '{made} of {count}', { made: shown, count: stage.count })} />
            {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
          </Stack>
        </SheetPane>
        <SheetFooter>
          {stage.at === 'done' && stage.made > 0 ? (
            <Button variant="secondary" loading={exports.running} onClick={() => void download()}>
              {t('issue.batch.download', 'Download the codes (CSV)')}
            </Button>
          ) : null}
          <Button variant="primary" disabled={stage.at === 'making'} onClick={() => onDone()}>
            {t('issue.done', 'Done')}
          </Button>
        </SheetFooter>
      </>
    );
  }

  const on = (field: string): { error?: string } => (wrong[field] === undefined ? {} : { error: wrong[field] });
  const many = /^\d+$/.test(count) ? Number(count) : 0;
  return (
    <>
      <SheetPane>
        <Stack gap="md">
          <Fixes t={t} wrong={what.failed === null ? wrong : { '': what.failed }} />
          <Input label={t('issue.batch.name', 'Name of the batch')} hint={t('issue.noteHint', 'For staff only.')} value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} {...on('name')} />
          <NumberInput label={t('issue.batch.count', 'How many')} value={count} onChange={setCount} whole required hint={t('issue.batch.countRange', 'From 1 to {max}', { max: BATCH_MAX })} {...on('count')} />
          <WorthFields t={t} worth={worth} onChange={setWorth} what={what.mapped} wrong={wrong} />
          <Input label={t('issue.voucher.name', 'Called')} hint={t('issue.voucher.nameHint', 'What the customer sees, on the voucher and on their order.')} value={title} maxLength={120} required onChange={(event) => setTitle(event.target.value)} {...on('public_name')} />
          <Field label={t('issue.expires', 'Use it by')} required {...on('expires_on')}>
            <DateInput value={expires} onChange={(event) => setExpires(event.target.value)} />
          </Field>
          {many > 0 && expires !== '' ? <Alert tone="info" title={t('issue.batch.readBack', '{count, plural, one {# code} other {# codes}}, each good once, until {date}', { count: many, date: formatDay(expires, locale) })} /> : null}
        </Stack>
      </SheetPane>
      <SheetFooter>
        <Button variant="primary" loading={batches.saving} onClick={() => void make()}>
          {t('issue.batch.save', 'Make the codes')}
        </Button>
      </SheetFooter>
    </>
  );
}
