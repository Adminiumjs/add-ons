/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install uses. Until the engine release that
 * admits `payment-provider@1` is published, the installed `@adminiumjs/manifest`
 * does not know the contract and the first case is red; it goes green against
 * the packed engine tarball (plan 70 P1-R) and after the release.
 */
import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';
import { NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { STRIPE_API_ORIGIN, STRIPE_CHECKOUT_HOSTS } from './wire.ts';

describe('the Card payments manifest', () => {
  it('validates with the validator an install uses', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`)).toEqual([]);
  });

  it('provides payment-provider@1 once, from the file the build writes', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'payment-provider', version: 1, server: OUTPUT.server }]);
  });

  it('may reach the Stripe API and send a customer to the Stripe page, and nothing else', () => {
    expect(manifest.addOn.network.allow).toEqual([new URL(STRIPE_API_ORIGIN).hostname, ...STRIPE_CHECKOUT_HOSTS]);
    expect(manifest.capabilities).toEqual(['outbound-http']);
  });

  it('shows nothing to the public and keeps both keys secret', () => {
    expect(manifest.addOn.publicSettings).toEqual([]);
    expect(manifest.settings.map((setting) => [setting.key, setting.secret])).toEqual([
      ['secret_key', true],
      ['webhook_secret', true],
    ]);
  });

  it('declares every secret key and the API host as never in a browser', () => {
    const declared = NEVER_IN_A_BROWSER.map((one) => one.text);
    for (const setting of manifest.settings) expect(declared).toContain(setting.key);
    expect(declared).toContain(new URL(STRIPE_API_ORIGIN).hostname);
  });

  it('is named for what it does, and says what it connects to (G1-1)', () => {
    expect(manifest.name).toBe('Card payments');
    expect(manifest.name).not.toMatch(/stripe/i);
    expect(manifest.description.fallback.startsWith('Connects to Stripe.')).toBe(true);
    expect(manifest.categories).toEqual(['payments']);
  });
});
