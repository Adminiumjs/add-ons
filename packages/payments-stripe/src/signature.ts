/**
 * Stripe's webhook signature: `Stripe-Signature: t=<seconds>,v1=<hex>[,v1=…]`,
 * where each `v1` is HMAC-SHA256 over `<t>.<raw body>` keyed with the
 * endpoint's signing secret (the whole `whsec_…` string).
 *
 * Source: https://docs.stripe.com/webhooks#verify-manually. Several `v1`
 * values appear while a secret is being rolled; any one matching is enough.
 * Web Crypto, so the server half needs no Node module.
 */

import { SIGNATURE_TOLERANCE_SECONDS } from './wire.ts';

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Two hex strings compared in time that does not depend on where they differ. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SignatureVerdict = 'ok' | 'missing' | 'malformed' | 'too-old' | 'mismatch';

/** Checks a delivery. `nowSeconds` is the engine's clock at receipt. */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowSeconds: number,
): Promise<SignatureVerdict> {
  if (header === undefined || header === '') return 'missing';
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [name, value] = part.split('=', 2) as [string, string | undefined];
    if (value === undefined) continue;
    if (name.trim() === 't' && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (name.trim() === 'v1' && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return 'malformed';
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return 'too-old';
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((one) => sameHex(one, expected)) ? 'ok' : 'mismatch';
}

/** Signs a body the way Stripe does. Used by the tests' fake Stripe, never by the transport. */
export async function signStripeWebhook(rawBody: string, secret: string, atSeconds: number): Promise<string> {
  return `t=${atSeconds},v1=${await hmacHex(secret, `${atSeconds}.${rawBody}`)}`;
}
