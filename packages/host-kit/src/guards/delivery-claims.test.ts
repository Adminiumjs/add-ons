/**
 * The build-mode claim guard, caught failing (34 D19; 34-T28).
 *
 * The three fixtures are shipped strings: two lies and the correct shape of the
 * same claim. A guard written from invented copy would be a guard tuned to
 * itself.
 */
import { describe, expect, it } from 'vitest';

import type { HostFacts } from '../config.ts';
import { claimIn, droppedLabels, unlabelledClaims } from './delivery-claims.ts';

const LOCALES = ['en-US', 'de-DE', 'cs-CZ'];

/** Enough of a host for the pure detectors — they read locales and an app key. */
const facts = (localeTags: readonly string[] = LOCALES): HostFacts =>
  ({ appKey: 'fixture-host', localeTags }) as unknown as HostFacts;

const DEMO_LABELS = { 'en-US': '· demo only', 'de-DE': '· nur Demo', 'cs-CZ': '· jen ukázka' };

function scopeOf(
  bundles: Record<string, Record<string, string>>,
  claimsDeclared?: Record<string, string>,
) {
  return {
    bundleFor: (locale: string) => bundles[locale] ?? {},
    demoLabels: DEMO_LABELS,
    ...(claimsDeclared === undefined ? {} : { claimsDeclared }),
  };
}

describe('what counts as a claim', () => {
  it.each([
    ['support-desk’s toast', 'Downloading {file}', 'downloading'],
    ['the storefront’s receipt line', 'Your order {number} is confirmed. We’ve emailed a receipt to {email}.', 'emailed'],
    ['the storefront’s email note', 'A confirmation with your receipt and tracking link is on the way to {email}.', 'on-the-way'],
    ['a receipt that was sent', 'Your receipt was sent to {email}', 'sent'],
    ['a print that happened', 'Printing your receipt', 'printed'],
  ])('reads %s as a claim', (_label, text, expected) => {
    expect(claimIn(text)).toBe(expected);
  });

  it.each([
    ['a button', 'Email'],
    ['a promise about the future', 'We will email your receipt when the order ships'],
    ['an instruction', 'Enter the email address for this receipt'],
    // The false positive the first pattern shipped with, found against a real
    // host's bundle: `email(ed)?\s+to` matches this.
    ['a subscribe prompt', 'Enter an email to subscribe'],
    ['a heading', 'Receipt'],
    // What the READER downloaded, not what the app just did. Found against a
    // real bundle: "keep the recordings you've downloaded".
    ['a past download by the reader', 'Anything you’ve downloaded stays yours.'],
  ])('does NOT read %s as a claim', (_label, text) => {
    /*
     * The false positives that would matter. A guard that flagged the button
     * "Email" would make every host declare its way out of the rule, and a rule
     * everybody is exempt from is a formality.
     */
    expect(claimIn(text)).toBeNull();
  });
});

describe('a claim needs a label or a declaration', () => {
  it('reports support-desk’s "Downloading {file}", which writes no file', () => {
    const findings = unlabelledClaims(
      facts(),
      scopeOf({ 'en-US': { 'lib.billing.downloading': 'Downloading {file}' } }),
    );
    expect(findings.map((f) => f.key)).toEqual(['lib.billing.downloading']);
  });

  it('accepts the SAME claim once it carries the demo marker', () => {
    // point-of-sale's `toast.receiptSentEmail`, verbatim.
    const findings = unlabelledClaims(
      facts(),
      scopeOf({ 'en-US': { 'toast.receiptSentEmail': 'Email receipt simulated · demo only' } }),
    );
    expect(findings).toEqual([]);
  });

  it('accepts a claim the host has declared an answer for', () => {
    const findings = unlabelledClaims(
      facts(),
      scopeOf(
        { 'en-US': { 'confirm.emailed': 'We’ve emailed a receipt to {email}.' } },
        { 'confirm.emailed': 'Confirm.tsx renders this only when document.delivery is `sent`' },
      ),
    );
    expect(findings).toEqual([]);
  });

  it('reports the storefront’s two lines, which are neither', () => {
    const findings = unlabelledClaims(
      facts(),
      scopeOf({
        'en-US': {
          'screens.confirm.receiptLine':
            'Your order {number} is confirmed. We’ve emailed a receipt to {email}.',
          'screens.confirm.emailNote':
            'A confirmation with your receipt and tracking link is on the way to {email}.',
          'screens.confirm.title': 'Thank you',
        },
      }),
    );
    expect(findings.map((f) => f.key).sort()).toEqual([
      'screens.confirm.emailNote',
      'screens.confirm.receiptLine',
    ]);
  });
});

describe('an add-on’s own copy is the add-on’s business', () => {
  it('leaves a vendored add-on’s claim alone', () => {
    /*
     * A host cannot fix a synced tree's words — `vendoredGuard` refuses the
     * hand-edit — and the add-on's own conformance suite owns them. Three of
     * eighteen findings on a real host were a carrier add-on's simulated-rate
     * copy.
     */
    const findings = unlabelledClaims(
      facts(),
      scopeOf({
        'en-US': {
          'addon.shipping-dhl.rates.simulated': 'Rates are simulated; nothing is sent to a carrier',
          'chrome.toast.downloading': 'Downloading {file}',
        },
      }),
    );
    expect(findings.map((f) => f.key)).toEqual(['chrome.toast.downloading']);
  });
});

describe('a label has to survive translation', () => {
  const LABELLED = {
    'en-US': { 'toast.sent': 'Email receipt simulated · demo only' },
    'de-DE': { 'toast.sent': 'Beleg per E-Mail simuliert · nur Demo' },
    'cs-CZ': { 'toast.sent': 'Účtenka e-mailem simulována · jen ukázka' },
  };

  it('passes when every language keeps its own marker', () => {
    expect(droppedLabels(facts(), scopeOf(LABELLED))).toEqual([]);
  });

  it('reports the language that lost it', () => {
    /*
     * The failure this half exists for: the English reader is told it is a
     * simulation and the German reader is told the receipt was emailed. No
     * other check in this kit can see it — the lexicon guard looks for banned
     * words, and this is a REQUIRED one going missing.
     */
    const findings = droppedLabels(
      facts(),
      scopeOf({
        ...LABELLED,
        'de-DE': { 'toast.sent': 'Beleg per E-Mail gesendet' },
      }),
    );
    expect(findings.map((f) => `${f.key}·${f.locale}`)).toEqual(['toast.sent·de-DE']);
  });

  it('says nothing about a key a locale has not translated at all', () => {
    // An absent key falls back to English, label and all. The untranslated
    // sweep owns that; treating it as a dropped label would double-report it.
    const findings = droppedLabels(facts(), scopeOf({ ...LABELLED, 'cs-CZ': {} }));
    expect(findings).toEqual([]);
  });
});
