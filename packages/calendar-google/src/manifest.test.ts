/**
 * WHAT THE PACKAGE PROMISES, read from its manifest and its sources.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { validateManifest } from '@adminiumjs/manifest';
import { offendingAddresses, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { BUILT_FILES, OUTPUT } from '../vite.config.ts';
import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';

const SRC = new URL('.', import.meta.url).pathname;
const ROOT = join(SRC, '..');
const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const SERVER = walk(SRC).filter((file) => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('/testing/') && !file.includes('/pages/') && !file.endsWith('add-on-facts.ts'));
const read = (file: string): string => readFileSync(file, 'utf8');
const code = (file: string): string => read(file).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const connect = manifest.addOn.connect as Record<string, unknown>;

describe('the manifest', () => {
  it('validates, on the engine release that has connected accounts', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.71');
  });

  it('provides calendar-provider@1 from the file the build writes, and one screen', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'calendar-provider', version: 1, server: OUTPUT.server }]);
    expect(manifest.addOn.pages.map((page) => page.client)).toEqual(Object.values(OUTPUT.pages));
    expect([...BUILT_FILES].sort()).toEqual([OUTPUT.server, ...manifest.addOn.pages.map((page) => page.client)].sort());
    for (const tag of LOCALES) expect(manifest.addOn.pages[0]!.titles[tag as 'en-US'], tag).toBeTruthy();
  });

  it('keeps one sign-in per person, and shows nothing to the public', () => {
    expect(connect['kind']).toBe('oauth2');
    expect(connect['accounts']).toBe('row');
    expect(manifest.addOn.publicSettings).toEqual([]);
    expect(manifest.settings).toEqual([]);
  });

  it('asks for the ruled permissions and no others (R7, branch B)', () => {
    expect(connect['scopes']).toEqual(['openid', 'email', 'https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.events.freebusy']);
    expect(connect['requiredScopes']).toEqual(['https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.events.freebusy']);
    expect(JSON.stringify(connect)).not.toMatch(/calendar\.events\.readonly|calendar\.readonly|auth\/calendar"/);
  });

  it('asks Google for a refresh token, and says who connected from the sign-in', () => {
    expect(connect['authorizeParams']).toEqual({ access_type: 'offline', prompt: 'consent' });
    expect(connect['identity']).toEqual({ subject: 'sub', address: ['email'] });
    expect(connect['revokeUrl']).toBe('https://oauth2.googleapis.com/revoke');
  });

  it('may reach Google and nothing else', () => {
    expect(manifest.addOn.network.allow).toEqual(['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com']);
  });
});

describe('the server half', () => {
  it('carries no raw control byte', () => {
    expect(walk(SRC).flatMap((file) => rawControlOffences(file, read(file))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('has no network but the client it is handed, and no Node module', () => {
    for (const file of SERVER) {
      const text = code(file);
      expect(/\bfetch\(/.test(text), relative(ROOT, file)).toBe(false);
      expect(/from 'node:/.test(text), relative(ROOT, file)).toBe(false);
    }
  });

  it('never holds a token', () => {
    for (const file of SERVER) expect(/refresh_token|access_token|client_secret|\bauthorization\b/i.test(code(file)), relative(ROOT, file)).toBe(false);
  });

  it('names no address but the ones it declares', () => {
    const allowed = [...manifest.addOn.network.allow.map((host) => ({ origin: `https://${host}`, why: 'declared' })), ...INERT_ORIGINS];
    for (const file of SERVER) expect(offendingAddresses(read(file), allowed), relative(ROOT, file)).toEqual([]);
  });

  it('holds no secret of its own', () => {
    expect(NEVER_IN_A_BROWSER).toEqual([]);
  });

  it('names its own marks', () => {
    expect(COMPANY_MARKS.length).toBeGreaterThan(0);
  });
});
