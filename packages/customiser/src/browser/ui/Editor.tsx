/**
 * THE CUSTOMER'S EDITOR: choose a design, fill it in, check it, save it and
 * come back, put it in the basket.
 *
 * Mounted by a shop app's product page for one base (the product's), with
 * the app's own public clients (`customiserApi`), the product's name and the
 * price the app works out. The editor prices nothing and orders nothing:
 *
 * - it tells the app what the design is and which priced features it takes
 *   (`onDesignChange`), so the app can price it as its own option rows;
 * - "Add to basket" saves the design (a new one, or the draft in place) and
 *   hands the app its code (`onAddToBasket`): the app's order line names the
 *   design by that code;
 * - "Save and come back" asks the customer's address, saves the design and
 *   hands it to the app too (`onSaved`); its private link goes to the address.
 *
 * Its words follow the customer's language (all eight inside), right to left
 * where that language is written so. Its look follows the base: a page is
 * the print look (Marlow Press), a piece, a kit or a printed item the maker's
 * look (Birch Row); both take the app's colours and type through the CSS
 * variables the app sets.
 *
 * Undo and redo go back and forward one change at a time (a run of typing in
 * one field is one change), by the buttons or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z.
 */
import { ArrowLeft, Layers, Maximize2, PenTool, PencilRuler, Redo2, SquareDashed, Undo2, X, MailCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

import type { DesignValues, FileFact, PartValue, Refusal } from '../../rules/index.ts';
import { FILE_COLUMNS, type CustomiserApi, type DesignData, type SavedDesign } from '../api.ts';
import { isRightToLeft } from '../i18n.ts';
import { answerFor, freshValues, liveParts, paletteOf, partsOf, readCatalogue, readyOf, type Catalogue, type EditPart, type Ready } from '../catalogue.ts';
import { checksOf } from '../say.ts';
import { SharedContext, sharedFor, useNarrow, useShared, type Look } from './context.tsx';
import { Drawing } from './Drawing.tsx';
import { fieldId, type Upload } from './fieldKit.tsx';
import { browserMeasure, loadFonts } from './fonts.ts';
import { Gallery } from './Gallery.tsx';
import { MakerFields } from './MakerFields.tsx';
import { Dialog, Toasts, type Toast } from './Overlay.tsx';
import { PrintFields } from './PrintFields.tsx';
import { SaveDialog } from './SaveDialog.tsx';
import { BlockLine, ChecksList, MakerBar, MakerBeforeBar, MakerPhoneBar, QuoteBar, QuotePanel, type EditorPrice, type EditorQuantity } from './Summary.tsx';

export type { EditorPrice, EditorQuantity };

/** A design handed to the app: what it is, its code, and the priced features it takes. */
export interface DesignForBasket extends SavedDesign {
  used: string[];
}

export interface CustomiserEditorProps {
  api: CustomiserApi;
  /** The base the product is made on (its row in the Customiser). */
  base: string | number;
  /** The product as the app shows it: its name, and its own price and unit for the maker's header ("£34.00", "set of 4"). */
  product: { name: string; price?: string; unit?: string };
  /** The ready-made designs this product offers, when it offers fewer than the base has. */
  readyDesigns?: readonly (string | number)[];
  /** A design to open: one saved (from its link, from "Your designs", from a basket line) or one to start from. */
  design?: SavedDesign | DesignData;
  /** The shop's name, for "Only you and {shop} can see your logo." */
  shop?: string;
  /** The customer's language (`de-DE`); English when it is not one of the eight. */
  locale?: string;
  /** The look, when the app wants the other one than its base suggests. */
  look?: Look;
  /** How many sides the customer chose (a print shop's configurator). */
  sides?: 1 | 2;
  /** The price as the app works it out, for the design and quantity on screen. */
  price?: EditorPrice;
  quantity?: EditorQuantity;
  /** What each priced feature costs, as the app words it, by feature code ("+£1.50 a piece"). */
  featurePrices?: Readonly<Record<string, string>>;
  /** A refusal the app's order got for this design (`designRefusal`): shown at its part. */
  refused?: Refusal | null;
  /**
   * Whether this Adminium mails a saved design's link to the address it was
   * saved with. Off, "Save and come back" saves at once and shows the
   * customer their link to keep, and asks for no address.
   */
  mailsLink?: boolean;
  /** The address of the app's page that opens a saved design, for its link's code (default: this page, the code after `#`). */
  linkUrl?: (token: string) => string;
  /** The customer's own address, where the app knows it: the save dialog starts with it. */
  email?: string | null;
  /** The label on the basket button ("Update the basket" when editing a line). */
  addLabel?: string;
  /** The shop previews its own design: nothing is saved and nothing goes in a basket. */
  preview?: boolean;
  onDesignChange?: (change: { design: DesignData; used: string[]; ok: boolean }) => void;
  onAddToBasket: (design: DesignForBasket) => void;
  onSaved?: (design: SavedDesign, email: string | null) => void;
  /** Back to the product ("← Engraved walnut coasters"), and "Back to the shop" after saving. */
  onBack?: () => void;
  /** The print look's other ways in, and its full editor: the app's (or the full editor's) to open. */
  onStartBlank?: () => void;
  onSendOwnFile?: () => void;
  onFullEditor?: (design: DesignData) => void;
  onChangeSides?: () => void;
}

/** The editor, its catalogue loaded. */
export function CustomiserEditor(props: CustomiserEditorProps) {
  const [catalogue, setCatalogue] = useState<Catalogue | 'loading' | 'missing' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const only = props.readyDesigns;
  useEffect(() => {
    const abort = new AbortController();
    setCatalogue('loading');
    props.api
      .catalogue(props.base, abort.signal)
      .then((rows) => {
        const read = readCatalogue(rows, props.base, only);
        setCatalogue(read ?? 'missing');
        if (read !== null) void loadFonts(props.api, read.fonts);
      })
      .catch(() => {
        if (!abort.signal.aborted) setCatalogue('failed');
      });
    return () => abort.abort();
    // The list of ready-made designs is compared by its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.api, props.base, attempt, (only ?? []).join(',')]);
  const look: Look = props.look ?? (typeof catalogue === 'object' && catalogue.base.kind === 'page' ? 'print' : 'maker');
  const shared = useMemo(() => sharedFor(props.locale, look, props.shop ?? ''), [props.locale, look, props.shop]);
  return (
    <SharedContext.Provider value={shared}>
      <div className={`cz cz-look-${look}`} dir={isRightToLeft(shared.locale) ? 'rtl' : 'ltr'} lang={shared.locale}>
        {catalogue === 'loading' ? <Loading /> : catalogue === 'missing' || catalogue === 'failed' ? <Unavailable failed={catalogue === 'failed'} onRetry={() => setAttempt(attempt + 1)} onBack={props.onBack} /> : <Inside {...props} catalogue={catalogue} />}
      </div>
    </SharedContext.Provider>
  );
}

function Loading() {
  const { t } = useShared();
  return (
    <div className="cz-loading" role="status">
      <span className="cz-hidden">{t('editor.loading', 'Loading the designs')}</span>
      <div className="cz-skel cz-skel-stage" />
      <div className="cz-skel-col">
        <div className="cz-skel cz-skel-line" />
        <div className="cz-skel cz-skel-block" />
        <div className="cz-skel cz-skel-small" />
      </div>
    </div>
  );
}

function Unavailable({ failed, onRetry, onBack }: { failed: boolean; onRetry: () => void; onBack?: (() => void) | undefined }) {
  const { t } = useShared();
  return (
    <div className="cz-empty" role="status">
      <span className="cz-tile">
        <SquareDashed aria-hidden="true" />
      </span>
      <p className="cz-empty-title">{failed ? t('editor.failed', 'The designs couldn’t be loaded.') : t('editor.missing', 'This product can’t be customised just now.')}</p>
      <div className="cz-chips">
        {failed ? (
          <button type="button" className="cz-primary" onClick={onRetry}>
            {t('editor.retry', 'Try again')}
          </button>
        ) : null}
        {onBack === undefined ? null : (
          <button type="button" className="cz-button" onClick={onBack}>
            {t('editor.saved.backToShop', 'Back to the shop')}
          </button>
        )}
      </div>
    </div>
  );
}

interface History {
  past: DesignValues[];
  now: DesignValues;
  future: DesignValues[];
  /** The last change was typing into this part: more typing joins it. */
  typingIn: string | null;
}

/** The file facts the rules read: what was uploaded here, and the files a saved design already keeps. */
function factsOf(uploads: Readonly<Record<string, Upload>>, kept: Readonly<Record<string, string>>, parts: readonly EditPart[]): FileFact[] {
  const types: Record<string, string> = { svg: 'image/svg+xml', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  return FILE_COLUMNS.flatMap((column): FileFact[] => {
    const up = uploads[column];
    if (up !== undefined) return [{ column, kind: types[up.kind] ?? up.kind, size: up.size }];
    if (kept[column] === undefined) return [];
    // A file the design already keeps was checked when it was sent; the server reads its facts again on the order.
    const accept = parts.map((part) => (part.picture ?? part.text?.alsoLogo)).find((rules) => rules?.file === column)?.accept[0] ?? 'png';
    return [{ column, kind: types[accept] ?? 'image/png', size: 1 }];
  });
}

function Inside(props: CustomiserEditorProps & { catalogue: Catalogue }) {
  const { catalogue, api } = props;
  const { t, look, locale } = useShared();
  const narrow = useNarrow();
  const opened = props.design;
  const savedStart = opened !== undefined && 'id' in opened ? opened : null;
  const sides = props.sides ?? (opened?.values.sides ?? 1);
  const [ready, setReady] = useState<Ready | null>(() => (opened === undefined ? null : readyOf(catalogue, opened.ready_design_id)));
  const [view, setView] = useState<'choose' | 'fill'>(() => (opened !== undefined || (catalogue.ready.length === 0 && look === 'maker') ? 'fill' : 'choose'));
  const [history, setHistory] = useState<History>(() => ({ past: [], now: opened?.values ?? freshValues(catalogue, null, sides), future: [], typingIn: null }));
  const [saved, setSaved] = useState<SavedDesign | null>(savedStart);
  const [uploads, setUploads] = useState<Record<string, Upload>>({});
  const [tried, setTried] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [lockShown, setLockShown] = useState<string | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [guides, setGuides] = useState(false);
  const [overlay, setOverlay] = useState<'save' | 'full' | null>(null);
  const [typing, setTyping] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<{ sentTo: string | null; failed: string | null; link: string | null }>({ sentTo: null, failed: null, link: null });
  const [refused, setRefused] = useState<Refusal | null>(props.refused ?? null);
  const [stripShown, setStripShown] = useState(false);
  const focusNext = useRef<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const measure = useMemo(() => browserMeasure(), []);
  const [knownEmail, setKnownEmail] = useState<string | null>(props.email ?? null);
  useEffect(() => setRefused(props.refused ?? null), [props.refused]);

  const values = history.now;
  const design: DesignData = { base_id: catalogue.base.id, ready_design_id: ready?.id ?? null, values };
  const allParts = partsOf(catalogue, ready);
  const parts = liveParts(catalogue, ready, values);
  const palette = paletteOf(ready, values);
  const files = useMemo(() => factsOf(uploads, saved?.files ?? {}, allParts), [uploads, saved, allParts]);
  const answer = answerFor(catalogue, design, files, measure);
  const checks = checksOf(answer, { t, locale, look, parts, values, palette }, refused);
  const blocks = checks.filter((one) => one.block);
  const ordered = saved?.state === 'ordered';

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok', undo?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { id, text, kind, ...(undo === undefined ? {} : { undo }) }]);
    setTimeout(() => setToasts((all) => all.filter((one) => one.id !== id)), undo === undefined ? 3400 : 6000);
  }, []);

  // Tell the app what the design is now, so it can price it.
  // The app's callback is read when the design changes, never a reason to tell it again.
  const change = useRef(props.onDesignChange);
  change.current = props.onDesignChange;
  const key = JSON.stringify([design.ready_design_id, values]);
  useEffect(() => {
    change.current?.({ design, used: answer.used, ok: answer.ok });
    // The design is compared by its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, answer.ok, answer.used.join(',')]);

  // Focus moves where the customer was sent, once the field is drawn.
  useEffect(() => {
    const id = focusNext.current;
    if (id === null) return;
    focusNext.current = null;
    const element = document.getElementById(id);
    element?.focus();
    element?.scrollIntoView?.({ block: 'center' });
  });

  // On a phone the print look's card gives way to a strip once it scrolls out of sight.
  useEffect(() => {
    if (!narrow || look !== 'print' || view !== 'fill' || typeof IntersectionObserver === 'undefined' || sheet.current === null) {
      setStripShown(false);
      return undefined;
    }
    const watch = new IntersectionObserver(([entry]) => setStripShown(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < 0));
    watch.observe(sheet.current);
    return () => watch.disconnect();
  }, [narrow, look, view]);

  const commit = (next: DesignValues, typingIn: string | null = null): void => {
    setRefused(null);
    setHistory((h) => (typingIn !== null && h.typingIn === typingIn ? { ...h, now: next, future: [] } : { past: [...h.past, h.now].slice(-100), now: next, future: [], typingIn }));
  };
  const setPart = (code: string, value: PartValue | null): void => {
    const parts2 = { ...values.parts };
    if (value === null) delete parts2[code];
    else parts2[code] = value;
    const before = values.parts[code];
    const onlyText = value !== null && before !== undefined && Object.keys(value).every((k) => k === 'text' || (value as Record<string, unknown>)[k] === (before as Record<string, unknown>)[k]);
    commit({ ...values, parts: parts2 }, onlyText || (before === undefined && value !== null && Object.keys(value).every((k) => k === 'text')) ? code : null);
    setSelected(code);
  };
  const setDesign = (patch: Partial<Omit<DesignValues, 'parts'>>): void => commit({ ...values, ...patch });
  const undo = (): void => setHistory((h) => (h.past.length === 0 ? h : { past: h.past.slice(0, -1), now: h.past[h.past.length - 1]!, future: [h.now, ...h.future], typingIn: null }));
  const redo = (): void => setHistory((h) => (h.future.length === 0 ? h : { past: [...h.past, h.now], now: h.future[0]!, future: h.future.slice(1), typingIn: null }));
  const keys = (event: ReactKeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const k = event.key.toLowerCase();
    if (k === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((k === 'z' && event.shiftKey) || k === 'y') {
      event.preventDefault();
      redo();
    }
  };

  /** A part chosen by its field: its side is the one the card shows. */
  const select = (code: string | null): void => {
    setSelected(code);
    const part = code === null ? undefined : allParts.find((one) => one.code === code);
    if (part !== undefined && part.side !== side) setSide(part.side);
  };
  const focusPart = (code: string | null): void => {
    if (code === null) return;
    const part = allParts.find((one) => one.code === code);
    if (part !== undefined && part.side !== side) setSide(part.side);
    setSelected(code);
    focusNext.current = fieldId(code);
    // Force a draw even when nothing else changed, so the focus lands.
    setLockShown((one) => one);
    setTimeout(() => {
      if (focusNext.current === null) return;
      document.getElementById(focusNext.current)?.focus();
      focusNext.current = null;
    }, 0);
  };

  const pick = (choice: Ready | null): void => {
    setReady(choice);
    setHistory({ past: [], now: { ...freshValues(catalogue, choice, sides), ...carried(values) }, future: [], typingIn: null });
    setTried(false);
    setSelected(null);
    setSide('front');
    setView('fill');
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  };
  /** What a customer typed into parts that have the same code stays when they change the design. */
  const carried = (from: DesignValues): Pick<DesignValues, 'parts'> => ({ parts: Object.fromEntries(Object.entries(from.parts).filter(([, one]) => (one.text ?? '').trim() !== '').map(([code, one]) => [code, { text: one.text! }])) });

  const keptFiles = (): Record<string, string> => Object.fromEntries(Object.entries(uploads).map(([column, one]) => [column, one.id]));

  const upload = async (part: EditPart, column: string, file: File): Promise<void> => {
    if (api.upload === null) throw new Error('uploads are not taken here');
    const sent = await api.upload(column, file, file.name, saved?.session ?? null);
    setUploads((all) => ({ ...all, [column]: sent }));
    const value = values.parts[part.code] ?? {};
    setPart(part.code, { ...value, file: column, ...(part.kind === 'text' ? { mode: 'logo' as const } : {}) });
  };

  /** Keep the design on the server: a new one, or the draft in place. */
  const keep = async (email: string | null): Promise<SavedDesign> => {
    const through = saved !== null && saved.session !== null && saved.state === 'draft' && (email === null || knownEmail === email);
    const made = through ? await api.change(saved, values, keptFiles()) : await api.create(design, email, keptFiles());
    // A change answers no link: the one the save answered, or the design was opened by, stays the design's.
    const next = { ...made, link: made.link ?? (through ? saved.link : null) ?? null };
    setSaved(next);
    setUploads({});
    if (email !== null) setKnownEmail(email);
    return next;
  };
  const wordsFor = (error: unknown): string => {
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    if (code === 'PUBLIC_RATE_LIMITED') return t('editor.error.rate', 'Too many tries. Wait a minute and try again.');
    if (code === 'PUBLIC_WRITE_REFUSED') return t('editor.error.refused', 'The shop couldn’t take this design as it is. Check it and try again.');
    return t('editor.error.other', 'That couldn’t be saved. Try again.');
  };

  const addToBasket = async (): Promise<void> => {
    if (busy) return;
    if (blocks.length > 0) {
      setTried(true);
      focusPart(blocks[0]!.part);
      return;
    }
    if (props.preview === true) {
      toast(t('editor.preview.noBasket', 'Previewing — nothing goes in a real basket.'), 'info');
      return;
    }
    setBusy(true);
    try {
      const kept = ordered ? await api.create(design, null, keptFiles()) : await keep(null);
      if (ordered) setSaved(kept);
      props.onAddToBasket({ ...kept, used: answer.used });
    } catch (error) {
      toast(wordsFor(error), 'warn');
    } finally {
      setBusy(false);
    }
  };
  const openSave = (): void => {
    if (props.preview === true) {
      toast(t('editor.preview.noSave', 'Previewing — saving is switched off here.'), 'info');
      return;
    }
    setSaveState({ sentTo: null, failed: null, link: null });
    setOverlay('save');
    if (props.mailsLink !== true) void submitSave(null);
  };
  const linkOf = (token: string | null | undefined): string => {
    if (token === null || token === undefined) return '';
    if (props.linkUrl !== undefined) return props.linkUrl(token);
    return typeof location === 'undefined' ? `#${token}` : `${location.href.split('#')[0] ?? ''}#${token}`;
  };
  const submitSave = async (email: string | null): Promise<void> => {
    setBusy(true);
    try {
      const next = ordered ? await api.create(design, email, keptFiles()) : await keep(email);
      if (ordered) {
        setSaved(next);
        if (email !== null) setKnownEmail(email);
      }
      setSaveState({ sentTo: email ?? '', failed: null, link: props.mailsLink === true ? null : linkOf(next.link) });
      props.onSaved?.(next, email);
    } catch (error) {
      setSaveState({ sentTo: null, failed: wordsFor(error), link: null });
    } finally {
      setBusy(false);
    }
  };

  if (view === 'choose')
    return (
      <>
        <Gallery catalogue={catalogue} product={props.product.name} sides={sides} onPick={pick} onBack={props.onBack} onStartBlank={props.onStartBlank} onSendOwnFile={props.onSendOwnFile} onChangeSides={props.onChangeSides} />
        <Toasts toasts={toasts} onUndo={(one) => one.undo?.()} />
      </>
    );

  const editableCount = parts.filter((one) => !one.locked && one.kind !== 'shape').length;
  const designName = ready === null ? (look === 'maker' ? t('editor.fill.plain', 'Plain piece') : t('editor.fill.yourDesign', 'Your design')) : ready.name;
  const bar = { price: props.price, quantity: props.quantity, blocks, addLabel: props.addLabel ?? t('editor.add', 'Add to basket'), onAdd: () => void addToBasket(), onSave: openSave, busy, hidden: typing };
  const fieldsProps = { catalogue, parts, values, palette, checks, selected, tried, setPart, setDesign, onSelect: select, onTyping: setTyping, featurePrices: props.featurePrices ?? {}, uploads, upload, api, session: saved?.session ?? null };
  const stageLabel = t('editor.stage.label', '{product}, {design}. Shown flat.', { product: props.product.name, design: designName });
  const undoButtons: ReactNode = (
    <span className="cz-undo">
      <button type="button" className="cz-icon-button" aria-label={t('editor.undo', 'Undo')} title={t('editor.undo', 'Undo')} aria-disabled={history.past.length === 0} onClick={undo}>
        <Undo2 aria-hidden="true" className="cz-flip" />
      </button>
      <button type="button" className="cz-icon-button" aria-label={t('editor.redo', 'Redo')} title={t('editor.redo', 'Redo')} aria-disabled={history.future.length === 0} onClick={redo}>
        <Redo2 aria-hidden="true" className="cz-flip" />
      </button>
    </span>
  );
  const ordinaryNote = ordered ? (
    <div role="status" className="cz-note">
      {t('editor.fill.ordered', 'This design is with an order already, so it stays as it was. What you change here is saved as a new design.')}
    </div>
  ) : null;

  const dialogs = (
    <>
      {overlay === 'save' ? (
        <SaveDialog
          email={knownEmail ?? ''}
          asks={props.mailsLink === true}
          sentTo={saveState.sentTo}
          link={saveState.link}
          busy={busy}
          failed={saveState.failed}
          onSubmit={(email) => void submitSave(email)}
          onRetry={() => void submitSave(null)}
          onCopied={() => toast(t('editor.saved.copied', 'Link copied.'))}
          onClose={() => setOverlay(null)}
          onBackToShop={props.onBack}
        />
      ) : null}
      {overlay === 'full' ? <FullScreen catalogue={catalogue} design={design} side={side} setSide={setSide} guides={guides} setGuides={setGuides} narrow={narrow} onClose={() => setOverlay(null)} /> : null}
      <Toasts toasts={toasts} onUndo={(one) => one.undo?.()} raised={narrow} />
    </>
  );

  if (look === 'maker') {
    // A printed item says its colour ("PLA · Amber"); a piece its material and thickness ("Walnut 6 mm").
    const colourPart = parts.find((one) => one.kind === 'colour');
    const colourCode = colourPart === undefined ? undefined : (values.parts[colourPart.code]?.choice ?? colourPart.start?.choice);
    const colourName = colourPart === undefined ? undefined : (catalogue.shared[colourPart.palette ?? '']?.find((one) => one.code === colourCode)?.name ?? colourCode);
    const material = catalogue.base.material === null ? null : catalogue.base.kind === 'printed' && colourName !== undefined ? `${catalogue.base.material} · ${colourName}` : catalogue.base.thickness === null ? catalogue.base.material : `${catalogue.base.material} ${String(catalogue.base.thickness)} mm`;
    // A kit is its assembled size and its pieces; a piece its outline and thickness.
    const kit = catalogue.base.kind === 'kit';
    const depth = kit ? catalogue.base.depth : catalogue.base.thickness;
    const size = [catalogue.base.width, catalogue.base.height, ...(depth === null ? [] : [depth])].map(String).join(' × ') + ' mm' + (kit && catalogue.rows.pieces.length > 0 ? ` · ${t('editor.stage.pieces', '{n, plural, one {# piece} other {# pieces}}', { n: catalogue.rows.pieces.length })}` : '');
    return (
      <section className="cz-fill cz-fill-maker" data-screen="fill" onKeyDown={keys}>
        <div className="cz-stage-col">
          <div className="cz-stage">
            <Drawing catalogue={catalogue} design={design} empty="dim" onPart={focusPart} selected={selected} lockShown={lockShown} onLock={setLockShown} label={stageLabel} />
            <span className="cz-stage-labels">
              <span className="cz-mono cz-stage-label">{size}</span>
              {material === null ? null : <span className="cz-stage-label">{material}</span>}
            </span>
          </div>
          {catalogue.ready.length === 0 ? (
            <div role="status" className="cz-note cz-note-dashed">
              <SquareDashed aria-hidden="true" />
              <span>
                <span className="cz-strong">{t('editor.fill.noneTitle', 'No ready-made designs for this one')}</span>
                <span className="cz-small">{t('editor.fill.noneBody', 'You’re starting with the plain piece. Add your words where the studio allows them.')}</span>
              </span>
            </div>
          ) : null}
        </div>
        <div className="cz-side-col">
          <div className="cz-title">
            <h1 className="cz-h1">{props.product.name}</h1>
            <div className="cz-title-line">
              <span className="cz-pill">
                <Layers aria-hidden="true" />
                {ready === null ? designName : t('editor.fill.design', 'Design: {name}', { name: ready.name })}
              </span>
              {catalogue.ready.length > 0 && props.preview !== true ? (
                <button type="button" className="cz-link" onClick={() => setView('choose')}>
                  {t('editor.fill.change', 'Change the design')}
                </button>
              ) : null}
              {props.product.price === undefined ? null : (
                <span className="cz-push cz-base-price">
                  <span className="cz-mono cz-strong">{props.product.price}</span>
                  {props.product.unit === undefined ? null : <span className="cz-small">{props.product.unit}</span>}
                </span>
              )}
            </div>
          </div>
          {ordinaryNote}
          <div className="cz-card-box">
            <div className="cz-card-head">
              <span className="cz-tile cz-tile-accent cz-tile-small">
                <PenTool aria-hidden="true" />
              </span>
              <h2 className="cz-h3">{t('editor.fill.makeItYours', 'Make it yours')}</h2>
              {undoButtons}
              <span className="cz-mono cz-kicker">{t('editor.fill.toChange', '{n} TO CHANGE', { n: editableCount })}</span>
            </div>
            <MakerFields {...fieldsProps} />
            <div className="cz-card-foot">
              <MailCheck aria-hidden="true" />
              {t('editor.fill.proof', 'We’ll send you a proof before we cut anything.')}
            </div>
          </div>
          <ChecksList checks={checks} onGo={focusPart} />
          {narrow ? (
            <>
              <MakerBeforeBar {...bar} />
              <MakerPhoneBar {...bar} />
            </>
          ) : (
            <MakerBar {...bar} />
          )}
        </div>
        {dialogs}
      </section>
    );
  }

  // The print look.
  const two = sides >= 2 && catalogue.base.sides >= 2;
  const lockPart = lockShown === null ? null : (allParts.find((one) => one.code === lockShown) ?? null);
  const trim = `${String(catalogue.base.width)} × ${String(catalogue.base.height)} mm`;
  return (
    <section className="cz-fill cz-fill-print" data-screen="fill" onKeyDown={keys}>
      {/* Sticks to the top once the card has scrolled away: placed first, so it has somewhere to stick from. */}
      {narrow && stripShown && !typing ? (
        <button type="button" className="cz-strip" aria-label={t('editor.stage.full', 'Full-screen preview')} onClick={() => setOverlay('full')}>
          <Drawing catalogue={catalogue} design={design} side={side} empty="dim" className="cz-strip-drawing" />
        </button>
      ) : null}
      <button type="button" className="cz-back" onClick={() => setView('choose')}>
        <ArrowLeft aria-hidden="true" className="cz-flip" />
        {t('editor.fill.allDesigns', 'All designs')}
      </button>
      <div className="cz-title-row">
        <div className="cz-title">
          <h1 className="cz-h1">{designName}</h1>
          <p className="cz-sub">
            {props.product.name} · <span className="cz-mono">{trim}</span> · {two ? t('editor.sides.both', 'both sides') : t('editor.sides.one', 'one side')}
          </p>
        </div>
        {undoButtons}
        {props.onFullEditor === undefined || props.preview === true ? null : (
          <button type="button" className="cz-button" onClick={() => props.onFullEditor?.(design)}>
            <PencilRuler aria-hidden="true" />
            {t('editor.fill.fullEditor', 'Switch to the full editor')}
          </button>
        )}
      </div>
      {ordinaryNote}
      <div className="cz-fill-grid">
        <div className="cz-card-col">
          <div ref={sheet} className="cz-sheet">
            <div className="cz-sheet-tools">
              {two ? <SideSwitch side={side} setSide={setSide} /> : null}
              {narrow ? (
                <button type="button" aria-pressed={guides} className={guides ? 'cz-chip cz-on' : 'cz-chip'} onClick={() => setGuides(!guides)}>
                  {t('editor.stage.guides', 'Guides')}
                </button>
              ) : (
                <ModeSwitch guides={guides} setGuides={setGuides} />
              )}
              <button type="button" className="cz-icon-button cz-push" aria-label={t('editor.stage.full', 'Full-screen preview')} title={t('editor.stage.full', 'Full-screen preview')} onClick={() => setOverlay('full')}>
                <Maximize2 aria-hidden="true" />
              </button>
            </div>
            <div className="cz-stage cz-stage-page">
              <Drawing catalogue={catalogue} design={design} side={side} guides={guides} empty="dim" onPart={focusPart} selected={selected} lockShown={lockShown} onLock={setLockShown} label={stageLabel} />
            </div>
            {!narrow && guides ? (
              <div className="cz-legend">
                <span className="cz-legend-item">
                  <span className="cz-legend-trim" />
                  {t('editor.stage.trim', 'Trim')}
                </span>
                <span className="cz-legend-item">
                  <span className="cz-legend-bleed" />
                  {t('editor.stage.bleed', 'Bleed')} <span className="cz-mono">{`${String(catalogue.base.bleed)} mm`}</span>
                </span>
                {catalogue.base.safe === null ? null : (
                  <span className="cz-legend-item">
                    <span className="cz-legend-safe" />
                    {t('editor.stage.safe', 'Safe line')} <span className="cz-mono">{`${String(catalogue.base.safe)} mm`}</span>
                  </span>
                )}
              </div>
            ) : null}
            <div aria-live="polite" className="cz-lock-line">
              {lockPart === null ? null : (
                <p className="cz-small">
                  {t('editor.stage.locked', '{name} is the shop’s part — it stays as it is.', { name: lockPart.name })}
                </p>
              )}
            </div>
          </div>
          {narrow ? null : <QuotePanel {...bar} nothingAdded={answer.used.length === 0} onShow={() => focusPart(blocks[0]?.part ?? null)} />}
        </div>
        <div className="cz-fields-col">
          <PrintFields {...fieldsProps} ready={ready} sides={two ? 2 : 1} />
          <ChecksList checks={checks} onGo={focusPart} />
          {narrow ? (
            <div className="cz-before-bar">
              {blocks.length > 0 ? <BlockLine id="cz-block" blocks={blocks} onShow={() => focusPart(blocks[0]?.part ?? null)} /> : null}
              {answer.used.length === 0 ? <p className="cz-small">{t('editor.quote.nothingAdded', 'Customising adds nothing to the price.')}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
      {narrow ? <QuoteBar {...bar} /> : null}
      {dialogs}
    </section>
  );
}

function SideSwitch({ side, setSide, dark = false }: { side: 'front' | 'back'; setSide: (side: 'front' | 'back') => void; dark?: boolean }) {
  const { t } = useShared();
  return (
    <div role="radiogroup" aria-label={t('editor.stage.side', 'Side')} className={dark ? 'cz-seg cz-seg-dark' : 'cz-seg'}>
      {(['front', 'back'] as const).map((one) => (
        <button key={one} type="button" role="radio" aria-checked={side === one} className={side === one ? 'cz-on' : ''} onClick={() => setSide(one)}>
          {one === 'front' ? t('editor.side.front', 'Front') : t('editor.side.back', 'Back')}
        </button>
      ))}
    </div>
  );
}

function ModeSwitch({ guides, setGuides, dark = false }: { guides: boolean; setGuides: (on: boolean) => void; dark?: boolean }) {
  const { t } = useShared();
  return (
    <div role="radiogroup" aria-label={t('editor.stage.mode', 'How the card is shown')} className={dark ? 'cz-seg cz-seg-dark' : 'cz-seg'}>
      <button type="button" role="radio" aria-checked={!guides} className={guides ? '' : 'cz-on'} onClick={() => setGuides(false)}>
        {t('editor.stage.printed', 'As printed')}
      </button>
      <button type="button" role="radio" aria-checked={guides} className={guides ? 'cz-on' : ''} onClick={() => setGuides(true)}>
        {t('editor.stage.withGuides', 'With guides')}
      </button>
    </div>
  );
}

/** The design at the size of the screen, both sides, with or without the guides. */
function FullScreen({ catalogue, design, side, setSide, guides, setGuides, narrow, onClose }: { catalogue: Catalogue; design: DesignData; side: 'front' | 'back'; setSide: (side: 'front' | 'back') => void; guides: boolean; setGuides: (on: boolean) => void; narrow: boolean; onClose: () => void }) {
  const { t } = useShared();
  const turned = narrow && catalogue.base.width > catalogue.base.height;
  const two = (design.values.sides ?? 1) >= 2 && catalogue.base.sides >= 2;
  return (
    <Dialog labelledBy="cz-full-title" onClose={onClose} className="cz-full">
      <h2 id="cz-full-title" className="cz-hidden">
        {t('editor.stage.full', 'Full-screen preview')}
      </h2>
      <div className="cz-full-tools">
        {two ? <SideSwitch side={side} setSide={setSide} dark /> : null}
        <ModeSwitch guides={guides} setGuides={setGuides} dark />
        <button type="button" className="cz-icon-button cz-icon-big cz-push cz-full-close" aria-label={t('editor.stage.close', 'Close the preview')} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className={turned ? 'cz-full-stage cz-turned' : 'cz-full-stage'}>
        <Drawing catalogue={catalogue} design={design} side={side} guides={guides} empty="hide" />
      </div>
      {turned ? <p className="cz-full-note">{t('editor.stage.turned', 'Turned to fill the screen.')}</p> : null}
    </Dialog>
  );
}
