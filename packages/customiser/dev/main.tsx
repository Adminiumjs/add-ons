/**
 * The editor's dev page: the customer's editor, "Your designs" and the ways
 * in, mounted against the sample rows through a stand-in of the public API,
 * in either shop's look, any of the eight languages, light or dark, desktop
 * or phone width. Not part of what ships: `vite build` only sees `src/`.
 *
 * `?shop=maker|print&base=<id>&lang=<tag>&theme=dark&frame=phone&view=editor|designs|ways`
 *
 * Against a real Adminium (the engine's walk server): `&real=<address>&shopKey=<key>&linkKey=<key>`,
 * the app's own public client in place of the stand-in. "Add to basket" then places an order whose
 * line names the design by its code, and finds it again, as the app's order lookup does.
 */
import { createPublicClient, type PublicClient } from '@adminium/public-client';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { customiserApi, CustomiserEditor, heldDesign, openSavedLink, LOCALES, WaysIn, YourDesigns, type DesignForBasket, type HeldDesign, type SavedDesign } from '../src/browser/index.ts';
import { stubApi } from '../src/browser/testing/stub.ts';

const query = new URLSearchParams(location.search);
const set = (key: string, value: string): void => {
  query.set(key, value);
  location.search = query.toString();
};

function Dev() {
  const shop = query.get('shop') === 'print' ? 'print' : 'maker';
  const stub = useMemo(() => stubApi(shop === 'print' ? 'printing' : 'maker'), [shop]);
  const real = query.get('real');
  const client = useMemo(() => (real === null ? null : (createPublicClient({ baseUrl: real, publishableKey: query.get('shopKey') ?? '' }) as PublicClient)), [real]);
  const api = useMemo(() => (real === null || client === null ? stub.api : customiserApi({ shop: client, link: () => createPublicClient({ baseUrl: real, publishableKey: query.get('linkKey') ?? '' })!, baseUrl: real })), [real, client, stub]);
  const [codes, setCodes] = useState<string[]>([]);
  // Come back: a saved design's link opens this page with its code after `#`.
  useEffect(() => {
    const token = location.hash.replace(/^#/, '');
    if (token === '') return;
    void openSavedLink(api, token).then((one) => {
      if (typeof one === 'string') return setLog(`the link opens nothing: ${one}`);
      setOpened(one);
      const kept = heldDesign(one);
      if (kept !== null) setHeld((all) => [kept, ...all]);
      setLog(`opened by its link: design ${String(one.id)}`);
    });
  }, [api]);
  /** As the app does: an order whose line names the design, found again by the order's number and code. */
  const order = async (code: string | null): Promise<void> => {
    if (client === null || code === null) return;
    const placed = await client.createTree<{ id: number; link_code: string }>('printing_orders', { values: { name: 'Guest', email: 'guest@example.com' }, children: { order_lines: [{ values: { product_id: 1, qty: 1, design_code: code } }] } });
    await client.claim({ id: placed.data.id, link_code: placed.data.link_code });
    setCodes([...codes, code]);
    setLog(`ordered ${String(placed.data.id)}, found again: ${code}`);
  };
  const bases = shop === 'print' ? [stub.ids.cards, stub.ids.flyers] : [stub.ids.coasters, stub.ids.nook, stub.ids.keyring, stub.ids.board];
  const base = Number(query.get('base') ?? bases[0]);
  const lang = query.get('lang') ?? 'en-US';
  const [view, setView] = useState(query.get('view') ?? 'editor');
  const [held, setHeld] = useState<HeldDesign[]>([]);
  const [opened, setOpened] = useState<SavedDesign | undefined>(undefined);
  const [qty, setQty] = useState(shop === 'print' ? 500 : 1);
  const [log, setLog] = useState('');
  document.documentElement.dataset['shop'] = shop;
  document.documentElement.dataset['theme'] = query.get('theme') === 'dark' ? 'dark' : 'light';
  const product = shop === 'print' ? (base === stub.ids.flyers ? 'A5 flyers' : 'Business cards') : ({ [stub.ids.coasters]: 'Engraved walnut coasters', [stub.ids.nook]: 'The Little Bookshop', [stub.ids.keyring]: 'Name keyring', [stub.ids.board]: 'Walnut cutting board' }[base] ?? '');
  const price =
    shop === 'print'
      ? { total: '£87.55', each: '£0.18', detail: `${String(qty)} business cards · including tax and delivery`, ready: 'Mon 10 Aug' }
      : { total: `£${(34 * qty).toFixed(2)}`, detail: '£34.00 a set', note: 'Order by 17:00 and we post it by Tue 11 Aug' };
  return (
    <>
      <div className="dev-bar">
        <select value={shop} onChange={(e) => set('shop', e.target.value)} aria-label="Shop">
          <option value="maker">Birch Row (maker)</option>
          <option value="print">Marlow Press (print)</option>
        </select>
        <select value={String(base)} onChange={(e) => set('base', e.target.value)} aria-label="Base">
          {bases.map((one) => (
            <option key={one} value={String(one)}>
              base {one}
            </option>
          ))}
        </select>
        <select value={lang} onChange={(e) => set('lang', e.target.value)} aria-label="Language">
          {LOCALES.map((one) => (
            <option key={one}>{one}</option>
          ))}
        </select>
        <select value={view} onChange={(e) => setView(e.target.value)} aria-label="View">
          <option value="editor">Editor</option>
          <option value="designs">Your designs</option>
          <option value="ways">Ways in</option>
        </select>
        <button type="button" onClick={() => set('theme', query.get('theme') === 'dark' ? 'light' : 'dark')}>
          Theme
        </button>
        <button type="button" onClick={() => set('frame', query.get('frame') === 'phone' ? 'desktop' : 'phone')}>
          Frame
        </button>
      </div>
      <div className="dev-out">{log}</div>
      <div className={query.get('frame') === 'phone' ? 'dev-frame phone' : 'dev-frame'}>
        {view === 'designs' ? (
          <YourDesigns api={api} locale={lang} look={shop} shop={shop === 'print' ? 'Marlow Press' : 'Birch Row'} codes={[...codes, ...(query.get('codes') ?? '').split(',').filter((one) => one !== '')]} held={held} onForget={(one) => setHeld(held.filter((other) => other !== one))} onRestore={(one) => setHeld([one, ...held])} onOpen={(design) => { setOpened(design); setView('editor'); }} onOrder={(design) => setLog(`order ${String(design.code)}`)} onChoose={() => setView('editor')} />
        ) : view === 'ways' ? (
          <WaysIn api={api} base={base} product={product} locale={lang} onChoose={() => setView('editor')} onStartBlank={() => setLog('start from blank')} onSendOwnFile={() => setLog('send your own file')} />
        ) : (
          <CustomiserEditor
            key={`${shop}-${String(base)}-${String(opened?.id ?? '')}`}
            api={api}
            base={base}
            product={{ name: product, ...(shop === 'maker' ? { price: '£34.00', unit: 'set of 4' } : {}) }}
            shop={shop === 'print' ? 'Marlow Press' : 'Birch Row'}
            locale={lang}
            sides={shop === 'print' ? 2 : 1}
            {...(opened === undefined ? {} : { design: opened })}
            price={price}
            quantity={shop === 'maker' ? { value: qty, breaks: [{ qty: 4, label: '−8%' }, { qty: 8, label: '−14%' }, { qty: 12, label: '−18%' }], onChange: setQty } : undefined}
            featurePrices={{ logo: '+£1.50 a piece' }}
            onDesignChange={({ used, ok }) => setLog(`used: [${used.join(', ')}] · ok: ${String(ok)}`)}
            onAddToBasket={(design: DesignForBasket) => {
              setLog(`basket: ${String(design.code)} · used [${design.used.join(', ')}]`);
              const one = heldDesign(design);
              if (one !== null) setHeld([one, ...held.filter((other) => String(other.id) !== String(one.id))]);
              void order(design.code).catch((error: unknown) => setLog(`order refused: ${String((error as Error).message)}`));
            }}
            onSaved={(design, email) => {
              const one = heldDesign(design, email);
              if (one !== null) setHeld([one, ...held.filter((other) => String(other.id) !== String(one.id))]);
              setLog(`saved ${String(design.id)} for ${email}`);
            }}
            onBack={() => setLog('back to the shop')}
            onStartBlank={() => setLog('start from blank')}
            onSendOwnFile={() => setLog('send your own file')}
            onFullEditor={() => setLog('the full editor')}
            onChangeSides={() => setLog('change the size or sides')}
          />
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dev />
  </StrictMode>,
);
