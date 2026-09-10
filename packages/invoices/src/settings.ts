/**
 * This add-on's own settings (34 Appendix C), read leniently.
 *
 * ── WHAT THESE ARE FOR, AFTER THE REDESIGN ─────────────────────────────────
 *
 * They are DEFAULTS that seed a new template, not the values a document is
 * drawn with. The comp moved four of them onto the document itself — the
 * letterhead name and address lines are editable fields, the logo is one of
 * five per-document image slots, and the terms are authored — and the comp's
 * own Images panel states the inheritance: *"Upload once and every document
 * built from this template keeps them."* (34 §0.4.3, O18 → D44).
 *
 * So the precedence a renderer applies is three deep, and it is written here
 * because nowhere else would be obvious:
 *
 *   1. THE DOCUMENT'S OWN VALUE, if it has one. An invoice made in March
 *      keeps March's letterhead, even after somebody edits this panel in May.
 *      That is the whole point of freezing a subject (25 D12).
 *   2. THESE SETTINGS, for a document that authored none — the purely mapped
 *      case, a till receipt with no template behind it.
 *   3. THE CONNECTION'S OWN business name, which the engine puts in every
 *      subject, for a deployment that has never opened this panel.
 *
 * ── NONE OF THEM IS SECRET, AND THAT IS CHECKABLE ──────────────────────────
 *
 * Every key below is in `publicSettings`, no key is marked `secret`, and
 * `manifest.test.ts` asserts both — which is also what makes
 * `add-on-facts.ts`'s empty `NEVER_IN_A_BROWSER` list a claim rather than an
 * omission. There is no credential here to keep out of a page.
 *
 * ── AND THERE IS NO `tax_rate` SETTING ─────────────────────────────────────
 *
 * D20, and it is the one absence worth defending. A tax rate held as a
 * workspace setting would change every already-issued document the day
 * somebody edited it — or, if it did not, would mean the setting and the
 * documents disagree and nobody can tell which is which. A rate is a mapped
 * column or a per-profile override, and never a setting. `tax_label` — the
 * WORD printed on the line — is a setting, because changing what a line is
 * called does not change what anybody owes.
 */

/** The paper a sheet-shaped document is drawn for. Receipts always use 80 mm. */
export type SettingPaper = 'a4' | 'letter';

export interface InvoiceSettings {
  readonly businessName: string;
  readonly businessLines: readonly string[];
  readonly logoDataUrl: string;
  readonly numberPrefix: string;
  readonly terms: string;
  readonly taxLabel: string;
  readonly paper: SettingPaper;
  readonly defaultFormats: readonly ('html' | 'pdf')[];
  /** Which host entity ids show a document button — WHICH only, never how. */
  readonly entities: readonly string[];
}

/**
 * The letterhead image cap, in characters of a `data:` URI.
 *
 * It travels inside every document (25 D12 freezes it into every subject), so
 * a 2 MB logo is 2 MB on every invoice ever issued, forever. 32 KB is roughly
 * a clean mark at the size a letterhead is printed.
 */
export const LOGO_DATA_URL_MAX = 32 * 1024;

export const DEFAULT_SETTINGS: InvoiceSettings = {
  businessName: '',
  businessLines: [],
  logoDataUrl: '',
  numberPrefix: 'INV-',
  terms: '',
  taxLabel: 'Tax',
  paper: 'a4',
  defaultFormats: ['html', 'pdf'],
  entities: [],
};

/** The values a manifest ships, in the manifest's own snake_case key names. */
export const DEFAULT_SETTING_VALUES: Readonly<Record<string, unknown>> = {
  business_name: '',
  business_lines: [],
  logo_data_url: '',
  number_prefix: 'INV-',
  terms: '',
  tax_label: 'Tax',
  paper: 'a4',
  default_formats: ['html', 'pdf'],
  entities: [],
};

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function lines(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
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
  return {
    businessName: text(values.business_name, ''),
    businessLines: lines(values.business_lines),
    // Over the cap is DROPPED rather than refused here, and refused where it
    // is SET — the panel says so with the size in the message. A document that
    // failed to render months after somebody pasted a large logo would be a
    // refusal nobody could connect to a cause.
    logoDataUrl: logo.length > LOGO_DATA_URL_MAX ? '' : logo,
    numberPrefix: text(values.number_prefix, DEFAULT_SETTINGS.numberPrefix),
    terms: text(values.terms, ''),
    taxLabel: text(values.tax_label, DEFAULT_SETTINGS.taxLabel),
    paper,
    defaultFormats: formats.length > 0 ? formats : DEFAULT_SETTINGS.defaultFormats,
    entities: lines(values.entities),
  };
}
