/**
 * THE DIGICERT INTERMEDIATES A PAYPAL WEBHOOK CERTIFICATE MAY HANG FROM.
 *
 * The certificate address PayPal names (`paypal-cert-url`) serves the
 * signing certificate ALONE, with no intermediate (seen on a real sandbox delivery,
 * 2026-10-22). The chain is completed here, from these pinned copies, and
 * each copy must itself chain to a root in Node's own list
 * (`tls.rootCertificates`). The intermediate is never fetched from the
 * address a certificate names (its AIA field): a delivery chooses the
 * certificate address, so nothing it names is fetched beyond that one file.
 *
 * Each copy was read from DigiCert's own download site
 * (cacerts.digicert.com, DER, turned into PEM) on 2026-10-22, and checked:
 * the real PayPal leaf named beside it is issued and signed by it, and it is
 * issued and signed by the root named, which is in Node 22's root list.
 *
 * Dropping one is safe only once no PayPal certificate in use names it.
 * A certificate issued by none of these is refused with "does not end in a
 * trusted root": add its intermediate here, after the same checks.
 */

export interface PinnedIntermediate {
  /** The certificate's subject common name. */
  readonly name: string;
  /** SHA-256 of the DER bytes, as `X509Certificate.fingerprint256` writes it. */
  readonly fingerprint256: string;
  readonly pem: string;
}

export const PINNED_INTERMEDIATES: readonly PinnedIntermediate[] = [
  /**
   * DigiCert EV RSA CA G2, under DigiCert Global Root G2; valid to
   * 2030-07-02. Issues the sandbox certificate
   * `messageverificationcerts.sandbox.paypal.com` of 2026-01-27 (until
   * 2027-01-26, CERT-360caa42-fca2a594-bf9ab596), the one the walk caught.
   * From DigiCertEVRSACAG2.crt.
   */
  {
    name: 'DigiCert EV RSA CA G2',
    fingerprint256: '95:88:EF:74:19:9E:45:AC:EF:CC:CF:C0:C4:70:10:E9:F2:A3:7A:1D:D4:4C:61:A4:E1:C6:B3:34:DA:5A:F6:14',
    pem: `-----BEGIN CERTIFICATE-----
MIIFPDCCBCSgAwIBAgIQAWePH++IIlXYsKcOa3uyIDANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0yMDA3MDIxMjQyNTBaFw0zMDA3MDIxMjQyNTBaMEQxCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxHjAcBgNVBAMTFURpZ2lDZXJ0IEVWIFJT
QSBDQSBHMjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAK0eZsx/neTr
f4MXJz0R2fJTIDfN8AwUAu7hy4gI0vp7O8LAAHx2h3bbf8wl+pGMSxaJK9ffDDCD
63FqqFBqE9eTmo3RkgQhlu55a04LsXRLcK6crkBOO0djdonybmhrfGrtBqYvbRat
xenkv0Sg4frhRl4wYh4dnW0LOVRGhbt1G5Q19zm9CqMlq7LlUdAE+6d3a5++ppfG
cnWLmbEVEcLHPAnbl+/iKauQpQlU1Mi+wEBnjE5tK8Q778naXnF+DsedQJ7NEi+b
QoonTHEz9ryeEcUHuQTv7nApa/zCqes5lXn1pMs4LZJ3SVgbkTLj+RbBov/uiwTX
tkBEWawvZH8CAwEAAaOCAgswggIHMB0GA1UdDgQWBBRqTlC/mGidW3sgddRZAXlI
ZpIyBjAfBgNVHSMEGDAWgBROIlQgGJXm427mD/r6uRLtBhePOTAOBgNVHQ8BAf8E
BAMCAYYwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMBIGA1UdEwEB/wQI
MAYBAf8CAQAwNAYIKwYBBQUHAQEEKDAmMCQGCCsGAQUFBzABhhhodHRwOi8vb2Nz
cC5kaWdpY2VydC5jb20wewYDVR0fBHQwcjA3oDWgM4YxaHR0cDovL2NybDMuZGln
aWNlcnQuY29tL0RpZ2lDZXJ0R2xvYmFsUm9vdEcyLmNybDA3oDWgM4YxaHR0cDov
L2NybDQuZGlnaWNlcnQuY29tL0RpZ2lDZXJ0R2xvYmFsUm9vdEcyLmNybDCBzgYD
VR0gBIHGMIHDMIHABgRVHSAAMIG3MCgGCCsGAQUFBwIBFhxodHRwczovL3d3dy5k
aWdpY2VydC5jb20vQ1BTMIGKBggrBgEFBQcCAjB+DHxBbnkgdXNlIG9mIHRoaXMg
Q2VydGlmaWNhdGUgY29uc3RpdHV0ZXMgYWNjZXB0YW5jZSBvZiB0aGUgUmVseWlu
ZyBQYXJ0eSBBZ3JlZW1lbnQgbG9jYXRlZCBhdCBodHRwczovL3d3dy5kaWdpY2Vy
dC5jb20vcnBhLXVhMA0GCSqGSIb3DQEBCwUAA4IBAQBSMgrCdY2+O9spnYNvwHiG
+9lCJbyELR0UsoLwpzGpSdkHD7pVDDFJm3//B8Es+17T1o5Hat+HRDsvRr7d3MEy
o9iXkkxLhKEgApA2Ft2eZfPrTolc95PwSWnn3FZ8BhdGO4brTA4+zkPSKoMXi/X+
WLBNN29Z/nbCS7H/qLGt7gViEvTIdU8x+H4l/XigZMUDaVmJ+B5d7cwSK7yOoQdf
oIBGmA5Mp4LhMzo52rf//kXPfE3wYIZVHqVuxxlnTkFYmffCX9/Lon7SWaGdg6Rc
k4RHhHLWtmz2lTZ5CEo2ljDsGzCFGJP7oT4q6Q8oFC38irvdKIJ95cUxYzj4tnOI
-----END CERTIFICATE-----`,
  },
  // Not pinned: DigiCert SHA2 Extended Validation Server CA (under DigiCert High Assurance EV Root CA), which issued
  // PayPal's webhook certificates up to early 2026. Node 22.23.3 no longer trusts that root, so on an up-to-date server
  // that path cannot be checked whatever is pinned; the current sandbox certificate (2026-01-27) is issued under G2.
];
