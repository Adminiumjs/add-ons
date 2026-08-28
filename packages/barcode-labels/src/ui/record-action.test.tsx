/**
 * THE FIRST FILL OF `record.actions`, RENDERED.
 *
 * ── THE CASE THIS WHOLE FILE EXISTS FOR ────────────────────────────────────
 *
 * `patchRecord` is OPTIONAL on this payload, and its own comment explains that
 * hosts genuinely differ on whether an add-on may write back to a record. The
 * rule the comment states is that an add-on handed no write handle SAYS SO ON
 * SCREEN and does the readable half of its job.
 *
 * This add-on takes that further, on purpose: it does not write at all, in
 * either kind of host, because the only write available to it would be stamping
 * a number into a field whose name no host has told it — which is
 * `payloads.ts`'s founding mistake in the other direction. So it renders THE
 * SAME SCREEN whether the handle is there or not, and the case below asserts
 * the two markups are byte-identical. A future edit that reached for the handle
 * turns it red, which is the point: the claim in the header is a claim a suite
 * holds rather than a paragraph.
 *
 * ── AND THE LIMIT THIS SURFACE CANNOT CHECK ────────────────────────────────
 *
 * Numbers are filed under the host's CATALOGUE key and looked up here by
 * `recordId`. Nothing on either payload lets the add-on verify the two
 * namespaces meet, so a host that mounts this on the wrong screen finds nothing
 * forever. The empty state therefore NAMES THE KEY IT LOOKED FOR, which turns a
 * mystery into a two-second diagnosis, and that is asserted below rather than
 * left to the header.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { RecordActionsPayload } from '@adminium/add-on-host';

import { modulesFor, STORAGE_KEY, type AssignedCode } from '../codes.ts';
import { LABELS_PER_SHEET } from '../geometry.ts';
import { strings } from '../i18n/strings.ts';
import { translate } from '../i18n/t.ts';
import { register } from '../index.ts';
import { runsOf } from '../modules.ts';
import { labelsFor } from '../sheet.ts';
import { RecordAction } from './RecordAction.tsx';

const EN = strings['en-US'];
const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate('en-US', key, params);

const EAN: AssignedCode = { sku: 'zinc-tray', symbology: 'ean13', code: '5901234123457' };
const C128: AssignedCode = { sku: 'ash-board', symbology: 'code128', code: 'ADM-4417' };

/**
 * A payload shaped like the one a host passes.
 *
 * `record` is filled with a plausible row on purpose, and this component reads
 * none of it: what it needs is `recordId` and `now`. Passing a real-looking
 * record is what makes the "reads nothing out of it" claim worth asserting —
 * a fixture of `{}` would prove only that the component survives an empty one.
 */
function payloadWith(over: Partial<RecordActionsPayload> = {}): RecordActionsPayload {
  return {
    entity: 'part',
    recordId: 'zinc-tray',
    record: { id: 42, name: 'Zinc tray', barcode: 'NOT-THIS-ONE', ref: 'ZT/9' },
    now: { iso: '2026-08-05', hour: 10, minute: 20 },
    settings: { [STORAGE_KEY]: [EAN, C128] },
    ...over,
  };
}

const renderAction = (over: Partial<RecordActionsPayload> = {}) =>
  renderToStaticMarkup(<RecordAction payload={payloadWith(over)} />);

const asRendered = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const shows = (html: string, text: string): boolean => html.includes(asRendered(text));

describe('the fill the host actually mounts', () => {
  it('is the one `register()` fills `record.actions` with', () => {
    const fill = register().fills.find((entry) => entry.slot === 'record.actions');
    expect(fill, 'record.actions is not filled').toBeDefined();
    expect(fill!.order).toBe(10);
    const html = renderToStaticMarkup(<>{fill!.render(payloadWith() as never)}</>);
    expect(shows(html, EN['addon.barcode-labels.record.title'])).toBe(true);
  });

  it('renders words, never a raw message key', () => {
    expect(renderAction()).not.toContain('addon.barcode-labels.');
    expect(renderAction({ recordId: 'nobody' })).not.toContain('addon.barcode-labels.');
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE OPTIONAL WRITE HANDLE
 * ═════════════════════════════════════════════════════════════════════════════
 */
describe('it works identically with and without `patchRecord`', () => {
  it('renders the same markup either way', () => {
    const without = renderAction();
    const with_ = renderAction({ patchRecord: () => {} });
    expect(with_).toBe(without);
  });

  it('renders the same markup either way for a row with no number, too', () => {
    const without = renderAction({ recordId: 'nobody' });
    const with_ = renderAction({ recordId: 'nobody', patchRecord: () => {} });
    expect(with_).toBe(without);
  });

  it('never calls the handle, even when the host offers one', () => {
    let called = 0;
    renderToStaticMarkup(
      <RecordAction payload={payloadWith({ patchRecord: () => { called += 1; } })} />,
    );
    expect(called).toBe(0);
  });

  it('says on screen that the row is read and never written to', () => {
    // The sentence is true in every host of this surface, which is what lets it
    // be the same sentence in every host of this surface.
    expect(shows(renderAction(), EN['addon.barcode-labels.record.readOnly'])).toBe(true);
    expect(
      shows(renderAction({ patchRecord: () => {} }), EN['addon.barcode-labels.record.readOnly']),
    ).toBe(true);
  });

  it('never names a field of the host’s record', () => {
    // The refused alternative: stamping the number into `barcode` or `ean`
    // would be this add-on inventing a host's schema. The fixture's record
    // carries a `barcode` field precisely so that reading it would show here.
    const html = renderAction();
    expect(html).not.toContain('NOT-THIS-ONE');
    expect(html).not.toContain('ZT/9');
    expect(html).not.toContain('Zinc tray');
  });
});

describe('a row that has been given a number', () => {
  const html = renderAction();

  it('shows the number and which symbology it is', () => {
    expect(shows(html, EAN.code)).toBe(true);
    expect(shows(html, EN['addon.barcode-labels.sym.ean13'])).toBe(true);
  });

  it('draws the bars from the very modules the sheet is drawn from', () => {
    // A preview drawn from a second encoding would look like confirmation and
    // be a picture of a different barcode.
    const dark = runsOf(modulesFor(EAN)).filter((run) => run.dark).length;
    // One extra rect is the background the preview paints behind the bars.
    expect([...html.matchAll(/<rect/g)].length).toBe(dark + 1);
  });

  it('offers a save and a print, and says what the run comes to', () => {
    expect(shows(html, EN['addon.barcode-labels.record.make'])).toBe(true);
    expect(shows(html, EN['addon.barcode-labels.record.print'])).toBe(true);
    const run = labelsFor(LABELS_PER_SHEET);
    expect(
      shows(html, t('addon.barcode-labels.record.run', { labels: run.labels, sheets: run.sheets })),
    ).toBe(true);
  });

  it('starts at one sheet’s worth, which is what somebody usually wants', () => {
    expect(html).toContain(`value="${LABELS_PER_SHEET}"`);
  });

  it('shows the Code 128 row the same way when that is what the row carries', () => {
    const other = renderAction({ recordId: 'ash-board' });
    expect(shows(other, C128.code)).toBe(true);
    expect(shows(other, EN['addon.barcode-labels.sym.code128'])).toBe(true);
  });
});

describe('a row that has not', () => {
  const html = renderAction({ recordId: 'nobody' });

  it('says so, rather than drawing an empty box', () => {
    expect(shows(html, EN['addon.barcode-labels.record.none'])).toBe(true);
  });

  /**
   * THE ONE SEAM THIS ADD-ON CANNOT CHECK, TURNED INTO A DIAGNOSIS.
   *
   * Numbers are filed under the host's catalogue key; a host that mounts this
   * surface on a screen whose `recordId` is something else finds nothing,
   * forever, with nothing anywhere to say why. Printing the key it looked for
   * is the most an add-on on this seam can honestly do.
   */
  it('names the key it looked for', () => {
    expect(shows(html, t('addon.barcode-labels.record.lookedUp', { key: 'nobody' }))).toBe(true);
    expect(shows(html, 'nobody')).toBe(true);
  });

  it('offers no button that would do nothing', () => {
    // A save button on a row with no number would produce a sheet of blank
    // stickers, which is worse than no button.
    expect(shows(html, EN['addon.barcode-labels.record.make'])).toBe(false);
    expect(html).not.toContain('<svg');
  });
});

describe('the label font’s alphabet, said where it is felt', () => {
  it('stays quiet when everything can be drawn', () => {
    expect(shows(renderAction(), EN['addon.barcode-labels.record.dropped'].slice(0, 20))).toBe(
      false,
    );
  });

  it('says how much of a reference cannot be printed, when some of it cannot', () => {
    const html = renderAction({
      recordId: 'zinc-tray',
      entity: 'часть',
      settings: { [STORAGE_KEY]: [EAN] },
    });
    expect(shows(html, t('addon.barcode-labels.record.dropped', { count: 5 }))).toBe(true);
  });
});

describe('the rules this file has to keep', () => {
  const source = readFileSync(new URL('./RecordAction.tsx', import.meta.url), 'utf8');

  it('reads no field of the host’s record, at all', () => {
    // A grep rather than an observation, because the observation above can only
    // see what a fixture happened to carry. `payload.record` may be named in a
    // comment — the header discusses it at length — so the code is read with
    // its comments removed.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(/payload\.record\s*\[/.test(code), 'a record field is being read').toBe(false);
    expect(/payload\.record\./.test(code), 'a record field is being read').toBe(false);
    expect(/\bpatchRecord\b/.test(code), 'the write handle is being used').toBe(false);
  });

  it('takes the day from the host rather than reading a clock', () => {
    /*
     * A PLAIN SUBSTRING AND NOT A PATTERN, and the first draft of this line was
     * the pattern. `packages/host/src/shared-rule.test.ts` reported it, exactly
     * as it is meant to: a regular expression hunting `new Date(` is a SECOND
     * copy of the shared purity rule, and two rules where there should be one
     * means only one of them gets repaired next time. The shared rule is run
     * over this whole package by `sources.test.ts`; this narrower question —
     * does THIS file take its day from the payload — is asked in a form that
     * cannot be mistaken for the rule itself.
     */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).toContain('payload.now.iso');
    expect(code.includes('new Date(')).toBe(false);
  });

  it('renders no anchor of its own, so no href can carry a banned path', () => {
    // The save button builds an anchor at press time and hands it an object
    // URL; nothing is rendered into the tree.
    expect(renderAction()).not.toContain('<a ');
  });
});
