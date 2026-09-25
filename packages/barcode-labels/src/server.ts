/**
 * The `document-render@1` half — the SECOND implementation of the contract
 * (34-invoices-add-on.md O11, 34-T06).
 *
 * ── WHY THIS ADD-ON HAS A SERVER HALF NOW, WHEN IT HAD A REASON NOT TO ─────
 *
 * `vite.config.ts` used to explain, in three sentences borrowed from
 * `holiday-calendars`, that this package builds one bundle because it holds no
 * credential, has no egress, and therefore needs no demo transport. Every one
 * of those sentences is still true. None of them is the reason a server half
 * exists here: this one is not a place to keep a secret out of a browser, it
 * is the entry point the ENGINE loads when a document profile names this
 * add-on — `manifest.addOn.provides[].server`, resolved in the
 * `document.render` job, which never runs in a page. A provider that lived
 * only in `client.js` could not be reached from there at all.
 *
 * ── AND WHY A LABEL SHEET IS A DOCUMENT ────────────────────────────────────
 *
 * 25 D4 wants two implementations of a contract before it enters the registry,
 * so that the shape is answering to more than one caller. 34 O11 records the
 * deviation this pairing carries — both implementations write PDF bytes by
 * hand, where 25 §5 asked for "completely different means" — and buys
 * something real in exchange: a label sheet is `formats: ['pdf']` with nothing
 * to say in HTML, on `receipt`-adjacent die-cut stock rather than a page, and
 * `coverage: 'ascii'` where the invoices provider is `winansi`. Those three
 * fields are on the KIND rather than on the contract precisely because this
 * implementation disagreed with the other one about all three. A second
 * implementation that agreed about everything would have proved nothing.
 *
 * ── THE REFUSAL COMES BEFORE THE WRITER ────────────────────────────────────
 *
 * `renderLabelSheet` drops what Helvetica cannot draw and says how much went
 * (`latinOnly`) — which is right for a sheet somebody is looking at, and wrong
 * for bytes an engine files against a record. So the coverage check runs
 * FIRST and the sheet is never written: a caller gets `LATIN_ONLY` naming the
 * glyphs, not a label with a hole in the reference (34 D6).
 */

import {
  DOCUMENT_LOCALE_IDS,
  type DocumentError,
  type DocumentKind,
  type DocumentOutline,
  type DocumentRenderer,
  type LocalizedText,
  type RenderInput,
  type RenderedDocument,
} from '@adminium/add-on-host/contracts';

import { SYMBOLOGIES, codeRefusal, symbologyOf, type AssignedCode, type Symbology } from './codes.ts';
import { MAX_LABELS } from './geometry.ts';
import {
  labelSheetFilename,
  renderLabelSheet,
  undrawnCharacters,
  type SheetFacts,
} from './sheet.ts';

/** The one kind this add-on renders. */
export const LABEL_SHEET_KIND = 'label-sheet';

/**
 * The eight-locale records, written out rather than generated.
 *
 * `i18n/strings.ts` holds this add-on's UI copy and is the right home for
 * anything a person reads inside the add-on. These are different: they are
 * read by ADMINIUM's Studio, in the profile editor, where this package's
 * bundle is not loaded and its `t()` does not exist. The contract's answer is
 * that the provider carries them itself (34 D14), so they live beside the
 * provider.
 */
const LABELS: Readonly<Record<string, LocalizedText>> = {
  kind: {
    'en-US': 'Label sheet',
    'de-DE': 'Etikettenbogen',
    'fr-FR': 'Feuille d’étiquettes',
    'cs-CZ': 'Arch štítků',
    'da-DK': 'Etiketark',
    'zh-CN': '标签纸',
    'zh-TW': '標籤紙',
    'ar-EG': 'ورقة ملصقات',
  },
  sku: {
    'en-US': 'Row key',
    'de-DE': 'Zeilenschlüssel',
    'fr-FR': 'Clé de ligne',
    'cs-CZ': 'Klíč řádku',
    'da-DK': 'Rækkenøgle',
    'zh-CN': '行标识',
    'zh-TW': '列識別碼',
    'ar-EG': 'مفتاح السطر',
  },
  symbology: {
    'en-US': 'Symbology',
    'de-DE': 'Symbologie',
    'fr-FR': 'Symbologie',
    'cs-CZ': 'Symbolika',
    'da-DK': 'Symbologi',
    'zh-CN': '码制',
    'zh-TW': '碼制',
    'ar-EG': 'نظام الترميز',
  },
  symbologyHelp: {
    'en-US': 'Either `ean13` or `code128`. Left unmapped, the number decides: thirteen digits are EAN-13, anything else Code 128.',
    'de-DE': 'Entweder `ean13` oder `code128`. Ohne Zuordnung entscheidet die Nummer: dreizehn Ziffern sind EAN-13, alles andere Code 128.',
    'fr-FR': 'Soit `ean13`, soit `code128`. Sans correspondance, le numéro décide : treize chiffres donnent EAN-13, tout le reste Code 128.',
    'cs-CZ': 'Buď `ean13`, nebo `code128`. Bez přiřazení rozhodne číslo: třináct číslic je EAN-13, cokoli jiného Code 128.',
    'da-DK': 'Enten `ean13` eller `code128`. Uden tilknytning afgør nummeret det: tretten cifre er EAN-13, alt andet Code 128.',
    'zh-CN': '`ean13` 或 `code128`。不映射时由号码决定：十三位数字为 EAN-13，其他为 Code 128。',
    'zh-TW': '`ean13` 或 `code128`。不對應時由號碼決定：十三位數字為 EAN-13，其他為 Code 128。',
    'ar-EG': 'إما `ean13` أو `code128`. بدون ربط يحدد الرقم ذلك: ثلاثة عشر رقماً تعني EAN-13، وأي شيء آخر Code 128.',
  },
  code: {
    'en-US': 'Number',
    'de-DE': 'Nummer',
    'fr-FR': 'Numéro',
    'cs-CZ': 'Číslo',
    'da-DK': 'Nummer',
    'zh-CN': '号码',
    'zh-TW': '號碼',
    'ar-EG': 'الرقم',
  },
  codeHelp: {
    'en-US': 'The number the shop already owns — map the column that holds it, such as a menu item’s barcode. Nothing here allocates one.',
    'de-DE': 'Die Nummer, die dem Geschäft bereits gehört — ordnen Sie die Spalte zu, die sie enthält, etwa den Barcode eines Artikels. Hier wird keine vergeben.',
    'fr-FR': 'Le numéro que la boutique possède déjà — associez la colonne qui le contient, comme le code-barres d’un article. Rien ici n’en attribue.',
    'cs-CZ': 'Číslo, které dílna už má — přiřaďte sloupec, ve kterém je, například čárový kód položky. Nic zde žádné nepřiděluje.',
    'da-DK': 'Det nummer, butikken allerede har — tilknyt den kolonne, der rummer det, fx en vares stregkode. Intet her tildeler et.',
    'zh-CN': '店铺已有的号码——映射存放它的列，例如菜单项的条码。这里不会分配号码。',
    'zh-TW': '店家已有的號碼——對應存放它的欄，例如菜單項的條碼。這裡不會配發號碼。',
    'ar-EG': 'الرقم الذي يملكه المحل بالفعل — اربط العمود الذي يحمله، مثل باركود صنف في القائمة. لا شيء هنا يصدر رقماً.',
  },
  entity: {
    'en-US': 'What the row is',
    'de-DE': 'Was die Zeile ist',
    'fr-FR': 'Ce qu’est la ligne',
    'cs-CZ': 'Co řádek je',
    'da-DK': 'Hvad rækken er',
    'zh-CN': '这一行是什么',
    'zh-TW': '這一列是什麼',
    'ar-EG': 'ما هو السطر',
  },
  entityHelp: {
    'en-US': 'Printed small above the reference — part, piece, tray.',
    'de-DE': 'Klein über der Referenz gedruckt — Teil, Stück, Schale.',
    'fr-FR': 'Imprimé en petit au-dessus de la référence — pièce, unité, plateau.',
    'cs-CZ': 'Vytištěno malým písmem nad odkazem — díl, kus, podnos.',
    'da-DK': 'Trykt lille over referencen — del, stykke, bakke.',
    'zh-CN': '以小字印在编号上方——部件、单件、托盘。',
    'zh-TW': '以小字印在編號上方——零件、單件、托盤。',
    'ar-EG': 'يُطبع بخط صغير فوق المرجع — جزء، قطعة، صينية.',
  },
  reference: {
    'en-US': 'Reference',
    'de-DE': 'Referenz',
    'fr-FR': 'Référence',
    'cs-CZ': 'Odkaz',
    'da-DK': 'Reference',
    'zh-CN': '编号',
    'zh-TW': '編號',
    'ar-EG': 'المرجع',
  },
  count: {
    'en-US': 'How many labels',
    'de-DE': 'Wie viele Etiketten',
    'fr-FR': 'Combien d’étiquettes',
    'cs-CZ': 'Kolik štítků',
    'da-DK': 'Hvor mange etiketter',
    'zh-CN': '标签数量',
    'zh-TW': '標籤數量',
    'ar-EG': 'عدد الملصقات',
  },
  countHelp: {
    'en-US': 'Left unmapped, one label — or the number the request asks for. At most 240, which is ten sheets.',
    'de-DE': 'Ohne Zuordnung ein Etikett — oder so viele, wie die Anfrage nennt. Höchstens 240, also zehn Bogen.',
    'fr-FR': 'Sans correspondance, une étiquette — ou le nombre que la demande indique. Au plus 240, soit dix feuilles.',
    'cs-CZ': 'Bez přiřazení jeden štítek — nebo tolik, kolik žádost uvádí. Nejvýše 240, tedy deset archů.',
    'da-DK': 'Uden tilknytning én etiket — eller det antal, anmodningen beder om. Højst 240, altså ti ark.',
    'zh-CN': '不映射时打印一张标签，或按请求中的数量打印。最多 240 张，即十页。',
    'zh-TW': '不對應時列印一張標籤，或依請求中的數量列印。最多 240 張，即十頁。',
    'ar-EG': 'بدون ربط ملصق واحد — أو العدد الذي يطلبه الطلب. 240 على الأكثر، أي عشر أوراق.',
  },
  on: {
    'en-US': 'Day',
    'de-DE': 'Tag',
    'fr-FR': 'Jour',
    'cs-CZ': 'Den',
    'da-DK': 'Dag',
    'zh-CN': '日期',
    'zh-TW': '日期',
    'ar-EG': 'اليوم',
  },
};

const LABEL_SHEET: DocumentKind = {
  id: LABEL_SHEET_KIND,
  label: LABELS.kind!,
  // No HTML. A label sheet is a die-cut physical stock with nothing to say in
  // a browser window, which is why `formats` is per kind and not a constant.
  formats: ['pdf'],
  paper: ['a4'],
  // ASCII 32..126 — exactly what Code 128 set B carries and what the base-14
  // fonts draw without a metrics table (`sheet.ts:100-116`).
  coverage: 'ascii',
};

const OUTLINE: DocumentOutline = {
  slots: [
    { id: 'sku', label: LABELS.sku!, type: 'text', required: true },
    /*
     * `text`, not an enum, because the outline vocabulary has no enum — nine
     * slot types and none of them is a closed set. Mapping is column-to-slot,
     * and a column holding one of two words is a text column; the two words
     * are named in `help`, which is what `help` is for, and `factsFrom`
     * refuses anything else as `INVALID_SUBJECT` rather than guessing.
     */
    /*
     * OPTIONAL since a host's own barcode column became a source: a till's
     * `menu_items.barcode` holds the number and nothing says which symbology
     * it is. Left unmapped, the number's own shape decides (`symbologyOf`).
     */
    {
      id: 'symbology',
      label: LABELS.symbology!,
      help: LABELS.symbologyHelp!,
      type: 'text',
      required: false,
    },
    { id: 'code', label: LABELS.code!, help: LABELS.codeHelp!, type: 'text', required: true },
    // Optional: a shelf label for a menu item names the item, and a shop that
    // maps no word for what the row is gets a label without that small line.
    { id: 'entity', label: LABELS.entity!, help: LABELS.entityHelp!, type: 'text', required: false },
    { id: 'reference', label: LABELS.reference!, type: 'text', required: true },
    // Optional, and one when nothing fills it: a till asks for a shelf's
    // worth in its request, and a row keeps no count of its own.
    { id: 'count', label: LABELS.count!, help: LABELS.countHelp!, type: 'number', required: false },
    // The shop's own day. `default: 'now'` is how the engine knows to fill it
    // from `subject.now` rather than leaving an operator to map a column that
    // does not exist on their table.
    { id: 'on', label: LABELS.on!, type: 'date', required: true, default: 'now' },
  ],
};

/** Everything the writer needs, or the reason it cannot have it. */
function factsFrom(input: RenderInput): SheetFacts | DocumentError {
  const { fields } = input.subject;
  for (const slot of OUTLINE.slots) {
    if (!slot.required || slot.default !== undefined) continue;
    const value = fields[slot.id];
    if (value === undefined || value === null || value === '') {
      return { code: 'MISSING_SLOT', detail: `'${slot.id}' has no value` };
    }
  }

  /*
   * The code goes through `codeRefusal` rather than being trusted: it is the
   * one field whose shape this add-on can actually check — a check digit, a
   * length, a character set — and a sheet drawn from an invalid number is a
   * sheet of unscannable stickers somebody only finds out about at the shelf.
   *
   * The refusal's `why` is carried into `detail` verbatim. The engine has no
   * copy for this add-on's seven refusal variants and should not invent any;
   * the tag is what an operator can search for and what the settings panel
   * already renders a sentence from.
   */
  const code = String(fields.code).trim();
  const given = fields.symbology;
  const symbology = (given === undefined || given === null || given === '' ? symbologyOf(code) : String(given)) as Symbology;
  if (!SYMBOLOGIES.includes(symbology)) {
    return {
      code: 'INVALID_SUBJECT',
      detail: `'symbology' is '${String(fields.symbology)}', not one of ${SYMBOLOGIES.join(', ')}`,
    };
  }

  const refusal = codeRefusal(symbology, code);
  if (refusal !== undefined) {
    return { code: 'INVALID_SUBJECT', detail: `'code' was refused: ${refusal.why}` };
  }
  const assigned: AssignedCode = { sku: String(fields.sku), symbology, code };

  const wanted = Number(fields.count ?? 1);
  return {
    assigned,
    entity: fields.entity === undefined || fields.entity === null ? '' : String(fields.entity),
    reference: String(fields.reference),
    count: Number.isFinite(wanted) ? Math.min(Math.max(Math.trunc(wanted), 1), MAX_LABELS) : 1,
    // The shop's day, from the subject. Never a clock — that is what makes two
    // renders of one subject the same bytes (25 D12).
    on: (fields.on === undefined || fields.on === null || fields.on === ''
      ? input.subject.now.iso
      : String(fields.on)
    ).slice(0, 10),
  };
}

export class LabelSheetRenderer implements DocumentRenderer {
  readonly key = 'barcode-labels';

  kinds(): readonly DocumentKind[] {
    return [LABEL_SHEET];
  }

  describe(kind: string): DocumentOutline {
    if (kind !== LABEL_SHEET_KIND) throw new Error(`unknown document kind: ${kind}`);
    return OUTLINE;
  }

  render(input: RenderInput): Promise<readonly RenderedDocument[] | DocumentError> {
    if (input.kind !== LABEL_SHEET_KIND) {
      return Promise.resolve({
        code: 'UNSUPPORTED_KIND',
        detail: `this add-on draws '${LABEL_SHEET_KIND}' and nothing else`,
      });
    }

    const facts = factsFrom(input);
    if ('code' in facts) return Promise.resolve(facts);

    // BEFORE the writer, always. `renderLabelSheet` would drop these
    // characters and print the rest.
    const dropped = undrawnCharacters(facts);
    if (dropped.length > 0) {
      return Promise.resolve({
        code: 'LATIN_ONLY',
        detail: 'a label sheet is drawn in the base-14 fonts, which are ASCII only',
        dropped,
      });
    }

    if (!input.formats.includes('pdf')) return Promise.resolve([]);

    /*
     * `renderLabelSheet` returns a STRING, and every byte of it is ASCII by
     * construction — which is the premise its cross-reference offsets rest on
     * (`sheet.ts:392-397`) and the reason the refusal above is not optional.
     * With that premise held, one character is one byte and `charCodeAt` is
     * an exact encoder rather than a hopeful one.
     */
    const sheet = renderLabelSheet(facts);
    return Promise.resolve([
      {
        format: 'pdf',
        filename: labelSheetFilename(facts.assigned),
        mediaType: 'application/pdf',
        bytes: Uint8Array.from(sheet, (character) => character.charCodeAt(0)),
        locale: input.subject.locale,
        warnings: [],
      },
    ]);
  }
}

/**
 * The default export the engine loads. Every locale id is re-exported beside
 * it so a fixture in another tree can build an eight-locale record without
 * importing the contract package twice.
 */
export default new LabelSheetRenderer();

export { DOCUMENT_LOCALE_IDS };
