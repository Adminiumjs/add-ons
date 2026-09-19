// SPDX-License-Identifier: AGPL-3.0-only
/**
 * This page's own words, handed to the host.
 *
 * They used to be a namespace in the engine's catalogue, loaded by the engine's
 * deferred-namespace machinery. They belong to this package now, so the host is
 * handed them instead: `registerMessages` takes them, returns a translator
 * bound to them, and the host never has to carry a string for a screen it does
 * not host.
 *
 * ─── The reader downloads one language, not eight ──────────────────────────
 *
 * All eight locales in one module is 191 KiB of which seven eighths is waste on
 * every open. So en-US is eager — it is the FALLBACK, and a key the reader's
 * language has not translated still has to render a word — and the other seven
 * are chunks fetched on demand.
 *
 * `pageMessagesReady()` is what the page awaits before its first paint, the
 * same choreography the engine used when these strings were its own: the
 * alternative is a translated reader watching English strings swap to their own
 * language a beat later.
 */
import { registerMessages } from '@adminium/add-on-contracts/runtime/app';

import { EN_US, LOCALE_CHUNKS } from './strings/index.js';

/**
 * Registered with English immediately, so a render that somehow beats the
 * loader still shows words rather than dotted keys.
 */
export const t = registerMessages('invoices', { 'en-US': EN_US });

/** `de-DE` from `de-DE`, `de` or `de-AT` — the host stamps a BCP-47 tag. */
function chunkFor(lang: string): (() => Promise<{ default: Record<string, string> }>) | null {
  if (LOCALE_CHUNKS[lang] !== undefined) return LOCALE_CHUNKS[lang];
  const base = lang.split('-')[0];
  const match = Object.keys(LOCALE_CHUNKS).find((tag) => tag.split('-')[0] === base);
  return match === undefined ? null : (LOCALE_CHUNKS[match] ?? null);
}

const loaded = new Map<string, Promise<void>>();

/**
 * Resolve once the reader's language is registered. Memoised per language, so
 * it is safe to call on every render and usable with `use()`.
 */
export function pageMessagesReady(): Promise<void> {
  const lang = typeof document === 'undefined' ? 'en-US' : document.documentElement.lang || 'en-US';
  const pending = loaded.get(lang);
  if (pending !== undefined) return pending;

  const chunk = chunkFor(lang);
  const promise =
    chunk === null
      ? Promise.resolve()
      : chunk()
          .then((mod) => {
            registerMessages('invoices', { [lang]: mod.default });
          })
          /*
           * A chunk that will not load is a page in English, not a page that
           * refuses to render. This promise is consumed by `use()`, so a
           * rejection would replace the screen with an error boundary over a
           * language file.
           */
          .catch(() => undefined);

  loaded.set(lang, promise);
  return promise;
}
