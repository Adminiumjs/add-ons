/**
 * A DISCOUNT IN A FEW WORDS: what it gives, how it starts, its limits, its
 * state. Each is one message with named places, so word order is the
 * translator's — never a sentence glued from fragments.
 */
import { money, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { cash, plain } from './form.ts';

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';

/** "10 % off", "15 % off Mugs", "2 for 1 on Totes", "$5.00 off". `on` names what it is for, when it is for something. */
export function givesWords(t: AddOnTranslate, offer: DataRow, on: string, locale: string): string {
  const value = text(offer['value']);
  // A figure kept to three places is said as money: two, unless it really has more.
  const amount = money(cash(value), locale);
  switch (offer['gives']) {
    case 'percent':
      return on === '' ? t('discounts.gives.percent', '{n} % off', { n: plain(value) }) : t('discounts.gives.percentOn', '{n} % off {what}', { n: plain(value), what: on });
    case 'amount':
      return on === '' ? t('discounts.gives.amount', '{amount} off', { amount }) : t('discounts.gives.amountOn', '{amount} off {what}', { amount, what: on });
    case 'fixed_price':
      return on === '' ? t('discounts.gives.price', '{amount} each', { amount }) : t('discounts.gives.priceOn', '{what} for {amount} each', { amount, what: on });
    case 'bonus_item': {
      const buy = Number(offer['buy_qty'] ?? 2);
      return on === '' ? t('discounts.gives.bonus', '{buy} for {pay}', { buy, pay: buy - 1 }) : t('discounts.gives.bonusOn', '{buy} for {pay} on {what}', { buy, pay: buy - 1, what: on });
    }
    case 'quantity_price':
      return on === '' ? t('discounts.gives.steps', 'More off the more they buy') : t('discounts.gives.stepsOn', 'More off the more {what} they buy', { what: on });
    default:
      return text(offer['gives']);
  }
}

/** The names of what a discount is for, as a short list: "Mugs", "Mugs, Totes", "Mugs and 3 more". */
export function targetNames(t: AddOnTranslate, labels: readonly string[]): string {
  if (labels.length === 0) return '';
  if (labels.length <= 2) return labels.join(', ');
  return t('discounts.targets.more', '{first} and {n} more', { first: labels[0] ?? '', n: labels.length - 1 });
}

const WEEKDAY_AT = Date.UTC(2023, 0, 1);
/** A weekday's name; 0 is Sunday. */
export const weekdayName = (index: number, locale: string, width: 'short' | 'long' = 'long'): string => new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(new Date(WEEKDAY_AT + index * 86_400_000));
/** The order a week is shown in: from the language's first day. */
export function weekOrder(locale: string): number[] {
  let first = 1;
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number }; getWeekInfo?: () => { firstDay?: number } };
    first = (info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? 1) % 7;
  } catch {
    first = 1;
  }
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => (first + offset) % 7);
}
export const shortDay = (value: unknown, locale: string): string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '';
  const [year = 0, month = 1, date = 1] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
};

/** The limits that are set, most telling first; a list shows the first two. */
export function limitWords(t: AddOnTranslate, offer: DataRow, locale: string): string[] {
  const out: string[] = [];
  const days = Array.from(text(offer['weekdays']).match(/[0-6]/g) ?? []).map(Number);
  if (offer['max_per_customer'] !== null && offer['max_per_customer'] !== undefined) out.push(t('discounts.limit.perCustomer', '{n} per customer', { n: Number(offer['max_per_customer']) }));
  if (days.length > 0 && days.length < 7) out.push(days.map((index) => weekdayName(index, locale, days.length === 1 ? 'long' : 'short')).join(', '));
  if (offer['max_uses'] !== null && offer['max_uses'] !== undefined) out.push(t('discounts.limit.uses', '{n, plural, one {# use} other {# uses}}', { n: Number(offer['max_uses']) }));
  if (text(offer['min_spend']) !== '') out.push(t('discounts.limit.from', 'from {amount}', { amount: money(offer['min_spend'], locale) }));
  if (text(offer['ends_on']) !== '') out.push(t('discounts.limit.until', 'until {date}', { date: shortDay(offer['ends_on'], locale) }));
  if (yes(offer['first_order_only'])) out.push(t('discounts.limit.first', 'first order only'));
  return out;
}

export type Pill = 'draft' | 'active' | 'paused' | 'ended' | 'used-up';
/** The state a list and a header show: "Used up" is the stored flag on an active discount, never worked out here. */
export const pillOf = (offer: DataRow): Pill => (offer['status'] === 'active' && yes(offer['used_up']) ? 'used-up' : ((['draft', 'active', 'paused', 'ended'] as const).find((one) => one === offer['status']) ?? 'draft'));
export const pillTone = (pill: Pill): 'pos' | 'warn' | 'info' | 'neutral' => (pill === 'active' ? 'pos' : pill === 'draft' ? 'info' : pill === 'paused' || pill === 'used-up' ? 'warn' : 'neutral');
export function pillWords(t: AddOnTranslate, pill: Pill): string {
  switch (pill) {
    case 'draft':
      return t('discounts.pill.draft', 'Draft');
    case 'active':
      return t('discounts.pill.active', 'Active');
    case 'paused':
      return t('discounts.pill.paused', 'Paused');
    case 'ended':
      return t('discounts.pill.ended', 'Ended');
    case 'used-up':
      return t('discounts.pill.usedUp', 'Used up');
  }
}
