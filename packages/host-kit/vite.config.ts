/**
 * There is no build here — this package ships TypeScript sources and a host
 * vendors them. The config exists for `vitest` alone.
 *
 * ── TWO ENVIRONMENTS IN ONE PACKAGE, WHICH IS THE TIER RULING MADE REAL ─────
 *
 * `environment: node` is the DEFAULT, because the tier-1 guards — lexicon,
 * brand, label-pairing's source half, payload-casts, facts, vendored-copy,
 * styles — read files off disk and assert over text, and nothing renders. That
 * is the whole point of the split: two of the four wave-6 hosts (`people-ops`,
 * `clinic-desk`) have no jsdom and no `.test.tsx` at all, and a kit whose
 * default environment were jsdom would have quietly required them to grow one.
 *
 * The tier-2 suites ask for jsdom per file, with `@vitest-environment jsdom` at
 * the top, exactly as both existing hosts already do. A file-level pragma
 * rather than a glob in here, because the pragma travels WITH the file when the
 * install script vendors it and a config entry does not.
 *
 * `@vitejs/plugin-react` is present for the `.tsx` under `src/` — `AddOnSlot`
 * and the tier-2 guards that render it.
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
