/**
 * "QR code": the code of the form's link on a white frame (white in a dark
 * theme too, or a phone's camera loses the quiet zone), and the code as a
 * PNG or an SVG file named after the form.
 */
import { useMemo, type ReactNode } from 'react';

import { Alert, Button, Card, type AddOnTranslate } from '../shared/host.ts';
import { useToast } from '../shared/toast.ts';
import { CardTitle, Icon } from './parts.tsx';
import { pictureOf, pngFile, qrFileName, qrOf, saveFile, svgFile } from './qr.ts';

export function QrCard({ t, link, slug }: { t: AddOnTranslate; link: string; slug: string }): ReactNode {
  const toast = useToast();
  const qr = useMemo(() => qrOf(link), [link]);
  const title = <CardTitle icon="qr-code">{t('share.qr.title', 'QR code')}</CardTitle>;
  if (qr === null) {
    return (
      <Card title={title}>
        <Alert tone="warn" title={t('share.qr.tooLong', 'This link is too long for a QR code.')} />
      </Card>
    );
  }
  const save = (kind: 'png' | 'svg', file: Blob): void => {
    const name = qrFileName(slug, kind);
    saveFile(name, file);
    toast(t('share.qr.downloading', 'Downloading {file}', { file: name }), 'info');
  };
  return (
    <Card title={title}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="block rounded-[10px] border border-border bg-white p-2">
          <img src={pictureOf(qr.svg)} width={176} height={176} alt={t('share.qr.alt', 'QR code for {link}', { link })} className="block rounded-[6px]" />
        </span>
        <div className="flex min-w-[140px] flex-1 flex-col gap-2">
          <span className="text-[12.5px] text-fg-muted">{t('share.qr.body', 'Opens the same link. Good for flyers and the showroom door.')}</span>
          <Button
            variant="secondary"
            iconLeft={<Icon name="download" />}
            onClick={() =>
              void pngFile(qr).then(
                (file) => save('png', file),
                () => toast(t('share.qr.pngFailed', 'The PNG could not be made. Download the SVG instead.'), 'error'),
              )
            }
          >
            {t('share.qr.png', 'Download PNG')}
          </Button>
          <Button variant="secondary" iconLeft={<Icon name="download" />} onClick={() => save('svg', svgFile(qr))}>
            {t('share.qr.svg', 'Download SVG')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
