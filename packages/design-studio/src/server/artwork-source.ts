/**
 * The SERVER HALF of this add-on — `provides[0].server` in `manifest.json`.
 *
 * WHY THIS FILE EXISTS AS A SEPARATE ENTRY. An add-on declares two kinds of
 * entry point (24 §5.3): a `server` path per provided contract, and a `client`
 * path per filled slot. Until this file landed, the manifest named a server
 * path that the build never emitted, so the split those two fields describe was
 * a claim about the repo rather than a fact about the artefact — nothing failed
 * if the halves quietly merged. `built-output.test.ts` now builds the repo and
 * asserts both paths exist, so a rename on either side is a red test.
 *
 * WHAT IS AND IS NOT IN HERE. Everything below is the pure half: the document
 * engine, the six starting layouts, the eight-locale bundle and the
 * `artwork-source@1` implementation. There is NO React, no JSX, no DOM and no
 * icon set — `built-output.test.ts` greps the built file for exactly that, and
 * `sources.test.ts` walks the import graph a build earlier. That is what makes
 * "the client half is the only half that renders" checkable.
 *
 * The one thing worth being honest about: `createArtworkSource` takes its
 * `open` function by injection, and in THIS add-on the shop's own browser is
 * what supplies it — the editor is in-browser and there is no network call at
 * any point (D11). The server half is therefore the provider registration plus
 * the engine a Phase B install would run when it re-derives a design record or
 * a preview without a browser in the loop (24 §5.10), not a second copy of the
 * editor.
 */

export {
  MAX_AREA_SQM,
  MAX_SIDE_MM,
  KEY,
  createArtworkSource,
  type ArtworkSourceDeps,
  type StartDoc,
} from "../artworkSource.ts";

export {
  BLEED_MM,
  OUTPUT_DPI,
  SAFE_MM,
  outsideSafeArea,
  toArtworkFile,
  toArtworkRef,
  toDesignRecord,
  type DesignRecord,
  type Doc,
} from "../doc.ts";

export { LAYOUTS, LAYOUT_IDS, docFromLayout, layoutForSize } from "../layouts.ts";

export { designStudioStrings, translator } from "../i18n/strings.ts";

export type { ArtworkRef, ArtworkSource, AvailabilityVerdict, JobSpec } from "@adminium/add-on-host/contracts";
