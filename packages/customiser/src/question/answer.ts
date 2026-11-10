/**
 * THE DESIGN QUESTION, ANSWERED FROM THE RULES.
 *
 * Each line of Adminium's question is one design with the rows the manifest's
 * checker read for it. Its answer is what the customer's editor already said:
 * whether it stands, what refuses it, and which priced features it takes.
 * The advice the customer sees stays in the browser: the server never
 * refuses on it.
 */
import type { CheckAnswer, CheckInput, CheckLine, CheckOutput } from '@adminium/add-on-contracts';

import { checkDesign, type DesignFacts } from '../rules/index.ts';

/** One line's design, as the rules read it. */
export function factsOf(line: CheckLine, settings: CheckInput['settings']): DesignFacts {
  const rows = (id: string) => line.rows[id] ?? [];
  return {
    design: line.design,
    ready: rows('ready')[0] ?? null,
    parts: rows('parts'),
    base: rows('base')[0] ?? null,
    areas: rows('areas'),
    palettes: rows('palettes'),
    features: rows('features'),
    fonts: rows('fonts'),
    files: line.files,
    settings,
  };
}

export function check(input: CheckInput): CheckOutput {
  return {
    lines: input.lines.map((line): CheckAnswer => {
      const answer = checkDesign(factsOf(line, input.settings));
      return { key: line.key, ok: answer.ok, used: answer.used, refusals: answer.refusals };
    }),
  };
}

