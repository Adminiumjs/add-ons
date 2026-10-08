/**
 * CHOOSE WHAT IT APPLIES TO: rows of the tables an order's lines sell — one
 * tab per table, by the table's own name — and, where lines carry a tag, tags.
 * The search is the server's; a row is kept with its name as it read when it
 * was picked, so a list of discounts can name it without reading that table.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, Checkbox, Dialog, DialogBody, DialogFooter, DialogHeader, EmptyState, Input, SearchInput, Stack, Tabs, TabsContent, TabsList, TabsTrigger, asDataError, type AddOnTranslate } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { things, type Mapped, type Thing } from '../shared/things.ts';
import type { Target } from './form.ts';

const TAGS = 'tags';
const sameTarget = (a: Target, b: Target): boolean => a.kind === b.kind && a.sourceTable === b.sourceTable && a.sourceRow === b.sourceRow;

export function TargetPicker({ t, mapped, chosen, onClose, onDone }: { t: AddOnTranslate; mapped: Mapped; chosen: readonly Target[]; onClose: () => void; onDone: (targets: readonly Target[]) => void }): ReactNode {
  const [tab, setTab] = useState(mapped.what.length > 0 ? '0' : TAGS);
  const [picked, setPicked] = useState<readonly Target[]>(chosen);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<readonly Thing[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const turn = useRef(0);
  const table = tab === TAGS ? undefined : mapped.what[Number(tab)];
  const { connectionId } = mapped;

  useEffect(() => {
    if (table === undefined) return undefined;
    const mine = (turn.current += 1);
    const timer = setTimeout(
      () => {
        things(connectionId, table.table, search).then(
          (rows) => {
            if (mine !== turn.current) return;
            setFound(rows);
            setSaid(null);
          },
          (caught: unknown) => (mine === turn.current ? setSaid(refusal(t, asDataError(caught)).message) : undefined),
        );
      },
      search === '' ? 0 : 250,
    );
    return () => clearTimeout(timer);
  }, [connectionId, table, search, t]);

  const toggle = (target: Target, on: boolean): void => setPicked((all) => (on ? (all.some((one) => sameTarget(one, target)) ? all : [...all, target]) : all.filter((one) => !sameTarget(one, target))));
  const countIn = (index: string): number => picked.filter((one) => (index === TAGS ? one.kind === 'tag' : one.kind !== 'tag' && one.sourceTable === mapped.what[Number(index)]?.ref && one.kind === mapped.what[Number(index)]?.as)).length;
  const addTag = (): void => {
    const word = tag.trim();
    if (word === '') return;
    toggle({ kind: 'tag', sourceTable: '', sourceRow: word, label: word }, true);
    setTag('');
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())} size="lg">
      <DialogHeader title={t('discounts.pick.title', 'Choose what it applies to')} subtitle={t('discounts.pick.subtitle', 'From the tables set to take discounts in Offer rules.')} closeLabel={t('shared.close', 'Close')} />
      <DialogBody>
        <Tabs
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            setSearch('');
            setFound([]);
          }}
        >
          <TabsList aria-label={t('discounts.pick.tabs', 'Where to choose from')}>
            {mapped.what.map((one, index) => (
              <TabsTrigger key={String(index)} value={String(index)}>
                {countIn(String(index)) === 0 ? one.label : t('discounts.pick.tabCount', '{label} · {n}', { label: one.label, n: countIn(String(index)) })}
              </TabsTrigger>
            ))}
            {mapped.tags ? <TabsTrigger value={TAGS}>{countIn(TAGS) === 0 ? t('discounts.pick.tags', 'Tags') : t('discounts.pick.tabCount', '{label} · {n}', { label: t('discounts.pick.tags', 'Tags'), n: countIn(TAGS) })}</TabsTrigger> : null}
          </TabsList>
          {mapped.what.map((one, index) => (
            <TabsContent key={String(index)} value={String(index)}>
              <Stack gap="sm">
                <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('discounts.pick.search', 'Search')} aria-label={t('discounts.pick.search', 'Search')} />
                {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
                {found.length === 0 && said === null ? <EmptyState compact preset="no-matches" title={t('discounts.pick.none', 'Nothing matches that search.')} /> : null}
                {found.map((thing) => {
                  const target: Target = { kind: one.as, sourceTable: one.ref, sourceRow: thing.key, label: thing.label };
                  const id = `pick-${String(index)}-${thing.key}`;
                  return (
                    <Stack key={thing.key} direction="row" gap="sm" align="center">
                      <Checkbox id={id} checked={picked.some((held) => sameTarget(held, target))} onCheckedChange={(on) => toggle(target, on)} />
                      <label htmlFor={id}>{thing.label}</label>
                    </Stack>
                  );
                })}
              </Stack>
            </TabsContent>
          ))}
          {mapped.tags ? (
            <TabsContent value={TAGS}>
              <Stack gap="sm">
                <Stack direction="row" gap="sm" align="end">
                  <Input label={t('discounts.pick.tag', 'A tag, as it is written on the line')} value={tag} maxLength={64} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => (event.key === 'Enter' ? addTag() : undefined)} />
                  <Button variant="secondary" onClick={() => addTag()}>
                    {t('discounts.pick.addTag', 'Add')}
                  </Button>
                </Stack>
                {picked
                  .filter((one) => one.kind === 'tag')
                  .map((one) => (
                    <Stack key={one.sourceRow} direction="row" gap="sm" align="center">
                      <Checkbox id={`pick-tag-${one.sourceRow}`} checked onCheckedChange={(on) => toggle(one, on)} />
                      <label htmlFor={`pick-tag-${one.sourceRow}`}>{one.label}</label>
                    </Stack>
                  ))}
              </Stack>
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogBody>
      <DialogFooter>
        <span className="text-body-sm text-fg-muted">{t('discounts.pick.chosen', '{n} chosen', { n: picked.length })}</span>
        <Button variant="secondary" onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" onClick={() => onDone(picked)}>
          {t('discounts.pick.done', 'Done')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
