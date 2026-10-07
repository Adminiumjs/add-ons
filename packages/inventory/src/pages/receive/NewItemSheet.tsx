/**
 * A NEW ITEM, FROM A CODE NOTHING MATCHED. Made in Items and added to the
 * delivery in one step. Its SKU is left empty: nobody makes one up.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { Alert, Button, Input, NumberInput, Select, Sheet, SheetBody, SheetFooter, SheetHeader, Stack, Switch, asDataError, lucideByName, useRecords, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';

export interface NewItemSheetProps {
  t: AddOnTranslate;
  /** The code that matched nothing; null keeps the sheet closed. */
  code: string | null;
  onClose: () => void;
  onMade: (item: DataRow) => void;
}

export function NewItemSheet({ t, code, onClose, onMade }: NewItemSheetProps): ReactNode {
  const open = code !== null;
  const items = useWrite('items');
  const units = useRecords('units', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'code', 'name', 'decimals'], enabled: open });
  const settings = useRecords('settings', { pageSize: 1, columns: ['default_unit_id'], enabled: open });
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unitId, setUnitId] = useState('');
  const [packSize, setPackSize] = useState('');
  const [tracks, setTracks] = useState(false);
  const [said, setSaid] = useState<{ field?: string; message: string } | null>(null);
  const [nameMissing, setNameMissing] = useState(false);

  useEffect(() => {
    if (code === null) return;
    setName('');
    setBarcode(code);
    setPackSize('');
    setTracks(false);
    setSaid(null);
    setNameMissing(false);
  }, [code]);

  const defaultUnit = String(settings.rows[0]?.['default_unit_id'] ?? '');
  useEffect(() => {
    if (open && unitId === '' && defaultUnit !== '') setUnitId(defaultUnit);
  }, [open, unitId, defaultUnit]);

  const add = async (): Promise<void> => {
    setSaid(null);
    if (name.trim() === '') {
      setNameMissing(true);
      return;
    }
    try {
      const made = await items.create({
        name: name.trim(),
        ...(barcode.trim() === '' ? {} : { barcode: barcode.trim() }),
        ...(unitId === '' ? {} : { unit_id: unitId }),
        ...(packSize === '' ? {} : { pack_size: packSize }),
        tracks_batches: tracks,
      });
      onMade(made.row);
    } catch (caught) {
      const words = refusal(t, asDataError(caught));
      setSaid({ message: words.message, ...(words.field === undefined ? {} : { field: words.field }) });
    }
  };

  const Icon = lucideByName('package-plus');
  const on = (field: string): { error?: string } => (said?.field === field ? { error: said.message } : {});
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} maxWidth={480}>
      <SheetHeader icon={<Icon />} title={t('receive.newItem.title', 'New item')} subtitle={t('receive.newItem.subtitle', "It's added to Items and to this delivery.")} closeLabel={t('shared.close', 'Close')} />
      <SheetBody>
        <Stack gap="md">
          {said !== null && said.field === undefined ? <Alert tone="danger" role="alert" title={said.message} /> : null}
          <Input
            label={t('receive.newItem.name', 'Name')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameMissing(false);
            }}
            placeholder={t('receive.newItem.nameHint', "As you'd like it to appear on counts")}
            maxLength={120}
            required
            {...(nameMissing ? { error: t('receive.newItem.nameMissing', 'Give the item a name') } : on('name'))}
          />
          <Input label={t('receive.newItem.barcode', 'Barcode')} value={barcode} onChange={(event) => setBarcode(event.target.value)} dir="ltr" maxLength={64} {...on('barcode')} />
          <Select label={t('receive.newItem.unit', 'Counted in')} value={unitId} onChange={(event) => setUnitId(event.target.value)} options={units.rows.map((unit) => ({ value: String(unit['id']), label: String(unit['name'] ?? unit['code'] ?? '') }))} {...on('unit_id')} />
          <NumberInput label={t('receive.newItem.pack', 'Units in a box (optional)')} value={packSize} onChange={setPackSize} decimals={3} {...on('pack_size')} />
          <Switch label={t('receive.newItem.tracks', 'Tracks batches — asks for a batch and expiry date each time it is received')} checked={tracks} onCheckedChange={setTracks} />
        </Stack>
      </SheetBody>
      <SheetFooter>
        <Button variant="secondary" onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" loading={items.saving} onClick={() => void add()}>
          {t('receive.newItem.add', 'Add item and receive')}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
