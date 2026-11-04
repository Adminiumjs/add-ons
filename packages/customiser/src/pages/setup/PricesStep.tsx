/**
 * STEP 5, PRICES: the priced features ("Your own logo").
 *
 * A feature here is a name shoppers read and a code the app's option row
 * names. Its price is the app's own (CR2): an option of the product, priced
 * flat per piece like any other option, never discounted by a quantity
 * break. The Customiser keeps no price, so this step edits the feature rows
 * and says where each price is set; nothing here writes a figure.
 */
import { useState, type ReactNode } from 'react';

import { asDataError, Button, Card, Figure, IconButton, Input, lucideByName, Stack, Switch, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import type { SetupData } from './data.ts';
import { codeFor, text, yes } from './facts.ts';

const Trash = lucideByName('trash-2');

export function PricesStep({ t, base, data }: { t: AddOnTranslate; base: DataRow; data: SetupData }): ReactNode {
  const write = useWrite('features');
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
            <Feature key={String(feature['id'])} t={t} feature={feature} failed={failed} />
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

function Feature({ t, feature, failed }: { t: AddOnTranslate; feature: DataRow; failed: (caught: unknown) => void }): ReactNode {
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
      <Figure>{t('setup.prices.where', 'Its price is the product’s own option, named “{code}”, set in the shop app.', { code })}</Figure>
      <Figure>{t('setup.prices.reads', 'Shoppers see: {name}', { name: shown })}</Figure>
    </li>
  );
}
