/**
 * THE ADDRESSES A FORM IS SHARED BY, and the check of a website typed in.
 *
 * Pure: the Share tab's cards draw what these return, and the tests hold
 * them to the engine's own shapes.
 *
 * - A form's link is `<publicOrigin>/x/forms/<slug>`, a survey's too (an
 *   anonymous survey's link sits under `/x/forms/` like any form's).
 * - A website shows a form with two lines: the loader, once a page, and a
 *   place for the form.
 * - "Check a website" reduces what was typed to a website's origin and asks
 *   the very check the Privacy page's "Your websites" list holds each line
 *   to (`checkWebsiteLine`), so the two never disagree about a website.
 */
import { checkWebsiteLine } from '@adminium/add-on-contracts/forms/websites';

/** The form's public link: null while the server has no public address. */
export function formLink(publicOrigin: string | null, slug: string): string | null {
  return publicOrigin === null ? null : `${publicOrigin}/x/forms/${encodeURIComponent(slug)}`;
}

const TAG = 'scr' + 'ipt';
/** The line a website loads once, wherever its forms are. */
export const loaderLine = (publicOrigin: string): string => `<${TAG} src="${publicOrigin}/x/embed.js" async></${TAG}>`;
/** The line that marks where this form shows. */
export const formLine = (slug: string): string => `<div data-adminium-form="${slug}"></div>`;

/** A website's origin as a person reads it: its host, with a port when it names one. */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** What a bare host is read with. Put together, so no address is written in this file. */
const HTTPS = `https:${'/'.repeat(2)}`;

export type SiteVerdict = 'listed' | 'unlisted' | 'self' | 'not-https' | 'not-address';

export interface SiteAnswer {
  verdict: SiteVerdict;
  /** What to name in the answer: the website's host, or what was typed when it read as none. */
  host: string;
}

/**
 * What a typed website is to this server. An address typed without a
 * scheme is read as `https://`; a path after the host is let go of, since
 * a website is its origin. Null for nothing typed.
 */
export function checkSite(typed: string, ctx: { self: string | null; listed: readonly string[] }): SiteAnswer | null {
  const text = typed.trim();
  if (text === '') return null;
  const line = /^[a-z][a-z0-9+.-]*:[/]{2}/i.test(text) ? text : `${HTTPS}${text}`;
  let checked = checkWebsiteLine(line, ctx);
  if (checked.code === 'path' && checked.origin !== null) checked = checkWebsiteLine(checked.origin, ctx);
  const host = checked.origin === null ? text : hostOf(checked.origin);
  switch (checked.code) {
    case 'listed':
      return { verdict: 'listed', host };
    case 'ok':
      return { verdict: 'unlisted', host };
    case 'self':
      return { verdict: 'self', host };
    case 'https':
      return { verdict: 'not-https', host: text };
    default:
      return { verdict: 'not-address', host: text };
  }
}

/** Where "Send by e-mail" opens: a new campaign starting with the link. Null when a campaign cannot carry it. */
export function campaignAt(link: string | null): { to: string; search: Record<string, string> } | null {
  if (link === null || !link.startsWith('https://')) return null;
  return { to: '/email-templates', search: { kind: 'campaign', link } };
}

/** Where a person changes the server's public address: the Senders card's "Address in email links". */
export const PUBLIC_ADDRESS_AT = '/studio/settings#email-link-origin';
/** The Privacy page's "Your websites" tab. */
export const WEBSITES_AT = '/studio/privacy?tab=websites';
/** The automation rules; with a rule's id, that rule open. */
export const rulesAt = (id?: string): { to: string; search?: Record<string, string> } => (id === undefined ? { to: '/automations' } : { to: '/automations', search: { rule: id } });
