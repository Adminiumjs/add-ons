/**
 * WHAT GOES TO THE MACHINE — comp L's screen 5, and the payoff.
 *
 * The piece's outline as a cut path, the personalization as filled paths, the
 * layers colour-coded and listed with each one's length or area in millimetres,
 * the material and the finished size, and a download.
 *
 * TWO HONEST LINES SHIP HERE AND BOTH ARE LOAD-BEARING. The first is the one
 * 24 §8B quotes verbatim — "This is a file, not a machine — send it to your
 * laser the way you always do" — because this add-on stops at the file and D5c
 * says so. The second says what the letters in it are: the studio's own cut
 * alphabet, at exactly the size and place the customer's picture shows. A
 * reader who compares the two side by side will notice the letterforms differ,
 * and being told why by the interface is better than working it out.
 *
 * The file is offered as a download through a `blob:` URL built from bytes this
 * package computed. That is not a network call — nothing leaves the browser and
 * nothing is fetched (24 D11); `sources.test.ts` greps this file for `fetch`
 * along with everything else.
 */

import type { Personalization, Template } from '@adminium/add-on-host/contracts';

import type { MessageKey } from '../i18n/strings.ts';
import { useNumber, useT } from '../i18n/t.ts';
import { pieceFor } from '../pieces.ts';
import { LAYER_COLOUR, nameSvg, productionSvg, toProductionPaths } from '../template.ts';
import { Mono } from './bits.tsx';

export function Production({
  personalization,
  template,
}: {
  personalization: Personalization;
  template: Template;
}) {
  const t = useT();
  const number = useNumber();
  const file = toProductionPaths(personalization, template);
  const svg = productionSvg(personalization, template);
  const piece = pieceFor(template.productKey);

  const download = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.productKey}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lp">
      <div className="lp-panel">
        <div className="lp-panel-title">{t('addon.personalizer.prod.title')}</div>

        {/*
         * The file itself, drawn as the file — paths on a neutral ground, not
         * the material tile. What a maker opens is geometry.
         *
         * AND IT IS NAMED, for the same reason the preview is: an unnamed
         * `<svg>` is announced as a graphic with nothing to say, and this one
         * IS the thing the panel is about. The name is the panel's own heading,
         * because that is what the picture is — "what goes to the machine" —
         * and because a name that repeated the geometry would say nothing a
         * reader could use.
         */}
        <div
          className="lp-file"
          dangerouslySetInnerHTML={{ __html: nameSvg(svg, t('addon.personalizer.prod.title')) }}
        />

        <div className="lp-layers">
          {file.layers.map((layer) => (
            <div key={layer.layer} className="lp-layer">
              <span
                className="lp-layer-swatch"
                style={{ background: LAYER_COLOUR[layer.layer] }}
                aria-hidden="true"
              />
              <span className="lp-layer-name">
                {t(`addon.personalizer.prod.layer.${layer.layer}` as never)}
              </span>
              <span className="lp-layer-figures">
                <span>{t('addon.personalizer.prod.count', { count: number(layer.count) })}</span>
                {layer.lengthMm > 0 && (
                  <span>{t('addon.personalizer.prod.length', { mm: number(layer.lengthMm) })}</span>
                )}
                {layer.areaMm2 > 0 && (
                  <span>{t('addon.personalizer.prod.area', { mm: number(layer.areaMm2) })}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="lp-row">
          <span className="lp-control-label">{t('addon.personalizer.prod.material')}</span>
          {/*
           * THE MATERIAL'S NAME, NOT ITS KEY.
           *
           * [Corrected 2026-08-11, wave 4b round 5.] This was
           * `<Mono>{file.materialId}</Mono>` — the literal string `walnut`, in
           * every locale, under a label reading `الخامة` and three rows from the
           * studio's own `جوز` for the same board. A maker reading a production
           * file wants the material they can pick up, and `walnut` is neither
           * that nor a code they have any use for.
           *
           * The names are THIS add-on's to give: `MATERIALS` in `pieces.ts` is
           * its own table of four, not a mirror of any host's catalogue, so
           * naming them here takes no host vocabulary and states nothing about
           * how a shop works.
           */}
          <span>{t(`addon.personalizer.material.${file.materialId}` as MessageKey)}</span>
          <span className="lp-control-label">{t('addon.personalizer.prod.size')}</span>
          <Mono>
            {t('addon.personalizer.sizeUnit', {
              mm: `${number(piece.widthMm)} × ${number(piece.heightMm)}`,
            })}
          </Mono>
        </div>

        <p className="lp-honest">{t('addon.personalizer.prod.honest')}</p>
        <p className="lp-honest">{t('addon.personalizer.prod.alphabet')}</p>

        <div className="lp-row">
          <button type="button" className="lp-button lp-button--primary" onClick={download}>
            {t('addon.personalizer.prod.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
