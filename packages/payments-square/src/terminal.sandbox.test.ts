/**
 * `card-terminal@1` against Square's sandbox, on Square's own test devices:
 * each test device id stands for one outcome (taken, taken with a 20% tip,
 * the customer cancels, Square times out, a Terminal that never picks up).
 * Source: https://developer.squareup.com/docs/devtools/sandbox/testing (read
 * 2026-11-15). The sandbox seller is in the US, so amounts are USD, up to $25.
 *
 * Runs only with `SQUARE_SANDBOX_TOKEN` set (a sandbox access token); a clean
 * clone skips it. A test device takes no tap and declines no card, so the
 * driver's `tap` does nothing and the decline case is skipped by name.
 */
import { describe, expect, it } from 'vitest';

import type { PaymentHttpClient } from '@adminium/add-on-host/contracts';
import { CARD_TERMINAL_ANSWER_SCHEMAS, cardTerminalConformance } from '@adminium/add-on-host/testing';

import { createSquareTerminal } from './terminal.ts';

const TOKEN = process.env['SQUARE_SANDBOX_TOKEN'] ?? '';
const LOCATION = process.env['SQUARE_SANDBOX_LOCATION'] ?? '';
const run = TOKEN.length > 20;

/** Square's sandbox test devices, by outcome. */
const DEVICE = {
  taken: '9fa747a2-25ff-48ee-b078-04381f7c828f',
  tipped: '22cd266c-6246-4c06-9983-67f0c26346b0',
  buyerCancels: '841100b9-ee60-4537-9bcf-e30b2ba5e215',
  timesOut: '0a956d49-619a-4530-8e5e-8eac603ffc5e',
  neverPicksUp: 'da40d603-c2ea-4a65-8cfd-f42e36dab0c7',
} as const;

const http: PaymentHttpClient = async (url, init) => {
  const response = await fetch(url, { method: init?.method ?? 'GET', headers: init?.headers ?? {}, ...(init?.body === undefined ? {} : { body: init.body }), redirect: 'manual' });
  return { status: response.status, headers: response.headers, text: () => response.text() };
};

const make = () => createSquareTerminal({ http, credentials: { access_token: TOKEN }, mode: 'test' });
const key = (label: string): string => `sq-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function settled(ref: string, done: (status: string) => boolean): Promise<Awaited<ReturnType<ReturnType<typeof make>['readerStatus']>>> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const state = await make().readerStatus(ref);
    if (!state.ok || done(state.status) || Date.now() > deadline) return state;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

describe.skipIf(!run)('Square Terminal, in the sandbox', () => {
  cardTerminalConformance({
    name: 'Square Terminal (sandbox test devices)',
    make,
    credentials: { access_token: TOKEN },
    driver: { readerId: DEVICE.taken, idleReaderId: DEVICE.neverPicksUp, tap: async () => undefined, declines: false },
    amount: '12.50',
    currency: 'USD',
    tips: false,
    settleMs: 20_000,
  });

  it('takes a tip on top, said apart, and the whole taken as asked plus tip', async () => {
    const sent = await make().sendToReader({ readerId: DEVICE.tipped, amount: '12.50', currency: 'USD', attemptId: key('attempt'), idempotencyKey: key('tip'), tipping: true });
    if (!sent.ok) throw new Error(sent.providerMessage);
    const taken = await settled(sent.ref, (status) => status === 'succeeded');
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.readerStatus.safeParse(taken).success).toBe(true);
    expect(taken).toMatchObject({ status: 'succeeded', tip: '2.50', amount: '15.00', currency: 'USD', brand: 'Visa', interac: false });
  });

  it('says the customer cancelled, and that Square timed it out, as cancelled with words', async () => {
    for (const [device, words] of [
      [DEVICE.buyerCancels, 'The customer cancelled on the reader.'],
      [DEVICE.timesOut, 'Nobody took the payment on the reader in time.'],
    ] as const) {
      const sent = await make().sendToReader({ readerId: device, amount: '12.50', currency: 'USD', attemptId: key('attempt'), idempotencyKey: key('cancel'), tipping: false });
      if (!sent.ok) throw new Error(sent.providerMessage);
      const ended = await settled(sent.ref, (status) => status === 'cancelled');
      expect(ended).toMatchObject({ status: 'cancelled', failureMessage: words, paymentRef: null });
    }
  });

  it('pairs the show way: Square makes a code, and the pairing waits for the Terminal', async () => {
    const started = await make().startPairing({ label: 'Conformance Terminal', locationId: LOCATION === '' ? null : LOCATION });
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.startPairing.safeParse(started).success).toBe(true);
    if (!started.ok) throw new Error(started.providerMessage);
    expect(started.way).toBe('show');
    expect(started.code).toMatch(/^[A-Z0-9]{4,12}$/);
    expect(started.expiresAt).toBeGreaterThan(Date.now());
    // The sandbox pairs no physical Terminal, so the code stays unpaired.
    expect(await make().finishPairing({ pairing: started.pairing, code: null })).toEqual({ ok: true, state: 'waiting' });
  });

  it('reads the refunds made at Square as events, and an unknown refund as NOT_FOUND', async () => {
    const events = await make().listEvents(null);
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.listEvents.safeParse(events).success).toBe(true);
    if (!events.ok) throw new Error(events.providerMessage);
    // The conformance case above refunded a payment minutes ago.
    expect(events.events.some((event) => event.kind === 'refund' && event.refundRef !== null)).toBe(true);
    const unknown = await make().refundStatus('nope');
    expect(!unknown.ok && unknown.code).toBe('NOT_FOUND');
  });

  it('refuses a token for the other mode by name', async () => {
    const live = await createSquareTerminal({ http, credentials: { access_token: TOKEN }, mode: 'live' }).checkCredentials();
    expect(!live.ok && live.code).toBe('CREDENTIALS_REFUSED');
    if (!live.ok) expect(live.providerMessage).not.toContain(TOKEN);
  });
});
