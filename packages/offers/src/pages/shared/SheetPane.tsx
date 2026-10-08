/**
 * THE PART OF A SHEET A PERSON WORKS IN.
 *
 * The host's `SheetBody` is a bare row that fills what the header and footer
 * leave and clips what does not fit: it has no padding and does not scroll,
 * because a sheet may lay several panes side by side in it. A sheet with one
 * column of fields needs one pane that pads and scrolls — this.
 */
import type { ReactNode } from 'react';

import { SheetBody } from './host.ts';

export function SheetPane({ children }: { children: ReactNode }) {
  return (
    <SheetBody>
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </SheetBody>
  );
}
