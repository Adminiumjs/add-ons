/**
 * THE CUSTOMER'S EDITOR, AS A SHOP APP MOUNTS IT.
 *
 * A shop app's customer pages vendor this entry from the released add-on and
 * mount its components with React of their own: Adminium serves no add-on
 * code to a visitor. The screens are themed by the app's colours and type
 * through the CSS variables it sets (`--accent`, `--surface`, `--fg`, …, the
 * comps' tokens), with the editor's own stylesheet beside this file
 * (`editor.css`), every class `cz-`.
 *
 * ```tsx
 * const api = customiserApi({ shop: client, link: () => createPublicClient({ baseUrl, publishableKey: keys['customiser-link'] })!, baseUrl });
 * <CustomiserEditor api={api} base={product.base_id} product={{ name: product.name, price: '£34.00', unit: 'set of 4' }}
 *   price={{ total: '£40.00', note: 'Order by 17:00 and we post it by Tue 11 Aug' }}
 *   onDesignChange={({ used }) => reprice(used)} onAddToBasket={(design) => addLine(design.code, design.used)} />
 * ```
 *
 * - `CustomiserEditor`: choose a design, fill it in, check it, save it and
 *   come back, add it to the basket.
 * - `YourDesigns`: the designs this browser holds, and those an order names.
 * - `WaysIn`: a print shop's three ways in, for its product page.
 * - `openSavedLink`, `readDesigns`, `heldDesign`, `hasSavedDesigns`,
 *   `designRefusal`: what the app's own routes call (the e-mailed link's
 *   page, the order lookup, keeping a design's session, the header's "Your
 *   designs", a refused order). The editor keeps nothing in the browser's
 *   storage: the app keeps the sessions it is handed, where it keeps its own.
 */
import './editor.css';

export { DESIGN_FORMAT } from '../rules/index.ts';
export type { DesignValues, PartValue, Refusal } from '../rules/index.ts';
export { customiserApi, REFS } from './api.ts';
export type { CatalogueRows, ClientLike, CustomiserApi, CustomiserClients, DesignData, HeldSession, SavedDesign } from './api.ts';
export { CustomiserEditor } from './ui/Editor.tsx';
export type { CustomiserEditorProps, DesignForBasket, EditorPrice, EditorQuantity } from './ui/Editor.tsx';
export { YourDesigns } from './ui/YourDesigns.tsx';
export type { YourDesignsProps } from './ui/YourDesigns.tsx';
export { WaysIn } from './ui/WaysIn.tsx';
export type { WaysInProps } from './ui/WaysIn.tsx';
export { hasSavedDesigns, heldDesign, liveDesigns, openSavedLink, readDesigns } from './store.ts';
export type { HeldDesign } from './store.ts';
export { designRefusal } from './refusal.ts';
export { LOCALES } from './i18n.ts';
