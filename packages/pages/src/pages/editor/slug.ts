/**
 * A PAGE'S ADDRESS: made from its name, and never one another page holds.
 *
 * The last part of a page's address (`/x/pages/<slug>`) follows the landing
 * slug rule (`isLandingSlug`): lower-case letters, digits and dashes, never a
 * word the addresses themselves use. No two pages share one: the table keeps
 * it unique, so a new page or a copy asks for the first one nobody holds.
 */
import { isLandingSlug, LANDING_SLUG_MAX } from '@adminium/add-on-contracts/landing';

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
  return isLandingSlug(made) ? made : 'page';
}

/** What a typed address becomes as it is typed: spaces to dashes, capitals to lower case, nothing else changed. */
export const typedSlug = (typed: string): string => typed.toLowerCase().replace(/\s+/g, '-').slice(0, LANDING_SLUG_MAX);

/**
 * The first of `base`, `base-2`, `base-3` … that no page holds, asking
 * `taken` for each in turn; null after twenty tries.
 */
export async function freeSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string | null> {
  const start = isLandingSlug(base) ? base : 'page';
  for (let n = 1; n <= 20; n += 1) {
    const suffix = n === 1 ? '' : `-${String(n)}`;
    const slug = `${start.slice(0, LANDING_SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (isLandingSlug(slug) && !(await taken(slug))) return slug;
  }
  return null;
}
