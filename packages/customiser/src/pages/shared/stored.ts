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

const asked = new Set<string>();

/** The shop's font files for these families loaded into the page, once each, so words are set and painted in them. */
export async function loadFamilies(fonts: readonly { family: string; file: unknown }[], families: ReadonlySet<string>): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) return;
  for (const font of fonts) {
    if (!families.has(font.family) || asked.has(font.family)) continue;
    const address = fileAddress(font.file);
    if (address === null) continue;
    asked.add(font.family);
    try {
      const face = new FontFace(font.family, `url(${JSON.stringify(address)}) format("woff2")`);
      document.fonts.add(await face.load());
    } catch {
      // A font that does not load is painted in its fallback; the files say so when they are made.
    }
  }
}

