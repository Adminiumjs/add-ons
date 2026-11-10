/**
 * A NEW BASE: its name (the product's), its kind and the app it is for.
 *
 * It starts as the comp's figures start: a page at 85 × 55 mm with the
 * settings' bleed and safe line, one side; a piece at 95 × 95 mm. It offers
 * the open-licence starter fonts and the app's finishes to begin with, and
 * is not offered to anyone until it is published.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { asDataError, Button, Dialog, DialogBody, DialogFooter, DialogHeader, Input, RadioCard, RadioGroup, Select, Stack, useAccess, useRead, useWrite, type AddOnTranslate, type Reads } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { APPS, SET_UP_NOW, num, text, type App, type Kind } from './facts.ts';
import { optionsTable } from './PricesStep.tsx';

/**
 * The shop apps a new base may be made for by this reader: those on the
 * install whose own tables the reader's role reads (an app's owner reads its
 * app's, never the other's). A reader who reads neither's (the Customiser's
 * own roles) is offered every app on the install.
 */
export async function appsFor(read: Reads, installed: readonly App[]): Promise<readonly App[]> {
  const mine = await Promise.all(
    installed.map(async (app) => {
      try {
        await read.list(optionsTable(app), { pageSize: 1 });
        return app;
      } catch {
        return null;
      }
    }),
  );
  const own = mine.filter((app): app is App => app !== null);
  return own.length > 0 ? own : installed.length > 0 ? installed : APPS;
}

export function kindName(t: AddOnTranslate, kind: Kind): string {
  switch (kind) {
    case 'page':
      return t('setup.kind.page', 'A flat page');
    case 'piece':
      return t('setup.kind.piece', 'A flat piece');
    case 'kit':
      return t('setup.kind.kit', 'A kit of pieces');
    default:
      return t('setup.kind.printed', 'A 3D-printed item');
  }
}

/**
 * The kind a new base starts on for an app: what that app's bases are. A
 * print shop prints flat pages; a maker shop makes pieces (and kits and
 * printed items, picked by hand).
 */
export const startingKind = (app: App): Kind => (app === 'printing' ? 'page' : 'piece');

export function NewBase({ t, open, onClose, onMade }: { t: AddOnTranslate; open: boolean; onClose: () => void; onMade: (id: string | number) => void }): ReactNode {
  const [name, setName] = useState('');
  // The kind the owner picked; until they pick one, the app's own (once it is known which app).
  const [picked, setKind] = useState<Kind | null>(null);
  const [chosen, setApp] = useState<App>('maker');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bases = useWrite('bases');
  const read = useRead();
  const toast = useToast();
  const access = useAccess();
  // Which apps this reader may make a base for, asked each time the dialog opens; the choice is shown only where there are two.
  const installed = access.ready ? APPS.filter((one) => access.canRead(optionsTable(one))) : [];
  const installedKey = installed.join(',');
  const [apps, setApps] = useState<readonly App[] | null>(null);
  const asking = useRef<Promise<readonly App[]> | null>(null);
  useEffect(() => {
    if (!open || !access.ready) return;
    let live = true;
    const asked = appsFor(read, installedKey === '' ? [] : (installedKey.split(',') as App[]));
    asking.current = asked;
    void asked.then((found) => {
      if (!live) return;
      setApps(found);
      setApp((current) => (found.includes(current) ? current : found[0]!));
    });
    return () => {
      live = false;
    };
  }, [open, access.ready, installedKey, read]);
  const make = async (): Promise<void> => {
    if (name.trim() === '') {
      setError(t('setup.new.nameNeeded', 'Give it the product’s name, so you know it in the list.'));
      return;
    }
    setSaving(true);
    try {
      const offered = apps ?? (asking.current === null ? APPS : await asking.current);
      const app = offered.includes(chosen) ? chosen : offered[0]!;
      const kind = picked ?? startingKind(app);
      const [settings, fonts, palettes] = await Promise.all([read.list('settings', { pageSize: 1 }), read.list('fonts', { filter: [{ column: 'starter', op: 'eq', value: true }, { column: 'active', op: 'eq', value: true }], pageSize: 199 }), read.list('palettes', { filter: [{ column: 'app', op: 'eq', value: app }, { column: 'kind', op: 'eq', value: 'finishes' }], pageSize: 20 })]);
      const own = palettes.rows.find((row) => row['ready_design_id'] === null || row['ready_design_id'] === undefined);
      const finishes = own === undefined || kind === 'page' ? [] : (await read.list('palette_colours', { filter: [{ column: 'palette_id', op: 'eq', value: own['id'] as string | number }], pageSize: 50 })).rows.map((row) => text(row['code']));
      const defaults = settings.rows[0];
      const page = kind === 'page';
      const { row } = await bases.create({
        name: name.trim(),
        kind,
        app,
        width_mm: page ? 85 : 95,
        height_mm: page ? 55 : 95,
        ...(page ? { bleed_mm: num(defaults?.['default_bleed_mm']) ?? 3, safe_mm: num(defaults?.['default_safe_mm']) ?? 4, sides: 1 } : {}),
        offered: JSON.stringify({ fonts: fonts.rows.map((font) => text(font['family'])), finishes }),
        state: 'draft',
      });
      toast(t('setup.new.made', '“{name}” is ready to set up.', { name: name.trim() }));
      setName('');
      setKind(null);
      setError(null);
      onClose();
      onMade(row['id'] as string | number);
    } catch (caught) {
      setError(refusal(t, asDataError(caught)).message);
    } finally {
      setSaving(false);
    }
  };
  // None is marked until the apps this reader may make a base for are known: a print shop never sees "A flat piece" picked first.
  const shownKind = picked ?? (apps === null ? undefined : startingKind(apps.includes(chosen) ? chosen : apps[0]!));
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())} size="md">
      <DialogHeader title={t('setup.newBase', 'New base')} subtitle={t('setup.new.sub', 'What a customer makes their own.')} closeLabel={t('setup.close', 'Close')} />
      <DialogBody>
        <Stack gap="md">
          <Input label={t('setup.new.name', 'Name')} value={name} onChange={(event) => setName(event.target.value)} error={error ?? undefined} maxLength={120} />
          <RadioGroup value={shownKind ?? ''} onValueChange={(value) => setKind(value as Kind)} aria-label={t('setup.new.kind', 'Kind of base')}>
            {(['page', 'piece', 'kit', 'printed'] as const).map((one) => (
              <RadioCard key={one} value={one} title={kindName(t, one)} disabled={!SET_UP_NOW.includes(one)} {...(SET_UP_NOW.includes(one) ? {} : { description: t('setup.new.later', 'Comes with the 3D preview.') })} />
            ))}
          </RadioGroup>
          {apps !== null && apps.length > 1 ? <Select label={t('setup.new.app', 'For')} value={chosen} onChange={(event) => setApp(event.target.value as App)} options={apps.map((one) => ({ value: one, label: one === 'maker' ? t('setup.app.maker', 'The maker shop') : t('setup.app.printing', 'The print shop') }))} /> : null}
        </Stack>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {t('setup.cancel', 'Cancel')}
        </Button>
        <Button loading={saving} onClick={() => void make()}>
          {t('setup.new.make', 'Make it')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
