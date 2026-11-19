/**
 * WHAT EVERY SOURCE SHARES: the one way it calls out, how it reads an answer,
 * and how it cuts what it found to the sizes the contract allows.
 *
 * A source calls out ONLY through `context.http`, the client the engine
 * hands it, narrowed to that source's own hosts. It never touches a global
 * `fetch`. Every call checks the stop signal before it goes and races it
 * while it waits, so Stop ends a look-up at once even when the client the
 * engine handed over is slow to give up.
 */
import type { LeadSourceContext, LeadSourceError, LeadSourceHttpResponse } from '@adminium/add-on-contracts';

/** The user agent the registers are asked with: France asks callers to name themselves. */
export const USER_AGENT = 'Adminium-LeadFinder/1 (+https://adminium.dev/lead-finder)';

/** The error a stopped call throws, as `fetch` does. */
function stoppedError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('The look-up was stopped.', 'AbortError');
}

/** Throws when the call was stopped: the first line of every question a source answers. */
export function halt(signal: AbortSignal): void {
  if (signal.aborted) throw stoppedError(signal);
}

/** The work, or the stop, whichever comes first. */
function racing<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(stoppedError(signal));
    signal.addEventListener('abort', stop, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', stop);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', stop);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** One GET through the engine's client: stopped before it goes, and while it waits. */
export async function ask(context: LeadSourceContext, url: string, headers: Record<string, string> = {}): Promise<LeadSourceHttpResponse> {
  halt(context.signal);
  const answer = await racing(context.http(url, { method: 'GET', headers: { accept: 'application/json', ...headers } }), context.signal);
  halt(context.signal);
  return answer;
}

/** The body as JSON, or null when it is not JSON. */
export async function jsonOf(response: LeadSourceHttpResponse, signal: AbortSignal): Promise<unknown> {
  const text = await racing(response.text(), signal);
  halt(signal);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** A refusal in the contract's shape. */
export function refusal(code: LeadSourceError['code'], message: string, retryAfterSeconds?: number): LeadSourceError {
  return retryAfterSeconds === undefined ? { ok: false, code, message } : { ok: false, code, message, retryAfterSeconds };
}

/** `Retry-After` in seconds, when the service sent it as a number (a date form is left to the engine's default pause). */
export function retryAfterOf(response: LeadSourceHttpResponse): number | undefined {
  const value = response.headers.get('retry-after')?.trim();
  if (value === undefined || !/^\d{1,5}$/.test(value)) return undefined;
  return Math.min(Number(value), 86_400);
}

/** A record of an answer, or an empty one: the services' answers are read field by field, never trusted whole. */
export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A list of an answer, or an empty one. */
export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A text of an answer, trimmed and cut to `max`; undefined when there is none. */
export function words(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text === '') return undefined;
  return [...text].slice(0, max).join('').trim();
}

/** Texts joined with ", ", the empty ones left out; undefined when none is left. */
export function joined(parts: readonly unknown[], max: number): string | undefined {
  return words(
    parts
      .map((part) => words(part, max))
      .filter((part): part is string => part !== undefined)
      .join(', '),
    max,
  );
}

/** The plain form of a name a comparison reads: no accents, no case, letters and digits only. */
export function plain(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * A company's website as an https address: a bare domain gets `https://`, an
 * `http://` one is asked for over https instead. Anything that is not a web
 * address of a named host, or is longer than the contract keeps, is left out.
 */
export function httpsSite(value: unknown): string | undefined {
  const text = words(value, 2048);
  if (text === undefined || /\s/.test(text)) return undefined;
  const bare = text.replace(/^https?:\/\//i, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare)) return undefined;
  let url: URL;
  try {
    url = new URL(`https://${bare}`);
  } catch {
    return undefined;
  }
  if (!url.hostname.includes('.') || url.username !== '' || url.password !== '') return undefined;
  const href = url.pathname === '/' && url.search === '' && url.hash === '' ? url.origin : url.href;
  return href.length > 2048 ? undefined : href;
}

/** An https address as given, or undefined: a link the card draws must be https. */
export function httpsLink(value: unknown): string | undefined {
  const text = words(value, 2048);
  if (text === undefined) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** An ISO 3166-1 alpha-2 code, upper case, or undefined. */
export function countryCode(value: unknown): string | undefined {
  const text = words(value, 2)?.toUpperCase();
  return text !== undefined && /^[A-Z]{2}$/.test(text) ? text : undefined;
}

/** The fields of a found address, each cut to the contract's size; undefined when none is there. */
export function addressOf(parts: { lines?: string | undefined; town?: string | undefined; region?: string | undefined; postalCode?: string | undefined; country?: string | undefined }): { lines?: string; town?: string; region?: string; postalCode?: string; country?: string } | undefined {
  const out: { lines?: string; town?: string; region?: string; postalCode?: string; country?: string } = {};
  const lines = words(parts.lines, 500);
  const town = words(parts.town, 120);
  const region = words(parts.region, 120);
  const postalCode = words(parts.postalCode, 20);
  const country = countryCode(parts.country);
  if (lines !== undefined) out.lines = lines;
  if (town !== undefined) out.town = town;
  if (region !== undefined) out.region = region;
  if (postalCode !== undefined) out.postalCode = postalCode;
  if (country !== undefined) out.country = country;
  return Object.keys(out).length === 0 ? undefined : out;
}

/** A query string from the values that are set. */
export function query(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(name, String(value));
  return params.toString();
}

/** A page cursor this source gave: a whole number at least `min`, or null when it is none. */
export function cursorOf(cursor: string | null, min: number): number | null {
  if (cursor === null) return min;
  return /^\d{1,6}$/.test(cursor) && Number(cursor) >= min ? Number(cursor) : null;
}

/** An officer's role, as a person reads it ("llp-designated-member" → "Llp designated member"). */
export function roleWords(value: unknown): string | undefined {
  const text = words(typeof value === 'string' ? value.replace(/[-_]+/g, ' ') : value, 100);
  return text === undefined ? undefined : `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
}

/** Whether an answer of a step is a refusal. */
export function isRefusal(value: unknown): value is LeadSourceError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}
