/**
 * A MODEL TO PRINT, READ: the zip under a 3MF read from its directory with
 * caps, a 3MF's model in millimetres, an STL in text and in binary, and the
 * refusals (a renamed zip, too many entries, a damaged entry).
 */
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { is3mf, isStl, modelKindOf } from './sniff.ts';
import { PrintRefused, read3mf, readPrintModel, readStl, trianglesOf3mfModel } from './printModel.ts';
import { crc32, ZIP_MAX_ENTRIES, zipEntries, zipEntryBytes, ZipRefused, zipStored } from './zip.ts';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A zip whose entries may be deflated, written the long way round (the package's own writer only stores). */
function zipWith(files: readonly { name: string; data: Uint8Array; deflate?: boolean; lie?: number }[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const packed = file.deflate === true ? deflateRawSync(file.data) : Buffer.from(file.data);
    const size = file.lie ?? file.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(file.deflate === true ? 8 : 0, 8);
    local.writeUInt32LE(crc32(file.data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(file.deflate === true ? 8 : 0, 10);
    central.writeUInt32LE(crc32(file.data), 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

const TYPES = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const RELS = (target = '/3D/3dmodel.model') => `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="${target}" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

/** A 3MF model part of one box, `w × h × d` in the given unit, placed by the build. */
function boxModel(w: number, h: number, d: number, unit = 'millimeter', transform?: string): string {
  const v = [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0], [0, 0, d], [w, 0, d], [w, h, d], [0, h, d]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return `<?xml version="1.0"?><model unit="${unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${v.map((p) => `<vertex x="${String(p[0])}" y="${String(p[1])}" z="${String(p[2])}"/>`).join('')}</vertices><triangles>${t.map((one) => `<triangle v1="${String(one[0])}" v2="${String(one[1])}" v3="${String(one[2])}"/>`).join('')}</triangles></mesh></object></resources><build><item objectid="1"${transform === undefined ? '' : ` transform="${transform}"`}/></build></model>`;
}

const package3mf = (model: string, deflate = false): Uint8Array =>
  zipWith([
    { name: '[Content_Types].xml', data: text(TYPES) },
    { name: '_rels/.rels', data: text(RELS()) },
    { name: '3D/3dmodel.model', data: text(model), deflate },
  ]);

const box = (positions: ArrayLike<number>): number[] => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k]!, positions[i + k]!);
    max[k] = Math.max(max[k]!, positions[i + k]!);
  }
  return max.map((one, k) => Math.round((one - min[k]!) * 1000) / 1000);
};

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (caught) {
    if (caught instanceof PrintRefused || caught instanceof ZipRefused) return caught.problem;
    throw caught;
  }
  return 'read';
}

describe('the zip under a 3MF', () => {
  it('writes stored entries that read back with their checksums, local headers saying what the directory says', async () => {
    const files = [
      { name: 'a.txt', data: text('hello') },
      { name: 'dir/b.bin', data: new Uint8Array([0, 1, 2, 255]) },
    ];
    const zip = zipStored(files);
    const entries = zipEntries(zip);
    expect(entries.map((one) => [one.name, one.method, one.size])).toEqual([
      ['a.txt', 0, 5],
      ['dir/b.bin', 0, 4],
    ]);
    expect(new TextDecoder().decode(await zipEntryBytes(zip, entries[0]!))).toBe('hello');
    expect([...(await zipEntryBytes(zip, entries[1]!))]).toEqual([0, 1, 2, 255]);
    // The checksum is the zip's own: CRC-32 of "123456789" is cbf43926.
    expect(crc32(text('123456789')).toString(16)).toBe('cbf43926');
  });

  it('reads a deflated entry, and refuses one whose bytes are not what its directory says', async () => {
    const zip = zipWith([{ name: 'x.model', data: text('<model/>'.repeat(50)), deflate: true }]);
    expect(new TextDecoder().decode(await zipEntryBytes(zip, zipEntries(zip)[0]!))).toBe('<model/>'.repeat(50));
    const lying = zipWith([{ name: 'x.model', data: text('<model/>'.repeat(50)), deflate: true, lie: 10 }]);
    expect(await refusal(() => zipEntryBytes(lying, zipEntries(lying)[0]!))).toBe('damaged');
    const flipped = zipStored([{ name: 'x', data: text('abcdef') }]);
    flipped[32] = 'z'.charCodeAt(0);
    expect(await refusal(() => zipEntryBytes(flipped, zipEntries(flipped)[0]!))).toBe('damaged');
  });

  it('holds a zip to its caps before unpacking anything: 64 entries, 200 MB unpacked', async () => {
    const many = zipStored(Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, i) => ({ name: `f${String(i)}`, data: text('x') })));
    expect(await refusal(async () => zipEntries(many))).toBe('too-many');
    expect(zipEntries(zipStored(Array.from({ length: ZIP_MAX_ENTRIES }, (_, i) => ({ name: `f${String(i)}`, data: text('x') })))).length).toBe(64);
    const big = zipWith([{ name: 'big', data: text('x'), lie: 200 * 1024 * 1024 + 1 }]);
    expect(await refusal(async () => zipEntries(big))).toBe('too-big');
    expect(await refusal(async () => zipEntries(text('not a zip at all, just words')))).toBe('not-zip');
  });
});

describe('a 3MF', () => {
  it('is read from its model part, in millimetres, its build placements applied', async () => {
    const read = await read3mf(package3mf(boxModel(56, 24, 4)));
    expect(read.kind).toBe('3mf');
    expect(read.index?.length).toBe(36);
    expect(box(read.positions)).toEqual([56, 24, 4]);
    // A model drawn in centimetres is put in millimetres; a placement turned a quarter about z swaps x and y.
    expect(box((await read3mf(package3mf(boxModel(5.6, 2.4, 0.4, 'centimeter')))).positions)).toEqual([56, 24, 4]);
    expect(box((await read3mf(package3mf(boxModel(56, 24, 4, 'millimeter', '0 1 0 -1 0 0 0 0 1 10 20 30')))).positions)).toEqual([24, 56, 4]);
  });

  it('is read when its model part is deflated, as slicers write it', async () => {
    expect(box((await read3mf(package3mf(boxModel(10, 20, 30), true))).positions)).toEqual([10, 20, 30]);
  });

  it('follows its objects’ components with their placements', () => {
    const one = boxModel(10, 10, 10).replace('<object id="1"', '<object id="2"').replace('<build><item objectid="1"/></build>', '');
    const parent = one.replace('</resources>', '<object id="1" type="model"><components><component objectid="2"/><component objectid="2" transform="1 0 0 0 1 0 0 0 1 20 0 0"/></components></object></resources><build><item objectid="1"/></build>');
    const read = trianglesOf3mfModel(parent);
    expect(read.index?.length).toBe(72);
    expect(box(read.positions)).toEqual([30, 10, 10]);
  });

  it('refuses a zip renamed .3mf without a model part, and a model part naming corners it does not have', async () => {
    const renamed = zipWith([{ name: 'photo.jpg', data: text('not a model') }]);
    expect(is3mf(renamed)).toBe(false);
    expect(await refusal(() => read3mf(renamed))).toBe('not-model');
    expect(await refusal(() => read3mf(package3mf(boxModel(1, 1, 1).replace('v3="1"', 'v3="99"'))))).toBe('damaged');
    expect(await refusal(() => read3mf(package3mf(boxModel(1, 1, 1).replace(/<triangles>.*<\/triangles>/, '<triangles></triangles>'))))).toBe('empty');
    expect(await refusal(() => read3mf(zipStored(Array.from({ length: 65 }, (_, i) => ({ name: `3D/${String(i)}.model`, data: text('x') })))))).toBe('too-many');
  });

  it('is sniffed by the parts its directory names, never by its name', () => {
    const real = package3mf(boxModel(1, 1, 1));
    expect(is3mf(real)).toBe(true);
    expect(modelKindOf(real)).toBe('3mf');
    expect(modelKindOf(zipWith([{ name: '3D/3dmodel.model', data: text('<model/>') }]))).toBeNull();
  });
});

describe('an STL', () => {
  const ascii = `solid plate
facet normal 0 0 1
 outer loop
  vertex 0 0 4
  vertex 56 0 4
  vertex 56 24 4
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex 0 0 4
  vertex 56 24 4
  vertex 0 24 4
 endloop
endfacet
endsolid plate`;

  it('is read as text', async () => {
    const read = await readPrintModel(text(ascii));
    expect(read.kind).toBe('stl');
    expect(read.positions.length).toBe(18);
    expect(box(read.positions)).toEqual([56, 24, 0]);
  });

  it('is read as binary by its size, whatever its header says (a binary STL may start `solid`)', async () => {
    const bytes = new Uint8Array(84 + 2 * 50);
    bytes.set(text('solid but binary'), 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(80, 2, true);
    const corners = [0, 0, 0, 10, 0, 0, 10, 5, 0, 0, 0, 0, 10, 5, 0, 0, 5, 2];
    corners.forEach((value, i) => view.setFloat32(84 + Math.floor(i / 9) * 50 + 12 + (i % 9) * 4, value, true));
    expect(isStl(bytes)).toBe(true);
    const read = await readPrintModel(bytes);
    expect([...read.positions]).toEqual(corners);
  });

  it('is refused when it is neither', async () => {
    expect(await refusal(async () => readStl(text('just words')))).toBe('not-model');
    expect(await refusal(async () => readStl(text('solid empty\nendsolid empty')))).toBe('empty');
  });
});
