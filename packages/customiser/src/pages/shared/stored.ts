/**
 * THE ADD-ON'S STORED FILES, AS THE SHOP'S SCREENS READ THEM.
 *
 * A file column holds the stored file's id (or its content address). The
 * shop's screens are inside the dashboard, signed in, so a file is read from
 * the dashboard's own files route, never from a link anyone could open. What
 * is read here: the shop's font files (to set words in them, and to draw
 * their outlines), a piece's outline, and a customer's logo or photo.
 */
import type { Painted } from '../../draw/canvas.ts';

/** The stored file a column's value names: a bare id, or its content address. */
const FILE = /^(?:(file_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26})$|.*\/api\/v1\/files\/(file_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26})\/content\/?(?:\?.*)?$)/;

/** The stored file's id, or none for a value that names no file. */
export function fileIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = FILE.exec(value.trim());
  return match === null ? null : (match[1] ?? match[2] ?? null);
}

/** Where the signed-in dashboard reads a stored file. */
export function fileAddress(value: unknown): string | null {
  const id = fileIdOf(value);
  return id === null ? null : `/api/v1/files/${id}/content`;
}

/** A stored file's bytes, or none when it cannot be read. */
export async function fileBytes(value: unknown): Promise<Uint8Array | null> {
  const address = fileAddress(value);
  if (address === null) return null;
  try {
    const answer = await fetch(address, { credentials: 'same-origin' });
    return answer.ok ? new Uint8Array(await answer.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** A stored file as a picture to paint, or none when it does not load. */
export async function filePicture(value: unknown): Promise<(Painted & { url: string }) | null> {
  const address = fileAddress(value);
  if (address === null || typeof Image === 'undefined') return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight, url: address });
    image.onerror = () => resolve(null);
    image.src = address;
  });
}

/**
 * The name a shop's font is loaded under in the dashboard: its family behind
 * the Customiser's own prefix. The dashboard is set in fonts of its own (one
 * of them is Manrope, a starter font too), and a shop's file loaded under the
 * real name would compete with the dashboard's face for every word on the
 * page. What draws in a shop's font names it by this.
 */
export const shopFamily = (family: string): string => `cz-${family}`;

/** Each family's face in the page, by the stored file it was loaded from. */
const loaded = new Map<string, { file: string; face: FontFace | null }>();

/**
 * The shop's font files for these families loaded into the page, under
 * `shopFamily`, so words are set and painted in them. Each file once: a
 * family whose file was replaced is loaded again from the new one (the old
 * face taken out), and one that failed is tried again on the next call.
 */
export async function loadFamilies(fonts: readonly { family: string; file: unknown }[], families: ReadonlySet<string>): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) return;
  for (const font of fonts) {
    if (!families.has(font.family)) continue;
    const file = fileIdOf(font.file);
    const address = fileAddress(font.file);
    if (file === null || address === null || loaded.get(font.family)?.file === file) continue;
    const before = loaded.get(font.family)?.face ?? null;
    loaded.set(font.family, { file, face: null });
    try {
      const face = await new FontFace(shopFamily(font.family), `url(${JSON.stringify(address)}) format("woff2")`).load();
      if (before !== null) document.fonts.delete(before);
      document.fonts.add(face);
      loaded.set(font.family, { file, face });
    } catch {
      // A font that does not load is painted in its fallback, and asked for again next time; the files say so when they are made.
      if (loaded.get(font.family)?.file === file) loaded.set(font.family, { file: '', face: before });
    }
  }
}

/** Forget every face loaded: for tests, which load into one page after another. */
export function forgetLoadedFamilies(): void {
  loaded.clear();
}

const facts = new Map<string, Promise<{ name: string | null; size: number | null }>>();

/** A stored file's name and size as the dashboard's files route says them (its headers), asked once a file. */
export function storedFacts(value: unknown): Promise<{ name: string | null; size: number | null }> {
  const address = fileAddress(value);
  if (address === null || typeof fetch === 'undefined') return Promise.resolve({ name: null, size: null });
  let found = facts.get(address);
  if (found === undefined) {
    found = fetch(address, { method: 'HEAD', credentials: 'same-origin' })
      .then((answer) => {
        if (!answer.ok) return { name: null, size: null };
        const disposition = answer.headers.get('content-disposition') ?? '';
        const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
        const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)?.[1];
        const length = Number(answer.headers.get('content-length'));
        return { name: star !== undefined ? decodeURIComponent(star) : (plain ?? null), size: Number.isFinite(length) && length > 0 ? length : null };
      })
      .catch(() => ({ name: null, size: null }));
    facts.set(address, found);
  }
  return found;
}
