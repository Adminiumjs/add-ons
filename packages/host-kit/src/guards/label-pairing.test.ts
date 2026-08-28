/**
 * Both halves of the affiliation rule, driven.
 *
 * @vitest-environment jsdom
 *
 * The rendered half needs a DOM and says so with the pragma above rather than
 * with a glob in `vite.config.ts`, for the reason that file records: a pragma
 * travels WITH the file when the install script vendors it and a config entry
 * does not.
 *
 * The case that earns this file is the first one. A page-wide `textContent`
 * version of the same walk passed while a planted "Ships with DHL" sat on 31
 * surfaces of a live app, and it passed for a reason nobody would guess from
 * reading it: `textContent` runs adjacent elements together with no separator,
 * so the mark ends up inside a longer word and the boundary rule says nothing.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  affiliationFindings,
  carriesDisclaimer,
  marksNamedIn,
  namesMark,
  surfaceStrings,
} from './label-pairing.ts';
import { syntheticHost, type SyntheticHost } from './synthetic-host.ts';

let host: SyntheticHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
});

const MARKS = [{ mark: 'DHL', owner: 'its owner' }, { mark: 'Canva', owner: 'its owner' }];
const DOCK = '.sx-dock';

function surface(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('reading a surface the way a reader reads it', () => {
  it('sees a mark that a page-wide textContent would run into the next word', () => {
    /*
     * THE MEASURED DEFECT, reproduced. A heading ending in the carrier's name,
     * followed immediately by the shop's own name, is the single run
     * "DHLMarlow Press" to `textContent` — and the boundary rule then reads the
     * mark as part of a longer word and reports nothing.
     */
    const root = surface('<h3>Ships with DHL</h3><span>Marlow Press</span>');
    expect(root.textContent).toContain('DHLMarlow');
    expect(namesMark(root.textContent ?? '', 'DHL')).toBe(false);

    // A TEXT NODE is a string somebody wrote, so its edges are real edges.
    expect(marksNamedIn(surfaceStrings(root, DOCK), MARKS)).toEqual(['DHL']);
  });

  it('reads the four attributes a person also reads', () => {
    // An `aria-label` is what a screen-reader user is TOLD the button is.
    const root = surface('<button aria-label="Import from Canva"></button>');
    expect(marksNamedIn(surfaceStrings(root, DOCK), MARKS)).toEqual(['Canva']);
  });

  it('leaves the reviewer’s control strip out, and only that', () => {
    /*
     * The dock is a row of toggle chips floating over every view, each labelled
     * with an add-on's name. Two of those names contain a mark, so a scan
     * including it would report every surface in the app in eight languages and
     * be switched off inside a week. It is the ONLY exclusion.
     */
    const root = surface('<div class="sx-dock"><button>DHL Shipping</button></div><p>Orders</p>');
    expect(marksNamedIn(surfaceStrings(root, DOCK), MARKS)).toEqual([]);
    // …and the same chip anywhere else on the page is in scope.
    const elsewhere = surface('<div class="sx-panel"><button>DHL Shipping</button></div>');
    expect(marksNamedIn(surfaceStrings(elsewhere, DOCK), MARKS)).toEqual(['DHL']);
  });

  it('does not remove the dock from the live tree', () => {
    // Removing it for real would change what the next assertion in the host's
    // own suite sees, which is why the walk works on a clone.
    const root = surface('<div class="sx-dock">chips</div>');
    surfaceStrings(root, DOCK);
    expect(root.querySelector(DOCK)).not.toBeNull();
  });
});

describe('the boundary rule', () => {
  it('drops a run of Latin letters inside a word', () => {
    // A plain `includes` reported a print works' own product list, in English
    // only: **Canva**s prints. That is the shop's product and not anybody's
    // mark, and a gate reporting it on five screens teaches a reader to skim.
    expect(namesMark('Canvas prints, 40 × 60', 'Canva')).toBe(false);
    expect(namesMark('Bring it from Canva', 'Canva')).toBe(true);
  });

  it('keeps a mark that a non-Latin script runs straight up against', () => {
    // `\b` does not mean what anybody wants it to mean in two of the eight
    // languages, which is why the rule is about LATIN letters specifically.
    expect(namesMark('Canva 带进来', 'Canva')).toBe(true);
    expect(namesMark('من Canva مباشرة', 'Canva')).toBe(true);
  });
});

describe('finding the line on a surface', () => {
  const LINES = ['Adminium is not affiliated with this company.'];

  it('accepts it split across two elements, because the reader still met it', () => {
    const root = surface('<p>Adminium is not affiliated</p><p> with this company.</p>');
    // Deliberately the opposite of how a MARK is looked for: a sentence broken
    // across two keys is still a sentence, and a mark broken across two
    // elements was never one word.
    expect(carriesDisclaimer(surfaceStrings(root, DOCK), LINES)).toBe(true);
  });

  it('refuses a surface that carries no line at all', () => {
    const root = surface('<h3>Bring it from Canva</h3>');
    expect(carriesDisclaimer(surfaceStrings(root, DOCK), LINES)).toBe(false);
    expect(marksNamedIn(surfaceStrings(root, DOCK), MARKS)).toEqual(['Canva']);
  });

  it('accepts an add-on’s own wording, not only the host’s', () => {
    // An add-on's copy is written and reviewed in the add-on's repository. In
    // Danish one host says "dette firma" and one add-on says "dette selskab";
    // both are right and neither is a copy of the other.
    const root = surface('<p>Adminium er ikke tilknyttet dette selskab.</p><h3>Canva</h3>');
    const lines = ['Adminium er ikke tilknyttet dette firma.', 'Adminium er ikke tilknyttet dette selskab.'];
    expect(carriesDisclaimer(surfaceStrings(root, DOCK), lines)).toBe(true);
  });
});

describe('the source sweep', () => {
  it('finds nothing in a host whose components pair the two', () => {
    host = syntheticHost();
    expect(affiliationFindings(host.config)).toEqual([]);
  });

  it('finds the surface nobody thought of', () => {
    /*
     * THE HALF THE RENDERED WALK CANNOT DO. Three dialogs carried the line
     * correctly and the shelf card, the fourth surface, did not — and a rule
     * held by naming surfaces cannot see the surface nobody thought of.
     */
    host = syntheticHost({
      files: {
        'src/screens/Shelf.tsx':
          'export const Card = () => (<article><h3>{addOn.name}</h3><p>{addOn.monogram}</p></article>);\n',
      },
    });
    const found = affiliationFindings(host.config);
    expect(found.map((f) => f.file)).toEqual(['src/screens/Shelf.tsx']);
  });

  it('says nothing about a component that names no add-on', () => {
    host = syntheticHost({
      files: { 'src/screens/Orders.tsx': 'export const Orders = () => <p>{order.ref}</p>;\n' },
    });
    expect(affiliationFindings(host.config)).toEqual([]);
  });

  it('honours an exemption, and only where one is written down', () => {
    const files = {
      'src/components/DemoDock.tsx':
        'export const Dock = () => <button>{addOn.shortName}</button>;\n',
    };
    host = syntheticHost({
      files,
      affiliationExempt: {
        'src/components/DemoDock.tsx':
          'the reviewer’s control strip, not the shop’s chrome: a row of toggle chips, and a ' +
          'paragraph inside a chip is not a surface',
      },
    });
    expect(affiliationFindings(host.config)).toEqual([]);

    // …and without the entry, the same file is a finding. An exemption is a
    // decision somebody wrote down, never a place a gate happens not to look.
    host.dispose();
    host = syntheticHost({ files });
    expect(affiliationFindings(host.config).map((f) => f.file)).toEqual([
      'src/components/DemoDock.tsx',
    ]);
  });

  it('does not read a mention inside a comment as a rendering', () => {
    host = syntheticHost({
      files: {
        'src/screens/Notes.tsx':
          '// one day this will print addOn.name\nexport const Notes = () => <p>x</p>;\n',
      },
    });
    expect(affiliationFindings(host.config)).toEqual([]);
  });
});
