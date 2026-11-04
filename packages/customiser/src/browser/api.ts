/**
 * HOW THE CUSTOMER'S EDITOR TALKS TO ADMINIUM: through the shop app's own
 * public clients, and nothing else.
 *
 * The editor never makes a client of its own and never carries a second copy
 * of `@adminium/public-client`: the app already has one in its bundle, built
 * with its customer key, and hands it in. It hands in a way to make a client
 * of the add-on's link key too, one per saved design, since a client holds one
 * session at a time and a customer may have several designs open.
 *
 * What it reaches, each through the add-on's own public entries:
 *
 * - the shop's catalogue (bases, areas, ready-made designs, parts, palettes,
 *   colours, priced features, fonts) through the app's key, every visitor;
 * - a new design, saved through the app's key behind the human check: the
 *   reply is the design's code and its own link, once;
 * - a saved design changed in place, through its own link with the session the
 *   save (or the e-mailed link) opened;
 * - an ordered design read by its code, with the session the app's order
 *   lookup holds on the same client, the code in a header.
 *
 * The types here are the few calls the editor makes, written out so a client
 * of any version that has them fits.
 */
import type { DesignValues } from '../rules/index.ts';

export type Row = Record<string, unknown>;

/** The add-on's public entries, as each app's key and the link key serve them. */
export const REFS = {
  bases: 'customiser_bases',
  pieces: 'customiser_base_pieces',
  areas: 'customiser_base_areas',
  ready: 'customiser_ready_designs',
  parts: 'customiser_ready_parts',
  fonts: 'customiser_fonts',
  palettes: 'customiser_palettes',
  colours: 'customiser_palette_colours',
  features: 'customiser_features',
  designs: 'customiser_designs',
  own: 'customiser_designs_claimed',
  byCode: 'customiser_designs_unlocked',
} as const;

/** A session a client holds, as the public client hands it over. */
export interface HeldSession {
  token: string;
  level: 'lookup' | 'verified';
  expiresAt: number;
}

/** The calls of `@adminium/public-client` the editor makes. */
export interface ClientLike {
  config: () => Promise<{ assets?: string; refs: Record<string, { assets?: string[] }> }>;
  list: <T = Row>(ref: string, options?: { where?: unknown; limit?: number; code?: string; signal?: AbortSignal }) => Promise<{ data: T[] }>;
  createWithRank: <T = Row>(ref: string, values: Row) => Promise<{ data: T; link: { key: string; token: string; session: string | null; expiresAt: number | null } | null }>;
  update: <T = Row>(ref: string, id: string, values: Row) => Promise<T>;
  openShared: (token: string) => Promise<'opened' | 'unknown' | 'closed'>;
  adoptSession: (session: { token: string; expiresAt: number; level?: 'lookup' | 'verified' }) => void;
  session: () => HeldSession | null;
  upload?: (ref: string, column: string, file: Blob, name?: string) => Promise<{ id: string; name: string; size: number; kind: string }>;
}

export interface CustomiserClients {
  /** The app's client, of its customer key. */
  shop: ClientLike;
  /** A new client of the add-on's link key (`customiser-link`), each call a fresh one. */
  link: () => ClientLike;
  /** The address the clients talk to, for the shop's font files. */
  baseUrl: string;
}

/** A design as the editor holds it: what makes it up, and where it is kept once saved. */
export interface DesignData {
  base_id: string | number;
  ready_design_id: string | number | null;
  values: DesignValues;
}

/** A design kept on the server: its row's key, its code (an order line names it by this), and the session that may change it. */
export interface SavedDesign extends DesignData {
  id: string | number;
  /** The design's code, as the save answered it; null for a design opened by its link, which never shows its code. */
  code: string | null;
  state: 'draft' | 'ordered';
  updatedAt: string | null;
  /** The session of its own link, while this browser holds one. */
  session: HeldSession | null;
  /** The design's file columns that hold a file (a logo, a photo), by column. */
  files: Readonly<Record<string, string>>;
}

/** The catalogue rows the editor reads, by table. */
export interface CatalogueRows {
  bases: Row[];
  pieces: Row[];
  areas: Row[];
  ready: Row[];
  parts: Row[];
  fonts: Row[];
  palettes: Row[];
  colours: Row[];
  features: Row[];
}

/** What the editor asks of Adminium. A test, or the dev page, hands in its own. */
export interface CustomiserApi {
  /** Every row of the shop's catalogue for one base. */
  catalogue: (base: string | number, signal?: AbortSignal) => Promise<CatalogueRows>;
  /** The address of a font's file, or null when the shop has not uploaded one. */
  fontUrl: (font: Row) => Promise<string | null>;
  /** Save a new design; the e-mail is where its link is sent (none: nothing is sent). */
  create: (design: DesignData, email: string | null, files?: Readonly<Record<string, string>>) => Promise<SavedDesign>;
  /** Change a saved draft in place, through its own link. */
  change: (design: SavedDesign, values: DesignValues, files?: Readonly<Record<string, string>>) => Promise<SavedDesign>;
  /** Open a design by the code of its own link (the e-mailed link's fragment). */
  openLink: (token: string) => Promise<SavedDesign | 'unknown' | 'closed'>;
  /** Read a design again with a session this browser kept; null when the session no longer opens it. */
  reopen: (session: HeldSession) => Promise<SavedDesign | null>;
  /** Read the designs an order names, by their codes, with the session the app's order lookup holds. */
  byCodes: (codes: readonly string[]) => Promise<SavedDesign[]>;
  /** Send one file for a design's file column; the answer is what the next save names in that column. Null when this Adminium takes none. */
  upload: ((column: string, file: Blob, name: string, session: HeldSession | null) => Promise<{ id: string; name: string; size: number; kind: string }>) | null;
}

/** The design's own file columns. */
export const FILE_COLUMNS = ['logo_file', 'photo_file'] as const;

const asKey = (value: unknown): string | number => (typeof value === 'number' ? value : String(value ?? ''));
const keyOrNull = (value: unknown): string | number | null => (value === null || value === undefined || value === '' ? null : asKey(value));

function valuesOf(raw: unknown): DesignValues {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : raw;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { parts: {} };
  const parts = (value as Record<string, unknown>)['parts'];
  return { ...(value as DesignValues), parts: typeof parts === 'object' && parts !== null ? (parts as DesignValues['parts']) : {} };
}

/** A design row as an entry answers it, read the same way whichever entry did. */
export function designFromRow(row: Row, session: HeldSession | null): SavedDesign {
  return {
    id: asKey(row['id']),
    code: typeof row['code'] === 'string' ? row['code'] : null,
    base_id: asKey(row['base_id']),
    ready_design_id: keyOrNull(row['ready_design_id']),
    values: valuesOf(row['values']),
    state: row['state'] === 'ordered' ? 'ordered' : 'draft',
    updatedAt: typeof row['updated_at'] === 'string' ? row['updated_at'] : null,
    session,
    files: Object.fromEntries(FILE_COLUMNS.filter((column) => typeof row[column] === 'string' && row[column] !== '').map((column) => [column, String(row[column])])),
  };
}

/** The Adminium file a column's value names: a bare id, or its content address. */
const FILE = /^(?:file_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$|.*\/api\/v1\/files\/(file_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26})\/content\/?(?:\?.*)?$)/;

/**
 * The address of a product asset, the way the public client builds it
 * (`assetUrls`): written here so the editor needs only the client's calls.
 */
export function assetAddress(baseUrl: string, assets: string | undefined, served: readonly string[], ref: string, id: string | number, column: string, value: unknown): string | null {
  if (assets === undefined || !served.includes(column) || typeof value !== 'string') return null;
  const match = FILE.exec(value.trim());
  if (match === null) return null;
  return `${baseUrl.replace(/\/+$/, '')}${assets}/${encodeURIComponent(ref)}/${encodeURIComponent(String(id))}/${encodeURIComponent(column)}/${match[1] ?? value.trim()}`;
}

/** The values a save writes: the design's data, and the files it names. */
const written = (design: DesignData, files: Readonly<Record<string, string>> = {}): Row => ({
  format: 1,
  base_id: design.base_id,
  ready_design_id: design.ready_design_id,
  values: design.values,
  ...files,
});

/** The editor's calls, made through the app's clients. */
export function customiserApi(clients: CustomiserClients): CustomiserApi {
  const { shop, link } = clients;
  const all = async (ref: string, where?: unknown, signal?: AbortSignal): Promise<Row[]> => {
    const out = await shop.list<Row>(ref, { ...(where === undefined ? {} : { where }), limit: 500, ...(signal === undefined ? {} : { signal }) });
    return out.data;
  };
  /** A client of the link key holding this session. */
  const holding = (session: HeldSession): ClientLike => {
    const client = link();
    client.adoptSession(session);
    return client;
  };
  const readOwn = async (client: ClientLike): Promise<SavedDesign | null> => {
    const rows = (await client.list<Row>(REFS.own, { limit: 1 })).data;
    return rows[0] === undefined ? null : designFromRow(rows[0], client.session());
  };
  return {
    async catalogue(base, signal) {
      const at = { column: 'base_id', op: 'eq', value: base };
      const [bases, pieces, areas, ready, fonts, palettes, colours, features] = await Promise.all([
        all(REFS.bases, { column: 'id', op: 'eq', value: base }, signal),
        all(REFS.pieces, at, signal),
        all(REFS.areas, at, signal),
        all(REFS.ready, at, signal),
        all(REFS.fonts, undefined, signal),
        all(REFS.palettes, undefined, signal),
        all(REFS.colours, undefined, signal),
        all(REFS.features, undefined, signal),
      ]);
      const parts = ready.length === 0 ? [] : await all(REFS.parts, { column: 'ready_design_id', op: 'in', value: ready.map((one) => one['id']) }, signal);
      return { bases, pieces, areas, ready, parts, fonts, palettes, colours, features };
    },
    async fontUrl(font) {
      const config = await shop.config();
      return assetAddress(clients.baseUrl, config.assets, config.refs[REFS.fonts]?.assets ?? [], REFS.fonts, asKey(font['id']), 'file', font['file']);
    },
    async create(design, email, files) {
      const out = await shop.createWithRank<Row>(REFS.designs, { ...written(design, files), ...(email === null ? {} : { email }) });
      const session = out.link?.session === null || out.link?.session === undefined ? null : { token: out.link.session, level: 'verified' as const, expiresAt: out.link.expiresAt ?? Date.now() + 86_400_000 };
      return { ...designFromRow({ ...out.data, base_id: design.base_id, ready_design_id: design.ready_design_id, values: design.values }, session), updatedAt: new Date().toISOString(), files: { ...(files ?? {}) } };
    },
    async change(design, values, files) {
      if (design.session === null) throw new Error('This design is not open on this device.');
      const client = holding(design.session);
      const row = await client.update<Row>(REFS.own, String(design.id), { ...written({ ...design, values }, files) });
      return { ...designFromRow({ ...row, values: row['values'] ?? values }, client.session() ?? design.session), code: design.code };
    },
    async openLink(token) {
      const client = link();
      const opened = await client.openShared(token);
      if (opened !== 'opened') return opened;
      return (await readOwn(client)) ?? 'unknown';
    },
    async reopen(session) {
      if (session.expiresAt <= Date.now()) return null;
      try {
        return await readOwn(holding(session));
      } catch {
        return null;
      }
    },
    async byCodes(codes) {
      const out: SavedDesign[] = [];
      for (const code of codes) {
        const rows = (await shop.list<Row>(REFS.byCode, { code, limit: 1 })).data;
        if (rows[0] !== undefined) out.push({ ...designFromRow(rows[0], null), code });
      }
      return out;
    },
    upload:
      shop.upload === undefined
        ? null
        : async (column, file, name, session) => {
            // With a design's own session the file goes through its link; before the first save, through the app's key.
            const client = session === null ? shop : holding(session);
            return client.upload!(session === null ? REFS.designs : REFS.own, column, file, name);
          },
  };
}
