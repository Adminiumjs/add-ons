/**
 * CHOOSE A DESIGN: the shop's ready-made designs for one base.
 *
 * Both comps' galleries in one: filters by the shop's tags with their counts
 * (Birch Row draws counts, Marlow Press a search; the add-on shows both), a
 * search over the names and what each design lets you change, cards drawn
 * from the designs' own data, and an empty state. The maker's look ends the
 * grid with "Start with a plain piece"; the print look, with no designs,
 * offers the two other ways in ("Start from blank", "Send your own file"),
 * which are the app's to open.
 */
import { ArrowLeft, Image as ImageIcon, SearchX, Sprout, SquareDashed, SquarePen, Type, Upload, Wand2, Search } from 'lucide-react';
import { useId, useState } from 'react';

import { freshValues, type Catalogue, type Ready } from '../catalogue.ts';
import { useShared, useNarrow } from './context.tsx';
import { Drawing } from './Drawing.tsx';

/** What a design lets a customer change, as the chips on its card say. */
export function chipsOf(ready: Ready): ('words' | 'logo' | 'photo' | 'motif')[] {
  const out = new Set<'words' | 'logo' | 'photo' | 'motif'>();
  for (const part of ready.parts) {
    if (part.locked) continue;
    if (part.kind === 'text') out.add('words');
    if (part.kind === 'picture') out.add(part.picture?.picture === 'photo' ? 'photo' : 'logo');
    if (part.kind === 'text' && part.text?.alsoLogo !== null && part.text?.alsoLogo !== undefined) out.add('logo');
    if (part.kind === 'choice') out.add('motif');
  }
  return (['words', 'logo', 'photo', 'motif'] as const).filter((one) => out.has(one));
}

export interface GalleryProps {
  catalogue: Catalogue;
  product: string;
  sides: number;
  onPick: (ready: Ready | null) => void;
  onBack?: (() => void) | undefined;
  onStartBlank?: (() => void) | undefined;
  onSendOwnFile?: (() => void) | undefined;
  onChangeSides?: (() => void) | undefined;
}

export function Gallery({ catalogue, product, sides, onPick, onBack, onStartBlank, onSendOwnFile, onChangeSides }: GalleryProps) {
  const { t, look, locale } = useShared();
  const narrow = useNarrow();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const searchId = useId();
  const { base } = catalogue;
  const chipWords = { words: t('editor.chip.words', 'Your words'), logo: t('editor.chip.logo', 'Your logo'), photo: t('editor.chip.photo', 'Photo'), motif: t('editor.chip.motif', 'Motifs') };
  const tagWords: Record<string, string> = {
    words: t('editor.filter.words', 'Words only'),
    logo: t('editor.filter.logo', 'With a logo'),
    motif: t('editor.filter.motif', 'Motifs'),
    simple: t('editor.filter.simple', 'Simple'),
    bold: t('editor.filter.bold', 'Bold'),
    photo: t('editor.filter.photo', 'With a photo'),
    one: t('editor.filter.one', 'One colour'),
  };
  // "Words only" is a design whose one tag is words, as Birch Row counts it.
  const matches = (ready: Ready, tag: string): boolean => tag === 'all' || (tag === 'words' ? ready.tags.length === 1 && ready.tags[0] === 'words' : ready.tags.includes(tag));
  // The comps' order: the maker's tags, then the print shop's, then any the shop added.
  const ORDER = ['words', 'logo', 'motif', 'simple', 'bold', 'photo', 'one'];
  const rank = (tag: string): number => (ORDER.includes(tag) ? ORDER.indexOf(tag) : ORDER.length);
  const tags = [...new Set(catalogue.ready.flatMap((one) => one.tags))].sort((a, b) => rank(a) - rank(b));
  const asked = query.trim().toLocaleLowerCase(locale);
  const list = catalogue.ready.filter((one) => matches(one, filter)).filter((one) => asked === '' || `${one.name} ${chipsOf(one).map((chip) => chipWords[chip]).join(' ')}`.toLocaleLowerCase(locale).includes(asked));
  const has = catalogue.ready.length > 0;
  const two = look === 'print' && sides >= 2;
  const trim = `${String(base.width)} × ${String(base.height)} mm`;

  return (
    <section className="cz-choose" data-screen="choose">
      {onBack === undefined ? null : (
        <button type="button" className="cz-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {product}
        </button>
      )}
      <div className="cz-choose-head">
        {look === 'maker' ? (
          <span className="cz-pill">
            <Wand2 aria-hidden="true" />
            {t('editor.choose.chip', 'Make it yours')}
          </span>
        ) : null}
        <h1 className="cz-h1">{t('editor.choose.title', 'Choose a design')}</h1>
        {look === 'maker' ? (
          <p className="cz-sub">{t('editor.choose.subMaker', '{n, plural, one {# ready-made design} other {# ready-made designs}} for the {product}. Pick one, then change what it lets you change.', { n: catalogue.ready.length, product })}</p>
        ) : (
          <p className="cz-sub">
            {t('editor.choose.subPrint', 'Shown on your {trim} {product}, {sides}. Each one has parts you fill in; the rest stays as the shop made it.', { trim, product: locale.startsWith('en') ? product.toLocaleLowerCase(locale) : product, sides: sides >= 2 ? t('editor.sides.both', 'both sides') : t('editor.sides.one', 'one side') })}{' '}
            {onChangeSides === undefined ? null : (
              <button type="button" className="cz-link" onClick={onChangeSides}>
                {t('editor.choose.changeSides', 'Change the size or sides')}
              </button>
            )}
          </p>
        )}
      </div>

      {has ? (
        <>
          <div className="cz-choose-tools">
            <div role="radiogroup" aria-label={t('editor.choose.show', 'Show designs')} className="cz-chips">
              {['all', ...tags].map((tag) => (
                <button key={tag} type="button" role="radio" aria-checked={filter === tag} className={filter === tag ? 'cz-filter cz-on' : 'cz-filter'} onClick={() => setFilter(tag)}>
                  {tag === 'all' ? t('editor.filter.all', 'All') : (tagWords[tag] ?? tag)}
                  <span className="cz-mono cz-count">{catalogue.ready.filter((one) => matches(one, tag)).length}</span>
                </button>
              ))}
            </div>
            <div className="cz-search">
              <label htmlFor={searchId} className="cz-hidden">
                {t('editor.choose.search', 'Search designs')}
              </label>
              <Search aria-hidden="true" />
              <input id={searchId} type="search" value={query} placeholder={t('editor.choose.search', 'Search designs')} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          <p aria-live="polite" className="cz-mono cz-tally">
            {t('editor.choose.count', '{n, plural, one {# design} other {# designs}}', { n: list.length })}
          </p>
          <div className={narrow ? 'cz-cards cz-cards-narrow' : 'cz-cards'}>
            {list.map((ready) => {
              const chips = chipsOf(ready);
              const design = { base_id: base.id, ready_design_id: ready.id, values: freshValues(catalogue, ready, sides) };
              return (
                <button key={String(ready.id)} type="button" className="cz-card" aria-label={t('editor.choose.use', 'Customise the {name} design. {chips}.', { name: ready.name, chips: chips.map((chip) => chipWords[chip]).join(', ') })} onClick={() => onPick(ready)}>
                  <span className={two ? 'cz-card-art cz-card-art-two' : 'cz-card-art'}>
                    {/* The front as the shop's preview picture shows it, where it has one; else drawn here. */}
                    {ready.picture === null ? <Drawing catalogue={catalogue} design={design} /> : <img src={ready.picture} alt="" className="cz-drawing cz-card-picture" />}
                    {two ? <Drawing catalogue={catalogue} design={design} side="back" /> : null}
                  </span>
                  <span className="cz-card-body">
                    <span className="cz-card-name">
                      {ready.name}
                      {look === 'print' ? (
                        <span className="cz-card-meta">
                          {t('editor.choose.colourways', '{n, plural, one {# colourway} other {# colourways}}', { n: Math.max(1, ready.palettes.length) })}
                          {ready.layouts.length > 1 ? ` · ${t('editor.choose.layouts', '{n, plural, one {# layout} other {# layouts}}', { n: ready.layouts.length })}` : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className="cz-tags">
                      {chips.map((chip) => (
                        <span key={chip} className="cz-tag">
                          {look === 'maker' ? chip === 'words' ? <Type aria-hidden="true" /> : chip === 'motif' ? <Sprout aria-hidden="true" /> : <ImageIcon aria-hidden="true" /> : null}
                          {chipWords[chip]}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
            {look === 'maker' ? (
              <button type="button" className="cz-card cz-card-plain" onClick={() => onPick(null)}>
                <span className="cz-tile">
                  <SquareDashed aria-hidden="true" />
                </span>
                <span className="cz-card-name">{t('editor.choose.plain', 'Start with a plain piece')}</span>
                <span className="cz-small">{catalogue.plain.length > 0 ? t('editor.choose.plainSub', 'Your words or logo where the studio allows them.') : t('editor.choose.plainNone', 'The piece as it comes, with nothing added.')}</span>
              </button>
            ) : null}
          </div>
          {list.length === 0 ? (
            <div className="cz-empty">
              <span className="cz-tile">
                <SearchX aria-hidden="true" />
              </span>
              <p className="cz-empty-title">{asked === '' ? t('editor.choose.noMatch', 'No designs match that') : t('editor.choose.noMatchQuery', 'No designs match “{query}”', { query: query.trim() })}</p>
              <button
                type="button"
                className="cz-button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                {t('editor.choose.showAll', 'Show all designs')}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="cz-none">
          <span className="cz-tile cz-tile-big">
            <SquareDashed aria-hidden="true" />
          </span>
          <h2 className="cz-h2">{t('editor.choose.none', 'No ready-made designs for {product} yet', { product })}</h2>
          <p className="cz-sub">{t('editor.choose.noneSub', 'Start from a blank page at the right size, or send a file you’ve made.')}</p>
          <div className="cz-doors">
            {onStartBlank === undefined ? null : (
              <button type="button" className="cz-door" onClick={onStartBlank}>
                <span className="cz-door-icon">
                  <SquarePen aria-hidden="true" />
                </span>
                <span className="cz-door-text">
                  <span className="cz-door-title">{t('editor.ways.blank', 'Start from blank')}</span>
                  <span className="cz-small">{t('editor.ways.blankNone', 'The page at its finished size, with the bleed and safe line drawn.')}</span>
                </span>
              </button>
            )}
            {onSendOwnFile === undefined ? null : (
              <button type="button" className="cz-door" onClick={onSendOwnFile}>
                <span className="cz-door-icon">
                  <Upload aria-hidden="true" />
                </span>
                <span className="cz-door-text">
                  <span className="cz-door-title">{t('editor.ways.own', 'Send your own file')}</span>
                  <span className="cz-small">{t('editor.ways.ownNone', 'A PDF, TIFF or JPEG up to 100 MB.')}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
