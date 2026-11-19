/**
 * THE `record.actions` FILL: "Fill in details" on a company's record.
 *
 * The module the manifest's slot fill points at (`dist/client.js`). Its
 * `register()` hands the host one fill: the action's words in every language
 * (the button and the sheet's title), its icon, and `render`, which draws the
 * sheet's content for the record the host hands it. The host mounts it only
 * on a table an app declares as companies, for a reader who may change the
 * record, in its own sheet (focus held inside, Escape closes it).
 */
import { createElement, type ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { DOOR, FILL, SHARED, SOURCE } from '../strings/index.ts';
import { FillSheet, type RecordActionPayload } from './FillSheet.tsx';

const t = wordsFor(SHARED, SOURCE, DOOR, FILL);

/** The action's name in every language the screens ship. */
const LABELS: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(FILL).map(([tag, words]) => [tag, words['fill.title'] ?? 'Fill in details']));

export interface RecordActionFill {
  slot: 'record.actions';
  order: number;
  /** The button's words and the sheet's title, in the reader's language when the host asks. */
  label: string;
  labels: Readonly<Record<string, string>>;
  icon: string;
  /** The kind of record it is for: a table an app declares as companies. */
  kind: 'companies';
  render: (payload: RecordActionPayload) => ReactNode;
}

export function register(): { key: string; fills: RecordActionFill[] } {
  return {
    key: 'lead-finder',
    fills: [
      {
        slot: 'record.actions',
        order: 10,
        label: t('fill.title', 'Fill in details'),
        labels: LABELS,
        icon: 'scan-search',
        kind: 'companies',
        // An element, not a call: the host maps fills inside its own render, so a fill's hooks are its own.
        render: (payload) => createElement(FillSheet, { t, payload }),
      },
    ],
  };
}
