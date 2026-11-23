/**
 * WHAT THE PACKAGE PROMISES, read from its manifest.
 *
 * No slot and no change to an app's page: one small page of its own, in a
 * sandbox, that may reach Google's hosts and nothing else. One row per app, read
 * by a stranger only once its owner said the key is restricted.
 */
import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { BUILT_FILES, OUTPUT } from '../vite.config.ts';

const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const places = manifest.requiredSchema.tables[0]!;
const framed = manifest.addOn.framedPage;

describe('the manifest', () => {
  it('validates', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('needs the release with the framed page, and attaches to Bookings from its 0.2.0', () => {
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.71');
    expect(manifest.addOn.attaches).toEqual([{ app: 'bookings', range: '^0.2.0' }]);
  });

  it('fills no slot, has no server half and connects to nothing from the server', () => {
    const block = manifest.addOn as Record<string, unknown>;
    expect(block['slots']).toBeUndefined();
    expect(block['provides']).toBeUndefined();
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect((manifest as Record<string, unknown>)['capabilities']).toBeUndefined();
  });

  it('names exactly the files the build writes', () => {
    expect(framed.script).toBe(OUTPUT.frame);
    expect(manifest.addOn.pages.map((page) => page.client)).toEqual(Object.values(OUTPUT.pages));
    expect([...BUILT_FILES].sort()).toEqual([framed.script, ...manifest.addOn.pages.map((page) => page.client)].sort());
  });
});

describe('the framed page', () => {
  it('may reach Google\'s hosts and no others', () => {
    const hosts = Object.values(framed.hosts).flat();
    expect(hosts.length).toBeGreaterThan(0);
    for (const host of hosts) expect(host, host).toMatch(/^https:\/\/(\*\.)?(maps\.|fonts\.)?(googleapis|gstatic|googleusercontent|ggpht|google)\.com$/);
  });

  it('names no frame of its own to load', () => {
    expect((framed.hosts as Record<string, unknown>)['frame']).toBeUndefined();
  });
});

describe('a place', () => {
  const column = (ref: string) => places.columns.find((one) => one.ref === ref) as Record<string, unknown>;

  it('is one row per app', () => {
    expect(column('app')['unique']).toBe(true);
    expect(places.appGrants.appColumn).toBe('app');
  });

  it('keeps no review, no rating and no name of anybody', () => {
    expect(places.columns.map((one) => one.ref)).toEqual(['id', 'app', 'place_id', 'browser_key', 'restricted', 'on_booking', 'on_reviews', 'on_site']);
    expect(manifest.requiredSchema.tables).toHaveLength(1);
  });

  it('starts with the key not yet restricted', () => {
    expect(column('restricted')['default']).toBe(false);
  });

  it('is read by a stranger only for their app, and only once the key is restricted', () => {
    expect(manifest.publicAccess).toEqual([
      { table: 'places', methods: ['GET'], select: ['place_id', 'browser_key', 'on_booking', 'on_reviews', 'on_site'], appColumn: 'app', filters: [{ column: 'restricted', op: 'eq', value: true }] },
    ]);
  });

  it('lets an app\'s own staff move only where it shows: never the place or the key', () => {
    expect(places.appGrants.actions).toEqual(['read', 'update']);
    expect(places.appGrants.writable).toEqual(['on_booking', 'on_reviews', 'on_site']);
    expect(places.appGrants.readable).not.toContain('browser_key');
  });

  it('is named in all eight languages, every column of it', () => {
    expect(Object.keys(places.label).sort()).toEqual(LOCALES);
    for (const one of places.columns.filter((c) => c.ref !== 'id')) expect(Object.keys((one as { label: object }).label).sort(), one.ref).toEqual(LOCALES);
    expect(Object.keys(manifest.addOn.pages[0]!.titles).sort()).toEqual(LOCALES);
  });
});
