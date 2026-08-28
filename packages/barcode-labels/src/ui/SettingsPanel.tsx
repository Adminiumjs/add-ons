/**
 * WHERE A ROW IS GIVEN A NUMBER — this add-on's own form in the manage drawer.
 *
 * ── THE DIVISION OF LABOUR BETWEEN THIS SURFACE AND THE OTHER ONE ──────────
 *
 * There are two, and which one does what is not an arrangement of convenience:
 *
 *   HERE, a number is GIVEN OUT. `SettingsPanelPayload` carries `patch`, which
 *   writes this add-on's own values, so this is the only surface in the package
 *   that can change anything at all.
 *
 *   ON A ROW'S OWN SCREEN, a sheet is MADE. `RecordActionsPayload` carries no
 *   way to write add-on settings — deliberately; it is an action on a record,
 *   not a settings form — so that surface reads the table and draws.
 *
 * The consequence is worth stating because somebody will meet it: you cannot
 * give a row its number from the row. That is not a missing button, it is what
 * the two payloads are. What the row's screen does instead is say which key it
 * looked for, so the trip to this form is a short one.
 *
 * ── AND THE LIMIT THIS FORM CANNOT GET ROUND ───────────────────────────────
 *
 * `samples` is ONE RECORD PER FAMILY of what the shop sells — its own comment
 * in `payloads.ts` says so — and it is the only view of the catalogue any slot
 * payload offers. So this form can offer the families and no more, and a shop
 * whose rows are finer than its families has rows it cannot reach from here.
 *
 * The honest thing is to say so rather than to render a box that looks like it
 * should list everything, so the form says it, in
 * `addon.barcode-labels.scope.families`, in all eight languages. What would
 * change it is a list-level surface — a slot handed the rows a person is
 * looking at — which is an open decision and not one this add-on is entitled to
 * assume. Until then this half is complete and the other half does not exist,
 * and both of those are on the screen in words.
 *
 * Styling is from the host's token custom properties only, in CSS logical
 * properties, for the reasons `atoms.tsx` sets out.
 */

import { useState } from 'react';

import type { SettingsPanelPayload } from '@adminium/add-on-host';

import {
  assignCode,
  forgetCode,
  modulesFor,
  readStored,
  writeStored,
  SYMBOLOGIES,
  type AssignedCode,
  type Refusal,
  type Symbology,
} from '../codes.ts';
import {
  CODE128_MAX_LENGTH,
  GRID,
  LABEL,
  LABELS_PER_SHEET,
} from '../geometry.ts';
import { useT, type TFunction } from '../i18n/t.ts';
import type { StringKey } from '../i18n/strings.ts';
import {
  Bars,
  Button,
  Eyebrow,
  Field,
  LinkButton,
  NoCompany,
  Note,
  Panel,
  PanelTitle,
  Tag,
  Typed,
  inputStyle,
} from './atoms.tsx';

/**
 * EVERY REFUSAL HAS A SENTENCE, AND THE MAPPING IS TOTAL.
 *
 * A `switch` over the discriminant rather than a lookup keyed by
 * `refusal.why`, because each variant carries different fields and the compiler
 * narrows them here: a message written with the wrong placeholder is a build
 * error rather than a `{expected}` printed literally on somebody's screen.
 *
 * `settings-panel.test.ts` drives every member of `REFUSAL_KINDS` through this
 * and asserts none of them comes back as a bare message key, so a variant added
 * to `codes.ts` without copy is a red suite rather than a blank red box.
 *
 * THE TWO DIGITS IN THE CHECK-DIGIT CASE ARE PASSED AS STRINGS. They are part
 * of an identifier, not a count, and `t.ts` leaves strings alone — see its own
 * header for why this is the one number in the package that must not be
 * transliterated.
 */
export function refusalMessage(t: TFunction, refusal: Refusal): string {
  switch (refusal.why) {
    case 'noRow':
      return t('addon.barcode-labels.refuse.noRow');
    case 'empty':
      return t('addon.barcode-labels.refuse.empty');
    case 'ean13Shape':
      return t('addon.barcode-labels.refuse.ean13Shape', { given: refusal.given });
    case 'ean13Check':
      return t('addon.barcode-labels.refuse.ean13Check', {
        expected: String(refusal.expected),
        typed: String(refusal.given),
      });
    case 'code128Character':
      return t('addon.barcode-labels.refuse.code128Character', { character: refusal.character });
    case 'code128TooLong':
      return t('addon.barcode-labels.refuse.code128TooLong', {
        given: refusal.given,
        limit: refusal.limit,
      });
    case 'duplicate':
      return t('addon.barcode-labels.refuse.duplicate', { heldBy: refusal.heldBy });
  }
}

/** The message key naming a symbology, so the picker and the held list agree. */
export function symbologyKey(symbology: Symbology): StringKey {
  return symbology === 'ean13'
    ? 'addon.barcode-labels.sym.ean13'
    : 'addon.barcode-labels.sym.code128';
}

/** What the last press did. Held here because it is a fact about this session. */
type Outcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  | { readonly kind: 'done' };

export function SettingsPanel({ payload }: { payload: SettingsPanelPayload }) {
  const t = useT();

  const held = readStored(payload.settings);
  const [row, setRow] = useState<string>(payload.samples[0]?.key ?? '');
  const [symbology, setSymbology] = useState<Symbology>('ean13');
  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });

  /*
   * EVERY WRITE GOES THROUGH `patch`, AND `patch` TAKES THE WHOLE TABLE.
   *
   * The engines in `codes.ts` return a complete table rather than a diff, so
   * there is no path here that appends to what the host holds — which is what
   * makes giving the same row the same number twice produce exactly the same
   * document. This function is the only writer in the file.
   */
  const save = (codes: readonly AssignedCode[]) => {
    payload.patch(writeStored(codes));
  };

  const doAssign = () => {
    const result = assignCode(held, row, symbology, code);
    if (!result.ok) {
      setOutcome({ kind: 'refused', refusal: result.refusal });
      return;
    }
    save(result.codes);
    setCode('');
    setOutcome({ kind: 'done' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeldCodes
        held={held}
        labelFor={(sku) => payload.samples.find((sample) => sample.key === sku)?.label}
        onForget={(sku) => {
          save(forgetCode(held, sku));
          setOutcome({ kind: 'none' });
        }}
      />

      <Panel>
        <PanelTitle>{t('addon.barcode-labels.assign.title')}</PanelTitle>
        <Note style={{ marginBlockStart: 6, marginBlockEnd: 12 }}>
          {t('addon.barcode-labels.assign.note')}
        </Note>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBlockEnd: 12 }}>
          <Field label={t('addon.barcode-labels.assign.row')}>
            <select
              value={row}
              onChange={(event) => {
                setRow(event.target.value);
                setOutcome({ kind: 'none' });
              }}
              style={inputStyle}
            >
              {payload.samples.map((sample) => (
                <option key={sample.key} value={sample.key}>
                  {sample.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('addon.barcode-labels.assign.symbology')}>
            <select
              value={symbology}
              onChange={(event) => {
                setSymbology(event.target.value as Symbology);
                setOutcome({ kind: 'none' });
              }}
              style={inputStyle}
            >
              {SYMBOLOGIES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {t(symbologyKey(candidate))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('addon.barcode-labels.assign.code')}>
            <input
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setOutcome({ kind: 'none' });
              }}
              style={inputStyle}
            />
          </Field>
        </div>

        <Note style={{ marginBlockEnd: 4 }}>{t('addon.barcode-labels.sym.ean13.note')}</Note>
        <Note style={{ marginBlockEnd: 12 }}>
          {t('addon.barcode-labels.sym.code128.note', { limit: CODE128_MAX_LENGTH })}
        </Note>

        <Button onClick={doAssign}>{t('addon.barcode-labels.assign.submit')}</Button>
      </Panel>

      {outcome.kind === 'refused' && (
        <Panel tone="danger">
          <PanelTitle tone="danger">{t('addon.barcode-labels.refuse.title')}</PanelTitle>
          <Note style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginBlockStart: 6 }}>
            {refusalMessage(t, outcome.refusal)}
          </Note>
        </Panel>
      )}

      {outcome.kind === 'done' && (
        <Panel tone="pos">
          <Note style={{ fontSize: 12.5, color: 'var(--fg)' }}>
            {t('addon.barcode-labels.assign.done')}
          </Note>
        </Panel>
      )}

      <Panel>
        <PanelTitle>{t('addon.barcode-labels.sheet.title')}</PanelTitle>
        <Note style={{ marginBlockStart: 6 }}>
          {t('addon.barcode-labels.sheet.geometry', {
            perSheet: LABELS_PER_SHEET,
            columns: GRID.columns,
            rows: GRID.rows,
            width: LABEL.widthMm,
            height: LABEL.heightMm,
          })}
        </Note>
        <Note style={{ marginBlockStart: 5 }}>{t('addon.barcode-labels.sheet.dated')}</Note>
        {/*
          THE BASE-14 CONSEQUENCE, ON THE SCREEN AND NOT ONLY IN A HEADER.
          `sheet.ts` draws its text with two of the fourteen fonts every PDF
          reader already has, which is what keeps a font out of the bundle and
          the file openable anywhere — and the price is a Latin alphabet and no
          other. 25 D11 asks for the cost of a no-dependency decision to be
          stated where it is felt, and it is felt by whoever prints a label for
          a row whose reference is not written in Latin script.
        */}
        <Note style={{ marginBlockStart: 5 }}>{t('addon.barcode-labels.sheet.latin')}</Note>
        <Note style={{ marginBlockStart: 5 }}>{t('addon.barcode-labels.sheet.noOutline')}</Note>
      </Panel>

      <Panel>
        <PanelTitle>{t('addon.barcode-labels.scope.title')}</PanelTitle>
        <Note style={{ marginBlockStart: 6 }}>{t('addon.barcode-labels.scope.oneRow')}</Note>
        <Note style={{ marginBlockStart: 5 }}>{t('addon.barcode-labels.scope.families')}</Note>
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Note>{t('addon.barcode-labels.note.noAllocation')}</Note>
        <NoCompany>{t('addon.barcode-labels.noCompany')}</NoCompany>
      </div>
    </div>
  );
}

/**
 * What is held now, one row per number.
 *
 * THE ROW FALLS BACK TO THE STORED KEY when the host's sample list no longer
 * carries it. A shop that renames a family, or an app that hands over a
 * different set of samples between two visits, still has the number in its
 * table and still has to be able to take it back — a row that vanished from
 * this list would leave a number nobody could reach, and the duplicate refusal
 * would go on naming it.
 */
function HeldCodes({
  held,
  labelFor,
  onForget,
}: {
  held: readonly AssignedCode[];
  labelFor: (sku: string) => string | undefined;
  onForget: (sku: string) => void;
}) {
  const t = useT();

  return (
    <div>
      <Eyebrow>{t('addon.barcode-labels.held.title')}</Eyebrow>
      {held.length === 0 ? (
        <Note>{t('addon.barcode-labels.held.none')}</Note>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {held.map((entry) => (
            <div
              key={entry.sku}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                border: '1px solid var(--border)',
                borderRadius: 11,
                padding: '9px 11px',
                background: 'var(--surface-2)',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, minInlineSize: 0 }}>
                {labelFor(entry.sku) ?? <Typed>{entry.sku}</Typed>}
              </span>
              <Tag>{t(symbologyKey(entry.symbology))}</Tag>
              <Typed style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                {entry.code}
              </Typed>
              <span style={{ inlineSize: 84, minInlineSize: 84 }}>
                <Bars modules={modulesFor(entry)} height={24} moduleWidth={1} />
              </span>
              <span style={{ marginInlineStart: 'auto' }}>
                <LinkButton onClick={() => onForget(entry.sku)}>
                  {t('addon.barcode-labels.held.remove')}
                </LinkButton>
              </span>
            </div>
          ))}
          <Note>{t('addon.barcode-labels.held.count', { count: held.length })}</Note>
        </div>
      )}
    </div>
  );
}
