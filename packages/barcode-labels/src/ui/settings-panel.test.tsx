/**
 * THE FORM RENDERS WORDS, AND HAS A SENTENCE FOR EVERY REFUSAL.
 *
 * ── WHAT THIS SUITE CAN AND CANNOT SEE ─────────────────────────────────────
 *
 * Rendered with `renderToStaticMarkup` rather than a DOM harness: this
 * repository ships no jsdom, and `t.ts` gives `useSyncExternalStore` a server
 * snapshot, so the static render is the real component tree rather than a
 * stand-in for it. What it cannot do is CLICK, so the refusal card and the
 * "taken" card — both of which appear only after a press — are not reachable by
 * rendering.
 *
 * That limit is met head-on rather than papered over, and it is split in two:
 *
 *   THE DECISION is `codes.test.ts`, over the pure engine. Whether a number is
 *   refused, what the refusal names, and what a second assignment costs are all
 *   properties of plain data and are tested as such — a suite that drove them
 *   through React would be testing two things and would go red the day somebody
 *   moved a button, which is the ordinary reason a rule stops being enforced.
 *
 *   THE WIRING is `refusalMessage`, which is exported for this purpose and is
 *   driven below over EVERY member of `REFUSAL_KINDS`. That is what catches an
 *   engine that refuses into a screen that says nothing — a variant added to
 *   `codes.ts` with no copy is a red suite here rather than a blank red box on
 *   somebody's settings page.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CatalogueSample, SettingsPanelPayload } from '@adminium/add-on-host';

import { REFUSAL_KINDS, STORAGE_KEY, type AssignedCode, type Refusal } from '../codes.ts';
import { CODE128_MAX_LENGTH, GRID, LABEL, LABELS_PER_SHEET } from '../geometry.ts';
import { strings } from '../i18n/strings.ts';
import { translate } from '../i18n/t.ts';
import { register } from '../index.ts';
import { refusalMessage, SettingsPanel, symbologyKey } from './SettingsPanel.tsx';

const EN = strings['en-US'];
const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate('en-US', key, params);

const SAMPLES: readonly CatalogueSample[] = [
  { key: 'zinc-tray', label: 'Zinc tray', quantity: 1 },
  { key: 'ash-board', label: 'Ash board', quantity: 4 },
];

/**
 * A payload shaped like the one a host passes.
 *
 * `samples` is REQUIRED by `SettingsPanelPayload` and its own comment explains
 * why an optional field would have been the easier and worse choice: the second
 * host of the delivery add-on passed `{ patch }` alone, `tsc` was happy, and
 * that add-on's settings form threw on `.map`. This fixture's job is to be what
 * a host really sends.
 */
function payloadWith(codes?: readonly AssignedCode[]): SettingsPanelPayload {
  return {
    patch: () => {},
    samples: SAMPLES,
    settings: codes === undefined ? undefined : { [STORAGE_KEY]: codes },
  };
}

const renderPanel = (codes?: readonly AssignedCode[]) =>
  renderToStaticMarkup(<SettingsPanel payload={payloadWith(codes)} />);

/**
 * A string as it appears IN MARKUP, which is not always as it appears in the
 * bundle. React escapes five characters on the way out, and the apostrophe is
 * the one that matters here — much of this add-on's English copy is possessive
 * — so a plain `toContain` on a bundle value reports a missing string for copy
 * that is on the screen.
 */
const asRendered = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const shows = (html: string, text: string): boolean => html.includes(asRendered(text));

describe('the panel the host actually mounts', () => {
  it('is the one `register()` fills `settings.add-on.panel` with', () => {
    // The gate has to sit on the thing that ships. Rendering a component a test
    // reached for directly proves nothing about what a shop sees.
    const fill = register().fills.find((entry) => entry.slot === 'settings.add-on.panel');
    expect(fill).toBeDefined();
    const html = renderToStaticMarkup(<>{fill!.render(payloadWith() as never)}</>);
    expect(shows(html, EN['addon.barcode-labels.assign.title'])).toBe(true);
  });

  it('renders words, never a raw message key', () => {
    // The failure this catches is a key added to a component and not to the
    // bundle: `t()` falls back to the key itself, so the screen quietly reads
    // `addon.barcode-labels.assign.row`.
    expect(renderPanel()).not.toContain('addon.barcode-labels.');
    expect(renderPanel([{ sku: 'zinc-tray', symbology: 'ean13', code: '5901234123457' }])).not.toContain(
      'addon.barcode-labels.',
    );
  });
});

describe('an empty table says what to do about it', () => {
  const html = renderPanel();

  it('has an honest empty state rather than a blank box', () => {
    expect(shows(html, EN['addon.barcode-labels.held.none'])).toBe(true);
  });

  it('offers every row the host handed over, by the host’s own label', () => {
    for (const sample of SAMPLES) expect(shows(html, sample.label)).toBe(true);
  });

  it('offers both symbologies, by name', () => {
    expect(shows(html, EN['addon.barcode-labels.sym.ean13'])).toBe(true);
    expect(shows(html, EN['addon.barcode-labels.sym.code128'])).toBe(true);
  });

  it('says what each symbology is for, with the real Code 128 limit', () => {
    expect(shows(html, EN['addon.barcode-labels.sym.ean13.note'])).toBe(true);
    expect(
      shows(html, t('addon.barcode-labels.sym.code128.note', { limit: CODE128_MAX_LENGTH })),
    ).toBe(true);
    // …and the limit is the one the engine actually enforces, not a number
    // somebody typed into the copy.
    expect(html).toContain(String(CODE128_MAX_LENGTH));
  });
});

describe('a table with numbers in it', () => {
  const held: readonly AssignedCode[] = [
    { sku: 'ash-board', symbology: 'code128', code: 'ADM-4417' },
    { sku: 'zinc-tray', symbology: 'ean13', code: '5901234123457' },
  ];
  const html = renderPanel(held);

  it('lists every row, its symbology and its number', () => {
    for (const entry of held) {
      expect(shows(html, entry.code), entry.code).toBe(true);
      expect(shows(html, EN[symbologyKey(entry.symbology)]), entry.symbology).toBe(true);
    }
    expect(shows(html, 'Zinc tray')).toBe(true);
    expect(shows(html, 'Ash board')).toBe(true);
  });

  it('counts them, formatted rather than stringified', () => {
    expect(shows(html, t('addon.barcode-labels.held.count', { count: held.length }))).toBe(true);
  });

  it('offers a way to take each one back', () => {
    expect(shows(html, EN['addon.barcode-labels.held.remove'])).toBe(true);
  });

  it('draws the bars beside the number, so a wrong one is visible before printing', () => {
    expect(html).toContain('<svg');
    expect([...html.matchAll(/<rect/g)].length).toBeGreaterThan(20);
  });

  it('falls back to the stored key for a row the host no longer samples', () => {
    // A shop that renames a family still has the number in its table and still
    // has to be able to take it back. A row that vanished from this list would
    // leave a number nobody could reach, while the duplicate refusal went on
    // naming it.
    const orphan = renderPanel([{ sku: 'gone-away', symbology: 'ean13', code: '4006381333931' }]);
    expect(shows(orphan, 'gone-away')).toBe(true);
    expect(shows(orphan, '4006381333931')).toBe(true);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * EVERY REFUSAL HAS A SENTENCE, AND THE SENTENCE NAMES WHAT TO DO
 * ═════════════════════════════════════════════════════════════════════════════
 */
describe('the refusal copy', () => {
  const EXAMPLES: Record<(typeof REFUSAL_KINDS)[number], Refusal> = {
    noRow: { why: 'noRow' },
    empty: { why: 'empty' },
    ean13Shape: { why: 'ean13Shape', given: 12 },
    ean13Check: { why: 'ean13Check', expected: 7, given: 0 },
    code128Character: { why: 'code128Character', character: 'é' },
    code128TooLong: { why: 'code128TooLong', given: 40, limit: CODE128_MAX_LENGTH },
    duplicate: { why: 'duplicate', heldBy: 'ash-board' },
  };

  it('covers every variant the engine can produce', () => {
    // Driven from `REFUSAL_KINDS` rather than from a list here, so a variant
    // added to `codes.ts` fails this rather than rendering nothing.
    expect(Object.keys(EXAMPLES).sort()).toEqual([...REFUSAL_KINDS].sort());
  });

  it.each(REFUSAL_KINDS)('%s says something rather than printing its key', (kind) => {
    const message = refusalMessage(t, EXAMPLES[kind]);
    expect(message.startsWith('addon.'), `${kind} has no copy`).toBe(false);
    expect(message.length).toBeGreaterThan(15);
    expect(message, `${kind} left a placeholder unfilled`).not.toMatch(/\{\w+\}/);
  });

  it('names the digit the check-digit rule expected, and what was typed', () => {
    const message = refusalMessage(t, EXAMPLES.ean13Check);
    expect(message).toContain('7');
    expect(message).toContain('0');
  });

  it('names the character Code 128 cannot draw', () => {
    expect(refusalMessage(t, EXAMPLES.code128Character)).toContain('é');
  });

  it('names the row that already holds the number', () => {
    expect(refusalMessage(t, EXAMPLES.duplicate)).toContain('ash-board');
  });

  it('says both lengths when a code is too long for the label', () => {
    const message = refusalMessage(t, EXAMPLES.code128TooLong);
    expect(message).toContain('40');
    expect(message).toContain(String(CODE128_MAX_LENGTH));
  });
});

describe('the limits are on the screen, not only in a header', () => {
  const html = renderPanel();

  it('describes the sheet with the geometry the renderer really uses', () => {
    expect(
      shows(
        html,
        t('addon.barcode-labels.sheet.geometry', {
          perSheet: LABELS_PER_SHEET,
          columns: GRID.columns,
          rows: GRID.rows,
          width: LABEL.widthMm,
          height: LABEL.heightMm,
        }),
      ),
    ).toBe(true);
  });

  it('states the base-14 alphabet, which is the cost of embedding no font', () => {
    // 25 D11 asks for the cost of a no-dependency decision to be stated where
    // it is felt, and it is felt by whoever prints a label for a row whose
    // reference is not written in Latin script.
    expect(shows(html, EN['addon.barcode-labels.sheet.latin'])).toBe(true);
  });

  /**
   * THE ABSENCE THIS ADD-ON IS NOT ALLOWED TO HIDE.
   *
   * A run of labels for the WHOLE catalogue is out of scope — the only view of
   * a shop's catalogue any slot payload offers is `samples`, one record per
   * family, and a list-level surface is an open decision this add-on is not
   * entitled to assume. So the form says so, rather than rendering a box that
   * looks as though it should have listed everything.
   */
  it('says out loud that a sheet covers one row and not a catalogue', () => {
    expect(shows(html, EN['addon.barcode-labels.scope.oneRow'])).toBe(true);
    expect(shows(html, EN['addon.barcode-labels.scope.families'])).toBe(true);
  });

  it('says that no number is handed out or looked up here', () => {
    expect(shows(html, EN['addon.barcode-labels.note.noAllocation'])).toBe(true);
  });

  it('states the positive fact where a not-affiliated line would go', () => {
    expect(shows(html, EN['addon.barcode-labels.noCompany'])).toBe(true);
  });
});

describe('the styling rules this file has to keep', () => {
  const source = readFileSync(new URL('./SettingsPanel.tsx', import.meta.url), 'utf8');

  it('renders no anchor, so no href can carry a banned path', () => {
    // 17 §2 bans `/mo` in a link. This surface has no link at all, which is the
    // simplest way to be sure — and a URL in a shipped source would also be the
    // first thing the egress net reports.
    expect(/href=/.test(source)).toBe(false);
    expect(renderPanel()).not.toContain('<a ');
  });

  it('leaves the host to decide the language, rather than stamping one', () => {
    expect(renderPanel()).not.toContain('lang=');
  });
});
