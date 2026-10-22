/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install uses. Until the engine release that
 * admits `payment-provider@1` is published, the installed `@adminiumjs/manifest`
 * does not know the contract and the first case is red; it goes green against
 * the packed engine tarball and after the release.
 */
import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';
import { NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { CERT_HOSTS, PAYPAL_HOSTS } from './wire.ts';

describe('the Wallet payments manifest', () => {
  it('validates with the validator an install uses', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`)).toEqual([]);
  });

  it('provides payment-provider@1 once, from the file the build writes', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'payment-provider', version: 1, server: OUTPUT.server }]);
  });

  it('may reach exactly the hosts each mode uses, and nothing else', () => {
    const hosts = new Set<string>();
    for (const mode of ['test', 'live'] as const) {
      hosts.add(new URL(PAYPAL_HOSTS[mode].api).hostname);
      hosts.add(PAYPAL_HOSTS[mode].checkout);
      for (const host of CERT_HOSTS[mode]) hosts.add(host);
    }
    expect([...manifest.addOn.network.allow].sort()).toEqual([...hosts].sort());
    expect(manifest.capabilities).toEqual(['outbound-http']);
  });

  it('shows nothing to the public and keeps all three settings secret', () => {
    expect(manifest.addOn.publicSettings).toEqual([]);
    expect(manifest.settings.map((setting) => [setting.key, setting.secret])).toEqual([
      ['client_id', true],
      ['client_secret', true],
      ['webhook_id', true],
    ]);
  });

  it('declares every secret key and both API hosts as never in a browser', () => {
    const declared = NEVER_IN_A_BROWSER.map((one) => one.text);
    for (const setting of manifest.settings) expect(declared).toContain(setting.key);
    for (const mode of ['test', 'live'] as const) expect(declared).toContain(new URL(PAYPAL_HOSTS[mode].api).hostname);
  });

  it('is named for what it does, and says what it connects to ', () => {
    expect(manifest.name).toBe('Wallet payments');
    expect(manifest.name).not.toMatch(/paypal/i);
    expect(manifest.description.fallback.startsWith('Connects to PayPal.')).toBe(true);
    expect(manifest.categories).toEqual(['payments']);
  });
});
