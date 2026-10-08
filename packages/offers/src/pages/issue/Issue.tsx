/**
 * ISSUE: a gift card by hand, one voucher, or a batch of codes — one sheet,
 * opened from Look up, the Overview and the lists.
 *
 * A CODE IS SHOWN ONCE. The save that makes a card or a voucher hands its
 * code back one time, to the person who made it. It is kept in this sheet's
 * state until the sheet closes and nowhere else: not in an address, not in
 * storage. Printing hands a one-use token to Adminium, which is how a desk
 * user who reads no code prints what they have just made.
 */
import { useState, type ReactNode } from 'react';

import { Alert, Sheet, SheetHeader, Tabs, TabsContent, TabsList, TabsTrigger, lucideByName, useNavigate, useSearch, type AddOnTranslate } from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { LOOK_UP } from '../shared/paths.ts';
import { useRole } from '../shared/role.ts';
import { BatchTab } from './BatchTab.tsx';
import { CardTab } from './CardTab.tsx';
import { VoucherTab } from './VoucherTab.tsx';
import { SheetPane } from '../shared/SheetPane.tsx';

type Tab = 'gift-card' | 'voucher' | 'batch';
const TABS: readonly Tab[] = ['gift-card', 'voucher', 'batch'];
/** Where closing may go: a path of this dashboard, never an address somebody put in a link. */
const pathOf = (back: unknown): string => (typeof back === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(back) ? back : LOOK_UP);

export function Issue({ t }: { t: AddOnTranslate }): ReactNode {
  const role = useRole();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const back = pathOf(search['back']);
  const may: readonly Tab[] = TABS.filter((tab) => (tab === 'voucher' ? role.issueVoucher : tab === 'batch' ? role.makeBatch : role.cardMoney));
  const asked = TABS.find((tab) => tab === search['tab']);
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab = picked ?? (asked !== undefined && may.includes(asked) ? asked : (may[0] ?? null));
  const close = (): void => void navigate({ to: back });
  const Icon = lucideByName('circle-plus');

  return (
    <PageFrame t={t} title={t('issue.title', 'Issue')} loading={!role.ready} testId="offers-issue">
      <Sheet open onOpenChange={(open) => (open ? undefined : close())} maxWidth={560}>
        <SheetHeader icon={Icon === undefined ? null : <Icon />} title={t('issue.title', 'Issue')} subtitle={t('issue.subtitle', 'A gift card, a voucher or a batch of codes')} closeLabel={t('shared.close', 'Close')} />
        {tab === null ? (
          <SheetPane>
            <Alert tone="warn" role="alert" title={t('issue.notAllowed', 'Your role cannot issue.')} />
          </SheetPane>
        ) : (
          <Tabs value={tab} onValueChange={(value) => setPicked(TABS.find((one) => one === value) ?? null)}>
            <SheetPane>
              <TabsList aria-label={t('issue.tabs', 'What to issue')}>
                {may.includes('gift-card') ? <TabsTrigger value="gift-card">{t('issue.tab.card', 'Gift card')}</TabsTrigger> : null}
                {may.includes('voucher') ? <TabsTrigger value="voucher">{t('issue.tab.voucher', 'Voucher')}</TabsTrigger> : null}
                {may.includes('batch') ? <TabsTrigger value="batch">{t('issue.tab.batch', 'Batch of codes')}</TabsTrigger> : null}
              </TabsList>
            </SheetPane>
            {/*
              Every tab the role has stays drawn, the others out of sight: a code shown once, a form half filled or a
              batch being made is not thrown away by a look at another tab.
            */}
            {may.map((one) => (
              // The host's own panel, so each tab names the panel it shows (a panel of our own left the tabs pointing at nothing).
              <TabsContent key={one} value={one} forceMount hidden={tab !== one}>
                {one === 'gift-card' ? <CardTab t={t} onDone={close} /> : one === 'voucher' ? <VoucherTab t={t} onDone={close} /> : <BatchTab t={t} onDone={close} />}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </Sheet>
    </PageFrame>
  );
}
