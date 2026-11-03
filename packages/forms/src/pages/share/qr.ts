/**
 * A FORM'S QR CODE: the code of its link, made by Adminium's own encoder for
 * a page's address (`@adminium/public-client/qr`, up to 256 bytes), the
 * same code a ticket's door reads. Never a second encoder.
 *
 * The tab shows the SVG as a picture, and offers it as a file, and as a PNG
 * drawn from that same SVG on a canvas: three views of one code.
 */
import { QR_PAGE_MAX_BYTES, QR_QUIET, qrMatrix, qrSvg } from '@adminium/public-client/qr';

export { QR_PAGE_MAX_BYTES };

/** Pixels a module takes in the PNG file. */
export const PNG_MODULE_PX = 12;

export interface FormQr {
  /** The SVG document, as the file holds it. */
  svg: string;
  /** Modules across, the quiet zone included. */
  modules: number;
}

/** The code of a link, or null when the link is too long for one. */
export function qrOf(link: string): FormQr | null {
  try {
    const modules = qrMatrix(link, { page: true }).length + 2 * QR_QUIET;
    return { svg: qrSvg(link, { page: true }), modules };
  } catch (caught) {
    if (caught instanceof RangeError) return null;
    throw caught;
  }
}

/** The SVG as a picture's address: no page markup is made from it. */
export const pictureOf = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The file names: `<slug>-qr.png`, `<slug>-qr.svg`. */
export const qrFileName = (slug: string, kind: 'png' | 'svg'): string => `${slug}-qr.${kind}`;

/** Hand the browser a file to save. */
export function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const svgFile = (qr: FormQr): Blob => new Blob([qr.svg], { type: 'image/svg+xml' });

/** The PNG: the SVG drawn on a canvas, `PNG_MODULE_PX` a module, on white. */
export function pngFile(qr: FormQr): Promise<Blob> {
  const size = qr.modules * PNG_MODULE_PX;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgFile(qr));
    const picture = new Image(size, size);
    const done = (): void => URL.revokeObjectURL(url);
    picture.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const pen = canvas.getContext('2d');
      if (pen === null) {
        done();
        reject(new Error('No canvas to draw on.'));
        return;
      }
      pen.imageSmoothingEnabled = false;
      pen.fillStyle = '#fff';
      pen.fillRect(0, 0, size, size);
      pen.drawImage(picture, 0, 0, size, size);
      done();
      canvas.toBlob((blob) => (blob === null ? reject(new Error('The canvas made no file.')) : resolve(blob)), 'image/png');
    };
    picture.onerror = () => {
      done();
      reject(new Error('The code could not be drawn.'));
    };
    picture.src = url;
  });
}
