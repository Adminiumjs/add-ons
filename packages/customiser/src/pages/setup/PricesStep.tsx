/**
 * STEP 5, PRICES: the priced features ("Your own logo").
 *
 * A feature here is a name shoppers read and a code the app's option row
 * names. Its price is the app's own (CR2): an option of the product, priced
 * flat per piece like any other option, never discounted by a quantity
 * break. The Customiser keeps no price, so this step edits the feature rows
 * and says where each price is set; nothing here writes a figure.
 *
 * Each price is READ from the app's own option rows, which link to the
 * feature (`<app>:options`, its `feature_id` and `price`), with the reader's
 * own grant on them. A reader the app's role does not let read them, or an
 * app with no such rows, sees each feature without its price and the note
 * saying where it is set.
 */
import { useState, type ReactNode } from 'react';

import { asDataError, Button, Card, Figure, IconButton, Input, lucideByName, Stack, Switch, useAccess, useLocaleTag, useRecords, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from './data.ts';
import { codeFor, text, yes } from './facts.ts';

const Trash = lucideByName('trash-2');

/** The app's table whose rows price the Customiser's features, as the kit names a table that links into the add-on. */
export const optionsTable = (app: string): string => `${app}:options`;

/**
 * The app's price for each feature, by the feature's id: read from the app's
 * option rows that link to it. Empty when the reader may not read them, or
 * the base names no app; a refusal is never shown here, only no price.
 */
export function useFeaturePrices(app: string, features: readonly DataRow[]): ReadonlyMap<string, string> {
  const access = useAccess();
  const table = optionsTable(app);
  const ids = features.map((feature) => feature['id'] as string | number);
  const allowed = app !== '' && ids.length > 0 && access.ready && access.canRead(table, ['feature_id', 'price']);
  const options = useRecords(table, { filter: [{ column: 'feature_id', op: 'in', value: ids }], columns: ['feature_id', 'price'], pageSize: 199, enabled: allowed });
  const prices = new Map<string, string>();
  if (!allowed || options.error !== null) return prices;
  for (const row of options.rows) {
    const price = text(row['price']);
    // The first option row naming a feature sets its price; a product with two is the app's to sort out.
    if (price !== '' && !prices.has(text(row['feature_id']))) prices.set(text(row['feature_id']), price);
  }
  return prices;
}

/** A price as the app keeps it (text, so nothing is rounded), in the install's currency where it has one. */
export function priceText(price: string, currency: string | null | undefined, locale: string): string {
  const value = Number(price);
  if (!Number.isFinite(value)) return price;
  if (currency === null || currency === undefined || currency === '') return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

export function PricesStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const write = useWrite('features');
  const prices = useFeaturePrices(text(base['app']), data.features);
  const currency = useAccess().currency;
  const locale = useLocaleTag();
  const toast = useToast();
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const failed = (caught: unknown): void => toast(refusal(t, asDataError(caught)).message, 'error');
  const add = (): void => {
    const name = adding.trim();
    if (name === '') {
      setError(t('setup.prices.nameNeeded', 'Say what the shopper gets, like “Your own logo”.'));
      return;
    }
    write
      .create({ app: text(base['app']) === '' ? null : text(base['app']), code: codeFor(name, data.features.map((row) => text(row['code'])), 'feature'), name, active: true })
      .then(() => {
        setAdding('');
        setError(null);
      })
      .catch((caught: unknown) => setError(refusal(t, asDataError(caught)).message));
  };
  return (
    <Card title={t('setup.prices.title', 'Priced features')}>
      <Stack gap="md">
        {data.features.length === 0 ? <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.prices.none', 'Nothing extra is charged. Every design costs what the product costs.')}</p> : null}
        <ul className="m-0 flex list-none flex-col">
          {data.features.map((feature) => (
            <Feature key={String(feature['id'])} t={t} feature={feature} price={prices.has(String(feature['id'])) ? priceText(prices.get(String(feature['id']))!, currency, locale) : null} failed={failed} />
          ))}
        </ul>
        <Stack direction="row" gap="sm" align="end" wrap>
          <Input label={t('setup.prices.new', 'A new priced feature')} value={adding} maxLength={120} onChange={(event) => setAdding(event.target.value)} error={error ?? undefined} />
          <Button variant="secondary" onClick={add}>
            {t('setup.prices.add', 'Add a priced feature')}
          </Button>
        </Stack>
        <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.prices.note', 'Everything else costs what the product costs.')}</p>
      </Stack>
    </Card>
  );
}

function Feature({ t, feature, price, failed }: { t: AddOnTranslate; feature: DataRow; price: string | null; failed: (caught: unknown) => void }): ReactNode {
  const write = useWrite('features');
  const [name, setName] = useState<string | null>(null);
  const id = feature['id'] as string | number;
  const code = text(feature['code']);
  const shown = name ?? text(feature['name']);
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3">
      <Stack direction="row" gap="sm" align="end" wrap>
        <Input
          label={t('setup.prices.gets', 'What the shopper gets')}
          value={shown}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name !== null && name.trim() !== '' && name.trim() !== text(feature['name'])) void write.update(id, { name: name.trim() }).catch(failed);
            setName(null);
          }}
        />
        <Switch label={t('setup.prices.offered', 'Offered')} checked={yes(feature['active'])} onCheckedChange={(checked) => void write.update(id, { active: checked }).catch(failed)} />
        <IconButton label={t('setup.prices.remove', 'Remove this feature')} variant="bordered" onClick={() => void write.remove(id).catch(failed)}>
          <Trash />
        </IconButton>
      </Stack>
      {price === null ? (
        <Figure>{t('setup.prices.where', 'Its price is the product’s own option, named “{code}”, set in the shop app.', { code })}</Figure>
      ) : (
        <Figure>{t('setup.prices.priced', '+{price} a piece: the product’s own option “{code}”, set in the shop app.', { price, code })}</Figure>
      )}
      <Figure>{price === null ? t('setup.prices.reads', 'Shoppers see: {name}', { name: shown }) : t('setup.prices.readsPriced', 'Shoppers see: {name} · +{price} a piece', { name: shown, price })}</Figure>
    </li>
  );
}
