/**
 * `card-terminal@1` against a real Stripe sandbox (test mode), with Stripe's
 * simulated reader standing in for the counter and its test helper tapping
 * the card. Runs only with `STRIPE_TERMINAL_SANDBOX_KEY` set (a test key); a
 * clean clone skips it. It makes a Terminal location and a simulated reader
 * in the sandbox if there is none, and leaves them for the next run.
 */
import { describe } from 'vitest';

import type { PaymentHttpClient } from '@adminium/add-on-host/contracts';
import { cardTerminalConformance, type CardTerminalConformanceDriver } from '@adminium/add-on-host/testing';

import { createStripeTerminal } from './terminal.ts';

const KEY = process.env['STRIPE_TERMINAL_SANDBOX_KEY'] ?? '';
const run = /^(sk|rk)_test_/.test(KEY);

const http: PaymentHttpClient = async (url, init) => {
  const response = await fetch(url, { method: init?.method ?? 'GET', headers: init?.headers ?? {}, ...(init?.body === undefined ? {} : { body: init.body }), redirect: 'manual' });
  return { status: response.status, headers: response.headers, text: () => response.text() };
};

/** A Stripe call for the sandbox's own setup, outside the transport. */
async function stripe(method: 'GET' | 'POST', path: string, form: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(form).toString();
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    ...(method === 'POST' ? { body } : {}),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Stripe ${path}: ${JSON.stringify(json['error'])}`);
  return json;
}

/** A location in Germany, and a simulated reader there: made once, found after. */
async function simulatedReader(): Promise<string> {
  const readers = (await stripe('GET', '/v1/terminal/readers?limit=100&device_type=simulated_wisepos_e')) as { data: { id: string; status: string }[] };
  const online = readers.data.find((reader) => reader.status === 'online');
  if (online !== undefined) return online.id;
  const locations = (await stripe('GET', '/v1/terminal/locations?limit=1')) as { data: { id: string }[] };
  const location =
    locations.data[0]?.id ??
    ((await stripe('POST', '/v1/terminal/locations', { display_name: 'Adminium conformance', 'address[line1]': 'Teststraße 1', 'address[city]': 'Berlin', 'address[postal_code]': '10115', 'address[country]': 'DE' })) as { id: string }).id;
  return ((await stripe('POST', '/v1/terminal/readers', { registration_code: 'simulated-wpe', label: 'Conformance reader', location })) as { id: string }).id;
}

describe.skipIf(!run)('Stripe Terminal, in a sandbox', () => {
  let readerId = '';
  const driver: CardTerminalConformanceDriver = {
    get readerId() {
      return readerId;
    },
    async tap(reader, _ref, outcome, tip) {
      const form: Record<string, string> = { 'card_present[number]': outcome === 'succeeds' ? '4242424242424242' : '4000000000000002', type: 'card_present' };
      if (tip !== undefined) form['amount_tip'] = String(Math.round(Number(tip) * 100));
      await stripe('POST', `/v1/test_helpers/terminal/readers/${reader}/present_payment_method`, form);
    },
  };
  cardTerminalConformance({
    name: 'Stripe Terminal (sandbox, simulated reader)',
    // The reader is found (or made) before the cases run.
    before: async () => {
      readerId = await simulatedReader();
    },
    make: () => createStripeTerminal({ http, credentials: { secret_key: KEY }, mode: 'test' }, { acceptSecretKey: true }),
    credentials: { secret_key: KEY },
    driver,
    amount: '12.50',
    currency: 'EUR',
    tips: false,
    settleMs: 15_000,
  });
});
