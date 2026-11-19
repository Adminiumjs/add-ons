/**
 * A HANDWRITTEN SERVICE FOR THE ADAPTERS' TESTS: answers by address, the
 * requests it was asked, and the context a source is built with. No test
 * reaches a real register or service, and no key here is shaped like a real
 * one: each is a plain phrase (`test-key-companies-1`).
 */
import type { LeadSourceContext, LeadSourceHttpClient, LeadSourceHttpResponse } from '@adminium/add-on-contracts';

/** The keys the handwritten services accept. */
export const KEYS = {
  companiesHouse: 'test-key-companies-1',
  openCorporates: 'test-key-opencorporates-1',
  hunter: 'test-key-hunter-1',
} as const;

/** A response with a status, a JSON body and headers. */
export function reply(status: number, body: unknown = {}, headers: Record<string, string> = {}): LeadSourceHttpResponse {
  const lower = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return { status, headers: { get: (name) => lower.get(name.toLowerCase()) ?? null }, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) };
}

/** One request a source made. */
export interface Asked {
  url: URL;
  headers: Record<string, string>;
}

/** What a route answers: a response, or undefined for a 404. */
export type Route = (url: URL, headers: Record<string, string>) => LeadSourceHttpResponse | undefined;

/** A client that answers through `route` and writes down every request. */
export function service(route: Route): { http: LeadSourceHttpClient; asked: Asked[]; respond: (url: URL, init?: { headers?: Record<string, string> }) => LeadSourceHttpResponse } {
  const asked: Asked[] = [];
  const respond = (url: URL, init?: { headers?: Record<string, string> }) => {
    const headers = Object.fromEntries(Object.entries(init?.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
    asked.push({ url, headers });
    return route(url, headers) ?? reply(404, { errors: [{ error: 'not found' }] });
  };
  const http: LeadSourceHttpClient = (url, init) => Promise.resolve(respond(new URL(url), init));
  return { http, asked, respond };
}

/** The context the engine builds a source with. */
export function contextFor(source: string, key: string | null, http: LeadSourceHttpClient, signal: AbortSignal = new AbortController().signal, locale = 'en-US'): LeadSourceContext {
  return { source, key, http, signal, locale };
}
