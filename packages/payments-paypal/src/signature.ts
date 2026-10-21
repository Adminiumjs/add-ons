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
 *   - the certificate must be for `CERT_SUBJECT`, inside its dates;
 *   - every certificate in the chain must be issued and signed by the next,
 *     and the last by a root the system trusts (`node:tls`).
 *
 * `node:crypto` and `node:tls` are the only modules this half imports: the
 * engine runs it on Node, and a certificate chain is not something to parse
 * by hand.
 */

import { verify, X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';

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

/** What a chain must be rooted in and issued for. Tests hand their own. */
export interface CertTrust {
  readonly anchors: readonly X509Certificate[];
  readonly subject: string;
}

let systemAnchors: X509Certificate[] | null = null;

/** The roots the system trusts, read once. */
export function systemTrust(subject: string): CertTrust {
  systemAnchors ??= rootCertificates.map((pem) => new X509Certificate(pem));
  return { anchors: systemAnchors, subject };
}

/** Each certificate in a PEM bundle, leaf first. */
export function splitPem(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}

/** The leaf of a chain that passes every check, or why it does not. */
export function checkChain(pem: string, nowMs: number, trust: CertTrust): X509Certificate | string {
  let chain: X509Certificate[];
  try {
    chain = splitPem(pem).map((one) => new X509Certificate(one));
  } catch {
    return 'The signing certificate cannot be read.';
  }
  const leaf = chain[0];
  if (leaf === undefined) return 'The certificate address sent no certificate.';
  for (const cert of chain) {
    if (nowMs < Date.parse(cert.validFrom) || nowMs > Date.parse(cert.validTo)) return 'A certificate in the chain is outside its dates.';
  }
  if (leaf.checkHost(trust.subject) === undefined) return 'The signing certificate is not issued to PayPal.';
  for (let i = 0; i + 1 < chain.length; i += 1) {
    if (!chain[i]!.checkIssued(chain[i + 1]!) || !chain[i]!.verify(chain[i + 1]!.publicKey)) {
      return 'The certificate chain does not hold together.';
    }
  }
  const top = chain[chain.length - 1]!;
  const anchored = trust.anchors.some(
    (anchor) => anchor.fingerprint256 === top.fingerprint256 || (top.checkIssued(anchor) && top.verify(anchor.publicKey)),
  );
  return anchored ? leaf : 'The certificate chain does not end in a trusted root.';
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
