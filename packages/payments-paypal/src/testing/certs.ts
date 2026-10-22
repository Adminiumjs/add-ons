/**
 * A test certificate chain for webhook signatures: a root, an intermediate,
 * and a leaf for both PayPal signing names (`messageverificationcerts.paypal.com`
 * and its `.sandbox.` twin, so one chain serves both modes), made fresh with the
 * `openssl` command line for each test run. Nothing here is committed key
 * material: the keys live in a temporary folder for the length of the run.
 *
 * Test only.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestChain {
  /** The root the transport is told to trust. */
  rootPem: string;
  /** What the certificate address serves: leaf, then intermediate. */
  chainPem: string;
  /** The leaf alone, as PayPal really serves it. */
  leafPem: string;
  /** The intermediate alone, to pin. */
  intermediatePem: string;
  /** The leaf's private key, to sign deliveries with. */
  leafKeyPem: string;
  /** A self-signed certificate for the same name, rooted in nothing trusted. */
  rogueChainPem: string;
  rogueKeyPem: string;
}

const CA_CONFIG = (cn: string) => `[req]
distinguished_name = dn
prompt = no
[dn]
CN = ${cn}
[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
`;

const LEAF_EXT = `basicConstraints = CA:FALSE
keyUsage = digitalSignature
subjectAltName = DNS:messageverificationcerts.paypal.com,DNS:messageverificationcerts.sandbox.paypal.com
`;

const ROGUE_CONFIG = `${CA_CONFIG('messageverificationcerts.paypal.com')}subjectAltName = DNS:messageverificationcerts.paypal.com,DNS:messageverificationcerts.sandbox.paypal.com
`;

const INTERMEDIATE_EXT = `basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
`;

let made: TestChain | null = null;

/** Makes the chain once per test process. */
export function testChain(): TestChain {
  if (made !== null) return made;
  const dir = mkdtempSync(join(tmpdir(), 'paypal-certs-'));
  const run = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  try {
    writeFileSync(join(dir, 'root.cnf'), CA_CONFIG('Adminium Test Root'));
    writeFileSync(join(dir, 'leaf.ext'), LEAF_EXT);
    writeFileSync(join(dir, 'int.ext'), INTERMEDIATE_EXT);
    run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'root.key', '-out', 'root.pem', '-days', '3650', '-config', 'root.cnf', '-extensions', 'v3_ca');
    run('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'int.key', '-out', 'int.csr', '-subj', '/CN=Adminium Test Intermediate');
    run('x509', '-req', '-in', 'int.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-out', 'int.pem', '-days', '3650', '-extfile', 'int.ext');
    run('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=messageverificationcerts.paypal.com');
    run('x509', '-req', '-in', 'leaf.csr', '-CA', 'int.pem', '-CAkey', 'int.key', '-CAcreateserial', '-out', 'leaf.pem', '-days', '3650', '-extfile', 'leaf.ext');
    writeFileSync(join(dir, 'rogue.cnf'), ROGUE_CONFIG);
    run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'rogue.key', '-out', 'rogue.pem', '-days', '3650', '-config', 'rogue.cnf', '-extensions', 'v3_ca');
    const read = (file: string) => readFileSync(join(dir, file), 'utf8');
    made = {
      rootPem: read('root.pem'),
      chainPem: `${read('leaf.pem')}${read('int.pem')}`,
      leafPem: read('leaf.pem'),
      intermediatePem: read('int.pem'),
      leafKeyPem: read('leaf.key'),
      rogueChainPem: read('rogue.pem'),
      rogueKeyPem: read('rogue.key'),
    };
    return made;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
