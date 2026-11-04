/**
 * A 3MF FILE A SLICER OPENS: one object, one mesh, in millimetres.
 *
 * The core 3MF package: its content types, its relationships naming the
 * model part, and the model part (`3D/3dmodel.model`) holding the object's
 * corners and triangles and a build that places it once. Stored in a zip as
 * it is (`zip.ts`), so no packing library is needed; Adminium reads the file
 * by the same rules when it is kept on the design's version.
 */
import { zipStored } from './zip.ts';

export const MODEL_PART = '3D/3dmodel.model';
const CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

const TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n';
const RELS = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/${MODEL_PART}" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n`;

const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A coordinate to a ten-thousandth of a millimetre, no trailing noughts. */
const number = (value: number): string => String(Math.round(value * 10_000) / 10_000 + 0);

export interface ThreeMfInput {
  /** Corners in millimetres, three numbers each; triangles by corner, counter-clockwise seen from outside. */
  positions: ArrayLike<number>;
  index: ArrayLike<number>;
  /** The object's name and the file's title, as the slicer shows them. */
  name: string;
  title: string;
}

/** The model part's text. */
export function modelXml(input: ThreeMfInput): string {
  const parts: string[] = [`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${CORE}"><metadata name="Title">${escaped(input.title)}</metadata><metadata name="Application">Adminium Customiser</metadata><resources><object id="1" type="model" name="${escaped(input.name)}"><mesh><vertices>`];
  const p = input.positions;
  for (let i = 0; i + 2 < p.length; i += 3) parts.push(`<vertex x="${number(p[i]!)}" y="${number(p[i + 1]!)}" z="${number(p[i + 2]!)}"/>`);
  parts.push('</vertices><triangles>');
  const t = input.index;
  for (let i = 0; i + 2 < t.length; i += 3) parts.push(`<triangle v1="${String(t[i]!)}" v2="${String(t[i + 1]!)}" v3="${String(t[i + 2]!)}"/>`);
  parts.push('</triangles></mesh></object></resources><build><item objectid="1"/></build></model>\n');
  return parts.join('');
}

/** The 3MF's bytes. */
export function write3mf(input: ThreeMfInput): Uint8Array {
  const encoder = new TextEncoder();
  return zipStored([
    { name: '[Content_Types].xml', data: encoder.encode(TYPES) },
    { name: '_rels/.rels', data: encoder.encode(RELS) },
    { name: MODEL_PART, data: encoder.encode(modelXml(input)) },
  ]);
}
