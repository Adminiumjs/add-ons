/**
 * THE SERVER HALF: what the engine loads from this add-on (`calendar-provider@1`).
 * It is handed a client that adds the bearer header, and never holds a token.
 */
export { createCalendarProvider } from './provider.ts';
