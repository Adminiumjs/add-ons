/**
 * `product-personalizer@1`, implemented.
 *
 * The contract is five methods and this file is the whole of them. Everything
 * they do is in `template.ts`; what lives here is the seam — turning the
 * engine's pure results into the shapes the host stores and hands around, and
 * holding the two little stores the host will one day replace with tables.
 *
 * ── THE STORES ARE MAPS, AND THAT IS THE SEAM ───────────────────────────────
 *
 * `render` returns a `PreviewRef` — a file id — and `productionFile` returns a
 * `FileRef`. In a real install both are rows in the host's file store, written
 * through `files:write`, which is the one write scope this add-on asks for. In
 * the demo they are two `Map`s keyed by the content digest, and every surface
 * that wants the actual bytes asks for them by id. The seam does not change
 * when the store does; only where `bytes.get(id)` reads from.
 *
 * KEYED BY DIGEST, NOT BY A COUNTER. Two identical personalizations produce one
 * entry, one id and one picture — which is criterion 17 expressed as storage
 * rather than as an assertion, and it is why the cart thumbnail and the proof
 * cannot drift apart even if the code that asked for them did.
 *
 * ── `open` RESOLVES THROUGH THE HOST ────────────────────────────────────────
 *
 * The contract's `open` is a promise the shopper's surface settles. This add-on
 * is a set of slot fills rather than a modal it drives itself, so `open` hands
 * back a promise and the surface calls `settle` when the shopper presses "Use
 * this" or backs out. A headless caller — the conformance suite — gets the
 * initial personalization straight back, because there is nobody to ask.
 */

import type { FileRef } from '@adminium/add-on-host/contracts';
import type {
  Personalization,
  PreviewRef,
  ProductPersonalizer,
  ProductRef,
  Template,
  Verdict,
} from '@adminium/add-on-host/contracts';

import { templateFor } from './seed.ts';
import {
  check,
  digestOf,
  previewSvg,
  productionSvg,
  type PreviewOptions,
} from './template.ts';

export const KEY = 'personalizer';

/** Every picture this add-on has drawn, by file id. */
const previews = new Map<string, string>();
/** Every production file it has written, by file id. */
const production = new Map<string, string>();

export function previewBytes(fileId: string): string | undefined {
  return previews.get(fileId);
}

export function productionBytes(fileId: string): string | undefined {
  return production.get(fileId);
}

/** The demo's stores, emptied — what a suite wants between cases. */
export function resetFiles(): void {
  previews.clear();
  production.clear();
}

/**
 * THE OPTIONS THE THREE SURFACES OF CRITERION 17 DRAW WITH — one object, so
 * "the same picture" is a fact about the code rather than a promise about it.
 *
 * `widthPx` IS PART OF THE BYTES. `previewSvg` writes `width="184"` into the
 * string it returns and `digestOf` hashes exactly those bytes, so a thumbnail
 * asked for at 184 and a proof asked for at 240 are two different pictures with
 * two different file ids — which is precisely what criterion 17 forbids across
 * the cart line, the proof and the order line. They therefore do not choose:
 * `LinePicture` in `ui/bits.tsx` takes no options at all and passes this, and
 * a surface that wants to show it larger scales the SVG with CSS, which changes
 * no byte.
 *
 * The shopper's editing canvas is deliberately NOT one of the three. It draws
 * at 520 with the maker's guides and the failing areas outlined, because it is
 * a different job — you are choosing there, not approving.
 */
export const LINE_PICTURE: PreviewOptions = { angle: 'front', widthPx: 184 };

/**
 * The picture for a personalization, as bytes plus the id it is stored under.
 *
 * EVERY SURFACE IN THIS ADD-ON GOES THROUGH HERE, and until this repair that
 * sentence was in this header and was false: the four React surfaces all called
 * `previewSvg` directly, through `Preview` in `ui/bits.tsx`, so nothing they
 * drew was ever stored and the id that travelled on an order was written by a
 * different call than the one the shopper looked at. The two agreed only
 * because the same pure function sat under both — which is a coincidence of the
 * arguments, not an invariant, and criterion 17 rests on the invariant.
 *
 * `Preview` calls this now, so drawing a picture and filing it are one act. The
 * store is keyed by the DIGEST, so a re-render of unchanged values writes the
 * same entry it already held: the map is bounded by the number of distinct
 * pictures rather than by the number of renders.
 */
export function drawPreview(
  p: Personalization,
  t: Template,
  opts: PreviewOptions,
): { fileId: string; svg: string; digest: string } {
  const svg = previewSvg(p, t, opts);
  const digest = digestOf(svg);
  const fileId = `prv_${digest}`;
  previews.set(fileId, svg);
  return { fileId, svg, digest };
}

export function drawProduction(p: Personalization, t: Template): { fileId: string; svg: string } {
  const svg = productionSvg(p, t);
  const fileId = `prd_${digestOf(svg)}`;
  production.set(fileId, svg);
  return { fileId, svg };
}

type Settle = (value: Personalization | null) => void;

/** The surface's end of `open`, set while a shopper has the panel open. */
let pending: Settle | null = null;

export function settleOpen(value: Personalization | null): void {
  const settle = pending;
  pending = null;
  settle?.(value);
}

export function createProductPersonalizer(): ProductPersonalizer {
  return {
    key: KEY,

    available(product: ProductRef) {
      const template = templateFor(product.productKey);
      if (template === undefined) {
        // A REASON, NOT A THROW. The host asks this to decide whether to offer
        // the surface at all, and "this piece has no areas drawn on it yet" is
        // an ordinary state of a shop that has just connected the add-on — it
        // is the empty state comp L draws, not an error.
        return { ok: false, reason: 'this piece has no personalization areas yet' };
      }
      if (template.zones.length === 0) {
        return { ok: false, reason: 'this piece has no personalization areas yet' };
      }
      return { ok: true };
    },

    async open(product: ProductRef, initial?: Personalization) {
      const template = templateFor(product.productKey);
      if (template === undefined) return null;
      const start: Personalization = initial ?? {
        templateId: template.productKey,
        values: {},
        font: template.zones[0]?.constraints.fonts?.[0],
        finish: template.zones[0]?.finish,
      };
      // Nobody is driving the surface — a suite, a server half, a script. The
      // honest answer is what they came in with rather than a promise that
      // never settles.
      if (pending === null && typeof document === 'undefined') return start;
      return new Promise<Personalization | null>((resolve) => {
        pending = resolve;
      });
    },

    async render(p: Personalization, opts: { angle: string; widthPx: number }): Promise<PreviewRef> {
      const template = templateFor(p.templateId);
      if (template === undefined) {
        throw new Error(`no template for ${p.templateId}`);
      }
      const drawn = drawPreview(p, template, opts);
      return {
        fileId: drawn.fileId,
        angle: opts.angle,
        widthPx: opts.widthPx,
        digest: drawn.digest,
      };
    },

    async productionFile(p: Personalization): Promise<FileRef> {
      const template = templateFor(p.templateId);
      if (template === undefined) {
        throw new Error(`no template for ${p.templateId}`);
      }
      const drawn = drawProduction(p, template);
      return {
        fileId: drawn.fileId,
        // `.svg`, and never `.ttf`/`.otf`/`.woff`. The extension is the first
        // thing the conformance suite looks at and the last thing that would
        // catch an implementation shipping a face beside its geometry.
        filename: `${template.productKey}-${drawn.fileId}.svg`,
        mediaType: 'image/svg+xml',
        bytes: drawn.svg.length,
      };
    },

    validate(p: Personalization, t: Template): Verdict[] {
      return check(p, t).verdicts;
    },
  };
}
