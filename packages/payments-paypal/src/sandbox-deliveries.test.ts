/**
 * REAL PAYPAL DELIVERIES, CHECKED THE WAY A SERVER CHECKS THEM.
 *
 * Six webhook deliveries the PayPal sandbox really sent on 2026-10-22, caught
 * on the test server with their headers and raw bodies, and the certificate
 * their `paypal-cert-url` served (the leaf ALONE, issued by "DigiCert EV RSA
 * CA G2"). They run through `verifyWebhook` with the DEFAULT trust: Node's
 * own roots and the pinned DigiCert intermediates, with the sandbox name the
 * certificate is issued to. Only the clock is fixed, inside the certificate's
 * dates, and the certificate address answers from the file instead of PayPal.
 *
 * Before this fix all six were refused twice over: the subject was the live
 * name, and the chain ended at an intermediate nobody served.
 */
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it } from 'vitest';

import type { PaymentHttpClient, WebhookDelivery } from '@adminium/add-on-host/contracts';

import { PINNED_INTERMEDIATES } from './intermediates.ts';
import { checkChain, systemTrust } from './signature.ts';
import { createPaypalProvider, forgetPaypalCaches } from './transport.ts';
import { CERT_SUBJECTS } from './wire.ts';

const FIXTURES = new URL('./testing/fixtures/', import.meta.url);
const CERT_PEM = readFileSync(new URL('paypal-sandbox-cert-CERT-360caa42.pem', FIXTURES), 'utf8');
const CAUGHT = JSON.parse(readFileSync(new URL('paypal-sandbox-webhooks-2026-10-22.json', FIXTURES), 'utf8')) as {
  headers: Record<string, string>;
  body: string;
}[];
/** The sandbox webhook the deliveries were signed for (fixtures README). */
const WEBHOOK_ID = '8JP041974U748851X';
const CERT_URL = 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-bf9ab596';
/** A minute after the last delivery; the certificate runs 2026-01-27 to 2027-01-26. */
const NOW = Date.parse('2026-10-22T10:40:00Z');

const deliveries: WebhookDelivery[] = CAUGHT.map((one) => ({ headers: one.headers, rawBody: one.body }));

let fetched: string[] = [];
const serving: PaymentHttpClient = async (url) => {
  fetched.push(url);
  return url === CERT_URL
    ? { status: 200, headers: { get: () => null }, text: async () => CERT_PEM }
    : { status: 404, headers: { get: () => null }, text: async () => '' };
};

const provider = (over: { webhook_id?: string; mode?: 'test' | 'live'; now?: number } = {}) =>
  createPaypalProvider(
    { http: serving, credentials: { client_id: 'AsandboxClient01', client_secret: 'EsandboxSecret01', webhook_id: over.webhook_id ?? WEBHOOK_ID }, mode: over.mode ?? 'test' },
    { now: () => over.now ?? NOW },
  );

beforeEach(() => {
  forgetPaypalCaches();
  fetched = [];
});

describe('the PayPal sandbox deliveries of 2026-10-22', () => {
  it('are six, each naming the same certificate address', () => {
    expect(deliveries).toHaveLength(6);
    expect(new Set(deliveries.map((one) => one.headers['paypal-cert-url']))).toEqual(new Set([CERT_URL]));
  });

  it('all six verify, end to end, with the default trust', async () => {
    const answers = [];
    for (const delivery of deliveries) answers.push(await provider().verifyWebhook(delivery));
    expect(answers.map((one) => (one.ok ? one.type : `${one.code}: ${one.providerMessage}`))).toEqual(
      CAUGHT.map((one) => (JSON.parse(one.body) as { event_type: string }).event_type),
    );
    expect(answers.every((one) => one.ok && one.livemode === false)).toBe(true);
    // Only the address the delivery named was fetched: never an intermediate.
    expect(new Set(fetched)).toEqual(new Set([CERT_URL]));
  });

  it('reads the capture and the order they name', async () => {
    const completed = deliveries.find((one) => one.rawBody.includes('"PAYMENT.CAPTURE.COMPLETED"'))!;
    expect(await provider().verifyWebhook(completed)).toMatchObject({ ok: true, kind: 'checkout', paymentRef: '1GS7034877077500R', checkoutRef: '04680378UG801802S' });
  });

  it('refuses a body changed by one byte', async () => {
    for (const delivery of deliveries) {
      const tampered = { ...delivery, rawBody: delivery.rawBody.replace('"1.00"', '"9.00"') };
      expect(tampered.rawBody).not.toBe(delivery.rawBody);
      expect(await provider().verifyWebhook(tampered)).toMatchObject({ ok: false, code: 'SIGNATURE_INVALID', providerMessage: 'The signature does not match this webhook.' });
    }
  });

  it('refuses them for another webhook, and once the certificate has run out', async () => {
    expect(await provider({ webhook_id: '0AB12345CD678901E' }).verifyWebhook(deliveries[0]!)).toMatchObject({ ok: false, code: 'SIGNATURE_INVALID' });
    expect(await provider({ now: Date.parse('2027-02-01T00:00:00Z') }).verifyWebhook(deliveries[0]!)).toMatchObject({
      ok: false,
      providerMessage: 'A certificate in the chain is outside its dates.',
    });
  });
});

describe('the sandbox certificate', () => {
  it('chains through the pinned DigiCert EV RSA CA G2 to a root in Node', () => {
    expect(checkChain(CERT_PEM, NOW, systemTrust(), CERT_SUBJECTS.test)).not.toBeTypeOf('string');
  });

  it('is not taken for the live name, nor without the pinned intermediate', () => {
    expect(checkChain(CERT_PEM, NOW, systemTrust(), CERT_SUBJECTS.live)).toBe('The signing certificate is not issued to PayPal.');
    expect(checkChain(CERT_PEM, NOW, { ...systemTrust(), intermediates: [] }, CERT_SUBJECTS.test)).toBe('The certificate chain does not end in a trusted root.');
  });

  it('pins intermediates that are what is written beside them, each issued by a root in Node', () => {
    const roots = systemTrust().anchors;
    for (const one of PINNED_INTERMEDIATES) {
      const cert = new X509Certificate(one.pem);
      expect(cert.fingerprint256, one.name).toBe(one.fingerprint256);
      expect(cert.subject, one.name).toContain(`CN=${one.name}`);
      expect(cert.ca, one.name).toBe(true);
      expect(roots.some((root) => cert.checkIssued(root) && cert.verify(root.publicKey)), one.name).toBe(true);
    }
  });
});
