/**
 * The SERVER half — everything the host loads outside a browser.
 *
 * `manifest.json` names two built files and no more: `addOn.slots[].client`
 * points at the bundle built from `index.ts`, and `addOn.provides[].server`
 * plus `addOn.demoTransport` point at the bundle built from this file. That is
 * the same two-file shape `shipping-dhl` settles on, so a reader who has seen
 * one add-on's `dist/` knows where to look in the next one.
 *
 * NOTHING HERE MAY REACH A RENDERER OR A DOM. The `artwork-source@1`
 * implementation is loaded by a host that has no React tree — in a connected
 * install, potentially no browser either — so an `import … from "react"`
 * anywhere in this graph would turn the client/server split into a naming
 * convention. `built-output.test.ts` asserts that over the built bytes rather
 * than trusting this comment.
 *
 * The vendor endpoints live here too, and only here. §5.6 gives the OAuth flow
 * to the HOST: the add-on declares an authorize URL, a token URL and two
 * scopes, and the host performs the exchange. A page therefore has no use for
 * any of them, and `index.ts` deliberately does not re-export them.
 */

export { createCanvaSource, toArtworkRef, ADD_ON_KEY, type Chooser } from "./source.ts";
export {
  createDemoTransport,
  DEMO_ACCOUNT,
  DEMO_AUTHORIZED_ON,
  type CanvaDesign,
  type CanvaExport,
  type CanvaTransport,
  type Clock,
  type Refit,
} from "./demo/transport.ts";
export {
  assessImport,
  coverScale,
  requiredSize,
  scaleToCover,
  SAFE_AREA_MM,
  type ImportAssessment,
  type ImportRemedy,
  type ImportVerdict,
} from "./import.ts";
export {
  OAUTH,
  VENDOR_API_HOST,
  VENDOR_NAME,
  CONSENT_PERMISSIONS,
  type AuthorizedHttpClient,
} from "./oauth.ts";
export type { ArtworkRef, ArtworkSource, JobSpec } from "@adminium/add-on-host/contracts";
