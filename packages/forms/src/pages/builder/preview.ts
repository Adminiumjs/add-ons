/**
 * WHERE THE PREVIEW IS DRAWN FROM.
 *
 * Adminium draws the saved draft of a form, whatever its state, at
 * `/x/forms/<slug>?preview=1` for a signed-in person who may read the
 * add-on's forms: the very page a stranger gets, with Send off and nothing
 * sent. It may be framed by this host alone, so the address is on the
 * dashboard's own origin, never the public one.
 *
 * TODO(0.3.41): the preview mode is Adminium 0.3.41's. On 0.3.40 the frame
 * draws "This form is not available" for a draft.
 */
export function previewAddress(origin: string, slug: string, lang: string): string {
  return `${origin}/x/forms/${encodeURIComponent(slug)}?preview=1&lang=${encodeURIComponent(lang)}`;
}
