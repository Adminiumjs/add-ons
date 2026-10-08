/**
 * THE BUILT FILE, RUN THE WAY ADMINIUM RUNS IT.
 *
 * `dist/server.js` is never imported. Adminium compiles its bytes and runs
 * them in a bare context made for the one call: no clock, no randomness, no
 * timers, no way to make code from text, and no module loader. The input
 * crosses as JSON text and is frozen inside; the answer comes back as JSON
 * text. Every server suite of this package loads the file through here, so a
 * test that passes has passed under the same limits a save is held to — a
 * decider that reached for `Date` would work under a plain `import` and fail
 * in every real save.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import type { AdjustInput, AdjustOutput, PostingInput, PostingOutput, PostingRowsProvider, PriceAdjustProvider } from '@adminium/add-on-contracts';

import { DIST } from './build.ts';

/** Everything the file may not reach: taken off the context before its code runs. */
export const STRIPPED = ['Date', 'Intl', 'WebAssembly', 'SharedArrayBuffer', 'Atomics', 'eval', 'Function', 'queueMicrotask', 'WeakRef', 'FinalizationRegistry', 'console'];

/** The longest one call may take, and the largest file that is run. */
export const CALL_TIMEOUT_MS = 250;
export const FILE_MAX_BYTES = 512 * 1024;

const STRIP = `(function () {
  'use strict';
  for (const name of ${JSON.stringify(STRIPPED)}) {
    try { delete globalThis[name]; } catch (e) {}
    if (name in globalThis) Object.defineProperty(globalThis, name, { value: undefined, writable: false, configurable: false });
  }
  Object.defineProperty(Math, 'random', { value: undefined, writable: false, configurable: false });
})();`;

const entry = (name: 'rows' | 'adjust'): string => `(function () {
  'use strict';
  var freeze = function (value) {
    if (value !== null && typeof value === 'object') {
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i += 1) freeze(value[keys[i]]);
      Object.freeze(value);
    }
    return value;
  };
  var method = __decider === null || typeof __decider !== 'object' ? undefined : __decider.${name};
  if (typeof method !== 'function') throw new Error('the file exports no ${name}()');
  var answer = method(freeze(JSON.parse(__input)));
  if (answer !== null && typeof answer === 'object' && typeof answer.then === 'function') throw new Error('${name}() answered a promise');
  return JSON.stringify(answer);
})()`;

const wrap = (source: string): string =>
  `(function () { var module = { exports: {} }; (function (module, exports) {\n${source}\n}).call(module.exports, module, module.exports); Object.defineProperty(globalThis, '__decider', { value: module.exports, writable: false, configurable: false }); })();`;

/** The bytes of the built server file. */
export function builtServer(): string {
  return readFileSync(join(DIST, 'server.js'), 'utf8');
}

/**
 * A provider that answers from the given source in a fresh bare context per
 * call, as a save does: nothing one call left behind is there for the next.
 */
export function providerFrom(source: string): PostingRowsProvider & PriceAdjustProvider {
  const script = new vm.Script(wrap(source), { filename: 'offers:server.js' });
  const call = (name: 'rows' | 'adjust', input: unknown): unknown => {
    const context = vm.createContext(Object.create(null) as object, { codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
    vm.runInContext(STRIP, context, { timeout: CALL_TIMEOUT_MS });
    script.runInContext(context, { timeout: CALL_TIMEOUT_MS });
    Object.defineProperty(context, '__input', { value: JSON.stringify(input), writable: false });
    return JSON.parse(String(vm.runInContext(entry(name), context, { timeout: CALL_TIMEOUT_MS })));
  };
  return {
    rows: (input: PostingInput) => call('rows', input) as PostingOutput,
    adjust: (input: AdjustInput) => call('adjust', input) as AdjustOutput,
  };
}

/** The provider of the built file. Build first (`buildForReal`). */
export function builtProvider(): PostingRowsProvider & PriceAdjustProvider {
  return providerFrom(builtServer());
}
