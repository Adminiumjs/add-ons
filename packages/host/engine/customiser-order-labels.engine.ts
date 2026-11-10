/**
 * ONE ORDER, SEVERAL CUSTOMISED ITEMS: THE CUSTOMISER'S PLAN PASSES ADMINIUM'S
 * WRITE CHECK.
 *
 * An order is one save, and every line of it that names a design is one plan
 * of the Customiser's `designs` ledger. Adminium refuses a plan that gives one
 * label to two rows, so two new designs in one order, each at its version 1,
 * must not both be labelled "v1". Here, on a real Adminium with the built
 * Customiser vouched for as a sandbox vouches for it, in the two shapes the
 * shops post in (a print shop's jobs, a maker shop's order lines), a guest of
 * the shop orders:
 *
 * - two designs in one order: the order is taken, each design gets its own
 *   version 1, both are marked ordered;
 * - two items of one design in one order: the order is taken, the design gets
 *   one version;
 * - two new designs beside one ordered before: each new one gets its own
 *   version 1, the one ordered before none.
 *
 * Run by `vitest.config.mjs` beside it, inside a built Adminium checkout
 * (`ADMINIUM_ENGINE`) with this repository built (`ADMINIUM_ADD_ONS_REPO`).
 * On every engine that run can reach.
 */
/* global describe, it, expect, beforeAll, afterAll */

type Doc = Record<string, unknown>;

const ENGINE = process.env['ADMINIUM_ENGINE']!;
const helpers = await import(`${ENGINE}/apps/server/test/app-add-ons.helpers.ts`);
const legs = await import(`${ENGINE}/apps/server/test/invoicing-install.helpers.ts`);
const lane = await import(`${ENGINE}/apps/server/test/public-lane.helpers.ts`);
const kit = await import(`${ENGINE}/apps/server/test/add-ons/harness.ts`);
const proofs = await import(`${ENGINE}/apps/server/src/public-api/proof.ts`);

const CUSTOMISER = 'customiser';
const DESIGNS = 'customiser_designs';
const built = kit.builtAddOn(CUSTOMISER) as { version: string; manifest: Doc; files: Record<string, string> } | null;
const pk = { ref: 'id', type: 'int', role: 'pk' } as const;
const EMAIL = 'guest@example.com';

/** The two shapes a shop posts a design in: its app, and the table its order's items are rows of. */
const SHOPS = [
  { app: 'printing', lines: 'jobs' },
  { app: 'maker', lines: 'order_lines' },
] as const;
type Shop = (typeof SHOPS)[number];

/** A shop whose order's items name a design by its code, check it, and post it when the item is made: the README's snippet. */
function shopOf(shop: Shop): Doc {
  return {
    manifestVersion: 1,
    publisher: { id: 'adminium', name: 'Adminium' },
    license: 'MIT',
    kind: 'app',
    key: shop.app,
    name: 'A shop',
    version: '1.0.0',
    description: { key: `mft.${shop.app}.desc`, fallback: 'A shop.' },
    categories: ['commerce'],
    compatibility: { minAdminiumVersion: '0.3.43', engines: ['postgres', 'mysql', 'sqlite'] },
    requiredSchema: {
      prefixed: true,
      tables: [
        { ref: 'products', columns: [pk, { ref: 'name', type: 'text', maxLength: 80, nullable: true }, { ref: 'price', type: 'decimal', scale: 2, default: 0 }] },
        { ref: 'orders', columns: [pk, { ref: 'name', type: 'text', maxLength: 80, nullable: true }, { ref: 'email', type: 'text', maxLength: 120, nullable: true }] },
        {
          ref: shop.lines,
          columns: [
            pk,
            { ref: 'order_id', type: 'fk', references: 'orders' },
            { ref: 'product_id', type: 'fk', references: 'products', nullable: true },
            { ref: 'qty', type: 'int', default: 1 },
            { ref: 'design_code', type: 'text', maxLength: 40, nullable: true },
            {
              ref: 'design_id',
              type: 'int',
              nullable: true,
              rules: {
                addOnLink: { addOn: CUSTOMISER, table: 'designs' },
                lookup: { from: 'design_code', table: { addOn: CUSTOMISER, table: 'designs' }, column: 'code' },
              },
            },
          ],
          check: { by: { addOn: CUSTOMISER }, design: 'design_id' },
          postings: [
            {
              id: 'design',
              into: { addOn: CUSTOMISER, ledger: 'designs', action: 'order' },
              via: 'order_id',
              post: { on: { create: true } },
              map: { design: 'design_id' },
              only: { column: 'design_id', set: true },
            },
          ],
        },
      ],
    },
    pages: [{ ref: `${shop.app}-home`, template: 'page-dashboard', title: { key: `mft.${shop.app}.page.home`, fallback: 'Home' }, nav: { group: 'manifest:sample', icon: 'layout-dashboard', order: 1 } }],
    frontends: [
      { side: 'staff', kind: 'spa', entry: 'index.html', routes: { desk: '/' } },
      { side: 'customer', kind: 'spa', entry: 'index.html', routes: { shop: '/' } },
    ],
    addOns: { requires: [{ key: CUSTOMISER, range: '^1.0.0', reason: { 'en-US': 'Customers make their items their own.' } }] },
    publicAccess: [
      { table: 'products', methods: ['GET'], select: ['id', 'name', 'price'] },
      {
        table: 'orders',
        methods: ['POST'],
        writable: ['name', 'email'],
        humanCheck: true,
        select: ['id'],
        children: { [shop.lines]: { via: 'order_id', writable: ['product_id', 'qty', 'design_code'], select: ['id', 'design_id'], min: 1, max: 12 } },
      },
    ],
  };
}

const CASES = (legs.LEGS as [string, boolean][]).flatMap(([dialect, available]) => SHOPS.map((shop) => ({ dialect, available, shop, app: shop.app })));

describe.each(CASES)('several customised items in one order — $app, $dialect', ({ dialect, available, shop }) => {
  const runs = available && built !== null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let h: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let served: any;
  let trusted: string | undefined;
  let ip = 0;
  const lines = `${shop.app}_${shop.lines}`;
  const fresh = () => {
    ip += 1;
    return `10.12.${String((ip >> 8) & 255)}.${String(ip & 255)}`;
  };
  const q = (name: string) => (dialect === 'mysql' ? `\`${name}\`` : `"${name}"`);
  /** A create behind the human check, through the shop's key, as a browser sends one. */
  const create = async (ref: string, payload: Doc) => {
    const address = fresh();
    const res = await served.composed.app.inject({ method: 'GET', url: '/api/v1/public/challenge?purpose=write', remoteAddress: address, headers: served.headers() });
    const c = (res.json() as { data: { id: string; salt: string; difficulty: number } }).data;
    const headers = served.headers(undefined, { 'x-adminium-proof': `${c.id}.${proofs.solveProof(c.salt, c.difficulty) as string}` });
    return served.composed.app.inject({ method: 'POST', url: `/api/v1/public/records/${ref}`, remoteAddress: address, headers, payload });
  };
  const words = (text: string) => ({ parts: { words: { text } } });
  /** A design saved through the shop's key: its id and its code. */
  const save = async (text: string): Promise<{ id: number; code: string }> => {
    const res = await create(DESIGNS, { values: { format: 1, ready_design_id: 1, base_id: 1, values: words(text), email: EMAIL } });
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json() as { data: { id: unknown; code: string } };
    return { id: Number(body.data.id), code: body.data.code };
  };
  /** One order whose items name these designs by their codes, one item each. */
  const order = (codes: string[]) => create(`${shop.app}_orders`, { values: { name: 'Guest', email: EMAIL }, children: { [shop.lines]: codes.map((code) => ({ values: { product_id: 1, qty: 1, design_code: code } })) } });
  const versions = async (id: number): Promise<number[]> => (await h.rows(`SELECT version FROM customiser_design_versions WHERE design_id = ${String(id)} ORDER BY version`)).map((row: Doc) => Number(row['version']));
  const state = async (id: number): Promise<unknown> => (await h.rows(`SELECT ${q('state')} AS state FROM customiser_designs WHERE id = ${String(id)}`))[0]?.['state'];

  beforeAll(async () => {
    if (!runs) return;
    trusted = process.env['ADMINIUM_ADD_ON_DEV_TRUST'];
    // The Customiser's code is vouched for as a sandbox vouches for it: the check and the posting load it.
    process.env['ADMINIUM_ADD_ON_DEV_TRUST'] = CUSTOMISER;
    h = await helpers.addOnHarness(dialect, { unbuiltWords: {} });
    await h.stageAddOn(built!.manifest, { files: built!.files });
    await h.stageApp(shopOf(shop));
    const installed = await h.install(shop.app, '1.0.0', { addOns: [{ key: CUSTOMISER, version: built!.version }], publicAccess: true });
    expect(installed.statusCode, installed.body).toBe(200);
    const key = (installed.json() as { publicAccess: { keyId: string } }).publicAccess.keyId;
    const yes = (value: boolean) => (dialect === 'postgres' ? String(value) : value ? '1' : '0');
    // A one-sided card with words of up to 20 characters.
    await h.rows(`INSERT INTO customiser_bases (id, app, name, kind, width_mm, height_mm, sides, ${q('state')}, position) VALUES (1, '${shop.app}', 'Square card', 'page', 95, 95, 1, 'published', 1)`);
    await h.rows(`INSERT INTO customiser_ready_designs (id, app, base_id, name, ${q('state')}, position) VALUES (1, '${shop.app}', 1, 'Ring', 'published', 1)`);
    const wordRules = JSON.stringify({ chars: 20, unit: 'mm', size: 6, min: 4, max: 8, fonts: ['Manrope'], font: 'Manrope' });
    await h.rows(
      `INSERT INTO customiser_ready_parts (id, app, ready_design_id, code, name, kind, locked, required, rules, feature_id, x_mm, y_mm, w_mm, h_mm, position) VALUES ` +
        `(1, '${shop.app}', 1, 'words', 'Your words', 'text', ${yes(false)}, ${yes(true)}, '${wordRules}', NULL, 14, 60, 72, 13, 1)`,
    );
    await h.rows(`INSERT INTO ${shop.app}_products (id, name, price) VALUES (1, 'Card', 10)`);
    served = await lane.servePublic(h as never, key, { ADMINIUM_DATA_DIR: h.dataDir });
  }, 240_000);
  afterAll(async () => {
    if (!runs) return;
    await served?.close();
    await h?.close();
    if (trusted === undefined) delete process.env['ADMINIUM_ADD_ON_DEV_TRUST'];
    else process.env['ADMINIUM_ADD_ON_DEV_TRUST'] = trusted;
  });

  it.skipIf(!runs)('two designs in one order: the order is taken, each design gets its own version 1', async () => {
    const one = await save('Monogram');
    const two = await save('Classic');
    const placed = await order([one.code, two.code]);
    expect(placed.statusCode, placed.body).toBe(201);
    expect(await versions(one.id)).toEqual([1]);
    expect(await versions(two.id)).toEqual([1]);
    expect(await state(one.id)).toBe('ordered');
    expect(await state(two.id)).toBe('ordered');
    expect(await h.rows(`SELECT id FROM ${lines} WHERE design_id IN (${String(one.id)}, ${String(two.id)})`)).toHaveLength(2);
  });

  it.skipIf(!runs)('two items of one design in one order: the order is taken, the design gets one version', async () => {
    const one = await save('Twice in one');
    const placed = await order([one.code, one.code]);
    expect(placed.statusCode, placed.body).toBe(201);
    expect(await versions(one.id)).toEqual([1]);
    expect(await h.rows(`SELECT id FROM ${lines} WHERE design_id = ${String(one.id)}`)).toHaveLength(2);
  });

  it.skipIf(!runs)('three designs and a repeat in one order: each new design its own version, the repeat none', async () => {
    const first = await save('Harbour');
    expect((await order([first.code])).statusCode).toBe(201);
    const fresh1 = await save('Pinfold');
    const fresh2 = await save('Wren');
    const placed = await order([fresh1.code, first.code, fresh2.code]);
    expect(placed.statusCode, placed.body).toBe(201);
    expect(await versions(first.id)).toEqual([1]);
    expect(await versions(fresh1.id)).toEqual([1]);
    expect(await versions(fresh2.id)).toEqual([1]);
  });

  it.skipIf(built !== null)('is skipped: no built Customiser (set ADMINIUM_ADD_ONS_REPO and run `npm run build` in packages/customiser)', () => {
    expect(built).toBeNull();
  });
});
