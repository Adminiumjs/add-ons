/**
 * The HTTP seam.
 *
 * Add-on server code never receives raw `fetch` (24 D14). It receives a client
 * the host built and bound to the hostnames in this add-on's manifest
 * `addOn.network.allow`; a call to anything else is refused, audited and shown
 * to the admin. Declaring the seam as an interface rather than reaching for the
 * global is what makes that enforceable — and it is also what lets the real
 * transport run the conformance suite offline, against a fake.
 *
 * There is no `fetch` in this repo. Grep for it: the only network code is
 * whatever the host passes in here.
 */

export interface HttpRequest {
  method: "GET" | "POST" | "DELETE";
  /** Path and query only. The client owns the origin — the add-on cannot change it. */
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  /** Parsed JSON, or `undefined` for an empty body. */
  body?: unknown;
}

export interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}

/**
 * Credentials, as the host injects them into the SERVER context and nowhere
 * else (24 D15).
 *
 * These two settings are marked `secret: true` in the manifest, are absent from
 * `publicSettings`, and are therefore never handed to a client bundle. Nothing
 * under `src/ui/` imports this type, and that is a rule rather than an
 * accident: the packer greps the client bundle for the keys of secret settings.
 */
export interface CarrierCredentials {
  apiKey: string;
  accountNumber: string;
}
