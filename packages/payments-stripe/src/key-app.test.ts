/**
 * The private Stripe App template: stamped per shop, refused unstamped, and
 * asking for exactly the access the key check reads — no more.
 */
import { describe, expect, it } from 'vitest';

import {
  KEY_APP_CHECKED_NAMES,
  KEY_APP_NAME_MAX,
  KEY_APP_PERMISSIONS,
  KEY_APP_PLACEHOLDER_ID,
  KEY_APP_SHIPPED_MANIFEST,
  keyAppId,
  keyAppIssues,
  keyAppName,
  keyAppTemplate,
} from './key-app.ts';

describe('the Stripe App template that makes the key', () => {
  it('is refused as shipped: its id is a placeholder and its name is no one\'s', () => {
    expect(KEY_APP_SHIPPED_MANIFEST['id']).toBe(KEY_APP_PLACEHOLDER_ID);
    const issues = keyAppIssues(KEY_APP_SHIPPED_MANIFEST);
    expect(issues).toContain('The app id is still the template one. Download the template from Studio again.');
    expect(issues).toContain('The app has no name of its own.');
  });

  it('is stamped for one shop: a unique id, its name, a private app that asks for a restricted key and shows nothing', () => {
    const made = keyAppTemplate({ shopName: 'Crumb & Co.', installId: 'K7QXM2PD9a4b' });
    expect(made.appId).toBe('com.crumb-co.payments.k7qxm2pd9a4b');
    expect(made.appName).toBe('Payments for Crumb & Co.');
    expect(Object.keys(made.files).sort()).toEqual(['README.md', 'stripe-app.json']);
    const manifest = JSON.parse(made.files['stripe-app.json']!) as Record<string, unknown>;
    expect(manifest).toMatchObject({ id: made.appId, name: made.appName, distribution_type: 'private', stripe_api_access_type: 'restricted_api_key', sandbox_install_compatible: true, ui_extension: { views: [] } });
    expect(keyAppIssues(manifest)).toEqual([]);
    expect(made.files['README.md']).toContain('rk_test_');
  });

  it('gives two shops of one name two ids, and the same install the same id again', () => {
    expect(keyAppId('Crumb', 'aaaaaaaa1111')).not.toBe(keyAppId('Crumb', 'bbbbbbbb2222'));
    expect(keyAppId('Crumb', 'aaaaaaaa1111')).toBe(keyAppId('Crumb', 'aaaaaaaa1111'));
    expect(() => keyAppId('Crumb', 'short')).toThrow(/at least 8/);
    // A name of no Latin letters still makes an id Stripe takes.
    expect(keyAppId('مخبز القاهرة', 'aaaaaaaa1111')).toBe('com.shop.payments.aaaaaaaa1111');
  });

  it('keeps out of the name the words Stripe does not take, and keeps it short, cut at a word', () => {
    expect(keyAppName('Stripe App Bakery')).toBe('Payments for Bakery');
    expect(keyAppName('stripe')).toBe('Payments for your shop');
    const long = keyAppName('The Very Long Name Of A Bakery In The Old Town Of Lübeck');
    expect(long.length).toBeLessThanOrEqual(KEY_APP_NAME_MAX);
    expect(long.endsWith(' ')).toBe(false);
    expect('The Very Long Name Of A Bakery In The Old Town Of Lübeck'.includes(long.slice('Payments for '.length))).toBe(true);
  });

  it('asks for exactly the access the key check reads, plus nothing', () => {
    expect(KEY_APP_PERMISSIONS.map((one) => one.name).sort()).toEqual([...KEY_APP_CHECKED_NAMES].sort());
    expect(new Set(KEY_APP_PERMISSIONS.map((one) => one.permission)).size).toBe(KEY_APP_PERMISSIONS.length);
    const manifest = JSON.parse(keyAppTemplate({ shopName: 'Crumb', installId: 'aaaaaaaa1111' }).files['stripe-app.json']!) as { permissions: { permission: string }[] };
    expect(keyAppIssues({ ...manifest, permissions: [...manifest.permissions, { permission: 'payout_write' }] })).toContain('The app asks for access the payments do not use: payout_write.');
    expect(keyAppIssues({ ...manifest, permissions: manifest.permissions.filter((one) => one.permission !== 'event_read') })).toContain('The app lacks access the payments need: event_read.');
    // The optional one may be left out.
    expect(keyAppIssues({ ...manifest, permissions: manifest.permissions.filter((one) => one.permission !== 'webhook_read') })).toEqual([]);
  });
});
