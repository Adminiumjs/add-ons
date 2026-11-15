/**
 * THE SERVER HALF: the only file the engine loads from this add-on.
 *
 * The engine imports the built `dist/server.js` and calls
 * `createCardTerminal({ http, credentials, mode })` once per operation
 * (`card-terminal@1`). There is no client half: pairing and the readers list
 * are Adminium's own screens (Studio → Payments → Card readers), so the access
 * token never reaches a browser.
 */

export { createCardTerminal, createSquareTerminal, SQUARE_ADD_ON_KEY, SQUARE_HOSTS, SQUARE_VERSION, type SquareTerminalOptions } from './terminal.ts';
