/**
 * This add-on's own settings (34 Appendix C, and the invoicing additions),
 * read leniently.
 *
 * ── TWO KINDS OF SETTING LIVE HERE, AND THEY ARE READ BY DIFFERENT THINGS ──
 *
 * The LETTERHEAD — name, address lines, image, tax name and number, payment
 * instructions, the footer — is what a document is drawn with. Adminium puts
 * the letterhead into every subject it hands the renderer, and an authored
 * template's own values still win over it: an invoice made in March keeps
 * March's letterhead however this panel is edited in May.
 *
 * The NUMBERING AND DEFAULTS — the prefixes and first numbers of the three
 * series, the default tax rate and terms, the reminder ladders — are read by
 * ADMINIUM'S RULES on the tables an app builds on this add-on's shapes
 * (`manifest.json`, `addOn.shapes`). They are read when a row is CREATED and
 * copied onto it, so a later change never re-prices, re-dates or re-numbers a
 * document already made. That copy is the whole answer to the worry about a
 * rate held as a setting: the setting is a starting value, never the value a
 * sent document is drawn with.
 *
 * ── THE KEYS THAT CHANGED MEANING, AND WHY NONE WAS RENAMED ────────────────
 *
 * An install's saved values are keyed by these names, so a rename would drop
 * every one of them on the floor. `tax_label` (the word printed on the tax
 * line) and `tax_name` (the tax's name copied onto each document) are one idea
 * with two keys: the panel writes both, and each falls back to the other.
 * `terms` (a sentence printed under the totals) is the older name of `footer`,
 * and is read when `footer` is empty. `number_prefix` is gone: nothing ever
 * numbered a document by it, and the three series prefixes replace it.
 *
 * ── NONE OF THEM IS SECRET ─────────────────────────────────────────────────
 *
 * No key is marked `secret`, and `manifest.test.ts` asserts it — which is also
 * what makes `add-on-facts.ts`'s empty `NEVER_IN_A_BROWSER` list a claim rather
 * than an omission. Only five of them are PUBLIC settings, which is a different
 * thing: those are the ones an app's own staff screens are given (the name,
 * the tax name, how to pay, the footer, whether to show the payments).
 */

/** The paper a sheet-shaped document is drawn for. Receipts always use 80 mm. */
export type SettingPaper = 'a4' | 'letter';

/** The three numbered series, each with its own prefix and first number. */
export const SERIES = ['invoice', 'receipt', 'quote'] as const;
export type Series = (typeof SERIES)[number];

/** How firmly an unpaid invoice is chased: the days after it falls due that each reminder wakes. */
export const LADDERS = ['gentle', 'standard', 'firm'] as const;
export type Ladder = (typeof LADDERS)[number];

/** When an invoice falls due, counted from the day it is sent. */
export const TERMS = ['net7', 'net14', 'net30', 'on-receipt'] as const;
export type Terms = (typeof TERMS)[number];

/** The days each term gives — the same map the invoice shape's due-date stamp uses. */
export const TERM_DAYS: Readonly<Record<Terms, number>> = { net7: 7, net14: 14, net30: 30, 'on-receipt': 0 };

/** Three reminders per invoice, so three days per ladder. */
export type LadderDays = readonly [number, number, number];

export const DEFAULT_LADDER_DAYS: Readonly<Record<Ladder, LadderDays>> = {
  gentle: [7, 21, 45],
  standard: [3, 14, 30],
  firm: [1, 7, 21],
};

/**
 * What a series prefix may be: the characters Adminium's numbering rule
 * accepts in a prefix of its own, twelve at most. Checked where it is typed,
 * because the rule reads the setting when a row is created and a prefix it
 * cannot use would surface as a refused create somewhere else entirely.
 */
export const PREFIX_PATTERN = /^[A-Za-z0-9_/.-]{0,12}$/;

export interface InvoiceSettings {
  readonly businessName: string;
  readonly businessLines: readonly string[];
  readonly logoDataUrl: string;
  /** The older name of `footer`; kept so a saved value is still read. */
  readonly terms: string;
  readonly taxLabel: string;
  readonly paper: SettingPaper;
  readonly defaultFormats: readonly ('html' | 'pdf')[];
  /** Which host entity ids show a document button — WHICH only, never how. */
  readonly entities: readonly string[];
  readonly taxName: string;
  readonly taxNumber: string;
  readonly footer: string;
  /** A percentage, copied onto a document when it is created. */
  readonly defaultTaxRate: number;
  readonly defaultTerms: Terms;
  readonly paymentInstructions: string;
  readonly prefixes: Readonly<Record<Series, string>>;
  readonly starts: Readonly<Record<Series, number>>;
  readonly ladders: Readonly<Record<Ladder, LadderDays>>;
  readonly defaultLadder: Ladder;
  readonly showPaymentLedger: boolean;
}

/**
 * The letterhead image cap, in characters of a `data:` URI.
 *
 * It travels inside every document (25 D12 freezes it into every subject), so
 * a 2 MB logo is 2 MB on every invoice ever issued, forever. 32 KB is roughly
 * a clean mark at the size a letterhead is printed.
 */
export const LOGO_DATA_URL_MAX = 32 * 1024;

/**
 * The quote series' default prefix is `QUO-`. The name an app gives its quotes
 * is its own; a studio that calls them something else types its own prefix.
 */
export const DEFAULT_SETTINGS: InvoiceSettings = {
  businessName: '',
  businessLines: [],
  logoDataUrl: '',
  terms: '',
  taxLabel: 'Tax',
  paper: 'a4',
  defaultFormats: ['html', 'pdf'],
  entities: [],
  taxName: '',
  taxNumber: '',
  footer: '',
  defaultTaxRate: 0,
  defaultTerms: 'net14',
  paymentInstructions: '',
  prefixes: { invoice: 'INV-', receipt: 'REC-', quote: 'QUO-' },
  starts: { invoice: 1, receipt: 1, quote: 1 },
  ladders: DEFAULT_LADDER_DAYS,
  defaultLadder: 'standard',
  showPaymentLedger: true,
};

/** The values a manifest ships, in the manifest's own snake_case key names. */
export const DEFAULT_SETTING_VALUES: Readonly<Record<string, unknown>> = {
  business_name: '',
  business_lines: [],
  logo_data_url: '',
  terms: '',
  tax_label: 'Tax',
  paper: 'a4',
  default_formats: ['html', 'pdf'],
  entities: [],
  tax_name: '',
  tax_number: '',
  footer: '',
  default_tax_rate: 0,
  default_terms: 'net14',
  payment_instructions: '',
  prefix_invoice: 'INV-',
  prefix_receipt: 'REC-',
  prefix_quote: 'QUO-',
  number_start_invoice: 1,
  number_start_receipt: 1,
  number_start_quote: 1,
  ladders: { gentle: [7, 21, 45], standard: [3, 14, 30], firm: [1, 7, 21] },
  default_ladder: 'standard',
  show_payment_ledger: true,
};

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function lines(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** A number the host may have stored as text; `fallback` when it is not one. */
function numberOf(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** A first number: a whole number, one or more. */
function startOf(value: unknown): number {
  const parsed = numberOf(value, 1);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * The ladders, each exactly three whole days in rising order. A ladder that
 * does not read that way takes its default rather than half of one: a
 * reminder due before the one it follows would overtake it the moment both
 * came due.
 */
function laddersOf(value: unknown): Readonly<Record<Ladder, LadderDays>> {
  // SQLite hands a JSON setting back as text; Postgres and MySQL parse it.
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  const source = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  const out = {} as Record<Ladder, LadderDays>;
  for (const ladder of LADDERS) {
    out[ladder] = ladderDaysOf(source[ladder]) ?? DEFAULT_LADDER_DAYS[ladder];
  }
  return out;
}

/** Three whole days, 0–3650, each after the one before; `null` otherwise. */
export function ladderDaysOf(value: unknown): LadderDays | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const days = value.map((entry) => numberOf(entry, Number.NaN));
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 3650)) return null;
  if (!(days[0]! < days[1]! && days[1]! < days[2]!)) return null;
  return [days[0]!, days[1]!, days[2]!];
}

function flag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/**
 * Settings as this add-on understands them, from whatever the host stored.
 *
 * Lenient, and never throwing, for the same reason `document.ts` is: these
 * values were saved by an older version of this panel and a renderer's job is
 * to draw the document anyway. A value it cannot read takes the default.
 */
export function settingsFrom(raw: Readonly<Record<string, unknown>> | undefined): InvoiceSettings {
  const values = raw ?? {};
  const paper = values.paper === 'letter' ? 'letter' : 'a4';
  const formats = Array.isArray(values.default_formats)
    ? values.default_formats.filter(
        (entry): entry is 'html' | 'pdf' => entry === 'html' || entry === 'pdf',
      )
    : DEFAULT_SETTINGS.defaultFormats;

  const logo = text(values.logo_data_url, '');
  // `tax_label`'s shipped default is the English word "Tax", which says nothing
  // somebody chose; a document then prints the word in its own language instead.
  const taxName = text(values.tax_name, values.tax_label === DEFAULT_SETTINGS.taxLabel ? '' : text(values.tax_label, ''));
  const prefix = (key: string, fallback: string): string => {
    // An unusable prefix is read as the default rather than passed on: the
    // panel refuses one where it is typed, and this is the last resort.
    const typed = typeof values[key] === 'string' ? (values[key] as string) : fallback;
    return PREFIX_PATTERN.test(typed) ? typed : fallback;
  };
  const rate = numberOf(values.default_tax_rate, 0);
  return {
    businessName: text(values.business_name, ''),
    businessLines: lines(values.business_lines),
    // Over the cap is DROPPED rather than refused here, and refused where it
    // is SET — the panel says so with the size in the message. A document that
    // failed to render months after somebody pasted a large logo would be a
    // refusal nobody could connect to a cause.
    logoDataUrl: logo.length > LOGO_DATA_URL_MAX ? '' : logo,
    terms: text(values.terms, ''),
    taxLabel: text(values.tax_label, taxName === '' ? DEFAULT_SETTINGS.taxLabel : taxName),
    paper,
    defaultFormats: formats.length > 0 ? formats : DEFAULT_SETTINGS.defaultFormats,
    entities: lines(values.entities),
    taxName,
    taxNumber: text(values.tax_number, ''),
    footer: text(values.footer, text(values.terms, '')),
    defaultTaxRate: rate >= 0 && rate <= 100 ? rate : 0,
    defaultTerms: oneOf(values.default_terms, TERMS, DEFAULT_SETTINGS.defaultTerms),
    paymentInstructions: text(values.payment_instructions, ''),
    prefixes: {
      invoice: prefix('prefix_invoice', DEFAULT_SETTINGS.prefixes.invoice),
      receipt: prefix('prefix_receipt', DEFAULT_SETTINGS.prefixes.receipt),
      quote: prefix('prefix_quote', DEFAULT_SETTINGS.prefixes.quote),
    },
    starts: {
      invoice: startOf(values.number_start_invoice),
      receipt: startOf(values.number_start_receipt),
      quote: startOf(values.number_start_quote),
    },
    ladders: laddersOf(values.ladders),
    defaultLadder: oneOf(values.default_ladder, LADDERS, DEFAULT_SETTINGS.defaultLadder),
    showPaymentLedger: flag(values.show_payment_ledger, DEFAULT_SETTINGS.showPaymentLedger),
  };
}
