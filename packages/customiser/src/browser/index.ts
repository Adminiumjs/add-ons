/**
 * THE CUSTOMER'S EDITOR, AS A SHOP APP IMPORTS IT.
 *
 * A shop app's customer pages import this entry
 * (`@adminiumjs/add-on-customiser/browser`) into their own bundle, at the
 * range the app pins: Adminium serves no add-on code to a visitor. The
 * screens are themed by the app's own colours and type, through the CSS
 * variables the app sets, so each shop looks like itself.
 *
 * The editor itself is not written yet. What is here is the entry and its
 * build, so the apps' wiring can be made against it: the version of the
 * design data the editor saves.
 */
export { DESIGN_FORMAT } from '../rules/index.ts';
