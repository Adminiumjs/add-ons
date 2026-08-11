/**
 * The server half — `addOn.provides[0].server` in `manifest.json`.
 *
 * WHAT IT IS FOR, AND WHY IT EXISTS IN AN ADD-ON THAT KEEPS NO SECRET. The
 * other two halves of this wave split so that credentials stay off the browser
 * (24 D15). This one has none to keep: `connect: { kind: "none" }`, no
 * `network.allow`, nothing to authenticate to. The split here is a PACKAGING
 * boundary — a host that wants a production file for a batch of order lines
 * wants the geometry and none of the React, and this is that file: the metric
 * table, the cut alphabet, `check`, `toProductionPaths` and the contract
 * implementation, with no renderer anywhere in it.
 *
 * `built-output.test.ts` asserts exactly that: `dist/server.js` carries the
 * engine and contains no React, no JSX runtime and no icon set. The two rollup
 * passes duplicate the engine into both files rather than hoisting it into a
 * shared chunk, which is the trade D7 asks for — one bundle per half, and the
 * host serves the client one from its own origin.
 */

export { createProductPersonalizer, KEY, drawProduction, productionBytes } from '../personalizer.ts';
export {
  check,
  fit,
  isRequired,
  previewSvg,
  productionSvg,
  settingsFor,
  sizeRange,
  toProductionPaths,
  digestOf,
  LAYER_COLOUR,
  type Check,
  type Fit,
  type ProductionFile,
  type ProductionPath,
} from '../template.ts';
export { FACES, FACE_IDS, FACE_LIST, faceOf, lineWidthMm, type Face, type FaceId } from '../faces.ts';
export { PIECES, MATERIALS, pieceFor, type Piece } from '../pieces.ts';
export {
  COASTER_TEMPLATE,
  SIGN_TEMPLATE,
  TEMPLATES,
  SAMPLE_LINES,
  sampleFor,
  sampleThat,
  templateFor,
} from '../seed.ts';
