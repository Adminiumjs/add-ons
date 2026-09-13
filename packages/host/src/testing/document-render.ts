/**
 * `describeDocumentRenderer` — COPIED VERBATIM from
 * `@adminium/add-on-contracts/testing` (24 §5.5, D9; 34-T04), with only the
 * import paths changed to the local mirror.
 *
 * The suite is part of the contract, not a courtesy. What it carries for THIS
 * contract is the claim that a document provider is interchangeable: the
 * engine picks one by add-on key and hands it a subject, and everything it
 * then relies on — eight-locale labels, a typed refusal instead of a silent
 * drop, a cross-reference table that parses back, the same subject rendering
 * to the same bytes — is asserted here and nowhere else.
 *
 * Do not soften an assertion here to make an implementation pass. If a
 * provider cannot satisfy it, the provider is wrong, or the contract needs a
 * version bump in the package these lines were copied from — and then here.
 */

import { describe, expect, it } from 'vitest';

import type {
  DocumentError,
  DocumentKind,
  DocumentOutline,
  DocumentRenderer,
  DocumentSubject,
  OutlineSlot,
  RenderedDocument,
} from '../contracts/document-render.ts';
import { isDocumentError } from '../contracts/document-render.ts';
import {
  documentKindSchema,
  documentOutlineSchema,
  localizedTextSchema,
  renderedDocumentSchema,
} from './schemas.ts';

/**
 * What an implementer supplies. Deliberately three fields, not ten.
 *
 * Every hard case this suite exercises — a missing required slot, an accented
 * subject, an Arabic one, a different clock — is DERIVED here from the one
 * valid subject, by rewriting the fields the outline already describes. That
 * keeps the derivations identical across providers (a fixture author cannot
 * accidentally make `MISSING_SLOT` easy by omitting an optional slot instead
 * of a required one), and it keeps the cost of a second implementer near zero,
 * which is the claim `shipping-carrier` makes and this contract inherits.
 */
export interface DocumentRendererFixtures {
  /** The add-on's own non-secret values, as the engine would pass them. */
  settings: Readonly<Record<string, unknown>>;
  /** One subject the provider renders happily, per kind. */
  subject: (kind: DocumentKind) => DocumentSubject;
  /** The authored composition, for a provider that takes one (34 D54). */
  body?: (kind: DocumentKind) => Readonly<Record<string, unknown>> | undefined;
  /**
   * The id of a slot whose value the renderer DRAWS VERBATIM — where the suite
   * puts `<script>`, `é ß ø €` and Arabic to see what comes back.
   *
   * It defaults to the kind's first `text` slot, which is right for most
   * providers and wrong for two kinds this suite has already met:
   *
   *   · a slot the provider VALIDATES. Push `é` into a slot holding a
   *     barcode number and the refusal that comes back is `INVALID_SUBJECT`
   *     from the check digit, never `LATIN_ONLY` from the writer — the
   *     assertion goes green on the wrong evidence, or red for the wrong
   *     reason;
   *   · a slot the provider does not PRINT. `barcode-labels`' first text slot
   *     is the row key, which is a lookup and appears nowhere on the sheet, so
   *     the accented subject rendered perfectly happily and the coverage
   *     assertion failed with the provider being entirely correct (found
   *     2026-09-10, 34-T06).
   *
   * A provider with no drawn free-text slot at all returns `undefined` and the
   * escaping and coverage assertions skip — loudly, in the name.
   */
  textSlot?: (kind: DocumentKind) => string | undefined;
}

/** WinAnsi-drawable, and outside ASCII — the boundary a `coverage:'ascii'` kind must refuse. */
const WINANSI_SAMPLE = 'é ß ø €';
/** Outside WinAnsi — the boundary a `coverage:'winansi'` kind must refuse. */
const BEYOND_WINANSI_SAMPLE = 'مرحبا 发票';

const LATIN1 = new TextDecoder('latin1');

/** The first slot of `type`, at the top level — collection columns are not mappable on their own. */
function firstSlotOfType(outline: DocumentOutline, type: string): OutlineSlot | undefined {
  return outline.slots.find((slot) => slot.type === type);
}

/**
 * A required slot with NO `default`. A required slot that defaults to
 * `sequence`/`now`/`connection`/`setting` is filled by the ENGINE, so deleting
 * its value proves nothing — the provider is entitled to see it arrive empty.
 */
function firstUnsuppliedRequiredSlot(outline: DocumentOutline): OutlineSlot | undefined {
  return outline.slots.find((slot) => slot.required && slot.default === undefined);
}

function withField(subject: DocumentSubject, id: string, value: unknown): DocumentSubject {
  return { ...subject, fields: { ...subject.fields, [id]: value } };
}

function withoutField(subject: DocumentSubject, id: string): DocumentSubject {
  const fields: Record<string, unknown> = { ...subject.fields };
  delete fields[id];
  return { ...subject, fields };
}

/**
 * `render` answered with documents — asserted, and narrowed in one step.
 *
 * `expect` fails by throwing, but TypeScript cannot see that, so the suite
 * used to follow each assertion with `if (isDocumentError(outcome)) continue;`
 * purely to narrow the union. That guard could never run: by the time it was
 * reached the assertion had either passed or thrown. An assertion signature
 * narrows without leaving an unreachable branch behind.
 */
function expectRendered(
  outcome: readonly RenderedDocument[] | DocumentError,
  message?: string,
): asserts outcome is readonly RenderedDocument[] {
  expect(isDocumentError(outcome), message).toBe(false);
}

/** `render` refused as data — the other ending, asserted and narrowed the same way. */
function expectRefused(
  outcome: readonly RenderedDocument[] | DocumentError,
  message?: string,
): asserts outcome is DocumentError {
  expect(isDocumentError(outcome), message).toBe(true);
}

/**
 * Walk a PDF's cross-reference table back to the objects it points at.
 *
 * This is the assertion that a hand-rolled writer cannot fake. Every offset in
 * the table is a BYTE offset, so a writer that computed them from
 * `String.length` over a stream containing one multi-byte character produces a
 * file every viewer opens and every parser mis-seeks — the exact failure 34's
 * §0.3 trap 8 sends the invoices writer over byte buffers to avoid. Seeking to
 * each offset and requiring `<n> 0 obj` there catches it on the first render.
 *
 * Exported so a writer's own tests can walk its table with the same rules the
 * suite applies, rather than re-deriving a second walker that drifts from
 * this one. Every refusal throws an `Error` naming what it found.
 */
export function parseXrefBack(bytes: Uint8Array): { objects: number; offsets: number[] } {
  const text = LATIN1.decode(bytes);
  const startxref = text.lastIndexOf('startxref');
  if (startxref < 0) throw new Error('no startxref in the file');
  const tail = text.slice(startxref);
  const declared = /startxref\s+(\d+)\s+%%EOF/.exec(tail);
  if (declared === null) throw new Error('startxref is not followed by an offset and %%EOF');

  const at = Number(declared[1]);
  if (!text.startsWith('xref', at)) {
    throw new Error(`startxref points at ${String(at)}, which is not the start of an xref table`);
  }

  const header = /^xref\s+(\d+)\s+(\d+)\s+/.exec(text.slice(at));
  if (header === null) throw new Error('the xref table has no subsection header');
  const first = Number(header[1]);
  const count = Number(header[2]);
  if (first !== 0) throw new Error('the first xref subsection must start at object 0');

  let cursor = at + header[0].length;
  const offsets: number[] = [];
  for (let n = 0; n < count; n += 1) {
    // Every entry is exactly twenty bytes: nnnnnnnnnn ggggg (n|f) plus two.
    const entry = text.slice(cursor, cursor + 20);
    if (!/^\d{10} \d{5} [nf][\r\n ][\r\n]$/.test(entry)) {
      throw new Error(`xref entry ${String(n)} is not twenty bytes: ${JSON.stringify(entry)}`);
    }
    const offset = Number(entry.slice(0, 10));
    const free = entry[17] === 'f';
    if (n === 0) {
      if (!free) throw new Error('object 0 must be the free-list head');
    } else {
      if (free) throw new Error(`object ${String(n)} is marked free but is in use`);
      if (!text.startsWith(`${String(n)} 0 obj`, offset)) {
        const found = JSON.stringify(text.slice(offset, offset + 16));
        throw new Error(`xref sends object ${String(n)} to ${String(offset)}, where ${found} is`);
      }
      offsets.push(offset);
    }
    cursor += 20;
  }
  return { objects: count - 1, offsets };
}

export function describeDocumentRenderer(
  impl: DocumentRenderer,
  fixtures: DocumentRendererFixtures,
): void {
  const kinds = impl.kinds();
  const bodyOf = (kind: DocumentKind): Readonly<Record<string, unknown>> | undefined =>
    fixtures.body === undefined ? undefined : fixtures.body(kind);
  const drawnTextSlot = (kind: DocumentKind): string | undefined => {
    if (fixtures.textSlot !== undefined) return fixtures.textSlot(kind);
    return firstSlotOfType(impl.describe(kind.id), 'text')?.id;
  };
  const renderOf = async (
    kind: DocumentKind,
    subject: DocumentSubject,
    formats: readonly ('html' | 'pdf')[] = kind.formats,
  ): Promise<readonly RenderedDocument[] | DocumentError> => {
    const body = bodyOf(kind);
    return impl.render({
      kind: kind.id,
      subject,
      formats,
      paper: kind.paper[0] as 'a4' | 'letter' | 'receipt-80mm',
      settings: fixtures.settings,
      ...(body === undefined ? {} : { body }),
    });
  };

  describe(`document-render@1 conformance — ${impl.key}`, () => {
    it('has a non-empty key', () => {
      expect(impl.key).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('lists at least one kind, each of the declared shape', () => {
      expect(kinds.length).toBeGreaterThan(0);
      for (const kind of kinds) {
        const parsed = documentKindSchema.safeParse(kind);
        expect(parsed.success, `${kind.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      }
    });

    it('labels every kind in all eight locales, with no locale left out', () => {
      // 0.3 trap 19. A hole here is a raw slot id on somebody's screen in
      // Studio, and `localizedTextSchema` is `.strict()` so a NINTH locale —
      // a provider inventing `es-ES` — fails just as loudly as a missing one.
      for (const kind of kinds) {
        const parsed = localizedTextSchema.safeParse(kind.label);
        expect(parsed.success, `${kind.id} label: ${JSON.stringify(parsed.error?.issues)}`).toBe(
          true,
        );
      }
    });

    it('describes every kind it lists, labelling every slot in all eight locales', () => {
      for (const kind of kinds) {
        const outline = impl.describe(kind.id);
        const parsed = documentOutlineSchema.safeParse(outline);
        expect(parsed.success, `${kind.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
        expect(outline.slots.length, `${kind.id} describes no slots`).toBeGreaterThan(0);
        for (const slot of outline.slots) {
          expect(
            localizedTextSchema.safeParse(slot.label).success,
            `${kind.id}.${slot.id} label is not complete in eight locales`,
          ).toBe(true);
          if (slot.help !== undefined) {
            expect(
              localizedTextSchema.safeParse(slot.help).success,
              `${kind.id}.${slot.id} help is not complete in eight locales`,
            ).toBe(true);
          }
          if (slot.type === 'collection') {
            expect(slot.columns ?? [], `${kind.id}.${slot.id} is a collection with no columns`)
              .not.toHaveLength(0);
          }
        }
      }
    });

    it('throws when asked to describe a kind it does not list', () => {
      // `describe` returns an outline, not a union: an unknown kind here is a
      // programming error in the CONSUMER, which has `kinds()` in its hand.
      // The data path — a stored profile naming a kind the provider dropped in
      // an upgrade — is `render`, and that one refuses as data. Both below.
      expect(() => impl.describe('no-such-kind')).toThrow();
    });

    it('refuses an unknown kind as data, never as an exception', async () => {
      const outcome = await impl.render({
        kind: 'no-such-kind',
        subject: fixtures.subject(kinds[0]!),
        formats: ['html'],
        paper: 'a4',
        settings: fixtures.settings,
      });
      expectRefused(outcome);
      expect(outcome.code).toBe('UNSUPPORTED_KIND');
    });

    it('refuses a subject missing a required slot with MISSING_SLOT that names it', async () => {
      for (const kind of kinds) {
        const outline = impl.describe(kind.id);
        const slot = firstUnsuppliedRequiredSlot(outline);
        if (slot === undefined) continue;
        const outcome = await renderOf(kind, withoutField(fixtures.subject(kind), slot.id));
        expectRefused(outcome, `${kind.id} rendered without ${slot.id}`);
        expect(outcome.code).toBe('MISSING_SLOT');
        // The engine puts this in front of an operator, who needs to know
        // WHICH column they did not map.
        expect(outcome.detail ?? '').toContain(slot.id);
      }
    });

    it('is given money as integer minor units and percent as basis points', async () => {
      // The wire law, asserted on the FIXTURE — the provider never sees a
      // decimal, so a fixture carrying 12.5 would be testing a shape the
      // engine does not produce. The invoice rounding law is NOT here: it is
      // the invoices package's own (34 D20), because it is arithmetic a
      // label-sheet renderer has no opinion about.
      for (const kind of kinds) {
        const outline = impl.describe(kind.id);
        const subject = fixtures.subject(kind);
        for (const slot of outline.slots) {
          // A collection's rows live in `subject.collections`, never in
          // `fields`, so this branch must come BEFORE the `fields` read below.
          // Written after it, the `continue` on an undefined field skipped
          // every collection, and a decimal in a line item passed.
          if (slot.type === 'collection') {
            const rows = subject.collections[slot.id] ?? [];
            for (const column of slot.columns ?? []) {
              if (column.type !== 'money' && column.type !== 'percent') continue;
              for (const row of rows) {
                const cell = row[column.id];
                if (cell === undefined || cell === null) continue;
                expect(
                  Number.isInteger(cell),
                  `${kind.id}.${slot.id}[].${column.id} is ${String(cell)}`,
                ).toBe(true);
              }
            }
            continue;
          }
          const value = subject.fields[slot.id];
          if (value === undefined || value === null) continue;
          if (slot.type === 'money' || slot.type === 'percent') {
            expect(Number.isInteger(value), `${kind.id}.${slot.id} is ${String(value)}`).toBe(true);
          }
        }
      }
    });

    it('renders every format it declares, and nothing it does not', async () => {
      for (const kind of kinds) {
        const outcome = await renderOf(kind, fixtures.subject(kind));
        expectRendered(outcome, `${kind.id}: ${JSON.stringify(outcome)}`);
        expect(outcome.map((d) => d.format).sort()).toEqual([...kind.formats].sort());
        for (const document of outcome) {
          const parsed = renderedDocumentSchema.safeParse(document);
          expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
          expect(document.bytes.byteLength).toBeGreaterThan(0);
          expect(document.filename).not.toContain('/');
        }
      }
    });

    it('renders one subject to the same bytes twice — and so reads no clock of its own', async () => {
      // 25 D12. Two renders separated by real time: identical bytes are the
      // proof that `Date.now()` is not in the code path, which is why this one
      // assertion carries the whole "byte-identical from a pinned clock" claim.
      for (const kind of kinds) {
        const subject = fixtures.subject(kind);
        const first = await renderOf(kind, subject);
        const second = await renderOf(kind, subject);
        expectRendered(first);
        expectRendered(second);
        expect(second).toHaveLength(first.length);
        for (let at = 0; at < first.length; at += 1) {
          expect(
            Array.from(second[at]!.bytes),
            `${kind.id} ${first[at]!.format} differs between two renders of one subject`,
          ).toEqual(Array.from(first[at]!.bytes));
          expect(second[at]!.filename).toBe(first[at]!.filename);
        }
      }
    });

    it('never puts a script into its HTML', async () => {
      // The engine serves these bytes back to a browser and the subject is
      // full of customer-supplied text, so this is an escaping assertion
      // wearing an output-format hat.
      for (const kind of kinds) {
        if (!kind.formats.includes('html')) continue;
        const text = drawnTextSlot(kind);
        const subject =
          text === undefined
            ? fixtures.subject(kind)
            : withField(fixtures.subject(kind), text, '<script>alert(1)</script>');
        const outcome = await renderOf(kind, subject, ['html']);
        expectRendered(outcome, `${kind.id}: ${JSON.stringify(outcome)}`);
        for (const document of outcome) {
          expect(LATIN1.decode(document.bytes).toLowerCase()).not.toContain('<script');
        }
      }
    });

    it('writes a PDF whose cross-reference table parses back to real objects', async () => {
      for (const kind of kinds) {
        if (!kind.formats.includes('pdf')) continue;
        const text = drawnTextSlot(kind);

        /*
         * Two subjects, and the SECOND one is the assertion that has teeth.
         *
         * A writer that collects its cross-reference offsets from
         * `String.length` over the document text — 34 §0.3 trap 8, and the
         * shape `barcode-labels`' scaffold is written in (`sheet.ts:441-449`)
         * — produces a perfectly valid file for as long as every character is
         * ASCII, because there one character is one byte. It breaks the first
         * time a customer is called Müller. Parsing the xref back over an
         * ASCII-only subject therefore proves nothing about the class of bug
         * it exists to catch: this assertion passed a deliberate mutation to
         * `String.length` on 2026-09-10 and had to be widened here.
         *
         * So where the kind's own coverage admits accented text, the table is
         * walked over a subject that HAS some.
         */
        const subjects: DocumentSubject[] = [fixtures.subject(kind)];
        if (kind.coverage !== 'ascii' && text !== undefined) {
          subjects.push(withField(fixtures.subject(kind), text, `Müller ${WINANSI_SAMPLE}`));
        }

        for (const subject of subjects) {
          const outcome = await renderOf(kind, subject, ['pdf']);
          expectRendered(outcome, `${kind.id}: ${JSON.stringify(outcome)}`);
          for (const document of outcome) {
            const decoded = LATIN1.decode(document.bytes);
            expect(decoded.startsWith('%PDF-1.4'), `${kind.id} is not a PDF 1.4`).toBe(true);
            expect(decoded.endsWith('%%EOF\n')).toBe(true);
            const { objects } = parseXrefBack(document.bytes);
            expect(objects, `${kind.id} declares no objects`).toBeGreaterThan(0);
            expect(document.mediaType).toBe('application/pdf');
          }
        }
      }
    });

    it('draws the glyphs its coverage claims, and refuses the ones it does not — typed', async () => {
      for (const kind of kinds) {
        if (!kind.formats.includes('pdf')) continue;
        const text = drawnTextSlot(kind);
        if (text === undefined) continue;

        for (const [sample, drawable] of [
          [WINANSI_SAMPLE, kind.coverage !== 'ascii'],
          [BEYOND_WINANSI_SAMPLE, kind.coverage === 'all'],
        ] as const) {
          const subject = withField(fixtures.subject(kind), text, sample);
          const outcome = await renderOf(kind, subject, ['pdf']);

          if (drawable) {
            expect(
              isDocumentError(outcome),
              `${kind.id} claims coverage '${kind.coverage}' but refused ${sample}: ${JSON.stringify(outcome)}`,
            ).toBe(false);
            continue;
          }

          // The refusal is the contract's point: a writer that silently
          // dropped the letters would ship an invoice with a customer's name
          // missing characters, and nothing downstream would ever know.
          expectRefused(
            outcome,
            `${kind.id} claims coverage '${kind.coverage}' and drew ${sample} anyway`,
          );
          expect(outcome.code).toBe('LATIN_ONLY');
          expect(outcome.dropped ?? [], `${kind.id} refused without naming a glyph`).not.toHaveLength(
            0,
          );
          for (const glyph of outcome.dropped ?? []) {
            expect(sample, `${kind.id} reported '${glyph}', which is not in the subject`).toContain(
              glyph,
            );
          }

          // And the refusal belongs to the WRITER, not to the subject: the
          // same text in HTML, which is UTF-8, must render.
          if (kind.formats.includes('html')) {
            const asHtml = await renderOf(kind, subject, ['html']);
            expect(
              isDocumentError(asHtml),
              `${kind.id} refused ${sample} in HTML too — the refusal is not the writer's`,
            ).toBe(false);
          }
        }
      }
    });
  });
}
