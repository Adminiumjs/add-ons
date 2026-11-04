/**
 * THE ARROW KEYS IN A ROW OF CHOICES.
 *
 * Every row of choices in the editor (fonts, finishes, layouts, palettes, a
 * card's side, Assembled or Pieces…) is a `radiogroup` of buttons. Each
 * button is a stop for Tab and takes Space or Enter, as a button does; the
 * arrow keys also move along the row and choose, as a row of radio buttons
 * does in every browser. Left and right follow the page's direction: on a
 * right-to-left page the next choice is to the left. Home and End go to the
 * first and the last.
 *
 * One handler on the editor's root does it for every row, the dialogs'
 * among them, so a new row needs nothing of its own.
 */
import type { KeyboardEvent } from 'react';

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const BACK = new Set(['ArrowLeft', 'ArrowUp']);

export function radioKeys(event: KeyboardEvent<HTMLElement>): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const { key } = event;
  if (!NEXT.has(key) && !BACK.has(key) && key !== 'Home' && key !== 'End') return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.getAttribute('role') !== 'radio') return;
  const group = target.closest('[role="radiogroup"]');
  if (group === null) return;
  const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter((one) => one.closest('[role="radiogroup"]') === group && !one.hasAttribute('disabled') && one.getAttribute('aria-disabled') !== 'true');
  const at = radios.indexOf(target);
  if (at === -1 || radios.length < 2) return;
  const rtl = target.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const forward = NEXT.has(key) !== (rtl && horizontal);
  const to = key === 'Home' ? 0 : key === 'End' ? radios.length - 1 : (at + (forward ? 1 : -1) + radios.length) % radios.length;
  event.preventDefault();
  event.stopPropagation();
  const next = radios[to]!;
  next.focus();
  next.click();
}
