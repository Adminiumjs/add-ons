/**
 * A PAGE'S ADDRESS: made from its name, and never one another page holds.
 *
 * The last part of a page's address (`/x/pages/<slug>`) follows the landing
 * slug rule: lower-case letters, digits and dashes (`LANDING_SLUG`), never a
 * word the addresses themselves use. No two pages share one: the table keeps
 * it unique, so a new page or a copy asks for the first one nobody holds.
 *
 * The shape is judged here, as it is typed. The words the addresses keep for
 * themselves (`LANDING_SLUGS_RESERVED`) are Adminium's to judge, and the page
 * carries no copy of them: the list spells words the add-ons' release sweep
 * refuses in a built file. Once an address is saved, the status read says
 * whether Adminium takes it as a page's address (`page.slug` is null when it
 * does not: {@link addressRefused}), and the publish seal refuses one it does
 * not take (`landing-slug`).
 */
import { LANDING_SLUG, LANDING_SLUG_MAX } from '@adminium/add-on-contracts/landing';

/** Whether a slug has the shape of a page's address. */
export const isPageSlug = (value: unknown): value is string => typeof value === 'string' && LANDING_SLUG.test(value);

/**
 * Whether Adminium refuses the page's saved address: the status read of the
 * page names no slug while the row holds one. Unknown (no status yet) is not
 * a refusal.
 */
export function addressRefused(status: { page: { slug: string | null } | null } | null, saved: string): boolean {
  return status !== null && status.page !== null && saved !== '' && status.page.slug === null;
}

/** The address a name reads as: "Spring open day" → `spring-open-day`; a name with no Latin letter reads as `page`. */
export function slugOf(name: string): string {
  const made = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LANDING_SLUG_MAX - 4)
    .replace(/-+$/g, '');
  return isPageSlug(made) ? made : 'page';
}

/** What a typed address becomes as it is typed: spaces to dashes, capitals to lower case, nothing else changed. */
export const typedSlug = (typed: string): string => typed.toLowerCase().replace(/\s+/g, '-').slice(0, LANDING_SLUG_MAX);

/**
 * The first of `base`, `base-2`, `base-3` … that no page holds, asking
 * `taken` for each in turn; null after twenty tries.
 */
export async function freeSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string | null> {
  const start = isPageSlug(base) ? base : 'page';
  for (let n = 1; n <= 20; n += 1) {
    const suffix = n === 1 ? '' : `-${String(n)}`;
    const slug = `${start.slice(0, LANDING_SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (isPageSlug(slug) && !(await taken(slug))) return slug;
  }
  return null;
}
