/**
 * A PICTURE ON THE PAGE (comp `States` 775-799; D59, D-M6-2): the picture,
 * "Choose from Files", "Upload", its description read aloud, or "It's only
 * decoration".
 *
 * A page shows only its own copy of a picture: whichever way one is chosen,
 * the engine keeps a cleaned copy for the page (PNG, JPEG, WebP or GIF of up
 * to 5 MB, never SVG) and the page names that copy. A file it refuses leaves
 * the picture as it was and says why, in a line read out at once. While a
 * file goes up, the button says so and waits.
 *
 * Files opens as a sheet over the editor, never as another screen: the page
 * stays where it is.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { asDataError, Button, Checkbox, Input, SearchInput, Sheet, SheetBody, SheetHeader, Spinner, type AddOnTranslate } from '../shared/host.ts';
import { hostUpload } from '../shared/upload.ts';
import { PAGES_TABLE } from '../shared/paths.ts';
import type { Picture } from './doc.ts';
import { keepPicture, pictureFits, pictureSrc, readFiles, type LibraryPicture } from './engine.ts';
import { Icon } from './Canvas.tsx';
import { refusalWords } from './words.ts';
import { LANDING_TEXT_MAX } from '@adminium/add-on-contracts/landing';

/** The column the kit's upload puts a picture into before the engine keeps the page's copy. */
export const UPLOAD_COLUMN = 'picture_upload';

const kitUpload = hostUpload();

/** The kit's upload, or nothing on a host without one (Files only, then). */
function useUploadInto(): ((key: string, file: File) => Promise<string>) | null {
  const upload = kitUpload?.(PAGES_TABLE, UPLOAD_COLUMN);
  if (upload === undefined) return null;
  return async (key, file) => (await upload.upload(key, file, { name: file.name })).id;
}

export interface PictureFieldProps {
  t: AddOnTranslate;
  pageKey: string;
  /** What the field is called ("Picture", "Sharing picture"). */
  label: string;
  value: Picture | undefined;
  mayEdit: boolean;
  /** The id of the field's description input, unique on the screen. */
  id: string;
  /** The sharing picture is never read aloud on the page: it asks for no description. */
  describe?: boolean;
  onChange: (next: Picture | undefined, group?: string) => void;
  /** An optional picture may be taken off; a Picture section's may not. */
  removable?: boolean;
}

export function PictureField({ t, pageKey, label, value, mayEdit, id, describe = true, onChange, removable = false }: PictureFieldProps): ReactNode {
  const uploadInto = useUploadInto();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const decorative = value !== undefined && 'decorative' in value;
  const alt = value !== undefined && 'alt' in value ? value.alt : '';
  const file = value?.file ?? '';
  const keep = (next: string): void => onChange(decorative ? { file: next, decorative: true } : { file: next, alt });

  const take = async (from: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setRefused(null);
    try {
      keep(await keepPicture(pageKey, await from()));
    } catch (caught) {
      setRefused(refusalWords(t, asDataError(caught)));
    } finally {
      setBusy(false);
    }
  };

  const chosen = (picked: File | undefined): void => {
    if (picked === undefined || uploadInto === null) return;
    // Judged here first, as the server judges it again: a file it would refuse is never sent.
    if (!pictureFits(picked)) {
      setRefused(t('editor.picture.refused', 'This file can’t be used. Use a PNG, JPEG, WebP or GIF of up to 5 MB.'));
      return;
    }
    void take(() => uploadInto(pageKey, picked));
  };

  return (
    <div data-lpe-fields="">
      <span data-lpe-micro="">{label}</span>
      {file === '' ? (
        <span data-lpe-placeholder="">{t('editor.picture.none', 'No picture chosen yet.')}</span>
      ) : (
        <img data-lpe-thumb="" {...(describe ? {} : { 'data-lpe-share': '' })} src={pictureSrc(pageKey, file)} alt="" />
      )}
      {busy ? (
        <span className="flex items-center gap-2 text-[12.5px] text-fg-muted" aria-busy="true">
          <Spinner size="sm" />
          <span role="status">{t('editor.picture.uploading', 'Uploading…')}</span>
        </span>
      ) : null}
      {mayEdit ? (
        <div className="flex flex-wrap gap-2" {...(busy ? { 'data-lpe-busy': '' } : {})}>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="folder" />} disabled={busy} onClick={() => setChoosing(true)}>
            {t('editor.picture.files', 'Choose from Files')}
          </Button>
          {uploadInto === null ? null : (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" tabIndex={-1} aria-hidden="true" className="hidden" onChange={(event) => {
                chosen(event.target.files?.[0]);
                event.target.value = '';
              }} />
              <Button variant="secondary" size="sm" iconLeft={<Icon name="upload" />} disabled={busy} onClick={() => input.current?.click()}>
                {t('editor.picture.upload', 'Upload')}
              </Button>
            </>
          )}
          {removable && value !== undefined ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              {t('editor.picture.remove', 'Remove')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {refused === null ? null : (
        <p data-lpe-alert="" role="alert">
          <Icon name="circle-alert" />
          <span>{refused}</span>
        </p>
      )}
      {describe && value !== undefined ? (
        <>
          <Input
            id={id}
            label={t('editor.picture.alt', 'Describe the picture')}
            hint={t('editor.picture.altHint', 'Read aloud to people who can’t see it.')}
            value={alt}
            maxLength={LANDING_TEXT_MAX.alt}
            disabled={!mayEdit || decorative}
            onChange={(event) => onChange({ file, alt: event.target.value }, `${id}:alt`)}
          />
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={decorative} disabled={!mayEdit} onCheckedChange={(on) => onChange(on ? { file, decorative: true } : { file, alt: '' })} />
            <span>{t('editor.picture.decorative', 'It’s only decoration')}</span>
          </label>
        </>
      ) : null}
      <FilesSheet
        t={t}
        open={choosing}
        onOpenChange={setChoosing}
        onPick={(picked) => {
          setChoosing(false);
          void take(async () => picked.id);
        }}
      />
    </div>
  );
}

/** The pictures in Files, to choose one from, in a sheet over the editor. */
function FilesSheet({ t, open, onOpenChange, onPick }: { t: AddOnTranslate; open: boolean; onOpenChange: (open: boolean) => void; onPick: (file: LibraryPicture) => void }): ReactNode {
  const [q, setQ] = useState('');
  const [files, setFiles] = useState<readonly LibraryPicture[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    const timer = setTimeout(() => {
      readFiles(q).then(
        (found) => (live ? setFiles(found) : undefined),
        () => (live ? setFailed(true) : undefined),
      );
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, q]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} maxWidth={640}>
      <SheetHeader icon={<Icon name="folder" />} title={t('editor.files.title', 'Choose from Files')} subtitle={t('editor.files.subtitle', 'PNG, JPEG, WebP or GIF of up to 5 MB. The page keeps its own copy.')} closeLabel={t('editor.close', 'Close')} />
      <SheetBody>
        <div className="flex flex-col gap-3">
          <SearchInput value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('editor.files.search', 'Search pictures')} aria-label={t('editor.files.search', 'Search pictures')} />
          {failed ? <p data-lpe-alert="" role="alert">{t('editor.files.failed', 'Files could not be read. Try again.')}</p> : null}
          {files === null && !failed ? <Spinner label={t('editor.files.loading', 'Reading Files…')} /> : null}
          {files !== null && files.length === 0 ? <p data-lpe-note="">{t('editor.files.none', 'No pictures in Files yet.')}</p> : null}
          {files !== null && files.length > 0 ? (
            <div data-lpe-files="">
              {files.map((file) => (
                <button key={file.id} type="button" data-lpe-card="" onClick={() => onPick(file)}>
                  <img src={file.src} alt="" />
                  <span>
                    <bdi>{file.filename}</bdi>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </SheetBody>
    </Sheet>
  );
}
