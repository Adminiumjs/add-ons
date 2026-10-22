/**
 * PAYPAL WEBHOOK SIGNATURES, CHECKED LOCALLY.
 *
 * PayPal signs `<transmission id>|<transmission time>|<webhook id>|<crc32 of
 * the raw body>` with SHA256withRSA, using the certificate at the delivery's
 * `paypal-cert-url` (developer.paypal.com/api/rest/webhooks/rest, read
 * 2026-10-20). Local checking is PayPal's preferred method and the only one
 * that also works for its simulator's events.
 *
 * A forged delivery names its own certificate address, so before any byte
 * of the certificate is believed:
 *   - the address must be https on one of the exact hosts in `CERT_HOSTS`;
 *   - the certificate must be for the mode's name in `CERT_SUBJECTS`, inside
 *     its dates;
 *   - every certificate served must be issued and signed by the next, and the
 *     last by a root the system trusts (`node:tls`), or by one of the pinned
 *     DigiCert intermediates (`intermediates.ts`) that is itself issued and
 *     signed by such a root. PayPal serves the leaf alone, so the pinned
 *     intermediate is what completes a real chain.
 *
 * `node:crypto` and `node:tls` are the only modules this half imports: the
 * engine runs it on Node, and a certificate chain is not something to parse
 * by hand.
 */

import { verify, X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';

import { PINNED_INTERMEDIATES } from './intermediates.ts';

/** CRC-32 (IEEE 802.3, the one PayPal names), over the UTF-8 bytes, as an unsigned decimal. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(text: string): number {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(text)) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** What a chain must be rooted in. Tests hand their own. */
export interface CertTrust {
  /** The roots a chain may end in. */
  readonly anchors: readonly X509Certificate[];
  /** Intermediates that may complete a chain served without one; each must itself hang from an anchor. */
  readonly intermediates: readonly X509Certificate[];
}

let system: CertTrust | null = null;

/** The roots the system trusts and the pinned DigiCert intermediates, read once. */
export function systemTrust(): CertTrust {
  system ??= {
    anchors: rootCertificates.map((pem) => new X509Certificate(pem)),
    intermediates: PINNED_INTERMEDIATES.map((one) => new X509Certificate(one.pem)),
  };
  return system;
}

/** Each certificate in a PEM bundle, leaf first. */
export function splitPem(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}

function inDates(cert: X509Certificate, nowMs: number): boolean {
  return nowMs >= Date.parse(cert.validFrom) && nowMs <= Date.parse(cert.validTo);
}

function issuedBy(cert: X509Certificate, issuer: X509Certificate): boolean {
  return cert.checkIssued(issuer) && cert.verify(issuer.publicKey);
}

function anchored(cert: X509Certificate, anchors: readonly X509Certificate[]): boolean {
  return anchors.some((anchor) => anchor.fingerprint256 === cert.fingerprint256 || issuedBy(cert, anchor));
}

/**
 * The leaf of a chain that passes every check, or why it does not. `subject`
 * is the name the leaf must be issued to: the mode's in `CERT_SUBJECTS`.
 */
export function checkChain(pem: string, nowMs: number, trust: CertTrust, subject: string): X509Certificate | string {
  let chain: X509Certificate[];
  try {
    chain = splitPem(pem).map((one) => new X509Certificate(one));
  } catch {
    return 'The signing certificate cannot be read.';
  }
  const leaf = chain[0];
  if (leaf === undefined) return 'The certificate address sent no certificate.';
  if (chain.some((cert) => !inDates(cert, nowMs))) return 'A certificate in the chain is outside its dates.';
  if (leaf.checkHost(subject) === undefined) return 'The signing certificate is not issued to PayPal.';
  for (let i = 0; i + 1 < chain.length; i += 1) {
    if (!issuedBy(chain[i]!, chain[i + 1]!)) return 'The certificate chain does not hold together.';
  }
  const top = chain[chain.length - 1]!;
  if (anchored(top, trust.anchors)) return leaf;
  // Served without its intermediate: complete it from the pinned ones, never from an address.
  const completed = trust.intermediates.some((middle) => inDates(middle, nowMs) && issuedBy(top, middle) && anchored(middle, trust.anchors));
  return completed ? leaf : 'The certificate chain does not end in a trusted root.';
}

/** True when `signature` (base64) is the leaf's SHA256withRSA signature over `message`. */
export function signatureMatches(message: string, signature: string, leaf: X509Certificate): boolean {
  try {
    return verify('sha256', new TextEncoder().encode(message), leaf.publicKey, Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
}

/** The signed message for one delivery. */
export function signedMessage(transmissionId: string, transmissionTime: string, webhookId: string, rawBody: string): string {
  return `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(rawBody)}`;
}
