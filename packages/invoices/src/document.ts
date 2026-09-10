/**
 * THE AUTHORED BODY, AS THIS PROVIDER UNDERSTANDS IT.
 *
 * `RenderInput.body` is OPAQUE on the wire — `Readonly<Record<string,
 * unknown>>` and nothing more (34 O28(a2) → D54). That was a deliberate choice
 * and this file is the other side of it: the contract carries no block
 * vocabulary into eighteen repos, so a new block kind never costs a contract
 * release, and the PROVIDER owns the schema. Owning it means this file.
 *
 * ── WHAT IS DELIBERATELY NOT HERE: ZOD ─────────────────────────────────────
 *
 * `apps/server/src/invoices/document.ts`, which this is copied from, validates
 * an incoming body with a Zod schema before it is stored. An add-on may take
 * no runtime dependency the host does not already have (24 D7), and Zod is
 * one — so what came across is the TYPES, the caps, and the LENIENT decoder
 * (`normalizeInvoiceBody` and everything under it), which needs no library and
 * never throws.
 *
 * That split is also the right one on its merits. The server's schema is an
 * INPUT GATE: it refuses a body somebody is trying to store. A renderer has no
 * such choice — it is handed a body that was stored months ago, possibly by an
 * older version of the surface, and its job is to draw it. So the rule here is
 * that any body decodes: a missing field takes `emptyBody()`'s value, an
 * unknown one is ignored, and a document from a future version renders the
 * parts this release understands rather than refusing the lot.
 *
 * A body this provider CANNOT make sense of at all is still a typed refusal —
 * `INVALID_SUBJECT` from `server.ts` — but that is reserved for a body that is
 * not an object, not for one with a field this release has not heard of.
 */



// --- the vocabulary -------------------------------------------------------------------

/** The comp's five-value vocabulary, shared by both kinds (1393, 1579). */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'live' | 'overdue';
export const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'sent', 'paid', 'live', 'overdue'];

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value as string);
}

export interface LineItem {
  id: string;
  desc: string;
  /** Decimal text; fractional quantities (hours) are allowed. */
  qty: string;
  /** Decimal text in major units; may be negative (a credit note's lines, comp 1122). */
  rate: string;
}

export interface AttachmentRef {
  name: string;
  /** Text as the comp types it — "214 KB" (903). */
  size: string;
}

export interface FxRate {
  code: string;
  sym: string;
  /** Decimal text: the multiplier applied to the total (comp 948). */
  rate: string;
}

export interface DiscountCode {
  code: string;
  label: string;
  /** Decimal text in major units. */
  amount: string;
}

export interface TaxLine {
  label: string;
  /** Percent, decimal text. */
  rate: string;
}

export interface PaymentRecord {
  date: string;
  method: string;
  /** Text as the comp types it (984) — "$500.00". */
  amount: string;
  status: InvoiceStatus;
}

export type DeliveryStepStatus = 'todo' | 'current' | 'done';

export interface DeliveryStep {
  label: string;
  status: DeliveryStepStatus;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** The four user-authored section types (comp `customDefs`, 1266-1272; `newCustom`, 1274-1281). */
export type CustomSectionType = 'text' | 'image' | 'kv' | 'gallery';

export interface CustomImageSlot {
  id: string;
  url: string;
}

export interface CustomKvRow {
  k: string;
  v: string;
}

export type CustomSection =
  | { id: string; type: 'text'; title: string; body: string }
  | { id: string; type: 'image'; title: string; url: string; caption: string; height: number }
  | { id: string; type: 'kv'; title: string; rows: CustomKvRow[] }
  | { id: string; type: 'gallery'; title: string; images: CustomImageSlot[] };

/** The image fields the toolbar's Images panel owns (comp 1658). */
export type ImageField = 'logoImage' | 'bgImage' | 'qrImage' | 'sigImage' | 'stampImage';
export const IMAGE_FIELDS: readonly ImageField[] = ['logoImage', 'bgImage', 'qrImage', 'sigImage', 'stampImage'];

export interface InvoiceBody {
  // ── theme (comp 1085) ─────────────────────────────────────────────
  accent: string;
  /** The currency SYMBOL the sheet prints (comp 1578: $ € £ ¥). */
  currency: string;
  cents: boolean;
  title: string;
  logoIcon: string;
  logoText: string;
  // ── parties (1086-1087) ───────────────────────────────────────────
  from: string[];
  customerName: string;
  customer: string[];
  // ── details (1088, 1093) ──────────────────────────────────────────
  number: string;
  issued: string;
  due: string;
  terms: string;
  poNumber: string;
  // ── items & totals (1089-1090) ────────────────────────────────────
  items: LineItem[];
  taxRate: string;
  discountRate: string;
  // ── payment & notes (1091-1092) ───────────────────────────────────
  payment: string[];
  notes: string;
  // ── the eighteen optional sections (1094-1111) ────────────────────
  shipShow: boolean;
  shipName: string;
  ship: string[];
  sigShow: boolean;
  sigName: string;
  sigTitle: string;
  termsShow: boolean;
  termsLabel: string;
  termsChecked: boolean;
  attachShow: boolean;
  attachments: AttachmentRef[];
  approvalShow: boolean;
  apprName: string;
  apprTitle: string;
  apprStatus: ApprovalStatus;
  qrShow: boolean;
  qrCaption: string;
  lateShow: boolean;
  lateRate: string;
  lateDays: number;
  poShow: boolean;
  poTerms: string;
  mcShow: boolean;
  fx: FxRate[];
  recurShow: boolean;
  recurFreq: string;
  recurNext: string;
  recurCount: string;
  discShow: boolean;
  discCodes: DiscountCode[];
  taxbShow: boolean;
  taxLines: TaxLine[];
  payhShow: boolean;
  payHist: PaymentRecord[];
  legalShow: boolean;
  legalText: string;
  refShow: boolean;
  refText: string;
  conShow: boolean;
  conName: string;
  conEmail: string;
  conPhone: string;
  loyShow: boolean;
  loyBalance: number;
  loyEarned: number;
  loyLevel: string;
  delShow: boolean;
  delSteps: DeliveryStep[];
  // ── images (1112) ─────────────────────────────────────────────────
  bgImage: string;
  /** 0–0.95: the scrim over the background image (comp 797, 1733). */
  bgTint: number;
  logoImage: string;
  qrImage: string;
  sigImage: string;
  stampImage: string;
  // ── composition (1113-1114) ───────────────────────────────────────
  custom: CustomSection[];
  /** The 23 built-in keys plus any `cus:<id>` keys, in sheet order. */
  blockOrder: string[];
}

/** The comp's `blockOrder` default (1114): every built-in, in this order. */
export const DEFAULT_BLOCK_ORDER: readonly string[] = [
  'parties',
  'shipping',
  'meta',
  'items',
  'totals',
  'paynotes',
  'signature',
  'terms',
  'attachments',
  'approval',
  'qr',
  'latefees',
  'poterms',
  'multicurrency',
  'recurring',
  'discount',
  'taxbreak',
  'payhistory',
  'legal',
  'refund',
  'contact',
  'loyalty',
  'delivery',
];

export const DEFAULT_ACCENT = '#4f46e5';

// --- the caps (34 O18) ----------------------------------------------------------------

/** One inline image may be this many characters of data URL (~384 KB of image bytes). */
export const IMAGE_DATA_URL_MAX = 512 * 1024;
/** The whole body, serialized. */
export const BODY_BYTES_MAX = 4 * 1024 * 1024;

export const TEXT_MAX = 4000;
export const LINE_MAX = 300;
export const ROWS_MAX = 100;
export const CUSTOM_MAX = 60;
export const BLOCK_ORDER_MAX = 120;


// --- defaults + normalizing (the dashboard's algorithm, restated) ------------

/**
 * The STRUCTURAL defaults — every field present, nothing authored. The seeded
 * content a new document starts from is `starters.ts`'s; this is what a
 * decoded row is completed against so an older body never renders
 * `undefined`.
 */
export function emptyBody(): InvoiceBody {
  return {
    accent: DEFAULT_ACCENT,
    currency: '$',
    cents: true,
    title: 'INVOICE',
    logoIcon: 'hexagon',
    logoText: '',
    from: [],
    customerName: '',
    customer: [],
    number: '',
    issued: '',
    due: '',
    terms: '',
    poNumber: '',
    items: [],
    taxRate: '0',
    discountRate: '0',
    payment: [],
    notes: '',
    shipShow: false,
    shipName: '',
    ship: [],
    sigShow: false,
    sigName: '',
    sigTitle: '',
    termsShow: false,
    termsLabel: '',
    termsChecked: false,
    attachShow: false,
    attachments: [],
    approvalShow: false,
    apprName: '',
    apprTitle: '',
    apprStatus: 'pending',
    qrShow: false,
    qrCaption: '',
    lateShow: false,
    lateRate: '1.5',
    lateDays: 7,
    poShow: false,
    poTerms: '',
    mcShow: false,
    fx: [],
    recurShow: false,
    recurFreq: 'Monthly',
    recurNext: '',
    recurCount: '',
    discShow: false,
    discCodes: [],
    taxbShow: false,
    taxLines: [],
    payhShow: false,
    payHist: [],
    legalShow: false,
    legalText: '',
    refShow: false,
    refText: '',
    conShow: false,
    conName: '',
    conEmail: '',
    conPhone: '',
    loyShow: false,
    loyBalance: 0,
    loyEarned: 0,
    loyLevel: '',
    delShow: false,
    delSteps: [],
    bgImage: '',
    bgTint: 0.82,
    logoImage: '',
    qrImage: '',
    sigImage: '',
    stampImage: '',
    custom: [],
    blockOrder: [...DEFAULT_BLOCK_ORDER],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => str(item, '')) : [];
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/*
 * `newLocalId` STAYED BEHIND TOO, and this one is not a tidiness call.
 *
 * The server's copy mints a short id from `node:crypto` for a new item or
 * custom section. A renderer must never mint anything: 25 D12 is that the same
 * subject renders to the same bytes, and one call to a random source anywhere
 * in the path makes that false forever — silently, because two renders a
 * second apart still LOOK identical to anybody eyeballing them, and only the
 * conformance suite's byte comparison would ever notice.
 *
 * `crypto` is on this package's purity gate for that reason, and this is the
 * line that would have tripped it. Nothing here calls it — verified: the
 * lenient decoder leaves an item's `id` as whatever was stored, empty string
 * included, because an id is a handle the EDITOR uses and the document does
 * not print it.
 */

function customSection(raw: Record<string, unknown>): CustomSection | null {
  const id = str(raw['id'], '');
  if (id === '') return null;
  const title = str(raw['title'], '');
  switch (raw['type']) {
    case 'text':
      return { id, type: 'text', title, body: str(raw['body'], '') };
    case 'image':
      return { id, type: 'image', title, url: str(raw['url'], ''), caption: str(raw['caption'], ''), height: Math.round(num(raw['height'], 200)) };
    case 'kv':
      return { id, type: 'kv', title, rows: records(raw['rows']).map((row) => ({ k: str(row['k'], ''), v: str(row['v'], '') })) };
    case 'gallery':
      return {
        id,
        type: 'gallery',
        title,
        images: records(raw['images']).map((image, index) => ({ id: str(image['id'], `${id}${String(index)}`), url: str(image['url'], '') })),
      };
    default:
      return null;
  }
}

/**
 * The composition, reconciled (34-T47's orphan rule): every built-in key
 * exactly once, `cus:` keys only for sections that exist, and every existing
 * section referenced — an unreferenced one is appended rather than lost. The
 * comp renders an orphan key as an empty draggable block (1512); a decode
 * here never does.
 */
export function reconcileBlockOrder(order: readonly string[], custom: readonly CustomSection[]): string[] {
  const customKeys = new Set(custom.map((section) => `cus:${section.id}`));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (seen.has(key)) continue;
    const builtin = DEFAULT_BLOCK_ORDER.includes(key);
    if (!builtin && !customKeys.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of DEFAULT_BLOCK_ORDER) {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  for (const key of customKeys) {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** A row's stored body (or anything on the wire) → the complete envelope. Lenient: an unknown value gets its default. */
export function normalizeInvoiceBody(raw: unknown): InvoiceBody {
  const base = emptyBody();
  if (!isRecord(raw)) return base;
  const r = raw;
  const status = (value: unknown): InvoiceStatus => (isInvoiceStatus(value) ? value : 'paid');
  const custom = records(r['custom']).map(customSection).filter((section): section is CustomSection => section !== null);
  const bgTint = num(r['bgTint'], base.bgTint);
  return {
    accent: /^#[0-9a-fA-F]{6}$/.test(str(r['accent'], '')) ? str(r['accent'], '') : base.accent,
    currency: str(r['currency'], base.currency) || base.currency,
    cents: bool(r['cents'], base.cents),
    title: str(r['title'], base.title),
    logoIcon: str(r['logoIcon'], base.logoIcon) || base.logoIcon,
    logoText: str(r['logoText'], ''),
    from: strings(r['from']),
    customerName: str(r['customerName'], ''),
    customer: strings(r['customer']),
    number: str(r['number'], ''),
    issued: str(r['issued'], ''),
    due: str(r['due'], ''),
    terms: str(r['terms'], ''),
    poNumber: str(r['poNumber'], ''),
    items: records(r['items']).map((item, index) => ({
      id: str(item['id'], '') || `i_${String(index)}`,
      desc: str(item['desc'], ''),
      qty: str(item['qty'], '1'),
      rate: str(item['rate'], '0'),
    })),
    taxRate: str(r['taxRate'], base.taxRate),
    discountRate: str(r['discountRate'], base.discountRate),
    payment: strings(r['payment']),
    notes: str(r['notes'], ''),
    shipShow: bool(r['shipShow'], false),
    shipName: str(r['shipName'], ''),
    ship: strings(r['ship']),
    sigShow: bool(r['sigShow'], false),
    sigName: str(r['sigName'], ''),
    sigTitle: str(r['sigTitle'], ''),
    termsShow: bool(r['termsShow'], false),
    termsLabel: str(r['termsLabel'], ''),
    termsChecked: bool(r['termsChecked'], false),
    attachShow: bool(r['attachShow'], false),
    attachments: records(r['attachments']).map((file) => ({ name: str(file['name'], ''), size: str(file['size'], '') })),
    approvalShow: bool(r['approvalShow'], false),
    apprName: str(r['apprName'], ''),
    apprTitle: str(r['apprTitle'], ''),
    apprStatus: r['apprStatus'] === 'approved' || r['apprStatus'] === 'rejected' ? r['apprStatus'] : 'pending',
    qrShow: bool(r['qrShow'], false),
    qrCaption: str(r['qrCaption'], ''),
    lateShow: bool(r['lateShow'], false),
    lateRate: str(r['lateRate'], base.lateRate),
    lateDays: Math.round(num(r['lateDays'], base.lateDays)),
    poShow: bool(r['poShow'], false),
    poTerms: str(r['poTerms'], ''),
    mcShow: bool(r['mcShow'], false),
    fx: records(r['fx']).map((row) => ({ code: str(row['code'], ''), sym: str(row['sym'], ''), rate: str(row['rate'], '1') })),
    recurShow: bool(r['recurShow'], false),
    recurFreq: str(r['recurFreq'], base.recurFreq),
    recurNext: str(r['recurNext'], ''),
    recurCount: str(r['recurCount'], ''),
    discShow: bool(r['discShow'], false),
    discCodes: records(r['discCodes']).map((row) => ({ code: str(row['code'], ''), label: str(row['label'], ''), amount: str(row['amount'], '0') })),
    taxbShow: bool(r['taxbShow'], false),
    taxLines: records(r['taxLines']).map((row) => ({ label: str(row['label'], ''), rate: str(row['rate'], '0') })),
    payhShow: bool(r['payhShow'], false),
    payHist: records(r['payHist']).map((row) => ({
      date: str(row['date'], ''),
      method: str(row['method'], ''),
      amount: str(row['amount'], ''),
      status: status(row['status']),
    })),
    legalShow: bool(r['legalShow'], false),
    legalText: str(r['legalText'], ''),
    refShow: bool(r['refShow'], false),
    refText: str(r['refText'], ''),
    conShow: bool(r['conShow'], false),
    conName: str(r['conName'], ''),
    conEmail: str(r['conEmail'], ''),
    conPhone: str(r['conPhone'], ''),
    loyShow: bool(r['loyShow'], false),
    loyBalance: Math.round(num(r['loyBalance'], 0)),
    loyEarned: Math.round(num(r['loyEarned'], 0)),
    loyLevel: str(r['loyLevel'], ''),
    delShow: bool(r['delShow'], false),
    delSteps: records(r['delSteps']).map((row) => ({
      label: str(row['label'], ''),
      status: row['status'] === 'done' || row['status'] === 'current' ? row['status'] : 'todo',
    })),
    bgImage: str(r['bgImage'], ''),
    bgTint: Math.min(0.95, Math.max(0, bgTint)),
    logoImage: str(r['logoImage'], ''),
    qrImage: str(r['qrImage'], ''),
    sigImage: str(r['sigImage'], ''),
    stampImage: str(r['stampImage'], ''),
    custom,
    blockOrder: reconcileBlockOrder(strings(r['blockOrder']).length === 0 ? DEFAULT_BLOCK_ORDER : strings(r['blockOrder']), custom),
  };
}

// --- the caps (34 O18) ----------------------------------------------------------------

/** Every inline image in a body, with the field that holds it — the five slots plus the custom sections'. */
export function inlineImages(body: InvoiceBody): { field: string; url: string }[] {
  const out: { field: string; url: string }[] = [];
  for (const field of IMAGE_FIELDS) out.push({ field, url: body[field] });
  for (const section of body.custom) {
    if (section.type === 'image') out.push({ field: `custom.${section.id}.url`, url: section.url });
    if (section.type === 'gallery') {
      for (const image of section.images) out.push({ field: `custom.${section.id}.images.${image.id}`, url: image.url });
    }
  }
  return out;
}

/*
 * ── THREE FUNCTIONS THAT STAYED BEHIND ─────────────────────────────────────
 *
 * `assertBodyWithinCaps`, `acceptInvoiceBody` and `bodyColumn` are in the
 * server's copy of this file and are deliberately not in this one.
 *
 * They are the WRITE path. `assertBodyWithinCaps` throws a
 * `ValidationFailedError` — an engine class this package cannot import — and
 * measures bytes with `Buffer`, a Node global an add-on bundle may not assume
 * exists, since the same bundle is loaded in a browser for the two slot fills.
 * `acceptInvoiceBody` is the door a `PUT` goes through. `bodyColumn` is the
 * shape a database row stores.
 *
 * A renderer does none of those things. It is handed a body that already went
 * through all three, months ago, and its only job is to draw it — so the caps
 * are the surface's business and enforcing them again here could only produce
 * a second, different refusal for a document already in the database.
 */
