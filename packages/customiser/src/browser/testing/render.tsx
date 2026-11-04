/**
 * What the editor's tests share: a stub of the public API over the samples,
 * a page as wide as a desktop or a phone, and a wait for the catalogue.
 */
import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

/** The page's width, as the editor's media query reads it: a phone below 900 px. */
export function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = max === null ? false : width <= Number(max[1]);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

export const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** Draw a screen and wait until its catalogue has loaded (the loading state is gone). */
export async function drawn(element: ReactElement): Promise<ReturnType<typeof render>> {
  const out = render(element);
  await settle();
  await settle();
  // A status still showing may be the loading one (or, on a page without WebGL, the 3D stage's note): one more moment.
  if (screen.queryAllByRole('status', { name: '' }).length > 0) await settle();
  return out;
}

/** Wait, a moment at a time, until something holds: a file is read and sent over several moments. */
export async function settleUntil(holds: () => boolean, moments = 60): Promise<void> {
  for (let at = 0; at < moments && !holds(); at += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  if (!holds()) throw new Error('it never held');
}

/**
 * A page that draws pictures, as a browser does and the test page does not:
 * every picture decodes at `px`, and a canvas hands back `light` (a lightness
 * a pixel, 0 black to 255 white) as its pixels. Gives the page back as it was.
 */
export function drawsPictures(px: readonly [number, number], light?: (x: number, y: number) => number): () => void {
  const saved = { Image: globalThis.Image, create: URL.createObjectURL, revoke: URL.revokeObjectURL, context: HTMLCanvasElement.prototype.getContext, toBlob: HTMLCanvasElement.prototype.toBlob };
  let made = 0;
  URL.createObjectURL = () => `blob:test/${String((made += 1))}`;
  URL.revokeObjectURL = () => {};
  class Decoded {
    naturalWidth = px[0];
    naturalHeight = px[1];
    width = px[0];
    height = px[1];
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  globalThis.Image = Decoded as unknown as typeof Image;
  HTMLCanvasElement.prototype.getContext = function context(this: HTMLCanvasElement) {
    const canvas = this;
    return {
      drawImage: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y += 1)
          for (let x = 0; x < w; x += 1) {
            const value = light === undefined ? 255 : light(x, y);
            data.set([value, value, value, 255], (y * w + x) * 4);
          }
        return { data, width: w, height: h };
      },
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: () => {},
      canvas,
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function toBlob(done: BlobCallback) {
    setTimeout(() => done(new Blob(['png'], { type: 'image/png' })), 0);
  };
  return () => {
    globalThis.Image = saved.Image;
    URL.createObjectURL = saved.create;
    URL.revokeObjectURL = saved.revoke;
    HTMLCanvasElement.prototype.getContext = saved.context;
    HTMLCanvasElement.prototype.toBlob = saved.toBlob;
  };
}
