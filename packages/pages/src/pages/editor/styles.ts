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

/** The rule that draws the selected section's ring; empty when nothing (or nothing drawable) is selected. */
export function selectionRule(id: string | null): string {
  if (id === null || !SAFE_ID.test(id)) return '';
  return `[data-lpe-frame] .lp-block[data-block-id="${id}"]{outline:2px solid var(--accent);outline-offset:-2px;}`;
}
