/**
 * THE EDITOR'S STYLESHEETS, PUT ON THE PAGE ONCE.
 *
 * The canvas draws the page with the landing renderer, whose looks are its
 * own plain stylesheet (`landing.css`, classes `lp-`), the same one the page a
 * stranger sees is drawn with. The editor's own frame, selection and rows are
 * `editor.css`. An add-on's page is one script and names no stylesheet of its
 * own, so the build reads both as text and this puts them in one `<style>`
 * element in the document's head, the first time an editor opens. It is left
 * there for the next one.
 *
 * The selection is drawn by a rule of its own (`selectionRule`): the renderer
 * marks each section with `data-block-id`, and a section's id is letters,
 * digits, `_` and `-` only, so it is put in the rule as it is.
 */
import landingCss from '@adminium/add-on-contracts/landing/landing.css?raw';
import { useEffect } from 'react';

import editorCss from './editor.css?raw';

/** The id the editor's `<style>` carries, so it is put on the page once. */
export const STYLE_ID = 'adminium-landing-pages-editor';

export function useEditorStyles(): void {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${landingCss}\n${editorCss}`;
    document.head.append(style);
  }, []);
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;

/** A text as a CSS string: its quotes and back-slashes escaped, its line breaks spaces. */
export const cssText = (text: string): string => `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;

const at = (id: string): string => `[data-lpe-frame] .lp-block[data-block-id="${id}"]`;

/**
 * The canvas's own marks, as rules: the selected section's ring (its "Edit"
 * button stays in sight), "Milo · check" on each section Milo wrote and nobody
 * looked at yet, and the line where a new section goes. An id that is not a
 * section id draws nothing.
 */
export function canvasRules(input: { selected: string | null; marked: readonly string[]; gap: string | null; words: { milo: string; gap: string } }): string {
  const rules: string[] = [];
  if (input.selected !== null && SAFE_ID.test(input.selected)) rules.push(`${at(input.selected)}{outline:2px solid var(--accent);outline-offset:-2px;}`, `${at(input.selected)} > .lp-edit{opacity:1;}`);
  for (const id of input.marked.filter((one) => SAFE_ID.test(one))) rules.push(`${at(id)}::after{content:${cssText(input.words.milo)};}`);
  if (input.gap !== null && SAFE_ID.test(input.gap)) rules.push(`${at(input.gap)}::before{content:${cssText(input.words.gap)};}`);
  return rules.join('\n');
}
