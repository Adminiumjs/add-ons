/**
 * FIND OR SCAN.
 *
 * A scanner types into this field and presses Enter; a person types a name
 * and picks from the list. Either way the SERVER is asked — by barcode, then
 * by SKU, then by name — among active items only: the screen holds no copy of
 * the catalogue. Enter submits and the field keeps the focus, so the next
 * scan needs no click. No camera.
 */
import { useRef, useState, type ReactNode, type Ref } from 'react';

import { Alert, Button, SearchInput, Spinner, Stack, asDataError, useRead, useRecords, type AddOnTranslate, type DataFilter, type DataRow } from './host.ts';

/** What every list of items here reads: nothing a clerk may not see. */
export const ITEM_COLUMNS = ['id', 'name', 'sku', 'barcode', 'unit', 'decimals', 'tracks_batches', 'pack_name', 'pack_size'] as const;

const PICK = 'item:';
const ACTIVE: DataFilter = { column: 'active', op: 'eq', value: true };
const same = (a: unknown, b: string): boolean => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

export interface FindOrScanProps {
  t: AddOnTranslate;
  /** An item was found: by a scan, or picked from the list. */
  onFound: (item: DataRow) => void;
  /** Offered when nothing matches and the reader may add items. */
  onAddNew?: (code: string) => void;
  /** Said under the field: what a scan does here. */
  hint: string;
  /** What "nothing matched" reads as; `{code}` is what was typed. */
  missing?: (code: string) => string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  table?: string;
  columns?: readonly string[];
  /** More conditions every answer must meet. */
  where?: readonly DataFilter[];
  /** The columns a scan is matched against, in order, before the name. */
  codes?: readonly string[];
  name?: string;
}

export function FindOrScan({ t, onFound, onAddNew, hint, missing, disabled, inputRef, table = 'items', columns = ITEM_COLUMNS, where, codes = ['barcode', 'sku'], name = 'name' }: FindOrScanProps): ReactNode {
  const read = useRead();
  const [typed, setTyped] = useState('');
  const [asking, setAsking] = useState(false);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const turn = useRef(0);
  const base = where ?? (table === 'items' ? [ACTIVE] : []);
  const term = typed.trim();

  const listed = useRecords(table, { filter: [...base, { column: name, op: 'contains', value: term }], pageSize: 5, columns, sort: [{ column: name, direction: 'asc' }], enabled: term.length >= 2 });
  const options = term.length >= 2 && !listed.loading ? listed.rows.map((row) => ({ value: `${PICK}${String(row['id'])}`, label: optionLabel(row, name) })) : [];

  const take = (row: DataRow): void => {
    setTyped('');
    setUnknown(null);
    onFound(row);
  };

  /** By each code in turn, then by name — and by name only an answer that leaves no doubt. */
  const ask = async (code: string): Promise<DataRow | null> => {
    for (const column of codes) {
      const { rows } = await read.list(table, { filter: [...base, { column, op: 'eq', value: code }], pageSize: 2, columns });
      const hit = rows.find((row) => same(row[column], code));
      if (hit !== undefined) return hit;
    }
    const { rows, hasMore } = await read.list(table, { filter: [...base, { column: name, op: 'contains', value: code }], pageSize: 5, columns });
    return rows.find((row) => same(row[name], code)) ?? (rows.length === 1 && !hasMore ? (rows[0] as DataRow) : null);
  };

  const submit = (value: string): void => {
    if (value.startsWith(PICK)) {
      const row = listed.rows.find((candidate) => `${PICK}${String(candidate['id'])}` === value);
      if (row !== undefined) take(row);
      return;
    }
    const code = value.trim();
    if (code === '') return;
    const mine = (turn.current += 1);
    setUnknown(null);
    setFailed(null);
    setAsking(true);
    ask(code)
      .then((row) => {
        // A scan answered after a later one is not the last word.
        if (mine !== turn.current) return;
        if (row === null) setUnknown(code);
        else take(row);
      })
      .catch((caught: unknown) => {
        if (mine === turn.current) setFailed(asDataError(caught).message);
      })
      .finally(() => {
        if (mine === turn.current) setAsking(false);
      });
  };

  return (
    <Stack gap="xs">
      <SearchInput
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onSubmit={submit}
        options={options}
        placeholder={t('shared.scan.placeholder', 'Scan a barcode, or type a name or code')}
        aria-label={t('shared.scan.label', 'Find or scan')}
        kbd="Enter"
        dir="ltr"
        autoFocus
        {...(disabled === undefined ? {} : { disabled })}
        {...(inputRef === undefined ? {} : { ref: inputRef })}
      />
      <span className="text-body-sm text-fg-muted">{hint}</span>
      {asking ? <Spinner size="sm" label={t('shared.scan.asking', 'Looking it up')} /> : null}
      {failed === null ? null : <Alert tone="danger" role="alert" title={t('shared.scan.failed', 'This could not be looked up')} body={failed} />}
      {unknown === null ? null : (
        <Alert
          tone="danger"
          role="alert"
          title={missing === undefined ? t('shared.scan.unknown', 'No item has this code · {code}', { code: unknown }) : missing(unknown)}
          action={
            <Stack direction="row" gap="xs">
              {onAddNew === undefined ? null : (
                <Button variant="secondary" size="sm" onClick={() => onAddNew(unknown)}>
                  {t('shared.scan.addNew', 'Add it as a new item')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setUnknown(null)}>
                {t('shared.dismiss', 'Dismiss')}
              </Button>
            </Stack>
          }
        />
      )}
    </Stack>
  );
}

function optionLabel(row: DataRow, name: string): ReactNode {
  const sku = row['sku'];
  return typeof sku === 'string' && sku !== '' ? `${String(row[name] ?? '')} · ${sku}` : String(row[name] ?? '');
}
