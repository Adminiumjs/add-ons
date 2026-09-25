/**
 * `record.actions` — a document button on the screen where somebody is already
 * looking at one record.
 *
 * ── ENTITY-GATED, AND THE GATE IS A SETTING RATHER THAN A GUESS ────────────
 *
 * `payload.entity` is the host's own word for what this record is — `invoice`,
 * `sale`, `order` — and the `entities` setting says which of those get a
 * button. That is the ONLY thing the setting decides. What the columns MEAN is
 * the host's projection at the mount site (`host/subjectFromHost.ts`), because
 * an add-on carrying a mapping for one host's `sale` shape would be an add-on
 * that names its hosts, and a shop owner hand-editing a JSON mapping in a
 * settings panel is not a product.
 *
 * A record whose entity is not on the list gets a sentence saying so and
 * naming where to change it — not a hidden panel, which is indistinguishable
 * from a broken one.
 *
 * ── IT NEVER WRITES BACK (34 D18) ──────────────────────────────────────────
 *
 * `patchRecord` is optional on this payload and this fill ignores it entirely.
 * Writing a document number back into a record would mean choosing a field
 * name — one shop's vocabulary pushed onto every host — and this add-on has no
 * business deciding where a host keeps its numbers. So it draws bytes and
 * hands them to the operating system, and the record is untouched.
 *
 * ── AND EVERY RESULT HERE IS A REAL ONE ────────────────────────────────────
 *
 * 24 D11 requires a SIMULATED result to be labelled. Nothing on this surface
 * is simulated: the bytes are drawn from the record in front of you by the
 * same functions the server half uses. The demo label belongs to the settings
 * panel's sample, and `sources.test.ts` asserts the pairing there.
 */

import { useState } from 'react';

import type { RecordActionsPayload } from '@adminium/add-on-host';
import { isDocumentError } from '@adminium/add-on-host/contracts';

import { useT } from '../i18n/t.ts';
import type { StringKey } from '../i18n/strings.ts';
import { kinds } from '../kinds.ts';
import { renderDocument } from '../render.ts';
import { settingsFrom } from '../settings.ts';
import { Button, Note, Panel, PanelTitle, Tag } from './atoms.tsx';

/**
 * Hand the bytes to the operating system.
 *
 * A blob rather than a link, for the reason the sibling add-ons give at the
 * same seam: the bytes are made in the page and there is no server to fetch
 * them from. Print goes through a hidden frame because `window.open` is
 * blocked in enough embeddings to be unreliable, and a Print button that
 * silently does nothing is worse than no Print button.
 */
function withBlob(bytes: Uint8Array, mediaType: string, use: (url: string) => void): void {
  const blob = new Blob([bytes as BlobPart], { type: mediaType });
  const url = URL.createObjectURL(blob);
  use(url);
  // Long enough for the save to start or the frame to load; the object URL is
  // the only thing leaked if it is not revoked, so err on the side of late.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function download(bytes: Uint8Array, mediaType: string, filename: string): void {
  withBlob(bytes, mediaType, (url) => {
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  });
}

function print(bytes: Uint8Array, mediaType: string): void {
  withBlob(bytes, mediaType, (url) => {
    const frame = window.document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = url;
    frame.onload = () => frame.contentWindow?.print();
    window.document.body.appendChild(frame);
  });
}

const KIND_KEYS: Readonly<Record<string, StringKey>> = {
  invoice: 'addon.invoices.record.kind.invoice',
  receipt: 'addon.invoices.record.kind.receipt',
  'credit-note': 'addon.invoices.record.kind.creditNote',
  quote: 'addon.invoices.record.kind.quote',
  statement: 'addon.invoices.record.kind.statement',
};

export function DocumentAction({ payload }: { payload: RecordActionsPayload }) {
  const t = useT();
  const settings = settingsFrom(payload.settings);
  const [message, setMessage] = useState<string | null>(null);

  if (!settings.entities.includes(payload.entity)) {
    return (
      <Panel>
        <PanelTitle>{t('addon.invoices.record.title')}</PanelTitle>
        <Note style={{ marginBlockStart: 6 }}>{t('addon.invoices.record.none')}</Note>
      </Panel>
    );
  }

  const make = (kind: string, then: (bytes: Uint8Array, media: string, name: string) => void) => {
    const outcome = renderDocument({
      kind,
      // The HOST's record, mapped at the mount site. This surface passes it
      // straight through: it has no opinion about which column is which, and
      // acquiring one here is the trap the header names.
      record: payload.record,
      recordId: payload.recordId,
      // THE SHOP'S DAY, NOT A CLOCK. `now` is a host fact, and taking it from
      // here rather than reading one is what keeps the same record giving back
      // the same bytes (25 D12).
      now: payload.now,
      settings,
    });

    if (isDocumentError(outcome)) {
      setMessage(
        outcome.code === 'LATIN_ONLY'
          ? t('addon.invoices.refuse.latinOnly', { glyphs: (outcome.dropped ?? []).join(' ') })
          : t('addon.invoices.refuse.missing', { columns: outcome.detail ?? '' }),
      );
      return;
    }

    // Prefer the PDF where there is one; a till roll and a printed invoice are
    // both PDFs, and the HTML is the fallback for a document the writer would
    // have had to refuse.
    const chosen = outcome.find((d) => d.format === 'pdf') ?? outcome[0];
    if (chosen === undefined) return;
    then(chosen.bytes, chosen.mediaType, chosen.filename);
    setMessage(
      t('addon.invoices.record.drawn', {
        kind: t(KIND_KEYS[kind] ?? 'addon.invoices.record.title'),
        number: '',
      }),
    );
  };

  return (
    <Panel>
      <PanelTitle>{t('addon.invoices.record.title')}</PanelTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 8 }}>
        {kinds().map((kind) => (
          <Tag key={kind.id}>{t(KIND_KEYS[kind.id] ?? 'addon.invoices.record.title')}</Tag>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 10 }}>
        <Button
          onClick={() => {
            make('invoice', (bytes, media, name) => download(bytes, media, name));
          }}
        >
          {t('addon.invoices.record.download')}
        </Button>
        <Button
          onClick={() => {
            make('invoice', (bytes, media) => print(bytes, media));
          }}
        >
          {t('addon.invoices.record.print')}
        </Button>
      </div>
      {message === null ? null : <Note style={{ marginBlockStart: 8 }}>{message}</Note>}
    </Panel>
  );
}
