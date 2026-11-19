/**
 * THE SERVER HALF: the only file the engine loads from this add-on
 * (`dist/server.js`, the manifest's `lead-source@1` entry). It exports
 * `createLeadSource`, which the engine calls once per call and per source.
 */
export { createLeadSource, SOURCES, type SourceId } from './server/index.ts';
