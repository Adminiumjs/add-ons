/**
 * THE BUILT BYTES, READ BACK: what ships is `dist/server.js`, so this builds
 * it for real, checks it is one self-contained module with nothing in it that
 * may not ship, then loads it the way the engine does and runs a call through
 * it against the fake Stripe.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CreatePaymentProvider } from '@adminium/add-on-host/contracts';

import { BUILT_FILES, OUTPUT } from '../vite.config.ts';
import { POSSESSIVE } from './sources.test.ts';
import { buildForReal, DIST, ROOT } from './testing/build.ts';
import { createFakeStripe } from './testing/fake-stripe.ts';

/** The size a server will load without a second thought. */
const MAX_BYTES = 128 * 1024;

const files = (dir = DIST): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? files(full) : [full];
  });

beforeAll(() => buildForReal(), 180_000);

describe('dist/server.js', () => {
  it('is the only file the build writes', () => {
    expect(files().map((file) => relative(ROOT, file)).sort()).toEqual([...BUILT_FILES].sort());
  });

  it('imports nothing, names no Node module and carries no sourcemap', () => {
    const bytes = readFileSync(join(ROOT, OUTPUT.server), 'utf8');
    expect(bytes).not.toMatch(/^\s*import\s/m);
    expect(bytes).not.toMatch(/\bfrom\s*['"]/);
    expect(bytes).not.toContain('node:');
    expect(bytes).not.toContain('sourceMappingURL');
    expect(bytes.length).toBeLessThan(MAX_BYTES);
  });

  it('writes no mark in the possessive', () => {
    const code = readFileSync(join(ROOT, OUTPUT.server), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code).not.toMatch(POSSESSIVE);
  });

  it('loads the way the engine loads it, and its factory answers', async () => {
    const module = (await import(pathToFileURL(join(ROOT, OUTPUT.server)).href)) as { createPaymentProvider?: CreatePaymentProvider };
    expect(typeof module.createPaymentProvider).toBe('function');
    const stripe = createFakeStripe({ accountId: 'acct_1Built00' });
    const provider = module.createPaymentProvider!({ http: stripe.http, credentials: { secret_key: 'rk_test_builtbytes0001', webhook_secret: 'whsec_builtbytes00001' }, mode: 'test' });
    expect(await provider.checkCredentials()).toEqual({ ok: true, accountId: 'acct_1Built00', livemode: false, missing: [] });
  });
});
