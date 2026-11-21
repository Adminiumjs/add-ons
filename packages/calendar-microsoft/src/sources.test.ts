/**
 * THE RULES A DIFF CANNOT SHOW: what the shipped code does not do.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

const SRC = new URL('.', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const code = (file: string): string => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the sources', () => {
  it('carry no raw control byte', () => {
    const files = walk(SRC).filter((file) => /\.(ts|tsx|json)$/.test(file));
    expect(files.flatMap((file) => rawControlOffences(file, readFileSync(file, 'utf8'))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('keep what reads Microsoft\u2019s answers free of clocks and dice', () => {
    const offenders = ['wire.ts'].flatMap((name) => impuritiesIn(code(join(SRC, name))).map((why) => `${relative(SRC, join(SRC, name))}: ${why}`));
    expect(offenders).toEqual([]);
  });
});
