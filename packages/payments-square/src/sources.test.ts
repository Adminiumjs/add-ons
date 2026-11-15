/**
 * THE RULES A DIFF CANNOT SHOW: what the shipped code does not do.
 *
 * - No network but the client the engine hands in: no `fetch`.
 * - No module but its own files and the contract mirror.
 * - No address but the Square hosts of its two modes.
 * - No possessive of a mark in anything it ships (the naming rule in TRADEMARKS.md).
 * - The real clock read only as the injectable default.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import { SQUARE_HOSTS } from './terminal.ts';

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
export const POSSESSIVE = /\b(Square|Interac)['’]s\b/;

describe('what the shipped code does not do', () => {
  it('found the shipped files at all', () => {
    expect(SHIPPED.map(name).sort()).toEqual(['add-on-facts.ts', 'server.ts', 'terminal.ts']);
  });

  it('makes no call of its own and loads no Node module', () => {
    expect(SHIPPED.filter((file) => /\bfetch\s*\(|XMLHttpRequest|from\s+['"]node:|require\(|process\./.test(codeOf(file))).map(name)).toEqual([]);
  });

  it('imports only its own files and the contract mirror', () => {
    const imports = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!));
    expect(imports.filter((one) => !one.startsWith('./') && one !== '@adminium/add-on-host/contracts')).toEqual([]);
  });

  it('names no address but the Square hosts of its two modes', () => {
    const allowed = new Set(Object.values(SQUARE_HOSTS));
    const named = SHIPPED.flatMap((file) => [...codeOf(file).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => `${name(file)} ${new URL(m[0]).origin}`));
    expect(named.filter((entry) => !allowed.has(entry.split(' ')[1]!))).toEqual([]);
  });

  it('reads the real clock only as the injectable default', () => {
    const uses = SHIPPED.flatMap((file) => impuritiesIn(codeOf(file)).map((why) => `${name(file)}: ${why}`));
    expect(uses).toEqual(['terminal.ts: Date.now() — the real clock']);
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
