/** The editor's stylesheet: bundled beside the entry as its own file, never read as code. */
declare module '*.css';
/** A stylesheet read as text, for a screen that puts it into the page itself (the shop's preview of the editor). */
declare module '*.css?inline' {
  const css: string;
  export default css;
}
