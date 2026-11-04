// @vitest-environment jsdom
/**
 * THE CUSTOMER'S EDITOR UNDER AXE.
 *
 * Every state the editor draws (both looks: the gallery, fill-in empty, over
 * the limit, a needed part missing after "Add to basket", a part that takes
 * words or a logo, the plain piece, the save dialog asking and done, the
 * full-screen preview, a product with no designs; "Your designs" with rows,
 * empty and asking to delete; the ways in), in English and Arabic, at a
 * desktop's width and a phone's. As the shop's screens' sweep (`src/pages/
 * a11y.test.tsx`): no stylesheet is loaded, so axe reads names, roles,
 * labels, the ties between a field and its messages, headings and lists, and
 * never colour; every sweep must have examined something.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomiserEditor, heldDesign, WaysIn, YourDesigns, type HeldDesign } from './index.ts';
import { drawn, setWidth, settle, settleUntil } from './testing/render.tsx';
import { stubApi, type Stub } from './testing/stub.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious']);
type Look = { locale: 'en-US' | 'ar-EG'; width: 1280 | 390 };
const LOOKS: Look[] = (['en-US', 'ar-EG'] as const).flatMap((locale) => ([1280, 390] as const).map((width) => ({ locale, width })));

interface State {
  label: string;
  app: 'maker' | 'printing';
  draw: (stub: Stub, locale: string, held: HeldDesign[]) => ReactElement;
  after?: (stub: Stub) => Promise<void>;
}

const click = async (name: RegExp): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name })[0]!);
  });
  await settle();
};
const maker = (base: (stub: Stub) => number) => (stub: Stub, locale: string) => <CustomiserEditor api={stub.api} base={base(stub)} product={{ name: 'Engraved walnut coasters', price: '£34.00', unit: 'set of 4' }} shop="Birch Row" locale={locale} price={{ total: '£40.00', note: 'Order by 17:00 and we post it by Tue 11 Aug' }} quantity={{ value: 1, breaks: [{ qty: 4, label: '−8%' }], onChange: () => {} }} featurePrices={{ logo: '+£1.50 a piece' }} mailsLink onAddToBasket={() => {}} onBack={() => {}} />;
const print = (base: (stub: Stub) => number, extra: { start?: 'blank' } = {}) => (stub: Stub, locale: string) => <CustomiserEditor api={stub.api} base={base(stub)} product={{ name: 'Business cards' }} shop="Marlow Press" sides={2} locale={locale} price={{ total: '£87.55', each: '£0.18', ready: 'Mon 10 Aug' }} onAddToBasket={() => {}} onSendOwnFile={() => {}} {...extra} />;
/** A PNG's first bytes: enough for the editor to know what it is. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Pick a file in the first file input, and wait until it is taken or refused. */
const upload = async (name: string, body: BlobPart, type: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([body], name, { type })] } });
  });
  await settleUntil(() => document.querySelector('[role="progressbar"]') === null && (document.querySelector('.cz-file') !== null || document.querySelector('[role="alert"]') !== null || document.querySelector('.cz-ed-layer') !== null));
};
const ring = async (): Promise<void> => click(/Ring/);
const typeInto = (selector: string, text: string): void => {
  fireEvent.change(document.querySelector(selector)!, { target: { value: text } });
};

const STATES: State[] = [
  { label: 'maker · choose a design', app: 'maker', draw: maker((s) => s.ids.coasters) },
  { label: 'maker · Ring, empty', app: 'maker', draw: maker((s) => s.ids.coasters), after: ring },
  {
    label: 'maker · Ring, over the limit, tried',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      typeInto('#cz-f-words', 'The Bellamy-Hart Kitchen Company');
      fireEvent.click(document.querySelector('.cz-add')!);
      await settle();
    },
  },
  {
    label: 'maker · Ring, a needed part missing after Add to basket',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      fireEvent.click(document.querySelector('.cz-add')!);
      await settle();
    },
  },
  {
    label: 'maker · save dialog, then done',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      fireEvent.click(document.querySelector('.cz-save')!);
      fireEvent.click(document.querySelector('.cz-dialog .cz-primary')!);
      await settle();
    },
  },
  {
    label: 'maker · saved',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      fireEvent.click(document.querySelector('.cz-save')!);
      typeInto('#cz-save-email', 'iris@example.com');
      await act(async () => {
        fireEvent.click(document.querySelector('.cz-dialog .cz-primary')!);
      });
      await settle();
    },
  },
  {
    label: 'print · saved, the link to keep',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      typeInto('#cz-f-name', 'Nell Fairweather');
      await act(async () => {
        fireEvent.click(document.querySelector('.cz-save, .cz-quote-bar .cz-icon-button')!);
      });
      await settle();
    },
  },
  { label: 'maker · book nook, Corner shop', app: 'maker', draw: maker((s) => s.ids.nook), after: () => click(/Corner/) },
  { label: 'maker · keyring, Name', app: 'maker', draw: maker((s) => s.ids.keyring), after: () => click(/Name/) },
  { label: 'maker · cutting board, the plain piece', app: 'maker', draw: maker((s) => s.ids.board) },
  { label: 'print · choose a design', app: 'printing', draw: print((s) => s.ids.cards) },
  { label: 'print · flyers, no designs', app: 'printing', draw: print((s) => s.ids.flyers) },
  {
    label: 'print · Harbour, too long, with guides',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      typeInto('#cz-f-title', 'Head baker and pastry chef, Quay Street');
      const guides = document.querySelectorAll<HTMLElement>('.cz-sheet-tools [role="radio"], .cz-sheet-tools [aria-pressed]');
      fireEvent.click(guides[guides.length - 1]!);
      fireEvent.click(document.querySelector('.cz-style-toggle')!);
      await settle();
    },
  },
  {
    label: 'print · full-screen preview',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      fireEvent.click(document.querySelector('.cz-sheet-tools .cz-icon-button')!);
      await settle();
    },
  },
  {
    label: 'maker · Ring, a logo in, the one-colour sheet open',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      await upload('pinfold-sign.png', PNG, 'image/png');
    },
  },
  {
    label: 'maker · Ring, the logo in its box',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      await upload('pinfold-sign.png', PNG, 'image/png');
      fireEvent.click(document.querySelector('.cz-oc-foot-bar .cz-button')!);
      await settle();
    },
  },
  {
    label: 'maker · Ring, a file refused',
    app: 'maker',
    draw: maker((s) => s.ids.coasters),
    after: async () => {
      await ring();
      await upload('notes.txt', 'just words', 'text/plain');
    },
  },
  {
    label: 'print · Harbour, a logo in, how it sits',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      await upload('harbour-loaf.png', PNG, 'image/png');
    },
  },
  { label: 'print · the full editor, blank', app: 'printing', draw: print((s) => s.ids.cards, { start: 'blank' }) },
  {
    label: 'print · the full editor, words selected, the panel or its sheet',
    app: 'printing',
    draw: print((s) => s.ids.cards, { start: 'blank' }),
    after: async () => {
      fireEvent.click(document.querySelector('.cz-ed-tool')!);
      await settle();
      const sheet = document.querySelector('.cz-ed-foot .cz-button');
      if (sheet !== null) fireEvent.click(sheet);
      await settle();
    },
  },
  {
    label: 'print · Harbour in the full editor, with its note',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      fireEvent.click(document.querySelector('.cz-title-row .cz-button')!);
      await settle();
    },
  },
  {
    label: 'print · Harbour, in the full editor, back on its form',
    app: 'printing',
    draw: print((s) => s.ids.cards),
    after: async () => {
      await click(/Harbour/);
      fireEvent.click(document.querySelector('.cz-title-row .cz-button')!);
      await settle();
      fireEvent.click(document.querySelector('.cz-ed-head .cz-icon-button')!);
      await settle();
    },
  },
  { label: 'your designs, two', app: 'maker', draw: (stub, locale, held) => <YourDesigns api={stub.api} held={held} locale={locale} onOpen={() => {}} onOrder={() => {}} onForget={() => {}} /> },
  {
    label: 'your designs, asking to delete',
    app: 'maker',
    draw: (stub, locale, held) => <YourDesigns api={stub.api} held={held} locale={locale} onOpen={() => {}} onOrder={() => {}} onForget={() => {}} />,
    after: async () => {
      fireEvent.click(document.querySelector('.cz-design-row .cz-icon-button')!);
      await settle();
    },
  },
  {
    label: 'your designs, print, asking to delete',
    app: 'printing',
    draw: (stub, locale, held) => <YourDesigns api={stub.api} held={held} look="print" shop="Marlow Press" locale={locale} onOpen={() => {}} onOrder={() => {}} onForget={() => {}} />,
    after: async () => {
      fireEvent.click(document.querySelector('.cz-design-row .cz-icon-button')!);
      await settle();
    },
  },
  {
    label: 'your designs, one deleted',
    app: 'maker',
    draw: (stub, locale, held) => <YourDesigns api={stub.api} held={held} locale={locale} onOpen={() => {}} onOrder={() => {}} onForget={() => {}} />,
    after: async () => {
      fireEvent.click(document.querySelector('.cz-design-row .cz-icon-button')!);
      await settle();
      fireEvent.click(document.querySelector('[role="alertdialog"] .cz-danger')!);
      await settle();
    },
  },
  { label: 'your designs, none', app: 'maker', draw: (stub, locale) => <YourDesigns api={stub.api} held={[]} locale={locale} onOpen={() => {}} onOrder={() => {}} onChoose={() => {}} /> },
  { label: 'your designs, by the order’s codes', app: 'printing', draw: (stub, locale) => <YourDesigns api={stub.api} look="print" codes={['MP4112C8G2S6E4WB']} locale={locale} onOpen={() => {}} onOrder={() => {}} /> },
  { label: 'the ways in', app: 'printing', draw: (stub, locale) => <WaysIn api={stub.api} base={stub.ids.cards} product="business cards" locale={locale} onChoose={() => {}} onStartBlank={() => {}} onSendOwnFile={() => {}} /> },
];

afterEach(cleanup);

describe('the customer’s editor under axe', () => {
  it('is clean in every state, English and Arabic, at a desktop’s width and a phone’s', async () => {
    const failures: string[] = [];
    let swept = 0;
    for (const look of LOOKS) {
      for (const state of STATES) {
        setWidth(look.width);
        const stub = stubApi(state.app);
        const held: HeldDesign[] = [];
        for (const words of ['Anna & Ben', 'Iris & Tom']) held.push(heldDesign(await stub.api.create({ base_id: stub.ids.coasters, ready_design_id: stub.ids.twoLines, values: { parts: { top: { text: words } } } }, 'iris@example.com'), 'iris@example.com')!);
        document.documentElement.lang = look.locale;
        await drawn(<main>{state.draw(stub, look.locale, held)}</main>);
        await settle();
        await state.after?.(stub);
        const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS }, rules: { 'color-contrast': { enabled: false } } });
        const label = `${look.locale} · ${String(look.width)} · ${state.label}`;
        if (results.passes.length === 0) failures.push(`${label}: axe examined nothing`);
        for (const violation of results.violations.filter((one) => BLOCKING.has(one.impact ?? ''))) failures.push(`${label}: ${String(violation.impact)} ${violation.id} — ${violation.help}\n  ${violation.nodes.slice(0, 3).map((node) => node.html.slice(0, 200)).join('\n  ')}`);
        swept += 1;
        cleanup();
      }
    }
    expect(failures, failures.join('\n\n')).toEqual([]);
    expect(swept).toBe(LOOKS.length * STATES.length);
  }, 240_000);
});
