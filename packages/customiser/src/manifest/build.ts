/**
 * THE MANIFEST, PUT TOGETHER.
 *
 * `scripts/manifest.mjs` writes what this returns to `manifest.json`, and
 * `manifest.test.ts` fails when the file is behind it. Nothing here reads a
 * clock or a file: the same call gives the same manifest every time.
 *
 * Left for the pieces that build them: the shop's pages and record panels
 * (`addOn.pages`, `addOn.panels`, `hostApi` and the `page:@…:view` grants), and the
 * design question (`provides`, `addOn.checker`). TODO(J1): `uploads` on the
 * designs entry. TODO(J10): the `svg` and `woff2` kinds, and `assets`.
 */
import { entries, LINK_KEY } from './entries.ts';
import { starterFontRows } from './fonts.ts';
import { tables } from './tables.ts';
import { DESCRIPTION, ROLE_NAMES } from './words.ts';

/** The add-on's key, its page ref, and the floor whose words it uses (an add-on's own entries on each app's key, expiry, links into it). */
export const KEY = 'customiser';
export const FLOOR = '0.3.43';
/** The package's version; `scripts/sync-manifest-versions.mjs` keeps the two equal at a release. */
export const VERSION = '1.0.15';

/** The shop's own tables: what the shop sets up, and the designer makes and changes. */
export const SHOP_TABLES = ['bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features'] as const;
/** What customers made: read by staff, never typed in by them. */
export const CUSTOMER_TABLES = ['designs', 'design_versions'] as const;

const grants = (table: string, actions: readonly string[]): string[] => actions.map((action) => `table:@${table}:${action}`);

function roles(): Record<string, unknown>[] {
  return [
    {
      key: 'designer',
      name: ROLE_NAMES.designer['en-US'],
      names: ROLE_NAMES.designer,
      permissions: [
        ...SHOP_TABLES.flatMap((table) => grants(table, ['read', 'create', 'update', 'delete'])),
        ...grants('designs', ['read', 'read_pii']),
        // A proof is a version the shop makes of a customer's design.
        ...grants('design_versions', ['read', 'read_pii', 'create', 'update']),
        ...grants('settings', ['read', 'update']),
      ],
    },
    {
      key: 'reader',
      name: ROLE_NAMES.reader['en-US'],
      names: ROLE_NAMES.reader,
      permissions: [...SHOP_TABLES.flatMap((table) => grants(table, ['read'])), ...CUSTOMER_TABLES.flatMap((table) => grants(table, ['read', 'read_pii'])), ...grants('settings', ['read'])],
    },
  ];
}

export function buildManifest(): Record<string, unknown> {
  return {
    kind: 'add-on',
    manifestVersion: 1,
    key: KEY,
    name: 'Customiser',
    version: VERSION,
    publisher: { id: 'adminium', name: 'Adminium' },
    license: 'AGPL-3.0-only',
    description: { key: 'addon.customiser.description', fallback: DESCRIPTION['en-US'] },
    categories: ['artwork'],
    compatibility: { minAdminiumVersion: FLOOR, requires: [] },
    requiredSchema: { prefixed: true, tables: tables() },
    roles: roles(),
    // The starter fonts, written once at install into an empty fonts table.
    seeds: [{ table: 'fonts', rows: starterFontRows() }],
    publicKeys: { [LINK_KEY]: {} },
    publicAccess: entries(),
    addOn: {
      /*
       * The two shop apps, at any version. The versions reworked around the
       * Customiser require it themselves, at the range they bundle; an older
       * version links nothing into it. A caret range here would refuse each
       * app's next minor until this add-on was released again.
       */
      attaches: [
        { app: 'maker', range: '*' },
        { app: 'printing', range: '*' },
      ],
      connect: { kind: 'none' },
      settingsTable: 'settings',
    },
  };
}
