/**
 * A FORM'S LINK NAME AT ITS FIRST PUBLISH.
 *
 * A new form has a random link name (`form-k3x9qz`). The first time it is
 * published it takes a readable one made from its title in its own language
 * (ASCII letters and digits, joined by dashes), and keeps it for good after:
 * a link printed on a flyer must keep working. It stays random when the title
 * gives nothing readable, when the words are one an address reserves, or when
 * another form has them already.
 *
 * TODO(0.3.41): import `isFormSlug`, `FORM_SLUG_MAX` and
 * `FORM_SLUGS_RESERVED` from `@adminium/add-on-contracts/forms` once the
 * floor is 0.3.41; until then the one rule is written out here, word for word
 * as Adminium's door holds it.
 */
export const FORM_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
export const FORM_SLUG_MAX = 80;
export const FORM_SLUGS_RESERVED: readonly string[] = ['api', 'surveys'];

/** Whether a form may have this slug: it keeps the rule, and is no reserved word. */
export function isFormSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && FORM_SLUG.test(slug) && !FORM_SLUGS_RESERVED.includes(slug);
}

/** The readable link name a title gives, or null when it gives none Adminium would serve. */
export function readableSlug(title: string): string | null {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, FORM_SLUG_MAX)
    .replace(/-+$/, '');
  return isFormSlug(slug) ? slug : null;
}

/**
 * The link name a form goes live with: its own when it has been live before,
 * else the title's readable one if nobody has it, else its own.
 */
export function slugAtPublish(current: string, firstPublish: boolean, title: string, taken: (slug: string) => boolean): string {
  if (!firstPublish) return current;
  const readable = readableSlug(title);
  return readable === null || readable === current || taken(readable) ? current : readable;
}
