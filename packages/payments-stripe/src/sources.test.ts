/**
 * THE RULES A DIFF CANNOT SHOW: what the shipped code does not do.
 *
 * - No network but the client the engine hands in: no `fetch`, no Node module.
 * - No address but the Stripe API and the Stripe page.
 * - No possessive of a mark in anything it ships (the naming rule in TRADEMARKS.md): "the Stripe
 *   page", never the possessive.
 * - Nothing shipped reaches the test-only entry points.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEY_APP_PERMISSIONS } from './key-app.ts';
import { LISTENED_EVENTS } from './wire.ts';

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import { STRIPE_API_ORIGIN, STRIPE_CHECKOUT_HOSTS } from './wire.ts';

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
export const POSSESSIVE = /\b(Stripe|PayPal|Link)['’]s\b/;

/**
 * The files that work out money, words and request bodies. They read no clock
 * and roll no die: the same amount always gives the same minor units. The
 * transport reads the clock in one place (`now`, injectable), for a session's
 * expiry and a signature's age, and nowhere else.
 */
const PURE = ['currency.ts', 'form.ts', 'locale.ts', 'methods.ts', 'wire.ts'];

describe('what the shipped code does not do', () => {
  it('keeps the money, word and form files pure', () => {
    const offenders = PURE.flatMap((file) => impuritiesIn(codeOf(join(SRC, file))).map((why) => `${file}: ${why}`));
    expect(offenders).toEqual([]);
  });

  it('reads the real clock only as the injectable default', () => {
    const uses = SHIPPED.flatMap((file) => impuritiesIn(codeOf(file)).map((why) => `${name(file)}: ${why}`));
    expect(uses).toEqual(['transport.ts: Date.now() — the real clock']);
  });

  it('carries no raw control byte in any file', () => {
    const all = walk(SRC).filter((file) => file.endsWith('.ts'));
    expect(all.flatMap((file) => rawControlOffences(name(file), readFileSync(file, 'utf8'))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('found the shipped files at all', () => {
    expect(SHIPPED.map(name).sort()).toContain('transport.ts');
  });

  it('makes no call of its own and loads no Node module', () => {
    const offenders = SHIPPED.filter((file) => /\bfetch\s*\(|XMLHttpRequest|from\s+['"]node:|require\(|process\./.test(codeOf(file))).map(name);
    expect(offenders).toEqual([]);
  });

  it('names no address but the Stripe API and the Stripe page', () => {
    const allowed = new Set([STRIPE_API_ORIGIN, ...STRIPE_CHECKOUT_HOSTS.map((host) => `https://${host}`)]);
    const named = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => `${name(file)} ${new URL(m[0]).origin}`));
    expect(named.filter((entry) => !allowed.has(entry.split(' ')[1]!))).toEqual([]);
  });

  it('imports only its own files and the contract mirror', () => {
    const imports = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!));
    expect(imports.filter((one) => !one.startsWith('./') && one !== '@adminium/add-on-host/contracts')).toEqual([]);
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

describe('the guide in the README', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

  it('names every event the webhook must send', () => {
    expect(LISTENED_EVENTS.filter((event) => !readme.includes(`\`${event}\``))).toEqual([]);
  });

  it('lists exactly the access the key app asks for, by the names the Stripe dashboard uses', () => {
    const rows = [...readme.matchAll(/^\s*\| ([^|]+?)(?: \(optional\))? \| [^|]+ \|$/gmu)].map((match) => match[1]!).filter((name) => name !== 'Permission' && !/^-+$/.test(name));
    expect(rows.sort()).toEqual(KEY_APP_PERMISSIONS.map((one) => one.name).sort());
  });
});
