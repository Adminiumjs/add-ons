/**
 * The company grep, driven — over a line, and over a whole synthetic host.
 *
 * The line-level cases prove the rule bites. The tree-level ones prove the
 * guard is pointed at the right files, which is the half a rule cannot check
 * for itself: a `vendorDir` off by one directory makes every finding disappear
 * and every case pass.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { INSTALL_LAYOUT } from '../config.ts';
import {
  brandFindings,
  guardHalfImportsIn,
  vendorImportLine,
  COMPANY_NAMES,
} from './brand.ts';
import { codeOf, ownShippedFiles } from './files.ts';
import { syntheticHost, type SyntheticHost } from './synthetic-host.ts';

let host: SyntheticHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
});

describe('the company grep', () => {
  it('reports the three firms that were really on a host’s shelf', () => {
    host = syntheticHost();
    const allowed = vendorImportLine(host.config);
    for (const line of [
      "    name: 'Royal Mail Shipping',",
      "    name: 'Stripe Payments',",
      "    name: 'Mailchimp Lists',",
    ]) {
      expect(brandFindings('registry.ts', line, allowed), line).toHaveLength(1);
    }
  });

  it('says nothing about a description that names nobody', () => {
    host = syntheticHost();
    expect(
      brandFindings('shelf.ts', "  name: 'A second delivery company',", vendorImportLine(host.config)),
    ).toEqual([]);
  });

  it('forgives the vendored import and only that shape', () => {
    host = syntheticHost();
    const allowed = vendorImportLine(host.config);
    const line = "import { register as shippingDhl } from './vendor/shipping-dhl/index.ts';";
    expect(brandFindings('registry.ts', line, allowed)).toEqual([]);
    // A deeper reach into the add-on is a host reading its internals.
    expect(
      brandFindings('r.ts', "import { rates } from './vendor/shipping-dhl/rates.ts';", allowed),
    ).toHaveLength(1);
    // A bare specifier is a different rule and is not forgiven here.
    expect(
      brandFindings('r.ts', "import { register } from '@adminium/add-on-shipping-dhl';", allowed),
    ).toHaveLength(1);
    // And a display string in the same file is exactly what a file-level
    // exemption would have waved through.
    expect(brandFindings('registry.ts', "const carrier = 'DHL';", allowed)).toHaveLength(1);
  });

  it('derives the allowed shape from this host’s own vendor directory', () => {
    // A hard-coded `vendor/` would stop forgiving anything in a host that
    // called the directory something else — a red suite on correct code, which
    // is how a gate earns an exemption list.
    host = syntheticHost();
    const moved = {
      ...host.config,
      vendorDir: `${host.config.srcDir}/add-ons/third-party`,
    };
    const allowed = vendorImportLine(moved);
    expect(
      brandFindings('r.ts', "import { register as x } from './third-party/canva/index.ts';", allowed),
    ).toEqual([]);
    expect(
      brandFindings('r.ts', "import { register as x } from './vendor/canva/index.ts';", allowed),
    ).toHaveLength(1);
  });

  it('leaves a run of letters inside a word alone', () => {
    // `ups` inside "groups" is the reason this rule is word-anchored where the
    // vocabulary ban deliberately is not: there is no release grep behind this
    // one to be weaker than, and an unreadable report is a report nobody acts on.
    expect(COMPANY_NAMES.test('grouped by size')).toBe(false);
    expect(COMPANY_NAMES.test('collected by UPS')).toBe(true);
  });

  it('reports the line number, so a reader is sent to the right place', () => {
    const source = ['const a = 1;', '', "const carrier = 'FedEx';"].join('\n');
    host = syntheticHost();
    const found = brandFindings('registry.ts', source, vendorImportLine(host.config));
    expect(found.map((f) => f.line)).toEqual([3]);
  });
});

describe('the guard-half import ban', () => {
  it('reports a shipped file reaching into the guards, or into zod', () => {
    const found = (code: string): number => guardHalfImportsIn(code, INSTALL_LAYOUT.guards).length;
    expect(found("import { SUBSTRING_BANNED } from '../testing/kit/guards/lexicon.ts';")).toBe(1);
    expect(found("import { z } from 'zod';")).toBe(1);
  });

  it('leaves the runtime half alone, which is the half that is meant to ship', () => {
    const found = (code: string): number => guardHalfImportsIn(code, INSTALL_LAYOUT.guards).length;
    expect(found("import { AddOnSlot } from '../add-ons/kit/AddOnSlot.tsx';")).toBe(0);
    expect(found("import { slotRuleBlock } from '../add-ons/kit/styles.ts';")).toBe(0);
  });
});

describe('over a whole host', () => {
  it('finds nothing in a clean one', () => {
    host = syntheticHost();
    const allowed = vendorImportLine(host.config);
    const offenders = ownShippedFiles(host.config).flatMap((file) =>
      brandFindings(file, codeOf(file), allowed),
    );
    expect(offenders).toEqual([]);
  });

  it('finds a planted company name in the host’s own source', () => {
    host = syntheticHost({
      files: { 'src/add-ons/shelf.ts': "export const shelf = [{ name: 'Stripe Payments' }];\n" },
    });
    const allowed = vendorImportLine(host.config);
    const offenders = ownShippedFiles(host.config).flatMap((file) =>
      brandFindings(file, codeOf(file), allowed),
    );
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.text).toContain('Stripe');
  });

  it('says nothing about the same name inside a VENDORED add-on', () => {
    /*
     * The vendored halves are the add-ons themselves. They name their own
     * companies nominatively, with a TRADEMARKS.md beside the claim in their
     * own repositories, and a host lint-banning them would be banning the
     * add-on rather than the defect.
     */
    host = syntheticHost({
      files: {
        'src/add-ons/vendor/shipping-example/ui.tsx':
          "export const Tile = () => <p>Ships with DHL</p>;\n",
      },
    });
    const allowed = vendorImportLine(host.config);
    const offenders = ownShippedFiles(host.config).flatMap((file) =>
      brandFindings(file, codeOf(file), allowed),
    );
    expect(offenders).toEqual([]);
  });

  it('does not report a company named only in a comment', () => {
    // The caller strips comments, and a guard's own prose necessarily names the
    // things it forbids — this package's `brand.ts` names nine of them.
    host = syntheticHost({
      files: { 'src/notes.ts': '// this one used to say Royal Mail\nexport const x = 1;\n' },
    });
    const allowed = vendorImportLine(host.config);
    const offenders = ownShippedFiles(host.config).flatMap((file) =>
      brandFindings(file, codeOf(file), allowed),
    );
    expect(offenders).toEqual([]);
  });

  it('would report a whole file it could not read as empty', () => {
    // The guard on the guard, from the other side: a host whose sources the
    // walk cannot reach produces no findings AND no files, and the guard's own
    // first case is what tells those two apart.
    host = syntheticHost();
    const wrong = { ...host.config, srcDir: `${host.config.rootDir}/not-src` };
    expect(ownShippedFiles(wrong)).toEqual([]);
    expect(ownShippedFiles(host.config).length).toBeGreaterThan(0);
  });
});

describe('the derived shape itself', () => {
  it('is anchored at both ends', () => {
    const config = syntheticHost();
    try {
      const allowed = vendorImportLine(config.config);
      expect(
        allowed.test("import { register as x } from './vendor/shipping-dhl/index.ts';"),
      ).toBe(true);
      // Trailing text is not the same line.
      expect(
        allowed.test("import { register as x } from './vendor/shipping-dhl/index.ts'; // DHL"),
      ).toBe(false);
      expect(brandFindings('x.ts', "const x = 'dhl';", allowed)).toHaveLength(1);
    } finally {
      config.dispose();
    }
  });
});
