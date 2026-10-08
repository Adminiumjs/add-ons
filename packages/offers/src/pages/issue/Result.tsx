/** "Issued · the full code is shown only this once": the code in its groups, what was made, Print and Done. */
import { useState, type ReactNode } from 'react';

import { CodeChips } from '../shared/codes.tsx';
import { Alert, Button, KeyValueList, SheetFooter, Stack, asDataError, useDocument, type AddOnTranslate, type OnceValue } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { SheetPane } from '../shared/SheetPane.tsx';

export interface Made {
  table: 'gift_cards' | 'vouchers';
  key: string;
  /** The code and its print token, as the save handed them: once. */
  once: OnceValue | null;
  word: string;
  document: 'gift-card' | 'voucher';
  facts: readonly { label: ReactNode; value: ReactNode }[];
}

export function Result({ t, title, made, onDone }: { t: AddOnTranslate; title: string; made: Made; onDone: () => void }): ReactNode {
  const documents = useDocument();
  const [said, setSaid] = useState<string | null>(null);
  const print = async (): Promise<void> => {
    setSaid(null);
    try {
      // The first print shows what the card was loaded with, not a balance on a day.
      await documents.open(made.document, made.table, made.key, { print: true, values: { first: '1' }, ...(made.once === null ? {} : { once: made.once.print }) });
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught), 'print').message);
    }
  };
  return (
    <>
      <SheetPane>
        <Stack gap="md">
          <Alert tone="pos" role="status" title={title} body={made.once === null ? t('issue.result.noCode', 'Its code can be read by a manager.') : t('issue.result.once', 'The full code is shown only this once.')} />
          {made.once === null ? null : <CodeChips code={made.once.value} word={made.word} label={t('issue.result.code', 'The code')} />}
          <KeyValueList items={made.facts} />
          {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
        </Stack>
      </SheetPane>
      <SheetFooter>
        <Button variant="secondary" loading={documents.opening} onClick={() => void print()}>
          {t('issue.print', 'Print')}
        </Button>
        <Button variant="primary" onClick={() => onDone()}>
          {t('issue.done', 'Done')}
        </Button>
      </SheetFooter>
    </>
  );
}

/** The code a save handed back for this row, if it handed one. */
export const onceOf = (once: readonly OnceValue[] | undefined, table: string): OnceValue | null => once?.find((entry) => entry.table === table && entry.column === 'code') ?? null;
