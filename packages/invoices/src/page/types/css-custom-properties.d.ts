// SPDX-License-Identifier: AGPL-3.0-only
// React's `CSSProperties` does not type `--*` keys, and this page passes CSS
// custom properties through the style attribute — the sanctioned escape hatch
// from the no-style-prop rule. The UI kit carries the same augmentation in its
// SOURCE, where `charts` and `widgets` each keep their own copy too; it is not
// in the published `dist`, because a public package that augments a global
// interface changes types for every consumer whether they wanted it or not.
// So this is a fourth copy, and deliberately local to this package.
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
