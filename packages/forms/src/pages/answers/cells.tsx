/**
 * WHAT ONE ANSWER SHOWS, wherever it is shown: in the table, on a phone's
 * card and in the side sheet. The row it became, its files and its language.
 */
import type { ReactNode } from 'react';

import { Link, Tag, useLocaleTag, type AddOnTranslate } from '../shared/host.ts';
import { codeOf } from '../shared/row.ts';
import { Icon } from './parts.tsx';
import { shortKey, sizeOf, type AnswerFile, type Became } from './read.ts';

/** Where staff open a file a stranger sent: Adminium checks the reader may read the answer, and hands it over as a download. */
export const fileAt = (file: Pick<AnswerFile, 'fileId'>): string => `/api/v1/forms/files/${encodeURIComponent(file.fileId)}`;

/** "1042 in Enquiries", a link where the reader may open that table's page; the table's name alone where they may not. */
export function BecameText({ t, became }: { t: AddOnTranslate; became: Became | null }): ReactNode {
  if (became === null) return <span className="text-fg-subtle">—</span>;
  if (became.to === null) return <span>{became.table}</span>;
  return (
    <span className="font-semibold">
      <Link to={became.to}>{t('answers.became.row', '{key} in {table}', { key: shortKey(became.key), table: became.table })}</Link>
    </span>
  );
}

/** One file as a chip: "drawings.pdf · 2.1 MB", opened as a download. */
export function FileChip({ t, file }: { t: AddOnTranslate; file: AnswerFile }): ReactNode {
  const locale = useLocaleTag();
  const size = sizeOf(file.size, locale);
  const words = size === null ? file.name : t('answers.file.chip', '{name} · {size}', { name: file.name, size });
  return (
    <a href={fileAt(file)} download={file.name} title={words} className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-surface-3 px-2 py-1 font-mono text-caption text-fg">
      <Icon name="file-text" />
      <span className="truncate">{words}</span>
    </a>
  );
}

export function FileChips({ t, files }: { t: AddOnTranslate; files: readonly AnswerFile[] }): ReactNode {
  if (files.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {files.map((file) => (
        <FileChip key={file.id} t={t} file={file} />
      ))}
    </span>
  );
}

export function LanguageChip({ tag }: { tag: string }): ReactNode {
  if (tag === '') return null;
  return (
    <Tag>
      <span className="font-mono" lang={tag}>
        {codeOf(tag)}
      </span>
    </Tag>
  );
}
