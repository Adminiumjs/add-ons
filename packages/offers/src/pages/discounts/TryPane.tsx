/**
 * TRY IT: the discount being edited, tried on a saved order.
 *
 * EVERY FIGURE HERE IS ADMINIUM'S. The pane sends the unsaved form with a
 * saved row of a table that takes discounts, and draws only what comes back:
 * what applied and for how much, what did not and why, the order's own
 * reduction and total as Adminium worked them out. Nothing is priced, added
 * or subtracted on this screen, so the pane can never disagree with a save.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, Card, Combobox, EmptyState, Field, Input, Link, SegmentedControl, Sheet, SheetBody, SheetHeader, Stack, StickyBar, api, asDataError, lucideByName, money, useLocaleTag, type AddOnTranslate, type DataValue } from '../shared/host.ts';
import { RULES } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { things, type Mapped, type Thing } from '../shared/things.ts';
import { explainWords } from './explainWords.ts';

export interface Tried {
  data: Readonly<Record<string, unknown>>;
  lines: readonly { table: string; key: string; discount: string }[];
  applied: readonly { line: string | null; name: string; kind: string; amount: string; typed: boolean }[];
  told: readonly { column: string; note: string; name: string }[];
  refused: readonly { typed: string; reason: string }[];
  explain?: readonly { offer: string; name: string; applies: boolean; reason?: string; amount?: string }[];
}

export interface TryPaneProps {
  t: AddOnTranslate;
  mapped: Mapped | null;
  /** The form as a save would send it; scalars only. */
  draft: Readonly<Record<string, DataValue>>;
  /** The offer's key once saved, else null. */
  offerId: string | null;
  /** The name the edited discount is shown under in the answer. */
  name: string;
  unsaved: boolean;
  /** Below this the pane is a bar that opens a sheet. */
  narrow: boolean;
}

const KEPT = 'adminium.offers.try.row';
const remembered = (): string | null => {
  try {
    return window.localStorage.getItem(KEPT);
  } catch {
    return null;
  }
};
const remember = (key: string): void => {
  try {
    window.localStorage.setItem(KEPT, key);
  } catch {
    // A browser that keeps nothing: the newest row is picked again next time.
  }
};

/** The column a rule names for a part of the order, when it names one. */
const columnOf = (rule: Readonly<Record<string, unknown>>, part: 'discount' | 'expect'): string | null => {
  const named = part === 'expect' ? rule['expect'] : (rule['order'] as { discount?: unknown } | undefined)?.discount;
  return typeof named === 'string' && named !== '' ? named : null;
};

export function TryPane({ t, mapped, draft, offerId, name, unsaved, narrow }: TryPaneProps): ReactNode {
  const locale = useLocaleTag();
  const [rows, setRows] = useState<readonly Thing[]>([]);
  const [row, setRow] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [buyer, setBuyer] = useState('guest');
  const [tried, setTried] = useState<Tried | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const turn = useRef(0);
  const first = mapped?.adjusts[0];
  const connectionId = mapped?.connectionId ?? null;
  const table = first?.table ?? null;
  const sent = JSON.stringify(draft);

  // The rows that can be tried: the newest of the first table that takes discounts.
  useEffect(() => {
    if (connectionId === null || table === null) return undefined;
    let live = true;
    things(connectionId, table, '', true).then(
      (found) => {
        if (!live) return;
        setRows(found);
        const kept = remembered();
        setRow(found.find((one) => one.key === kept)?.key ?? found[0]?.key ?? null);
      },
      (caught: unknown) => (live ? setSaid(refusal(t, asDataError(caught)).message) : undefined),
    );
    return () => {
      live = false;
    };
  }, [connectionId, table, t]);

  // Each change of the form, the row, the code or the buyer is tried again, once typing has stopped.
  useEffect(() => {
    if (connectionId === null || table === null || row === null) return undefined;
    const mine = (turn.current += 1);
    const timer = setTimeout(() => {
      setBusy(true);
      api
        .post<Tried>(`/api/v1/data/${encodeURIComponent(connectionId)}/${encodeURIComponent(table)}/try`, {
          row,
          draft: { ...(JSON.parse(sent) as Record<string, DataValue>), ...(offerId === null ? {} : { id: /^\d+$/.test(offerId) ? Number(offerId) : offerId }) },
          codes: code.trim() === '' ? [] : [code.trim()],
          buyer,
          explain: true,
        })
        .then(
          (answer) => {
            if (mine !== turn.current) return;
            setTried(answer);
            setSaid(null);
          },
          // A try that failed says so and changes no figure.
          (caught: unknown) => (mine === turn.current ? setSaid(refusal(t, asDataError(caught)).message) : undefined),
        )
        .finally(() => (mine === turn.current ? setBusy(false) : undefined));
    }, 400);
    return () => clearTimeout(timer);
  }, [connectionId, table, row, sent, offerId, code, buyer, t]);

  if (mapped === null) return null;
  if (first === undefined) {
    return (
      <Card title={t('discounts.try.title', 'Try it')}>
        <EmptyState compact title={t('discounts.try.none', 'Nothing takes discounts yet')} body={t('discounts.try.noneBody', 'Say which of your tables takes discounts, and this discount can be tried on its rows.')} actions={<Link to={RULES}>{t('discounts.try.rules', 'Offer rules')}</Link>} />
      </Card>
    );
  }

  const total = tried === null ? null : columnOf(first.adjust, 'expect');
  const reduction = tried === null ? null : columnOf(first.adjust, 'discount');
  const totalShown = total === null || tried === null || tried.data[total] === undefined || tried.data[total] === null ? null : money(tried.data[total], locale);
  const notApplied = (tried?.explain ?? []).filter((entry) => !entry.applies);
  const body = (
    <Stack gap="md">
      <Field label={t('discounts.try.row', 'Tried on')} hint={t('discounts.try.rowHint', 'A saved row of {table}', { table: first.tableLabel })}>
        <Combobox
          options={rows.map((one) => ({ value: one.key, label: one.label }))}
          value={row}
          onValueChange={(next) => {
            setRow(next);
            if (next !== null) remember(next);
          }}
          emptyText={t('discounts.try.noRows', 'Nothing saved there yet.')}
        />
      </Field>
      <Input label={t('discounts.try.code', 'Code at checkout')} value={code} placeholder={t('discounts.try.noCode', 'No code')} dir="ltr" onChange={(event) => setCode(event.target.value)} />
      <Field label={t('discounts.try.buyer', 'Who is buying')}>
        <SegmentedControl
          value={buyer}
          onValueChange={setBuyer}
          options={[
            { value: 'guest', label: t('discounts.try.guest', 'A guest') },
            { value: 'customer', label: t('discounts.try.customer', 'A signed-in customer') },
          ]}
        />
      </Field>
      {said === null ? null : <Alert tone="danger" role="alert" title={t('discounts.try.failed', 'This could not be tried')} body={said} />}
      {rows.length === 0 && said === null ? <Alert tone="info" title={t('discounts.try.noRows', 'Nothing saved there yet.')} /> : null}
      {tried === null ? null : (
        <div data-part="try-answer" aria-busy={busy}>
          <Stack gap="sm">
            {tried.applied.length === 0 ? <span className="text-body-sm text-fg-muted">{t('discounts.try.nothing', 'No discount applies to this order.')}</span> : null}
            {tried.applied.map((one, index) => (
              <Stack key={String(index)} direction="row" justify="between" gap="sm">
                {one.name === name ? <span className="font-semibold">{unsaved ? t('discounts.try.draftName', '{name} (draft)', { name: one.name }) : one.name}</span> : <span className="text-fg">{one.name}</span>}
                <span dir="ltr">{`−${money(one.amount, locale)}`}</span>
              </Stack>
            ))}
            {reduction === null || tried.data[reduction] === undefined || tried.data[reduction] === null ? null : (
              <Stack direction="row" justify="between" gap="sm">
                <span className="text-fg-muted">{t('discounts.try.off', 'Taken off the order')}</span>
                <span dir="ltr">{money(tried.data[reduction], locale)}</span>
              </Stack>
            )}
            <div role="status" aria-live="polite">
              {totalShown === null ? (
                <span className="text-body-sm text-fg-muted">{t('discounts.try.taxLater', 'Tax is added when the order is saved')}</span>
              ) : (
                <Stack direction="row" justify="between" gap="sm">
                  <span className="font-semibold">{t('discounts.try.total', 'Total')}</span>
                  <span dir="ltr" className="font-semibold">
                    {totalShown}
                  </span>
                </Stack>
              )}
            </div>
            {tried.refused.map((one, index) => (
              <Alert key={String(index)} tone="warn" title={t('discounts.try.refused', '{code}: {why}', { code: one.typed, why: explainWords(t, one.reason) })} />
            ))}
            {tried.told.map((one, index) => (
              <Alert key={String(index)} tone="info" title={t('discounts.try.better', '{name} was used instead: it gives more.', { name: one.name })} />
            ))}
            {notApplied.length === 0 ? null : (
              <Stack gap="xs">
                <span className="font-semibold">{t('discounts.try.notApplied', 'Did not apply')}</span>
                {notApplied.map((entry, index) => (
                  <span key={String(index)} className="text-body-sm text-fg-muted">
                    {t('discounts.try.whyNot', '{name} — {why}', { name: entry.name === '' ? t('discounts.try.unnamed', 'A discount') : entry.name, why: explainWords(t, entry.reason) })}
                  </span>
                ))}
              </Stack>
            )}
            {unsaved ? <span className="text-body-sm text-fg-muted">{t('discounts.try.asIfOn', 'A draft is tried as if it were switched on.')}</span> : null}
          </Stack>
        </div>
      )}
    </Stack>
  );

  if (!narrow) return <Card title={t('discounts.try.title', 'Try it')}>{body}</Card>;
  const Icon = lucideByName('flask-conical');
  return (
    <>
      <StickyBar aria-label={t('discounts.try.title', 'Try it')}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {tried === null ? t('discounts.try.title', 'Try it') : totalShown === null ? t('discounts.try.bar', 'Try it · {n, plural, one {# discount} other {# discounts}}', { n: tried.applied.length }) : t('discounts.try.barTotal', 'Try it · {n, plural, one {# discount} other {# discounts}} · {total}', { n: tried.applied.length, total: totalShown })}
        </Button>
      </StickyBar>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetHeader icon={Icon === undefined ? null : <Icon />} title={t('discounts.try.title', 'Try it')} closeLabel={t('shared.close', 'Close')} />
        <SheetBody>{body}</SheetBody>
      </Sheet>
    </>
  );
}
