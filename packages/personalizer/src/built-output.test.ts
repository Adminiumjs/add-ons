/**
 * The gate over the ARTEFACT rather than over the sources.
 *
 * Three of this wave's rules are claims about files that do not exist until
 * something is built:
 *
 *  1. `manifest.json` names entry points. Nothing was checking that the build
 *     emits them, and a manifest field naming a file no build writes is a 404
 *     at install time that nothing catches before then.
 *
 *  2. Criterion 16 asks that the preview is 2D "verifiable by grep over the
 *     BUILT BUNDLE, not just the source". A source check cannot see what a
 *     dependency dragged in; this one can.
 *
 *  3. The vocabulary ban (17 §2, 24 D10b) is a grep over BUILT output. Checking
 *     the string bundle catches the copy; it does not catch a class name, a
 *     minified identifier, or a comment that survived minification — and Vite's
 *     library build deliberately keeps comments so that pure annotations
 *     survive.
 *
 * IT DOES NOT ASSUME `dist/` IS FRESH. The build runs in vitest global setup
 * (`src/testing/dist.ts`, wired in `vite.config.ts`) once, before any worker
 * starts, because `manifest.test.ts` reads the same directory and two suites
 * racing to empty and rewrite it is a flake nobody can reproduce.
 */

import { describe, expect, it } from 'vitest';

import { foreignImportsIn, offendingAddresses, sendersIn } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json';
import { emittedFiles, readEmitted } from './testing/dist.ts';
import { ALLOWED_TOKENS, CARVE_OUTS, scanForBannedLexicon } from './testing/lexicon.ts';

const emitted = emittedFiles();

describe('the manifest’s entry points exist in the build output', () => {
  it('emits a file for every slot’s client path', () => {
    for (const fill of manifest.addOn.slots) {
      expect(emitted, `slot ${fill.slot} points at a file the build never wrote`).toContain(
        fill.client,
      );
    }
  });

  it('emits a file for every provided contract’s server path', () => {
    for (const provided of manifest.addOn.provides) {
      expect(
        emitted,
        `contract ${provided.contract} points at a file the build never wrote`,
      ).toContain(provided.server);
    }
  });

  it('emits nothing the manifest does not account for', () => {
    // `dist/client.css` is the one file the manifest cannot name — the slot
    // schema has no field for a stylesheet, and §5.7 item 2 has the host serve
    // it beside the bundle. Everything else here is declared above.
    expect(emitted).toEqual(['dist/client.css', 'dist/client.js', 'dist/server.js']);
  });

  it('emits no sourcemap, which would carry every source file into dist/', () => {
    expect(emitted.filter((file) => file.endsWith('.map'))).toEqual([]);
  });

  it('keeps the client half a SINGLE ESM bundle (D7)', () => {
    // A THIRD script is what a shared chunk looks like, and it is the exact
    // failure mode that makes this a two-pass build.
    const scripts = emitted.filter((file) => file.endsWith('.js'));
    expect(scripts).toEqual(['dist/client.js', 'dist/server.js']);
    expect(emitted.some((file) => /-[A-Za-z0-9_]{8}\.js$/.test(file))).toBe(false);
  });

  it('loads one bundle for all seven declared slots, because the host serves one', () => {
    expect(new Set(manifest.addOn.slots.map((fill) => fill.client))).toEqual(
      new Set(['dist/client.js']),
    );
  });
});

describe('the client/server split is real in the artefact (AC10)', () => {
  it('keeps React, the JSX runtime and the icon set out of the server half', () => {
    const server = readEmitted('dist/server.js');
    expect(server).not.toMatch(/from\s*["']react/);
    expect(server).not.toMatch(/react\/jsx-runtime/);
    expect(server).not.toMatch(/lucide-react/);
    expect(server).not.toMatch(/jsxDEV|jsxs?\(/);
  });

  it('puts the real engine in the server half rather than an empty re-export', () => {
    const server = readEmitted('dist/server.js');
    // The metric table alone is five arrays of ninety-five numbers, and the cut
    // alphabet is another seventy glyphs. If this file ever shrinks to a stub,
    // the contract it claims to provide is not in it.
    expect(server.length).toBeGreaterThan(20_000);
    expect(server).toContain('personalizer');
  });

  it('declares no import of anything outside the bundle', () => {
    const server = readEmitted('dist/server.js');
    const bare = [...server.matchAll(/\bfrom\s*["']([^."'][^"']*)["']/g)].map((m) => m[1]);
    expect(bare).toEqual([]);
  });
});

/**
 * CRITERION 16, OVER THE BUNDLE — AND AS A RULE ABOUT WHAT IT CAN DO.
 *
 * ── WHAT THE SIX PATTERNS THAT STOOD HERE COULD NOT SEE ────────────────────
 *
 * They were `/webgl/i`, three.js identifiers, `/\bgltf\b/i`, `/\.stl\b/i`,
 * `getContext(` and `measureText` — six literals, and D18's claim is that this
 * preview is a 2D composite and CANNOT be anything else. The gap is not
 * academic: the spec's own O7 names "a GLB with a UV-mapped zone" as the 3D
 * upgrade path D18 defers, and `.glb` is not `gltf`. Nor is `webgpu` `webgl`;
 * `/webgl/i` does not match it, and WebGPU is how a bundle would reach a GPU
 * today. Neither is CSS's own `transform-style: preserve-3d`, which needs no
 * library and no context at all.
 *
 * ── SO THE QUESTION IS WHAT THE BUNDLE CAN DO, IN FOUR CATEGORIES ──────────
 *
 * A bundle draws in 3D by doing at least one of four things, and each is stated
 * as the category rather than as the examples somebody remembered:
 *
 *   IT GETS A DRAWING SURFACE. `getContext(` is the one door to every canvas
 *   context there is — 2d, webgl, webgl2, bitmaprenderer — so banning the door
 *   covers the ones nobody has heard of yet. WebGPU has its own doors
 *   (`navigator.gpu`, `requestAdapter`), and a shader has its own vocabulary
 *   (`gl_FragColor`, `precision mediump`, WGSL's `@vertex`), which is evidence
 *   even where the door is spelt some other way.
 *
 *   IT READS OR WRITES A 3D MODEL. Every interchange format's MIME type begins
 *   `model/` — that is the category, in one string, and it covers formats that
 *   do not exist yet. The extensions are listed too, because a bundle names a
 *   file before it names a MIME type, and they are matched INSIDE A STRING
 *   LITERAL so that a minified `x.obj` property access is not a finding.
 *
 *   IT CARRIES A 3D RUNTIME. three.js, Babylon, and the linear algebra any of
 *   them is built out of.
 *
 *   OR IT ASKS THE BROWSER FOR 3D DIRECTLY, in CSS. `preserve-3d`,
 *   `perspective`, `matrix3d`, `translateZ`, `rotate3d` — no library, no
 *   context, and the old check did not read the stylesheet at all.
 *
 * `measureText` stays: it is not 3D, it is the other half of D18's claim — the
 * text metrics are a pure table in this package, never the platform's.
 */
const THREE_D_FORMATS = [
  'glb',
  'gltf',
  'obj',
  'stl',
  'fbx',
  'dae',
  '3mf',
  '3ds',
  'usdz',
  'ply',
  'x3d',
  'wrl',
  'step',
  'iges',
] as const;

const FORBIDDEN: readonly [string, RegExp][] = [
  // ── a drawing surface ────────────────────────────────────────────────────
  ['a canvas context of any kind', /getContext\s*\(/],
  ['a WebGL context', /webgl/i],
  ['a WebGPU device', /navigator\s*\.\s*gpu|requestAdapter|GPUDevice|GPUCanvasContext/i],
  ['shader source', /gl_FragColor|gl_Position|precision\s+(?:low|medium|high)p|@vertex|@fragment|\bwgsl\b/i],
  ['an offscreen surface', /OffscreenCanvas/],
  // ── a 3D model ───────────────────────────────────────────────────────────
  ['a 3D model MIME type', /\bmodel\//i],
  [
    'a 3D model file',
    new RegExp(`["'\`][^"'\`]*\\.(?:${THREE_D_FORMATS.join('|')})["'\`]`, 'i'),
  ],
  ['a 3D format named outright', /\bgltf\b|\busdz\b|\bglTF\b/i],
  // ── a 3D runtime ─────────────────────────────────────────────────────────
  ['the three.js runtime', /\bTHREE\b|BufferGeometry|PerspectiveCamera|WebGLRenderer/],
  ['the Babylon runtime', /BABYLON|babylonjs/i],
  ['3D linear algebra', /Matrix4|Quaternion|\bmat4\b|\bvec3\b/],
  // ── or the browser's own 3D ──────────────────────────────────────────────
  ['CSS 3D', /preserve-3d|matrix3d|translateZ|translate3d|rotate3d|rotateX|rotateY|\bperspective\b/i],
  // ── and the other half of D18's claim ────────────────────────────────────
  ['canvas text measurement', /measureText/],
];

describe('the preview is 2D in the artefact, not only in the source (AC16, D18)', () => {
  /*
   * THE STYLESHEET IS READ TOO, and it was not. CSS is the one place a bundle
   * can be three-dimensional with no code at all.
   */
  it.each(['dist/client.js', 'dist/server.js', 'dist/client.css'])(
    '%s carries none of them',
    (file) => {
      const bytes = readEmitted(file);
      for (const [what, pattern] of FORBIDDEN) {
        expect(pattern.test(bytes), `${file} contains ${what}`).toBe(false);
      }
    },
  );

  /*
   * EVERY PATTERN IS DRIVEN OVER THE THING IT FORBIDS. A guard whose matcher
   * has quietly stopped matching reports nothing forever, which is the failure
   * mode this whole file is a repair for — and the two that got past the last
   * version, `.glb` and WebGPU, are first in the list.
   */
  it('bites on each of them, so a green run above means something', () => {
    const mutants: [string, string][] = [
      ['a GLB, which O7 names as the 3D upgrade path', 'const model = "zone.glb";'],
      ['a WebGPU adapter', 'const a = await navigator.gpu.requestAdapter();'],
      ['a WGSL shader', '@vertex fn main() -> @builtin(position) vec4f {}'],
      ['a glTF by MIME type', 'blob.type === "model/gltf-binary"'],
      ['a USDZ', 'href = "coaster.usdz"'],
      ['an OBJ', 'const mesh = "mug.obj";'],
      ['a WebGL context', 'canvas.getContext("webgl2")'],
      ['three.js', 'new THREE.PerspectiveCamera(45, 1, 0.1, 1000)'],
      ['Babylon', 'const e = new BABYLON.Engine(canvas)'],
      ['a matrix', 'const m = new Matrix4();'],
      ['CSS 3D', '.lp-face{transform-style:preserve-3d;transform:rotateY(12deg)}'],
      ['text metrics from the platform', 'ctx.measureText(word).width'],
    ];
    for (const [what, sample] of mutants) {
      expect(
        FORBIDDEN.some(([, pattern]) => pattern.test(sample)),
        `nothing in FORBIDDEN matches ${what}: ${sample}`,
      ).toBe(true);
    }
  });

  /*
   * AND IT LETS THROUGH THE 2D COMPOSITE THIS ADD-ON ACTUALLY IS. A ban on
   * `\bvec3\b` or `\bperspective\b` that fired on the real bundle would be
   * switched off within a week, so the shapes it must stay quiet about are
   * driven as well.
   */
  it('says nothing about the flat drawing this add-on really makes', () => {
    for (const clean of [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30">',
      '<path d="M0 0 L10 10 Z" fill="currentColor"/>',
      'const file = "monogram.svg";',
      'style.transform = `translate(${x}px, ${y}px) rotate(${a}deg)`',
      'const width = glyphWidth(letter, face) * size;',
      'object.assign(job, { objective: "trim" })',
    ]) {
      const hits = FORBIDDEN.filter(([, pattern]) => pattern.test(clean)).map(([what]) => what);
      expect(hits, `reported on clean 2D code: ${clean}`).toEqual([]);
    }
  });

  it('does carry the SVG the composite is made of, so the check is not passing by being empty', () => {
    expect(readEmitted('dist/client.js')).toContain('http://www.w3.org/2000/svg');
  });
});

describe('the vocabulary ban, over built output (17 §2, 24 D10b)', () => {
  const GREPPED = /\.(js|css|html|map)$/;

  it('greps every emitted script, stylesheet, map and page — no file exempt', () => {
    // Guards the guard, twice over. If the build stops emitting CSS the suite
    // below would pass by having nothing to read; and if it ever emits a file
    // type this pattern does not cover, that file would be silently exempt.
    const scanned = emitted.filter((file) => GREPPED.test(file));
    expect(scanned).toEqual(emitted);
    expect(scanned).toEqual(['dist/client.css', 'dist/client.js', 'dist/server.js']);
  });

  it('finds no banned word that a carve-out does not explain', () => {
    const offences = emitted
      .filter((file) => GREPPED.test(file))
      .flatMap((file) => scanForBannedLexicon(file, readEmitted(file)))
      .map((offence) => `${offence.file} · “${offence.hit}” · …${offence.context}…`);
    expect(offences).toEqual([]);
  });

  /**
   * D10b's craft traps, which are wave 4b's own and are NOT in the release
   * sweep's seven. Two of them — the word for a thing that grows in a pot, and
   * the word for a cake with two layers — are words a maker's shop says every
   * day, which is exactly why they are checked over the bytes rather than
   * trusted to care.
   */
  it('carries none of the craft traps', () => {
    const CRAFT: readonly [string, RegExp][] = [
      ['plant', /plant/i],
      ['planter', /planter/i],
      ['tiered', /tiered/i],
      ['free postage', /free\s*postage/i],
      ['free engraving', /free\s*engraving/i],
    ];
    for (const file of emitted.filter((name) => GREPPED.test(name))) {
      const bytes = readEmitted(file);
      for (const [what, pattern] of CRAFT) {
        expect(pattern.test(bytes), `${file} contains ${what}`).toBe(false);
      }
    }
  });

  it('keeps the carve-out lists short enough to read, and reasoned', () => {
    // The two lists are the complete set of things this gate forgives, so they
    // are worth a test of their own: every entry carries a sentence saying why,
    // and both stay small enough that a reviewer actually reads them.
    expect(CARVE_OUTS.length).toBeLessThanOrEqual(4);
    for (const carve of CARVE_OUTS) expect(carve.why.length).toBeGreaterThan(30);
    expect(ALLOWED_TOKENS.length).toBeLessThanOrEqual(12);
    for (const allow of ALLOWED_TOKENS) expect(allow.why.length).toBeGreaterThan(30);
  });

  it('forgives whole words only, never a banned word glued to punctuation', () => {
    for (const bait of ['Pro.', '(pro)', 'PRO', 'pro-tier', 'The Pro one', 'proplan']) {
      expect(scanForBannedLexicon('bait', bait), bait).not.toEqual([]);
    }
    for (const fine of ['approved', 'proof', 'productKey', 'Provedení', 'stopPropagation']) {
      expect(scanForBannedLexicon('fine', fine), fine).toEqual([]);
    }
  });
});

/**
 * D11 OVER THE ARTEFACT, WHICH IS WHERE THE MUTANT REACHED.
 *
 * `sources.test.ts` states the rule over the sources; this states it over the
 * bytes a host serves. They are not the same check — an address can arrive from
 * a dependency, survive minification as a folded constant, or be written in a
 * file the source walk does not classify as shipped. A verifier put an image
 * beacon into a sibling package's component and it reached a live host's bundle
 * with every gate green.
 *
 * The one address allowed here is the SVG namespace `template.ts` writes into
 * every picture it draws: an XML namespace names a vocabulary and is never
 * dereferenced. Everything else, in any emitted file, is a finding.
 */
describe('nothing in the artefact can reach a host we do not control (24 D11)', () => {
  const BYTES = /\.(js|css|html|map)$/;
  const INERT = [
    {
      origin: 'http://www.w3.org',
      why: 'the SVG XML namespace — a name for the vocabulary, never fetched',
    },
  ];

  it('names no address the namespace declaration does not explain', () => {
    const offences = emitted
      .filter((file) => BYTES.test(file))
      .flatMap((file) =>
        offendingAddresses(readEmitted(file), INERT).map((url) => `${file} → ${url}`),
      );
    expect(offences).toEqual([]);
  });

  it('carries nothing that can issue a request', () => {
    // Every dependency is external in this build, so these bytes are this
    // package's own code and a sender in them was written here.
    const offences = emitted
      .filter((file) => BYTES.test(file))
      .flatMap((file) => [
        ...sendersIn(readEmitted(file)).map((means) => `${file} → ${means}`),
        ...foreignImportsIn(readEmitted(file)).map((spec) => `${file} → ${spec}`),
      ]);
    expect(offences).toEqual([]);
  });

  it('would report an image beacon, which is the mutant that beat the old grep', () => {
    // Driven over the detector rather than restated beside it. The mutant holds
    // none of `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`.
    const mutant = 'const img=new Image();img.src="https://tracking.example-analytics.net/p?c="+c;';
    expect(offendingAddresses(mutant, INERT)).toEqual([
      'https://tracking.example-analytics.net/p?c=',
    ]);
    expect(sendersIn(mutant)).toEqual(['new Image — an image beacon']);
  });
});
