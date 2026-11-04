/**
 * The editor's dev page: the customer's editor, "Your designs" and the ways
 * in, mounted against the sample rows through a stand-in of the public API,
 * in either shop's look, any of the eight languages, light or dark, desktop
 * or phone width. Not part of what ships: `vite build` only sees `src/`.
 *
 * `?shop=maker|print&base=<id>&lang=<tag>&theme=dark&frame=phone&view=editor|designs|ways`
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { CustomiserEditor, LOCALES, WaysIn, YourDesigns, type DesignForBasket, type SavedDesign } from '../src/browser/index.ts';
import { stubApi } from '../src/browser/testing/stub.ts';

const query = new URLSearchParams(location.search);
const set = (key: string, value: string): void => {
  query.set(key, value);
  location.search = query.toString();
};

function Dev() {
  const shop = query.get('shop') === 'print' ? 'print' : 'maker';
  const stub = useMemo(() => stubApi(shop === 'print' ? 'printing' : 'maker'), [shop]);
  const bases = shop === 'print' ? [stub.ids.cards, stub.ids.flyers] : [stub.ids.coasters, stub.ids.nook, stub.ids.keyring, stub.ids.board];
  const base = Number(query.get('base') ?? bases[0]);
  const lang = query.get('lang') ?? 'en-US';
  const view = query.get('view') ?? 'editor';
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
        <select value={view} onChange={(e) => set('view', e.target.value)} aria-label="View">
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
          <YourDesigns api={stub.api} locale={lang} look={shop} shop={shop === 'print' ? 'Marlow Press' : 'Birch Row'} codes={(query.get('codes') ?? '').split(',').filter((one) => one !== '')} onOpen={(design) => { setOpened(design); set('view', 'editor'); }} onOrder={(design) => setLog(`order ${String(design.code)}`)} onChoose={() => set('view', 'editor')} />
        ) : view === 'ways' ? (
          <WaysIn api={stub.api} base={base} product={product} locale={lang} onChoose={() => set('view', 'editor')} onStartBlank={() => setLog('start from blank')} onSendOwnFile={() => setLog('send your own file')} />
        ) : (
          <CustomiserEditor
            key={`${shop}-${String(base)}`}
            api={stub.api}
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
            onAddToBasket={(design: DesignForBasket) => setLog(`basket: ${String(design.code)} · used [${design.used.join(', ')}]`)}
            onSaved={(design, email) => setLog(`saved ${String(design.id)} for ${email}`)}
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
