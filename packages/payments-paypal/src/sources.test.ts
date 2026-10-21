/**
 * THE RULES A DIFF CANNOT SHOW: what the shipped code does not do.
 *
 * - No network but the client the engine hands in: no `fetch`.
 * - No module but its own files, the contract mirror, and exactly
 *   `node:crypto` and `node:tls` (the webhook certificate check).
 * - No address but the PayPal hosts of its two modes.
 * - No possessive of a mark in anything it ships (the naming rule in TRADEMARKS.md).
 * - The money, word and signature files read no clock and roll no die.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import { NODE_IMPORTS } from '../vite.config.ts';
import { CERT_HOSTS, PAYPAL_HOSTS } from './wire.ts';

const SRC = new URL('.', import.meta.url).pathname;
const ROOT = join(SRC, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const SHIPPED = walk(SRC).filter((file) => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('/testing/'));
const codeOf = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
const name = (file: string) => file.slice(SRC.length);

/** A mark followed by an apostrophe-s, straight or curly. */
export const POSSESSIVE = /\b(Stripe|PayPal|Venmo)['’]s\b/;

const PURE = ['currency.ts', 'locale.ts', 'wire.ts', 'signature.ts'];

describe('what the shipped code does not do', () => {
  it('found the shipped files at all', () => {
    expect(SHIPPED.map(name).sort()).toContain('transport.ts');
  });

  it('makes no call of its own', () => {
    expect(SHIPPED.filter((file) => /\bfetch\s*\(|XMLHttpRequest|require\(|process\./.test(codeOf(file))).map(name)).toEqual([]);
  });

  it('imports only its own files, the contract mirror, node:crypto and node:tls', () => {
    const allowed = new Set<string>(['@adminium/add-on-host/contracts', ...NODE_IMPORTS]);
    const imports = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!));
    expect(imports.filter((one) => !one.startsWith('./') && !allowed.has(one))).toEqual([]);
  });

  it('names no address but the PayPal hosts of its two modes', () => {
    const hosts = new Set<string>();
    for (const mode of ['test', 'live'] as const) {
      hosts.add(new URL(PAYPAL_HOSTS[mode].api).hostname);
      hosts.add(PAYPAL_HOSTS[mode].checkout);
      for (const host of CERT_HOSTS[mode]) hosts.add(host);
    }
    const named = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => `${name(file)} ${new URL(m[0]).hostname}`));
    expect(named.filter((entry) => !hosts.has(entry.split(' ')[1]!))).toEqual([]);
  });

  it('keeps the money, word and signature files pure', () => {
    expect(PURE.flatMap((file) => impuritiesIn(codeOf(join(SRC, file))).map((why) => `${file}: ${why}`))).toEqual([]);
  });

  it('reads the real clock only as the injectable default', () => {
    const uses = SHIPPED.flatMap((file) => impuritiesIn(codeOf(file)).map((why) => `${name(file)}: ${why}`));
    expect(uses).toEqual(['transport.ts: Date.now() — the real clock']);
  });

  it('carries no raw control byte in any file', () => {
    const all = walk(SRC).filter((file) => file.endsWith('.ts'));
    expect(all.flatMap((file) => rawControlOffences(name(file), readFileSync(file, 'utf8'))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('writes no mark in the possessive, in code, manifest or README', () => {
    const texts = [
      ...SHIPPED.map((file) => [name(file), codeOf(file)] as const),
      ['manifest.json', readFileSync(join(ROOT, 'manifest.json'), 'utf8')] as const,
      ['README.md', readFileSync(join(ROOT, 'README.md'), 'utf8')] as const,
    ];
    expect(texts.filter(([, text]) => POSSESSIVE.test(text)).map(([file]) => file)).toEqual([]);
  });
});
