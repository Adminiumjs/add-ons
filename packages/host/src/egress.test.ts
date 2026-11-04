/**
 * AN XML NAMESPACE IS AN IDENTIFIER, NEVER AN ADDRESS.
 *
 * A drawing names the SVG namespace; a 3MF names the package's and the 3D
 * model's. Neither is fetched, so the address gate lets the exact namespace
 * origins past, and nothing else on those hosts' neighbours.
 */
import { describe, expect, it } from 'vitest';

import { offendingAddresses } from './testing/egress.ts';

describe('the address gate and XML namespaces', () => {
  it('lets the SVG and 3MF namespaces past', () => {
    const text = [
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
      '<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"/>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    ].join('\n');
    expect(offendingAddresses(text, [])).toEqual([]);
  });

  it('still finds a real address beside them', () => {
    expect(offendingAddresses('fetch("https://cdn.example.net/three.js")', [])).toEqual(['https://cdn.example.net/three.js']);
  });
});
