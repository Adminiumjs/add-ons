/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install uses. Until the engine release that
 * admits `card-terminal@1` is published, the installed `@adminiumjs/manifest`
 * does not know the contract and the first case is red; it goes green against
 * the packed engine tarball and after the release.
 */
import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';
import { NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { SQUARE_HOSTS } from './terminal.ts';

describe('the Card readers manifest', () => {
  it('validates with the validator an install uses', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`)).toEqual([]);
  });

  it('provides card-terminal@1 alone, from the file the build writes', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'card-terminal', version: 1, server: OUTPUT.server }]);
  });

  it('may reach the Terminal API of each mode, and nothing else', () => {
    expect([...manifest.addOn.network.allow].sort()).toEqual(Object.values(SQUARE_HOSTS).map((origin) => new URL(origin).hostname).sort());
    expect(manifest.capabilities).toEqual(['outbound-http']);
  });

  it('shows nothing to the public and keeps its one setting secret', () => {
    expect(manifest.addOn.publicSettings).toEqual([]);
    expect(manifest.settings.map((setting) => [setting.key, setting.secret, setting.required])).toEqual([['access_token', true, true]]);
  });

  it('declares the secret key and both API hosts as never in a browser', () => {
    const declared = NEVER_IN_A_BROWSER.map((one) => one.text);
    for (const setting of manifest.settings) expect(declared).toContain(setting.key);
    for (const origin of Object.values(SQUARE_HOSTS)) expect(declared).toContain(new URL(origin).hostname);
  });

  it('is named for what it does, says what it connects to, and needs the engine that knows card readers', () => {
    expect(manifest.name).toBe('Card readers');
    expect(manifest.name).not.toMatch(/square/i);
    expect(manifest.description.fallback.startsWith('Connects to Square.')).toBe(true);
    expect(manifest.categories).toEqual(['payments']);
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.60');
  });
});
