/**
 * STEP 4, FONTS & FINISHES: which typefaces and finishes this base offers.
 *
 * The fonts are the install's: the open-licence starter set (each named by
 * its own family, with its licence, read "Open licence": a licence, never a
 * price) and the shop's own uploads (WOFF2, up to 2 MB, checked by its first
 * bytes before Adminium reads it again). A switch offers a font on this base;
 * an area or a part offers some of the base's. Finishes are the app's own
 * palette of finishes, each switched on for this base the same way.
 */
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { Alert, asDataError, Button, Card, FileInput, Figure, Grid, Input, Stack, Switch, Tag, useUploader, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from './data.ts';
import { codeFor, familyFromFile, FONT_BYTES, fontUse, isWoff2, kindOf, mm, num, offeredOf, text, toggled, yes, type Offered } from './facts.ts';

export function FontsStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const bases = useWrite('bases');
  const toast = useToast();
  const offered = offeredOf(base);
  const id = base['id'] as string | number;
  const offer = (next: Offered): void => void bases.update(id, { offered: JSON.stringify(next) }).catch((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'));
  const kind = kindOf(base);
  return (
    <Grid columns={2} gap="lg">
      <Fonts t={t} base={base} data={data} offered={offered} offer={offer} />
      {kind === 'page' ? (
        <Card title={t('setup.finishes.title', 'Finishes offered')}>
          <p className="m-0 text-[12.5px] leading-relaxed text-fg-muted">{t('setup.finishes.page', 'A printed page takes its colours from the design. The colours a customer can pick are set on each design.')}</p>
        </Card>
      ) : kind === 'printed' ? (
        <Card title={t('setup.finishes.title', 'Finishes offered')}>
          <p className="m-0 text-[12.5px] leading-relaxed text-fg-muted">{t('setup.finishes.printed', 'A printed piece takes its colour from the filament. The colours a shopper can pick are set on the design.')}</p>
        </Card>
      ) : (
        <Finishes t={t} base={base} data={data} offered={offered} offer={offer} />
      )}
    </Grid>
  );
}

function Fonts({ t, base, data, offered, offer }: { t: AddOnTranslate; base: DataRow; data: SetupData; offered: Offered; offer: (next: Offered) => void }): ReactNode {
  const upload = useUploader('fonts', 'file');
  const fonts = useWrite('fonts');
  const toast = useToast();
  const licence = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const used = fontUse(data.parts);
  const count = data.fonts.filter((font) => offered.fonts.includes(text(font['family']))).length;
  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || upload === null) return;
    if (!/\.woff2$/i.test(file.name)) return setError(t('setup.font.notWoff2', '{file}: That isn’t a WOFF2 font.', { file: file.name }));
    if (file.size > FONT_BYTES) return setError(t('setup.font.tooBig', '{file}: That file is over 2 MB.', { file: file.name }));
    if (!isWoff2(new Uint8Array(await file.slice(0, 4).arrayBuffer()))) return setError(t('setup.font.renamed', '{file}: That file doesn’t look like a WOFF2 font. It may have been renamed.', { file: file.name }));
    setBusy(true);
    let made: string | number | null = null;
    try {
      const family = familyFromFile(file.name) || t('setup.font.uploaded', 'Uploaded font');
      const taken = data.fonts.map((font) => text(font['family']));
      const name = taken.includes(family) ? codeFor(family, taken, 'font') : family;
      const { row } = await fonts.create({ app: text(base['app']) === '' ? null : text(base['app']), family: name, name, licence: t('setup.font.ownLicence', 'The shop’s own licence'), starter: false, active: true });
      made = row['id'] as string | number;
      // The upload saves the font's row with its file: no second save.
      await upload.upload(made, file, { name: file.name });
      setError(null);
      toast(t('setup.font.added', 'Font added. Shoppers see it once you switch it on.'));
    } catch (caught) {
      // A font row with no file is no font: take it back.
      if (made !== null) await fonts.remove(made).catch(() => undefined);
      setError(t('setup.outline.refused', '{file}: {why}', { file: file.name, why: asDataError(caught).message || refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t('setup.fonts.title', 'Fonts')} actions={<Figure>{t('setup.fonts.count', '{n} offered', { n: count })}</Figure>}>
      <Stack gap="md">
        <ul className="m-0 flex list-none flex-col">
          {data.fonts.map((font) => {
            const family = text(font['family']);
            const starter = yes(font['starter']);
            const smallest = num(font['smallest_mm']);
            const designs = used.get(family)?.size ?? 0;
            return (
              <li key={String(font['id'])} className="flex items-center gap-3 border-b border-border py-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <svg viewBox="0 0 320 30" width="100%" height="30" role="img" aria-label={t('setup.fonts.sampleAlt', '{name}, in {family}', { name: text(base['name']), family })}>
                    <text x="0" y="24" fontFamily={family} fontSize="22" fill="var(--fg)">
                      {text(base['name'])}
                    </text>
                  </svg>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-extrabold">{text(font['name'])}</span>
                    <Tag tone={starter ? 'pos' : 'info'}>{starter ? t('setup.fonts.open', 'Open licence') : t('setup.fonts.own', 'Uploaded')}</Tag>
                    <span className="font-mono text-[10.5px] text-fg-subtle">
                      {[text(font['licence']), smallest === null ? null : t('setup.fonts.smallest', 'smallest {n} mm', { n: mm(smallest) }), designs === 0 ? t('setup.fonts.unused', 'Not used yet') : t('setup.fonts.used', 'Used in {n, plural, one {# design} other {# designs}}', { n: designs })].filter((part) => part !== null).join(' · ')}
                    </span>
                  </span>
                </span>
                <Switch label={<span className="sr-only">{t('setup.fonts.offer', 'Offer {name}', { name: text(font['name']) })}</span>} checked={offered.fonts.includes(family)} onCheckedChange={() => offer(toggled(offered, 'fonts', family))} />
                {starter ? null : (
                  <Button variant="ghost" size="sm" aria-label={t('setup.fonts.removeAria', 'Remove {name}', { name: text(font['name']) })} onClick={() => void fonts.remove(font['id'] as string | number).catch((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'))}>
                    {t('setup.fonts.remove', 'Remove')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <Stack gap="sm">
          {upload === null ? <Alert tone="warn" title={t('setup.upload.none', 'Uploading here needs a newer Adminium.')} body={t('setup.upload.noneBody', 'Ask whoever runs Adminium to update it. Everything else on this page works now.')} /> : null}
          <FileInput type="file" accept=".woff2,font/woff2" label={t('setup.font.upload', 'Upload a font (WOFF2)')} hint={<span id={licence}>{t('setup.font.licence', 'Only upload fonts your licence lets you use on products you sell.')}</span>} disabled={upload === null || busy} error={error ?? undefined} onChange={(event) => void pick(event)} />
          <Figure>{t('setup.font.limits', '.woff2 · up to 2 MB')}</Figure>
        </Stack>
      </Stack>
    </Card>
  );
}

function Finishes({ t, base, data, offered, offer }: { t: AddOnTranslate; base: DataRow; data: SetupData; offered: Offered; offer: (next: Offered) => void }): ReactNode {
  const palettes = useWrite('palettes');
  const colours = useWrite('palette_colours');
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#3a2414');
  const [error, setError] = useState<string | null>(null);
  const app = text(base['app']) === '' ? null : text(base['app']);
  const add = async (): Promise<void> => {
    if (name.trim() === '') return setError(t('setup.finishes.nameNeeded', 'Name the finish as a shopper will read it.'));
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return setError(t('setup.finishes.hexNeeded', 'Give its colour as # and six figures, like #3a2414.'));
    try {
      const palette = data.finishPalette ?? (await palettes.create({ app, kind: 'finishes', code: 'finishes', name: t('setup.finishes.title', 'Finishes offered'), position: 1 })).row;
      const code = codeFor(name, data.finishes.map((one) => text(one['code'])), 'finish');
      await colours.create({ app, palette_id: palette['id'] as string | number, code, name: name.trim(), hex: hex.toLowerCase(), position: data.finishes.length + 1 });
      offer(toggled(offered, 'finishes', code));
      setName('');
      setError(null);
    } catch (caught) {
      setError(refusal(t, asDataError(caught)).message);
    }
  };
  return (
    <Card title={t('setup.finishes.title', 'Finishes offered')}>
      <Stack gap="md">
        <ul className="m-0 flex list-none flex-col">
          {data.finishes.map((finish) => {
            const code = text(finish['code']);
            return (
              <li key={String(finish['id'])} className="flex items-center gap-3 border-b border-border py-2.5">
                <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
                  <circle cx="15" cy="15" r="14" fill={text(finish['hex'])} stroke="var(--border-strong)" />
                </svg>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-extrabold">{text(finish['name'])}</span>
                  <span className="font-mono text-[12px] text-fg-subtle">{text(finish['hex'])}</span>
                </span>
                <Switch label={<span className="sr-only">{t('setup.fonts.offer', 'Offer {name}', { name: text(finish['name']) })}</span>} checked={offered.finishes.includes(code)} onCheckedChange={() => offer(toggled(offered, 'finishes', code))} />
              </li>
            );
          })}
        </ul>
        {data.finishes.length === 0 ? <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.finishes.none', 'No finishes yet. Add the ones you make: engraved, painted white, painted black.')}</p> : null}
        <Stack direction="row" gap="sm" align="end" wrap>
          <Input label={t('setup.finishes.name', 'A finish')} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} error={error ?? undefined} />
          <Input label={t('setup.finishes.hex', 'Its colour')} value={hex} maxLength={7} dir="ltr" onChange={(event) => setHex(event.target.value)} />
          <Button variant="secondary" onClick={() => void add()}>
            {t('setup.finishes.add', 'Add a finish')}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
