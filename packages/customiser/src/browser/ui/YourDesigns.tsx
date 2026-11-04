/**
 * YOUR DESIGNS: the designs this browser holds, and the ones an order names.
 *
 * Two ways in, no other (a guest is never asked for an address to list
 * designs by):
 *
 * - the designs this browser holds a link session for: saved here, or opened
 *   from the e-mailed link;
 * - after the app's order lookup, the designs its lines name, read by their
 *   codes with the lookup's session (`codes`).
 *
 * Each row: the design drawn flat, its words, the product and the design's
 * name, when it last changed, "Open", "Order it", and a bin. The bin asks
 * first, then deletes the design for good through its own link, its logo and
 * photo with it. Only a draft this browser holds a session on has a bin: an
 * ordered design is the order's, and the link no longer deletes it.
 */
import { FolderHeart, PenLine, ShoppingBasket, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CustomiserApi, SavedDesign } from '../api.ts';
import { isRightToLeft, shortWhen } from '../i18n.ts';
import { readCatalogue, readyOf, wordsIn, type Catalogue } from '../catalogue.ts';
import { liveDesigns, type HeldDesign } from '../store.ts';
import { SharedContext, sharedFor, useShared, type Look } from './context.tsx';
import { Drawing } from './Drawing.tsx';
import { Dialog, Toasts, type Toast } from './Overlay.tsx';
import { radioKeys } from './radios.ts';

export interface YourDesignsProps {
  api: CustomiserApi;
  /** The designs this browser holds, as the app kept them (`heldDesign`). */
  held?: readonly HeldDesign[];
  /** A design this browser held was deleted: the app lets go of its session. */
  onForget?: (held: HeldDesign) => void;
  /** The codes the app's order lookup found on the order's lines: read with the lookup's session. */
  codes?: readonly string[];
  locale?: string;
  look?: Look;
  shop?: string;
  onOpen: (design: SavedDesign) => void;
  onOrder: (design: SavedDesign) => void;
  /** The empty list's button: back to the shop's products. */
  onChoose?: () => void;
}

interface Item {
  design: SavedDesign;
  remembered: HeldDesign | null;
}

export function YourDesigns(props: YourDesignsProps) {
  const shared = useMemo(() => sharedFor(props.locale, props.look ?? 'maker', props.shop ?? ''), [props.locale, props.look, props.shop]);
  return (
    <SharedContext.Provider value={shared}>
      <div className={`cz cz-look-${shared.look}`} dir={isRightToLeft(shared.locale) ? 'rtl' : 'ltr'} lang={shared.locale} onKeyDown={radioKeys}>
        <List {...props} />
      </div>
    </SharedContext.Provider>
  );
}

function List({ api, held, codes, onOpen, onOrder, onChoose, onForget }: YourDesignsProps) {
  const { t, locale, look } = useShared();
  const [items, setItems] = useState<Item[] | null>(null);
  const [catalogues, setCatalogues] = useState<Record<string, Catalogue | null>>({});
  const [asking, setAsking] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const byCode = (codes ?? []).length > 0;
  useEffect(() => {
    let live = true;
    void (async () => {
      const found: Item[] = [];
      for (const one of liveDesigns(held ?? [])) {
        const design = await api.reopen(one.session);
        if (design !== null) found.push({ design, remembered: one });
      }
      if (byCode) for (const design of await api.byCodes(codes!).catch(() => [])) if (!found.some((one) => String(one.design.id) === String(design.id))) found.push({ design, remembered: null });
      if (!live) return;
      setItems(found);
      const bases = [...new Set(found.map((one) => String(one.design.base_id)))];
      const read = await Promise.all(bases.map(async (base) => [base, await api.catalogue(base).then((rows) => readCatalogue(rows, base)).catch(() => null)] as const));
      if (live) setCatalogues(Object.fromEntries(read));
    })();
    return () => {
      live = false;
    };
  }, [api, byCode, (codes ?? []).join(','), (held ?? []).map((one) => String(one.id)).join(',')]);

  const toast = (text: string, kind: Toast['kind'] = 'info'): void => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { id, text, kind }]);
    setTimeout(() => setToasts((all) => all.filter((one) => one.id !== id)), 3400);
  };
  const nameOf = (item: Item): string => wordsIn(catalogues[String(item.design.base_id)] ?? null, item.design) || t('editor.designs.noWords', 'No words yet');
  /**
   * The delete is real: the design goes from the shop's records, its link
   * stops opening it, and nothing brings it back, so there is no Undo.
   */
  const remove = async (item: Item): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.remove(item.design);
    } catch (error) {
      setDeleting(false);
      setAsking(null);
      const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
      // Gone already, or ordered since (an ordered design answers as gone): it is no longer this list's to delete.
      if (code === 'PUBLIC_REF_NOT_FOUND' || code === 'PUBLIC_CLAIM_NOT_FOUND') {
        toast(t('editor.designs.deleteGone', 'This design is with an order now, so it stays.'), 'warn');
        return;
      }
      toast(t('editor.designs.deleteFailed', 'That couldn’t be deleted. Try again.'), 'warn');
      return;
    }
    setDeleting(false);
    setAsking(null);
    if (item.remembered !== null) onForget?.(item.remembered);
    setItems((all) => (all ?? []).filter((one) => one !== item));
    toast(look === 'print' ? t('editor.designs.deletedPrint', '{name} is deleted.', { name: nameOf(item) }) : t('editor.designs.deleted', 'Design deleted.'), look === 'print' ? 'ok' : 'info');
    setTimeout(() => document.getElementById('cz-designs-title')?.focus(), 30);
  };
  const email = items?.find((one) => one.remembered?.email !== null && one.remembered?.email !== undefined)?.remembered?.email ?? null;

  return (
    <section className="cz-designs" data-screen="designs">
      <div className="cz-title">
        <h1 id="cz-designs-title" tabIndex={-1} className="cz-h1">
          {t('editor.designs.title', 'Your designs')}
        </h1>
        <p className="cz-sub">
          {byCode
            ? t('editor.designs.byCode', 'Opened after you found your order. Only you can see these.')
            : email === null
              ? t('editor.designs.here', 'The designs you saved on this device. Only you can see these.')
              : t('editor.designs.byLink', 'Only you can see these. You opened them with the link we e-mailed to {email}.', { email })}
        </p>
      </div>
      {items === null ? (
        <div className="cz-loading" role="status">
          <span className="cz-hidden">{t('editor.loading', 'Loading the designs')}</span>
          <div className="cz-skel cz-skel-row" />
        </div>
      ) : items.length === 0 ? (
        <div className="cz-empty">
          <span className="cz-tile">
            <FolderHeart aria-hidden="true" />
          </span>
          <p className="cz-empty-title">{t('editor.designs.none', 'No saved designs')}</p>
          <p className="cz-sub">{look === 'print' ? t('editor.designs.noneBodyPrint', 'When you choose “Save and come back”, the design waits here and we e-mail you the link.') : t('editor.designs.noneBody', 'When you press “Save and come back” while customising, the design waits here.')}</p>
          {onChoose === undefined ? null : (
            <button type="button" className="cz-primary" onClick={onChoose}>
              {look === 'print' ? t('editor.choose.title', 'Choose a design') : t('editor.saved.backToShop', 'Back to the shop')}
            </button>
          )}
        </div>
      ) : (
        <ul className="cz-design-list">
          {items.map((item) => {
            const catalogue = catalogues[String(item.design.base_id)] ?? null;
            const ready = catalogue === null ? null : readyOf(catalogue, item.design.ready_design_id);
            const words = wordsIn(catalogue, item.design) || t('editor.designs.noWords', 'No words yet');
            const name = ready?.name ?? (look === 'maker' ? t('editor.fill.plain', 'Plain piece') : t('editor.fill.yourDesign', 'Your design'));
            const two = (item.design.values.sides ?? 1) >= 2;
            return (
              <li key={String(item.design.id)} className="cz-design-row">
                <span className={two && look === 'print' ? 'cz-design-art cz-card-art-two' : 'cz-design-art'}>
                  {catalogue === null ? null : (
                    <>
                      <Drawing catalogue={catalogue} design={item.design} />
                      {two && look === 'print' ? <Drawing catalogue={catalogue} design={item.design} side="back" /> : null}
                    </>
                  )}
                </span>
                <span className="cz-design-text">
                  <span className="cz-strong">{look === 'print' ? `${name} — ${words.split(' · ')[0] ?? ''}` : words}</span>
                  <span className="cz-small">
                    {look === 'print' ? `${catalogue?.base.name ?? ''} · ${catalogue === null ? '' : `${String(catalogue.base.width)} × ${String(catalogue.base.height)} mm`}` : `${catalogue?.base.name ?? ''} · ${name}`}
                  </span>
                  {item.design.updatedAt === null ? null : (
                    <span className="cz-mono cz-small">{t('editor.designs.changed', 'Last changed {when}', { when: shortWhen(item.design.updatedAt, locale) })}</span>
                  )}
                </span>
                <span className="cz-chips">
                  <button type="button" className="cz-button" aria-label={t('editor.designs.openAria', 'Open {name}', { name: words })} onClick={() => onOpen(item.design)}>
                    <PenLine aria-hidden="true" />
                    {t('editor.designs.open', 'Open')}
                  </button>
                  <button type="button" className="cz-primary" aria-label={t('editor.designs.orderAria', 'Order {name}', { name: words })} onClick={() => onOrder(item.design)}>
                    <ShoppingBasket aria-hidden="true" />
                    {t('editor.designs.order', 'Order it')}
                  </button>
                  {item.design.state !== 'draft' || item.design.session === null ? null : (
                    <button type="button" className="cz-icon-button" aria-label={t('editor.designs.deleteAria', 'Delete {name}', { name: words })} onClick={() => setAsking(item)}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {asking === null ? null : (
        <Dialog labelledBy="cz-del-title" describedBy="cz-del-body" alert onClose={() => setAsking(null)}>
          <div className="cz-dialog-body">
            {look === 'print' ? (
              <span className="cz-tile cz-tile-danger">
                <Trash2 aria-hidden="true" />
              </span>
            ) : null}
            <h2 id="cz-del-title" className="cz-h2">
              {t('editor.designs.deleteTitle', 'Delete “{name}”?', { name: nameOf(asking) })}
            </h2>
            <p id="cz-del-body" className="cz-sub">
              {look === 'print' ? t('editor.designs.deleteBodyPrint', 'It goes from your designs and its link stops working. Orders you’ve placed keep their own copy.') : t('editor.designs.deleteBody', 'It goes for good, along with any logo you uploaded for it. Orders you’ve already placed keep their copy.')}
            </p>
            {look === 'print' ? (
              <div className="cz-dialog-actions cz-dialog-actions-end">
                <button type="button" className="cz-button" onClick={() => setAsking(null)}>
                  {t('editor.designs.keep', 'Keep it')}
                </button>
                <button type="button" className="cz-danger" aria-busy={deleting} aria-disabled={deleting} onClick={() => void remove(asking)}>
                  {t('editor.designs.deleteYesPrint', 'Delete')}
                </button>
              </div>
            ) : (
              <div className="cz-dialog-actions">
                <button type="button" className="cz-danger cz-grow" aria-busy={deleting} aria-disabled={deleting} onClick={() => void remove(asking)}>
                  {t('editor.designs.deleteYes', 'Delete it')}
                </button>
                <button type="button" className="cz-button cz-grow" onClick={() => setAsking(null)}>
                  {t('editor.designs.keep', 'Keep it')}
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
      <Toasts toasts={toasts} onUndo={(one) => one.undo?.()} />
    </section>
  );
}
