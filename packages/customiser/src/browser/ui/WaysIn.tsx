/**
 * "HOW WOULD YOU LIKE TO MAKE IT?": the print look's three ways in, for an
 * app to put on its own product page above its options.
 *
 * "Choose a design" shows only when the product has ready-made designs to
 * show; "Start from blank" and "Send your own file" always, in that order.
 * Each is the app's to open: the gallery (this editor), the full editor, its
 * own artwork step.
 */
import { LayoutTemplate, SquareDashed, SquarePen, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CustomiserApi } from '../api.ts';
import { isRightToLeft } from '../i18n.ts';
import { readCatalogue } from '../catalogue.ts';
import { SharedContext, sharedFor, useNarrow } from './context.tsx';

export interface WaysInProps {
  api: CustomiserApi;
  base: string | number;
  product: string;
  readyDesigns?: readonly (string | number)[];
  locale?: string;
  /** Which way is open below the cards, if any. */
  open?: 'choose' | 'blank' | 'own' | null;
  onChoose: () => void;
  onStartBlank: () => void;
  onSendOwnFile: () => void;
}

export function WaysIn(props: WaysInProps) {
  const shared = useMemo(() => sharedFor(props.locale, 'print', ''), [props.locale]);
  const { t } = shared;
  const narrow = useNarrow();
  const [count, setCount] = useState<{ designs: number; w: number; h: number; bleed: number } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    props.api
      .catalogue(props.base, abort.signal)
      .then((rows) => {
        const read = readCatalogue(rows, props.base, props.readyDesigns);
        if (read !== null) setCount({ designs: read.ready.length, w: read.base.width, h: read.base.height, bleed: read.base.bleed });
      })
      .catch(() => setCount(null));
    return () => abort.abort();
  }, [props.api, props.base, props.readyDesigns]);
  const cards = [
    ...(count !== null && count.designs > 0 ? [{ key: 'choose' as const, icon: <LayoutTemplate aria-hidden="true" />, title: t('editor.choose.title', 'Choose a design'), body: t('editor.ways.chooseBody', 'A ready-made design by the shop. Fill in your words, add your logo, pick the colours.'), meta: t('editor.choose.count', '{n, plural, one {# design} other {# designs}}', { n: count.designs }), go: props.onChoose }] : []),
    { key: 'blank' as const, icon: <SquarePen aria-hidden="true" />, title: t('editor.ways.blank', 'Start from blank'), body: t('editor.ways.blankBody', 'The full editor, on a page at the finished size with the bleed and safe line drawn.'), meta: count === null ? '' : t('editor.ways.blankMeta', '{w} × {h} mm + {bleed} mm bleed', { w: count.w, h: count.h, bleed: count.bleed }), go: props.onStartBlank },
    { key: 'own' as const, icon: <Upload aria-hidden="true" />, title: t('editor.ways.own', 'Send your own file'), body: t('editor.ways.ownBody', 'Already have print-ready artwork? Upload it and a person checks it.'), meta: t('editor.ways.ownMeta', 'PDF · TIFF · JPEG · up to 100 MB'), go: props.onSendOwnFile },
  ];
  return (
    <SharedContext.Provider value={shared}>
      <div className="cz cz-look-print" dir={isRightToLeft(shared.locale) ? 'rtl' : 'ltr'} lang={shared.locale}>
        <h2 id="cz-ways" className="cz-h3">
          {t('editor.ways.title', 'How would you like to make it?')}
        </h2>
        <div role="group" aria-labelledby="cz-ways" className={narrow ? 'cz-ways cz-ways-narrow' : 'cz-ways'}>
          {cards.map((card) => (
            <button key={card.key} type="button" className={props.open === card.key ? 'cz-door cz-on' : 'cz-door'} aria-expanded={card.key === 'own' ? props.open === 'own' : undefined} onClick={card.go}>
              <span className="cz-door-icon">{card.icon}</span>
              <span className="cz-door-text">
                <span className="cz-door-title">{card.title}</span>
                <span className="cz-small">{card.body}</span>
                <span className="cz-mono cz-hint">{card.meta}</span>
              </span>
            </button>
          ))}
        </div>
        {count !== null && count.designs === 0 ? (
          <p className="cz-small cz-note-line">
            <SquareDashed aria-hidden="true" />
            {t('editor.ways.noDesigns', 'There are no ready-made designs for {product} yet.', { product: props.product })}
          </p>
        ) : null}
      </div>
    </SharedContext.Provider>
  );
}
