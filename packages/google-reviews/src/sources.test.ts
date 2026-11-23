/**
 * THE RULES THAT ARE EASIER TO BREAK THAN TO NOTICE, each about an absence: no
 * address outside the declared list, no raw control byte, no clock or dice in
 * what decides how a review is drawn, no store written. The rules come from
 * the shared host package and are not restated here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { impuritiesIn, offendingAddresses, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';

const SRC = new URL('.', import.meta.url).pathname;
const ROOT = join(SRC, '..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const SHIPPED = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes('.test.'));
const read = (file: string) => readFileSync(file, 'utf8');
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('the sources', () => {
  it('use no raw directional control characters', () => {
    expect(SHIPPED.flatMap((file) => rawControlOffences(file, read(file))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('name no address but the ones declared', () => {
    for (const file of SHIPPED) expect(offendingAddresses(read(file), INERT_ORIGINS), relative(ROOT, file)).toEqual([]);
  });

  it('read no clock and mint nothing random in what draws the box', () => {
    for (const file of SHIPPED.filter((one) => one.includes('/frame/'))) expect(impuritiesIn(code(file)), relative(ROOT, file)).toEqual([]);
  });

  it('keep nothing Google answered: no storage, no cookie, no request of their own', () => {
    for (const file of SHIPPED.filter((one) => one.includes('/frame/'))) {
      for (const never of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'innerHTML', 'outerHTML', 'insertAdjacentHTML']) {
        expect(code(file).includes(never), `${relative(ROOT, file)}: ${never}`).toBe(false);
      }
    }
  });
});

describe('what the package declares', () => {
  it('holds no secret: the key is a browser key, meant to be in a page', () => {
    expect(NEVER_IN_A_BROWSER).toEqual([]);
    expect(manifest.addOn.connect.kind).toBe('none');
  });

  it('names Google and nobody else', () => {
    expect(COMPANY_MARKS.map((one) => one.mark)).toEqual(['Google', 'Google Maps']);
  });
});
