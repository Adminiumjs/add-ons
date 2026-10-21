/**
 * THE BUILT BYTES, READ BACK: what ships is `dist/server.js`, so this builds
 * it for real, checks it imports nothing but `node:crypto` and `node:tls`,
 * then loads it the way the engine does and runs a call through it against
 * the fake PayPal.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CreatePaymentProvider } from '@adminium/add-on-host/contracts';

import { BUILT_FILES, NODE_IMPORTS, OUTPUT } from '../vite.config.ts';
import { POSSESSIVE } from './sources.test.ts';
import { buildForReal, DIST, ROOT } from './testing/build.ts';
import { createFakePaypal } from './testing/fake-paypal.ts';
import { testChain } from './testing/certs.ts';

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

  it('imports node:crypto and node:tls and nothing else, with no sourcemap', () => {
    const bytes = readFileSync(join(ROOT, OUTPUT.server), 'utf8');
    const imported = new Set([...bytes.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1]!));
    expect([...imported].sort()).toEqual([...NODE_IMPORTS].sort());
    expect(bytes).not.toMatch(/\bimport\s*\(/);
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
    const chain = testChain();
    const credentials = { client_id: 'AbuiltBytesClient01', client_secret: 'EbuiltBytesSecret01', webhook_id: 'WH0BUILT' };
    const paypal = createFakePaypal({ clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem, merchantId: 'BUILTMERCHANT' });
    const provider = module.createPaymentProvider!({ http: paypal.http, credentials, mode: 'test' });
    expect(await provider.checkCredentials()).toEqual({ ok: true, accountId: 'BUILTMERCHANT', livemode: false, missing: [] });
  });
});
