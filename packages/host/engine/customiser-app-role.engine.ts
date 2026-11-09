/**
 * AN APP'S OWN ROLE MAKES A CUSTOMISER PROOF, AS THE CUSTOMISER ALLOWS IT.
 *
 * The Customiser says, table by table, how far an app's role may go
 * (`appGrants`). A print shop's pre-press role takes what the README's "What
 * an app's role needs" lists, and with it, through the data and files routes
 * as itself: reads a customer's design with its words in clear, adds a proof
 * version, uploads the proof and sets it on the version, makes a production
 * file and attaches it, and removes it to make it again. An owner role that
 * takes the README's set-up grants (`ownSetUp`) reads and changes the
 * settings and adds, changes and removes on the set-up tables what the page
 * does, on its own app's rows alone: another app's base, font or new row is
 * refused, and the starter fonts (no app's) are read and changed, never
 * removed. Its ask to change a customer's design, and to read the postings,
 * is cut at install. A counter role that holds only the designs' read sees
 * the words masked and may make nothing.
 *
 * Run by `vitest.config.mjs` beside it, inside a built Adminium checkout
 * (`ADMINIUM_ENGINE`) with this repository built (`ADMINIUM_ADD_ONS_REPO`).
 * On every engine that run can reach.
 */
/* global describe, it, expect, beforeAll, afterAll */

type Doc = Record<string, unknown>;

const ENGINE = process.env['ADMINIUM_ENGINE']!;
const helpers = await import(`${ENGINE}/apps/server/test/app-add-ons.helpers.ts`);
const auth = await import(`${ENGINE}/apps/server/test/auth-helpers.ts`);
const legs = await import(`${ENGINE}/apps/server/test/invoicing-install.helpers.ts`);
const lane = await import(`${ENGINE}/apps/server/test/public-lane.helpers.ts`);
const kit = await import(`${ENGINE}/apps/server/test/add-ons/harness.ts`);
const meta = await import(`${ENGINE}/packages/meta/dist/index.js`);
const engine = await import(`${ENGINE}/packages/engine/dist/index.js`);

// The README's set-up grants, as the Customiser writes them out for an app.
const grantsFile = new URL('../../customiser/src/manifest/app-grants.ts', import.meta.url).pathname;
const { ownSetUp, SET_UP_TABLES } = (await import(grantsFile)) as { ownSetUp: (app: string, table: string) => Doc; SET_UP_TABLES: readonly string[] };

const CUSTOMISER = 'customiser';
const built = kit.builtAddOn(CUSTOMISER) as { version: string; manifest: Doc; files: Record<string, string> } | null;
const pk = { ref: 'id', type: 'int', role: 'pk' } as const;
const AT = '2026-11-01 10:00:00';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const READS = ['bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features'];

/** A print shop whose order lines link to the Customiser's designs, with a pre-press role and a counter role. */
function printShop(): Doc {
  return {
    manifestVersion: 1,
    publisher: { id: 'adminium', name: 'Adminium' },
    license: 'MIT',
    kind: 'app',
    key: 'printing',
    name: 'Print shop',
    version: '1.0.0',
    description: { key: 'mft.printing.desc', fallback: 'A shop.' },
    categories: ['commerce'],
    compatibility: { minAdminiumVersion: '0.3.47', engines: ['postgres', 'mysql', 'sqlite'] },
    requiredSchema: {
      prefixed: true,
      tables: [
        {
          ref: 'order_lines',
          columns: [pk, { ref: 'lettering', type: 'text', maxLength: 80, nullable: true }, { ref: 'design_id', type: 'int', nullable: true, rules: { addOnLink: { addOn: CUSTOMISER, table: 'designs' } } }],
        },
      ],
    },
    pages: [{ ref: 'printing-lines', template: 'page-crud', title: { key: 't', fallback: 'Lines' }, nav: { group: 'manage', icon: 'list', order: 1 }, bindings: { main: 'order_lines' } }],
    frontends: [{ side: 'staff', kind: 'spa', entry: 'index.html' }],
    addOns: { requires: [{ key: CUSTOMISER, range: '^1.0.0', reason: { 'en-US': 'Customers make their cards their own.' } }] },
    roles: [
      {
        key: 'prepress',
        name: 'Pre-press',
        screensOnly: true,
        permissions: ['app:@:staff', 'table:@order_lines:read', 'page:@customiser-line:view', 'page:@customiser:view'],
        tables: [
          { addOn: CUSTOMISER, table: 'designs', actions: ['read', 'read_pii'] },
          { addOn: CUSTOMISER, table: 'design_versions', actions: ['read', 'read_pii', 'create', 'update'] },
          { addOn: CUSTOMISER, table: 'version_files', actions: ['read', 'create', 'update', 'delete'] },
          ...READS.map((table) => ({ addOn: CUSTOMISER, table, actions: ['read'] })),
        ],
      },
      {
        key: 'owner',
        name: 'Owner',
        screensOnly: true,
        permissions: ['app:@:staff', 'table:@order_lines:read', 'page:@customiser:view'],
        tables: [
          { addOn: CUSTOMISER, table: 'settings', actions: ['read', 'update'], limit: { writable: ['length_unit', 'default_bleed_mm', 'default_safe_mm', 'one_colour_threshold', 'smallest_line_mm', 'min_dpi'] } },
          // Read before a ready-made design is removed (whether a customer's design came from it); asked to change one too, which the Customiser offers no app's role.
          { addOn: CUSTOMISER, table: 'designs', actions: ['read', 'update'] },
          // The set-up tables, its own app's rows alone.
          ...SET_UP_TABLES.map((table) => ownSetUp('printing', table)),
          // A ledger's receipts: never an app's.
          { addOn: CUSTOMISER, table: 'postings', actions: ['read'] },
        ],
      },
      { key: 'counter', name: 'Counter', screensOnly: true, permissions: ['app:@:staff', 'table:@order_lines:read'], tables: [{ addOn: CUSTOMISER, table: 'designs', actions: ['read'] }] },
    ],
  };
}

describe.each(legs.LEGS as [string, boolean][])("a print shop's own pre-press role makes a Customiser proof — %s", (dialect, available) => {
  const runs = available && built !== null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let h: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let served: any;
  let installReply: Doc = {};
  const id: Record<string, string> = {};
  const cookies = new Map<string, string>();
  let at = 0;

  const signIn = async (role: 'prepress' | 'counter' | 'owner'): Promise<string> => {
    const member = await meta.usersRepo(h.meta).create({ email: `${role}@print.dev`, name: role, passwordHash: await auth.adminPasswordHash() });
    await meta.rolesRepo(h.meta).assignToUser(member.id, (await meta.rolesRepo(h.meta).findBySlug(`printing-${role}`))!.id);
    at += 1;
    const login = await served.composed.app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: `10.9.0.${String(at)}`, payload: { email: `${role}@print.dev`, password: auth.ADMIN_PASSWORD } });
    expect(login.statusCode, login.body).toBe(200);
    return auth.sessionCookie(login.headers['set-cookie']);
  };
  const data = (who: string, method: string, url: string, payload?: Doc) =>
    served.composed.app.inject({ method, url: `/api/v1/data/${h.connectionId as string}/${url}`, headers: { cookie: cookies.get(who)! }, ...(payload === undefined ? {} : { payload }) });
  const upload = (who: string, table: string, column: string, name: string) =>
    served.composed.app.inject({ method: 'POST', url: `/api/v1/files?filename=${name}&connectionId=${h.connectionId as string}&table=${encodeURIComponent(table)}&column=${column}`, headers: { cookie: cookies.get(who)!, 'content-type': 'application/pdf' }, payload: PDF });
  /** What an upload reply names the stored file by, as the panel's uploader sets it on the row. */
  const refOf = (reply: { json: () => Doc }): string => {
    const body = reply.json() as { ref?: string; data?: { ref?: string; id?: string } };
    return body.ref ?? body.data?.ref ?? body.data!.id!;
  };

  beforeAll(async () => {
    if (!runs) return;
    h = await helpers.addOnHarness(dialect, { unbuiltWords: {} });
    await h.stageAddOn(built!.manifest, { files: built!.files });
    await h.stageApp(printShop());
    const installed = await h.install('printing', '1.0.0', { addOns: [{ key: CUSTOMISER, version: built!.version }] });
    expect(installed.statusCode, installed.body).toBe(200);
    installReply = installed.json() as Doc;
    const q = (name: string) => (dialect === 'mysql' ? `\`${name}\`` : `"${name}"`);
    await h.rows(`INSERT INTO customiser_designs (id, app, code, ${q('values')}, created_at, updated_at) VALUES (1, 'printing', 'AAAABBBBCCCCDDD1', '{"format":1,"parts":{"name":{"text":"Marta Kovac"}}}', '${AT}', '${AT}')`);
    await h.rows(`INSERT INTO printing_order_lines (id, lettering, design_id) VALUES (1, 'Marta Kovac', 1)`);
    const model = engine.parseDatabaseModel((await meta.snapshotsRepo(h.meta).latest(h.connectionId))!.schema);
    for (const ref of ['designs', 'design_versions', 'version_files', 'settings', ...READS]) id[ref] = model.tables.find((table: { name: string }) => table.name === `customiser_${ref}`)!.id;
    served = await lane.servePublic(h, null, { ADMINIUM_DATA_DIR: h.dataDir });
    cookies.set('prepress', await signIn('prepress'));
    cookies.set('counter', await signIn('counter'));
    cookies.set('owner', await signIn('owner'));
  });
  afterAll(async () => {
    if (!runs) return;
    await served?.close();
    await h?.close();
  });

  it.skipIf(built !== null)('is skipped: no built Customiser (set ADMINIUM_ADD_ONS_REPO and run `npm run build` in packages/customiser)', () => {
    expect(built).toBeNull();
  });

  it.skipIf(!runs)("cuts at install what the Customiser offers no app's role: a change to a customer's design, a read of the postings", () => {
    const said = JSON.stringify(installReply);
    expect(said).toContain('ledger-table');
    expect(said).toContain('ceiling');
  });

  it.skipIf(!runs)("reads the customer's words in clear; the counter reads them masked", async () => {
    const own = await data('prepress', 'GET', `${id['designs']!}/1`);
    expect(own.statusCode, own.body).toBe(200);
    expect(own.body).toContain('Marta Kovac');
    const counter = await data('counter', 'GET', `${id['designs']!}/1`);
    expect(counter.statusCode, counter.body).toBe(200);
    expect(counter.body).not.toContain('Marta Kovac');
  });

  it.skipIf(!runs)('makes the proof: adds a version, uploads the proof and sets it on the version', async () => {
    const made = await data('prepress', 'POST', id['design_versions']!, { values: { app: 'printing', design_id: 1, version: 1, values: '{"format":1,"parts":{"name":{"text":"Marta Kovac"}}}' } });
    expect(made.statusCode, made.body).toBeLessThan(300);
    const version = String((made.json() as { data: { id: unknown } }).data.id);
    const sent = await upload('prepress', id['design_versions']!, 'proof_file', 'design-1-v1-proof.pdf');
    expect(sent.statusCode, sent.body).toBe(201);
    const set = await data('prepress', 'PATCH', `${id['design_versions']!}/${version}`, { values: { proof_file: refOf(sent) } });
    expect(set.statusCode, set.body).toBe(200);
    const rows = await h.rows(`SELECT id, proof_file FROM customiser_design_versions`);
    expect(rows).toHaveLength(1);
    expect(String(rows[0]['proof_file'] ?? '')).not.toBe('');
    // What the order's posting copies stays as it was: the role may not change the words on a version.
    expect((await data('prepress', 'PATCH', `${id['design_versions']!}/${version}`, { values: { values: '{"parts":{}}' } })).statusCode).toBe(403);
  });

  it.skipIf(!runs)("makes a production file, attaches it, and removes it to make the files again", async () => {
    const version = String((await h.rows('SELECT id FROM customiser_design_versions'))[0]['id']);
    const made = await data('prepress', 'POST', id['version_files']!, { values: { app: 'printing', version_id: Number(version), kind: 'print', name: 'design-1-v1-front-print.pdf', about: 'front', position: 1 } });
    expect(made.statusCode, made.body).toBeLessThan(300);
    const row = String((made.json() as { data: { id: unknown } }).data.id);
    const sent = await upload('prepress', id['version_files']!, 'file', 'design-1-v1-front-print.pdf');
    expect(sent.statusCode, sent.body).toBe(201);
    const set = await data('prepress', 'PATCH', `${id['version_files']!}/${row}`, { values: { file: refOf(sent) } });
    expect(set.statusCode, set.body).toBe(200);
    const removed = await data('prepress', 'DELETE', `${id['version_files']!}/${row}`);
    expect(removed.statusCode, removed.body).toBeLessThan(300);
    expect(await h.rows('SELECT id FROM customiser_version_files')).toEqual([]);
  });

  it.skipIf(!runs)('refuses the settings to a role whose app asked none of them', async () => {
    expect((await data('prepress', 'GET', `${id['settings']!}/1`)).statusCode).toBe(403);
  });

  it.skipIf(!runs)('lets the owner read every table the set-up page reads, and keep the settings', async () => {
    const settings = await data('owner', 'GET', id['settings']!);
    expect(settings.statusCode, settings.body).toBe(200);
    for (const table of READS) {
      const read = await data('owner', 'GET', id[table]!);
      expect(read.statusCode, `${table}: ${read.body as string}`).toBe(200);
    }
    const row = String(((await h.rows('SELECT id FROM customiser_settings')) as Doc[])[0]?.['id'] ?? '1');
    const changed = await data('owner', 'PATCH', `${id['settings']!}/${row}`, { values: { one_colour_threshold: 62 } });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(Number(((await h.rows('SELECT one_colour_threshold FROM customiser_settings')) as Doc[])[0]!['one_colour_threshold'])).toBe(62);
    // The pre-press role, whose app asked no settings, changes none.
    expect((await data('prepress', 'PATCH', `${id['settings']!}/${row}`, { values: { one_colour_threshold: 40 } })).statusCode).toBe(403);
  });

  it.skipIf(!runs)("keeps the owner to its own app's set-up: another app's base and font are neither seen, changed nor removed, and no row is made for it", async () => {
    await h.rows(`INSERT INTO customiser_bases (id, app, name, kind, width_mm, height_mm, state, position) VALUES (900, 'maker', 'Walnut coaster', 'piece', 95, 95, 'draft', 1)`);
    await h.rows(`INSERT INTO customiser_fonts (id, app, family, name, licence, starter, active) VALUES (900, 'maker', 'Maker Script', 'Maker Script', 'The shop’s own licence', FALSE, TRUE)`);
    const bases = await data('owner', 'GET', id['bases']!);
    expect(bases.statusCode, bases.body).toBe(200);
    expect(bases.body).not.toContain('Walnut coaster');
    // Print's owner changing a Maker base, removing a Maker font: refused, and nothing changed.
    const renamed = await data('owner', 'PATCH', `${id['bases']!}/900`, { values: { name: 'Taken' } });
    expect([403, 404], renamed.body).toContain(renamed.statusCode);
    expect(((await h.rows('SELECT name FROM customiser_bases WHERE id = 900')) as Doc[])[0]!['name']).toBe('Walnut coaster');
    const removed = await data('owner', 'DELETE', `${id['fonts']!}/900`);
    expect([403, 404], removed.body).toContain(removed.statusCode);
    expect(await h.rows('SELECT id FROM customiser_fonts WHERE id = 900')).toHaveLength(1);
    // A row tagged with Maker, made by Print's owner: refused.
    const made = await data('owner', 'POST', id['bases']!, { values: { app: 'maker', name: 'Slate sign', kind: 'piece', width_mm: 200, height_mm: 120, state: 'draft', position: 2 } });
    expect(made.statusCode, made.body).toBe(403);
    const madeFont = await data('owner', 'POST', id['fonts']!, { values: { app: 'maker', family: 'Other', name: 'Other', licence: 'own', starter: false, active: true } });
    expect(madeFont.statusCode, madeFont.body).toBe(403);
    expect(await h.rows(`SELECT id FROM customiser_bases WHERE name = 'Slate sign'`)).toEqual([]);
  });

  it.skipIf(!runs)('lets the owner read and change the starter fonts, which are no app’s, and remove none of them', async () => {
    const starters = (await h.rows('SELECT id, app FROM customiser_fonts WHERE starter = TRUE')) as Doc[];
    expect(starters.length).toBeGreaterThan(0);
    expect(starters.every((one) => one['app'] === null)).toBe(true);
    const listed = await data('owner', 'GET', id['fonts']!);
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.body).not.toContain('Maker Script');
    const ids = ((listed.json() as { data: Doc[] }).data ?? []).map((one) => String(one['id']));
    for (const one of starters) expect(ids).toContain(String(one['id']));
    const first = String(starters[0]!['id']);
    const switched = await data('owner', 'PATCH', `${id['fonts']!}/${first}`, { values: { active: false } });
    expect(switched.statusCode, switched.body).toBe(200);
    const gone = await data('owner', 'DELETE', `${id['fonts']!}/${first}`);
    expect([403, 404], gone.body).toContain(gone.statusCode);
    expect(await h.rows(`SELECT id FROM customiser_fonts WHERE id = ${first}`)).toHaveLength(1);
  });

  it.skipIf(!runs)('lets the owner set up a base as the set-up page does: add and change it, add, change and remove its parts, never remove the base', async () => {
    const base = await data('owner', 'POST', id['bases']!, { values: { app: 'printing', name: 'Card', kind: 'page', width_mm: 85, height_mm: 55, state: 'draft', position: 1 } });
    expect(base.statusCode, base.body).toBeLessThan(300);
    const baseId = String((base.json() as { data: { id: unknown } }).data.id);
    const renamed = await data('owner', 'PATCH', `${id['bases']!}/${baseId}`, { values: { name: 'Business card', state: 'published' } });
    expect(renamed.statusCode, renamed.body).toBe(200);
    // The app a row belongs to is the set-up page's to give a new row, never to change.
    expect((await data('owner', 'PATCH', `${id['bases']!}/${baseId}`, { values: { app: 'maker' } })).statusCode).toBe(403);
    const area = await data('owner', 'POST', id['base_areas']!, { values: { app: 'printing', base_id: Number(baseId), code: 'name', name: 'Name', side: 'front', shape: 'rect', x_mm: 5, y_mm: 5, w_mm: 40, h_mm: 8, takes: 'words', required: false, position: 1 } });
    expect(area.statusCode, area.body).toBeLessThan(300);
    const areaId = String((area.json() as { data: { id: unknown } }).data.id);
    expect((await data('owner', 'PATCH', `${id['base_areas']!}/${areaId}`, { values: { w_mm: 50 } })).statusCode).toBe(200);
    const feature = await data('owner', 'POST', id['features']!, { values: { app: 'printing', code: 'foil', name: 'Foil', active: true } });
    expect(feature.statusCode, feature.body).toBeLessThan(300);
    const featureId = String((feature.json() as { data: { id: unknown } }).data.id);
    expect((await data('owner', 'DELETE', `${id['features']!}/${featureId}`)).statusCode).toBeLessThan(300);
    expect((await data('owner', 'DELETE', `${id['base_areas']!}/${areaId}`)).statusCode).toBeLessThan(300);
    // A ready-made design is removed as the set-up page removes it: no customer's design came from it, then the row.
    const ready = await data('owner', 'POST', id['ready_designs']!, { values: { app: 'printing', base_id: Number(baseId), name: 'Harbour', state: 'draft', position: 1 } });
    expect(ready.statusCode, ready.body).toBeLessThan(300);
    const readyId = String((ready.json() as { data: { id: unknown } }).data.id);
    const from = await data('owner', 'GET', `${id['designs']!}?where=${encodeURIComponent(JSON.stringify({ column: 'ready_design_id', op: 'eq', value: Number(readyId) }))}`);
    expect(from.statusCode, from.body).toBe(200);
    expect((await data('owner', 'DELETE', `${id['ready_designs']!}/${readyId}`)).statusCode).toBeLessThan(300);
    expect((await data('owner', 'DELETE', `${id['bases']!}/${baseId}`)).statusCode).toBe(403);
  });

  it.skipIf(!runs)('the counter, holding only the designs’ read, may make nothing', async () => {
    expect((await data('counter', 'POST', id['design_versions']!, { values: { app: 'printing', design_id: 1, version: 2 } })).statusCode).toBe(403);
    expect((await data('counter', 'POST', id['version_files']!, { values: { app: 'printing', version_id: 1, kind: 'print', name: 'x.pdf' } })).statusCode).toBe(403);
  });
});
