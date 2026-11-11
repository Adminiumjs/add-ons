/**
 * A STAND-IN FOR ADMINIUM'S PUBLIC API, OVER THE SAMPLE ROWS.
 *
 * The editor's tests and its dev page run it against this: the samples of
 * both shops (`src/testing/samples.ts`), served for one app at a time as the
 * add-on's public entries in manifest.json serve them (each app's own rows,
 * through each entry's filters, with only the columns it selects), and a
 * designs table held in memory, with an own link per design and the codes an
 * order names. It records every call, so a
 * test can say what the editor asked for.
 *
 * It is not Adminium: what a real server answers is proved by the walk on a
 * real engine.
 */
import { sampleTables, served, type Tables } from '../../testing/samples.ts';
import { designFromRow, type CatalogueRows, type CustomiserApi, type DesignData, type HeldSession, type Row, type SavedDesign } from '../api.ts';

export interface StubCall {
  call: 'catalogue' | 'create' | 'change' | 'remove' | 'openLink' | 'reopen' | 'byCodes' | 'upload' | 'file';
  args: unknown[];
}

export interface Stub {
  api: CustomiserApi;
  calls: StubCall[];
  /** Every design saved, by id, with the address it was saved with. */
  designs: Map<string, Row & { email: string | null; link: string }>;
  tables: Tables;
  /** Make the next save fail with this error. */
  failNext: (error: unknown) => void;
  /** Make the next upload fail with this error (a refusal the server gives). */
  failNextUpload: (error: unknown) => void;
  /** The files sent, by the id the upload answered. */
  files: Map<string, Blob>;
  /** Hold every upload until the answer is let go: a file seen on its way. */
  holdUploads: () => () => void;
  /** The ids of the sample rows, by what they are. */
  ids: { coasters: number; nook: number; keyring: number; board: number; cards: number; flyers: number; ring: number; twoLines: number; harbour: number; photo: number };
}

let codes = 0;
const code = (prefix: string): string => `${prefix}${String(++codes).padStart(16 - prefix.length, '0')}`;

/** What a test may change in what the shop is served: its fonts and settings, and the columns of a table its entry does not serve (one an earlier version opened). */
export interface StubOptions {
  fonts?: Row[];
  settings?: Row[];
  notServed?: Readonly<Record<string, readonly string[]>>;
}

export function stubApi(app: 'maker' | 'printing', options: StubOptions = {}): Stub {
  const tables = sampleTables();
  const calls: StubCall[] = [];
  const designs = new Map<string, Row & { email: string | null; link: string }>();
  for (const row of tables['designs'] ?? []) if (row['app'] === app) designs.set(String(row['id']), { ...row, email: null, link: code('LK') });
  let fail: unknown = null;
  let failUpload: unknown = null;
  let held: Promise<void> | null = null;
  const files = new Map<string, Blob>();
  let next = 5000;
  const failing = (): void => {
    if (fail === null) return;
    const error = fail;
    fail = null;
    throw error;
  };
  const session = (id: string): HeldSession => ({ token: `session-${id}`, level: 'verified', expiresAt: Date.now() + 3_600_000 });
  const idOf = (name: string, table: string): number => Number((tables[table] ?? []).find((one) => one['name'] === name)?.['id']);
  const api: CustomiserApi = {
    async catalogue(base) {
      calls.push({ call: 'catalogue', args: [base] });
      // Every table as the add-on's public entries serve it to this shop's visitor: its rows, its filters, its columns.
      const read = (table: string): Row[] => served(table, tables[table] ?? [], app, options.notServed?.[table]);
      const bases = read('bases').filter((one) => String(one['id']) === String(base));
      // With the preview picture's address a test gave the row, as `api.ts` adds it from the picture.
      const pictured = (one: Row): Row => {
        const url = (tables['ready_designs'] ?? []).find((row) => row['id'] === one['id'])?.['preview_url'];
        return url === undefined ? one : { ...one, preview_url: url };
      };
      const ready = read('ready_designs').filter((one) => String(one['base_id']) === String(base)).map(pictured);
      const fonts = served('fonts', options.fonts ?? [
        { id: 1, family: 'Cormorant Garamond', name: 'Cormorant Garamond', file: null },
        { id: 2, family: 'Manrope', name: 'Manrope', file: null },
        { id: 3, family: 'Caveat', name: 'Caveat', file: null },
        { id: 4, family: 'Zilla Slab', name: 'Zilla Slab', file: null },
        { id: 5, family: 'Oswald', name: 'Oswald', file: null },
        { id: 6, family: 'Archivo', name: 'Archivo', file: null },
        { id: 7, family: 'Libre Baskerville', name: 'Libre Baskerville', file: null },
        { id: 8, family: 'DM Serif Display', name: 'DM Serif Display', file: null },
      ], app);
      const rows: CatalogueRows = {
        bases,
        pieces: read('base_pieces').filter((one) => String(one['base_id']) === String(base)),
        areas: read('base_areas').filter((one) => String(one['base_id']) === String(base)),
        ready,
        parts: read('ready_parts').filter((one) => ready.some((r) => r['id'] === one['ready_design_id'])),
        fonts,
        palettes: read('palettes'),
        colours: read('palette_colours'),
        features: read('features'),
        settings: served('settings', options.settings ?? [], app),
      };
      return structuredClone(rows);
    },
    async fontUrl() {
      return null;
    },
    async create(design: DesignData, email, files = {}) {
      calls.push({ call: 'create', args: [structuredClone(design), email, files] });
      failing();
      const id = String(++next);
      const row = { id, app, code: code('CZ'), format: 1, base_id: design.base_id, ready_design_id: design.ready_design_id, values: structuredClone(design.values), state: 'draft', updated_at: new Date().toISOString(), email, link: code('LK'), ...files };
      designs.set(id, row);
      return { ...designFromRow(row, session(id)), files: { ...files }, link: row.link };
    },
    async change(design: SavedDesign, values, files = {}) {
      calls.push({ call: 'change', args: [design.id, structuredClone(values), files] });
      failing();
      const row = designs.get(String(design.id));
      if (row === undefined || design.session === null) throw Object.assign(new Error('not found'), { code: 'PUBLIC_REF_NOT_FOUND' });
      if (row['state'] !== 'draft') throw Object.assign(new Error('refused'), { code: 'PUBLIC_WRITE_REFUSED' });
      Object.assign(row, { values: structuredClone(values), updated_at: new Date().toISOString(), ...files });
      return { ...designFromRow(row, design.session), code: design.code, link: design.link ?? null };
    },
    async remove(design: SavedDesign) {
      calls.push({ call: 'remove', args: [design.id] });
      failing();
      const row = designs.get(String(design.id));
      // An ordered design answers as one that is not there, as the server's own link does.
      if (row === undefined || design.session === null || row['state'] !== 'draft') throw Object.assign(new Error('not found'), { code: 'PUBLIC_REF_NOT_FOUND' });
      designs.delete(String(design.id));
    },
    async openLink(token) {
      calls.push({ call: 'openLink', args: [token] });
      const row = [...designs.values()].find((one) => one.link === token);
      if (row === undefined) return 'unknown';
      return { ...designFromRow(row, session(String(row['id']))), link: token };
    },
    async reopen(held) {
      calls.push({ call: 'reopen', args: [held.token] });
      const row = designs.get(held.token.replace('session-', ''));
      return row === undefined ? null : designFromRow(row, held);
    },
    async byCodes(list) {
      calls.push({ call: 'byCodes', args: [[...list]] });
      return list.flatMap((one) => {
        const row = [...designs.values()].find((design) => design['code'] === one);
        if (row === undefined) return [];
        const { code: _code, ...rest } = row;
        void _code;
        return [{ ...designFromRow(rest, null), code: one }];
      });
    },
    async upload(column, file, name) {
      calls.push({ call: 'upload', args: [column, name] });
      if (held !== null) await held;
      if (failUpload !== null) {
        const error = failUpload;
        failUpload = null;
        throw error;
      }
      const kind = /\.svg$/i.test(name) ? 'svg' : /\.pdf$/i.test(name) ? 'pdf' : /\.png$/i.test(name) ? 'png' : 'jpg';
      const id = `up_${String(++next)}`;
      files.set(id, file);
      return { id, name, size: file.size, kind };
    },
    async file(design, column) {
      calls.push({ call: 'file', args: [design.id, column] });
      const row = designs.get(String(design.id));
      const id = row?.[column];
      return design.session === null || typeof id !== 'string' ? null : (files.get(id) ?? null);
    },
  };
  return {
    api,
    calls,
    designs,
    tables,
    failNext: (error) => {
      fail = error;
    },
    failNextUpload: (error) => {
      failUpload = error;
    },
    holdUploads: () => {
      let release = (): void => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return () => release();
    },
    files,
    ids: {
      coasters: idOf('Engraved walnut coasters', 'bases'),
      nook: idOf('The Little Bookshop', 'bases'),
      keyring: idOf('Name keyring', 'bases'),
      board: idOf('Walnut cutting board', 'bases'),
      cards: idOf('Business cards', 'bases'),
      flyers: idOf('A5 flyers', 'bases'),
      ring: Number((tables['ready_designs'] ?? []).find((one) => one['name'] === 'Ring')?.['id']),
      twoLines: idOf('Two lines', 'ready_designs'),
      harbour: idOf('Harbour', 'ready_designs'),
      photo: idOf('Photo back', 'ready_designs'),
    },
  };
}
