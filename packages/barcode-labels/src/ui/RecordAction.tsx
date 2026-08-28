/**
 * THE FIRST FILL OF `record.actions` — a sheet of labels for the row in front
 * of you.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY THIS SURFACE IS THE SHAPE THE SLOT WAS BOUGHT FOR
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The closed registry's entry for this id describes it as one opening, on the
 * screen where somebody is already looking at ONE record, to do a thing to it —
 * and then records that it ships unfilled, because the wave-6 add-on that could
 * have filled it turned out not to need it. `payloads.ts` repeats the
 * consequence: a reader will not find a fill by grepping.
 *
 * Printing labels for one catalogue row is that sentence with nothing left
 * over. The person is on the row's screen because the row is what they are
 * dealing with; the thing they want is a sheet of stickers for it; and there is
 * no other screen in either host where that request makes sense, because a
 * sheet of labels is FOR a row and a list of rows is not a row.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * `patchRecord` IS NEVER CALLED, AND THAT IS A DECISION WITH AN ARGUMENT
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The payload carries an OPTIONAL write handle, and its own comment sets out
 * the reason for the optionality: hosts genuinely differ on whether an add-on
 * may write back, and the dossier the slot was bought against splits down the
 * middle — rendering an invoice to a file writes nothing to the invoice, while
 * logging a call onto a deal is nothing but a write.
 *
 * THIS ADD-ON IS SQUARELY IN THE FIRST HALF, and it does not merely happen to
 * be: the alternative was considered and refused. The obvious write is to stamp
 * the number onto the record so the shop's own list can show it — and to do
 * that this add-on would have to choose a FIELD NAME. `barcode`? `ean`? `code`?
 * Nothing on this payload says what the shop calls that column, or whether it
 * has one, and picking one would be this add-on inventing a host's schema. That
 * is `payloads.ts`'s founding mistake in the other direction: one shop's
 * vocabulary pushed into every host through the only door that was open.
 *
 * So the number lives where it belongs — in this add-on's own table, reachable
 * through `codeFor` at any mount site the host likes — the record is READ and
 * never written, and the screen says so in
 * `addon.barcode-labels.record.readOnly`.
 *
 * THE PAYOFF IS THAT THE ABSENCE COSTS NOTHING. An add-on that wanted the
 * handle would have to render one screen when it has one and a different, worse
 * screen when it does not. This one renders the same screen either way, in
 * every host of the surface, which is the strongest form the optionality can be
 * honoured in — and `record-action.test.tsx` renders it both ways and asserts
 * the markup is identical, so a future edit that reached for the handle turns
 * that case red.
 *
 * ── AND `record` IS UNUSED, WHICH IS ALSO THE POINT ────────────────────────
 *
 * The payload hands over the whole record and this component reads none of it.
 * What it needs is `recordId` — the host's own answer to "which row is this" —
 * and `now`, the shop's own day. Reaching into `record` to find a better key,
 * or a name to print on the sticker, would be sniffing a layout that differs in
 * every app: `id`, `ref`, `number` and `code` are all in use as the identity
 * field across the fifteen apps, which is exactly why `recordId` exists.
 */

import { useState } from 'react';

import type { RecordActionsPayload } from '@adminium/add-on-host';

import { codeFor, modulesFor } from '../codes.ts';
import { LABELS_PER_SHEET } from '../geometry.ts';
import { useT } from '../i18n/t.ts';
import {
  labelSheetFilename,
  labelsFor,
  renderLabelSheet,
  undrawableCharacters,
  type SheetFacts,
} from '../sheet.ts';
import { Bars, Button, Field, Note, Panel, PanelTitle, Tag, Typed, inputStyle } from './atoms.tsx';
import { symbologyKey } from './SettingsPanel.tsx';

/**
 * Hand the sheet to the operating system.
 *
 * A blob rather than a link, for the reason `shipping-dhl` gives at the same
 * seam: the bytes are made in the page and there is no server to fetch them
 * from. Print goes through a hidden frame because `window.open` is blocked in
 * enough embeddings to be unreliable, and a Print button that silently does
 * nothing is worse than no Print button.
 */
function withSheetBlob(bytes: string, use: (url: string) => void): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  use(url);
  // Long enough for the save to start or the frame to load; the object URL is
  // the only thing leaked if it is not revoked, so err on the side of late.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function RecordAction({ payload }: { payload: RecordActionsPayload }) {
  const t = useT();

  const assigned = codeFor(payload.settings, payload.recordId);
  const [wanted, setWanted] = useState(String(LABELS_PER_SHEET));

  if (assigned === undefined) {
    /*
     * THE EMPTY STATE NAMES THE KEY IT LOOKED FOR, which is the most this
     * add-on can honestly do about the one seam it cannot check. Numbers are
     * filed under the host's catalogue key; a host that mounts this surface on
     * a screen whose `recordId` is something else will find nothing, forever,
     * with nothing anywhere to say why. Printing the key turns that from a
     * mystery into a two-second diagnosis. See `codes.ts` for the whole
     * account.
     */
    return (
      <Panel>
        <PanelTitle>{t('addon.barcode-labels.record.title')}</PanelTitle>
        <Note style={{ marginBlockStart: 6, fontSize: 12.5, color: 'var(--fg-muted)' }}>
          {t('addon.barcode-labels.record.none')}
        </Note>
        <Note style={{ marginBlockStart: 5 }}>
          {t('addon.barcode-labels.record.lookedUp', { key: payload.recordId })}
        </Note>
      </Panel>
    );
  }

  const facts: SheetFacts = {
    assigned,
    entity: payload.entity,
    reference: payload.recordId,
    count: Number.parseInt(wanted, 10),
    // THE SHOP'S DAY, NOT A CLOCK. `now` is a host fact — see `payloads.ts` —
    // and taking it from here rather than reading one is what keeps the same
    // request giving back the same bytes.
    on: payload.now.iso,
  };
  const run = labelsFor(facts.count);
  const dropped = undrawableCharacters(facts);

  return (
    <Panel>
      <PanelTitle>{t('addon.barcode-labels.record.title')}</PanelTitle>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBlockStart: 8,
          marginBlockEnd: 10,
        }}
      >
        <Tag>{t(symbologyKey(assigned.symbology))}</Tag>
        <Typed style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
          {assigned.code}
        </Typed>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 11,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          marginBlockEnd: 12,
        }}
      >
        <Bars modules={modulesFor(assigned)} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <Field label={t('addon.barcode-labels.record.count')}>
          <input
            type="number"
            min={1}
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            style={inputStyle}
          />
        </Field>
        <Button
          onClick={() =>
            withSheetBlob(renderLabelSheet(facts), (url) => {
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = labelSheetFilename(assigned);
              anchor.click();
            })
          }
        >
          {t('addon.barcode-labels.record.make')}
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            withSheetBlob(renderLabelSheet(facts), (url) => {
              const frame = document.createElement('iframe');
              frame.style.display = 'none';
              frame.src = url;
              frame.onload = () => frame.contentWindow?.print();
              document.body.appendChild(frame);
            })
          }
        >
          {t('addon.barcode-labels.record.print')}
        </Button>
      </div>

      <Note style={{ marginBlockStart: 10 }}>
        {t('addon.barcode-labels.record.run', { labels: run.labels, sheets: run.sheets })}
      </Note>
      {dropped > 0 && (
        <Note style={{ marginBlockStart: 5, color: 'var(--warn)' }}>
          {t('addon.barcode-labels.record.dropped', { count: dropped })}
        </Note>
      )}
      <Note style={{ marginBlockStart: 5 }}>{t('addon.barcode-labels.record.readOnly')}</Note>
    </Panel>
  );
}
