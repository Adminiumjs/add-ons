/** A stylesheet read as its text, by the build (`?raw`), to be put on the page by `styles.ts`. */
declare module '*.css?raw' {
  const text: string;
  export default text;
}
