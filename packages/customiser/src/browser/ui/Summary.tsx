/**
 * THE CHECKS, THE TOTAL AND "ADD TO BASKET".
 *
 * The list of checks (Birch Row's, in both looks: one Customiser), each row
 * taking the customer to its part ("Go to it"). The total is the app's: the
 * editor shows what the app passes in and prices nothing.
 *
 * - The maker's look: Birch Row's total bar, sticky at the foot of the
 *   fields, with the quantity, the break chips, the total, "Save and come
 *   back", "Add to basket" and the post-by line. On a phone the bar is one
 *   row (the quantity, the total, "Add to basket"), the rest sits in the page
 *   just above it, and the bar hides while a text field has focus.
 * - The print look: Marlow Press's quote panel under the card on a desktop,
 *   and its one-row quote bar on a phone, hidden while a text field has focus.
 *
 * "Add to basket" is never disabled, only marked so (`aria-disabled`) with
 * the reason beside it: pressing it then takes the customer to the first
 * thing to fix.
 */
import { Bookmark, CalendarCheck, Calendar, ChevronRight, CircleAlert, CircleCheck, ListChecks, Lock, Minus, Plus, ShoppingBasket } from 'lucide-react';

import type { Check } from '../say.ts';
import { useShared } from './context.tsx';
import { CheckIcon } from './fieldKit.tsx';

export interface EditorPrice {
  /** The total, as the app writes money ("£40.00"). */
  total: string;
  /** What one costs ("£0.18"), where the app shows it. */
  each?: string;
  /** The line under the total: what it includes ("£40.00 a set · includes your own logo +£6.00"). */
  detail?: string;
  /** When it is ready, as the app works it out ("Mon 10 Aug"). */
  ready?: string;
  /** The post-by line ("Order by 17:00 and we post it by Tue 11 Aug"). */
  note?: string;
  /** The app is working the price out. */
  pending?: boolean;
}

export interface EditorQuantity {
  value: number;
  min?: number;
  max?: number;
  /** The quantities with a lower price, and what each takes off ("−8%"). */
  breaks?: readonly { qty: number; label: string }[];
  onChange: (qty: number) => void;
}

export function ChecksList({ checks, onGo }: { checks: readonly Check[]; onGo: (part: string | null) => void }) {
  const { t } = useShared();
  const blocks = checks.filter((one) => one.block).length;
  return (
    <div aria-live="polite" className="cz-checks">
      <div className="cz-checks-head">
        <ListChecks aria-hidden="true" />
        <h2 className="cz-h3">{t('editor.checks.title', 'Checks')}</h2>
        <span className={`cz-mono cz-checks-count ${blocks > 0 ? 'cz-bad' : checks.length > 0 ? 'cz-warn' : 'cz-good'}`}>{checks.length > 0 ? t('editor.checks.count', '{n} to look at', { n: checks.length }) : t('editor.checks.clear', 'All clear')}</span>
      </div>
      {checks.length === 0 ? (
        <div className="cz-checks-clear">
          <CircleCheck aria-hidden="true" />
          {t('editor.checks.nothing', 'Nothing to fix. Whether it looks right is what the proof is for.')}
        </div>
      ) : (
        checks.map((check, i) => (
          <button key={i} type="button" className={check.block ? 'cz-check cz-bad' : 'cz-check cz-warn'} onClick={() => onGo(check.part)}>
            <CheckIcon icon={check.icon} />
            <span className="cz-check-text">{check.listed}</span>
            <span className="cz-check-go">{t('editor.checks.go', 'Go to it')}</span>
            <ChevronRight aria-hidden="true" className="cz-flip" />
          </button>
        ))
      )}
    </div>
  );
}

interface BarProps {
  price: EditorPrice | undefined;
  quantity: EditorQuantity | undefined;
  blocks: readonly Check[];
  addLabel: string;
  onAdd: () => void;
  onSave: () => void;
  busy: boolean;
  /** The phone's text field has focus: the bar steps aside for the keyboard. */
  hidden: boolean;
}

function Stepper({ quantity }: { quantity: EditorQuantity }) {
  const { t } = useShared();
  const [min, max] = [quantity.min ?? 1, quantity.max ?? 999];
  return (
    <div role="group" aria-label={t('editor.bar.howMany', 'How many')} className="cz-stepper">
      <button type="button" aria-label={t('editor.bar.fewer', 'One fewer')} aria-disabled={quantity.value <= min} onClick={() => quantity.value > min && quantity.onChange(quantity.value - 1)}>
        <Minus aria-hidden="true" />
      </button>
      <span aria-live="polite" className="cz-mono cz-stepper-value cz-qty">
        {quantity.value}
      </span>
      <button type="button" aria-label={t('editor.bar.more', 'One more')} aria-disabled={quantity.value >= max} onClick={() => quantity.value < max && quantity.onChange(quantity.value + 1)}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

function Breaks({ quantity }: { quantity: EditorQuantity }) {
  return (
    <>
      {(quantity.breaks ?? []).map((one) => (
        <button key={one.qty} type="button" aria-pressed={quantity.value === one.qty} className={quantity.value === one.qty ? 'cz-break cz-on' : 'cz-break'} onClick={() => quantity.onChange(one.qty)}>
          <span className="cz-mono">{one.qty}</span>
          <span className="cz-mono cz-break-off">{one.label}</span>
        </button>
      ))}
    </>
  );
}

function Total({ price, big = true }: { price: EditorPrice | undefined; big?: boolean }) {
  const { t } = useShared();
  if (price === undefined) return null;
  if (price.pending === true)
    return (
      <span role="status" className="cz-pending">
        {t('editor.bar.working', 'Working out the price…')}
      </span>
    );
  return <span className={big ? 'cz-mono cz-total' : 'cz-mono cz-total cz-total-small'}>{price.total}</span>;
}

function AddButton({ blocks, addLabel, onAdd, busy, describedBy, className = 'cz-add' }: Pick<BarProps, 'blocks' | 'addLabel' | 'onAdd' | 'busy'> & { describedBy: string; className?: string }) {
  const off = blocks.length > 0;
  return (
    <button type="button" className={off ? `${className} cz-add-off` : className} aria-disabled={off || busy} aria-describedby={off ? describedBy : undefined} onClick={onAdd}>
      <ShoppingBasket aria-hidden="true" />
      {addLabel}
    </button>
  );
}

/** Birch Row's total bar, as its comp draws it on a desktop. */
export function MakerBar(props: BarProps) {
  const { t } = useShared();
  const { price, quantity, blocks } = props;
  return (
    <div className="cz-bar">
      {quantity === undefined ? null : (
        <div className="cz-bar-line">
          <Stepper quantity={quantity} />
          <Breaks quantity={quantity} />
        </div>
      )}
      <div className="cz-bar-line">
        <div className="cz-bar-total">
          <Total price={price} />
          {price?.detail === undefined ? null : <span className="cz-mono cz-small">{price.detail}</span>}
        </div>
        <button type="button" className="cz-save" onClick={props.onSave}>
          <Bookmark aria-hidden="true" />
          {t('editor.save', 'Save and come back')}
        </button>
        <AddButton {...props} describedBy="cz-add-why" />
      </div>
      {blocks.length > 0 ? (
        <span id="cz-add-why" className="cz-why">
          <Lock aria-hidden="true" />
          {t('editor.bar.fix', 'Fix {n, plural, one {# thing} other {# things}} in the checks before it can go in the basket.', { n: blocks.length })}
        </span>
      ) : null}
      {price?.note === undefined ? null : (
        <span className="cz-mono cz-post">
          <Calendar aria-hidden="true" />
          {price.note}
        </span>
      )}
    </div>
  );
}

/** On a phone: what Birch Row's bar held beside its one row, in the page above it. */
export function MakerBeforeBar(props: BarProps) {
  const { t } = useShared();
  const { price, quantity, blocks } = props;
  return (
    <div className="cz-before-bar">
      {quantity !== undefined && (quantity.breaks ?? []).length > 0 ? (
        <div className="cz-bar-line">
          <Breaks quantity={quantity} />
        </div>
      ) : null}
      <button type="button" className="cz-save" onClick={props.onSave}>
        <Bookmark aria-hidden="true" />
        {t('editor.save', 'Save and come back')}
      </button>
      {blocks.length > 0 ? (
        <span id="cz-add-why" className="cz-why">
          <Lock aria-hidden="true" />
          {t('editor.bar.fix', 'Fix {n, plural, one {# thing} other {# things}} in the checks before it can go in the basket.', { n: blocks.length })}
        </span>
      ) : null}
      {price?.detail === undefined ? null : <span className="cz-mono cz-small">{price.detail}</span>}
      {price?.note === undefined ? null : (
        <span className="cz-mono cz-post">
          <Calendar aria-hidden="true" />
          {price.note}
        </span>
      )}
    </div>
  );
}

/** On a phone: Birch Row's bar as one row. */
export function MakerPhoneBar(props: BarProps) {
  return (
    <div className={props.hidden ? 'cz-phone-bar cz-gone' : 'cz-phone-bar'}>
      {props.quantity === undefined ? null : <Stepper quantity={props.quantity} />}
      <Total price={props.price} big={false} />
      <AddButton {...props} describedBy="cz-add-why" />
    </div>
  );
}

/** Marlow Press's quote panel, under the card on a desktop. */
export function QuotePanel(props: BarProps & { nothingAdded: boolean; onShow: () => void }) {
  const { t } = useShared();
  const { price, blocks } = props;
  return (
    <div role="region" aria-label={t('editor.quote.title', 'Your quote')} className="cz-quote">
      <div className="cz-quote-top">
        <div aria-live="polite" className="cz-quote-price">
          {price === undefined ? null : price.pending === true ? (
            <span role="status" className="cz-pending">
              {t('editor.bar.working', 'Working out the price…')}
            </span>
          ) : (
            <>
              <span className="cz-quote-line">
                <span className="cz-mono cz-total">{price.total}</span>
                {price.each === undefined ? null : <span className="cz-mono cz-small">{t('editor.quote.each', '{price} each', { price: price.each })}</span>}
              </span>
              {price.detail === undefined ? null : <span className="cz-small">{price.detail}</span>}
            </>
          )}
        </div>
        {price?.ready === undefined ? null : (
          <span className="cz-ready">
            <CalendarCheck aria-hidden="true" />
            {t('editor.quote.ready', 'Ready {date}', { date: price.ready })}
          </span>
        )}
      </div>
      <div className="cz-quote-actions">
        <AddButton {...props} describedBy="cz-block" className="cz-add cz-grow" />
        <button type="button" className="cz-save cz-grow" onClick={props.onSave}>
          <Bookmark aria-hidden="true" />
          {t('editor.save', 'Save and come back')}
        </button>
      </div>
      {blocks.length > 0 ? <BlockLine id="cz-block" blocks={blocks} onShow={props.onShow} /> : null}
      {props.nothingAdded ? <p className="cz-small">{t('editor.quote.nothingAdded', 'Customising adds nothing to the price.')}</p> : null}
    </div>
  );
}

/** The first thing to fix, and how many more: "Job title is 15 characters over the limit. And 1 more. Show me". */
export function BlockLine({ id, blocks, onShow }: { id: string; blocks: readonly Check[]; onShow: () => void }) {
  const { t } = useShared();
  return (
    <p id={id} className="cz-block">
      <CircleAlert aria-hidden="true" />
      <span>
        {blocks[0]!.listed}
        {blocks.length > 1 ? ` ${t('editor.quote.more', 'And {n} more.', { n: blocks.length - 1 })}` : ''}{' '}
        <button type="button" className="cz-link" onClick={onShow}>
          {t('editor.quote.show', 'Show me')}
        </button>
      </span>
    </p>
  );
}

/** Marlow Press's quote bar on a phone: one row. */
export function QuoteBar(props: BarProps) {
  const { t } = useShared();
  const { price } = props;
  return (
    <div role="region" aria-label={t('editor.quote.title', 'Your quote')} className={props.hidden ? 'cz-quote-bar cz-gone' : 'cz-quote-bar'}>
      <div aria-live="polite" className="cz-quote-bar-price">
        {price === undefined ? null : price.pending === true ? (
          <span role="status" className="cz-pending">
            {t('editor.bar.working', 'Working out the price…')}
          </span>
        ) : (
          <>
            <span className="cz-quote-line">
              <span className="cz-mono cz-total cz-total-small">{price.total}</span>
              {price.each === undefined ? null : <span className="cz-mono cz-small">{t('editor.quote.each', '{price} each', { price: price.each })}</span>}
            </span>
            {price.ready === undefined ? null : <span className="cz-small">{t('editor.quote.ready', 'Ready {date}', { date: price.ready })}</span>}
          </>
        )}
      </div>
      <button type="button" className="cz-icon-button cz-icon-big" aria-label={t('editor.save', 'Save and come back')} title={t('editor.save', 'Save and come back')} onClick={props.onSave}>
        <Bookmark aria-hidden="true" />
      </button>
      <AddButton {...props} describedBy="cz-block" />
    </div>
  );
}
