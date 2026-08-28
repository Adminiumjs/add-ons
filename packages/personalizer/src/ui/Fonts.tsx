/**
 * THE STUDIO'S FONTS — the five alphabets this laser cuts, and which of them a
 * customer is allowed to choose from.
 *
 * ── WHY THIS IS A PAGE AND NOT A ROW OF CHECKBOXES ──────────────────────────
 *
 * `settings.add-on.panel` already carries the same switch, as a row of chips
 * beside two other settings, and that is the right shape for "change one thing
 * while you are in the settings". It is the wrong shape for the decision
 * itself, which is a TYPOGRAPHIC one: a maker deciding whether to offer Alder
 * needs to see Alder, at a size, next to the other four, with the word they
 * actually engrave in it. So this page draws every face with the maker's own
 * line in it and puts the switch on the specimen.
 *
 * ── SMALLEST IS A FACT ABOUT THE MATERIAL, NOT A SETTING ────────────────────
 *
 * `smallestMm` is per face and comes from `faces.ts`, because it is a property
 * of an alphabet on open grain rather than a shop's preference — a face with
 * hairline strokes closes up sooner than a slab. The shop WARNS at that size
 * and cuts anyway (`template.ts`), which is the maker's call to make, and the
 * footnote says so rather than leaving a number unexplained.
 *
 * ── ONE MUST STAY OFFERED ───────────────────────────────────────────────────
 *
 * Turning the last one off leaves a personalizable piece with no alphabet to be
 * cut in, and the shopper's surface would have an empty font picker and no way
 * to explain itself. The last chip refuses and says why, in the reader's own
 * language, rather than being disabled with no reason given.
 *
 * NO WEBFONT (24 D11): every specimen is drawn in the face's own `css` stack,
 * which is families a browser already has. Nothing is fetched.
 */

import { useState } from 'react';

import { FACE_LIST, type FaceId } from '../faces.ts';
import { useT } from '../i18n/t.ts';
import { Chip, Mono, Note } from './bits.tsx';

export function Fonts({
  offered,
  onChange,
}: {
  offered: readonly string[];
  onChange: (next: FaceId[]) => void;
}) {
  const t = useT();
  const [line, setLine] = useState('');
  const [refused, setRefused] = useState(false);

  const on = new Set(offered);
  const specimen = line.trim();

  function toggle(id: FaceId) {
    if (on.has(id)) {
      // Never all the way off: a piece with no alphabet cannot be cut.
      if (on.size <= 1) {
        setRefused(true);
        return;
      }
      onChange(FACE_LIST.map((f) => f.id).filter((f) => f !== id && on.has(f)));
    } else {
      onChange(FACE_LIST.map((f) => f.id).filter((f) => f === id || on.has(f)));
    }
    setRefused(false);
  }

  return (
    <div className="lp">
      <div>
        <h2 className="lp-page-title">{t('addon.personalizer.fonts.title')}</h2>
        <p className="lp-sub">{t('addon.personalizer.fonts.sub')}</p>
      </div>

      <label className="lp-control">
        <span className="lp-control-label">{t('addon.personalizer.fonts.try')}</span>
        <input
          className="lp-input"
          value={line}
          placeholder={t('addon.personalizer.fonts.tryHint')}
          onChange={(e) => setLine(e.target.value)}
        />
      </label>

      <div className="lp-faces">
        {FACE_LIST.map((face) => {
          const isOn = on.has(face.id);
          /*
           * The specimen is the maker's own line, or the face's name when they
           * have typed nothing — a name set in its own alphabet is the oldest
           * specimen there is, and it beats "The quick brown fox" for a studio
           * that engraves names.
           */
          const shown = specimen === '' ? face.name : specimen;
          return (
            <div key={face.id} className="lp-face" data-on={isOn}>
              <div
                className="lp-face-specimen"
                /*
                 * `dir="auto"` because the line inside is the MAKER'S text and
                 * may be anything; the face itself is Latin, and a right-to-left
                 * page must not reverse a specimen of it.
                 */
                dir="auto"
                style={{
                  fontFamily: face.css,
                  fontWeight: face.weight,
                  textTransform: face.upper ? 'uppercase' : 'none',
                  fontStyle: face.slantDeg === 0 ? 'normal' : 'italic',
                }}
              >
                {shown}
              </div>
              <div className="lp-face-row">
                <span className="lp-face-name">{face.name}</span>
                <span className="lp-face-smallest">
                  <span className="lp-face-smallest-label">
                    {t('addon.personalizer.fonts.smallest')}
                  </span>
                  <Mono>{t('addon.personalizer.sizeUnit', { mm: face.smallestMm })}</Mono>
                </span>
                <Chip pressed={isOn} onClick={() => toggle(face.id)}>
                  {isOn
                    ? t('addon.personalizer.fonts.offered')
                    : t('addon.personalizer.fonts.studioOnly')}
                </Chip>
              </div>
            </div>
          );
        })}
      </div>

      {refused && <Note tone="warn">{t('addon.personalizer.fonts.lastOne')}</Note>}

      <p className="lp-honest">{t('addon.personalizer.fonts.smallestNote')}</p>
    </div>
  );
}
