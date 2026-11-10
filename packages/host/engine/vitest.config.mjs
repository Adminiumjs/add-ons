/**
 * THE CUSTOMISER'S `appGrants` AND ITS ORDER POSTING, PROVED ON A REAL ADMINIUM.
 *
 * Runs every `*.engine.ts` beside it inside a built Adminium checkout's own
 * server test set-up, where its test harness lives. Nothing here is part of
 * `npm test`; run it by hand, from the engine's server folder:
 *
 *   cd <adminium>/apps/server
 *   ADMINIUM_ENGINE=<adminium> ADMINIUM_ADD_ONS_REPO=<this repo> \
 *     npx vitest run --config <this repo>/packages/host/engine/vitest.config.mjs
 *
 * The Customiser must be built first (`npm run build` in packages/customiser).
 * Plain object, no imports: the engine's own vitest reads it.
 */
const here = new URL('.', import.meta.url).pathname;
const engine = process.env.ADMINIUM_ENGINE;
if (engine === undefined || engine === '') throw new Error('Set ADMINIUM_ENGINE to a built Adminium checkout.');

export default {
  cacheDir: `${process.env.TMPDIR ?? '/tmp'}/adminium-add-ons-engine-vitest`,
  test: {
    root: `${engine}/apps/server`,
    include: [`${here}*.engine.ts`],
    setupFiles: [`${engine}/apps/server/test/no-adminium-dev.setup.ts`],
    globals: true,
    hookTimeout: 240_000,
    testTimeout: 60_000,
  },
};
